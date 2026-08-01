use anyhow::{anyhow, Context, Result};
use base64::Engine;
use chrono::{DateTime, Utc};
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};
use reqwest::header::{ACCEPT, CONTENT_TYPE, LOCATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::{
    collections::HashSet,
    env,
    fs::{self, File, OpenOptions},
    io::{self, BufReader, Cursor, Read, Seek, Write},
    net::{IpAddr, SocketAddr},
    path::{Component, Path, PathBuf},
    sync::Mutex,
    time::{Duration, SystemTime},
};
use tauri::{ipc::Channel, AppHandle, Manager, State, Window};
use tokio::{net::lookup_host, time::timeout};
use url::Url;
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

const APP_NAME: &str = "Inkubator";
const GITHUB_REPO: &str = "aloglu/inkubator";
const GITHUB_RELEASES_URL: &str = "https://github.com/aloglu/inkubator/releases";
const MAX_REMOTE_IMAGE_BYTES: usize = 25 * 1024 * 1024;
const MAX_BACKUP_COMPRESSED_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_BACKUP_ENTRIES: usize = 20_000;
const MAX_BACKUP_EXPANDED_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_BACKUP_RASTER_PIXELS: u64 = 100_000_000;
const MAX_BACKUP_RASTER_DECODE_BYTES: u64 = 512 * 1024 * 1024;
const MAX_REMOTE_REDIRECTS: usize = 5;
const REMOTE_IMAGE_TIMEOUT: Duration = Duration::from_secs(15);
const AUTO_BACKUP_DEFAULT_MAX_FILES: usize = 30;
const AUTO_BACKUP_HARD_MAX_FILES: usize = 365;
const PUBLIC_RECENT_ACTIVITY_LIMIT: usize = 5;
const MANAGED_IMAGE_SUBDIRS: [&str; 3] = ["pens", "inks", "swatches"];
const ALLOWED_IMAGE_EXTENSIONS: [&str; 7] = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif"];
const PUBLIC_IMAGE_EXTENSIONS: [&str; 5] = ["jpg", "jpeg", "png", "webp", "avif"];
const TRANSACTION_MARKER_NAME: &str = "transaction.json";
const STORAGE_REVISION_KEY: &str = "_inkubator_storage_revision";
const MAX_METADATA_FILENAME_STEM_LEN: usize = 160;

#[derive(Default)]
struct InkubatorState {
    selected_external_image_paths: Mutex<HashSet<PathBuf>>,
    selected_backup_paths: Mutex<HashSet<PathBuf>>,
}

#[derive(Debug, Deserialize)]
struct ImportOptions {
    auto_validate_import: Option<bool>,
}

#[derive(Debug)]
struct StoragePaths {
    root: PathBuf,
    data: PathBuf,
    preferences: PathBuf,
    images: PathBuf,
    replaced_images: PathBuf,
}

impl StoragePaths {
    fn new(root: PathBuf) -> Self {
        Self {
            data: root.join("data.json"),
            preferences: root.join("preferences.json"),
            images: root.join("images"),
            replaced_images: root.join("replaced-images"),
            root,
        }
    }
}

struct StorageLock {
    file: File,
}

impl Drop for StorageLock {
    fn drop(&mut self) {
        let _ = File::unlock(&self.file);
    }
}

#[derive(Debug)]
struct StagedCommitItem {
    label: &'static str,
    staged: Option<PathBuf>,
    target: PathBuf,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct TransactionMarker {
    version: u32,
    state: String,
    items: Vec<TransactionMarkerItem>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct TransactionMarkerItem {
    target: String,
    rollback: String,
    had_target: bool,
    #[serde(default)]
    has_staged: bool,
}

#[derive(Debug)]
struct DownloadedRemoteImage {
    bytes: Vec<u8>,
    final_url: Url,
    mime_type: String,
}

#[derive(Debug, Deserialize)]
struct ConfirmOptions {
    title: Option<String>,
    message: Option<String>,
    detail: Option<String>,
    #[allow(dead_code)]
    buttons: Option<Vec<String>>,
}

fn command_error(error: anyhow::Error) -> String {
    error.to_string()
}

fn normalize_version_for_compare(raw_version: &str) -> Option<Vec<u64>> {
    let cleaned = raw_version
        .trim()
        .trim_start_matches(['v', 'V'])
        .split(['+', '-'])
        .next()
        .unwrap_or("");
    if cleaned.is_empty() {
        return None;
    }
    let mut parts = Vec::new();
    for part in cleaned.split('.') {
        parts.push(part.parse::<u64>().ok()?);
    }
    Some(parts)
}

fn compare_versions(current_version: &str, latest_version: &str) -> i8 {
    let Some(current) = normalize_version_for_compare(current_version) else {
        return 0;
    };
    let Some(latest) = normalize_version_for_compare(latest_version) else {
        return 0;
    };
    let max_len = current.len().max(latest.len());
    for index in 0..max_len {
        let current_part = *current.get(index).unwrap_or(&0);
        let latest_part = *latest.get(index).unwrap_or(&0);
        if current_part > latest_part {
            return 1;
        }
        if current_part < latest_part {
            return -1;
        }
    }
    0
}

fn release_version_state(current_version: &str, latest_version: &str) -> &'static str {
    if latest_version.trim().is_empty() {
        return "unknown";
    }
    match compare_versions(current_version, latest_version) {
        value if value < 0 => "update_available",
        value if value > 0 => "ahead_of_latest",
        _ => "up_to_date",
    }
}

fn normalize_data_dir_override(value: Option<&str>) -> Option<PathBuf> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

fn desktop_data_dir_override() -> Option<PathBuf> {
    env::var("INKUBATOR_DATA_DIR")
        .ok()
        .and_then(|value| normalize_data_dir_override(Some(&value)))
}

fn app_storage_dir(app: &AppHandle) -> Result<PathBuf> {
    if let Some(path) = desktop_data_dir_override() {
        return Ok(path);
    }

    app.path()
        .app_data_dir()
        .context("Could not resolve application data directory")
}

fn storage_paths(app: &AppHandle) -> Result<StoragePaths> {
    Ok(StoragePaths::new(app_storage_dir(app)?))
}

fn acquire_storage_lock(root: &Path) -> Result<StorageLock> {
    fs::create_dir_all(root)?;
    let lock_path = root.join(".inkubator.lock");
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(&lock_path)
        .with_context(|| format!("Could not open storage lock {}", lock_path.display()))?;
    File::lock(&file).with_context(|| format!("Could not lock storage {}", root.display()))?;
    Ok(StorageLock { file })
}

fn acquire_recovered_storage_lock(root: &Path) -> Result<StorageLock> {
    let lock = acquire_storage_lock(root)?;
    recover_interrupted_transactions(root).with_context(|| {
        format!(
            "Could not recover interrupted storage transaction in {}",
            root.display()
        )
    })?;
    Ok(lock)
}

fn acquire_app_storage_lock(app: &AppHandle) -> Result<StorageLock> {
    acquire_recovered_storage_lock(&app_storage_dir(app)?)
}

fn data_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_storage_dir(app)?.join("data.json"))
}

fn preferences_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_storage_dir(app)?.join("preferences.json"))
}

fn images_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_storage_dir(app)?.join("images"))
}

fn replaced_images_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_storage_dir(app)?.join("replaced-images"))
}

fn backups_root(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_storage_dir(app)?.join("backups"))
}

fn auto_backups_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(backups_root(app)?.join("auto"))
}

fn manual_backups_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(backups_root(app)?.join("manual"))
}

fn frontend_source_root(app: &AppHandle) -> Result<PathBuf> {
    if let Some(path) = app.path().resource_dir().ok().map(|path| path.join("app")) {
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_dir() => return Ok(path),
            Ok(_) => {
                return Err(anyhow!(
                    "Bundled app source is not a real directory: {}",
                    path.display()
                ))
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }

    #[cfg(debug_assertions)]
    {
        let manifest_app = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or_else(|| anyhow!("Could not resolve repository root"))?
            .join("app");
        match fs::symlink_metadata(&manifest_app) {
            Ok(metadata) if metadata.file_type().is_dir() => return Ok(manifest_app),
            Ok(_) => {
                return Err(anyhow!(
                    "Bundled app source is not a real directory: {}",
                    manifest_app.display()
                ))
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }

    Err(anyhow!(
        "Could not find bundled app files needed for showcase export."
    ))
}

fn ensure_managed_image_dirs(root: &Path) -> Result<()> {
    for dir in MANAGED_IMAGE_SUBDIRS {
        fs::create_dir_all(root.join(dir))
            .with_context(|| format!("Could not create image directory {dir}"))?;
    }
    Ok(())
}

fn ensure_real_directory(path: &Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_dir() => Ok(()),
        Ok(_) => Err(anyhow!(
            "Managed image directory is not a real directory: {}",
            path.display()
        )),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            fs::create_dir(path).with_context(|| {
                format!(
                    "Could not create managed image directory {}",
                    path.display()
                )
            })?;
            if let Some(parent) = path.parent() {
                sync_directory(parent)?;
            }
            Ok(())
        }
        Err(error) => Err(error).with_context(|| {
            format!(
                "Could not inspect managed image directory {}",
                path.display()
            )
        }),
    }
}

fn ensure_real_subdirectory(parent: &Path, name: &str) -> Result<PathBuf> {
    if name.is_empty()
        || Path::new(name).components().count() != 1
        || !matches!(
            Path::new(name).components().next(),
            Some(Component::Normal(_))
        )
    {
        return Err(anyhow!("Invalid managed image directory component."));
    }
    let path = parent.join(name);
    ensure_real_directory(&path)?;
    Ok(path)
}

fn ensure_managed_write_roots(storage_root: &Path, section: &str) -> Result<(PathBuf, PathBuf)> {
    if !MANAGED_IMAGE_SUBDIRS.contains(&section) {
        return Err(anyhow!("Invalid managed image section."));
    }
    ensure_real_directory(storage_root)?;
    let images = ensure_real_subdirectory(storage_root, "images")?;
    let thumbnails = ensure_real_subdirectory(&images, ".thumbs")?;
    let image_section = ensure_real_subdirectory(&images, section)?;
    let thumbnail_section = ensure_real_subdirectory(&thumbnails, section)?;
    Ok((image_section, thumbnail_section))
}

fn ensure_managed_storage_tree(storage_root: &Path) -> Result<()> {
    for section in MANAGED_IMAGE_SUBDIRS {
        ensure_managed_write_roots(storage_root, section)?;
    }
    Ok(())
}

fn ensure_backup_storage_tree(storage_root: &Path) -> Result<()> {
    ensure_real_directory(storage_root)?;
    let backups = ensure_real_subdirectory(storage_root, "backups")?;
    ensure_real_subdirectory(&backups, "auto")?;
    ensure_real_subdirectory(&backups, "manual")?;
    Ok(())
}

fn ensure_real_relative_directory(root: &Path, relative: &Path) -> Result<PathBuf> {
    ensure_real_directory(root)?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err(anyhow!("Invalid managed image directory path."));
        };
        let name = name
            .to_str()
            .ok_or_else(|| anyhow!("Managed image directory path is not valid UTF-8."))?;
        current = ensure_real_subdirectory(&current, name)?;
    }
    Ok(current)
}

fn require_real_regular_file(path: &Path, label: &str) -> Result<()> {
    let metadata = fs::symlink_metadata(path)
        .with_context(|| format!("Could not inspect {label} {}", path.display()))?;
    if !metadata.file_type().is_file() {
        return Err(anyhow!(
            "{label} is not a real regular file: {}",
            path.display()
        ));
    }
    Ok(())
}

fn read_json(path: &Path) -> Result<Value> {
    let raw =
        fs::read(path).with_context(|| format!("Could not read JSON file {}", path.display()))?;
    serde_json::from_slice(&raw)
        .with_context(|| format!("Could not parse JSON file {}", path.display()))
}

fn sync_directory_best_effort(path: &Path) {
    if let Ok(directory) = File::open(path) {
        let _ = directory.sync_all();
    }
}

#[cfg(unix)]
fn sync_directory(path: &Path) -> Result<()> {
    File::open(path)
        .with_context(|| format!("Could not open directory {} for syncing", path.display()))?
        .sync_all()
        .with_context(|| format!("Could not sync directory {}", path.display()))
}

#[cfg(not(unix))]
fn sync_directory(path: &Path) -> Result<()> {
    // The standard library cannot portably open directories on Windows.
    sync_directory_best_effort(path);
    Ok(())
}

#[cfg(unix)]
fn sync_file(path: &Path) -> Result<()> {
    OpenOptions::new()
        .read(true)
        .open(path)
        .with_context(|| format!("Could not open {} for syncing", path.display()))?
        .sync_all()
        .with_context(|| format!("Could not sync {}", path.display()))
}

#[cfg(not(unix))]
fn sync_file(path: &Path) -> Result<()> {
    let open_for_sync = || OpenOptions::new().read(true).write(true).open(path);
    let file = match open_for_sync() {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => {
            let mut permissions = fs::metadata(path)?.permissions();
            if !permissions.readonly() {
                return Err(error)
                    .with_context(|| format!("Could not open {} for syncing", path.display()));
            }
            // Windows FlushFileBuffers requires write access. These are staged
            // copies, so clearing their inherited read-only flag is safe.
            permissions.set_readonly(false);
            fs::set_permissions(path, permissions)?;
            open_for_sync()
                .with_context(|| format!("Could not open {} for syncing", path.display()))?
        }
        Err(error) => {
            return Err(error)
                .with_context(|| format!("Could not open {} for syncing", path.display()))
        }
    };
    file.sync_all()
        .with_context(|| format!("Could not sync {}", path.display()))
}

fn write_file_synced(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .with_context(|| format!("Could not exclusively create {}", path.display()))?;
    let result = (|| -> Result<()> {
        file.write_all(bytes)
            .with_context(|| format!("Could not write {}", path.display()))?;
        file.sync_all()
            .with_context(|| format!("Could not sync {}", path.display()))?;
        Ok(())
    })();
    if let Err(error) = result {
        drop(file);
        let _ = fs::remove_file(path);
        return Err(error);
    }
    drop(file);
    if let Some(parent) = path.parent() {
        sync_directory(parent)?;
    }
    Ok(())
}

fn sync_tree_files(path: &Path) -> Result<()> {
    let metadata = fs::symlink_metadata(path)
        .with_context(|| format!("Could not inspect staged path {}", path.display()))?;
    if metadata.file_type().is_file() {
        return sync_file(path);
    }
    if !metadata.file_type().is_dir() {
        return Err(anyhow!(
            "Staged import contains an unsupported filesystem entry at {}",
            path.display()
        ));
    }
    for entry in fs::read_dir(path)? {
        sync_tree_files(&entry?.path())?;
    }
    sync_directory(path)
}

#[cfg(not(windows))]
fn replace_existing_file_atomic(staged: &Path, destination: &Path) -> Result<()> {
    fs::rename(staged, destination).with_context(|| {
        format!(
            "Could not atomically replace {} with {}",
            destination.display(),
            staged.display()
        )
    })
}

#[cfg(windows)]
fn replace_existing_file_atomic(staged: &Path, destination: &Path) -> Result<()> {
    use std::{ffi::c_void, os::windows::ffi::OsStrExt, ptr};

    #[link(name = "Kernel32")]
    unsafe extern "system" {
        #[link_name = "ReplaceFileW"]
        fn replace_file_w(
            replaced_file_name: *const u16,
            replacement_file_name: *const u16,
            backup_file_name: *const u16,
            replace_flags: u32,
            exclude: *mut c_void,
            reserved: *mut c_void,
        ) -> i32;
    }

    let destination_wide = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let staged_wide = staged
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let replaced = unsafe {
        replace_file_w(
            destination_wide.as_ptr(),
            staged_wide.as_ptr(),
            ptr::null(),
            0,
            ptr::null_mut(),
            ptr::null_mut(),
        )
    };
    if replaced == 0 {
        return Err(io::Error::last_os_error()).with_context(|| {
            format!(
                "Could not atomically replace {} with {}",
                destination.display(),
                staged.display()
            )
        });
    }
    Ok(())
}

#[derive(Debug)]
struct InstalledFileDirectorySyncError {
    destination: PathBuf,
    cause: String,
}

impl std::fmt::Display for InstalledFileDirectorySyncError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "{} was installed, but its directory could not be synced: {}",
            self.destination.display(),
            self.cause
        )
    }
}

impl std::error::Error for InstalledFileDirectorySyncError {}

fn installed_file_sync_error(destination: &Path, cause: anyhow::Error) -> anyhow::Error {
    InstalledFileDirectorySyncError {
        destination: destination.to_path_buf(),
        cause: cause.to_string(),
    }
    .into()
}

fn file_was_installed_before_error(error: &anyhow::Error) -> bool {
    error
        .chain()
        .any(|cause| cause.is::<InstalledFileDirectorySyncError>())
}

fn promote_synced_file_with<F, S>(
    staged: &Path,
    destination: &Path,
    replace_existing: F,
    sync_parent: S,
) -> Result<()>
where
    F: FnOnce(&Path, &Path) -> Result<()>,
    S: FnOnce(&Path) -> Result<()>,
{
    let parent = destination
        .parent()
        .ok_or_else(|| anyhow!("Could not resolve parent for {}", destination.display()))?;
    if path_exists_without_following(destination)? {
        let metadata = fs::symlink_metadata(destination)
            .with_context(|| format!("Could not inspect {}", destination.display()))?;
        if !metadata.file_type().is_file() {
            return Err(anyhow!(
                "Replacement destination is not a regular file: {}",
                destination.display()
            ));
        }
        replace_existing(staged, destination)?;
    } else {
        fs::rename(staged, destination).with_context(|| {
            format!(
                "Could not promote completed file {} to {}",
                staged.display(),
                destination.display()
            )
        })?;
    }
    if let Err(error) = sync_parent(parent) {
        return Err(installed_file_sync_error(destination, error));
    }
    Ok(())
}

fn promote_synced_file_with_replacer<F>(
    staged: &Path,
    destination: &Path,
    replace_existing: F,
) -> Result<()>
where
    F: FnOnce(&Path, &Path) -> Result<()>,
{
    promote_synced_file_with(staged, destination, replace_existing, sync_directory)
}

fn atomic_write_with_replacer<F>(path: &Path, bytes: &[u8], replace_existing: F) -> Result<()>
where
    F: FnOnce(&Path, &Path) -> Result<()>,
{
    let parent = path
        .parent()
        .ok_or_else(|| anyhow!("Could not resolve parent for {}", path.display()))?;
    fs::create_dir_all(parent)?;
    let staged = unique_sibling_path(path, "atomic-tmp")?;
    let result = (|| -> Result<()> {
        {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&staged)
                .with_context(|| {
                    format!("Could not create atomic staging file {}", staged.display())
                })?;
            file.write_all(bytes)
                .with_context(|| format!("Could not write {}", staged.display()))?;
            file.sync_all()
                .with_context(|| format!("Could not sync {}", staged.display()))?;
        }

        promote_synced_file_with_replacer(&staged, path, replace_existing)
    })();
    if result.is_err() {
        let _ = remove_path(&staged);
    }
    result
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    atomic_write_with_replacer(path, bytes, replace_existing_file_atomic)
}

fn write_json(path: &Path, value: &Value) -> Result<()> {
    atomic_write(path, &serde_json::to_vec_pretty(value)?)
        .with_context(|| format!("Could not write JSON file {}", path.display()))
}

fn state_revision(collection: &Value, preferences: &Value) -> Result<String> {
    const FNV_OFFSET: u128 = 0x6c62272e07bb014262b821756295c58d;
    const FNV_PRIME: u128 = 0x0000000001000000000000000000013b;

    fn update(hash: &mut u128, bytes: &[u8]) {
        for byte in bytes {
            *hash ^= u128::from(*byte);
            *hash = hash.wrapping_mul(FNV_PRIME);
        }
    }

    let collection = serde_json::to_vec(collection)?;
    let preferences = serde_json::to_vec(preferences)?;
    let mut hash = FNV_OFFSET;
    update(&mut hash, &(collection.len() as u64).to_le_bytes());
    update(&mut hash, &collection);
    update(&mut hash, &(preferences.len() as u64).to_le_bytes());
    update(&mut hash, &preferences);
    Ok(format!("r1-{hash:032x}"))
}

fn read_storage_state(paths: &StoragePaths) -> Result<(Value, Value, String)> {
    let collection = read_json(&paths.data)?;
    let preferences = read_json(&paths.preferences)?;
    let revision = state_revision(&collection, &preferences)?;
    Ok((collection, preferences, revision))
}

fn revision_conflict(expected_revision: Option<&str>, current_revision: &str) -> Option<Value> {
    if expected_revision == Some(current_revision) {
        return None;
    }
    Some(json!({
        "success": false,
        "code": "DATA_CONFLICT",
        "conflict": true,
        "revision": current_revision,
        "message": "The collection changed in another app window. Reload it before saving again."
    }))
}

fn success_with_warnings(mut response: Value, prefix: &str, warnings: Vec<String>) -> Value {
    if warnings.is_empty() {
        return response;
    }
    response["warning"] = json!(true);
    response["message"] = json!(format!("{prefix}, but {}.", warnings.join("; ")));
    response
}

fn default_collection_data() -> Value {
    json!({
        "pens": [],
        "inks": [],
        "swatches": [],
        "currently_inked": [],
        "activity_log": []
    })
}

fn default_preferences() -> Value {
    json!({
        "show_activity_log": true,
        "show_recent_activity": true,
        "open_cards_in_edit_mode": true,
        "activity_retention_days": 365,
        "color_mode": "auto",
        "confirm_destructive_actions": true,
        "activity_log_verbosity": "normal",
        "activity_log_filters": {
            "pen_edits": true,
            "ink_edits": true,
            "swatches": true,
            "deletes": true
        },
        "activity_log_categories": {
            "pen": true,
            "ink": true,
            "swatch": true
        },
        "defaults": {
            "currency": "USD",
            "date_format": "system",
            "pen_nib": "",
            "pen_nib_material": "",
            "pen_status": "",
            "ink_type": ""
        },
        "import_export": {
            "auto_validate_import": true,
            "conflict_behavior": "overwrite",
            "include_optional_metadata": true
        },
        "backup": {
            "auto_frequency": "daily",
            "retention_count": 30,
            "include_images": true,
            "keep_replaced_images": false
        },
        "showcase": {
            "title": APP_NAME,
            "color_mode": "auto",
            "show_prices": true,
            "show_pens": true,
            "show_inks": true,
            "show_swatches": true,
            "show_activity_filters": true,
            "default_sort": {
                "pens": "newest",
                "inks": "newest",
                "swatches": "newest"
            },
            "show_insights": true,
            "show_charts": true
        }
    })
}

fn collection_without_preferences(input: &Value) -> Value {
    let mut out = input.as_object().cloned().unwrap_or_else(Map::new);
    out.remove("preferences");
    Value::Object(out)
}

fn preferences_from(input: &Value) -> Value {
    input
        .get("preferences")
        .filter(|value| value.is_object())
        .cloned()
        .unwrap_or_else(default_preferences)
}

fn refresh_storage_revision(preferences: &mut Value) -> Result<()> {
    let object = preferences
        .as_object_mut()
        .ok_or_else(|| anyhow!("Preferences must be a JSON object."))?;
    object.insert(
        STORAGE_REVISION_KEY.to_string(),
        json!(Uuid::new_v4().to_string()),
    );
    Ok(())
}

fn preferences_for_client(mut preferences: Value) -> Value {
    if let Some(object) = preferences.as_object_mut() {
        object.remove(STORAGE_REVISION_KEY);
    }
    preferences
}

fn preferences_for_backup(preferences: &Value) -> Value {
    preferences_for_client(preferences.clone())
}

fn combine_collection_with_preferences(collection: Value, preferences: Value) -> Value {
    let mut out = collection.as_object().cloned().unwrap_or_else(Map::new);
    out.insert(
        "preferences".to_string(),
        preferences_for_client(preferences),
    );
    Value::Object(out)
}

#[derive(Clone, Copy)]
struct PublicVisibility {
    show_pens: bool,
    show_inks: bool,
    show_swatches: bool,
    show_prices: bool,
    show_activity_log: bool,
    show_recent_activity: bool,
}

fn value_at_path<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    Some(current)
}

fn bool_at_path(value: &Value, path: &[&str], fallback: bool) -> bool {
    value_at_path(value, path)
        .and_then(Value::as_bool)
        .unwrap_or(fallback)
}

fn string_at_path(value: &Value, path: &[&str], fallback: &str) -> String {
    value_at_path(value, path)
        .and_then(Value::as_str)
        .unwrap_or(fallback)
        .to_string()
}

fn safe_enum_at_path(value: &Value, path: &[&str], allowed: &[&str], fallback: &str) -> String {
    let normalized = string_at_path(value, path, fallback).trim().to_lowercase();
    if allowed.contains(&normalized.as_str()) {
        normalized
    } else {
        fallback.to_string()
    }
}

fn effective_public_swatches_visibility(show_inks: bool, show_swatches: bool) -> bool {
    show_inks && show_swatches
}

fn public_visibility(preferences: &Value) -> PublicVisibility {
    let show_inks = bool_at_path(preferences, &["showcase", "show_inks"], true);
    PublicVisibility {
        show_pens: bool_at_path(preferences, &["showcase", "show_pens"], true),
        show_inks,
        show_swatches: bool_at_path(preferences, &["showcase", "show_swatches"], true),
        show_prices: bool_at_path(preferences, &["showcase", "show_prices"], true),
        show_activity_log: bool_at_path(preferences, &["show_activity_log"], true),
        show_recent_activity: bool_at_path(preferences, &["show_recent_activity"], true),
    }
}

fn public_preferences(preferences: &Value, visibility: PublicVisibility) -> Value {
    let title = string_at_path(preferences, &["showcase", "title"], APP_NAME);
    let title = title.trim();
    let mut defaults = Map::new();
    defaults.insert(
        "date_format".to_string(),
        json!(safe_enum_at_path(
            preferences,
            &["defaults", "date_format"],
            &["system", "us", "eu", "iso"],
            "system"
        )),
    );
    if visibility.show_prices {
        defaults.insert(
            "currency".to_string(),
            json!(safe_enum_at_path(
                preferences,
                &["defaults", "currency"],
                &["usd", "eur", "gbp", "jpy", "try"],
                "usd"
            )
            .to_uppercase()),
        );
    }

    json!({
        "show_activity_log": visibility.show_activity_log,
        "show_recent_activity": visibility.show_recent_activity,
        "activity_log_verbosity": safe_enum_at_path(
            preferences,
            &["activity_log_verbosity"],
            &["minimal", "normal", "detailed"],
            "normal"
        ),
        "defaults": Value::Object(defaults),
        "showcase": {
            "title": if title.is_empty() { APP_NAME } else { title },
            "color_mode": safe_enum_at_path(
                preferences,
                &["showcase", "color_mode"],
                &["light", "dark", "auto"],
                "auto"
            ),
            "show_prices": visibility.show_prices,
            "show_pens": visibility.show_pens,
            "show_inks": visibility.show_inks,
            "show_swatches": effective_public_swatches_visibility(
                visibility.show_inks,
                visibility.show_swatches
            ),
            "show_activity_filters": bool_at_path(preferences, &["showcase", "show_activity_filters"], true),
            "default_sort": {
                "pens": safe_enum_at_path(
                    preferences,
                    &["showcase", "default_sort", "pens"],
                    &["newest", "oldest", "brand-asc", "brand-desc", "model-asc", "model-desc"],
                    "newest"
                ),
                "inks": safe_enum_at_path(
                    preferences,
                    &["showcase", "default_sort", "inks"],
                    &["newest", "oldest", "brand-asc", "brand-desc", "name-asc", "name-desc"],
                    "newest"
                ),
                "swatches": safe_enum_at_path(
                    preferences,
                    &["showcase", "default_sort", "swatches"],
                    &["newest", "oldest", "brand-asc", "brand-desc", "name-asc", "name-desc"],
                    "newest"
                )
            },
            "show_insights": bool_at_path(preferences, &["showcase", "show_insights"], true),
            "show_charts": bool_at_path(preferences, &["showcase", "show_charts"], true)
        }
    })
}

fn sanitize_public_managed_image_path(raw_path: &str, expected_folder: &str) -> Option<String> {
    let normalized = normalize_managed_relative_image_path(raw_path)?;
    let path = Path::new(&normalized);
    let components = path.components().collect::<Vec<_>>();
    if components.len() < 2
        || components
            .iter()
            .any(|component| !matches!(component, Component::Normal(_)))
        || components[0].as_os_str() != expected_folder
        || !PUBLIC_IMAGE_EXTENSIONS.contains(&extension_lower(path).as_str())
    {
        return None;
    }
    Some(normalized)
}

fn sanitize_public_image_fields(object: &mut Map<String, Value>, expected_folder: &str) {
    object.remove("image_url");
    object.remove("url");
    let direct_path = object
        .get("image")
        .and_then(Value::as_str)
        .and_then(|path| sanitize_public_managed_image_path(path, expected_folder));
    let direct_rotation = object
        .get("image_rotation")
        .filter(|value| value.is_number())
        .cloned()
        .unwrap_or_else(|| json!(0));
    let mut entries = Vec::new();
    let mut seen = HashSet::new();
    let mut explicit_primary = None;

    if let Some(images) = object.get("images").and_then(Value::as_array) {
        for entry in images {
            let raw_path = entry
                .as_str()
                .or_else(|| entry.get("path").and_then(Value::as_str))
                .or_else(|| entry.get("image").and_then(Value::as_str))
                .or_else(|| entry.get("url").and_then(Value::as_str));
            let Some(path) =
                raw_path.and_then(|path| sanitize_public_managed_image_path(path, expected_folder))
            else {
                continue;
            };
            if !seen.insert(path.clone()) {
                continue;
            }
            let rotation = entry
                .get("rotation")
                .filter(|value| value.is_number())
                .cloned()
                .unwrap_or_else(|| json!(0));
            if explicit_primary.is_none()
                && entry
                    .get("primary")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
            {
                explicit_primary = Some(path.clone());
            }
            entries.push((path, rotation));
        }
    }

    if let Some(path) = &direct_path {
        if seen.insert(path.clone()) {
            entries.push((path.clone(), direct_rotation.clone()));
        }
    }

    let primary_path = direct_path
        .or(explicit_primary)
        .or_else(|| entries.first().map(|(path, _)| path.clone()));
    let Some(primary_path) = primary_path else {
        object.remove("image");
        object.remove("images");
        object.remove("image_rotation");
        return;
    };

    if let Some(primary_index) = entries.iter().position(|(path, _)| path == &primary_path) {
        let primary = entries.remove(primary_index);
        entries.insert(0, primary);
    }

    let mut primary_rotation = json!(0);
    let images = entries
        .into_iter()
        .enumerate()
        .map(|(index, (path, rotation))| {
            let primary = path == primary_path;
            if primary {
                primary_rotation = rotation.clone();
            }
            json!({
                "id": format!("public_image_{}", index + 1),
                "path": path,
                "rotation": rotation,
                "primary": primary
            })
        })
        .collect::<Vec<_>>();
    object.insert("image".to_string(), json!(primary_path));
    object.insert("images".to_string(), json!(images));
    object.insert("image_rotation".to_string(), primary_rotation);
}

fn project_public_item(
    item: Value,
    show_prices: bool,
    expected_image_folder: &str,
) -> Option<Value> {
    let mut object = item.as_object()?.clone();
    if !show_prices {
        object.remove("price");
    }
    sanitize_public_image_fields(&mut object, expected_image_folder);
    Some(Value::Object(object))
}

fn project_public_items(
    items: Vec<Value>,
    visible: bool,
    show_prices: bool,
    expected_image_folder: &str,
) -> Vec<Value> {
    if !visible {
        return Vec::new();
    }
    items
        .into_iter()
        .filter_map(|item| project_public_item(item, show_prices, expected_image_folder))
        .collect()
}

fn collection_ids(items: &[Value]) -> HashSet<String> {
    items
        .iter()
        .filter_map(item_id)
        .map(ToOwned::to_owned)
        .collect()
}

fn project_public_swatches(
    collection: &Value,
    visibility: PublicVisibility,
    ink_ids: &HashSet<String>,
) -> Vec<Value> {
    if !effective_public_swatches_visibility(visibility.show_inks, visibility.show_swatches) {
        return Vec::new();
    }
    collection_array(collection, "swatches")
        .into_iter()
        .filter(|swatch| {
            swatch
                .get("ink_id")
                .and_then(Value::as_str)
                .map(|ink_id| ink_ids.contains(ink_id))
                .unwrap_or(false)
        })
        .filter_map(|swatch| project_public_item(swatch, visibility.show_prices, "swatches"))
        .collect()
}

