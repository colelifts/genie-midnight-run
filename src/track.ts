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
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  halfWidth: number;
  halfLength: number;
  route: RouteName;
  mesh: THREE.Group;
}

export function touchesBoostPad(pad: BoostPad, position: THREE.Vector3, route: RouteName) {
  if (route !== pad.route || Math.abs(position.y - pad.position.y) > 2.5) return false;
  const toPad = position.clone().sub(pad.position);
  return Math.abs(toPad.dot(pad.right)) <= pad.halfWidth + 1.2 && Math.abs(toPad.dot(pad.tangent)) <= pad.halfLength + 1.8;
}

export function roadArrowRotation(tangent: THREE.Vector3) {
  return new THREE.Euler(Math.PI / 2, Math.atan2(tangent.x, tangent.z), 0, 'YXZ');
}

export function overMainPavement(main: RoadPoint[], position: THREE.Vector3, padding = 0) {
  for (const point of main) {
    if (Math.abs(point.position.y - position.y) > 1.3) continue;
    const dx = point.position.x - position.x;
    const dz = point.position.z - position.z;
    const clearance = point.width / 2 + padding;
    if (dx * dx + dz * dz < clearance * clearance) return true;
  }
  return false;
}

export function branchCoversMainEdge(branches: RoadPoint[][], position: THREE.Vector3) {
  for (const branch of branches) {
    for (const point of branch) {
      if (Math.abs(point.position.y - position.y) > 2.7) continue;
      const dx = point.position.x - position.x;
      const dz = point.position.z - position.z;
      const clearance = point.width / 2 + 2.4;
      if (dx * dx + dz * dz < clearance * clearance) return true;
    }
  }
  return false;
}

export const MARKET_BANNER_SPANS = [0.025, 0.08, 0.17, 0.235, 0.29, 0.89, 0.93, 0.97];
export const CAVE_ARCH_SPANS = [0.684, 0.721, 0.758];
export const CAVE_ARCH_SHAPE = { pillarOutset: 8, pillarHalfWidth: 7.4, crystalOutset: 5.5, crystalRadius: 1.7, ceilingY: 16.5, ceilingHalfHeight: 4.8 };
export const COURSE_SCALE = 2.5;
export const MAIN_ROAD_WIDTH = 84;
export const ALLEY_ROAD_WIDTH = 40;
export const ROOF_ROAD_WIDTH = 42;
export const ALLEY_OFFSET = -80;
export const ROOF_OFFSET = -103;

export function clearOfOtherRoutes(samples: RoadPoint[], position: THREE.Vector3, radius: number, excludedRoute: RouteName) {
  for (const point of samples) {
    if (point.route === excludedRoute) continue;
    const dx = position.x - point.position.x;
    const dz = position.z - point.position.z;
    const clearance = point.width * 0.5 + radius + 0.6;
    if (dx * dx + dz * dz < clearance * clearance) return false;
  }
  return true;
}

const sand = new THREE.MeshStandardMaterial({ color: 0xb77b5c, roughness: 1, flatShading: true });
const stone = new THREE.MeshStandardMaterial({ color: 0xc48b66, roughness: 0.92 });
const stoneLight = new THREE.MeshStandardMaterial({ color: 0xd7a476, roughness: 0.9 });
const stoneDark = new THREE.MeshStandardMaterial({ color: 0x865e59, roughness: 0.97, flatShading: true });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x9d6577, roughness: 0.84, flatShading: true });
const roadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, side: THREE.DoubleSide });
const red = new THREE.MeshStandardMaterial({ color: 0xd65b62, roughness: 0.93, side: THREE.DoubleSide });
const blue = new THREE.MeshStandardMaterial({ color: 0x4669a3, roughness: 0.93, side: THREE.DoubleSide });
const leaf = new THREE.MeshStandardMaterial({ color: 0x477653, roughness: 0.92, flatShading: true, side: THREE.DoubleSide });
const wood = new THREE.MeshStandardMaterial({ color: 0x705142, roughness: 0.95 });
const water = new THREE.MeshBasicMaterial({ color: 0x51c1db, transparent: true, opacity: 0.9 });
const glow = new THREE.MeshBasicMaterial({ color: 0xffca67 });
const gold = new THREE.MeshStandardMaterial({ color: 0xdfaf63, metalness: 0.38, roughness: 0.52 });

const box = (w: number, h: number, d: number, material: THREE.Material) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);

let lanternHaloTexture: THREE.CanvasTexture | undefined;
function lanternHalo(size: number, color = 0xffba58) {
  if (!lanternHaloTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 63);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.16, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    lanternHaloTexture = new THREE.CanvasTexture(canvas);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: lanternHaloTexture, color, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

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

export function makeMainCurve() {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(-95, 0, -96),
    new THREE.Vector3(-44, 0, -107),
    new THREE.Vector3(7, 0, -102),
    new THREE.Vector3(55, 0, -91),
    new THREE.Vector3(100, 0, -60),
    new THREE.Vector3(118, 0, -15),
    new THREE.Vector3(110, 0, 35),
    new THREE.Vector3(85, 0, 78),
    new THREE.Vector3(35, 0, 103),
    new THREE.Vector3(-20, 0, 105),
    new THREE.Vector3(-68, 0, 106),
    new THREE.Vector3(-111, 0, 77),
    new THREE.Vector3(-135, 0, 31),
    new THREE.Vector3(-130, 0, -20),
    new THREE.Vector3(-125, 0, -68),
  ].map((point) => point.multiplyScalar(COURSE_SCALE)), true, 'catmullrom', 0.5);
}

