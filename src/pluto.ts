import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { RaceTrack, RouteName } from './track';

export const PLUTO_ULTIMATE_DURATION = 18;
const STRIKE_WARNING = 1.65;
const STRIKE_TIMES = [5.5, 11.8];
const COLLAPSE_DURATION = 5.8;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const wrap = (n: number) => ((n % 1) + 1) % 1;

let plutoTemplate: THREE.Group | null = null;
let plutoLoading: Promise<THREE.Group | null> | null = null;

/** The earlier Godot project's Pluto model, normalized for both kart and giant use. */
export function loadPluto(): Promise<THREE.Group | null> {
  if (plutoTemplate) return Promise.resolve(plutoTemplate);
  if (plutoLoading) return plutoLoading;
  plutoLoading = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/pluto.glb`).then((gltf) => {
    const raw = gltf.scene;
    raw.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(raw);
    const height = Math.max(0.1, bounds.max.y - bounds.min.y);
    const middle = bounds.getCenter(new THREE.Vector3());
    const normalized = new THREE.Group();
    raw.position.set(-middle.x / height, -bounds.min.y / height, -middle.z / height);
    raw.scale.setScalar(1 / height);
    raw.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    normalized.add(raw);
    plutoTemplate = normalized;
    return normalized;
  }).catch((error) => { console.warn('Pluto model unavailable', error); return null; });
  return plutoLoading;
}

export function makePluto(height: number): Promise<THREE.Group | null> {
  return loadPluto().then((template) => {
    if (!template) return null;
    const group = template.clone(true);
    group.scale.setScalar(height);
    return group;
  });
}

export interface PlutoRacer {
  id: number;
  position: THREE.Vector3;
  progress: number;
  speed: number;
  moveYaw: number;
}

interface SlamMark {
  route: RouteName;
  progress: number;
  lane: number;
  halfWidth: number;
  halfLength: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  age: number;
  hit: Set<number>;
  root: THREE.Group;
  danger: THREE.Mesh;
  outline: THREE.Mesh;
  paw: THREE.Group;
  slamPaw: THREE.Group;
  debris: THREE.Group;
  cracks: THREE.Group;
  fired: boolean;
}

export interface PlutoImpact { position: THREE.Vector3; }

function pawPrint(color: number, opacity: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), material);
  palm.scale.set(1.6, 0.045, 1.15);
  palm.position.z = -0.25;
  group.add(palm);
  for (const [x, z, scale] of [[-1.5, 1.1, 0.58], [-0.5, 1.65, 0.62], [0.55, 1.65, 0.62], [1.5, 1.08, 0.58]]) {
    const toe = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
    toe.scale.set(scale, 0.04, scale * 0.8);
    toe.position.set(x, 0, z);
    group.add(toe);
  }
  return group;
}

function fracturedRoad(width: number, length: number) {
  const shape = new THREE.Shape();
  const edge: [number, number][] = [
    [-0.49, -0.5], [-0.27, -0.48], [-0.09, -0.52], [0.13, -0.47], [0.35, -0.51], [0.49, -0.44],
    [0.46, -0.15], [0.52, 0.07], [0.47, 0.28], [0.49, 0.49], [0.18, 0.47], [-0.03, 0.53],
    [-0.26, 0.47], [-0.51, 0.49], [-0.47, 0.18], [-0.52, -0.06], [-0.47, -0.32],
  ];
  shape.moveTo(edge[0][0] * width, edge[0][1] * length);
  for (const [x, y] of edge.slice(1)) shape.lineTo(x * width, y * length);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function makeSlamPaw(width: number) {
  const paw = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xd9a44f, roughness: 0.75, emissive: 0x4d2707, emissiveIntensity: 0.12 });
  const claw = new THREE.MeshStandardMaterial({ color: 0x1a1521, roughness: 0.53 });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), fur);
  palm.scale.set(width * 0.31, 2.1, 2.25);
  palm.position.y = 1.8;
  paw.add(palm);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * width * 0.16;
    const digit = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), fur);
    digit.scale.set(width * 0.11, 1.35, 1.34);
    digit.position.set(x, 1.1, 2.12 + 0.1 * Math.cos(i * 2));
    paw.add(digit);
    const nail = new THREE.Mesh(new THREE.ConeGeometry(width * 0.065, 0.9, 9), claw);
    nail.rotation.x = Math.PI / 2;
    nail.position.set(x, 0.79, 3.1 + 0.1 * Math.cos(i * 2));
    paw.add(nail);
  }
  paw.visible = false;
  return paw;
}

export class PlutoUltimate {
  readonly group = new THREE.Group();
  private giant: THREE.Group | null = null;
  private marks: SlamMark[] = [];
  private ownerId = -1;
  private preferredTargetId = -1;
  private age = 0;
  private nextStrike = 0;

  constructor(private scene: THREE.Scene, private track: RaceTrack) {
    this.group.visible = false;
    scene.add(this.group);
    void makePluto(24).then((model) => {
      if (!model) return;
      model.rotation.y = 0;
      this.giant = model;
      this.group.add(model);
    });
  }

  get active() { return this.ownerId >= 0; }
  get owner() { return this.ownerId; }
  get elapsed() { return this.age; }
  get hazards() { return this.marks.length; }

  start(owner: number, preferredTarget = -1) {
    if (this.active) return false;
    this.reset();
    this.ownerId = owner;
    this.preferredTargetId = preferredTarget;
    this.age = 0;
    this.group.visible = true;
    return true;
  }

  private spawnMark(racers: PlutoRacer[]) {
    const caster = racers[this.ownerId];
    if (!caster) return;
    const enemy = racers.filter((racer) => racer.id !== caster.id)
      .map((racer) => ({ racer, distance: racer.position.distanceTo(caster.position) }))
      .sort((a, b) => a.distance - b.distance)[0]?.racer;
    const preferred = racers[this.preferredTargetId];
    const target = preferred && preferred.id !== caster.id ? preferred : enemy && enemy.position.distanceTo(caster.position) < 145 ? enemy : caster;
    const sample = this.track.nearest(target.position, target.progress);
    const ahead = clamp(target.speed * (STRIKE_WARNING + 0.45), 38, 75);
    const progress = wrap(sample.point.progress + ahead / this.track.length);
    const point = this.track.routeAt(sample.point.route, progress);
    const laneWidth = point.width / 3;
    const predicted = target.position.clone().sub(sample.point.position).dot(sample.point.right);
    const lane = clamp(Math.floor((predicted + point.width / 2) / laneWidth), 0, 2);
    const center = (lane - 1) * laneWidth;
    const position = point.position.clone().addScaledVector(point.right, center);
    position.y += 0.18;
    const root = new THREE.Group();
    root.position.copy(position);
    root.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
    const danger = new THREE.Mesh(fracturedRoad(laneWidth - 0.8, 15), new THREE.MeshBasicMaterial({ color: 0x160e20, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    danger.rotation.x = -Math.PI / 2;
    danger.position.y = 0.03;
    const outline = new THREE.Mesh(fracturedRoad(laneWidth + 0.35, 15.9), new THREE.MeshBasicMaterial({ color: 0xffd265, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }));
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.015;
    root.add(outline, danger);
    const paw = pawPrint(0xffdb78, 0.7);
    paw.position.y = 0.065;
    paw.scale.setScalar(1.8);
    root.add(paw);
    const slamPaw = makeSlamPaw(laneWidth);
    root.add(slamPaw);
    const debris = new THREE.Group();
    debris.visible = false;
    root.add(debris);
    const cracks = new THREE.Group();
    cracks.visible = false;
    root.add(cracks);
    const crackMaterial = new THREE.MeshBasicMaterial({ color: 0xff8f59, transparent: true, opacity: 0.87, toneMapped: false });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.13 * Math.sin(i * 7);
      const radius = i % 3 === 0 ? 6.2 : 4.2;
      const end = new THREE.Vector3(Math.cos(angle) * Math.min(laneWidth * 0.46, radius), 0.085, Math.sin(angle) * Math.min(7.1, radius * 1.4));
      const middle = end.clone().multiplyScalar(0.52).add(new THREE.Vector3(Math.sin(i * 2.7) * 0.42, 0.044, Math.cos(i * 3.1) * 0.31));
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.09, 0), middle, end]);
      cracks.add(new THREE.Mesh(new THREE.TubeGeometry(path, 5, 0.055 + (i % 3) * 0.012, 4, false), crackMaterial));
    }
    const rubbleMaterials = [0xa56f69, 0xcb9672, 0xe0ae82, 0x80545c].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.94, flatShading: true }));
    for (let i = 0; i < 15; i++) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + (i % 3) * 0.17, 0), rubbleMaterials[i % 4]);
      const x = (Math.sin(i * 2.43) * 0.44) * laneWidth;
      const z = (Math.cos(i * 3.21) * 0.45) * 15;
      stone.position.set(x, 0.14 + (i % 4) * 0.12, z);
      stone.scale.set(1.4, 0.48, 1.1);
      stone.rotation.y = i * 1.7;
      debris.add(stone);
    }
    this.scene.add(root);
    this.marks.push({ route: point.route, progress, lane, halfWidth: laneWidth / 2, halfLength: 7.5, position, tangent: point.tangent.clone(), right: point.right.clone(), age: 0, hit: new Set(), root, danger, outline, paw, slamPaw, debris, cracks, fired: false });
  }

  update(dt: number, racers: PlutoRacer[]): PlutoImpact[] {
    if (!this.active) return [];
    this.age += dt;
    const caster = racers[this.ownerId];
    const viewer = racers[0] ?? caster;
    if (caster && viewer) {
      const anchor = this.track.at(wrap(viewer.progress + 78 / this.track.length));
      const side = this.nextStrike % 2 ? -1 : 1;
      const target = anchor.position.clone().addScaledVector(anchor.right, side * (anchor.width / 2 + 23));
      target.y += 1;
      this.group.position.lerp(target, clamp(dt * 2.7, 0, 1));
      this.group.rotation.y = Math.atan2(viewer.position.x - this.group.position.x, viewer.position.z - this.group.position.z);
      const reveal = clamp(this.age / 2.2, 0, 1);
      const fade = clamp((PLUTO_ULTIMATE_DURATION - this.age) / 1.25, 0, 1);
      this.group.scale.setScalar(reveal * fade);
      if (this.giant) {
        this.giant.position.y = Math.sin(this.age * 2.2) * 0.25 + (this.marks.some((mark) => mark.age > STRIKE_WARNING - 0.24 && mark.age < STRIKE_WARNING + 0.3) ? -1.8 : 0);
        this.giant.rotation.z = Math.sin(this.age * 1.4) * 0.035;
      }
    }
    while (this.nextStrike < STRIKE_TIMES.length && this.age >= STRIKE_TIMES[this.nextStrike] - STRIKE_WARNING) {
      this.spawnMark(racers);
      this.nextStrike++;
    }
    const impacts: PlutoImpact[] = [];
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mark = this.marks[i];
      mark.age += dt;
      if (!mark.fired && mark.age >= STRIKE_WARNING) {
        mark.fired = true;
        mark.debris.visible = true;
        mark.cracks.visible = true;
        mark.paw.visible = false;
        (mark.danger.material as THREE.MeshBasicMaterial).opacity = 0.94;
        (mark.outline.material as THREE.MeshBasicMaterial).color.setHex(0xf58851);
        impacts.push({ position: mark.position.clone() });
      }
      const landing = clamp((STRIKE_WARNING - mark.age) / 0.38, 0, 1);
      const rise = clamp((mark.age - STRIKE_WARNING) / 0.56, 0, 1);
      mark.slamPaw.visible = mark.age > STRIKE_WARNING - 0.38 && mark.age < STRIKE_WARNING + 0.56;
      mark.slamPaw.position.y = landing * landing * 23 + rise * rise * 16;
      mark.slamPaw.rotation.x = (1 - landing) * 0.09;
      (mark.outline.material as THREE.MeshBasicMaterial).opacity = mark.fired ? 0.28 : 0.26 + 0.35 * Math.abs(Math.sin(mark.age * 12));
      if (mark.fired && mark.age > STRIKE_WARNING + COLLAPSE_DURATION) {
        this.scene.remove(mark.root);
        mark.root.traverse((part) => { if (part instanceof THREE.Mesh) { part.geometry.dispose(); (part.material as THREE.Material).dispose(); } });
        this.marks.splice(i, 1);
      }
    }
    if (this.age >= PLUTO_ULTIMATE_DURATION) this.reset();
    return impacts;
  }

  /** One-third-width collapsed section; callers handle the hit and recovery. */
  hazardAt(racer: PlutoRacer) {
    const road = this.track.nearest(racer.position, racer.progress);
    for (const mark of this.marks) {
      if (!mark.fired || road.point.route !== mark.route || Math.abs(racer.position.y - mark.position.y) > 4.5) continue;
      const delta = racer.position.clone().sub(mark.position);
      const along = Math.abs(delta.dot(mark.tangent));
      const across = Math.abs(delta.dot(mark.right));
      if (along < mark.halfLength + 1.1 && across < mark.halfWidth + 0.5) return mark;
    }
    return null;
  }

  avoidLane(racer: PlutoRacer, route: RouteName): number | null {
    for (const mark of this.marks) {
      if (mark.route !== route) continue;
      const distance = wrap(mark.progress - racer.progress) * this.track.length;
      if (distance > 68) continue;
      const width = this.track.routeAt(route, mark.progress).width;
      const candidates = [-width / 3, 0, width / 3].filter((_, lane) => lane !== mark.lane);
      const current = this.track.nearest(racer.position, racer.progress).lateral;
      return candidates.sort((a, b) => Math.abs(a - current) - Math.abs(b - current))[0];
    }
    return null;
  }

  reset() {
    for (const mark of this.marks) {
      this.scene.remove(mark.root);
      mark.root.traverse((part) => { if (part instanceof THREE.Mesh) { part.geometry.dispose(); (part.material as THREE.Material).dispose(); } });
    }
    this.marks.length = 0;
    this.ownerId = -1;
    this.preferredTargetId = -1;
    this.age = 0;
    this.nextStrike = 0;
    this.group.visible = false;
  }
}

export interface TongueRacer { id: number; position: THREE.Vector3; moveYaw: number; }

function plutoMouth(racer: TongueRacer) {
  const forward = new THREE.Vector3(Math.sin(racer.moveYaw), 0, Math.cos(racer.moveYaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  return racer.position.clone().addScaledVector(right, 0.68).addScaledVector(forward, -0.84).add(new THREE.Vector3(0, 2.03, 0));
}

/** Fast visible tether, aimed when fired and following the target for a short reach. */
export class PlutoTongue {
  private shots: { owner: number; target: number; age: number; hit: boolean; tip: THREE.Vector3; root: THREE.Group; shaft: THREE.Mesh; mouth: THREE.Mesh }[] = [];

  constructor(private scene: THREE.Scene) {}
  get count() { return this.shots.length; }

  fire(owner: number, target: number, racers: TongueRacer[]) {
    const racer = racers[owner];
    if (!racer || !racers[target]) return false;
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0xf86989, roughness: 0.39, metalness: 0.02, emissive: 0x8d1d4f, emissiveIntensity: 0.15 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 1, 12), material);
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.57, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff9dae, roughness: 0.42, emissive: 0x8d1648, emissiveIntensity: 0.12 }));
    root.add(shaft, mouth);
    this.scene.add(root);
    this.shots.push({ owner, target, age: 0, hit: false, tip: plutoMouth(racer), root, shaft, mouth });
    return true;
  }

  update(dt: number, racers: TongueRacer[]): { target: number; position: THREE.Vector3; owner: number }[] {
    const hits: { target: number; position: THREE.Vector3; owner: number }[] = [];
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      const owner = racers[shot.owner];
      const target = racers[shot.target];
      shot.age += dt;
      if (!owner || !target || shot.age >= 0.9 || owner.position.distanceTo(target.position) > 58) {
        this.disposeShot(i);
        continue;
      }
      const origin = plutoMouth(owner);
      const targetPoint = target.position.clone().add(new THREE.Vector3(0, 1.5, 0));
      if (shot.age < 0.5) {
        const delta = targetPoint.clone().sub(shot.tip);
        shot.tip.addScaledVector(delta.normalize(), Math.min(delta.length(), dt * 120));
      } else shot.tip.lerp(origin, Math.min(1, dt * 14));
      const span = shot.tip.clone().sub(origin);
      const midpoint = origin.clone().addScaledVector(span, 0.5);
      midpoint.y += Math.sin(Math.PI * clamp(shot.age / 0.9, 0, 1)) * 0.28;
      shot.shaft.position.copy(midpoint);
      shot.shaft.scale.set(1, Math.max(0.05, span.length()), 1);
      shot.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize());
      shot.mouth.position.copy(shot.tip);
      shot.mouth.scale.setScalar(0.86 + Math.sin(shot.age * 25) * 0.1);
      if (!shot.hit && shot.age < 0.5 && shot.tip.distanceTo(targetPoint) < 2.6) {
        shot.hit = true;
        hits.push({ target: target.id, position: targetPoint, owner: owner.id });
      }
    }
    return hits;
  }

  private disposeShot(index: number) {
    const [shot] = this.shots.splice(index, 1);
    this.scene.remove(shot.root);
    shot.shaft.geometry.dispose(); shot.mouth.geometry.dispose();
    (shot.shaft.material as THREE.Material).dispose(); (shot.mouth.material as THREE.Material).dispose();
  }

  reset() { while (this.shots.length) this.disposeShot(this.shots.length - 1); }
}
