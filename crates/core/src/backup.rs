//! Backups: one zip file holding the collection and its photos.
//!
//! ```text
//! manifest.json          what the backup holds and when it was made
//! inkubator.json         the collection
//! images/<section>/...   every photo the collection references
//! replaced-photos/...    retired photos, when "keep replaced photos" is on
//! ```
//!
//! Restoring checks everything before touching the current data: archive size
//! and entry limits, safe paths, the collection's format and validity, and that
//! every referenced photo is present and decodes. The current state is saved as
//! a backup first, so a restore can always be undone.

use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::model::{BackupFrequency, Collection, Timestamp, SCHEMA_VERSION};
use crate::photos::{self, section_of};
use crate::storage::{parse_collection, revision_of, Loaded, Store, StoreError, COLLECTION_FILE};

pub const MAX_BACKUP_BYTES: u64 = 1024 * 1024 * 1024;
pub const MAX_EXPANDED_BYTES: u64 = 2 * 1024 * 1024 * 1024;
pub const MAX_ENTRIES: usize = 20_000;
const MANIFEST_FILE: &str = "manifest.json";
const MANIFEST_KIND: &str = "inkubator-backup";
const REPLACED_DIR: &str = "replaced-photos";
const DAY_MS: i64 = 24 * 60 * 60 * 1000;

#[derive(Debug, thiserror::Error)]
pub enum BackupError {
    #[error("the backup is larger than {} MB", MAX_BACKUP_BYTES / (1024 * 1024))]
    TooLarge,
    #[error("the backup holds too many files or expands too large")]
    TooManyEntries,
    #[error("this is not an Inkubator backup")]
    NotABackup,
    #[error("this backup is from Inkubator 2.x; use the 2.x import instead")]
    FromVersion2,
    #[error("the backup contains an unsafe or unexpected file: {0}")]
    UnexpectedEntry(String),
    #[error("the backup is missing photo {0}")]
    MissingPhoto(String),
    #[error("photo {path} in the backup can't be read: {reason}")]
    BadPhoto { path: String, reason: String },
    #[error("the backup file is damaged: {0}")]
    Damaged(String),
    #[error(transparent)]
    Store(#[from] StoreError),
}

type Result<T> = std::result::Result<T, BackupError>;

fn io_error<'a>(
    action: &'static str,
    path: &'a Path,
) -> impl FnOnce(io::Error) -> BackupError + 'a {
    move |source| {
        BackupError::Store(StoreError::Io {
            action,
            path: path.to_path_buf(),
            source,
        })
    }
}

