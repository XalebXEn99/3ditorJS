# Deployment and Desktop Releases

## Browser deployment

The browser editor is published with the `Deploy browser editor` workflow in [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml).

1. In GitHub repository settings, open **Pages**.
2. Set **Build and deployment** to **GitHub Actions**.
3. Push a commit to `main`, or run the workflow manually from the Actions tab.

The workflow runs `npm ci`, builds the Vite site, uploads `dist`, and deploys that artifact to Pages. GitHub Pages must not be configured for direct branch deployment: `main` contains source files, while the generated site lives in the workflow artifact.

For this repository the public editor address is:

```text
https://xalebxen99.github.io/3ditorJS/
```

The production build uses the repository base path `/3ditorJS/`. Use relative paths such as `./project-manager.html` and `./menu-editor.html` for editor pages. Root-relative paths such as `/project-manager.html` resolve outside the repository site and fail on Pages.

## Verify the browser build

Run the production build locally before pushing a deployment change:

```bash
npm run build
```

After the workflow completes, open the Pages URL and verify the editor loads. The project manager must be available at:

```text
https://xalebxen99.github.io/3ditorJS/project-manager.html
```

## Desktop releases

The `Build Tauri desktop releases` workflow in [.github/workflows/release-tauri.yml](../.github/workflows/release-tauri.yml) produces desktop packages from the same frontend bundle.

- A tag beginning with `v`, such as `v0.1.2`, starts the release workflow.
- The workflow builds an NSIS installer on `windows-latest`.
- The workflow builds an AppImage on `ubuntu-24.04`.
- Successful packages are uploaded as Actions artifacts and attached to the tagged GitHub release.

Create and publish a release tag after the browser build on `main` is verified:

```bash
git tag -a v0.1.2 -m "3ditorJS v0.1.2"
git push origin v0.1.2
```

For local desktop development, install a Rust toolchain and the platform-specific Tauri prerequisites, then run:

```bash
npm run tauri:dev
npm run tauri:build
```

## Current verification status

The browser deployment workflow has completed successfully on previous commits. At the time of this documentation update, the Pages run triggered by the relative-link correction is still publishing.

The `v0.1.1` Tauri workflow reached the bundle step on both Windows and Ubuntu after Node, Rust, and Linux dependencies installed successfully, but both jobs failed during `npm run tauri:build -- --ci --bundles ...`. No desktop installer or AppImage should be treated as released until a later tagged workflow completes successfully. Inspect the failed job logs in GitHub Actions before changing the workflow again; the jobs are linked from the failed `Build Tauri desktop releases` run.

## Release checklist

- Run `npm run build` locally.
- Push the source change to `main` and confirm the Pages workflow is successful.
- Verify the Pages editor and project-manager routes.
- Create and push a new `v*` tag.
- Confirm both Tauri matrix jobs succeed.
- Download the Windows installer and Linux AppImage from the GitHub release or workflow artifacts and smoke-test each platform.