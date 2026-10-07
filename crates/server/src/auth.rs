//! Signing in: session cookies for the browser, a limit on failed attempts, and
//! refusal of cross-site requests that change data.

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use axum::extract::{ConnectInfo, Request, State};
use axum::http::{header, HeaderMap, Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use base64::Engine;
use serde::Deserialize;

use crate::config::Credentials;
use crate::{ApiError, AppState};

pub const SESSION_COOKIE: &str = "inkubator_session";
pub const SESSION_TTL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const MAX_FAILURES: u32 = 5;
const FAILURE_WINDOW: Duration = Duration::from_secs(15 * 60);

#[derive(Default)]
pub struct Sessions {
    sessions: Mutex<HashMap<String, Instant>>,
    failures: Mutex<HashMap<IpAddr, (u32, Instant)>>,
}

impl Sessions {
    fn create(&self) -> String {
        let mut bytes = [0u8; 32];
        getrandom::fill(&mut bytes).expect("the system random source works");
        let token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);
        let mut sessions = self.sessions.lock().unwrap();
        sessions.retain(|_, created| created.elapsed() < SESSION_TTL);
        sessions.insert(token.clone(), Instant::now());
        token
    }

    fn is_valid(&self, token: &str) -> bool {
        self.sessions
            .lock()
            .unwrap()
            .get(token)
            .is_some_and(|created| created.elapsed() < SESSION_TTL)
    }

    fn end(&self, token: &str) {
        self.sessions.lock().unwrap().remove(token);
    }

    /// True while an address has failed too often recently.
    fn is_locked_out(&self, ip: IpAddr) -> bool {
        let mut failures = self.failures.lock().unwrap();
        match failures.get(&ip) {
            Some((_, since)) if since.elapsed() >= FAILURE_WINDOW => {
                failures.remove(&ip);
                false
            }
            Some((count, _)) => *count >= MAX_FAILURES,
            None => false,
        }
    }

    fn record_failure(&self, ip: IpAddr) {
        let mut failures = self.failures.lock().unwrap();
        let entry = failures.entry(ip).or_insert((0, Instant::now()));
        entry.0 += 1;
    }

    fn clear_failures(&self, ip: IpAddr) {
        self.failures.lock().unwrap().remove(&ip);
    }
}

/// Compares secrets without exiting early, so timing doesn't reveal how much matched.
fn same(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    let mut diff = a.len() ^ b.len();
    for i in 0..a.len().max(b.len()) {
        diff |= usize::from(a.get(i).copied().unwrap_or(0) ^ b.get(i).copied().unwrap_or(0));
    }
    diff == 0
}

/// Checks a sign-in. A stored password is an argon2 hash, deliberately slow
/// to check, so callers run this off the async threads.
fn credentials_ok(credentials: &Credentials, user: &str, password: &str) -> bool {
    match credentials {
        Credentials::Given {
            user: expected_user,
            password: expected,
        } => same(user, expected_user) & same(password, expected),
        Credentials::Stored(stored) => stored.verify(user, password),
        Credentials::Insecure => true,
    }
}

fn cookie<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(key, _)| *key == name)
        .map(|(_, value)| value)
}

fn first_value<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(str::trim)
        .filter(|v| !v.is_empty())
}

/// Whether the browser reached us over https, directly or through a proxy.
fn uses_https(headers: &HeaderMap) -> bool {
    first_value(headers, "x-forwarded-proto").is_some_and(|p| p.eq_ignore_ascii_case("https"))
}

fn session_cookie(token: &str, max_age: u64, secure: bool) -> String {
    let mut value =
        format!("{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}");
    if secure {
        value.push_str("; Secure");
    }
    value
}

pub fn is_authorized(state: &AppState, headers: &HeaderMap) -> bool {
    state.config.insecure()
        || cookie(headers, SESSION_COOKIE).is_some_and(|token| state.sessions.is_valid(token))
}

/// Requires a signed-in admin.
pub async fn require_admin(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    if is_authorized(&state, request.headers()) {
        next.run(request).await
    } else {
        ApiError::new(StatusCode::UNAUTHORIZED, "unauthorized", "Sign in first.").into_response()
    }
}

/// Refuses requests that change data when they come from another site.
pub async fn same_origin_only(request: Request, next: Next) -> Response {
    if matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    ) {
        return next.run(request).await;
    }
    let headers = request.headers();
    let forbidden = || {
        ApiError::new(
            StatusCode::FORBIDDEN,
            "cross_site",
            "Requests from other sites are not allowed.",
        )
        .into_response()
    };
    if let Some(site) = first_value(headers, "sec-fetch-site") {
        if !site.eq_ignore_ascii_case("same-origin") && !site.eq_ignore_ascii_case("none") {
            return forbidden();
        }
    }
    // The page's host must be the one the request was sent to. Only the host
    // is compared: behind an HTTPS proxy that does not say so, the browser's
    // origin is https while the server sees http, yet it is the same site.
    if let Some(origin) = first_value(headers, "origin") {
        let host =
            first_value(headers, "x-forwarded-host").or_else(|| first_value(headers, "host"));
        let origin_host = origin
            .strip_prefix("https://")
            .or_else(|| origin.strip_prefix("http://"));
        let same = match (origin_host, host) {
            (Some(a), Some(b)) => a.eq_ignore_ascii_case(b),
            _ => false,
        };
        if !same {
            return forbidden();
        }
    }
    next.run(request).await
}

#[derive(Deserialize)]
pub struct Login {
    username: String,
    password: String,
}

pub async fn login(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(login): Json<Login>,
) -> Response {
    let ip = peer.ip();
    if state.sessions.is_locked_out(ip) {
        return ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "too_many_attempts",
            "Too many failed sign-ins. Try again in 15 minutes.",
        )
        .into_response();
    }
    let credentials = state.config.credentials.clone();
    let ok = tokio::task::spawn_blocking(move || {
        credentials_ok(&credentials, &login.username, &login.password)
    })
    .await
    .unwrap_or(false);
    if !ok {
        state.sessions.record_failure(ip);
        return ApiError::new(
            StatusCode::UNAUTHORIZED,
            "bad_credentials",
            "Wrong username or password.",
        )
        .into_response();
    }
    state.sessions.clear_failures(ip);
    let token = state.sessions.create();
    (
        [(
            header::SET_COOKIE,
            session_cookie(&token, SESSION_TTL.as_secs(), uses_https(&headers)),
        )],
        Json(serde_json::json!({ "signed_in": true })),
    )
        .into_response()
}

pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(token) = cookie(&headers, SESSION_COOKIE) {
        state.sessions.end(token);
    }
    (
        [(
            header::SET_COOKIE,
            session_cookie("", 0, uses_https(&headers)),
        )],
        Json(serde_json::json!({ "signed_in": false })),
    )
        .into_response()
}

pub async fn session(State(state): State<AppState>, headers: HeaderMap) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "signed_in": is_authorized(&state, &headers) }))
}

#[cfg(test)]
mod tests {
    use super::same;

    #[test]
    fn secret_comparison() {
        assert!(same("hunter2", "hunter2"));
        assert!(!same("hunter2", "hunter3"));
        assert!(!same("hunter2", "hunter22"));
        assert!(!same("", "x"));
        assert!(same("", ""));
    }
}
