mod common;

use common::*;
use inkubator_core::retention::apply_retention;
use inkubator_core::storage::{revision_of, EMPTY_REVISION};
use inkubator_core::*;

fn problems(c: &Collection) -> Vec<String> {
    match validate(c) {
        Ok(()) => vec![],
        Err(ValidationError(problems)) => problems.iter().map(ToString::to_string).collect(),
    }
}

// ---------- validation ----------

#[test]
fn sample_collection_is_valid() {
    assert_eq!(problems(&sample()), Vec::<String>::new());
}

#[test]
fn a_pen_cannot_hold_two_inks_at_once() {
    let mut c = sample();
    c.fills[0].emptied_at = None;
    assert!(problems(&c).iter().any(|p| p.contains("still open")));

    let mut c = sample();
    c.fills[0].emptied_at = Some(T0 + 3 * DAY);
    assert!(problems(&c).iter().any(|p| p.contains("overlaps")));
}

#[test]
fn references_and_formats_are_checked() {
    let mut c = sample();
    c.fills[1].ink_id = "missing".into();
    c.pens[0].colors.push("red".into());
    c.pens[0].purchased_on = Some("June 2022".into());
    c.inks[0].base_color = "#1E6B6E".into();
    c.swatches.push(Swatch {
        id: "sw_1".into(),
        ink_id: "nope".into(),
        paper: String::new(),
        nib: String::new(),
        sampled_on: None,
        notes: String::new(),
        notes_public: false,
        images: vec![],
        created_at: T0,
        updated_at: T0,
    });
    let found = problems(&c);
    for expected in [
        "fills[1].ink_id",
        "pens[0].colors[1]",
        "pens[0].purchased_on",
        "inks[0].base_color",
        "swatches[0].ink_id",
    ] {
        assert!(
            found.iter().any(|p| p.starts_with(expected)),
            "{expected} in {found:?}"
        );
    }
}

#[test]
fn photos_need_one_primary_and_sane_crop_values() {
    let mut c = sample();
    let mut a = Image::new("img_a", "pens/a.webp");
    let mut b = Image::new("img_b", "pens/b.webp");
    a.zoom = 0.5;
    b.focus_x = 1.5;
    c.pens[0].images = vec![a, b];
    let found = problems(&c);
    assert!(found.iter().any(|p| p.contains("exactly one primary")));
    assert!(found.iter().any(|p| p.contains("zoom")));
    assert!(found.iter().any(|p| p.contains("focus_x")));

    let mut c = sample();
    let mut wrong_folder = Image::new("img_a", "inks/a.webp");
    wrong_folder.primary = true;
    c.pens[0].images = vec![wrong_folder];
    assert!(problems(&c).iter().any(|p| p.contains("inside pens/")));
}

#[test]
fn duplicate_ids_are_rejected() {
    let mut c = sample();
    c.pens.push(pen("pen_1"));
    assert!(problems(&c).iter().any(|p| p.contains("duplicate id")));
}

// ---------- retention ----------

#[test]
fn keep_forever_prunes_nothing() {
    let mut c = sample();
    let pruned = apply_retention(&mut c, T0 + 1000 * DAY);
    assert_eq!((pruned.activity, pruned.fills), (0, 0));
    assert_eq!(c.fills.len(), 2);
}

#[test]
fn a_retention_limit_prunes_old_activity_and_finished_fills_but_not_current_ones() {
    let mut c = sample();
    c.settings.activity.retention = Retention::Days(30);
    c.activity.push(ActivityEntry {
        id: "act_old".into(),
        at: T0,
        subject: Subject::Pen,
        action: Action::Inked,
        subject_id: "pen_1".into(),
        label: "Pilot Custom 74".into(),
        previous_ink_id: None,
        ink_id: Some("ink_2".into()),
        changes: vec![],
    });
    let pruned = apply_retention(&mut c, T0 + 100 * DAY);
    assert_eq!((pruned.activity, pruned.fills), (1, 1));
    assert_eq!(c.fills.len(), 1);
    assert!(c.fills[0].emptied_at.is_none(), "the current fill is kept");
}

// ---------- storage ----------

#[test]
fn a_new_store_starts_empty_and_round_trips() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(dir.path()).unwrap();
    let loaded = store.load().unwrap();
    assert_eq!(loaded.revision, EMPTY_REVISION);
    assert_eq!(loaded.collection, Collection::empty());

    let c = sample();
    let revision = store.save(&c, EMPTY_REVISION).unwrap();
    let loaded = store.load().unwrap();
    assert_eq!(loaded.collection, c);
    assert_eq!(loaded.revision, revision);
    assert!(dir.path().join("images/pens").is_dir());
    assert!(dir.path().join("images/.thumbs/swatches").is_dir());
    assert!(dir.path().join("backups/auto").is_dir());
}

#[test]
fn saving_from_a_stale_revision_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(dir.path()).unwrap();
    let first = store.save(&sample(), EMPTY_REVISION).unwrap();

    let mut newer = sample();
    newer.pens[0].notes = "changed in another window".into();
    store.save(&newer, &first).unwrap();

    let mut stale = sample();
    stale.pens[0].notes = "stale edit".into();
    match store.save(&stale, &first) {
        Err(StoreError::Conflict { current }) => assert_ne!(current, first),
        other => panic!("expected a conflict, got {other:?}"),
    }
    assert_eq!(
        store.load().unwrap().collection.pens[0].notes,
        "changed in another window"
    );
}

#[test]
fn invalid_collections_are_never_written() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(dir.path()).unwrap();
    let mut bad = sample();
    bad.fills[1].pen_id = "ghost".into();
    assert!(matches!(
        store.save(&bad, EMPTY_REVISION),
        Err(StoreError::Invalid(_))
    ));
    assert!(!store.collection_path().exists());
}

#[test]
fn other_data_formats_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(dir.path()).unwrap();
    std::fs::write(store.collection_path(), br#"{"pens":[],"inks":[]}"#).unwrap();
    assert!(matches!(
        store.load(),
        Err(StoreError::UnsupportedVersion { found: 0, .. })
    ));
}

#[cfg(unix)]
#[test]
fn symlinked_folders_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let elsewhere = tempfile::tempdir().unwrap();
    std::os::unix::fs::symlink(elsewhere.path(), dir.path().join("images")).unwrap();
    assert!(matches!(
        Store::open(dir.path()),
        Err(StoreError::NotADirectory { .. })
    ));
}

#[test]
fn revisions_follow_content() {
    assert_eq!(revision_of(b"abc"), revision_of(b"abc"));
    assert_ne!(revision_of(b"abc"), revision_of(b"abd"));
}
