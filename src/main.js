import * as THREE from 'three';
import * as monaco from 'monaco-editor';
import editorWorker from '../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { SceneManager } from './scene/SceneManager.js';
import { createDefaultScene } from './scene/sceneSchema.js';
import { generateSceneCode } from './scene/sceneCodeGenerator.js';
import { parseSceneCode } from './scene/sceneCodeParser.js';
import { addRigidBody, beginGrab, endGrab, initPhysics, moveGrabbedBody, moveKinematic, onCollision, stepPhysics } from './physics/index.js';
import { TriggerManager } from './triggers/TriggerManager.js';
import { AnimationManager } from './animation/AnimationManager.js';
import { CutsceneManager } from './animation/CutsceneManager.js';
import { SplineEditor } from './animation/SplineEditor.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SceneAssets } from './scene/SceneAssets.js';
import { ScriptManager } from './scripts/ScriptManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { buildSceneExportZip, downloadBlob } from './export/exportScene.js';
import './style.css';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

const container = document.querySelector('#scene-container');
const objectList = document.querySelector('#object-list');
const selectionLabel = document.querySelector('#selection-label');
const transformFields = document.querySelector('#transform-fields');
const propertyFields = document.querySelector('#property-fields');
const scenePropertyFields = document.querySelector('#scene-property-fields');
const animationPropertyFields = document.querySelector('#animation-property-fields');
const undoButton = document.querySelector('#undo-scene');
const redoButton = document.querySelector('#redo-scene');
const sceneJSONView = document.querySelector('#scene-json');
const applyJSONButton = document.querySelector('#apply-json');
const jsonStatus = document.querySelector('#json-status');
const physicsToggle = document.querySelector('#physics-toggle');
const triggerToggle = document.querySelector('#trigger-toggle');
const splineToggle = document.querySelector('#spline-toggle');
const cameraHelperToggle = document.querySelector('#camera-helper-toggle');
const lightHelperToggle = document.querySelector('#light-helper-toggle');
const cutscenePlay = document.querySelector('#cutscene-play');
const cutscenePause = document.querySelector('#cutscene-pause');
const cutsceneStop = document.querySelector('#cutscene-stop');
const cutsceneStatus = document.querySelector('#cutscene-status');
const cutsceneSelect = document.querySelector('#cutscene-select');
const bgmSelect = document.querySelector('#bgm-select');
const bgmVolume = document.querySelector('#bgm-volume');
const bgmLoop = document.querySelector('#bgm-loop');
const bgmAutoplay = document.querySelector('#bgm-autoplay');
const playBgmButton = document.querySelector('#play-bgm');
const stopBgmButton = document.querySelector('#stop-bgm');
const sceneCodeView = document.querySelector('#scene-code');
const applyCodeButton = document.querySelector('#apply-code');
const jsonTab = document.querySelector('#json-tab');
const codeTab = document.querySelector('#code-tab');
const editorViews = document.querySelectorAll('[data-editor-view]');
const panel = document.querySelector('.editor-panel');
const panelResizeHandle = document.querySelector('#panel-resize-handle');
const editorStatus = document.querySelector('#editor-status');
const downloadSceneButton = document.querySelector('#download-scene');
const uploadBgmFileButton = document.querySelector('#upload-bgm-file');
const uploadSfxFileButton = document.querySelector('#upload-sfx-file');
const inspectorCollapse = document.querySelector('#panel-collapse');
const objectModal = document.querySelector('#object-modal');
const objectModalClose = document.querySelector('#object-modal-close');
const objectModalStatus = document.querySelector('#object-modal-status');
const importObjectFile = document.querySelector('#import-object-file');
const sceneAddObject = document.querySelector('#scene-add-object');
const playScene = document.querySelector('#play-scene');
const scriptAttachmentFields = document.querySelector('#script-attachment-fields');
const createScriptButton = document.querySelector('#create-script');
const newScriptForm = document.querySelector('#new-script-form');
const newScriptNameInput = document.querySelector('#new-script-name');
const confirmNewScriptButton = document.querySelector('#confirm-new-script');
const cancelNewScriptButton = document.querySelector('#cancel-new-script');
const editScriptButton = document.querySelector('#edit-script');
const saveScriptButton = document.querySelector('#save-script');
const scriptSelect = document.querySelector('#script-select');
const scriptEditorView = document.querySelector('#script-editor-view');
const scriptEditorHost = document.querySelector('#script-editor-host');
const sceneDeleteObject = document.querySelector('#scene-delete-object');
const sceneDuplicateObject = document.querySelector('#scene-duplicate-object');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101820);
const sceneLights = new Map();
const lightHelpers = new Map();
let cameraHelper = null;
const sceneCameras = new Map();
const gltfLoader = new GLTFLoader();

const sceneAssets = new SceneAssets({
  onChange: () => {
    populateScripts();
    populateBgmSelect();
  },
});
const scriptManager = new ScriptManager(sceneAssets);
let playMode = false;
let playTarget = null;
let scriptEditor = null;
const shaderFileModels = new Map();

function pickAudioFiles(category) {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.multiple = true;
  picker.accept = 'audio/*';
  picker.addEventListener('change', () => {
    const added = sceneAssets.addImportedAudio(category, picker.files);
    editorStatus.textContent = added.length ? `Uploaded ${added.length} audio file${added.length === 1 ? '' : 's'}` : 'No files selected';
  }, { once: true });
  picker.click();
}

uploadBgmFileButton.addEventListener('click', () => pickAudioFiles('bgm'));
uploadSfxFileButton.addEventListener('click', () => pickAudioFiles('sfx'));

downloadSceneButton.addEventListener('click', async () => {
  try {
    editorStatus.textContent = 'Building scene export…';
    const blob = await buildSceneExportZip(sceneManager.exportJSON(), sceneAssets);
    const slug = (sceneManager.exportJSON().metadata?.name || 'scene').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'scene';
    downloadBlob(blob, `${slug}.zip`);
    editorStatus.textContent = 'Scene exported';
  } catch (error) {
    editorStatus.textContent = error.message;
  }
});

const camera = new THREE.PerspectiveCamera(
  50,
  container.clientWidth / container.clientHeight,
  0.1,
  100,
);
camera.position.set(3.8, 2.8, 5.5);
let renderCamera = camera;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
container.append(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.6, 0);

const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls.getHelper());
transformControls.addEventListener('dragging-changed', (event) => {
  controls.enabled = !event.value;
  const mesh = selectedId ? sceneManager.getMesh(selectedId) : null;
  if (event.value) {
    sceneManager.beginEdit();
    if (mesh) beginGrab(mesh);
    if (activeSelection?.type === 'trigger') {
      const trigger = triggerManager.triggers.get(activeSelection.id);
      if (trigger) triggerGizmoEdit = { id: activeSelection.id, size: [...(trigger.data.size || [1, 1, 1])] };
    }
    if (activeSelection?.type === 'collider') {
      const objectJSON = sceneManager.exportJSON().objects.find((entry) => entry.id === activeSelection.id);
      const colliderMesh = sceneManager.getMesh(activeSelection.id);
      const spec = getColliderSpec(objectJSON, activeSelection.colliderIndex);
      const resolvedPhysics = activeSelection.colliderIndex === null ? resolveColliderOptions(objectJSON, colliderMesh, spec) : spec;
      const effective = computeEffectiveColliderDims(colliderMesh, resolvedPhysics);
      colliderGizmoEdit = { id: activeSelection.id, colliderIndex: activeSelection.colliderIndex, collider: resolvedPhysics.collider, size: effective.size, radius: effective.radius, height: effective.height };
    }
  } else {
    if (mesh) endGrab(mesh);
    if (mesh && gizmoMode === 'scale') rebuildPhysics();
    if (triggerGizmoEdit) {
      const trigger = triggerManager.triggers.get(triggerGizmoEdit.id);
      if (trigger) {
        const size = triggerGizmoEdit.size.map((value, index) => value * trigger.helper.scale.toArray()[index]);
        trigger.helper.scale.set(1, 1, 1);
        sceneManager.updateTrigger(triggerGizmoEdit.id, { position: trigger.helper.position.toArray(), size });
        triggerManager.registerTrigger(sceneManager.exportJSON().triggers.find((entry) => entry.id === triggerGizmoEdit.id));
        if (activeSelection?.type === 'trigger' && activeSelection.id === triggerGizmoEdit.id) transformControls.attach(triggerManager.triggers.get(triggerGizmoEdit.id).helper);
        updateVectorFields(transformFields, 'Position', trigger.helper.position.toArray());
        updateVectorFields(transformFields, 'Size', size);
        renderJSON();
      }
      triggerGizmoEdit = null;
    }
    if (colliderGizmoEdit) {
      const { id, colliderIndex, collider } = colliderGizmoEdit;
      const colliderMesh = sceneManager.getMesh(id);
      const helper = getColliderHelper(id, colliderIndex);
      if (colliderMesh && helper) {
        const helperScale = helper.scale.toArray();
        const finalEffective = {
          size: colliderGizmoEdit.size.map((value, index) => value * helperScale[index]),
          radius: colliderGizmoEdit.radius * helperScale[0],
          height: colliderGizmoEdit.height * helperScale[1],
        };
        const baseDims = baseColliderDimsFromEffective(colliderMesh, collider, finalEffective);
        helper.scale.set(1, 1, 1);
        if (colliderIndex === null) {
          sceneManager.updateObjectProperties(id, { physics: { collider, position: helper.position.toArray(), rotation: [helper.rotation.x, helper.rotation.y, helper.rotation.z], ...baseDims } });
        } else {
          const scale = colliderMesh.scale.toArray();
          const localOffset = [
            (helper.position.x - colliderMesh.position.x) / (scale[0] || 1),
            (helper.position.y - colliderMesh.position.y) / (scale[1] || 1),
            (helper.position.z - colliderMesh.position.z) / (scale[2] || 1),
          ];
          const objectJSON = sceneManager.exportJSON().objects.find((entry) => entry.id === id);
          const extras = [...(objectJSON.physics.extraColliders || [])];
          extras[colliderIndex] = { ...extras[colliderIndex], collider, position: localOffset, ...baseDims };
          sceneManager.updateObjectProperties(id, { physics: { extraColliders: extras } });
        }
        rebuildPhysics();
        if (activeSelection?.type === 'collider' && activeSelection.id === id && activeSelection.colliderIndex === colliderIndex) selectCollider(id, colliderIndex);
        renderJSON();
      }
      colliderGizmoEdit = null;
    }
    sceneManager.endEdit();
  }
});
transformControls.addEventListener('objectChange', () => {
  if (selectedId) {
    const mesh = sceneManager.getMesh(selectedId);
    moveGrabbedBody(mesh);
    sceneManager.updateObjectTransform(selectedId, {
      position: mesh.position.toArray(),
      rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
      scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
    });
    updateTransformFields(mesh);
  } else if (activeSelection?.type === 'camera') {
    const targetCamera = activeSelection.id ? sceneCameras.get(activeSelection.id) : camera;
    if (activeSelection.id) sceneManager.updateCameraById(activeSelection.id, { position: targetCamera.position.toArray() });
    else sceneManager.updateCamera({ position: targetCamera.position.toArray() });
    updateVectorFields(scenePropertyFields, activeSelection.id ? 'Scene camera position' : 'Camera position', targetCamera.position.toArray());
    (activeSelection.id ? targetCamera.userData.helper : cameraHelper)?.update();
  } else if (activeSelection?.type === 'light') {
    const light = sceneLights.get(activeSelection.id);
    sceneManager.updateLight(activeSelection.id, { position: light.position.toArray() });
    lightHelpers.get(activeSelection.id)?.update();
    updateVectorFields(scenePropertyFields, 'Light position', light.position.toArray());
  } else if (activeSelection?.type === 'trigger') {
    const trigger = triggerManager.triggers.get(activeSelection.id);
    if (!trigger) return;
    if (gizmoMode === 'scale' && triggerGizmoEdit) {
      const size = triggerGizmoEdit.size.map((value, index) => value * trigger.helper.scale.toArray()[index]);
      updateVectorFields(transformFields, 'Size', size);
    } else {
      updateVectorFields(transformFields, 'Position', trigger.helper.position.toArray());
    }
  } else if (activeSelection?.type === 'audio') {
    const helper = audioHelpers.get(activeSelection.id);
    const emitter = audioManager.emitters.get(activeSelection.id);
    if (!helper || !emitter) return;
    sceneManager.updateAudioEmitter(activeSelection.id, { position: helper.position.toArray() });
    emitter.data.position = helper.position.toArray();
    updateVectorFields(propertyFields, 'Position', helper.position.toArray());
  } else if (activeSelection?.type === 'collider') {
    const helper = getColliderHelper(activeSelection.id, activeSelection.colliderIndex);
    if (!helper) return;
    if (gizmoMode === 'scale' && colliderGizmoEdit) {
      const helperScale = helper.scale.toArray();
      const size = colliderGizmoEdit.size.map((value, index) => value * helperScale[index]);
      updateVectorFields(transformFields, 'Size', size);
      updateVectorFields(transformFields, 'Radius / height', [colliderGizmoEdit.radius * helperScale[0], colliderGizmoEdit.height * helperScale[1]]);
    } else {
      updateVectorFields(transformFields, 'Position', helper.position.toArray());
    }
  }
  renderJSON();
});

