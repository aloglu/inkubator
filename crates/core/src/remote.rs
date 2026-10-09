//! Downloading photos from the web without exposing the local network.
//!
//! Only https URLs are fetched. Every address a host resolves to must be public,
//! and the connection is pinned to those checked addresses, so DNS tricks can't
//! redirect it to a private one. Redirects are followed by hand and re-checked.
//! Responses must be raster images and are capped in size and time.

use std::net::{IpAddr, SocketAddr};
use std::time::Duration;

use reqwest::header::{ACCEPT, CONTENT_TYPE, LOCATION};
use tokio::net::lookup_host;
use tokio::time::timeout;
use url::Url;

use crate::photos::MAX_UPLOAD_BYTES;

/// Chooses the `ring` crypto backend for HTTPS, once per process.
pub(crate) fn use_ring_crypto() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        // Fails only if a backend was already chosen, which is fine.
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
}

const MAX_REDIRECTS: usize = 5;
pub(crate) const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(15);
pub(crate) const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, thiserror::Error)]
pub enum RemoteError {
    #[error("that is not a valid web address")]
    InvalidUrl,
    #[error("only https addresses can be used")]
    NotHttps,
    #[error("web addresses with a username or password can't be used")]
    HasCredentials,
    #[error("that address points to a private or local network")]
    PrivateAddress,
    #[error("could not reach {0}")]
    Unreachable(String),
    #[error("the address redirected too many times")]
    TooManyRedirects,
    #[error("the server answered {0}")]
    Status(u16),
    #[error("that address is not a photo")]
    NotAnImage,
    #[error("the photo is larger than {} MB", MAX_UPLOAD_BYTES / (1024 * 1024))]
    TooLarge,
    #[error("the download took too long")]
    TimedOut,
    #[error("no swatch was found for that ink")]
    NoSwatch,
}

type Result<T> = std::result::Result<T, RemoteError>;

/// A downloaded image, before it is stored.
#[derive(Clone, Debug)]
pub struct Downloaded {
    pub bytes: Vec<u8>,
    pub final_url: String,
    pub mime_type: String,
}

/// Addresses that must never be fetched: loopback, private, link-local,
/// carrier-grade NAT, documentation, benchmarking, multicast and reserved ranges.
pub fn is_forbidden_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(a) => {
            let o = a.octets();
            a.is_unspecified()
                || a.is_loopback()
                || a.is_private()
                || a.is_link_local()
                || a.is_multicast()
                || a.is_broadcast()
                || o[0] == 0
                || (o[0] == 100 && (64..=127).contains(&o[1]))
                || (o[0] == 192 && o[1] == 0 && (o[2] == 0 || o[2] == 2))
                || (o[0] == 198 && (o[1] == 18 || o[1] == 19))
                || (o[0] == 198 && o[1] == 51 && o[2] == 100)
                || (o[0] == 203 && o[1] == 0 && o[2] == 113)
                || o[0] >= 240
        }
        IpAddr::V6(a) => {
            if let Some(mapped) = a.to_ipv4_mapped() {
                return is_forbidden_ip(IpAddr::V4(mapped));
            }
            let s = a.segments();
            a.is_unspecified()
                || a.is_loopback()
                || a.is_unique_local()
                || a.is_unicast_link_local()
                || a.is_multicast()
                || (s[0] == 0x2001 && s[1] == 0x0db8)
        }
    }
}

fn check_url(url: &Url) -> Result<()> {
    if url.scheme() != "https" {
        return Err(RemoteError::NotHttps);
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(RemoteError::HasCredentials);
    }
    if url.host_str().is_none() {
        return Err(RemoteError::InvalidUrl);
    }
    Ok(())
}

fn image_mime(raw: &str) -> Option<String> {
    let mime = raw.split(';').next()?.trim().to_ascii_lowercase();
    matches!(
        mime.as_str(),
        "image/jpeg"
            | "image/jpg"
            | "image/png"
            | "image/webp"
            | "image/gif"
            | "image/heic"
            | "image/heif"
    )
    .then_some(mime)
}

