//! The owner's password when it is not given by environment variable: stored
//! as an argon2 hash in `password.json` in the data folder, set with
//! `inkubator set-password`.

use std::fs;
use std::io::Write;
use std::path::Path;

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use serde::{Deserialize, Serialize};

pub const FILE: &str = "password.json";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Stored {
    pub user: String,
    /// An argon2id hash in PHC format.
    pub hash: String,
}

impl Stored {
    pub fn new(user: &str, password: &str) -> Result<Self, String> {
        let mut bytes = [0u8; 16];
        getrandom::fill(&mut bytes).map_err(|e| format!("Could not make a salt: {e}"))?;
        let salt =
            SaltString::encode_b64(&bytes).map_err(|e| format!("Could not make a salt: {e}"))?;
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| format!("Could not hash the password: {e}"))?
            .to_string();
        Ok(Self {
            user: user.to_string(),
            hash,
        })
    }

    /// Checks a sign-in. The hash is always checked, so a wrong user name takes
    /// as long as a wrong password.
    pub fn verify(&self, user: &str, password: &str) -> bool {
        let password_ok = PasswordHash::new(&self.hash).is_ok_and(|hash| {
            Argon2::default()
                .verify_password(password.as_bytes(), &hash)
                .is_ok()
        });
        password_ok & (user == self.user)
    }
}

/// The stored password, if one was set. A damaged file is an error, not "none".
pub fn load(data_dir: &Path) -> Result<Option<Stored>, String> {
    let path = data_dir.join(FILE);
    match fs::read(&path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(|e| {
            format!(
                "{} is damaged ({e}). Run `inkubator set-password` again.",
                path.display()
            )
        }),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Could not read {}: {e}", path.display())),
    }
}

/// Writes the password file, readable only by its owner where the system allows.
pub fn save(data_dir: &Path, stored: &Stored) -> Result<(), String> {
    fs::create_dir_all(data_dir)
        .map_err(|e| format!("Could not create {}: {e}", data_dir.display()))?;
    let path = data_dir.join(FILE);
    let temporary = data_dir.join(format!("{FILE}.tmp"));
    let bytes = serde_json::to_vec_pretty(stored).expect("password file serializes");
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&temporary)
        .map_err(|e| format!("Could not write {}: {e}", temporary.display()))?;
    file.write_all(&bytes)
        .and_then(|()| file.sync_all())
        .map_err(|e| format!("Could not write {}: {e}", temporary.display()))?;
    fs::rename(&temporary, &path).map_err(|e| format!("Could not save {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_stored_password_checks_both_user_and_password() {
        let stored = Stored::new("admin", "correct horse").unwrap();
        assert!(stored.hash.starts_with("$argon2id$"));
        assert!(stored.verify("admin", "correct horse"));
        assert!(!stored.verify("admin", "wrong"));
        assert!(!stored.verify("someone", "correct horse"));
    }

    #[test]
    fn saving_and_loading_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(load(dir.path()).unwrap(), None);
        let stored = Stored::new("admin", "pw").unwrap();
        save(dir.path(), &stored).unwrap();
        assert_eq!(load(dir.path()).unwrap(), Some(stored));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(dir.path().join(FILE))
                .unwrap()
                .permissions()
                .mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        fs::write(dir.path().join(FILE), b"not json").unwrap();
        assert!(load(dir.path()).is_err());
    }
}
