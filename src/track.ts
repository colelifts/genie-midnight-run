import * as THREE from 'three';

export type RouteName = 'main' | 'alley' | 'roof';
export type ZoneName = 'MIDNIGHT MARKET' | 'ROOFTOP RUN' | 'PALACE GARDEN' | 'DESERT CAVE';

export interface RoadPoint {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  progress: number;
  width: number;
  route: RouteName;
}

export interface RoadHit {
  point: RoadPoint;
  distance: number;
  lateral: number;
  onRoad: boolean;
}

export interface Obstacle {
  kind: 'crate' | 'boulder' | 'cart';
  mesh: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  broken: boolean;
  respawn: number;
  moving: boolean;
  basePosition: THREE.Vector3;
  right: THREE.Vector3;
  phase: number;
}

export interface BoostPad {
  position: THREE.Vector3;
  radius: number;
  route: RouteName;
  mesh: THREE.Group;
}

const sand = new THREE.MeshLambertMaterial({ color: 0xb77b5c, flatShading: true });
const stone = new THREE.MeshLambertMaterial({ color: 0xc48b66, flatShading: true });
const stoneLight = new THREE.MeshLambertMaterial({ color: 0xd7a476, flatShading: true });
const stoneDark = new THREE.MeshLambertMaterial({ color: 0x865e59, flatShading: true });
const roofMat = new THREE.MeshLambertMaterial({ color: 0x9d6577, flatShading: true });
const roadMat = new THREE.MeshLambertMaterial({ color: 0x59546a, flatShading: true, side: THREE.DoubleSide });
const red = new THREE.MeshLambertMaterial({ color: 0xd65b62, flatShading: true });
const blue = new THREE.MeshLambertMaterial({ color: 0x4669a3, flatShading: true });
const leaf = new THREE.MeshLambertMaterial({ color: 0x477653, flatShading: true, side: THREE.DoubleSide });
const wood = new THREE.MeshLambertMaterial({ color: 0x705142, flatShading: true });
const water = new THREE.MeshBasicMaterial({ color: 0x51c1db, transparent: true, opacity: 0.9 });
const glow = new THREE.MeshBasicMaterial({ color: 0xffca67 });

