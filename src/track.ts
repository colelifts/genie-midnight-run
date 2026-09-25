import * as THREE from 'three';

export type RouteName = 'main' | 'alley' | 'roof' | 'garden';
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
  kind: 'crate' | 'boulder' | 'cart' | 'urn';
  route: RouteName;
  progress: number;
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
  boostSeconds: number;
  route: RouteName;
  mesh: THREE.Group;
}

export function touchesBoostPad(pad: BoostPad, position: THREE.Vector3, route: RouteName) {
  if (route !== pad.route || Math.abs(position.y - pad.position.y) > 2.5) return false;
  const toPad = position.clone().sub(pad.position);
  return Math.abs(toPad.dot(pad.right)) <= pad.halfWidth + 1.2 && Math.abs(toPad.dot(pad.tangent)) <= pad.halfLength + 1.8;
}

export function turnSignDirection(tangent: THREE.Vector3, upcoming: THREE.Vector3): 'left' | 'right' {
  const screenRight = new THREE.Vector3(-tangent.z, 0, tangent.x);
  return upcoming.dot(screenRight) >= 0 ? 'right' : 'left';
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
export const MARKET_GATE_SPANS = [0.175, 0.91];
export const TURN_SIGN_SPANS = [0.235, 0.28, 0.315, 0.345, 0.435, 0.475, 0.535, 0.595, 0.65, 0.722, 0.785, 0.865, 0.91, 0.935];
export const CAVE_ARCH_SPANS = [0.684, 0.721, 0.758];
export const CAVE_ARCH_SHAPE = { pillarOutset: 8, pillarHalfWidth: 7.4, crystalOutset: 5.5, crystalRadius: 1.7, ceilingY: 16.5, ceilingHalfHeight: 4.8 };
export const CAVE_TUNNEL_SHAPE = { wallOutset: 20, wallRadius: 14, roofCenterY: 19, roofEdgeY: 9 };
export const COURSE_SCALE = 2;
export const MAIN_ROAD_WIDTH = 36;
export function mainRoadWidth(progress: number) {
  const smooth = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
  };
  const corner = (start: number, end: number) => smooth((progress - start) / 0.012) * smooth((end - progress) / 0.012);
  return MAIN_ROAD_WIDTH - 3 * Math.max(corner(0.527, 0.638), corner(0.695, 0.815), corner(0.855, 0.963));
}
export const ALLEY_ROAD_WIDTH = 26;
export const ROOF_ROAD_WIDTH = 26;
export const ALLEY_OFFSET = -56;
export const ROOF_OFFSET = -60;
export const GARDEN_OFFSET = 20;
export const GARDEN_ROAD_WIDTH = 22;
export const GARDEN_ROUTE_END = 0.504;
export const MARKET_CROSSING_PROGRESS = 0.842;
export const MARKET_CROSSING_TRAVEL = MAIN_ROAD_WIDTH / 2 + 5;
export const BOOST_PAD_LENGTH = 10;
export function marketCartState(time: number) {
  const phase = ((time % 18) + 18) % 18;
  if (phase < 5) return { lateral: 1, direction: -1, crossing: false, warning: phase >= 3 };
  if (phase < 9) return { lateral: 1 - (phase - 5) / 2, direction: -1, crossing: true, warning: true };
  if (phase < 14) return { lateral: -1, direction: 1, crossing: false, warning: phase >= 12 };
  return { lateral: -1 + (phase - 14) / 2, direction: 1, crossing: true, warning: true };
}
export const BOOST_PAD_LAYOUT: Array<{ route: RouteName; progress: number; boostSeconds: number; lateral?: number; width?: number }> = [
  { route: 'main', progress: 0.08, boostSeconds: 3.3 },
  { route: 'alley', progress: 0.08, boostSeconds: 5.3 },
  { route: 'alley', progress: 0.128, boostSeconds: 5.3 },
  { route: 'roof', progress: 0.22, boostSeconds: 5.3 },
  { route: 'roof', progress: 0.266, boostSeconds: 5.3 },
  { route: 'roof', progress: 0.311, boostSeconds: 5.3 },
  { route: 'main', progress: 0.418, boostSeconds: 2.4, lateral: 10, width: 9 },
  { route: 'garden', progress: 0.487, boostSeconds: 3.1 },
  { route: 'main', progress: 0.535, boostSeconds: 3.3 },
  { route: 'main', progress: 0.582, boostSeconds: 2.4, lateral: 10, width: 9 },
  { route: 'main', progress: 0.612, boostSeconds: 2.4, lateral: -10, width: 9 },
  { route: 'main', progress: 0.88, boostSeconds: 2.4, lateral: 10, width: 9 },
  { route: 'main', progress: 0.975, boostSeconds: 3.3 },
];
export const PICKUP_LAYOUT: Array<{ route: RouteName; progress: number; lateral: number }> = [
  { route: 'main', progress: 0.035, lateral: -9 },
  { route: 'alley', progress: 0.105, lateral: 5.5 },
  { route: 'main', progress: 0.13, lateral: 10 },
  { route: 'roof', progress: 0.248, lateral: -5 },
  { route: 'roof', progress: 0.3, lateral: -5 },
  { route: 'main', progress: 0.39, lateral: -9 },
  { route: 'garden', progress: 0.445, lateral: 0 },
  { route: 'main', progress: 0.575, lateral: -9 },
  { route: 'main', progress: 0.55, lateral: 8 },
  { route: 'main', progress: 0.62, lateral: 9 },
  { route: 'main', progress: 0.735, lateral: 0 },
  { route: 'main', progress: 0.79, lateral: -9 },
  { route: 'main', progress: 0.87, lateral: -10 },
  { route: 'main', progress: 0.94, lateral: 0 },
];
export const OBSTACLE_LAYOUT: Array<{ kind: Obstacle['kind']; route: RouteName; progress: number; lateral: number; phase?: number }> = [
  { kind: 'cart', route: 'main', progress: 0.025, lateral: 8 },
  { kind: 'crate', route: 'main', progress: 0.115, lateral: -7 },
  { kind: 'crate', route: 'main', progress: 0.115, lateral: 7 },
  { kind: 'crate', route: 'main', progress: 0.245, lateral: -8 },
  { kind: 'urn', route: 'main', progress: 0.415, lateral: -8 },
  { kind: 'urn', route: 'main', progress: 0.445, lateral: -10 },
  { kind: 'urn', route: 'main', progress: 0.445, lateral: 7 },
  { kind: 'urn', route: 'main', progress: 0.565, lateral: 0 },
  { kind: 'urn', route: 'main', progress: 0.59, lateral: 0 },
  { kind: 'urn', route: 'main', progress: 0.615, lateral: 9 },
  { kind: 'boulder', route: 'main', progress: 0.685, lateral: -7 },
  { kind: 'boulder', route: 'main', progress: 0.708, lateral: 7, phase: Math.PI },
  { kind: 'boulder', route: 'main', progress: 0.73, lateral: -7 },
  { kind: 'boulder', route: 'main', progress: 0.73, lateral: 7, phase: Math.PI },
  { kind: 'boulder', route: 'main', progress: 0.755, lateral: 0 },
  { kind: 'boulder', route: 'main', progress: 0.785, lateral: 7, phase: Math.PI },
  { kind: 'boulder', route: 'main', progress: 0.815, lateral: -7 },
  { kind: 'cart', route: 'main', progress: 0.92, lateral: 8 },
  { kind: 'crate', route: 'main', progress: 0.955, lateral: -8 },
  { kind: 'crate', route: 'alley', progress: 0.085, lateral: 0 },
  { kind: 'crate', route: 'alley', progress: 0.106, lateral: -4 },
  { kind: 'crate', route: 'roof', progress: 0.24, lateral: 3 },
  { kind: 'crate', route: 'roof', progress: 0.285, lateral: -4 },
  { kind: 'urn', route: 'garden', progress: 0.425, lateral: -6 },
  { kind: 'urn', route: 'garden', progress: 0.463, lateral: 6 },
];

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
const rockSmooth = new THREE.MeshStandardMaterial({ color: 0x806779, roughness: 0.98, emissive: 0x15192d, emissiveIntensity: 0.2 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x9d6577, roughness: 0.84, flatShading: true });
const roadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, side: THREE.DoubleSide });
const gardenRoadMat = new THREE.MeshStandardMaterial({ color: 0xe6d5ba, roughness: 0.96, side: THREE.DoubleSide });
const red = new THREE.MeshStandardMaterial({ color: 0xd65b62, roughness: 0.93, side: THREE.DoubleSide });
const blue = new THREE.MeshStandardMaterial({ color: 0x4669a3, roughness: 0.93, side: THREE.DoubleSide });
const redFabric = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, side: THREE.DoubleSide });
const blueFabric = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, side: THREE.DoubleSide });
const leaf = new THREE.MeshStandardMaterial({ color: 0x477653, roughness: 0.92, flatShading: true, side: THREE.DoubleSide });
const wood = new THREE.MeshStandardMaterial({ color: 0x705142, roughness: 0.95 });
const water = new THREE.MeshBasicMaterial({ color: 0x51c1db, transparent: true, opacity: 0.9 });
const glow = new THREE.MeshBasicMaterial({ color: 0xffca67 });
const gold = new THREE.MeshStandardMaterial({ color: 0xdfaf63, metalness: 0.38, roughness: 0.52 });

