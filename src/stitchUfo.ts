import * as THREE from 'three';
import type { RaceTrack } from './track';

export interface UfoRacer {
  id: number;
  position: THREE.Vector3;
  progress: number;
  moveYaw: number;
  speed: number;
}

export interface UfoImpact {
  kind: 'bombardment' | 'beam';
  position: THREE.Vector3;
  previous?: THREE.Vector3;
  radius: number;
}

export type UfoPhase = 'none' | 'inbound' | 'tracking' | 'locked' | 'sweep' | 'beam';

interface WarningMark {
  target: number;
  position: THREE.Vector3;
  impactAt: number;
  lockAt: number;
  locked: boolean;
  group: THREE.Group;
  ring: THREE.Mesh;
  materials: THREE.MeshBasicMaterial[];
  bolt: THREE.Group;
  nextTrackAt: number;
  radius: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrap = (value: number) => ((value % 1) + 1) % 1;
const BOMB_RADIUS = 5.2;
export const STITCH_UFO_DURATION = 9.4;

function makeShip() {
  const ship = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const palette = {
    shell: new THREE.MeshStandardMaterial({ color: 0xd85b57, metalness: 0.45, roughness: 0.25 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xf3e5c7, metalness: 0.25, roughness: 0.3 }),
    navy: new THREE.MeshStandardMaterial({ color: 0x122b49, metalness: 0.7, roughness: 0.25 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x718797, metalness: 0.8, roughness: 0.23 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xcd9d55, metalness: 0.65, roughness: 0.27 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x135b79, metalness: 0.65, roughness: 0.13, emissive: 0x07172d, emissiveIntensity: 0.4 }),
    light: new THREE.MeshBasicMaterial({ color: 0x65f5ff, toneMapped: false }),
    violet: new THREE.MeshBasicMaterial({ color: 0x9273ff, toneMapped: false }),
  };
  type Finish = keyof typeof palette;
  const oval = (x: number, y: number, z: number, sx: number, sy: number, sz: number, finish: Finish) => {
    const mesh = new THREE.Mesh(sphere, palette[finish]);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = finish !== 'light' && finish !== 'violet';
    ship.add(mesh);
    return mesh;
  };
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, finish: Finish) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), palette[finish]);
    mesh.position.set(x, y, z);
    mesh.castShadow = finish !== 'light';
    ship.add(mesh);
    return mesh;
  };
  oval(0, -0.3, 0, 5.3, 1.25, 4.5, 'navy');
  oval(0, 0.4, 0, 5.4, 1.15, 4.5, 'shell');
  oval(0, 1, 0.15, 4.55, 0.65, 3.3, 'cream');
  oval(0, 1.15, -2.5, 2.9, 0.68, 1.5, 'navy');
  oval(0, 1.22, -2.65, 2.62, 0.6, 1.24, 'glass');
  oval(0, 0.05, -4, 2.65, 0.6, 1.1, 'shell');
  box(0, -0.12, -4.78, 3.5, 0.16, 0.1, 'light');
  for (const side of [-1, 1]) {
    oval(side * 5.7, -0.1, 0.9, 2.9, 0.38, 3.7, 'cream');
    oval(side * 6.7, -0.35, 0.8, 1.55, 1.05, 3.55, 'shell');
    oval(side * 6.7, -0.1, -1.7, 1.25, 0.82, 1.05, 'navy');
    box(side * 6.7, 0.7, 2.3, 0.3, 2.1, 2.4, 'cream').rotation.z = -side * 0.18;
    box(side * 4.2, 0.5, 3.1, 2.9, 0.13, 0.5, 'light');
    for (const z of [-0.8, 0.6, 2]) {
      oval(side * 6.7, -1.3, z, 0.74, 0.55, 0.74, 'steel');
      oval(side * 6.7, -1.66, z, 0.51, 0.27, 0.51, 'light');
    }
    for (let n = 0; n < 6; n++) {
      const angle = n / 5 * Math.PI;
      oval(side * (4.7 + Math.sin(angle) * 0.45), -0.25, Math.cos(angle) * 3.65, 0.11, 0.11, 0.11, 'gold');
    }
  }
  for (const x of [-2.8, 0, 2.8]) {
    oval(x, -1.25, -0.2, 1.05, 0.6, 1.05, 'steel');
    oval(x, -1.83, -0.2, 0.68, 0.55, 0.68, 'navy');
    oval(x, -2.22, -0.2, 0.5, 0.25, 0.5, 'violet');
    oval(x, -2.42, -0.2, 0.23, 0.06, 0.23, 'light');
  }
  for (const x of [-1.5, 0, 1.5]) box(x, 1.48, -3.15, 0.12, 0.62, 1, 'gold');
  for (const z of [0, 1, 2]) box(0, 1.66, z, 2.3, 0.09, 0.2, 'navy');
  const label = document.createElement('canvas');
  label.width = 256; label.height = 96;
  const context = label.getContext('2d')!;
  context.font = '900 70px Impact, sans-serif';
  context.textAlign = 'center';
  context.lineWidth = 7;
  context.strokeStyle = '#122b49';
  context.fillStyle = '#fff0ca';
  context.strokeText('626', 128, 73);
  context.fillText('626', 128, 73);
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.24), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(label), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  emblem.position.set(0, 0.35, 4.52);
  ship.add(emblem);
  ship.scale.setScalar(1.3);
  ship.visible = false;
  return ship;
}

