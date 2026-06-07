# Publication Runbook

Use this from the real GitHub repository, not from the detached migration workspace.

## Before Tagging

1. Confirm the working tree is clean.
2. Run the local preflight from `docs/release-checklist.md`.
3. Review `docs/release-notes-2.0.0.md`.
4. Confirm `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `packaging/arch/PKGBUILD` all carry the intended version.

## Create the Release Tag

Use the `Version Bump and Tag` GitHub Actions workflow.

For the first 2.0 release from the already-prepared 2.0.0 tree, do not run a patch/minor/major bump unless the repository version still needs to change. If the repository is already at `2.0.0`, create and push the tag directly:

```bash
git tag v2.0.0
git push origin v2.0.0
```

If the repository is not yet at `2.0.0`, run:

```bash
npm run sync-version -- 2.0.0
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json packaging/arch/PKGBUILD
git commit -m "chore(release): v2.0.0"
git tag v2.0.0
git push --follow-tags
```

## Watch Workflows

The `v2.0.0` tag should trigger:

- `Build Desktop Artifacts`
- `Build Docker Image`

Both must pass before publishing is considered complete.

## Verify Desktop Release Assets

Expected GitHub Release assets:

- `Inkubator-2.0.0-win-x64.exe`
- `Inkubator-2.0.0-win-arm64.exe`
- `Inkubator-2.0.0-mac-x64.dmg`
- `Inkubator-2.0.0-mac-x64.zip`
- `Inkubator-2.0.0-mac-arm64.dmg`
- `Inkubator-2.0.0-mac-arm64.zip`
- `Inkubator-2.0.0-linux-x64.deb`
- `Inkubator-2.0.0-linux-x64.rpm`

## Verify Docker Publication

Confirm the GitHub Container Registry package has:

- `2.0.0`
- `latest`

Then smoke-test:

```bash
docker pull ghcr.io/aloglu/inkubator:2.0.0
docker run --rm \
  -p 8080:8080 \
  -e INKUBATOR_ADMIN_PASSWORD=test \
  -v "$(mktemp -d):/data" \
  ghcr.io/aloglu/inkubator:2.0.0
```

Verify:

- `http://localhost:8080/` shows the public showcase.
- `http://localhost:8080/admin/` requires login.
- Login works.
- Image upload works.
- Backup export downloads a ZIP.
- Backup import accepts that ZIP.

## Publish Notes

Use `docs/release-notes-2.0.0.md` as the release description, editing any wording that should be more user-facing before publishing.
