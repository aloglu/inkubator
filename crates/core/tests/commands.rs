mod common;

use common::*;
use inkubator_core::storage::EMPTY_REVISION;
use inkubator_core::*;

const LATER: Timestamp = T0 + 10 * DAY;

fn run(c: &mut Collection, command: Command) -> Result<Outcome, CommandError> {
    let result = apply(c, command, LATER);
    if result.is_ok() {
        validate(c).expect("a successful command leaves a valid collection");
    }
    result
}

fn ink_pen(pen: &str, ink: &str) -> Command {
    Command::InkPen {
        pen_id: pen.into(),
        ink_id: ink.into(),
        at: None,
        note: String::new(),
    }
}

fn empty_pen() -> Collection {
    let mut c = sample();
    c.fills.clear();
    c
}

fn photo(id: &str, path: &str) -> Image {
    let mut image = Image::new(id, path);
    image.primary = true;
    image
}

// ---------- inking ----------

#[test]
fn inking_an_empty_pen_opens_a_fill() {
    let mut c = empty_pen();
    run(&mut c, ink_pen("pen_1", "ink_2")).unwrap();
    let fill = c.current_fill("pen_1").unwrap();
    assert_eq!((fill.ink_id.as_str(), fill.inked_at), ("ink_2", LATER));
    let last = c.activity.last().unwrap();
    assert_eq!(last.action, Action::Inked);
    assert_eq!(last.label, "Pilot Custom 74");
    assert_eq!(last.ink_id.as_deref(), Some("ink_2"));
}

#[test]
fn re_inking_switches_to_a_different_ink() {
    let mut c = sample(); // pen_1 holds ink_1
    run(&mut c, ink_pen("pen_1", "ink_2")).unwrap();
    assert_eq!(c.current_fill("pen_1").unwrap().ink_id, "ink_2");
    let previous = c.fills.iter().find(|f| f.id == "fill_2").unwrap();
    assert_eq!(previous.emptied_at, Some(LATER));
    let last = c.activity.last().unwrap();
    assert_eq!(last.action, Action::Reinked);
    assert_eq!(last.previous_ink_id.as_deref(), Some("ink_1"));
}

#[test]
fn re_inking_with_the_same_ink_is_refused() {
    let mut c = sample();
    let before = c.clone();
    assert_eq!(
        run(&mut c, ink_pen("pen_1", "ink_1")),
        Err(CommandError::AlreadyInked)
    );
    assert_eq!(c, before, "nothing changes on failure");
}

#[test]
fn inking_can_be_backdated_but_not_before_the_last_change() {
    let mut c = sample(); // current fill started at T0 + 2 days
    let too_early = Command::InkPen {
        pen_id: "pen_1".into(),
        ink_id: "ink_2".into(),
        at: Some(T0 + DAY),
        note: String::new(),
    };
    assert_eq!(run(&mut c, too_early), Err(CommandError::TooEarly));

    let backdated = Command::InkPen {
        pen_id: "pen_1".into(),
        ink_id: "ink_2".into(),
        at: Some(T0 + 5 * DAY),
        note: "after cleaning".into(),
    };
    run(&mut c, backdated).unwrap();
    let fill = c.current_fill("pen_1").unwrap();
    assert_eq!(
        (fill.inked_at, fill.note.as_str()),
        (T0 + 5 * DAY, "after cleaning")
    );
}

#[test]
fn unknown_pens_and_inks_are_reported() {
    let mut c = sample();
    assert!(matches!(
        run(&mut c, ink_pen("nope", "ink_1")),
        Err(CommandError::NotFound { kind: "pen", .. })
    ));
    assert!(matches!(
        run(&mut c, ink_pen("pen_1", "nope")),
        Err(CommandError::NotFound { kind: "ink", .. })
    ));
}

#[test]
fn flushing_closes_the_open_fill() {
    let mut c = sample();
    run(
        &mut c,
        Command::FlushPen {
            pen_id: "pen_1".into(),
            at: None,
        },
    )
    .unwrap();
    assert!(c.current_fill("pen_1").is_none());
    let last = c.activity.last().unwrap();
    assert_eq!(last.action, Action::Flushed);
    assert_eq!(last.previous_ink_id.as_deref(), Some("ink_1"));

    assert_eq!(
        run(
            &mut c,
            Command::FlushPen {
                pen_id: "pen_1".into(),
                at: None
            }
        ),
        Err(CommandError::NotInked)
    );
}

// ---------- saving and deleting ----------

#[test]
fn saving_a_new_pen_stamps_it_and_records_it() {
    let mut c = sample();
    let mut new = pen("pen_2");
    new.created_at = 1;
    new.updated_at = 1;
    run(&mut c, Command::SavePen { pen: new }).unwrap();
    let saved = c.pens.iter().find(|p| p.id == "pen_2").unwrap();
    assert_eq!((saved.created_at, saved.updated_at), (LATER, LATER));
    assert_eq!(c.activity.last().unwrap().action, Action::Created);
}

#[test]
fn editing_records_what_changed_at_the_chosen_detail() {
    let edited = || {
        let mut p = pen("pen_1");
        p.price = Some(180.0);
        p.notes = "private thoughts".into();
        p
    };

    let mut c = sample();
    run(&mut c, Command::SavePen { pen: edited() }).unwrap();
    assert_eq!(c.activity.last().unwrap().changes, vec!["price", "notes"]);
    assert_eq!(c.pens[0].created_at, T0, "creation time is kept");
    assert_eq!(c.pens[0].updated_at, LATER);

    let mut c = sample();
    c.settings.activity.detail = ActivityDetail::Detailed;
    run(&mut c, Command::SavePen { pen: edited() }).unwrap();
    assert_eq!(
        c.activity.last().unwrap().changes,
        vec!["price: 160.0 → 180.0", "notes"],
        "notes are named but never quoted"
    );

    let mut c = sample();
    c.settings.activity.detail = ActivityDetail::Brief;
    run(&mut c, Command::SavePen { pen: edited() }).unwrap();
    let last = c.activity.last().unwrap();
    assert_eq!(last.action, Action::Updated, "brief still records the edit");
    assert!(last.changes.is_empty(), "but not what changed");
}

