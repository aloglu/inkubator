use std::io::Cursor;
use std::net::SocketAddr;

use axum::body::Body;
use axum::extract::connect_info::MockConnectInfo;
use axum::http::{header, Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use inkubator_server::{router, AppState, Config};
use serde_json::{json, Value};
use tower::ServiceExt;

const PASSWORD: &str = "correct horse";

struct Server {
    app: Router,
    _dir: tempfile::TempDir,
}

fn server() -> Server {
    let dir = tempfile::tempdir().unwrap();
    let config = Config::from_lookup(|key| match key {
        "INKUBATOR_DATA_DIR" => Some(dir.path().display().to_string()),
        "INKUBATOR_WEB_DIR" => Some(dir.path().join("web").display().to_string()),
        "INKUBATOR_ADMIN_PASSWORD" => Some(PASSWORD.into()),
        _ => None,
    })
    .unwrap();
    let app = router(AppState::new(config).unwrap())
        .layer(MockConnectInfo(SocketAddr::from(([203, 0, 113, 9], 4000))));
    Server { app, _dir: dir }
}

struct Reply {
    status: StatusCode,
    headers: axum::http::HeaderMap,
    bytes: Vec<u8>,
}

impl Reply {
    fn json(&self) -> Value {
        serde_json::from_slice(&self.bytes).unwrap_or(Value::Null)
    }
}

impl Server {
    async fn send(&self, request: Request<Body>) -> Reply {
        let response = self.app.clone().oneshot(request).await.unwrap();
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes()
            .to_vec();
        Reply {
            status,
            headers,
            bytes,
        }
    }

    async fn login(&self) -> String {
        let reply = self
            .send(json_request(
                "POST",
                "/auth/login",
                None,
                json!({ "username": "admin", "password": PASSWORD }),
            ))
            .await;
        assert_eq!(reply.status, StatusCode::OK);
        let cookie = reply.headers[header::SET_COOKIE].to_str().unwrap();
        assert!(cookie.contains("HttpOnly") && cookie.contains("SameSite=Lax"));
        cookie.split(';').next().unwrap().to_string()
    }

    async fn collection(&self, cookie: &str) -> Value {
        self.send(get("/api/collection", Some(cookie))).await.json()
    }

    async fn command(&self, cookie: &str, command: Value) -> Reply {
        let revision = self.collection(cookie).await["revision"].clone();
        self.send(json_request(
            "POST",
            "/api/commands",
            Some(cookie),
            json!({ "command": command, "revision": revision }),
        ))
        .await
    }
}

fn get(uri: &str, cookie: Option<&str>) -> Request<Body> {
    let mut builder = Request::get(uri);
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, cookie);
    }
    builder.body(Body::empty()).unwrap()
}

fn json_request(method: &str, uri: &str, cookie: Option<&str>, body: Value) -> Request<Body> {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::HOST, "inkubator.local")
        .header(header::ORIGIN, "http://inkubator.local");
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, cookie);
    }
    builder.body(Body::from(body.to_string())).unwrap()
}

fn bytes_request(uri: &str, cookie: &str, bytes: Vec<u8>) -> Request<Body> {
    Request::post(uri)
        .header(header::COOKIE, cookie)
        .header(header::HOST, "inkubator.local")
        .body(Body::from(bytes))
        .unwrap()
}

fn pen(id: &str, price: f64) -> Value {
    json!({
        "id": id, "brand": "Pelikan", "model": "M800", "color_name": "Green Stripe",
        "colors": ["#2f6b3a"], "nib_size": "B", "nib_material": "18k gold",
        "body_material": "Resin", "filling_systems": ["Piston"], "price": price,
        "purchased_on": null, "purchased_from": "A friend", "notes": "",
        "images": [], "created_at": 1, "updated_at": 1
    })
}

fn ink(id: &str) -> Value {
    json!({
        "id": id, "brand": "J. Herbin", "line": "1670", "name": "Emerald of Chivor",
        "kind": "bottle", "volume_ml": 50.0, "amount": 1, "price": 28.0,
        "base_color": "#0f6b5c", "sheen_color": "#c2502e", "shimmer": "gold",
        "sheen": "high", "shading": "high", "water_resistance": "none", "flow": "average",
        "lubrication": "low", "dry_time_seconds": 30, "base_types": ["dye", "shimmer"],
        "paper": ["friendly"], "notes": "", "images": [], "created_at": 1, "updated_at": 1
    })
}

