//! The `inkubator` program: runs the server, and a few one-off commands.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Duration;

use inkubator_core::{import_v2, now, Store};
use inkubator_server::config::{default_data_dir, Config};
use inkubator_server::password::{self, Stored};
use inkubator_server::{router, run_backup_schedule, AppState, VERSION};

const HELP: &str = "\
Inkubator — your fountain pens, inks and swatches, in your browser.

Usage:
  inkubator [options]                     Start Inkubator
  inkubator set-password [options]        Set or change the sign-in password
  inkubator import-v2 <folder> [options]  Bring in a collection from Inkubator 2.x
  inkubator healthcheck [options]         Exit 0 if Inkubator answers (for Docker)
  inkubator --version | --help

Options:
  --data-dir <folder>  Where your collection is kept
                       (default: INKUBATOR_DATA_DIR, else your system's data folder)
  --port <number>      Port to listen on (default: PORT, else 8080)
  --host <address>     Address to listen on (default: INKUBATOR_HOST, else all, 0.0.0.0)
  --user <name>        With set-password: the user name (default: admin)

A password given in INKUBATOR_ADMIN_PASSWORD takes the place of one set with
set-password. See the documentation for Docker and other setups.
";

fn main() -> ExitCode {
    let args = match Args::parse(std::env::args().skip(1)) {
        Ok(args) => args,
        Err(message) => {
            eprintln!("{message}\n\nRun `inkubator --help` for the options.");
            return ExitCode::from(2);
        }
    };
    match args.command.as_str() {
        "help" => {
            print!("{HELP}");
            ExitCode::SUCCESS
        }
        "version" => {
            println!("Inkubator {VERSION}");
            ExitCode::SUCCESS
        }
        "set-password" => set_password(&args),
        "import-v2" => import(&args),
        "healthcheck" => healthcheck(&args),
        _ => serve(&args),
    }
}

/// The command and its options; options are passed on under the names of the
/// environment variables they stand in for.
struct Args {
    command: String,
    folder: Option<String>,
    options: HashMap<&'static str, String>,
}

impl Args {
    fn parse(raw: impl Iterator<Item = String>) -> Result<Self, String> {
        let mut command = String::from("serve");
        let mut folder = None;
        let mut options = HashMap::new();
        let mut raw = raw.peekable();
        let mut first = true;
        while let Some(arg) = raw.next() {
            let key = match arg.as_str() {
                "-h" | "--help" | "help" => {
                    command = "help".into();
                    continue;
                }
                "-V" | "--version" | "version" => {
                    command = "version".into();
                    continue;
                }
                "--data-dir" => "INKUBATOR_DATA_DIR",
                "--port" => "PORT",
                "--host" => "INKUBATOR_HOST",
                "--user" => "INKUBATOR_ADMIN_USER",
                "serve" | "set-password" | "import-v2" | "healthcheck" if first => {
                    command = arg;
                    first = false;
                    continue;
                }
                other if !other.starts_with('-') && command == "import-v2" && folder.is_none() => {
                    folder = Some(other.to_string());
                    continue;
                }
                other => return Err(format!("Unknown option or command: {other}")),
            };
            first = false;
            let value = raw.next().ok_or_else(|| format!("{arg} needs a value."))?;
            options.insert(key, value);
        }
        Ok(Self {
            command,
            folder,
            options,
        })
    }

    /// An option, else the environment variable of the same name.
    fn get(&self, key: &str) -> Option<String> {
        self.options
            .get(key)
            .cloned()
            .or_else(|| std::env::var(key).ok())
    }

    fn data_dir(&self) -> PathBuf {
        self.get("INKUBATOR_DATA_DIR")
            .or_else(|| self.get("DATA_DIR"))
            .filter(|dir| !dir.trim().is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(default_data_dir)
    }
}

fn serve(args: &Args) -> ExitCode {
    let config = match Config::from_lookup(|key| args.get(key)) {
        Ok(config) => config,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::FAILURE;
        }
    };
    if config.insecure() {
        eprintln!("WARNING: running without a password (INKUBATOR_ALLOW_INSECURE=1). Do not expose this server.");
    }
    let runtime = match tokio::runtime::Runtime::new() {
        Ok(runtime) => runtime,
        Err(error) => {
            eprintln!("Could not start: {error}");
            return ExitCode::FAILURE;
        }
    };
    runtime.block_on(run(config))
}

async fn run(config: Config) -> ExitCode {
    let address = SocketAddr::new(config.host, config.port);
    let data_dir = config.data_dir.clone();
    let state = match AppState::new(config) {
        Ok(state) => state,
        Err(error) => {
            eprintln!(
                "Could not open the data folder {}: {error}",
                data_dir.display()
            );
            return ExitCode::FAILURE;
        }
    };
    tokio::spawn(run_backup_schedule(state.store.clone()));

    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("Could not listen on {address}: {error}");
            eprintln!("Is another program (or another Inkubator) using port {}? Choose another with --port.", address.port());
            return ExitCode::FAILURE;
        }
    };
    let shown = if address.ip().is_unspecified() {
        format!("http://localhost:{}", address.port())
    } else {
        format!("http://{address}")
    };
    println!("Inkubator {VERSION} is running. Open {shown} in your browser.");
    println!("Your collection is kept in {}", data_dir.display());

    let app = router(state).into_make_service_with_connect_info::<SocketAddr>();
    if let Err(error) = axum::serve(listener, app)
        .with_graceful_shutdown(stop_signal())
        .await
    {
        eprintln!("Server error: {error}");
        return ExitCode::FAILURE;
    }
    println!("Inkubator stopped.");
    ExitCode::SUCCESS
}