#[test]
fn saving_without_changes_records_nothing() {
    let mut c = sample();
    run(&mut c, Command::SavePen { pen: pen("pen_1") }).unwrap();
    assert!(c.activity.is_empty());
}

#[test]
fn recording_can_be_switched_off_per_kind() {
    let mut c = sample();
    c.settings.activity.record_pen_changes = false;
    c.settings.activity.record_deletions = false;
    run(&mut c, Command::SavePen { pen: pen("pen_2") }).unwrap();
    run(&mut c, Command::DeletePen { id: "pen_2".into() }).unwrap();
    assert!(c.activity.is_empty());
    // Inking is history, not an edit, so it is always recorded.
    run(&mut c, ink_pen("pen_1", "ink_2")).unwrap();
    assert_eq!(c.activity.len(), 1);
}

#[test]
fn deleting_a_pen_removes_its_ink_history() {
    let mut c = sample();
    run(&mut c, Command::DeletePen { id: "pen_1".into() }).unwrap();
    assert!(c.pens.is_empty());
    assert!(c.fills.is_empty());
    assert_eq!(c.activity.last().unwrap().action, Action::Deleted);
}

#[test]
fn an_ink_in_a_pen_cannot_be_deleted() {
    let mut c = sample();
    assert_eq!(
        run(&mut c, Command::DeleteInk { id: "ink_1".into() }),
        Err(CommandError::InkInUse)
    );
}

#[test]
fn deleting_an_ink_removes_its_swatches_and_past_fills_and_reports_their_photos() {
    let mut c = sample();
    c.swatches.push(Swatch {
        id: "sw_1".into(),
        ink_id: "ink_2".into(),
        paper: "Tomoe River".into(),
        nib: "F".into(),
        sampled_on: None,
        notes: String::new(),
        images: vec![photo("img_1", "swatches/kon-peki.webp")],
        created_at: T0,
        updated_at: T0,
    });
    let outcome = run(&mut c, Command::DeleteInk { id: "ink_2".into() }).unwrap();
    assert!(c.swatches.is_empty());
    assert!(c.fills.iter().all(|f| f.ink_id != "ink_2"));
    assert_eq!(outcome.unused_images, vec!["swatches/kon-peki.webp"]);
}

#[test]
fn replacing_a_photo_reports_the_old_one() {
    let mut c = sample();
    c.pens[0].images = vec![photo("img_a", "pens/old.webp")];
    let mut edited = c.pens[0].clone();
    edited.images = vec![photo("img_b", "pens/new.webp")];
    let outcome = run(&mut c, Command::SavePen { pen: edited }).unwrap();
    assert_eq!(outcome.unused_images, vec!["pens/old.webp"]);
}

#[test]
fn swatches_must_belong_to_an_existing_ink() {
    let mut c = sample();
    let swatch = Swatch {
        id: "sw_1".into(),
        ink_id: "ghost".into(),
        paper: String::new(),
        nib: String::new(),
        sampled_on: None,
        notes: String::new(),
        images: vec![],
        created_at: T0,
        updated_at: T0,
    };
    assert!(matches!(
        run(&mut c, Command::SaveSwatch { swatch }),
        Err(CommandError::NotFound { kind: "ink", .. })
    ));
}

#[test]
fn commands_round_trip_as_json() {
    let command = ink_pen("pen_1", "ink_2");
    let json = serde_json::to_string(&command).unwrap();
    assert!(json.contains(r#""type":"ink_pen""#));
    assert_eq!(serde_json::from_str::<Command>(&json).unwrap(), command);
}

// ---------- through the store ----------

#[test]
fn the_store_applies_commands_atomically_with_revision_checks() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(dir.path()).unwrap();
    let first = store.save(&sample(), EMPTY_REVISION).unwrap();

    let (state, _) = store
        .apply(ink_pen("pen_1", "ink_2"), &first, LATER)
        .unwrap();
    assert_eq!(
        state.collection.current_fill("pen_1").unwrap().ink_id,
        "ink_2"
    );
    assert_eq!(store.load().unwrap(), state);

    // A second window still holding the first revision is refused.
    assert!(matches!(
        store.apply(ink_pen("pen_1", "ink_1"), &first, LATER),
        Err(StoreError::Conflict { .. })
    ));
    // A failing command writes nothing.
    assert!(matches!(
        store.apply(
            Command::DeleteInk { id: "ink_2".into() },
            &state.revision,
            LATER
        ),
        Err(StoreError::Command(CommandError::InkInUse))
    ));
    assert_eq!(store.load().unwrap().revision, state.revision);
}

#[test]
fn the_store_applies_retention_after_each_command() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(dir.path()).unwrap();
    let mut c = sample();
    c.settings.activity.retention = Retention::Days(3);
    let revision = store.save(&c, EMPTY_REVISION).unwrap();
    // fill_1 ended at T0 + 1 day, long before LATER - 3 days.
    let (state, _) = store
        .apply(ink_pen("pen_1", "ink_2"), &revision, LATER)
        .unwrap();
    assert!(state.collection.fills.iter().all(|f| f.id != "fill_1"));
}