fn png() -> Vec<u8> {
    let image = image::RgbImage::from_pixel(64, 48, image::Rgb([47, 107, 58]));
    let mut out = Cursor::new(Vec::new());
    image.write_to(&mut out, image::ImageFormat::Png).unwrap();
    out.into_inner()
}

#[tokio::test]
async fn admin_endpoints_need_a_sign_in() {
    let s = server();
    let reply = s.send(get("/api/collection", None)).await;
    assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
    assert_eq!(reply.json()["code"], "unauthorized");
    assert_eq!(
        s.send(get("/api/health", None)).await.status,
        StatusCode::OK
    );
    let private = s.send(get("/api/public", None)).await;
    assert_eq!(
        private.status,
        StatusCode::NOT_FOUND,
        "the showcase starts off"
    );
    assert_eq!(private.json()["code"], "showcase_off");

    let cookie = s.login().await;
    let state = s.collection(&cookie).await;
    assert_eq!(state["revision"], "empty");
    assert_eq!(state["collection"]["schema_version"], 3);

    let reply = s
        .send(json_request(
            "POST",
            "/auth/logout",
            Some(&cookie),
            json!({}),
        ))
        .await;
    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(
        s.send(get("/api/collection", Some(&cookie))).await.status,
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn repeated_wrong_passwords_lock_the_address_out() {
    let s = server();
    for _ in 0..5 {
        let reply = s
            .send(json_request(
                "POST",
                "/auth/login",
                None,
                json!({ "username": "admin", "password": "nope" }),
            ))
            .await;
        assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
    }
    let reply = s
        .send(json_request(
            "POST",
            "/auth/login",
            None,
            json!({ "username": "admin", "password": PASSWORD }),
        ))
        .await;
    assert_eq!(
        reply.status,
        StatusCode::TOO_MANY_REQUESTS,
        "even the right password waits"
    );
}

#[tokio::test]
async fn cross_site_changes_are_refused() {
    let s = server();
    let cookie = s.login().await;
    let request = Request::post("/api/commands")
        .header(header::COOKIE, &cookie)
        .header(header::HOST, "inkubator.local")
        .header(header::ORIGIN, "https://evil.example")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from("{}"))
        .unwrap();
    assert_eq!(s.send(request).await.status, StatusCode::FORBIDDEN);

    let request = Request::post("/auth/logout")
        .header(header::COOKIE, &cookie)
        .header("sec-fetch-site", "cross-site")
        .body(Body::empty())
        .unwrap();
    assert_eq!(s.send(request).await.status, StatusCode::FORBIDDEN);

    // Another site with the same host name on a different port is still another site.
    let request = Request::post("/auth/logout")
        .header(header::COOKIE, &cookie)
        .header(header::HOST, "inkubator.local")
        .header(header::ORIGIN, "http://inkubator.local:9999")
        .body(Body::empty())
        .unwrap();
    assert_eq!(s.send(request).await.status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn signing_in_works_behind_an_https_proxy() {
    // Such as `tailscale serve`: the browser is on https, the proxy forwards
    // plain http with the original host and no X-Forwarded-Proto.
    let s = server();
    let request = Request::post("/auth/login")
        .header(header::HOST, "box.tailnet.ts.net")
        .header(header::ORIGIN, "https://box.tailnet.ts.net")
        .header("sec-fetch-site", "same-origin")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "username": "admin", "password": PASSWORD }).to_string(),
        ))
        .unwrap();
    assert_eq!(s.send(request).await.status, StatusCode::OK);
}