const sceneManager = new SceneManager(scene);
const triggerManager = new TriggerManager(scene);
const animationManager = new AnimationManager();
const cutsceneManager = new CutsceneManager({
  camera,
  controls,
  onStateChange: (state) => { cutsceneStatus.textContent = state; },
  onAudioEvent: (event) => audioManager.playSfx(event.path, { position: event.position || [0, 0, 0], volume: event.volume ?? 0.8, radius: event.radius ?? 12 }),
});
const audioManager = new AudioManager({
  camera,
  getFile: (path) => sceneAssets.get(path),
});
const splineEditor = new SplineEditor({
  scene,
  camera,
  domElement: renderer.domElement,
  orbitControls: controls,
  onSelect: () => transformControls.detach(),
  onChange: (points) => {
    cutsceneManager.registerSplineCurve(activeSplineId, new THREE.CatmullRomCurve3(
      points.map((point) => new THREE.Vector3(...point)),
    ));
    sceneManager.updateSplinePoints(activeSplineId, points);
    renderJSON();
  },
});
const physicsHelpers = new Map();
const audioHelpers = new Map();
let showPhysicsBodies = false;
const sceneData = createDefaultScene();
sceneManager.loadFromJSON(sceneData);
for (const cameraJSON of sceneData.cameras || []) {
  const sceneCamera = new THREE.PerspectiveCamera(cameraJSON.fov, cameraJSON.aspect, cameraJSON.near, cameraJSON.far);
  sceneCamera.name = cameraJSON.name;
  sceneCamera.position.fromArray(cameraJSON.position);
  sceneCamera.lookAt(...cameraJSON.target);
  sceneCameras.set(cameraJSON.id, sceneCamera);
  scene.add(sceneCamera);
  const helper = new THREE.CameraHelper(sceneCamera);
  helper.visible = cameraHelperToggle.checked;
  sceneCamera.userData.helper = helper;
  scene.add(helper);
  if (cameraJSON.parent) sceneManager.getMesh(cameraJSON.parent)?.add(sceneCamera);
}
for (const lightJSON of sceneData.lights || []) {
  const light = lightJSON.type === 'hemisphere'
    ? new THREE.HemisphereLight(lightJSON.skyColor, lightJSON.groundColor, lightJSON.intensity)
    : new THREE.DirectionalLight(lightJSON.color, lightJSON.intensity);
  if (lightJSON.position) light.position.fromArray(lightJSON.position);
  light.castShadow = Boolean(lightJSON.castShadow);
  light.userData.sceneLightId = lightJSON.id;
  sceneLights.set(lightJSON.id, light);
  scene.add(light);
  if (lightJSON.type === 'directional') {
    const helper = new THREE.DirectionalLightHelper(light, 1.2, 0xf2b880);
    helper.visible = lightHelperToggle.checked;
    lightHelpers.set(lightJSON.id, helper);
    scene.add(helper);
  }
}
cameraHelper = new THREE.CameraHelper(camera);
cameraHelper.visible = cameraHelperToggle.checked;
scene.add(cameraHelper);
for (const spline of sceneData.splines || []) cutsceneManager.registerSpline(spline);
for (const cutscene of sceneData.cutscenes || []) cutsceneManager.registerCutscene(cutscene);
if (sceneData.splines?.[0]) splineEditor.load(sceneData.splines[0].points);
for (const trigger of sceneData.triggers || []) triggerManager.registerTrigger(trigger);
rebuildAudio();
triggerManager.on('triggerEnter', (trigger, actor) => {
  console.info(trigger.params?.message || `${actor.name} entered ${trigger.id}`);
});
triggerManager.registerAction('playCutscene', (params) => cutsceneManager.play(params.cutsceneId));
triggerManager.registerAction('playSfx', (params, actor) => audioManager.playSfx(params.path, { position: actor.position.toArray(), volume: params.volume ?? 0.8, radius: params.radius ?? 12 }));

const AUTO_COLLIDER_SHAPE_BY_OBJECT_TYPE = {
  box: 'box',
  plane: 'box',
  gltf: 'box',
  model: 'box',
  sphere: 'sphere',
  cylinder: 'cylinder',
  cone: 'cylinder',
  torus: 'cylinder',
};

function getBaseGeometrySize(mesh) {
  const originalScale = mesh.scale.clone();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  mesh.scale.copy(originalScale);
  mesh.updateMatrixWorld(true);
  const size = new THREE.Vector3();
  box.getSize(size);
  return [size.x || 1, Math.max(size.y, 0.05), size.z || 1];
}

function resolveColliderOptions(objectJSON, mesh, physics) {
  if (physics.collider !== 'auto') return physics;
  const baseSize = getBaseGeometrySize(mesh);
  const shape = AUTO_COLLIDER_SHAPE_BY_OBJECT_TYPE[objectJSON.type] || 'box';
  if (shape === 'sphere') return { ...physics, collider: 'sphere', radius: Math.max(...baseSize) / 2 };
  if (shape === 'cylinder') return { ...physics, collider: 'cylinder', radius: Math.max(baseSize[0], baseSize[2]) / 2, height: baseSize[1] };
  return { ...physics, collider: 'box', size: baseSize };
}

function computeEffectiveColliderDims(mesh, resolvedPhysics) {
  const scale = mesh.scale.toArray();
  const radialScale = (scale[0] + scale[2]) / 2;
  const size = (resolvedPhysics.size || [1, 1, 1]).map((value, index) => value * scale[index]);
  const radius = (resolvedPhysics.radius || (resolvedPhysics.size || [1, 1, 1])[0] / 2)
    * (resolvedPhysics.collider === 'sphere' ? (scale[0] + scale[1] + scale[2]) / 3 : radialScale);
  const height = (resolvedPhysics.height || (resolvedPhysics.size || [1, 1, 1])[1]) * scale[1];
  return { size, radius, height, scale, radialScale };
}

function baseColliderDimsFromEffective(mesh, collider, effective) {
  const scale = mesh.scale.toArray();
  const radialScale = (scale[0] + scale[2]) / 2;
  const uniformScale = (scale[0] + scale[1] + scale[2]) / 3;
  if (collider === 'sphere') return { radius: effective.radius / (uniformScale || 1) };
  if (collider === 'cylinder' || collider === 'capsule') {
    return { radius: effective.radius / (radialScale || 1), height: effective.height / (scale[1] || 1) };
  }
  return { size: effective.size.map((value, index) => value / (scale[index] || 1)) };
}

function getColliderHelper(id, colliderIndex) {
  return physicsHelpers.get(id)?.find((entry) => entry.colliderIndex === colliderIndex)?.object3D;
}

function getColliderSpec(objectJSON, colliderIndex) {
  if (colliderIndex === null) return objectJSON.physics;
  return { collider: 'box', ...(objectJSON.physics.extraColliders || [])[colliderIndex] };
}

function buildColliderHelper(collider, size, radius, height) {
  if (collider === 'sphere') {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0x91c483, wireframe: true }),
    );
  }
  if (collider === 'cylinder') {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 16),
      new THREE.MeshBasicMaterial({ color: 0x91c483, wireframe: true }),
    );
  }
  if (collider === 'capsule') {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0x91c483, wireframe: true });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), material);
    const top = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), material);
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), material);
    top.position.y = height / 2;
    bottom.position.y = -height / 2;
    group.add(body, top, bottom);
    return group;
  }
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)),
    new THREE.LineBasicMaterial({ color: 0x91c483 }),
  );
}

function rebuildPhysics() {
  initPhysics({ gravity: [0, -9.81, 0], engine: 'cannon' });
  for (const entries of physicsHelpers.values()) {
    for (const { object3D } of entries) {
      scene.remove(object3D);
      object3D.traverse((child) => {
        child.geometry?.dispose();
        child.material?.dispose();
      });
    }
  }
  physicsHelpers.clear();
  for (const objectJSON of sceneManager.exportJSON().objects) {
    if (objectJSON.physics?.enabled) {
      const mesh = sceneManager.getMesh(objectJSON.id);
      const resolvedPhysics = resolveColliderOptions(objectJSON, mesh, objectJSON.physics);
      addRigidBody(mesh, resolvedPhysics);
      if (objectJSON.physics.impactSfx) {
        let lastImpactAt = 0;
        onCollision(mesh, (_mesh, _otherBody, event) => {
          const impact = Math.abs(event.contact?.getImpactVelocityAlongNormal?.() || 0);
          const now = performance.now();
          if (impact < (objectJSON.physics.impactThreshold ?? 1.5) || now - lastImpactAt < (objectJSON.physics.impactCooldown ?? 0.12) * 1000) return;
          lastImpactAt = now;
          audioManager.playSfx(objectJSON.physics.impactSfx, {
            position: mesh.position.toArray(),
            volume: Math.min(objectJSON.physics.impactVolume ?? 0.7, impact / 8),
            radius: objectJSON.physics.impactRadius ?? 12,
          });
        });
      }
      const entries = [];
      const { size, radius, height } = computeEffectiveColliderDims(mesh, resolvedPhysics);
      const helper = buildColliderHelper(resolvedPhysics.collider, size, radius, height);
      helper.position.fromArray(objectJSON.physics.position || mesh.position.toArray());
      helper.rotation.set(...(objectJSON.physics.rotation || mesh.rotation.toArray()));
      helper.userData.followMeshRotation = (objectJSON.physics.mass ?? 0) > 0;
      helper.userData.sceneObjectId = objectJSON.id;
      helper.userData.colliderIndex = null;
      helper.traverse((child) => { child.userData.sceneObjectId = objectJSON.id; child.userData.colliderIndex = null; });
      helper.visible = showPhysicsBodies;
      scene.add(helper);
      entries.push({ object3D: helper, colliderIndex: null });
      const scale = mesh.scale.toArray();
      (objectJSON.physics.extraColliders || []).forEach((extra, index) => {
        const extraDims = computeEffectiveColliderDims(mesh, extra);
        const extraHelper = buildColliderHelper(extra.collider || 'box', extraDims.size, extraDims.radius, extraDims.height);
        const localOffset = extra.position || [0, 0, 0];
        extraHelper.position.set(
          mesh.position.x + localOffset[0] * scale[0],
          mesh.position.y + localOffset[1] * scale[1],
          mesh.position.z + localOffset[2] * scale[2],
        );
        extraHelper.userData.followMeshRotation = (objectJSON.physics.mass ?? 0) > 0;
        extraHelper.userData.sceneObjectId = objectJSON.id;
        extraHelper.userData.colliderIndex = index;
        extraHelper.userData.localOffset = localOffset;
        extraHelper.traverse((child) => { child.userData.sceneObjectId = objectJSON.id; child.userData.colliderIndex = index; });
        extraHelper.visible = showPhysicsBodies;
        scene.add(extraHelper);
        entries.push({ object3D: extraHelper, colliderIndex: index });
      });
      physicsHelpers.set(objectJSON.id, entries);
    }
  }
}

