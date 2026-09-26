import * as THREE from 'three';
import type { RaceTrack, RoadPoint } from './track';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const x = clamp01(value); return x * x * (3 - 2 * x); };

type FrostRacer = { id: number; character: string; progress: number; visual: { group: THREE.Group } };
type IceSection = { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; progress: number };

function iceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const wash = ctx.createLinearGradient(0, 0, 256, 0);
  wash.addColorStop(0, 'rgba(215,249,255,.88)');
  wash.addColorStop(0.17, 'rgba(118,207,244,.42)');
  wash.addColorStop(0.5, 'rgba(203,247,255,.28)');
  wash.addColorStop(0.83, 'rgba(118,207,244,.42)');
  wash.addColorStop(1, 'rgba(215,249,255,.88)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 256, 256);
  let seed = 73917;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  for (let i = 0; i < 45; i++) {
    let x = random() * 256;
    let y = random() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (random() - 0.5) * 48;
      y += 8 + random() * 23;
      ctx.lineTo(x, y);
      if (j === 2 && random() > 0.45) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + (random() - 0.5) * 42, y + 14);
        ctx.moveTo(x, y);
      }
    }
    ctx.strokeStyle = `rgba(233,255,255,${0.18 + random() * 0.31})`;
    ctx.lineWidth = 0.7 + random() * 1.4;
    ctx.stroke();
  }
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.18 + random() * 0.55})`;
    const r = 0.5 + random() * 1.8;
    ctx.fillRect(random() * 256, random() * 256, r, r);
  }
  for (const x of [2, 254]) {
    ctx.strokeStyle = 'rgba(243,255,255,.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function snowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.18, 'rgba(242,255,255,.92)');
  glow.addColorStop(0.55, 'rgba(201,242,255,.36)');
  glow.addColorStop(1, 'rgba(201,242,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export class ElsaStorm {
  private readonly group = new THREE.Group();
  private readonly sections: IceSection[] = [];
  private readonly frost = new Map<number, { group: THREE.Group; material: THREE.MeshBasicMaterial }>();
  private readonly snow: THREE.Points;
  private readonly snowPositions: Float32Array;
  private readonly snowSeeds: Float32Array;
  private readonly snowMaterial: THREE.PointsMaterial;
  private elapsed = 0;
  private duration = 0;
  private origin = 0;
  owner = -1;

  constructor(scene: THREE.Scene, track: RaceTrack) {
    const texture = iceTexture();
    this.makeSections(track.mainSamples, true, texture);
    this.makeSections(track.alleySamples, false, texture);
    this.makeSections(track.roofSamples, false, texture);
    this.makeSections(track.gardenSamples, false, texture);
    this.snowPositions = new Float32Array(260 * 3);
    this.snowSeeds = new Float32Array(260);
    for (let i = 0; i < this.snowSeeds.length; i++) {
      const a = i * 3;
      const hash = (n: number) => ((Math.sin(n * 127.1 + 78.2) * 43758.5453) % 1 + 1) % 1;
      this.snowPositions[a] = (hash(i + 1) - 0.5) * 130;
      this.snowPositions[a + 1] = hash(i + 31) * 34;
      this.snowPositions[a + 2] = (hash(i + 81) - 0.5) * 130;
      this.snowSeeds[i] = hash(i + 147);
    }
    const snowGeometry = new THREE.BufferGeometry();
    snowGeometry.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));
    this.snowMaterial = new THREE.PointsMaterial({ map: snowTexture(), color: 0xeaffff, size: 0.36, transparent: true, opacity: 0, depthWrite: false, fog: false, sizeAttenuation: true });
    this.snow = new THREE.Points(snowGeometry, this.snowMaterial);
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.group.add(this.snow);
    scene.add(this.group);
  }

  private makeSections(points: RoadPoint[], closed: boolean, texture: THREE.Texture) {
    const step = points.length > 400 ? 16 : 12;
    const count = closed ? points.length : points.length - 1;
    for (let first = 0; first < count; first += step) {
      const end = Math.min(count, first + step);
      const vertices: number[] = [];
      const uv: number[] = [];
      const indices: number[] = [];
      for (let i = first; i <= end; i++) {
        const point = points[i % points.length];
        const half = point.width * 0.49;
        const left = point.position.clone().addScaledVector(point.right, -half);
        const right = point.position.clone().addScaledVector(point.right, half);
        vertices.push(left.x, left.y + 0.058, left.z, right.x, right.y + 0.058, right.z);
        uv.push(0, (i - first) / 5, 1, (i - first) / 5);
        if (i > first) {
          const a = (i - first - 1) * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({ map: texture, color: 0xb2eaff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 3;
      mesh.visible = false;
      this.group.add(mesh);
      this.sections.push({ mesh, material, progress: points[Math.floor((first + end) / 2) % points.length].progress });
    }
  }

  start(owner: number, progress: number, duration: number) {
    this.owner = owner;
    this.origin = progress;
    this.duration = duration;
    this.elapsed = 0;
  }

  reset() {
    this.owner = -1;
    this.elapsed = 0;
    this.duration = 0;
    for (const section of this.sections) section.mesh.visible = false;
    for (const effect of this.frost.values()) effect.group.visible = false;
    this.snow.visible = false;
    this.snowMaterial.opacity = 0;
  }

  get active() { return this.owner >= 0 && this.elapsed < this.duration; }
  get blend() { return this.active ? smooth(this.elapsed / 1.4) * smooth((this.duration - this.elapsed) / 1.6) : 0; }
  get frozenSections() { return this.sections.filter((section) => section.mesh.visible).length; }

  strengthAt(progress: number) {
    if (!this.active) return 0;
    const delta = Math.abs(progress - this.origin);
    const distance = Math.min(delta, 1 - delta);
    const arrival = distance * 6.2;
    return smooth((this.elapsed - arrival) / 0.9) * smooth((this.duration - this.elapsed) / 1.6);
  }

  private frostKart(racer: FrostRacer, strength: number) {
    let effect = this.frost.get(racer.id);
    if (!effect) {
      const group = new THREE.Group();
      const material = new THREE.MeshBasicMaterial({ color: 0xd8ffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      for (let side = -1; side <= 1; side += 2) for (let end = -1; end <= 1; end += 2) {
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), material);
        crystal.position.set(side * 1.24, 0.83, end * 1.17);
        crystal.scale.set(0.6, 1.65, 0.65);
        group.add(crystal);
      }
      for (let i = 0; i < 4; i++) {
        const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), material);
        sparkle.position.set((i - 1.5) * 0.7, 2.3 + (i % 2) * 0.29, -0.3 + (i % 2) * 0.7);
        group.add(sparkle);
      }
      effect = { group, material };
      this.frost.set(racer.id, effect);
    }
    if (effect.group.parent !== racer.visual.group) racer.visual.group.add(effect.group);
    effect.group.visible = strength > 0.03;
    effect.material.opacity = 0.47 * strength;
  }

  update(dt: number, racers: FrostRacer[], focus: THREE.Vector3) {
    if (!this.active) { if (this.owner >= 0) this.reset(); return; }
    this.elapsed += dt;
    const blend = this.blend;
    for (const section of this.sections) {
      const strength = this.strengthAt(section.progress);
      section.mesh.visible = strength > 0.02;
      section.material.opacity = 0.61 * strength;
    }
    for (const racer of racers) this.frostKart(racer, racer.id === this.owner ? 0 : this.strengthAt(racer.progress));
    this.snow.visible = blend > 0.01;
    this.snowMaterial.opacity = blend * 0.88;
    this.snow.position.set(focus.x, focus.y + 1, focus.z);
    for (let i = 0; i < this.snowSeeds.length; i++) {
      const a = i * 3;
      this.snowPositions[a] += dt * (2 + this.snowSeeds[i] * 2.5);
      this.snowPositions[a + 1] -= dt * (4.5 + this.snowSeeds[i] * 7);
      if (this.snowPositions[a] > 65) this.snowPositions[a] -= 130;
      if (this.snowPositions[a + 1] < 0) this.snowPositions[a + 1] += 34;
    }
    (this.snow.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    if (this.elapsed >= this.duration) this.reset();
  }
}