fn zip_error(error: zip::result::ZipError) -> BackupError {
    BackupError::Damaged(error.to_string())
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Manifest {
    pub kind: String,
    pub schema_version: u32,
    pub app_version: String,
    pub created_at: Timestamp,
    /// Why the backup was made: "manual", "scheduled", "before-restore".
    pub reason: String,
    pub pens: usize,
    pub inks: usize,
    pub swatches: usize,
    pub photos: usize,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
/// A backup file found in the scheduled-backups folder.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct BackupFile {
    pub file_name: String,
    pub created_at: Timestamp,
    pub bytes: u64,
}

fn referenced_photos(c: &Collection) -> Vec<String> {
    let mut seen = HashSet::new();
    c.pens
        .iter()
        .flat_map(|p| &p.images)
        .chain(c.inks.iter().flat_map(|i| &i.images))
        .chain(c.swatches.iter().flat_map(|s| &s.images))
        .map(|image| image.path.clone())
        .filter(|path| seen.insert(path.clone()))
        .collect()
}

fn frequency_ms(frequency: BackupFrequency) -> Option<i64> {
    match frequency {
        BackupFrequency::Off => None,
        BackupFrequency::Daily => Some(DAY_MS),
        BackupFrequency::Weekly => Some(7 * DAY_MS),
        BackupFrequency::Monthly => Some(30 * DAY_MS),
    }
}

/// Scheduled backups are named `auto-<milliseconds>.zip`.
fn auto_backup_time(file_name: &str) -> Option<Timestamp> {
    file_name
        .strip_prefix("auto-")?
        .strip_suffix(".zip")?
        .parse()
        .ok()
}

impl Store {
    fn auto_backups_dir(&self) -> PathBuf {
        self.backups_dir().join("auto")
    }

    /// Writes a backup of the current collection to `destination`.
    pub fn write_backup(
        &self,
        destination: &Path,
        reason: &str,
        app_version: &str,
        now: Timestamp,
    ) -> Result<Manifest> {
        let _lock = self.lock()?;
        self.write_backup_unlocked(destination, reason, app_version, now)
    }

    fn write_backup_unlocked(
        &self,
        destination: &Path,
        reason: &str,
        app_version: &str,
        now: Timestamp,
    ) -> Result<Manifest> {
        let Loaded { collection, .. } = self.load_unlocked()?;
        let photos = referenced_photos(&collection);
        let manifest = Manifest {
            kind: MANIFEST_KIND.to_string(),
            schema_version: SCHEMA_VERSION,
            app_version: app_version.to_string(),
            created_at: now,
            reason: reason.to_string(),
            pens: collection.pens.len(),
            inks: collection.inks.len(),
            swatches: collection.swatches.len(),
            photos: photos.len(),
        };

        let parent = destination.parent().unwrap_or(Path::new("."));
        fs::create_dir_all(parent).map_err(io_error("could not create", parent))?;
        let staged = parent.join(format!(
            ".{}.tmp-{}",
            destination
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("backup.zip"),
            uuid::Uuid::new_v4().simple()
        ));

        let result = (|| -> Result<()> {
            let file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&staged)
                .map_err(io_error("could not create", &staged))?;
            let mut zip = ZipWriter::new(file);
            let deflated =
                SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
            // Photos are already compressed.
            let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

            zip.start_file(MANIFEST_FILE, deflated).map_err(zip_error)?;
            zip.write_all(&serde_json::to_vec_pretty(&manifest).expect("manifest serializes"))
                .map_err(io_error("could not write", &staged))?;
            zip.start_file(COLLECTION_FILE, deflated)
                .map_err(zip_error)?;
            zip.write_all(&serde_json::to_vec_pretty(&collection).expect("collection serializes"))
                .map_err(io_error("could not write", &staged))?;

            for photo in &photos {
                let path = self
                    .photo_file(photo)
                    .map_err(|_| BackupError::MissingPhoto(photo.clone()))?;
                let bytes = fs::read(&path).map_err(io_error("could not read", &path))?;
                zip.start_file(format!("images/{photo}"), stored)
                    .map_err(zip_error)?;
                zip.write_all(&bytes)
                    .map_err(io_error("could not write", &staged))?;
            }

            if collection.settings.backups.keep_replaced_photos {
                let replaced = self.root().join(REPLACED_DIR);
                for relative in walk_files(&replaced)? {
                    let bytes = fs::read(replaced.join(&relative))
                        .map_err(io_error("could not read", &replaced))?;
                    zip.start_file(format!("{REPLACED_DIR}/{relative}"), stored)
                        .map_err(zip_error)?;
                    zip.write_all(&bytes)
                        .map_err(io_error("could not write", &staged))?;
                }
            }

            let file = zip.finish().map_err(zip_error)?;
            file.sync_all()
                .map_err(io_error("could not sync", &staged))?;
            drop(file);
            fs::rename(&staged, destination).map_err(io_error("could not save", destination))
        })();
        if result.is_err() {
            let _ = fs::remove_file(&staged);
        }
        result.map(|()| manifest)
    }

    /// Scheduled backups, newest first.
    pub fn auto_backups(&self) -> Result<Vec<BackupFile>> {
        let dir = self.auto_backups_dir();
        let mut out = Vec::new();
        for entry in fs::read_dir(&dir).map_err(io_error("could not list", &dir))? {
            let entry = entry.map_err(io_error("could not list", &dir))?;
            let name = entry.file_name().to_string_lossy().to_string();
            let Some(created_at) = auto_backup_time(&name) else {
                continue;
            };
            let meta = entry
                .metadata()
                .map_err(io_error("could not inspect", &dir))?;
            if meta.is_file() {
                out.push(BackupFile {
                    file_name: name,
                    created_at,
                    bytes: meta.len(),
                });
            }
        }
        out.sort_by_key(|b| std::cmp::Reverse(b.created_at));
        Ok(out)
    }

    /// Makes a scheduled backup if the backup frequency says one is due, then
    /// deletes the oldest beyond the number to keep. Returns the new backup.
    pub fn auto_backup_if_due(
        &self,
        app_version: &str,
        now: Timestamp,
    ) -> Result<Option<BackupFile>> {
        let _lock = self.lock()?;
        let settings = self.load_unlocked()?.collection.settings.backups;
        let Some(interval) = frequency_ms(settings.frequency) else {
            return Ok(None);
        };
        if !self.collection_path().exists() {
            return Ok(None);
        }
        let existing = self.auto_backups()?;
        if existing
            .first()
            .is_some_and(|latest| now - latest.created_at < interval)
        {
            return Ok(None);
        }
        let name = format!("auto-{now}.zip");
        let path = self.auto_backups_dir().join(&name);
        self.write_backup_unlocked(&path, "scheduled", app_version, now)?;
        for old in self.auto_backups()?.iter().skip(settings.keep as usize) {
            let _ = fs::remove_file(self.auto_backups_dir().join(&old.file_name));
        }
        let bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        Ok(Some(BackupFile {
            file_name: name,
            created_at: now,
            bytes,
        }))
    }

    /// Replaces the current collection and photos with those in the backup at
    /// `zip_path`. The current state is first saved as a scheduled backup named
    /// with reason "before-restore".
    pub fn restore_backup(
        &self,
        zip_path: &Path,
        expected_revision: &str,
        app_version: &str,
        now: Timestamp,
    ) -> Result<Loaded> {
        let stage = self
            .root()
            .join(format!(".restore-{}", uuid::Uuid::new_v4().simple()));
        let result = self.restore_from_stage(zip_path, &stage, expected_revision, app_version, now);
        let _ = fs::remove_dir_all(&stage);
        result
    }

    fn restore_from_stage(
        &self,
        zip_path: &Path,
        stage: &Path,
        expected_revision: &str,
        app_version: &str,
        now: Timestamp,
    ) -> Result<Loaded> {
        extract(zip_path, stage)?;
        let manifest: Manifest = read_json(&stage.join(MANIFEST_FILE))?;
        if manifest.kind != MANIFEST_KIND {
            return Err(BackupError::NotABackup);
        }
        let collection_bytes =
            fs::read(stage.join(COLLECTION_FILE)).map_err(|_| BackupError::NotABackup)?;
        let collection = parse_collection(&collection_bytes, &stage.join(COLLECTION_FILE))?;
        for photo in referenced_photos(&collection) {
            let path = stage.join("images").join(&photo);
            let bytes = fs::read(&path).map_err(|_| BackupError::MissingPhoto(photo.clone()))?;
            photos::decode(&bytes).map_err(|e| BackupError::BadPhoto {
                path: photo.clone(),
                reason: e.to_string(),
            })?;
        }

        let _lock = self.lock()?;
        let current = self.load_unlocked()?;
        if current.revision != expected_revision {
            return Err(StoreError::Conflict {
                current: current.revision,
            }
            .into());
        }
        if self.collection_path().exists() {
            let safety = self.auto_backups_dir().join(format!("auto-{now}.zip"));
            self.write_backup_unlocked(&safety, "before-restore", app_version, now)?;
        }

        // Swap the photo folders, then write the collection. If writing fails,
        // put the old photos back.
        let images = self.images_dir();
        let old_images = self
            .root()
            .join(format!(".images-old-{}", uuid::Uuid::new_v4().simple()));
        fs::rename(&images, &old_images).map_err(io_error("could not move", &images))?;
        let staged_images = stage.join("images");
        fs::create_dir_all(&staged_images).map_err(io_error("could not create", &staged_images))?;
        if let Err(error) = fs::rename(&staged_images, &images) {
            let _ = fs::rename(&old_images, &images);
            return Err(io_error("could not move", &staged_images)(error));
        }
        if let Err(error) = crate::storage::atomic_write(&self.collection_path(), &collection_bytes)
        {
            let _ = fs::remove_dir_all(&images);
            let _ = fs::rename(&old_images, &images);
            return Err(error.into());
        }
        let _ = fs::remove_dir_all(&old_images);

        let staged_replaced = stage.join(REPLACED_DIR);
        if staged_replaced.is_dir() {
            let replaced = self.root().join(REPLACED_DIR);
            let _ = fs::remove_dir_all(&replaced);
            let _ = fs::rename(&staged_replaced, &replaced);
        }
        // Recreate the thumbnail folders; thumbnails are rebuilt on demand.
        Store::open(self.root())?;

        Ok(Loaded {
            collection,
            revision: revision_of(&collection_bytes),
        })
    }
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
    let bytes = fs::read(path).map_err(|_| BackupError::NotABackup)?;
    serde_json::from_slice(&bytes).map_err(|_| BackupError::NotABackup)
}

