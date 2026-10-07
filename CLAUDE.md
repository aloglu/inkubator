# Inkubator

Inkubator is a self-hosted app (Docker, or a plain server program) for cataloging fountain pens, inks and swatches, used in a browser. From 3.0 there is no desktop app.

**A 3.0 rework is in progress on the `v3-rework` branch.** Before doing anything, read `docs/v3/PLAN.md`: it holds every settled design decision, the data model, the architecture, the phase order, current progress and follow-ups that must not be lost. `docs/v3/prototype.html` is the clickable design reference.

Working rules for the rework:
- 3.0 is a clean break: no backward compatibility with 2.x except the one-time `import-v2`.
- Keep the app lean: one Rust backend (`crates/core`, served by `crates/server`), Svelte + Vite frontend in `web/`, no dead code.
- Never write to the owner's real data folder (`~/.local/share/com.aloglu.inkubator`); test against copies in a scratch folder.
- Update the Progress and Follow-ups sections of `docs/v3/PLAN.md` as work lands.
- Rust checks: `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`.
- Web checks (in `web/`): `npm test`, `npm run check`, `npm run build`. After changing types in core, run `npm run types` and commit the regenerated `web/src/lib/types`.
- Local dev: run the server on port 18080 against a scratch data folder (`INKUBATOR_DATA_DIR=<scratch> INKUBATOR_ADMIN_PASSWORD=<any> PORT=18080 cargo run -p inkubator-server`) and `npm run dev` in `web/`. The component gallery is at `/_components` in dev only.
