//! Storing, finding and retiring photos.
//!
//! Uploaded photos are re-encoded as WebP no larger than [`PHOTO_MAX_EDGE`] on
//! their long side, with a [`THUMB_MAX_EDGE`] thumbnail beside them. Paths are
//! always relative to `images/` (e.g. `pens/pilot-custom-74.webp`) and every
//! folder on the way is checked not to be a symlink.

use std::fs;
use std::io::{self, Cursor};
use std::path::{Component, Path, PathBuf};

use image::{ImageReader, Limits};

use crate::images::{is_managed_image_path, ImageSection};
use crate::storage::{atomic_write, Store, StoreError};

pub const PHOTO_MAX_EDGE: u32 = 1200;
pub const THUMB_MAX_EDGE: u32 = 480;
/// Lossy WebP quality, 0–100.
const WEBP_QUALITY: f32 = 82.0;
/// Largest upload accepted, before re-encoding.
pub const MAX_UPLOAD_BYTES: usize = 25 * 1024 * 1024;
const MAX_DECODE_PIXELS: u64 = 100_000_000;
const MAX_DECODE_ALLOC: u64 = 512 * 1024 * 1024;
const REPLACED_DIR: &str = "replaced-photos";

#[derive(Debug, thiserror::Error)]
pub enum PhotoError {
    #[error("the photo is larger than {} MB", MAX_UPLOAD_BYTES / (1024 * 1024))]
    TooLarge,
    #[error("the file is not a photo this app can read ({0})")]
    Unreadable(String),
    #[error("{0:?} is not a stored photo path")]
    InvalidPath(String),
    #[error("photo {0:?} was not found")]
    NotFound(String),
    #[error("{0} is a link or not a regular file")]
    NotARealFile(PathBuf),
    #[error(transparent)]
    Store(#[from] StoreError),
}

type Result<T> = std::result::Result<T, PhotoError>;

fn io_error<'a>(action: &'static str, path: &'a Path) -> impl FnOnce(io::Error) -> PhotoError + 'a {
    move |source| {
        PhotoError::Store(StoreError::Io {
            action,
            path: path.to_path_buf(),
            source,
        })
    }
}

/// The section a stored photo path belongs to, if the path is valid.
pub fn section_of(path: &str) -> Option<ImageSection> {
    ImageSection::ALL
        .into_iter()
        .find(|section| is_managed_image_path(path, *section))
}

/// Decodes a photo, refusing oversized or unreadable files.
pub fn decode(bytes: &[u8]) -> Result<image::DynamicImage> {
    if bytes.len() > MAX_UPLOAD_BYTES {
        return Err(PhotoError::TooLarge);
    }
    let reader = || {
        ImageReader::new(Cursor::new(bytes))
            .with_guessed_format()
            .map_err(|e| PhotoError::Unreadable(e.to_string()))
    };
    let (width, height) = reader()?
        .into_dimensions()
        .map_err(|e| PhotoError::Unreadable(e.to_string()))?;
    if u64::from(width) * u64::from(height) > MAX_DECODE_PIXELS {
        return Err(PhotoError::TooLarge);
    }
    let mut limits = Limits::default();
    limits.max_alloc = Some(MAX_DECODE_ALLOC);
    let mut decoder = reader()?;
    decoder.limits(limits);
    decoder
        .decode()
        .map_err(|e| PhotoError::Unreadable(e.to_string()))
}

/// Re-encodes `bytes` as WebP whose long side is at most `max_edge`.
pub fn encode_webp(bytes: &[u8], max_edge: u32) -> Result<Vec<u8>> {
    let image = decode(bytes)?;
    let image = if image.width() > max_edge || image.height() > max_edge {
        image.thumbnail(max_edge, max_edge)
    } else {
        image
    };
    // Lossy WebP: photos stay a fraction of the size of lossless encoding.
    let (width, height) = (image.width(), image.height());
    let encoded = if image.color().has_alpha() {
        let rgba = image.to_rgba8();
        webp::Encoder::from_rgba(&rgba, width, height).encode(WEBP_QUALITY)
    } else {
        let rgb = image.to_rgb8();
        webp::Encoder::from_rgb(&rgb, width, height).encode(WEBP_QUALITY)
    };
    Ok(encoded.to_vec())
}

/// A filename-safe version of `text`: lowercase ASCII letters, digits and dashes.
pub fn slug(text: &str) -> String {
    let mut out = String::new();
    for c in text.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    let out: String = out.trim_matches('-').chars().take(80).collect();
    let out = out.trim_end_matches('-').to_string();
    if out.is_empty() {
        "photo".to_string()
    } else {
        out
    }
}

/// Resolves `relative` inside `root`, refusing `..`, absolute parts and any
/// symlink along the way. The final entry may not exist yet.
fn resolve_inside(root: &Path, relative: &str) -> Result<PathBuf> {
    let mut current = root.to_path_buf();
    for component in Path::new(relative).components() {
        let Component::Normal(part) = component else {
            return Err(PhotoError::InvalidPath(relative.to_string()));
        };
        current.push(part);
        match fs::symlink_metadata(&current) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err(PhotoError::NotARealFile(current))
            }
            Ok(_) => {}
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(io_error("could not inspect", &current)(e)),
        }
    }
    Ok(current)
}

