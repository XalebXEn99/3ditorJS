import * as THREE from 'three';

export class CutsceneManager {
  constructor({ camera, controls, onStateChange } = {}) {
    this.camera = camera;
    this.controls = controls;
    this.onStateChange = onStateChange;
    this.splines = new Map();
    this.cutscenes = new Map();
    this.active = null;
  }

  registerSpline(splineJSON) {
    const points = (splineJSON.points || []).map((point) => new THREE.Vector3(...point));
    if (points.length < 2) throw new Error('A spline requires at least two points.');
    this.splines.set(splineJSON.id, new THREE.CatmullRomCurve3(points));
  }

  registerSplineCurve(id, curve) {
    if (!id || !curve?.getPoint) throw new Error('A spline id and curve are required.');
    this.splines.set(id, curve);
  }

  registerCutscene(cutsceneJSON) {
    if (!cutsceneJSON?.id) throw new Error('Cutscene requires an id.');
    this.cutscenes.set(cutsceneJSON.id, structuredClone(cutsceneJSON));
  }

  clear() {
    this.splines.clear();
    this.cutscenes.clear();
    this.stop();
  }

  play(id) {
    const cutscene = this.cutscenes.get(id);
    if (!cutscene) throw new Error(`Unknown cutscene: ${id}`);
    this.active = { cutscene, elapsed: 0, paused: false };
    if (this.controls) this.controls.enabled = false;
    this.emitState('playing');
  }

  pause() {
    if (!this.active) return;
    this.active.paused = true;
    this.emitState('paused');
  }

  resume() {
    if (!this.active) return;
    this.active.paused = false;
    this.emitState('playing');
  }

  stop() {
    if (!this.active) return;
    this.active = null;
    if (this.controls) this.controls.enabled = true;
    this.emitState('stopped');
  }

  update(deltaTime) {
    if (!this.active || this.active.paused) return;
    const { cutscene } = this.active;
    this.active.elapsed = Math.min(cutscene.duration, this.active.elapsed + deltaTime);
    const progress = cutscene.duration === 0 ? 1 : this.active.elapsed / cutscene.duration;
    for (const track of cutscene.tracks || []) {
      if (track.target !== 'camera' || track.type !== 'spline') continue;
      const spline = this.splines.get(track.path);
      if (!spline) continue;
      const start = track.start ?? 0;
      const end = track.end ?? cutscene.duration;
      const trackProgress = THREE.MathUtils.clamp((this.active.elapsed - start) / (end - start), 0, 1);
      const point = spline.getPoint(trackProgress);
      this.camera.position.copy(point);
      this.camera.lookAt(0, 0.6, 0);
    }
    if (progress >= 1) this.stop();
  }

  emitState(state) {
    this.onStateChange?.(state, this.active?.cutscene?.id || null);
  }
}