async fn public_addresses(url: &Url) -> Result<(String, Vec<SocketAddr>)> {
    check_url(url)?;
    let host = url.host_str().ok_or(RemoteError::InvalidUrl)?.to_string();
    let port = url.port_or_known_default().ok_or(RemoteError::InvalidUrl)?;
    let mut addresses: Vec<SocketAddr> = lookup_host((host.as_str(), port))
        .await
        .map_err(|_| RemoteError::Unreachable(host.clone()))?
        .collect();
    addresses.sort_unstable();
    addresses.dedup();
    if addresses.is_empty() {
        return Err(RemoteError::Unreachable(host));
    }
    if addresses.iter().any(|a| is_forbidden_ip(a.ip())) {
        return Err(RemoteError::PrivateAddress);
    }
    Ok((host, addresses))
}

/// Downloads an image from a public https address.
pub async fn download_image(raw_url: &str) -> Result<Downloaded> {
    use_ring_crypto();
    timeout(DOWNLOAD_TIMEOUT, download_inner(raw_url))
        .await
        .map_err(|_| RemoteError::TimedOut)?
}

async fn download_inner(raw_url: &str) -> Result<Downloaded> {
    let mut current = Url::parse(raw_url.trim()).map_err(|_| RemoteError::InvalidUrl)?;
    for _ in 0..=MAX_REDIRECTS {
        let (host, addresses) = public_addresses(&current).await?;
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(CONNECT_TIMEOUT)
            .resolve_to_addrs(&host, &addresses)
            .build()
            .map_err(|_| RemoteError::Unreachable(host.clone()))?;
        let mut response = client
            .get(current.clone())
            .header(
                ACCEPT,
                "image/webp,image/png,image/jpeg,image/heic,image/heif",
            )
            .send()
            .await
            .map_err(|_| RemoteError::Unreachable(host.clone()))?;
        if response
            .remote_addr()
            .is_some_and(|addr| is_forbidden_ip(addr.ip()))
        {
            return Err(RemoteError::PrivateAddress);
        }

        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or(RemoteError::InvalidUrl)?;
            current = current
                .join(location)
                .map_err(|_| RemoteError::InvalidUrl)?;
            continue;
        }
        if !response.status().is_success() {
            return Err(RemoteError::Status(response.status().as_u16()));
        }
        let mime_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .and_then(image_mime)
            .ok_or(RemoteError::NotAnImage)?;
        if response
            .content_length()
            .is_some_and(|len| len > MAX_UPLOAD_BYTES as u64)
        {
            return Err(RemoteError::TooLarge);
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| RemoteError::Unreachable(host.clone()))?
        {
            if bytes.len() + chunk.len() > MAX_UPLOAD_BYTES {
                return Err(RemoteError::TooLarge);
            }
            bytes.extend_from_slice(&chunk);
        }
        if bytes.is_empty() {
            return Err(RemoteError::NotAnImage);
        }
        return Ok(Downloaded {
            bytes,
            final_url: current.to_string(),
            mime_type,
        });
    }
    Err(RemoteError::TooManyRedirects)
}

/// A swatch photo found on inkswatch.com.
#[derive(Clone, Debug, PartialEq)]
pub struct FoundSwatch {
    pub image_url: String,
    pub ink_name: String,
}

const INKSWATCH: &str = "https://inkswatch.com";

/// Looks up an ink on inkswatch.com and returns the address of its swatch photo.
/// Download it with [`download_image`].
pub async fn find_inkswatch(query: &str) -> Result<FoundSwatch> {
    use_ring_crypto();
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .map_err(|_| RemoteError::Unreachable(INKSWATCH.into()))?;
    let fetch = |url: String| {
        let client = client.clone();
        async move {
            let response = timeout(DOWNLOAD_TIMEOUT, client.get(url).send())
                .await
                .map_err(|_| RemoteError::TimedOut)?
                .map_err(|_| RemoteError::Unreachable(INKSWATCH.into()))?;
            if !response.status().is_success() {
                return Err(RemoteError::Status(response.status().as_u16()));
            }
            response
                .text()
                .await
                .map_err(|_| RemoteError::Unreachable(INKSWATCH.into()))
        }
    };

    let search = fetch(format!(
        "{INKSWATCH}/getSearchResults.php?query={}",
        urlencoding::encode(query)
    ))
    .await?;
    let (id, ink_name) = parse_inkswatch_search(&search, query).ok_or(RemoteError::NoSwatch)?;
    let detail = fetch(format!("{INKSWATCH}/getInkChoiceSwatches.php?inkId={id}")).await?;
    let image = parse_inkswatch_detail(&detail, &id).ok_or(RemoteError::NoSwatch)?;
    Ok(FoundSwatch {
        image_url: format!("{INKSWATCH}/{image}"),
        ink_name,
    })
}

