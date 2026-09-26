import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterKartVisual, type RaceVisual } from './characterKart';
import { makePluto } from './pluto';

type ImportedRacer = 'mickey' | 'stitch' | 'maleficent' | 'moana' | 'buzz';
type Templates = { kart: THREE.Group; stitch: THREE.Group; maleficentKart: THREE.Group; moanaKart: THREE.Group; buzzKart: THREE.Group; dragon: THREE.Group };

let templates: Templates | null = null;
let loading: Promise<boolean> | null = null;

/** High-detail racers share a common rendering and animation pipeline. */
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
    loader.loadAsync(`${import.meta.env.BASE_URL}models/maleficent-kart.glb`),
    loader.loadAsync(`${import.meta.env.BASE_URL}models/moana-kart.glb`),
    loader.loadAsync(`${import.meta.env.BASE_URL}models/buzz-kart.glb`),
    loader.loadAsync(`${import.meta.env.BASE_URL}models/maleficent-dragon.glb`),
  ]).then(([kart, stitch, maleficentKart, moanaKart, buzzKart, dragon]) => {
    templates = { kart: kart.scene, stitch: stitch.scene, maleficentKart: maleficentKart.scene, moanaKart: moanaKart.scene, buzzKart: buzzKart.scene, dragon: dragon.scene };
    return true;
  }).catch((error) => {
    console.warn('Detailed racer models unavailable; using the built-in racers.', error);
    return false;
  }).finally(() => draco.dispose());
  return loading;
}

export class ImportedKartVisual implements RaceVisual {
  readonly group = new THREE.Group();
  private readonly fallback: CharacterKartVisual;
  private model: THREE.Group | null = null;
  private importedDriver: THREE.Object3D | null = null;
  private driverBaseYaw = 0;
  private pluto: THREE.Group | null = null;
  private plutoPerch: THREE.Group | null = null;
  private glider: THREE.Group | null = null;
  private dragon: THREE.Group | null = null;
  private dragonWingL: THREE.Object3D | null = null;
  private dragonWingR: THREE.Object3D | null = null;
  private buzzWings: THREE.Group | null = null;
  private readonly buzzWingPanels: THREE.Group[] = [];
  private buzzWingDeploy = 0;
  private plutoPresent = true;
  private ultimateActive = false;
  private readonly wheels: THREE.Object3D[] = [];
  private disposed = false;
  private elapsed = 0;

