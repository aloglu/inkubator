mod common;

use std::io::{Cursor, Write};
use std::path::Path;

use common::*;
use inkubator_core::backup::BackupError;
use inkubator_core::images::ImageSection;
use inkubator_core::storage::EMPTY_REVISION;
use inkubator_core::*;
use zip::write::SimpleFileOptions;

const VERSION: &str = "3.0.0-test";
const NOW: Timestamp = T0 + 30 * DAY;

fn png() -> Vec<u8> {
    let image = image::RgbImage::from_pixel(40, 30, image::Rgb([30, 107, 110]));
    let mut out = Cursor::new(Vec::new());
    image.write_to(&mut out, image::ImageFormat::Png).unwrap();
    out.into_inner()
}

/// A store holding the sample collection with one pen photo.
fn filled_store() -> (tempfile::TempDir, Store, String) {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(dir.path()).unwrap();
    let path = store
        .add_photo(ImageSection::Pens, &png(), "Pilot Custom 74")
        .unwrap();
    let mut c = sample();
    let mut image = Image::new("img_1", path);
    image.primary = true;
    c.pens[0].images.push(image);
    let revision = store.save(&c, EMPTY_REVISION).unwrap();
    (dir, store, revision)
}

fn zip_with(entries: &[(&str, &[u8])]) -> tempfile::NamedTempFile {
    let file = tempfile::NamedTempFile::new().unwrap();
    let mut zip = zip::ZipWriter::new(file.reopen().unwrap());
    for (name, bytes) in entries {
        zip.start_file(*name, SimpleFileOptions::default()).unwrap();
        zip.write_all(bytes).unwrap();
    }
    zip.finish().unwrap();
    file
}

#[test]
fn a_backup_restores_the_collection_and_photos() {
    let (dir, store, _) = filled_store();
    let backup = dir.path().join("my-backup.zip");
    let manifest = store.write_backup(&backup, "manual", VERSION, NOW).unwrap();
    assert_eq!((manifest.pens, manifest.inks, manifest.photos), (1, 2, 1));
    let original = store.load().unwrap().collection;

    // Change everything: delete the pen (its photo goes unused) and retire the photo.
    let current = store.load().unwrap().revision;
    let (state, outcome) = store
        .apply(Command::DeletePen { id: "pen_1".into() }, &current, NOW)
        .unwrap();
    store.retire_photos(&outcome.unused_images, false).unwrap();
    assert!(store.photo_file("pens/pilot-custom-74.webp").is_err());

    let restored = store
        .restore_backup(&backup, &state.revision, VERSION, NOW + 1)
        .unwrap();
    assert_eq!(restored.collection, original);
    assert_eq!(store.load().unwrap(), restored);
    assert!(store.photo_file("pens/pilot-custom-74.webp").is_ok());
    assert!(
        store.thumbnail_file("pens/pilot-custom-74.webp").is_ok(),
        "thumbnails rebuild"
    );
}

#[test]
fn restoring_first_saves_the_current_state() {
    let (dir, store, revision) = filled_store();
    let backup = dir.path().join("b.zip");
    store.write_backup(&backup, "manual", VERSION, NOW).unwrap();
    let (state, _) = store
        .apply(Command::DeletePen { id: "pen_1".into() }, &revision, NOW)
        .unwrap();

    store
        .restore_backup(&backup, &state.revision, VERSION, NOW + 5)
        .unwrap();
    let safety = store.auto_backups().unwrap();
    assert_eq!(safety.len(), 1);
    assert_eq!(safety[0].created_at, NOW + 5);

    // The safety backup holds the state from just before the restore.
    let other = tempfile::tempdir().unwrap();
    let other_store = Store::open(other.path()).unwrap();
    let path = store.backups_dir().join("auto").join(&safety[0].file_name);
    let undone = other_store
        .restore_backup(&path, EMPTY_REVISION, VERSION, NOW + 6)
        .unwrap();
    assert!(undone.collection.pens.is_empty());
}

#[test]
fn a_stale_window_cannot_restore() {
    let (dir, store, revision) = filled_store();
    let backup = dir.path().join("b.zip");
    store.write_backup(&backup, "manual", VERSION, NOW).unwrap();
    store
        .apply(Command::DeletePen { id: "pen_1".into() }, &revision, NOW)
        .unwrap();
    assert!(matches!(
        store.restore_backup(&backup, &revision, VERSION, NOW),
        Err(BackupError::Store(StoreError::Conflict { .. }))
    ));
}

