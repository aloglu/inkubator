mod common;

use std::io::Cursor;

use common::*;
use inkubator_core::images::ImageSection;
use inkubator_core::photos::{slug, PhotoError, PHOTO_MAX_EDGE, THUMB_MAX_EDGE};
use inkubator_core::storage::EMPTY_REVISION;
use inkubator_core::*;

fn png(width: u32, height: u32) -> Vec<u8> {
    let image = image::RgbImage::from_fn(width, height, |x, y| {
        image::Rgb([(x % 256) as u8, (y % 256) as u8, 128])
    });
    let mut out = Cursor::new(Vec::new());
    image.write_to(&mut out, image::ImageFormat::Png).unwrap();
    out.into_inner()
}

fn dimensions(path: &std::path::Path) -> (u32, u32) {
    image::image_dimensions(path).unwrap()
}

fn store() -> (tempfile::TempDir, Store) {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(dir.path()).unwrap();
    (dir, store)
}

#[test]
fn uploads_are_resized_and_get_a_thumbnail() {
    let (_dir, store) = store();
    let path = store
        .add_photo(ImageSection::Pens, &png(3000, 1500), "Pilot Custom 74")
        .unwrap();
    assert_eq!(path, "pens/pilot-custom-74.webp");

    let file = store.photo_file(&path).unwrap();
    assert_eq!(dimensions(&file), (PHOTO_MAX_EDGE, PHOTO_MAX_EDGE / 2));
    let thumb = store.thumbnail_file(&path).unwrap();
    assert_eq!(dimensions(&thumb), (THUMB_MAX_EDGE, THUMB_MAX_EDGE / 2));
    assert_eq!(&std::fs::read(&file).unwrap()[8..12], b"WEBP");
    let (photo_bytes, thumb_bytes) = (
        std::fs::metadata(&file).unwrap().len(),
        std::fs::metadata(&thumb).unwrap().len(),
    );
    assert!(
        thumb_bytes < photo_bytes,
        "thumbnail {thumb_bytes}B vs photo {photo_bytes}B"
    );
    assert!(
        photo_bytes < 300_000,
        "lossy encoding keeps photos small: {photo_bytes}B"
    );
}

#[test]
fn small_photos_are_not_enlarged_and_names_never_collide() {
    let (_dir, store) = store();
    let first = store
        .add_photo(ImageSection::Inks, &png(200, 100), "Kon-peki!")
        .unwrap();
    let second = store
        .add_photo(ImageSection::Inks, &png(200, 100), "Kon-peki!")
        .unwrap();
    assert_eq!(
        (first.as_str(), second.as_str()),
        ("inks/kon-peki.webp", "inks/kon-peki-2.webp")
    );
    assert_eq!(dimensions(&store.photo_file(&first).unwrap()), (200, 100));
}

#[test]
fn files_that_are_not_photos_are_refused() {
    let (_dir, store) = store();
    assert!(matches!(
        store.add_photo(ImageSection::Pens, b"not an image", "x"),
        Err(PhotoError::Unreadable(_))
    ));
}

#[test]
fn only_stored_photo_paths_can_be_served() {
    let (_dir, store) = store();
    for bad in [
        "../inkubator.json",
        "pens/../../etc/passwd",
        "/etc/passwd",
        "notes/a.webp",
    ] {
        assert!(
            matches!(store.photo_file(bad), Err(PhotoError::InvalidPath(_))),
            "{bad}"
        );
    }
    assert!(matches!(
        store.photo_file("pens/missing.webp"),
        Err(PhotoError::NotFound(_))
    ));
}

#[cfg(unix)]
#[test]
fn symlinked_photos_are_refused() {
    let (dir, store) = store();
    let outside = dir.path().join("secret.webp");
    std::fs::write(&outside, b"secret").unwrap();
    std::os::unix::fs::symlink(&outside, dir.path().join("images/pens/link.webp")).unwrap();
    assert!(matches!(
        store.photo_file("pens/link.webp"),
        Err(PhotoError::NotARealFile(_))
    ));
}

#[test]
fn a_missing_thumbnail_is_recreated() {
    let (_dir, store) = store();
    let path = store
        .add_photo(ImageSection::Swatches, &png(900, 900), "Swatch")
        .unwrap();
    let thumb = store.thumbnail_file(&path).unwrap();
    std::fs::remove_file(&thumb).unwrap();
    let again = store.thumbnail_file(&path).unwrap();
    assert_eq!(dimensions(&again), (THUMB_MAX_EDGE, THUMB_MAX_EDGE));
}

#[test]
fn retiring_skips_photos_that_are_still_used() {
    let (dir, store) = store();
    let used = store
        .add_photo(ImageSection::Pens, &png(10, 10), "Used")
        .unwrap();
    let unused = store
        .add_photo(ImageSection::Pens, &png(10, 10), "Unused")
        .unwrap();
    let mut c = sample();
    let mut image = Image::new("img_1", used.clone());
    image.primary = true;
    c.pens[0].images.push(image);
    store.save(&c, EMPTY_REVISION).unwrap();

    let retired = store
        .retire_photos(&[used.clone(), unused.clone()], false)
        .unwrap();
    assert_eq!(retired, vec![unused.clone()]);
    assert!(store.photo_file(&used).is_ok());
    assert!(!dir.path().join("images").join(&unused).exists());
    assert!(!dir.path().join("images/.thumbs").join(&unused).exists());
}

#[test]
fn retired_photos_can_be_kept_aside() {
    let (dir, store) = store();
    let first = store
        .add_photo(ImageSection::Pens, &png(10, 10), "Old")
        .unwrap();
    store
        .retire_photos(std::slice::from_ref(&first), true)
        .unwrap();
    // A new photo can reuse the name; retiring it again doesn't overwrite the first.
    let second = store
        .add_photo(ImageSection::Pens, &png(10, 10), "Old")
        .unwrap();
    assert_eq!(first, second);
    store.retire_photos(&[second], true).unwrap();
    let kept = dir.path().join("replaced-photos/pens");
    assert!(kept.join("old.webp").is_file());
    assert!(kept.join("old-2.webp").is_file());
}

#[test]
fn slugs_are_filename_safe() {
    assert_eq!(slug("Pilot Custom 74"), "pilot-custom-74");
    assert_eq!(
        slug("  J. Herbin — 1670 / Émeraude "),
        "j-herbin-1670-meraude"
    );
    assert_eq!(slug("../.."), "photo");
    assert_eq!(slug(&"a".repeat(200)).len(), 80);
}