function makeWarning(position: THREE.Vector3, target: number, impactAt: number): WarningMark {
  const group = new THREE.Group();
  group.position.copy(position);
  const materials: THREE.MeshBasicMaterial[] = [];
  const material = (opacity: number) => {
    const result = new THREE.MeshBasicMaterial({ color: 0xffd274, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    materials.push(result);
    return result;
  };
  const disk = new THREE.Mesh(new THREE.CircleGeometry(BOMB_RADIUS, 40), material(0.18));
  disk.rotation.x = -Math.PI / 2;
  group.add(disk);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(BOMB_RADIUS, 0.15, 8, 48), material(0.95));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(BOMB_RADIUS * 0.61, 0.07, 6, 40), material(0.7));
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 0.06;
  group.add(inner);
  for (const rotation of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.17), material(0.7));
    bar.rotation.set(-Math.PI / 2, 0, rotation);
    bar.position.y = 0.07;
    group.add(bar);
  }
  const bolt = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshBasicMaterial({ color: 0x7ff6ff, toneMapped: false }));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), new THREE.MeshBasicMaterial({ color: 0xa963ff, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }));
  shell.scale.y = 2.2;
  bolt.add(core, shell);
  bolt.visible = false;
  return { target, position: position.clone(), impactAt, lockAt: impactAt - 0.55, locked: false, group, ring, materials, bolt, nextTrackAt: 0, radius: BOMB_RADIUS };
}

export class StitchUfo {
  readonly ship = makeShip();
  private readonly marks: WarningMark[] = [];
  private readonly sweep = new THREE.Group();
  private readonly sweepFloor: THREE.Mesh;
  private readonly beamCore: THREE.Mesh;
  private readonly beamShell: THREE.Mesh;
  private readonly beamRing: THREE.Mesh;
  private readonly beamLight: THREE.PointLight;
  private ownerId = -1;
  private age = 0;
  private nextWave = 0;
  private beamWarned = false;
  private beamHalfWidth = 0;
  private beamCenter = new THREE.Vector3();
  private beamRight = new THREE.Vector3(1, 0, 0);
  private beamPrevious = new THREE.Vector3();
  private beamFireAt = 0;
  private beamDone = false;