const box = (w: number, h: number, d: number, material: THREE.Material) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export class RaceTrack {
  readonly group = new THREE.Group();
  readonly mainCurve: THREE.CatmullRomCurve3;
  readonly samples: RoadPoint[] = [];
  readonly mainSamples: RoadPoint[] = [];
  readonly alleySamples: RoadPoint[] = [];
  readonly roofSamples: RoadPoint[] = [];
  readonly obstacles: Obstacle[] = [];
  readonly boostPads: BoostPad[] = [];
  readonly length: number;
  private readonly rng = seededRandom(626);
  private readonly carpetMaterials: THREE.MeshBasicMaterial[] = [];

  constructor(scene: THREE.Scene) {
    this.mainCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-95, 0, -96),
      new THREE.Vector3(-44, 0, -107),
      new THREE.Vector3(7, 0, -102),
      new THREE.Vector3(55, 0, -91),
      new THREE.Vector3(91, 0, -58),
      new THREE.Vector3(106, 0, -15),
      new THREE.Vector3(78, 0, 20),
      new THREE.Vector3(98, 0, 52),
      new THREE.Vector3(67, 0, 85),
      new THREE.Vector3(24, 0, 97),
      new THREE.Vector3(-18, 0, 81),
      new THREE.Vector3(-58, 0, 105),
      new THREE.Vector3(-102, 0, 80),
      new THREE.Vector3(-119, 0, 37),
      new THREE.Vector3(-102, 0, -2),
      new THREE.Vector3(-119, 0, -44),
      new THREE.Vector3(-111, 0, -76),
    ], true, 'catmullrom', 0.5);
    this.length = this.mainCurve.getLength();
    this.makeSamples();
    this.makeTerrain();
    this.makeRoad(this.mainSamples, true);
    this.makeRoad(this.alleySamples, false);
    this.makeRoad(this.roofSamples, false);
    this.makeRoadMarkers();
    this.makeRoadLights();
    this.makeMarketBanners();
    this.makeRouteSigns();
    this.makeDecor();
    this.makeObstacles();
    this.makePads();
    scene.add(this.group);
  }

  private makeSamples() {
    for (let i = 0; i < 640; i++) {
      const progress = i / 640;
      const position = this.mainCurve.getPointAt(progress);
      position.y = 0.06;
      const tangent = this.mainCurve.getTangentAt(progress).normalize();
      const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      this.mainSamples.push({ position, tangent, right, progress, width: 13.5, route: 'main' });
    }
    this.alleySamples.push(...this.makeBranch('alley', 0.045, 0.16, -17, 0, 8.2));
    this.roofSamples.push(...this.makeBranch('roof', 0.19, 0.33, -20, 5.4, 9.5));
    this.samples.push(...this.mainSamples, ...this.alleySamples, ...this.roofSamples);
  }

  private makeBranch(route: RouteName, start: number, end: number, maxOffset: number, maxHeight: number, width: number): RoadPoint[] {
    const result: RoadPoint[] = [];
    const count = 90;
    const startPoint = this.mainCurve.getPointAt(start);
    const endPoint = this.mainCurve.getPointAt(end);
    for (let i = 0; i <= count; i++) {
      const f = i / count;
      const progress = start + (end - start) * f;
      const mainPoint = this.mainCurve.getPointAt(progress);
      const tangent = this.mainCurve.getTangentAt(progress).normalize();
      const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const chord = startPoint.clone().lerp(endPoint, f);
      const cut = Math.pow(Math.sin(Math.PI * f), 1.2) * 0.42;
      const position = mainPoint.clone().lerp(chord, cut).addScaledVector(right, maxOffset * Math.sin(Math.PI * f));
      position.y = 0.07 + maxHeight * Math.pow(Math.sin(Math.PI * f), 2);
      result.push({ position, tangent, right, progress, width, route });
    }
    for (let i = 0; i < result.length; i++) {
      const a = result[Math.max(0, i - 1)].position;
      const b = result[Math.min(result.length - 1, i + 1)].position;
      result[i].tangent = b.clone().sub(a).normalize();
      result[i].right = new THREE.Vector3(-result[i].tangent.z, 0, result[i].tangent.x).normalize();
    }
    return result;
  }

  private makeTerrain() {
    const ground = box(900, 1, 900, sand);
    ground.position.y = -0.7;
    ground.receiveShadow = true;
    this.group.add(ground);
    const duneGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 45; i++) {
      const angle = (i / 45) * Math.PI * 2;
      const distance = 200 + this.rng() * 155;
      const dune = new THREE.Mesh(duneGeo, i % 3 === 0 ? stoneDark : stone);
      dune.scale.set(20 + this.rng() * 28, 9 + this.rng() * 14, 18 + this.rng() * 25);
      dune.position.set(Math.sin(angle) * distance, -6, Math.cos(angle) * distance);
      this.group.add(dune);
    }
  }

  private makeRoad(points: RoadPoint[], closed: boolean) {
    const positions: number[] = [];
    const indices: number[] = [];
    const count = points.length;
    for (const point of points) {
      const half = point.width / 2;
      const left = point.position.clone().addScaledVector(point.right, -half);
      const right = point.position.clone().addScaledVector(point.right, half);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    }
    const segments = closed ? count : count - 1;
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % count;
      indices.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const road = new THREE.Mesh(geometry, roadMat);
    road.receiveShadow = true;
    this.group.add(road);
    this.makeCurbs(points, closed);
    if (points[0].route === 'roof') this.makeRoofRails(points);
  }

  private makeCurbs(points: RoadPoint[], closed: boolean) {
    for (const side of [-1, 1]) {
      const vertices: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      const count = points.length;
      for (let i = 0; i < count; i++) {
        const point = points[i];
        const inner = point.position.clone().addScaledVector(point.right, side * (point.width / 2 - 0.05));
        const outer = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 0.75));
        inner.y += 0.035;
        outer.y += 0.035;
        vertices.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
        const color = Math.floor(i / 6) % 2 === 0 ? new THREE.Color(0xe8dcce) : new THREE.Color(0xc85d65);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
      for (let i = 0; i < (closed ? count : count - 1); i++) {
        const j = (i + 1) % count;
        indices.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      this.group.add(new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    }
  }

  private makeRoofRails(points: RoadPoint[]) {
    for (let i = 22; i < points.length - 22; i += 4) {
      for (const side of [-1, 1]) {
        const sample = points[i];
        const rail = box(2.7, 1.05, 0.42, stoneLight);
        rail.position.copy(sample.position).addScaledVector(sample.right, side * (sample.width / 2 + 0.75));
        rail.position.y += 0.45;
        rail.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
        rail.castShadow = true;
        this.group.add(rail);
      }
    }
    for (let i = 26; i < points.length - 25; i += 12) {
      const sample = points[i];
      for (const side of [-1, 1]) {
        const support = box(1.8, Math.max(0.5, sample.position.y), 1.8, stoneDark);
        support.position.copy(sample.position).addScaledVector(sample.right, side * (sample.width / 2 - 1.1));
        support.position.y = sample.position.y / 2;
        this.group.add(support);
      }
    }
  }

  private makeRoadMarkers() {
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 1.8);
    arrowShape.lineTo(1.3, -0.2);
    arrowShape.lineTo(0.45, -0.2);
    arrowShape.lineTo(0.45, -1.5);
    arrowShape.lineTo(-0.45, -1.5);
    arrowShape.lineTo(-0.45, -0.2);
    arrowShape.lineTo(-1.3, -0.2);
    arrowShape.closePath();
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xd7c8ad, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    for (let i = 18; i < this.mainSamples.length; i += 40) {
      const sample = this.mainSamples[i];
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.rotation.x = -Math.PI / 2;
      arrow.rotation.z = -Math.atan2(sample.tangent.x, sample.tangent.z);
      arrow.position.copy(sample.position);
      arrow.position.y += 0.045;
      this.group.add(arrow);
    }
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xc4b8ad, transparent: true, opacity: 0.48 });
    for (let i = 5; i < this.mainSamples.length; i += 11) {
      const point = this.mainSamples[i];
      const dash = box(0.19, 0.025, 3.2, lineMaterial);
      dash.position.copy(point.position);
      dash.position.y += 0.065;
      dash.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
      this.group.add(dash);
    }
    const start = this.mainSamples[0];
    for (let i = -6; i < 6; i++) {
      for (let j = -1; j <= 1; j++) {
        const tile = box(1.15, 0.04, 1.15, (i + j) % 2 === 0 ? stoneLight : stoneDark);
        tile.position.copy(start.position).addScaledVector(start.right, i * 1.12).addScaledVector(start.tangent, j * 1.1);
        tile.position.y += 0.06;
        tile.rotation.y = Math.atan2(start.tangent.x, start.tangent.z);
        this.group.add(tile);
      }
    }
  }

  private makeRoadLights() {
    for (let i = 0; i < 26; i++) {
      const progress = i / 26;
      if (progress > 0.58 && progress < 0.85) continue;
      const point = this.at(progress);
      const side = i % 2 === 0 ? -1 : 1;
      const group = new THREE.Group();
      const post = box(0.28, 4.2, 0.28, wood);
      post.position.y = 2.1;
      group.add(post);
      const housing = box(0.9, 1.1, 0.9, stoneDark);
      housing.position.y = 4.75;
      group.add(housing);
      const bright = box(0.65, 0.78, 0.66, glow);
      bright.position.y = 4.76;
      group.add(bright);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.7, 4), stoneDark);
      cap.position.y = 5.6;
      cap.rotation.y = Math.PI / 4;
      group.add(cap);
      group.position.copy(point.position).addScaledVector(point.right, side * 11.2);
      group.position.y = 0;
      this.group.add(group);
    }
  }

  private makeMarketBanners() {
    for (const progress of [0.025, 0.1, 0.17, 0.29, 0.93]) {
      const point = this.at(progress);
      const group = new THREE.Group();
      const rope = box(19, 0.1, 0.1, wood);
      rope.position.y = 7.5;
      group.add(rope);
      for (const side of [-1, 1]) {
        const pole = box(0.25, 8, 0.25, wood);
        pole.position.set(side * 9.5, 4, 0);
        group.add(pole);
      }
      for (let i = 0; i < 7; i++) {
        const flag = new THREE.Mesh(new THREE.ConeGeometry(0.88, 1.55, 3), i % 2 === 0 ? red : blue);
        flag.position.set(-7.5 + i * 2.5, 6.75, 0);
        flag.rotation.z = Math.PI;
        group.add(flag);
      }
      group.position.copy(point.position);
      group.position.y = 0;
      group.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
      this.group.add(group);
    }
  }

  private makeRouteSigns() {
    const signs: Array<{ progress: number; side: number; text: string; color: string }> = [
      { progress: 0.04, side: -1, text: 'ALLEY CUT', color: '#eac76b' },
      { progress: 0.186, side: -1, text: 'ROOF RAMP', color: '#8fe1f4' },
      { progress: 0.345, side: 1, text: 'PALACE GARDEN', color: '#eac76b' },
      { progress: 0.665, side: 1, text: 'CAVE ROUTE', color: '#8fe1f4' },
    ];
    for (const sign of signs) {
      const point = this.at(sign.progress);
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#202c4e';
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = sign.color;
      ctx.lineWidth = 8;
      ctx.strokeRect(5, 5, 502, 118);
      ctx.fillStyle = '#fff7e8';
      ctx.font = '900 49px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.text, 256, 68);
      const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), side: THREE.DoubleSide });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), material);
      face.position.y = 6.4;
      const post = box(0.35, 5.6, 0.35, stoneDark);
      post.position.y = 2.8;
      const group = new THREE.Group();
      group.add(post, face);
      group.position.copy(point.position).addScaledVector(point.right, sign.side * 10.8);
      group.position.y = 0;
      group.rotation.y = Math.atan2(point.tangent.x, point.tangent.z) + Math.PI;
      this.group.add(group);
    }
  }

  private makeDecor() {
    for (let i = 0; i < 55; i++) {
      const progress = i / 55;
      const sample = this.mainSamples[Math.floor(progress * this.mainSamples.length)];
      const side = i % 2 === 0 ? 1 : -1;
      const offset = 22 + this.rng() * 11;
      const position = sample.position.clone().addScaledVector(sample.right, side * offset);
      if (progress < 0.33 || progress > 0.88) {
        const facing = sample.right.clone().multiplyScalar(-side);
        const yaw = Math.atan2(facing.x, facing.z);
        this.makeBuilding(position, 8 + this.rng() * 7, 8 + this.rng() * 10, 8 + this.rng() * 9, i, yaw);
        if (i % 4 === 0) this.makeStall(sample.position.clone().addScaledVector(sample.right, side * 14.5), i, yaw);
      } else if (progress < 0.56) {
        if (i % 3 === 0) this.makeGardenWall(position);
        else this.makePalm(position, 7 + this.rng() * 3);
      } else {
        if (i % 4 === 0) this.makePalm(position, 7 + this.rng() * 4);
        else this.makeRock(position, 3 + this.rng() * 3);
      }
    }
    this.makeFountain();
    this.makeCave();
    this.makePalace();
    for (let i = 0; i < 25; i++) {
      const p = this.roofSamples[20 + Math.floor(this.rng() * 50)];
      const pos = p.position.clone();
      pos.y = -0.05;
      pos.addScaledVector(p.right, (i % 2 ? 1 : -1) * (11 + this.rng() * 13));
      const facing = p.right.clone().multiplyScalar(i % 2 ? -1 : 1);
      this.makeBuilding(pos, 9 + this.rng() * 7, 5 + this.rng() * 5, 9 + this.rng() * 7, i + 100, Math.atan2(facing.x, facing.z));
    }
  }

  private clearOfRoad(position: THREE.Vector3, radius: number) {
    for (const point of this.samples) {
      const dx = position.x - point.position.x;
      const dz = position.z - point.position.z;
      const clearance = point.width * 0.5 + radius + 1.5;
      if (dx * dx + dz * dz < clearance * clearance) return false;
    }
    return true;
  }

  private makeBuilding(position: THREE.Vector3, width: number, height: number, depth: number, seed: number, yaw: number) {
    if (!this.clearOfRoad(position, Math.hypot(width, depth) * 0.5 + 2)) return;
    const group = new THREE.Group();
    const body = box(width, height, depth, seed % 3 === 0 ? stoneLight : stone);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const lip = box(width + 0.6, 0.65, depth + 0.6, stoneLight);
    lip.position.y = height + 0.1;
    group.add(lip);
    if (seed % 4 === 0) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(width, depth) * 0.36, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
      dome.position.y = height + 0.35;
      dome.castShadow = true;
      group.add(dome);
    }
    const windowCount = Math.max(1, Math.floor(width / 5));
    for (let i = 0; i < windowCount; i++) {
      const window = box(1.15, 1.9, 0.08, glow);
      window.position.set(-width / 2 + (i + 1) * width / (windowCount + 1), height * 0.61, depth / 2 + 0.06);
      group.add(window);
    }
    const doorway = box(2.5, 3.6, 0.1, stoneDark);
    doorway.position.set(0, 1.8, depth / 2 + 0.1);
    group.add(doorway);
    const doorArch = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 4, 0, Math.PI, 0, Math.PI / 2), stoneDark);
    doorArch.position.set(0, 3.55, depth / 2 + 0.11);
    doorArch.scale.set(1, 0.35, 0.15);
    group.add(doorArch);
    const lintel = box(width * 0.7, 0.15, 0.22, roofMat);
    lintel.position.set(0, height * 0.78, depth / 2 + 0.12);
    group.add(lintel);
    group.position.copy(position);
    group.position.y = 0;
    group.rotation.y = yaw;
    this.group.add(group);
  }

  private makeStall(position: THREE.Vector3, seed: number, yaw: number) {
    if (!this.clearOfRoad(position, 5.3)) return;
    const group = new THREE.Group();
    const base = box(5.4, 1.7, 3.6, wood);
    base.position.y = 0.85;
    group.add(base);
    for (const x of [-2.4, 2.4]) {
      const pole = box(0.2, 2.8, 0.2, wood);
      pole.position.set(x, 2.8, -1.3);
      group.add(pole);
    }
    const canopy = box(6.5, 0.18, 4.7, seed % 2 === 0 ? red : blue);
    canopy.position.y = 4.3;
    canopy.rotation.z = seed % 2 ? -0.09 : 0.09;
    group.add(canopy);
    const lantern = box(0.5, 0.8, 0.5, glow);
    lantern.position.set(0, 3.1, -1.45);
    group.add(lantern);
    group.position.copy(position);
    group.position.y = 0;
    group.rotation.y = yaw;
    this.group.add(group);
  }

  private makePalm(position: THREE.Vector3, height: number) {
    if (!this.clearOfRoad(position, 2.5)) return;
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, height, 6), wood);
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    group.add(trunk);
    const leafGeo = new THREE.ConeGeometry(1, 5.3, 3);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(leafGeo, leaf);
      frond.position.set(Math.sin(i * Math.PI / 3) * 2.1, height + 0.2, Math.cos(i * Math.PI / 3) * 2.1);
      frond.rotation.z = 0.65;
      frond.rotation.y = i * Math.PI / 3;
      group.add(frond);
    }
    group.position.copy(position);
    group.position.y = 0;
    this.group.add(group);
  }

  private makeRock(position: THREE.Vector3, radius: number) {
    if (!this.clearOfRoad(position, radius + 1.2)) return;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), stoneDark);
    rock.scale.y = 0.65;
    rock.position.copy(position);
    rock.position.y = radius * 0.45;
    rock.castShadow = true;
    this.group.add(rock);
  }

  private makeGardenWall(position: THREE.Vector3) {
    if (!this.clearOfRoad(position, 6)) return;
    const wall = box(9, 3, 1.4, stoneLight);
    wall.position.copy(position);
    wall.position.y = 1.4;
    wall.rotation.y = this.rng() * 2;
    wall.castShadow = true;
    this.group.add(wall);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(2.3, 0), leaf);
    bush.position.copy(position);
    bush.position.y = 3.4;
    this.group.add(bush);
  }

  private makeFountain() {
    const sample = this.mainSamples[Math.floor(0.44 * this.mainSamples.length)];
    const position = sample.position.clone().addScaledVector(sample.right, -24);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.6, 1.2, 8), stoneLight);
    basin.position.copy(position);
    basin.position.y = 0.6;
    this.group.add(basin);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 0.1, 8), water);
    pool.position.copy(position);
    pool.position.y = 1.23;
    this.group.add(pool);
    const center = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 4, 8), stoneLight);
    center.position.copy(position);
    center.position.y = 2.9;
    this.group.add(center);
    const spout = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 8), water);
    spout.position.copy(position);
    spout.position.y = 6.1;
    this.group.add(spout);
  }

  private makeCave() {
    for (let i = 0; i < 6; i++) {
      const sample = this.mainSamples[Math.floor((0.68 + i * 0.012) * this.mainSamples.length)];
      const group = new THREE.Group();
      for (const side of [-1, 1]) {
        const pillar = box(2.6, 9, 5, stoneDark);
        pillar.position.set(side * 9.5, 4.5, 0);
        pillar.castShadow = true;
        group.add(pillar);
      }
      const top = box(19, 4, 5.5, stoneDark);
      top.position.y = 10;
      top.castShadow = true;
      group.add(top);
      group.position.copy(sample.position);
      group.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
      this.group.add(group);
    }
  }

  private makePalace() {
    const palace = new THREE.Group();
    const body = box(35, 15, 20, stoneLight);
    body.position.y = 7.5;
    palace.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
    dome.position.y = 15;
    palace.add(dome);
    for (const x of [-15, 15]) {
      const tower = box(6, 23, 6, stone);
      tower.position.set(x, 11.5, 0);
      palace.add(tower);
      const towerDome = new THREE.Mesh(new THREE.SphereGeometry(3.7, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
      towerDome.position.set(x, 23, 0);
      palace.add(towerDome);
    }
    const sample = this.mainSamples[Math.floor(0.46 * this.mainSamples.length)];
    palace.position.copy(sample.position).addScaledVector(sample.right, -55);
    palace.position.y = 0;
    this.group.add(palace);
  }

  private addObstacle(kind: Obstacle['kind'], point: RoadPoint, lateral: number, phase = 0) {
    const group = new THREE.Group();
    let radius = 2;
    if (kind === 'crate') {
      const crate = box(3.2, 3.2, 3.2, wood);
      crate.position.y = 1.6;
      crate.castShadow = true;
      group.add(crate);
      for (const x of [-1.2, 1.2]) {
        const stripe = box(0.2, 3.3, 3.3, stoneDark);
        stripe.position.set(x, 1.6, 0);
        group.add(stripe);
      }
      radius = 2.1;
    } else if (kind === 'boulder') {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2.45, 0), stoneDark);
      rock.position.y = 2.35;
      rock.castShadow = true;
      group.add(rock);
      radius = 2.65;
    } else {
      const body = box(4.3, 2.1, 2.6, wood);
      body.position.y = 1.8;
      body.castShadow = true;
      group.add(body);
      const awning = box(5, 0.18, 3.2, red);
      awning.position.y = 3.5;
      group.add(awning);
      radius = 2.8;
    }
    group.position.copy(point.position).addScaledVector(point.right, lateral);
    group.position.y = point.position.y;
    group.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
    this.group.add(group);
    this.obstacles.push({ kind, mesh: group, position: group.position, radius, broken: false, respawn: 0, moving: kind === 'boulder', basePosition: group.position.clone(), right: point.right.clone(), phase });
  }

  private makeObstacles() {
    this.addObstacle('cart', this.mainSamples[Math.floor(0.06 * 640)], 3.4);
    this.addObstacle('crate', this.alleySamples[25], 0);
    this.addObstacle('crate', this.alleySamples[55], -2.3);
    this.addObstacle('crate', this.mainSamples[Math.floor(0.24 * 640)], -4.2);
    this.addObstacle('boulder', this.mainSamples[Math.floor(0.705 * 640)], 0, 0);
    this.addObstacle('boulder', this.mainSamples[Math.floor(0.735 * 640)], 0, Math.PI);
  }

  private makePads() {
    const points = [this.roofSamples[59], this.mainSamples[Math.floor(0.54 * 640)]];
    for (const point of points) {
      const group = new THREE.Group();
      const base = box(point.width * 0.78, 0.045, 5.3, new THREE.MeshBasicMaterial({ color: 0x6a3c99 }));
      base.position.y = 0.03;
      group.add(base);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf2bd57 });
      this.carpetMaterials.push(mat);
      for (const x of [-point.width * 0.36, point.width * 0.36]) {
        const edge = box(0.2, 0.06, 5.4, mat);
        edge.position.set(x, 0.08, 0);
        group.add(edge);
      }
      for (let i = 0; i < 3; i++) {
        const stripe = box(point.width * 0.5, 0.05, 0.22, mat);
        stripe.position.set(0, 0.08, -1.7 + i * 1.6);
        group.add(stripe);
      }
      group.position.copy(point.position);
      group.position.y += 0.08;
      group.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
      this.group.add(group);
      this.boostPads.push({ position: group.position, radius: point.width * 0.43, route: point.route, mesh: group });
    }
  }

  at(progress: number): RoadPoint {
    const normalized = ((progress % 1) + 1) % 1;
    return this.mainSamples[Math.floor(normalized * this.mainSamples.length)];
  }

  routeAt(route: RouteName, progress: number): RoadPoint {
    if (route === 'main') return this.at(progress);
    const list = route === 'alley' ? this.alleySamples : this.roofSamples;
    const first = list[0].progress;
    const last = list[list.length - 1].progress;
    const fraction = Math.max(0, Math.min(1, (progress - first) / (last - first)));
    return list[Math.floor(fraction * (list.length - 1))];
  }

  nearest(position: THREE.Vector3, previousProgress?: number): RoadHit {
    let best = this.samples[0];
    let bestScore = Infinity;
    let bestDistance = Infinity;
    for (let i = 0; i < this.samples.length; i += 2) {
      const sample = this.samples[i];
      const dx = position.x - sample.position.x;
      const dz = position.z - sample.position.z;
      const dy = position.y - sample.position.y;
      const horizontal = dx * dx + dz * dz;
      let score = horizontal + dy * dy * 0.4;
      if (previousProgress !== undefined) {
        const diff = Math.abs(sample.progress - previousProgress);
        const circular = Math.min(diff, 1 - diff);
        if (circular > 0.08) score += (circular - 0.08) * 1100;
      }
      if (score < bestScore) {
        bestScore = score;
        bestDistance = Math.sqrt(horizontal);
        best = sample;
      }
    }
    const lateral = position.clone().sub(best.position).dot(best.right);
    return { point: best, distance: bestDistance, lateral, onRoad: Math.abs(lateral) < best.width / 2 + 0.5 && Math.abs(position.y - best.position.y) < 4.5 };
  }

  zone(progress: number): ZoneName {
    const p = ((progress % 1) + 1) % 1;
    if (p < 0.19 || p > 0.87) return 'MIDNIGHT MARKET';
    if (p < 0.35) return 'ROOFTOP RUN';
    if (p < 0.57) return 'PALACE GARDEN';
    return 'DESERT CAVE';
  }

  update(time: number, dt: number) {
    for (const obstacle of this.obstacles) {
      if (obstacle.broken) {
        obstacle.respawn -= dt;
        if (obstacle.respawn <= 0) {
          obstacle.broken = false;
          obstacle.mesh.visible = true;
        }
      }
      if (obstacle.moving && !obstacle.broken) {
        const shift = Math.sin(time * 0.9 + obstacle.phase) * 3;
        obstacle.mesh.position.copy(obstacle.basePosition).addScaledVector(obstacle.right, shift);
        obstacle.mesh.rotation.x += dt * 0.5;
      }
    }
    const pulse = 0.88 + 0.12 * Math.sin(time * 3);
    for (const material of this.carpetMaterials) material.color.setRGB(1, 0.65 * pulse, 0.25 * pulse);
  }
}
