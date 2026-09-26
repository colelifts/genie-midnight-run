import * as THREE from 'three';
import type { RaceTrack } from './track';

export const DRAGON_ULTIMATE_DURATION = 12;
export const DRAGON_FIRE_DURATION = 3;
export const DRAGON_FIRE_RANGE = 42;
const BREATH_DURATION = 0.48;
const SCORCH_AFTERGLOW_DURATION = 2.2;

interface BreathRacer {
  id: number;
  position: THREE.Vector3;
  yaw: number;
}

interface Breath {
  owner: number;
  age: number;
  origin: THREE.Vector3;
  forward: THREE.Vector3;
  right: THREE.Vector3;
  length: number;
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  embers: THREE.Mesh[];
  light: THREE.PointLight;
  hit: Set<number>;
}

interface BurnMark {
  owner: number;
  age: number;
  delay: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
  floor: THREE.MeshBasicMaterial;
  scorch: THREE.MeshBasicMaterial;
  rim: THREE.MeshBasicMaterial;
  veins: THREE.MeshBasicMaterial;
  flames: THREE.MeshBasicMaterial[];
  hit: Set<number>;
}

interface ScorchedKart {
  group: THREE.Group;
  flames: THREE.MeshBasicMaterial;
  soot: THREE.MeshBasicMaterial;
  embers: THREE.Mesh[];
  light: THREE.PointLight;
  time: number;
}

export interface BreathHit {
  owner: number;
  target: number;
  position: THREE.Vector3;
  kind: 'breath' | 'fire';
}

/** A short, wide, steerable cone attack rather than a traveling projectile. */
export class DragonBreath {
  private readonly breaths: Breath[] = [];
  private readonly marks: BurnMark[] = [];
  private readonly scorched = new Map<number, ScorchedKart>();

  constructor(private readonly scene: THREE.Scene) {}

  get activeCount() { return this.breaths.length; }
  get fireCount() { return this.marks.filter((mark) => mark.age >= mark.delay && mark.age - mark.delay < DRAGON_FIRE_DURATION).length; }
  get fireLifetimes() { return this.marks.filter((mark) => mark.age >= mark.delay && mark.age - mark.delay < DRAGON_FIRE_DURATION).map((mark) => Number((DRAGON_FIRE_DURATION - mark.age + mark.delay).toFixed(2))); }
  get scorchedCount() { return [...this.scorched.values()].filter((effect) => effect.time > 0).length; }

