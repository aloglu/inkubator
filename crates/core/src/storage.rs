//! On-disk storage for a collection.
//!
//! Layout of a storage root:
//!
//! ```text
//! inkubator.json        the whole collection
//! images/pens/...       photos, one folder per item type
//! images/.thumbs/...    generated thumbnails, same structure
//! backups/auto/         scheduled backups
//! backups/manual/       backups made on request
//! .inkubator.lock       held while reading or writing
//! ```
//!
//! Writes are atomic (write a synced temporary file, then rename over the
//! target) and guarded by a file lock. Every load returns a revision; a save
//! must name the revision it started from, so a stale window cannot overwrite
//! newer data.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use crate::commands::{self, Command, CommandError, Outcome};
use crate::images::ImageSection;
use crate::model::{Collection, Timestamp, SCHEMA_VERSION};
use crate::retention::apply_retention;
use crate::validate::{validate, ValidationError};

pub const COLLECTION_FILE: &str = "inkubator.json";
const LOCK_FILE: &str = ".inkubator.lock";
/// Revision reported when no collection has been saved yet.
pub const EMPTY_REVISION: &str = "empty";

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("{action} {path}: {source}")]
    Io {
        action: &'static str,
        path: PathBuf,
        source: io::Error,
    },
    #[error("{path} is not a real directory")]
    NotADirectory { path: PathBuf },
    #[error("could not read {path}: {source}")]
    Parse {
        path: PathBuf,
        source: serde_json::Error,
    },
    #[error("{path} uses data format {found}; this version reads format {SCHEMA_VERSION}")]
    UnsupportedVersion { path: PathBuf, found: u64 },
    #[error(transparent)]
    Invalid(#[from] ValidationError),
    #[error("the collection changed since it was loaded (now at revision {current})")]
    Conflict { current: String },
    #[error(transparent)]
    Command(#[from] CommandError),
}

type Result<T> = std::result::Result<T, StoreError>;

fn io_err<'a>(action: &'static str, path: &'a Path) -> impl FnOnce(io::Error) -> StoreError + 'a {
    move |source| StoreError::Io {
        action,
        path: path.to_path_buf(),
        source,
    }
}

/// A collection together with the revision it was read at.
#[derive(Clone, Debug, PartialEq)]
pub struct Loaded {
    pub collection: Collection,
    pub revision: String,
}

#[derive(Clone, Debug)]
pub struct Store {
    root: PathBuf,
}

impl Store {
    /// Opens a storage root, creating the folder structure if needed. Refuses
    /// symlinked folders so writes can't be redirected outside the root.
    pub fn open(root: impl Into<PathBuf>) -> Result<Self> {
        let root = root.into();
        fs::create_dir_all(&root).map_err(io_err("could not create", &root))?;
        let store = Self { root };
        store.ensure_tree()?;
        Ok(store)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn collection_path(&self) -> PathBuf {
        self.root.join(COLLECTION_FILE)
    }

    pub fn images_dir(&self) -> PathBuf {
        self.root.join("images")
    }

    pub fn thumbnails_dir(&self) -> PathBuf {
        self.images_dir().join(".thumbs")
    }

    pub fn backups_dir(&self) -> PathBuf {
        self.root.join("backups")
    }

    fn ensure_tree(&self) -> Result<()> {
        ensure_real_dir(&self.root)?;
        let images = self.images_dir();
        let thumbs = self.thumbnails_dir();
        ensure_real_dir(&images)?;
        ensure_real_dir(&thumbs)?;
        for section in ImageSection::ALL {
            ensure_real_dir(&images.join(section.dir()))?;
            ensure_real_dir(&thumbs.join(section.dir()))?;
        }
        let backups = self.backups_dir();
        ensure_real_dir(&backups)?;
        ensure_real_dir(&backups.join("auto"))?;
        ensure_real_dir(&backups.join("manual"))?;
        Ok(())
    }

    /// Takes the storage lock for the life of the returned guard.
    pub fn lock(&self) -> Result<StorageLock> {
        let path = self.root.join(LOCK_FILE);
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(&path)
            .map_err(io_err("could not open", &path))?;
        file.lock().map_err(io_err("could not lock", &path))?;
        Ok(StorageLock { file })
    }

    /// Reads the collection. A root with no collection yet yields an empty one.
    pub fn load(&self) -> Result<Loaded> {
        let _lock = self.lock()?;
        self.load_unlocked()
    }

    fn load_unlocked(&self) -> Result<Loaded> {
        let path = self.collection_path();
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return Ok(Loaded {
                    collection: Collection::empty(),
                    revision: EMPTY_REVISION.to_string(),
                })
            }
            Err(error) => return Err(io_err("could not read", &path)(error)),
        };
        let collection = parse_collection(&bytes, &path)?;
        Ok(Loaded {
            collection,
            revision: revision_of(&bytes),
        })
    }

    /// Validates and writes the collection, returning the new revision.
    ///
    /// `expected_revision` is the revision the caller loaded. If the stored
    /// collection has changed since, nothing is written and
    /// [`StoreError::Conflict`] is returned.
    pub fn save(&self, collection: &Collection, expected_revision: &str) -> Result<String> {
        validate(collection)?;
        let bytes = serde_json::to_vec_pretty(collection).expect("collection serializes");

        let _lock = self.lock()?;
        let current = self.current_revision()?;
        if current != expected_revision {
            return Err(StoreError::Conflict { current });
        }
        atomic_write(&self.collection_path(), &bytes)?;
        Ok(revision_of(&bytes))
    }

    /// Applies one command to the stored collection: checks the revision, applies
    /// the change, prunes history past the retention limit, validates and writes,
    /// all under the storage lock. Returns the new state and what the command
    /// left unused.
    pub fn apply(
        &self,
        command: Command,
        expected_revision: &str,
        now: Timestamp,
    ) -> Result<(Loaded, Outcome)> {
        let _lock = self.lock()?;
        let Loaded {
            mut collection,
            revision,
        } = self.load_unlocked()?;
        if revision != expected_revision {
            return Err(StoreError::Conflict { current: revision });
        }
        let outcome = commands::apply(&mut collection, command, now)?;
        apply_retention(&mut collection, now);
        validate(&collection)?;
        let bytes = serde_json::to_vec_pretty(&collection).expect("collection serializes");
        atomic_write(&self.collection_path(), &bytes)?;
        Ok((
            Loaded {
                collection,
                revision: revision_of(&bytes),
            },
            outcome,
        ))
    }

    fn current_revision(&self) -> Result<String> {
        let path = self.collection_path();
        match fs::read(&path) {
            Ok(bytes) => Ok(revision_of(&bytes)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(EMPTY_REVISION.to_string()),
            Err(error) => Err(io_err("could not read", &path)(error)),
        }
    }
}

/// Holds the storage lock until dropped.
pub struct StorageLock {
    file: File,
}

impl Drop for StorageLock {
    fn drop(&mut self) {
        let _ = self.file.unlock();
    }
}

/// Parses and checks a stored collection.
pub fn parse_collection(bytes: &[u8], path: &Path) -> Result<Collection> {
    let raw: serde_json::Value =
        serde_json::from_slice(bytes).map_err(|source| StoreError::Parse {
            path: path.to_path_buf(),
            source,
        })?;
    let found = raw
        .get("schema_version")
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(0);
    if found != u64::from(SCHEMA_VERSION) {
        return Err(StoreError::UnsupportedVersion {
            path: path.to_path_buf(),
            found,
        });
    }
    let collection: Collection =
        serde_json::from_value(raw).map_err(|source| StoreError::Parse {
            path: path.to_path_buf(),
            source,
        })?;
    validate(&collection)?;
    Ok(collection)
}

/// Content fingerprint of a stored collection (FNV-1a, 128-bit).
pub fn revision_of(bytes: &[u8]) -> String {
    const OFFSET: u128 = 0x6c62272e07bb014262b821756295c58d;
    const PRIME: u128 = 0x0000000001000000000000000000013b;
    let hash = bytes.iter().fold(OFFSET, |hash, byte| {
        (hash ^ u128::from(*byte)).wrapping_mul(PRIME)
    });
    format!("r3-{hash:032x}")
}

fn ensure_real_dir(path: &Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_dir() => Ok(()),
        Ok(_) => Err(StoreError::NotADirectory {
            path: path.to_path_buf(),
        }),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            fs::create_dir(path).map_err(io_err("could not create", path))?;
            if let Some(parent) = path.parent() {
                sync_dir(parent)?;
            }
            Ok(())
        }
        Err(error) => Err(io_err("could not inspect", path)(error)),
    }
}

