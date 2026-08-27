export function generateSceneCode(sceneJSON) {
  const scriptImports = [...new Set((sceneJSON.objects || []).flatMap((objectJSON) => (objectJSON.scripts || []).map((script) => `import { ${script.export} } from './${script.path}';`)))];
  const shaderImports = (sceneJSON.objects || []).flatMap((objectJSON) => {
    const files = objectJSON.material?.shaderFiles;
    if (!files) return [];
    const variableName = `object_${objectJSON.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`;
    return [
      `import ${variableName}VertexShader from './${files.vertexPath}?raw';`,
      `import ${variableName}FragmentShader from './${files.fragmentPath}?raw';`,
    ];
  });
  const lines = [
    "import * as THREE from 'three';",
    "import * as CANNON from 'cannon-es';",
    ...shaderImports,
    ...scriptImports,
    "import { TriggerManager } from './triggers/TriggerManager.js';",
    ...(sceneJSON.splines?.length || sceneJSON.cutscenes?.length
      ? ["import { CutsceneManager } from './animation/CutsceneManager.js';"]
      : []),
    '',
    'export function createScene({ sceneManager = null, audioManager = null } = {}) {',
    '  const scene = new THREE.Scene();',
    `  scene.name = ${JSON.stringify(sceneJSON.metadata?.name || sceneJSON.id)};`,
    '',
    '  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);',
    `  camera.position.set(${sceneJSON.camera?.position?.join(', ') || '0, 2, 5'});`,
    `  camera.lookAt(${sceneJSON.camera?.target?.join(', ') || '0, 0, 0'});`,
    '  scene.add(camera);',
    '  const physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });',
    '',
  ];

  for (const light of sceneJSON.lights || []) {
    const variableName = `light_${light.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`;
    const constructor = light.type === 'hemisphere' ? 'HemisphereLight' : light.type === 'point' ? 'PointLight' : 'DirectionalLight';
    const args = light.type === 'hemisphere'
      ? `${JSON.stringify(light.skyColor || '#ffffff')}, ${JSON.stringify(light.groundColor || '#444444')}, ${light.intensity ?? 1}`
      : `${JSON.stringify(light.color || '#ffffff')}, ${light.intensity ?? 1}`;
    lines.push(`  const ${variableName} = new THREE.${constructor}(${args});`);
    if (light.position) lines.push(`  ${variableName}.position.set(${light.position.join(', ')});`);
    lines.push(`  ${variableName}.name = ${JSON.stringify(light.name || light.id)};`);
    if (light.castShadow) lines.push(`  ${variableName}.castShadow = true;`);
    lines.push(`  scene.add(${variableName});`, '');
  }

  for (const cameraJSON of sceneJSON.cameras || []) {
    const variableName = `camera_${cameraJSON.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`;
    lines.push(`  const ${variableName} = new THREE.PerspectiveCamera(${cameraJSON.fov ?? 50}, ${cameraJSON.aspect ?? 1}, ${cameraJSON.near ?? 0.1}, ${cameraJSON.far ?? 1000});`);
    lines.push(`  ${variableName}.name = ${JSON.stringify(cameraJSON.name || cameraJSON.id)};`);
    lines.push(`  ${variableName}.position.set(${(cameraJSON.position || [0, 2, 5]).join(', ')});`);
    lines.push(`  ${variableName}.lookAt(${(cameraJSON.target || [0, 0, 0]).join(', ')});`);
    if (cameraJSON.parent) lines.push(`  ${variableName}.userData.parentId = ${JSON.stringify(cameraJSON.parent)};`);
    lines.push(`  scene.add(${variableName});`, '');
  }

  for (const cameraJSON of sceneJSON.cameras || []) {
    if (!cameraJSON.parent) continue;
    const variableName = `camera_${cameraJSON.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`;
    lines.push(`  const ${variableName}Parent = scene.getObjectByProperty('userData.sceneObjectId', ${JSON.stringify(cameraJSON.parent)});`);
    lines.push(`  if (${variableName}Parent) ${variableName}Parent.attach(${variableName});`);
  }

  lines.push(
    '  const triggerManager = new TriggerManager(scene);',
    '  let transitionActive = false;',
    '  function switchSceneWithFade(sceneId) {',
    '    if (transitionActive || !sceneManager) return;',
    '    transitionActive = true;',
    '    const fade = document.createElement(\'div\');',
    '    Object.assign(fade.style, { position: \'fixed\', inset: \'0\', zIndex: \'9999\', background: \'#101820\', opacity: \'0\', transition: \'opacity 350ms ease\', pointerEvents: \'none\' });',
    '    document.body.append(fade);',
    '    requestAnimationFrame(() => { fade.style.opacity = \'1\'; });',
    '    window.setTimeout(() => {',
    '      sceneManager.switchTo(sceneId);',
    '      window.setTimeout(() => { fade.style.opacity = \'0\'; fade.addEventListener(\'transitionend\', () => fade.remove(), { once: true }); transitionActive = false; }, 350);',
    '    }, 350);',
    '  }',
    "  triggerManager.registerAction('switchScene', (params) => switchSceneWithFade(params.sceneId));",
    '',
  );

  for (const objectJSON of sceneJSON.objects) {
    const variableName = `object_${objectJSON.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`;
    const planeSize = objectJSON.physics?.size || [30, 0.2, 30];
    const geometry = objectJSON.type === 'plane'
      ? `new THREE.PlaneGeometry(${planeSize[0]}, ${planeSize[2]})`
      : objectJSON.type === 'sphere'
        ? 'new THREE.SphereGeometry(0.7, 24, 16)'
        : objectJSON.type === 'cylinder'
          ? 'new THREE.CylinderGeometry(0.6, 0.6, 1.4, 24)'
          : objectJSON.type === 'cone'
            ? 'new THREE.ConeGeometry(0.7, 1.4, 24)'
            : objectJSON.type === 'torus'
              ? 'new THREE.TorusGeometry(0.7, 0.22, 12, 32)'
              : 'new THREE.BoxGeometry(1, 1, 1)';
    const material = objectJSON.material || {};
    lines.push(`  const ${variableName}Geometry = ${geometry};`);
    const materialType = material.type || 'MeshStandardMaterial';
    if (materialType === 'ShaderMaterial' || materialType === 'RawShaderMaterial') {
      const shaderVariables = material.shaderFiles
        ? { vertex: `${variableName}VertexShader`, fragment: `${variableName}FragmentShader` }
        : { vertex: JSON.stringify(material.vertexShader || ''), fragment: JSON.stringify(material.fragmentShader || '') };
      lines.push(`  const ${variableName}Material = new THREE.${materialType}({ vertexShader: ${shaderVariables.vertex}, fragmentShader: ${shaderVariables.fragment}, opacity: ${material.opacity ?? 1}, transparent: ${material.transparent ?? false}, wireframe: ${material.wireframe ?? false} });`);
    } else {
      lines.push(`  const ${variableName}Material = new THREE.${materialType}({ color: ${JSON.stringify(material.color || '#ffffff')}, roughness: ${material.roughness ?? 0.5}, metalness: ${material.metalness ?? 0}, emissive: ${JSON.stringify(material.emissive || '#000000')}, emissiveIntensity: ${material.emissiveIntensity ?? 1}, opacity: ${material.opacity ?? 1}, transparent: ${material.transparent ?? false}, wireframe: ${material.wireframe ?? false}, flatShading: ${material.flatShading ?? false} });`);
    }
    lines.push(`  const ${variableName} = new THREE.Mesh(${variableName}Geometry, ${variableName}Material);`);
    lines.push(`  ${variableName}.userData.sceneObjectId = ${JSON.stringify(objectJSON.id)};`);
    lines.push(`  ${variableName}.name = ${JSON.stringify(objectJSON.name || objectJSON.id)};`);
    lines.push(`  ${variableName}.position.set(${objectJSON.position?.join(', ') || '0, 0, 0'});`);
    lines.push(`  ${variableName}.rotation.set(${objectJSON.rotation?.join(', ') || '0, 0, 0'});`);
    lines.push(`  ${variableName}.scale.set(${objectJSON.scale?.join(', ') || '1, 1, 1'});`);
    lines.push(`  scene.add(${variableName});`);
    for (const script of objectJSON.scripts || []) {
      const scriptVariable = `${variableName}_${script.export}`;
      lines.push(`  const ${scriptVariable} = new ${script.export}({ mesh: ${variableName}, physics: physicsWorld, camera, audioManager });`);
      lines.push(`  ${variableName}.userData.scripts = ${variableName}.userData.scripts || [];`);
      lines.push(`  ${variableName}.userData.scripts.push(${scriptVariable});`);
    }
    if (objectJSON.physics?.enabled) {
      const physics = objectJSON.physics;
      const size = physics.size || [1, 1, 1];
      const shape = physics.collider === 'sphere'
        ? `new CANNON.Sphere(${physics.radius ?? size[0] / 2})`
        : physics.collider === 'cylinder'
          ? `new CANNON.Cylinder(${physics.radius ?? size[0] / 2}, ${physics.radius ?? size[0] / 2}, ${physics.height ?? size[1]}, 8)`
          : `new CANNON.Box(new CANNON.Vec3(${size[0] / 2}, ${size[1] / 2}, ${size[2] / 2}))`;
      lines.push(`  const ${variableName}Body = new CANNON.Body({ mass: ${physics.mass ?? 0}, linearDamping: ${physics.linearDamping ?? 0.01}, angularDamping: ${physics.angularDamping ?? 0.01} });`);
      if (physics.collider === 'capsule') {
        lines.push(`  ${variableName}Body.addShape(new CANNON.Cylinder(${physics.radius ?? 0.5}, ${physics.radius ?? 0.5}, ${physics.height ?? 1}, 8));`);
        lines.push(`  ${variableName}Body.addShape(new CANNON.Sphere(${physics.radius ?? 0.5}), new CANNON.Vec3(0, ${(physics.height ?? 1) / 2}, 0));`);
        lines.push(`  ${variableName}Body.addShape(new CANNON.Sphere(${physics.radius ?? 0.5}), new CANNON.Vec3(0, -${(physics.height ?? 1) / 2}, 0));`);
      } else {
        lines.push(`  ${variableName}Body.addShape(${shape});`);
      }
      lines.push(`  ${variableName}Body.position.set(${objectJSON.position?.join(', ') || '0, 0, 0'});`);
      if (physics.velocity) lines.push(`  ${variableName}Body.velocity.set(${physics.velocity.join(', ')});`);
      lines.push(`  physicsWorld.addBody(${variableName}Body);`);
    }
    lines.push('');
  }

  for (const trigger of sceneJSON.triggers || []) {
    lines.push('  triggerManager.registerTrigger({');
    lines.push(`    id: ${JSON.stringify(trigger.id)},`);
    lines.push(`    type: ${JSON.stringify(trigger.type || 'box')},`);
    lines.push(`    position: [${(trigger.position || [0, 0, 0]).join(', ')}],`);
    lines.push(`    size: [${(trigger.size || [1, 1, 1]).join(', ')}],`);
    lines.push(`    action: ${JSON.stringify(trigger.action || '')},`);
    lines.push(`    params: ${JSON.stringify(trigger.params || {})},`);
    lines.push('  });');
  }
  if ((sceneJSON.splines || []).length || (sceneJSON.cutscenes || []).length) {
    lines.push('  const cutsceneManager = new CutsceneManager({ camera });');
    for (const spline of sceneJSON.splines || []) {
      const variableName = `spline_${spline.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`;
      const points = (spline.points || []).map((point) => `new THREE.Vector3(${point.join(', ')})`).join(', ');
      lines.push(`  const ${variableName} = new THREE.CatmullRomCurve3([${points}]);`);
      lines.push(`  // Spline name: ${JSON.stringify(spline.name || spline.id)}`);
      lines.push(`  cutsceneManager.registerSplineCurve(${JSON.stringify(spline.id)}, ${variableName});`);
    }
    for (const cutscene of sceneJSON.cutscenes || []) {
      lines.push('  cutsceneManager.registerCutscene({');
      lines.push(`    id: ${JSON.stringify(cutscene.id)},`);
      lines.push(`    name: ${JSON.stringify(cutscene.name || cutscene.id)},`);
      lines.push(`    duration: ${cutscene.duration ?? 0},`);
      lines.push('    tracks: [');
      for (const track of cutscene.tracks || []) {
        lines.push(`      { target: ${JSON.stringify(track.target)}, type: ${JSON.stringify(track.type)}, path: ${JSON.stringify(track.path)}, start: ${track.start ?? 0}, end: ${track.end ?? cutscene.duration ?? 0} },`);
      }
      lines.push('    ],', '  });');
      for (const event of cutscene.events || []) {
        if (event.type === 'audio') lines.push(`  if (audioManager) cutsceneManager.registerAudioEvent(${JSON.stringify(cutscene.id)}, ${JSON.stringify(event)});`);
      }
    }
    lines.push('');
  }
  lines.push(
    '  function updatePhysics(deltaTime) {',
    '    physicsWorld.step(1 / 60, deltaTime, 3);',
    '    // Copy each dynamic body transform to its matching Three.js mesh here.',
    '  }',
    '',
    '  // Pass the application SceneManager when creating this scene: createScene({ sceneManager }).',
    '  // Register named actions, then call triggerManager.update([playerMesh]) in your game loop.',
    '  // triggerManager.registerAction(\'onPlayerEnter\', (params, actor, trigger) => {',
    '  //   console.log(`${actor.name} entered ${trigger.id}`);',
    '  // });',
    '  // triggerManager.registerTrigger({ id: \'example\', type: \'box\', position: [0, 1, 0], size: [3, 2, 3], action: \'onPlayerEnter\' });',
    '',
  );
  const sceneAudio = sceneJSON.audio || { bgm: null, emitters: [] };
  if (sceneAudio.bgm?.path) lines.push(`  if (audioManager) audioManager.setBgm(${JSON.stringify(sceneAudio.bgm)});`);
  for (const emitter of sceneAudio.emitters || []) lines.push(`  if (audioManager) audioManager.registerEmitter(${JSON.stringify(emitter)});`);
  if (sceneAudio.bgm?.path || sceneAudio.emitters?.length) lines.push('');
  lines.push(
    `  return { scene, camera, physicsWorld, updatePhysics, triggerManager, switchSceneWithFade${(sceneJSON.splines || []).length || (sceneJSON.cutscenes || []).length ? ', cutsceneManager' : ''} };`,
    '}',
    '',
  );
  return lines.join('\n');
}
