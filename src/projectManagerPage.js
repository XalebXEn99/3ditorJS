import './projectManagerPage.css';
import { IndexedDbProjectStorage } from './project/IndexedDbProjectStorage.js';
import { createDefaultScene } from './scene/sceneSchema.js';

const storage = new IndexedDbProjectStorage();
const nameInput = document.querySelector('#project-name');
const recentProjects = document.querySelector('#recent-projects');
const status = document.querySelector('#project-manager-status');

async function renderProjects() {
  const projects = await storage.listProjects();
  recentProjects.replaceChildren();
  if (!projects.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-projects';
    empty.textContent = 'No browser projects yet.';
    recentProjects.append(empty);
    return;
  }
  for (const project of projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const item = document.createElement('article');
    item.className = 'recent-project';
    item.innerHTML = `<strong></strong><span></span><button type="button">Open</button>`;
    item.querySelector('strong').textContent = project.name;
    item.querySelector('span').textContent = project.location || 'Browser storage';
    item.querySelector('button').addEventListener('click', () => {
      window.location.href = `./?project=${encodeURIComponent(project.id)}`;
    });
    recentProjects.append(item);
  }
}

async function createProject() {
  const name = nameInput.value.trim();
  if (!name) {
    status.textContent = 'Enter a project name.';
    return;
  }
  const project = await storage.createProject(name);
  await storage.saveFile(project.id, 'project.json', JSON.stringify({ name, version: 1 }, null, 2));
  await storage.saveFile(project.id, 'scenes/test-foundation.scene.json', JSON.stringify(createDefaultScene(), null, 2));
  await storage.saveFile(project.id, 'scenes/main.scene.js', `import * as THREE from 'three';\n\nexport function createScene() {\n  const scene = new THREE.Scene();\n  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);\n  scene.add(camera);\n  return { scene, camera };\n}\n`);
  window.location.href = `./?project=${encodeURIComponent(project.id)}`;
}

async function openFolder() {
  if (!window.showDirectoryPicker) {
    status.textContent = 'Local folder access requires a supported Chromium browser.';
    return;
  }
  const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
  status.textContent = `Folder selected: ${directory.name}. Native file initialization will use the storage adapter.`;
}

document.querySelector('#create-project').addEventListener('click', createProject);
document.querySelector('#open-folder').addEventListener('click', openFolder);
document.querySelector('#refresh-projects').addEventListener('click', renderProjects);
renderProjects();