function rebuildAudio() {
  const audio = sceneManager.exportJSON().audio || { bgm: null, emitters: [] };
  audioManager.stopBgm();
  audioManager.clearEmitters();
  for (const helper of audioHelpers.values()) {
    scene.remove(helper);
    helper.geometry.dispose();
    helper.material.dispose();
  }
  audioHelpers.clear();
  try {
    if (audio.bgm?.path) audioManager.setBgm(audio.bgm);
    for (const emitter of audio.emitters || []) {
      audioManager.registerEmitter(emitter);
      const helper = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.SphereGeometry(emitter.radius ?? 12, 20, 12)),
        new THREE.LineBasicMaterial({ color: 0x70b8d8 }),
      );
      helper.position.fromArray(emitter.position || [0, 1, 0]);
      helper.userData.audioEmitterId = emitter.id;
      scene.add(helper);
      audioHelpers.set(emitter.id, helper);
    }
  } catch (error) {
    editorStatus.textContent = error.message;
  }
}

sceneManager.activeSceneId = sceneData.id;

rebuildPhysics();

const grid = new THREE.GridHelper(30, 30, 0x6b8790, 0x38505a);
grid.position.y = 0.01;
scene.add(grid);

let selectedId = null;
let activeSelection = null;
let activeSplineId = 'foundation-camera-path';
let activeCutsceneId = 'foundation-flythrough';
let sceneCodeDirty = false;
let syncingEditors = false;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let gizmoMode = 'translate';
let triggerGizmoEdit = null;
let colliderGizmoEdit = null;

function setGizmoMode(mode) {
  gizmoMode = mode;
  transformControls.setMode(mode);
  transformFields.querySelectorAll('[data-gizmo-mode]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.gizmoMode === mode);
    button.setAttribute('aria-pressed', String(button.dataset.gizmoMode === mode));
  });
}

function restoreEditorAfterHistory() {
  rebuildPhysics();
  renderObjectList();
  selectObject(sceneManager.exportJSON().objects[0]?.id || null);
  renderJSON();
}

monaco.editor.defineTheme('three-editor', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '718096' },
    { token: 'keyword', foreground: 'f2b880' },
    { token: 'string', foreground: 'b9d7b0' },
  ],
  colors: {
    'editor.background': '#101820',
    'editorGutter.background': '#101820',
    'editorLineNumber.foreground': '#52666d',
    'editorLineNumber.activeForeground': '#f2b880',
    'editorIndentGuide.background': '#1c2a31',
    'editor.selectionBackground': '#31505c',
  },
});

const editorOptions = {
  theme: 'three-editor',
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: 'off',
  folding: true,
  roundedSelection: false,
  scrollBeyondLastLine: false,
  padding: { top: 10, bottom: 10 },
};
const codeEditor = monaco.editor.create(sceneCodeView, {
  ...editorOptions,
  language: 'javascript',
  readOnly: false,
});
const jsonEditor = monaco.editor.create(document.querySelector('#scene-json'), {
  ...editorOptions,
  language: 'json',
});
scriptEditor = monaco.editor.create(scriptEditorHost, {
  ...editorOptions,
  language: 'javascript',
  value: '',
});
addFullscreenControl(scriptEditorHost, 'script');

function populateScripts() {
  const current = scriptSelect.value;
  scriptSelect.replaceChildren();
  for (const file of scriptManager.listScripts()) {
    const option = document.createElement('option');
    option.value = file.path;
    option.textContent = file.path.split('/').at(-1);
    scriptSelect.append(option);
  }
  if (current && scriptManager.listScripts().some((file) => file.path === current)) scriptSelect.value = current;
  scriptSelect.disabled = scriptSelect.options.length === 0;
}

function listAudioFiles(folder) {
  return sceneAssets.listAudio(folder);
}

function populateBgmSelect() {
  const bgm = sceneManager.exportJSON()?.audio?.bgm;
  const current = bgm?.path || '';
  bgmSelect.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'No background music';
  bgmSelect.append(none);
  for (const file of listAudioFiles('bgm')) {
    const option = document.createElement('option');
    option.value = file.path;
    option.textContent = file.path.split('/').at(-1);
    bgmSelect.append(option);
  }
  bgmSelect.value = current;
  bgmVolume.value = bgm?.volume ?? 0.7;
  bgmLoop.checked = bgm?.loop !== false;
  bgmAutoplay.checked = Boolean(bgm?.autoplay);
}

function editSelectedScript() {
  const file = scriptManager.listScripts().find((entry) => entry.path === scriptSelect.value);
  if (!file) return;
  scriptEditor.setValue(file.content || '');
  scriptEditorView.hidden = false;
  scriptEditor.layout();
}

function saveSelectedScript() {
  const file = scriptManager.listScripts().find((entry) => entry.path === scriptSelect.value);
  if (!file) return;
  file.content = scriptEditor.getValue();
  file.exportName = file.content.match(/export class (\w+)/)?.[1] || file.exportName;
  editorStatus.textContent = `Saved ${file.path}`;
}

function playSelectedCharacter() {
  const candidate = selectedId ? sceneManager.getMesh(selectedId) : null;
  if (!candidate) {
    editorStatus.textContent = 'Select a character object first';
    return;
  }
  playMode = !playMode;
  playTarget = playMode ? candidate : null;
  if (playMode) {
    const playerCamera = sceneCameras.get('player-camera');
    if (playerCamera) renderCamera = playerCamera;
  } else {
    renderCamera = camera;
  }
  playScene.textContent = playMode ? '■' : '▶';
  playScene.setAttribute('aria-label', playMode ? 'Stop scene' : 'Play scene');
  playScene.title = playMode ? 'Stop scene' : 'Play scene';
  transformControls.detach();
  controls.enabled = !playMode;
  editorStatus.textContent = playMode ? `Playing as ${candidate.name}` : 'Scene editor';
  if (!playMode) rebuildPhysics();
}

const keys = new Set();
window.addEventListener('keydown', (event) => {
  if (playMode && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) keys.add(event.code);
});
window.addEventListener('keyup', (event) => keys.delete(event.code));

function addFullscreenControl(host, label) {
  const originalParent = host.parentElement;
  const placeholder = document.createComment(`fullscreen-${label}`);
  originalParent.insertBefore(placeholder, host);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'editor-fullscreen-button';
  button.textContent = '⛶';
  button.setAttribute('aria-label', `Fullscreen ${label}`);
  button.title = `Fullscreen ${label}`;
  button.addEventListener('click', () => {
    const fullscreen = host.classList.toggle('is-editor-fullscreen');
    if (fullscreen) {
      document.querySelectorAll('.is-editor-fullscreen').forEach((otherHost) => {
        if (otherHost !== host) otherHost.classList.remove('is-editor-fullscreen');
      });
      document.body.append(host);
    } else {
      placeholder.parentNode?.insertBefore(host, placeholder.nextSibling);
      host.style.width = '100%';
      host.style.maxWidth = '100%';
    }
    requestAnimationFrame(() => {
      monaco.editor.getEditors().forEach((editor) => {
        if (host.contains(editor.getDomNode())) editor.layout({ width: host.clientWidth, height: host.clientHeight });
      });
    });
    host.querySelector('.monaco-editor')?.focus();
    button.textContent = fullscreen ? '×' : '⛶';
    button.setAttribute('aria-label', fullscreen ? `Exit fullscreen ${label}` : `Fullscreen ${label}`);
    button.title = fullscreen ? `Exit fullscreen ${label}` : `Fullscreen ${label}`;
  });
  host.append(button);
}

addFullscreenControl(sceneCodeView, 'scene.js');
addFullscreenControl(document.querySelector('#scene-json'), 'Scene JSON');

function renderJSON() {
  const exported = sceneManager.exportJSON();
  syncingEditors = true;
  jsonEditor.setValue(JSON.stringify(exported, null, 2));
  codeEditor.setValue(generateSceneCode(exported));
  sceneCodeDirty = false;
  syncingEditors = false;
}

function applyJSON() {
  try {
    const nextScene = JSON.parse(jsonEditor.getValue());
    sceneManager.loadFromJSON(nextScene);
    triggerManager.clear();
    for (const trigger of nextScene.triggers || []) triggerManager.registerTrigger(trigger);
    rebuildAudio();
    rebuildPhysics();
    renderObjectList();
    selectObject(nextScene.objects[0]?.id || null);
    sceneCodeDirty = false;
    renderJSON();
    jsonStatus.textContent = 'Scene applied';
  } catch (error) {
    jsonStatus.textContent = error instanceof SyntaxError
      ? 'Invalid JSON'
      : error.message;
  }
}

function applyCode() {
  try {
    const nextScene = parseSceneCode(codeEditor.getValue());
    sceneManager.loadFromJSON(nextScene);
    triggerManager.clear();
    for (const trigger of nextScene.triggers || []) triggerManager.registerTrigger(trigger);
    rebuildAudio();
    rebuildPhysics();
    renderObjectList();
    selectObject(nextScene.objects[0]?.id || null);
    sceneCodeDirty = false;
    renderJSON();
    jsonStatus.textContent = 'scene.js applied';
  } catch (error) {
    jsonStatus.textContent = error.message;
  }
}

populateScripts();
populateBgmSelect();
scriptSelect.addEventListener('change', editSelectedScript);
function openNewScriptForm() {
  newScriptForm.hidden = false;
  newScriptNameInput.value = '';
  newScriptNameInput.focus();
}
function closeNewScriptForm() {
  newScriptForm.hidden = true;
}
function confirmNewScript() {
  const name = newScriptNameInput.value.trim();
  if (!name) return;
  try {
    const file = scriptManager.createScript(name);
    populateScripts();
    scriptSelect.value = file.path;
    editSelectedScript();
    closeNewScriptForm();
  } catch (error) {
    editorStatus.textContent = error.message;
  }
}
createScriptButton.addEventListener('click', openNewScriptForm);
cancelNewScriptButton.addEventListener('click', closeNewScriptForm);
confirmNewScriptButton.addEventListener('click', confirmNewScript);
newScriptNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') confirmNewScript();
  if (event.key === 'Escape') closeNewScriptForm();
});
editScriptButton.addEventListener('click', editSelectedScript);
saveScriptButton.addEventListener('click', saveSelectedScript);
playScene.addEventListener('click', playSelectedCharacter);
function updateBgm() {
  sceneManager.updateAudio({ bgm: bgmSelect.value ? { path: bgmSelect.value, volume: Number(bgmVolume.value) || 0, loop: bgmLoop.checked, autoplay: bgmAutoplay.checked } : null });
  rebuildAudio();
  renderJSON();
}

bgmSelect.addEventListener('change', updateBgm);
bgmVolume.addEventListener('change', updateBgm);
bgmLoop.addEventListener('change', updateBgm);
bgmAutoplay.addEventListener('change', updateBgm);
playBgmButton.addEventListener('click', () => audioManager.playBgm());
stopBgmButton.addEventListener('click', () => audioManager.stopBgm());

