mod common;

use common::*;
use inkubator_core::public::{project, RECENT_ACTIVITY_LIMIT};
use inkubator_core::*;

fn showcase() -> Collection {
    let mut c = sample();
    c.pens[0].purchased_from = "A friend".into();
    c.inks[0].price = Some(18.0);
    c.fills[1].note = "private".into();
    let mut photo = Image::new("img_1", "swatches/a.webp");
    photo.primary = true;
    c.swatches.push(Swatch {
        id: "sw_1".into(),
        ink_id: "ink_1".into(),
        paper: "Tomoe River".into(),
        nib: "F".into(),
        sampled_on: None,
        notes: String::new(),
        notes_public: false,
        images: vec![photo],
        created_at: T0,
        updated_at: T0,
    });
    for n in 0..8 {
        c.activity.push(ActivityEntry {
            id: format!("act_{n}"),
            at: T0 + n,
            subject: Subject::Pen,
            action: if n == 0 {
                Action::Inked
            } else {
                Action::Updated
            },
            subject_id: "pen_1".into(),
            label: "Pilot Custom 74".into(),
            previous_ink_id: None,
            ink_id: if n == 0 { Some("ink_1".into()) } else { None },
            changes: vec!["notes".into()],
        });
    }
    c
}

#[test]
fn prices_and_private_details_are_hidden_by_default() {
    let p = project(&showcase());
    assert_eq!(p.pens[0].price, None);
    assert_eq!(p.pens[0].purchased_from, "");
    assert_eq!(p.inks[0].price, None);
    assert_eq!(p.currency, None);
    assert!(
        p.fills.iter().all(|f| f.note.is_empty()),
        "fill notes stay private"
    );
}

#[test]
fn prices_show_when_enabled() {
    let mut c = showcase();
    c.settings.showcase.show_prices = true;
    let p = project(&c);
    assert_eq!(p.pens[0].price, Some(160.0));
    assert_eq!(p.pens[0].purchased_from, "A friend");
    assert_eq!(p.currency.as_deref(), Some("USD"));
}

#[test]
fn hiding_inks_hides_swatches_fills_and_inking_activity() {
    let mut c = showcase();
    c.settings.showcase.show_inks = false;
    let p = project(&c);
    assert!(p.inks.is_empty() && p.swatches.is_empty() && p.fills.is_empty());
    assert!(p.activity.iter().all(|a| a.action != Action::Inked));
    assert!(p.photo_paths().is_empty());
}

#[test]
fn hiding_pens_hides_their_fills_and_activity() {
    let mut c = showcase();
    c.settings.showcase.show_pens = false;
    let p = project(&c);
    assert!(p.pens.is_empty() && p.fills.is_empty() && p.activity.is_empty());
    assert_eq!(p.inks.len(), 2);
}

#[test]
fn activity_is_stripped_and_limited() {
    let mut c = showcase();
    c.settings.showcase.show_activity = false;
    let p = project(&c);
    assert_eq!(p.activity.len(), RECENT_ACTIVITY_LIMIT, "recent only");
    assert_eq!(p.activity[0].at, T0 + 7, "newest first");

    c.settings.showcase.show_activity = true;
    assert_eq!(project(&c).activity.len(), 8);

    c.settings.showcase.show_activity = false;
    c.settings.showcase.show_recent_activity = false;
    assert!(project(&c).activity.is_empty());

    let json = serde_json::to_string(&project(&showcase())).unwrap();
    assert!(!json.contains("\"label\""), "no activity labels");
    assert!(!json.contains("\"changes\""), "no change details");
    assert!(!json.contains("\"settings\""), "no settings object");
}

#[test]
fn only_visible_photos_are_listed() {
    let p = project(&showcase());
    assert!(p.photo_paths().contains("swatches/a.webp"));
    let mut c = showcase();
    c.settings.showcase.show_swatches = false;
    assert!(!project(&c).photo_paths().contains("swatches/a.webp"));
}

#[test]
fn notes_need_both_the_item_and_the_showcase_switch() {
    let notes = |show_notes: bool, item_public: bool| {
        let mut c = showcase();
        c.settings.showcase.show_notes = show_notes;
        c.pens[0].notes = "Bought from a friend".into();
        c.pens[0].notes_public = item_public;
        c.inks[0].notes = "Shake first".into();
        c.inks[0].notes_public = item_public;
        c.swatches[0].notes = "Daylight".into();
        c.swatches[0].notes_public = item_public;
        let p = project(&c);
        (
            p.pens[0].notes.clone(),
            p.inks[0].notes.clone(),
            p.swatches[0].notes.clone(),
        )
    };
    let hidden = (String::new(), String::new(), String::new());
    assert_eq!(notes(false, false), hidden, "private by default");
    assert_eq!(
        notes(false, true),
        hidden,
        "the showcase switch overrides every item"
    );
    assert_eq!(
        notes(true, false),
        hidden,
        "items stay private unless marked public"
    );
    assert_eq!(
        notes(true, true),
        (
            "Bought from a friend".into(),
            "Shake first".into(),
            "Daylight".into()
        )
    );
}