/// Writes `bytes` to `path` so that readers see either the old or the new
/// content, never a partial file.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().unwrap_or(Path::new("."));
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("file");
    let staged = parent.join(format!(".{name}.tmp-{}", uuid::Uuid::new_v4().simple()));

    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&staged)
            .map_err(io_err("could not create", &staged))?;
        file.write_all(bytes)
            .map_err(io_err("could not write", &staged))?;
        file.sync_all().map_err(io_err("could not sync", &staged))?;
        drop(file);
        replace_file(&staged, path)?;
        sync_dir(parent)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&staged);
    }
    result
}

#[cfg(not(windows))]
fn replace_file(staged: &Path, destination: &Path) -> Result<()> {
    fs::rename(staged, destination).map_err(io_err("could not replace", destination))
}

#[cfg(windows)]
fn replace_file(staged: &Path, destination: &Path) -> Result<()> {
    use std::{ffi::c_void, os::windows::ffi::OsStrExt, ptr};

    if !destination.exists() {
        return fs::rename(staged, destination).map_err(io_err("could not replace", destination));
    }

    #[link(name = "Kernel32")]
    unsafe extern "system" {
        #[link_name = "ReplaceFileW"]
        fn replace_file_w(
            replaced: *const u16,
            replacement: *const u16,
            backup: *const u16,
            flags: u32,
            exclude: *mut c_void,
            reserved: *mut c_void,
        ) -> i32;
    }

    let wide = |path: &Path| {
        path.as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect::<Vec<u16>>()
    };
    let (destination_w, staged_w) = (wide(destination), wide(staged));
    // SAFETY: both buffers are NUL-terminated and outlive the call.
    let ok = unsafe {
        replace_file_w(
            destination_w.as_ptr(),
            staged_w.as_ptr(),
            ptr::null(),
            0,
            ptr::null_mut(),
            ptr::null_mut(),
        )
    };
    if ok == 0 {
        return Err(io_err("could not replace", destination)(
            io::Error::last_os_error(),
        ));
    }
    Ok(())
}

#[cfg(unix)]
fn sync_dir(path: &Path) -> Result<()> {
    File::open(path)
        .and_then(|dir| dir.sync_all())
        .map_err(io_err("could not sync", path))
}

#[cfg(not(unix))]
fn sync_dir(_path: &Path) -> Result<()> {
    // Directories can't be opened for syncing portably on Windows; the rename
    // above is already durable there.
    Ok(())
}
