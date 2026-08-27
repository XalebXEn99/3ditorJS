# 3ditor JS

A browser-first Three.js editor and project maker. The shared editor core targets the browser first and is also prepared for a Tauri desktop shell.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The foundation scene should display a lit, orbitable cube on a grid.

The editor currently supports scene JSON, generated Three.js scene code, Cannon-es physics, trigger zones, spline cutscenes, Monaco JavaScript/GLSL editors, material and shader authoring, scene cameras, script attachments, scene-tree editing, and browser project persistence.

Menus are optional game UI overlays. Register a menu with `UIManager` only when a game needs one; scenes without a registered menu are unaffected.

## Documentation

The complete workflow is in [docs/HOW_TO_USE.md](docs/HOW_TO_USE.md).

## Architecture

```text
Visual editor / inspector / gizmos
		  |
		  v
	 Canonical scene state
	    /          \
	   v            v
   Scene JSON      scene.js
			     |
			     v
		     Three.js runtime
```

Three.js remains the rendering and scene foundation. Physics, triggers, cutscenes, UI, scripts, and project management are editor/runtime conveniences built around it.

## Deployment

The browser build is static and deploys through GitHub Actions. Tauri uses the same `dist` output for native desktop packaging and will eventually provide the native filesystem adapter. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Pages setup, the desktop release workflow, and troubleshooting.

```bash
npm run build
npm run tauri:dev
npm run tauri:build
```

The Tauri commands require the Rust toolchain and platform build prerequisites. Windows artifacts can be built on Windows; Linux AppImage artifacts should be built on Linux or in a Linux GitHub Actions runner.

## Scene authoring contract

`scene.js` is the primary authoring document. The visual editor and inspector are convenience tools for editor-managed scene constructs, while Scene JSON is the structured persistence and inspection projection.

`scene.js`, the visual editor, and the inspector are synchronized authoring paths. Press `Apply scene.js` to commit code edits into the active scene; inspector and transform-gizmo edits update the canonical scene and regenerate the supported scene code. The reverse parser currently guarantees round trips for the generated supported constructs: cameras, lights, meshes, materials, transforms, physics bodies, triggers, splines, and cutscenes. Custom runtime JavaScript remains authored code and should be kept in the scene module or separate script modules rather than being converted into static scene JSON.

## Verify a production build

```bash
npm run build
npm run start
```
