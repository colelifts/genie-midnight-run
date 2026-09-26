import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterKartVisual, type RaceVisual } from './characterKart';
import { makePluto } from './pluto';

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
  private pluto: THREE.Group | null = null;
  private glider: THREE.Group | null = null;
  private plutoPresent = true;
  private readonly wheels: THREE.Object3D[] = [];
  private disposed = false;
  private elapsed = 0;

  constructor(readonly id: ImportedRacer) {
    this.fallback = new CharacterKartVisual(id);
    this.group.add(this.fallback.group);
    if (templates) this.mount();
    else void loadImportedKarts().then((ready) => { if (ready && !this.disposed) this.mount(); });
    if (id === 'mickey') {
      void makePluto(1.62).then((pluto) => {
        if (!pluto || this.disposed) return;
        pluto.position.set(1.13, 0.72, -1.04);
        pluto.rotation.y = 0;
        pluto.visible = this.plutoPresent;
        this.pluto = pluto;
        this.group.add(pluto);
      });
      this.glider = this.makeGlider();
      this.group.add(this.glider);
    }
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
  setPlutoPresent(active: boolean) { this.plutoPresent = active; if (this.pluto) this.pluto.visible = active; }
  setGlider(active: boolean) { if (this.glider) this.glider.visible = active; }
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
    if (this.pluto) {
      this.pluto.position.y = 0.72 + Math.sin(this.elapsed * (boosting ? 10 : 4.5)) * 0.045;
      this.pluto.rotation.z = -steer * 0.065;
    }
    if (this.glider?.visible) this.glider.rotation.z = -steer * 0.1;
    if (this.importedDriver) {
      this.importedDriver.rotation.y = steer * 0.045;
      this.importedDriver.rotation.z = stunned ? Math.sin(this.elapsed * 12) * 0.13 : -steer * (drifting ? 0.055 : 0.025);
    }
  }

  dispose() {
    this.disposed = true;
    this.model?.removeFromParent();
    this.pluto?.removeFromParent();
    this.glider?.removeFromParent();
    this.fallback.dispose();
  }

  private makeGlider() {
    const root = new THREE.Group();
    root.visible = false;
    root.position.y = 4.45;
    const satin = new THREE.MeshStandardMaterial({ color: 0xd83144, side: THREE.DoubleSide, roughness: 0.48, metalness: 0.13, emissive: 0x52131a, emissiveIntensity: 0.18 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffdc7d, side: THREE.DoubleSide, roughness: 0.3, metalness: 0.72, emissive: 0x9b6122, emissiveIntensity: 0.21 });
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(side * 1.3, 0.76, side * 3.5, 0.05);
      shape.quadraticCurveTo(side * 3.0, -0.28, side * 1.15, -0.63);
      shape.closePath();
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape, 18), satin);
      wing.rotation.x = -0.36;
      wing.position.z = -0.4;
      root.add(wing);
      const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, -0.4), new THREE.Vector3(side * 1.3, 0.76, -0.4), new THREE.Vector3(side * 3.5, 0.05, -0.4)), 20, 0.065, 7, false), gold);
      root.add(edge);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.7, 7), gold);
      const from = new THREE.Vector3(side * 2.05, -0.05, -0.4);
      const to = new THREE.Vector3(side * 0.65, -3.2, 0.2);
      cable.position.copy(from).add(to).multiplyScalar(0.5);
      cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.sub(to).normalize());
      root.add(cable);
    }
    const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), gold);
    crest.position.y = 0.09;
    root.add(crest);
    return root;
  }
}
