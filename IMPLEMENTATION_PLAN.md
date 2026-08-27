# IMPLEMENTATION_PLAN.md

# ThreeJS Editor Implementation Plan

**Purpose**  
This document is a complete, phased, step‑by‑step implementation plan you can save as `IMPLEMENTATION_PLAN.md` and hand to GitHub Copilot. It covers the exact systems we agreed on: **scene editor (3D visualizer + code editor + JSON backbone)**, **physics layer (pluggable)**, **trigger manager**, **animations and cutscenes with spline editor**, **menu editor as a dedicated page**, **UI manager**, **scene manager**, **JSON ↔ JS sync**, **inspector/debugger**, **visualizer toggles**, and a progressive **test** project used for acceptance testing. The browser version is the canonical first target; packaging to **Windows .exe** and **Linux .AppImage** happens only after explicit approval.

---

## Project Scope and Constraints

### Platform and Deployment Architecture
- Maintain one repository for the shared editor core, browser build, and Tauri desktop build.
- Keep platform-specific project storage behind a common adapter interface.
- Browser default: IndexedDB-backed projects, with optional File System Access API support where available.
- Desktop target: Tauri with Rust-backed filesystem access, native folder dialogs, recent projects, and file watching.
- GitHub Pages target: deploy the static browser build from a GitHub Actions workflow.
- GitHub Releases target: publish Windows and Linux Tauri artifacts from tagged releases.
- Configure Vite for repository subpaths so GitHub Pages does not depend on the site being hosted at `/`.
- Use relative asset and worker paths so Three.js and Monaco work under the GitHub Pages base path.
- Do not let browser-only or Tauri-only APIs leak into shared scene, physics, animation, trigger, UI, or editor modules.
- Keep Electron packaging on hold unless a specific native requirement makes Tauri unsuitable.

**Recommended shared storage contract**
```js
export class ProjectStorage {
  async listProjects() {}
  async createProject(name, location) {}
  async openProject(location) {}
  async readFile(path) {}
  async saveFile(path, content) {}
  async deleteFile(path) {}
}
```

Implementations should include `IndexedDbProjectStorage`, `FileSystemAccessProjectStorage`, and `TauriProjectStorage`. The editor and `ProjectManager` should depend on this contract rather than directly calling browser or Rust APIs.

### In scope
- Scene editor with live 3D visualizer and code editor.  
- JSON canonical scene format and deterministic JSON → JS generator.  
- Two‑way JSON ↔ JS sync for supported constructs.  
- Centralized, pluggable physics layer (default adapter: Cannon‑es).  
- Trigger manager with trigger zones and actions.  
- AnimationManager and CutsceneManager with spline editor.  
- Menu editor as a separate full‑page mode (HTML/CSS menu design).  
- UIManager to load menu JSON into DOM and wire actions.  
- SceneManager to load/unload scenes and manage global registration.  
- Inspector and visualizer toggles (physics colliders, trigger zones).  
- `test` project used as the progressive acceptance harness.  
- Packaging to Electron `.exe` and `.AppImage` only after browser sign‑off.

### Out of scope (on hold)
- Asset manager, material editor, lighting editor, advanced profiling tools, third‑party integrations beyond the core stack. These are explicitly placed on hold.

### Technology choices (recommended)
- **Bundler**: Vite (fast dev server, ES modules).  
- **Renderer**: Three.js (latest stable).  
- **Physics**: Cannon‑es adapter by default; adapter pattern to swap Rapier later.  
- **Code editor**: Monaco or CodeMirror (Monaco recommended for full JS editing).  
- **Packaging**: Electron + electron‑builder for `.exe` and `.AppImage`.  
- **Language**: Modern ES modules, plain JS for core modules; minimal framework usage to keep Copilot scaffolding simple.

---

## Phased Implementation Roadmap

Each phase lists **goal**, **tasks**, **deliverables**, **acceptance tests**, **estimated time**, and a **user approval gate**. Work sequentially; do not package until Phase 7 sign‑off.

---

### Phase 0 — Foundation Project Setup
**Goal** Create reproducible scaffold and `test` skeleton.

