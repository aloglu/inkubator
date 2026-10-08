//! The self-hosted Inkubator server: the admin API, the public showcase and
//! scheduled backups, all on top of `inkubator-core`.

pub mod auth;
pub mod config;
pub mod password;
mod web;

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Path, Query, Request, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get, post};
use axum::{middleware, Json, Router};
use http_body_util::BodyExt;
use inkubator_core::backup::BackupError;
use inkubator_core::images::ImageSection;
use inkubator_core::photos::{PhotoError, MAX_UPLOAD_BYTES};
use inkubator_core::public::project;
use inkubator_core::remote::{self, RemoteError};
use inkubator_core::{now, Command, CommandError, Loaded, Store, StoreError};
use serde::Deserialize;
use serde_json::{json, Value};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;

pub use config::Config;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
/// How often to check whether a scheduled backup is due.
pub const BACKUP_CHECK_INTERVAL: Duration = Duration::from_secs(60 * 60);
const MAX_JSON_BYTES: usize = 4 * 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub store: Store,
    pub config: Arc<Config>,
    pub sessions: Arc<auth::Sessions>,
}

impl AppState {
    pub fn new(config: Config) -> Result<Self, StoreError> {
        Ok(Self {
            store: Store::open(&config.data_dir)?,
            config: Arc::new(config),
            sessions: Arc::default(),
        })
    }
}

/// An error answer: `{ "code": ..., "message": ..., ...extra }`.
#[derive(Debug)]
pub struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
    extra: Option<Value>,
}

impl ApiError {
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
            extra: None,
        }
    }

    fn with(mut self, extra: Value) -> Self {
        self.extra = Some(extra);
        self
    }

    fn internal(error: impl std::fmt::Display) -> Self {
        eprintln!("internal error: {error}");
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal",
            error.to_string(),
        )
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut body = json!({ "code": self.code, "message": self.message });
        if let (Some(Value::Object(extra)), Value::Object(map)) = (self.extra, &mut body) {
            map.extend(extra);
        }
        (self.status, Json(body)).into_response()
    }
}

impl From<StoreError> for ApiError {
    fn from(error: StoreError) -> Self {
        match error {
            StoreError::Conflict { current } => Self::new(
                StatusCode::CONFLICT,
                "conflict",
                "The collection changed in another window. Reload before saving again.",
            )
            .with(json!({ "revision": current })),
            StoreError::Command(error) => Self::from(error),
            StoreError::Invalid(invalid) => {
                let problems: Vec<String> = invalid.0.iter().map(ToString::to_string).collect();
                Self::new(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "invalid",
                    invalid.to_string(),
                )
                .with(json!({ "problems": problems }))
            }
            other => Self::internal(other),
        }
    }
}

impl From<CommandError> for ApiError {
    fn from(error: CommandError) -> Self {
        let code = match error {
            CommandError::NotFound { .. } => "not_found",
            CommandError::AlreadyInked => "already_inked",
            CommandError::NotInked => "not_inked",
            CommandError::InkInUse => "ink_in_use",
            CommandError::TooEarly => "too_early",
            CommandError::NothingToUndo => "nothing_to_undo",
        };
        Self::new(StatusCode::UNPROCESSABLE_ENTITY, code, error.to_string())
    }
}

impl From<PhotoError> for ApiError {
    fn from(error: PhotoError) -> Self {
        match error {
            PhotoError::TooLarge => Self::new(
                StatusCode::PAYLOAD_TOO_LARGE,
                "too_large",
                error.to_string(),
            ),
            PhotoError::Unreadable(_) => Self::new(
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                "not_a_photo",
                error.to_string(),
            ),
            PhotoError::InvalidPath(_) | PhotoError::NotFound(_) | PhotoError::NotARealFile(_) => {
                Self::new(StatusCode::NOT_FOUND, "not_found", "Photo not found.")
            }
            PhotoError::Store(error) => error.into(),
        }
    }
}

