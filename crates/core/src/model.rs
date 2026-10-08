//! The Inkubator 3.0 data model.
//!
//! Everything the app stores lives in one [`Collection`], serialized as a single
//! JSON document. Timestamps are milliseconds since the Unix epoch. Calendar dates
//! that only matter to the user (purchase date, swatch date) are ISO strings
//! (`YYYY-MM-DD` or `YYYY-MM`).

use serde::{Deserialize, Serialize};

/// Version written to every stored collection. Readers reject anything else.
pub const SCHEMA_VERSION: u32 = 3;

/// Milliseconds since the Unix epoch.
pub type Timestamp = i64;

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Collection {
    pub schema_version: u32,
    pub pens: Vec<Pen>,
    pub inks: Vec<Ink>,
    pub swatches: Vec<Swatch>,
    /// Every time a pen was inked. An open fill (no `emptied_at`) is a pen's current ink.
    pub fills: Vec<Fill>,
    pub activity: Vec<ActivityEntry>,
    pub settings: Settings,
}

impl Collection {
    pub fn empty() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            ..Self::default()
        }
    }

    /// The open fill for a pen, if the pen is inked.
    pub fn current_fill(&self, pen_id: &str) -> Option<&Fill> {
        self.fills
            .iter()
            .find(|fill| fill.pen_id == pen_id && fill.emptied_at.is_none())
    }
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
/// A photo attached to a pen, ink or swatch.
///
/// Cards show the photo cropped to a fixed frame around (`focus_x`, `focus_y`),
/// enlarged by `zoom`. The stored file itself is never altered.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Image {
    pub id: String,
    /// Path relative to the images folder, e.g. `pens/pilot-custom-74.webp`.
    pub path: String,
    pub primary: bool,
    /// Clockwise rotation in degrees: 0, 90, 180 or 270.
    pub rotation: u16,
    /// Horizontal focus point, 0.0 (left) to 1.0 (right).
    pub focus_x: f32,
    /// Vertical focus point, 0.0 (top) to 1.0 (bottom).
    pub focus_y: f32,
    /// Crop zoom, 1.0 (no zoom) to [`Image::MAX_ZOOM`].
    pub zoom: f32,
}

impl Image {
    pub const MAX_ZOOM: f32 = 4.0;

