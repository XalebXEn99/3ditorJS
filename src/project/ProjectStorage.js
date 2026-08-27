export class ProjectStorage {
  async listProjects() {
    throw new Error('ProjectStorage.listProjects() must be implemented.');
  }

  async createProject(name, location) {
    throw new Error('ProjectStorage.createProject() must be implemented.');
  }

  async openProject(location) {
    throw new Error('ProjectStorage.openProject() must be implemented.');
  }

  async readFile(path) {
    throw new Error('ProjectStorage.readFile() must be implemented.');
  }

  async saveFile(path, content) {
    throw new Error('ProjectStorage.saveFile() must be implemented.');
  }

  async deleteFile(path) {
    throw new Error('ProjectStorage.deleteFile() must be implemented.');
  }
}
