# Inkubator

Inkubator is a desktop (Tauri) and self-hosted (Docker) app for cataloging fountain pens, inks and swatches.

**A 3.0 rework is in progress on the `v3-rework` branch.** Before doing anything, read `docs/v3/PLAN.md`: it holds every settled design decision, the data model, the architecture, the phase order, current progress and follow-ups that must not be lost. `docs/v3/prototype.html` is the clickable design reference.

Working rules for the rework:
- 3.0 is a clean break: no backward compatibility with 2.x except the one-time `import-v2`.
- Keep the app lean: one Rust backend (`crates/core` shared by `src-tauri` and the coming `crates/server`), Svelte + Vite frontend, no dead code.
- Never write to the owner's real data folder (`~/.local/share/com.aloglu.inkubator`); test against copies in a scratch folder.
- Update the Progress and Follow-ups sections of `docs/v3/PLAN.md` as work lands.
- Core checks: `cargo test -p inkubator-core`, `cargo clippy -p inkubator-core --all-targets -- -D warnings`, `cargo fmt --check`.