**Tasks**
- Initialize Git repo, `README.md`, license, issue templates.  
- Setup Vite project and `npm` scripts: `dev`, `build`, `start`.  
- Create folder layout and placeholder `test` scene rendering a cube.  
- Add basic CI skeleton (lint + build).  

**Deliverables**
- Repo scaffold with `src/`, `scenes/`, `editor/`, `physics/`, `ui/`, `test/`.  
- Dev server runs and renders placeholder cube.

**Acceptance tests**
- `npm run dev` opens local server and shows cube.

**Estimate** 1–2 days

**User approval gate**
- You run dev server and confirm the cube renders.

---

### Phase 1 — Scene Editor Core
**Goal** Implement scene JSON schema, SceneManager, visualizer, code editor, and two‑way sync.

**Tasks**
- Define canonical JSON schema for scenes, objects, cameras, and metadata.  
- Implement `SceneManager.loadFromJSON(json)` and `SceneManager.exportJSON()`.  
- Integrate code editor pane showing generated `scene.js`.  
- Implement deterministic JSON → JS generator and a conservative JS → JSON parser for supported constructs.  
- Build Visualizer with OrbitControls, grid, and transform gizmos.  
- Implement object inspector and click selection.  
- Save/load scene JSON to local storage / file.

**Deliverables**
- `editor/scene-editor.html` with visualizer + code editor + inspector.  
- `SceneManager` API.

**Acceptance tests**
- Edit JSON and see immediate visualizer update.  
- Move object with gizmo and see JSON update.

**Estimate** 5–8 days

**User approval gate**
- You create and manipulate objects and confirm JSON ↔ visualizer sync.

---

### Phase 2 — Physics Layer
**Goal** Centralized, pluggable physics layer with visual collider overlays.

**Design principles**
- Physics is **pluggable**: default adapter for Cannon‑es; adapter pattern allows swapping Rapier later.  
- Physics bodies are **attached to meshes** and stored in a `Map(mesh -> body)`.  
- Physics runs in the main loop and syncs transforms to meshes.

**API (public)**
```js
initPhysics({ gravity: [0,-9.81,0], engine: 'cannon' });
addRigidBody(mesh, { mass: 1, collider: 'box', size: [1,1,1], velocity: [0,0,0] });
removeRigidBody(mesh);
applyImpulse(mesh, [x,y,z]);
setPhysicsEnabled(mesh, true|false);
stepPhysics(deltaTime);
```

**Tasks**
- Implement `physics/adapter/cannonAdapter.js` with the above API.  
- `physics/index.js` exposes the adapter and manages stepping.  
- **Visualizer overlay**: wireframe helpers for colliders (box, sphere, capsule); toggle `showPhysicsBodies`.  
- `SceneManager` exposes `physics.addRigidBody` convenience wrapper.  
- `scene.js` can declare physics in JSON: `"physics": { "enabled": true, "mass": 1, "collider": "box" }`.  
- Each frame: `physics.stepPhysics(dt)` → copy body transforms to meshes.  
- Edge cases: kinematic bodies, static bodies (mass 0), sleeping bodies.  
- Basic collision callbacks: `onCollision(meshA, meshB, callback)`.

**Deliverables**
- `physics/` module with Cannon adapter.  
- Example scene where a cube falls onto a plane.  
- Visualizer toggle to show colliders.

**Acceptance tests**
- Add a dynamic cube with mass 1 above a static floor; cube falls and rests on floor.  
- Toggle collider overlay visible/invisible.  
- `applyImpulse` moves a body.

**Estimate** 5–7 days

**User approval gate**
- You place a cube above a floor in the editor, enable physics, run, and confirm gravity and collisions behave as expected.

---

### Future Physics Feature — Collision Impact Visualization
**Goal** Make collisions visibly identifiable in the editor when the physics collider view is enabled.

**Behavior**
- On collision, briefly show an impact marker, contact point, or flash on the relevant collider overlay.
- Scale the visual response using collision strength or relative impact velocity where the physics adapter provides it.
- Show contact normals or a short directional indicator when useful for debugging.
- Keep impact visuals hidden when `showPhysicsBodies` is disabled.
- Avoid changing gameplay physics or object appearance in the normal runtime view.