#[test]
fn unsafe_or_foreign_archives_are_refused_without_changing_anything() {
    let (_dir, store, revision) = filled_store();
    let before = store.load().unwrap();
    let collection = serde_json::to_vec(&before.collection).unwrap();
    let manifest = br#"{"kind":"inkubator-backup","schema_version":3,"app_version":"x","created_at":1,"reason":"manual","pens":1,"inks":2,"swatches":0,"photos":1}"#;

    let cases: Vec<(&str, tempfile::NamedTempFile)> = vec![
        (
            "2.x backup",
            zip_with(&[("data.json", b"{}"), ("preferences.json", b"{}")]),
        ),
        ("escaping path", zip_with(&[("../evil.webp", b"x")])),
        (
            "unexpected file",
            zip_with(&[("manifest.json", manifest), ("notes.txt", b"x")]),
        ),
        (
            "missing photo",
            zip_with(&[("manifest.json", manifest), ("inkubator.json", &collection)]),
        ),
        (
            "corrupt photo",
            zip_with(&[
                ("manifest.json", manifest),
                ("inkubator.json", &collection),
                ("images/pens/pilot-custom-74.webp", b"not a photo"),
            ]),
        ),
        ("not a zip", {
            let file = tempfile::NamedTempFile::new().unwrap();
            std::fs::write(file.path(), b"hello").unwrap();
            file
        }),
    ];
    for (label, archive) in cases {
        let result = store.restore_backup(archive.path(), &revision, VERSION, NOW);
        let expected = match label {
            "2.x backup" => matches!(result, Err(BackupError::FromVersion2)),
            "escaping path" | "unexpected file" => {
                matches!(result, Err(BackupError::UnexpectedEntry(_)))
            }
            "missing photo" => matches!(result, Err(BackupError::MissingPhoto(_))),
            "corrupt photo" => matches!(result, Err(BackupError::BadPhoto { .. })),
            _ => matches!(result, Err(BackupError::NotABackup)),
        };
        assert!(expected, "{label}: {result:?}");
        assert_eq!(store.load().unwrap(), before, "{label} changed the data");
    }
    assert!(store.photo_file("pens/pilot-custom-74.webp").is_ok());
}

#[test]
fn scheduled_backups_follow_the_frequency_and_keep_limit() {
    let (_dir, store, revision) = filled_store();
    let mut settings = store.load().unwrap().collection.settings;
    settings.backups.keep = 2;
    store
        .apply(Command::UpdateSettings { settings }, &revision, NOW)
        .unwrap();

    let first = store.auto_backup_if_due(VERSION, NOW).unwrap();
    assert!(first.is_some());
    assert!(
        store
            .auto_backup_if_due(VERSION, NOW + DAY / 2)
            .unwrap()
            .is_none(),
        "not due yet"
    );
    store
        .auto_backup_if_due(VERSION, NOW + DAY)
        .unwrap()
        .unwrap();
    store
        .auto_backup_if_due(VERSION, NOW + 2 * DAY)
        .unwrap()
        .unwrap();

    let kept: Vec<Timestamp> = store
        .auto_backups()
        .unwrap()
        .iter()
        .map(|b| b.created_at)
        .collect();
    assert_eq!(
        kept,
        vec![NOW + 2 * DAY, NOW + DAY],
        "oldest pruned, newest first"
    );
}

#[test]
fn scheduled_backups_can_be_turned_off() {
    let (_dir, store, revision) = filled_store();
    let mut settings = store.load().unwrap().collection.settings;
    settings.backups.frequency = BackupFrequency::Off;
    store
        .apply(Command::UpdateSettings { settings }, &revision, NOW)
        .unwrap();
    assert!(store.auto_backup_if_due(VERSION, NOW).unwrap().is_none());
}

#[test]
fn an_empty_store_makes_no_scheduled_backup() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(dir.path()).unwrap();
    assert!(store.auto_backup_if_due(VERSION, NOW).unwrap().is_none());
    assert!(!Path::new(&store.backups_dir().join("auto"))
        .read_dir()
        .unwrap()
        .any(|_| true));
}
