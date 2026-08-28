import JSZip from 'jszip';
import { generateSceneCode } from '../scene/sceneCodeGenerator.js';
import triggerManagerSource from '../triggers/TriggerManager.js?raw';
import cutsceneManagerSource from '../animation/CutsceneManager.js?raw';
import audioManagerSource from '../audio/AudioManager.js?raw';

function collectScriptPaths(sceneJSON) {
  const paths = new Set();
  for (const objectJSON of sceneJSON.objects || []) {
    for (const script of objectJSON.scripts || []) paths.add(script.path);
  }
  return paths;
}

function collectShaderPaths(sceneJSON) {
  const paths = new Set();
  for (const objectJSON of sceneJSON.objects || []) {
    const files = objectJSON.material?.shaderFiles;
    if (files) {
      paths.add(files.vertexPath);
      paths.add(files.fragmentPath);
    }
  }
  return paths;
}

function collectAudioPaths(sceneJSON) {
  const paths = new Set();
  const audio = sceneJSON.audio || {};
  if (audio.bgm?.path) paths.add(audio.bgm.path);
  for (const emitter of audio.emitters || []) if (emitter.path) paths.add(emitter.path);
  for (const cutscene of sceneJSON.cutscenes || []) {
    for (const event of cutscene.events || []) if (event.type === 'audio' && event.path) paths.add(event.path);
  }
  return paths;
}

function buildReadme(sceneJSON, { hasCutscenes, hasAudio }) {
  const lines = [
    `3ditorJS scene export: ${sceneJSON.metadata?.name || sceneJSON.id}`,
    '',
    'Install the runtime dependencies this scene uses:',
    '  npm install three cannon-es',
    '',
    'Drop this folder into your Three.js project, then:',
    "  import { createScene } from './scene.js';",
    hasAudio ? "  import { AudioManager } from './audio/AudioManager.js';" : null,
    '',
    hasAudio
      ? '  const audioManager = new AudioManager({ camera, getFile: (path) => ({ content: /* resolve path to a URL or Blob */ path }) });'
      : '  // No audio manager is required for this scene.',
    `  const { scene, camera, physicsWorld, updatePhysics${hasCutscenes ? ', cutsceneManager' : ''} } = createScene({${hasAudio ? ' audioManager' : ''} });`,
    '',
    'In your render loop, call:',
    '  updatePhysics(deltaTime);',
    hasCutscenes ? '  cutsceneManager.update(deltaTime);' : null,
  ].filter((line) => line !== null);
  return lines.join('\n');
}

/**
 * Builds a downloadable zip containing the generated scene.js plus every
 * helper module, script, shader, and audio file it references, so the scene
 * can be dropped straight into a regular Three.js project.
 */
export async function buildSceneExportZip(sceneJSON, sceneAssets) {
  const zip = new JSZip();
  zip.file('scene.js', generateSceneCode(sceneJSON));
  zip.file('triggers/TriggerManager.js', triggerManagerSource);

  const hasCutscenes = Boolean(sceneJSON.splines?.length || sceneJSON.cutscenes?.length);
  if (hasCutscenes) zip.file('animation/CutsceneManager.js', cutsceneManagerSource);

  for (const path of collectScriptPaths(sceneJSON)) {
    const file = sceneAssets.get(path);
    if (file) zip.file(path, file.content || '');
  }

  for (const path of collectShaderPaths(sceneJSON)) {
    const file = sceneAssets.get(path);
    if (file) zip.file(path, file.content || '');
  }

  const audioPaths = collectAudioPaths(sceneJSON);
  if (audioPaths.size) zip.file('audio/AudioManager.js', audioManagerSource);
  for (const path of audioPaths) {
    const file = sceneAssets.get(path);
    if (file?.content) zip.file(path, file.content);
  }

  zip.file('README.txt', buildReadme(sceneJSON, { hasCutscenes, hasAudio: audioPaths.size > 0 }));

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