**Tasks**
- Extend collision events with contact point, normal, relative velocity, and impulse data where available.
- Add a short-lived impact effect pool to avoid allocating objects every frame.
- Connect impact effects to the existing collider visibility toggle.
- Add acceptance tests for dynamic/static and dynamic/dynamic collisions.

**User approval gate**
- Enable collider view, run the test scene, and confirm each collision produces a clear, correctly positioned impact visualization.

---

### Phase 3 — Trigger Manager
**Goal** Trigger zones, collision triggers, and modular actions.

**Design**
- Triggers are invisible colliders with metadata and actions.  
- Trigger actions are declarative in JSON and can call named JS functions or built‑in actions.  
- Trigger manager listens to physics collisions (preferred) or does AABB checks if physics is off.

**JSON example**
```json
"triggers": [
  { "id":"t1", "type":"box", "position":[10,0,0], "size":[5,5,5], "action":"playCutscene", "params":{ "clip":"intro" } }
]
```

**API**
```js
TriggerManager.registerTrigger(triggerJSON);
TriggerManager.unregisterTrigger(id);
TriggerManager.on('triggerEnter', (trigger, actor) => {});
```

**Tasks**
- Implement `TriggerManager` that:
  - Creates invisible meshes/colliders in the scene.
  - Registers collision callbacks with physics adapter.
  - Fires actions: `playCutscene`, `loadScene`, `callFunction`.
- Visualizer: show trigger zones as wireframes when `showTriggers` is enabled.  
- Editor UI: create a trigger creation tool (drag box into scene, set action).  
- Support both physics-based triggers and non-physics fallback (distance checks).  
- Provide a small DSL for actions or allow binding to global functions.

**Deliverables**
- `TriggerManager` module.  
- Editor UI to create and edit triggers.  
- Example: entering a trigger plays a cutscene.

**Acceptance tests**
- Player enters trigger zone → cutscene starts.  
- Trigger overlay visible in editor.  
- Trigger can be toggled on/off.

**Estimate** 4–6 days

**User approval gate**
- You place a trigger in the editor, walk the player into it in `test` and confirm the action fires.

### Inspector Alignment and Shader Authoring
**Goal** Bring the editor inspector toward the useful parts of the official Three.js Editor while keeping our code-first workflow and canonical scene bridge.

**Official Three.js Editor concepts to adopt**
- Scene outliner: hierarchical scene graph with selectable scenes, cameras, lights, meshes, geometry, materials, and attached scripts.
- Object properties: name, UUID, position, rotation, scale, visibility, cast shadow, receive shadow, render order, and user data.
- Scene properties: background, environment, fog, and scene-level settings.
- Material properties: material class, color channels, emissive settings, roughness, metalness, opacity, transparency, side, wireframe, depth settings, and texture maps.
- Material slots: support multiple materials on one mesh rather than assuming one material forever.
- Script indicators: show attached scripts in the scene tree while leaving their internal JavaScript authored directly by the user.
- Command history: route editor mutations through undoable commands so every inspector operation behaves consistently.

**Our implementation rule**
- The visual editor and inspector edit the canonical scene state.
- The canonical scene state generates `scene.js` and persistence data.
- User-authored JavaScript remains normal JavaScript and is not flattened into JSON.
- Every editor-managed property must have a clear generated Three.js equivalent or an explicit unsupported-state diagnostic.

**Shader support**
- Add built-in material selection for Three.js material classes, including `MeshBasicMaterial`, `MeshPhongMaterial`, `MeshStandardMaterial`, `MeshPhysicalMaterial`, `ShaderMaterial`, and `RawShaderMaterial` where applicable.
- Add custom vertex and fragment shader editors using Monaco.
- Store shader source, uniforms, defines, and material options in scene data only when the editor owns those values.
- Generate real `THREE.ShaderMaterial` or `THREE.RawShaderMaterial` code in `scene.js`.
- Keep arbitrary shader helper code and game logic in user-authored JavaScript modules.
- Add shader validation, uniform editing, preview error reporting, and safe fallback behavior.