fn project_public_relationships(
    collection: &Value,
    pen_ids: &HashSet<String>,
    ink_ids: &HashSet<String>,
) -> Vec<Value> {
    collection_array(collection, "currently_inked")
        .into_iter()
        .enumerate()
        .filter_map(|(index, entry)| {
            let pen_id = entry.get("pen_id").and_then(Value::as_str).unwrap_or("");
            let ink_id = entry.get("ink_id").and_then(Value::as_str).unwrap_or("");
            if !pen_ids.contains(pen_id) || !ink_ids.contains(ink_id) {
                return None;
            }
            let mut projected = Map::new();
            projected.insert(
                "id".to_string(),
                json!(format!("public_inked_{}", index + 1)),
            );
            projected.insert("pen_id".to_string(), json!(pen_id));
            projected.insert("ink_id".to_string(), json!(ink_id));
            if let Some(date_inked) = entry.get("date_inked").filter(|value| value.is_number()) {
                projected.insert("date_inked".to_string(), date_inked.clone());
            }
            Some(Value::Object(projected))
        })
        .collect()
}

fn public_activity_category(entry: &Value) -> &'static str {
    match entry
        .get("category")
        .and_then(Value::as_str)
        .unwrap_or("system")
        .to_lowercase()
        .as_str()
    {
        "pen" => "pen",
        "ink" => "ink",
        "swatch" => "swatch",
        _ => "system",
    }
}

fn public_activity_action(entry: &Value) -> &'static str {
    match entry
        .get("action")
        .and_then(Value::as_str)
        .unwrap_or("updated")
        .to_lowercase()
        .as_str()
    {
        "created" => "created",
        "updated" => "updated",
        "deleted" => "deleted",
        "inked" => "inked",
        "reinked" => "reinked",
        "cleaned" => "cleaned",
        _ => "updated",
    }
}

fn public_activity_dependency_allowed(
    category: &str,
    action: &str,
    visibility: PublicVisibility,
) -> bool {
    match category {
        "pen" => {
            visibility.show_pens
                && (visibility.show_inks || !matches!(action, "inked" | "reinked" | "cleaned"))
        }
        "ink" => visibility.show_inks,
        "swatch" => {
            effective_public_swatches_visibility(visibility.show_inks, visibility.show_swatches)
        }
        _ => true,
    }
}

fn public_activity_entity_id(
    entry: &Value,
    category: &str,
    pen_ids: &HashSet<String>,
    ink_ids: &HashSet<String>,
    swatch_ids: &HashSet<String>,
) -> String {
    let entity_id = entry.get("entity_id").and_then(Value::as_str).unwrap_or("");
    let visible = match category {
        "pen" => pen_ids.contains(entity_id),
        "ink" => ink_ids.contains(entity_id),
        "swatch" => swatch_ids.contains(entity_id),
        _ => false,
    };
    if visible {
        entity_id.to_string()
    } else {
        String::new()
    }
}

fn sanitize_public_activity(
    collection: &Value,
    visibility: PublicVisibility,
    pen_ids: &HashSet<String>,
    ink_ids: &HashSet<String>,
    swatch_ids: &HashSet<String>,
) -> Vec<Value> {
    if !visibility.show_activity_log && !visibility.show_recent_activity {
        return Vec::new();
    }

    let mut entries = Vec::new();
    for entry in collection_array(collection, "activity_log") {
        let category = public_activity_category(&entry);
        let action = public_activity_action(&entry);
        if !public_activity_dependency_allowed(category, action, visibility) {
            continue;
        }
        let timestamp = entry
            .get("timestamp")
            .filter(|value| value.is_number())
            .cloned()
            .unwrap_or_else(|| json!(0));
        let entity_id = public_activity_entity_id(&entry, category, pen_ids, ink_ids, swatch_ids);
        entries.push(json!({
            "id": format!("public_activity_{}", entries.len() + 1),
            "timestamp": timestamp,
            "action": action,
            "category": category,
            "message": format!("{category}: {action}"),
            "entity_id": entity_id,
            "metadata": {}
        }));
    }

    entries.sort_by(|left, right| {
        let left = left.get("timestamp").and_then(Value::as_f64).unwrap_or(0.0);
        let right = right
            .get("timestamp")
            .and_then(Value::as_f64)
            .unwrap_or(0.0);
        right
            .partial_cmp(&left)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    if !visibility.show_activity_log {
        entries.truncate(PUBLIC_RECENT_ACTIVITY_LIMIT);
    }
    entries
}

fn build_public_showcase_data(collection: &Value, preferences: &Value) -> Value {
    let visibility = public_visibility(preferences);
    let pens = project_public_items(
        collection_array(collection, "pens"),
        visibility.show_pens,
        visibility.show_prices,
        "pens",
    );
    let inks = project_public_items(
        collection_array(collection, "inks"),
        visibility.show_inks,
        visibility.show_prices,
        "inks",
    );
    let pen_ids = collection_ids(&pens);
    let ink_ids = collection_ids(&inks);
    let swatches = project_public_swatches(collection, visibility, &ink_ids);
    let swatch_ids = collection_ids(&swatches);
    let currently_inked = project_public_relationships(collection, &pen_ids, &ink_ids);
    let activity_log =
        sanitize_public_activity(collection, visibility, &pen_ids, &ink_ids, &swatch_ids);

    json!({
        "pens": pens,
        "inks": inks,
        "swatches": swatches,
        "currently_inked": currently_inked,
        "activity_log": activity_log,
        "preferences": public_preferences(preferences, visibility)
    })
}

fn collection_array(data: &Value, key: &str) -> Vec<Value> {
    data.get(key)
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn item_id(item: &Value) -> Option<&str> {
    item.get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
}

fn merge_objects(existing: &Value, incoming: &Value) -> Value {
    let Some(existing_object) = existing.as_object() else {
        return incoming.clone();
    };
    let Some(incoming_object) = incoming.as_object() else {
        return incoming.clone();
    };
    let mut merged = existing_object.clone();
    for (key, value) in incoming_object {
        merged.insert(key.clone(), value.clone());
    }
    Value::Object(merged)
}

fn merge_by_id(existing: &[Value], incoming: &[Value], behavior: &str) -> Vec<Value> {
    if behavior == "skip" {
        let mut out = existing.to_vec();
        let mut seen = existing
            .iter()
            .filter_map(item_id)
            .map(ToOwned::to_owned)
            .collect::<HashSet<_>>();

        for item in incoming {
            if let Some(id) = item_id(item) {
                if seen.insert(id.to_string()) {
                    out.push(item.clone());
                }
            } else {
                out.push(item.clone());
            }
        }
        return out;
    }

    let mut by_id = existing
        .iter()
        .filter_map(|item| item_id(item).map(|id| (id.to_string(), item.clone())))
        .collect::<std::collections::HashMap<_, _>>();

    for item in incoming {
        let Some(id) = item_id(item) else {
            continue;
        };
        let next = if behavior == "merge" {
            by_id
                .get(id)
                .map(|previous| merge_objects(previous, item))
                .unwrap_or_else(|| item.clone())
        } else {
            item.clone()
        };
        by_id.insert(id.to_string(), next);
    }

    let mut out = Vec::new();
    let mut inserted = HashSet::new();
    for item in existing {
        if let Some(id) = item_id(item) {
            if let Some(value) = by_id.get(id) {
                out.push(value.clone());
                inserted.insert(id.to_string());
            }
        } else {
            out.push(item.clone());
        }
    }
    for item in incoming {
        if let Some(id) = item_id(item) {
            if !inserted.contains(id) {
                out.push(by_id.get(id).cloned().unwrap_or_else(|| item.clone()));
                inserted.insert(id.to_string());
            }
        } else {
            out.push(item.clone());
        }
    }
    out
}

fn dedupe_currently_inked_by_pen(entries: Vec<Value>) -> Vec<Value> {
    let mut last_index_by_pen_id = std::collections::HashMap::new();
    for (index, entry) in entries.iter().enumerate() {
        if let Some(pen_id) = entry
            .get("pen_id")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
        {
            last_index_by_pen_id.insert(pen_id.to_string(), index);
        }
    }

    entries
        .into_iter()
        .enumerate()
        .filter(|(index, entry)| {
            let Some(pen_id) = entry
                .get("pen_id")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
            else {
                return true;
            };
            last_index_by_pen_id.get(pen_id).copied() == Some(*index)
        })
        .map(|(_, entry)| entry)
        .collect()
}

fn collection_with_arrays(source: &Value) -> Value {
    json!({
        "pens": collection_array(source, "pens"),
        "inks": collection_array(source, "inks"),
        "swatches": collection_array(source, "swatches"),
        "currently_inked": dedupe_currently_inked_by_pen(collection_array(source, "currently_inked")),
        "activity_log": collection_array(source, "activity_log")
    })
}

fn has_current_swatch_image_reference(swatch: &Value) -> bool {
    let is_swatch_reference = |value: &str| {
        normalize_managed_relative_image_path(value)
            .is_some_and(|image_path| image_path.starts_with("swatches/"))
    };
    if swatch
        .get("image")
        .and_then(Value::as_str)
        .is_some_and(is_swatch_reference)
    {
        return true;
    }
    swatch
        .get("images")
        .and_then(Value::as_array)
        .is_some_and(|images| {
            images.iter().any(|entry| {
                entry.as_str().is_some_and(is_swatch_reference)
                    || ["path", "image", "url"].iter().any(|field| {
                        entry
                            .get(field)
                            .and_then(Value::as_str)
                            .is_some_and(is_swatch_reference)
                    })
            })
        })
}

fn clear_missing_legacy_ink_swatch_aliases(data: &mut Value, images_root: &Path) -> Result<()> {
    let ink_ids_with_swatches = collection_array(data, "swatches")
        .into_iter()
        .filter(has_current_swatch_image_reference)
        .filter_map(|swatch| {
            swatch
                .get("ink_id")
                .and_then(Value::as_str)
                .filter(|ink_id| !ink_id.is_empty())
                .map(ToOwned::to_owned)
        })
        .collect::<HashSet<_>>();
    let Some(inks) = data.get_mut("inks").and_then(Value::as_array_mut) else {
        return Ok(());
    };
    let images_root_exists = path_exists_without_following(images_root)?;

    for ink in inks {
        let Some(object) = ink.as_object_mut() else {
            continue;
        };
        let linked_swatch_exists = object
            .get("id")
            .and_then(Value::as_str)
            .is_some_and(|ink_id| ink_ids_with_swatches.contains(ink_id));
        if !linked_swatch_exists {
            continue;
        }
        for field in ["image", "image_url", "url"] {
            let legacy_alias = object
                .get(field)
                .and_then(Value::as_str)
                .and_then(normalize_managed_relative_image_path)
                .filter(|image_path| image_path.starts_with("swatches/"));
            let Some(legacy_alias) = legacy_alias else {
                continue;
            };
            let alias_exists = images_root_exists
                && resolve_referenced_image_source(images_root, &legacy_alias, false)?.is_some();
            if !alias_exists {
                object.insert(field.to_string(), json!(""));
            }
        }
    }
    Ok(())
}

fn merge_collection_data(existing: &Value, incoming: &Value, behavior: &str) -> Value {
    if behavior == "overwrite" {
        return collection_with_arrays(incoming);
    }

    let currently_inked = dedupe_currently_inked_by_pen(merge_by_id(
        &collection_array(existing, "currently_inked"),
        &collection_array(incoming, "currently_inked"),
        behavior,
    ));

    json!({
        "pens": merge_by_id(&collection_array(existing, "pens"), &collection_array(incoming, "pens"), behavior),
        "inks": merge_by_id(&collection_array(existing, "inks"), &collection_array(incoming, "inks"), behavior),
        "swatches": merge_by_id(&collection_array(existing, "swatches"), &collection_array(incoming, "swatches"), behavior),
        "currently_inked": currently_inked,
        "activity_log": merge_by_id(&collection_array(existing, "activity_log"), &collection_array(incoming, "activity_log"), behavior)
    })
}

fn ensure_app_storage(app: &AppHandle) -> Result<()> {
    let storage_dir = app_storage_dir(app)?;
    fs::create_dir_all(&storage_dir)?;
    ensure_real_directory(&storage_dir)?;
    let _lock = acquire_recovered_storage_lock(&storage_dir)?;

    let data = data_path(app)?;
    if !path_exists_without_following(&data)? {
        let frontend = frontend_source_root(app)?;
        let bundled_data = frontend.join("data.json");
        if inspect_path_without_symlinks(&frontend, Path::new("data.json"))?
            .map(|metadata| metadata.file_type().is_file())
            .unwrap_or(false)
        {
            atomic_write(&data, &fs::read(&bundled_data)?)?;
        } else {
            write_json(&data, &default_collection_data())?;
        }
    }
    require_real_regular_file(&data, "Collection data")?;

    let prefs = preferences_path(app)?;
    if !path_exists_without_following(&prefs)? {
        write_json(&prefs, &default_preferences())?;
    }
    require_real_regular_file(&prefs, "Preferences data")?;

    let images = images_path(app)?;
    if !path_exists_without_following(&images)? {
        let bundled_images = frontend_source_root(app)?.join("images");
        if path_exists_without_following(&bundled_images)? {
            copy_dir_all(&bundled_images, &images)?;
        }
    }
    ensure_managed_storage_tree(&storage_dir)?;
    ensure_backup_storage_tree(&storage_dir)?;
    Ok(())
}

fn copy_dir_all(source: &Path, destination: &Path) -> Result<()> {
    copy_dir_all_with_mode(source, destination, true)
}

fn copy_required_file(
    source_root: &Path,
    destination_root: &Path,
    relative_path: &str,
) -> Result<()> {
    let source = source_root.join(relative_path);
    let Some(metadata) = inspect_path_without_symlinks(source_root, Path::new(relative_path))?
    else {
        return Err(anyhow!("Missing required app file: {}", source.display()));
    };
    if !metadata.file_type().is_file() {
        return Err(anyhow!(
            "Required app source is not a regular file: {}",
            source.display()
        ));
    }
    let relative_parent = Path::new(relative_path)
        .parent()
        .ok_or_else(|| anyhow!("Invalid required app destination."))?;
    ensure_real_relative_directory(destination_root, relative_parent)?;
    let destination = destination_root.join(relative_path);
    if path_exists_without_following(&destination)?
        && !fs::symlink_metadata(&destination)?.file_type().is_file()
    {
        return Err(anyhow!(
            "Required app destination is not a regular file: {}",
            destination.display()
        ));
    }
    fs::copy(&source, &destination)?;
    Ok(())
}

fn prune_showcase_only_assets(root: &Path) -> Result<()> {
    for relative in [
        "assets/brand/inkubator-logo-background-source.png",
        "assets/brand/inkubator-logo-transparent-source.png",
        "assets/icons/ink-drop-white.source.png",
    ] {
        let target = root.join(relative);
        if target.exists() {
            fs::remove_file(target)?;
        }
    }
    Ok(())
}

fn content_fingerprint(bytes: &[u8]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn version_asset_reference(root: &Path, raw: &str) -> Result<String> {
    if raw.is_empty()
        || raw.starts_with('#')
        || raw.starts_with('?')
        || raw.starts_with("//")
        || raw.contains(':')
    {
        return Ok(raw.to_string());
    }

    let (before_hash, hash) = raw
        .split_once('#')
        .map(|(left, right)| (left, format!("#{right}")))
        .unwrap_or((raw, String::new()));
    let (pathname, query) = before_hash.split_once('?').unwrap_or((before_hash, ""));
    let normalized = pathname.trim_start_matches('/');
    if normalized.is_empty()
        || normalized == "data.js"
        || normalized.split(['/', '\\']).any(|part| part == "..")
    {
        return Ok(raw.to_string());
    }

    let target = root.join(normalized);
    if !target.is_file() {
        return Ok(raw.to_string());
    }

    let fingerprint = content_fingerprint(&fs::read(&target)?);
    let mut query_parts = query
        .split('&')
        .filter(|part| !part.is_empty() && !part.starts_with("v="))
        .map(|part| part.to_string())
        .collect::<Vec<_>>();
    query_parts.push(format!("v={fingerprint}"));
    Ok(format!("{}?{}{}", pathname, query_parts.join("&"), hash))
}

fn version_html_attr_references(root: &Path, html: &str, attr: &str) -> Result<String> {
    let pattern = format!("{attr}=\"");
    let mut out = String::with_capacity(html.len());
    let mut rest = html;

    while let Some(index) = rest.find(&pattern) {
        out.push_str(&rest[..index + pattern.len()]);
        let after = &rest[index + pattern.len()..];
        let Some(end) = after.find('"') else {
            out.push_str(after);
            return Ok(out);
        };
        out.push_str(&version_asset_reference(root, &after[..end])?);
        rest = &after[end..];
    }

    out.push_str(rest);
    Ok(out)
}

fn version_html_asset_references(root: &Path, html: &str) -> Result<String> {
    let html = version_html_attr_references(root, html, "src")?;
    version_html_attr_references(root, &html, "href")
}

fn remove_html_script_line(html: &str, src: &str) -> String {
    let tag = format!("<script src=\"{src}\"></script>");
    let lines = html
        .lines()
        .filter(|line| line.trim() != tag)
        .collect::<Vec<_>>();
    let mut output = lines.join("\n");
    if html.ends_with('\n') {
        output.push('\n');
    }
    output
}

fn ensure_showcase_data_script(html: &str) -> Result<String> {
    if html.contains("src=\"data.js\"") {
        return Ok(html.to_string());
    }
    if !html.contains("<script src=\"renderer.js\"></script>") {
        return Err(anyhow!(
            "Could not find renderer script while preparing showcase export."
        ));
    }
    Ok(html.replace(
        "<script src=\"renderer.js\"></script>",
        "<script src=\"data.js\"></script>\n    <script src=\"renderer.js\"></script>",
    ))
}

fn prepare_showcase_index_html(root: &Path, html: &str, data: &Value) -> Result<String> {
    let html = ensure_showcase_data_script(html)?;
    let html = remove_html_script_line(&html, "tauri-api.js");
    let html = remove_html_script_line(&html, "docker-api.js");
    let html = remove_html_script_line(&html, "docker-shell.js");
    let html = inject_public_color_mode(&html, &showcase_color_mode_from_data(data));
    version_html_asset_references(root, &html)
}

fn showcase_color_mode_from_data(data: &Value) -> String {
    let mode = data
        .get("preferences")
        .and_then(|value| value.get("showcase"))
        .and_then(|value| value.get("color_mode"))
        .and_then(Value::as_str)
        .unwrap_or("auto")
        .to_lowercase();
    if matches!(mode.as_str(), "light" | "dark" | "auto") {
        mode
    } else {
        "auto".to_string()
    }
}

fn inject_public_color_mode(html: &str, mode: &str) -> String {
    let safe_mode = if matches!(mode, "light" | "dark" | "auto") {
        mode
    } else {
        "auto"
    };
    if html.contains("data-inkubator-public-color-mode=") {
        let Some(start) = html.find("data-inkubator-public-color-mode=\"") else {
            return html.to_string();
        };
        let value_start = start + "data-inkubator-public-color-mode=\"".len();
        let Some(relative_end) = html[value_start..].find('"') else {
            return html.to_string();
        };
        let mut out = String::with_capacity(html.len());
        out.push_str(&html[..value_start]);
        out.push_str(safe_mode);
        out.push_str(&html[value_start + relative_end..]);
        return out;
    }
    if let Some(index) = html.find("<html") {
        let insert_at = index + "<html".len();
        let mut out = String::with_capacity(html.len() + 48);
        out.push_str(&html[..insert_at]);
        out.push_str(&format!(
            " data-inkubator-public-color-mode=\"{safe_mode}\""
        ));
        out.push_str(&html[insert_at..]);
        return out;
    }
    html.to_string()
}

fn create_backup_folder(
    app: &AppHandle,
    folder: &Path,
    data: &Value,
    preferences: &Value,
    backup_type: &str,
    reason: Option<&str>,
    keep_replaced: bool,
) -> Result<()> {
    fs::create_dir_all(folder)?;
    write_json(&folder.join("data.json"), data)?;
    write_json(
        &folder.join("preferences.json"),
        &preferences_for_backup(preferences),
    )?;
    copy_referenced_images(&images_path(app)?, &folder.join("images"), data)?;
    let replaced_images = replaced_images_path(app)?;
    if keep_replaced && path_exists_without_following(&replaced_images)? {
        copy_dir_all(&replaced_images, &folder.join("replaced-images"))?;
    }
    let mut manifest = json!({
        "type": backup_type,
        "version": 3,
        "created_at": Utc::now().to_rfc3339(),
        "includes_images": true,
        "includes_replaced_images": keep_replaced,
        "includes_preferences": true
    });
    if let Some(reason) = reason {
        manifest["reason"] = json!(reason);
    }
    write_json(&folder.join("manifest.json"), &manifest)?;
    Ok(())
}

fn copy_dir_all_with_mode(source: &Path, destination: &Path, overwrite: bool) -> Result<()> {
    let source_metadata = fs::symlink_metadata(source)
        .with_context(|| format!("Could not inspect copy source {}", source.display()))?;
    if !source_metadata.file_type().is_dir() {
        return Err(anyhow!(
            "Copy source is not a real directory: {}",
            source.display()
        ));
    }
    ensure_real_directory(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all_with_mode(&entry.path(), &target, overwrite)?;
        } else if file_type.is_file() {
            if path_exists_without_following(&target)? {
                let target_metadata = fs::symlink_metadata(&target)?;
                if !target_metadata.file_type().is_file() {
                    return Err(anyhow!(
                        "Copy destination is not a regular file: {}",
                        target.display()
                    ));
                }
                if !overwrite {
                    continue;
                }
            }
            fs::copy(entry.path(), target)?;
        } else {
            return Err(anyhow!(
                "Copy source contains an unsupported filesystem entry: {}",
                entry.path().display()
            ));
        }
    }
    Ok(())
}

fn unique_sibling_path(destination: &Path, label: &str) -> Result<PathBuf> {
    let parent = destination
        .parent()
        .ok_or_else(|| anyhow!("Could not resolve parent for {}", destination.display()))?;
    let filename = destination
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("backup.zip");
    Ok(parent.join(format!(".{filename}.{label}-{}", Uuid::new_v4().simple())))
}

fn promote_completed_file(staged: &Path, destination: &Path) -> Result<()> {
    promote_synced_file_with_replacer(staged, destination, replace_existing_file_atomic)
}

fn zip_folder(source: &Path, destination: &Path) -> Result<()> {
    zip_folder_with(source, destination, |_| Ok(()))
}

fn zip_folder_with<F>(source: &Path, destination: &Path, mut before_entry: F) -> Result<()>
where
    F: FnMut(&Path) -> Result<()>,
{
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    let staged = unique_sibling_path(destination, "tmp")?;
    let result = (|| -> Result<()> {
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&staged)
            .with_context(|| format!("Could not create temporary backup {}", staged.display()))?;
        let mut zip = ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        fn add_entries<W, F>(
            zip: &mut ZipWriter<W>,
            root: &Path,
            current: &Path,
            options: SimpleFileOptions,
            before_entry: &mut F,
        ) -> Result<()>
        where
            W: Write + Seek,
            F: FnMut(&Path) -> Result<()>,
        {
            for entry in fs::read_dir(current)? {
                let entry = entry?;
                let path = entry.path();
                before_entry(&path)?;
                let relative = path
                    .strip_prefix(root)?
                    .to_string_lossy()
                    .replace('\\', "/");
                if entry.file_type()?.is_dir() {
                    zip.add_directory(format!("{relative}/"), options)?;
                    add_entries(zip, root, &path, options, before_entry)?;
                } else {
                    zip.start_file(relative, options)?;
                    let mut file = File::open(&path)?;
                    let mut buffer = Vec::new();
                    file.read_to_end(&mut buffer)?;
                    zip.write_all(&buffer)?;
                }
            }
            Ok(())
        }

        add_entries(&mut zip, source, source, options, &mut before_entry)?;
        let output = zip.finish()?;
        output
            .sync_all()
            .with_context(|| format!("Could not sync temporary backup {}", staged.display()))?;
        drop(output);
        promote_completed_file(&staged, destination)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&staged);
    }
    result
}

fn extract_zip_to_folder_with_limits(
    zip_path: &Path,
    destination: &Path,
    max_entries: usize,
    max_expanded_bytes: u64,
) -> Result<()> {
    let compressed_bytes = fs::metadata(zip_path)
        .with_context(|| format!("Could not inspect {}", zip_path.display()))?
        .len();
    if compressed_bytes > MAX_BACKUP_COMPRESSED_BYTES {
        return Err(anyhow!(
            "Backup exceeds the {} MiB compressed size limit.",
            MAX_BACKUP_COMPRESSED_BYTES / 1024 / 1024
        ));
    }
    let file =
        File::open(zip_path).with_context(|| format!("Could not open {}", zip_path.display()))?;
    let mut archive = ZipArchive::new(file)?;
    if archive.len() > max_entries {
        return Err(anyhow!("Backup contains more than {max_entries} entries."));
    }
    fs::create_dir_all(destination)?;
    let mut expanded_bytes = 0u64;
    let mut seen = HashSet::new();

    for index in 0..archive.len() {
        let mut file = archive.by_index(index)?;
        let Some(enclosed) = file.enclosed_name() else {
            return Err(anyhow!("Backup contains an unsafe file path."));
        };
        if !seen.insert(enclosed.clone()) {
            return Err(anyhow!("Backup contains a duplicate file path."));
        }
        let out_path = destination.join(enclosed);
        if file.is_dir() {
            fs::create_dir_all(&out_path)?;
            continue;
        }
        let remaining = max_expanded_bytes.saturating_sub(expanded_bytes);
        if file.size() > remaining {
            return Err(anyhow!(
                "Expanded backup exceeds the {} MiB limit.",
                max_expanded_bytes / 1024 / 1024
            ));
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut out_file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&out_path)?;
        let copied = io::copy(
            &mut file.by_ref().take(remaining.saturating_add(1)),
            &mut out_file,
        )?;
        if copied > remaining {
            return Err(anyhow!(
                "Expanded backup exceeds the {} MiB limit.",
                max_expanded_bytes / 1024 / 1024
            ));
        }
        expanded_bytes = expanded_bytes
            .checked_add(copied)
            .ok_or_else(|| anyhow!("Expanded backup size overflowed."))?;
    }
    Ok(())
}

fn extract_zip_to_folder(zip_path: &Path, destination: &Path) -> Result<()> {
    extract_zip_to_folder_with_limits(
        zip_path,
        destination,
        MAX_BACKUP_ENTRIES,
        MAX_BACKUP_EXPANDED_BYTES,
    )
}

fn resolve_backup_root(folder: &Path) -> PathBuf {
    if folder.join("data.json").exists() && folder.join("preferences.json").exists() {
        return folder.to_path_buf();
    }

    let Ok(entries) = fs::read_dir(folder) else {
        return folder.to_path_buf();
    };
    let candidates = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_dir()
                && path.join("data.json").exists()
                && path.join("preferences.json").exists()
        })
        .collect::<Vec<_>>();

    if candidates.len() == 1 {
        candidates[0].clone()
    } else {
        folder.to_path_buf()
    }
}

fn has_raster_signature(bytes: &[u8], extension: &str) -> bool {
    match extension {
        "jpg" | "jpeg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        "png" => bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]),
        "webp" => bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP",
        "avif" | "heic" | "heif" => {
            if bytes.len() < 12 || &bytes[4..8] != b"ftyp" {
                return false;
            }
            let brands: &[&[u8; 4]] = if extension == "avif" {
                &[b"avif", b"avis"]
            } else {
                &[
                    b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1",
                ]
            };
            bytes[8..]
                .windows(4)
                .any(|window| brands.iter().any(|brand| window == brand.as_slice()))
        }
        _ => false,
    }
}

fn validate_backup_raster_decode_limits(
    width: u32,
    height: u32,
    total_bytes: u64,
    path: &Path,
    label: &str,
) -> Result<()> {
    let pixels = u64::from(width).saturating_mul(u64::from(height));
    if width == 0
        || height == 0
        || pixels > MAX_BACKUP_RASTER_PIXELS
        || total_bytes > MAX_BACKUP_RASTER_DECODE_BYTES
    {
        return Err(anyhow!(
            "Backup {label} contains a raster image that exceeds the decode limits at {}.",
            path.display()
        ));
    }
    Ok(())
}

fn decode_backup_raster_file(
    path: &Path,
    label: &str,
    format: ImageFormat,
) -> Result<DynamicImage> {
    let file = File::open(path)
        .with_context(|| format!("Could not inspect backup media {}", path.display()))?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_BACKUP_RASTER_PIXELS as u32);
    limits.max_image_height = Some(MAX_BACKUP_RASTER_PIXELS as u32);
    limits.max_alloc = Some(MAX_BACKUP_RASTER_DECODE_BYTES);
    let mut reader = ImageReader::with_format(BufReader::new(file), format);
    reader.limits(limits);
    let decoder = reader.into_decoder().map_err(|_| {
        anyhow!(
            "Backup {label} contains an unreadable raster image at {}.",
            path.display()
        )
    })?;
    let (width, height) = decoder.dimensions();
    validate_backup_raster_decode_limits(width, height, decoder.total_bytes(), path, label)?;
    DynamicImage::from_decoder(decoder).map_err(|_| {
        anyhow!(
            "Backup {label} contains an unreadable raster image at {}.",
            path.display()
        )
    })
}

fn validate_backup_raster_file(path: &Path, label: &str) -> Result<()> {
    let mut file = File::open(path)
        .with_context(|| format!("Could not inspect backup media {}", path.display()))?;
    let extension = extension_lower(path);
    let mut signature = [0u8; 64];
    let bytes_read = file
        .read(&mut signature)
        .with_context(|| format!("Could not read backup media {}", path.display()))?;
    if !has_raster_signature(&signature[..bytes_read], &extension) {
        return Err(anyhow!(
            "Backup {label} contains invalid raster image contents at {}.",
            path.display()
        ));
    }

    // AVIF decoding is behind image's opt-in native dav1d feature. HEIC/HEIF
    // decoding is also platform-dependent, so these formats remain signature-only.
    if matches!(extension.as_str(), "avif" | "heic" | "heif") {
        return Ok(());
    }

    let format = ImageFormat::from_extension(&extension).ok_or_else(|| {
        anyhow!(
            "Backup {label} contains an unsupported raster image at {}.",
            path.display()
        )
    })?;
    decode_backup_raster_file(path, label, format)?;
    Ok(())
}

fn repair_legacy_png_webp_file(path: &Path, label: &str) -> Result<bool> {
    if extension_lower(path) != "webp" {
        return Ok(false);
    }
    let mut file = File::open(path)
        .with_context(|| format!("Could not inspect managed image {}", path.display()))?;
    let mut signature = [0u8; 8];
    let bytes_read = file
        .read(&mut signature)
        .with_context(|| format!("Could not read managed image {}", path.display()))?;
    drop(file);
    if !has_raster_signature(&signature[..bytes_read], "png") {
        return Ok(false);
    }

    let image = decode_backup_raster_file(path, label, ImageFormat::Png)?;
    let mut output = Cursor::new(Vec::new());
    image
        .write_to(&mut output, ImageFormat::WebP)
        .with_context(|| format!("Could not repair managed image {}", path.display()))?;
    atomic_write(path, &output.into_inner())
        .with_context(|| format!("Could not repair managed image {}", path.display()))?;
    Ok(true)
}

fn validate_backup_media_tree_with_repairs(
    root: &Path,
    label: &str,
    repair_legacy: bool,
) -> Result<()> {
    if !path_exists_without_following(root)? {
        return Ok(());
    }
    if !fs::symlink_metadata(root)?.file_type().is_dir() {
        return Err(anyhow!("Backup {label} must be a directory."));
    }

    fn validate_entries(path: &Path, label: &str, repair_legacy: bool) -> Result<()> {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let entry_path = entry.path();
            let file_type = entry.file_type()?;
            if file_type.is_dir() {
                validate_entries(&entry_path, label, repair_legacy)?;
            } else if file_type.is_file() && is_allowed_image_extension(&entry_path) {
                if repair_legacy {
                    repair_legacy_png_webp_file(&entry_path, label)?;
                }
                validate_backup_raster_file(&entry_path, label)?;
            } else {
                return Err(anyhow!(
                    "Backup {label} contains an unsupported media file at {}.",
                    entry_path.display()
                ));
            }
        }
        Ok(())
    }

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let name = entry.file_name();
        let section = name.to_string_lossy();
        if !entry.file_type()?.is_dir() || !MANAGED_IMAGE_SUBDIRS.contains(&section.as_ref()) {
            return Err(anyhow!(
                "Backup {label} contains an unsupported media path at {}.",
                entry.path().display()
            ));
        }
        validate_entries(&entry.path(), label, repair_legacy)?;
    }
    Ok(())
}

#[cfg(test)]
fn validate_backup_media_tree(root: &Path, label: &str) -> Result<()> {
    validate_backup_media_tree_with_repairs(root, label, false)
}

fn repair_and_validate_backup_media_tree(root: &Path, label: &str) -> Result<()> {
    validate_backup_media_tree_with_repairs(root, label, true)
}

fn remove_path(path: &Path) -> Result<()> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    };
    if metadata.file_type().is_dir() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }
    Ok(())
}

fn path_exists_without_following(path: &Path) -> Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