function selectObject(id) {
  selectedId = id;
  activeSelection = { type: 'object', id };
  sceneDeleteObject.disabled = !id;
  sceneDuplicateObject.disabled = !id;
  const objectJSON = sceneManager.exportJSON().objects.find((entry) => entry.id === id);
  selectionLabel.textContent = objectJSON?.name || 'Select an object';
  selectionLabel.contentEditable = String(Boolean(objectJSON));
  transformFields.replaceChildren();
  propertyFields.replaceChildren();
  scenePropertyFields.replaceChildren();
  animationPropertyFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  if (!objectJSON) {
    transformControls.detach();
    return;
  }
  splineEditor.detachGizmo();
  transformControls.attach(sceneManager.getMesh(id));

  for (const [axis, values] of [['position', objectJSON.position], ['rotation', objectJSON.rotation], ['scale', objectJSON.scale]]) {
    const row = document.createElement('div');
    row.className = 'transform-row';
    const label = document.createElement('button');
    label.type = 'button';
    label.dataset.gizmoMode = axis === 'position' ? 'translate' : axis === 'rotation' ? 'rotate' : 'scale';
    label.setAttribute('aria-pressed', String(label.dataset.gizmoMode === gizmoMode));
    label.addEventListener('click', () => setGizmoMode(label.dataset.gizmoMode));
    label.textContent = axis;
    row.append(label);
    values.forEach((value, index) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.1';
      input.value = value.toFixed(2);
      input.setAttribute('aria-label', `${axis} ${'xyz'[index]}`);
      input.addEventListener('change', () => {
        const nextValues = values.slice();
        nextValues[index] = Number(input.value) || 0;
        sceneManager.updateObjectTransform(id, { [axis]: nextValues });
        if (axis === 'scale') rebuildPhysics();
        selectObject(id);
        renderJSON();
      });
      row.append(input);
    });
    transformFields.append(row);
  }
  setGizmoMode(gizmoMode);

  const material = objectJSON.material || {};
  const physics = objectJSON.physics || {};
  const propertyGroups = [
    {
      title: 'Material',
      fields: [
        { label: 'Type', type: 'select', key: 'type', value: material.type || 'MeshStandardMaterial', options: ['MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial', 'MeshToonMaterial', 'MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshDepthMaterial', 'MeshNormalMaterial', 'MeshMatcapMaterial', 'MeshDistanceMaterial', 'ShadowMaterial', 'SpriteMaterial', 'PointsMaterial', 'LineBasicMaterial', 'LineDashedMaterial', 'ShaderMaterial', 'RawShaderMaterial'] },
        { label: 'Color', type: 'color', key: 'color', value: material.color || '#ffffff' },
        { label: 'Roughness', type: 'number', key: 'roughness', value: material.roughness ?? 0.5, step: '0.01', min: '0', max: '1' },
        { label: 'Metalness', type: 'number', key: 'metalness', value: material.metalness ?? 0, step: '0.01', min: '0', max: '1' },
        { label: 'Emissive', type: 'color', key: 'emissive', value: material.emissive || '#000000' },
        { label: 'Emissive intensity', type: 'number', key: 'emissiveIntensity', value: material.emissiveIntensity ?? 1, step: '0.1', min: '0' },
        { label: 'Opacity', type: 'number', key: 'opacity', value: material.opacity ?? 1, step: '0.01', min: '0', max: '1' },
        { label: 'Transparent', type: 'checkbox', key: 'transparent', value: material.transparent ?? false },
        { label: 'Wireframe', type: 'checkbox', key: 'wireframe', value: material.wireframe ?? false },
        { label: 'Flat shading', type: 'checkbox', key: 'flatShading', value: material.flatShading ?? false },
      ],
    },
    {
      title: 'Physics',
      fields: [
        { label: 'Enabled', type: 'checkbox', key: 'enabled', value: physics.enabled ?? false },
        { label: 'Mass', type: 'number', key: 'mass', value: physics.mass ?? 1, step: '0.1', min: '0' },
        { label: 'Collider', type: 'select', key: 'collider', value: physics.collider || 'auto', options: ['auto', 'box', 'sphere', 'cylinder', 'capsule'] },
        { label: 'Radius', type: 'number', key: 'radius', value: physics.radius ?? 0.5, step: '0.1', min: '0.01' },
        { label: 'Height', type: 'number', key: 'height', value: physics.height ?? 1, step: '0.1', min: '0.01' },
        { label: 'Linear damping', type: 'number', key: 'linearDamping', value: physics.linearDamping ?? 0.01, step: '0.01', min: '0', max: '1' },
        { label: 'Angular damping', type: 'number', key: 'angularDamping', value: physics.angularDamping ?? 0.01, step: '0.01', min: '0', max: '1' },
        { label: 'Impact SFX', type: 'select', key: 'impactSfx', value: physics.impactSfx || '', options: ['', ...listAudioFiles('sfx').map((file) => file.path)] },
        { label: 'Impact threshold', type: 'number', key: 'impactThreshold', value: physics.impactThreshold ?? 1.5, step: '0.1', min: '0' },
        { label: 'Impact cooldown', type: 'number', key: 'impactCooldown', value: physics.impactCooldown ?? 0.12, step: '0.01', min: '0' },
        { label: 'Velocity X', type: 'number', key: 'velocityX', value: physics.velocity?.[0] ?? 0, step: '0.1' },
        { label: 'Velocity Y', type: 'number', key: 'velocityY', value: physics.velocity?.[1] ?? 0, step: '0.1' },
        { label: 'Velocity Z', type: 'number', key: 'velocityZ', value: physics.velocity?.[2] ?? 0, step: '0.1' },
      ],
    },
  ];
  for (const group of propertyGroups) {
    const heading = document.createElement('p');
    heading.className = 'property-heading';
    heading.textContent = group.title;
    propertyFields.append(heading);
    for (const field of group.fields) {
      const row = document.createElement('label');
      row.className = 'property-row';
      const label = document.createElement('span');
      label.textContent = field.label;
      const input = field.type === 'select' ? document.createElement('select') : document.createElement('input');
      if (field.type !== 'select') input.type = field.type;
      if (field.type === 'select') field.options.forEach((option) => { const optionElement = document.createElement('option'); optionElement.value = option; optionElement.textContent = option; input.append(optionElement); });
      if (field.type === 'checkbox') input.checked = field.value;
      else input.value = field.value;
      if (field.step) input.step = field.step;
      if (field.min) input.min = field.min;
      if (field.max) input.max = field.max;
      const eventName = group.title === 'Material' && field.key !== 'type' ? 'input' : 'change';
      input.addEventListener(eventName, () => {
        const value = field.type === 'checkbox' ? input.checked : field.type === 'number' ? Number(input.value) : input.value;
        const physicsValues = { [field.key]: value };
        if (field.key === 'enabled' && value && !physics.mass) physicsValues.mass = 1;
        if (field.key === 'velocityX' || field.key === 'velocityY' || field.key === 'velocityZ') {
          physicsValues.velocity = [physics.velocity?.[0] || 0, physics.velocity?.[1] || 0, physics.velocity?.[2] || 0];
          physicsValues.velocity[field.key.slice(-1).charCodeAt(0) - 88] = value;
        }
        const properties = group.title === 'Material' ? { material: { [field.key]: value } } : { physics: physicsValues };
        sceneManager.updateObjectProperties(id, properties);
        if (group.title === 'Physics') rebuildPhysics();
        if (group.title === 'Material' && field.key === 'type' && (value === 'ShaderMaterial' || value === 'RawShaderMaterial')) {
          const shaderFiles = sceneAssets.createShaderFiles(`${objectJSON.name || id}-material`);
          sceneManager.updateObjectProperties(id, { material: { shaderFiles } });
        }
        renderJSON();
        if (eventName === 'change') selectObject(id);
      });
      row.append(label, input);
      propertyFields.append(row);
      if (group.title === 'Material' && field.key === 'type' && (material.type === 'ShaderMaterial' || material.type === 'RawShaderMaterial')) {
        const shaderControls = document.createElement('div');
        shaderControls.className = 'shader-controls';
        const shaderButton = document.createElement('button');
        shaderButton.className = 'shader-open-button';
        shaderButton.type = 'button';
        shaderButton.textContent = 'Open shader editor';
        shaderButton.addEventListener('click', () => openShaderEditor(id, shaderControls));
        shaderControls.append(shaderButton);
        propertyFields.append(shaderControls);
      }
    }
  }
  const scriptHeading = document.createElement('p');
  scriptHeading.className = 'property-heading';
  scriptHeading.textContent = 'Attached scripts';
  scriptAttachmentFields.append(scriptHeading);
  for (const script of scriptManager.getAttachments(sceneManager, id)) {
    const attached = document.createElement('button');
    attached.type = 'button';
    attached.className = 'attached-script';
    attached.textContent = `Remove ${script.path.split('/').at(-1)}`;
    attached.addEventListener('click', () => {
      scriptManager.detach(sceneManager, id, script.path);
      selectObject(id);
      renderJSON();
    });
    scriptAttachmentFields.append(attached);
  }
  const attach = document.createElement('button');
  attach.type = 'button';
  attach.className = 'attached-script';
  attach.textContent = 'Attach selected script';
  attach.disabled = scriptSelect.disabled;
  attach.addEventListener('click', () => {
    scriptManager.attach(sceneManager, id, scriptSelect.value);
    selectObject(id);
    renderJSON();
  });
  scriptAttachmentFields.append(attach);
}

function openShaderEditor(id, shaderControls) {
  const objectJSON = sceneManager.exportJSON().objects.find((entry) => entry.id === id);
  if (!objectJSON) return;
  const material = objectJSON.material || {};
  const shaderFiles = material.shaderFiles || sceneAssets.createShaderFiles(`${objectJSON.name || objectJSON.id}-material`);
  const vertexFile = sceneAssets.get(shaderFiles.vertexPath);
  const fragmentFile = sceneAssets.get(shaderFiles.fragmentPath);
  const vertexShader = vertexFile?.content || material.vertexShader || 'void main() {\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}';
  const fragmentShader = fragmentFile?.content || material.fragmentShader || 'void main() {\n  gl_FragColor = vec4(0.2, 0.6, 1.0, 1.0);\n}';
  if (vertexFile) vertexFile.content = vertexShader;
  if (fragmentFile) fragmentFile.content = fragmentShader;
  sceneManager.updateObjectProperties(id, { material: { shaderFiles, vertexShader, fragmentShader } });
  shaderControls.replaceChildren();
  const files = document.createElement('p');
  files.className = 'property-heading';
  files.textContent = `${shaderFiles.vertexPath} / ${shaderFiles.fragmentPath}`;
  shaderControls.append(files);
  addShaderEditor(shaderControls, 'Vertex shader', 'vertexShader', shaderFiles.vertexPath, vertexShader);
  addShaderEditor(shaderControls, 'Fragment shader', 'fragmentShader', shaderFiles.fragmentPath, fragmentShader);
  renderJSON();
}

function addShaderEditor(parent, labelText, key, path, value) {
  const heading = document.createElement('p');
  heading.className = 'property-heading';
  heading.textContent = labelText;
  const host = document.createElement('div');
  host.className = 'shader-editor-host';
  parent.append(heading, host);
  let model = shaderFileModels.get(path);
  if (!model) {
    model = monaco.editor.createModel(value, 'cpp', monaco.Uri.parse(`inmemory://3ditorjs/${path}`));
    shaderFileModels.set(path, model);
  } else {
    model.setValue(value);
    monaco.editor.setModelLanguage(model, 'cpp');
  }
  const editor = monaco.editor.create(host, { ...editorOptions, language: 'cpp', minimap: { enabled: false }, model });
  addFullscreenControl(host, labelText);
  editor.onDidChangeModelContent(() => {
    if (!selectedId) return;
    const source = editor.getValue();
    const file = sceneAssets.get(path);
    if (file) file.content = source;
    sceneManager.updateObjectProperties(selectedId, { material: { [key]: source } });
    const mesh = sceneManager.getMesh(selectedId);
    mesh.material.needsUpdate = true;
    renderJSON();
  });
}

selectionLabel.addEventListener('blur', () => {
  if (!activeSelection || activeSelection.type === 'camera' && !activeSelection.id) return;
  sceneManager.renameSceneItem(activeSelection.type, activeSelection.id, selectionLabel.textContent);
  renderObjectList();
  renderJSON();
  if (activeSelection.type === 'object') selectObject(activeSelection.id);
  else if (activeSelection.type === 'light') selectLight(activeSelection.id);
  else if (activeSelection.type === 'spline') selectSpline(activeSelection.id);
  else if (activeSelection.type === 'cutscene') selectCutscene(activeSelection.id);
  else if (activeSelection.type === 'camera') selectSceneCamera(activeSelection.id);
});

selectionLabel.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  selectionLabel.blur();
});

function duplicateSelected() {
  if (activeSelection?.type !== 'object') return;
  const source = sceneManager.exportJSON().objects.find((entry) => entry.id === selectedId);
  if (!source) return;
  const name = nextName(source.type);
  const duplicate = {
    id: `${source.type}_${Date.now()}`,
    name,
    position: source.position.map((value, index) => value + (index === 0 ? 1 : 0)),
    material: { ...source.material, color: shiftedColor(source.material?.color || '#ffffff') },
  };
  sceneManager.duplicateObject(selectedId, duplicate);
  rebuildPhysics();
  renderObjectList();
  selectObject(duplicate.id);
  renderJSON();
}

function shiftedColor(color) {
  const shifted = new THREE.Color(color);
  shifted.offsetHSL(0.16, 0, 0);
  return `#${shifted.getHexString()}`;
}

