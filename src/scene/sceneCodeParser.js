import { SCENE_SCHEMA_VERSION } from './sceneSchema.js';

function parseVector(source, label) {
  const values = source.split(',').map((value) => Number(value.trim()));
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid ${label} transform.`);
  }
  return values;
}

function readVector(source, expression, label) {
  const match = source.match(new RegExp(`${expression}\\(([^)]+)\\)`));
  if (!match) throw new Error(`Missing ${label} transform.`);
  return parseVector(match[1], label);
}

function readNumber(source, expression, fallback) {
  const match = source.match(new RegExp(`${expression}\\s*:\\s*([^,}\\n]+)`));
  if (!match) return fallback;
  const value = Number(match[1].trim());
  if (!Number.isFinite(value)) throw new Error(`Invalid material value: ${expression}.`);
  return value;
}

function readString(source, expression, fallback) {
  const match = source.match(new RegExp(`${expression}\\s*:\\s*("[^"]+")`));
  return match ? JSON.parse(match[1]) : fallback;
}

function readBoolean(source, expression, fallback) {
  const match = source.match(new RegExp(`${expression}\\s*:\\s*(true|false)`));
  return match ? match[1] === 'true' : fallback;
}

export function parseSceneCode(source) {
  if (typeof source !== 'string' || !source.includes("import * as THREE from 'three';")) {
    throw new Error('Expected generated Three.js scene code.');
  }
  if (!source.includes('export function createScene(')) {
    throw new Error('Missing createScene function.');
  }

  const cameraPosition = readVector(source, 'camera\\.position\\.set', 'camera position');
  const cameraTargetMatch = source.match(/camera\.lookAt\(([^)]+)\)/);
  if (!cameraTargetMatch) throw new Error('Missing camera target.');
  const cameraTarget = parseVector(cameraTargetMatch[1], 'camera target');

  const objects = [];
  const objectPattern = /const object_([a-zA-Z0-9_$]+)Geometry = new THREE\.(BoxGeometry|PlaneGeometry|SphereGeometry|CylinderGeometry|ConeGeometry|TorusGeometry)[^;]*;\s+const object_\1Material = new THREE\.(MeshBasicMaterial|MeshLambertMaterial|MeshPhongMaterial|MeshToonMaterial|MeshStandardMaterial|MeshPhysicalMaterial|MeshDepthMaterial|MeshNormalMaterial|MeshMatcapMaterial|MeshDistanceMaterial|ShadowMaterial|SpriteMaterial|PointsMaterial|LineBasicMaterial|LineDashedMaterial)\(\{([^}]+)\}\);\s+const object_\1 = new THREE\.Mesh\(object_\1Geometry, object_\1Material\);\s+object_\1\.userData\.sceneObjectId = ([^;]+);\s+object_\1\.name = ([^;]+);\s+object_\1\.position\.set\(([^)]+)\);\s+object_\1\.rotation\.set\(([^)]+)\);\s+object_\1\.scale\.set\(([^)]+)\);\s+scene\.add\(object_\1\);/g;
  let match;
  while ((match = objectPattern.exec(source))) {
    const [, fallbackId, geometryType, materialType, materialSource, idSource, nameSource, positionSource, rotationSource, scaleSource] = match;
    let id;
    try {
      id = JSON.parse(idSource.trim());
    } catch {
      throw new Error(`Invalid ID for object ${fallbackId}.`);
    }
    let name;
    try {
      name = JSON.parse(nameSource.trim());
    } catch {
      throw new Error(`Invalid name for object ${fallbackId}.`);
    }
    const parsedObject = {
      id,
      name,
      type: { PlaneGeometry: 'plane', SphereGeometry: 'sphere', CylinderGeometry: 'cylinder', ConeGeometry: 'cone', TorusGeometry: 'torus' }[geometryType] || 'box',
      position: parseVector(positionSource, 'position'),
      rotation: parseVector(rotationSource, 'rotation'),
      scale: parseVector(scaleSource, 'scale'),
      material: {
        type: materialType,
        color: JSON.parse(materialSource.match(/color:\s*("[^"]+")/)?.[1] || '"#ffffff"'),
        roughness: readNumber(materialSource, 'roughness', 0.5),
        metalness: readNumber(materialSource, 'metalness', 0),
        emissive: readString(materialSource, 'emissive', '#000000'),
        emissiveIntensity: readNumber(materialSource, 'emissiveIntensity', 1),
        opacity: readNumber(materialSource, 'opacity', 1),
        transparent: readBoolean(materialSource, 'transparent', false),
        wireframe: readBoolean(materialSource, 'wireframe', false),
        flatShading: readBoolean(materialSource, 'flatShading', false),
      },
    };
    const bodyPattern = new RegExp(`const object_${fallbackId}Body = new CANNON\\.Body\\(\\{ mass: ([^,}]+),`);
    const bodyMatch = source.match(bodyPattern);
    if (bodyMatch) {
      parsedObject.physics = {
        enabled: true,
        mass: Number(bodyMatch[1]),
        collider: source.includes(`object_${fallbackId}Body.addShape(new CANNON.Cylinder`) && source.includes(`object_${fallbackId}Body.addShape(new CANNON.Sphere`) ? 'capsule' : source.includes(`object_${fallbackId}Body.addShape(new CANNON.Cylinder`) ? 'cylinder' : source.includes(`object_${fallbackId}Body.addShape(new CANNON.Sphere`) ? 'sphere' : 'box',
      };
      const boxMatch = source.match(new RegExp(`const object_${fallbackId}Body = new CANNON\\.Body\\(\\{ mass: [^,]+, shape: new CANNON\\.Box\\(new CANNON\\.Vec3\\(([^)]+)\\)`));
      const sphereMatch = source.match(new RegExp(`const object_${fallbackId}Body = new CANNON\\.Body\\(\\{ mass: [^,]+, shape: new CANNON\\.Sphere\\(([^)]+)\\)`));
      if (boxMatch) parsedObject.physics.size = parseVector(boxMatch[1], 'physics size').map((value) => value * 2);
      if (sphereMatch) parsedObject.physics.radius = Number(sphereMatch[1]);
    }
    objects.push(parsedObject);
  }

  if (!objects.length) throw new Error('No supported scene objects found.');
  const lights = [];
  const lightPattern = /const light_([a-zA-Z0-9_$]+) = new THREE\.(HemisphereLight|DirectionalLight|PointLight)\(([^)]+)\);([\s\S]*?)scene\.add\(light_\1\);/g;
  while ((match = lightPattern.exec(source))) {
    const [, fallbackId, type, args, body] = match;
    const values = args.split(',').map((value) => value.trim());
    const light = { id: fallbackId, type: type === 'HemisphereLight' ? 'hemisphere' : type === 'PointLight' ? 'point' : 'directional', intensity: Number(values.at(-1)) };
    if (type === 'HemisphereLight') {
      light.skyColor = JSON.parse(values[0]);
      light.groundColor = JSON.parse(values[1]);
    } else {
      light.color = JSON.parse(values[0]);
    }
    const nameMatch = body.match(/name = ([^;]+)/);
    if (nameMatch) light.name = JSON.parse(nameMatch[1]);
    const position = body.match(/position\.set\(([^)]+)\)/);
    if (position) light.position = parseVector(position[1], 'light position');
    light.castShadow = body.includes('.castShadow = true');
    lights.push(light);
  }

  const cameras = [];
  const cameraPattern = /const camera_([a-zA-Z0-9_$]+) = new THREE\.PerspectiveCamera\(([^)]+)\);\s+camera_\1\.name = ([^;]+);\s+camera_\1\.position\.set\(([^)]+)\);\s+camera_\1\.lookAt\(([^)]+)\);\s+scene\.add\(camera_\1\);/g;
  while ((match = cameraPattern.exec(source))) {
    const [, fallbackId, settings, nameSource, positionSource, targetSource] = match;
    const values = settings.split(',').map((value) => Number(value.trim()));
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) throw new Error(`Invalid camera settings for ${fallbackId}.`);
    cameras.push({ id: fallbackId, name: JSON.parse(nameSource), type: 'perspective', fov: values[0], aspect: values[1], near: values[2], far: values[3], position: parseVector(positionSource, 'camera position'), target: parseVector(targetSource, 'camera target') });
  }

  const splines = [];
  const splinePattern = /const spline_([a-zA-Z0-9_$]+) = new THREE\.CatmullRomCurve3\(\[([^\]]+)\]\);\s+cutsceneManager\.registerSplineCurve\(([^,]+), spline_\1\);/g;
  while ((match = splinePattern.exec(source))) {
    const [, fallbackId, pointsSource, idSource] = match;
    const points = [...pointsSource.matchAll(/new THREE\.Vector3\(([^)]+)\)/g)].map((point) => parseVector(point[1], 'spline point'));
    const id = JSON.parse(idSource.trim());
    const nameMatch = source.slice(Math.max(0, match.index - 100), match.index).match(/\/\/ Spline name: ([^\n]+)/);
    splines.push({ id, name: nameMatch ? JSON.parse(nameMatch[1]) : id, type: 'CatmullRom', points });
  }

  const triggers = [];
  const triggerPattern = /triggerManager\.registerTrigger\(\{\s*id: ([^,]+),\s*type: ([^,]+),\s*position: \[([^\]]+)\],\s*size: \[([^\]]+)\],\s*action: ([^,]+),\s*params: ([^,]+),\s*\}\);/g;
  while ((match = triggerPattern.exec(source))) {
    const [, idSource, typeSource, positionSource, sizeSource, actionSource, paramsSource] = match;
    triggers.push({ id: JSON.parse(idSource), type: JSON.parse(typeSource), position: parseVector(positionSource, 'trigger position'), size: parseVector(sizeSource, 'trigger size'), action: JSON.parse(actionSource), params: JSON.parse(paramsSource) });
  }

  const cutscenes = [];
  const cutscenePattern = /cutsceneManager\.registerCutscene\(\{\s*id: ([^,]+),\s*duration: ([^,]+),\s*tracks: \[([\s\S]*?)\],\s*\}\);/g;
  while ((match = cutscenePattern.exec(source))) {
    const [, idSource, durationSource, tracksSource] = match;
    const nameMatch = source.slice(Math.max(0, match.index - 100), match.index).match(/name: ([^,]+),/);
    const tracks = [...tracksSource.matchAll(/\{ target: ([^,]+), type: ([^,]+), path: ([^,]+), start: ([^,]+), end: ([^ ]+) \},/g)].map((track) => ({ target: JSON.parse(track[1]), type: JSON.parse(track[2]), path: JSON.parse(track[3]), start: Number(track[4]), end: Number(track[5]) }));
    cutscenes.push({ id: JSON.parse(idSource), name: nameMatch ? JSON.parse(nameMatch[1]) : JSON.parse(idSource), duration: Number(durationSource), tracks });
  }
  return {
    version: SCENE_SCHEMA_VERSION,
    id: 'parsed-scene',
    metadata: { name: 'Parsed Scene' },
    lights,
    cameras,
    camera: { position: cameraPosition, target: cameraTarget },
    objects,
    triggers,
    splines,
    cutscenes,
  };
}