const box = (w: number, h: number, d: number, material: THREE.Material) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);

function pointedDoorGeometry(width: number, height: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height * 0.7);
  shape.quadraticCurveTo(width / 2, height * 0.88, 0, height);
  shape.quadraticCurveTo(-width / 2, height * 0.88, -width / 2, height * 0.7);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 12);
}

const doorFrameGeometry = pointedDoorGeometry(3, 4.1);
const doorInsetGeometry = pointedDoorGeometry(2.42, 3.72);

function makeOrganicRockGeometry() {
  const geometry = new THREE.SphereGeometry(1, 20, 14);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const irregularity = 1 + 0.11 * Math.sin(8 * x + 3 * y) * Math.cos(7 * z - 2 * y)
      + 0.055 * Math.sin(13 * y + 5 * z) + 0.035 * Math.cos(17 * x - 11 * z);
    positions.setXYZ(i, x * irregularity, y * irregularity, z * irregularity);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const organicRockGeometry = makeOrganicRockGeometry();

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
    new THREE.Vector3(-44, 0, -112),
    new THREE.Vector3(7, 0, -94),
    new THREE.Vector3(55, 0, -91),
    new THREE.Vector3(88, 0, -59),
    new THREE.Vector3(109, 0, -38),
    new THREE.Vector3(112, 0, 5),
    new THREE.Vector3(122, 0, 35),
    new THREE.Vector3(110, 0, 70),
    new THREE.Vector3(73, 0, 100),
    new THREE.Vector3(32, 0, 98),
    new THREE.Vector3(14, 0, 88),
    new THREE.Vector3(5, 0, 72),
    new THREE.Vector3(7, 0, 53),
    new THREE.Vector3(1, 0, 37.7),
    new THREE.Vector3(-8, 0, 12),
    new THREE.Vector3(-30, 0, 5),
    new THREE.Vector3(-58, 0, -2.5),
    new THREE.Vector3(-86, 0, 30),
    new THREE.Vector3(-112, 0, 40),
    new THREE.Vector3(-148, 0, 66),
    new THREE.Vector3(-189, 0, 31),
    new THREE.Vector3(-168, 0, -12),
    new THREE.Vector3(-178.5, 0, -48.5),
    new THREE.Vector3(-150, 0, -77),
    new THREE.Vector3(-130, 0, -98),
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
    const shortcutSlalom = route === 'alley' ? 4.5 * Math.sin(4 * Math.PI * f) * Math.sin(Math.PI * f) ** 2
      : route === 'garden' ? 3.5 * Math.sin(4 * Math.PI * f) * Math.sin(Math.PI * f) ** 2 : 0;
    const position = mainPoint.clone().lerp(chord, cut).addScaledVector(right, maxOffset * Math.sin(Math.PI * f) ** 2 + shortcutSlalom);
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
  ctx.fillStyle = '#504958';
  ctx.fillRect(0, 0, 512, 512);
  const palette = ['#786a74', '#716570', '#776b75', '#80717a', '#6d626f', '#796971'];
  for (let row = 0; row < 10; row++) {
    for (let col = -1; col < 7; col++) {
      const x = col * 90 + (row % 2) * 45;
      const y = row * 52;
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
      ctx.fillRect(x + 2, y + 2, 87, 49);
      ctx.fillStyle = 'rgba(255,221,192,0.095)';
      ctx.fillRect(x + 4, y + 4, 83, 3);
      ctx.fillStyle = 'rgba(27,25,43,0.12)';
      ctx.fillRect(x + 4, y + 47, 83, 2);
      for (let fleck = 0; fleck < 18; fleck++) {
        ctx.fillStyle = fleck % 3 === 0 ? 'rgba(255,225,196,0.09)' : 'rgba(38,36,56,0.075)';
        ctx.fillRect(x + 6 + rng() * 77, y + 6 + rng() * 39, 0.7 + rng() * 3.1, 0.5 + rng() * 1.5);
      }
      if (rng() < 0.32) {
        const scratchX = x + 12 + rng() * 62;
        const scratchY = y + 10 + rng() * 26;
        ctx.strokeStyle = 'rgba(43,40,60,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(scratchX, scratchY);
        ctx.lineTo(scratchX + 5, scratchY + 2);
        ctx.lineTo(scratchX + 9, scratchY + 1);
        ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeSandTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(93417);
  ctx.fillStyle = '#b98160';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4400; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,220,170,0.1)' : 'rgba(71,48,64,0.065)';
    ctx.fillRect(x, y, 1 + rng() * 2.7, 0.6 + rng() * 1.2);
  }
  for (let i = 0; i < 28; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    ctx.strokeStyle = 'rgba(255,220,180,0.055)';
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 20, y - 3, x + 47, y + 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(82, 82);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeStuccoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(5188);
  ctx.fillStyle = '#f6efe8';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 24000; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const size = 0.4 + rng() * 2.8;
    ctx.fillStyle = i % 4 === 0 ? 'rgba(114,81,90,0.11)' : 'rgba(255,255,255,0.16)';
    ctx.fillRect(x, y, size, size * (0.42 + rng()));
  }
  for (let i = 0; i < 18; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const radius = 9 + rng() * 26;
    const stain = ctx.createRadialGradient(x, y, 1, x, y, radius);
    stain.addColorStop(0, 'rgba(122,85,93,0.08)');
    stain.addColorStop(1, 'rgba(122,85,93,0)');
    ctx.fillStyle = stain;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeFabricTexture(base: string, stripe: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 64) {
    ctx.fillStyle = stripe;
    ctx.fillRect(x + 18, 0, 19, 256);
    ctx.fillStyle = 'rgba(255,238,185,0.7)';
    ctx.fillRect(x + 40, 0, 4, 256);
    ctx.fillStyle = 'rgba(42,36,67,0.28)';
    ctx.fillRect(x + 13, 0, 4, 256);
  }
  for (const y of [25, 225]) {
    ctx.fillStyle = 'rgba(255,224,165,0.68)';
    ctx.fillRect(0, y, 256, 5);
    for (let x = 15; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 8, y - 2);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 8, y - 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
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
  readonly gardenSamples: RoadPoint[] = [];
  readonly obstacles: Obstacle[] = [];
  readonly boostPads: BoostPad[] = [];
  birdLaunches = 0;
  readonly length: number;
  private readonly rng = seededRandom(626);
  private readonly carpetMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly marketPeople: Array<{ figure: THREE.Group; phase: number; baseX: number }> = [];
  private readonly marketWalkers: Array<{ figure: THREE.Group; progress: number; side: number; phase: number; leftArm: THREE.Mesh; rightArm: THREE.Mesh }> = [];
  private readonly marketFlags: Array<{ mesh: THREE.Mesh; phase: number }> = [];
  private readonly roofPerches: THREE.Vector3[] = [];
  private readonly clouds: Array<{ sprite: THREE.Sprite; baseX: number; speed: number }> = [];
  private readonly fireflies: Array<{ sprite: THREE.Sprite; base: THREE.Vector3; phase: number }> = [];
  private readonly fountainRipples: Array<{ mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; phase: number }> = [];
  private caveCrystalMaterial: THREE.MeshBasicMaterial | null = null;
  private readonly caveBeams: Array<{ material: THREE.MeshBasicMaterial; phase: number }> = [];
  private readonly birds: Array<{ group: THREE.Group; leftWing: THREE.Group; rightWing: THREE.Group; base: THREE.Vector3; phase: number; launchTime: number; direction: THREE.Vector3 }> = [];
  private readonly skyBirds: Array<{ group: THREE.Group; leftWing: THREE.Group; rightWing: THREE.Group; center: THREE.Vector3; phase: number; radius: number }> = [];
  private marketCart: Obstacle | null = null;
  private readonly marketCartWheels: THREE.Mesh[] = [];
  private readonly marketCrossingCenter = new THREE.Vector3();
  private readonly marketCrossingSignals: Array<{ bulb: THREE.MeshBasicMaterial; halo: THREE.Sprite }> = [];

  constructor(scene: THREE.Scene) {
    roadMat.map = makePavingTexture();
    roadMat.needsUpdate = true;
    gardenRoadMat.map = roadMat.map;
    gardenRoadMat.needsUpdate = true;
    const stucco = makeStuccoTexture();
    stone.map = stucco;
    stoneLight.map = stucco;
    stone.needsUpdate = stoneLight.needsUpdate = true;
    redFabric.map = makeFabricTexture('#bb4559', '#e9aa76');
    blueFabric.map = makeFabricTexture('#385b91', '#91bfd3');
    redFabric.needsUpdate = blueFabric.needsUpdate = true;
    this.mainCurve = makeMainCurve();
    this.length = this.mainCurve.getLength();
    this.makeSamples();
    this.makeTerrain();
    this.makeRoad(this.mainSamples, true);
    this.makeRoad(this.alleySamples, false);
    this.makeRoad(this.roofSamples, false);
    this.makeRoad(this.gardenSamples, false);
    this.makeRoadMarkers();
    this.makeRoadLights();
    this.makeMarketBanners();
    this.makeRouteSigns();
    this.makeTurnSigns();
    this.makeDecor();
    this.makeAtmosphere();
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
      this.mainSamples.push({ position, tangent, right, progress, width: mainRoadWidth(progress), route: 'main' });
    }
    this.alleySamples.push(...makeBranchSamples(this.mainCurve, 'alley', 0.045, 0.16, ALLEY_OFFSET, 0, ALLEY_ROAD_WIDTH));
    this.roofSamples.push(...makeBranchSamples(this.mainCurve, 'roof', 0.19, 0.33, ROOF_OFFSET, 5.4, ROOF_ROAD_WIDTH));
    this.gardenSamples.push(...makeBranchSamples(this.mainCurve, 'garden', 0.37, GARDEN_ROUTE_END, GARDEN_OFFSET, 0, GARDEN_ROAD_WIDTH));
    this.samples.push(...this.mainSamples, ...this.alleySamples, ...this.roofSamples, ...this.gardenSamples);
  }

  private makeTerrain() {
    sand.color.setHex(0xffffff);
    sand.map = makeSandTexture();
    sand.needsUpdate = true;
    const ground = box(1400, 1, 1400, sand);
    ground.position.y = -0.7;
    ground.receiveShadow = true;
    this.group.add(ground);
    const duneGeo = new THREE.SphereGeometry(1, 20, 10);
    const duneWarm = new THREE.MeshStandardMaterial({ color: 0xb98368, roughness: 1 });
    const duneLight = new THREE.MeshStandardMaterial({ color: 0xc99570, roughness: 1 });
    const duneShadow = new THREE.MeshStandardMaterial({ color: 0x98677a, roughness: 1 });
    for (let i = 0; i < 45; i++) {
      const angle = (i / 45) * Math.PI * 2;
      const distance = 380 + this.rng() * 100;
      const dune = new THREE.Mesh(duneGeo, i % 7 === 0 ? duneShadow : i % 2 === 0 ? duneLight : duneWarm);
      dune.scale.set(20 + this.rng() * 28, 9 + this.rng() * 14, 18 + this.rng() * 25);
      const outward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      dune.position.set(outward.x * distance, -6, outward.z * distance);
      const clearance = Math.max(dune.scale.x, dune.scale.z) + 9;
      for (let step = 0; step < 6 && !this.clearOfRoad(dune.position, clearance); step++) dune.position.addScaledVector(outward, 36);
      if (!this.clearOfRoad(dune.position, clearance)) continue;
      dune.rotation.y = this.rng() * Math.PI;
      dune.receiveShadow = true;
      this.group.add(dune);
    }
    const distantStone = new THREE.MeshStandardMaterial({ color: 0x5f536d, roughness: 1, flatShading: true });
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2;
      const distance = 480 + this.rng() * 100;
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
    const road = new THREE.Mesh(geometry, points[0].route === 'garden' ? gardenRoadMat : roadMat);
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
    const branches = [this.alleySamples, this.roofSamples, this.gardenSamples];
    for (const side of [-1, 1]) {
      for (let i = 0; i < points.length - (closed ? 0 : 1); i += 3) {
        if (!closed && (i < 18 || i > points.length - 21)) continue;
        const a = points[i];
        const b = points[(i + 3) % points.length];
        if (!closed && i + 3 >= points.length) continue;
        if (closed && Math.abs(a.progress - MARKET_CROSSING_PROGRESS) < 0.006) continue;
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
      const coveredAtJunction: boolean[] = [];
      const count = points.length;
      for (let i = 0; i < count; i++) {
        const point = points[i];
        const inner = point.position.clone().addScaledVector(point.right, side * (point.width / 2 - 0.05));
        const outer = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 0.75));
        inner.y += 0.035;
        outer.y += 0.035;
        vertices.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
        coveredAtJunction.push(closed
          ? branchCoversMainEdge([this.alleySamples, this.roofSamples, this.gardenSamples], inner) || branchCoversMainEdge([this.alleySamples, this.roofSamples, this.gardenSamples], outer)
          : overMainPavement(this.mainSamples, inner, 1) || overMainPavement(this.mainSamples, outer, 1));
        const color = Math.floor(i / 6) % 2 === 0 ? new THREE.Color(0xe8dcce) : new THREE.Color(0xc85d65);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
      for (let i = 0; i < (closed ? count : count - 1); i++) {
        const j = (i + 1) % count;
        if (coveredAtJunction[i] || coveredAtJunction[j]) continue;
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
      if (progress > 0.58 && progress < 0.82) continue;
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
        this.marketFlags.push({ mesh: flag, phase: i * 0.8 + span * 1.7 });
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
    const signs: Array<{ progress: number; side: number; text: string; color: string; arrow?: 'left' | 'right' }> = [
      { progress: 0.04, side: -1, text: 'BOOST ALLEY', color: '#eac76b', arrow: 'left' },
      { progress: 0.186, side: -1, text: 'ROOF RAMP', color: '#8fe1f4', arrow: 'left' },
      { progress: 0.345, side: 1, text: 'PALACE GARDEN', color: '#eac76b' },
      { progress: 0.36, side: -1, text: 'GARDEN CUT', color: '#a9e5a5', arrow: 'right' },
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
      ctx.font = sign.arrow ? '900 43px Arial' : '900 49px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.text, 256, 68, sign.arrow ? 335 : 490);
      if (sign.arrow) {
        const direction = sign.arrow === 'right' ? 1 : -1;
        const x = direction === 1 ? 438 : 74;
        ctx.strokeStyle = sign.color;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x - direction * 28, 64);
        ctx.lineTo(x + direction * 18, 64);
        ctx.lineTo(x - direction * 2, 44);
        ctx.moveTo(x + direction * 18, 64);
        ctx.lineTo(x - direction * 2, 84);
        ctx.stroke();
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
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

  private makeTurnSigns() {
    const materials = new Map<'left' | 'right', THREE.MeshBasicMaterial>();
    const signMaterial = (direction: 'left' | 'right') => {
      const cached = materials.get(direction);
      if (cached) return cached;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 208;
      const ctx = canvas.getContext('2d')!;
      const background = ctx.createLinearGradient(0, 0, 512, 208);
      background.addColorStop(0, '#142d55');
      background.addColorStop(1, '#30345d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 512, 208);
      ctx.strokeStyle = '#f2bf66';
      ctx.lineWidth = 15;
      ctx.strokeRect(10, 10, 492, 188);
      ctx.strokeStyle = '#72e8ee';
      ctx.lineWidth = 3;
      ctx.strokeRect(25, 25, 462, 158);
      ctx.fillStyle = '#fce9b2';
      ctx.font = 'bold 29px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('CURVE AHEAD', 256, 63);
      ctx.lineWidth = 20;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ffdb87';
      ctx.shadowColor = '#fbc871';
      ctx.shadowBlur = 16;
      for (const x of [162, 256, 350]) {
        const directionSign = direction === 'right' ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x - directionSign * 18, 91);
        ctx.lineTo(x + directionSign * 19, 132);
        ctx.lineTo(x - directionSign * 18, 171);
        ctx.stroke();
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
      materials.set(direction, material);
      return material;
    };
    for (const progress of TURN_SIGN_SPANS) {
      const point = this.at(progress);
      const upcoming = this.at(progress + 0.035);
      const direction = turnSignDirection(point.tangent, upcoming.tangent);
      const preferredSide = direction === 'right' ? -1 : 1;
      const side = [preferredSide, -preferredSide].find((candidate) => {
        const position = point.position.clone().addScaledVector(point.right, candidate * (point.width / 2 + 5.6));
        return this.clearOfOtherRoad(position, 5.1, 'main');
      });
      if (side === undefined) continue;
      const sign = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 3.75), signMaterial(direction));
      face.position.set(0, 4.65, 0.22);
      sign.add(face);
      const frame = box(9.55, 4.05, 0.28, gold);
      frame.position.y = 4.65;
      sign.add(frame);
      for (const x of [-3.5, 3.5]) {
        const post = box(0.36, 2.85, 0.36, stoneDark);
        post.position.set(x, 1.42, 0);
        sign.add(post);
        const finial = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.72, 6), gold);
        finial.position.set(x, 6.8, 0);
        sign.add(finial);
      }
      sign.position.copy(point.position).addScaledVector(point.right, side * (point.width / 2 + 5.6));
      sign.position.y = 0;
      sign.rotation.y = Math.atan2(point.tangent.x, point.tangent.z) + Math.PI;
      this.group.add(sign);
    }
  }

  private makeDecor() {
    for (let i = 0; i < 205; i++) {
      const progress = i / 205;
      const sample = this.mainSamples[Math.floor(progress * this.mainSamples.length)];
      if (Math.abs(progress - MARKET_CROSSING_PROGRESS) < 0.014) continue;
      const side = i % 2 === 0 ? 1 : -1;
      const offset = sample.width / 2 + 16 + this.rng() * 12;
      const position = sample.position.clone().addScaledVector(sample.right, side * offset);
      if (progress < 0.33 || progress > 0.82) {
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
    for (let i = 28; i <= 70; i += 7) {
      const sample = this.alleySamples[i];
      for (const side of [-1, 1]) {
        const position = sample.position.clone().addScaledVector(sample.right, side * (sample.width / 2 + 8.5));
        const facing = sample.right.clone().multiplyScalar(-side);
        this.makeStall(position, 300 + i * 2 + (side + 1) / 2, Math.atan2(facing.x, facing.z));
      }
    }
    this.makeFountain();
    this.makeGarden();
    this.makeCave();
    this.makePalace();
    for (const progress of MARKET_GATE_SPANS) this.makeMarketGate(progress);
    for (let i = 0; i < 25; i++) {
      const p = this.roofSamples[20 + Math.floor(this.rng() * 50)];
      const pos = p.position.clone();
      pos.y = -0.05;
      pos.addScaledVector(p.right, (i % 2 ? 1 : -1) * (p.width / 2 + 17 + this.rng() * 13));
      const facing = p.right.clone().multiplyScalar(i % 2 ? -1 : 1);
      this.makeBuilding(pos, 9 + this.rng() * 7, 5 + this.rng() * 5, 9 + this.rng() * 7, i + 100, Math.atan2(facing.x, facing.z));
    }
  }

  private makeBird() {
    const plumage = new THREE.MeshStandardMaterial({ color: 0xe7d5bb, roughness: 1, side: THREE.DoubleSide });
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x8a7892, roughness: 1, side: THREE.DoubleSide });
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 9, 7), plumage);
    body.scale.set(1, 0.62, 1.3);
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), plumage);
    head.position.set(0, 0.17, 0.26);
    group.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.21, 5), gold);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.14, 0.47);
    group.add(beak);
    const wingGeometry = new THREE.SphereGeometry(1, 9, 6);
    const wings: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.2, 0.05, -0.02);
      const wing = new THREE.Mesh(wingGeometry, wingMaterial);
      wing.scale.set(0.42, 0.055, 0.21);
      wing.position.x = side * 0.31;
      pivot.add(wing);
      group.add(pivot);
      wings.push(pivot);
    }
    group.scale.setScalar(1.6);
    this.group.add(group);
    return { group, leftWing: wings[0], rightWing: wings[1] };
  }

  private makeAtmosphere() {
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 256;
    cloudCanvas.height = 128;
    const cloudCtx = cloudCanvas.getContext('2d')!;
    for (const [x, y, radius] of [[65, 77, 44], [105, 62, 50], [150, 73, 44], [189, 80, 37]] as const) {
      const mist = cloudCtx.createRadialGradient(x, y, 5, x, y, radius);
      mist.addColorStop(0, 'rgba(250,233,255,0.78)');
      mist.addColorStop(0.48, 'rgba(216,205,245,0.52)');
      mist.addColorStop(1, 'rgba(208,199,238,0)');
      cloudCtx.fillStyle = mist;
      cloudCtx.beginPath();
      cloudCtx.arc(x, y, radius, 0, Math.PI * 2);
      cloudCtx.fill();
    }
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 30; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, color: i % 3 === 0 ? 0xf4d3e8 : 0xd6d9f3, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
      const baseX = -420 + this.rng() * 840;
      sprite.position.set(baseX, 55 + this.rng() * 43, -370 + this.rng() * 740);
      sprite.scale.set(78 + this.rng() * 62, 25 + this.rng() * 15, 1);
      this.group.add(sprite);
      this.clouds.push({ sprite, baseX, speed: 1.1 + this.rng() * 1.8 });
    }
    for (let i = 0; i < 42; i++) {
      const progress = i < 24 ? i < 12 ? 0.012 + i * 0.013 : 0.87 + (i - 12) * 0.01 : 0.38 + (i - 24) * 0.009;
      const point = this.at(progress);
      const side = i % 2 === 0 ? -1 : 1;
      const base = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 7 + this.rng() * 13));
      base.y = 1.4 + this.rng() * 3.5;
      const sprite = lanternHalo(0.95 + this.rng() * 0.65, i % 4 === 0 ? 0x66eaff : 0xffdc82);
      sprite.material.opacity = 0.38;
      sprite.position.copy(base);
      this.group.add(sprite);
      this.fireflies.push({ sprite, base, phase: i * 1.8 });
    }
    for (const base of this.roofPerches.slice(0, 9)) {
      const bird = this.makeBird();
      bird.group.position.copy(base);
      this.birds.push({ ...bird, base, phase: this.rng() * Math.PI * 2, launchTime: -1, direction: new THREE.Vector3(1, 0, 0) });
    }
    for (const index of [23, 28, 36, 44, 55, 64, 72, 77]) {
      const point = this.roofSamples[index];
      const side = index % 2 === 0 ? 1 : -1;
      const base = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 0.8));
      base.y += 1.6;
      const bird = this.makeBird();
      bird.group.position.copy(base);
      this.birds.push({ ...bird, base, phase: this.rng() * Math.PI * 2, launchTime: -1, direction: point.right.clone().multiplyScalar(side) });
    }
    for (let i = 0; i < 7; i++) {
      const point = this.at([0.07, 0.12, 0.23, 0.27, 0.88, 0.94, 0.18][i]);
      const center = point.position.clone().add(new THREE.Vector3(0, 18 + i % 3 * 4, 0));
      const bird = this.makeBird();
      this.skyBirds.push({ ...bird, center, phase: i * 0.9, radius: 16 + i % 3 * 7 });
    }
  }

  private makeMarketWalkers() {
    const progressPoints = [0.018, 0.058, 0.103, 0.148, 0.183, 0.845, 0.875, 0.895, 0.925, 0.953, 0.98];
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
    const frieze = box(width + 0.42, 0.18, depth + 0.42, seed % 3 === 0 ? gold : roofMat);
    frieze.position.y = height - 1.58;
    group.add(frieze);
    for (const x of [-width / 2 + 1, width / 2 - 1]) {
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 7), gold);
      finial.position.set(x, height + 0.68, depth / 2 - 0.8);
      group.add(finial);
    }
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
      const arch = new THREE.Mesh(new THREE.SphereGeometry(0.84, 12, 6, 0, Math.PI, 0, Math.PI / 2), stoneDark);
      arch.position.set(x, height * 0.64 + 1.02, depth / 2 + 0.065);
      arch.scale.set(1, 0.36, 0.14);
      group.add(frame, window, sill, arch);
      if (seed % 2 === 0) {
        const halo = lanternHalo(2.7);
        halo.position.set(x, height * 0.64, depth / 2 + 0.25);
        group.add(halo);
      }
    }
    const doorFrame = new THREE.Mesh(doorFrameGeometry, seed % 4 === 0 ? gold : stoneDark);
    doorFrame.position.set(0, 0.05, depth / 2 + 0.12);
    group.add(doorFrame);
    const doorway = new THREE.Mesh(doorInsetGeometry, wood);
    doorway.position.set(0, 0.06, depth / 2 + 0.15);
    group.add(doorway);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), gold);
    handle.position.set(0.58, 1.55, depth / 2 + 0.22);
    group.add(handle);
    const lintel = box(width * 0.7, 0.15, 0.22, roofMat);
    lintel.position.set(0, height * 0.78, depth / 2 + 0.12);
    group.add(lintel);
    if (seed % 3 !== 1) {
      const fabric = Math.floor(seed / 2) % 2 === 0 ? redFabric : blueFabric;
      const awningWidth = width * 0.83;
      const awningHeight = Math.min(height * 0.48, 6);
      const roof = new THREE.BufferGeometry();
      roof.setAttribute('position', new THREE.Float32BufferAttribute([
        -awningWidth / 2, awningHeight + 0.65, depth / 2 + 0.05,
        awningWidth / 2, awningHeight + 0.65, depth / 2 + 0.05,
        -awningWidth / 2, awningHeight - 0.45, depth / 2 + 3.65,
        awningWidth / 2, awningHeight - 0.45, depth / 2 + 3.65,
      ], 3));
      roof.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
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
    if (seed % 11 === 1 && seed % 4 !== 0) {
      const perch = new THREE.Vector3(0, height + 0.65, depth / 2 - 0.9);
      perch.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(position);
      this.roofPerches.push(perch);
    }
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
    const fabric = Math.floor(seed / 4) % 2 === 0 ? redFabric : blueFabric;
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
    for (const side of [-1, 1]) {
      const positions: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i <= 88; i++) {
        const point = this.at(0.355 + i / 88 * 0.21);
        for (const [offset, color] of [[1.45, 0x65815b], [15.5, 0x315f4c]] as const) {
          const edge = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + offset));
          positions.push(edge.x, 0.018, edge.z);
          const tint = new THREE.Color(color).multiplyScalar(0.93 + (i % 5) * 0.025);
          colors.push(tint.r, tint.g, tint.b);
        }
        if (i > 0) indices.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const plantedBorder = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
      plantedBorder.receiveShadow = true;
      this.group.add(plantedBorder);
    }
    for (let i = 0; i < 33; i++) {
      const progress = 0.34 + i * 0.0067;
      const point = this.at(progress);
      for (const side of [-1, 1]) {
        const sectionPosition = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 1.2));
        if (branchCoversMainEdge([this.gardenSamples], sectionPosition)) continue;
        const section = new THREE.Group();
        const plinth = box(1.4, 1.2, 7.2, stoneLight);
        plinth.position.y = 0.62;
        section.add(plinth);
        const trim = box(1.68, 0.24, 7.4, stoneDark);
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
        section.position.copy(sectionPosition);
        section.position.y = 0;
        section.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
        this.group.add(section);
        const planterPosition = point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 4.7));
        if (i % 3 !== 0 && !branchCoversMainEdge([this.gardenSamples], planterPosition)) {
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
          planter.position.copy(planterPosition);
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
    const rock = new THREE.Mesh(organicRockGeometry, rockSmooth);
    rock.scale.set(radius, radius * 0.65, radius);
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
    const sprayMaterial = new THREE.MeshBasicMaterial({ color: 0x9defff, transparent: true, opacity: 0.72, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const outward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const arc = new THREE.QuadraticBezierCurve3(
        position.clone().add(new THREE.Vector3(0, 7.35, 0)),
        position.clone().addScaledVector(outward, 4.1).add(new THREE.Vector3(0, 7.8, 0)),
        position.clone().addScaledVector(outward, 6.25).add(new THREE.Vector3(0, 1.32, 0)),
      );
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 22, 0.095, 5, false), sprayMaterial));
    }
    for (let i = 0; i < 3; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xb8f7ff, transparent: true, opacity: 0.45, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.055, 5, 48), material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.copy(position);
      mesh.position.y = 1.31;
      this.group.add(mesh);
      this.fountainRipples.push({ mesh, material, phase: i / 3 });
    }
  }

  private makeCave() {
    const rockGeometry = organicRockGeometry;
    const caveStone = new THREE.MeshStandardMaterial({ color: 0x66596c, roughness: 0.97, emissive: 0x18213a, emissiveIntensity: 0.3 });
    const caveStoneLight = new THREE.MeshStandardMaterial({ color: 0x786679, roughness: 0.98, emissive: 0x18213a, emissiveIntensity: 0.28 });
    const crystal = new THREE.MeshBasicMaterial({ color: 0x67dbed, toneMapped: false });
    this.caveCrystalMaterial = crystal;
    for (let i = 0; i < 18; i++) {
      const sample = this.at(0.667 + i * 0.006);
      for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(rockGeometry, i % 4 === 0 ? caveStoneLight : caveStone);
        wall.scale.set(10 + this.rng() * 2, 10 + this.rng() * 2.5, 12 + this.rng() * 2);
        wall.position.copy(sample.position).addScaledVector(sample.right, side * (sample.width / 2 + CAVE_TUNNEL_SHAPE.wallOutset));
        wall.position.y = 7.2 + this.rng() * 1.3;
        wall.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + this.rng() * 0.15;
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.group.add(wall);
      }
    }
    const roofPositions: number[] = [];
    const roofColors: number[] = [];
    const roofIndices: number[] = [];
    const roofSteps = 56;
    const roofBands = 10;
    for (let i = 0; i <= roofSteps; i++) {
      const sample = this.at(0.665 + i * 0.002);
      for (let j = 0; j <= roofBands; j++) {
        const across = j / roofBands * 2 - 1;
        const width = sample.width / 2 + 17;
        const vertex = sample.position.clone().addScaledVector(sample.right, across * width);
        const arch = Math.pow(1 - across * across, 0.78);
        vertex.y = CAVE_TUNNEL_SHAPE.roofEdgeY + (CAVE_TUNNEL_SHAPE.roofCenterY - CAVE_TUNNEL_SHAPE.roofEdgeY) * arch
          + Math.sin(i * 1.79 + j * 2.3) * 0.28;
        roofPositions.push(vertex.x, vertex.y, vertex.z);
        const shade = 0.77 + 0.1 * Math.sin(i * 1.3 + j * 2.7);
        roofColors.push(shade, shade * 0.91, shade * 1.06);
        if (i > 0 && j > 0) {
          const a = (i - 1) * (roofBands + 1) + j - 1;
          const b = i * (roofBands + 1) + j - 1;
          roofIndices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const roofGeometry = new THREE.BufferGeometry();
    roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
    roofGeometry.setAttribute('color', new THREE.Float32BufferAttribute(roofColors, 3));
    roofGeometry.setIndex(roofIndices);
    roofGeometry.computeVertexNormals();
    const roof = new THREE.Mesh(roofGeometry, new THREE.MeshStandardMaterial({ color: 0x897b91, vertexColors: true, roughness: 1, side: THREE.DoubleSide, emissive: 0x655672, emissiveIntensity: 0.55 }));
    roof.receiveShadow = true;
    this.group.add(roof);
    for (let i = 0; i < 12; i++) {
      const sample = this.mainSamples[Math.floor((0.665 + i * 0.01) * this.mainSamples.length)];
      for (const side of [-1, 1]) {
        const size = 3.4 + this.rng() * 2.1;
        const rock = new THREE.Mesh(rockGeometry, i % 3 === 0 ? caveStoneLight : caveStone);
        rock.scale.set(size * 1.05, size * (1.15 + this.rng() * 0.65), size * 1.35);
        rock.position.copy(sample.position).addScaledVector(sample.right, side * (sample.width / 2 + 9.5 + this.rng() * 3.2));
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
      const hangingCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), crystal);
      hangingCrystal.scale.set(1.45, 2.15, 1.45);
      hangingCrystal.position.y = 11.5;
      arch.add(hangingCrystal);
      const crystalGlow = lanternHalo(8, 0x68eaff);
      crystalGlow.position.copy(hangingCrystal.position);
      arch.add(crystalGlow);
      const beamMaterial = new THREE.MeshBasicMaterial({ color: 0x6addf2, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(5.2, 10.5, 20, 1, true), beamMaterial);
      beam.position.y = 6.35;
      arch.add(beam);
      this.caveBeams.push({ material: beamMaterial, phase: progress * 27 });
      const lightPool = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ map: lanternHaloTexture, color: 0x52cbe9, transparent: true, opacity: 0.19, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      lightPool.rotation.x = -Math.PI / 2;
      lightPool.position.y = 0.13;
      arch.add(lightPool);
      arch.position.copy(sample.position);
      arch.position.y = 0;
      arch.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
      this.group.add(arch);
    }
  }

  private makePalace() {
    const palace = new THREE.Group();
    const ivory = new THREE.MeshStandardMaterial({ color: 0xe6b990, map: stone.map, roughness: 0.82 });
    const shadedStone = new THREE.MeshStandardMaterial({ color: 0x9b6c6e, map: stone.map, roughness: 0.9 });
    const glazedTile = new THREE.MeshStandardMaterial({ color: 0x4d83a0, metalness: 0.18, roughness: 0.42 });
    const deepBlue = new THREE.MeshStandardMaterial({ color: 0x243b67, roughness: 0.7 });
    const warmWindow = new THREE.MeshBasicMaterial({ color: 0xffd28a, toneMapped: false });
    const foundation = box(112, 2.2, 38, shadedStone);
    foundation.position.y = 1.1;
    palace.add(foundation);
    for (const [width, height, depth, x] of [[47, 27, 25, 0], [24, 17, 21, -35], [24, 17, 21, 35]] as const) {
      const block = box(width, height, depth, ivory);
      block.position.set(x, 2.2 + height / 2, -1.5);
      block.castShadow = block.receiveShadow = true;
      palace.add(block);
      const parapet = box(width + 1.4, 0.9, depth + 1.4, stoneLight);
      parapet.position.set(x, 2.2 + height, -1.5);
      palace.add(parapet);
      const enamel = box(width + 1.1, 0.34, depth + 1.1, glazedTile);
      enamel.position.set(x, 1.2 + height, -1.5);
      palace.add(enamel);
    }
    const portal = box(12, 13, 0.2, deepBlue);
    portal.position.set(0, 8.6, 11.15);
    palace.add(portal);
    const portalCrown = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 12, 0, Math.PI, 0, Math.PI / 2), deepBlue);
    portalCrown.scale.z = 0.08;
    portalCrown.position.set(0, 15.1, 11.16);
    palace.add(portalCrown);
    for (const side of [-1, 1]) {
      const jamb = box(0.65, 15.8, 0.64, gold);
      jamb.position.set(side * 6.25, 9.4, 11.55);
      palace.add(jamb);
      const lantern = box(0.8, 1.6, 0.38, warmWindow);
      lantern.position.set(side * 8.8, 9.2, 11.25);
      palace.add(lantern);
      const halo = lanternHalo(5.6, 0xffc16c);
      halo.position.copy(lantern.position);
      palace.add(halo);
    }
    const archTrim = new THREE.Mesh(new THREE.TorusGeometry(6.25, 0.28, 8, 32, Math.PI), gold);
    archTrim.position.set(0, 15.2, 11.55);
    palace.add(archTrim);
    const entranceSteps = [0, 1, 2].map((level) => {
      const step = box(18 + level * 3, 0.38, 2.6, level % 2 ? stoneLight : ivory);
      step.position.set(0, 0.2 + level * 0.38, 18 - level * 2.3);
      return step;
    });
    palace.add(...entranceSteps);
    for (const x of [-40, -31, -22, -13, 13, 22, 31, 40]) {
      const wing = Math.abs(x) > 20;
      const facadeZ = wing ? 9.25 : 11.15;
      const height = wing ? 7.2 : 10.8;
      const inset = box(3.1, height, 0.16, deepBlue);
      inset.position.set(x, 4.2 + height / 2, facadeZ);
      palace.add(inset);
      const light = box(2.0, height * 0.65, 0.11, warmWindow);
      light.position.set(x, 4.6 + height / 2, facadeZ + 0.12);
      palace.add(light);
      const arch = new THREE.Mesh(new THREE.SphereGeometry(1.62, 16, 8, 0, Math.PI, 0, Math.PI / 2), glazedTile);
      arch.scale.z = 0.18;
      arch.position.set(x, 4.2 + height, facadeZ + 0.06);
      palace.add(arch);
      const sill = box(3.7, 0.28, 0.55, gold);
      sill.position.set(x, 4.0, facadeZ + 0.24);
      palace.add(sill);
    }
    const centralDrum = new THREE.Mesh(new THREE.CylinderGeometry(13.2, 14.4, 5.1, 28), ivory);
    centralDrum.position.y = 32;
    palace.add(centralDrum);
    for (const y of [29.6, 34.6]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(13.8, 0.32, 8, 48), gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      palace.add(ring);
    }
    const centralDome = new THREE.Mesh(new THREE.SphereGeometry(13.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glazedTile);
    centralDome.position.y = 34.6;
    centralDome.castShadow = true;
    palace.add(centralDome);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const meridian = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(Math.sin(angle) * 13.4, 34.6, Math.cos(angle) * 13.4),
        new THREE.Vector3(Math.sin(angle) * 11.5, 45.5, Math.cos(angle) * 11.5),
        new THREE.Vector3(0, 48.1, 0),
      );
      palace.add(new THREE.Mesh(new THREE.TubeGeometry(meridian, 16, 0.17, 5, false), gold));
    }
    for (const side of [-1, 1]) {
      const x = side * 53;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.6, 30, 18), ivory);
      tower.position.set(x, 17.2, -3.5);
      tower.castShadow = true;
      palace.add(tower);
      for (const y of [4, 21, 31]) {
        const balcony = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.2, 0.75, 18), y === 21 ? glazedTile : gold);
        balcony.position.set(x, y, -3.5);
        palace.add(balcony);
      }
      for (const y of [11, 25]) {
        const window = box(1.4, 3.8, 0.14, warmWindow);
        window.position.set(x, y, 1.65);
        palace.add(window);
        const frame = box(1.8, 0.32, 0.52, gold);
        frame.position.set(x, y + 2.05, 1.82);
        palace.add(frame);
      }
      const cap = new THREE.Mesh(new THREE.SphereGeometry(5.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), glazedTile);
      cap.position.set(x, 32, -3.5);
      palace.add(cap);
      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.6, 10), gold);
      finial.position.set(x, 39, -3.5);
      palace.add(finial);
    }
    const topFinial = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.4, 12), gold);
    topFinial.position.y = 51;
    palace.add(topFinial);
    const sample = this.mainSamples[Math.floor(0.46 * this.mainSamples.length)];
    palace.position.copy(sample.position).addScaledVector(sample.right, -(sample.width / 2 + 53));
    palace.position.y = 0;
    palace.rotation.y = Math.atan2(sample.right.x, sample.right.z);
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
      const rock = new THREE.Mesh(organicRockGeometry, rockSmooth);
      rock.scale.setScalar(2.6);
      rock.position.y = 2.95;
      rock.castShadow = true;
      group.add(rock);
      const warning = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.16, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffc76e, toneMapped: false }));
      warning.rotation.x = Math.PI / 2;
      warning.position.y = 0.13;
      group.add(warning);
      radius = 2.65;
    } else if (kind === 'urn') {
      const jar = new THREE.Mesh(new THREE.SphereGeometry(1.55, 16, 10), roofMat);
      jar.scale.y = 1.08;
      jar.position.y = 1.7;
      jar.castShadow = true;
      group.add(jar);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.16, 0.4, 16), gold);
      rim.position.y = 3.16;
      group.add(rim);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 1.08, 0.62, 16), stoneLight);
      neck.position.y = 3.56;
      group.add(neck);
      for (const side of [-1, 1]) {
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.17, 6, 14, Math.PI), gold);
        handle.position.set(side * 1.56, 2.28, 0);
        handle.rotation.y = side * Math.PI / 2;
        group.add(handle);
      }
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.22, 0.35, 14), stoneDark);
      foot.position.y = 0.26;
      group.add(foot);
      radius = 2.25;
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
        wheel.userData.marketWheel = true;
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
      const awning = box(4.7, 0.2, 3, redFabric);
      awning.position.y = 3.8;
      awning.rotation.z = 0.07;
      group.add(awning);
      radius = 2.15;
    }
    group.position.copy(point.position).addScaledVector(point.right, lateral);
    group.position.y = point.position.y;
    group.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
    this.group.add(group);
    const obstacle = { kind, route: point.route, progress: point.progress, mesh: group, position: group.position, radius, broken: false, respawn: 0, moving: kind === 'boulder', basePosition: group.position.clone(), right: point.right.clone(), phase };
    this.obstacles.push(obstacle);
    return obstacle;
  }

  private makeObstacles() {
    for (const item of OBSTACLE_LAYOUT) this.addObstacle(item.kind, this.routeAt(item.route, item.progress), item.lateral, item.phase ?? 0);
    this.makeMarketCrossing();
  }

  private makeMarketCrossing() {
    const point = this.at(MARKET_CROSSING_PROGRESS);
    this.marketCrossingCenter.copy(point.position);
    this.marketCart = this.addObstacle('cart', point, MARKET_CROSSING_TRAVEL);
    for (const child of this.marketCart.mesh.children) if (child instanceof THREE.Mesh && child.userData.marketWheel) this.marketCartWheels.push(child);
    for (const side of [-1, 1]) {
      const signal = new THREE.Group();
      const post = box(0.48, 3.7, 0.48, stoneDark);
      post.position.y = 1.85;
      signal.add(post);
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.26, 10), gold);
      housing.position.y = 3.82;
      signal.add(housing);
      const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0x9d6743, toneMapped: false });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), bulbMaterial);
      bulb.position.y = 4.22;
      signal.add(bulb);
      const halo = lanternHalo(6.2, 0xffa15f);
      halo.position.y = 4.22;
      halo.material.opacity = 0.12;
      signal.add(halo);
      signal.position.copy(point.position).addScaledVector(point.right, side * (point.width / 2 + 1.6));
      signal.position.y = 0;
      this.group.add(signal);
      this.marketCrossingSignals.push({ bulb: bulbMaterial, halo });
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#112343';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#eec77b';
    ctx.lineWidth = 13;
    ctx.strokeRect(9, 9, 494, 142);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe5a8';
    ctx.font = 'bold 48px Arial';
    ctx.fillText('CART CROSSING', 256, 86);
    ctx.font = 'bold 21px Arial';
    ctx.fillText('WATCH FOR MOVEMENT', 256, 126);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const signPoint = this.at(MARKET_CROSSING_PROGRESS - 0.015);
    const sign = new THREE.Group();
    const frame = box(9.8, 3.2, 0.28, gold);
    frame.position.y = 4.8;
    sign.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 2.95), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));
    face.position.set(0, 4.8, 0.19);
    sign.add(face);
    for (const x of [-3.3, 3.3]) {
      const post = box(0.35, 3.25, 0.35, stoneDark);
      post.position.set(x, 1.62, 0);
      sign.add(post);
    }
    sign.position.copy(signPoint.position).addScaledVector(signPoint.right, signPoint.width / 2 + 5.5);
    sign.position.y = 0;
    sign.rotation.y = Math.atan2(signPoint.tangent.x, signPoint.tangent.z) + Math.PI;
    this.group.add(sign);
  }

  private makePads() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#3d205d');
    gradient.addColorStop(0.5, '#225779');
    gradient.addColorStop(1, '#3d205d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#f7c86b';
    ctx.lineWidth = 21;
    ctx.strokeRect(14, 14, 996, 228);
    ctx.strokeStyle = '#6ce8f4';
    ctx.lineWidth = 7;
    ctx.strokeRect(37, 37, 950, 182);
    ctx.fillStyle = 'rgba(255,230,152,0.23)';
    for (let i = 0; i < 8; i++) {
      const x = 74 + i * 125;
      ctx.beginPath();
      ctx.moveTo(x, 128);
      ctx.lineTo(x + 44, 63);
      ctx.lineTo(x + 88, 128);
      ctx.lineTo(x + 44, 193);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffe09a';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 44, 128, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#b6f9ff';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,230,152,0.23)';
    }
    const carpetTexture = new THREE.CanvasTexture(canvas);
    carpetTexture.colorSpace = THREE.SRGBColorSpace;
    carpetTexture.anisotropy = 8;
    const carpetFace = new THREE.MeshBasicMaterial({ map: carpetTexture, side: THREE.DoubleSide, toneMapped: false });
    const glowMat = new THREE.MeshBasicMaterial({ map: lanternHaloTexture, color: 0x59e7ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const edgeGemMat = new THREE.MeshBasicMaterial({ color: 0x9af7ff, toneMapped: false });
    for (const { route, progress, boostSeconds, lateral = 0, width } of BOOST_PAD_LAYOUT) {
      const point = this.routeAt(route, progress);
      const carpetWidth = width ?? point.width * 0.78;
      const group = new THREE.Group();
      const base = box(carpetWidth, 0.055, BOOST_PAD_LENGTH, new THREE.MeshBasicMaterial({ color: 0x3d205d }));
      base.position.y = 0.04;
      group.add(base);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf2bd57 });
      this.carpetMaterials.push(mat);
      const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(carpetWidth * 1.2, BOOST_PAD_LENGTH * 1.25), glowMat);
      glowPlane.rotation.x = -Math.PI / 2;
      glowPlane.position.y = 0.09;
      group.add(glowPlane);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(carpetWidth * 0.94, BOOST_PAD_LENGTH * 0.95), carpetFace);
      face.rotation.x = -Math.PI / 2;
      face.position.y = 0.105;
      group.add(face);
      for (const x of [-carpetWidth * 0.46, carpetWidth * 0.46]) {
        const edge = box(0.28, 0.09, BOOST_PAD_LENGTH * 0.98, mat);
        edge.position.set(x, 0.15, 0);
        group.add(edge);
        for (const z of [-3.5, -1.2, 1.2, 3.5]) {
          const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), edgeGemMat);
          gem.position.set(x, 0.32, z);
          group.add(gem);
        }
      }
      group.position.copy(point.position).addScaledVector(point.right, lateral);
      group.position.y += 0.08;
      group.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
      this.group.add(group);
      this.boostPads.push({ position: group.position, tangent: point.tangent.clone(), right: point.right.clone(), halfWidth: carpetWidth / 2, halfLength: BOOST_PAD_LENGTH / 2, boostSeconds, route: point.route, mesh: group });
    }
  }

  at(progress: number): RoadPoint {
    const normalized = ((progress % 1) + 1) % 1;
    return this.mainSamples[Math.floor(normalized * this.mainSamples.length)];
  }

  routeAt(route: RouteName, progress: number): RoadPoint {
    if (route === 'main') return this.at(progress);
    const list = route === 'alley' ? this.alleySamples : route === 'roof' ? this.roofSamples : this.gardenSamples;
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
    if (p < 0.19 || p > 0.82) return 'MIDNIGHT MARKET';
    if (p < 0.35) return 'ROOFTOP RUN';
    if (p < 0.57) return 'PALACE GARDEN';
    return 'DESERT CAVE';
  }

  update(time: number, dt: number, racers: THREE.Vector3[] = []) {
    this.birdLaunches = 0;
    for (const obstacle of this.obstacles) {
      if (obstacle.broken) {
        obstacle.respawn -= dt;
        if (obstacle.respawn <= 0) {
          obstacle.broken = false;
          obstacle.mesh.visible = true;
        }
      }
      if (obstacle.moving && !obstacle.broken) {
        const shift = Math.sin(time * 0.9 + obstacle.phase) * 2.2;
        obstacle.mesh.position.copy(obstacle.basePosition).addScaledVector(obstacle.right, shift);
      }
    }
    if (this.marketCart) {
      const crossing = marketCartState(time);
      this.marketCart.mesh.position.copy(this.marketCrossingCenter).addScaledVector(this.marketCart.right, crossing.lateral * MARKET_CROSSING_TRAVEL);
      const forward = this.marketCart.right.clone().multiplyScalar(crossing.direction);
      this.marketCart.mesh.rotation.y = Math.atan2(forward.x, forward.z);
      if (crossing.crossing) for (const wheel of this.marketCartWheels) wheel.rotateY(dt * MARKET_CROSSING_TRAVEL / 1.32);
      const bright = crossing.warning && Math.sin(time * 12) > 0;
      for (const signal of this.marketCrossingSignals) {
        signal.bulb.color.setHex(bright ? 0xffd884 : 0x9d6743);
        signal.halo.material.opacity = bright ? 0.85 : 0.12;
      }
    }
    const pulse = 0.88 + 0.12 * Math.sin(time * 3);
    for (const material of this.carpetMaterials) material.color.setRGB(1, 0.65 * pulse, 0.25 * pulse);
    for (const cloud of this.clouds) cloud.sprite.position.x = ((cloud.baseX + time * cloud.speed + 550) % 1100) - 550;
    for (const firefly of this.fireflies) {
      firefly.sprite.position.x = firefly.base.x + Math.sin(time * 0.8 + firefly.phase) * 0.8;
      firefly.sprite.position.y = firefly.base.y + Math.sin(time * 1.3 + firefly.phase) * 0.55;
    }
    for (const ripple of this.fountainRipples) {
      const wave = (time * 0.42 + ripple.phase) % 1;
      ripple.mesh.scale.setScalar(0.7 + wave * 5.8);
      ripple.material.opacity = (1 - wave) * 0.42;
    }
    if (this.caveCrystalMaterial) {
      const glimmer = 0.9 + 0.1 * Math.sin(time * 2.2);
      this.caveCrystalMaterial.color.setRGB(0.43 * glimmer, 0.9 * glimmer, 0.99 * glimmer);
    }
    for (const beam of this.caveBeams) beam.material.opacity = 0.055 + 0.025 * Math.sin(time * 1.8 + beam.phase);
    for (const flag of this.marketFlags) flag.mesh.rotation.z = Math.PI + Math.sin(time * 1.4 + flag.phase) * 0.08;
    for (const bird of this.birds) {
      const nearest = racers.find((racer) => racer.distanceTo(bird.base) < 21);
      if (bird.launchTime < 0 && nearest) {
        bird.launchTime = time;
        this.birdLaunches++;
        bird.direction.copy(bird.base).sub(nearest).setY(0).normalize();
        if (bird.direction.lengthSq() < 0.1) bird.direction.set(1, 0, 0);
      }
      if (bird.launchTime >= 0) {
        const flight = Math.min(7, time - bird.launchTime);
        bird.group.position.copy(bird.base).addScaledVector(bird.direction, flight * 4.5);
        bird.group.position.y += Math.min(2.4, flight) * 5.4 + Math.sin(time * 8 + bird.phase) * 0.22;
        bird.group.rotation.y = Math.atan2(bird.direction.x, bird.direction.z);
        if (time - bird.launchTime > 7 && !nearest) {
          bird.launchTime = -1;
          bird.group.position.copy(bird.base);
        }
      } else bird.group.position.y = bird.base.y + Math.sin(time * 1.9 + bird.phase) * 0.08;
      const wingBeat = bird.launchTime >= 0 ? Math.sin(time * 17 + bird.phase) * 0.62 : Math.sin(time * 2 + bird.phase) * 0.07;
      bird.leftWing.rotation.z = wingBeat;
      bird.rightWing.rotation.z = -wingBeat;
    }
    for (const bird of this.skyBirds) {
      const angle = time * 0.32 + bird.phase;
      bird.group.position.set(bird.center.x + Math.cos(angle) * bird.radius, bird.center.y + Math.sin(time * 1.7 + bird.phase) * 1.5, bird.center.z + Math.sin(angle) * bird.radius);
      bird.group.rotation.y = -angle;
      const wingBeat = Math.sin(time * 12 + bird.phase) * 0.52;
      bird.leftWing.rotation.z = wingBeat;
      bird.rightWing.rotation.z = -wingBeat;
    }
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