**Suggested inspector order**
1. Object identity and visibility.
2. Transform and gizmo mode.
3. Geometry and material.
4. Physics and colliders.
5. Attached scripts.
6. Animation and cutscene references.
7. User data and advanced properties.

**Acceptance tests**
- Select each supported scene-tree node and edit its supported properties.
- Confirm visual changes, canonical scene state, JSON persistence, and generated `scene.js` agree.
- Switch material classes without losing supported properties.
- Create a built-in shader material and a custom shader material, then preview both and inspect generated code.

---

### Phase 4 — Animations, Cutscenes, and Spline Editor
**Goal** Implement `AnimationManager` (AnimationMixer integration), spline editor (visual drawing of curves in the editor), and cutscene playback with a Play button.

**Design**
- Animations are either imported clips (GLTF) or keyframe tracks created in JS.  
- Cutscenes are timelines that can animate objects, lights, and cameras.  
- Splines are drawn in the visual editor and exported as JSON control points.

**JSON examples**
- **Spline**
  ```json
  { "id":"camPath1", "type":"CatmullRom", "points":[[0,2,5],[5,3,2],[10,2,0]] }
  ```
- **Cutscene**
  ```json
  { "id":"intro", "duration":6, "tracks":[ { "target":"camera", "type":"spline", "path":"camPath1", "start":0, "end":6 } ] }
  ```

**API**
```js
AnimationManager.createClipFromKeyframes(target, keyframes);
CutsceneManager.play(cutsceneId);
SplineEditor.drawSpline(points) // visual tool
```

**Tasks**
- Implement `AnimationManager` using `THREE.AnimationMixer`.  
- Implement `SplineEditor`:
  - Draw control points in the visualizer.
  - Allow dragging points; export JSON.
  - Show spline preview.
- Implement `CutsceneManager`:
  - Play cutscene: disable player controls, animate camera along spline, play object animations, fire timed events.
  - Provide Play/Pause/Stop controls in the editor.
- Editor: show Play button when a cutscene is attached to the scene.  
- Sync cutscene JSON with `scene.js`.

**Deliverables**
- `AnimationManager`, `CutsceneManager`, `SplineEditor`.  
- Example cutscene: camera flythrough along spline + object animation.

**Acceptance tests**
- Draw a spline in the editor, attach it to a cutscene, press Play, and see the camera follow the path.  
- Cutscene disables controls and re-enables after completion.

**Estimate** 6–9 days

**User approval gate**
- You draw a spline, attach it to a cutscene, press Play, and confirm the cinematic plays as expected.

---

### Phase 5 — Menu Editor (Dedicated Page) and UI Manager
**Goal** Implement the menu editor as a **separate page/mode** (3D editor disappears), a JSON format for menus, and `UIManager` that loads menu JSON into HTML/CSS and wires actions to game functions.

**Design**
- Menu editor is a full‑screen page (not a panel) with a flat canvas for layout and CSS styling controls.  
- Menus are saved as JSON and loaded by `UIManager` at runtime.  
- `UIManager` exposes `showMenu(menuId)` / `hideMenu(menuId)` and binds actions to global functions.

**Menu JSON example**
```json
{
  "id":"pause",
  "layout": { "width": 400, "height": 300 },
  "elements":[
    { "type":"button", "id":"resumeBtn", "label":"Resume", "action":"resumeGame", "style":{ "top": "20px" } }
  ]
}
```

**Tasks**
- Build `menu-editor.html` (separate route/mode). Editor UI: drag/drop elements, style panel (CSS properties), action binding dropdown.  
- Implement `UIManager`:
  - `UIManager.load(menuJSON)` → creates DOM elements and attaches actions.
  - `UIManager.show(menuId)` / `UIManager.hide(menuId)`.
- Scene manager integration:
  - When a menu is shown, pause the active scene (stop physics stepping and input).
  - When menu hides, resume scene.
- Export/import menu JSON.  
- Provide a small library of default actions (`resumeGame`, `openSettings`, `exitGame`) and allow custom JS handlers.