/// Relative paths of all regular files under `root`, using `/` separators.
fn walk_files(root: &Path) -> Result<Vec<String>> {
    let mut out = Vec::new();
    if !root.is_dir() {
        return Ok(out);
    }
    let mut pending = vec![root.to_path_buf()];
    while let Some(dir) = pending.pop() {
        for entry in fs::read_dir(&dir).map_err(io_error("could not list", &dir))? {
            let entry = entry.map_err(io_error("could not list", &dir))?;
            let kind = entry
                .file_type()
                .map_err(io_error("could not inspect", &dir))?;
            if kind.is_dir() {
                pending.push(entry.path());
            } else if kind.is_file() {
                let relative = entry
                    .path()
                    .strip_prefix(root)
                    .expect("inside root")
                    .to_string_lossy()
                    .replace('\\', "/");
                out.push(relative);
            }
        }
    }
    out.sort();
    Ok(out)
}

/// Whether an archive entry may be restored, and if so its relative path.
fn allowed_entry(name: &str) -> bool {
    if name == MANIFEST_FILE || name == COLLECTION_FILE {
        return true;
    }
    for prefix in ["images/", "replaced-photos/"] {
        if let Some(rest) = name.strip_prefix(prefix) {
            return section_of(rest).is_some();
        }
    }
    false
}

