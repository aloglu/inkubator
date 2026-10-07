//! Where photos live and which paths are acceptable.

/// The folder inside `images/` that holds an item type's photos.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ImageSection {
    Pens,
    Inks,
    Swatches,
}

impl ImageSection {
    pub const ALL: [ImageSection; 3] = [Self::Pens, Self::Inks, Self::Swatches];

    pub fn dir(self) -> &'static str {
        match self {
            Self::Pens => "pens",
            Self::Inks => "inks",
            Self::Swatches => "swatches",
        }
    }
}

/// File types accepted as stored photos.
pub const IMAGE_EXTENSIONS: [&str; 5] = ["jpg", "jpeg", "png", "webp", "avif"];

/// True when `path` is a plain relative path such as `pens/pilot-74.webp`:
/// inside `section`, no `.`/`..` or empty components, no backslashes, query or
/// fragment characters, control characters or surrounding whitespace, and an
/// accepted extension.
pub fn is_managed_image_path(path: &str, section: ImageSection) -> bool {
    if path.is_empty()
        || path.trim() != path
        || path.contains(['\\', '?', '#', ':'])
        || path.chars().any(char::is_control)
    {
        return false;
    }
    let mut components = path.split('/');
    if components.next() != Some(section.dir()) {
        return false;
    }
    let rest: Vec<&str> = components.collect();
    if rest.is_empty() || rest.iter().any(|c| c.is_empty() || *c == "." || *c == "..") {
        return false;
    }
    let file = rest[rest.len() - 1];
    match file.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => {
            IMAGE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str())
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_paths_in_the_right_section() {
        assert!(is_managed_image_path(
            "pens/pilot-74.webp",
            ImageSection::Pens
        ));
        assert!(is_managed_image_path(
            "swatches/2024/a.JPG",
            ImageSection::Swatches
        ));
    }

    #[test]
    fn rejects_unsafe_or_misplaced_paths() {
        for bad in [
            "",
            " pens/a.webp",
            "inks/a.webp",
            "pens/../inks/a.webp",
            "pens//a.webp",
            "/pens/a.webp",
            "pens/a.webp?x",
            "pens\\a.webp",
            "pens/a.gif",
            "pens/.webp",
            "pens",
            "images/pens/a.webp",
            "c:/pens/a.webp",
        ] {
            assert!(!is_managed_image_path(bad, ImageSection::Pens), "{bad:?}");
        }
    }
}
