export const SCENE_SCHEMA_VERSION = 1;

export function createDefaultScene() {
  return {
    version: SCENE_SCHEMA_VERSION,
    id: 'test-foundation',
    metadata: {
      name: 'Foundation Scene',
    },
    camera: {
      position: [3.8, 2.8, 5.5],
      target: [0, 0.6, 0],
    },
    cameras: [
      { id: 'player-camera', name: 'Player Camera', type: 'perspective', position: [0, 2.5, 6], target: [0, 1, 0], parent: 'cube-01', fov: 50, aspect: 1, near: 0.1, far: 1000 },
    ],
    lights: [
      { id: 'ambient-01', type: 'hemisphere', skyColor: '#dceeff', groundColor: '#27313a', intensity: 2.2 },
      { id: 'key-01', type: 'directional', color: '#ffd6a0', intensity: 3.5, position: [4, 6, 3], castShadow: true },
    ],
    objects: [
      {
        id: 'cube-01',
        name: 'Test Cube',
        type: 'box',
        position: [-5, 4, 0],
        rotation: [0, 0, 0],
        scale: [1.5, 1.5, 1.5],
        material: {
          color: '#f26b5e',
          roughness: 0.32,
          metalness: 0.08,
        },
        physics: {
          enabled: true,
          mass: 1,
          collider: 'box',
          size: [1.5, 1.5, 1.5],
        },
        scripts: [
          { path: 'scripts/player.js', export: 'PlayerController', enabled: true },
        ],
      },
      {
        id: 'cube-02',
        name: 'Test Box Blue',
        type: 'box',
        position: [0, 5, 0],
        rotation: [0, 0.35, 0],
        scale: [1.2, 1.2, 1.2],
        material: { color: '#3287d6', roughness: 0.4, metalness: 0.05 },
        physics: { enabled: true, mass: 1, collider: 'box', size: [1.2, 1.2, 1.2] },
      },
      {
        id: 'cube-03',
        name: 'Test Box Gold',
        type: 'box',
        position: [3, 7, 0],
        rotation: [0, -0.25, 0],
        scale: [1, 1, 1],
        material: { color: '#f2b84f', roughness: 0.3, metalness: 0.12 },
        physics: { enabled: true, mass: 1, collider: 'box', size: [1, 1, 1] },
      },
      {
        id: 'floor-01',
        name: 'Test Floor',
        type: 'plane',
        position: [0, 0, 0],
        rotation: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
        material: { color: '#26343b', roughness: 0.8, metalness: 0 },
        physics: { enabled: true, mass: 0, collider: 'box', size: [30, 0.2, 30], rotation: [0, 0, 0] },
      },
    ],
    splines: [],
    cutscenes: [],
    triggers: [],
  };
}

export function validateScene(sceneJSON) {
  if (!sceneJSON || typeof sceneJSON !== 'object') {
    throw new TypeError('Scene data must be an object.');
  }
  if (sceneJSON.version !== SCENE_SCHEMA_VERSION) {
    throw new Error(`Unsupported scene schema version: ${sceneJSON.version}`);
  }
  if (!Array.isArray(sceneJSON.objects)) {
    throw new TypeError('Scene objects must be an array.');
  }
  return true;
}