fn safe_transaction_relative_path(root: &Path, path: &Path) -> Result<String> {
    let relative = path.strip_prefix(root).with_context(|| {
        format!(
            "Transaction target {} is outside {}",
            path.display(),
            root.display()
        )
    })?;
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(anyhow!("Transaction target path is invalid."));
    }
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

fn transaction_path_from_marker(root: &Path, relative: &str) -> Result<PathBuf> {
    let relative = Path::new(relative);
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(anyhow!(
            "Transaction marker contains an unsafe target path."
        ));
    }
    Ok(root.join(relative))
}

fn rollback_path_from_marker(rollback_root: &Path, name: &str) -> Result<PathBuf> {
    let path = Path::new(name);
    if path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
    {
        return Err(anyhow!(
            "Transaction marker contains an unsafe rollback path."
        ));
    }
    Ok(rollback_root.join(path))
}

fn transaction_marker_path(rollback_root: &Path) -> PathBuf {
    rollback_root.join(TRANSACTION_MARKER_NAME)
}

fn finalized_transaction_marker(marker: &TransactionMarker) -> TransactionMarker {
    TransactionMarker {
        version: marker.version,
        state: "finalized".to_string(),
        items: marker.items.clone(),
    }
}

fn retire_transaction_root(storage_root: &Path, rollback_root: &Path) -> Result<()> {
    if !path_exists_without_following(rollback_root)? {
        return Ok(());
    }
    let retired = storage_root.join(format!(".transaction-cleanup-{}", Uuid::new_v4().simple()));
    fs::rename(rollback_root, &retired).with_context(|| {
        format!(
            "Could not retire transaction recovery data {}",
            rollback_root.display()
        )
    })?;
    sync_directory(storage_root)?;
    if let Err(error) = remove_path(&retired) {
        eprintln!(
            "Retired transaction cleanup data remains at {}: {error}",
            retired.display()
        );
    }
    sync_directory(storage_root)?;
    Ok(())
}

fn sync_transaction_directories(items: &[StagedCommitItem], rollback_root: &Path) -> Result<()> {
    let mut directories = HashSet::new();
    if let Some(parent) = rollback_root.parent() {
        directories.insert(parent.to_path_buf());
    }
    directories.insert(rollback_root.to_path_buf());
    for item in items {
        if let Some(parent) = item.target.parent() {
            directories.insert(parent.to_path_buf());
        }
        if let Some(parent) = item.staged.as_ref().and_then(|path| path.parent()) {
            directories.insert(parent.to_path_buf());
        }
    }
    for directory in directories {
        sync_directory(&directory)?;
    }
    Ok(())
}

fn recover_marked_transaction(
    storage_root: &Path,
    rollback_root: &Path,
    marker: &TransactionMarker,
) -> Result<()> {
    recover_marked_transaction_with(storage_root, rollback_root, marker, |_| Ok(()))
}

fn recover_marked_transaction_with<F>(
    storage_root: &Path,
    rollback_root: &Path,
    marker: &TransactionMarker,
    mut after_restore: F,
) -> Result<()>
where
    F: FnMut(usize) -> Result<()>,
{
    if marker.version != 1 {
        return Err(anyhow!(
            "Unsupported transaction marker version {} at {}",
            marker.version,
            rollback_root.display()
        ));
    }
    if marker.state != "prepared" && marker.state != "committed" && marker.state != "finalized" {
        return Err(anyhow!(
            "Unknown transaction state at {}",
            rollback_root.display()
        ));
    }
    if marker.state == "finalized" {
        return retire_transaction_root(storage_root, rollback_root);
    }
    let mut recovery_marker = marker.clone();
    if marker.state == "committed" {
        let mut committed_state_is_complete = true;
        for item in &marker.items {
            let target = transaction_path_from_marker(storage_root, &item.target)?;
            if path_exists_without_following(&target)? != item.has_staged {
                committed_state_is_complete = false;
                break;
            }
        }
        if committed_state_is_complete {
            return retire_transaction_root(storage_root, rollback_root);
        }
        recovery_marker.state = "prepared".to_string();
        write_json(
            &transaction_marker_path(rollback_root),
            &serde_json::to_value(&recovery_marker)?,
        )
        .with_context(|| {
            format!(
                "Could not durably prepare incomplete transaction recovery at {}",
                rollback_root.display()
            )
        })?;
    }

    for (restore_index, item) in recovery_marker.items.iter().rev().enumerate() {
        let target = transaction_path_from_marker(storage_root, &item.target)?;
        let rollback = rollback_path_from_marker(rollback_root, &item.rollback)?;
        let mut restored = false;
        if path_exists_without_following(&rollback)? {
            remove_path(&target)?;
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::rename(&rollback, &target).with_context(|| {
                format!(
                    "Could not recover interrupted transaction target {}",
                    target.display()
                )
            })?;
            if let Some(parent) = target.parent() {
                sync_directory(parent)?;
            }
            restored = true;
        } else if !item.had_target {
            remove_path(&target)?;
            if let Some(parent) = target.parent() {
                sync_directory(parent)?;
            }
            restored = true;
        } else if !path_exists_without_following(&target)? {
            return Err(anyhow!(
                "Interrupted transaction recovery is missing both {} and its rollback copy.",
                target.display()
            ));
        }
        if restored {
            after_restore(restore_index)?;
        }
    }
    sync_directory(storage_root)?;
    sync_directory(rollback_root)?;
    write_json(
        &transaction_marker_path(rollback_root),
        &serde_json::to_value(finalized_transaction_marker(&recovery_marker))?,
    )?;
    retire_transaction_root(storage_root, rollback_root)
}

fn legacy_transaction_items(
    storage_root: &Path,
    rollback_name: &str,
) -> Option<Vec<(PathBuf, &'static str, bool)>> {
    if rollback_name.starts_with(".collection-save-rollback-") {
        return Some(vec![
            (storage_root.join("data.json"), "0-data.json", true),
            (
                storage_root.join("preferences.json"),
                "1-preferences.json",
                true,
            ),
        ]);
    }
    if rollback_name.starts_with(".backup-import-rollback-") {
        return Some(vec![
            (storage_root.join("data.json"), "0-data.json", true),
            (
                storage_root.join("preferences.json"),
                "1-preferences.json",
                true,
            ),
            (storage_root.join("images"), "2-images", true),
            (
                storage_root.join("replaced-images"),
                "3-replaced-images",
                false,
            ),
        ]);
    }
    None
}

fn recover_legacy_transaction(storage_root: &Path, rollback_root: &Path) -> Result<()> {
    recover_legacy_transaction_with(storage_root, rollback_root, |_| Ok(()))
}

fn recover_legacy_transaction_with<F>(
    storage_root: &Path,
    rollback_root: &Path,
    after_restore: F,
) -> Result<()>
where
    F: FnMut(usize) -> Result<()>,
{
    let rollback_name = rollback_root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let Some(items) = legacy_transaction_items(storage_root, rollback_name) else {
        return Ok(());
    };
    let mut live_complete = true;
    for (target, _, required) in &items {
        if *required && !path_exists_without_following(target)? {
            live_complete = false;
            break;
        }
    }
    if live_complete {
        write_json(
            &transaction_marker_path(rollback_root),
            &serde_json::to_value(TransactionMarker {
                version: 1,
                state: "finalized".to_string(),
                items: Vec::new(),
            })?,
        )?;
        return retire_transaction_root(storage_root, rollback_root);
    }

    let marker = TransactionMarker {
        version: 1,
        state: "prepared".to_string(),
        items: items
            .iter()
            .map(|(target, rollback_name, required)| {
                let rollback_exists =
                    path_exists_without_following(&rollback_root.join(rollback_name))?;
                Ok(TransactionMarkerItem {
                    target: safe_transaction_relative_path(storage_root, target)?,
                    rollback: (*rollback_name).to_string(),
                    had_target: *required || rollback_exists,
                    has_staged: *required,
                })
            })
            .collect::<Result<Vec<_>>>()?,
    };
    write_json(
        &transaction_marker_path(rollback_root),
        &serde_json::to_value(&marker)?,
    )?;
    recover_marked_transaction_with(storage_root, rollback_root, &marker, after_restore)
}

fn recover_interrupted_transactions(storage_root: &Path) -> Result<()> {
    let mut transactions = Vec::new();
    for entry in fs::read_dir(storage_root)
        .with_context(|| format!("Could not inspect storage root {}", storage_root.display()))?
    {
        let entry = entry
            .with_context(|| format!("Could not inspect an entry in {}", storage_root.display()))?;
        let file_type = entry.file_type().with_context(|| {
            format!("Could not inspect storage entry {}", entry.path().display())
        })?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !file_type.is_dir()
            || (!name.starts_with(".collection-save-rollback-")
                && !name.starts_with(".backup-import-rollback-"))
        {
            continue;
        }
        let modified = entry
            .metadata()
            .with_context(|| format!("Could not inspect transaction {}", entry.path().display()))?
            .modified()
            .with_context(|| {
                format!(
                    "Could not read transaction timestamp {}",
                    entry.path().display()
                )
            })?;
        transactions.push((entry.path(), modified));
    }
    transactions.sort_by_key(|(_, modified)| *modified);

    for (rollback_root, _) in transactions {
        let marker_path = transaction_marker_path(&rollback_root);
        match fs::symlink_metadata(&marker_path) {
            Ok(metadata) if metadata.file_type().is_file() => {
                let marker: TransactionMarker = serde_json::from_value(read_json(&marker_path)?)
                    .with_context(|| {
                        format!(
                            "Could not parse transaction marker {}",
                            marker_path.display()
                        )
                    })?;
                recover_marked_transaction(storage_root, &rollback_root, &marker)?;
            }
            Ok(_) => {
                return Err(anyhow!(
                    "Transaction marker is not a regular file: {}",
                    marker_path.display()
                ));
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                recover_legacy_transaction(storage_root, &rollback_root)?;
            }
            Err(error) => {
                return Err(error).with_context(|| {
                    format!(
                        "Could not inspect transaction marker {}",
                        marker_path.display()
                    )
                });
            }
        }
    }
    Ok(())
}

fn commit_staged_items(items: &[StagedCommitItem], rollback_root: &Path) -> Result<Vec<String>> {
    commit_staged_items_with(items, rollback_root, |_| Ok(()))
}

fn commit_staged_items_with<F>(
    items: &[StagedCommitItem],
    rollback_root: &Path,
    before_promote: F,
) -> Result<Vec<String>>
where
    F: FnMut(usize) -> Result<()>,
{
    commit_staged_items_with_marker_writer(items, rollback_root, before_promote, write_json)
}

fn commit_staged_items_with_marker_writer<F, M>(
    items: &[StagedCommitItem],
    rollback_root: &Path,
    mut before_promote: F,
    mut write_marker: M,
) -> Result<Vec<String>>
where
    F: FnMut(usize) -> Result<()>,
    M: FnMut(&Path, &Value) -> Result<()>,
{
    let transaction_root = rollback_root
        .parent()
        .ok_or_else(|| anyhow!("Could not resolve transaction root"))?;
    let mut targets = HashSet::new();
    let mut marker_items = Vec::new();
    for item in items {
        if !targets.insert(item.target.clone()) {
            return Err(anyhow!(
                "Duplicate transaction target {}",
                item.target.display()
            ));
        }
        if let Some(staged) = &item.staged {
            if !path_exists_without_following(staged)? {
                return Err(anyhow!("Missing staged import item {}", staged.display()));
            }
        }
        if let Some(parent) = item.target.parent() {
            fs::create_dir_all(parent)?;
        }
        marker_items.push(TransactionMarkerItem {
            target: safe_transaction_relative_path(transaction_root, &item.target)?,
            rollback: format!("{}-{}", marker_items.len(), item.label),
            had_target: path_exists_without_following(&item.target)?,
            has_staged: item.staged.is_some(),
        });
    }

    remove_path(rollback_root)?;
    fs::create_dir_all(rollback_root)?;
    sync_directory(transaction_root)?;
    let mut marker = TransactionMarker {
        version: 1,
        state: "prepared".to_string(),
        items: marker_items,
    };
    let marker_path = transaction_marker_path(rollback_root);
    if let Err(error) = write_marker(&marker_path, &serde_json::to_value(&marker)?) {
        if file_was_installed_before_error(&error) {
            return Err(anyhow!(
                "The prepared transaction marker was installed, but its directory could not be synced. Live data was not changed; recovery data remains at {}: {error}",
                rollback_root.display()
            ));
        }
        return Err(error);
    }
    let mut backed_up = Vec::new();
    let mut promoted = Vec::new();
    let mut committed_marker_sync_warning = None;

    let commit_result = (|| -> Result<()> {
        for (item, marker_item) in items.iter().zip(&marker.items) {
            if !marker_item.had_target {
                continue;
            }
            let rollback = rollback_path_from_marker(rollback_root, &marker_item.rollback)?;
            fs::rename(&item.target, &rollback).with_context(|| {
                format!(
                    "Could not stage existing {} for rollback",
                    item.target.display()
                )
            })?;
            backed_up.push((item.target.clone(), rollback));
        }
        sync_transaction_directories(items, rollback_root)?;

        for (index, item) in items.iter().enumerate() {
            before_promote(index)?;
            let Some(staged) = &item.staged else {
                continue;
            };
            fs::rename(staged, &item.target).with_context(|| {
                format!(
                    "Could not promote staged {} to {}",
                    staged.display(),
                    item.target.display()
                )
            })?;
            promoted.push(item.target.clone());
        }
        sync_transaction_directories(items, rollback_root)?;
        marker.state = "committed".to_string();
        if let Err(error) = write_marker(&marker_path, &serde_json::to_value(&marker)?) {
            if file_was_installed_before_error(&error) {
                committed_marker_sync_warning = Some(format!(
                    "the committed transaction marker was installed but its directory could not be synced; recovery data remains at {}: {error}",
                    rollback_root.display()
                ));
            } else {
                return Err(error);
            }
        }
        Ok(())
    })();

    if let Err(error) = commit_result {
        let mut rollback_errors = Vec::new();
        for target in promoted.iter().rev() {
            if let Err(rollback_error) = remove_path(target) {
                rollback_errors.push(format!(
                    "could not remove promoted {}: {rollback_error}",
                    target.display()
                ));
            }
        }
        for (target, rollback) in backed_up.iter().rev() {
            let rollback_exists = match path_exists_without_following(rollback) {
                Ok(exists) => exists,
                Err(rollback_error) => {
                    rollback_errors.push(format!(
                        "could not inspect rollback copy {}: {rollback_error}",
                        rollback.display()
                    ));
                    continue;
                }
            };
            if !rollback_exists {
                continue;
            }
            let target_exists = match path_exists_without_following(target) {
                Ok(exists) => exists,
                Err(rollback_error) => {
                    rollback_errors.push(format!(
                        "could not inspect rollback target {}: {rollback_error}",
                        target.display()
                    ));
                    continue;
                }
            };
            if target_exists {
                if let Err(rollback_error) = remove_path(target) {
                    rollback_errors.push(format!(
                        "could not clear {} before rollback: {rollback_error}",
                        target.display()
                    ));
                    continue;
                }
            }
            if let Err(rollback_error) = fs::rename(rollback, target) {
                rollback_errors.push(format!(
                    "could not restore {}: {rollback_error}",
                    target.display()
                ));
            }
        }
        if rollback_errors.is_empty() {
            if let Err(sync_error) = sync_transaction_directories(items, rollback_root) {
                return Err(anyhow!(
                    "{error}; the transaction was rolled back, but its directories could not be synced: {sync_error}. Recovery data remains at {}",
                    rollback_root.display()
                ));
            }
            marker.state = "finalized".to_string();
            if let Err(marker_error) = write_marker(&marker_path, &serde_json::to_value(&marker)?) {
                let installed_note = if file_was_installed_before_error(&marker_error) {
                    " was installed, but its directory could not be synced"
                } else {
                    " could not be installed"
                };
                return Err(anyhow!(
                    "{error}; the transaction was rolled back, but its finalized recovery marker{installed_note}: {marker_error}"
                ));
            }
            let cleanup_note = retire_transaction_root(transaction_root, rollback_root)
                .err()
                .map(|cleanup_error| {
                    format!(
                        "; finalized rollback data remains at {} because it could not be retired: {cleanup_error}",
                        rollback_root.display()
                    )
                })
                .unwrap_or_default();
            return Err(anyhow!(
                "{error}; the transaction was rolled back{cleanup_note}"
            ));
        }
        return Err(anyhow!(
            "{error}; rollback was incomplete and recovery data was preserved at {}: {}",
            rollback_root.display(),
            rollback_errors.join("; "),
        ));
    }

    let mut warnings = Vec::new();
    if let Some(warning) = committed_marker_sync_warning {
        warnings.push(warning);
        return Ok(warnings);
    }
    if let Err(error) = retire_transaction_root(transaction_root, rollback_root) {
        warnings.push(format!(
            "committed collection rollback data could not be retired: {error}"
        ));
    }
    Ok(warnings)
}

fn commit_collection_state(
    paths: &StoragePaths,
    collection: &Value,
    preferences: &Value,
) -> Result<Vec<String>> {
    let stage = paths.root.join(format!(
        ".collection-save-stage-{}",
        Uuid::new_v4().simple()
    ));
    let rollback = paths.root.join(format!(
        ".collection-save-rollback-{}",
        Uuid::new_v4().simple()
    ));
    fs::create_dir_all(&stage)?;

    let result = (|| -> Result<Vec<String>> {
        let staged_data = stage.join("data.json");
        let staged_preferences = stage.join("preferences.json");
        write_json(&staged_data, collection)?;
        write_json(&staged_preferences, preferences)?;
        let items = [
            StagedCommitItem {
                label: "data.json",
                staged: Some(staged_data),
                target: paths.data.clone(),
            },
            StagedCommitItem {
                label: "preferences.json",
                staged: Some(staged_preferences),
                target: paths.preferences.clone(),
            },
        ];
        let mut warnings = commit_staged_items(&items, &rollback)?;
        if let Err(error) = remove_path(&stage) {
            warnings.push(format!("temporary save data could not be removed: {error}"));
        }
        Ok(warnings)
    })();

    if result.is_err() {
        let _ = remove_path(&stage);
    }
    result
}

fn timestamp() -> String {
    Utc::now().format("%Y%m%d-%H%M%S").to_string()
}

fn sanitize_slug(value: &str) -> String {
    let mut out = value
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>();
    while out.contains("--") {
        out = out.replace("--", "-");
    }
    out.trim_matches('-').to_string()
}

fn metadata_string(metadata: &Value, key: &str, fallback: &str) -> String {
    metadata
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| fallback.to_string())
}

fn bounded_metadata_filename_stem(stem: String) -> String {
    if stem.len() <= MAX_METADATA_FILENAME_STEM_LEN {
        return stem;
    }
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;
    let mut hash = FNV_OFFSET;
    for byte in stem.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    let suffix = format!("-{hash:016x}");
    let prefix_len = MAX_METADATA_FILENAME_STEM_LEN - suffix.len();
    format!("{}{}", &stem[..prefix_len], suffix)
}

fn pen_filename_stem(metadata: &Value) -> String {
    let brand = sanitize_slug(&metadata_string(metadata, "brand", "unknown"));
    let model = sanitize_slug(&metadata_string(metadata, "model", "pen"));
    let nib = sanitize_slug(&metadata_string(metadata, "nib", "standard"));
    let color = sanitize_slug(&metadata_string(metadata, "color", "standard"));
    bounded_metadata_filename_stem(format!("{brand}-{model}-{nib}-{color}"))
}

fn image_filename_is_occupied(
    image_dir: &Path,
    thumbnail_dir: &Path,
    filename: &str,
) -> Result<bool> {
    Ok(path_exists_without_following(&image_dir.join(filename))?
        || path_exists_without_following(&thumbnail_dir.join(filename))?)
}

fn next_numbered_filename(image_dir: &Path, thumbnail_dir: &Path, stem: &str) -> Result<String> {
    let mut next = 1usize;
    loop {
        let filename = format!("{stem}-{next}.webp");
        if !image_filename_is_occupied(image_dir, thumbnail_dir, &filename)? {
            return Ok(filename);
        }
        next += 1;
    }
}

fn ink_filename_stem(metadata: &Value) -> String {
    let brand = sanitize_slug(&metadata_string(metadata, "brand", "unknown"));
    let model = sanitize_slug(&metadata_string(metadata, "model", "ink"));
    bounded_metadata_filename_stem(format!("{brand}-{model}"))
}

fn next_ink_filename(image_dir: &Path, thumbnail_dir: &Path, metadata: &Value) -> Result<String> {
    let stem = ink_filename_stem(metadata);
    let filename = format!("{stem}.webp");
    if !image_filename_is_occupied(image_dir, thumbnail_dir, &filename)? {
        return Ok(filename);
    }
    let mut next = 2usize;
    loop {
        let filename = format!("{stem}-{next}.webp");
        if !image_filename_is_occupied(image_dir, thumbnail_dir, &filename)? {
            return Ok(filename);
        }
        next += 1;
    }
}

fn swatch_filename_stem(metadata: &Value) -> String {
    let brand = sanitize_slug(&metadata_string(metadata, "brand", "unknown"));
    let model = sanitize_slug(&metadata_string(metadata, "model", "swatch"));
    bounded_metadata_filename_stem(format!("{brand}-{model}"))
}

fn next_swatch_filename(
    image_dir: &Path,
    thumbnail_dir: &Path,
    metadata: &Value,
) -> Result<String> {
    let stem = swatch_filename_stem(metadata);
    loop {
        let filename = format!(
            "{stem}-{}-{}.webp",
            Utc::now().timestamp_millis(),
            Uuid::new_v4().simple()
        );
        if !image_filename_is_occupied(image_dir, thumbnail_dir, &filename)? {
            return Ok(filename);
        }
    }
}

fn normalize_managed_relative_image_path(input: &str) -> Option<String> {
    if input.is_empty()
        || input.trim() != input
        || input.contains(['\\', '?', '#'])
        || input.chars().any(char::is_control)
    {
        return None;
    }
    let relative = input.strip_prefix("images/").unwrap_or(input);
    if relative.is_empty()
        || relative.starts_with('/')
        || relative.ends_with('/')
        || relative
            .split('/')
            .any(|component| component.is_empty() || component == "." || component == "..")
    {
        return None;
    }
    let path = Path::new(relative);
    let mut components = path.components();
    let Some(Component::Normal(section)) = components.next() else {
        return None;
    };
    if !MANAGED_IMAGE_SUBDIRS
        .iter()
        .any(|allowed| section == *allowed)
        || components.next().is_none()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
        || !is_allowed_image_extension(path)
    {
        return None;
    }
    Some(relative.to_string())
}

fn require_managed_relative_image_path(input: &str) -> Result<String> {
    normalize_managed_relative_image_path(input)
        .ok_or_else(|| anyhow!("Invalid managed image path: {input}"))
}

fn path_inside(parent: &Path, candidate: &Path) -> bool {
    let parent = match parent.canonicalize() {
        Ok(path) => path,
        Err(_) => return false,
    };
    let candidate = candidate
        .canonicalize()
        .unwrap_or_else(|_| candidate.to_path_buf());
    candidate.starts_with(parent)
}

fn collection_references_local_image_path(app: &AppHandle, candidate: &Path) -> Result<bool> {
    let data = read_json(&data_path(app)?)?;
    let candidate = candidate
        .canonicalize()
        .unwrap_or_else(|_| candidate.to_path_buf());

    for key in ["pens", "inks", "swatches"] {
        let Some(items) = data.get(key).and_then(Value::as_array) else {
            continue;
        };
        for item in items {
            let direct = item.get("image").and_then(Value::as_str);
            let gallery = item
                .get("images")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|entry| entry.get("path").and_then(Value::as_str));
            for raw_path in direct.into_iter().chain(gallery) {
                let Ok(path) = local_path_from_input(raw_path) else {
                    continue;
                };
                let path = path.canonicalize().unwrap_or(path);
                if path == candidate {
                    return Ok(true);
                }
            }
        }
    }

    Ok(false)
}

fn local_path_from_input(input: &str) -> Result<PathBuf> {
    if input.starts_with("file://") {
        let url = Url::parse(input)?;
        return url.to_file_path().map_err(|_| anyhow!("Invalid file URL"));
    }
    Ok(PathBuf::from(input))
}

fn take_selected_backup_path(
    selected_backup_paths: &Mutex<HashSet<PathBuf>>,
    input: &str,
) -> Result<PathBuf> {
    let path = local_path_from_input(input)?;
    let was_selected = selected_backup_paths
        .lock()
        .map_err(|_| anyhow!("Backup selection state is unavailable"))?
        .remove(&path);
    if !was_selected {
        return Err(anyhow!("The selected backup is no longer available."));
    }
    if !path.is_file() {
        return Err(anyhow!("Selected backup file does not exist."));
    }
    if extension_lower(&path) != "zip" {
        return Err(anyhow!("Selected backup must be a ZIP archive."));
    }
    Ok(path)
}

fn extension_lower(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase()
}

fn is_allowed_image_extension(path: &Path) -> bool {
    let ext = extension_lower(path);
    ALLOWED_IMAGE_EXTENSIONS.contains(&ext.as_str())
}

fn image_mime_type(path: &Path) -> &'static str {
    match extension_lower(path).as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    }
}

fn managed_media_base_url() -> &'static str {
    if cfg!(any(target_os = "windows", target_os = "android")) {
        "http://inkubator.localhost/images"
    } else {
        "inkubator://localhost/images"
    }
}

fn inspect_path_without_symlinks(root: &Path, relative: &Path) -> Result<Option<fs::Metadata>> {
    let root_metadata = fs::symlink_metadata(root)
        .with_context(|| format!("Could not inspect managed root {}", root.display()))?;
    if !root_metadata.file_type().is_dir() {
        return Err(anyhow!(
            "Managed root is not a real directory: {}",
            root.display()
        ));
    }
    let components = relative.components().collect::<Vec<_>>();
    let mut current = root.to_path_buf();
    for (index, component) in components.iter().enumerate() {
        let Component::Normal(name) = component else {
            return Err(anyhow!("Invalid managed path."));
        };
        current.push(name);
        match fs::symlink_metadata(&current) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err(anyhow!(
                        "Managed path contains a symbolic link: {}",
                        current.display()
                    ));
                }
                if index + 1 < components.len() && !metadata.file_type().is_dir() {
                    return Err(anyhow!(
                        "Managed path parent is not a directory: {}",
                        current.display()
                    ));
                }
                if index + 1 == components.len() {
                    return Ok(Some(metadata));
                }
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => {
                return Err(error).with_context(|| {
                    format!("Could not inspect managed path {}", current.display())
                })
            }
        }
    }
    Ok(Some(root_metadata))
}

fn is_real_managed_file(root: &Path, target: &Path) -> Result<bool> {
    let relative = target
        .strip_prefix(root)
        .with_context(|| format!("Managed path is outside {}", root.display()))?;
    Ok(inspect_path_without_symlinks(root, relative)?
        .map(|metadata| metadata.file_type().is_file())
        .unwrap_or(false))
}

fn resolve_managed_media_path(images_root: &Path, request_path: &str) -> Result<PathBuf> {
    let decoded = urlencoding::decode(request_path).context("Invalid managed image URL")?;
    let relative = decoded
        .trim_start_matches('/')
        .strip_prefix("images/")
        .ok_or_else(|| anyhow!("Invalid managed image URL"))?;
    let relative_path = Path::new(relative);
    if relative_path.as_os_str().is_empty()
        || relative_path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(anyhow!("Invalid managed image path"));
    }
    let target = images_root.join(relative_path);
    if !is_allowed_image_extension(&target) {
        return Err(anyhow!("Invalid managed image path"));
    }
    if let Some(metadata) = inspect_path_without_symlinks(images_root, relative_path)? {
        if !metadata.file_type().is_file() {
            return Err(anyhow!("Managed image path is not a regular file"));
        }
    }
    Ok(target)
}

fn managed_media_response(
    app: &AppHandle,
    request: &tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    use tauri::http::{header, Method, Response, StatusCode};

    let response =
        |status, body: Vec<u8>, content_type: &'static str, cache_control: &'static str| {
            Response::builder()
                .status(status)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .header(header::CACHE_CONTROL, cache_control)
                .header(header::CONTENT_LENGTH, body.len())
                .body(body)
                .unwrap_or_else(|_| Response::new(Vec::new()))
        };

    if request.method() != Method::GET && request.method() != Method::HEAD {
        return response(
            StatusCode::METHOD_NOT_ALLOWED,
            Vec::new(),
            "text/plain",
            "no-store",
        );
    }
    let _storage_lock = match acquire_app_storage_lock(app) {
        Ok(lock) => lock,
        Err(_) => {
            return response(
                StatusCode::INTERNAL_SERVER_ERROR,
                Vec::new(),
                "text/plain",
                "no-store",
            )
        }
    };
    let images = match images_path(app) {
        Ok(path) => path,
        Err(_) => {
            return response(
                StatusCode::INTERNAL_SERVER_ERROR,
                Vec::new(),
                "text/plain",
                "no-store",
            )
        }
    };
    let requested_target = match resolve_managed_media_path(&images, request.uri().path()) {
        Ok(path) => path,
        Err(_) => return response(StatusCode::FORBIDDEN, Vec::new(), "text/plain", "no-store"),
    };
    let thumbnail_root = images.join(".thumbs");
    let fallback = requested_target
        .strip_prefix(&thumbnail_root)
        .ok()
        .map(|relative| images.join(relative))
        .filter(|path| is_real_managed_file(&images, path).unwrap_or(false));
    let requested_is_file = is_real_managed_file(&images, &requested_target).unwrap_or(false);
    let using_full_image_fallback = !requested_is_file && fallback.is_some();
    let target = if requested_is_file {
        requested_target
    } else if let Some(path) = fallback {
        path
    } else {
        return response(StatusCode::NOT_FOUND, Vec::new(), "text/plain", "no-store");
    };
    let content_type = if !using_full_image_fallback && target.starts_with(&thumbnail_root) {
        "image/webp"
    } else {
        image_mime_type(&target)
    };
    let body = if request.method() == Method::HEAD {
        Vec::new()
    } else {
        match fs::read(&target) {
            Ok(bytes) => bytes,
            Err(_) => {
                return response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Vec::new(),
                    "text/plain",
                    "no-store",
                )
            }
        }
    };
    response(
        StatusCode::OK,
        body,
        content_type,
        if using_full_image_fallback {
            "no-store"
        } else {
            "public, max-age=31536000, immutable"
        },
    )
}

fn assert_allowed_local_image_path(
    app: &AppHandle,
    state: &State<InkubatorState>,
    input: &str,
) -> Result<PathBuf> {
    let path = local_path_from_input(input)?;
    if !path.exists() || !path.is_file() {
        return Err(anyhow!("Selected image file does not exist."));
    }
    if !is_allowed_image_extension(&path) {
        return Err(anyhow!("Unsupported image file type."));
    }

    let images = images_path(app)?;
    let selected = state
        .selected_external_image_paths
        .lock()
        .map_err(|_| anyhow!("Image selection state is unavailable"))?;
    let selected_ok = selected.contains(&path);
    let managed_ok = path_inside(&images, &path);
    let referenced_ok = collection_references_local_image_path(app, &path)?;
    if !selected_ok && !managed_ok && !referenced_ok {
        return Err(anyhow!("Access to this image path is not allowed."));
    }
    Ok(path)
}

fn process_image_to_webp_with_max(
    source: &[u8],
    source_hint: &str,
    max_size: u32,
) -> Result<Vec<u8>> {
    let lower = source_hint.to_lowercase();
    if lower.ends_with(".heic") || lower.ends_with(".heif") {
        return Err(anyhow!(
            "HEIC/HEIF images must be converted before entering the Rust image pipeline."
        ));
    }

    if is_preprocessed_heic_webp(source_hint) && has_raster_signature(source, "webp") {
        let image = image::load_from_memory(source).context("Could not decode image")?;
        if image.width() <= max_size && image.height() <= max_size {
            return Ok(source.to_vec());
        }
    }

    let image = image::load_from_memory(source).context("Could not decode image")?;
    let resized = if image.width() > max_size || image.height() > max_size {
        image.thumbnail(max_size, max_size)
    } else {
        image
    };
    let mut output = Cursor::new(Vec::new());
    resized.write_to(&mut output, ImageFormat::WebP)?;
    Ok(output.into_inner())
}

fn process_image_to_webp(source: &[u8], source_hint: &str) -> Result<Vec<u8>> {
    process_image_to_webp_with_max(source, source_hint, 1200)
}

fn is_preprocessed_heic_webp(source_hint: &str) -> bool {
    let lower = source_hint.to_lowercase();
    lower.ends_with(".heic.webp") || lower.ends_with(".heif.webp")
}

fn thumbnail_path_for_images_root(images_root: &Path, relative_path: &str) -> Result<PathBuf> {
    let normalized = require_managed_relative_image_path(relative_path)?;
    let root = images_root.join(".thumbs");
    let target = root.join(normalized);
    Ok(target)
}

fn thumbnail_path_for(app: &AppHandle, relative_path: &str) -> Result<PathBuf> {
    thumbnail_path_for_images_root(&images_path(app)?, relative_path)
}

