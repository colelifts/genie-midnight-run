import * as THREE from 'three';
import type { RaceTrack, RoadPoint } from './track';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const x = clamp01(value); return x * x * (3 - 2 * x); };
type GridSection = { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; progress: number };

function gridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(135,240,255,.94)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(214,166,255,.86)';
  ctx.lineWidth = 5;
  for (const x of [3, 253]) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(240,250,255,.93)';
  ctx.lineWidth = 3;
  for (const y of [0, 128, 255]) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function starTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const halo = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  halo.addColorStop(0, 'rgba(255,255,255,1)');
  halo.addColorStop(0.22, 'rgba(215,244,255,.95)');
  halo.addColorStop(0.6, 'rgba(144,212,255,.31)');
  halo.addColorStop(1, 'rgba(144,212,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export class BuzzOrbit {
  private readonly group = new THREE.Group();
  private readonly sections: GridSection[] = [];
  private readonly texture = gridTexture();
  private readonly stars: THREE.Points;
  private readonly starPositions = new Float32Array(160 * 3);
  private readonly starSeeds = new Float32Array(160);
  private readonly starMaterial = new THREE.PointsMaterial({ map: starTexture(), color: 0xc9f8ff, size: 0.58, transparent: true, opacity: 0, depthWrite: false, fog: false, sizeAttenuation: true });
  private elapsed = 0;
  private duration = 0;
  private origin = 0;
  owner = -1;

  constructor(scene: THREE.Scene, track: RaceTrack) {
    this.makeSections(track.mainSamples, true);
    this.makeSections(track.alleySamples, false);
    this.makeSections(track.roofSamples, false);
    this.makeSections(track.gardenSamples, false);
    let seed = 66731;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    for (let i = 0; i < this.starSeeds.length; i++) {
      this.starPositions[i * 3] = (random() - 0.5) * 130;
      this.starPositions[i * 3 + 1] = random() * 34;
      this.starPositions[i * 3 + 2] = (random() - 0.5) * 130;
      this.starSeeds[i] = random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
    this.stars = new THREE.Points(geometry, this.starMaterial);
    this.stars.frustumCulled = false;
    this.stars.visible = false;
    this.group.add(this.stars);
    scene.add(this.group);
  }

  private makeSections(points: RoadPoint[], closed: boolean) {
    const step = points.length > 400 ? 16 : 12;
    const count = closed ? points.length : points.length - 1;
    for (let first = 0; first < count; first += step) {
      const end = Math.min(count, first + step);
      const vertices: number[] = [];
      const uv: number[] = [];
      const indices: number[] = [];
      for (let i = first; i <= end; i++) {
        const point = points[i % points.length];
        const left = point.position.clone().addScaledVector(point.right, -point.width * 0.47);
        const right = point.position.clone().addScaledVector(point.right, point.width * 0.47);
        vertices.push(left.x, left.y + 0.09, left.z, right.x, right.y + 0.09, right.z);
        uv.push(0, (i - first) / 3, 1, (i - first) / 3);
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
      const material = new THREE.MeshBasicMaterial({ map: this.texture, color: 0x8bddf5, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 5;
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
    this.elapsed = this.duration = 0;
    for (const section of this.sections) section.mesh.visible = false;
    this.stars.visible = false;
    this.starMaterial.opacity = 0;
  }

  get active() { return this.owner >= 0 && this.elapsed < this.duration; }
  get blend() { return this.active ? smooth(this.elapsed / 1.1) * smooth((this.duration - this.elapsed) / 1.4) : 0; }
  get litSections() { return this.sections.filter((section) => section.mesh.visible).length; }

  strengthAt(progress: number) {
    if (!this.active) return 0;
    const delta = Math.abs(progress - this.origin);
    return smooth((this.elapsed - Math.min(delta, 1 - delta) * 5.6) / 0.85) * smooth((this.duration - this.elapsed) / 1.4);
  }

  update(dt: number, focus: THREE.Vector3) {
    if (!this.active) { if (this.owner >= 0) this.reset(); return; }
    this.elapsed += dt;
    this.texture.offset.y = (this.texture.offset.y + dt * 0.22) % 1;
    for (const section of this.sections) {
      const strength = this.strengthAt(section.progress);
      section.mesh.visible = strength > 0.02;
      section.material.opacity = 0.5 * strength;
    }
    const blend = this.blend;
    this.stars.visible = blend > 0.02;
    this.starMaterial.opacity = 0.7 * blend;
    this.stars.position.copy(focus);
    this.stars.position.y += 6;
    for (let i = 0; i < this.starSeeds.length; i++) {
      const base = i * 3;
      this.starPositions[base + 1] -= dt * (2.5 + this.starSeeds[i] * 4);
      if (this.starPositions[base + 1] < -5) this.starPositions[base + 1] += 38;
    }
    (this.stars.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    if (this.elapsed >= this.duration) this.reset();
  }
}