  constructor(readonly id: ImportedRacer) {
    this.fallback = new CharacterKartVisual(id);
    this.group.add(this.fallback.group);
    if (templates) this.mount();
    else void loadImportedKarts().then((ready) => { if (ready && !this.disposed) this.mount(); });
    if (id === 'mickey') {
      const perch = new THREE.Group();
      perch.position.set(0.66, 1.48, -1.39);
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.27, 0.24, 1.38), new THREE.MeshStandardMaterial({ color: 0x772733, roughness: 0.72 }));
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.09, 1.45), new THREE.MeshStandardMaterial({ color: 0xe0b451, metalness: 0.53, roughness: 0.38 }));
      trim.position.y = -0.13;
      perch.add(cushion, trim);
      this.plutoPerch = perch;
      this.group.add(perch);
      void makePluto(1.15).then((pluto) => {
        if (!pluto || this.disposed) return;
        pluto.position.set(0, 0.15, -0.07);
        pluto.rotation.y = 0;
        pluto.visible = this.plutoPresent;
        this.pluto = pluto;
        perch.add(pluto);
      });
      this.glider = this.makeGlider();
      this.group.add(this.glider);
    }
    if (id === 'buzz') {
      this.buzzWings = this.makeBuzzWings();
      this.group.add(this.buzzWings);
    }
  }

  get driver(): THREE.Object3D { return this.importedDriver ?? this.fallback.driver; }

  private mount() {
    if (this.model || !templates || this.disposed) return;
    const kart = (this.id === 'maleficent' ? templates.maleficentKart : this.id === 'moana' ? templates.moanaKart : this.id === 'buzz' ? templates.buzzKart : templates.kart).clone(true);
    const mickey = kart.getObjectByName(this.id === 'maleficent' ? 'Maleficent' : this.id === 'moana' ? 'Moana' : this.id === 'buzz' ? 'Buzz' : 'Driver');
    if (!mickey) return;
    if (this.id === 'stitch') {
      mickey.visible = false;
      const stitch = templates.stitch.clone(true);
      stitch.scale.multiplyScalar(0.94);
      kart.add(stitch);
      this.importedDriver = stitch.getObjectByName('Stitch') ?? stitch;
    } else this.importedDriver = mickey;
    this.driverBaseYaw = this.importedDriver.rotation.y;
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
    if (this.id === 'stitch') model.scale.setScalar(0.93);
    model.add(kart);
    this.fallback.hideBaseModel();
    this.model = model;
    this.group.add(model);
    if (this.id === 'maleficent' || this.id === 'moana' || this.id === 'buzz') {
      // Preserve the GLB scene's Blender-to-Three axis transform when lifting
      // the driver out of the imported chassis for independent animation.
      this.group.attach(mickey);
      this.driverBaseYaw = mickey.rotation.y;
    }
    if (this.id === 'maleficent') {
      const dragon = templates.dragon.clone(true);
      dragon.rotation.y = Math.PI;
      dragon.scale.setScalar(1.72);
      dragon.visible = false;
      this.dragon = dragon;
      this.dragonWingL = dragon.getObjectByName('Wing_L') ?? null;
      this.dragonWingR = dragon.getObjectByName('Wing_R') ?? null;
      this.group.add(dragon);
    }
    if (this.ultimateActive) this.setUltimate(true);
  }

  setShield(active: boolean) { this.fallback.setShield(active); }
  setOceanBarrier(active: boolean) { this.fallback.setOceanBarrier(active); }
  setUltimate(active: boolean) {
    this.ultimateActive = active;
    if (this.id === 'maleficent' && this.model && this.dragon) {
      this.model.visible = !active;
      if (this.importedDriver) this.importedDriver.visible = !active;
      this.dragon.visible = active;
      this.fallback.setUltimate(false);
    } else this.fallback.setUltimate(this.id === 'buzz' ? false : active);
    if (this.buzzWings && active) this.buzzWings.visible = true;
  }
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
    if (this.plutoPerch) this.plutoPerch.position.y = 1.48 + this.fallback.body.position.y;
    if (this.pluto) {
      this.pluto.position.y = 0.15 + Math.sin(this.elapsed * (boosting ? 10 : 4.5)) * 0.035;
      this.pluto.rotation.z = -steer * 0.065;
    }
    if (this.glider?.visible) this.glider.rotation.z = -steer * 0.1;
    if (this.buzzWings) {
      this.buzzWingDeploy += ((this.ultimateActive ? 1 : 0) - this.buzzWingDeploy) * Math.min(1, dt * 5);
      this.buzzWings.visible = this.buzzWingDeploy > 0.02;
      for (const panel of this.buzzWingPanels) panel.scale.x = Math.max(0.02, this.buzzWingDeploy);
      this.buzzWings.position.y = Math.sin(this.elapsed * 7) * 0.08 * this.buzzWingDeploy;
    }
    if (this.dragon?.visible) {
      this.dragon.position.y = 1.9 + Math.sin(this.elapsed * 5.7) * 0.23;
      this.dragon.rotation.z = -steer * (drifting ? 0.09 : 0.045);
      if (this.dragonWingL) this.dragonWingL.rotation.z = -0.13 + Math.sin(this.elapsed * 7.2) * 0.15;
      if (this.dragonWingR) this.dragonWingR.rotation.z = 0.13 - Math.sin(this.elapsed * 7.2) * 0.15;
    }
    if (this.importedDriver) {
      this.importedDriver.rotation.y = this.driverBaseYaw + steer * 0.045;
      this.importedDriver.rotation.z = stunned ? Math.sin(this.elapsed * 12) * 0.13 : -steer * (drifting ? 0.055 : 0.025);
    }
  }

  dispose() {
    this.disposed = true;
    this.model?.removeFromParent();
    this.pluto?.removeFromParent();
    this.plutoPerch?.removeFromParent();
    this.glider?.removeFromParent();
    this.dragon?.removeFromParent();
    this.buzzWings?.removeFromParent();
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

  private makeBuzzWings() {
    const root = new THREE.Group();
    root.visible = false;
    const enamel = new THREE.MeshStandardMaterial({ color: 0xe5f3f0, metalness: 0.34, roughness: 0.26, side: THREE.DoubleSide, emissive: 0x385e72, emissiveIntensity: 0.21 });
    const green = new THREE.MeshStandardMaterial({ color: 0x83db53, metalness: 0.23, roughness: 0.32, side: THREE.DoubleSide, emissive: 0x438f35, emissiveIntensity: 0.27 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xb4faff, toneMapped: false });
    for (const side of [-1, 1]) {
      const panel = new THREE.Group();
      panel.position.set(side * 0.77, 1.42, -0.88);
      const outline = new THREE.Shape();
      outline.moveTo(0, -0.5);
      outline.lineTo(side * 1.4, -0.75);
      outline.lineTo(side * 3.12, -0.28);
      outline.lineTo(side * 3.25, 0.35);
      outline.lineTo(side * 1.1, 0.18);
      outline.lineTo(0, 0.4);
      outline.closePath();
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(outline), enamel);
      wing.rotation.x = 0.68;
      panel.add(wing);
      const shell = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.16, 1.04), enamel);
      shell.position.set(side * 1.58, 0.14, -0.18);
      shell.rotation.z = side * 0.15;
      shell.rotation.y = side * -0.11;
      panel.add(shell);
      const inset = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.38), green);
      inset.position.set(side * 1.54, 0.28, -0.11);
      inset.rotation.y = side * -0.19;
      panel.add(inset);
      const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.25, 0.04, -0.5),
        new THREE.Vector3(side * 1.6, 0.06, -0.73),
        new THREE.Vector3(side * 3.13, 0.06, -0.27),
      ]), 20, 0.07, 7, false), glow);
      panel.add(edge);
      for (let n = 0; n < 3; n++) {
        const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glow);
        lamp.position.set(side * (1.15 + n * 0.68), 0.12, -0.28 + n * 0.12);
        panel.add(lamp);
      }
      root.add(panel);
      this.buzzWingPanels.push(panel);
    }
    return root;
  }
}