  constructor(private readonly scene: THREE.Scene, private readonly track: RaceTrack) {
    scene.add(this.ship);
    const gold = new THREE.MeshBasicMaterial({ color: 0xffc96a, transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.sweepFloor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gold);
    this.sweepFloor.rotation.x = -Math.PI / 2;
    this.sweep.add(this.sweepFloor);
    for (let n = -5; n <= 5; n++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 5.8), new THREE.MeshBasicMaterial({ color: 0xffe6a3, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(n, 0.05, 0);
      this.sweep.add(stripe);
    }
    this.sweep.visible = false;
    scene.add(this.sweep);
    const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
    this.beamCore = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: 0x8af8ff, transparent: true, opacity: 0.84, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.beamShell = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: 0x825dff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.beamRing = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.2, 8, 40), new THREE.MeshBasicMaterial({ color: 0xa6faff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    this.beamRing.rotation.x = Math.PI / 2;
    this.beamLight = new THREE.PointLight(0x70dfff, 0, 15, 2);
    scene.add(this.beamCore, this.beamShell, this.beamRing, this.beamLight);
    this.hideBeam();
  }

  get active() { return this.ownerId >= 0; }
  get owner() { return this.ownerId; }
  get elapsed() { return this.age; }
  get warnings() { return this.marks.length; }

  start(owner: number, racers: UfoRacer[]) {
    if (this.active) return false;
    this.reset();
    const caster = racers[owner];
    if (!caster) return false;
    this.ownerId = owner;
    this.age = 0;
    this.ship.visible = true;
    const right = new THREE.Vector3(Math.cos(caster.moveYaw), 0, -Math.sin(caster.moveYaw));
    this.ship.position.copy(caster.position).addScaledVector(right, 58).add(new THREE.Vector3(0, 36, -22));
    return true;
  }

  private roadPoint(racer: UfoRacer, lead: number) {
    const predicted = racer.position.clone().add(new THREE.Vector3(Math.sin(racer.moveYaw) * racer.speed * lead, 0, Math.cos(racer.moveYaw) * racer.speed * lead));
    const road = this.track.nearest(predicted, racer.progress);
    const half = road.point.width / 2;
    return road.point.position.clone().addScaledVector(road.point.right, clamp(road.lateral, -half + 4, half - 4)).add(new THREE.Vector3(0, 0.14, 0));
  }

  private updateShip(dt: number, racers: UfoRacer[]) {
    const caster = racers[this.ownerId];
    if (!caster) return;
    let leader = caster;
    let lead = 0;
    for (const peer of racers) {
      if (peer.id === caster.id) continue;
      const ahead = wrap(peer.progress - caster.progress) * this.track.length;
      if (ahead > lead && ahead < 120) { lead = ahead; leader = peer; }
    }
    const point = this.track.at(wrap(caster.progress + (lead + 32 + Math.min(leader.speed, 80) * 0.45) / this.track.length));
    const desired = point.position.clone().add(new THREE.Vector3(0, 18, 0));
    this.ship.position.lerp(desired, 1 - Math.exp(-dt * 4));
    const desiredYaw = Math.atan2(point.tangent.x, point.tangent.z);
    const deltaYaw = Math.atan2(Math.sin(desiredYaw - this.ship.rotation.y), Math.cos(desiredYaw - this.ship.rotation.y));
    this.ship.rotation.y += deltaYaw * (1 - Math.exp(-dt * 5));
    this.ship.rotation.z = Math.sin(this.age * 1.7) * 0.025;
    this.ship.position.y += Math.sin(this.age * 2) * 0.008;
  }

  private addWave(racers: UfoRacer[], wave: number) {
    const caster = racers[this.ownerId];
    if (!caster) return;
    const rivals = racers.filter((racer) => racer.id !== this.ownerId).sort((a, b) => a.position.distanceToSquared(caster.position) - b.position.distanceToSquared(caster.position));
    for (let slot = 0; slot < rivals.length; slot++) {
      const target = rivals[(wave + slot) % rivals.length];
      const impactAt = 1.6 + wave * 0.75 + 1.4;
      const mark = makeWarning(this.roadPoint(target, 1.4), target.id, impactAt);
      this.marks.push(mark);
      this.scene.add(mark.group, mark.bolt);
    }
  }

  private beginSweep(racers: UfoRacer[]) {
    const caster = racers[this.ownerId];
    if (!caster) return;
    const target = racers.filter((racer) => racer.id !== this.ownerId).sort((a, b) => a.position.distanceToSquared(caster.position) - b.position.distanceToSquared(caster.position))[0];
    if (!target) return;
    const position = this.roadPoint(target, 2);
    const road = this.track.nearest(position, target.progress);
    this.beamCenter.copy(road.point.position).add(new THREE.Vector3(0, 0.16, 0));
    this.beamRight.copy(road.point.right);
    this.beamHalfWidth = Math.max(3, road.point.width / 2 - 4);
    this.beamPrevious.copy(this.beamCenter).addScaledVector(this.beamRight, -this.beamHalfWidth);
    this.sweep.position.copy(this.beamCenter);
    this.sweep.rotation.y = Math.atan2(road.point.tangent.x, road.point.tangent.z);
    this.sweepFloor.scale.set(this.beamHalfWidth * 2 + 6, 6, 1);
    this.sweep.children.slice(1).forEach((stripe, index) => { stripe.position.x = (index - 5) * this.beamHalfWidth / 5; });
    this.sweep.visible = true;
    this.beamWarned = true;
    this.beamFireAt = 5.9;
  }

  private updateBeam(endpoint: THREE.Vector3) {
    const emitter = this.ship.position.clone().add(new THREE.Vector3(0, -3, 0));
    const axis = emitter.sub(endpoint);
    const middle = endpoint.clone().addScaledVector(axis, 0.5);
    const direction = axis.clone().normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    for (const [mesh, radius] of [[this.beamCore, 0.7], [this.beamShell, 1.7]] as const) {
      mesh.visible = true;
      mesh.position.copy(middle);
      mesh.quaternion.copy(rotation);
      mesh.scale.set(radius, axis.length(), radius);
    }
    this.beamRing.visible = true;
    this.beamRing.position.copy(endpoint).add(new THREE.Vector3(0, 0.15, 0));
    this.beamRing.scale.setScalar(0.94 + Math.sin(this.age * 16) * 0.08);
    this.beamLight.intensity = 2.4;
    this.beamLight.position.copy(endpoint).add(new THREE.Vector3(0, 2, 0));
  }

  private hideBeam() {
    this.beamCore.visible = this.beamShell.visible = this.beamRing.visible = false;
    this.beamLight.intensity = 0;
  }

  getLockedThreat(racerId: number) {
    return this.marks.find((mark) => mark.target === racerId && mark.locked && mark.impactAt > this.age)?.position ?? null;
  }

  update(dt: number, racers: UfoRacer[]): { impacts: UfoImpact[]; locks: number; phase: UfoPhase } {
    if (!this.active) return { impacts: [], locks: 0, phase: 'none' };
    this.age += dt;
    this.updateShip(dt, racers);
    while (this.nextWave < 3 && this.age >= 1.6 + this.nextWave * 0.75) this.addWave(racers, this.nextWave++);
    const impacts: UfoImpact[] = [];
    let locks = 0;
    let anyLocked = false;
    for (let index = this.marks.length - 1; index >= 0; index--) {
      const mark = this.marks[index];
      const remaining = mark.impactAt - this.age;
      if (!mark.locked) {
        const target = racers[mark.target];
        if (target && (this.age >= mark.nextTrackAt || this.age >= mark.lockAt)) {
          mark.position.copy(this.roadPoint(target, Math.max(0, remaining)));
          mark.nextTrackAt = this.age + 0.07;
        }
        if (this.age >= mark.lockAt) {
          mark.locked = true;
          for (const material of mark.materials) material.color.setHex(0xff635b);
          locks++;
        }
      }
      anyLocked ||= mark.locked && remaining > 0;
      mark.group.position.copy(mark.position);
      mark.ring.scale.setScalar(1 + Math.sin(this.age * 10 + index) * 0.025);
      mark.bolt.visible = remaining > 0 && remaining < 0.35;
      if (mark.bolt.visible) {
        mark.bolt.position.copy(this.ship.position).lerp(mark.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 1 - remaining / 0.35);
        mark.bolt.scale.setScalar(0.75 + Math.sin(this.age * 27) * 0.1);
      }
      if (remaining > 0) continue;
      impacts.push({ kind: 'bombardment', position: mark.position.clone(), radius: mark.radius });
      this.scene.remove(mark.group, mark.bolt);
      mark.group.traverse((part) => { if (part instanceof THREE.Mesh) part.geometry.dispose(); });
      mark.bolt.traverse((part) => { if (part instanceof THREE.Mesh) { part.geometry.dispose(); (part.material as THREE.Material).dispose(); } });
      for (const material of mark.materials) material.dispose();
      this.marks.splice(index, 1);
    }
    if (!this.beamWarned && this.age >= 4.7) this.beginSweep(racers);
    if (this.beamWarned && !this.beamDone && this.age >= this.beamFireAt) {
      const progress = clamp((this.age - this.beamFireAt) / 1.6, 0, 1);
      const endpoint = this.beamCenter.clone().addScaledVector(this.beamRight, -this.beamHalfWidth + this.beamHalfWidth * 2 * progress);
      this.updateBeam(endpoint);
      impacts.push({ kind: 'beam', position: endpoint, previous: this.beamPrevious.clone(), radius: 3 });
      this.beamPrevious.copy(endpoint);
      if (progress >= 1) { this.beamDone = true; this.sweep.visible = false; this.hideBeam(); }
    }
    const phase: UfoPhase = this.age < 1.6 ? 'inbound' : this.beamWarned && !this.beamDone ? this.age >= this.beamFireAt ? 'beam' : 'sweep' : anyLocked ? 'locked' : 'tracking';
    if (this.age >= STITCH_UFO_DURATION) this.reset();
    return { impacts, locks, phase };
  }

  reset() {
    for (const mark of this.marks) {
      this.scene.remove(mark.group, mark.bolt);
      mark.group.traverse((part) => { if (part instanceof THREE.Mesh) part.geometry.dispose(); });
      mark.bolt.traverse((part) => { if (part instanceof THREE.Mesh) { part.geometry.dispose(); (part.material as THREE.Material).dispose(); } });
      for (const material of mark.materials) material.dispose();
    }
    this.marks.length = 0;
    this.ownerId = -1;
    this.age = 0;
    this.nextWave = 0;
    this.beamWarned = false;
    this.beamDone = false;
    this.ship.visible = false;
    this.sweep.visible = false;
    this.hideBeam();
  }
}
