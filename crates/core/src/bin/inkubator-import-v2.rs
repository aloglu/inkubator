//! Converts an Inkubator 2.x data folder into a 3.0 collection.
//!
//! Usage: inkubator-import-v2 <2.x data folder> <new 3.0 data folder>
//!
//! The 2.x folder is only read. The 3.0 folder must not contain a collection yet.

use std::path::PathBuf;
use std::process::ExitCode;

use inkubator_core::{import_v2, now, Store};

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [from, to] = args.as_slice() else {
        eprintln!("Usage: inkubator-import-v2 <2.x data folder> <new 3.0 data folder>");
        return ExitCode::from(2);
    };
    let (from, to) = (PathBuf::from(from), PathBuf::from(to));
    if from == to {
        eprintln!("Choose a different folder for the 3.0 data; the 2.x folder is left untouched.");
        return ExitCode::from(2);
    }

    let result = Store::open(&to)
        .map_err(import_v2::ImportError::from)
        .and_then(|store| import_v2::import(&from, &store, now()));
    match result {
        Ok(report) => {
            println!("Imported into {}", to.display());
            println!(
                "  {} pens, {} inks, {} swatches, {} photos",
                report.pens, report.inks, report.swatches, report.images
            );
            println!(
                "  {} fills ({} pens inked now), {} activity entries",
                report.fills, report.open_fills, report.activity
            );
            if !report.warnings.is_empty() {
                println!("\n{} adjustment(s):", report.warnings.len());
                for warning in &report.warnings {
                    println!("  - {warning}");
                }
            }
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("Import failed: {error}");
            ExitCode::FAILURE
        }
    }
}
