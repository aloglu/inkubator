use anyhow::{anyhow, Context, Result};
use base64::Engine;
use chrono::{DateTime, Utc};
use image::ImageFormat;
use reqwest::header::{ACCEPT, USER_AGENT};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::{
    collections::HashSet,
    env,
    fs::{self, File},
    io::{Cursor, Read, Write},
    path::{Component, Path, PathBuf},
    sync::Mutex,
    time::{Duration, SystemTime},
};
use tauri::{AppHandle, Manager, State, Window};
use tokio::time::timeout;
use url::Url;
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

const APP_NAME: &str = "Inkubator";
const GITHUB_REPO: &str = "aloglu/inkubator";
const GITHUB_RELEASES_URL: &str = "https://github.com/aloglu/inkubator/releases";
const MAX_REMOTE_IMAGE_BYTES: usize = 25 * 1024 * 1024;
const AUTO_BACKUP_DEFAULT_MAX_FILES: usize = 30;
const AUTO_BACKUP_HARD_MAX_FILES: usize = 365;
const MANAGED_IMAGE_SUBDIRS: [&str; 3] = ["pens", "inks", "swatches"];
const ALLOWED_IMAGE_EXTENSIONS: [&str; 7] = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif"];

#[derive(Default)]
struct InkubatorState {
    selected_external_image_paths: Mutex<HashSet<PathBuf>>,
    selected_backup_paths: Mutex<HashSet<PathBuf>>,
}

#[derive(Debug, Deserialize)]
struct ImportOptions {
    conflict_behavior: Option<String>,
    auto_validate_import: Option<bool>,
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

fn data_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_storage_dir(app)?.join("data.json"))
}

fn preferences_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_storage_dir(app)?.join("preferences.json"))
}

fn images_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_storage_dir(app)?.join("images"))
}

fn thumbnails_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(images_path(app)?.join(".thumbs"))
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
    let resource_app = app
        .path()
        .resource_dir()
        .ok()
        .map(|path| path.join("app"))
        .filter(|path| path.exists());
    if let Some(path) = resource_app {
        return Ok(path);
    }

    let manifest_app = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| anyhow!("Could not resolve repository root"))?
        .join("app");
    if manifest_app.exists() {
        return Ok(manifest_app);
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

fn read_json_or(path: &Path, fallback: Value) -> Value {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or(fallback)
}

fn write_json(path: &Path, value: &Value) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_string_pretty(value)?)
        .with_context(|| format!("Could not write {}", path.display()))
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

fn combine_collection_with_preferences(collection: Value, preferences: Value) -> Value {
    let mut out = collection.as_object().cloned().unwrap_or_else(Map::new);
    out.insert("preferences".to_string(), preferences);
    Value::Object(out)
}

fn normalize_import_conflict_behavior(input: Option<String>) -> String {
    match input
        .unwrap_or_else(|| "overwrite".to_string())
        .to_lowercase()
        .as_str()
    {
        "skip" => "skip".to_string(),
        "merge" => "merge".to_string(),
        _ => "overwrite".to_string(),
    }
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

    let data = data_path(app)?;
    if !data.exists() {
        let bundled_data = frontend_source_root(app)?.join("data.json");
        if bundled_data.exists() {
            fs::copy(&bundled_data, &data)?;
        } else {
            write_json(&data, &default_collection_data())?;
        }
    }

    let prefs = preferences_path(app)?;
    if !prefs.exists() {
        write_json(&prefs, &default_preferences())?;
    }

    let images = images_path(app)?;
    if !images.exists() {
        let bundled_images = frontend_source_root(app)?.join("images");
        if bundled_images.exists() {
            copy_dir_all(&bundled_images, &images)?;
        }
    }
    fs::create_dir_all(&images)?;
    ensure_managed_image_dirs(&images)?;
    fs::create_dir_all(thumbnails_path(app)?)?;
    ensure_managed_image_dirs(&thumbnails_path(app)?)?;
    fs::create_dir_all(auto_backups_path(app)?)?;
    fs::create_dir_all(manual_backups_path(app)?)?;
    Ok(())
}