impl From<RemoteError> for ApiError {
    fn from(error: RemoteError) -> Self {
        let code = match error {
            RemoteError::NoSwatch => "no_swatch",
            RemoteError::TooLarge => "too_large",
            _ => "download_failed",
        };
        Self::new(StatusCode::BAD_REQUEST, code, error.to_string())
    }
}

impl From<BackupError> for ApiError {
    fn from(error: BackupError) -> Self {
        match error {
            BackupError::Store(error) => error.into(),
            other => Self::new(StatusCode::BAD_REQUEST, "bad_backup", other.to_string()),
        }
    }
}

type ApiResult<T> = Result<T, ApiError>;

/// Runs blocking storage work off the async threads.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, ApiError> + Send + 'static,
) -> ApiResult<T> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(ApiError::internal)?
}

fn state_json(loaded: &Loaded) -> Value {
    json!({ "collection": loaded.collection, "revision": loaded.revision })
}

pub fn router(state: AppState) -> Router {
    let admin = Router::new()
        .route("/api/collection", get(get_collection))
        .route("/api/commands", post(run_command))
        .route(
            "/api/uploads/{section}",
            post(upload_photo).layer(DefaultBodyLimit::max(MAX_UPLOAD_BYTES + 1024)),
        )
        .route("/api/uploads/{section}/from-url", post(photo_from_url))
        .route("/api/inkswatch", get(find_inkswatch))
        .route("/api/photos/{*path}", get(admin_photo))
        .route("/api/thumbs/{*path}", get(admin_thumb))
        .route("/api/backups", get(list_backups))
        .route("/api/backups/export", get(export_backup))
        .route(
            "/api/backups/restore",
            post(restore_backup).layer(DefaultBodyLimit::disable()),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_admin,
        ));

    let web_dir = state.config.web_dir.clone();
    let app = Router::new()
        .route("/api/health", get(|| async { Json(json!({ "ok": true })) }))
        .route(
            "/api/app-info",
            get(|| async { Json(json!({ "version": VERSION })) }),
        )
        .route("/api/public", get(public_collection))
        .route("/public/photos/{*path}", get(public_photo))
        .route("/public/thumbs/{*path}", get(public_thumb))
        .route("/auth/login", post(auth::login))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/session", get(auth::session))
        .merge(admin)
        .route(
            "/api/{*rest}",
            any(|| async {
                ApiError::new(StatusCode::NOT_FOUND, "not_found", "No such endpoint.")
            }),
        );
    // The interface built into the program, or a folder given for development.
    let app = match web_dir {
        Some(dir) => app
            .fallback_service(ServeDir::new(&dir).fallback(ServeFile::new(dir.join("index.html")))),
        None => app.fallback(web::serve),
    };
    app.layer(DefaultBodyLimit::max(MAX_JSON_BYTES))
        .layer(middleware::from_fn(auth::same_origin_only))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::REFERRER_POLICY,
            HeaderValue::from_static("same-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("frame-ancestors 'none'"),
        ))
        .with_state(state)
}

/// Makes a scheduled backup whenever one is due, checking every hour.
pub async fn run_backup_schedule(store: Store) {
    let mut ticker = tokio::time::interval(BACKUP_CHECK_INTERVAL);
    loop {
        ticker.tick().await;
        let store = store.clone();
        let result =
            tokio::task::spawn_blocking(move || store.auto_backup_if_due(VERSION, now())).await;
        match result {
            Ok(Ok(Some(backup))) => println!("Scheduled backup written: {}", backup.file_name),
            Ok(Ok(None)) => {}
            Ok(Err(error)) => eprintln!("Scheduled backup failed: {error}"),
            Err(error) => eprintln!("Scheduled backup task failed: {error}"),
        }
    }
}

// ---------- collection ----------

async fn get_collection(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let store = state.store.clone();
    let loaded = blocking(move || Ok(store.load()?)).await?;
    Ok(Json(state_json(&loaded)))
}

#[derive(Deserialize)]
struct CommandRequest {
    command: Command,
    revision: String,
}

