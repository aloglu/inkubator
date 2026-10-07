use std::net::SocketAddr;
use std::process::ExitCode;

use inkubator_server::{router, run_backup_schedule, AppState, Config, VERSION};

#[tokio::main]
async fn main() -> ExitCode {
    let config = match Config::from_env() {
        Ok(config) => config,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::FAILURE;
        }
    };
    if config.insecure {
        eprintln!("WARNING: running without a password (INKUBATOR_ALLOW_INSECURE=1). Do not expose this server.");
    }
    let port = config.port;
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

    let address = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("Could not listen on {address}: {error}");
            return ExitCode::FAILURE;
        }
    };
    println!(
        "Inkubator {VERSION} listening on http://{address} (data in {})",
        data_dir.display()
    );

    let app = router(state).into_make_service_with_connect_info::<SocketAddr>();
    if let Err(error) = axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
    {
        eprintln!("Server error: {error}");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}
