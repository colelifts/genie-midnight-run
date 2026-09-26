import * as THREE from 'three';

export const DRAGON_ULTIMATE_DURATION = 12;
const BREATH_DURATION = 1.0;

interface BreathRacer {
  id: number;
  position: THREE.Vector3;
  yaw: number;
}

interface Breath {
  owner: number;
  aimSign: number;
  age: number;
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  embers: THREE.Mesh[];
  light: THREE.PointLight;
  hit: Set<number>;
}

export interface BreathHit {
  owner: number;
  target: number;
  position: THREE.Vector3;
}

/** A short, wide, steerable cone attack rather than a traveling projectile. */
export class DragonBreath {
  private readonly breaths: Breath[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  get activeCount() { return this.breaths.length; }

  fire(owner: number, aimSign: number) {
    const group = new THREE.Group();
    const materials: THREE.MeshBasicMaterial[] = [];
    for (const [radius, length, color, opacity] of [
      [3.45, 19, 0x37ff76, 0.22],
      [2.4, 17.5, 0x7cff6c, 0.38],
      [1.22, 15.5, 0xe5ff9d, 0.58],
    ] as const) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 20, 4, true), material);
      flame.rotation.x = -Math.PI / 2;
      flame.position.z = length / 2;
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
    this.scene.add(group);
    this.breaths.push({ owner, aimSign, age: 0, group, materials, embers, light, hit: new Set() });
  }

  update(dt: number, racers: BreathRacer[]): BreathHit[] {
    const hits: BreathHit[] = [];
    for (let index = this.breaths.length - 1; index >= 0; index--) {
      const breath = this.breaths[index];
      breath.age += dt;
      const owner = racers[breath.owner];
      if (!owner || breath.age >= BREATH_DURATION) {
        this.dispose(index);
        continue;
      }
      const yaw = owner.yaw + (breath.aimSign < 0 ? Math.PI : 0);
      const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      breath.group.position.copy(owner.position).addScaledVector(forward, 3.1).add(new THREE.Vector3(0, 3.7, 0));
      breath.group.rotation.y = yaw;
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
        if (racer.id === owner.id || breath.hit.has(racer.id) || Math.abs(racer.position.y - owner.position.y) > 5) continue;
        const delta = racer.position.clone().sub(owner.position);
        const along = delta.dot(forward);
        const across = Math.abs(delta.dot(right));
        if (along < 2.5 || along > 21 || across > 1.25 + along * 0.23) continue;
        breath.hit.add(racer.id);
        hits.push({ owner: owner.id, target: racer.id, position: racer.position.clone() });
      }
    }
    return hits;
  }

  reset() {
    for (let index = this.breaths.length - 1; index >= 0; index--) this.dispose(index);
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
}
