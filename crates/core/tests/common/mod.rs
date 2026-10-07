//! Sample data shared by the integration tests.
#![allow(dead_code)]

use inkubator_core::*;

pub const T0: Timestamp = 1_700_000_000_000;
pub const DAY: Timestamp = 24 * 60 * 60 * 1000;

pub fn pen(id: &str) -> Pen {
    Pen {
        id: id.into(),
        brand: "Pilot".into(),
        model: "Custom 74".into(),
        color_name: String::new(),
        colors: vec!["#5a5f66".into()],
        nib_size: "F".into(),
        nib_material: "14k gold".into(),
        body_material: "Resin".into(),
        filling_system: "Converter".into(),
        price: Some(160.0),
        purchased_on: Some("2022-06".into()),
        purchased_from: String::new(),
        notes: String::new(),
        notes_public: false,
        images: vec![],
        created_at: T0,
        updated_at: T0,
    }
}

pub fn ink(id: &str) -> Ink {
    Ink {
        id: id.into(),
        brand: "Sailor".into(),
        line: "Shikiori".into(),
        name: "Yama-dori".into(),
        kind: InkKind::Bottle,
        volume_ml: Some(20.0),
        amount: 1,
        price: None,
        base_color: "#1e6b6e".into(),
        sheen_color: Some("#b03a72".into()),
        shimmer: Shimmer::None,
        sheen: Sheen::High,
        shading: Level::Medium,
        water_resistance: WaterResistance::None,
        flow: Flow::Average,
        lubrication: Level::Medium,
        dry_time_seconds: Some(25),
        base_types: vec![BaseType::Dye],
        paper: vec![PaperBehavior::Friendly],
        notes: String::new(),
        notes_public: false,
        images: vec![],
        created_at: T0,
        updated_at: T0,
    }
}

pub fn fill(id: &str, pen: &str, ink: &str, from: Timestamp, to: Option<Timestamp>) -> Fill {
    Fill {
        id: id.into(),
        pen_id: pen.into(),
        ink_id: ink.into(),
        inked_at: from,
        emptied_at: to,
        note: String::new(),
    }
}

pub fn sample() -> Collection {
    let mut c = Collection::empty();
    c.pens.push(pen("pen_1"));
    c.inks.push(ink("ink_1"));
    c.inks.push(Ink {
        name: "Kon-peki".into(),
        ..ink("ink_2")
    });
    c.fills
        .push(fill("fill_1", "pen_1", "ink_2", T0, Some(T0 + DAY)));
    c.fills
        .push(fill("fill_2", "pen_1", "ink_1", T0 + 2 * DAY, None));
    c
}