**Deliverables**
- `menu-editor/` page.  
- `UIManager` module.  
- Example pause menu that overlays the game scene when ESC is pressed.

**Acceptance tests**
- Switch to menu editor mode; design a menu; save JSON.  
- Load the menu in the running app; press ESC to show the menu; confirm game pauses and resumes.

**Estimate** 5–8 days

**User approval gate**
- You design a menu in the dedicated page, load it in the running app, and confirm it overlays and pauses the scene.

---

### Phase 6 — Scene Manager, Inspector, and Editor Polish
**Goal** Finalize scene switching, global managers, inspector/debugger, and polish the editor UX.

**Tasks**
- **SceneManager**:
  - Load/unload scenes, register/unregister physics bodies and triggers.
  - Provide `SceneManager.switchTo(sceneId)` with graceful teardown.
- **Inspector**:
  - Click object → show full properties (physics, triggers, animations).
  - Allow editing properties and saving to JSON.
- **Editor UX**:
  - Add toggles: `showPhysicsBodies`, `showTriggers`, `showGrid`.
  - Add undo/redo stack for scene edits.
- **Project Manager and storage**:
  - Add a Godot-style project manager screen for recent, open, create, and import project flows.
  - Keep project files behind the shared `ProjectStorage` contract.
  - Implement IndexedDB storage for browser-managed projects.
  - Add optional File System Access API storage for user-selected browser folders.
  - Reserve a Tauri/Rust storage adapter for the desktop build.
  - Keep project explorer, scene documents, and file templates independent from platform APIs.
- **Test project**:
  - Expand `test` project into a small playable level that uses physics, triggers, a cutscene, and a pause menu.
  - Use `test` as the acceptance harness for each feature.
- **Documentation**:
  - Document APIs (`SceneManager`, `Physics`, `TriggerManager`, `CutsceneManager`, `UIManager`) in `docs/`.
  - Document browser storage, local-folder permissions, GitHub Pages deployment, and Tauri project storage.

**Deliverables**
- Polished editor with inspector and undo/redo.  
- `test` playable level that exercises all systems.

**Acceptance tests**
- Switch scenes and confirm physics and triggers unregister/register correctly.  
- Inspector edits persist to JSON and reflect in the visualizer.  
- `test` level demonstrates all features end‑to‑end.

**Estimate** 6–10 days

**User approval gate**
- You play the `test` level and confirm all systems behave as expected and that the editor UX is acceptable.

---

### Phase 7 — QA, Performance Tuning, and Browser Release
**Goal** Stabilize the browser app, run QA, fix bugs, and prepare a production browser build.

**Tasks**
- Manual QA checklist and bug fixes.  
- Add automated tests where feasible (unit tests for JSON parsers, integration tests for SceneManager).  
- Performance profiling: reduce draw calls, optimize physics stepping, cull unused objects.  
- Finalize build scripts: `npm run build` produces a static site.  
- Create a release candidate and a changelog.
- Add GitHub Actions deployment for the browser build to GitHub Pages.
- Verify Vite base-path, relative assets, and Monaco worker loading under a repository subpath.
- Keep native Tauri APIs out of the GitHub Pages build.

**Deliverables**
- Production build (static) that runs in modern browsers.  
- QA report and bug list resolved.

**Acceptance tests**
- All acceptance tests from prior phases pass.  
- `test` level runs at target framerate (e.g., 60fps on dev machine).  
- No critical bugs remain.

**Estimate** 4–7 days

**User approval gate**
- You run the production build in the browser and sign off on functionality and performance.

---

### Phase 8 — Desktop Packaging (.exe and .AppImage)
**Goal** Package the browser app into a Windows `.exe` and Linux `.AppImage` using Electron + `electron-builder`. Only proceed after your explicit approval.

**High‑level approach**
- Wrap the built static site in an Electron shell.  
- Use `electron-builder` to produce installers and AppImage.  
- Provide an alternative Tauri path if you want smaller binaries later.

**Tasks**
- Add `electron/` wrapper:
  - `main.js` loads `index.html` from the built site.
  - Expose native APIs if needed (file dialogs, filesystem).
