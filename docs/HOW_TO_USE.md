# 3ditorJS How To Use

## Run the browser editor

```bash
npm install
npm run dev
```

Open the Vite URL. The editor uses Three.js for the viewport, Monaco for code, Cannon-es for physics, and browser storage for the current project persistence slice.

## Scene authoring

The Scene Tree is the main object workflow. Use `+` to add boxes, spheres, cylinders, cones, toruses, lights, cameras, cutscene/spline pairs, or import a GLB model. Select an item to inspect it. Rename an editable item by editing the title under Inspector. Use the duplicate and delete controls beside Scene Tree.

The position, rotation, and scale labels are gizmo mode buttons. The active mode is bold/highlighted. Object, camera, directional-light, and spline-point movement updates the editor state, Scene JSON, and generated `scene.js`.

## Physics

Enable physics on an object and choose a box, sphere, cylinder, or capsule-style collider. Radius, height, velocity, and damping are available for physics bodies. Enable `Physics colliders` in Display to inspect the actual configured collider shape. Dynamic bodies can be grabbed with the gizmo and dropped again.

## Animation and cutscenes

Use `+` and choose `Cutscene + spline` to create a linked pair. Select the cutscene in the Scene Tree to edit duration and control points in one inspector section. The Cutscene dropdown chooses which registered cutscene Play, Pause, and Stop control. Enable `Spline editor` to show the curve and its point gizmo.

## Shaders

Choose a built-in material such as `MeshToonMaterial`, `MeshStandardMaterial`, or `MeshPhysicalMaterial`. For custom GLSL, choose `ShaderMaterial` or `RawShaderMaterial`, then use `Open shader editor`. Vertex and fragment source is created under `shaders/` and generated code imports it with Vite's `?raw` convention.

## Scripts and play mode

The Scripts section can create, edit, and save JavaScript files. Select an object, choose a script, and attach it. The relationship is stored with the object and emitted as an import and instance in `scene.js`. Select the player object and press the Scene Tree Play button to enter the current basic WASD/arrow playtest. Space is the jump input when the attached physics API is available.

## Menus

Menus are optional. Open `/menu-editor.html` to edit code-first `menu.js` and `menu.css`. Register a menu with `UIManager` only when a game needs HTML/CSS UI. Scenes without menus are unaffected.

## Source of truth

Scene JSON is the structured bridge used by the visual editor and persistence. `scene.js` is the primary Three.js authoring surface. `Apply scene.js` parses supported editor constructs into scene state; visual editor and inspector changes regenerate supported `scene.js` output. Custom runtime JavaScript remains normal JavaScript and is not flattened into JSON.

## Browser project storage

`Save` stores the virtual explorer files and active scene JSON in IndexedDB. `Load` restores them through the normal scene-apply path. The browser storage adapter is separate from the future File System Access and Tauri adapters.

## Release targets

GitHub Pages serves the Vite browser build. Tauri uses the same `dist` output for desktop builds. The shared editor code must not call Tauri APIs directly; platform-specific behavior belongs behind storage adapters.
