//! Whether a newer Inkubator is out, from the latest release on GitHub.
//!
//! Only the release's version, address and date are read. The request carries
//! nothing about the collection; GitHub sees the server's address and version.

use serde::{Deserialize, Serialize};
use tokio::time::timeout;

use crate::model::Timestamp;
use crate::remote::{use_ring_crypto, RemoteError, CONNECT_TIMEOUT, DOWNLOAD_TIMEOUT};

const LATEST_RELEASE: &str = "https://api.github.com/repos/aloglu/inkubator/releases/latest";
const RELEASE_PAGES: &str = "https://github.com/aloglu/inkubator/releases/";

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
/// A published release.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Release {
    /// Such as `3.0.2`, without the tag's `v`.
    pub version: String,
    /// The release page on GitHub.
    pub url: String,
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
/// What Settings shows about updates.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct UpdateStatus {
    /// The running version.
    pub current: String,
    /// False when checking is turned off in Settings.
    pub checking: bool,
    /// The latest release, once a check has succeeded.
    pub latest: Option<Release>,
    /// When the latest release was last checked successfully.
    pub checked_at: Option<Timestamp>,
    /// Whether `latest` is newer than `current`.
    pub available: bool,
}

/// Asks GitHub for the latest release. Drafts and pre-releases are never "latest".
pub async fn latest_release(app_version: &str) -> Result<Release, RemoteError> {
    use_ring_crypto();
    let unreachable = || RemoteError::Unreachable("github.com".into());
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .user_agent(format!("Inkubator/{app_version}"))
        .build()
        .map_err(|_| unreachable())?;
    let request = client
        .get(LATEST_RELEASE)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send();
    let response = timeout(DOWNLOAD_TIMEOUT, request)
        .await
        .map_err(|_| RemoteError::TimedOut)?
        .map_err(|_| unreachable())?;
    if !response.status().is_success() {
        return Err(RemoteError::Status(response.status().as_u16()));
    }
    let body = timeout(DOWNLOAD_TIMEOUT, response.bytes())
        .await
        .map_err(|_| RemoteError::TimedOut)?
        .map_err(|_| unreachable())?;
    parse_release(&body).ok_or_else(unreachable)
}

/// The version and page of a GitHub release, if they look like ours.
pub fn parse_release(json: &[u8]) -> Option<Release> {
    #[derive(Deserialize)]
    struct Raw {
        tag_name: String,
        html_url: String,
    }
    let raw: Raw = serde_json::from_slice(json).ok()?;
    let version = raw.tag_name.strip_prefix('v').unwrap_or(&raw.tag_name);
    // The page is linked from the app, so it must be one of this project's releases.
    if version_parts(version).is_none() || !raw.html_url.starts_with(RELEASE_PAGES) {
        return None;
    }
    Some(Release {
        version: version.to_string(),
        url: raw.html_url,
    })
}

/// Whether version `candidate` comes after `current`. A release comes after
/// its own pre-releases (`3.0.0` after `3.0.0-rc.1`); anything that is not a
/// version is never newer.
pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (version_parts(candidate), version_parts(current)) {
        (Some(candidate), Some(current)) => candidate > current,
        _ => false,
    }
}

/// `major.minor.patch` and whether it is a release (no `-pre` part).
fn version_parts(version: &str) -> Option<(u64, u64, u64, bool)> {
    let (core, pre) = match version.split_once('-') {
        Some((core, pre)) if !pre.is_empty() => (core, Some(pre)),
        Some(_) => return None,
        None => (version, None),
    };
    let mut numbers = core.split('.').map(|part| {
        (!part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
            .then(|| part.parse::<u64>().ok())
            .flatten()
    });
    let parts = (numbers.next()??, numbers.next()??, numbers.next()??);
    if numbers.next().is_some() {
        return None;
    }
    Some((parts.0, parts.1, parts.2, pre.is_none()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_compare_by_number() {
        assert!(is_newer("3.0.2", "3.0.1"));
        assert!(is_newer("3.1.0", "3.0.9"));
        assert!(is_newer("3.0.10", "3.0.9"));
        assert!(is_newer("4.0.0", "3.9.9"));
        assert!(is_newer("3.0.0", "3.0.0-rc.10"));
        assert!(!is_newer("3.0.1", "3.0.1"));
        assert!(!is_newer("3.0.0", "3.0.1"));
        assert!(!is_newer("3.0.0-rc.1", "3.0.0"));
    }

    #[test]
    fn anything_else_is_never_newer() {
        for odd in [
            "", "latest", "3", "3.0", "3.0.1.2", "3.x.1", "3.0.1-", " 3.0.2", "+3.0.2",
        ] {
            assert!(!is_newer(odd, "3.0.1"), "{odd:?}");
            assert!(!is_newer("3.0.2", odd), "{odd:?}");
        }
    }

    #[test]
    fn releases_are_read_from_github_answers() {
        let answer = br#"{"tag_name":"v3.0.2","html_url":"https://github.com/aloglu/inkubator/releases/tag/v3.0.2","draft":false}"#;
        assert_eq!(
            parse_release(answer),
            Some(Release {
                version: "3.0.2".into(),
                url: "https://github.com/aloglu/inkubator/releases/tag/v3.0.2".into(),
            })
        );
    }

    #[test]
    fn odd_answers_are_ignored() {
        for answer in [
            &br#"{"message":"Not Found"}"#[..],
            br#"{"tag_name":"nightly","html_url":"https://github.com/aloglu/inkubator/releases/tag/nightly"}"#,
            br#"{"tag_name":"v3.0.2","html_url":"https://example.com/aloglu/inkubator/releases/tag/v3.0.2"}"#,
            br#"{"tag_name":"v3.0.2","html_url":"javascript:alert(1)"}"#,
            b"not json",
        ] {
            assert_eq!(parse_release(answer), None);
        }
    }
}
