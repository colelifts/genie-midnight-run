import * as THREE from 'three';
import type { RaceTrack, RoadPoint } from './track';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const x = clamp01(value); return x * x * (3 - 2 * x); };

type TideRacer = { id: number; position: THREE.Vector3; progress: number; yaw: number };
type CurrentSection = { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; progress: number };

function currentTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const fill = ctx.createLinearGradient(0, 0, 256, 0);
  fill.addColorStop(0, 'rgba(225,255,247,.8)');
  fill.addColorStop(0.12, 'rgba(74,214,215,.58)');
  fill.addColorStop(0.66, 'rgba(23,126,178,.32)');
  fill.addColorStop(1, 'rgba(224,255,248,.86)');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 256, 256);
  let seed = 43439;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  for (let i = 0; i < 48; i++) {
    const x = random() * 256;
    const y = random() * 256;
    ctx.beginPath();
    ctx.ellipse(x, y, 14 + random() * 54, 2 + random() * 5, (random() - 0.5) * 0.4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(231,255,250,${0.18 + random() * 0.4})`;
    ctx.lineWidth = 1 + random() * 2.2;
    ctx.stroke();
  }
  for (let i = 0; i < 120; i++) {
    ctx.beginPath();
    ctx.arc(random() * 256, random() * 256, 0.6 + random() * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240,255,255,${0.2 + random() * 0.5})`;
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeCrest() {
  const group = new THREE.Group();
  const translucent = new THREE.MeshStandardMaterial({ color: 0x4fdcdb, emissive: 0x2b9da6, emissiveIntensity: 0.52, metalness: 0.07, roughness: 0.25, transparent: true, opacity: 0.74, depthWrite: false, side: THREE.DoubleSide });
  const foam = new THREE.MeshBasicMaterial({ color: 0xd9fff4, toneMapped: false, transparent: true, opacity: 0.92, depthWrite: false });
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(side * 2.7, 0);
    shape.bezierCurveTo(side * 4.0, 0.7, side * 5.7, 4.0, side * 7.9, 4.15);
    shape.bezierCurveTo(side * 9.2, 4.2, side * 10.7, 2.9, side * 9.4, 2.4);
    shape.bezierCurveTo(side * 7.8, 3.1, side * 8.4, 1.1, side * 10.3, 0);
    shape.closePath();
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), translucent);
    wing.position.z = -2.4;
    wing.renderOrder = 5;
    group.add(wing);
    const edge = new THREE.QuadraticBezierCurve3(new THREE.Vector3(side * 2.7, 0.1, -2.37), new THREE.Vector3(side * 6.3, 5.3, -2.37), new THREE.Vector3(side * 9.4, 2.4, -2.37));
    const line = new THREE.Mesh(new THREE.TubeGeometry(edge, 30, 0.13, 7, false), foam);
    line.renderOrder = 6;
    group.add(line);
    for (let n = 0; n < 6; n++) {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.13 + n * 0.018, 10, 8), foam);
      bubble.position.set(side * (5.1 + n * 0.83), 1.4 + Math.sin(n * 2) * 0.73, -2.18 + (n % 2) * 0.43);
      group.add(bubble);
    }
  }
  group.visible = false;
  return group;
}

export class MoanaTide {
  private readonly group = new THREE.Group();
  private readonly sections: CurrentSection[] = [];
  private readonly texture = currentTexture();
  private readonly crest = makeCrest();
  private elapsed = 0;
  private duration = 0;
  private origin = 0;
  owner = -1;

  constructor(scene: THREE.Scene, track: RaceTrack) {
    this.makeSections(track.mainSamples, true);
    this.makeSections(track.alleySamples, false);
    this.makeSections(track.roofSamples, false);
    this.makeSections(track.gardenSamples, false);
    this.group.add(this.crest);
    scene.add(this.group);
  }

  private makeSections(points: RoadPoint[], closed: boolean) {
    const step = points.length > 400 ? 16 : 12;
    const count = closed ? points.length : points.length - 1;
    for (let first = 0; first < count; first += step) {
      const end = Math.min(count, first + step);
      for (const side of [-1, 1]) {
        const vertices: number[] = [];
        const uv: number[] = [];
        const indices: number[] = [];
        for (let i = first; i <= end; i++) {
          const point = points[i % points.length];
          const inner = point.position.clone().addScaledVector(point.right, side * point.width * 0.22);
          const outer = point.position.clone().addScaledVector(point.right, side * point.width * 0.49);
          vertices.push(inner.x, inner.y + 0.075, inner.z, outer.x, outer.y + 0.075, outer.z);
          uv.push(0, (i - first) / 6, 1, (i - first) / 6);
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
        const material = new THREE.MeshBasicMaterial({ map: this.texture, color: 0x85fff4, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        mesh.renderOrder = 4;
        this.sections.push({ mesh, material, progress: points[Math.floor((first + end) / 2) % points.length].progress });
        this.group.add(mesh);
      }
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
    this.crest.visible = false;
  }

  get active() { return this.owner >= 0 && this.elapsed < this.duration; }
  get blend() { return this.active ? smooth(this.elapsed / 1.1) * smooth((this.duration - this.elapsed) / 1.5) : 0; }
  get wetSections() { return this.sections.filter((section) => section.mesh.visible).length; }

  strengthAt(progress: number) {
    if (!this.active) return 0;
    const delta = Math.abs(progress - this.origin);
    const distance = Math.min(delta, 1 - delta);
    return smooth((this.elapsed - distance * 5.7) / 0.8) * smooth((this.duration - this.elapsed) / 1.5);
  }

  currentAt(progress: number, lateral: number, width: number) {
    const across = Math.abs(lateral) / Math.max(1, width / 2);
    return this.strengthAt(progress) * smooth((across - 0.42) / 0.22);
  }

  update(dt: number, racers: TideRacer[]) {
    if (!this.active) { if (this.owner >= 0) this.reset(); return; }
    this.elapsed += dt;
    this.texture.offset.y = (this.texture.offset.y - dt * 0.47) % 1;
    for (const section of this.sections) {
      const strength = this.strengthAt(section.progress);
      section.mesh.visible = strength > 0.02;
      section.material.opacity = 0.71 * strength;
    }
    const owner = racers.find((racer) => racer.id === this.owner);
    if (owner) {
      this.crest.visible = this.blend > 0.03;
      this.crest.position.copy(owner.position);
      this.crest.position.y += 0.22 + Math.sin(this.elapsed * 5.8) * 0.13;
      this.crest.rotation.y = owner.yaw;
      this.crest.scale.setScalar(0.76 + this.blend * 0.24);
    }
    if (this.elapsed >= this.duration) this.reset();
  }
}
