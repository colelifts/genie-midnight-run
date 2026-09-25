import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterKartVisual, type RaceVisual } from './characterKart';

type ImportedRacer = 'mickey' | 'stitch';
type Templates = { kart: THREE.Group; stitch: THREE.Group };

let templates: Templates | null = null;
let loading: Promise<boolean> | null = null;

/** The kart is shared by Mickey and Stitch; only the driver changes. */
export function loadImportedKarts(): Promise<boolean> {
  if (templates) return Promise.resolve(true);
  if (loading) return loading;
  const draco = new DRACOLoader();
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loading = Promise.all([
    loader.loadAsync(`${import.meta.env.BASE_URL}models/mickey-kart.glb`),
    loader.loadAsync(`${import.meta.env.BASE_URL}models/stitch-driver.glb`),
  ]).then(([kart, stitch]) => {
    templates = { kart: kart.scene, stitch: stitch.scene };
    return true;
  }).catch((error) => {
    console.warn('Detailed Mickey and Stitch models unavailable; using the built-in racers.', error);
    return false;
  }).finally(() => draco.dispose());
  return loading;
}

export class ImportedKartVisual implements RaceVisual {
  readonly group = new THREE.Group();
  private readonly fallback: CharacterKartVisual;
  private model: THREE.Group | null = null;
  private importedDriver: THREE.Object3D | null = null;
  private readonly wheels: THREE.Object3D[] = [];
  private disposed = false;
  private elapsed = 0;

  constructor(readonly id: ImportedRacer) {
    this.fallback = new CharacterKartVisual(id);
    this.group.add(this.fallback.group);
    if (templates) this.mount();
    else void loadImportedKarts().then((ready) => { if (ready && !this.disposed) this.mount(); });
  }

  get driver(): THREE.Object3D { return this.importedDriver ?? this.fallback.driver; }

  private mount() {
    if (this.model || !templates || this.disposed) return;
    const kart = templates.kart.clone(true);
    const mickey = kart.getObjectByName('Driver');
    if (!mickey) return;
    if (this.id === 'stitch') {
      mickey.visible = false;
      const stitch = templates.stitch.clone(true);
      kart.add(stitch);
      this.importedDriver = stitch.getObjectByName('Stitch') ?? stitch;
    } else this.importedDriver = mickey;
    for (const name of ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) {
      const wheel = kart.getObjectByName(name);
      if (wheel) this.wheels.push(wheel);
    }
    kart.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.castShadow = false;
        part.receiveShadow = true;
      }
    });
    const model = new THREE.Group();
    model.rotation.y = Math.PI; // The source kart faces -Z; this course drives toward +Z.
    model.add(kart);
    this.fallback.hideBaseModel();
    this.model = model;
    this.group.add(model);
  }

  setShield(active: boolean) { this.fallback.setShield(active); }
  setOceanBarrier(active: boolean) { this.fallback.setOceanBarrier(active); }
  setUltimate(active: boolean) { this.fallback.setUltimate(active); }
  setStunned(active: boolean) { this.fallback.setStunned(active); }
  setGroundOffset(offset: number) { this.fallback.setGroundOffset(offset); }

  update(dt: number, speed: number, steer: number, drifting: boolean, boosting: boolean, stunned: boolean) {
    this.elapsed += dt;
    this.fallback.update(dt, speed, steer, drifting, boosting, stunned);
    if (!this.model) return;
    for (const wheel of this.wheels) wheel.rotation.x += speed * dt / 0.58;
    const lean = stunned ? Math.sin(this.elapsed * 12) * 0.11 : -steer * (drifting ? 0.12 : 0.06);
    this.model.rotation.z += (lean - this.model.rotation.z) * Math.min(1, dt * 7);
    this.model.position.y = this.fallback.body.position.y;
    if (this.importedDriver) {
      this.importedDriver.rotation.y = steer * 0.045;
      this.importedDriver.rotation.z = stunned ? Math.sin(this.elapsed * 12) * 0.13 : -steer * (drifting ? 0.055 : 0.025);
    }
  }

  dispose() {
    this.disposed = true;
    this.model?.removeFromParent();
    this.fallback.dispose();
  }
}