async fn run_command(
    State(state): State<AppState>,
    Json(request): Json<CommandRequest>,
) -> ApiResult<Json<Value>> {
    let store = state.store.clone();
    let (loaded, retired) = blocking(move || {
        let (loaded, outcome) = store.apply(request.command, &request.revision, now())?;
        let keep = loaded.collection.settings.backups.keep_replaced_photos;
        // The change is saved; failing to tidy photos must not report failure.
        let retired = store
            .retire_photos(&outcome.unused_images, keep)
            .unwrap_or_else(|error| {
                eprintln!("Could not retire unused photos: {error}");
                Vec::new()
            });
        Ok((loaded, retired))
    })
    .await?;
    let mut body = state_json(&loaded);
    body["retired_photos"] = json!(retired);
    Ok(Json(body))
}

// ---------- photos ----------

fn section(raw: &str) -> ApiResult<ImageSection> {
    ImageSection::ALL
        .into_iter()
        .find(|s| s.dir() == raw)
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "not_found", "Unknown photo section."))
}

#[derive(Deserialize)]
struct NameQuery {
    #[serde(default)]
    name: String,
}

async fn upload_photo(
    State(state): State<AppState>,
    Path(raw_section): Path<String>,
    Query(query): Query<NameQuery>,
    body: axum::body::Bytes,
) -> ApiResult<Json<Value>> {
    let section = section(&raw_section)?;
    let store = state.store.clone();
    let path = blocking(move || Ok(store.add_photo(section, &body, &query.name)?)).await?;
    Ok(Json(json!({ "path": path })))
}

#[derive(Deserialize)]
struct FromUrl {
    url: String,
    #[serde(default)]
    name: String,
}

async fn photo_from_url(
    State(state): State<AppState>,
    Path(raw_section): Path<String>,
    Json(request): Json<FromUrl>,
) -> ApiResult<Json<Value>> {
    let section = section(&raw_section)?;
    let downloaded = remote::download_image(&request.url).await?;
    let store = state.store.clone();
    let path =
        blocking(move || Ok(store.add_photo(section, &downloaded.bytes, &request.name)?)).await?;
    Ok(Json(json!({ "path": path })))
}

#[derive(Deserialize)]
struct SwatchQuery {
    query: String,
}

async fn find_inkswatch(Query(q): Query<SwatchQuery>) -> ApiResult<Json<Value>> {
    let found = remote::find_inkswatch(&q.query).await?;
    Ok(Json(
        json!({ "image_url": found.image_url, "ink_name": found.ink_name }),
    ))
}

async fn send_file(path: PathBuf, cache: &'static str) -> ApiResult<Response> {
    let bytes = tokio::fs::read(&path).await.map_err(ApiError::internal)?;
    let mime = match path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("avif") => "image/avif",
        _ => "image/webp",
    };
    Ok((
        [(header::CONTENT_TYPE, mime), (header::CACHE_CONTROL, cache)],
        bytes,
    )
        .into_response())
}

async fn admin_photo(
    State(state): State<AppState>,
    Path(path): Path<String>,
) -> ApiResult<Response> {
    let store = state.store.clone();
    let file = blocking(move || Ok(store.photo_file(&path)?)).await?;
    send_file(file, "private, max-age=3600").await
}

async fn admin_thumb(
    State(state): State<AppState>,
    Path(path): Path<String>,
) -> ApiResult<Response> {
    let store = state.store.clone();
    let file = blocking(move || Ok(store.thumbnail_file(&path)?)).await?;
    send_file(file, "private, max-age=3600").await
}

// ---------- showcase ----------

async fn public_collection(State(state): State<AppState>) -> ApiResult<Response> {
    let store = state.store.clone();
    let loaded = blocking(move || Ok(store.load()?)).await?;
    let public = project(&loaded.collection).ok_or_else(|| {
        ApiError::new(
            StatusCode::NOT_FOUND,
            "showcase_off",
            "This collection is private.",
        )
    })?;
    Ok(([(header::CACHE_CONTROL, "no-cache")], Json(public)).into_response())
}

