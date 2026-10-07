//! The web interface, built into the program so a single file is all that is
//! needed. `web/dist` is embedded at compile time; build the web interface
//! (`npm run build` in `web/`) before building a release.

use axum::body::Body;
use axum::http::{header, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "../../web/dist"]
#[allow_missing = true]
struct Assets;

/// Serves a file of the interface, or `index.html` for the app's own pages so
/// that addresses such as `/inks?ink=…` open the app.
pub async fn serve(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    if let Some(file) = (!path.is_empty()).then(|| Assets::get(path)).flatten() {
        // File names under assets/ carry a content hash, so they never change.
        let cache = if path.starts_with("assets/") {
            "public, max-age=31536000, immutable"
        } else {
            "public, max-age=3600"
        };
        return (
            [
                (header::CONTENT_TYPE, file.metadata.mimetype().to_string()),
                (header::CACHE_CONTROL, cache.to_string()),
            ],
            Body::from(file.data.into_owned()),
        )
            .into_response();
    }
    match Assets::get("index.html") {
        Some(index) => (
            [
                (header::CONTENT_TYPE, "text/html; charset=utf-8"),
                (header::CACHE_CONTROL, "no-cache"),
            ],
            Body::from(index.data.into_owned()),
        )
            .into_response(),
        None => (
            StatusCode::SERVICE_UNAVAILABLE,
            "This copy of Inkubator was built without its web interface.",
        )
            .into_response(),
    }
}
