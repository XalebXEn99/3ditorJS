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

## Features

- **Scene Tree**: add boxes, spheres, cylinders, cones, toruses, lights, cameras, cutscene/spline pairs, box/sphere trigger areas, audio emitters, or upload a GLTF/GLB model; duplicate, delete, and select any of them.
- **Transform gizmo**: translate/rotate/scale any selected item, synced live with Scene JSON and generated `scene.js`.
- **Materials and shaders**: every built-in Three.js material, plus a Monaco GLSL editor for `ShaderMaterial`/`RawShaderMaterial`.
- **Physics**: Cannon-es bodies with an `auto` collider mode that matches the real mesh geometry and rescales with the object automatically, or manual box/sphere/cylinder/capsule shapes. With "Physics colliders" display on, colliders are directly selectable and gizmo-editable (independent translate/resize), and right-click lets you add or remove extra colliders to build compound shapes.
- **Triggers**: box/sphere trigger volumes that fire "Play cutscene" or "Play sound effect" actions.
- **Cutscenes and splines**: Catmull-Rom camera paths with play/pause/stop controls.
- **Scripts**: create/edit JavaScript classes in-browser and attach them to any object; they're emitted as real imports/instances in `scene.js`.
- **Audio**: upload BGM/SFX, configure background music, and preview playback.
- **Code/JSON sync**: `scene.js` and Scene JSON tabs stay in sync with the visual editor; edit either and apply it back.
- **Undo/redo** and a resizable/collapsible inspector panel.

See [docs/CONTROLS.md](docs/CONTROLS.md) for the complete control-by-control reference.

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

`scene.js`, the visual editor, and the inspector are synchronized authoring paths. Press `Apply scene.js` to commit code edits into the active scene; inspector and transform-gizmo edits update the canonical scene and regenerate the supported scene code. The reverse parser guarantees round trips for the generated supported constructs: cameras, lights, meshes, materials, transforms, a primary physics body per object, triggers, splines, and cutscenes. Compound "extra" colliders currently round-trip only through the Scene JSON tab, not the `scene.js` code parser. Custom runtime JavaScript remains authored code and should be kept in the scene module or separate script modules rather than being converted into static scene JSON.

## Verify a production build

```bash
npm run build
npm run start
```

## Prior full game-engine vision

An earlier iteration of this project aimed to be a full in-browser game engine with a multi-scene project browser and a Tauri desktop shell. That work is preserved on the `game-engine-full` branch. `main` and `dev` now track the scene/cutscene creator vision described above.