fn copy_dir_all(source: &Path, destination: &Path) -> Result<()> {
    copy_dir_all_with_mode(source, destination, true)
}

fn copy_required_file(source: &Path, destination: &Path) -> Result<()> {
    if !source.exists() {
        return Err(anyhow!("Missing required app file: {}", source.display()));
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, destination)?;
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
    let (pathname, query) = before_hash
        .split_once('?')
        .map(|(left, right)| (left, right))
        .unwrap_or((before_hash, ""));
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
    write_json(&folder.join("preferences.json"), preferences)?;
    copy_referenced_images(&images_path(app)?, &folder.join("images"), data)?;
    if keep_replaced && replaced_images_path(app)?.exists() {
        copy_dir_all(&replaced_images_path(app)?, &folder.join("replaced-images"))?;
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
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all_with_mode(&entry.path(), &target, overwrite)?;
        } else {
            if !overwrite && target.exists() {
                continue;
            }
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

fn zip_folder(source: &Path, destination: &Path) -> Result<()> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    let file = File::create(destination)
        .with_context(|| format!("Could not create {}", destination.display()))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    fn add_entries(
        zip: &mut ZipWriter<File>,
        root: &Path,
        current: &Path,
        options: SimpleFileOptions,
    ) -> Result<()> {
        for entry in fs::read_dir(current)? {
            let entry = entry?;
            let path = entry.path();
            let relative = path
                .strip_prefix(root)?
                .to_string_lossy()
                .replace('\\', "/");
            if entry.file_type()?.is_dir() {
                zip.add_directory(format!("{relative}/"), options)?;
                add_entries(zip, root, &path, options)?;
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

    add_entries(&mut zip, source, source, options)?;
    zip.finish()?;
    Ok(())
}

fn extract_zip_to_folder(zip_path: &Path, destination: &Path) -> Result<()> {
    let file =
        File::open(zip_path).with_context(|| format!("Could not open {}", zip_path.display()))?;
    let mut archive = ZipArchive::new(file)?;
    fs::create_dir_all(destination)?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index)?;
        let Some(enclosed) = file.enclosed_name().map(PathBuf::from) else {
            continue;
        };
        let out_path = destination.join(enclosed);
        if file.is_dir() {
            fs::create_dir_all(&out_path)?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut out_file = File::create(&out_path)?;
        std::io::copy(&mut file, &mut out_file)?;
    }
    Ok(())
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

fn replace_dir_with_staging(source: &Path, destination: &Path) -> Result<()> {
    let parent = destination
        .parent()
        .ok_or_else(|| anyhow!("Could not resolve destination parent"))?;
    fs::create_dir_all(parent)?;
    let stage = parent.join(format!(
        ".{}-import-stage-{}-{}",
        destination
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("images"),
        timestamp(),
        Uuid::new_v4().simple()
    ));
    let rollback = parent.join(format!(
        ".{}-import-rollback-{}-{}",
        destination
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("images"),
        timestamp(),
        Uuid::new_v4().simple()
    ));

    if stage.exists() {
        fs::remove_dir_all(&stage)?;
    }
    if rollback.exists() {
        fs::remove_dir_all(&rollback)?;
    }

    let result = (|| -> Result<()> {
        copy_dir_all(source, &stage)?;
        if destination.exists() {
            fs::rename(destination, &rollback)?;
        }
        fs::rename(&stage, destination)?;
        if rollback.exists() {
            fs::remove_dir_all(&rollback)?;
        }
        Ok(())
    })();

    if result.is_err() {
        if stage.exists() {
            let _ = fs::remove_dir_all(&stage);
        }
        if rollback.exists() && !destination.exists() {
            let _ = fs::rename(&rollback, destination);
        } else if rollback.exists() {
            let _ = fs::remove_dir_all(&rollback);
        }
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

fn pen_filename_stem(metadata: &Value) -> String {
    let brand = sanitize_slug(&metadata_string(metadata, "brand", "unknown"));
    let model = sanitize_slug(&metadata_string(metadata, "model", "pen"));
    let nib = sanitize_slug(&metadata_string(metadata, "nib", "standard"));
    let color = sanitize_slug(&metadata_string(metadata, "color", "standard"));
    format!("{brand}-{model}-{nib}-{color}")
}

fn next_numbered_filename(dir: &Path, stem: &str) -> String {
    let mut next = 1usize;
    loop {
        let filename = format!("{stem}-{next}.webp");
        if !dir.join(&filename).exists() {
            return filename;
        }
        next += 1;
    }
}

fn next_ink_filename(dir: &Path, metadata: &Value) -> String {
    let brand = sanitize_slug(&metadata_string(metadata, "brand", "unknown"));
    let model = sanitize_slug(&metadata_string(metadata, "model", "ink"));
    let stem = format!("{brand}-{model}");
    if !dir.join(format!("{stem}.webp")).exists() {
        return format!("{stem}.webp");
    }
    let mut next = 2usize;
    loop {
        let filename = format!("{stem}-{next}.webp");
        if !dir.join(&filename).exists() {
            return filename;
        }
        next += 1;
    }
}

fn swatch_filename(metadata: &Value) -> String {
    let brand = sanitize_slug(&metadata_string(metadata, "brand", "unknown"));
    let model = sanitize_slug(&metadata_string(metadata, "model", "swatch"));
    format!(
        "{brand}-{model}-{}-{}.webp",
        Utc::now().timestamp_millis(),
        Uuid::new_v4().simple()
    )
}

fn normalize_relative_image_path(input: &str) -> String {
    let mut value = input.trim().replace('\\', "/");
    while value.starts_with("./") {
        value = value.trim_start_matches("./").to_string();
    }
    value = value.trim_start_matches('/').to_string();
    if let Some(stripped) = value.strip_prefix("images/") {
        stripped.to_string()
    } else {
        value
    }
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
    let data = read_json_or(&data_path(app)?, default_collection_data());
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
    if !path_inside(images_root, &target) || !is_allowed_image_extension(&target) {
        return Err(anyhow!("Invalid managed image path"));
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
        .filter(|path| path.is_file() && path_inside(&images, path));
    let using_full_image_fallback = !requested_target.is_file() && fallback.is_some();
    let target = if requested_target.is_file() {
        requested_target
    } else if let Some(path) = fallback {
        path
    } else {
        return response(StatusCode::NOT_FOUND, Vec::new(), "text/plain", "no-store");
    };
    let content_type = image_mime_type(&target);
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

    if is_preprocessed_heic_webp(source_hint) {
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

fn thumbnail_path_for(app: &AppHandle, relative_path: &str) -> Result<PathBuf> {
    let normalized = normalize_relative_image_path(relative_path);
    if normalized.is_empty() {
        return Err(anyhow!("Invalid thumbnail path."));
    }
    let root = thumbnails_path(app)?;
    let target = root.join(normalized);
    if !path_inside(&root, target.parent().unwrap_or(&root)) {
        return Err(anyhow!("Invalid thumbnail path."));
    }
    Ok(target)
}

fn write_thumbnail_for(
    app: &AppHandle,
    relative_path: &str,
    source_bytes: &[u8],
    source_hint: &str,
) -> Result<()> {
    let target = thumbnail_path_for(app, relative_path)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(
        target,
        process_image_to_webp_with_max(source_bytes, source_hint, 480)?,
    )?;
    Ok(())
}

fn ensure_thumbnail_for(app: &AppHandle, relative_path: &str) -> Result<()> {
    let normalized = normalize_relative_image_path(relative_path);
    if normalized.is_empty() {
        return Ok(());
    }
    let target = thumbnail_path_for(app, &normalized)?;
    if target.exists() {
        return Ok(());
    }
    let source = images_path(app)?.join(&normalized);
    if !source.exists() || !source.is_file() || !path_inside(&images_path(app)?, &source) {
        return Ok(());
    }
    let bytes = fs::read(&source)?;
    write_thumbnail_for(app, &normalized, &bytes, &normalized)
}

fn ensure_referenced_thumbnails(app: &AppHandle, data: &Value) -> Result<()> {
    fs::create_dir_all(thumbnails_path(app)?)?;
    ensure_managed_image_dirs(&thumbnails_path(app)?)?;
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
        if let Err(error) = ensure_referenced_thumbnails(&app, &data) {
            eprintln!("Some thumbnails could not be generated in the background: {error}");
        }
    });
}

fn remove_thumbnail_for(app: &AppHandle, relative_path: &str) -> Result<()> {
    let target = thumbnail_path_for(app, relative_path)?;
    if target.exists() {
        fs::remove_file(target)?;
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
    let folder = match image_type {
        "pen" => "pens",
        "swatch" => "swatches",
        _ => "inks",
    };
    let dir = images_path(app)?.join(folder);
    fs::create_dir_all(&dir)?;

    let filename = match image_type {
        "pen" => next_numbered_filename(&dir, &pen_filename_stem(metadata)),
        "swatch" => swatch_filename(metadata),
        _ => next_ink_filename(&dir, metadata),
    };
    let output = process_image_to_webp(source_bytes, source_hint)?;
    let relative_path = format!("{folder}/{filename}");
    fs::write(dir.join(&filename), &output)?;
    write_thumbnail_for(app, &relative_path, &output, &relative_path)?;
    Ok(relative_path)
}

fn collect_referenced_images(data: &Value) -> Vec<String> {
    let mut out = HashSet::new();
    for key in ["pens", "inks", "swatches"] {
        if let Some(items) = data.get(key).and_then(Value::as_array) {
            for item in items {
                for image in item
                    .get("images")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|entry| entry.get("path").and_then(Value::as_str))
                    .chain(item.get("image").and_then(Value::as_str))
                {
                    if image.is_empty()
                        || image.contains("default_")
                        || image.starts_with("data:")
                        || image.starts_with("blob:")
                        || image.starts_with("http://")
                        || image.starts_with("https://")
                        || image.starts_with("file://")
                    {
                        continue;
                    }
                    let normalized = normalize_relative_image_path(image);
                    // Migrated ink records may retain a swatch-owned compatibility path.
                    if key == "inks" && normalized.starts_with("swatches/") {
                        continue;
                    }
                    if !normalized.is_empty() {
                        out.insert(normalized);
                    }
                }
            }
        }
    }
    let mut paths = out.into_iter().collect::<Vec<_>>();
    paths.sort();
    paths
}

fn copy_referenced_images(source_root: &Path, destination_root: &Path, data: &Value) -> Result<()> {
    fs::create_dir_all(destination_root)?;
    ensure_managed_image_dirs(destination_root)?;
    for rel in collect_referenced_images(data) {
        let source = source_root.join(&rel);
        if !source.exists() || !path_inside(source_root, &source) {
            continue;
        }
        let destination = destination_root.join(&rel);
        if !path_inside(
            destination_root,
            destination.parent().unwrap_or(destination_root),
        ) {
            continue;
        }
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(source, destination)?;
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

fn latest_auto_backup(auto_root: &Path) -> Option<(PathBuf, SystemTime)> {
    let entries = fs::read_dir(auto_root).ok()?;
    let mut latest: Option<(PathBuf, SystemTime)> = None;
    for entry in entries.flatten() {
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
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((entry.path(), modified))
        })
        .collect::<Vec<_>>();
    entries.sort_by(|a, b| b.1.cmp(&a.1));
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
    reason: &str,
    force: bool,
) -> Result<Option<PathBuf>> {
    let preferences = read_json_or(&preferences_path(app)?, default_preferences());
    let (frequency, retention, keep_replaced) = backup_settings(&preferences);
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

    let backup_path = auto_root.join(format!("auto-{}", timestamp()));
    fs::create_dir_all(&backup_path)?;
    write_json(&backup_path.join("data.json"), data)?;
    write_json(&backup_path.join("preferences.json"), &preferences)?;
    copy_referenced_images(&images_path(app)?, &backup_path.join("images"), data)?;
    if keep_replaced && replaced_images_path(app)?.exists() {
        copy_dir_all(
            &replaced_images_path(app)?,
            &backup_path.join("replaced-images"),
        )?;
    }
    write_json(
        &backup_path.join("manifest.json"),
        &json!({
            "type": "inkubator-auto-backup",
            "version": 3,
            "created_at": Utc::now().to_rfc3339(),
            "reason": reason,
            "include_images": true,
            "include_replaced_images": keep_replaced,
            "include_preferences": true,
            "auto_frequency": frequency,
            "retention_count": retention,
            "keep_replaced_images": keep_replaced
        }),
    )?;
    prune_auto_backups(&auto_root, retention)?;
    Ok(Some(backup_path))
}

#[tauri::command]
async fn load_data(app: AppHandle) -> std::result::Result<Value, String> {
    (|| {
        ensure_app_storage(&app)?;
        let collection = read_json_or(&data_path(&app)?, default_collection_data());
        let preferences = read_json_or(&preferences_path(&app)?, default_preferences());
        Ok(combine_collection_with_preferences(collection, preferences))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn save_data(app: AppHandle, data: Value) -> std::result::Result<Value, String> {
    (|| {
        ensure_app_storage(&app)?;
        let collection = collection_without_preferences(&data);
        let preferences = preferences_from(&data);
        write_json(&data_path(&app)?, &collection)?;
        write_json(&preferences_path(&app)?, &preferences)?;
        create_auto_backup(&app, &collection, "save-data", false)?;
        Ok(json!({ "success": true }))
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
        let filename = save_processed_image(&app, &bytes, &source_hint, &image_type, &metadata)?;
        Ok(Some(filename))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn read_remote_image_bytes(url: String) -> std::result::Result<Value, String> {
    async {
        let parsed = Url::parse(&url).context("Invalid URL")?;
        if parsed.scheme() != "https" {
            return Err(anyhow!("Only https URLs are allowed for remote images."));
        }
        let response = timeout(Duration::from_secs(15), reqwest::get(parsed.as_str()))
            .await
            .context("Request timed out")??;
        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch image: {}", response.status()));
        }
        let mime_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        if let Some(length) = response.content_length() {
            if length as usize > MAX_REMOTE_IMAGE_BYTES {
                return Err(anyhow!("Remote image is too large."));
            }
        }
        let bytes = response.bytes().await?;
        if bytes.len() > MAX_REMOTE_IMAGE_BYTES {
            return Err(anyhow!("Remote image is too large."));
        }
        Ok(json!({
            "base64": base64::engine::general_purpose::STANDARD.encode(bytes),
            "sourceUrl": parsed.as_str(),
            "sourceHint": parsed.path(),
            "mimeType": mime_type
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
        let parsed = Url::parse(&url).context("Invalid URL")?;
        if parsed.scheme() != "https" {
            return Err(anyhow!("Only https URLs are allowed for remote images."));
        }
        let response = timeout(Duration::from_secs(15), reqwest::get(parsed.as_str()))
            .await
            .context("Request timed out")??;
        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch image: {}", response.status()));
        }
        if let Some(length) = response.content_length() {
            if length as usize > MAX_REMOTE_IMAGE_BYTES {
                return Err(anyhow!("Remote image is too large."));
            }
        }
        let bytes = response.bytes().await?;
        if bytes.len() > MAX_REMOTE_IMAGE_BYTES {
            return Err(anyhow!("Remote image is too large."));
        }
        let filename = save_processed_image(&app, &bytes, parsed.path(), &image_type, &metadata)?;
        Ok(json!({ "success": true, "filename": filename }))
    }
    .await
    .map_err(command_error)
}

#[tauri::command]
async fn delete_image(app: AppHandle, relative_path: String) -> std::result::Result<Value, String> {
    (|| {
        if relative_path.is_empty() || relative_path.contains("default_") {
            return Ok(json!({ "success": true }));
        }
        let images = images_path(&app)?;
        let normalized = normalize_relative_image_path(&relative_path);
        let target = images.join(normalized);
        if target.exists() && path_inside(&images, &target) {
            fs::remove_file(target)?;
        }
        let _ = remove_thumbnail_for(&app, &relative_path);
        Ok(json!({ "success": true }))
    })()
    .map_err(command_error)
}

#[tauri::command]
async fn dispose_replaced_image(
    app: AppHandle,
    relative_path: String,
) -> std::result::Result<Value, String> {
    (|| {
        if relative_path.is_empty() || relative_path.contains("default_") {
            return Ok(json!({ "success": true, "action": "noop" }));
        }
        let normalized = normalize_relative_image_path(&relative_path);
        let images = images_path(&app)?;
        let source = images.join(&normalized);
        if !source.exists() || !path_inside(&images, &source) {
            return Ok(json!({ "success": true, "action": "missing", "relativePath": normalized }));
        }

        let preferences = read_json_or(&preferences_path(&app)?, default_preferences());
        let (_, _, keep_replaced) = backup_settings(&preferences);
        if !keep_replaced {
            fs::remove_file(source)?;
            return Ok(json!({ "success": true, "action": "deleted", "relativePath": normalized }));
        }

        let archive_root = replaced_images_path(&app)?;
        let destination = archive_root.join(&normalized);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut unique = destination.clone();
        let mut index = 2usize;
        while unique.exists() {
            let stem = destination
                .file_stem()
                .and_then(|v| v.to_str())
                .unwrap_or("image");
            let ext = destination
                .extension()
                .and_then(|v| v.to_str())
                .unwrap_or("webp");
            unique = destination.with_file_name(format!("{stem}-{index}.{ext}"));
            index += 1;
        }
        fs::rename(source, &unique)?;
        let _ = remove_thumbnail_for(&app, &normalized);
        Ok(json!({ "success": true, "action": "archived", "relativePath": normalized }))
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
async fn export_backup(app: AppHandle) -> std::result::Result<Value, String> {
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
        let stage = manual_backups_path(&app)?.join(format!(
            ".manual-export-{}-{}",
            timestamp(),
            Uuid::new_v4().simple()
        ));
        let collection = read_json_or(&data_path(&app)?, default_collection_data());
        let preferences = read_json_or(&preferences_path(&app)?, default_preferences());
        let (_, _, keep_replaced) = backup_settings(&preferences);
        if stage.exists() {
            fs::remove_dir_all(&stage)?;
        }
        let result = (|| -> Result<()> {
            create_backup_folder(
                &app,
                &stage,
                &collection,
                &preferences,
                "inkubator-backup",
                None,
                keep_replaced,
            )?;
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
    app: &AppHandle,
    folder: &Path,
    options: Option<&ImportOptions>,
) -> Result<Value> {
    let incoming_data = folder.join("data.json");
    let incoming_preferences = folder.join("preferences.json");
    if !incoming_data.exists() || !incoming_preferences.exists() {
        return Ok(json!({ "success": false, "message": "Selected backup is not valid." }));
    }

    let incoming_collection = read_json_or(&incoming_data, default_collection_data());
    let preferences = read_json_or(&incoming_preferences, default_preferences());
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

    let current_collection = read_json_or(&data_path(app)?, default_collection_data());
    let behavior = normalize_import_conflict_behavior(
        options.and_then(|value| value.conflict_behavior.clone()),
    );
    let data = merge_collection_data(&current_collection, &incoming_collection, &behavior);
    write_json(&data_path(app)?, &data)?;
    write_json(&preferences_path(app)?, &preferences)?;

    let backup_images = folder.join("images");
    if backup_images.exists() {
        if behavior == "overwrite" {
            replace_dir_with_staging(&backup_images, &images_path(app)?)?;
        } else if behavior == "skip" {
            copy_dir_all_with_mode(&backup_images, &images_path(app)?, false)?;
        } else {
            copy_dir_all_with_mode(&backup_images, &images_path(app)?, true)?;
        }
    }
    ensure_managed_image_dirs(&images_path(app)?)?;

    let backup_replaced_images = folder.join("replaced-images");
    let replaced_images = replaced_images_path(app)?;
    if backup_replaced_images.exists() {
        if behavior == "overwrite" {
            replace_dir_with_staging(&backup_replaced_images, &replaced_images)?;
        } else if behavior == "skip" {
            copy_dir_all_with_mode(&backup_replaced_images, &replaced_images, false)?;
        } else {
            copy_dir_all_with_mode(&backup_replaced_images, &replaced_images, true)?;
        }
    } else if behavior == "overwrite" && replaced_images.exists() {
        fs::remove_dir_all(&replaced_images)?;
    }

    Ok(json!({
        "success": true,
        "data": combine_collection_with_preferences(data, preferences)
    }))
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
) -> std::result::Result<Value, String> {
    (|| {
        ensure_app_storage(&app)?;
        let zip_path = take_selected_backup_path(&state.selected_backup_paths, &zip_path)?;
        let overwrite_options = ImportOptions {
            conflict_behavior: Some("overwrite".to_string()),
            auto_validate_import: options
                .as_ref()
                .and_then(|value| value.auto_validate_import),
        };
        let options_ref = Some(&overwrite_options);

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
            import_backup_folder(&app, &backup_root, options_ref)
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
            let data = read_json_or(&data_path(&app)?, default_collection_data());
            regenerate_thumbnails_in_background(app.clone(), data);
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
            copy_required_file(&frontend.join(name), &stage.join(name))?;
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

        let data = read_json_or(&data_path(&app)?, default_collection_data());
        let preferences = read_json_or(&preferences_path(&app)?, default_preferences());
        let showcase_data = combine_collection_with_preferences(data.clone(), preferences);
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

        copy_referenced_images(&images_path(&app)?, &stage.join("images"), &data)?;
        copy_referenced_images(&images_path(&app)?, &stage.join("thumbs"), &data)?;
        let thumbnail_warning = match ensure_referenced_thumbnails(&app, &data) {
            Ok(()) => None,
            Err(error) => {
                eprintln!("Showcase export will use original images for some thumbnails: {error}");
                Some(format!(
                    "Showcase exported, but {error} Full-size images were used as fallbacks for those thumbnails."
                ))
            }
        };
        copy_referenced_images(&thumbnails_path(&app)?, &stage.join("thumbs"), &data)?;

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
            let data = read_json_or(&data_path(&handle)?, default_collection_data());
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
        let root = PathBuf::from("/tmp");
        assert_eq!(
            resolve_managed_media_path(&root, "/images/.thumbs/pens/example.webp").unwrap(),
            root.join(".thumbs/pens/example.webp")
        );
        assert!(resolve_managed_media_path(&root, "/images/../data.json").is_err());
        assert!(resolve_managed_media_path(&root, "/other/example.webp").is_err());
        assert!(resolve_managed_media_path(&root, "/images/pens/example.txt").is_err());
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
    fn referenced_images_ignore_migrated_ink_swatch_compatibility_paths() {
        let data = json!({
            "pens": [{ "image": "pens/keep.webp" }],
            "inks": [
                { "image": "inks/keep.webp" },
                { "image": "swatches/legacy-ink-swatch.webp" }
            ],
            "swatches": [{ "image": "swatches/keep.webp" }]
        });

        assert_eq!(
            collect_referenced_images(&data),
            vec![
                "inks/keep.webp".to_string(),
                "pens/keep.webp".to_string(),
                "swatches/keep.webp".to_string()
            ]
        );
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