    pub fn new(id: impl Into<String>, path: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            path: path.into(),
            primary: false,
            rotation: 0,
            focus_x: 0.5,
            focus_y: 0.5,
            zoom: 1.0,
        }
    }
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Pen {
    pub id: String,
    pub brand: String,
    pub model: String,
    /// The maker's name for the finish, e.g. "Green Stripe".
    pub color_name: String,
    /// Body colors as `#rrggbb`, used to draw the pen when it has no photo.
    pub colors: Vec<String>,
    /// Free text, e.g. "F", "1.5 mm", "Stub".
    pub nib_size: String,
    /// Free text, e.g. "Steel", "14k gold".
    pub nib_material: String,
    pub body_material: String,
    /// How the pen takes ink; a pen may take several, e.g. "Cartridge" and "Converter".
    pub filling_systems: Vec<String>,
    pub price: Option<f64>,
    /// `YYYY-MM-DD` or `YYYY-MM`.
    pub purchased_on: Option<String>,
    pub purchased_from: String,
    pub notes: String,
    /// Show these notes on the public showcase (also needs `ShowcaseSettings::show_notes`).
    #[serde(default)]
    pub notes_public: bool,
    pub images: Vec<Image>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InkKind {
    #[default]
    Bottle,
    Sample,
    Cartridge,
    Other,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
/// Strength scale used for shading and lubrication.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Level {
    #[default]
    None,
    Low,
    Medium,
    High,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Sheen {
    #[default]
    None,
    Low,
    Medium,
    High,
    Monster,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
/// Color groups used for the ink shelf and search.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ColorFamily {
    Red,
    Orange,
    Yellow,
    Green,
    Teal,
    Blue,
    Purple,
    Pink,
    Brown,
    BlackGrey,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Shimmer {
    #[default]
    None,
    Gold,
    Silver,
    Multiple,
    Other,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Flow {
    VeryDry,
    Dry,
    #[default]
    Average,
    Wet,
    VeryWet,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WaterResistance {
    #[default]
    None,
    WaterResistant,
    Waterproof,
    Archival,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BaseType {
    Dye,
    Pigment,
    IronGall,
    Shimmer,
    Scented,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaperBehavior {
    Friendly,
    Average,
    Feathering,
    Bleeding,
    ShowThrough,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Ink {
    pub id: String,
    pub brand: String,
    /// Product line, e.g. "Iroshizuku". Empty when the ink has none.
    pub line: String,
    pub name: String,
    pub kind: InkKind,
    pub volume_ml: Option<f64>,
    /// Number of bottles, samples or cartridges owned.
    pub amount: u32,
    pub price: Option<f64>,
    /// Main color as `#rrggbb`.
    pub base_color: String,
    /// Sheen color as `#rrggbb`, when the ink has a noticeably different one.
    pub sheen_color: Option<String>,
    /// Where the ink sits on the shelf. `None` means it is worked out from
    /// `base_color`; set it when the stored color misleads.
    #[serde(default)]
    pub color_family: Option<ColorFamily>,
    pub shimmer: Shimmer,
    pub sheen: Sheen,
    pub shading: Level,
    pub water_resistance: WaterResistance,
    pub flow: Flow,
    pub lubrication: Level,
    pub dry_time_seconds: Option<u32>,
    pub base_types: Vec<BaseType>,
    pub paper: Vec<PaperBehavior>,
    pub notes: String,
    /// Show these notes on the public showcase (also needs `ShowcaseSettings::show_notes`).
    #[serde(default)]
    pub notes_public: bool,
    pub images: Vec<Image>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Swatch {
    pub id: String,
    pub ink_id: String,
    pub paper: String,
    pub nib: String,
    /// `YYYY-MM-DD`.
    pub sampled_on: Option<String>,
    pub notes: String,
    /// Show these notes on the public showcase (also needs `ShowcaseSettings::show_notes`).
    #[serde(default)]
    pub notes_public: bool,
    pub images: Vec<Image>,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
/// One period of a pen holding one ink.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Fill {
    pub id: String,
    pub pen_id: String,
    pub ink_id: String,
    pub inked_at: Timestamp,
    /// `None` while the pen still holds this ink.
    pub emptied_at: Option<Timestamp>,
    pub note: String,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Subject {
    Pen,
    Ink,
    Swatch,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Created,
    Updated,
    Deleted,
    /// A pen was filled while empty.
    Inked,
    /// A pen was switched from one ink to another.
    Reinked,
    /// A pen was emptied.
    Flushed,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
/// One changed field of a pen, ink or swatch. The interface words it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Change {
    /// The field's name as stored, e.g. `sheen` or `price`.
    pub field: String,
    /// The value before and after, recorded only with detailed activity and
    /// never for notes or photos.
    pub values: Option<(serde_json::Value, serde_json::Value)>,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActivityEntry {
    pub id: String,
    pub at: Timestamp,
    pub subject: Subject,
    pub action: Action,
    /// Id of the pen, ink or swatch. It may no longer exist after a deletion.
    pub subject_id: String,
    /// Display name at the time of the event, so entries stay readable after renames or deletions.
    pub label: String,
    /// For ink changes: the ink before and after.
    pub previous_ink_id: Option<String>,
    pub ink_id: Option<String>,
    /// What changed, when the detail level records it.
    pub changes: Vec<Change>,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Theme {
    #[default]
    Auto,
    Light,
    Dark,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
/// How long activity and finished fills are kept.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "keep", content = "days")]
pub enum Retention {
    #[default]
    Forever,
    Days(u32),
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActivityDetail {
    Brief,
    #[default]
    Normal,
    Detailed,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DateFormat {
    #[default]
    System,
    Us,
    Eu,
    Iso,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackupFrequency {
    Off,
    #[default]
    Daily,
    Weekly,
    Monthly,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PenSort {
    #[default]
    Newest,
    Oldest,
    Brand,
    Model,
    Price,
    LastInked,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InkSort {
    #[default]
    Hue,
    Newest,
    Oldest,
    Brand,
    Name,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwatchSort {
    #[default]
    Newest,
    Oldest,
    Ink,
    Paper,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Settings {
    pub theme: Theme,
    pub open_items_in_edit_mode: bool,
    pub confirm_destructive_actions: bool,
    pub activity: ActivitySettings,
    pub defaults: Defaults,
    pub backups: BackupSettings,
    pub showcase: ShowcaseSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::Auto,
            open_items_in_edit_mode: false,
            confirm_destructive_actions: true,
            activity: ActivitySettings::default(),
            defaults: Defaults::default(),
            backups: BackupSettings::default(),
            showcase: ShowcaseSettings::default(),
        }
    }
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActivitySettings {
    /// Also applies to finished fills: pruning activity prunes ink history with it.
    pub retention: Retention,
    pub detail: ActivityDetail,
    pub record_pen_changes: bool,
    pub record_ink_changes: bool,
    pub record_swatches: bool,
    pub record_deletions: bool,
}

impl Default for ActivitySettings {
    fn default() -> Self {
        Self {
            retention: Retention::Forever,
            detail: ActivityDetail::Normal,
            record_pen_changes: true,
            record_ink_changes: true,
            record_swatches: true,
            record_deletions: true,
        }
    }
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Defaults {
    /// ISO 4217 code, e.g. "USD".
    pub currency: String,
    pub date_format: DateFormat,
    pub nib_size: String,
    pub nib_material: String,
    pub ink_kind: InkKind,
}

impl Default for Defaults {
    fn default() -> Self {
        Self {
            currency: "USD".to_string(),
            date_format: DateFormat::System,
            nib_size: String::new(),
            nib_material: String::new(),
            ink_kind: InkKind::Bottle,
        }
    }
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BackupSettings {
    pub frequency: BackupFrequency,
    /// Automatic backups kept before the oldest is deleted.
    pub keep: u32,
    pub keep_replaced_photos: bool,
    pub validate_on_import: bool,
}

impl BackupSettings {
    pub const MAX_KEEP: u32 = 365;
}

impl Default for BackupSettings {
    fn default() -> Self {
        Self {
            frequency: BackupFrequency::Daily,
            keep: 30,
            keep_replaced_photos: false,
            validate_on_import: true,
        }
    }
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ShowcaseSettings {
    /// Whether visitors who are not signed in can see anything at all. Off by
    /// default: the collection stays private until the owner opens it.
    #[serde(default)]
    pub enabled: bool,
    pub title: String,
    pub theme: Theme,
    pub show_pens: bool,
    pub show_inks: bool,
    pub show_swatches: bool,
    pub show_prices: bool,
    /// When each pen was bought.
    #[serde(default)]
    pub show_purchase_dates: bool,
    /// Where each pen was bought.
    #[serde(default)]
    pub show_purchased_from: bool,
    /// Master switch for notes: when off, no notes are public, whatever each item says.
    #[serde(default)]
    pub show_notes: bool,
    pub show_stats: bool,
    pub show_charts: bool,
    pub show_activity: bool,
    pub show_activity_filters: bool,
    pub show_recent_activity: bool,
    pub pen_sort: PenSort,
    pub ink_sort: InkSort,
    pub swatch_sort: SwatchSort,
}

impl Default for ShowcaseSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            title: "Inkubator".to_string(),
            theme: Theme::Auto,
            show_pens: true,
            show_inks: true,
            show_swatches: true,
            show_prices: false,
            show_purchase_dates: false,
            show_purchased_from: false,
            show_notes: false,
            show_stats: true,
            show_charts: true,
            show_activity: true,
            show_activity_filters: true,
            show_recent_activity: true,
            pen_sort: PenSort::Newest,
            ink_sort: InkSort::Hue,
            swatch_sort: SwatchSort::Newest,
        }
    }
}
