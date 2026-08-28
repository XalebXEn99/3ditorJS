import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CannonAdapter } from '../src/physics/adapters/cannonAdapter.js';
import { createDefaultScene } from '../src/scene/sceneSchema.js';

test('default floor catches a new physics box at its visible resting height', () => {
  const scene = createDefaultScene();
  const floor = scene.objects.find((object) => object.id === 'floor');

  assert.deepEqual(floor.physics.size, [30, 0.2, 30]);
  assert.deepEqual(floor.physics.position, [0, -0.1, 0]);
  assert.deepEqual(floor.physics.rotation, [0, 0, 0]);

  const physics = new CannonAdapter();
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30));
  floorMesh.position.fromArray(floor.position);
  physics.addRigidBody(floorMesh, floor.physics);

  const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  boxMesh.position.set(0, 2, 0);
  physics.addRigidBody(boxMesh, { enabled: true, mass: 1, collider: 'box', size: [1, 1, 1] });

  for (let frame = 0; frame < 180; frame += 1) physics.stepPhysics(1 / 60);

  assert.ok(Math.abs(boxMesh.position.y - 0.5) < 0.08, `Expected resting height near 0.50, got ${boxMesh.position.y.toFixed(3)}`);
});