import * as THREE from 'three';
import { raceSpeed } from './handling';
import type { RaceTrack } from './track';

type SoulRacer = {
  id: number;
  position: THREE.Vector3;
  speed: number;
  drifting: boolean;
  driftCharge: number;
  shieldTime: number;
  ultimateTime: number;
};

type SoulLink = {
  owner: number;
  target: number;
  life: number;
  group: THREE.Group;
  beam: THREE.Mesh;
  beads: THREE.Mesh[];
  light: THREE.PointLight;
  cyan: THREE.MeshBasicMaterial;
  violet: THREE.MeshBasicMaterial;
};

export type SoulLinkEnd = { owner: number; target: number; brokenByDrift: boolean };

const smooth = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};

function spiritTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.22, 'rgba(151,239,255,.9)');
  glow.addColorStop(0.62, 'rgba(76,152,255,.35)');
  glow.addColorStop(1, 'rgba(76,152,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/** Hades' speed-draining chain and his course-wide cursed boost carpets. */
export class HadesStyx {
  private readonly group = new THREE.Group();
  private readonly floor = new THREE.MeshBasicMaterial({ color: 0x1b3d9c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  private readonly flame = new THREE.MeshBasicMaterial({ color: 0x65d9ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  private readonly arch = new THREE.MeshBasicMaterial({ color: 0x9cf2ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  private readonly pads: Array<{ group: THREE.Group; flames: THREE.Mesh[] }> = [];
  private readonly souls: THREE.Sprite[] = [];
  private readonly soulMaterial: THREE.SpriteMaterial;
  private readonly links: SoulLink[] = [];
  private elapsed = 0;
  private duration = 0;
  private fade = 0;
  owner = -1;

  constructor(private readonly scene: THREE.Scene, track: RaceTrack) {
    for (const pad of track.boostPads) {
      const group = new THREE.Group();
      group.position.copy(pad.position);
      group.position.y += 0.13;
      group.rotation.y = Math.atan2(pad.tangent.x, pad.tangent.z);
      const surface = new THREE.Mesh(new THREE.PlaneGeometry(pad.halfWidth * 2.05, pad.halfLength * 2), this.floor);
      surface.rotation.x = -Math.PI / 2;
      group.add(surface);
      const flames: THREE.Mesh[] = [];
      for (const side of [-1, 1]) {
        for (let i = -2; i <= 2; i++) {
          const tongue = new THREE.Mesh(new THREE.ConeGeometry(i % 2 ? 0.34 : 0.46, 1.45 + (i % 3) * 0.2, 7, 3, true), this.flame);
          tongue.position.set(side * (pad.halfWidth - 0.35), 0.71, i * pad.halfLength * 0.39);
          tongue.rotation.z = side * 0.16;
          group.add(tongue);
          flames.push(tongue);
        }
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.3, 4.2, 8, 1, true), this.flame);
        pillar.position.set(side * (pad.halfWidth - 0.5), 2.1, 0);
        group.add(pillar);
      }
      const arc = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-pad.halfWidth + 0.5, 4.1, 0),
        new THREE.Vector3(0, 6.3, 0),
        new THREE.Vector3(pad.halfWidth - 0.5, 4.1, 0),
      );
      group.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 22, 0.13, 6, false), this.arch));
      const seal = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.1, 7, 24), this.arch);
      seal.position.y = 5.35;
      group.add(seal);
      group.visible = false;
      this.group.add(group);
      this.pads.push({ group, flames });
    }
    this.soulMaterial = new THREE.SpriteMaterial({ map: spiritTexture(), color: 0x9adeff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (let i = 0; i < 42; i++) {
      const soul = new THREE.Sprite(this.soulMaterial);
      soul.scale.setScalar(0.8 + (i % 5) * 0.18);
      this.souls.push(soul);
      this.group.add(soul);
    }
    this.group.visible = false;
    scene.add(this.group);
  }

  get active() { return this.owner >= 0 && this.elapsed < this.duration; }
  get blend() { return this.fade; }
  get litPads() { return this.active ? this.pads.length : 0; }
  get linkedCount() { return this.links.length; }

  start(owner: number, duration: number) {
    this.owner = owner;
    this.elapsed = 0;
    this.duration = duration;
    this.group.visible = true;
  }

  link(owner: number, target: number) {
    for (let index = this.links.length - 1; index >= 0; index--) if (this.links[index].owner === owner) this.removeLink(index);
    const group = new THREE.Group();
    const cyan = new THREE.MeshBasicMaterial({ color: 0x76e8ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const violet = new THREE.MeshBasicMaterial({ color: 0xa185ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1, 8), cyan);
    group.add(beam);
    const beads: THREE.Mesh[] = [];
    for (let i = 0; i < 11; i++) {
      const bead = new THREE.Mesh(new THREE.OctahedronGeometry(i % 3 === 0 ? 0.24 : 0.14, 0), i % 2 ? cyan : violet);
      group.add(bead);
      beads.push(bead);
    }
    const light = new THREE.PointLight(0x6fe6ff, 1.8, 13, 2);
    group.add(light);
    this.scene.add(group);
    this.links.push({ owner, target, life: 3.3, group, beam, beads, light, cyan, violet });
  }

  update(dt: number, racers: SoulRacer[], focus: THREE.Vector3): SoulLinkEnd[] {
    const events: SoulLinkEnd[] = [];
    if (this.active) this.elapsed += dt;
    if (this.owner >= 0 && this.elapsed >= this.duration) this.owner = -1;
    this.fade += ((this.active ? smooth(this.elapsed / 0.8) * smooth((this.duration - this.elapsed) / 1.2) : 0) - this.fade) * Math.min(1, dt * 3.2);
    this.group.visible = this.fade > 0.01;
    this.floor.opacity = 0.54 * this.fade;
    this.flame.opacity = 0.76 * this.fade;
    this.arch.opacity = 0.82 * this.fade;
    this.soulMaterial.opacity = 0.7 * this.fade;
    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      pad.group.visible = this.group.visible;
      pad.flames.forEach((flame, index) => { flame.scale.y = 0.82 + Math.sin(this.elapsed * 9 + index * 1.7 + i) * 0.18; });
    }
    for (let i = 0; i < this.souls.length; i++) {
      const angle = i * 2.399963 + this.elapsed * (i % 3 ? 0.13 : -0.08);
      const radius = 8 + (i % 8) * 4.5;
      this.souls[i].position.set(focus.x + Math.cos(angle) * radius, focus.y + 2 + ((i * 7 + this.elapsed * (2 + i % 4)) % 16), focus.z + Math.sin(angle) * radius);
    }
    for (let index = this.links.length - 1; index >= 0; index--) {
      const link = this.links[index];
      link.life -= dt;
      const owner = racers[link.owner];
      const target = racers[link.target];
      const brokenByDrift = !!target && target.drifting && target.driftCharge >= 1;
      const distance = owner && target ? owner.position.distanceTo(target.position) : Infinity;
      if (!owner || !target || link.life <= 0 || distance > 58 || target.shieldTime > 0 || target.ultimateTime > 0 || brokenByDrift) {
        events.push({ owner: link.owner, target: link.target, brokenByDrift });
        this.removeLink(index);
        continue;
      }
      const siphon = Math.min(target.speed, 5.5 * dt);
      target.speed -= siphon;
      owner.speed = Math.min(raceSpeed(54), owner.speed + siphon * 0.85);
      const from = owner.position.clone().add(new THREE.Vector3(0, 1.85, 0));
      const to = target.position.clone().add(new THREE.Vector3(0, 1.5, 0));
      const delta = to.clone().sub(from);
      link.beam.position.copy(from).add(to).multiplyScalar(0.5);
      link.beam.scale.y = delta.length();
      link.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      link.beads.forEach((bead, beadIndex) => {
        const t = (beadIndex + 1) / (link.beads.length + 1);
        bead.position.copy(from).lerp(to, t);
        bead.position.y += Math.sin(t * Math.PI) * (0.5 + Math.sin(this.elapsed * 12 + beadIndex) * 0.13);
        bead.rotation.y += dt * 3;
      });
      link.light.position.copy(link.beam.position);
      const alpha = Math.min(1, link.life * 2.4);
      link.cyan.opacity = 0.73 * alpha;
      link.violet.opacity = 0.86 * alpha;
    }
    return events;
  }

  reset() {
    this.owner = -1;
    this.elapsed = this.duration = this.fade = 0;
    this.group.visible = false;
    for (let index = this.links.length - 1; index >= 0; index--) this.removeLink(index);
  }

  private removeLink(index: number) {
    const [link] = this.links.splice(index, 1);
    link.group.removeFromParent();
    link.beam.geometry.dispose();
    link.beads.forEach((bead) => bead.geometry.dispose());
    link.cyan.dispose();
    link.violet.dispose();
  }
}