export function makeBranchSamples(mainCurve: THREE.CatmullRomCurve3, route: RouteName, start: number, end: number, maxOffset: number, maxHeight: number, width: number): RoadPoint[] {
  const result: RoadPoint[] = [];
  const count = 90;
  const startPoint = mainCurve.getPointAt(start);
  const endPoint = mainCurve.getPointAt(end);
  for (let i = 0; i <= count; i++) {
    const f = i / count;
    const progress = start + (end - start) * f;
    const mainPoint = mainCurve.getPointAt(progress);
    const tangent = mainCurve.getTangentAt(progress).normalize();
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const chord = startPoint.clone().lerp(endPoint, f);
    const cut = Math.pow(Math.sin(Math.PI * f), 1.2) * 0.42;
    const position = mainPoint.clone().lerp(chord, cut).addScaledVector(right, maxOffset * Math.sin(Math.PI * f) ** 2);
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

function makePavingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(13579);
  ctx.fillStyle = '#62545f';
  ctx.fillRect(0, 0, 512, 512);
  const palette = ['#78666e', '#74626b', '#70606b', '#7d6b72', '#75636e'];
  for (let row = 0; row < 10; row++) {
    for (let col = -1; col < 7; col++) {
      const x = col * 90 + (row % 2) * 45;
      const y = row * 52;
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
      ctx.fillRect(x + 2, y + 2, 87, 49);
      ctx.fillStyle = 'rgba(255,211,180,0.045)';
      ctx.fillRect(x + 4, y + 4, 83, 3);
      ctx.fillStyle = 'rgba(30,23,42,0.055)';
      ctx.fillRect(x + 4, y + 47, 83, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class RaceTrack {
  readonly mainWidth = MAIN_ROAD_WIDTH;
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
  private readonly marketPeople: Array<{ figure: THREE.Group; phase: number; baseX: number }> = [];
  private readonly marketWalkers: Array<{ figure: THREE.Group; progress: number; side: number; phase: number; leftArm: THREE.Mesh; rightArm: THREE.Mesh }> = [];

  constructor(scene: THREE.Scene) {
    roadMat.map = makePavingTexture();
    roadMat.needsUpdate = true;
    this.mainCurve = makeMainCurve();
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
    this.makeMarketWalkers();
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
      this.mainSamples.push({ position, tangent, right, progress, width: this.mainWidth, route: 'main' });
    }
    this.alleySamples.push(...makeBranchSamples(this.mainCurve, 'alley', 0.045, 0.16, ALLEY_OFFSET, 0, ALLEY_ROAD_WIDTH));
    this.roofSamples.push(...makeBranchSamples(this.mainCurve, 'roof', 0.19, 0.33, ROOF_OFFSET, 5.4, ROOF_ROAD_WIDTH));
    this.samples.push(...this.mainSamples, ...this.alleySamples, ...this.roofSamples);
  }

  private makeTerrain() {
    const ground = box(1400, 1, 1400, sand);
    ground.position.y = -0.7;
    ground.receiveShadow = true;
    this.group.add(ground);
    const duneGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 45; i++) {
      const angle = (i / 45) * Math.PI * 2;
      const distance = 460 + this.rng() * 120;
      const dune = new THREE.Mesh(duneGeo, i % 3 === 0 ? stoneDark : stone);
      dune.scale.set(20 + this.rng() * 28, 9 + this.rng() * 14, 18 + this.rng() * 25);
      dune.position.set(Math.sin(angle) * distance, -6, Math.cos(angle) * distance);
      this.group.add(dune);
    }
    const distantStone = new THREE.MeshStandardMaterial({ color: 0x5f536d, roughness: 1, flatShading: true });
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2;
      const distance = 570 + this.rng() * 120;
      const mountain = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), distantStone);
      mountain.scale.set(34 + this.rng() * 32, 19 + this.rng() * 22, 34 + this.rng() * 31);
      mountain.position.set(Math.sin(angle) * distance, -7, Math.cos(angle) * distance);
      this.group.add(mountain);
    }
  }

  private makeRoad(points: RoadPoint[], closed: boolean) {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const count = points.length;
    let pathDistance = 0;
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (i > 0) pathDistance += point.position.distanceTo(points[i - 1].position);
      const half = point.width / 2;
      const left = point.position.clone().addScaledVector(point.right, -half);
      const right = point.position.clone().addScaledVector(point.right, half);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      uvs.push(0, pathDistance / 12, point.width / 18, pathDistance / 12);
    }
    const segments = closed ? count : count - 1;
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % count;
      indices.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const road = new THREE.Mesh(geometry, roadMat);
    road.receiveShadow = true;
    this.group.add(road);
    this.makeCurbs(points, closed);
    this.makeEdgeBarriers(points, closed);
    if (points[0].route === 'roof') {
      this.makeRoofDeck(points);
      this.makeRoofRails(points);
    }
  }

  private makeEdgeBarriers(points: RoadPoint[], closed: boolean) {
    const placements: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    const branches = [this.alleySamples, this.roofSamples];
    for (const side of [-1, 1]) {
      for (let i = 0; i < points.length - (closed ? 0 : 1); i += 3) {
        if (!closed && (i < 18 || i > points.length - 21)) continue;
        const a = points[i];
        const b = points[(i + 3) % points.length];
        if (!closed && i + 3 >= points.length) continue;
        const edgeA = a.position.clone().addScaledVector(a.right, side * (a.width / 2 + 0.26));
        const edgeB = b.position.clone().addScaledVector(b.right, side * (b.width / 2 + 0.26));
        const middle = edgeA.clone().add(edgeB).multiplyScalar(0.5);
        if (closed) {
          if (branchCoversMainEdge(branches, edgeA) || branchCoversMainEdge(branches, middle) || branchCoversMainEdge(branches, edgeB)) continue;
        } else if (overMainPavement(this.mainSamples, edgeA, 1) || overMainPavement(this.mainSamples, middle, 1) || overMainPavement(this.mainSamples, edgeB, 1)) continue;
        middle.y += 0.31;
        const heading = Math.atan2(edgeB.x - edgeA.x, edgeB.z - edgeA.z);
        dummy.position.copy(middle);
        dummy.rotation.set(0, heading, 0);
        dummy.scale.set(0.58, 0.58, edgeA.distanceTo(edgeB) + 0.15);
        dummy.updateMatrix();
        placements.push(dummy.matrix.clone());
      }
    }
    const barriers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stoneLight, placements.length);
    placements.forEach((matrix, i) => barriers.setMatrixAt(i, matrix));
    barriers.instanceMatrix.needsUpdate = true;
    barriers.receiveShadow = true;
    this.group.add(barriers);
  }

  private makeCurbs(points: RoadPoint[], closed: boolean) {
    for (const side of [-1, 1]) {
      const vertices: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      const coveredByMain: boolean[] = [];
      const count = points.length;
      for (let i = 0; i < count; i++) {
        const point = points[i];
        const inner = point.position.clone().addScaledVector(point.right, side * (point.width / 2 - 0.05));
        const outer = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 0.75));
        inner.y += 0.035;
        outer.y += 0.035;
        vertices.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
        coveredByMain.push(!closed && (overMainPavement(this.mainSamples, inner, 1) || overMainPavement(this.mainSamples, outer, 1)));
        const color = Math.floor(i / 6) % 2 === 0 ? new THREE.Color(0xe8dcce) : new THREE.Color(0xc85d65);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
      for (let i = 0; i < (closed ? count : count - 1); i++) {
        const j = (i + 1) % count;
        if (coveredByMain[i] || coveredByMain[j]) continue;
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

  private makeRoofDeck(points: RoadPoint[]) {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xb98668, roughness: 0.94, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const vertices: number[] = [];
      const indices: number[] = [];
      for (let i = 18; i <= points.length - 19; i++) {
        const point = points[i];
        const edge = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 0.5));
        const bottom = Math.min(edge.y - 0.12, 0.04);
        vertices.push(edge.x, edge.y - 0.08, edge.z, edge.x, bottom, edge.z);
        const j = i - 18;
        if (j > 0) indices.push((j - 1) * 2, (j - 1) * 2 + 1, j * 2, (j - 1) * 2 + 1, j * 2 + 1, j * 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const wall = new THREE.Mesh(geometry, wallMaterial);
      wall.receiveShadow = true;
      this.group.add(wall);
    }
  }

  private makeRoofRails(points: RoadPoint[]) {
    for (const side of [-1, 1]) {
      for (let i = 18; i < points.length - 19; i += 3) {
        const a = points[i];
        const b = points[Math.min(i + 3, points.length - 19)];
        const edgeA = a.position.clone().addScaledVector(a.right, side * (a.width / 2 + 0.85));
        const edgeB = b.position.clone().addScaledVector(b.right, side * (b.width / 2 + 0.85));
        const rail = box(0.22, 0.2, edgeA.distanceTo(edgeB) + 0.12, gold);
        rail.position.copy(edgeA).add(edgeB).multiplyScalar(0.5);
        rail.position.y += 1.25;
        rail.rotation.y = Math.atan2(edgeB.x - edgeA.x, edgeB.z - edgeA.z);
        this.group.add(rail);
      }
      for (let i = 18; i <= points.length - 19; i += 9) {
        const sample = points[i];
        const post = box(0.34, 1.52, 0.34, stoneDark);
        post.position.copy(sample.position).addScaledVector(sample.right, side * (sample.width / 2 + 0.85));
        post.position.y += 0.76;
        this.group.add(post);
        const cap = box(0.55, 0.17, 0.55, stoneLight);
        cap.position.copy(post.position);
        cap.position.y += 0.81;
        this.group.add(cap);
      }
    }
    for (let i = 26; i < points.length - 25; i += 12) {
      const sample = points[i];
      for (const side of [-1, 1]) {
        const position = sample.position.clone().addScaledVector(sample.right, side * (sample.width / 2 + 1.6));
        if (!this.clearOfOtherRoad(position, 1.3, 'roof')) continue;
        const support = box(1.8, Math.max(0.5, sample.position.y), 1.8, stoneDark);
        support.position.copy(position);
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
      for (const lane of [-0.25, 0.25]) {
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.rotation.copy(roadArrowRotation(sample.tangent));
        arrow.position.copy(sample.position).addScaledVector(sample.right, sample.width * lane);
        arrow.position.y += 0.045;
        this.group.add(arrow);
      }
    }
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xc4b8ad, transparent: true, opacity: 0.48 });
    for (let i = 5; i < this.mainSamples.length; i += 11) {
      const point = this.mainSamples[i];
      for (const lane of [-0.25, 0, 0.25]) {
        const dash = box(0.19, 0.025, 4.4, lineMaterial);
        dash.position.copy(point.position).addScaledVector(point.right, point.width * lane);
        dash.position.y += 0.065;
        dash.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
        this.group.add(dash);
      }
    }
    const start = this.mainSamples[0];
    const gridHalfTiles = Math.floor((start.width / 2 - 2) / 1.12);
    for (let i = -gridHalfTiles; i <= gridHalfTiles; i++) {
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
    for (let i = 0; i < 46; i++) {
      const progress = i / 46;
      if (progress > 0.58 && progress < 0.85) continue;
      const point = this.at(progress);
      const side = i % 2 === 0 ? -1 : 1;
      const lampPosition = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 3.8));
      if (!this.clearOfOtherRoad(lampPosition, 1.5, 'main')) continue;
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
      const halo = lanternHalo(5.4);
      halo.position.y = 4.76;
      group.add(halo);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(8, 10), new THREE.MeshBasicMaterial({ map: lanternHaloTexture, color: 0xffb65d, transparent: true, opacity: 0.27, blending: THREE.AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.copy(point.position).addScaledVector(point.right, side * (point.width / 2 - 1.4));
      pool.position.y += 0.09;
      this.group.add(pool);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.7, 4), stoneDark);
      cap.position.y = 5.6;
      cap.rotation.y = Math.PI / 4;
      group.add(cap);
      group.position.copy(lampPosition);
      group.position.y = 0;
      this.group.add(group);
    }
  }

  private makeMarketBanners() {
    for (let span = 0; span < MARKET_BANNER_SPANS.length; span++) {
      const progress = MARKET_BANNER_SPANS[span];
      const point = this.at(progress);
      const group = new THREE.Group();
      const spanWidth = point.width + 6;
      const poleClear = [-1, 1].every((side) => this.clearOfOtherRoad(point.position.clone().addScaledVector(point.right, side * spanWidth / 2), 1, 'main'));
      if (!poleClear) continue;
      const rope = box(spanWidth, 0.1, 0.1, wood);
      rope.position.y = 7.5;
      group.add(rope);
      for (const side of [-1, 1]) {
        const pole = box(0.25, 8, 0.25, wood);
        pole.position.set(side * spanWidth / 2, 4, 0);
        group.add(pole);
      }
      const flagCount = Math.floor((spanWidth - 5) / 2.5);
      for (let i = 0; i < flagCount; i++) {
        const flag = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.12, 3), i % 2 === 0 ? red : blue);
        flag.position.set((i - (flagCount - 1) / 2) * 2.5, 6.98, 0);
        flag.rotation.z = Math.PI;
        group.add(flag);
      }
      for (const fraction of [-0.4, -0.2, 0, 0.2, 0.4]) {
        const x = fraction * spanWidth;
        const hook = box(0.055, 0.48, 0.055, wood);
        hook.position.set(x, 7.15, 0.2);
        group.add(hook);
        const lantern = box(0.43, 0.62, 0.4, glow);
        lantern.position.set(x, 6.65, 0.2);
        group.add(lantern);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.28, 4), stoneDark);
        roof.position.set(x, 7.12, 0.2);
        roof.rotation.y = Math.PI / 4;
        group.add(roof);
        const halo = lanternHalo(4.1);
        halo.position.set(x, 6.65, 0.2);
        group.add(halo);
      }
      if (span % 3 === 1) {
        const cloth = new THREE.BufferGeometry();
        const vertices: number[] = [];
        const indices: number[] = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          const x = -spanWidth / 2 + t * spanWidth;
          const sag = Math.sin(t * Math.PI) * 1.1;
          vertices.push(x, 7.6 - sag, 1.4, x, 6.75 - sag, 1.4);
          if (i > 0) indices.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
        }
        cloth.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        cloth.setIndex(indices);
        cloth.computeVertexNormals();
        group.add(new THREE.Mesh(cloth, span % 2 ? red : blue));
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
      group.position.copy(point.position).addScaledVector(point.right, sign.side * (point.width / 2 + 6));
      group.position.y = 0;
      group.rotation.y = Math.atan2(point.tangent.x, point.tangent.z) + Math.PI;
      this.group.add(group);
    }
  }

  private makeDecor() {
    for (let i = 0; i < 205; i++) {
      const progress = i / 205;
      const sample = this.mainSamples[Math.floor(progress * this.mainSamples.length)];
      const side = i % 2 === 0 ? 1 : -1;
      const offset = sample.width / 2 + 16 + this.rng() * 12;
      const position = sample.position.clone().addScaledVector(sample.right, side * offset);
      if (progress < 0.33 || progress > 0.88) {
        const facing = sample.right.clone().multiplyScalar(-side);
        const yaw = Math.atan2(facing.x, facing.z);
        this.makeBuilding(position, 8 + this.rng() * 7, 8 + this.rng() * 10, 8 + this.rng() * 9, i, yaw);
        if (i % 4 < 2) this.makeStall(sample.position.clone().addScaledVector(sample.right, side * (sample.width / 2 + 7.5)), i, yaw);
      } else if (progress < 0.56) {
        if (i % 3 === 0) this.makeGardenWall(position);
        else this.makePalm(position, 7 + this.rng() * 3);
      } else {
        if (i % 4 === 0) this.makePalm(position, 7 + this.rng() * 4);
        else this.makeRock(position, 3 + this.rng() * 3);
      }
    }
    this.makeFountain();
    this.makeGarden();
    this.makeCave();
    this.makePalace();
    this.makeMarketGate(0.12);
    this.makeMarketGate(0.91);
    for (let i = 0; i < 25; i++) {
      const p = this.roofSamples[20 + Math.floor(this.rng() * 50)];
      const pos = p.position.clone();
      pos.y = -0.05;
      pos.addScaledVector(p.right, (i % 2 ? 1 : -1) * (p.width / 2 + 17 + this.rng() * 13));
      const facing = p.right.clone().multiplyScalar(i % 2 ? -1 : 1);
      this.makeBuilding(pos, 9 + this.rng() * 7, 5 + this.rng() * 5, 9 + this.rng() * 7, i + 100, Math.atan2(facing.x, facing.z));
    }
  }

  private makeMarketWalkers() {
    const progressPoints = [0.018, 0.058, 0.103, 0.148, 0.183, 0.895, 0.925, 0.953, 0.98];
    const robeGeometry = new THREE.CylinderGeometry(0.4, 0.56, 1.65, 9);
    const headGeometry = new THREE.SphereGeometry(0.34, 10, 8);
    const turbanGeometry = new THREE.SphereGeometry(0.42, 10, 6);
    const armGeometry = new THREE.CylinderGeometry(0.13, 0.16, 0.9, 7);
    progressPoints.forEach((progress, i) => {
      const figure = new THREE.Group();
      const clothes = i % 3 === 0 ? red : i % 3 === 1 ? blue : roofMat;
      const robe = new THREE.Mesh(robeGeometry, clothes);
      robe.position.y = 0.95;
      const head = new THREE.Mesh(headGeometry, stoneLight);
      head.position.y = 2.05;
      const turban = new THREE.Mesh(turbanGeometry, i % 2 === 0 ? stoneLight : gold);
      turban.scale.y = 0.5;
      turban.position.y = 2.38;
      const leftArm = new THREE.Mesh(armGeometry, clothes);
      const rightArm = new THREE.Mesh(armGeometry, clothes);
      leftArm.position.set(-0.49, 1.46, 0);
      rightArm.position.set(0.49, 1.46, 0);
      leftArm.rotation.z = -0.23;
      rightArm.rotation.z = 0.23;
      figure.add(robe, head, turban, leftArm, rightArm);
      const side = progress < 0.19 ? 1 : i % 2 === 0 ? -1 : 1;
      this.group.add(figure);
      this.marketWalkers.push({ figure, progress, side, phase: i * 1.35, leftArm, rightArm });
    });
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

  private clearOfOtherRoad(position: THREE.Vector3, radius: number, excludedRoute: RouteName) {
    return clearOfOtherRoutes(this.samples, position, radius, excludedRoute);
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
    const cornice = box(width + 0.35, 0.3, depth + 0.35, stoneDark);
    cornice.position.y = height - 1.15;
    group.add(cornice);
    for (const side of [-1, 1]) {
      const pilaster = box(0.48, height * 0.82, 0.42, stoneLight);
      pilaster.position.set(side * (width / 2 - 0.36), height * 0.41, depth / 2 + 0.12);
      group.add(pilaster);
    }
    if (seed % 4 === 0) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(width, depth) * 0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
      dome.position.y = height + 0.35;
      dome.castShadow = true;
      group.add(dome);
      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.23, 1.2, 8), stoneLight);
      finial.position.y = height + Math.min(width, depth) * 0.37 + 0.65;
      group.add(finial);
    }
    const windowCount = Math.max(1, Math.floor(width / 5));
    for (let i = 0; i < windowCount; i++) {
      const x = -width / 2 + (i + 1) * width / (windowCount + 1);
      const frame = box(1.65, 2.35, 0.13, stoneDark);
      frame.position.set(x, height * 0.64, depth / 2 + 0.06);
      const window = box(1.06, 1.62, 0.09, glow);
      window.position.set(x, height * 0.64, depth / 2 + 0.15);
      const sill = box(1.86, 0.22, 0.55, stoneLight);
      sill.position.set(x, height * 0.64 - 1.17, depth / 2 + 0.28);
      group.add(frame, window, sill);
      if (seed % 2 === 0) {
        const halo = lanternHalo(2.7);
        halo.position.set(x, height * 0.64, depth / 2 + 0.25);
        group.add(halo);
      }
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
    if (seed % 3 !== 1) {
      const fabric = Math.floor(seed / 2) % 2 === 0 ? red : blue;
      const awningWidth = width * 0.83;
      const awningHeight = Math.min(height * 0.48, 6);
      const roof = new THREE.BufferGeometry();
      roof.setAttribute('position', new THREE.Float32BufferAttribute([
        -awningWidth / 2, awningHeight + 0.65, depth / 2 + 0.05,
        awningWidth / 2, awningHeight + 0.65, depth / 2 + 0.05,
        -awningWidth / 2, awningHeight - 0.45, depth / 2 + 3.65,
        awningWidth / 2, awningHeight - 0.45, depth / 2 + 3.65,
      ], 3));
      roof.setIndex([0, 2, 1, 1, 2, 3]);
      roof.computeVertexNormals();
      group.add(new THREE.Mesh(roof, fabric));
      const valance = box(awningWidth, 0.36, 0.12, fabric);
      valance.position.set(0, awningHeight - 0.59, depth / 2 + 3.7);
      group.add(valance);
      for (const side of [-1, 1]) {
        const brace = box(0.14, awningHeight - 0.5, 0.14, wood);
        brace.position.set(side * awningWidth * 0.48, (awningHeight - 0.5) / 2, depth / 2 + 3.5);
        group.add(brace);
      }
    }
    if (seed % 4 === 1) {
      const porchLamp = box(0.62, 0.88, 0.62, glow);
      porchLamp.position.set(width * 0.25, 3.7, depth / 2 + 0.48);
      group.add(porchLamp);
      const halo = lanternHalo(4);
      halo.position.copy(porchLamp.position);
      group.add(halo);
    }
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
      const pole = box(0.2, 3.4, 0.2, wood);
      pole.position.set(x, 3.4, -1.3);
      group.add(pole);
      const frontPole = box(0.2, 2.8, 0.2, wood);
      frontPole.position.set(x, 1.8, 2.15);
      group.add(frontPole);
    }
    const fabric = Math.floor(seed / 4) % 2 === 0 ? red : blue;
    const canopy = new THREE.Mesh(new THREE.PlaneGeometry(7, 5.6), fabric);
    canopy.rotation.x = -Math.PI / 2 + 0.35;
    canopy.position.set(0, 4.23, 0);
    group.add(canopy);
    const frontFlap = box(7, 0.42, 0.12, fabric);
    frontFlap.position.set(0, 3.08, 2.66);
    group.add(frontFlap);
    for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) {
      const fringe = new THREE.Mesh(new THREE.ConeGeometry(0.39, 0.6, 3), fabric);
      fringe.rotation.z = Math.PI;
      fringe.position.set(x, 2.7, 2.67);
      group.add(fringe);
    }
    const lantern = box(0.5, 0.8, 0.5, glow);
    lantern.position.set(0, 3.85, -1.45);
    group.add(lantern);
    const halo = lanternHalo(4.5);
    halo.position.copy(lantern.position);
    group.add(halo);
    const frontLantern = box(0.4, 0.62, 0.4, glow);
    frontLantern.position.set(seed % 2 === 0 ? -2 : 2, 2.5, 2.8);
    group.add(frontLantern);
    const frontHalo = lanternHalo(3.8);
    frontHalo.position.copy(frontLantern.position);
    group.add(frontHalo);
    for (let i = 0; i < 3; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.49, 0.95, 8), i % 2 ? roofMat : blue);
      jar.position.set((i - 1) * 1.35, 2.15, 0.15);
      group.add(jar);
    }
    for (const x of [-1.8, 1.8]) {
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 0.6, 8), wood);
      basket.position.set(x, 2.02, 1.45);
      group.add(basket);
      for (let i = 0; i < 3; i++) {
        const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), i % 2 ? red : stoneLight);
        fruit.position.set(x + (i - 1) * 0.24, 2.42, 1.45);
        group.add(fruit);
      }
    }
    if (seed % 3 !== 1) {
      const figure = new THREE.Group();
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.54, 1.68, 9), seed % 4 === 0 ? blue : red);
      robe.position.y = 0.92;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.37, 10, 8), stoneLight);
      head.position.y = 2.04;
      const turban = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 6), seed % 2 === 0 ? stoneLight : roofMat);
      turban.scale.y = 0.48;
      turban.position.y = 2.37;
      figure.add(robe, head, turban);
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 1.04, 7), seed % 4 === 0 ? blue : red);
        arm.position.set(side * 0.52, 1.35, 0.03);
        arm.rotation.z = side * 0.28;
        figure.add(arm);
      }
      const baseX = seed % 2 === 0 ? -0.72 : 0.72;
      figure.position.set(baseX, 0.95, -0.25);
      group.add(figure);
      this.marketPeople.push({ figure, phase: seed * 1.7, baseX });
    }
    group.position.copy(position);
    group.position.y = 0;
    group.rotation.y = yaw;
    this.group.add(group);
  }

  private makePalm(position: THREE.Vector3, height: number) {
    if (!this.clearOfRoad(position, 2.5)) return;
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.72, height, 9, 6), wood);
    trunk.position.y = height / 2;
    trunk.rotation.z = 0.065;
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 7; i++) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.45 + i * 0.035, 0.46 + i * 0.035, 0.1, 9), stoneDark);
      ring.position.set((height * 0.065) * (1 - i / 7), height * (0.14 + i * 0.11), 0);
      group.add(ring);
    }
    const crown = new THREE.Group();
    crown.position.set(height * 0.065, height, 0);
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2;
      const length = 4.4 + (i % 3) * 0.45;
      const verts: number[] = [];
      const uvs: number[] = [];
      const index: number[] = [];
      for (let j = 0; j <= 5; j++) {
        const t = j / 5;
        const reach = 0.55 + t * length;
        const drop = 0.45 + Math.sin(t * Math.PI) * 0.55 - t * t * 2.65;
        const spread = Math.sin(t * Math.PI) * (0.83 - t * 0.24) + 0.03;
        for (const side of [-1, 1]) {
          const sideways = side * spread;
          verts.push(Math.sin(angle) * reach + Math.cos(angle) * sideways, drop, Math.cos(angle) * reach - Math.sin(angle) * sideways);
          uvs.push(side < 0 ? 0 : 1, t);
        }
        if (j < 5) index.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(index);
      geometry.computeVertexNormals();
      const frond = new THREE.Mesh(geometry, leaf);
      frond.castShadow = true;
      crown.add(frond);
    }
    group.add(crown);
    group.position.copy(position);
    group.position.y = 0;
    this.group.add(group);
  }

  private makeGarden() {
    const green = new THREE.MeshStandardMaterial({ color: 0x397255, roughness: 0.9 });
    const hedge = new THREE.MeshStandardMaterial({ color: 0x265942, roughness: 0.95 });
    const flower = new THREE.MeshBasicMaterial({ color: 0xf2ae8a });
    for (let i = 0; i < 33; i++) {
      const progress = 0.34 + i * 0.0067;
      const point = this.at(progress);
      for (const side of [-1, 1]) {
        const section = new THREE.Group();
        const plinth = box(7.2, 1.2, 1.4, stoneLight);
        plinth.position.y = 0.62;
        section.add(plinth);
        const trim = box(7.4, 0.24, 1.68, stoneDark);
        trim.position.y = 1.31;
        section.add(trim);
        if (i % 3 === 0) {
          const post = box(0.95, 2.8, 1.05, stoneLight);
          post.position.y = 1.4;
          section.add(post);
          const postCap = box(1.2, 0.26, 1.32, stoneDark);
          postCap.position.y = 2.89;
          section.add(postCap);
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), glow);
          lamp.position.y = 3.44;
          section.add(lamp);
          const halo = lanternHalo(4.6);
          halo.position.y = 3.44;
          section.add(halo);
        }
        section.position.copy(point.position).addScaledVector(point.right, side * (point.width / 2 + 1.2));
        section.position.y = 0;
        section.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
        this.group.add(section);
        if (i % 3 !== 0) {
          const planter = new THREE.Group();
          const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.76, 1, 8), roofMat);
          pot.position.y = 0.52;
          planter.add(pot);
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.16, 0.19, 8), gold);
          rim.position.y = 1.02;
          planter.add(rim);
          const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), i % 2 ? green : hedge);
          leaves.position.y = 1.8;
          planter.add(leaves);
          for (let f = 0; f < 5; f++) {
            const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), flower);
            const angle = f / 5 * Math.PI * 2;
            blossom.position.set(Math.sin(angle) * 0.84, 1.65 + (f % 2) * 0.4, Math.cos(angle) * 0.84);
            planter.add(blossom);
          }
          planter.position.copy(point.position).addScaledVector(point.right, side * (point.width / 2 + 4.7));
          planter.position.y = 0;
          this.group.add(planter);
        }
        if (i % 5 === 0) {
          const palmPos = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 12));
          this.makePalm(palmPos, 9 + this.rng() * 2.5);
        }
      }
    }
    for (const progress of [0.375, 0.445, 0.515]) {
      const point = this.at(progress);
      const pavilion = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 6.2, 0.68, 12), stoneLight);
      base.position.y = 0.35;
      pavilion.add(base);
      for (let j = 0; j < 8; j++) {
        const angle = j / 8 * Math.PI * 2;
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.59, 6, 10), stoneLight);
        column.position.set(Math.sin(angle) * 4.5, 3.55, Math.cos(angle) * 4.5);
        pavilion.add(column);
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), glow);
        light.position.set(Math.sin(angle) * 4.5, 5.05, Math.cos(angle) * 4.5);
        pavilion.add(light);
      }
      const roof = new THREE.Mesh(new THREE.SphereGeometry(5.8, 20, 9, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
      roof.position.y = 6.45;
      pavilion.add(roof);
      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.48, 2.2, 12), gold);
      finial.position.y = 12.6;
      pavilion.add(finial);
      pavilion.position.copy(point.position).addScaledVector(point.right, (progress === 0.445 ? -1 : 1) * (point.width / 2 + 25));
      pavilion.position.y = 0;
      if (this.clearOfRoad(pavilion.position, 7)) this.group.add(pavilion);
    }
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
    const position = sample.position.clone().addScaledVector(sample.right, -(sample.width / 2 + 22));
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
    const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
    const caveStone = new THREE.MeshStandardMaterial({ color: 0x66596c, roughness: 0.97, flatShading: true });
    const crystal = new THREE.MeshBasicMaterial({ color: 0x67dbed, toneMapped: false });
    for (let i = 0; i < 12; i++) {
      const sample = this.mainSamples[Math.floor((0.665 + i * 0.01) * this.mainSamples.length)];
      for (const side of [-1, 1]) {
        const size = 3.4 + this.rng() * 2.1;
        const rock = new THREE.Mesh(rockGeometry, i % 3 === 0 ? stoneDark : stone);
        rock.scale.set(size * 1.05, size * (1.15 + this.rng() * 0.65), size * 1.35);
        rock.position.copy(sample.position).addScaledVector(sample.right, side * (sample.width / 2 + 6.5 + this.rng() * 3.2));
        rock.position.y = rock.scale.y * 0.62 - 0.1;
        rock.rotation.y = this.rng() * Math.PI;
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.group.add(rock);
      }
    }
    for (const progress of CAVE_ARCH_SPANS) {
      const sample = this.at(progress);
      const arch = new THREE.Group();
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(rockGeometry, caveStone);
        pillar.scale.set(CAVE_ARCH_SHAPE.pillarHalfWidth, 8.5, 7.8);
        pillar.position.set(side * (sample.width / 2 + CAVE_ARCH_SHAPE.pillarOutset), 6.5, 0);
        pillar.castShadow = true;
        arch.add(pillar);
        const gem = new THREE.Mesh(new THREE.ConeGeometry(CAVE_ARCH_SHAPE.crystalRadius, 5.6, 5), crystal);
        gem.position.set(side * (sample.width / 2 + CAVE_ARCH_SHAPE.crystalOutset), 3.05, 5.3);
        gem.rotation.z = side * 0.12;
        arch.add(gem);
        const halo = lanternHalo(9, 0x50dcff);
        halo.position.copy(gem.position).add(new THREE.Vector3(0, 0.8, 0));
        arch.add(halo);
      }
      const crownPiecesPerSide = Math.ceil((sample.width / 2 - 12) / 11.3);
      for (let piece = -crownPiecesPerSide; piece <= crownPiecesPerSide; piece++) {
        const crown = new THREE.Mesh(rockGeometry, caveStone);
        crown.scale.set(9.6, piece === 0 ? CAVE_ARCH_SHAPE.ceilingHalfHeight : 4.4, 7.2);
        crown.position.set(piece * 11.3, CAVE_ARCH_SHAPE.ceilingY - Math.abs(piece) * 0.45, 0);
        crown.rotation.z = piece * 0.035;
        crown.castShadow = true;
        arch.add(crown);
      }
      arch.position.copy(sample.position);
      arch.position.y = 0;
      arch.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
      this.group.add(arch);
    }
    for (const progress of [0.668, 0.705, 0.742]) {
      const sample = this.at(progress);
      const upcoming = this.at(progress + 0.018);
      const leftTurn = sample.tangent.x * upcoming.tangent.z - sample.tangent.z * upcoming.tangent.x >= 0;
      const group = new THREE.Group();
      const sign = box(4.9, 2.6, 0.22, stoneDark);
      sign.position.y = 3.7;
      group.add(sign);
      for (let i = 0; i < 2; i++) {
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.1, 3), glow);
        arrow.rotation.z = leftTurn ? Math.PI / 2 : -Math.PI / 2;
        arrow.position.set(-0.8 + i * 1.4, 3.7, 0.17);
        group.add(arrow);
      }
      group.position.copy(sample.position).addScaledVector(sample.right, sample.width / 2 + 4.6);
      group.position.y = 0;
      group.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + Math.PI;
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
    palace.position.copy(sample.position).addScaledVector(sample.right, -(sample.width / 2 + 53));
    palace.position.y = 0;
    this.group.add(palace);
  }

  private makeMarketGate(progress: number) {
    const point = this.at(progress);
    const gate = new THREE.Group();
    for (const side of [-1, 1]) {
      const tower = box(4.2, 18, 4.2, stoneLight);
      tower.position.set(side * (point.width / 2 + 3), 9, 0);
      tower.castShadow = true;
      gate.add(tower);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.65, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
      dome.position.set(side * (point.width / 2 + 3), 18.2, 0);
      gate.add(dome);
      const lamp = box(0.72, 1.25, 0.7, glow);
      lamp.position.set(side * (point.width / 2 + 0.2), 8.6, 2.25);
      gate.add(lamp);
      const halo = lanternHalo(5);
      halo.position.copy(lamp.position);
      gate.add(halo);
      const window = box(0.8, 1.85, 0.08, glow);
      window.position.set(side * (point.width / 2 + 3), 12.6, 2.15);
      gate.add(window);
      const windowHalo = lanternHalo(4.2);
      windowHalo.position.copy(window.position);
      gate.add(windowHalo);
    }
    const lintel = box(point.width + 6.4, 2.3, 3.6, stoneLight);
    lintel.position.y = 14.8;
    lintel.castShadow = true;
    gate.add(lintel);
    const upperCourse = box(point.width + 7.2, 0.55, 4.2, stoneDark);
    upperCourse.position.y = 16.15;
    gate.add(upperCourse);
    const centerTower = box(9, 3.2, 4.5, stoneLight);
    centerTower.position.y = 18;
    gate.add(centerTower);
    const centerDome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
    centerDome.position.y = 19.6;
    gate.add(centerDome);
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.8, 8), gold);
    finial.position.y = 24.5;
    gate.add(finial);
    const banner = box(6, 3.5, 0.13, red);
    banner.position.set(0, 11.8, 1.88);
    gate.add(banner);
    const ornament = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.15, 7, 16), glow);
    ornament.position.set(0, 11.95, 2.05);
    gate.add(ornament);
    for (const x of [-19, -10, 10, 19]) {
      const lantern = box(0.55, 0.82, 0.55, glow);
      lantern.position.set(x, 12.85, 1.95);
      gate.add(lantern);
      const lanternGlow = lanternHalo(5.2);
      lanternGlow.position.copy(lantern.position);
      gate.add(lanternGlow);
    }
    gate.position.copy(point.position);
    gate.position.y = 0;
    gate.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
    this.group.add(gate);
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
      for (const z of [-1.65, 1.65]) {
        for (const tilt of [-1, 1]) {
          const brace = box(0.18, 3.9, 0.14, stoneDark);
          brace.position.set(0, 1.6, z);
          brace.rotation.z = tilt * 0.67;
          group.add(brace);
        }
      }
      const lid = box(3.5, 0.2, 3.5, stoneLight);
      lid.position.y = 3.27;
      group.add(lid);
      radius = 2.1;
    } else if (kind === 'boulder') {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.85, 1), stoneDark);
      rock.position.y = 1.9;
      rock.castShadow = true;
      group.add(rock);
      const warning = new THREE.Mesh(new THREE.TorusGeometry(2.16, 0.13, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffb65d }));
      warning.rotation.x = Math.PI / 2;
      warning.position.y = 0.13;
      group.add(warning);
      radius = 1.95;
    } else {
      const platform = box(3.7, 0.42, 2.45, wood);
      platform.position.y = 1.32;
      platform.castShadow = true;
      group.add(platform);
      for (const x of [-1.7, 1.7]) {
        const rail = box(0.22, 0.75, 2.4, stoneDark);
        rail.position.set(x, 1.82, 0);
        group.add(rail);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.35, 12), wood);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x * 1.2, 0.75, 0);
        group.add(wheel);
        const post = box(0.16, 2.1, 0.16, wood);
        post.position.set(x, 2.72, -0.9);
        group.add(post);
      }
      for (let i = 0; i < 3; i++) {
        const goods = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.9, 8), i % 2 ? roofMat : blue);
        goods.position.set((i - 1) * 1.08, 1.98, 0.15);
        group.add(goods);
      }
      const awning = box(4.7, 0.2, 3, red);
      awning.position.y = 3.8;
      awning.rotation.z = 0.07;
      group.add(awning);
      radius = 2.15;
    }
    group.position.copy(point.position).addScaledVector(point.right, lateral);
    group.position.y = point.position.y;
    group.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
    this.group.add(group);
    this.obstacles.push({ kind, mesh: group, position: group.position, radius, broken: false, respawn: 0, moving: kind === 'boulder', basePosition: group.position.clone(), right: point.right.clone(), phase });
  }

  private makeObstacles() {
    this.addObstacle('cart', this.mainSamples[Math.floor(0.06 * 640)], 10);
    this.addObstacle('crate', this.alleySamples[25], 0);
    this.addObstacle('crate', this.alleySamples[55], -2.3);
    this.addObstacle('crate', this.mainSamples[Math.floor(0.24 * 640)], -8.5);
    this.addObstacle('boulder', this.mainSamples[Math.floor(0.705 * 640)], 9.5, 0);
    this.addObstacle('boulder', this.mainSamples[Math.floor(0.735 * 640)], -9.5, Math.PI);
  }

  private makePads() {
    const points = [this.at(0.105), this.roofSamples[59], this.at(0.54), this.at(0.805)];
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
      this.boostPads.push({ position: group.position, tangent: point.tangent.clone(), right: point.right.clone(), halfWidth: point.width * 0.39, halfLength: 2.65, route: point.route, mesh: group });
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
      let score = horizontal + dy * dy * 4;
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
        const shift = Math.sin(time * 0.9 + obstacle.phase) * 0.4;
        obstacle.mesh.position.copy(obstacle.basePosition).addScaledVector(obstacle.right, shift);
      }
    }
    const pulse = 0.88 + 0.12 * Math.sin(time * 3);
    for (const material of this.carpetMaterials) material.color.setRGB(1, 0.65 * pulse, 0.25 * pulse);
    for (const person of this.marketPeople) {
      person.figure.position.x = person.baseX + Math.sin(time * 0.65 + person.phase) * 0.22;
      person.figure.rotation.y = Math.sin(time * 0.55 + person.phase) * 0.17;
    }
    for (const walker of this.marketWalkers) {
      const phase = time * 0.47 + walker.phase;
      const point = this.at(walker.progress + Math.sin(phase) * 0.003);
      walker.figure.position.copy(point.position).addScaledVector(point.right, walker.side * (point.width / 2 + 3.1));
      walker.figure.position.y = Math.sin(time * 6 + walker.phase) * 0.045;
      walker.figure.rotation.y = Math.atan2(point.tangent.x, point.tangent.z) + (Math.cos(phase) < 0 ? Math.PI : 0);
      walker.leftArm.rotation.x = Math.sin(time * 6 + walker.phase) * 0.32;
      walker.rightArm.rotation.x = -walker.leftArm.rotation.x;
    }
  }
}
