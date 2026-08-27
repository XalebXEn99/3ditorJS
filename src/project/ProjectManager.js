const DEFAULT_FILES = [
  { path: 'main.js', type: 'javascript' },
  { path: 'scenes/test-foundation.scene.js', type: 'scene' },
  { path: 'scripts/player.js', type: 'javascript', content: `export class PlayerController {
  constructor({ mesh, physics, camera, speed = 4, jumpForce = 5 }) {
    this.mesh = mesh;
    this.physics = physics;
    this.camera = camera;
    this.speed = speed;
    this.jumpForce = jumpForce;
    this.keys = new Set();
    this.onKeyDown = (event) => this.keys.add(event.code);
    this.onKeyUp = (event) => this.keys.delete(event.code);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  update(input, deltaTime) {
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const forward = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const backward = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const currentVelocity = this.physics?.getVelocity ? this.physics.getVelocity(this.mesh) : [0, 0, 0];
    const velocity = [
      (right ? 1 : 0) - (left ? 1 : 0),
      currentVelocity[1],
      (backward ? 1 : 0) - (forward ? 1 : 0),
    ];
    const length = Math.hypot(velocity[0], velocity[2]) || 1;
    velocity[0] = velocity[0] / length * this.speed;
    velocity[2] = velocity[2] / length * this.speed;
    if (this.physics?.setVelocity) this.physics.setVelocity(this.mesh, velocity);
    else {
      this.mesh.position.x += velocity[0] * deltaTime;
      this.mesh.position.z += velocity[2] * deltaTime;
    }
    if ((this.keys.has('Space') || input?.jump) && this.physics?.applyImpulse) {
      this.physics.applyImpulse(this.mesh, [0, this.jumpForce, 0]);
      this.keys.delete('Space');
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
` },
  { path: 'animations/README.md', type: 'document' },
  { path: 'menus/README.md', type: 'document' },
  { path: 'assets/.gitkeep', type: 'asset' },
  { path: 'shaders/README.md', type: 'document' },
];

const SCENE_TEMPLATE = `import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

  scene.add(camera);

  return { scene, camera };
}
`;

export class ProjectManager {
  constructor({ onChange, onOpen } = {}) {
    this.files = new Map(DEFAULT_FILES.map((file) => [file.path, { ...file }]));
    this.onChange = onChange;
    this.onOpen = onOpen;
    this.storage = null;
    this.projectId = null;
  }

  listFiles() {
    return [...this.files.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  createScene(name = 'new-scene') {
    const path = `scenes/${name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}.scene.js`;
    if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
    const file = { path, type: 'scene', content: SCENE_TEMPLATE, sceneId: path };
    this.files.set(path, file);
    this.onChange?.(this.listFiles());
    this.open(file);
    return file;
  }

  createScript(name = 'new-script') {
    const path = `scripts/${name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}.js`;
    if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
    const file = { path, type: 'javascript', content: '' };
    this.files.set(path, file);
    this.onChange?.(this.listFiles());
    this.open(file);
    return file;
  }

  createShaderFiles(name = 'custom-material') {
    const base = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const vertexPath = `shaders/${base}.vert`;
    const fragmentPath = `shaders/${base}.frag`;
    if (!this.files.has(vertexPath)) this.files.set(vertexPath, { path: vertexPath, type: 'shader', content: '' });
    if (!this.files.has(fragmentPath)) this.files.set(fragmentPath, { path: fragmentPath, type: 'shader', content: '' });
    this.onChange?.(this.listFiles());
    return { vertexPath, fragmentPath };
  }

  open(file) {
    this.onOpen?.(file);
  }

  async connectStorage(storage, projectName = 'Untitled Project') {
    this.storage = storage;
    const projects = await storage.listProjects();
    const project = projects[0] || await storage.createProject(projectName);
    this.projectId = project.id;
    for (const [path, content] of Object.entries(project.files || {})) {
      const existing = this.files.get(path);
      this.files.set(path, { ...(existing || { path, type: path.endsWith('.scene.js') ? 'scene' : 'javascript' }), content });
    }
    return project;
  }

  async saveProjectFile(path, content) {
    if (!this.storage || !this.projectId) throw new Error('Project storage is not connected.');
    await this.storage.saveFile(this.projectId, path, content);
  }

  async saveAllFiles() {
    if (!this.storage || !this.projectId) throw new Error('Project storage is not connected.');
    for (const file of this.files.values()) {
      await this.storage.saveFile(this.projectId, file.path, file.content || '');
    }
  }

  async loadProjectFile(path) {
    if (!this.storage || !this.projectId) throw new Error('Project storage is not connected.');
    return this.storage.readFile(this.projectId, path);
  }

  attachScene(path, sceneJSON) {
    const file = this.files.get(path);
    if (!file || file.type !== 'scene') throw new Error(`Unknown scene file: ${path}`);
    file.sceneJSON = structuredClone(sceneJSON);
    file.sceneId = sceneJSON.id;
  }
}
