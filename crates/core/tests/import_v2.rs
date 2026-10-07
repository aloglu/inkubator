use inkubator_core::import_v2::{convert, import, normalize_hex, ImportError};
use inkubator_core::storage::EMPTY_REVISION;
use inkubator_core::*;
use serde_json::{json, Map, Value};

const NOW: Timestamp = 1_800_000_000_000;

fn object(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(map) => map,
        _ => panic!("expected an object"),
    }
}

fn v2_data() -> Value {
    json!({
        "pens": [
            {
                "id": "pen_a", "brand": "Pilot", "model": "Custom 74", "color": "Smoke",
                "hex_color": "#5A5F66", "hex_colors": [], "nib": "F", "nib_material": "Gold",
                "material": "Resin", "filling_system": "Converter", "price": "160",
                "notes": "", "image": "pens/custom-74.webp", "image_rotation": 95,
                "images": []
            },
            {
                "id": "pen_b", "brand": "Lamy", "model": "Safari", "hex_colors": ["#1f4e5a"],
                "price": "", "images": [
                    {"id": "img_1", "path": "images/pens/safari.webp", "primary": false, "rotation": 0},
                    {"id": "img_2", "path": "pens/missing.webp", "primary": true, "rotation": 0}
                ]
            }
        ],
        "inks": [
            {
                "id": "ink_x", "brand": "Sailor", "name": "Yama-dori", "type": "Bottle",
                "volume_ml": "20", "amount": "1", "price": "18", "color_base": "#1e6b6e",
                "color_accent": "#B03A72", "shading": "Medium", "sheen": "Monster",
                "shimmer": "None", "flow": "Very Wet", "lubrication": "None",
                "dry_time": "25", "base_type": ["Dye", "Shimmer"], "permanence": "Water Resistant",
                "paper_compatibility": ["Friendly", "Show Through"], "notes": "",
                "image": "swatches/yama-dori.webp"
            },
            {
                "id": "ink_y", "brand": "Pilot", "name": "Kon-peki", "color_base": "#abc",
                "color_accent": "#abc", "shading": "Extreme", "sheen": "None", "flow": "Average"
            }
        ],
        "swatches": [
            {
                "id": "sw_1", "ink_id": "ink_x", "image": "swatches/yama-dori.webp",
                "images": [{"id": "i", "path": "swatches/yama-dori.webp", "primary": true, "rotation": 0}],
                "swatch_paper": "Tomoe River", "swatch_nib": "MF", "swatch_date": "2026-10-02",
                "swatch_lighting": "Daylight", "swatch_notes": "", "created_at": 1_760_000_000_000_i64
            },
            {
                "id": "sw_2", "ink_id": "ink_y", "image": "swatches/kon-peki.webp",
                "swatch_date": "last spring", "swatch_notes": "Nice", "created_at": 1_760_000_000_001_i64
            },
            { "id": "sw_3", "ink_id": "deleted_ink", "image": "swatches/gone.webp" }
        ],
        "currently_inked": [
            // 2.x kept the first inking date after a re-ink.
            { "id": "ci_1", "pen_id": "pen_a", "ink_id": "ink_x", "date_inked": 1_000 },
            // Inked, but never logged.
            { "id": "ci_2", "pen_id": "pen_b", "ink_id": "ink_y", "date_inked": 9_000 }
        ],
        "activity_log": [
            { "id": "a1", "timestamp": 1_001, "action": "inked", "category": "pen",
              "entity_id": "pen_a", "metadata": { "new_ink_id": "ink_y", "pen_display_name": "Pilot Custom 74" } },
            { "id": "a2", "timestamp": 5_000, "action": "reinked", "category": "pen",
              "entity_id": "pen_a", "metadata": { "previous_ink_id": "ink_y", "new_ink_id": "ink_x" } },
            { "id": "a3", "timestamp": 2_000, "action": "inked", "category": "pen",
              "entity_id": "pen_b", "metadata": { "new_ink_id": "ink_x" } },
            { "id": "a4", "timestamp": 3_000, "action": "cleaned", "category": "pen",
              "entity_id": "pen_b", "metadata": {} },
            { "id": "a5", "timestamp": 500, "action": "created", "category": "ink", "entity_id": "ink_x" },
            { "id": "a6", "timestamp": 600, "action": "exported", "category": "system", "entity_id": "" }
        ]
    })
}