function updateTransformFields(mesh) {
  const valuesByAxis = {
    position: mesh.position.toArray(),
    rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
    scale: mesh.scale.toArray(),
  };
  for (const [axis, values] of Object.entries(valuesByAxis)) {
    values.forEach((value, index) => {
      const input = transformFields.querySelector(`[aria-label="${axis} ${'xyz'[index]}"]`);
      if (input) input.value = value.toFixed(2);
    });
  }
}

function selectCamera() {
  selectedId = null;
  activeSelection = { type: 'camera' };
  selectionLabel.contentEditable = 'true';
  sceneDeleteObject.disabled = true;
  transformControls.detach();
  splineEditor.detachGizmo();
  transformControls.attach(camera);
  selectionLabel.textContent = 'Editor Camera';
  transformFields.replaceChildren();
  propertyFields.replaceChildren();
  scenePropertyFields.replaceChildren();
  animationPropertyFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  addVectorFields(scenePropertyFields, 'Camera position', camera.position.toArray(), (values) => {
    camera.position.fromArray(values);
    sceneManager.updateCamera({ position: values });
    renderJSON();
  });
  addVectorFields(scenePropertyFields, 'Camera target', controls.target.toArray(), (values) => {
    controls.target.fromArray(values);
    camera.lookAt(controls.target);
    sceneManager.updateCamera({ target: values });
    renderJSON();
  });
}

function selectSceneCamera(id) {
  const sceneCamera = sceneCameras.get(id);
  const cameraJSON = sceneManager.exportJSON().cameras?.find((entry) => entry.id === id);
  if (!sceneCamera || !cameraJSON) return;
  selectedId = null;
  activeSelection = { type: 'camera', id };
  selectionLabel.contentEditable = 'true';
  sceneDeleteObject.disabled = false;
  sceneDuplicateObject.disabled = true;
  transformControls.detach();
  splineEditor.detachGizmo();
  transformControls.attach(sceneCamera);
  selectionLabel.textContent = cameraJSON.name;
  transformFields.replaceChildren();
  propertyFields.replaceChildren();
  scenePropertyFields.replaceChildren();
  animationPropertyFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  addVectorFields(scenePropertyFields, 'Scene camera position', sceneCamera.position.toArray(), (values) => {
    sceneCamera.position.fromArray(values);
    sceneManager.updateCameraById(id, { position: values });
    sceneCamera.userData.helper.update();
    renderJSON();
  });
  const attachmentRow = document.createElement('label');
  attachmentRow.className = 'property-row';
  const attachmentLabel = document.createElement('span');
  attachmentLabel.textContent = 'Attach to';
  const attachmentSelect = document.createElement('select');
  const detachedOption = document.createElement('option');
  detachedOption.value = '';
  detachedOption.textContent = 'None';
  attachmentSelect.append(detachedOption);
  for (const objectJSON of sceneManager.exportJSON().objects.filter((entry) => entry.type !== 'plane')) {
    const option = document.createElement('option');
    option.value = objectJSON.id;
    option.textContent = objectJSON.name;
    attachmentSelect.append(option);
  }
  attachmentSelect.value = cameraJSON.parent || '';
  attachmentSelect.addEventListener('change', () => {
    const parent = attachmentSelect.value ? sceneManager.getMesh(attachmentSelect.value) : scene;
    if (!parent) return;
    parent.attach(sceneCamera);
    sceneManager.attachCamera(id, attachmentSelect.value || null);
    sceneManager.updateCameraById(id, { position: sceneCamera.position.toArray() });
    renderJSON();
  });
  attachmentRow.append(attachmentLabel, attachmentSelect);
  scenePropertyFields.append(attachmentRow);
}

function selectLight(id) {
  selectedId = null;
  activeSelection = { type: 'light', id };
  selectionLabel.contentEditable = 'true';
  sceneDeleteObject.disabled = id === 'ambient-01';
  transformControls.detach();
  splineEditor.detachGizmo();
  const lightJSON = sceneManager.exportJSON().lights?.find((entry) => entry.id === id);
  const light = sceneLights.get(id);
  selectionLabel.textContent = lightJSON?.name || lightJSON?.id || 'Light';
  transformFields.replaceChildren();
  propertyFields.replaceChildren();
  scenePropertyFields.replaceChildren();
  animationPropertyFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  if (!lightJSON || !light) return;
  if (lightJSON.type === 'directional') transformControls.attach(light);
  addNumberField(scenePropertyFields, 'Intensity', light.intensity, (value) => {
    light.intensity = value;
    sceneManager.updateLight(id, { intensity: value });
    renderJSON();
  });
  if (lightJSON.type === 'directional') addVectorFields(scenePropertyFields, 'Light position', light.position.toArray(), (values) => {
    light.position.fromArray(values);
    sceneManager.updateLight(id, { position: values });
    renderJSON();
  });
}

function addNumberField(parent, labelText, value, onInput) {
  const row = document.createElement('label');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.textContent = labelText;
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.1';
  input.value = value;
  input.addEventListener('input', () => onInput(Number(input.value) || 0));
  row.append(label, input);
  parent.append(row);
}

function addTextField(parent, labelText, value, onInput) {
  const row = document.createElement('label');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.textContent = labelText;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.addEventListener('change', () => onInput(input.value.trim()));
  row.append(label, input);
  parent.append(row);
}

function addCheckboxField(parent, labelText, checked, onInput) {
  const row = document.createElement('label');
  row.className = 'display-toggle';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onInput(input.checked));
  const label = document.createElement('span');
  label.textContent = labelText;
  row.append(input, label);
  parent.append(row);
}

function addSelectField(parent, labelText, value, options, onInput) {
  const row = document.createElement('label');
  row.className = 'property-row';
  const label = document.createElement('span');
  label.textContent = labelText;
  const select = document.createElement('select');
  for (const optionData of options) {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.append(option);
  }
  select.value = value || '';
  select.addEventListener('change', () => onInput(select.value));
  row.append(label, select);
  parent.append(row);
}

function addVectorFields(parent, labelText, values, onInput) {
  const heading = document.createElement('p');
  heading.className = 'property-heading';
  heading.textContent = labelText;
  parent.append(heading);
  const row = document.createElement('div');
  row.className = 'transform-row';
  row.dataset.vectorField = labelText;
  const label = document.createElement('span');
  label.textContent = 'xyz';
  row.append(label);
  values.forEach((value) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.1';
    input.value = value.toFixed(2);
    input.addEventListener('input', () => onInput([...row.querySelectorAll('input')].map((entry) => Number(entry.value) || 0)));
    row.append(input);
  });
  parent.append(row);
}

function addTriggerTransformFields(labelText, gizmoModeName, values, onInput) {
  const row = document.createElement('div');
  row.className = 'transform-row';
  row.dataset.vectorField = labelText;
  const label = document.createElement('button');
  label.type = 'button';
  label.dataset.gizmoMode = gizmoModeName;
  label.setAttribute('aria-pressed', String(gizmoMode === gizmoModeName));
  label.textContent = labelText;
  label.addEventListener('click', () => setGizmoMode(gizmoModeName));
  row.append(label);
  values.forEach((value) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.1';
    input.value = value.toFixed(2);
    input.addEventListener('input', () => onInput([...row.querySelectorAll('input')].map((entry) => Number(entry.value) || 0)));
    row.append(input);
  });
  transformFields.append(row);
}

function updateVectorFields(parent, labelText, values) {
  const row = parent.querySelector(`[data-vector-field="${labelText}"]`);
  if (!row) return;
  row.querySelectorAll('input').forEach((input, index) => {
    input.value = values[index].toFixed(2);
  });
}

function addColliderTransformFields(labelText, gizmoModeName, values, onInput) {
  const row = document.createElement('div');
  row.className = 'transform-row';
  row.dataset.vectorField = labelText;
  const label = document.createElement('button');
  label.type = 'button';
  label.dataset.gizmoMode = gizmoModeName;
  label.setAttribute('aria-pressed', String(gizmoMode === gizmoModeName));
  label.textContent = labelText;
  label.addEventListener('click', () => setGizmoMode(gizmoModeName));
  row.append(label);
  values.forEach((value) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.1';
    input.value = value.toFixed(2);
    input.addEventListener('change', () => onInput([...row.querySelectorAll('input')].map((entry) => Number(entry.value) || 0)));
    row.append(input);
  });
  transformFields.append(row);
}

function selectSpline(id) {
  const spline = sceneManager.exportJSON().splines?.find((entry) => entry.id === id);
  if (!spline) return;
  activeSplineId = id;
  selectedId = null;
  activeSelection = { type: 'spline', id };
  sceneDeleteObject.disabled = true;
  sceneDuplicateObject.disabled = true;
  transformControls.detach();
  splineEditor.load(spline.points);
  splineEditor.setVisible(true);
  splineToggle.checked = true;
  selectionLabel.contentEditable = 'false';
  selectionLabel.textContent = spline.name || spline.id;
  transformFields.replaceChildren();
  propertyFields.replaceChildren();
  scenePropertyFields.replaceChildren();
  animationPropertyFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  const heading = document.createElement('p');
  heading.className = 'property-heading';
  heading.textContent = 'Spline points';
  animationPropertyFields.append(heading);
  const addPoint = document.createElement('button');
  addPoint.className = 'cutscene-button';
  addPoint.type = 'button';
  addPoint.textContent = 'Add point';
  addPoint.addEventListener('click', () => {
    const last = spline.points.at(-1) || [0, 2, 0];
    sceneManager.addSplinePoint(id, [last[0] + 2, last[1], last[2]]);
    splineEditor.load(sceneManager.exportJSON().splines.find((entry) => entry.id === id).points);
    renderJSON();
  });
  animationPropertyFields.append(addPoint);
  spline.points.forEach((point, index) => {
    const removePoint = document.createElement('button');
    removePoint.className = 'cutscene-button';
    removePoint.type = 'button';
    removePoint.textContent = `Remove point ${index + 1}`;
    removePoint.addEventListener('click', () => {
      if (sceneManager.removeSplinePoint(id, index)) {
        selectSpline(id);
        renderJSON();
      }
    });
    animationPropertyFields.append(removePoint);
  });
}

function renderCutsceneSelect() {
  const current = activeCutsceneId;
  cutsceneSelect.replaceChildren();
  for (const cutscene of sceneManager.exportJSON().cutscenes || []) {
    const option = document.createElement('option');
    option.value = cutscene.id;
    option.textContent = cutscene.name || cutscene.id;
    option.selected = cutscene.id === current;
    cutsceneSelect.append(option);
  }
  cutsceneSelect.disabled = cutsceneSelect.options.length === 0;
}

