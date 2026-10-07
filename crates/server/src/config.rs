//! Server settings. Each comes from a command-line option, else an environment
//! variable (the Docker way), else a default. The password comes from
//! `INKUBATOR_ADMIN_PASSWORD`, else from the one stored with
//! `inkubator set-password`.

use std::net::IpAddr;
use std::path::{Path, PathBuf};

use crate::password::{self, Stored};

/// Placeholder password from the published examples; never accepted.
const PLACEHOLDER_PASSWORD: &str = "change-this-password";

#[derive(Clone, Debug)]
pub enum Credentials {
    /// From `INKUBATOR_ADMIN_USER` / `INKUBATOR_ADMIN_PASSWORD`.
    Given { user: String, password: String },
    /// Set with `inkubator set-password`.
    Stored(Stored),
    /// No password and no sign-in: only for throwaway local testing.
    Insecure,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub data_dir: PathBuf,
    /// A folder to serve the web interface from instead of the copy built into
    /// the program (for development).
    pub web_dir: Option<PathBuf>,
    pub host: IpAddr,
    pub port: u16,
    pub credentials: Credentials,
}

impl Config {
    pub fn insecure(&self) -> bool {
        matches!(self.credentials, Credentials::Insecure)
    }

    /// Reads settings through `get`, which answers for environment variable
    /// names (command-line options are passed in under the same names).
    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Result<Self, String> {
        let get = |key: &str| get(key).filter(|value| !value.trim().is_empty());
        let port = match get("PORT").or_else(|| get("INKUBATOR_PORT")) {
            None => 8080,
            Some(raw) => raw
                .trim()
                .parse()
                .map_err(|_| format!("The port must be a number such as 8080, not {raw:?}."))?,
        };
        let host = match get("INKUBATOR_HOST") {
            None => IpAddr::from([0, 0, 0, 0]),
            Some(raw) => raw.trim().parse().map_err(|_| {
                format!("The host must be an IP address such as 127.0.0.1, not {raw:?}.")
            })?,
        };
        let data_dir = get("INKUBATOR_DATA_DIR")
            .or_else(|| get("DATA_DIR"))
            .map(PathBuf::from)
            .unwrap_or_else(default_data_dir);

        let password = get("INKUBATOR_ADMIN_PASSWORD");
        let credentials = if let Some(password) = password {
            if password.trim().eq_ignore_ascii_case(PLACEHOLDER_PASSWORD) {
                return Err(
                    "INKUBATOR_ADMIN_PASSWORD is still the placeholder from the example. Choose your own password."
                        .to_string(),
                );
            }
            Credentials::Given {
                user: get("INKUBATOR_ADMIN_USER").unwrap_or_else(|| "admin".into()),
                password,
            }
        } else if let Some(stored) = password::load(&data_dir)? {
            Credentials::Stored(stored)
        } else if get("INKUBATOR_ALLOW_INSECURE").as_deref() == Some("1") {
            Credentials::Insecure
        } else {
            return Err(no_password_message(&data_dir));
        };

        Ok(Self {
            data_dir,
            web_dir: get("INKUBATOR_WEB_DIR").map(PathBuf::from),
            host,
            port,
            credentials,
        })
    }
}

/// Where the plain program keeps its data unless told otherwise:
/// `~/.local/share/Inkubator`, `~/Library/Application Support/Inkubator` or
/// `%APPDATA%\Inkubator`.
pub fn default_data_dir() -> PathBuf {
    dirs::data_dir()
        .map(|dir| dir.join("Inkubator"))
        .unwrap_or_else(|| PathBuf::from("inkubator-data"))
}

fn no_password_message(data_dir: &Path) -> String {
    format!(
        "No password is set, so Inkubator will not start.\n\
         - Running the program yourself: run `inkubator set-password` once, then start it again.\n\
         - In Docker: set INKUBATOR_ADMIN_PASSWORD in your compose file or `docker run -e ...`.\n\
         (Data folder: {})",
        data_dir.display()
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn config(dir: &Path, vars: &[(&str, &str)]) -> Result<Config, String> {
        let mut map: HashMap<String, String> = vars
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        map.insert("INKUBATOR_DATA_DIR".into(), dir.display().to_string());
        Config::from_lookup(|key| map.get(key).cloned())
    }

    #[test]
    fn a_password_is_required() {
        let dir = tempfile::tempdir().unwrap();
        let error = config(dir.path(), &[]).unwrap_err();
        assert!(error.contains("inkubator set-password"), "{error}");
        assert!(config(dir.path(), &[("INKUBATOR_ADMIN_PASSWORD", "  ")]).is_err());
        assert!(config(
            dir.path(),
            &[("INKUBATOR_ADMIN_PASSWORD", "Change-This-Password")]
        )
        .is_err());
        let ok = config(dir.path(), &[("INKUBATOR_ADMIN_PASSWORD", "s3cret")]).unwrap();
        assert!(matches!(ok.credentials, Credentials::Given { ref user, .. } if user == "admin"));
        assert_eq!(ok.port, 8080);
        assert_eq!(ok.host, IpAddr::from([0, 0, 0, 0]));
    }

    #[test]
    fn a_stored_password_is_used_when_none_is_given() {
        let dir = tempfile::tempdir().unwrap();
        password::save(dir.path(), &Stored::new("owner", "pw").unwrap()).unwrap();
        let stored = config(dir.path(), &[]).unwrap();
        assert!(matches!(stored.credentials, Credentials::Stored(ref s) if s.user == "owner"));
        let given = config(dir.path(), &[("INKUBATOR_ADMIN_PASSWORD", "env")]).unwrap();
        assert!(
            matches!(given.credentials, Credentials::Given { .. }),
            "the environment wins"
        );
    }

    #[test]
    fn insecure_mode_needs_an_explicit_opt_in_and_no_password() {
        let dir = tempfile::tempdir().unwrap();
        assert!(config(dir.path(), &[("INKUBATOR_ALLOW_INSECURE", "1")])
            .unwrap()
            .insecure());
        let with_password = config(
            dir.path(),
            &[
                ("INKUBATOR_ALLOW_INSECURE", "1"),
                ("INKUBATOR_ADMIN_PASSWORD", "s3cret"),
            ],
        )
        .unwrap();
        assert!(
            !with_password.insecure(),
            "a set password is always enforced"
        );
    }

    #[test]
    fn bad_ports_and_hosts_are_reported() {
        let dir = tempfile::tempdir().unwrap();
        let password = ("INKUBATOR_ADMIN_PASSWORD", "x");
        assert!(config(dir.path(), &[password, ("PORT", "eighty")]).is_err());
        assert!(config(dir.path(), &[password, ("INKUBATOR_HOST", "home")]).is_err());
        let local = config(
            dir.path(),
            &[password, ("INKUBATOR_HOST", "127.0.0.1"), ("PORT", "9000")],
        )
        .unwrap();
        assert_eq!(
            (local.host, local.port),
            (IpAddr::from([127, 0, 0, 1]), 9000)
        );
    }
}
