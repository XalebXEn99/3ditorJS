# Deployment

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

The production build uses the repository base path `/3ditorJS/`.

## Verify the browser build

Run the production build locally before pushing a deployment change:

```bash
npm run build
```

After the workflow completes, open the Pages URL and verify the editor loads.

## Release checklist

- Run `npm run build` locally.
- Push the source change to `main` and confirm the Pages workflow is successful.
- Verify the Pages editor loads and the Download scene export works.

## Prior desktop packaging

An earlier iteration of this project produced Windows/Linux desktop builds via Tauri. That workflow and the `src-tauri` project have been removed from `main`/`dev` and are preserved on the `game-engine-full` branch, since the current scope is browser-only.

- Download the Windows installer and Linux AppImage from the GitHub release or workflow artifacts and smoke-test each platform.