fn v2_preferences() -> Value {
    json!({
        "color_mode": "dark",
        "activity_retention_days": 0,
        "activity_log_verbosity": "minimal",
        "defaults": { "currency": "eur", "ink_type": "Sample" },
        "backup": { "auto_frequency": "weekly", "retention_count": 999 },
        "show_activity_log": false,
        "showcase": { "title": "  ", "show_prices": true, "default_sort": { "pens": "brand-desc", "inks": "name-asc" } }
    })
}

fn existing(path: &str) -> bool {
    path != "pens/missing.webp"
}

fn converted() -> (Collection, Vec<String>, Vec<String>) {
    let out = convert(&object(v2_data()), &object(v2_preferences()), NOW, existing);
    (out.collection, out.images, out.warnings)
}

#[test]
fn the_result_is_a_valid_collection() {
    let (c, _, _) = converted();
    validate(&c).unwrap();
}

#[test]
fn pens_are_cleaned_up() {
    let (c, _, warnings) = converted();
    let a = &c.pens[0];
    assert_eq!(a.colors, vec!["#5a5f66"]);
    assert_eq!(a.price, Some(160.0));
    assert_eq!(a.nib_material, "Gold");
    assert_eq!(a.images.len(), 1, "legacy single photo becomes an image");
    assert_eq!(a.images[0].rotation, 90, "rotation snaps to a quarter turn");
    assert!(a.images[0].primary);

    let b = &c.pens[1];
    assert_eq!(b.price, None);
    assert_eq!(b.images.len(), 1);
    assert_eq!(
        b.images[0].path, "pens/safari.webp",
        "images/ prefix removed"
    );
    assert!(
        b.images[0].primary,
        "missing primary photo hands primary to the next"
    );
    assert!(warnings.iter().any(|w| w.contains("pens/missing.webp")));
}

#[test]
fn inks_map_onto_the_new_scales() {
    let (c, _, warnings) = converted();
    let x = &c.inks[0];
    assert_eq!(x.sheen, Sheen::Monster);
    assert_eq!(x.flow, Flow::VeryWet);
    assert_eq!(x.water_resistance, WaterResistance::WaterResistant);
    assert_eq!(x.sheen_color.as_deref(), Some("#b03a72"));
    assert_eq!(x.base_types, vec![BaseType::Dye, BaseType::Shimmer]);
    assert_eq!(
        x.paper,
        vec![PaperBehavior::Friendly, PaperBehavior::ShowThrough]
    );
    assert_eq!((x.volume_ml, x.dry_time_seconds), (Some(20.0), Some(25)));
    assert!(
        x.images.is_empty(),
        "the mirrored swatch photo is not copied onto the ink"
    );
    assert_eq!(
        x.created_at, 500,
        "creation time comes from the activity log"
    );

    let y = &c.inks[1];
    assert_eq!(y.base_color, "#aabbcc");
    assert_eq!(y.sheen_color, None, "same as the base color");
    assert_eq!(y.shading, Level::None);
    assert!(warnings
        .iter()
        .any(|w| w.contains("shading") && w.contains("extreme")));
}

#[test]
fn swatches_drop_lighting_and_keep_odd_dates_in_notes() {
    let (c, images, warnings) = converted();
    assert_eq!(
        c.swatches.len(),
        2,
        "the swatch of a deleted ink is skipped"
    );
    assert_eq!(c.swatches[0].sampled_on.as_deref(), Some("2026-10-02"));
    assert_eq!(c.swatches[1].sampled_on, None);
    assert_eq!(c.swatches[1].notes, "Nice\nSampled: last spring");
    assert!(warnings.iter().any(|w| w.contains("deleted_ink")));
    assert!(images.contains(&"swatches/yama-dori.webp".to_string()));
    assert!(!images.contains(&"swatches/gone.webp".to_string()));
}

#[test]
fn ink_history_is_rebuilt_from_the_log() {
    let (c, _, _) = converted();
    let history = |pen: &str| -> Vec<(String, Timestamp, Option<Timestamp>)> {
        c.fills
            .iter()
            .filter(|f| f.pen_id == pen)
            .map(|f| (f.ink_id.clone(), f.inked_at, f.emptied_at))
            .collect()
    };
    // Re-ink at 5000 is kept even though 2.x still said "inked at 1000".
    assert_eq!(
        history("pen_a"),
        vec![
            ("ink_y".into(), 1_001, Some(5_000)),
            ("ink_x".into(), 5_000, None)
        ]
    );
    // A logged, flushed fill, then an unlogged current one.
    assert_eq!(
        history("pen_b"),
        vec![
            ("ink_x".into(), 2_000, Some(3_000)),
            ("ink_y".into(), 9_000, None)
        ]
    );
    assert_eq!(c.current_fill("pen_a").unwrap().ink_id, "ink_x");
}

