import * as monaco from 'monaco-editor';
import editorWorker from '../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker';
import './menuEditor.css';
import { UIManager } from './ui/UIManager.js';

self.MonacoEnvironment = { getWorker: () => new editorWorker() };
const canvas = document.querySelector('#menu-canvas');
const status = document.querySelector('#menu-status');
const views = { js: document.querySelector('#menu-js-view'), css: document.querySelector('#menu-css-view') };
const tabs = { js: document.querySelector('#menu-js-tab'), css: document.querySelector('#menu-css-tab') };
const editorOptions = { theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', folding: true, scrollBeyondLastLine: false, padding: { top: 10, bottom: 10 } };
const jsEditor = monaco.editor.create(document.querySelector('#menu-js'), { ...editorOptions, language: 'javascript', value: `function createMenu(root, actions) {
  root.innerHTML = \`<section class="pause-menu"><p>Game paused</p><h2>Pause menu</h2><button id="resume-button">Resume</button><button id="settings-button">Settings</button></section>\`;
  root.querySelector('#resume-button').onclick = () => actions.resumeGame();
  root.querySelector('#settings-button').onclick = () => actions.openSettings();
}` });
const cssEditor = monaco.editor.create(document.querySelector('#menu-css'), { ...editorOptions, language: 'css', value: `.pause-menu {
  display: grid;
  gap: 14px;
  width: 100%;
  height: 100%;
  padding: 34px 42px;
  align-content: center;
  justify-items: center;
  border: 6px solid #173e78;
  border-radius: 18px;
  background: linear-gradient(145deg, #4e9eea, #2674c8);
  box-shadow: inset 0 0 0 4px #f8e6a0, 10px 10px 0 rgba(13, 42, 83, 0.28);
  color: #fffdf2;
  text-align: center;
}

.pause-menu p {
  margin: 0;
  color: #f8e6a0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.pause-menu h2 {
  margin: 0 0 12px;
  color: #fffdf2;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-shadow: 3px 3px 0 #173e78;
}

.pause-menu button {
  width: 210px;
  padding: 11px 18px;
  border: 3px solid #173e78;
  border-radius: 999px;
  background: #fffdf2;
  color: #173e78;
  cursor: pointer;
  font-weight: 800;
  text-transform: uppercase;
}

.pause-menu button:hover,
.pause-menu button:focus-visible {
  border-color: #a43b32;
  background: #ffb347;
  color: #173e78;
  outline: none;
  transform: translateX(5px);
}` });

function addFullscreenControl(host, label) {
  const originalParent = host.parentElement;
  const placeholder = document.createComment(`fullscreen-${label}`);
  originalParent.insertBefore(placeholder, host);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-fullscreen-button';
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

addFullscreenControl(document.querySelector('#menu-js'), 'menu.js');
addFullscreenControl(document.querySelector('#menu-css'), 'menu.css');

const uiManager = new UIManager({ root: canvas });
const selectedElementLabel = document.querySelector('#selected-menu-element');
const elementLeft = document.querySelector('#element-left');
const elementTop = document.querySelector('#element-top');
let selectedElement = null;
const actions = { resumeGame: () => { status.textContent = 'Resume action called'; uiManager.hide('pause'); }, openSettings: () => { status.textContent = 'Settings action called'; } };
function getMenuFactory() { const createMenu = new Function(`${jsEditor.getValue()}; return createMenu;`)(); if (typeof createMenu !== 'function') throw new Error('menu.js must define createMenu(root, actions).'); return createMenu; }
function bindPreviewSelection() {
  const menu = uiManager.getMenuElement('pause');
  menu.querySelectorAll('*').forEach((element) => {
    if (!element.id) return;
    element.addEventListener('click', (event) => { event.stopPropagation(); selectPreviewElement(element); });
    element.addEventListener('pointerdown', (event) => { if (event.button === 0) selectPreviewElement(element); });
  });
}
function selectPreviewElement(element) { selectedElement = element; selectedElementLabel.textContent = `#${element.id}`; elementLeft.value = parseInt(element.style.left || 0, 10); elementTop.value = parseInt(element.style.top || 0, 10); }
function applyMenu() { try { uiManager.registerMenu('pause', { create: getMenuFactory(), stylesheet: cssEditor.getValue() }); bindPreviewSelection(); status.textContent = 'Menu applied'; } catch (error) { status.textContent = error.message; canvas.replaceChildren(); } }
function addButtonTemplate() {
  const source = jsEditor.getValue();
  const insertion = `\n  const button = document.createElement('button');\n  button.id = 'new-button';\n  button.type = 'button';\n  button.textContent = 'New button';\n  button.onclick = () => actions.customAction();\n  root.querySelector('.pause-menu').append(button);\n`;
  const markerIndex = source.lastIndexOf('\n}');
  if (markerIndex < 0) { status.textContent = 'Could not find createMenu function'; return; }
  jsEditor.setValue(`${source.slice(0, markerIndex)}${insertion}${source.slice(markerIndex)}`);
  status.textContent = 'Button template added to menu.js';
}
function addHeadingTemplate() {
  const source = jsEditor.getValue();
  const insertion = `\n  const heading = document.createElement('h3');\n  heading.id = 'new-heading';\n  heading.textContent = 'New heading';\n  root.querySelector('.pause-menu').append(heading);\n`;
  const markerIndex = source.lastIndexOf('\n}');
  if (markerIndex < 0) { status.textContent = 'Could not find createMenu function'; return; }
  jsEditor.setValue(`${source.slice(0, markerIndex)}${insertion}${source.slice(markerIndex)}`);
  status.textContent = 'Heading template added to menu.js';
}
function applyElementPosition() {
  if (!selectedElement) { status.textContent = 'Select a preview element first'; return; }
  const id = selectedElement.id;
  const source = jsEditor.getValue();
  const insertion = `\n  root.querySelector('#${id}').style.left = '${elementLeft.value}px';\n  root.querySelector('#${id}').style.top = '${elementTop.value}px';\n`;
  const markerIndex = source.lastIndexOf('\n}');
  if (markerIndex < 0) { status.textContent = 'Could not find createMenu function'; return; }
  jsEditor.setValue(`${source.slice(0, markerIndex)}${insertion}${source.slice(markerIndex)}`);
  applyJS();
}
function downloadFile(name, content) { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' })); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
function exportMenuFiles() { downloadFile('menu.js', jsEditor.getValue()); downloadFile('menu.css', cssEditor.getValue()); status.textContent = 'menu.js and menu.css exported'; }
async function importMenuFiles(event) { for (const file of event.target.files) { const content = await file.text(); if (file.name.endsWith('.css')) cssEditor.setValue(content); if (file.name.endsWith('.js')) jsEditor.setValue(content); } applyCSS(); applyJS(); status.textContent = 'Menu files imported'; event.target.value = ''; }
function applyCSS() { applyMenu(); status.textContent = 'menu.css applied'; }
function applyJS() { applyMenu(); }
function activateTab(name) { Object.entries(views).forEach(([key, view]) => { view.hidden = key !== name; tabs[key].classList.toggle('is-active', key === name); }); }
document.querySelector('#apply-menu-js').addEventListener('click', applyJS);
document.querySelector('#add-menu-button').addEventListener('click', addButtonTemplate);
document.querySelector('#add-menu-heading').addEventListener('click', addHeadingTemplate);
document.querySelector('#apply-element-position').addEventListener('click', applyElementPosition);
document.querySelector('#export-menu-files').addEventListener('click', exportMenuFiles);
document.querySelector('#import-menu-file').addEventListener('change', importMenuFiles);
document.querySelector('#apply-menu-css').addEventListener('click', () => { applyCSS(); status.textContent = 'menu.css applied'; });
tabs.js.addEventListener('click', () => activateTab('js')); tabs.css.addEventListener('click', () => activateTab('css'));
applyCSS(); applyJS();