fn is_real_file(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok_and(|meta| meta.file_type().is_file())
}

impl Store {
    /// Stores an uploaded photo for `section` and returns its path, e.g.
    /// `pens/pilot-custom-74.webp`. `name` (usually the item's brand and model)
    /// becomes the filename.
    pub fn add_photo(&self, section: ImageSection, bytes: &[u8], name: &str) -> Result<String> {
        let photo = encode_webp(bytes, PHOTO_MAX_EDGE)?;
        let thumb = encode_webp(&photo, THUMB_MAX_EDGE)?;

        let _lock = self.lock()?;
        let stem = slug(name);
        let relative = (1..)
            .map(|n| match n {
                1 => format!("{}/{stem}.webp", section.dir()),
                n => format!("{}/{stem}-{n}.webp", section.dir()),
            })
            .find(|candidate| {
                !self.images_dir().join(candidate).exists()
                    && !self.thumbnails_dir().join(candidate).exists()
            })
            .expect("an unused name exists");

        let target = resolve_inside(&self.images_dir(), &relative)?;
        let thumb_target = resolve_inside(&self.thumbnails_dir(), &relative)?;
        atomic_write(&target, &photo)?;
        if let Err(error) = atomic_write(&thumb_target, &thumb) {
            let _ = fs::remove_file(&target);
            return Err(error.into());
        }
        Ok(relative)
    }

    /// The file of a stored photo, for serving it.
    pub fn photo_file(&self, relative: &str) -> Result<PathBuf> {
        if section_of(relative).is_none() {
            return Err(PhotoError::InvalidPath(relative.to_string()));
        }
        let path = resolve_inside(&self.images_dir(), relative)?;
        if !is_real_file(&path) {
            return Err(PhotoError::NotFound(relative.to_string()));
        }
        Ok(path)
    }

    /// The thumbnail of a stored photo, created first if it is missing.
    pub fn thumbnail_file(&self, relative: &str) -> Result<PathBuf> {
        let original = self.photo_file(relative)?;
        let path = resolve_inside(&self.thumbnails_dir(), relative)?;
        if is_real_file(&path) {
            return Ok(path);
        }
        let bytes = fs::read(&original).map_err(io_error("could not read", &original))?;
        let thumb = encode_webp(&bytes, THUMB_MAX_EDGE)?;
        let _lock = self.lock()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(io_error("could not create", parent))?;
        }
        atomic_write(&path, &thumb)?;
        Ok(path)
    }

    /// Deletes photos that nothing references any more, or moves them to
    /// `replaced-photos/` when `keep` is set. Photos that are still referenced
    /// (for example re-attached by a later edit) are left alone. Returns the
    /// paths actually retired.
    pub fn retire_photos(&self, paths: &[String], keep: bool) -> Result<Vec<String>> {
        let _lock = self.lock()?;
        let collection = self.load_unlocked()?.collection;
        let referenced: std::collections::HashSet<&str> = collection
            .pens
            .iter()
            .flat_map(|p| &p.images)
            .chain(collection.inks.iter().flat_map(|i| &i.images))
            .chain(collection.swatches.iter().flat_map(|s| &s.images))
            .map(|image| image.path.as_str())
            .collect();

        let mut retired = Vec::new();
        for relative in paths {
            if referenced.contains(relative.as_str()) || section_of(relative).is_none() {
                continue;
            }
            let thumb = resolve_inside(&self.thumbnails_dir(), relative)?;
            if is_real_file(&thumb) {
                fs::remove_file(&thumb).map_err(io_error("could not delete", &thumb))?;
            }
            let photo = resolve_inside(&self.images_dir(), relative)?;
            if !is_real_file(&photo) {
                continue;
            }
            if keep {
                let archive = self.root().join(REPLACED_DIR);
                let mut destination = resolve_inside(&archive, relative)?;
                if let Some(parent) = destination.parent() {
                    fs::create_dir_all(parent).map_err(io_error("could not create", parent))?;
                }
                let stem = destination
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("photo")
                    .to_string();
                let mut n = 2;
                while destination.exists() {
                    destination.set_file_name(format!("{stem}-{n}.webp"));
                    n += 1;
                }
                fs::rename(&photo, &destination).map_err(io_error("could not move", &photo))?;
            } else {
                fs::remove_file(&photo).map_err(io_error("could not delete", &photo))?;
            }
            retired.push(relative.clone());
        }
        Ok(retired)
    }
}