#[test]
fn activity_keeps_known_events_with_readable_labels() {
    let (c, _, warnings) = converted();
    assert_eq!(c.activity.len(), 5, "the system entry is skipped");
    assert!(warnings.iter().any(|w| w.contains("1 activity")));
    let first = &c.activity[0];
    assert_eq!(
        (first.subject, first.action),
        (Subject::Ink, Action::Created)
    );
    assert_eq!(
        first.label, "Sailor Yama-dori",
        "label falls back to the current name"
    );
    let flushed = c.activity.iter().find(|a| a.id == "a4").unwrap();
    assert_eq!(flushed.action, Action::Flushed);
    let reinked = c.activity.iter().find(|a| a.id == "a2").unwrap();
    assert_eq!(reinked.previous_ink_id.as_deref(), Some("ink_y"));
    assert_eq!(reinked.ink_id.as_deref(), Some("ink_x"));
}

#[test]
fn settings_carry_over() {
    let (c, _, _) = converted();
    let s = &c.settings;
    assert_eq!(s.theme, Theme::Dark);
    assert_eq!(
        s.activity.retention,
        Retention::Forever,
        "2.x stored 'unlimited' as 0"
    );
    assert_eq!(s.activity.detail, ActivityDetail::Brief);
    assert_eq!(s.defaults.currency, "EUR");
    assert_eq!(s.defaults.ink_kind, InkKind::Sample);
    assert_eq!(s.backups.frequency, BackupFrequency::Weekly);
    assert_eq!(s.backups.keep, 365, "clamped");
    assert_eq!(s.showcase.title, "Inkubator", "blank title falls back");
    assert!(s.showcase.show_prices);
    assert!(!s.showcase.show_activity);
    assert_eq!(s.showcase.pen_sort, PenSort::Brand);
    assert_eq!(s.showcase.ink_sort, InkSort::Name);

    let limited = convert(
        &object(v2_data()),
        &object(json!({ "activity_retention_days": 90 })),
        NOW,
        existing,
    );
    assert_eq!(
        limited.collection.settings.activity.retention,
        Retention::Days(90)
    );
}

#[test]
fn import_writes_the_collection_and_copies_referenced_photos() {
    let old = tempfile::tempdir().unwrap();
    std::fs::write(old.path().join("data.json"), v2_data().to_string()).unwrap();
    std::fs::write(
        old.path().join("preferences.json"),
        v2_preferences().to_string(),
    )
    .unwrap();
    for path in [
        "pens/custom-74.webp",
        "pens/safari.webp",
        "swatches/yama-dori.webp",
        "swatches/kon-peki.webp",
        "swatches/unreferenced.webp",
    ] {
        let file = old.path().join("images").join(path);
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(file, path.as_bytes()).unwrap();
    }

    let new = tempfile::tempdir().unwrap();
    let store = Store::open(new.path()).unwrap();
    let report = import(old.path(), &store, NOW).unwrap();
    assert_eq!((report.pens, report.inks, report.swatches), (2, 2, 2));
    assert_eq!((report.fills, report.open_fills, report.images), (4, 2, 4));

    let images = new.path().join("images");
    assert_eq!(
        std::fs::read(images.join("pens/safari.webp")).unwrap(),
        b"pens/safari.webp"
    );
    assert!(!images.join("swatches/unreferenced.webp").exists());
    assert_ne!(store.load().unwrap().revision, EMPTY_REVISION);

    // A second import into the same folder is refused.
    assert!(matches!(
        import(old.path(), &store, NOW),
        Err(ImportError::DestinationNotEmpty)
    ));
}

#[test]
fn hex_colors_are_normalized() {
    assert_eq!(normalize_hex("#ABC").as_deref(), Some("#aabbcc"));
    assert_eq!(normalize_hex(" #1E6B6E ").as_deref(), Some("#1e6b6e"));
    assert_eq!(normalize_hex("1e6b6e"), None);
    assert_eq!(normalize_hex("#12345"), None);
    assert_eq!(normalize_hex("#ggg"), None);
}
