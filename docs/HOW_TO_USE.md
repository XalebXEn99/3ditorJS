# 3ditorJS How To Use

For a complete list of every feature and control, see [CONTROLS.md](CONTROLS.md).

## Run the browser editor

```bash
npm install
npm run dev
```

Open the Vite URL. The editor uses Three.js for the viewport, Monaco for code, and Cannon-es for physics. Everything you build lives in one in-memory scene for the current browser session; use **Download scene** to save your work as a zip.

## Scene authoring

The Scene Tree is the main object workflow. Use `+` to add boxes, spheres, cylinders, cones, toruses, lights, cameras, cutscene/spline pairs, or import a GLB model. Select an item to inspect it. Rename an editable item by editing the title under Inspector. Use the duplicate and delete controls beside Scene Tree.

The position, rotation, and scale labels are gizmo mode buttons. The active mode is bold/highlighted. Object, camera, directional-light, and spline-point movement updates the editor state, Scene JSON, and generated `scene.js`.

## Physics

Enable physics on an object and choose `auto` (default, derived from the mesh's real geometry) or a specific box, sphere, cylinder, or capsule-style collider. Radius, height, velocity, and damping are available for physics bodies. Enabling physics defaults mass to `1`.

Enable `Physics colliders` in Display to inspect and directly edit the actual collider shapes: with the toggle on, clicking a collider in the viewport selects it (instead of the mesh) and attaches the gizmo to it, letting you translate its position and scale its size/radius/height independently of the mesh. Right-click a physics-enabled object (or one of its colliders) for an "Add collider" option to build a compound shape out of multiple independent colliders, each separately selectable and gizmo-editable from the "Colliders on this object" list; a "Remove this collider" option deletes extra colliders. Click "Select mesh instead" to return to the regular object inspector. Dynamic bodies can be grabbed with the gizmo and dropped again.

## Trigger areas

Use the Scene Tree `+` object adder to add a Box trigger area or Sphere trigger area. Triggers appear as selectable Scene Tree items and can be deleted with the regular scene delete control. Select a trigger to configure its position, size, and enter action. Move its visible area with the standard transform gizmo. Current built-in actions are Play cutscene and Play sound effect; each reveals the required target ID field. Adding a trigger enables the Trigger zones display overlay automatically.

## Animation and cutscenes

Use `+` and choose `Cutscene + spline` to create a linked pair. Select the cutscene in the Scene Tree to edit duration and control points in one inspector section. The Cutscene dropdown chooses which registered cutscene Play, Pause, and Stop control. Enable `Spline editor` to show the curve and its point gizmo.

## Shaders

Choose a built-in material such as `MeshToonMaterial`, `MeshStandardMaterial`, or `MeshPhysicalMaterial`. For custom GLSL, choose `ShaderMaterial` or `RawShaderMaterial`, then use `Open shader editor`. Vertex and fragment source is created under `shaders/` and generated code imports it with Vite's `?raw` convention.

## Scripts and play mode

The Scripts section can create, edit, and save JavaScript files. Select an object, choose a script, and attach it. The relationship is stored with the object and emitted as an import and instance in `scene.js`. Select the player object and press the Scene Tree Play button to enter the current basic WASD/arrow playtest. Space is the jump input when the attached physics API is available.

## Source of truth

Scene JSON is the structured bridge used by the visual editor and export. `scene.js` is the primary Three.js authoring surface. `Apply scene.js` parses supported editor constructs into scene state; visual editor and inspector changes regenerate supported `scene.js` output. Custom runtime JavaScript remains normal JavaScript and is not flattened into JSON.

## Uploading audio

Use **Upload BGM / SFX** in the Scene audio panel to bring local audio files into the current session. Choose Cancel in the prompt to upload sound effects, or OK to upload background music candidates. Uploaded files are only held in memory for this session and are included in the exported zip when referenced by the scene.

## Exporting your scene

Press **Download scene** in the top bar. This bundles `scene.js`, the trigger/cutscene/audio helper modules it depends on, any scripts and shaders you authored, and any audio you imported, into a single zip. Unzip it into an existing Three.js project folder and import `scene.js` as a normal ES module — no editor runtime is required to use the exported scene.

## Release targets

GitHub Pages serves the Vite browser build. See [DEPLOYMENT.md](DEPLOYMENT.md) for setup and release procedures.