- Configure `electron-builder`:
  - Windows target: `nsis` or `portable` to produce `.exe`.
  - Linux target: `AppImage`.
- Build steps:
  - `npm run build` (frontend) → `electron-builder --win --linux`.
- Test packaged apps on target OSes (VMs or real machines).
- Sign binaries if required (optional).

**Deliverables**
- `dist/win/MyEditor-Setup.exe`  
- `dist/linux/MyEditor-x.y.z.AppImage`  
- Packaging docs and run instructions.

**Acceptance tests**
- Installer runs on Windows and launches the app.  
- AppImage runs on a Linux test machine and launches the app.  
- All editor features work in packaged app as in browser.

**Estimate** 3–6 days (packaging + testing on both OSes)

**User approval gate**
- You run the `.exe` and `.AppImage` and confirm parity with the browser version.

---

### Future Phase 9 — Full JavaScript and Three.js Code Compatibility
**Goal** Expand the conservative generated-code parser into a broader JavaScript/Three.js authoring system.

**Important scope note**
- This is substantially more difficult than the current supported-construct parser. “All Three.js code” also includes the full JavaScript language, imported modules, asynchronous code, callbacks, custom classes, external assets, shaders, browser APIs, and runtime state that cannot always be represented as static scene JSON.
- The canonical scene JSON format should remain the portable, deterministic representation. Arbitrary JavaScript should not be executed directly in the editor without explicit sandboxing and permission controls.

**Possible approach**
- Parse JavaScript with a standards-compliant AST parser rather than regular expressions.
- Define a documented compatibility profile for Three.js scene construction and supported JavaScript expressions.
- Convert recognized AST nodes into scene JSON where a lossless conversion is possible.
- Preserve unsupported code as a script/module attachment instead of silently discarding it.
- Run preview scripts in an isolated worker or sandbox with an explicit API boundary.
- Add diagnostics that identify unsupported constructs, source locations, side effects, and non-serializable runtime values.

**Tasks**
- Evaluate AST tooling and sandbox architecture.
- Define JavaScript-to-scene-JSON conversion rules and round-trip guarantees.
- Support broader Three.js objects, loaders, lights, cameras, materials, animation tracks, and user scripts incrementally.
- Add import resolution and asset dependency tracking.
- Add compatibility fixtures covering real-world Three.js examples.
- Add security, performance, and regression testing before enabling unrestricted script preview.

**Deliverables**
- AST-based JavaScript analysis and conversion pipeline.
- Documented supported JavaScript/Three.js compatibility profile.
- Safe preview runtime for approved scripts.
- Clear diagnostics and fallback handling for code that cannot be represented in scene JSON.

**Estimated difficulty** Very high; likely several weeks to multiple months depending on the desired compatibility level. Full arbitrary-code round trips are not guaranteed to be possible because runtime behavior is often more expressive than static JSON.

**User approval gate**
- Approve the compatibility profile and sandbox design before implementation. Expand support incrementally using real Three.js examples rather than promising unrestricted conversion from the outset.

---

## Testing Plan and Acceptance Criteria

### Testing types
- Unit tests for JSON parser/generator and utilities.  
- Integration tests for SceneManager and Physics adapter.  
- Manual playtests using `test` project as canonical harness.  
- User Acceptance Tests (UAT) performed by you at each phase gate.

### Progressive `test` milestones
- **v0** Render cube and camera.  
- **v1** Physics: falling cube onto floor.  
- **v2** Trigger: entering zone plays animation.  
- **v3** Cutscene: spline camera flythrough.  
- **v4** Pause menu: menu editor → pause/resume.

### UAT checklist for each phase
- JSON ↔ visualizer sync works.  
- Physics behaves as expected.  
- Triggers fire actions reliably.  
- Cutscenes play and disable input.  
- Menus pause and resume scenes.  
- Scene switching cleans up registrations.

---

## Developer APIs and Example Snippets