fn write_thumbnail_for(
    app: &AppHandle,
    relative_path: &str,
    source_bytes: &[u8],
    source_hint: &str,
) -> Result<()> {
    write_thumbnail_for_storage_root(
        &app_storage_dir(app)?,
        relative_path,
        source_bytes,
        source_hint,
    )?;
    Ok(())
}

fn write_thumbnail_for_storage_root(
    storage_root: &Path,
    relative_path: &str,
    source_bytes: &[u8],
    source_hint: &str,
) -> Result<PathBuf> {
    let normalized = require_managed_relative_image_path(relative_path)?;
    let relative = Path::new(&normalized);
    let section = relative
        .components()
        .next()
        .and_then(|component| match component {
            Component::Normal(value) => value.to_str(),
            _ => None,
        })
        .ok_or_else(|| anyhow!("Invalid thumbnail section."))?;
    let (_, thumbnail_section) = ensure_managed_write_roots(storage_root, section)?;
    let nested_parent = relative
        .parent()
        .and_then(|parent| parent.strip_prefix(section).ok())
        .unwrap_or_else(|| Path::new(""));
    ensure_real_relative_directory(&thumbnail_section, nested_parent)?;
    let target = storage_root.join("images/.thumbs").join(relative);
    let thumbnail = process_image_to_webp_with_max(source_bytes, source_hint, 480)?;
    write_file_synced(&target, &thumbnail)?;
    Ok(target)
}

fn ensure_thumbnail_for(app: &AppHandle, relative_path: &str) -> Result<()> {
    let normalized = require_managed_relative_image_path(relative_path)?;
    let images = images_path(app)?;
    let target = thumbnail_path_for(app, &normalized)?;
    let thumbnail_relative = target
        .strip_prefix(&images)
        .context("Thumbnail path is outside the image directory.")?;
    if let Some(metadata) = inspect_path_without_symlinks(&images, thumbnail_relative)? {
        if metadata.file_type().is_file() {
            return Ok(());
        }
        return Err(anyhow!("Managed thumbnail target is not a regular file."));
    }
    let source = images.join(&normalized);
    let Some(metadata) = inspect_path_without_symlinks(&images, Path::new(&normalized))? else {
        return Ok(());
    };
    if !metadata.file_type().is_file() {
        return Err(anyhow!("Managed image source is not a regular file."));
    }
    let bytes = fs::read(&source)?;
    write_thumbnail_for(app, &normalized, &bytes, &normalized)
}

fn ensure_referenced_thumbnails(app: &AppHandle, data: &Value) -> Result<()> {
    ensure_managed_storage_tree(&app_storage_dir(app)?)?;
    let mut failures = Vec::new();
    for relative_path in collect_referenced_images(data) {
        if let Err(error) = ensure_thumbnail_for(app, &relative_path) {
            eprintln!("Failed to generate thumbnail for {relative_path}: {error}");
            failures.push(relative_path);
        }
    }
    if !failures.is_empty() {
        return Err(anyhow!(
            "{} referenced thumbnail(s) could not be generated.",
            failures.len()
        ));
    }
    Ok(())
}

fn regenerate_thumbnails_in_background(app: AppHandle, data: Value) {
    tauri::async_runtime::spawn_blocking(move || {
        let _storage_lock = match acquire_app_storage_lock(&app) {
            Ok(lock) => lock,
            Err(error) => {
                eprintln!("Could not lock storage while regenerating thumbnails: {error}");
                return;
            }
        };
        if let Err(error) = ensure_referenced_thumbnails(&app, &data) {
            eprintln!("Some thumbnails could not be generated in the background: {error}");
        }
    });
}

fn remove_image_artifacts(image_target: &Path, thumbnail_target: &Path) -> Result<()> {
    let mut failures = Vec::new();
    for (label, target) in [
        ("full image", image_target),
        ("thumbnail", thumbnail_target),
    ] {
        match fs::remove_file(target) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => failures.push(format!("{label} {}: {error}", target.display())),
        }
    }
    if failures.is_empty() {
        Ok(())
    } else {
        Err(anyhow!(
            "Could not remove image artifacts: {}",
            failures.join("; ")
        ))
    }
}

