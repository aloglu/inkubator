//! Server settings, read from environment variables.

use std::path::PathBuf;

/// Placeholder password from the published examples; never accepted.
const PLACEHOLDER_PASSWORD: &str = "change-this-password";

#[derive(Clone, Debug)]
pub struct Config {
    pub data_dir: PathBuf,
    /// Built web interface. Missing is fine: the API still works.
    pub web_dir: PathBuf,
    pub port: u16,
    pub admin_user: String,
    pub admin_password: String,
    /// No password and no login: only for throwaway local testing.
    pub insecure: bool,
}

impl Config {
    /// Reads `INKUBATOR_DATA_DIR` (default `/data`), `INKUBATOR_WEB_DIR` (default
    /// `/app/web`), `PORT` (default 8080), `INKUBATOR_ADMIN_USER` (default
    /// `admin`), `INKUBATOR_ADMIN_PASSWORD` (required) and
    /// `INKUBATOR_ALLOW_INSECURE=1` (allows starting with no password).
    pub fn from_env() -> Result<Self, String> {
        Self::from_lookup(|key| std::env::var(key).ok())
    }

    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Result<Self, String> {
        let port = match get("PORT").or_else(|| get("INKUBATOR_PORT")) {
            None => 8080,
            Some(raw) => raw
                .trim()
                .parse()
                .map_err(|_| format!("PORT must be a port number, not {raw:?}"))?,
        };
        let admin_password = get("INKUBATOR_ADMIN_PASSWORD").unwrap_or_default();
        let insecure =
            get("INKUBATOR_ALLOW_INSECURE").as_deref() == Some("1") && admin_password.is_empty();
        let normalized = admin_password.trim().to_ascii_lowercase();
        if !insecure && (normalized.is_empty() || normalized == PLACEHOLDER_PASSWORD) {
            return Err(
                "INKUBATOR_ADMIN_PASSWORD is required and must not be the published placeholder. \
                 Set INKUBATOR_ALLOW_INSECURE=1 only for throwaway local testing without a password."
                    .to_string(),
            );
        }
        Ok(Self {
            data_dir: get("INKUBATOR_DATA_DIR")
                .or_else(|| get("DATA_DIR"))
                .unwrap_or_else(|| "/data".into())
                .into(),
            web_dir: get("INKUBATOR_WEB_DIR")
                .unwrap_or_else(|| "/app/web".into())
                .into(),
            port,
            admin_user: get("INKUBATOR_ADMIN_USER")
                .filter(|user| !user.trim().is_empty())
                .unwrap_or_else(|| "admin".into()),
            admin_password,
            insecure,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn config(vars: &[(&str, &str)]) -> Result<Config, String> {
        let map: HashMap<String, String> = vars
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        Config::from_lookup(|key| map.get(key).cloned())
    }

    #[test]
    fn a_real_password_is_required() {
        assert!(config(&[]).is_err());
        assert!(config(&[("INKUBATOR_ADMIN_PASSWORD", "  ")]).is_err());
        assert!(config(&[("INKUBATOR_ADMIN_PASSWORD", "Change-This-Password")]).is_err());
        let ok = config(&[("INKUBATOR_ADMIN_PASSWORD", "s3cret")]).unwrap();
        assert!(!ok.insecure);
        assert_eq!((ok.port, ok.admin_user.as_str()), (8080, "admin"));
    }

    #[test]
    fn insecure_mode_needs_an_explicit_opt_in_and_no_password() {
        assert!(
            config(&[("INKUBATOR_ALLOW_INSECURE", "1")])
                .unwrap()
                .insecure
        );
        let with_password = config(&[
            ("INKUBATOR_ALLOW_INSECURE", "1"),
            ("INKUBATOR_ADMIN_PASSWORD", "s3cret"),
        ])
        .unwrap();
        assert!(!with_password.insecure, "a set password is always enforced");
    }

    #[test]
    fn bad_ports_are_reported() {
        assert!(config(&[("INKUBATOR_ADMIN_PASSWORD", "x"), ("PORT", "eighty")]).is_err());
    }
}
