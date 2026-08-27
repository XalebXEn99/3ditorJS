export class ScriptManager {
  constructor(projectManager) {
    this.projectManager = projectManager;
    this.editors = new Map();
  }

  listScripts() {
    return this.projectManager.listFiles().filter((file) => file.type === 'javascript' && file.path.startsWith('scripts/'));
  }

  createScript(name = 'new-script') {
    return this.projectManager.createScript(name);
  }

  attach(sceneManager, objectId, path, exportName = 'PlayerController') {
    const objectJSON = sceneManager.sceneJSON?.objects?.find((entry) => entry.id === objectId);
    if (!objectJSON) throw new Error(`Unknown scene object: ${objectId}`);
    sceneManager.recordHistory();
    objectJSON.scripts = [...(objectJSON.scripts || []).filter((script) => script.path !== path), { path, export: exportName, enabled: true }];
  }

  detach(sceneManager, objectId, path) {
    const objectJSON = sceneManager.sceneJSON?.objects?.find((entry) => entry.id === objectId);
    if (!objectJSON) throw new Error(`Unknown scene object: ${objectId}`);
    sceneManager.recordHistory();
    objectJSON.scripts = (objectJSON.scripts || []).filter((script) => script.path !== path);
  }

  getAttachments(sceneManager, objectId) {
    return sceneManager.sceneJSON?.objects?.find((entry) => entry.id === objectId)?.scripts || [];
  }
}