function selectCutscene(id) {
  const cutscene = sceneManager.exportJSON().cutscenes?.find((entry) => entry.id === id);
  if (!cutscene) return;
  selectedId = null;
  activeSelection = { type: 'cutscene', id };
  activeCutsceneId = id;
  renderCutsceneSelect();
  sceneDeleteObject.disabled = false;
  sceneDuplicateObject.disabled = true;
  transformControls.detach();
  splineEditor.detachGizmo();
  selectionLabel.contentEditable = 'true';
  selectionLabel.textContent = cutscene.name || cutscene.id;
  transformFields.replaceChildren();
  propertyFields.replaceChildren();
  scenePropertyFields.replaceChildren();
  animationPropertyFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  addNumberField(animationPropertyFields, 'Duration', cutscene.duration, (value) => {
    sceneManager.updateCutscene(id, { duration: value });
    cutsceneManager.registerCutscene({ ...cutscene, duration: value });
    renderJSON();
  });
  const cueHeading = document.createElement('p');
  cueHeading.className = 'property-heading';
  cueHeading.textContent = 'Sound cues';
  animationPropertyFields.append(cueHeading);
  const cueTime = document.createElement('input');
  cueTime.type = 'number';
  cueTime.min = '0';
  cueTime.max = String(cutscene.duration);
  cueTime.step = '0.1';
  cueTime.value = '0';
  cueTime.setAttribute('aria-label', 'Sound cue time');
  const cueSound = document.createElement('select');
  cueSound.setAttribute('aria-label', 'Sound cue effect');
  for (const file of listAudioFiles('sfx')) {
    const option = document.createElement('option');
    option.value = file.path;
    option.textContent = file.path.split('/').at(-1);
    cueSound.append(option);
  }
  const addCue = document.createElement('button');
  addCue.type = 'button';
  addCue.className = 'cutscene-button';
  addCue.textContent = 'Add sound cue';
  addCue.disabled = cueSound.options.length === 0;
  addCue.addEventListener('click', () => {
    const event = { id: `audio_cue_${Date.now()}`, type: 'audio', time: Number(cueTime.value) || 0, path: cueSound.value, volume: 0.8, radius: 12 };
    const events = [...(cutscene.events || []), event];
    sceneManager.updateCutscene(id, { events });
    cutsceneManager.registerCutscene({ ...cutscene, events });
    selectCutscene(id);
    renderJSON();
  });
  const cueForm = document.createElement('div');
  cueForm.className = 'cutscene-buttons';
  cueForm.append(cueTime, cueSound, addCue);
  animationPropertyFields.append(cueForm);
  (cutscene.events || []).filter((event) => event.type === 'audio').forEach((event) => {
    const removeCue = document.createElement('button');
    removeCue.type = 'button';
    removeCue.className = 'cutscene-button';
    removeCue.textContent = `Remove ${event.path.split('/').at(-1)} at ${event.time}s`;
    removeCue.addEventListener('click', () => {
      const events = cutscene.events.filter((entry) => entry.id !== event.id);
      sceneManager.updateCutscene(id, { events });
      cutsceneManager.registerCutscene({ ...cutscene, events });
      selectCutscene(id);
      renderJSON();
    });
    animationPropertyFields.append(removeCue);
  });
  const track = cutscene.tracks?.find((entry) => entry.type === 'spline');
  const spline = sceneManager.exportJSON().splines?.find((entry) => entry.id === track?.path);
  if (spline) {
    activeSplineId = spline.id;
    spline.points.forEach((point, index) => {
      const removePoint = document.createElement('button');
      removePoint.className = 'cutscene-button';
      removePoint.type = 'button';
      removePoint.textContent = `Remove point ${index + 1}`;
      removePoint.addEventListener('click', () => {
        if (sceneManager.removeSplinePoint(spline.id, index)) {
          selectCutscene(id);
          splineEditor.load(sceneManager.exportJSON().splines.find((entry) => entry.id === spline.id).points);
          renderJSON();
        }
      });
      animationPropertyFields.append(removePoint);
    });
    const addPoint = document.createElement('button');
    addPoint.className = 'cutscene-button';
    addPoint.type = 'button';
    addPoint.textContent = 'Add point';
    addPoint.addEventListener('click', () => {
      const last = spline.points.at(-1) || [0, 2, 0];
      sceneManager.addSplinePoint(spline.id, [last[0] + 2, last[1], last[2]]);
      splineEditor.load(sceneManager.exportJSON().splines.find((entry) => entry.id === spline.id).points);
      selectCutscene(id);
      renderJSON();
    });
    animationPropertyFields.append(addPoint);
    splineEditor.load(spline.points);
    splineEditor.setVisible(splineToggle.checked);
  }
}

function addTriggerArea(type) {
  const id = `trigger_${Date.now()}`;
  const trigger = {
    id,
    name: `${type === 'sphere' ? 'Sphere' : 'Box'} Trigger`,
    type,
    position: [0, 1, 0],
    size: type === 'sphere' ? [3, 3, 3] : [3, 2, 3],
    action: '',
    params: {},
  };
  sceneManager.addTrigger(trigger);
  triggerManager.registerTrigger(trigger);
  triggerManager.setVisible(true);
  triggerToggle.checked = true;
  renderObjectList();
  selectTrigger(id);
  renderJSON();
}

function updateTriggerArea(id, settings) {
  sceneManager.updateTrigger(id, settings);
  const trigger = sceneManager.exportJSON().triggers.find((entry) => entry.id === id);
  triggerManager.updateTrigger(trigger);
  renderJSON();
}

function updateColliderSpec(id, colliderIndex, patch) {
  if (colliderIndex === null) {
    sceneManager.updateObjectProperties(id, { physics: patch });
  } else {
    const objectJSON = sceneManager.exportJSON().objects.find((entry) => entry.id === id);
    const extras = [...(objectJSON.physics.extraColliders || [])];
    extras[colliderIndex] = { ...extras[colliderIndex], ...patch };
    sceneManager.updateObjectProperties(id, { physics: { extraColliders: extras } });
  }
  rebuildPhysics();
  if (activeSelection?.type === 'collider' && activeSelection.id === id && activeSelection.colliderIndex === colliderIndex) selectCollider(id, colliderIndex);
  renderJSON();
}

function addExtraCollider(id) {
  const objectJSON = sceneManager.exportJSON().objects.find((entry) => entry.id === id);
  if (!objectJSON?.physics?.enabled) return;
  const extras = [...(objectJSON.physics.extraColliders || []), { collider: 'box', size: [0.5, 0.5, 0.5], position: [0, 0, 0] }];
  sceneManager.updateObjectProperties(id, { physics: { extraColliders: extras } });
  rebuildPhysics();
  selectCollider(id, extras.length - 1);
  renderJSON();
}

function removeExtraCollider(id, colliderIndex) {
  const objectJSON = sceneManager.exportJSON().objects.find((entry) => entry.id === id);
  const extras = (objectJSON.physics.extraColliders || []).filter((_, index) => index !== colliderIndex);
  sceneManager.updateObjectProperties(id, { physics: { extraColliders: extras } });
  rebuildPhysics();
  selectCollider(id, null);
  renderJSON();
}

function selectCollider(id, colliderIndex = null) {
  const objectJSON = sceneManager.exportJSON().objects.find((entry) => entry.id === id);
  const mesh = sceneManager.getMesh(id);
  const helper = getColliderHelper(id, colliderIndex);
  if (!objectJSON || !mesh || !helper) return;
  selectedId = null;
  activeSelection = { type: 'collider', id, colliderIndex };
  sceneDeleteObject.disabled = true;
  sceneDuplicateObject.disabled = true;
  transformControls.detach();
  splineEditor.detachGizmo();
  transformControls.attach(helper);
  selectionLabel.contentEditable = 'false';
  selectionLabel.textContent = `${objectJSON.name || id} \u2013 ${colliderIndex === null ? 'primary collider' : `collider ${colliderIndex + 2}`}`;
  transformFields.replaceChildren();
  propertyFields.replaceChildren();
  scenePropertyFields.replaceChildren();
  animationPropertyFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  if (gizmoMode !== 'translate' && gizmoMode !== 'scale') setGizmoMode('translate');

  const spec = getColliderSpec(objectJSON, colliderIndex);
  const resolvedPhysics = colliderIndex === null ? resolveColliderOptions(objectJSON, mesh, spec) : spec;
  const effective = computeEffectiveColliderDims(mesh, resolvedPhysics);
  addColliderTransformFields('Position', 'translate', helper.position.toArray(), (position) => {
    helper.position.fromArray(position);
    if (colliderIndex === null) {
      updateColliderSpec(id, null, { position });
    } else {
      const scale = mesh.scale.toArray();
      const localOffset = position.map((value, index) => (value - mesh.position.toArray()[index]) / (scale[index] || 1));
      updateColliderSpec(id, colliderIndex, { position: localOffset });
    }
  });
  if (resolvedPhysics.collider === 'box') {
    addColliderTransformFields('Size', 'scale', effective.size, (size) => {
      const base = baseColliderDimsFromEffective(mesh, 'box', { size });
      updateColliderSpec(id, colliderIndex, { collider: 'box', size: base.size });
    });
  } else if (resolvedPhysics.collider === 'sphere') {
    addColliderTransformFields('Radius', 'scale', [effective.radius], ([radius]) => {
      const base = baseColliderDimsFromEffective(mesh, 'sphere', { radius });
      updateColliderSpec(id, colliderIndex, { collider: 'sphere', radius: base.radius });
    });
  } else {
    addColliderTransformFields('Radius / height', 'scale', [effective.radius, effective.height], ([radius, height]) => {
      const base = baseColliderDimsFromEffective(mesh, resolvedPhysics.collider, { radius, height });
      updateColliderSpec(id, colliderIndex, { collider: resolvedPhysics.collider, ...base });
    });
  }
  setGizmoMode(gizmoMode);

  const listHeading = document.createElement('p');
  listHeading.className = 'property-heading';
  listHeading.textContent = 'Colliders on this object';
  propertyFields.append(listHeading);
  const list = document.createElement('div');
  list.className = 'collider-list';
  const primaryButton = document.createElement('button');
  primaryButton.type = 'button';
  primaryButton.className = 'attached-script';
  primaryButton.textContent = 'Primary collider';
  primaryButton.classList.toggle('is-active', colliderIndex === null);
  primaryButton.addEventListener('click', () => selectCollider(id, null));
  list.append(primaryButton);
  (objectJSON.physics.extraColliders || []).forEach((_, index) => {
    const extraButton = document.createElement('button');
    extraButton.type = 'button';
    extraButton.className = 'attached-script';
    extraButton.textContent = `Collider ${index + 2}`;
    extraButton.classList.toggle('is-active', colliderIndex === index);
    extraButton.addEventListener('click', () => selectCollider(id, index));
    list.append(extraButton);
  });
  propertyFields.append(list);
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'attached-script';
  addButton.textContent = '+ Add collider';
  addButton.addEventListener('click', () => addExtraCollider(id));
  propertyFields.append(addButton);
  if (colliderIndex !== null) {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'attached-script';
    removeButton.textContent = 'Remove this collider';
    removeButton.addEventListener('click', () => removeExtraCollider(id, colliderIndex));
    propertyFields.append(removeButton);
  }

  const heading = document.createElement('p');
  heading.className = 'property-heading';
  heading.textContent = 'Physics collider';
  propertyFields.append(heading);
  addSelectField(
    propertyFields,
    'Collider shape',
    spec.collider || 'auto',
    (colliderIndex === null ? ['auto', 'box', 'sphere', 'cylinder', 'capsule'] : ['box', 'sphere', 'cylinder', 'capsule']).map((value) => ({ value, label: value })),
    (collider) => updateColliderSpec(id, colliderIndex, { collider }),
  );
  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'attached-script';
  backButton.textContent = 'Select mesh instead';
  backButton.addEventListener('click', () => selectObject(id));
  propertyFields.append(backButton);
}

const colliderContextMenu = document.createElement('div');
colliderContextMenu.className = 'collider-context-menu';
colliderContextMenu.hidden = true;
document.body.append(colliderContextMenu);

function hideColliderContextMenu() {
  colliderContextMenu.hidden = true;
}

function showColliderContextMenu(x, y, id, colliderIndex) {
  colliderContextMenu.replaceChildren();
  colliderContextMenu.style.left = `${x}px`;
  colliderContextMenu.style.top = `${y}px`;
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.textContent = 'Add collider';
  addButton.addEventListener('click', () => {
    addExtraCollider(id);
    hideColliderContextMenu();
  });
  colliderContextMenu.append(addButton);
  if (colliderIndex !== null) {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove this collider';
    removeButton.addEventListener('click', () => {
      removeExtraCollider(id, colliderIndex);
      hideColliderContextMenu();
    });
    colliderContextMenu.append(removeButton);
  }
  colliderContextMenu.hidden = false;
}

window.addEventListener('pointerdown', (event) => {
  if (!colliderContextMenu.hidden && !colliderContextMenu.contains(event.target)) hideColliderContextMenu();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hideColliderContextMenu();
});