/// Serves a photo only if a visitor can see the item it belongs to.
async fn visible_photo(state: AppState, path: String, thumb: bool) -> ApiResult<Response> {
    let store = state.store.clone();
    let file = blocking(move || {
        let loaded = store.load()?;
        // Nothing is public while the showcase is off.
        let visible = project(&loaded.collection)
            .is_some_and(|public| public.photo_paths().contains(path.as_str()));
        if !visible {
            return Err(PhotoError::NotFound(path).into());
        }
        Ok(if thumb {
            store.thumbnail_file(&path)?
        } else {
            store.photo_file(&path)?
        })
    })
    .await?;
    send_file(file, "public, max-age=300").await
}

async fn public_photo(
    State(state): State<AppState>,
    Path(path): Path<String>,
) -> ApiResult<Response> {
    visible_photo(state, path, false).await
}

async fn public_thumb(
    State(state): State<AppState>,
    Path(path): Path<String>,
) -> ApiResult<Response> {
    visible_photo(state, path, true).await
}

// ---------- backups ----------

async fn list_backups(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let store = state.store.clone();
    let (backups, settings) = blocking(move || {
        let settings = store.load()?.collection.settings.backups;
        Ok((store.auto_backups()?, settings))
    })
    .await?;
    Ok(Json(json!({ "scheduled": backups, "settings": settings })))
}

/// `YYYY-MM-DD` (UTC) for a millisecond timestamp.
fn date_of(ms: i64) -> String {
    // Days since 1970-01-01 to a civil date (Howard Hinnant's algorithm).
    let z = ms.div_euclid(86_400_000) + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}")
}

async fn export_backup(State(state): State<AppState>) -> ApiResult<Response> {
    let store = state.store.clone();
    let at = now();
    let file = blocking(move || {
        let file = tempfile::Builder::new()
            .prefix(".export-")
            .suffix(".zip")
            .tempfile_in(store.backups_dir())
            .map_err(ApiError::internal)?;
        store.write_backup(file.path(), "manual", VERSION, at)?;
        Ok(file)
    })
    .await?;
    // The temporary file is removed when `file` is dropped after reading.
    let bytes = tokio::fs::read(file.path())
        .await
        .map_err(ApiError::internal)?;
    drop(file);
    let disposition = format!(
        "attachment; filename=\"inkubator-backup-{}.zip\"",
        date_of(at)
    );
    Ok((
        [
            (header::CONTENT_TYPE, "application/zip".to_string()),
            (header::CONTENT_DISPOSITION, disposition),
            (header::CACHE_CONTROL, "no-store".to_string()),
        ],
        Body::from(bytes),
    )
        .into_response())
}

#[derive(Deserialize)]
struct RevisionQuery {
    revision: String,
}

async fn restore_backup(
    State(state): State<AppState>,
    Query(query): Query<RevisionQuery>,
    request: Request,
) -> ApiResult<Json<Value>> {
    use std::io::Write;

    let store = state.store.clone();
    let mut file = tempfile::Builder::new()
        .prefix(".upload-")
        .suffix(".zip")
        .tempfile_in(store.backups_dir())
        .map_err(ApiError::internal)?;
    let mut body = request.into_body();
    let mut received = 0u64;
    while let Some(frame) = body.frame().await {
        let frame = frame
            .map_err(|e| ApiError::new(StatusCode::BAD_REQUEST, "upload_failed", e.to_string()))?;
        if let Some(chunk) = frame.data_ref() {
            received += chunk.len() as u64;
            if received > inkubator_core::backup::MAX_BACKUP_BYTES {
                return Err(BackupError::TooLarge.into());
            }
            file.write_all(chunk).map_err(ApiError::internal)?;
        }
    }
    let loaded =
        blocking(move || Ok(store.restore_backup(file.path(), &query.revision, VERSION, now())?))
            .await?;
    Ok(Json(state_json(&loaded)))
}

#[cfg(test)]
mod tests {
    use super::date_of;

    #[test]
    fn dates() {
        assert_eq!(date_of(0), "1970-01-01");
        assert_eq!(date_of(1_759_795_200_000), "2025-10-07");
        assert_eq!(date_of(951_782_400_000), "2000-02-29");
    }
}