### SceneManager
```js
// src/scene/SceneManager.js
export class SceneManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.scenes = new Map();
    this.active = null;
  }
  async loadFromJSON(json) { /* create THREE.Scene, meshes, cameras, register physics/triggers */ }
  switchTo(sceneId) { /* teardown active, init new scene */ }
  exportJSON(sceneId) { /* serialize scene */ }
}
```

### Physics API
```js
// src/physics/index.js
export function initPhysics(opts) { /* choose adapter, init world */ }
export function addRigidBody(mesh, opts) { /* adapter.createBody */ }
export function stepPhysics(dt) { /* adapter.step(dt) */ }
export function onCollision(cb) { /* adapter collision hook */ }
```

### TriggerManager
```js
// src/triggers/TriggerManager.js
export class TriggerManager {
  registerTrigger(scene, triggerJSON) { /* create invisible collider, bind action */ }
  unregisterTrigger(id) { /* remove trigger */ }
  on(event, cb) { /* event emitter for triggerEnter/Exit */ }
}
```

### UIManager
```js
// src/ui/UIManager.js
export function loadMenu(menuJSON) {
  const container = document.createElement('div');
  menuJSON.elements.forEach(e => {
    if (e.type === 'button') {
      const b = document.createElement('button');
      b.innerText = e.label;
      b.onclick = window[e.action];
      container.appendChild(b);
    }
  });
  document.body.appendChild(container);
}
export function showMenu(id) { /* show menu and pause scene */ }
export function hideMenu(id) { /* hide menu and resume scene */ }
```

### Cutscene JSON examples
```json
{
  "splines": [
    { "id":"camPath1", "type":"CatmullRom", "points":[[0,2,5],[5,3,2],[10,2,0]] }
  ],
  "cutscenes": [
    { "id":"intro", "duration":6, "tracks":[ { "target":"camera", "type":"spline", "path":"camPath1", "start":0, "end":6 } ] }
  ]
}
```

---

## Folder Tree (Recommended)
```
/project-root
  /src
    /editor
      scene-editor.html
      menu-editor.html
      /components
    /scene
      SceneManager.js
      scene-loader.js
    /physics
      index.js
      adapters/
        cannonAdapter.js
    /triggers
      TriggerManager.js
    /animation
      AnimationManager.js
      CutsceneManager.js
    /ui
      UIManager.js
    /test
      scenes/
      assets/
  /scenes
    level1.json
  /menus
    pause.json
  /build
  package.json
  vite.config.js
  electron/
    main.js
    package.json
  README.md
```

---

## Build Packaging Notes

### Browser build
- `npm run build` produces static site for Electron wrapper and for hosting.

### Electron packaging
- Use `electron-builder` config in `package.json`.  
- Windows target: `nsis` or `portable`.  
- Linux target: `AppImage`.  
- Test on VMs or real machines before release.

### Alternative packaging
- Consider Tauri later for smaller binaries and Rust security benefits.

---

## Timeline Summary (rough)
- Phase 0: 1–2 days  
- Phase 1: 5–8 days  
- Phase 2: 5–7 days  
- Phase 3: 4–6 days  
- Phase 4: 6–9 days  
- Phase 5: 5–8 days  
- Phase 6: 6–10 days  
- Phase 7: 4–7 days  
- Phase 8: 3–6 days  
**Total estimate**: ~39–63 days of focused development (single developer). Adjust for parallel work, reviews, and bug fixes.

---

## Final Notes and Handover Instructions

### How to use this file with GitHub Copilot
- Save this document as `IMPLEMENTATION_PLAN.md` in the repo root.  
- Create issues for each phase and break tasks into small PR‑sized issues.  
- Use the `test` project as the canonical acceptance harness; require sign‑off on each phase before merging the next.

### User involvement
- You will run the dev server and validate each phase using the acceptance gates described. Do not proceed to packaging until you explicitly approve Phase 7.

### Backups and versioning
- Keep scene and menu JSON files in `scenes/` and `menus/` and commit them to Git. Use Git LFS for large assets.

---

If you want, I can now convert the first two phases into GitHub issue templates with titles, descriptions, and checklists ready to paste into your repository. Which would you like next: generate issue templates for Phase 0 and Phase 1, or produce the full set of issues for all phases ready to import into your issue tracker.