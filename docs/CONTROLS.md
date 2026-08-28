# 3ditorJS Features and Controls Reference

A complete listing of every feature and control currently in the editor. See [HOW_TO_USE.md](HOW_TO_USE.md) for narrative workflows and [ARCHITECTURE.md](ARCHITECTURE.md) for the system reference.

## Top bar

| Control | Behavior |
| --- | --- |
| **Download scene** | Builds a zip containing `scene.js`, the helper modules it depends on (triggers, cutscenes, audio), any attached scripts/shaders, and any uploaded audio referenced by the scene, then downloads it. |
| Status text | Shows the result of the last action (export, save, upload, errors). |

## Scene Tree (left of Inspector)

| Control | Behavior |
| --- | --- |
| **▶ / ■ Play scene** | Enters/exits play mode on the selected object (see Play mode below). |
| **+ Add object** | Opens the Add Object dialog. |
| **+ Duplicate** | Duplicates the selected scene object (position offset, shifted color). Disabled unless an object is selected. |
| **− Delete** | Deletes the selected scene item (object, light, camera, trigger, cutscene, spline, or audio emitter). Also bound to the `Delete` key when focus isn't in a text field. |
| Object list | Click any entry (Camera, lights, objects, cameras, triggers, cutscenes, audio emitters) to select and inspect it. |

### Add Object dialog

| Option | Result |
| --- | --- |
| Box / Sphere / Cylinder / Cone / Torus | Adds a primitive mesh with default material and physics disabled. |
| Directional light / Point light | Adds a light source. |
| Perspective camera | Adds an additional scene camera (selectable, attachable to an object). |
| Cutscene + spline | Adds a linked spline (Catmull-Rom curve) and cutscene pair. |
| Box trigger area / Sphere trigger area | Adds an invisible trigger volume; enables the Trigger zones display automatically. |
| Audio emitter | Adds a positional SFX emitter. Requires at least one SFX file already uploaded. |
| Upload GLTF / GLB | Opens a file picker to bring a local `.glb` model into the scene (`.gltf` alone is not supported without its side-car assets). |

## Inspector (selected object)

### Transform gizmo

- **position / rotation / scale** buttons switch the gizmo mode (translate/rotate/scale) and are mirrored by the numeric X/Y/Z fields beside them.
- Dragging the gizmo in the viewport updates the object live; releasing commits the change to Scene JSON and `scene.js`.
- Numeric transform fields commit on blur/Enter.

### Material

| Field | Notes |
| --- | --- |
| Type | Any built-in Three.js material (`MeshBasicMaterial` through `RawShaderMaterial`). |
| Color / Emissive | Color pickers. |
| Roughness / Metalness / Emissive intensity / Opacity | Numeric sliders/inputs. |
| Transparent / Wireframe / Flat shading | Checkboxes. |
| **Open shader editor** | Only shown for `ShaderMaterial`/`RawShaderMaterial`. Opens Monaco editors for the vertex and fragment GLSL source, stored under `shaders/` and bundled on export. |

### Physics

| Field | Notes |
| --- | --- |
| Enabled | Turns physics on for this object. Defaults `mass` to `1` the first time it's enabled. |
| Mass | `0` = static/immovable, `>0` = dynamic. |
| Collider | `auto` (default — matches the real mesh geometry automatically and rescales with it), or manually pick `box` / `sphere` / `cylinder` / `capsule`. |
| Radius / Height | Used by sphere/cylinder/capsule colliders. |
| Linear damping / Angular damping | Standard Cannon-es damping. |
| Impact SFX / threshold / cooldown | Plays an uploaded sound effect on hard collisions. |
| Velocity X/Y/Z | Initial velocity for dynamic bodies. |

#### Editing physics colliders directly (Display → Physics colliders)

Turning on **Physics colliders** in the Display section changes what clicking in the viewport selects:

- With it **off**, clicks select the mesh as normal.
- With it **on**, clicks select the collider itself. The gizmo attaches to the collider (not the mesh): translate to move it, scale to resize it (`Size` for box, `Radius`/`Radius / height` for sphere/cylinder/capsule). Manual numeric edits commit on blur/Enter.
- The panel shows a **Colliders on this object** list ("Primary collider", "Collider 2", …) to switch which shape the gizmo is editing, a **+ Add collider** button, and (for non-primary colliders) a **Remove this collider** button.
- **Right-click** a physics-enabled object or one of its collider shapes for a context menu with **Add collider** (and **Remove this collider** when right-clicking an existing extra collider). This is how you build a compound collider (e.g., a capsule body plus a separate box for a held item) that doesn't match a single primitive shape.
- Extra colliders are positioned as a local offset from the object's origin and move/scale with the object automatically.
- Click **Select mesh instead** to return to the normal object inspector.

### Scripts

| Control | Behavior |
| --- | --- |
| **+ (Create new script)** | Opens an inline name field; **Create** (or Enter) generates a new script file under `scripts/` with a starter class, **Cancel** (or Escape) dismisses it. |
| Script dropdown | Lists all created scripts. |
| **Edit script** | Opens the selected script in a Monaco editor. |
| **Save script** | Saves edits and re-detects the exported class name from the source. |
| **Attach selected script** (under the selected object) | Attaches the dropdown's script to the selected object; generates the `import` and instantiation in `scene.js`. |
| **Remove `<script>`** | Detaches an attached script from the selected object. |

### Attached scripts / audio emitter / trigger / spline / cutscene fields

Selecting a trigger, spline, cutscene, audio emitter, light, or camera swaps the Inspector's property fields to that item's own settings (position/size for triggers, control points for splines/cutscenes, volume/radius/loop for audio emitters, intensity for lights, attach-to-object for extra cameras).

## Scene audio

| Control | Behavior |
| --- | --- |
| **Upload BGM** / **Upload SFX** | Opens a file picker to bring local audio into the session (held in memory only; bundled on export if referenced). |
| Background music dropdown / Volume / Loop / Autoplay | Configures the scene's background track. |
| **Play BGM** / **Stop BGM** | Preview controls. |

## Cutscene

| Control | Behavior |
| --- | --- |
| Cutscene dropdown | Selects which registered cutscene the buttons below control. |
| **Play** / **Pause** / **Stop** | Playback controls; moves the active camera along the selected spline. |

## Display toggles

| Toggle | Effect |
| --- | --- |
| Physics colliders | Shows collider wireframes and switches viewport click-selection to collider-edit mode (see Physics above). |
| Trigger zones | Shows/hides trigger volume wireframes. |
| Spline editor | Shows/hides the spline curve and its draggable control points. |
| Camera helper | Shows/hides the editor camera's frustum helper. |
| Light helpers | Shows/hides directional light helpers. |

## scene.js / Scene JSON tabs

| Control | Behavior |
| --- | --- |
| **scene.js** tab | Monaco editor showing the generated Three.js module for the current scene. **Apply scene.js** (or `Ctrl/Cmd+S` while focused) parses the supported subset of edited code back into the scene. |
| **Scene JSON** tab | Monaco editor showing the canonical Scene JSON. **Apply JSON** re-loads the scene from edited JSON (full round trip, including any hand-edited compound colliders). |
| Fullscreen button (⛶) | Expands any Monaco editor to fill the screen; click again (×) to restore. |

## Undo / redo

`Undo` and `Redo` buttons above the transform fields step through scene edit history (object/property/transform changes).

## Play mode

Select an object, then press **▶ Play scene** on the Scene Tree header:

- `W`/`A`/`S`/`D` move the selected object (checked against physics if enabled).
- Press **■** (same button) to stop and restore the editor camera/controls.

## Keyboard shortcuts summary

| Shortcut | Action |
| --- | --- |
| `Delete` | Delete the selected scene item (when focus isn't in a text input). |
| `W` / `A` / `S` / `D` | Move the play-mode character. |
| `Ctrl/Cmd+S` (in the `scene.js` editor) | Apply the edited code to the scene. |
| `Enter` / `Escape` (new script name field) | Create / cancel. |
| `Escape` | Close the collider right-click context menu. |

## Panel controls

- The inspector panel can be **resized** by dragging its left edge handle, and **collapsed/expanded** with the `›`/`‹` button.