function selectTrigger(id) {
  const trigger = sceneManager.exportJSON().triggers?.find((entry) => entry.id === id);
  if (!trigger) return;
  selectedId = null;
  activeSelection = { type: 'trigger', id };
  sceneDeleteObject.disabled = false;
  sceneDuplicateObject.disabled = true;
  transformControls.detach();
  splineEditor.detachGizmo();
  const triggerRuntime = triggerManager.triggers.get(id);
  if (triggerRuntime) transformControls.attach(triggerRuntime.helper);
  selectionLabel.contentEditable = 'true';
  selectionLabel.textContent = trigger.name || trigger.id;
  transformFields.replaceChildren();
  propertyFields.replaceChildren();
  scenePropertyFields.replaceChildren();
  animationPropertyFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  if (gizmoMode !== 'translate' && gizmoMode !== 'scale') setGizmoMode('translate');
  addTriggerTransformFields('Position', 'translate', trigger.position, (position) => updateTriggerArea(id, { position }));
  addTriggerTransformFields('Size', 'scale', trigger.size, (size) => updateTriggerArea(id, { size }));
  setGizmoMode(gizmoMode);
  const heading = document.createElement('p');
  heading.className = 'property-heading';
  heading.textContent = trigger.type === 'sphere' ? 'Sphere area' : 'Box area';
  propertyFields.append(heading);
  const actionRow = document.createElement('label');
  actionRow.className = 'property-row';
  const actionLabel = document.createElement('span');
  actionLabel.textContent = 'On enter';
  const actionSelect = document.createElement('select');
  for (const [value, label] of [['', 'No action'], ['playCutscene', 'Play cutscene'], ['playSfx', 'Play sound effect']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = trigger.action === value;
    actionSelect.append(option);
  }
  actionSelect.addEventListener('change', () => {
    updateTriggerArea(id, { action: actionSelect.value, params: {} });
    selectTrigger(id);
  });
  actionRow.append(actionLabel, actionSelect);
  propertyFields.append(actionRow);
  if (trigger.action === 'playCutscene') {
    const cutscenes = (sceneManager.exportJSON().cutscenes || []).map((cutscene) => ({ value: cutscene.id, label: cutscene.name || cutscene.id }));
    addSelectField(propertyFields, 'Cutscene', trigger.params?.cutsceneId, cutscenes, (cutsceneId) => updateTriggerArea(id, { params: { cutsceneId } }));
  }
  if (trigger.action === 'playSfx') {
    const effects = listAudioFiles('sfx').map((file) => ({ value: file.path, label: file.path.split('/').at(-1) }));
    addSelectField(propertyFields, 'Sound effect', trigger.params?.path, effects, (path) => updateTriggerArea(id, { params: { path } }));
  }
}

function selectAudioEmitter(id) {
  const emitter = sceneManager.exportJSON().audio?.emitters?.find((entry) => entry.id === id);
  const helper = audioHelpers.get(id);
  if (!emitter || !helper) return;
  selectedId = null;
  activeSelection = { type: 'audio', id };
  sceneDeleteObject.disabled = false;
  sceneDuplicateObject.disabled = true;
  transformControls.detach();
  splineEditor.detachGizmo();
  transformControls.attach(helper);
  selectionLabel.contentEditable = 'true';
  selectionLabel.textContent = emitter.name || emitter.id;
  transformFields.replaceChildren();
  propertyFields.replaceChildren();
  scenePropertyFields.replaceChildren();
  animationPropertyFields.replaceChildren();
  scriptAttachmentFields.replaceChildren();
  addVectorFields(propertyFields, 'Position', emitter.position, (position) => updateAudioEmitter(id, { position }));
  addNumberField(propertyFields, 'Volume', emitter.volume ?? 1, (volume) => updateAudioEmitter(id, { volume }));
  addNumberField(propertyFields, 'Radius', emitter.radius ?? 12, (radius) => updateAudioEmitter(id, { radius }));
  addSelectField(propertyFields, 'Sound effect', emitter.path, listAudioFiles('sfx').map((file) => ({ value: file.path, label: file.path.split('/').at(-1) })), (path) => updateAudioEmitter(id, { path }));
  addCheckboxField(propertyFields, 'Loop sound', emitter.loop !== false, (loop) => updateAudioEmitter(id, { loop }));
  addCheckboxField(propertyFields, 'Autoplay after interaction', emitter.autoplay !== false, (autoplay) => updateAudioEmitter(id, { autoplay }));
  const preview = document.createElement('div');
  preview.className = 'cutscene-buttons';
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'cutscene-button';
  play.textContent = 'Play sound';
  play.addEventListener('click', () => audioManager.playEmitter(id));
  const stop = document.createElement('button');
  stop.type = 'button';
  stop.className = 'cutscene-button';
  stop.textContent = 'Stop sound';
  stop.addEventListener('click', () => audioManager.stopEmitter(id));
  preview.append(play, stop);
  propertyFields.append(preview);
}

function updateAudioEmitter(id, settings) {
  sceneManager.updateAudioEmitter(id, settings);
  rebuildAudio();
  if (activeSelection?.type === 'audio' && activeSelection.id === id) transformControls.attach(audioHelpers.get(id));
  renderJSON();
}

function renderObjectList() {
  objectList.replaceChildren();
  const cameraButton = document.createElement('button');
  cameraButton.type = 'button';
  cameraButton.className = 'object-entry scene-node';
  cameraButton.textContent = 'Camera';
  cameraButton.addEventListener('click', selectCamera);
  objectList.append(cameraButton);
  for (const cameraJSON of sceneManager.exportJSON().cameras || []) {
    const sceneCameraButton = document.createElement('button');
    sceneCameraButton.type = 'button';
    sceneCameraButton.className = 'object-entry scene-node';
    sceneCameraButton.textContent = cameraJSON.name;
    sceneCameraButton.addEventListener('click', () => selectSceneCamera(cameraJSON.id));
    objectList.append(sceneCameraButton);
  }
  for (const lightJSON of sceneManager.exportJSON().lights || []) {
    const lightButton = document.createElement('button');
    lightButton.type = 'button';
    lightButton.className = 'object-entry scene-node';
    lightButton.textContent = lightJSON.name || lightJSON.id;
    lightButton.addEventListener('click', () => selectLight(lightJSON.id));
    objectList.append(lightButton);
  }
  const linkedSplineIds = new Set((sceneManager.exportJSON().cutscenes || []).flatMap((cutscene) => (cutscene.tracks || []).map((track) => track.path)));
  for (const spline of (sceneManager.exportJSON().splines || []).filter((entry) => !linkedSplineIds.has(entry.id))) {
    const splineButton = document.createElement('button');
    splineButton.type = 'button';
    splineButton.className = 'object-entry scene-node';
    splineButton.textContent = `Spline: ${spline.name || spline.id}`;
    splineButton.addEventListener('click', () => selectSpline(spline.id));
    objectList.append(splineButton);
  }
  for (const cutscene of sceneManager.exportJSON().cutscenes || []) {
    const cutsceneButton = document.createElement('button');
    cutsceneButton.type = 'button';
    cutsceneButton.className = 'object-entry scene-node';
    cutsceneButton.textContent = `Cutscene: ${cutscene.name || cutscene.id}`;
    cutsceneButton.addEventListener('click', () => selectCutscene(cutscene.id));
    objectList.append(cutsceneButton);
  }
  for (const trigger of sceneManager.exportJSON().triggers || []) {
    const triggerButton = document.createElement('button');
    triggerButton.type = 'button';
    triggerButton.className = 'object-entry scene-node';
    triggerButton.classList.toggle('is-selected', activeSelection?.type === 'trigger' && activeSelection.id === trigger.id);
    triggerButton.textContent = `Trigger: ${trigger.name || trigger.id}`;
    triggerButton.addEventListener('click', () => selectTrigger(trigger.id));
    objectList.append(triggerButton);
  }
  for (const emitter of sceneManager.exportJSON().audio?.emitters || []) {
    const emitterButton = document.createElement('button');
    emitterButton.type = 'button';
    emitterButton.className = 'object-entry scene-node';
    emitterButton.textContent = `Audio: ${emitter.name || emitter.id}`;
    emitterButton.addEventListener('click', () => selectAudioEmitter(emitter.id));
    objectList.append(emitterButton);
  }
  for (const objectJSON of sceneManager.exportJSON().objects) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'object-entry';
    button.classList.toggle('is-selected', activeSelection?.type === 'object' && activeSelection.id === objectJSON.id);
    button.textContent = objectJSON.name;
    button.addEventListener('click', () => selectObject(objectJSON.id));
    objectList.append(button);
  }
}

function deleteSelectedSceneItem() {
  if (!activeSelection || !['object', 'light', 'cutscene', 'trigger', 'audio'].includes(activeSelection.type)) return;
  if (activeSelection.type === 'light' && activeSelection.id === 'ambient-01') return;
  if (!window.confirm('Delete the selected scene item?')) return;
  if (activeSelection?.type === 'object') {
    sceneManager.removeObject(activeSelection.id);
  } else if (activeSelection?.type === 'light' && activeSelection.id !== 'ambient-01') {
    const helper = lightHelpers.get(activeSelection.id);
    helper?.removeFromParent();
    helper?.dispose?.();
    lightHelpers.delete(activeSelection.id);
    sceneLights.get(activeSelection.id)?.removeFromParent();
    sceneLights.delete(activeSelection.id);
    sceneManager.removeLight(activeSelection.id);
  } else if (activeSelection?.type === 'cutscene') {
    cutsceneManager.cutscenes.delete(activeSelection.id);
    const cutscene = sceneManager.exportJSON().cutscenes.find((entry) => entry.id === activeSelection.id);
    sceneManager.removeCutscene(activeSelection.id);
    for (const track of cutscene?.tracks || []) cutsceneManager.splines.delete(track.path);
    activeCutsceneId = null;
  } else if (activeSelection?.type === 'trigger') {
    triggerManager.unregisterTrigger(activeSelection.id);
    sceneManager.removeTrigger(activeSelection.id);
  } else if (activeSelection?.type === 'audio') {
    sceneManager.removeAudioEmitter(activeSelection.id);
    rebuildAudio();
  } else {
    return;
  }
  rebuildPhysics();
  renderObjectList();
  selectObject(sceneManager.exportJSON().objects[0]?.id || null);
  renderJSON();
}

function showObjectModal() {
  objectModal.hidden = false;
  objectModalStatus.textContent = '';
}

function hideObjectModal() {
  objectModal.hidden = true;
}

