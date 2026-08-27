# 3ditor JS

A browser-first Three.js editor foundation. The browser build is the canonical target before desktop packaging.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The foundation scene should display a lit, orbitable cube on a grid.

The editor currently supports scene JSON, generated Three.js scene code, Cannon-es physics, trigger zones, and the initial animation manager API.

Menus are optional game UI overlays. Register a menu with `UIManager` only when a game needs one; scenes without a registered menu are unaffected.

## Scene authoring contract

`scene.js` is the primary authoring document. The visual editor and inspector are convenience tools for editor-managed scene constructs, while Scene JSON is the structured persistence and inspection projection.

`scene.js`, the visual editor, and the inspector are synchronized authoring paths. Press `Apply scene.js` to commit code edits into the active scene; inspector and transform-gizmo edits update the canonical scene and regenerate the supported scene code. The reverse parser currently guarantees round trips for the generated supported constructs: cameras, lights, meshes, materials, transforms, physics bodies, triggers, splines, and cutscenes. Custom runtime JavaScript remains authored code and should be kept in the scene module or separate script modules rather than being converted into static scene JSON.

## Verify a production build

```bash
npm run build
npm run start
```
