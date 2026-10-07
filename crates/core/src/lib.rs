//! Shared core of Inkubator 3.0: the data model, validation, storage and the
//! one-time import from 2.x. Used by the desktop app and the server.

pub mod commands;
pub mod images;
pub mod import_v2;
pub mod model;
pub mod retention;
pub mod storage;
pub mod validate;

pub use commands::{apply, Command, CommandError, Outcome};
pub use model::*;
pub use storage::{Loaded, Store, StoreError};
pub use validate::{validate, Problem, ValidationError};

/// A new random id such as `pen_6f1c…`.
pub fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", uuid::Uuid::new_v4().simple())
}

/// The current time in milliseconds since the Unix epoch.
pub fn now() -> Timestamp {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as Timestamp)
        .unwrap_or(0)
}