function nextName(type) {
  const labels = { box: 'Box', sphere: 'Sphere', cylinder: 'Cylinder', cone: 'Cone', torus: 'Torus', model: 'Model', 'directional-light': 'Directional Light', 'point-light': 'Point Light' };
  const base = labels[type] || type.replace('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const names = [
    ...(sceneManager.exportJSON().objects || []).map((objectJSON) => objectJSON.name),
    ...(sceneManager.exportJSON().lights || []).map((lightJSON) => lightJSON.name || lightJSON.id),
  ];
  let index = 1;
  while (names.includes(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

function addSceneObject(type) {
  if (type === 'audio-emitter') {
    const sound = listAudioFiles('sfx')[0];
    if (!sound) {
      objectModalStatus.textContent = 'Upload a sound effect in audio/sfx before adding an emitter.';
      return;
    }
    const emitter = { id: `audio_${Date.now()}`, name: 'Audio Emitter', path: sound.path, position: [0, 1, 0], volume: 0.8, radius: 12, loop: true, autoplay: true };
    sceneManager.addAudioEmitter(emitter);
    rebuildAudio();
    renderObjectList();
    selectAudioEmitter(emitter.id);
    renderJSON();
    hideObjectModal();
    return;
  }
  if (type === 'box-trigger' || type === 'sphere-trigger') {
    addTriggerArea(type === 'sphere-trigger' ? 'sphere' : 'box');
    hideObjectModal();
    return;
  }
  if (type === 'directional-light' || type === 'point-light') {
    const id = `${type.replace('-', '_')}_${Date.now()}`;
    const lightJSON = {
      id,
      name: nextName(type),
      type: type === 'point-light' ? 'point' : 'directional',
      color: '#ffffff',
      intensity: 2,
      position: [2, 4, 2],
      castShadow: false,
    };
    sceneManager.addLight(lightJSON);
    const light = type === 'point-light'
      ? new THREE.PointLight(lightJSON.color, lightJSON.intensity)
      : new THREE.DirectionalLight(lightJSON.color, lightJSON.intensity);
    light.name = lightJSON.name;
    light.position.fromArray(lightJSON.position);
    light.userData.sceneLightId = lightJSON.id;
    sceneLights.set(lightJSON.id, light);
    scene.add(light);
    if (type === 'directional-light') {
      const helper = new THREE.DirectionalLightHelper(light, 1.2, 0xf2b880);
      helper.visible = lightHelperToggle.checked;
      lightHelpers.set(lightJSON.id, helper);
      scene.add(helper);
    }
  } else if (type === 'camera') {
    const id = `camera_${Date.now()}`;
    const cameraJSON = { id, name: nextName('camera'), type: 'perspective', position: [0, 3, 6], target: [0, 0, 0], fov: 50, aspect: 1, near: 0.1, far: 1000 };
    sceneManager.addCamera(cameraJSON);
    const sceneCamera = new THREE.PerspectiveCamera(cameraJSON.fov, cameraJSON.aspect, cameraJSON.near, cameraJSON.far);
    sceneCamera.name = cameraJSON.name;
    sceneCamera.position.fromArray(cameraJSON.position);
    sceneCamera.lookAt(...cameraJSON.target);
    sceneCameras.set(id, sceneCamera);
    scene.add(sceneCamera);
    const helper = new THREE.CameraHelper(sceneCamera);
    helper.visible = cameraHelperToggle.checked;
    sceneCamera.userData.helper = helper;
    scene.add(helper);
    renderObjectList();
    selectSceneCamera(id);
  } else if (type === 'cutscene') {
    const suffix = Date.now();
    const spline = {
      id: `camera_path_${suffix}`,
      type: 'CatmullRom',
      points: [[-4, 3, 5], [0, 5, 3], [4, 3, 5]],
    };
    const cutscene = {
      id: `cutscene_${suffix}`,
      name: nextName('cutscene'),
      duration: 5,
      tracks: [{ target: 'camera', type: 'spline', path: spline.id, start: 0, end: 5 }],
    };
    sceneManager.addCutscene(cutscene, spline);
    cutsceneManager.registerSpline(spline);
    cutsceneManager.registerCutscene(cutscene);
    activeSplineId = spline.id;
    splineEditor.load(spline.points);
    splineEditor.setVisible(true);
    splineToggle.checked = true;
    renderObjectList();
    selectCutscene(cutscene.id);
  } else {
    const size = type === 'sphere' ? [1.4, 1.4, 1.4] : type === 'cylinder' || type === 'cone' ? [1, 1.4, 1] : type === 'torus' ? [1.8, 0.5, 1.8] : [1, 1, 1];
    const objectJSON = {
      id: `${type}_${Date.now()}`,
      name: nextName(type),
      type,
      position: [0, type === 'torus' ? 1 : 2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      material: { color: '#ffffff', roughness: 0.5, metalness: 0 },
      physics: { enabled: false, mass: 0, collider: 'auto', size },
    };
    sceneManager.addObject(objectJSON);
    selectObject(objectJSON.id);
  }
  renderObjectList();
  renderJSON();
  hideObjectModal();
}

sceneAddObject.addEventListener('click', showObjectModal);
sceneDeleteObject.addEventListener('click', deleteSelectedSceneItem);
sceneDuplicateObject.addEventListener('click', duplicateSelected);
window.addEventListener('keydown', (event) => {
  const activeTag = document.activeElement?.tagName;
  if (event.key === 'Delete' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') deleteSelectedSceneItem();
});
objectModalClose.addEventListener('click', hideObjectModal);
objectModal.addEventListener('click', (event) => { if (event.target === objectModal) hideObjectModal(); });
objectModal.querySelectorAll('[data-add-type]').forEach((button) => button.addEventListener('click', () => addSceneObject(button.dataset.addType)));
importObjectFile.addEventListener('change', async () => {
  const file = importObjectFile.files[0];
  if (!file) return;
  if (file.name.toLowerCase().endsWith('.gltf')) {
    objectModalStatus.textContent = 'GLTF upload requires a local asset URL; use GLB or an external file for the next asset slice.';
    return;
  }
  const url = URL.createObjectURL(file);
  gltfLoader.load(url, (gltf) => {
    const id = `model_${Date.now()}`;
    const name = nextName('model');
    gltf.scene.name = name;
    gltf.scene.userData.sceneObjectId = id;
    scene.add(gltf.scene);
    sceneManager.sceneJSON.objects.push({ id, name, type: 'gltf', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], material: { color: '#ffffff', roughness: 0.5, metalness: 0 }, physics: { enabled: false, mass: 0, collider: 'auto', size: [1, 1, 1] } });
    sceneManager.objectMeshes.set(id, gltf.scene);
    renderObjectList();
    renderJSON();
    hideObjectModal();
    URL.revokeObjectURL(url);
  }, undefined, (error) => { objectModalStatus.textContent = `Upload failed: ${error.message}`; URL.revokeObjectURL(url); });
});

let pointerDownPosition = null;

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDownPosition = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerDownPosition || transformControls.dragging) return;
  const movement = Math.hypot(
    event.clientX - pointerDownPosition.x,
    event.clientY - pointerDownPosition.y,
  );
  pointerDownPosition = null;
  if (movement > 5) return;

  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (showPhysicsBodies) {
    const colliderObjects = [...physicsHelpers.values()].flatMap((entries) => entries.map((entry) => entry.object3D));
    const hit = raycaster.intersectObjects(colliderObjects, true)[0];
    if (hit) selectCollider(hit.object.userData.sceneObjectId, hit.object.userData.colliderIndex ?? null);
    return;
  }
  const selectableMeshes = [...sceneManager.objectMeshes.values()]
    .filter((mesh) => mesh.userData.sceneObject?.type !== 'plane');
  const hit = raycaster.intersectObjects(selectableMeshes)[0];
  if (hit) selectObject(hit.object.userData.sceneObjectId);
});

renderer.domElement.addEventListener('contextmenu', (event) => {
  if (!showPhysicsBodies) return;
  event.preventDefault();
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const colliderObjects = [...physicsHelpers.values()].flatMap((entries) => entries.map((entry) => entry.object3D));
  const colliderHit = raycaster.intersectObjects(colliderObjects, true)[0];
  if (colliderHit) {
    showColliderContextMenu(event.clientX, event.clientY, colliderHit.object.userData.sceneObjectId, colliderHit.object.userData.colliderIndex ?? null);
    return;
  }
  const selectableMeshes = [...sceneManager.objectMeshes.values()]
    .filter((mesh) => mesh.userData.sceneObject?.type !== 'plane');
  const meshHit = raycaster.intersectObjects(selectableMeshes)[0];
  if (meshHit) {
    const hitId = meshHit.object.userData.sceneObjectId;
    const hitObjectJSON = sceneManager.exportJSON().objects.find((entry) => entry.id === hitId);
    if (hitObjectJSON?.physics?.enabled) showColliderContextMenu(event.clientX, event.clientY, hitId, null);
  }
});

codeEditor.onDidChangeModelContent(() => {
  if (!syncingEditors) {
    sceneCodeDirty = true;
    jsonStatus.textContent = 'scene.js has unapplied edits';
  }
});

applyJSONButton.addEventListener('click', applyJSON);
applyCodeButton.addEventListener('click', applyCode);

physicsToggle.addEventListener('change', () => {
  showPhysicsBodies = physicsToggle.checked;
  for (const entries of physicsHelpers.values()) {
    for (const { object3D } of entries) object3D.visible = showPhysicsBodies;
  }
});

triggerToggle.addEventListener('change', () => {
  const visible = triggerToggle.checked;
  triggerManager.setVisible(visible);
});

splineToggle.addEventListener('change', () => {
  const visible = splineToggle.checked;
  splineEditor.setVisible(visible);
});

cameraHelperToggle.addEventListener('change', () => {
  cameraHelper.visible = cameraHelperToggle.checked;
  for (const sceneCamera of sceneCameras.values()) sceneCamera.userData.helper.visible = cameraHelperToggle.checked;
});
lightHelperToggle.addEventListener('change', () => {
  for (const helper of lightHelpers.values()) helper.visible = lightHelperToggle.checked;
});

cutscenePlay.addEventListener('click', () => {
  if (activeCutsceneId && cutsceneManager.cutscenes.has(activeCutsceneId)) cutsceneManager.play(activeCutsceneId);
  else cutsceneStatus.textContent = 'Select a cutscene';
});
cutsceneSelect.addEventListener('change', () => selectCutscene(cutsceneSelect.value));
cutscenePause.addEventListener('click', () => {
  if (cutsceneManager.active?.paused) cutsceneManager.resume();
  else cutsceneManager.pause();
});
cutsceneStop.addEventListener('click', () => cutsceneManager.stop());

function activateEditorTab(tabName) {
  const isJSON = tabName === 'json';
  jsonTab.classList.toggle('is-active', isJSON);
  codeTab.classList.toggle('is-active', !isJSON);
  jsonTab.setAttribute('aria-selected', String(isJSON));
  codeTab.setAttribute('aria-selected', String(!isJSON));
  editorViews.forEach((view) => {
    view.hidden = view.dataset.editorView !== tabName;
    view.classList.toggle('is-active', view.dataset.editorView === tabName);
  });
}

jsonTab.addEventListener('click', () => activateEditorTab('json'));
codeTab.addEventListener('click', () => activateEditorTab('code'));
activateEditorTab('code');

undoButton.addEventListener('click', () => {
  if (sceneManager.undo()) restoreEditorAfterHistory();
});
redoButton.addEventListener('click', () => {
  if (sceneManager.redo()) restoreEditorAfterHistory();
});

codeEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
  applyCode();
});

panelResizeHandle.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  panelResizeHandle.setPointerCapture(event.pointerId);
  panel.classList.add('is-resizing');
});

panelResizeHandle.addEventListener('pointermove', (event) => {
  if (!panelResizeHandle.hasPointerCapture(event.pointerId)) return;
  const maxWidth = window.innerWidth * 0.5;
  const nextWidth = Math.min(maxWidth, Math.max(280, window.innerWidth - event.clientX));
  panel.style.width = `${nextWidth}px`;
});

panelResizeHandle.addEventListener('pointerup', (event) => {
  panelResizeHandle.releasePointerCapture(event.pointerId);
  panel.classList.remove('is-resizing');
});

inspectorCollapse.addEventListener('click', () => {
  panel.classList.toggle('is-collapsed');
  const collapsed = panel.classList.contains('is-collapsed');
  inspectorCollapse.textContent = collapsed ? '‹' : '›';
  inspectorCollapse.setAttribute('aria-label', collapsed ? 'Expand inspector' : 'Collapse inspector');
  inspectorCollapse.setAttribute('title', collapsed ? 'Expand inspector' : 'Collapse inspector');
});

function resizeRenderer() {
  const { clientWidth, clientHeight } = container;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight);
}

window.addEventListener('resize', resizeRenderer);

function animate() {
  requestAnimationFrame(animate);
  if (playMode && playTarget) {
    const speed = 3;
    const deltaX = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const deltaZ = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
    if (deltaX || deltaZ) {
      moveKinematic(playTarget, [playTarget.position.x + deltaX * speed / 60, playTarget.position.y, playTarget.position.z + deltaZ * speed / 60]);
      playTarget.position.x += deltaX * speed / 60;
      playTarget.position.z += deltaZ * speed / 60;
      sceneManager.updateObjectTransform(playTarget.userData.sceneObjectId, { position: playTarget.position.toArray() });
      renderJSON();
    }
  }
  stepPhysics(1 / 60);
  animationManager.update(1 / 60);
  cutsceneManager.update(1 / 60);
  audioManager.update();
  const dynamicActors = [...sceneManager.objectMeshes.values()]
    .filter((mesh) => (mesh.userData.sceneObject?.physics?.mass || 0) > 0);
  triggerManager.update(dynamicActors);
  audioManager.updateEmitterActors(playTarget ? [playTarget] : dynamicActors.slice(0, 1));
  for (const [id, entries] of physicsHelpers) {
    const mesh = sceneManager.getMesh(id);
    if (!mesh) continue;
    for (const { object3D, colliderIndex } of entries) {
      if (colliderIndex === null) {
        object3D.position.copy(mesh.position);
      } else if (object3D.userData.localOffset) {
        const scale = mesh.scale.toArray();
        const offset = object3D.userData.localOffset;
        object3D.position.set(
          mesh.position.x + offset[0] * scale[0],
          mesh.position.y + offset[1] * scale[1],
          mesh.position.z + offset[2] * scale[2],
        );
      }
      if (object3D.userData.followMeshRotation) object3D.quaternion.copy(mesh.quaternion);
    }
  }
  controls.update();
  renderer.render(scene, renderCamera);
}

renderObjectList();
selectObject(null);
renderJSON();
resizeRenderer();
animate();