#[tokio::test]
async fn commands_change_the_collection_and_report_conflicts() {
    let s = server();
    let cookie = s.login().await;
    assert_eq!(
        s.command(
            &cookie,
            json!({ "type": "save_pen", "pen": pen("pen_1", 560.0) })
        )
        .await
        .status,
        StatusCode::OK
    );
    assert_eq!(
        s.command(&cookie, json!({ "type": "save_ink", "ink": ink("ink_1") }))
            .await
            .status,
        StatusCode::OK
    );
    let reply = s
        .command(
            &cookie,
            json!({ "type": "ink_pen", "pen_id": "pen_1", "ink_id": "ink_1" }),
        )
        .await;
    assert_eq!(reply.status, StatusCode::OK);
    let fills = &reply.json()["collection"]["fills"];
    assert_eq!(fills[0]["ink_id"], "ink_1");
    assert!(fills[0]["emptied_at"].is_null());

    // Business rules come back as readable errors.
    let reply = s
        .command(&cookie, json!({ "type": "delete_ink", "id": "ink_1" }))
        .await;
    assert_eq!(reply.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(reply.json()["code"], "ink_in_use");

    // A window holding an old revision is told to reload.
    let reply = s
        .send(json_request(
            "POST",
            "/api/commands",
            Some(&cookie),
            json!({ "command": { "type": "flush_pen", "pen_id": "pen_1" }, "revision": "empty" }),
        ))
        .await;
    assert_eq!(reply.status, StatusCode::CONFLICT);
    assert_eq!(reply.json()["code"], "conflict");
    assert!(reply.json()["revision"].is_string());
}

#[tokio::test]
async fn photos_upload_attach_serve_and_retire() {
    let s = server();
    let cookie = s.login().await;
    let reply = s
        .send(bytes_request(
            "/api/uploads/pens?name=Pelikan%20M800",
            &cookie,
            png(),
        ))
        .await;
    assert_eq!(reply.status, StatusCode::OK);
    let path = reply.json()["path"].as_str().unwrap().to_string();
    assert_eq!(path, "pens/pelikan-m800.webp");

    let mut with_photo = pen("pen_1", 560.0);
    with_photo["images"] = json!([{ "id": "img_1", "path": path, "primary": true, "rotation": 0, "focus_x": 0.5, "focus_y": 0.5, "zoom": 1.0 }]);
    s.command(&cookie, json!({ "type": "save_pen", "pen": with_photo }))
        .await;

    let photo = s
        .send(get(&format!("/api/photos/{path}"), Some(&cookie)))
        .await;
    assert_eq!(photo.status, StatusCode::OK);
    assert_eq!(photo.headers[header::CONTENT_TYPE], "image/webp");
    assert_eq!(
        s.send(get(&format!("/api/thumbs/{path}"), Some(&cookie)))
            .await
            .status,
        StatusCode::OK
    );
    assert_eq!(
        s.send(get(&format!("/api/photos/{path}"), None))
            .await
            .status,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        s.send(get(
            "/api/photos/pens/..%2F..%2Finkubator.json",
            Some(&cookie)
        ))
        .await
        .status,
        StatusCode::NOT_FOUND
    );

    // Removing the photo from the pen retires the file.
    let reply = s
        .command(
            &cookie,
            json!({ "type": "save_pen", "pen": pen("pen_1", 560.0) }),
        )
        .await;
    assert_eq!(reply.json()["retired_photos"], json!([path]));
    assert_eq!(
        s.send(get(&format!("/api/photos/{path}"), Some(&cookie)))
            .await
            .status,
        StatusCode::NOT_FOUND
    );

    let reply = s
        .send(bytes_request(
            "/api/uploads/pens",
            &cookie,
            b"text".to_vec(),
        ))
        .await;
    assert_eq!(reply.status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    let reply = s
        .send(bytes_request("/api/uploads/notes", &cookie, png()))
        .await;
    assert_eq!(reply.status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn the_showcase_only_shows_what_is_allowed() {
    let s = server();
    let cookie = s.login().await;
    let photo = s
        .send(bytes_request("/api/uploads/pens?name=M800", &cookie, png()))
        .await
        .json()["path"]
        .as_str()
        .unwrap()
        .to_string();
    let mut with_photo = pen("pen_1", 560.0);
    with_photo["images"] = json!([{ "id": "img_1", "path": photo, "primary": true, "rotation": 0, "focus_x": 0.5, "focus_y": 0.5, "zoom": 1.0 }]);
    s.command(&cookie, json!({ "type": "save_pen", "pen": with_photo }))
        .await;

    // Off: neither the collection nor its photos are public.
    let photo_url = format!("/public/photos/{photo}");
    assert_eq!(
        s.send(get(&photo_url, None)).await.status,
        StatusCode::NOT_FOUND
    );

    let mut settings = s.collection(&cookie).await["collection"]["settings"].clone();
    settings["showcase"]["enabled"] = json!(true);
    s.command(
        &cookie,
        json!({ "type": "update_settings", "settings": settings }),
    )
    .await;

    let public = s.send(get("/api/public", None)).await.json();
    assert_eq!(public["show_pens"], true);
    assert_eq!(public["pens"][0]["model"], "M800");
    assert!(
        public["pens"][0]["price"].is_null(),
        "prices hidden by default"
    );
    assert_eq!(public["pens"][0]["purchased_from"], "");
    assert!(public.get("settings").is_none());
    assert_eq!(
        s.send(get(&format!("/public/photos/{photo}"), None))
            .await
            .status,
        StatusCode::OK
    );

    // Hide pens: their photos stop being served too.
    let mut settings = s.collection(&cookie).await["collection"]["settings"].clone();
    settings["showcase"]["show_pens"] = json!(false);
    s.command(
        &cookie,
        json!({ "type": "update_settings", "settings": settings }),
    )
    .await;
    assert_eq!(
        s.send(get("/api/public", None)).await.json()["pens"],
        json!([])
    );
    assert_eq!(
        s.send(get(&format!("/public/photos/{photo}"), None))
            .await
            .status,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn backups_export_and_restore() {
    let s = server();
    let cookie = s.login().await;
    s.command(
        &cookie,
        json!({ "type": "save_pen", "pen": pen("pen_1", 560.0) }),
    )
    .await;

    let export = s.send(get("/api/backups/export", Some(&cookie))).await;
    assert_eq!(export.status, StatusCode::OK);
    assert_eq!(export.headers[header::CONTENT_TYPE], "application/zip");
    assert!(export.headers[header::CONTENT_DISPOSITION]
        .to_str()
        .unwrap()
        .starts_with("attachment; filename=\"inkubator-backup-"));

    s.command(&cookie, json!({ "type": "delete_pen", "id": "pen_1" }))
        .await;
    let revision = s.collection(&cookie).await["revision"]
        .as_str()
        .unwrap()
        .to_string();
    let restore = s
        .send(bytes_request(
            &format!("/api/backups/restore?revision={revision}"),
            &cookie,
            export.bytes.clone(),
        ))
        .await;
    assert_eq!(restore.status, StatusCode::OK, "{:?}", restore.json());
    assert_eq!(restore.json()["collection"]["pens"][0]["id"], "pen_1");

    let backups = s.send(get("/api/backups", Some(&cookie))).await.json();
    assert_eq!(
        backups["scheduled"].as_array().unwrap().len(),
        1,
        "the safety backup"
    );

    let reply = s
        .send(bytes_request(
            &format!("/api/backups/restore?revision={revision}"),
            &cookie,
            b"junk".to_vec(),
        ))
        .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST);
    assert_eq!(reply.json()["code"], "bad_backup");

    // `revision` is stale now that the restore changed the collection.
    let reply = s
        .send(bytes_request(
            &format!("/api/backups/restore?revision={revision}"),
            &cookie,
            export.bytes,
        ))
        .await;
    assert_eq!(reply.status, StatusCode::CONFLICT);
}

#[tokio::test]
async fn unknown_api_paths_answer_in_json() {
    let s = server();
    let reply = s.send(get("/api/nope", None)).await;
    assert_eq!(reply.status, StatusCode::NOT_FOUND);
    assert_eq!(reply.json()["code"], "not_found");
    assert_eq!(reply.headers[header::X_FRAME_OPTIONS], "DENY");
}

#[tokio::test]
async fn update_checks_need_a_sign_in_and_can_be_turned_off() {
    let s = server();
    assert_eq!(
        s.send(get("/api/update", None)).await.status,
        StatusCode::UNAUTHORIZED
    );

    let cookie = s.login().await;
    let mut settings = s.collection(&cookie).await["collection"]["settings"].clone();
    assert_eq!(settings["check_for_updates"], true, "on by default");
    settings["check_for_updates"] = json!(false);
    s.command(
        &cookie,
        json!({ "type": "update_settings", "settings": settings }),
    )
    .await;

    // Off, nothing is asked of GitHub.
    let status = s.send(get("/api/update", Some(&cookie))).await.json();
    assert_eq!(
        status,
        json!({
            "current": env!("CARGO_PKG_VERSION"),
            "checking": false,
            "latest": null,
            "checked_at": null,
            "available": false,
        })
    );
}
