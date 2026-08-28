# 3ditor JS

A browser-based Three.js scene and cutscene creator. Build a single scene visually, then download it as a `scene.js` module (plus every helper file it depends on) ready to drop into a regular Three.js project.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The editor starts with an empty Main Scene, neutral lighting, an editor camera, and a grid.

The editor supports scene JSON, generated Three.js scene code, Cannon-es physics with an editable/compound collider system, trigger zones, spline cutscenes, audio (BGM and SFX), Monaco JavaScript/GLSL editors, material and shader authoring, scene cameras, script attachments, and scene-tree editing.

## Exporting a scene

Press **Download scene** in the top bar to generate a zip containing `scene.js`, the helper modules it imports (triggers, cutscenes, audio), any scripts/shaders you authored, and any audio you uploaded. Unzip it into an existing Three.js project and import `scene.js` as a regular ES module.

## Documentation

Start with [docs/HOW_TO_USE.md](docs/HOW_TO_USE.md) for editor workflows and [docs/CONTROLS.md](docs/CONTROLS.md) for a complete list of every feature and control. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system reference and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for GitHub Pages deployment.

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

Three.js remains the rendering and scene foundation. Physics, triggers, cutscenes, scripts, and audio are editor conveniences built around it, all of which are bundled into the exported scene.

## Deployment

The app is a static browser build deployed through GitHub Actions to GitHub Pages. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for setup and troubleshooting.

## Scene authoring contract

`scene.js` is the primary authoring document. The visual editor and inspector are convenience tools for editor-managed scene constructs, while Scene JSON is the structured persistence and inspection projection.

`scene.js`, the visual editor, and the inspector are synchronized authoring paths. Press `Apply scene.js` to commit code edits into the active scene; inspector and transform-gizmo edits update the canonical scene and regenerate the supported scene code. The reverse parser currently guarantees round trips for the generated supported constructs: cameras, lights, meshes, materials, transforms, physics bodies, triggers, splines, and cutscenes. Custom runtime JavaScript remains authored code and should be kept in the scene module or separate script modules rather than being converted into static scene JSON.

## Verify a production build

```bash
npm run build
npm run start
```

## Prior full game-engine vision

An earlier iteration of this project aimed to be a full in-browser game engine with a multi-scene project browser and a Tauri desktop shell. That work is preserved on the `game-engine-full` branch. `main` and `dev` now track the scene/cutscene creator vision described above.