fn extract(zip_path: &Path, destination: &Path) -> Result<()> {
    let size = fs::metadata(zip_path)
        .map_err(io_error("could not open", zip_path))?
        .len();
    if size > MAX_BACKUP_BYTES {
        return Err(BackupError::TooLarge);
    }
    let file = File::open(zip_path).map_err(io_error("could not open", zip_path))?;
    let mut archive = ZipArchive::new(file).map_err(|_| BackupError::NotABackup)?;
    if archive.len() > MAX_ENTRIES {
        return Err(BackupError::TooManyEntries);
    }
    if archive.index_for_name("data.json").is_some()
        || archive.index_for_name("preferences.json").is_some()
    {
        return Err(BackupError::FromVersion2);
    }

    fs::create_dir_all(destination).map_err(io_error("could not create", destination))?;
    let mut expanded = 0u64;
    let mut seen = HashSet::new();
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(zip_error)?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        let safe = entry
            .enclosed_name()
            .is_some_and(|p| p.to_string_lossy().replace('\\', "/") == name);
        if !safe || !allowed_entry(&name) || !seen.insert(name.clone()) {
            return Err(BackupError::UnexpectedEntry(name));
        }
        let remaining = MAX_EXPANDED_BYTES.saturating_sub(expanded);
        if entry.size() > remaining {
            return Err(BackupError::TooManyEntries);
        }
        let out_path = destination.join(&name);
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(io_error("could not create", parent))?;
        }
        let mut out = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&out_path)
            .map_err(io_error("could not create", &out_path))?;
        let copied = io::copy(&mut (&mut entry).take(remaining + 1), &mut out)
            .map_err(|e| BackupError::Damaged(e.to_string()))?;
        if copied > remaining {
            return Err(BackupError::TooManyEntries);
        }
        expanded += copied;
    }
    Ok(())
}