  scorchKart(racer: BreathRacer & { visual: { group: THREE.Group } }) {
    let effect = this.scorched.get(racer.id);
    if (!effect) {
      const group = new THREE.Group();
      const flames = new THREE.MeshBasicMaterial({ color: 0x7cff56, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
      const soot = new THREE.MeshBasicMaterial({ color: 0x151221, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const stain = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 6), soot);
        stain.position.set(side * 1.05, 0.75, end * 0.82);
        stain.scale.set(1.2, 0.14, 0.7);
        group.add(stain);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.15, 8, 3, true), flames);
        flame.position.set(side * 1.13, 1.18, end * 0.85);
        flame.rotation.z = side * 0.2;
        group.add(flame);
      }
      const embers: THREE.Mesh[] = [];
      for (let i = 0; i < 7; i++) {
        const ember = new THREE.Mesh(new THREE.OctahedronGeometry(0.075 + (i % 3) * 0.027, 0), flames);
        ember.position.set(Math.sin(i * 2.9) * 1.25, 1.1 + (i % 3) * 0.4, Math.cos(i * 3.7) * 1.1);
        group.add(ember);
        embers.push(ember);
      }
      const light = new THREE.PointLight(0x88ff67, 0, 6, 2);
      light.position.y = 1.1;
      group.add(light);
      effect = { group, flames, soot, embers, light, time: 0 };
      this.scorched.set(racer.id, effect);
    }
    if (effect.group.parent !== racer.visual.group) racer.visual.group.add(effect.group);
    effect.time = 1.75;
    effect.group.visible = true;
  }

  fire(owner: number, origin: THREE.Vector3, target: THREE.Vector3, track: RaceTrack) {
    const displacement = target.clone().sub(origin).setY(0);
    if (displacement.lengthSq() < 1) return;
    const length = Math.min(DRAGON_FIRE_RANGE, displacement.length());
    const forward = displacement.normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const yaw = Math.atan2(forward.x, forward.z);
    const group = new THREE.Group();
    const materials: THREE.MeshBasicMaterial[] = [];
    for (const [radius, beamLength, color, opacity] of [
      [3.8, length, 0x37ff76, 0.27],
      [2.6, length * 0.96, 0x7cff6c, 0.44],
      [1.35, length * 0.91, 0xe5ff9d, 0.66],
    ] as const) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(radius, beamLength, 20, 4, true), material);
      flame.rotation.x = Math.PI / 2;
      flame.position.z = beamLength / 2;
      flame.rotation.z = materials.length * 1.73;
      group.add(flame);
      materials.push(material);
    }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 10), new THREE.MeshBasicMaterial({ color: 0xc8ff75, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    group.add(mouth);
    const embers: THREE.Mesh[] = [];
    for (let index = 0; index < 21; index++) {
      const bright = index % 3 === 0;
      const ember = new THREE.Mesh(
        new THREE.IcosahedronGeometry(bright ? 0.28 : 0.16, 0),
        new THREE.MeshBasicMaterial({ color: bright ? 0xeeffae : index % 2 ? 0x7dff79 : 0x46e69a, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      );
      const along = 2.2 + (index / 20) * 17;
      const spread = 0.38 + along * 0.16;
      ember.position.set(Math.sin(index * 12.7) * spread, Math.cos(index * 8.9) * spread * 0.7, along);
      group.add(ember);
      embers.push(ember);
    }
    const light = new THREE.PointLight(0x9bff80, 3.6, 19, 2);
    light.position.z = 5;
    group.add(light);
    group.position.copy(origin).addScaledVector(forward, 2.6).add(new THREE.Vector3(0, 3.8, 0));
    group.rotation.y = yaw;
    group.rotation.x = 0.1;
    const castHit = new Set<number>();
    this.scene.add(group);
    this.breaths.push({ owner, age: 0, origin: origin.clone(), forward, right, length, group, materials, embers, light, hit: castHit });
    for (let along = 4; along <= length + 1; along += 4.2) {
      const probe = origin.clone().addScaledVector(forward, Math.min(along, length));
      const road = track.nearest(probe);
      if (!road.onRoad || Math.abs(road.lateral) > road.point.width / 2 - 1.5 || Math.abs(probe.y - road.point.position.y) > 4) continue;
      probe.y = road.point.position.y + 0.16;
      const mesh = new THREE.Group();
      mesh.position.copy(probe);
      const scorch = new THREE.MeshBasicMaterial({ color: 0x170e25, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });
      const scorchDisk = new THREE.Mesh(new THREE.CircleGeometry(3.6, 22), scorch);
      scorchDisk.rotation.x = -Math.PI / 2;
      scorchDisk.position.y = -0.03;
      mesh.add(scorchDisk);
      const floor = new THREE.MeshBasicMaterial({ color: 0x56ff63, transparent: true, opacity: 0.58, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
      const disk = new THREE.Mesh(new THREE.CircleGeometry(3.35, 24), floor);
      disk.rotation.x = -Math.PI / 2;
      mesh.add(disk);
      const rim = new THREE.MeshBasicMaterial({ color: 0xd6ff80, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const bright = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.19, 6, 24), rim);
      bright.rotation.x = Math.PI / 2;
      bright.position.y = 0.1;
      mesh.add(bright);
      const veins = new THREE.MeshBasicMaterial({ color: 0x93ff68, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      for (let crack = 0; crack < 4; crack++) {
        const angle = crack * Math.PI / 2 + along * 0.19;
        const path = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(angle) * 0.55, 0.07, Math.sin(angle) * 0.55),
          new THREE.Vector3(Math.cos(angle + 0.22) * 1.5, 0.07, Math.sin(angle + 0.22) * 1.5),
          new THREE.Vector3(Math.cos(angle - 0.1) * 2.85, 0.07, Math.sin(angle - 0.1) * 2.85),
        ]);
        mesh.add(new THREE.Mesh(new THREE.TubeGeometry(path, 9, 0.075, 5, false), veins));
      }
      const flames: THREE.MeshBasicMaterial[] = [];
      for (let part = 0; part < 5; part++) {
        const flameMaterial = new THREE.MeshBasicMaterial({ color: part % 2 ? 0x98ff65 : 0xcfff80, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
        const tongue = new THREE.Mesh(new THREE.ConeGeometry(part % 2 ? 0.7 : 0.95, 2.3 + part % 3, 7), flameMaterial);
        tongue.position.set(Math.cos(part * 2.4) * 1.5, 1.2, Math.sin(part * 2.4) * 1.5);
        tongue.rotation.z = Math.sin(part * 2.7) * 0.3;
        mesh.add(tongue);
        flames.push(flameMaterial);
      }
      mesh.visible = false;
      this.scene.add(mesh);
      this.marks.push({ owner, age: 0, delay: along / 60, position: probe, mesh, floor, scorch, rim, veins, flames, hit: castHit });
    }
  }

  update(dt: number, racers: BreathRacer[]): BreathHit[] {
    const hits: BreathHit[] = [];
    for (const effect of this.scorched.values()) {
      effect.time = Math.max(0, effect.time - dt);
      const strength = Math.min(1, effect.time * 2.1);
      effect.group.visible = strength > 0.01;
      effect.flames.opacity = (0.55 + Math.sin(effect.time * 23) * 0.12) * strength;
      effect.soot.opacity = 0.48 * strength;
      effect.light.intensity = 1.65 * strength;
      effect.embers.forEach((ember, index) => {
        ember.position.y = 1.1 + (index % 3) * 0.4 + Math.sin(effect.time * 8 + index) * 0.24;
      });
    }
    for (let index = this.breaths.length - 1; index >= 0; index--) {
      const breath = this.breaths[index];
      breath.age += dt;
      if (breath.age >= BREATH_DURATION) {
        this.dispose(index);
        continue;
      }
      const grow = Math.min(1, breath.age / 0.14);
      const fade = Math.min(1, (BREATH_DURATION - breath.age) / 0.2);
      breath.group.scale.set(0.7 + Math.sin(breath.age * 42) * 0.08, 0.8 + Math.sin(breath.age * 37) * 0.09, grow);
      breath.materials.forEach((material, layer) => { material.opacity = [0.22, 0.38, 0.58][layer] * fade; });
      breath.light.intensity = 3.6 * fade;
      breath.embers.forEach((ember, index) => {
        ember.position.x += Math.sin(breath.age * 31 + index * 2.6) * dt * 0.8;
        ember.position.y += Math.cos(breath.age * 28 + index * 3.1) * dt * 0.55;
        ember.position.z += dt * (3.5 + index % 4);
        (ember.material as THREE.MeshBasicMaterial).opacity = 0.86 * fade;
      });
      if (breath.age < 0.16) continue;
      for (const racer of racers) {
        if (racer.id === breath.owner || breath.hit.has(racer.id) || Math.abs(racer.position.y - breath.origin.y) > 5) continue;
        const delta = racer.position.clone().sub(breath.origin);
        const along = delta.dot(breath.forward);
        const across = Math.abs(delta.dot(breath.right));
        if (along < 2.5 || along > breath.length * grow || across > 1.5 + along * 0.18) continue;
        breath.hit.add(racer.id);
        hits.push({ owner: breath.owner, target: racer.id, position: racer.position.clone(), kind: 'breath' });
      }
    }
    for (let index = this.marks.length - 1; index >= 0; index--) {
      const mark = this.marks[index];
      mark.age += dt;
      const burning = mark.age - mark.delay;
      if (burning < 0) continue;
      if (burning >= DRAGON_FIRE_DURATION + SCORCH_AFTERGLOW_DURATION) { this.disposeMark(index); continue; }
      mark.mesh.visible = true;
      if (burning >= DRAGON_FIRE_DURATION) {
        const afterglow = 1 - (burning - DRAGON_FIRE_DURATION) / SCORCH_AFTERGLOW_DURATION;
        mark.floor.opacity = 0;
        mark.rim.opacity = 0;
        mark.veins.opacity = 0.42 * afterglow;
        mark.scorch.opacity = 0.68 * afterglow;
        mark.flames.forEach((material) => { material.opacity = 0; });
        continue;
      }
      const fade = Math.min(1, burning * 5, (DRAGON_FIRE_DURATION - burning) * 1.9);
      mark.floor.opacity = 0.58 * fade;
      mark.rim.opacity = 0.72 * fade;
      mark.veins.opacity = 0.7 * fade;
      mark.scorch.opacity = 0.78;
      mark.flames.forEach((material, part) => { material.opacity = (0.67 + Math.sin(burning * 18 + part * 2.1) * 0.16) * fade; });
      for (const racer of racers) {
        if (racer.id === mark.owner || mark.hit.has(racer.id) || Math.abs(racer.position.y - mark.position.y) > 2.8) continue;
        if (Math.hypot(racer.position.x - mark.position.x, racer.position.z - mark.position.z) > 4.1) continue;
        mark.hit.add(racer.id);
        hits.push({ owner: mark.owner, target: racer.id, position: racer.position.clone(), kind: 'fire' });
      }
    }
    return hits;
  }

  reset() {
    for (let index = this.breaths.length - 1; index >= 0; index--) this.dispose(index);
    for (let index = this.marks.length - 1; index >= 0; index--) this.disposeMark(index);
    for (const effect of this.scorched.values()) {
      effect.group.removeFromParent();
      effect.group.traverse((part) => {
        if (part instanceof THREE.Mesh) {
          part.geometry.dispose();
          (part.material as THREE.Material).dispose();
        }
      });
    }
    this.scorched.clear();
  }

  private dispose(index: number) {
    const [breath] = this.breaths.splice(index, 1);
    this.scene.remove(breath.group);
    breath.group.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.geometry.dispose();
        (part.material as THREE.Material).dispose();
      }
    });
  }

  private disposeMark(index: number) {
    const [mark] = this.marks.splice(index, 1);
    this.scene.remove(mark.mesh);
    mark.mesh.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.geometry.dispose();
        (part.material as THREE.Material).dispose();
      }
    });
  }
}