/// Ctrl+C, or SIGTERM from Docker or a service manager.
async fn stop_signal() {
    let interrupt = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        () = interrupt => {}
        () = terminate => {}
    }
}

fn set_password(args: &Args) -> ExitCode {
    let data_dir = args.data_dir();
    let user = args
        .get("INKUBATOR_ADMIN_USER")
        .filter(|user| !user.trim().is_empty())
        .unwrap_or_else(|| "admin".into());
    println!(
        "Setting the password for \"{user}\" (data folder: {}).",
        data_dir.display()
    );
    let password = match rpassword::prompt_password("New password: ") {
        Ok(password) => password,
        Err(error) => {
            eprintln!("Could not read the password: {error}");
            return ExitCode::FAILURE;
        }
    };
    if password.chars().count() < 8 {
        eprintln!("Please choose a password of at least 8 characters.");
        return ExitCode::FAILURE;
    }
    match rpassword::prompt_password("Type it again: ") {
        Ok(again) if again == password => {}
        Ok(_) => {
            eprintln!("The two passwords are different. Nothing was changed.");
            return ExitCode::FAILURE;
        }
        Err(error) => {
            eprintln!("Could not read the password: {error}");
            return ExitCode::FAILURE;
        }
    }
    let result =
        Stored::new(&user, &password).and_then(|stored| password::save(&data_dir, &stored));
    match result {
        Ok(()) => {
            println!("Password saved. Sign in as \"{user}\".");
            if std::env::var("INKUBATOR_ADMIN_PASSWORD").is_ok_and(|p| !p.trim().is_empty()) {
                println!("Note: INKUBATOR_ADMIN_PASSWORD is set, and it takes the place of this password.");
            }
            println!("If Inkubator is running, restart it to use the new password.");
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}

fn import(args: &Args) -> ExitCode {
    let Some(from) = args.folder.as_ref().map(PathBuf::from) else {
        eprintln!(
            "Usage: inkubator import-v2 <your Inkubator 2.x data folder> [--data-dir <folder>]"
        );
        return ExitCode::from(2);
    };
    let to = args.data_dir();
    if from == to {
        eprintln!(
            "Choose a different data folder for 3.0; the 2.x folder is only read, never changed."
        );
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

/// Asks the running server for /api/health over plain HTTP; no extra tools needed in the image.
fn healthcheck(args: &Args) -> ExitCode {
    let port: u16 = args
        .get("PORT")
        .or_else(|| args.get("INKUBATOR_PORT"))
        .and_then(|p| p.trim().parse().ok())
        .unwrap_or(8080);
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let answer = (|| -> std::io::Result<String> {
        let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(3))?;
        stream.set_read_timeout(Some(Duration::from_secs(3)))?;
        stream.write_all(b"GET /api/health HTTP/1.0\r\nHost: localhost\r\n\r\n")?;
        let mut reply = String::new();
        stream.read_to_string(&mut reply)?;
        Ok(reply)
    })();
    match answer {
        Ok(reply) if reply.starts_with("HTTP/1.1 200") || reply.starts_with("HTTP/1.0 200") => {
            ExitCode::SUCCESS
        }
        Ok(reply) => {
            eprintln!("Unhealthy: {}", reply.lines().next().unwrap_or("no answer"));
            ExitCode::FAILURE
        }
        Err(error) => {
            eprintln!("Unhealthy: {error}");
            ExitCode::FAILURE
        }
    }
}