fn remove_thumbnail_artifact(thumbnail: &Path, relative_path: &str) -> Result<()> {
    match fs::remove_file(thumbnail) {
        Ok(()) => {
            if let Some(parent) = thumbnail.parent() {
                sync_directory_best_effort(parent);
            }
            Ok(())
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(anyhow!(
            "Could not remove thumbnail for {relative_path} at {}: {error}",
            thumbnail.display()
        )),
    }
}

fn write_image_with_thumbnail<F>(
    image_target: &Path,
    thumbnail_target: &Path,
    image_bytes: &[u8],
    write_thumbnail: F,
) -> Result<()>
where
    F: FnOnce() -> Result<()>,
{
    write_file_synced(image_target, image_bytes)?;
    if let Err(error) = write_thumbnail() {
        return match remove_image_artifacts(image_target, thumbnail_target) {
            Ok(()) => Err(error),
            Err(cleanup_error) => Err(anyhow!(
                "Thumbnail save failed and image cleanup was incomplete: {error}; {cleanup_error}"
            )),
        };
    }
    Ok(())
}

fn save_processed_image(
    app: &AppHandle,
    source_bytes: &[u8],
    source_hint: &str,
    image_type: &str,
    metadata: &Value,
) -> Result<String> {
    save_processed_image_for_storage_root(
        &app_storage_dir(app)?,
        source_bytes,
        source_hint,
        image_type,
        metadata,
    )
}

fn save_processed_image_for_storage_root(
    storage_root: &Path,
    source_bytes: &[u8],
    source_hint: &str,
    image_type: &str,
    metadata: &Value,
) -> Result<String> {
    let folder = match image_type {
        "pen" => "pens",
        "swatch" => "swatches",
        _ => "inks",
    };
    let (dir, thumbnail_dir) = ensure_managed_write_roots(storage_root, folder)?;

    let filename = match image_type {
        "pen" => next_numbered_filename(&dir, &thumbnail_dir, &pen_filename_stem(metadata))?,
        "swatch" => next_swatch_filename(&dir, &thumbnail_dir, metadata)?,
        _ => next_ink_filename(&dir, &thumbnail_dir, metadata)?,
    };
    let output = process_image_to_webp(source_bytes, source_hint)?;
    let relative_path = format!("{folder}/{filename}");
    let image_target = dir.join(&filename);
    let thumbnail_target =
        thumbnail_path_for_images_root(&storage_root.join("images"), &relative_path)?;
    write_image_with_thumbnail(&image_target, &thumbnail_target, &output, || {
        write_thumbnail_for_storage_root(storage_root, &relative_path, &output, &relative_path)
            .map(|_| ())
    })?;
    Ok(relative_path)
}

fn collect_live_image_references(data: &Value) -> Vec<&str> {
    let mut references = Vec::new();
    for key in ["pens", "inks", "swatches"] {
        if let Some(items) = data.get(key).and_then(Value::as_array) {
            for item in items {
                for field in ["image", "image_url", "url"] {
                    if let Some(reference) = item.get(field).and_then(Value::as_str) {
                        references.push(reference);
                    }
                }
                if let Some(entries) = item.get("images").and_then(Value::as_array) {
                    for entry in entries {
                        if let Some(reference) = entry.as_str() {
                            references.push(reference);
                            continue;
                        }
                        for field in ["path", "image", "url"] {
                            if let Some(reference) = entry.get(field).and_then(Value::as_str) {
                                references.push(reference);
                            }
                        }
                    }
                }
            }
        }
    }
    references
}

fn is_ignored_managed_image_reference(value: &str) -> bool {
    if value.is_empty() || value == "default_pen.png" {
        return true;
    }
    let lowercase = value.to_ascii_lowercase();
    ["data:", "blob:", "http:", "https:", "file:"]
        .iter()
        .any(|scheme| lowercase.starts_with(scheme))
}

fn validate_managed_image_references(data: &Value) -> Result<()> {
    for reference in collect_live_image_references(data) {
        if is_ignored_managed_image_reference(reference) {
            continue;
        }
        if normalize_managed_relative_image_path(reference).is_none() {
            return Err(anyhow!(
                "Collection data contains an unsupported managed image path: {reference}"
            ));
        }
    }
    Ok(())
}

fn collect_referenced_images(data: &Value) -> Vec<String> {
    let mut out = HashSet::new();
    for reference in collect_live_image_references(data) {
        if is_ignored_managed_image_reference(reference) {
            continue;
        }
        if let Some(normalized) = normalize_managed_relative_image_path(reference) {
            out.insert(normalized);
        }
    }
    let mut paths = out.into_iter().collect::<Vec<_>>();
    paths.sort();
    paths
}

fn collection_references_managed_image(data: &Value, relative_path: &str) -> bool {
    let Some(candidate) = normalize_managed_relative_image_path(relative_path) else {
        return false;
    };
    collect_live_image_references(data)
        .into_iter()
        .filter_map(normalize_managed_relative_image_path)
        .any(|path| path == candidate)
}

fn delete_managed_image_unless_referenced(
    paths: &StoragePaths,
    relative_path: &str,
) -> Result<Value> {
    let normalized = require_managed_relative_image_path(relative_path)?;
    let collection = read_json(&paths.data)?;
    if collection_references_managed_image(&collection, &normalized) {
        return Ok(json!({
            "success": true,
            "action": "referenced",
            "relativePath": normalized
        }));
    }

    let target = paths.images.join(&normalized);
    let target_metadata = inspect_path_without_symlinks(&paths.images, Path::new(&normalized))?;
    let target_exists = target_metadata.is_some();
    if let Some(metadata) = target_metadata {
        if !metadata.file_type().is_file() {
            return Err(anyhow!("Managed image target is not a regular file."));
        }
    }
    let thumbnail = thumbnail_path_for_images_root(&paths.images, &normalized)?;
    let thumbnail_relative = thumbnail
        .strip_prefix(&paths.images)
        .context("Thumbnail path is outside the image directory.")?;
    if let Some(metadata) = inspect_path_without_symlinks(&paths.images, thumbnail_relative)? {
        if !metadata.file_type().is_file() {
            return Err(anyhow!("Managed thumbnail target is not a regular file."));
        }
    }
    remove_thumbnail_artifact(&thumbnail, &normalized)?;
    if !target_exists {
        return Ok(json!({
            "success": true,
            "action": "missing",
            "relativePath": normalized
        }));
    }
    fs::remove_file(&target)?;
    if let Some(parent) = target.parent() {
        sync_directory(parent)?;
    }
    Ok(json!({
        "success": true,
        "action": "deleted",
        "relativePath": normalized
    }))
}

fn dispose_managed_image_unless_referenced(
    paths: &StoragePaths,
    relative_path: &str,
) -> Result<Value> {
    let normalized = require_managed_relative_image_path(relative_path)?;
    let collection = read_json(&paths.data)?;
    if collection_references_managed_image(&collection, &normalized) {
        return Ok(json!({
            "success": true,
            "action": "referenced",
            "relativePath": normalized
        }));
    }

    let source = paths.images.join(&normalized);
    let source_metadata = inspect_path_without_symlinks(&paths.images, Path::new(&normalized))?;
    let source_exists = source_metadata.is_some();
    if let Some(metadata) = source_metadata {
        if !metadata.file_type().is_file() {
            return Err(anyhow!("Managed image target is not a regular file."));
        }
    }
    let thumbnail = thumbnail_path_for_images_root(&paths.images, &normalized)?;
    let thumbnail_relative = thumbnail
        .strip_prefix(&paths.images)
        .context("Thumbnail path is outside the image directory.")?;
    if let Some(metadata) = inspect_path_without_symlinks(&paths.images, thumbnail_relative)? {
        if !metadata.file_type().is_file() {
            return Err(anyhow!("Managed thumbnail target is not a regular file."));
        }
    }
    if !source_exists {
        remove_thumbnail_artifact(&thumbnail, &normalized)?;
        return Ok(json!({ "success": true, "action": "missing", "relativePath": normalized }));
    }

    let preferences = read_json(&paths.preferences)?;
    let (_, _, keep_replaced) = backup_settings(&preferences);
    let archive_destination = if keep_replaced {
        let destination = paths.replaced_images.join(&normalized);
        ensure_real_directory(&paths.root)?;
        ensure_real_directory(&paths.replaced_images)?;
        let destination_parent = Path::new(&normalized)
            .parent()
            .ok_or_else(|| anyhow!("Invalid replaced image destination."))?;
        ensure_real_relative_directory(&paths.replaced_images, destination_parent)?;
        let mut unique = destination.clone();
        let mut index = 2usize;
        while path_exists_without_following(&unique)? {
            let stem = destination
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("image");
            let extension = destination
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or("webp");
            unique = destination.with_file_name(format!("{stem}-{index}.{extension}"));
            index += 1;
        }
        Some(unique)
    } else {
        None
    };
    remove_thumbnail_artifact(&thumbnail, &normalized)?;
    if !keep_replaced {
        fs::remove_file(&source)
            .with_context(|| format!("Could not remove managed image {}", source.display()))?;
        if let Some(parent) = source.parent() {
            sync_directory(parent)?;
        }
        return Ok(json!({ "success": true, "action": "deleted", "relativePath": normalized }));
    }

    let unique = archive_destination
        .ok_or_else(|| anyhow!("Replaced image destination was not prepared."))?;
    fs::rename(&source, &unique)?;
    if let Some(parent) = source.parent() {
        sync_directory(parent)?;
    }
    if let Some(parent) = unique.parent() {
        sync_directory(parent)?;
    }
    let archived_relative_path = unique
        .strip_prefix(&paths.replaced_images)
        .unwrap_or(&unique)
        .to_string_lossy()
        .replace('\\', "/");
    Ok(json!({
        "success": true,
        "action": "archived",
        "relativePath": normalized,
        "archivedRelativePath": archived_relative_path
    }))
}

fn resolve_referenced_image_source(
    source_root: &Path,
    relative_path: &str,
    required: bool,
) -> Result<Option<PathBuf>> {
    let source = source_root.join(relative_path);
    let metadata = match inspect_path_without_symlinks(source_root, Path::new(relative_path))? {
        Some(metadata) => metadata,
        None if !required => return Ok(None),
        None => {
            return Err(anyhow!(
                "Referenced image is missing from managed media: {}",
                source.display()
            ));
        }
    };
    if !metadata.file_type().is_file() {
        return Err(anyhow!(
            "Referenced image is not a regular file: {}",
            source.display()
        ));
    }
    Ok(Some(source))
}

fn validate_saved_managed_image_references(images_root: &Path, data: &Value) -> Result<()> {
    validate_managed_image_references(data)?;
    let references = collect_referenced_images(data);
    if references.is_empty() {
        return Ok(());
    }

    let metadata = fs::symlink_metadata(images_root).with_context(|| {
        format!(
            "Could not inspect managed image directory {}",
            images_root.display()
        )
    })?;
    if !metadata.file_type().is_dir() {
        return Err(anyhow!(
            "Managed image root is not a directory: {}",
            images_root.display()
        ));
    }
    for relative_path in references {
        resolve_referenced_image_source(images_root, &relative_path, true)?;
    }
    Ok(())
}

fn validate_imported_referenced_images(images_root: &Path, data: &Value) -> Result<()> {
    let references = collect_referenced_images(data);
    if references.is_empty() {
        return Ok(());
    }
    if !path_exists_without_following(images_root)? {
        return Err(anyhow!(
            "Backup is missing its referenced images directory: {}",
            images_root.display()
        ));
    }
    for relative_path in references {
        resolve_referenced_image_source(images_root, &relative_path, true)?;
    }
    Ok(())
}

fn copy_referenced_images_with_options(
    source_root: &Path,
    destination_root: &Path,
    data: &Value,
    validate_raster: bool,
    require_all: bool,
) -> Result<()> {
    ensure_real_directory(destination_root)?;
    for section in MANAGED_IMAGE_SUBDIRS {
        ensure_real_subdirectory(destination_root, section)?;
    }
    for rel in collect_referenced_images(data) {
        let Some(canonical_source) =
            resolve_referenced_image_source(source_root, &rel, require_all)?
        else {
            continue;
        };
        if validate_raster {
            repair_legacy_png_webp_file(&canonical_source, "images")?;
            validate_backup_raster_file(&canonical_source, "images")?;
        }
        let destination = destination_root.join(&rel);
        let relative_parent = Path::new(&rel)
            .parent()
            .ok_or_else(|| anyhow!("Invalid referenced image destination."))?;
        ensure_real_relative_directory(destination_root, relative_parent)?;
        if path_exists_without_following(&destination)?
            && !fs::symlink_metadata(&destination)?.file_type().is_file()
        {
            return Err(anyhow!(
                "Referenced image destination is not a regular file: {}",
                destination.display()
            ));
        }
        fs::copy(canonical_source, destination)?;
    }
    Ok(())
}

fn copy_referenced_images(source_root: &Path, destination_root: &Path, data: &Value) -> Result<()> {
    validate_managed_image_references(data)?;
    copy_referenced_images_with_options(source_root, destination_root, data, true, true)
}

fn copy_showcase_thumbnails(
    source_root: &Path,
    destination_root: &Path,
    data: &Value,
) -> Result<()> {
    ensure_real_directory(destination_root)?;
    for section in MANAGED_IMAGE_SUBDIRS {
        ensure_real_subdirectory(destination_root, section)?;
    }
    for rel in collect_referenced_images(data) {
        let Some(canonical_source) = resolve_referenced_image_source(source_root, &rel, false)?
        else {
            continue;
        };
        let destination = destination_root.join(format!("{rel}.webp"));
        let relative_parent = Path::new(&rel)
            .parent()
            .ok_or_else(|| anyhow!("Invalid showcase thumbnail destination."))?;
        ensure_real_relative_directory(destination_root, relative_parent)?;
        if path_exists_without_following(&destination)?
            && !fs::symlink_metadata(&destination)?.file_type().is_file()
        {
            return Err(anyhow!(
                "Showcase thumbnail destination is not a regular file: {}",
                destination.display()
            ));
        }
        fs::copy(canonical_source, destination)?;
    }
    Ok(())
}

fn backup_settings(preferences: &Value) -> (String, usize, bool) {
    let backup = preferences.get("backup").and_then(Value::as_object);
    let frequency = backup
        .and_then(|value| value.get("auto_frequency"))
        .and_then(Value::as_str)
        .unwrap_or("daily")
        .to_string();
    let retention = backup
        .and_then(|value| value.get("retention_count"))
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(AUTO_BACKUP_DEFAULT_MAX_FILES)
        .clamp(1, AUTO_BACKUP_HARD_MAX_FILES);
    let keep_replaced = backup
        .and_then(|value| value.get("keep_replaced_images"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    (frequency, retention, keep_replaced)
}

fn is_complete_auto_backup(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let is_directory = fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_dir())
        .unwrap_or(false);
    name.starts_with("auto-")
        && is_directory
        && path.join("data.json").is_file()
        && path.join("preferences.json").is_file()
        && path.join("manifest.json").is_file()
        && path.join("images").is_dir()
}

fn latest_auto_backup(auto_root: &Path) -> Option<(PathBuf, SystemTime)> {
    let entries = fs::read_dir(auto_root).ok()?;
    let mut latest: Option<(PathBuf, SystemTime)> = None;
    for entry in entries.flatten() {
        if !is_complete_auto_backup(&entry.path()) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Ok(modified) = metadata.modified() else {
            continue;
        };
        if latest
            .as_ref()
            .map(|(_, time)| modified > *time)
            .unwrap_or(true)
        {
            latest = Some((entry.path(), modified));
        }
    }
    latest
}

fn frequency_duration(frequency: &str) -> Option<Duration> {
    match frequency {
        "daily" => Some(Duration::from_secs(24 * 60 * 60)),
        "weekly" => Some(Duration::from_secs(7 * 24 * 60 * 60)),
        "monthly" => Some(Duration::from_secs(30 * 24 * 60 * 60)),
        _ => None,
    }
}

fn prune_auto_backups(auto_root: &Path, retention: usize) -> Result<()> {
    let mut entries = fs::read_dir(auto_root)?
        .flatten()
        .filter_map(|entry| {
            if !is_complete_auto_backup(&entry.path()) {
                return None;
            }
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((entry.path(), modified))
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.1));
    for (path, _) in entries.into_iter().skip(retention) {
        if path.is_dir() {
            fs::remove_dir_all(path)?;
        } else {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

fn create_auto_backup(
    app: &AppHandle,
    data: &Value,
    preferences: &Value,
    reason: &str,
    force: bool,
) -> Result<Option<PathBuf>> {
    let (frequency, retention, keep_replaced) = backup_settings(preferences);
    let auto_root = auto_backups_path(app)?;
    fs::create_dir_all(&auto_root)?;

    if !force {
        let Some(duration) = frequency_duration(&frequency) else {
            return Ok(None);
        };
        if let Some((_, modified)) = latest_auto_backup(&auto_root) {
            if SystemTime::now()
                .duration_since(modified)
                .unwrap_or_default()
                < duration
            {
                return Ok(None);
            }
        }
    }

    let suffix = Uuid::new_v4().simple().to_string();
    let staging_path = auto_root.join(format!(".auto-stage-{suffix}"));
    let backup_path = auto_root.join(format!("auto-{}-{suffix}", timestamp()));
    fs::create_dir_all(&staging_path)?;
    let result = (|| -> Result<()> {
        write_json(&staging_path.join("data.json"), data)?;
        write_json(
            &staging_path.join("preferences.json"),
            &preferences_for_backup(preferences),
        )?;
        copy_referenced_images(&images_path(app)?, &staging_path.join("images"), data)?;
        let replaced_images = replaced_images_path(app)?;
        if keep_replaced && path_exists_without_following(&replaced_images)? {
            copy_dir_all(&replaced_images, &staging_path.join("replaced-images"))?;
        }
        write_json(
            &staging_path.join("manifest.json"),
            &json!({
                "type": "inkubator-auto-backup",
                "version": 3,
                "created_at": Utc::now().to_rfc3339(),
                "reason": reason,
                "includes_images": true,
                "includes_replaced_images": keep_replaced,
                "includes_preferences": true,
                "auto_frequency": frequency,
                "retention_count": retention,
                "keep_replaced_images": keep_replaced
            }),
        )?;
        sync_tree_files(&staging_path)?;
        fs::rename(&staging_path, &backup_path)?;
        sync_directory(&auto_root)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = remove_path(&staging_path);
        let _ = remove_path(&backup_path);
    }
    result?;
    prune_auto_backups(&auto_root, retention)?;
    sync_directory(&auto_root)?;
    Ok(Some(backup_path))
}

fn commit_save_data_state(
    paths: &StoragePaths,
    data: &Value,
) -> Result<(Value, Value, String, Vec<String>)> {
    let collection = collection_without_preferences(data);
    validate_saved_managed_image_references(&paths.images, &collection)?;

    let mut preferences = preferences_from(data);
    refresh_storage_revision(&mut preferences)?;
    let revision = state_revision(&collection, &preferences)?;
    let warnings = commit_collection_state(paths, &collection, &preferences)?;
    Ok((collection, preferences, revision, warnings))
}

#[tauri::command]
async fn load_data(app: AppHandle) -> std::result::Result<Value, String> {
    (|| {
        ensure_app_storage(&app)?;
        let paths = storage_paths(&app)?;
        let _lock = acquire_recovered_storage_lock(&paths.root)?;
        let (collection, preferences, revision) = read_storage_state(&paths)?;
        Ok(json!({
            "success": true,
            "data": combine_collection_with_preferences(collection, preferences),
            "revision": revision
        }))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn save_data(
    app: AppHandle,
    data: Value,
    expected_revision: Option<String>,
) -> std::result::Result<Value, String> {
    (|| {
        ensure_app_storage(&app)?;
        let paths = storage_paths(&app)?;
        let _lock = acquire_recovered_storage_lock(&paths.root)?;
        let (_, _, current_revision) = read_storage_state(&paths)?;
        if let Some(conflict) = revision_conflict(expected_revision.as_deref(), &current_revision) {
            return Ok(conflict);
        }

        let (collection, preferences, revision, mut warnings) =
            commit_save_data_state(&paths, &data)?;
        if let Err(error) = create_auto_backup(&app, &collection, &preferences, "save-data", false)
        {
            warnings.push(format!("the automated backup failed: {error}"));
        }
        Ok(success_with_warnings(
            json!({ "success": true, "revision": revision }),
            "Saved",
            warnings,
        ))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn select_image(
    app: AppHandle,
    state: State<'_, InkubatorState>,
) -> std::result::Result<Option<String>, String> {
    (|| {
        ensure_app_storage(&app)?;
        let file = rfd::FileDialog::new()
            .add_filter(
                "Images",
                &[
                    "jpg", "jpeg", "png", "webp", "avif", "heic", "heif", "JPG", "JPEG", "PNG",
                    "WEBP", "AVIF", "HEIC", "HEIF",
                ],
            )
            .add_filter("HEIC/HEIF", &["heic", "heif", "HEIC", "HEIF"])
            .pick_file();
        let Some(path) = file else {
            return Ok(None);
        };
        state
            .selected_external_image_paths
            .lock()
            .map_err(|_| anyhow!("Image selection state is unavailable"))?
            .insert(path.clone());
        Ok(Some(path.to_string_lossy().to_string()))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn save_image(
    app: AppHandle,
    state: State<'_, InkubatorState>,
    source_path: String,
    image_type: String,
    metadata: Value,
) -> std::result::Result<Option<String>, String> {
    (|| {
        let _lock = acquire_app_storage_lock(&app)?;
        let source = assert_allowed_local_image_path(&app, &state, &source_path)?;
        let bytes = fs::read(&source)?;
        let filename = save_processed_image(
            &app,
            &bytes,
            &source.to_string_lossy(),
            &image_type,
            &metadata,
        )?;
        Ok(Some(filename))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn read_selected_image_bytes(
    app: AppHandle,
    state: State<'_, InkubatorState>,
    source_path: String,
) -> std::result::Result<Value, String> {
    (|| {
        let _lock = acquire_app_storage_lock(&app)?;
        let source = assert_allowed_local_image_path(&app, &state, &source_path)?;
        let bytes = fs::read(&source)?;
        Ok(json!({
            "base64": base64::engine::general_purpose::STANDARD.encode(bytes),
            "sourcePath": source.to_string_lossy()
        }))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn save_image_bytes(
    app: AppHandle,
    bytes_base64: String,
    image_type: String,
    metadata: Value,
    source_hint: String,
) -> std::result::Result<Option<String>, String> {
    (|| {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(bytes_base64)
            .context("Invalid image payload")?;
        let _lock = acquire_app_storage_lock(&app)?;
        let filename = save_processed_image(&app, &bytes, &source_hint, &image_type, &metadata)?;
        Ok(Some(filename))
    })()
    .map_err(command_error)
}

fn is_forbidden_remote_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(address) => {
            let octets = address.octets();
            address.is_unspecified()
                || address.is_loopback()
                || address.is_private()
                || address.is_link_local()
                || address.is_multicast()
                || address.is_broadcast()
                || octets[0] == 0
                || (octets[0] == 100 && (64..=127).contains(&octets[1]))
                || (octets[0] == 192 && octets[1] == 0 && octets[2] == 0)
                || (octets[0] == 192 && octets[1] == 0 && octets[2] == 2)
                || (octets[0] == 198 && (octets[1] == 18 || octets[1] == 19))
                || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
                || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
                || octets[0] >= 240
        }
        IpAddr::V6(address) => {
            if let Some(mapped) = address.to_ipv4_mapped() {
                return is_forbidden_remote_ip(IpAddr::V4(mapped));
            }
            let segments = address.segments();
            address.is_unspecified()
                || address.is_loopback()
                || address.is_unique_local()
                || address.is_unicast_link_local()
                || address.is_multicast()
                || (segments[0] == 0x2001 && segments[1] == 0x0db8)
        }
    }
}

fn validate_remote_image_url(url: &Url) -> Result<()> {
    if url.scheme() != "https" {
        return Err(anyhow!("Only https URLs are allowed for remote images."));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(anyhow!(
            "Remote image URLs cannot contain usernames or passwords."
        ));
    }
    if url.host_str().is_none() {
        return Err(anyhow!("Remote image URL has no host."));
    }
    Ok(())
}

fn normalized_raster_mime(raw_mime: &str) -> Option<String> {
    let mime = raw_mime
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if matches!(
        mime.as_str(),
        "image/jpeg"
            | "image/jpg"
            | "image/png"
            | "image/webp"
            | "image/avif"
            | "image/heic"
            | "image/heif"
    ) {
        Some(mime)
    } else {
        None
    }
}

async fn resolve_public_remote_addresses(url: &Url) -> Result<(String, Vec<SocketAddr>)> {
    validate_remote_image_url(url)?;
    let host = url
        .host_str()
        .ok_or_else(|| anyhow!("Remote image URL has no host."))?
        .to_string();
    let port = url
        .port_or_known_default()
        .ok_or_else(|| anyhow!("Remote image URL has no usable port."))?;
    let mut addresses = lookup_host((host.as_str(), port))
        .await
        .with_context(|| format!("Could not resolve remote image host {host}"))?
        .collect::<Vec<_>>();
    addresses.sort_unstable();
    addresses.dedup();
    if addresses.is_empty() {
        return Err(anyhow!("Remote image host did not resolve to an address."));
    }
    if addresses
        .iter()
        .any(|address| is_forbidden_remote_ip(address.ip()))
    {
        return Err(anyhow!(
            "Remote image host resolves to a private or local network address."
        ));
    }
    Ok((host, addresses))
}

fn append_chunk_with_limit(bytes: &mut Vec<u8>, chunk: &[u8], max_bytes: usize) -> Result<()> {
    let next_size = bytes
        .len()
        .checked_add(chunk.len())
        .ok_or_else(|| anyhow!("Remote image size overflowed."))?;
    if next_size > max_bytes {
        return Err(anyhow!("Remote image is too large."));
    }
    bytes.extend_from_slice(chunk);
    Ok(())
}

fn append_remote_image_chunk(bytes: &mut Vec<u8>, chunk: &[u8]) -> Result<()> {
    append_chunk_with_limit(bytes, chunk, MAX_REMOTE_IMAGE_BYTES)
}

async fn download_remote_image_inner(raw_url: &str) -> Result<DownloadedRemoteImage> {
    let mut current = Url::parse(raw_url).context("Invalid URL")?;

    for redirect_count in 0..=MAX_REMOTE_REDIRECTS {
        let (host, addresses) = resolve_public_remote_addresses(&current).await?;
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(10))
            .resolve_to_addrs(&host, &addresses)
            .build()
            .context("Could not initialize remote image client")?;
        let mut response = client
            .get(current.clone())
            .header(
                ACCEPT,
                "image/avif,image/webp,image/png,image/jpeg,image/heic,image/heif",
            )
            .send()
            .await
            .context("Could not download remote image")?;

        if let Some(remote_addr) = response.remote_addr() {
            if is_forbidden_remote_ip(remote_addr.ip()) {
                return Err(anyhow!(
                    "Remote image connection reached a private or local network address."
                ));
            }
        }

        if response.status().is_redirection() {
            if redirect_count == MAX_REMOTE_REDIRECTS {
                return Err(anyhow!("Remote image redirected too many times."));
            }
            let location = response
                .headers()
                .get(LOCATION)
                .ok_or_else(|| anyhow!("Remote image redirect has no destination."))?
                .to_str()
                .context("Remote image redirect destination is invalid")?;
            current = current
                .join(location)
                .context("Remote image redirect destination is invalid")?;
            validate_remote_image_url(&current)?;
            continue;
        }

        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch image: {}", response.status()));
        }
        let mime_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .and_then(normalized_raster_mime)
            .ok_or_else(|| anyhow!("Remote response is not a supported raster image."))?;
        if response
            .content_length()
            .map(|length| length > MAX_REMOTE_IMAGE_BYTES as u64)
            .unwrap_or(false)
        {
            return Err(anyhow!("Remote image is too large."));
        }

        let capacity = response
            .content_length()
            .and_then(|length| usize::try_from(length).ok())
            .unwrap_or(0)
            .min(MAX_REMOTE_IMAGE_BYTES);
        let mut bytes = Vec::with_capacity(capacity);
        while let Some(chunk) = response.chunk().await? {
            append_remote_image_chunk(&mut bytes, &chunk)?;
        }
        if bytes.is_empty() {
            return Err(anyhow!("Remote image is empty."));
        }
        return Ok(DownloadedRemoteImage {
            bytes,
            final_url: current,
            mime_type,
        });
    }

    Err(anyhow!("Remote image redirected too many times."))
}

async fn download_remote_image(raw_url: &str) -> Result<DownloadedRemoteImage> {
    timeout(REMOTE_IMAGE_TIMEOUT, download_remote_image_inner(raw_url))
        .await
        .map_err(|_| anyhow!("Remote image download timed out."))?
}

#[tauri::command]
async fn read_remote_image_bytes(url: String) -> std::result::Result<Value, String> {
    async {
        let downloaded = download_remote_image(&url).await?;
        Ok(json!({
            "base64": base64::engine::general_purpose::STANDARD.encode(downloaded.bytes),
            "sourceUrl": downloaded.final_url.as_str(),
            "sourceHint": downloaded.final_url.path(),
            "mimeType": downloaded.mime_type
        }))
    }
    .await
    .map_err(command_error)
}

#[tauri::command]
async fn save_image_url(
    app: AppHandle,
    url: String,
    image_type: String,
    metadata: Value,
) -> std::result::Result<Value, String> {
    async {
        let downloaded = download_remote_image(&url).await?;
        let _lock = acquire_app_storage_lock(&app)?;
        let filename = save_processed_image(
            &app,
            &downloaded.bytes,
            downloaded.final_url.path(),
            &image_type,
            &metadata,
        )?;
        Ok(json!({ "success": true, "filename": filename }))
    }
    .await
    .map_err(command_error)
}

#[tauri::command]
async fn delete_image(app: AppHandle, relative_path: String) -> std::result::Result<Value, String> {
    (|| {
        if relative_path.is_empty() || relative_path == "default_pen.png" {
            return Ok(json!({ "success": true, "action": "noop" }));
        }
        let _lock = acquire_app_storage_lock(&app)?;
        let paths = storage_paths(&app)?;
        delete_managed_image_unless_referenced(&paths, &relative_path)
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn dispose_replaced_image(
    app: AppHandle,
    relative_path: String,
) -> std::result::Result<Value, String> {
    (|| {
        if relative_path.is_empty() || relative_path == "default_pen.png" {
            return Ok(json!({ "success": true, "action": "noop" }));
        }
        let _lock = acquire_app_storage_lock(&app)?;
        let paths = storage_paths(&app)?;
        dispose_managed_image_unless_referenced(&paths, &relative_path)
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn get_image_preview_url(
    app: AppHandle,
    state: State<'_, InkubatorState>,
    source_path: String,
) -> std::result::Result<String, String> {
    (|| {
        let _lock = acquire_app_storage_lock(&app)?;
        let source = assert_allowed_local_image_path(&app, &state, &source_path)?;
        if extension_lower(&source) != "heic" && extension_lower(&source) != "heif" {
            let bytes = fs::read(&source)?;
            return Ok(format!(
                "data:{};base64,{}",
                image_mime_type(&source),
                base64::engine::general_purpose::STANDARD.encode(bytes)
            ));
        }
        let bytes = fs::read(&source)?;
        let preview = process_image_to_webp(&bytes, &source.to_string_lossy())?;
        Ok(format!(
            "data:image/webp;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(preview)
        ))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn get_images_base_url(app: AppHandle) -> std::result::Result<Option<String>, String> {
    ensure_app_storage(&app).map_err(command_error)?;
    Ok(Some(managed_media_base_url().to_string()))
}

#[tauri::command]
async fn backup_status(app: AppHandle) -> std::result::Result<Value, String> {
    (|| {
        ensure_app_storage(&app)?;
        let auto = auto_backups_path(&app)?;
        let entries = fs::read_dir(&auto)?
            .flatten()
            .filter_map(|entry| {
                if !is_complete_auto_backup(&entry.path()) {
                    return None;
                }
                let modified = entry.metadata().ok()?.modified().ok()?;
                Some((entry.path(), modified))
            })
            .collect::<Vec<_>>();
        let latest = entries.iter().max_by(|a, b| a.1.cmp(&b.1));
        let latest_json = latest.map(|(path, modified)| {
            let dt: DateTime<Utc> = (*modified).into();
            json!({
                "name": path.file_name().and_then(|v| v.to_str()).unwrap_or("auto-backup"),
                "path": path,
                "updated_at": dt.to_rfc3339(),
                "include_images": true,
                "reason": ""
            })
        });
        Ok(json!({ "success": true, "count": entries.len(), "latest": latest_json }))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn export_backup(
    app: AppHandle,
    on_started: Channel<()>,
) -> std::result::Result<Value, String> {
    (|| {
        ensure_app_storage(&app)?;
        let default_name = format!("inkubator-backup-{}.zip", timestamp());
        let Some(target) = rfd::FileDialog::new()
            .set_title("Save backup ZIP")
            .set_file_name(&default_name)
            .add_filter("ZIP archive", &["zip"])
            .save_file()
        else {
            return Ok(json!({ "success": false, "canceled": true }));
        };
        let target = if target.extension().and_then(|value| value.to_str()) == Some("zip") {
            target
        } else {
            target.with_extension("zip")
        };
        let _ = on_started.send(());
        let stage = manual_backups_path(&app)?.join(format!(
            ".manual-export-{}-{}",
            timestamp(),
            Uuid::new_v4().simple()
        ));
        if stage.exists() {
            fs::remove_dir_all(&stage)?;
        }
        let result = (|| -> Result<()> {
            {
                let paths = storage_paths(&app)?;
                let _lock = acquire_recovered_storage_lock(&paths.root)?;
                let (collection, preferences, _) = read_storage_state(&paths)?;
                let (_, _, keep_replaced) = backup_settings(&preferences);
                create_backup_folder(
                    &app,
                    &stage,
                    &collection,
                    &preferences,
                    "inkubator-backup",
                    None,
                    keep_replaced,
                )?;
            }
            zip_folder(&stage, &target)?;
            Ok(())
        })();
        if stage.exists() {
            fs::remove_dir_all(&stage).ok();
        }
        result?;
        Ok(json!({ "success": true, "path": target }))
    })()
    .map_err(command_error)
}

fn import_backup_folder(
    paths: &StoragePaths,
    folder: &Path,
    options: Option<&ImportOptions>,
    expected_revision: Option<&str>,
) -> Result<Value> {
    let incoming_data = folder.join("data.json");
    let incoming_preferences = folder.join("preferences.json");
    if !path_exists_without_following(&incoming_data)?
        || !path_exists_without_following(&incoming_preferences)?
    {
        return Ok(json!({ "success": false, "message": "Selected backup is not valid." }));
    }

    let incoming_collection = read_json(&incoming_data)?;
    let mut preferences = read_json(&incoming_preferences)?;
    if !preferences.is_object() {
        return Ok(json!({
            "success": false,
            "message": "Import validation failed: preferences must be a JSON object."
        }));
    }
    validate_managed_image_references(&incoming_collection)?;
    if options
        .and_then(|value| value.auto_validate_import)
        .unwrap_or(true)
        && !(incoming_collection
            .get("pens")
            .and_then(Value::as_array)
            .is_some()
            && incoming_collection
                .get("inks")
                .and_then(Value::as_array)
                .is_some()
            && incoming_collection
                .get("currently_inked")
                .and_then(Value::as_array)
                .is_some())
    {
        return Ok(
            json!({ "success": false, "message": "Import validation failed: invalid data shape." }),
        );
    }

    let (_, _, current_revision) = read_storage_state(paths)?;
    if let Some(conflict) = revision_conflict(expected_revision, &current_revision) {
        return Ok(conflict);
    }

    let backup_images = folder.join("images");
    let backup_replaced_images = folder.join("replaced-images");
    repair_and_validate_backup_media_tree(&backup_images, "images")?;
    repair_and_validate_backup_media_tree(&backup_replaced_images, "replaced-images")?;
    let mut data = merge_collection_data(&Value::Null, &incoming_collection, "overwrite");
    clear_missing_legacy_ink_swatch_aliases(&mut data, &backup_images)?;
    validate_managed_image_references(&data)?;
    refresh_storage_revision(&mut preferences)?;
    let revision = state_revision(&data, &preferences)?;
    validate_imported_referenced_images(&backup_images, &data)?;
    let has_backup_images = path_exists_without_following(&backup_images)?;
    let has_backup_replaced_images = path_exists_without_following(&backup_replaced_images)?;
    let stage = paths
        .root
        .join(format!(".backup-import-stage-{}", Uuid::new_v4().simple()));
    let rollback = paths.root.join(format!(
        ".backup-import-rollback-{}",
        Uuid::new_v4().simple()
    ));
    fs::create_dir_all(&stage)?;

    let result = (|| -> Result<Value> {
        let staged_data = stage.join("data.json");
        let staged_preferences = stage.join("preferences.json");
        let staged_images = stage.join("images");
        let staged_replaced_images = stage.join("replaced-images");
        write_json(&staged_data, &data)?;
        write_json(&staged_preferences, &preferences)?;
        if has_backup_images {
            copy_dir_all(&backup_images, &staged_images)?;
        } else {
            fs::create_dir_all(&staged_images)?;
        }
        ensure_managed_image_dirs(&staged_images)?;

        let staged_replaced = if has_backup_replaced_images {
            copy_dir_all(&backup_replaced_images, &staged_replaced_images)?;
            Some(staged_replaced_images)
        } else {
            None
        };
        sync_tree_files(&stage)?;
        let items = [
            StagedCommitItem {
                label: "data.json",
                staged: Some(staged_data),
                target: paths.data.clone(),
            },
            StagedCommitItem {
                label: "preferences.json",
                staged: Some(staged_preferences),
                target: paths.preferences.clone(),
            },
            StagedCommitItem {
                label: "images",
                staged: Some(staged_images),
                target: paths.images.clone(),
            },
            StagedCommitItem {
                label: "replaced-images",
                staged: staged_replaced,
                target: paths.replaced_images.clone(),
            },
        ];
        let mut warnings = commit_staged_items(&items, &rollback)?;
        if let Err(error) = remove_path(&stage) {
            warnings.push(format!(
                "temporary import data could not be removed: {error}"
            ));
        }
        Ok(success_with_warnings(
            json!({
                "success": true,
                "data": combine_collection_with_preferences(data, preferences),
                "revision": revision
            }),
            "Backup imported",
            warnings,
        ))
    })();

    if result.is_err() {
        let _ = remove_path(&stage);
    }
    result
}

#[tauri::command]
async fn select_backup(
    state: State<'_, InkubatorState>,
) -> std::result::Result<Option<String>, String> {
    (|| {
        let Some(path) = rfd::FileDialog::new()
            .set_title("Choose backup ZIP to import")
            .add_filter("ZIP archive", &["zip"])
            .pick_file()
        else {
            return Ok(None);
        };
        let mut selected = state
            .selected_backup_paths
            .lock()
            .map_err(|_| anyhow!("Backup selection state is unavailable"))?;
        selected.clear();
        selected.insert(path.clone());
        Ok(Some(path.to_string_lossy().to_string()))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn import_backup(
    app: AppHandle,
    state: State<'_, InkubatorState>,
    zip_path: String,
    options: Option<ImportOptions>,
    expected_revision: Option<String>,
) -> std::result::Result<Value, String> {
    (|| {
        ensure_app_storage(&app)?;
        let zip_path = take_selected_backup_path(&state.selected_backup_paths, &zip_path)?;
        let stage = manual_backups_path(&app)?.join(format!(
            ".manual-import-{}-{}",
            timestamp(),
            Uuid::new_v4().simple()
        ));
        if stage.exists() {
            fs::remove_dir_all(&stage)?;
        }
        let result = (|| -> Result<Value> {
            extract_zip_to_folder(&zip_path, &stage)?;
            let backup_root = resolve_backup_root(&stage);
            let paths = storage_paths(&app)?;
            let _lock = acquire_recovered_storage_lock(&paths.root)?;
            import_backup_folder(
                &paths,
                &backup_root,
                options.as_ref(),
                expected_revision.as_deref(),
            )
        })();
        if stage.exists() {
            fs::remove_dir_all(&stage).ok();
        }
        let result = result?;
        if result
            .get("success")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            if let Some(data) = result.get("data").cloned() {
                regenerate_thumbnails_in_background(app.clone(), data);
            }
        }
        Ok(result)
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn export_showcase(app: AppHandle) -> std::result::Result<Value, String> {
    let mut cleanup_stage: Option<PathBuf> = None;
    let result: Result<Value> = (|| {
        ensure_app_storage(&app)?;
        let Some(target) = rfd::FileDialog::new()
            .set_title("Choose destination for showcase folder")
            .pick_folder()
        else {
            return Ok(json!({ "success": false, "canceled": true }));
        };

        let frontend = frontend_source_root(&app)?;
        let stage = target.join(format!(
            ".showcase-export-{}-{}",
            timestamp(),
            Uuid::new_v4().simple()
        ));
        let showcase = target.join("showcase");
        if stage.exists() {
            fs::remove_dir_all(&stage)?;
        }
        fs::create_dir_all(&stage)?;
        cleanup_stage = Some(stage.clone());

        for name in [
            "index.html",
            "style.css",
            "theme-boot.js",
            "heic-converter.js",
            "renderer.js",
        ] {
            copy_required_file(&frontend, &stage, name)?;
        }
        for name in ["assets", "renderer"] {
            let source = frontend.join(name);
            if source.exists() {
                copy_dir_all(&source, &stage.join(name))?;
            }
        }
        prune_showcase_only_assets(&stage)?;
        for name in ["tauri-api.js", "docker-api.js", "docker-shell.js"] {
            let target = stage.join(name);
            if target.exists() {
                fs::remove_file(target)?;
            }
        }

        let paths = storage_paths(&app)?;
        let storage_lock = acquire_recovered_storage_lock(&paths.root)?;
        let (data, preferences, _) = read_storage_state(&paths)?;
        let showcase_data = build_public_showcase_data(&data, &preferences);
        write_json(&stage.join("data.json"), &showcase_data)?;
        fs::write(
            stage.join("data.js"),
            format!(
                "window.__INKUBATOR_DATA__ = {};\n",
                serde_json::to_string(&showcase_data)?
            ),
        )?;

        let index_path = stage.join("index.html");
        let mut prepared_html = None;
        if index_path.exists() {
            let html = fs::read_to_string(&index_path)?;
            let html = prepare_showcase_index_html(&stage, &html, &showcase_data)?;
            fs::write(&index_path, &html)?;
            prepared_html = Some(html);
        }

        copy_referenced_images_with_options(
            &paths.images,
            &stage.join("images"),
            &showcase_data,
            true,
            false,
        )?;
        let thumbnail_warning = match ensure_referenced_thumbnails(&app, &showcase_data) {
            Ok(()) => None,
            Err(error) => {
                eprintln!("Showcase export will use original images for some thumbnails: {error}");
                Some(format!(
                    "Showcase exported, but {error} Full-size images were used as fallbacks for those thumbnails."
                ))
            }
        };
        copy_showcase_thumbnails(
            &paths.images.join(".thumbs"),
            &stage.join("thumbs"),
            &showcase_data,
        )?;
        drop(storage_lock);

        if let Some(html) = prepared_html {
            for route in [
                "dashboard",
                "pens",
                "inks",
                "swatches",
                "stats",
                "activity",
                "settings",
            ] {
                let route_dir = stage.join(route);
                fs::create_dir_all(&route_dir)?;
                let route_html = html.replace("<head>", "<head>\n    <base href=\"../\">");
                fs::write(route_dir.join("index.html"), route_html)?;
            }
        }

        if showcase.exists() {
            fs::remove_dir_all(&showcase)?;
        }
        fs::rename(&stage, &showcase)?;
        cleanup_stage = None;

        let mut response = json!({ "success": true, "path": showcase });
        if let Some(message) = thumbnail_warning {
            response["warning"] = json!(true);
            response["message"] = json!(message);
        }
        Ok(response)
    })();

    if result.is_err() {
        if let Some(stage) = cleanup_stage {
            if stage.exists() {
                let _ = fs::remove_dir_all(stage);
            }
        }
    }

    result.map_err(command_error)
}

#[tauri::command]
async fn confirm_dialog(options: Option<ConfirmOptions>) -> std::result::Result<Value, String> {
    let options = options.unwrap_or(ConfirmOptions {
        title: None,
        message: None,
        detail: None,
        buttons: None,
    });
    let message = match options.detail {
        Some(detail) if !detail.is_empty() => format!(
            "{}\n\n{}",
            options
                .message
                .unwrap_or_else(|| "Are you sure?".to_string()),
            detail
        ),
        _ => options
            .message
            .unwrap_or_else(|| "Are you sure?".to_string()),
    };
    let confirmed = rfd::MessageDialog::new()
        .set_title(options.title.unwrap_or_else(|| "Confirm".to_string()))
        .set_description(message)
        .set_buttons(rfd::MessageButtons::OkCancel)
        .show();
    Ok(
        json!({ "success": true, "confirmed": matches!(confirmed, rfd::MessageDialogResult::Ok | rfd::MessageDialogResult::Yes) }),
    )
}

#[tauri::command]
async fn focus_window(window: Window) -> std::result::Result<Value, String> {
    window.unminimize().ok();
    window.show().ok();
    window.set_focus().ok();
    Ok(json!({ "success": true }))
}

#[tauri::command]
async fn open_external_url(url: String) -> std::result::Result<Value, String> {
    (|| {
        let parsed = Url::parse(&url)?;
        if parsed.scheme() != "http" && parsed.scheme() != "https" {
            return Ok(json!({ "success": false, "message": "Only http/https URLs are allowed." }));
        }
        open::that(parsed.as_str())?;
        Ok(json!({ "success": true }))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn get_release_status(app: AppHandle) -> std::result::Result<Value, String> {
    async {
        let version = app.package_info().version.to_string();
        let current_tag = format!("v{version}");
        let client = reqwest::Client::new();
        let url = format!("https://api.github.com/repos/{GITHUB_REPO}/releases/latest");
        let response = timeout(
            Duration::from_secs(15),
            client
                .get(url)
                .header(ACCEPT, "application/vnd.github+json")
                .header(USER_AGENT, format!("inkubator/{version}"))
                .send(),
        )
        .await
        .context("Request timed out")??;
        if !response.status().is_success() {
            return Ok(json!({
                "success": false,
                "currentVersion": version,
                "currentTag": current_tag,
                "releasesUrl": GITHUB_RELEASES_URL,
                "message": format!("GitHub API responded with {}.", response.status())
            }));
        }
        let release: Value = response.json().await?;
        let latest_tag = release
            .get("tag_name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let release_url = release
            .get("html_url")
            .and_then(Value::as_str)
            .unwrap_or(GITHUB_RELEASES_URL)
            .to_string();
        let published_at = release
            .get("published_at")
            .or_else(|| release.get("created_at"))
            .cloned()
            .unwrap_or(Value::Null);
        let latest_version = latest_tag.trim_start_matches('v').to_string();
        let version_state = release_version_state(&version, &latest_version);
        let has_update = version_state == "update_available";
        Ok(json!({
            "success": true,
            "currentVersion": version,
            "currentTag": current_tag,
            "latestVersion": latest_version,
            "latestTag": latest_tag,
            "versionState": version_state,
            "hasUpdate": has_update,
            "releaseUrl": release_url,
            "releasesUrl": GITHUB_RELEASES_URL,
            "publishedAt": published_at
        }))
    }
    .await
    .map_err(command_error)
}

#[tauri::command]
async fn get_app_info(app: AppHandle) -> std::result::Result<Value, String> {
    let version = app.package_info().version.to_string();
    let data_dir = app_storage_dir(&app)
        .ok()
        .map(|path| path.to_string_lossy().to_string());
    let data_dir_override =
        desktop_data_dir_override().map(|path| path.to_string_lossy().to_string());
    Ok(json!({
        "success": true,
        "currentVersion": version,
        "currentTag": format!("v{version}"),
        "distribution": "desktop",
        "dataDir": data_dir,
        "dataDirOverride": data_dir_override,
        "releasesUrl": GITHUB_RELEASES_URL
    }))
}

#[tauri::command]
async fn fetch_inkswatch(query: String) -> std::result::Result<Value, String> {
    async {
        let client = reqwest::Client::new();
        let search_url = format!("https://inkswatch.com/getSearchResults.php?query={}", urlencoding::encode(&query));
        let html = timeout(Duration::from_secs(15), client.get(search_url).send())
            .await
            .context("Request timed out")??
            .text()
            .await?;
        let marker = "ink.html?inkId=";
        let Some(start) = html.find(marker) else {
            return Ok(json!({ "success": false, "message": "No results found." }));
        };
        let id_start = start + marker.len();
        let id = html[id_start..]
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect::<String>();
        if id.is_empty() {
            return Ok(json!({ "success": false, "message": "No results found." }));
        }
        let name = html[id_start..]
            .find('>')
            .and_then(|offset| {
                let text_start = id_start + offset + 1;
                html[text_start..].find("</a>").map(|end| html[text_start..text_start + end].to_string())
            })
            .unwrap_or_else(|| query.clone());
        let detail_url = format!("https://inkswatch.com/getInkChoiceSwatches.php?inkId={id}");
        let detail = timeout(Duration::from_secs(15), client.get(detail_url).send())
            .await
            .context("Request timed out")??
            .text()
            .await?;
        let img_marker = format!("id=\"ink{id}Swatch\" src=\"");
        let Some(img_start) = detail.find(&img_marker) else {
            return Ok(json!({ "success": false, "message": "Swatch image not found in detail page." }));
        };
        let src_start = img_start + img_marker.len();
        let src_end = detail[src_start..].find('"').unwrap_or(0);
        let relative = &detail[src_start..src_start + src_end];
        Ok(json!({ "success": true, "imageUrl": format!("https://inkswatch.com/{relative}"), "inkName": name }))
    }
    .await
    .map_err(command_error)
}

#[tauri::command]
async fn detect_pen_colors(_source_path: String) -> std::result::Result<Value, String> {
    Ok(json!({
        "success": false,
        "message": "Local ML color detection was intentionally removed from the Tauri port."
    }))
}

pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("inkubator", |context, request| {
            managed_media_response(context.app_handle(), &request)
        })
        .manage(InkubatorState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            ensure_app_storage(&handle).map_err(|error| {
                eprintln!("Failed to initialize app storage: {error}");
                error
            })?;
            let paths = storage_paths(&handle)?;
            let _lock = acquire_recovered_storage_lock(&paths.root)?;
            let (data, _, _) = read_storage_state(&paths)?;
            regenerate_thumbnails_in_background(handle, data);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            select_image,
            save_image,
            read_selected_image_bytes,
            save_image_bytes,
            read_remote_image_bytes,
            save_image_url,
            delete_image,
            dispose_replaced_image,
            get_image_preview_url,
            get_images_base_url,
            backup_status,
            export_backup,
            select_backup,
            import_backup,
            export_showcase,
            confirm_dialog,
            focus_window,
            open_external_url,
            get_app_info,
            get_release_status,
            fetch_inkswatch,
            detect_pen_colors
        ])
        .run(tauri::generate_context!())
        .expect("error while running Inkubator");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(label: &str) -> PathBuf {
        let root = env::temp_dir().join(format!("inkubator-{label}-{}", Uuid::new_v4().simple()));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn write_test_storage(paths: &StoragePaths, collection: &Value, preferences: &Value) {
        fs::create_dir_all(paths.images.join("pens")).unwrap();
        fs::create_dir_all(paths.images.join("inks")).unwrap();
        fs::create_dir_all(paths.images.join("swatches")).unwrap();
        write_json(&paths.data, collection).unwrap();
        write_json(&paths.preferences, preferences).unwrap();
    }

    fn create_test_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let file = File::create(path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for (name, contents) in entries {
            zip.start_file(*name, options).unwrap();
            zip.write_all(contents).unwrap();
        }
        zip.finish().unwrap();
    }

    fn test_raster_bytes(format: ImageFormat, color: [u8; 3]) -> Vec<u8> {
        let image = image::RgbImage::from_pixel(2, 2, image::Rgb(color));
        let mut output = Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(image)
            .write_to(&mut output, format)
            .unwrap();
        output.into_inner()
    }

    fn write_complete_auto_backup(path: &Path, marker: &str) {
        fs::create_dir_all(path.join("images")).unwrap();
        write_json(&path.join("data.json"), &json!({ "marker": marker })).unwrap();
        write_json(&path.join("preferences.json"), &json!({})).unwrap();
        write_json(
            &path.join("manifest.json"),
            &json!({ "type": "inkubator-auto-backup", "version": 3 }),
        )
        .unwrap();
    }

    #[test]
    fn remote_image_validation_rejects_unsafe_urls_addresses_and_mime_types() {
        assert!(validate_remote_image_url(
            &Url::parse("https://images.example.test/photo.webp").unwrap()
        )
        .is_ok());
        assert!(validate_remote_image_url(
            &Url::parse("http://images.example.test/photo.webp").unwrap()
        )
        .is_err());
        assert!(validate_remote_image_url(
            &Url::parse("https://user:secret@images.example.test/photo.webp").unwrap()
        )
        .is_err());

        for address in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.1.1",
            "100.64.0.1",
            "::1",
            "fc00::1",
            "fe80::1",
            "::ffff:192.168.1.10",
        ] {
            assert!(
                is_forbidden_remote_ip(address.parse::<IpAddr>().unwrap()),
                "{address} should be rejected"
            );
        }
        assert!(!is_forbidden_remote_ip(
            "8.8.8.8".parse::<IpAddr>().unwrap()
        ));
        assert!(!is_forbidden_remote_ip(
            "2606:4700:4700::1111".parse::<IpAddr>().unwrap()
        ));

        assert_eq!(
            normalized_raster_mime("image/webp; charset=binary").as_deref(),
            Some("image/webp")
        );
        assert!(normalized_raster_mime("image/svg+xml").is_none());
        assert!(normalized_raster_mime("text/html").is_none());

        let mut bytes = vec![1, 2];
        append_chunk_with_limit(&mut bytes, &[3, 4], 4).unwrap();
        assert_eq!(bytes, vec![1, 2, 3, 4]);
        assert!(append_chunk_with_limit(&mut bytes, &[5], 4).is_err());
    }

    #[test]
    fn atomic_json_write_replaces_file_without_temp_artifacts() {
        let root = test_root("atomic-json");
        let path = root.join("data.json");
        fs::write(&path, br#"{"value":"old"}"#).unwrap();

        write_json(&path, &json!({ "value": "new" })).unwrap();

        assert_eq!(read_json(&path).unwrap(), json!({ "value": "new" }));
        let entries = fs::read_dir(&root)
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name())
            .collect::<Vec<_>>();
        assert_eq!(entries, vec![std::ffi::OsString::from("data.json")]);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn existing_file_promotion_uses_the_injected_atomic_replacer() {
        let root = test_root("injected-atomic-replacement");
        let destination = root.join("backup.zip");
        let staged = root.join(".backup.zip.completed");
        fs::write(&destination, b"old-backup").unwrap();
        fs::write(&staged, b"new-backup").unwrap();
        sync_file(&staged).unwrap();
        let mut replacement_called = false;

        promote_synced_file_with_replacer(&staged, &destination, |source, target| {
            replacement_called = true;
            assert_eq!(fs::read(target).unwrap(), b"old-backup");
            assert_eq!(fs::read(source).unwrap(), b"new-backup");
            let replacement = fs::read(source)?;
            let mut target_file = OpenOptions::new().write(true).truncate(true).open(target)?;
            target_file.write_all(&replacement)?;
            target_file.sync_all()?;
            drop(target_file);
            fs::remove_file(source)?;
            Ok(())
        })
        .unwrap();

        assert!(replacement_called);
        assert_eq!(fs::read(&destination).unwrap(), b"new-backup");
        assert!(!staged.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn post_install_directory_sync_failure_has_a_distinct_error() {
        let root = test_root("post-install-sync-error");
        let destination = root.join("data.json");
        let staged = root.join(".data.json.completed");
        fs::write(&destination, b"old-data").unwrap();
        fs::write(&staged, b"new-data").unwrap();

        let error = promote_synced_file_with(
            &staged,
            &destination,
            |source, target| {
                let replacement = fs::read(source)?;
                fs::write(target, replacement)?;
                fs::remove_file(source)?;
                Ok(())
            },
            |_| Err(anyhow!("injected directory fsync failure")),
        )
        .err()
        .unwrap();

        assert!(file_was_installed_before_error(&error));
        assert_eq!(fs::read(&destination).unwrap(), b"new-data");
        assert!(!staged.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn completed_file_promotion_preserves_non_file_destinations() {
        let root = test_root("atomic-replacement-directory-guard");
        let destination = root.join("backup.zip");
        let staged = root.join(".backup.zip.completed");
        fs::create_dir(&destination).unwrap();
        fs::write(&staged, b"new-backup").unwrap();

        let error =
            promote_synced_file_with_replacer(&staged, &destination, replace_existing_file_atomic)
                .err()
                .unwrap();

        assert!(error.to_string().contains("not a regular file"));
        assert!(destination.is_dir());
        assert_eq!(fs::read(&staged).unwrap(), b"new-backup");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn storage_state_rejects_malformed_live_json() {
        let root = test_root("malformed-live-json");
        let paths = StoragePaths::new(root.clone());
        fs::write(&paths.data, b"{not-json").unwrap();
        write_json(&paths.preferences, &default_preferences()).unwrap();

        assert!(read_storage_state(&paths).is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn revisions_change_with_state_and_missing_expectations_conflict() {
        let collection = default_collection_data();
        let preferences = default_preferences();
        let revision = state_revision(&collection, &preferences).unwrap();
        let changed_revision =
            state_revision(&json!({ "pens": [{ "id": "pen-1" }] }), &preferences).unwrap();

        assert_ne!(revision, changed_revision);
        assert!(revision_conflict(Some(&revision), &revision).is_none());
        let missing = revision_conflict(None, &revision).unwrap();
        assert_eq!(
            missing.get("code").and_then(Value::as_str),
            Some("DATA_CONFLICT")
        );
        assert_eq!(
            missing.get("revision").and_then(Value::as_str),
            Some(revision.as_str())
        );
    }

    #[test]
    fn backup_preferences_omit_the_internal_storage_revision() {
        let mut preferences = default_preferences();
        preferences[STORAGE_REVISION_KEY] = json!("private-revision-token");

        let exported = preferences_for_backup(&preferences);

        assert!(exported.get(STORAGE_REVISION_KEY).is_none());
        assert_eq!(
            preferences[STORAGE_REVISION_KEY],
            json!("private-revision-token")
        );
    }

    #[test]
    fn storage_lock_serializes_collection_access() {
        let root = test_root("storage-lock");
        let first = acquire_storage_lock(&root).unwrap();
        let second_file = OpenOptions::new()
            .read(true)
            .write(true)
            .open(root.join(".inkubator.lock"))
            .unwrap();

        let error = File::try_lock(&second_file).unwrap_err();
        assert!(matches!(error, std::fs::TryLockError::WouldBlock));
        drop(first);
        File::try_lock(&second_file).unwrap();
        File::unlock(&second_file).unwrap();
        drop(second_file);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recovered_storage_lock_repairs_pending_state_before_access_and_stays_held() {
        let root = test_root("recovered-storage-lock");
        let rollback = root.join(".collection-save-rollback-pending");
        fs::create_dir_all(&rollback).unwrap();
        fs::write(root.join("data.json"), b"new-data").unwrap();
        fs::write(rollback.join("0-data.json"), b"old-data").unwrap();
        write_json(
            &transaction_marker_path(&rollback),
            &serde_json::to_value(TransactionMarker {
                version: 1,
                state: "prepared".to_string(),
                items: vec![TransactionMarkerItem {
                    target: "data.json".to_string(),
                    rollback: "0-data.json".to_string(),
                    had_target: true,
                    has_staged: true,
                }],
            })
            .unwrap(),
        )
        .unwrap();

        let lock = acquire_recovered_storage_lock(&root).unwrap();

        assert_eq!(fs::read(root.join("data.json")).unwrap(), b"old-data");
        assert!(!rollback.exists());
        let second_file = OpenOptions::new()
            .read(true)
            .write(true)
            .open(root.join(".inkubator.lock"))
            .unwrap();
        assert!(matches!(
            File::try_lock(&second_file).unwrap_err(),
            std::fs::TryLockError::WouldBlock
        ));
        drop(lock);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recovered_storage_lock_blocks_access_when_recovery_is_incomplete() {
        let root = test_root("incomplete-recovery-lock");
        let rollback = root.join(".collection-save-rollback-incomplete");
        fs::create_dir_all(&rollback).unwrap();
        write_json(
            &transaction_marker_path(&rollback),
            &serde_json::to_value(TransactionMarker {
                version: 1,
                state: "prepared".to_string(),
                items: vec![TransactionMarkerItem {
                    target: "data.json".to_string(),
                    rollback: "0-data.json".to_string(),
                    had_target: true,
                    has_staged: true,
                }],
            })
            .unwrap(),
        )
        .unwrap();

        let error = acquire_recovered_storage_lock(&root).err().unwrap();

        assert!(error
            .to_string()
            .contains("Could not recover interrupted storage transaction"));
        assert!(rollback.exists());
        assert!(!root.join("data.json").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn staged_commit_restores_json_and_images_after_mid_commit_failure() {
        let root = test_root("transaction-rollback");
        let live = root.join("live");
        let stage = root.join("stage");
        let rollback = root.join("rollback");
        fs::create_dir_all(live.join("images")).unwrap();
        fs::create_dir_all(live.join("replaced-images")).unwrap();
        fs::create_dir_all(stage.join("images")).unwrap();
        fs::write(live.join("data.json"), b"old-data").unwrap();
        fs::write(live.join("preferences.json"), b"old-preferences").unwrap();
        fs::write(live.join("images/old.webp"), b"old-image").unwrap();
        fs::write(live.join("replaced-images/old.webp"), b"old-replaced").unwrap();
        fs::write(stage.join("data.json"), b"new-data").unwrap();
        fs::write(stage.join("preferences.json"), b"new-preferences").unwrap();
        fs::write(stage.join("images/new.webp"), b"new-image").unwrap();

        let items = [
            StagedCommitItem {
                label: "data.json",
                staged: Some(stage.join("data.json")),
                target: live.join("data.json"),
            },
            StagedCommitItem {
                label: "preferences.json",
                staged: Some(stage.join("preferences.json")),
                target: live.join("preferences.json"),
            },
            StagedCommitItem {
                label: "images",
                staged: Some(stage.join("images")),
                target: live.join("images"),
            },
            StagedCommitItem {
                label: "replaced-images",
                staged: None,
                target: live.join("replaced-images"),
            },
        ];

        let result = commit_staged_items_with(&items, &rollback, |index| {
            if index == 2 {
                Err(anyhow!("injected promotion failure"))
            } else {
                Ok(())
            }
        });

        assert!(result.is_err());
        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"old-data");
        assert_eq!(
            fs::read(live.join("preferences.json")).unwrap(),
            b"old-preferences"
        );
        assert_eq!(
            fs::read(live.join("images/old.webp")).unwrap(),
            b"old-image"
        );
        assert!(!live.join("images/new.webp").exists());
        assert_eq!(
            fs::read(live.join("replaced-images/old.webp")).unwrap(),
            b"old-replaced"
        );
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn committed_marker_post_install_sync_failure_never_starts_rollback() {
        let root = test_root("committed-marker-sync-failure");
        let live = root.join("live");
        let stage = root.join("stage");
        let rollback = root.join(".collection-save-rollback-sync-failure");
        fs::create_dir_all(&live).unwrap();
        fs::create_dir_all(&stage).unwrap();
        fs::write(live.join("data.json"), b"old-data").unwrap();
        fs::write(stage.join("data.json"), b"new-data").unwrap();
        let items = [StagedCommitItem {
            label: "data.json",
            staged: Some(stage.join("data.json")),
            target: live.join("data.json"),
        }];

        let warnings = commit_staged_items_with_marker_writer(
            &items,
            &rollback,
            |_| Ok(()),
            |path, value| {
                write_json(path, value)?;
                if value.get("state").and_then(Value::as_str) == Some("committed") {
                    return Err(installed_file_sync_error(
                        path,
                        anyhow!("injected post-install directory sync failure"),
                    ));
                }
                Ok(())
            },
        )
        .unwrap();

        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"new-data");
        assert!(rollback.exists());
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("committed transaction marker")));
        let marker: TransactionMarker =
            serde_json::from_value(read_json(&transaction_marker_path(&rollback)).unwrap())
                .unwrap();
        assert_eq!(marker.state, "committed");

        recover_interrupted_transactions(&root).unwrap();
        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"new-data");
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn prepared_marker_post_install_sync_failure_leaves_live_state_unchanged() {
        let root = test_root("prepared-marker-sync-failure");
        let live = root.join("live");
        let stage = root.join("stage");
        let rollback = root.join(".collection-save-rollback-prepared-sync-failure");
        fs::create_dir_all(&live).unwrap();
        fs::create_dir_all(&stage).unwrap();
        fs::write(live.join("data.json"), b"old-data").unwrap();
        fs::write(stage.join("data.json"), b"new-data").unwrap();
        let items = [StagedCommitItem {
            label: "data.json",
            staged: Some(stage.join("data.json")),
            target: live.join("data.json"),
        }];

        let error = commit_staged_items_with_marker_writer(
            &items,
            &rollback,
            |_| Ok(()),
            |path, value| {
                write_json(path, value)?;
                Err(installed_file_sync_error(
                    path,
                    anyhow!("injected prepared-marker directory sync failure"),
                ))
            },
        )
        .err()
        .unwrap();

        assert!(error.to_string().contains("Live data was not changed"));
        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"old-data");
        assert_eq!(fs::read(stage.join("data.json")).unwrap(), b"new-data");
        assert!(rollback.exists());
        recover_interrupted_transactions(&root).unwrap();
        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"old-data");
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn startup_recovery_restores_pre_transaction_state_after_interruption() {
        let root = test_root("transaction-startup-recovery");
        let live = root.join("live");
        let stage = root.join("stage");
        let rollback = root.join(".collection-save-rollback-interrupted");
        fs::create_dir_all(&live).unwrap();
        fs::create_dir_all(&stage).unwrap();
        fs::write(live.join("data.json"), b"old-data").unwrap();
        fs::write(live.join("preferences.json"), b"old-preferences").unwrap();
        fs::write(stage.join("data.json"), b"new-data").unwrap();
        fs::write(stage.join("preferences.json"), b"new-preferences").unwrap();

        let items = [
            StagedCommitItem {
                label: "data.json",
                staged: Some(stage.join("data.json")),
                target: live.join("data.json"),
            },
            StagedCommitItem {
                label: "preferences.json",
                staged: Some(stage.join("preferences.json")),
                target: live.join("preferences.json"),
            },
        ];
        let interrupted = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = commit_staged_items_with(&items, &rollback, |index| {
                if index == 1 {
                    panic!("simulated process interruption");
                }
                Ok(())
            });
        }));

        assert!(interrupted.is_err());
        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"new-data");
        assert!(!live.join("preferences.json").exists());
        assert!(transaction_marker_path(&rollback).is_file());

        recover_interrupted_transactions(&root).unwrap();

        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"old-data");
        assert_eq!(
            fs::read(live.join("preferences.json")).unwrap(),
            b"old-preferences"
        );
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn startup_recovery_keeps_committed_state_when_cleanup_was_interrupted() {
        let root = test_root("transaction-committed-recovery");
        let live = root.join("live");
        let rollback = root.join(".collection-save-rollback-committed");
        fs::create_dir_all(&live).unwrap();
        fs::create_dir_all(&rollback).unwrap();
        fs::write(live.join("data.json"), b"new-data").unwrap();
        fs::write(live.join("preferences.json"), b"new-preferences").unwrap();
        fs::write(rollback.join("0-data.json"), b"old-data").unwrap();
        fs::write(rollback.join("1-preferences.json"), b"old-preferences").unwrap();
        let marker = TransactionMarker {
            version: 1,
            state: "committed".to_string(),
            items: vec![
                TransactionMarkerItem {
                    target: "live/data.json".to_string(),
                    rollback: "0-data.json".to_string(),
                    had_target: true,
                    has_staged: true,
                },
                TransactionMarkerItem {
                    target: "live/preferences.json".to_string(),
                    rollback: "1-preferences.json".to_string(),
                    had_target: true,
                    has_staged: true,
                },
            ],
        };
        write_json(
            &transaction_marker_path(&rollback),
            &serde_json::to_value(marker).unwrap(),
        )
        .unwrap();

        recover_interrupted_transactions(&root).unwrap();

        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"new-data");
        assert_eq!(
            fs::read(live.join("preferences.json")).unwrap(),
            b"new-preferences"
        );
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn startup_recovery_rolls_back_an_incomplete_committed_snapshot() {
        let root = test_root("transaction-incomplete-committed");
        let live = root.join("live");
        let rollback = root.join(".collection-save-rollback-incomplete");
        fs::create_dir_all(&live).unwrap();
        fs::create_dir_all(&rollback).unwrap();
        fs::write(live.join("data.json"), b"new-data").unwrap();
        fs::write(rollback.join("0-data.json"), b"old-data").unwrap();
        fs::write(rollback.join("1-preferences.json"), b"old-preferences").unwrap();
        let marker = TransactionMarker {
            version: 1,
            state: "committed".to_string(),
            items: vec![
                TransactionMarkerItem {
                    target: "live/data.json".to_string(),
                    rollback: "0-data.json".to_string(),
                    had_target: true,
                    has_staged: true,
                },
                TransactionMarkerItem {
                    target: "live/preferences.json".to_string(),
                    rollback: "1-preferences.json".to_string(),
                    had_target: true,
                    has_staged: true,
                },
            ],
        };
        write_json(
            &transaction_marker_path(&rollback),
            &serde_json::to_value(marker).unwrap(),
        )
        .unwrap();

        recover_interrupted_transactions(&root).unwrap();

        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"old-data");
        assert_eq!(
            fs::read(live.join("preferences.json")).unwrap(),
            b"old-preferences"
        );
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn incomplete_committed_recovery_is_prepared_before_partial_restore_and_retries() {
        let root = test_root("transaction-incomplete-committed-retry");
        let live = root.join("live");
        let rollback = root.join(".collection-save-rollback-incomplete-retry");
        fs::create_dir_all(&live).unwrap();
        fs::create_dir_all(&rollback).unwrap();
        fs::write(live.join("data.json"), b"new-data").unwrap();
        fs::write(rollback.join("0-data.json"), b"old-data").unwrap();
        fs::write(rollback.join("1-preferences.json"), b"old-preferences").unwrap();
        let marker = TransactionMarker {
            version: 1,
            state: "committed".to_string(),
            items: vec![
                TransactionMarkerItem {
                    target: "live/data.json".to_string(),
                    rollback: "0-data.json".to_string(),
                    had_target: true,
                    has_staged: true,
                },
                TransactionMarkerItem {
                    target: "live/preferences.json".to_string(),
                    rollback: "1-preferences.json".to_string(),
                    had_target: true,
                    has_staged: true,
                },
            ],
        };
        write_json(
            &transaction_marker_path(&rollback),
            &serde_json::to_value(&marker).unwrap(),
        )
        .unwrap();

        let error = recover_marked_transaction_with(&root, &rollback, &marker, |restore_index| {
            if restore_index == 0 {
                Err(anyhow!("simulated recovery interruption"))
            } else {
                Ok(())
            }
        })
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("simulated recovery interruption"));
        let prepared: TransactionMarker =
            serde_json::from_value(read_json(&transaction_marker_path(&rollback)).unwrap())
                .unwrap();
        assert_eq!(prepared.state, "prepared");
        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"new-data");
        assert_eq!(
            fs::read(live.join("preferences.json")).unwrap(),
            b"old-preferences"
        );

        recover_interrupted_transactions(&root).unwrap();
        assert_eq!(fs::read(live.join("data.json")).unwrap(), b"old-data");
        assert_eq!(
            fs::read(live.join("preferences.json")).unwrap(),
            b"old-preferences"
        );
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn markerless_legacy_recovery_writes_prepared_marker_before_partial_restore() {
        let root = test_root("legacy-transaction-retry");
        let rollback = root.join(".collection-save-rollback-legacy-retry");
        fs::create_dir_all(&rollback).unwrap();
        fs::write(root.join("data.json"), b"new-data").unwrap();
        fs::write(rollback.join("0-data.json"), b"old-data").unwrap();
        fs::write(rollback.join("1-preferences.json"), b"old-preferences").unwrap();

        recover_legacy_transaction_with(&root, &rollback, |restore_index| {
            if restore_index == 0 {
                Err(anyhow!("simulated legacy recovery interruption"))
            } else {
                Ok(())
            }
        })
        .unwrap_err();

        let prepared: TransactionMarker =
            serde_json::from_value(read_json(&transaction_marker_path(&rollback)).unwrap())
                .unwrap();
        assert_eq!(prepared.state, "prepared");
        assert_eq!(fs::read(root.join("data.json")).unwrap(), b"new-data");
        assert_eq!(
            fs::read(root.join("preferences.json")).unwrap(),
            b"old-preferences"
        );

        recover_interrupted_transactions(&root).unwrap();
        assert_eq!(fs::read(root.join("data.json")).unwrap(), b"old-data");
        assert_eq!(
            fs::read(root.join("preferences.json")).unwrap(),
            b"old-preferences"
        );
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn markerless_legacy_recovery_preserves_a_required_live_file_without_rollback() {
        let root = test_root("legacy-transaction-incomplete-rollback");
        let rollback = root.join(".collection-save-rollback-incomplete-copy");
        fs::create_dir_all(&rollback).unwrap();
        fs::write(root.join("data.json"), b"only-data-copy").unwrap();
        fs::write(rollback.join("1-preferences.json"), b"old-preferences").unwrap();

        recover_legacy_transaction(&root, &rollback).unwrap();

        assert_eq!(fs::read(root.join("data.json")).unwrap(), b"only-data-copy");
        assert_eq!(
            fs::read(root.join("preferences.json")).unwrap(),
            b"old-preferences"
        );
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn startup_recovery_rejects_a_non_file_transaction_marker() {
        let root = test_root("transaction-marker-directory");
        let rollback = root.join(".collection-save-rollback-invalid-marker");
        fs::create_dir_all(transaction_marker_path(&rollback)).unwrap();

        let error = recover_interrupted_transactions(&root).err().unwrap();

        assert!(error
            .to_string()
            .contains("Transaction marker is not a regular file"));
        assert!(rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn finalized_recovery_cleanup_never_replays_stale_target_changes() {
        let root = test_root("finalized-transaction-cleanup");
        let rollback = root.join(".collection-save-rollback-finalized");
        fs::create_dir_all(&rollback).unwrap();
        fs::write(root.join("later.json"), b"later-state").unwrap();
        write_json(
            &transaction_marker_path(&rollback),
            &serde_json::to_value(TransactionMarker {
                version: 1,
                state: "finalized".to_string(),
                items: vec![TransactionMarkerItem {
                    target: "later.json".to_string(),
                    rollback: "0-later.json".to_string(),
                    had_target: false,
                    has_staged: true,
                }],
            })
            .unwrap(),
        )
        .unwrap();

        recover_interrupted_transactions(&root).unwrap();

        assert_eq!(fs::read(root.join("later.json")).unwrap(), b"later-state");
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn zip_extraction_enforces_entry_and_expanded_size_limits() {
        let root = test_root("zip-limits");
        let zip_path = root.join("backup.zip");
        create_test_zip(
            &zip_path,
            &[
                ("data.json", b"12345678"),
                ("preferences.json", b"abcdefgh"),
            ],
        );

        let entry_error =
            extract_zip_to_folder_with_limits(&zip_path, &root.join("entry-limit"), 1, 1024)
                .unwrap_err();
        assert!(entry_error.to_string().contains("more than 1 entries"));

        let size_error =
            extract_zip_to_folder_with_limits(&zip_path, &root.join("size-limit"), 10, 8)
                .unwrap_err();
        assert!(size_error.to_string().contains("Expanded backup exceeds"));

        let oversized = root.join("oversized.zip");
        let file = File::create(&oversized).unwrap();
        file.set_len(MAX_BACKUP_COMPRESSED_BYTES + 1).unwrap();
        drop(file);
        let compressed_error =
            extract_zip_to_folder_with_limits(&oversized, &root.join("compressed-limit"), 10, 1024)
                .unwrap_err();
        assert!(compressed_error
            .to_string()
            .contains("compressed size limit"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_zip_export_preserves_existing_destination_until_completed() {
        let root = test_root("atomic-backup-zip");
        let source = root.join("source");
        let output = root.join("output");
        let destination = output.join("backup.zip");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&output).unwrap();
        fs::write(source.join("one.txt"), b"one").unwrap();
        fs::write(source.join("two.txt"), b"two").unwrap();
        fs::write(&destination, b"existing-backup").unwrap();
        let mut entries_seen = 0usize;

        let error = zip_folder_with(&source, &destination, |_| {
            entries_seen += 1;
            if entries_seen == 2 {
                Err(anyhow!("injected ZIP failure"))
            } else {
                Ok(())
            }
        })
        .err()
        .unwrap();

        assert!(error.to_string().contains("injected ZIP failure"));
        assert_eq!(fs::read(&destination).unwrap(), b"existing-backup");
        assert_eq!(fs::read_dir(&output).unwrap().count(), 1);

        zip_folder(&source, &destination).unwrap();
        let mut archive = ZipArchive::new(File::open(&destination).unwrap()).unwrap();
        assert_eq!(archive.len(), 2);
        assert!(archive.by_name("one.txt").is_ok());
        assert!(archive.by_name("two.txt").is_ok());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn auto_backup_schedule_and_retention_ignore_incomplete_directories() {
        let root = test_root("auto-backup-completeness");
        let old = root.join("auto-old");
        write_complete_auto_backup(&old, "old");
        std::thread::sleep(Duration::from_millis(20));

        let staging = root.join(".auto-stage-interrupted");
        fs::create_dir_all(&staging).unwrap();
        write_json(&staging.join("data.json"), &json!({ "partial": true })).unwrap();
        let incomplete = root.join("auto-incomplete");
        fs::create_dir_all(incomplete.join("images")).unwrap();
        write_json(&incomplete.join("data.json"), &json!({ "partial": true })).unwrap();

        let latest = latest_auto_backup(&root).unwrap();
        assert_eq!(latest.0, old);

        std::thread::sleep(Duration::from_millis(20));
        let newest = root.join("auto-newest");
        write_complete_auto_backup(&newest, "newest");
        prune_auto_backups(&root, 1).unwrap();

        assert!(!old.exists());
        assert!(newest.exists());
        assert!(staging.exists());
        assert!(incomplete.exists());
        assert_eq!(latest_auto_backup(&root).unwrap().0, newest);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn malformed_backup_json_preserves_existing_storage() {
        let root = test_root("malformed-backup");
        let paths = StoragePaths::new(root.join("storage"));
        let collection = json!({
            "pens": [{ "id": "old-pen" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        let preferences = json!({ "color_mode": "dark" });
        write_test_storage(&paths, &collection, &preferences);
        fs::write(paths.images.join("pens/old.webp"), b"old-image").unwrap();

        let backup = root.join("backup");
        fs::create_dir_all(backup.join("images/pens")).unwrap();
        fs::write(backup.join("data.json"), b"{malformed").unwrap();
        write_json(&backup.join("preferences.json"), &json!({})).unwrap();
        fs::write(backup.join("images/pens/new.webp"), b"new-image").unwrap();
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        assert!(import_backup_folder(
            &paths,
            &backup,
            Some(&ImportOptions {
                auto_validate_import: Some(true),
            }),
            Some(&revision),
        )
        .is_err());
        assert_eq!(read_json(&paths.data).unwrap(), collection);
        assert_eq!(read_json(&paths.preferences).unwrap(), preferences);
        assert_eq!(
            fs::read(paths.images.join("pens/old.webp")).unwrap(),
            b"old-image"
        );
        assert!(!paths.images.join("pens/new.webp").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_import_rejects_forged_raster_media_before_replacing_storage() {
        let root = test_root("unsupported-backup-media");
        let paths = StoragePaths::new(root.join("storage"));
        let original = json!({
            "pens": [{ "id": "old-pen" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_test_storage(&paths, &original, &default_preferences());

        let backup = root.join("backup");
        fs::create_dir_all(backup.join("images/pens")).unwrap();
        write_json(&backup.join("data.json"), &default_collection_data()).unwrap();
        write_json(&backup.join("preferences.json"), &default_preferences()).unwrap();
        fs::write(
            backup.join("images/pens/active-content.webp"),
            b"<script>alert(1)</script>",
        )
        .unwrap();
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        let error = import_backup_folder(&paths, &backup, None, Some(&revision))
            .err()
            .unwrap();

        assert!(error.to_string().contains("invalid raster image contents"));
        assert_eq!(read_json(&paths.data).unwrap(), original);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_media_validation_decodes_supported_formats_and_checks_native_format_signatures() {
        let root = test_root("backup-raster-validation");
        let media = root.join("images/pens");
        fs::create_dir_all(&media).unwrap();
        let decoded_cases = [
            ("sample.jpg", ImageFormat::Jpeg),
            ("sample.jpeg", ImageFormat::Jpeg),
            ("sample.png", ImageFormat::Png),
            ("sample.webp", ImageFormat::WebP),
        ];
        for (name, format) in decoded_cases {
            fs::write(media.join(name), test_raster_bytes(format, [20, 40, 60])).unwrap();
        }
        let signature_only_cases: [(&str, &[u8]); 3] = [
            ("sample.avif", b"\0\0\0\x18ftypavif\0\0\0\0avif"),
            ("sample.heic", b"\0\0\0\x18ftypheic\0\0\0\0mif1"),
            ("sample.heif", b"\0\0\0\x18ftypmif1\0\0\0\0heic"),
        ];
        for (name, bytes) in signature_only_cases {
            fs::write(media.join(name), bytes).unwrap();
        }

        validate_backup_media_tree(&root.join("images"), "images").unwrap();
        assert!(!has_raster_signature(b"<svg onload=alert(1)>", "webp"));
        assert!(!has_raster_signature(b"<html>active</html>", "avif"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_media_validation_rejects_truncated_decodable_raster_headers() {
        let root = test_root("truncated-backup-rasters");
        let cases: [(&str, &[u8]); 3] = [
            ("truncated.jpg", &[0xff, 0xd8, 0xff, 0xe0]),
            (
                "truncated.png",
                &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a],
            ),
            ("truncated.webp", b"RIFF\x04\0\0\0WEBP"),
        ];
        for (name, bytes) in cases {
            let path = root.join(name);
            fs::write(&path, bytes).unwrap();
            let error = validate_backup_raster_file(&path, "images").err().unwrap();
            assert!(
                error.to_string().contains("unreadable raster image"),
                "unexpected error for {name}: {error}"
            );
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_raster_decode_limits_cap_dimensions_and_allocations() {
        let path = Path::new("images/pens/oversized.webp");
        assert!(
            validate_backup_raster_decode_limits(10_001, 10_000, 40_000, path, "images").is_err()
        );
        assert!(validate_backup_raster_decode_limits(
            1,
            1,
            MAX_BACKUP_RASTER_DECODE_BYTES + 1,
            path,
            "images"
        )
        .is_err());
        assert!(
            validate_backup_raster_decode_limits(10_000, 10_000, 400_000_000, path, "images")
                .is_ok()
        );
    }

    #[cfg(unix)]
    #[test]
    fn backup_media_validation_rejects_a_dangling_media_root() {
        use std::os::unix::fs::symlink;

        let root = test_root("dangling-backup-media-root");
        let images = root.join("images");
        symlink(root.join("missing-images"), &images).unwrap();

        let error = validate_backup_media_tree(&images, "images").err().unwrap();

        assert!(error.to_string().contains("must be a directory"));
        fs::remove_file(images).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn recursive_copy_rejects_symlinked_roots_and_entries() {
        use std::os::unix::fs::symlink;

        let root = test_root("symlinked-recursive-copy");
        let source = root.join("source");
        let destination = root.join("destination");
        let outside = root.join("outside");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.webp"), b"outside-secret").unwrap();
        symlink(&outside, source.join("linked")).unwrap();

        assert!(copy_dir_all(&source, &destination).is_err());
        assert!(!destination.join("linked/secret.webp").exists());

        let linked_root = root.join("linked-root");
        symlink(&source, &linked_root).unwrap();
        assert!(copy_dir_all(&linked_root, &root.join("destination-two")).is_err());
        assert_eq!(
            fs::read(outside.join("secret.webp")).unwrap(),
            b"outside-secret"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn required_static_copy_rejects_symlinked_parents_and_files() {
        use std::os::unix::fs::symlink;

        let root = test_root("symlinked-static-copy");
        let source = root.join("source");
        let destination = root.join("destination");
        let outside = root.join("outside");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&destination).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.css"), b"outside-secret").unwrap();
        symlink(outside.join("secret.css"), source.join("style.css")).unwrap();
        symlink(&outside, source.join("assets")).unwrap();

        assert!(copy_required_file(&source, &destination, "style.css").is_err());
        assert!(copy_required_file(&source, &destination, "assets/secret.css").is_err());
        assert!(!destination.join("style.css").exists());
        assert!(!destination.join("assets/secret.css").exists());
        assert_eq!(
            fs::read(outside.join("secret.css")).unwrap(),
            b"outside-secret"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn startup_storage_files_must_be_real_regular_files() {
        use std::{os::unix::fs::symlink, process::Command};

        let root = test_root("startup-storage-file-types");
        let outside = root.join("outside.json");
        let linked = root.join("data.json");
        fs::write(&outside, b"{}").unwrap();
        symlink(&outside, &linked).unwrap();
        assert!(require_real_regular_file(&linked, "Collection data").is_err());

        let fifo = root.join("preferences.json");
        let status = Command::new("mkfifo").arg(&fifo).status().unwrap();
        assert!(status.success());
        assert!(require_real_regular_file(&fifo, "Preferences data").is_err());
        assert_eq!(fs::read(&outside).unwrap(), b"{}");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_import_replaces_storage_and_returns_new_revision() {
        let root = test_root("backup-import");
        let paths = StoragePaths::new(root.join("storage"));
        let old_collection = json!({
            "pens": [{ "id": "old-pen" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_test_storage(&paths, &old_collection, &json!({ "color_mode": "dark" }));
        fs::write(paths.images.join("pens/old.webp"), b"old-image").unwrap();
        fs::create_dir_all(&paths.replaced_images).unwrap();
        fs::write(paths.replaced_images.join("old.webp"), b"old-replaced").unwrap();

        let backup = root.join("backup");
        let new_collection = json!({
            "pens": [{ "id": "new-pen", "image": "pens/new.webp" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        let new_preferences = json!({ "color_mode": "light" });
        fs::create_dir_all(backup.join("images/pens")).unwrap();
        write_json(&backup.join("data.json"), &new_collection).unwrap();
        write_json(&backup.join("preferences.json"), &new_preferences).unwrap();
        let new_image = test_raster_bytes(ImageFormat::WebP, [20, 40, 60]);
        fs::write(backup.join("images/pens/new.webp"), &new_image).unwrap();
        let (_, _, old_revision) = read_storage_state(&paths).unwrap();

        let conflict = import_backup_folder(
            &paths,
            &backup,
            Some(&ImportOptions {
                auto_validate_import: Some(true),
            }),
            Some("stale-revision"),
        )
        .unwrap();
        assert_eq!(
            conflict.get("code").and_then(Value::as_str),
            Some("DATA_CONFLICT")
        );
        assert_eq!(read_json(&paths.data).unwrap(), old_collection);
        assert!(paths.images.join("pens/old.webp").exists());
        assert!(!paths.images.join("pens/new.webp").exists());

        let result = import_backup_folder(
            &paths,
            &backup,
            Some(&ImportOptions {
                auto_validate_import: Some(true),
            }),
            Some(&old_revision),
        )
        .unwrap();

        assert_eq!(result.get("success").and_then(Value::as_bool), Some(true));
        let (live_collection, live_preferences, live_revision) =
            read_storage_state(&paths).unwrap();
        assert_eq!(live_collection, new_collection);
        assert_eq!(
            live_preferences["color_mode"],
            new_preferences["color_mode"]
        );
        assert!(live_preferences[STORAGE_REVISION_KEY].is_string());
        assert!(result["data"]["preferences"]
            .get(STORAGE_REVISION_KEY)
            .is_none());
        assert_eq!(
            result.get("revision").and_then(Value::as_str),
            Some(live_revision.as_str())
        );
        assert!(!paths.images.join("pens/old.webp").exists());
        assert_eq!(
            fs::read(paths.images.join("pens/new.webp")).unwrap(),
            new_image
        );
        assert!(!paths.replaced_images.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_import_repairs_legacy_png_named_webp_media() {
        let root = test_root("legacy-png-webp-import");
        let paths = StoragePaths::new(root.join("storage"));
        let current_collection = default_collection_data();
        let preferences = default_preferences();
        write_test_storage(&paths, &current_collection, &preferences);
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        let backup = root.join("backup");
        let imported_collection = json!({
            "pens": [{ "id": "legacy-pen", "image": "pens/legacy.webp" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_json(&backup.join("data.json"), &imported_collection).unwrap();
        write_json(&backup.join("preferences.json"), &preferences).unwrap();
        fs::create_dir_all(backup.join("images/pens")).unwrap();
        fs::create_dir_all(backup.join("replaced-images/pens")).unwrap();
        let png = test_raster_bytes(ImageFormat::Png, [20, 40, 60]);
        fs::write(backup.join("images/pens/legacy.webp"), &png).unwrap();
        fs::write(backup.join("replaced-images/pens/old.webp"), &png).unwrap();

        let result = import_backup_folder(&paths, &backup, None, Some(&revision)).unwrap();

        assert_eq!(result["success"], json!(true));
        assert_eq!(read_json(&paths.data).unwrap(), imported_collection);
        for path in [
            paths.images.join("pens/legacy.webp"),
            paths.replaced_images.join("pens/old.webp"),
        ] {
            let bytes = fs::read(&path).unwrap();
            assert!(has_raster_signature(&bytes, "webp"), "{}", path.display());
            validate_backup_raster_file(&path, "images").unwrap();
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_import_clears_only_obsolete_legacy_ink_swatch_aliases() {
        let root = test_root("legacy-ink-swatch-alias-import");
        let paths = StoragePaths::new(root.join("storage"));
        let preferences = default_preferences();
        write_test_storage(&paths, &default_collection_data(), &preferences);
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        let backup = root.join("backup");
        let imported_collection = json!({
            "pens": [],
            "inks": [{
                "id": "legacy-alias",
                "image": "swatches/missing-legacy.webp",
                "image_url": "images/swatches/missing-url-alias.webp",
                "url": "swatches/missing-direct-url-alias.webp"
            }, {
                "id": "bottle-photo",
                "image": "inks/bottle.webp"
            }, {
                "id": "preserved-alias",
                "image": "swatches/preserved-legacy.webp"
            }, {
                "id": "unlinked-alias",
                "image": "swatches/unlinked.webp"
            }],
            "swatches": [{
                "id": "current-swatch",
                "ink_id": "legacy-alias",
                "image": "swatches/current.webp"
            }, {
                "id": "bottle-swatch",
                "ink_id": "bottle-photo",
                "image": "swatches/bottle-swatch.webp"
            }, {
                "id": "preserved-current-swatch",
                "ink_id": "preserved-alias",
                "image": "swatches/preserved-current.webp"
            }],
            "currently_inked": [],
            "activity_log": []
        });
        write_json(&backup.join("data.json"), &imported_collection).unwrap();
        write_json(&backup.join("preferences.json"), &preferences).unwrap();
        fs::create_dir_all(backup.join("images/inks")).unwrap();
        fs::create_dir_all(backup.join("images/swatches")).unwrap();
        let image = test_raster_bytes(ImageFormat::WebP, [20, 40, 60]);
        fs::write(backup.join("images/inks/bottle.webp"), &image).unwrap();
        fs::write(backup.join("images/swatches/current.webp"), &image).unwrap();
        fs::write(backup.join("images/swatches/bottle-swatch.webp"), &image).unwrap();
        fs::write(backup.join("images/swatches/preserved-legacy.webp"), &image).unwrap();
        fs::write(
            backup.join("images/swatches/preserved-current.webp"),
            &image,
        )
        .unwrap();
        fs::write(backup.join("images/swatches/unlinked.webp"), &image).unwrap();

        let result = import_backup_folder(&paths, &backup, None, Some(&revision)).unwrap();

        assert_eq!(result["success"], json!(true));
        let imported = read_json(&paths.data).unwrap();
        assert_eq!(imported["inks"][0]["image"], json!(""));
        assert_eq!(imported["inks"][0]["image_url"], json!(""));
        assert_eq!(imported["inks"][0]["url"], json!(""));
        assert_eq!(imported["inks"][1]["image"], json!("inks/bottle.webp"));
        assert_eq!(
            imported["inks"][2]["image"],
            json!("swatches/preserved-legacy.webp")
        );
        assert_eq!(
            imported["inks"][3]["image"],
            json!("swatches/unlinked.webp")
        );
        assert_eq!(
            imported["swatches"][0]["image"],
            json!("swatches/current.webp")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn legacy_alias_replacement_requires_a_canonical_swatch_image() {
        assert!(has_current_swatch_image_reference(&json!({
            "image": "swatches/current.webp"
        })));
        assert!(has_current_swatch_image_reference(&json!({
            "images": [{ "url": "swatches/current.webp" }]
        })));
        assert!(!has_current_swatch_image_reference(&json!({
            "image_url": "swatches/noncanonical.webp"
        })));
        assert!(!has_current_swatch_image_reference(&json!({
            "url": "swatches/noncanonical.webp"
        })));
        assert!(!has_current_swatch_image_reference(&json!({
            "images": [{}]
        })));
    }

    #[test]
    fn backup_import_does_not_treat_an_empty_swatch_gallery_as_a_replacement() {
        let root = test_root("invalid-empty-swatch-gallery-import");
        let paths = StoragePaths::new(root.join("storage"));
        let preferences = default_preferences();
        write_test_storage(&paths, &default_collection_data(), &preferences);
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        let backup = root.join("backup");
        let imported_collection = json!({
            "pens": [],
            "inks": [{
                "id": "legacy-alias",
                "image": "swatches/missing-legacy.webp"
            }],
            "swatches": [{
                "id": "invalid-swatch",
                "ink_id": "legacy-alias",
                "images": [{}]
            }],
            "currently_inked": [],
            "activity_log": []
        });
        write_json(&backup.join("data.json"), &imported_collection).unwrap();
        write_json(&backup.join("preferences.json"), &preferences).unwrap();

        let error = import_backup_folder(&paths, &backup, None, Some(&revision))
            .expect_err("the missing legacy reference must remain strict");

        assert!(error.to_string().contains("missing its referenced images"));
        assert_eq!(read_json(&paths.data).unwrap(), default_collection_data());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn identical_backup_import_refreshes_revision_and_hides_internal_token() {
        let root = test_root("identical-backup-revision");
        let paths = StoragePaths::new(root.join("storage"));
        let collection = json!({
            "pens": [{ "id": "pen-1", "image": "pens/same.webp" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        let preferences = default_preferences();
        write_test_storage(&paths, &collection, &preferences);
        let old_image = test_raster_bytes(ImageFormat::WebP, [10, 20, 30]);
        let new_image = test_raster_bytes(ImageFormat::WebP, [40, 50, 60]);
        fs::write(paths.images.join("pens/same.webp"), old_image).unwrap();
        let (_, _, old_revision) = read_storage_state(&paths).unwrap();

        let backup = root.join("backup");
        fs::create_dir_all(backup.join("images/pens")).unwrap();
        write_json(&backup.join("data.json"), &collection).unwrap();
        write_json(&backup.join("preferences.json"), &preferences).unwrap();
        fs::write(backup.join("images/pens/same.webp"), &new_image).unwrap();

        let result = import_backup_folder(&paths, &backup, None, Some(&old_revision)).unwrap();
        let (_, live_preferences, new_revision) = read_storage_state(&paths).unwrap();

        assert_eq!(result["success"], json!(true));
        assert_ne!(new_revision, old_revision);
        assert_eq!(result["revision"], json!(new_revision));
        assert!(live_preferences[STORAGE_REVISION_KEY].is_string());
        assert!(result["data"]["preferences"]
            .get(STORAGE_REVISION_KEY)
            .is_none());
        assert!(
            combine_collection_with_preferences(collection.clone(), live_preferences.clone())
                ["preferences"]
                .get(STORAGE_REVISION_KEY)
                .is_none()
        );
        assert!(revision_conflict(Some(&old_revision), &new_revision).is_some());
        assert_eq!(
            fs::read(paths.images.join("pens/same.webp")).unwrap(),
            new_image
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_import_rejects_non_object_preferences() {
        let root = test_root("non-object-backup-preferences");
        let paths = StoragePaths::new(root.join("storage"));
        let collection = default_collection_data();
        write_test_storage(&paths, &collection, &default_preferences());
        let backup = root.join("backup");
        fs::create_dir_all(&backup).unwrap();
        write_json(&backup.join("data.json"), &collection).unwrap();
        write_json(&backup.join("preferences.json"), &json!([])).unwrap();
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        let result = import_backup_folder(&paths, &backup, None, Some(&revision)).unwrap();

        assert_eq!(result["success"], json!(false));
        assert!(result["message"]
            .as_str()
            .unwrap()
            .contains("preferences must be a JSON object"));
        assert_eq!(read_json(&paths.data).unwrap(), collection);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_import_rejects_unsafe_managed_image_aliases_before_replacing_storage() {
        let root = test_root("unsafe-import-image-reference");
        let paths = StoragePaths::new(root.join("storage"));
        let original = json!({
            "pens": [{ "id": "original-pen", "image": "pens/original.webp" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_test_storage(&paths, &original, &default_preferences());

        let backup = root.join("backup");
        fs::create_dir_all(&backup).unwrap();
        let incoming = json!({
            "pens": [{
                "id": "unsafe-pen",
                "images": [{ "url": "pens/../inks/escape.webp" }]
            }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_json(&backup.join("data.json"), &incoming).unwrap();
        write_json(&backup.join("preferences.json"), &default_preferences()).unwrap();
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        let error = import_backup_folder(&paths, &backup, None, Some(&revision))
            .err()
            .unwrap();

        assert!(error.to_string().contains("unsupported managed image path"));
        assert_eq!(read_json(&paths.data).unwrap(), original);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_import_rejects_referenced_media_when_images_directory_is_missing() {
        let root = test_root("missing-import-images-directory");
        let paths = StoragePaths::new(root.join("storage"));
        let original = default_collection_data();
        write_test_storage(&paths, &original, &default_preferences());
        let backup = root.join("backup");
        fs::create_dir_all(&backup).unwrap();
        let incoming = json!({
            "pens": [{ "id": "pen-1", "image": "pens/missing.webp" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_json(&backup.join("data.json"), &incoming).unwrap();
        write_json(&backup.join("preferences.json"), &default_preferences()).unwrap();
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        let error = import_backup_folder(&paths, &backup, None, Some(&revision))
            .err()
            .unwrap();

        assert!(error
            .to_string()
            .contains("missing its referenced images directory"));
        assert_eq!(read_json(&paths.data).unwrap(), original);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_import_rejects_one_missing_nested_alias_reference() {
        let root = test_root("missing-import-nested-alias");
        let paths = StoragePaths::new(root.join("storage"));
        let original = default_collection_data();
        write_test_storage(&paths, &original, &default_preferences());
        let backup = root.join("backup");
        fs::create_dir_all(backup.join("images/pens/nested")).unwrap();
        let incoming = json!({
            "pens": [{
                "id": "pen-1",
                "image_url": "pens/nested/present.webp",
                "images": [{ "url": "pens/nested/missing.webp" }]
            }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_json(&backup.join("data.json"), &incoming).unwrap();
        write_json(&backup.join("preferences.json"), &default_preferences()).unwrap();
        fs::write(
            backup.join("images/pens/nested/present.webp"),
            test_raster_bytes(ImageFormat::WebP, [10, 30, 50]),
        )
        .unwrap();
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        let error = import_backup_folder(&paths, &backup, None, Some(&revision))
            .err()
            .unwrap();

        assert!(error.to_string().contains("missing.webp"));
        assert_eq!(read_json(&paths.data).unwrap(), original);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_import_accepts_all_present_nested_alias_references() {
        let root = test_root("complete-import-nested-aliases");
        let paths = StoragePaths::new(root.join("storage"));
        write_test_storage(&paths, &default_collection_data(), &default_preferences());
        let backup = root.join("backup");
        fs::create_dir_all(backup.join("images/pens/nested")).unwrap();
        let incoming = json!({
            "pens": [{
                "id": "pen-1",
                "image_url": "pens/nested/direct.webp",
                "images": [{ "url": "pens/nested/gallery.webp" }]
            }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_json(&backup.join("data.json"), &incoming).unwrap();
        write_json(&backup.join("preferences.json"), &default_preferences()).unwrap();
        for (name, color) in [
            ("direct.webp", [20, 40, 60]),
            ("gallery.webp", [70, 90, 110]),
        ] {
            fs::write(
                backup.join("images/pens/nested").join(name),
                test_raster_bytes(ImageFormat::WebP, color),
            )
            .unwrap();
        }
        let (_, _, revision) = read_storage_state(&paths).unwrap();

        let result = import_backup_folder(&paths, &backup, None, Some(&revision)).unwrap();

        assert_eq!(result["success"], json!(true));
        assert_eq!(read_json(&paths.data).unwrap(), incoming);
        assert!(paths.images.join("pens/nested/direct.webp").is_file());
        assert!(paths.images.join("pens/nested/gallery.webp").is_file());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn save_rejects_invalid_missing_and_non_file_references_without_mutation() {
        let root = test_root("save-reference-validation");
        let paths = StoragePaths::new(root.join("storage"));
        let original_collection = default_collection_data();
        let mut original_preferences = default_preferences();
        original_preferences[STORAGE_REVISION_KEY] = json!("unchanged-token");
        write_test_storage(&paths, &original_collection, &original_preferences);
        fs::create_dir_all(paths.images.join("pens/not-a-file.webp")).unwrap();
        let before = read_storage_state(&paths).unwrap();

        for (label, reference, expected_error) in [
            (
                "malformed",
                "pens/../escape.webp",
                "unsupported managed image path",
            ),
            ("missing", "pens/missing.webp", "is missing"),
            ("directory", "pens/not-a-file.webp", "not a regular file"),
        ] {
            let data = json!({
                "pens": [{ "id": label, "image": reference }],
                "inks": [],
                "swatches": [],
                "currently_inked": [],
                "activity_log": [],
                "preferences": { "color_mode": "dark" }
            });

            let error = commit_save_data_state(&paths, &data).err().unwrap();

            assert!(
                error.to_string().contains(expected_error),
                "unexpected {label} error: {error}"
            );
            assert_eq!(read_storage_state(&paths).unwrap(), before);
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn save_rejects_reference_resolving_outside_images_without_mutation() {
        use std::os::unix::fs::symlink;

        let root = test_root("save-reference-containment");
        let paths = StoragePaths::new(root.join("storage"));
        let original_collection = default_collection_data();
        let mut original_preferences = default_preferences();
        original_preferences[STORAGE_REVISION_KEY] = json!("unchanged-token");
        write_test_storage(&paths, &original_collection, &original_preferences);
        let outside = root.join("outside");
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("escaped.webp"), b"not decoded during save").unwrap();
        symlink(&outside, paths.images.join("pens/linked")).unwrap();
        let before = read_storage_state(&paths).unwrap();
        let data = json!({
            "pens": [{ "id": "outside", "image": "pens/linked/escaped.webp" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": [],
            "preferences": { "color_mode": "dark" }
        });

        let error = commit_save_data_state(&paths, &data).err().unwrap();

        assert!(error.to_string().contains("symbolic link"));
        assert_eq!(read_storage_state(&paths).unwrap(), before);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn save_accepts_existing_managed_and_intentionally_ignored_references() {
        let root = test_root("save-valid-references");
        let paths = StoragePaths::new(root.join("storage"));
        let original_collection = default_collection_data();
        let mut original_preferences = default_preferences();
        original_preferences[STORAGE_REVISION_KEY] = json!("old-token");
        write_test_storage(&paths, &original_collection, &original_preferences);
        fs::write(
            paths.images.join("pens/valid.webp"),
            b"filesystem validation intentionally does not decode this file",
        )
        .unwrap();
        let (_, _, old_revision) = read_storage_state(&paths).unwrap();
        let data = json!({
            "pens": [{
                "id": "valid",
                "image": "pens/valid.webp",
                "image_url": "https://example.test/remote.webp",
                "url": "file:///tmp/external.webp",
                "images": [
                    "",
                    "default_pen.png",
                    "data:image/webp;base64,AAAA",
                    "blob:temporary",
                    "http://example.test/remote.webp",
                    { "path": "https://example.test/gallery.webp" },
                    { "image": "file:///tmp/gallery.webp" },
                    { "url": "data:image/png;base64,AAAA" }
                ]
            }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": [],
            "preferences": { "color_mode": "dark" }
        });

        let (collection, preferences, revision, warnings) =
            commit_save_data_state(&paths, &data).unwrap();
        let (stored_collection, stored_preferences, stored_revision) =
            read_storage_state(&paths).unwrap();

        assert!(warnings.is_empty());
        assert_eq!(stored_collection, collection);
        assert_eq!(stored_preferences, preferences);
        assert_eq!(stored_revision, revision);
        assert_ne!(stored_revision, old_revision);
        assert_eq!(stored_preferences["color_mode"], json!("dark"));
        assert!(stored_preferences[STORAGE_REVISION_KEY].as_str().is_some());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failed_collection_commit_restores_previous_storage_revision_token() {
        let root = test_root("revision-token-rollback");
        let paths = StoragePaths::new(root.join("storage"));
        let collection = default_collection_data();
        let mut old_preferences = default_preferences();
        old_preferences[STORAGE_REVISION_KEY] = json!("old-token");
        write_test_storage(&paths, &collection, &old_preferences);
        let (_, _, old_revision) = read_storage_state(&paths).unwrap();

        let stage = paths.root.join(".collection-save-stage-test");
        let rollback = paths.root.join(".collection-save-rollback-test");
        fs::create_dir_all(&stage).unwrap();
        let mut new_preferences = old_preferences.clone();
        new_preferences[STORAGE_REVISION_KEY] = json!("new-token");
        write_json(&stage.join("data.json"), &collection).unwrap();
        write_json(&stage.join("preferences.json"), &new_preferences).unwrap();
        let items = [
            StagedCommitItem {
                label: "data.json",
                staged: Some(stage.join("data.json")),
                target: paths.data.clone(),
            },
            StagedCommitItem {
                label: "preferences.json",
                staged: Some(stage.join("preferences.json")),
                target: paths.preferences.clone(),
            },
        ];

        let error = commit_staged_items_with(&items, &rollback, |index| {
            if index == 1 {
                Err(anyhow!("injected preference promotion failure"))
            } else {
                Ok(())
            }
        })
        .err()
        .unwrap();

        assert!(error
            .to_string()
            .contains("injected preference promotion failure"));
        let (_, restored_preferences, restored_revision) = read_storage_state(&paths).unwrap();
        assert_eq!(
            restored_preferences[STORAGE_REVISION_KEY],
            json!("old-token")
        );
        assert_eq!(restored_revision, old_revision);
        assert!(!rollback.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn selected_backup_paths_are_consumed_once() {
        let path = env::temp_dir().join(format!(
            "inkubator-selected-backup-{}.zip",
            Uuid::new_v4().simple()
        ));
        fs::write(&path, b"test").unwrap();
        let selected = Mutex::new(HashSet::from([path.clone()]));

        assert_eq!(
            take_selected_backup_path(&selected, path.to_string_lossy().as_ref()).unwrap(),
            path
        );
        assert!(take_selected_backup_path(&selected, path.to_string_lossy().as_ref()).is_err());

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn data_dir_override_ignores_empty_values() {
        assert_eq!(normalize_data_dir_override(None), None);
        assert_eq!(normalize_data_dir_override(Some("")), None);
        assert_eq!(normalize_data_dir_override(Some("   ")), None);
    }

    #[test]
    fn data_dir_override_accepts_trimmed_path() {
        assert_eq!(
            normalize_data_dir_override(Some(" /tmp/inkubator-desktop-dev ")),
            Some(PathBuf::from("/tmp/inkubator-desktop-dev"))
        );
    }

    #[test]
    fn managed_media_paths_are_confined_to_the_image_root() {
        let root = test_root("managed-media-paths");
        assert_eq!(
            resolve_managed_media_path(&root, "/images/.thumbs/pens/example.webp").unwrap(),
            root.join(".thumbs/pens/example.webp")
        );
        assert!(resolve_managed_media_path(&root, "/images/../data.json").is_err());
        assert!(resolve_managed_media_path(&root, "/other/example.webp").is_err());
        assert!(resolve_managed_media_path(&root, "/images/pens/example.txt").is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn managed_media_paths_reject_symlinked_parents_and_files() {
        use std::os::unix::fs::symlink;

        let root = test_root("managed-media-symlinks");
        let images = root.join("images");
        let linked_images = root.join("linked-images");
        let outside = root.join("outside");
        fs::create_dir_all(images.join("pens")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(images.join("pens/real.webp"), b"real-image").unwrap();
        fs::write(outside.join("secret.webp"), b"outside-secret").unwrap();
        symlink(&images, &linked_images).unwrap();
        symlink(&outside, images.join("pens/linked")).unwrap();
        symlink(outside.join("secret.webp"), images.join("pens/final.webp")).unwrap();
        symlink(
            outside.join("missing.webp"),
            images.join("pens/dangling.webp"),
        )
        .unwrap();

        for path in [
            "/images/pens/linked/secret.webp",
            "/images/pens/final.webp",
            "/images/pens/dangling.webp",
        ] {
            assert!(resolve_managed_media_path(&images, path).is_err(), "{path}");
        }
        assert!(resolve_managed_media_path(&linked_images, "/images/pens/real.webp").is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn preprocessed_heic_webp_detection_is_narrow() {
        assert!(is_preprocessed_heic_webp("/tmp/photo.HEIC.webp"));
        assert!(is_preprocessed_heic_webp(
            "https://example.test/photo.heif.webp"
        ));
        assert!(!is_preprocessed_heic_webp("/tmp/photo.webp"));
        assert!(!is_preprocessed_heic_webp("/tmp/photo.heic"));
    }

    #[test]
    fn preprocessed_heic_passthrough_requires_actual_webp_bytes() {
        let png = test_raster_bytes(ImageFormat::Png, [20, 40, 60]);
        let converted = process_image_to_webp_with_max(&png, "/tmp/photo.heic.webp", 1200).unwrap();
        assert!(has_raster_signature(&converted, "webp"));
        assert_ne!(converted, png);

        let webp = test_raster_bytes(ImageFormat::WebP, [70, 90, 110]);
        let passed_through =
            process_image_to_webp_with_max(&webp, "/tmp/photo.heic.webp", 1200).unwrap();
        assert_eq!(passed_through, webp);
    }

    #[test]
    fn failed_thumbnail_write_removes_full_image_and_partial_thumbnail() {
        let root = test_root("failed-thumbnail-cleanup");
        let image = root.join("images/pens/example.webp");
        let thumbnail = root.join("images/.thumbs/pens/example.webp");
        fs::create_dir_all(image.parent().unwrap()).unwrap();
        fs::create_dir_all(thumbnail.parent().unwrap()).unwrap();

        let result = write_image_with_thumbnail(&image, &thumbnail, b"full image", || {
            fs::write(&thumbnail, b"partial thumbnail")?;
            Err(anyhow!("injected thumbnail failure"))
        });

        assert!(result
            .unwrap_err()
            .to_string()
            .contains("injected thumbnail failure"));
        assert!(!image.exists());
        assert!(!thumbnail.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn synced_file_and_staged_tree_writes_are_readable() {
        let root = test_root("synced-staged-tree");
        let first = root.join("images/pens/first.webp");
        let second = root.join("images/swatches/second.webp");
        fs::create_dir_all(first.parent().unwrap()).unwrap();
        fs::create_dir_all(second.parent().unwrap()).unwrap();

        write_file_synced(&first, b"first-image").unwrap();
        fs::write(&second, b"second-image").unwrap();
        sync_tree_files(&root).unwrap();

        assert_eq!(fs::read(first).unwrap(), b"first-image");
        assert_eq!(fs::read(second).unwrap(), b"second-image");
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn staged_tree_sync_accepts_read_only_media_files() {
        use std::os::unix::fs::PermissionsExt;

        let root = test_root("read-only-staged-tree");
        let image = root.join("images/pens/read-only.webp");
        fs::create_dir_all(image.parent().unwrap()).unwrap();
        fs::write(&image, b"read-only-image").unwrap();
        fs::set_permissions(&image, fs::Permissions::from_mode(0o444)).unwrap();

        sync_tree_files(&root).unwrap();

        assert_eq!(fs::read(&image).unwrap(), b"read-only-image");
        fs::set_permissions(&image, fs::Permissions::from_mode(0o644)).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn synced_managed_image_creation_never_overwrites_an_existing_file() {
        let root = test_root("exclusive-image-create");
        let image = root.join("images/pens/existing.webp");
        fs::create_dir_all(image.parent().unwrap()).unwrap();
        fs::write(&image, b"existing-image").unwrap();

        let error = write_file_synced(&image, b"replacement-image")
            .err()
            .unwrap();

        assert!(error.to_string().contains("exclusively create"));
        assert_eq!(fs::read(&image).unwrap(), b"existing-image");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn metadata_filename_stems_are_bounded_ascii_and_deterministic() {
        let long = "Very Long Metadata Value ".repeat(40);
        let metadata = json!({
            "brand": long,
            "model": "Model".repeat(100),
            "nib": "Extra Fine".repeat(100),
            "color": "Blue".repeat(100)
        });
        let stems = [
            pen_filename_stem(&metadata),
            ink_filename_stem(&metadata),
            swatch_filename_stem(&metadata),
        ];

        for stem in &stems {
            assert_eq!(stem.len(), MAX_METADATA_FILENAME_STEM_LEN);
            assert!(stem.is_ascii());
        }
        assert_eq!(pen_filename_stem(&metadata), stems[0]);
        assert_ne!(
            pen_filename_stem(&metadata),
            pen_filename_stem(&json!({
                "brand": metadata["brand"],
                "model": metadata["model"],
                "nib": metadata["nib"],
                "color": format!("{}x", metadata["color"].as_str().unwrap())
            }))
        );
    }

    #[test]
    fn image_saves_with_long_metadata_use_filesystem_safe_names() {
        let root = test_root("long-metadata-image-save");
        let storage = root.join("storage");
        let raster = test_raster_bytes(ImageFormat::Png, [10, 20, 30]);
        let metadata = json!({
            "brand": "Very Long Brand ".repeat(80),
            "model": "Very Long Model ".repeat(80),
            "nib": "Extra Fine ".repeat(80),
            "color": "Blue Green ".repeat(80)
        });

        for image_type in ["pen", "ink", "swatch"] {
            let relative = save_processed_image_for_storage_root(
                &storage,
                &raster,
                "source.png",
                image_type,
                &metadata,
            )
            .unwrap();
            let filename = Path::new(&relative)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap();
            assert!(filename.len() < 255, "{image_type}: {filename}");
            assert!(storage.join("images").join(&relative).is_file());
            assert!(storage.join("images/.thumbs").join(&relative).is_file());
        }

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn thumbnail_entries_including_dangling_links_reserve_image_filenames() {
        use std::os::unix::fs::symlink;

        let root = test_root("thumbnail-filename-collision");
        let image_dir = root.join("images/pens");
        let thumbnail_dir = root.join("images/.thumbs/pens");
        fs::create_dir_all(&image_dir).unwrap();
        fs::create_dir_all(&thumbnail_dir).unwrap();
        let collision = thumbnail_dir.join("example-1.webp");
        symlink(root.join("missing-thumbnail"), &collision).unwrap();

        let filename = next_numbered_filename(&image_dir, &thumbnail_dir, "example").unwrap();

        assert_eq!(filename, "example-2.webp");
        assert!(fs::symlink_metadata(collision)
            .unwrap()
            .file_type()
            .is_symlink());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn image_saves_reject_symlinked_managed_roots_and_sections() {
        use std::os::unix::fs::symlink;

        let raster = test_raster_bytes(ImageFormat::Png, [10, 20, 30]);
        for case in ["images", "section", "thumbnail-section"] {
            let root = test_root(&format!("symlinked-save-{case}"));
            let storage = root.join("storage");
            let outside = root.join("outside");
            fs::create_dir_all(&storage).unwrap();
            fs::create_dir_all(&outside).unwrap();
            fs::write(outside.join("sentinel"), b"unchanged").unwrap();
            match case {
                "images" => symlink(&outside, storage.join("images")).unwrap(),
                "section" => {
                    fs::create_dir_all(storage.join("images")).unwrap();
                    symlink(&outside, storage.join("images/pens")).unwrap();
                }
                _ => {
                    fs::create_dir_all(storage.join("images/pens")).unwrap();
                    fs::create_dir_all(storage.join("images/.thumbs")).unwrap();
                    symlink(&outside, storage.join("images/.thumbs/pens")).unwrap();
                }
            }

            let error = save_processed_image_for_storage_root(
                &storage,
                &raster,
                "source.png",
                "pen",
                &json!({ "brand": "Outside", "model": "Guard" }),
            )
            .unwrap_err();

            assert!(error.to_string().contains("not a real directory"));
            assert_eq!(fs::read(outside.join("sentinel")).unwrap(), b"unchanged");
            assert_eq!(fs::read_dir(&outside).unwrap().count(), 1);
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[cfg(unix)]
    #[test]
    fn backup_storage_rejects_symlinked_fixed_directories() {
        use std::os::unix::fs::symlink;

        for linked_component in ["backups", "auto", "manual"] {
            let root = test_root(&format!("symlinked-backup-{linked_component}"));
            let storage = root.join("storage");
            let outside = root.join("outside");
            fs::create_dir_all(&storage).unwrap();
            fs::create_dir_all(&outside).unwrap();
            fs::write(outside.join("sentinel"), b"unchanged").unwrap();
            if linked_component == "backups" {
                symlink(&outside, storage.join("backups")).unwrap();
            } else {
                fs::create_dir(storage.join("backups")).unwrap();
                symlink(&outside, storage.join("backups").join(linked_component)).unwrap();
            }

            assert!(ensure_backup_storage_tree(&storage).is_err());
            assert_eq!(fs::read(outside.join("sentinel")).unwrap(), b"unchanged");
            assert_eq!(fs::read_dir(&outside).unwrap().count(), 1);
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[cfg(unix)]
    #[test]
    fn thumbnail_write_rejects_final_symlink_without_changing_target() {
        use std::os::unix::fs::symlink;

        let root = test_root("thumbnail-final-symlink");
        let storage = root.join("storage");
        let outside = root.join("outside.webp");
        fs::create_dir_all(&storage).unwrap();
        ensure_managed_storage_tree(&storage).unwrap();
        fs::write(&outside, b"outside-unchanged").unwrap();
        let thumbnail = storage.join("images/.thumbs/pens/example.webp");
        symlink(&outside, &thumbnail).unwrap();
        let raster = test_raster_bytes(ImageFormat::Png, [10, 20, 30]);

        assert!(write_thumbnail_for_storage_root(
            &storage,
            "pens/example.webp",
            &raster,
            "source.png"
        )
        .is_err());

        assert_eq!(fs::read(&outside).unwrap(), b"outside-unchanged");
        assert!(fs::symlink_metadata(&thumbnail)
            .unwrap()
            .file_type()
            .is_symlink());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn referenced_image_cleanup_preserves_full_image_and_thumbnail_for_all_aliases() {
        let root = test_root("referenced-image-cleanup");
        let paths = StoragePaths::new(root.join("storage"));
        let referenced = [
            "pens/direct.webp",
            "pens/direct-image-url.webp",
            "pens/direct-url.webp",
            "pens/gallery-string.webp",
            "pens/gallery-path.webp",
            "pens/gallery-image.webp",
            "pens/gallery-url.webp",
            "swatches/legacy-ink-swatch.webp",
        ];
        let collection = json!({
            "pens": [{
                "id": "pen-1",
                "image": "pens/direct.webp",
                "image_url": "pens/direct-image-url.webp",
                "url": "pens/direct-url.webp",
                "images": [
                    "pens/gallery-string.webp",
                    { "path": "pens/gallery-path.webp" },
                    { "image": "pens/gallery-image.webp" },
                    {
                        "path": "pens/some-other-image.webp",
                        "url": "pens/gallery-url.webp"
                    }
                ]
            }],
            "inks": [{
                "id": "ink-1",
                "image": "swatches/legacy-ink-swatch.webp"
            }],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_test_storage(
            &paths,
            &collection,
            &json!({
                "backup": { "keep_replaced_images": true }
            }),
        );
        fs::create_dir_all(paths.images.join(".thumbs/pens")).unwrap();
        fs::create_dir_all(paths.images.join(".thumbs/swatches")).unwrap();
        for relative in referenced {
            let image = paths.images.join(relative);
            let thumbnail = paths.images.join(".thumbs").join(relative);
            fs::write(&image, b"full-image").unwrap();
            fs::write(&thumbnail, b"thumbnail").unwrap();

            let delete_result =
                delete_managed_image_unless_referenced(&paths, &format!("images/{relative}"))
                    .unwrap();
            let result = dispose_managed_image_unless_referenced(&paths, relative).unwrap();

            assert_eq!(delete_result["action"], json!("referenced"));
            assert_eq!(result["action"], json!("referenced"));
            assert_eq!(fs::read(&image).unwrap(), b"full-image");
            assert_eq!(fs::read(&thumbnail).unwrap(), b"thumbnail");
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn managed_image_cleanup_rejects_noncanonical_paths_without_touching_live_media() {
        assert_eq!(
            normalize_managed_relative_image_path("images/pens/safe.webp").as_deref(),
            Some("pens/safe.webp")
        );
        assert_eq!(
            normalize_managed_relative_image_path("pens/nested/album/safe.webp").as_deref(),
            Some("pens/nested/album/safe.webp")
        );
        for invalid in [
            "./pens/safe.webp",
            "/pens/safe.webp",
            "pens/../inks/live.webp",
            "pens/./safe.webp",
            "pens\\safe.webp",
            "pens//safe.webp",
            "pens/safe.webp?download=1",
            "pens/safe.webp#fragment",
            "pens/safe.webp\n",
            "other/safe.webp",
            "pens/no-extension",
        ] {
            assert!(
                normalize_managed_relative_image_path(invalid).is_none(),
                "accepted {invalid:?}"
            );
        }

        let root = test_root("noncanonical-image-cleanup");
        let paths = StoragePaths::new(root.join("storage"));
        let collection = json!({
            "pens": [],
            "inks": [{ "id": "ink-1", "image": "images/inks/live.webp" }],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        write_test_storage(&paths, &collection, &default_preferences());
        let image = paths.images.join("inks/live.webp");
        let thumbnail = paths.images.join(".thumbs/inks/live.webp");
        fs::create_dir_all(thumbnail.parent().unwrap()).unwrap();
        fs::write(&image, b"live-image").unwrap();
        fs::write(&thumbnail, b"live-thumbnail").unwrap();

        assert!(collection_references_managed_image(
            &collection,
            "inks/live.webp"
        ));
        assert!(delete_managed_image_unless_referenced(&paths, "pens/../inks/live.webp").is_err());
        assert!(dispose_managed_image_unless_referenced(&paths, "pens/../inks/live.webp").is_err());
        assert_eq!(fs::read(image).unwrap(), b"live-image");
        assert_eq!(fs::read(thumbnail).unwrap(), b"live-thumbnail");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn image_cleanup_reports_thumbnail_failures_before_removing_or_archiving_originals() {
        let root = test_root("thumbnail-cleanup-errors");
        let paths = StoragePaths::new(root.join("storage"));
        write_test_storage(
            &paths,
            &default_collection_data(),
            &json!({ "backup": { "keep_replaced_images": true } }),
        );
        fs::create_dir_all(paths.images.join(".thumbs/pens")).unwrap();

        let delete_image = paths.images.join("pens/delete.webp");
        let delete_thumbnail = paths.images.join(".thumbs/pens/delete.webp");
        fs::write(&delete_image, b"delete-image").unwrap();
        fs::create_dir(&delete_thumbnail).unwrap();
        let delete_error = delete_managed_image_unless_referenced(&paths, "pens/delete.webp")
            .err()
            .unwrap();
        assert!(delete_error
            .to_string()
            .contains("thumbnail target is not a regular file"));
        assert_eq!(fs::read(&delete_image).unwrap(), b"delete-image");

        let missing_thumbnail = paths.images.join(".thumbs/pens/missing.webp");
        fs::create_dir(&missing_thumbnail).unwrap();
        let missing_error = dispose_managed_image_unless_referenced(&paths, "pens/missing.webp")
            .err()
            .unwrap();
        assert!(missing_error
            .to_string()
            .contains("thumbnail target is not a regular file"));

        let archive_image = paths.images.join("pens/archive.webp");
        let archive_thumbnail = paths.images.join(".thumbs/pens/archive.webp");
        fs::write(&archive_image, b"archive-image").unwrap();
        fs::create_dir(&archive_thumbnail).unwrap();
        let archive_error = dispose_managed_image_unless_referenced(&paths, "pens/archive.webp")
            .err()
            .unwrap();
        assert!(archive_error
            .to_string()
            .contains("thumbnail target is not a regular file"));
        assert_eq!(fs::read(&archive_image).unwrap(), b"archive-image");
        assert!(!paths.replaced_images.join("pens/archive.webp").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn unreferenced_image_cleanup_removes_full_image_and_thumbnail() {
        let root = test_root("unreferenced-image-cleanup");
        let paths = StoragePaths::new(root.join("storage"));
        write_test_storage(&paths, &default_collection_data(), &default_preferences());
        let image = paths.images.join("pens/unreferenced.webp");
        let thumbnail = paths.images.join(".thumbs/pens/unreferenced.webp");
        fs::create_dir_all(thumbnail.parent().unwrap()).unwrap();
        fs::write(&image, b"full-image").unwrap();
        fs::write(&thumbnail, b"thumbnail").unwrap();

        let result =
            delete_managed_image_unless_referenced(&paths, "pens/unreferenced.webp").unwrap();

        assert_eq!(result["action"], json!("deleted"));
        assert_eq!(result["relativePath"], json!("pens/unreferenced.webp"));
        assert!(!image.exists());
        assert!(!thumbnail.exists());
        let missing =
            delete_managed_image_unless_referenced(&paths, "pens/already-missing.webp").unwrap();
        assert_eq!(missing["action"], json!("missing"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn dispose_image_reports_deleted_missing_and_archived_paths() {
        let root = test_root("dispose-image-actions");
        let paths = StoragePaths::new(root.join("storage"));
        write_test_storage(&paths, &default_collection_data(), &default_preferences());
        fs::create_dir_all(paths.images.join(".thumbs/pens/nested")).unwrap();

        fs::write(paths.images.join("pens/deleted.webp"), b"deleted").unwrap();
        fs::write(paths.images.join(".thumbs/pens/deleted.webp"), b"thumbnail").unwrap();
        let deleted = dispose_managed_image_unless_referenced(&paths, "pens/deleted.webp").unwrap();
        assert_eq!(deleted["action"], json!("deleted"));

        let missing = dispose_managed_image_unless_referenced(&paths, "pens/missing.webp").unwrap();
        assert_eq!(missing["action"], json!("missing"));

        write_json(
            &paths.preferences,
            &json!({ "backup": { "keep_replaced_images": true } }),
        )
        .unwrap();
        fs::create_dir_all(paths.images.join("pens/nested")).unwrap();
        fs::create_dir_all(paths.replaced_images.join("pens/nested")).unwrap();
        fs::write(paths.images.join("pens/nested/archived.webp"), b"archived").unwrap();
        fs::write(
            paths.images.join(".thumbs/pens/nested/archived.webp"),
            b"thumbnail",
        )
        .unwrap();
        fs::write(
            paths.replaced_images.join("pens/nested/archived.webp"),
            b"existing",
        )
        .unwrap();

        let archived =
            dispose_managed_image_unless_referenced(&paths, "pens/nested/archived.webp").unwrap();
        assert_eq!(archived["action"], json!("archived"));
        assert_eq!(
            archived["archivedRelativePath"],
            json!("pens/nested/archived-2.webp")
        );
        assert_eq!(
            fs::read(paths.replaced_images.join("pens/nested/archived-2.webp")).unwrap(),
            b"archived"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn managed_image_cleanup_rejects_dangling_entries_without_removing_them() {
        use std::os::unix::fs::symlink;

        let root = test_root("dangling-managed-images");
        let paths = StoragePaths::new(root.join("storage"));
        write_test_storage(&paths, &default_collection_data(), &default_preferences());
        fs::create_dir_all(paths.images.join(".thumbs/pens")).unwrap();
        let deleted_link = paths.images.join("pens/deleted.webp");
        let disposed_link = paths.images.join("pens/disposed.webp");
        symlink(paths.images.join("pens/no-target.webp"), &deleted_link).unwrap();
        symlink(paths.images.join("pens/no-target.webp"), &disposed_link).unwrap();

        let deleted =
            delete_managed_image_unless_referenced(&paths, "pens/deleted.webp").unwrap_err();
        let disposed =
            dispose_managed_image_unless_referenced(&paths, "pens/disposed.webp").unwrap_err();

        assert!(deleted.to_string().contains("symbolic link"));
        assert!(disposed.to_string().contains("symbolic link"));
        assert!(path_exists_without_following(&deleted_link).unwrap());
        assert!(path_exists_without_following(&disposed_link).unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn managed_image_cleanup_and_archive_reject_symlinked_directories() {
        use std::os::unix::fs::symlink;

        let root = test_root("symlinked-managed-cleanup");
        let paths = StoragePaths::new(root.join("storage"));
        fs::create_dir_all(paths.images.join("inks")).unwrap();
        fs::create_dir_all(paths.images.join("swatches")).unwrap();
        let outside = root.join("outside");
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("victim.webp"), b"outside-unchanged").unwrap();
        symlink(&outside, paths.images.join("pens")).unwrap();
        write_json(&paths.data, &default_collection_data()).unwrap();
        write_json(
            &paths.preferences,
            &json!({ "backup": { "keep_replaced_images": true } }),
        )
        .unwrap();

        assert!(delete_managed_image_unless_referenced(&paths, "pens/victim.webp").is_err());
        assert!(dispose_managed_image_unless_referenced(&paths, "pens/victim.webp").is_err());
        assert_eq!(
            fs::read(outside.join("victim.webp")).unwrap(),
            b"outside-unchanged"
        );

        fs::remove_file(paths.images.join("pens")).unwrap();
        fs::create_dir_all(paths.images.join("pens")).unwrap();
        fs::write(paths.images.join("pens/archive.webp"), b"managed").unwrap();
        fs::create_dir_all(paths.images.join(".thumbs/pens")).unwrap();
        fs::write(
            paths.images.join(".thumbs/pens/archive.webp"),
            b"managed-thumbnail",
        )
        .unwrap();
        symlink(&outside, &paths.replaced_images).unwrap();
        assert!(dispose_managed_image_unless_referenced(&paths, "pens/archive.webp").is_err());
        assert_eq!(
            fs::read(paths.images.join("pens/archive.webp")).unwrap(),
            b"managed"
        );
        assert_eq!(
            fs::read(paths.images.join(".thumbs/pens/archive.webp")).unwrap(),
            b"managed-thumbnail"
        );
        assert_eq!(fs::read_dir(&outside).unwrap().count(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn retention_off_cleanup_removes_full_image_and_thumbnail() {
        let root = test_root("retention-off-cleanup");
        let image = root.join("images/pens/example.webp");
        let thumbnail = root.join("images/.thumbs/pens/example.webp");
        fs::create_dir_all(image.parent().unwrap()).unwrap();
        fs::create_dir_all(thumbnail.parent().unwrap()).unwrap();
        fs::write(&image, b"full image").unwrap();
        fs::write(&thumbnail, b"thumbnail").unwrap();

        remove_image_artifacts(&image, &thumbnail).unwrap();

        assert!(!image.exists());
        assert!(!thumbnail.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn merge_collection_data_skip_preserves_existing_conflicts() {
        let existing = json!({
            "pens": [
                { "id": "pen-1", "brand": "Existing", "image": "pens/existing.webp" }
            ],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        let incoming = json!({
            "pens": [
                { "id": "pen-1", "brand": "Incoming", "image": "pens/incoming.webp" },
                { "id": "pen-2", "brand": "New" }
            ],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });

        let merged = merge_collection_data(&existing, &incoming, "skip");
        let pens = merged.get("pens").and_then(Value::as_array).unwrap();

        assert_eq!(pens.len(), 2);
        assert_eq!(
            pens[0].get("brand").and_then(Value::as_str),
            Some("Existing")
        );
        assert_eq!(pens[1].get("id").and_then(Value::as_str), Some("pen-2"));
    }

    #[test]
    fn merge_collection_data_merge_combines_existing_and_incoming_fields() {
        let existing = json!({
            "pens": [
                { "id": "pen-1", "brand": "Existing", "nib": "M", "image": "pens/existing.webp" }
            ],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });
        let incoming = json!({
            "pens": [
                { "id": "pen-1", "brand": "Incoming", "color": "Black" }
            ],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": []
        });

        let merged = merge_collection_data(&existing, &incoming, "merge");
        let pen = &merged.get("pens").and_then(Value::as_array).unwrap()[0];

        assert_eq!(pen.get("brand").and_then(Value::as_str), Some("Incoming"));
        assert_eq!(pen.get("nib").and_then(Value::as_str), Some("M"));
        assert_eq!(pen.get("color").and_then(Value::as_str), Some("Black"));
    }

    #[test]
    fn merge_collection_data_dedupes_currently_inked_by_pen() {
        let existing = json!({
            "pens": [],
            "inks": [],
            "swatches": [],
            "currently_inked": [
                { "id": "entry-1", "pen_id": "pen-1", "ink_id": "ink-old" }
            ],
            "activity_log": []
        });
        let incoming = json!({
            "pens": [],
            "inks": [],
            "swatches": [],
            "currently_inked": [
                { "id": "entry-2", "pen_id": "pen-1", "ink_id": "ink-new" }
            ],
            "activity_log": []
        });

        let merged = merge_collection_data(&existing, &incoming, "merge");
        let currently_inked = merged
            .get("currently_inked")
            .and_then(Value::as_array)
            .unwrap();

        assert_eq!(currently_inked.len(), 1);
        assert_eq!(
            currently_inked[0].get("ink_id").and_then(Value::as_str),
            Some("ink-new")
        );
    }

    #[test]
    fn public_showcase_projection_rebuilds_only_context_correct_managed_images() {
        let collection = json!({
            "pens": [{
                "id": "pen-public",
                "image": "inks/wrong-folder.webp",
                "image_url": "https://tracker.test/pen-alias.webp",
                "url": "https://tracker.test/pen-url.webp",
                "images": [
                    {
                        "id": "SECRET_IMAGE_ID",
                        "path": "images/pens/safe.webp",
                        "rotation": 90,
                        "primary": true,
                        "private_marker": "SECRET_IMAGE_METADATA"
                    },
                    { "path": "pens/nested/visible.webp" },
                    { "url": "pens/nested/url-only.webp" },
                    { "path": "pens/../inks/rejected.webp" },
                    { "path": "https://example.test/rejected.webp" },
                    { "path": "pens/rejected.svg" }
                ]
            }],
            "inks": [{
                "id": "ink-public",
                "image": "images/inks/safe.png",
                "image_url": "https://tracker.test/ink-alias.webp",
                "url": "https://tracker.test/ink-url.webp",
                "images": [
                    { "path": "swatches/wrong-folder.webp", "primary": true },
                    { "path": "inks/safe.png" }
                ]
            }],
            "swatches": [{
                "id": "swatch-public",
                "ink_id": "ink-public",
                "image": "swatches/safe.avif",
                "image_url": "https://tracker.test/swatch-alias.webp",
                "url": "https://tracker.test/swatch-url.webp",
                "images": [
                    { "path": "swatches/safe.avif", "primary": true },
                    { "path": "swatches/rejected.heic" }
                ]
            }],
            "currently_inked": [],
            "activity_log": []
        });
        let preferences = json!({
            "showcase": {
                "show_pens": true,
                "show_inks": true,
                "show_swatches": true
            }
        });

        let public = build_public_showcase_data(&collection, &preferences);

        assert_eq!(public["pens"][0]["image"], json!("pens/safe.webp"));
        assert_eq!(
            public["pens"][0]["images"],
            json!([
                {
                    "id": "public_image_1",
                    "path": "pens/safe.webp",
                    "rotation": 90,
                    "primary": true
                },
                {
                    "id": "public_image_2",
                    "path": "pens/nested/visible.webp",
                    "rotation": 0,
                    "primary": false
                },
                {
                    "id": "public_image_3",
                    "path": "pens/nested/url-only.webp",
                    "rotation": 0,
                    "primary": false
                }
            ])
        );
        assert_eq!(public["inks"][0]["image"], json!("inks/safe.png"));
        assert_eq!(
            public["inks"][0]["images"],
            json!([{
                "id": "public_image_1",
                "path": "inks/safe.png",
                "rotation": 0,
                "primary": true
            }])
        );
        assert_eq!(
            public["swatches"][0]["images"],
            json!([{
                "id": "public_image_1",
                "path": "swatches/safe.avif",
                "rotation": 0,
                "primary": true
            }])
        );
        for section in ["pens", "inks", "swatches"] {
            assert!(public[section][0].get("image_url").is_none());
            assert!(public[section][0].get("url").is_none());
        }
        let serialized = serde_json::to_string(&public).unwrap();
        for rejected in [
            "SECRET_IMAGE_ID",
            "SECRET_IMAGE_METADATA",
            "wrong-folder",
            "../",
            "https://",
            "tracker.test",
            ".svg",
            ".heic",
        ] {
            assert!(!serialized.contains(rejected), "leaked {rejected}");
        }
        assert_eq!(
            collect_referenced_images(&public),
            vec![
                "inks/safe.png".to_string(),
                "pens/nested/url-only.webp".to_string(),
                "pens/nested/visible.webp".to_string(),
                "pens/safe.webp".to_string(),
                "swatches/safe.avif".to_string()
            ]
        );
    }

    #[test]
    fn public_showcase_projection_moves_primary_image_first() {
        let mut item = json!({
            "image": "pens/third.webp",
            "images": [
                { "path": "pens/first.webp", "primary": false },
                { "path": "pens/second.webp", "primary": false },
                { "path": "pens/third.webp", "rotation": 90, "primary": true }
            ]
        })
        .as_object()
        .unwrap()
        .clone();

        sanitize_public_image_fields(&mut item, "pens");

        assert_eq!(
            item["images"],
            json!([
                {
                    "id": "public_image_1",
                    "path": "pens/third.webp",
                    "rotation": 90,
                    "primary": true
                },
                {
                    "id": "public_image_2",
                    "path": "pens/first.webp",
                    "rotation": 0,
                    "primary": false
                },
                {
                    "id": "public_image_3",
                    "path": "pens/second.webp",
                    "rotation": 0,
                    "primary": false
                }
            ])
        );
    }

    #[test]
    fn public_showcase_projection_strips_prices_private_preferences_and_activity_payloads() {
        let collection = json!({
            "pens": [{
                "id": "pen-public",
                "brand": "Public Pen",
                "price": "987654.32",
                "notes": "PUBLIC_PEN_NOTE",
                "image": "pens/public-pen.webp"
            }],
            "inks": [{
                "id": "ink-public",
                "name": "Public Ink",
                "price": "876543.21",
                "notes": "PUBLIC_INK_NOTE",
                "image": "inks/public-ink.webp"
            }],
            "swatches": [{
                "id": "swatch-public",
                "ink_id": "ink-public",
                "swatch_notes": "PUBLIC_SWATCH_NOTE",
                "image": "swatches/public-swatch.webp"
            }],
            "currently_inked": [{
                "id": "SECRET_RELATIONSHIP_ID",
                "pen_id": "pen-public",
                "ink_id": "ink-public",
                "date_inked": 1700000123456_i64,
                "private_note": "SECRET_RELATIONSHIP_PRIVATE_FIELD"
            }],
            "activity_log": [{
                "id": "SECRET_STORED_ACTIVITY_ID",
                "timestamp": 1700000123456_i64,
                "action": "updated",
                "category": "pen",
                "message": "SECRET_ACTIVITY_MESSAGE price 987654.32",
                "entity_id": "pen-public",
                "metadata": {
                    "private_marker": "SECRET_ACTIVITY_METADATA",
                    "previous_ink_name": "SECRET_PREVIOUS_INK"
                }
            }, {
                "id": "SECRET_STORED_SYSTEM_ACTIVITY_ID",
                "timestamp": 1700000123000_i64,
                "action": "SECRET_ACTION",
                "category": "SECRET_CATEGORY",
                "message": "SECRET_SYSTEM_MESSAGE",
                "entity_id": "pen-public",
                "metadata": { "private_marker": "SECRET_SYSTEM_METADATA" }
            }]
        });
        let preferences = json!({
            "show_activity_log": true,
            "show_recent_activity": true,
            "activity_log_verbosity": "detailed",
            "open_cards_in_edit_mode": false,
            "confirm_destructive_actions": false,
            "activity_retention_days": 137,
            "defaults": {
                "currency": "EUR",
                "date_format": "iso",
                "pen_nib": "SECRET_DEFAULT_NIB"
            },
            "backup": {
                "retention_count": 137,
                "keep_replaced_images": true,
                "private_marker": "SECRET_BACKUP_PREF"
            },
            "import_export": {
                "conflict_behavior": "SECRET_IMPORT_PREF"
            },
            "activity_log_filters": {
                "private_marker": "SECRET_LOGGING_PREF"
            },
            "showcase": {
                "title": "Public Showcase",
                "color_mode": "light",
                "show_prices": false,
                "show_pens": true,
                "show_inks": true,
                "show_swatches": true,
                "show_activity_filters": true,
                "default_sort": {
                    "pens": "brand-asc",
                    "inks": "name-asc",
                    "swatches": "oldest"
                },
                "show_insights": true,
                "show_charts": true
            }
        });
        let original_collection = collection.clone();
        let original_preferences = preferences.clone();

        let public = build_public_showcase_data(&collection, &preferences);

        assert_eq!(collection, original_collection);
        assert_eq!(preferences, original_preferences);
        assert!(public["pens"][0].get("price").is_none());
        assert!(public["inks"][0].get("price").is_none());
        assert_eq!(
            public["currently_inked"],
            json!([{
                "id": "public_inked_1",
                "pen_id": "pen-public",
                "ink_id": "ink-public",
                "date_inked": 1700000123456_i64
            }])
        );
        assert!(public["preferences"].get("backup").is_none());
        assert!(public["preferences"].get("import_export").is_none());
        assert!(public["preferences"]
            .get("open_cards_in_edit_mode")
            .is_none());
        assert!(public["preferences"]["defaults"].get("pen_nib").is_none());
        assert_eq!(
            public["preferences"]["defaults"]["date_format"].as_str(),
            Some("iso")
        );
        assert!(public["preferences"]["defaults"].get("currency").is_none());

        let activity = public["activity_log"].as_array().unwrap();
        assert_eq!(activity.len(), 2);
        assert_eq!(activity[0]["id"].as_str(), Some("public_activity_1"));
        assert_eq!(activity[0]["message"].as_str(), Some("pen: updated"));
        assert_eq!(activity[0]["entity_id"].as_str(), Some("pen-public"));
        assert_eq!(activity[0]["metadata"], json!({}));
        assert_eq!(activity[1]["id"].as_str(), Some("public_activity_2"));
        assert_eq!(activity[1]["category"].as_str(), Some("system"));
        assert_eq!(activity[1]["action"].as_str(), Some("updated"));
        assert_eq!(activity[1]["message"].as_str(), Some("system: updated"));
        assert_eq!(activity[1]["entity_id"].as_str(), Some(""));

        let serialized = serde_json::to_string(&public).unwrap();
        for sentinel in [
            "987654.32",
            "876543.21",
            "SECRET_ACTIVITY_MESSAGE",
            "SECRET_ACTIVITY_METADATA",
            "SECRET_PREVIOUS_INK",
            "SECRET_ACTION",
            "SECRET_CATEGORY",
            "SECRET_SYSTEM_MESSAGE",
            "SECRET_SYSTEM_METADATA",
            "SECRET_DEFAULT_NIB",
            "SECRET_BACKUP_PREF",
            "SECRET_IMPORT_PREF",
            "SECRET_LOGGING_PREF",
            "SECRET_RELATIONSHIP_ID",
            "SECRET_RELATIONSHIP_PRIVATE_FIELD",
            "SECRET_STORED_ACTIVITY_ID",
            "SECRET_STORED_SYSTEM_ACTIVITY_ID",
        ] {
            assert!(!serialized.contains(sentinel), "leaked {sentinel}");
        }
        assert_eq!(
            collect_referenced_images(&public),
            vec![
                "inks/public-ink.webp".to_string(),
                "pens/public-pen.webp".to_string(),
                "swatches/public-swatch.webp".to_string()
            ]
        );
    }

    #[test]
    fn public_showcase_projection_retains_currency_when_prices_are_visible() {
        let collection = json!({
            "pens": [{
                "id": "pen-public",
                "price": "150"
            }],
            "inks": [{
                "id": "ink-public",
                "price": "24.50"
            }]
        });
        let preferences = json!({
            "defaults": {
                "currency": "EUR"
            },
            "showcase": {
                "show_prices": true
            }
        });

        let public = build_public_showcase_data(&collection, &preferences);

        assert_eq!(
            public["preferences"]["defaults"]["currency"].as_str(),
            Some("EUR")
        );
        assert_eq!(public["pens"][0]["price"].as_str(), Some("150"));
        assert_eq!(public["inks"][0]["price"].as_str(), Some("24.50"));
    }

    #[test]
    fn public_showcase_projection_omits_hidden_ink_dependencies_and_media() {
        let collection = json!({
            "pens": [{
                "id": "pen-visible",
                "brand": "Visible Pen",
                "image": "pens/visible-pen.webp"
            }],
            "inks": [{
                "id": "ink-secret",
                "name": "SECRET_INK_NAME",
                "image": "inks/secret-ink.webp"
            }],
            "swatches": [{
                "id": "swatch-secret",
                "ink_id": "ink-secret",
                "swatch_notes": "SECRET_SWATCH_NOTE",
                "image": "swatches/secret-swatch.webp"
            }],
            "currently_inked": [{
                "id": "pair-secret",
                "pen_id": "pen-visible",
                "ink_id": "ink-secret",
                "date_inked": 1700000123456_i64
            }],
            "activity_log": [{
                "id": "pen-created",
                "timestamp": 40,
                "action": "created",
                "category": "pen",
                "message": "Created visible pen",
                "entity_id": "pen-visible",
                "metadata": {}
            }, {
                "id": "pen-inked",
                "timestamp": 30,
                "action": "inked",
                "category": "pen",
                "message": "Inked with SECRET_INK_NAME",
                "entity_id": "pen-visible",
                "metadata": { "new_ink_id": "ink-secret" }
            }, {
                "id": "ink-updated",
                "timestamp": 20,
                "action": "updated",
                "category": "ink",
                "message": "Updated SECRET_INK_NAME",
                "entity_id": "ink-secret",
                "metadata": {}
            }, {
                "id": "swatch-created",
                "timestamp": 10,
                "action": "created",
                "category": "swatch",
                "message": "Added SECRET_SWATCH_NOTE",
                "entity_id": "swatch-secret",
                "metadata": {}
            }]
        });
        let preferences = json!({
            "show_activity_log": true,
            "show_recent_activity": true,
            "activity_log_verbosity": "SECRET_VERBOSITY",
            "defaults": {
                "currency": "SECRET_CURRENCY",
                "date_format": "SECRET_DATE_FORMAT"
            },
            "showcase": {
                "color_mode": "SECRET_COLOR_MODE",
                "show_prices": true,
                "show_pens": true,
                "show_inks": false,
                "show_swatches": true,
                "default_sort": {
                    "pens": "SECRET_PEN_SORT",
                    "inks": "SECRET_INK_SORT",
                    "swatches": "SECRET_SWATCH_SORT"
                }
            }
        });

        let public = build_public_showcase_data(&collection, &preferences);

        assert_eq!(public["pens"].as_array().unwrap().len(), 1);
        assert!(public["inks"].as_array().unwrap().is_empty());
        assert!(public["swatches"].as_array().unwrap().is_empty());
        assert!(public["currently_inked"].as_array().unwrap().is_empty());
        assert_eq!(
            public["preferences"]["showcase"]["show_swatches"].as_bool(),
            Some(false)
        );
        assert_eq!(
            public["preferences"]["activity_log_verbosity"].as_str(),
            Some("normal")
        );
        assert_eq!(
            public["preferences"]["defaults"]["currency"].as_str(),
            Some("USD")
        );
        assert_eq!(
            public["preferences"]["defaults"]["date_format"].as_str(),
            Some("system")
        );
        assert_eq!(
            public["preferences"]["showcase"]["color_mode"].as_str(),
            Some("auto")
        );
        assert_eq!(
            public["preferences"]["showcase"]["default_sort"],
            json!({
                "pens": "newest",
                "inks": "newest",
                "swatches": "newest"
            })
        );
        let activity = public["activity_log"].as_array().unwrap();
        assert_eq!(activity.len(), 1);
        assert_eq!(activity[0]["id"].as_str(), Some("public_activity_1"));
        assert_eq!(activity[0]["message"].as_str(), Some("pen: created"));
        assert_eq!(
            collect_referenced_images(&public),
            vec!["pens/visible-pen.webp".to_string()]
        );
        let serialized = serde_json::to_string(&public).unwrap();
        for sentinel in [
            "SECRET_INK_NAME",
            "SECRET_SWATCH_NOTE",
            "inks/secret-ink.webp",
            "swatches/secret-swatch.webp",
            "ink-secret",
            "swatch-secret",
            "pair-secret",
            "SECRET_VERBOSITY",
            "SECRET_CURRENCY",
            "SECRET_DATE_FORMAT",
            "SECRET_COLOR_MODE",
            "SECRET_PEN_SORT",
            "SECRET_INK_SORT",
            "SECRET_SWATCH_SORT",
        ] {
            assert!(!serialized.contains(sentinel), "leaked {sentinel}");
        }
    }

    #[test]
    fn public_showcase_projection_applies_independent_activity_visibility() {
        let activity_log = [10, 70, 30, 60, 20, 50, 40]
            .into_iter()
            .map(|timestamp| {
                json!({
                    "id": format!("activity-{timestamp}"),
                    "timestamp": timestamp,
                    "action": "updated",
                    "category": "pen",
                    "message": format!("SECRET_ACTIVITY_{timestamp}"),
                    "entity_id": "pen-visible",
                    "metadata": { "private_marker": format!("SECRET_META_{timestamp}") }
                })
            })
            .collect::<Vec<_>>();
        let collection = json!({
            "pens": [{ "id": "pen-visible" }],
            "inks": [],
            "swatches": [],
            "currently_inked": [],
            "activity_log": activity_log
        });
        let recent_only_preferences = json!({
            "show_activity_log": false,
            "show_recent_activity": true,
            "showcase": {
                "show_pens": true,
                "show_inks": true,
                "show_swatches": true
            }
        });

        let recent_only = build_public_showcase_data(&collection, &recent_only_preferences);
        let recent = recent_only["activity_log"].as_array().unwrap();
        assert_eq!(recent.len(), PUBLIC_RECENT_ACTIVITY_LIMIT);
        assert_eq!(
            recent
                .iter()
                .map(|entry| entry["timestamp"].as_i64().unwrap())
                .collect::<Vec<_>>(),
            vec![70, 60, 50, 40, 30]
        );
        assert!(recent.iter().all(|entry| {
            entry["message"].as_str() == Some("pen: updated") && entry["metadata"] == json!({})
        }));
        assert!(recent.iter().all(|entry| {
            entry["id"]
                .as_str()
                .map(|id| id.starts_with("public_activity_"))
                .unwrap_or(false)
        }));

        let mut full_only_preferences = recent_only_preferences.clone();
        full_only_preferences["show_activity_log"] = json!(true);
        full_only_preferences["show_recent_activity"] = json!(false);
        let full_only = build_public_showcase_data(&collection, &full_only_preferences);
        assert_eq!(full_only["activity_log"].as_array().unwrap().len(), 7);
        assert_eq!(
            full_only["activity_log"]
                .as_array()
                .unwrap()
                .iter()
                .map(|entry| entry["timestamp"].as_i64().unwrap())
                .collect::<Vec<_>>(),
            vec![70, 60, 50, 40, 30, 20, 10]
        );

        let mut no_activity_preferences = full_only_preferences.clone();
        no_activity_preferences["show_activity_log"] = json!(false);
        let no_activity = build_public_showcase_data(&collection, &no_activity_preferences);
        assert!(no_activity["activity_log"].as_array().unwrap().is_empty());

        let serialized = serde_json::to_string(&recent_only).unwrap();
        assert!(!serialized.contains("SECRET_ACTIVITY_"));
        assert!(!serialized.contains("SECRET_META_"));
        assert!(!serialized.contains("\"activity-"));
    }

    #[test]
    fn backup_reference_copy_rejects_missing_and_invalid_managed_sources() {
        let root = test_root("invalid-backup-reference-source");
        let source = root.join("source");
        let destination = root.join("destination");
        ensure_managed_image_dirs(&source).unwrap();
        let data = json!({
            "pens": [{ "image": "pens/required.webp" }],
            "inks": [],
            "swatches": []
        });

        let missing_error = copy_referenced_images(&source, &destination, &data)
            .err()
            .unwrap();
        assert!(missing_error.to_string().contains("is missing"));

        fs::write(source.join("pens/required.webp"), b"<svg>not raster</svg>").unwrap();
        let invalid_error = copy_referenced_images(&source, &destination, &data)
            .err()
            .unwrap();
        assert!(invalid_error
            .to_string()
            .contains("invalid raster image contents"));

        let unsafe_data = json!({
            "pens": [{ "image_url": "pens/../escape.webp" }],
            "inks": [],
            "swatches": []
        });
        let unsafe_error = copy_referenced_images(&source, &destination, &unsafe_data)
            .err()
            .unwrap();
        assert!(unsafe_error
            .to_string()
            .contains("unsupported managed image path"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_reference_copy_repairs_legacy_png_named_webp() {
        let root = test_root("legacy-png-webp-reference");
        let source = root.join("source");
        let destination = root.join("destination");
        ensure_managed_image_dirs(&source).unwrap();
        let relative = "pens/legacy-heic.webp";
        let source_path = source.join(relative);
        let png = test_raster_bytes(ImageFormat::Png, [20, 40, 60]);
        fs::write(&source_path, &png).unwrap();
        let data = json!({
            "pens": [{ "image": relative }],
            "inks": [],
            "swatches": []
        });

        copy_referenced_images(&source, &destination, &data).unwrap();

        let repaired = fs::read(&source_path).unwrap();
        let copied = fs::read(destination.join(relative)).unwrap();
        assert!(has_raster_signature(&repaired, "webp"));
        assert_eq!(copied, repaired);
        validate_backup_raster_file(&source_path, "images").unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn referenced_images_include_all_aliases_nested_paths_and_legacy_ink_swatches() {
        let data = json!({
            "pens": [{
                "image": "pens/direct.webp",
                "image_url": "images/pens/url-alias.webp",
                "url": "pens/direct-url.webp",
                "images": [
                    "pens/gallery-string.webp",
                    { "path": "pens/nested/gallery-path.webp" },
                    { "image": "pens/gallery-image.webp" },
                    { "url": "pens/gallery-url.webp" },
                    { "path": "pens/direct.webp" }
                ]
            }],
            "inks": [{ "image": "swatches/legacy-ink-swatch.webp" }],
            "swatches": [{
                "image": "swatches/direct.webp",
                "image_url": "https://example.test/external.webp",
                "url": "data:image/webp;base64,AAAA",
                "images": ["blob:temporary", { "path": "default_pen.png" }]
            }]
        });

        let expected = vec![
            "pens/direct-url.webp".to_string(),
            "pens/direct.webp".to_string(),
            "pens/gallery-image.webp".to_string(),
            "pens/gallery-string.webp".to_string(),
            "pens/gallery-url.webp".to_string(),
            "pens/nested/gallery-path.webp".to_string(),
            "pens/url-alias.webp".to_string(),
            "swatches/direct.webp".to_string(),
            "swatches/legacy-ink-swatch.webp".to_string(),
        ];
        assert_eq!(collect_referenced_images(&data), expected);
        validate_managed_image_references(&data).unwrap();

        let root = test_root("all-backup-image-aliases");
        let source = root.join("source");
        let destination = root.join("destination");
        let image_bytes = test_raster_bytes(ImageFormat::WebP, [70, 80, 90]);
        for relative in collect_referenced_images(&data) {
            let path = source.join(&relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, &image_bytes).unwrap();
        }
        copy_referenced_images(&source, &destination, &data).unwrap();
        for relative in collect_referenced_images(&data) {
            assert_eq!(fs::read(destination.join(&relative)).unwrap(), image_bytes);
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn showcase_thumbnail_copy_uses_a_webp_output_suffix() {
        let root = test_root("showcase-thumbnail-suffix");
        let source = root.join("source");
        let destination = root.join("destination");
        let source_thumbnail = source.join("pens/example.png");
        let data = json!({
            "pens": [{ "image": "pens/example.png" }],
            "inks": [],
            "swatches": []
        });
        fs::create_dir_all(source_thumbnail.parent().unwrap()).unwrap();
        fs::write(&source_thumbnail, b"webp-thumbnail").unwrap();

        copy_showcase_thumbnails(&source, &destination, &data).unwrap();

        assert_eq!(
            fs::read(destination.join("pens/example.png.webp")).unwrap(),
            b"webp-thumbnail"
        );
        assert!(!destination.join("pens/example.png").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn prepare_showcase_index_injects_data_and_removes_manager_scripts() {
        let html = r#"<html>
<head></head>
<body>
	    <script src="renderer/data-schema.js"></script>
	    <script src="tauri-api.js"></script>
	    <script src="renderer.js"></script>
</body>
</html>
"#;
        let data = json!({
            "preferences": {
                "showcase": {
                    "color_mode": "light"
                }
            }
        });

        let prepared = prepare_showcase_index_html(Path::new("/tmp"), html, &data).unwrap();

        assert!(prepared.contains(r#"data-inkubator-public-color-mode="light""#));
        assert!(prepared.contains(r#"<script src="data.js"></script>"#));
        assert!(prepared.contains(r#"<script src="renderer.js"></script>"#));
        assert!(!prepared.contains("tauri-api.js"));
        assert!(
            prepared.find("data.js").unwrap() < prepared.find("renderer.js").unwrap(),
            "data.js must load before renderer.js"
        );
    }

    #[test]
    fn versioning_leaves_static_data_script_unversioned() {
        let root = env::temp_dir().join(format!(
            "inkubator-version-assets-{}",
            Uuid::new_v4().simple()
        ));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("renderer.js"), b"console.log('renderer');").unwrap();
        fs::write(root.join("data.js"), b"window.__INKUBATOR_DATA__ = {};").unwrap();

        let html = r#"<script src="data.js"></script><script src="renderer.js"></script>"#;
        let versioned = version_html_asset_references(&root, html).unwrap();

        assert!(versioned.contains(r#"src="data.js""#));
        assert!(!versioned.contains("data.js?v="));
        assert!(versioned.contains("renderer.js?v="));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn release_version_state_detects_local_build_ahead_of_latest() {
        assert_eq!(release_version_state("2.0.0", "1.7.6"), "ahead_of_latest");
    }

    #[test]
    fn release_version_state_detects_update_available() {
        assert_eq!(release_version_state("1.7.6", "2.0.0"), "update_available");
    }

    #[test]
    fn release_version_state_detects_matching_versions() {
        assert_eq!(release_version_state("v2.0.0", "2.0.0"), "up_to_date");
    }
}