/// The first result's ink id and name from an inkswatch search page.
fn parse_inkswatch_search(html: &str, query: &str) -> Option<(String, String)> {
    const MARKER: &str = "ink.html?inkId=";
    let start = html.find(MARKER)? + MARKER.len();
    let id: String = html[start..]
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();
    if id.is_empty() {
        return None;
    }
    let name = html[start..]
        .find('>')
        .and_then(|offset| {
            let text = start + offset + 1;
            html[text..]
                .find("</a>")
                .map(|end| html[text..text + end].trim().to_string())
        })
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| query.to_string());
    Some((id, name))
}

/// The swatch image path from an inkswatch detail page. Only plain relative
/// paths are accepted, so the result stays on inkswatch.com.
fn parse_inkswatch_detail(html: &str, id: &str) -> Option<String> {
    let marker = format!("id=\"ink{id}Swatch\" src=\"");
    let start = html.find(&marker)? + marker.len();
    let end = html[start..].find('"')?;
    let path = &html[start..start + end];
    let plain = !path.is_empty()
        && !path.starts_with('/')
        && !path.contains("//")
        && !path.contains("..")
        && path
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "/._-".contains(c));
    plain.then(|| path.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_and_special_addresses_are_forbidden() {
        for ip in [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "0.0.0.0",
            "::1",
            "fd00::1",
            "fe80::1",
            "::ffff:192.168.1.1",
        ] {
            assert!(is_forbidden_ip(ip.parse().unwrap()), "{ip}");
        }
        for ip in ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"] {
            assert!(!is_forbidden_ip(ip.parse().unwrap()), "{ip}");
        }
    }

    #[test]
    fn only_plain_https_urls_are_accepted() {
        assert!(check_url(&Url::parse("https://example.com/a.jpg").unwrap()).is_ok());
        assert!(matches!(
            check_url(&Url::parse("http://example.com/a.jpg").unwrap()),
            Err(RemoteError::NotHttps)
        ));
        assert!(matches!(
            check_url(&Url::parse("https://user:pw@example.com/").unwrap()),
            Err(RemoteError::HasCredentials)
        ));
    }

    #[tokio::test]
    async fn local_hosts_are_refused_before_connecting() {
        assert!(matches!(
            download_image("https://127.0.0.1/photo.jpg").await,
            Err(RemoteError::PrivateAddress)
        ));
        assert!(matches!(
            download_image("https://localhost/photo.jpg").await,
            Err(RemoteError::PrivateAddress)
        ));
    }

    #[test]
    fn inkswatch_pages_are_parsed_safely() {
        let search = r#"<a href="ink.html?inkId=1234">Sailor Yama-dori</a>"#;
        assert_eq!(
            parse_inkswatch_search(search, "yama-dori"),
            Some(("1234".into(), "Sailor Yama-dori".into()))
        );
        assert_eq!(parse_inkswatch_search("nothing here", "x"), None);

        let detail = r#"<img id="ink1234Swatch" src="swatches/1234.jpg">"#;
        assert_eq!(
            parse_inkswatch_detail(detail, "1234").as_deref(),
            Some("swatches/1234.jpg")
        );
        for bad in [
            "//evil.com/x.jpg",
            "../x.jpg",
            "/abs.jpg",
            "https://evil.com/x.jpg",
        ] {
            let html = format!(r#"<img id="ink1Swatch" src="{bad}">"#);
            assert_eq!(parse_inkswatch_detail(&html, "1"), None, "{bad}");
        }
    }
}
