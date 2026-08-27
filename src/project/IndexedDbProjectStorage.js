const DATABASE_NAME = '3ditor-js-projects';
const DATABASE_VERSION = 1;
const PROJECT_STORE = 'projects';

export class IndexedDbProjectStorage {
  constructor({ databaseName = DATABASE_NAME } = {}) {
    this.databaseName = databaseName;
  }

  async listProjects() {
    const database = await this.openDatabase();
    return this.request(database.transaction(PROJECT_STORE).objectStore(PROJECT_STORE).getAll());
  }

  async createProject(name, location = 'browser') {
    const project = {
      id: crypto.randomUUID(),
      name,
      location,
      updatedAt: new Date().toISOString(),
      files: {},
    };
    const database = await this.openDatabase();
    await this.request(database.transaction(PROJECT_STORE, 'readwrite').objectStore(PROJECT_STORE).add(project));
    return project;
  }

  async openProject(id) {
    const database = await this.openDatabase();
    const project = await this.request(database.transaction(PROJECT_STORE).objectStore(PROJECT_STORE).get(id));
    if (!project) throw new Error(`Unknown project: ${id}`);
    return project;
  }

  async readFile(projectId, path) {
    const project = await this.openProject(projectId);
    return project.files[path] ?? null;
  }

  async saveFile(projectId, path, content) {
    const project = await this.openProject(projectId);
    project.files[path] = content;
    project.updatedAt = new Date().toISOString();
    await this.saveProject(project);
  }

  async deleteFile(projectId, path) {
    const project = await this.openProject(projectId);
    delete project.files[path];
    project.updatedAt = new Date().toISOString();
    await this.saveProject(project);
  }

  async saveProject(project) {
    const database = await this.openDatabase();
    await this.request(database.transaction(PROJECT_STORE, 'readwrite').objectStore(PROJECT_STORE).put(project));
    return project;
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => request.result.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
    });
  }

  request(request) {
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}
