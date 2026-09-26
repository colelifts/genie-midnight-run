import * as THREE from 'three';
import './style.css';
import './roster.css';
import { GameAudio } from './audio';
import { sweptSphereHit } from './collision';
import { advanceChaseYaw, advanceHeading, driftBoostStage, raceSpeed, railScrapeSpeed, screenSteer, slideHeadingAlongRail } from './handling';
import { CharacterKartVisual, type RaceVisual } from './characterKart';
import { ImportedKartVisual, loadImportedKarts } from './importedKart';
import { CHARACTERS, CHARACTER_BY_ID, type CharacterId } from './characters';
import { KartVisual, makeProjectile } from './kart';
import { StitchUfo, STITCH_UFO_DURATION, STITCH_UFO_INBOUND_DURATION } from './stitchUfo';
import { PlutoUltimate, PlutoTongue, PLUTO_ULTIMATE_DURATION } from './pluto';
import { RacerShowcase } from './showcase';
import { ITEMS, rollItem, type ItemId } from './items';
import { BOOST_PAD_LAYOUT, GARDEN_ROUTE_END, MARKET_CROSSING_PROGRESS, MARKET_CROSSING_TRAVEL, marketCartState, PICKUP_LAYOUT, RaceTrack, START_GRID_BASE_PROGRESS, START_GRID_LANES, startGridProgress, touchesBoostPad, type RoadHit, type RoadPoint, type RouteName } from './track';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>('game');
const minimap = el<HTMLCanvasElement>('minimap');
const mapContext = minimap.getContext('2d')!;
const hud = el<HTMLDivElement>('hud');
const menu = el<HTMLDivElement>('menu');
const pause = el<HTMLDivElement>('pause');
const results = el<HTMLDivElement>('results');
const countdown = el<HTMLDivElement>('countdown');
const positionText = el<HTMLDivElement>('position');
const lapText = el<HTMLDivElement>('lap');
const zoneText = el<HTMLDivElement>('zone');
const lapTimeText = el<HTMLDivElement>('lap-time');
const speedText = el<HTMLElement>('speed');
const surfaceText = el<HTMLDivElement>('surface');
const boostFill = el<HTMLDivElement>('boost-fill');
const wishPicker = el<HTMLDivElement>('wish-picker');
const wishTile = el<HTMLDivElement>('wish-tile');
const aimCue = el<HTMLDivElement>('aim-cue');
const ultimateTile = el<HTMLDivElement>('ultimate-tile');
const signatureFill = el<HTMLDivElement>('signature-fill');
const ultimateFill = el<HTMLDivElement>('ultimate-fill');
const banner = el<HTMLDivElement>('banner');
const characterSelect = el<HTMLDivElement>('character-select');
const characterDetail = el<HTMLDivElement>('character-detail');
const itemCaption = document.querySelector<HTMLElement>('.item-caption')!;
const itemIcon = document.querySelector<HTMLElement>('.item-icon')!;
const ultimateAnnouncement = el<HTMLDivElement>('ultimate-announcement');
const ultimateVeil = el<HTMLDivElement>('ultimate-veil');
const stitchAlert = el<HTMLDivElement>('stitch-ufo-alert');
const stitchIntro = el<HTMLDivElement>('stitch-ufo-intro');
const plutoAlert = el<HTMLDivElement>('pluto-alert');
const atmosphereShade = el<HTMLDivElement>('atmosphere-shade');

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrap = (value: number) => ((value % 1) + 1) % 1;
const angleDiff = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
const formatLapTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
const KART_HITBOX_HEIGHT = 1.45;
const RACER_COUNT = START_GRID_LANES.length;

type GameMode = 'menu' | 'countdown' | 'race' | 'paused' | 'finished';
type Wish = 'boost' | 'shield' | 'shot';

interface Racer {
  id: number;
  character: CharacterId;
  visual: RaceVisual;
  itemOrbit: THREE.Group;
  position: THREE.Vector3;
  previousPosition: THREE.Vector3;
  yaw: number;
  moveYaw: number;
  yawRate: number;
  speed: number;
  progress: number;
  lap: number;
  finishPlace: number;
  boostTime: number;
  padBoostTime: number;
  shieldTime: number;
  oceanBarrierTime: number;
  ultimateTime: number;
  ultimateMeter: number;
  signatureCooldown: number;
  item: ItemId | null;
  tripleSparks: number;
  fogTime: number;
  featherTime: number;
  mirrorTime: number;
  wishUpgrade: boolean;
  curseTime: number;
  iceSpeedTime: number;
  luckyEscapeCooldown: number;
  wobbleTime: number;
  hauntedTime: number;
  hotHeadTime: number;
  laserReadyTime: number;
  powerTick: number;
  stunTime: number;
  hitCooldown: number;
  offTrackTime: number;
  lastPad: number;
  drifting: boolean;
  driftDirection: number;
  driftCharge: number;
  jumpTime: number;
  jumpDuration: number;
  jumpPower: number;
  trickReady: boolean;
  trickBoost: boolean;
  trickAnim: number;
  slipCharge: number;
  slipCooldown: number;
  tricksLanded: number;
  draftBoosts: number;
  compassTime: number;
  compassTarget: Pickup | null;
  compassShortcut: { route: Exclude<RouteName, 'main'>; progress: number } | null;
  lastSafe: THREE.Vector3;
  lastSafeProgress: number;
  aiRoute: RouteName;
  aiLane: number;
  aiLine: number;
  aiAbilityTimer: number;
  aiUltimateTimer: number;
  ultimateHit: Set<number>;
  steerVisual: number;
}

interface Projectile {
  owner: number;
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  life: number;
  kind: 'star' | 'plasma' | 'laser' | 'curse' | 'dragonfire' | 'dragon' | 'cannon' | 'wave' | 'firefly' | 'tornado';
  color: number;
  bounces: number;
  target: number;
  cast?: number;
}

interface PowerField {
  owner: number;
  kind: 'ice' | 'soul' | 'star' | 'dragonfire' | 'clock' | 'anchor';
  mesh: THREE.Group;
  life: number;
  radius: number;
  victims: Set<number>;
}

interface Pickup {
  mesh: THREE.Group;
  position: THREE.Vector3;
  route: RouteName;
  progress: number;
  baseY: number;
  respawn: number;
  collected: boolean;
  phase: number;
}

interface Pulse {
  mesh: THREE.Mesh;
  age: number;
  duration: number;
  growth: number;
}

interface Flash {
  sprite: THREE.Sprite;
  age: number;
  duration: number;
  size: number;
}

function makeFlashTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.13, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(0.43, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.86)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    ctx.lineWidth = i % 2 === 0 ? 3.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(64 + Math.sin(angle) * 12, 64 + Math.cos(angle) * 12);
    ctx.lineTo(64 + Math.sin(angle) * (i % 2 === 0 ? 60 : 41), 64 + Math.cos(angle) * (i % 2 === 0 ? 60 : 41));
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

const flashTexture = makeFlashTexture();

function disposeTransient(object: THREE.Object3D) {
  object.traverse((part) => {
    if (part instanceof THREE.Mesh) part.geometry.dispose();
    if (part instanceof THREE.Mesh || part instanceof THREE.Sprite) {
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface DashDragon {
  group: THREE.Group;
  racerId: number;
  age: number;
  duration: number;
  materials: THREE.MeshBasicMaterial[];
}

class Sparks {
  readonly mesh: THREE.InstancedMesh;
  private readonly particles: Particle[] = [];
  private readonly dummy = new THREE.Object3D();
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), 160);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < 160; i++) {
      this.particles.push({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 1 });
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, new THREE.Color(0x66dcff));
    }
    scene.add(this.mesh);
  }

  spawn(position: THREE.Vector3, velocity: THREE.Vector3, color: number, life = 0.35) {
    const index = this.cursor++ % this.particles.length;
    const particle = this.particles[index];
    particle.position.copy(position);
    particle.velocity.copy(velocity);
    particle.life = life;
    particle.maxLife = life;
    this.mesh.setColorAt(index, new THREE.Color(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (particle.life > 0) {
        particle.life -= dt;
        particle.velocity.y -= dt * 9;
        particle.position.addScaledVector(particle.velocity, dt);
        this.dummy.position.copy(particle.position);
        this.dummy.scale.setScalar(Math.max(0, particle.life / particle.maxLife));
      } else {
        this.dummy.scale.setScalar(0);
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class GenieRace {
  readonly scene = new THREE.Scene();
  readonly renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 900);
  readonly clock = new THREE.Clock();
  readonly track: RaceTrack;
  readonly racers: Racer[] = [];
  readonly sparks: Sparks;
  readonly audio = new GameAudio();
  readonly showcase: RacerShowcase;
  readonly projectiles: Projectile[] = [];
  readonly powerFields: PowerField[] = [];
  readonly pickups: Pickup[] = [];
  readonly pulses: Pulse[] = [];
  readonly flashes: Flash[] = [];
  readonly dashDragons: DashDragon[] = [];
  readonly plasmaVolleys: { owner: number; target: number; cast: number; remaining: number; timer: number; aimSign: number }[] = [];
  readonly plasmaCombos = new Map<number, { cast: number; count: number; last: number }>();
  readonly ufo: StitchUfo;
  readonly pluto: PlutoUltimate;
  readonly plutoTongue: PlutoTongue;
  private plutoGliderStarted = false;
  private plasmaCast = 0;
  private plasmaTotalHits = 0;
  private ufoTotalHits = 0;
  private readonly ufoBeamVictims = new Set<number>();
  private lastUfoImpactSound = -10;
  private skyColors!: THREE.BufferAttribute;
  private skyCalm!: Float32Array;
  private skyStorm!: Float32Array;
  private stormBlend = 0;
  private ambientUltBlend = 0;
  private stitchIntroTime = 0;
  private ufoPhase = 'none';
  readonly keys = new Set<string>();
  readonly touch = new Set<string>();
  readonly plutoPreview = new URLSearchParams(window.location.search).has('plutoPreview');
  readonly demoMode = new URLSearchParams(window.location.search).has('demo') || this.plutoPreview;
  readonly debugDrive = window.location.hostname === '127.0.0.1' ? new URLSearchParams(window.location.search).get('debugDrive') : null;
  readonly debugPowers = window.location.hostname === '127.0.0.1' && new URLSearchParams(window.location.search).has('debugPowers');
  readonly debugBrake = this.debugPowers && new URLSearchParams(window.location.search).has('debugBrake');
  readonly debugCollision = window.location.hostname === '127.0.0.1' && new URLSearchParams(window.location.search).has('debugCollision');
  mode: GameMode = 'menu';
  private elapsed = 0;
  private countdownElapsed = 0;
  private countShown = 4;
  private bannerTime = 0;
  private announcementTime = 0;
  private wishHolding = false;
  private wishElapsed = 0;
  private wishIndex = 0;
  private laserLocking = false;
  private laserLockElapsed = 0;
  private laserLockTarget = -1;
  private gamepadWishHeld = false;
  private gamepadUltimateHeld = false;
  private gamepadDrift = false;
  private gamepadSteer = 0;
  private gamepadAccel = 0;
  private gamepadBrake = 0;
  private driftSparksTimer = 0;
  private lastMagicTrailTick = -1;
  private lastCartWarningCycle = -1;
  private lastBirdSound = -10;
  private lapClock = 0;
  private raceClock = 0;
  private finishCount = 0;
  private collisionAudit = { frames: 0, roadFrames: 0, obstacleFrames: 0, racerFrames: 0, maxRoad: 0, maxObstacle: 0, maxRacer: 0, examples: [] as string[] };
  private bestLap = Infinity;
  private cameraLook = new THREE.Vector3();
  private cameraYaw = 0;
  private sunlight!: THREE.DirectionalLight;
  private cameraDistance = 14.3;
  private cameraReady = false;
  private mapTransform = { centerX: 0, centerZ: 0, scale: 0.25 };
  private smoothedFps = 60;
  private lastFrame = performance.now();
  private selectedCharacter: CharacterId = 'genie';

  constructor() {
    try {
      const saved = Number(localStorage.getItem('genie-midnight-best-lap'));
      if (saved >= 25 && Number.isFinite(saved)) this.bestLap = saved;
    } catch { /* Racing still works when browser storage is unavailable. */ }
    try {
      const saved = localStorage.getItem('genie-midnight-character');
      if (saved && Object.prototype.hasOwnProperty.call(CHARACTER_BY_ID, saved)) this.selectedCharacter = saved as CharacterId;
    } catch { /* Character selection still works without storage. */ }
    if (this.plutoPreview) this.selectedCharacter = 'genie';
    el<HTMLDivElement>('preview-label').classList.toggle('hidden', !this.plutoPreview);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.34;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x1c2a59);
    this.scene.fog = new THREE.Fog(0x3a3158, 260, 700);
    const ambient = new THREE.HemisphereLight(0xa9b9fa, 0x875263, 1.25);
    this.scene.add(ambient);
    const sunlight = new THREE.DirectionalLight(0xffc480, 2.15);
    sunlight.position.set(-75, 130, -85);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    sunlight.shadow.camera.left = -135;
    sunlight.shadow.camera.right = 135;
    sunlight.shadow.camera.top = 135;
    sunlight.shadow.camera.bottom = -135;
    sunlight.shadow.camera.near = 1;
    sunlight.shadow.camera.far = 650;
    sunlight.shadow.bias = -0.0004;
    this.sunlight = sunlight;
    this.scene.add(sunlight, sunlight.target);
    const moonFill = new THREE.DirectionalLight(0x809cff, 0.62);
    moonFill.position.set(90, 80, 45);
    this.scene.add(moonFill);
    this.makeSky();
    this.makeStars();
    this.track = new RaceTrack(this.scene);
    this.ufo = new StitchUfo(this.scene, this.track);
    this.pluto = new PlutoUltimate(this.scene, this.track);
    this.plutoTongue = new PlutoTongue(this.scene);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const point of this.track.samples) {
      minX = Math.min(minX, point.position.x);
      maxX = Math.max(maxX, point.position.x);
      minZ = Math.min(minZ, point.position.z);
      maxZ = Math.max(maxZ, point.position.z);
    }
    this.mapTransform = {
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
      scale: Math.min(176 / (maxX - minX), 146 / (maxZ - minZ)),
    };
    this.sparks = new Sparks(this.scene);
    this.makeRacers();
    this.showcase = new RacerShowcase(el<HTMLCanvasElement>('showcase-canvas'), this.selectedCharacter);
    this.makeCharacterSelect();
    this.makePickups();
    this.bindInput();
    Object.defineProperty(window, '__kartDebug', {
      configurable: true,
      get: () => ({
        mode: this.mode,
        elapsed: Math.round(this.elapsed * 10) / 10,
        trackLength: Math.round(this.track.length),
        racers: this.racers.map((racer) => ({
          id: racer.id, character: racer.character, lap: racer.lap, progress: Math.round(racer.progress * 1000) / 1000,
          speed: Math.round(racer.speed),
          position: racer.position.toArray().map((n) => Math.round(n * 10) / 10),
          stun: Math.round(racer.stunTime * 10) / 10,
          ultimate: Math.round(racer.ultimateTime * 10) / 10,
          meter: Math.round(racer.ultimateMeter),
          cooldown: Math.round(racer.signatureCooldown * 10) / 10,
        })),
        projectiles: this.projectiles.length,
        plasmaVolleys: this.plasmaVolleys.length,
        ufo: { active: this.ufo.active, owner: this.ufo.owner, phase: this.ufoPhase, age: Math.round(this.ufo.elapsed * 10) / 10, warnings: this.ufo.warnings },
        pluto: { active: this.pluto.active, owner: this.pluto.owner, age: Math.round(this.pluto.elapsed * 10) / 10, hazards: this.pluto.hazards, tongues: this.plutoTongue.count },
        powerFields: this.powerFields.length,
        audio: this.audio.getStatus(),
      }),
    });
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    requestAnimationFrame((now) => this.frame(now));
    if (this.plutoPreview) window.setTimeout(() => this.startRace(), 120);
  }

  private makeStars() {
    const count = 150;
    const vertices: number[] = [];
    let seed = 47291;
    const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 240 + rng() * 290;
      vertices.push(Math.sin(angle) * radius, 120 + rng() * 160, Math.cos(angle) * radius);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xd4defe, size: 1.15, sizeAttenuation: true })));
  }

  private makeSky() {
    const geometry = new THREE.SphereGeometry(540, 36, 18);
    const positions = geometry.getAttribute('position');
    const colors: number[] = [];
    const horizon = new THREE.Color(0x65436d);
    const middle = new THREE.Color(0x2b3b7c);
    const zenith = new THREE.Color(0x101b43);
    const stormHorizon = new THREE.Color(0x47345f);
    const stormMiddle = new THREE.Color(0x25183f);
    const stormZenith = new THREE.Color(0x0d102b);
    const stormColors: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      const up = Math.max(0, positions.getY(i) / 540);
      const color = up < 0.32 ? horizon.clone().lerp(middle, up / 0.32) : middle.clone().lerp(zenith, Math.min(1, (up - 0.32) / 0.68));
      colors.push(color.r, color.g, color.b);
      const storm = up < 0.32 ? stormHorizon.clone().lerp(stormMiddle, up / 0.32) : stormMiddle.clone().lerp(stormZenith, Math.min(1, (up - 0.32) / 0.68));
      stormColors.push(storm.r, storm.g, storm.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.skyColors = geometry.getAttribute('color') as THREE.BufferAttribute;
    this.skyCalm = new Float32Array(colors);
    this.skyStorm = new Float32Array(stormColors);
    const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
    sky.renderOrder = -100;
    this.scene.add(sky);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff7ec';
    ctx.beginPath();
    ctx.arc(64, 64, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(77, 53, 30, 0, Math.PI * 2);
    ctx.fill();
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, fog: false }));
    moon.position.set(220, 140, -110);
    moon.scale.set(37, 37, 1);
    this.scene.add(moon);
  }

  private setStorm(amount: number) {
    this.stormBlend = amount;
    const values = this.skyColors.array as Float32Array;
    for (let i = 0; i < values.length; i++) values[i] = this.skyCalm[i] + (this.skyStorm[i] - this.skyCalm[i]) * amount;
    this.skyColors.needsUpdate = true;
    (this.scene.fog as THREE.Fog).color.copy(new THREE.Color(0x3a3158).lerp(new THREE.Color(0x302841), amount));
    this.sunlight.color.copy(new THREE.Color(0xffc480).lerp(new THREE.Color(0xc2b8ef), amount));
    this.sunlight.intensity = 2.15 - amount * 1.03;
    this.renderer.toneMappingExposure = 1.34 - amount * 0.15;
  }

  private raceStarts() {
    const requestedStart = new URLSearchParams(window.location.search).get('demoStart');
    const demoStart = requestedStart === null ? NaN : Number(requestedStart);
    const base = this.plutoPreview ? 0.29 : this.demoMode && Number.isFinite(demoStart) && demoStart >= 0 && demoStart < 1 ? demoStart : START_GRID_BASE_PROGRESS;
    return Array.from({ length: RACER_COUNT }, (_, i) => startGridProgress(base, i));
  }

  private aiRouteForLap(id: number, lap: number): RouteName {
    if (this.plutoPreview) return 'main';
    const requested = new URLSearchParams(window.location.search).get('demoRoute');
    if (this.demoMode && id === 0 && (requested === 'alley' || requested === 'roof' || requested === 'garden')) return requested;
    return (['alley', 'roof', 'garden'] as const)[(id + lap + 1) % 3];
  }

  private makeRacers() {
    const starts = this.raceStarts();
    const candidates = CHARACTERS.map((character) => character.id).filter((id) => id !== this.selectedCharacter);
    for (let i = 0; i < RACER_COUNT; i++) {
      const start = this.track.at(starts[i]);
      const gridPosition = start.position.clone().addScaledVector(start.right, START_GRID_LANES[i]);
      const yaw = Math.atan2(start.tangent.x, start.tangent.z);
      const character: CharacterId = i === 0 ? this.selectedCharacter : candidates[i - 1];
      const visual = this.makeVisual(character);
      visual.group.position.copy(gridPosition);
      visual.group.rotation.y = yaw;
      this.scene.add(visual.group);
      const itemOrbit = new THREE.Group();
      for (let n = 0; n < 3; n++) {
        const orb = new THREE.Group();
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a9, toneMapped: false }));
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.07, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffa56e, toneMapped: false }));
        orb.add(core, halo);
        orb.position.set(Math.cos(n * Math.PI * 2 / 3) * 2.3, 0, Math.sin(n * Math.PI * 2 / 3) * 2.3);
        itemOrbit.add(orb);
      }
      itemOrbit.visible = false;
      this.scene.add(itemOrbit);
      const racer: Racer = {
        id: i, character, visual, itemOrbit, position: gridPosition.clone(), previousPosition: gridPosition.clone(), yaw, moveYaw: yaw, yawRate: 0, speed: 0, progress: starts[i], lap: 1, finishPlace: 0,
        boostTime: 0, padBoostTime: 0, shieldTime: 0, oceanBarrierTime: 0, ultimateTime: 0, ultimateMeter: 0, signatureCooldown: 0, item: null, tripleSparks: 0, fogTime: 0, featherTime: 0, mirrorTime: 0, wishUpgrade: false, curseTime: 0, iceSpeedTime: 0, luckyEscapeCooldown: 0, wobbleTime: 0, hauntedTime: 0, hotHeadTime: 0, laserReadyTime: 0, powerTick: 0, stunTime: 0, hitCooldown: 0, offTrackTime: 0, lastPad: 0,
        drifting: false, driftDirection: 0, driftCharge: 0, jumpTime: 0, jumpDuration: 0, jumpPower: 0, trickReady: false, trickBoost: false, trickAnim: 0, slipCharge: 0, slipCooldown: 0, tricksLanded: 0, draftBoosts: 0, compassTime: 0, compassTarget: null, compassShortcut: null,
        lastSafe: gridPosition.clone(), lastSafeProgress: starts[i], aiRoute: this.aiRouteForLap(i, 1), aiLane: START_GRID_LANES[i], aiLine: START_GRID_LANES[i],
        aiAbilityTimer: 7 + i * 1.2, aiUltimateTimer: 40 + i * 3, ultimateHit: new Set<number>(), steerVisual: 0,
      };
      this.racers.push(racer);
    }
  }

  private makeVisual(character: CharacterId): RaceVisual {
    return character === 'genie' ? new KartVisual('gold')
      : character === 'mickey' || character === 'stitch' ? new ImportedKartVisual(character)
      : new CharacterKartVisual(character);
  }

  private racerSound(name: Parameters<GameAudio['play']>[0], racer: Racer) {
    if (racer.id === 0) this.audio.play(name);
    else this.audio.playAt(name, racer.position);
  }

  private makeCharacterSelect() {
    for (const [index, character] of CHARACTERS.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-choice roster-card';
      button.dataset.character = character.id;
      button.style.setProperty('--racer-accent', `#${character.accent.toString(16).padStart(6, '0')}`);
      button.style.setProperty('--racer-color', `#${character.color.toString(16).padStart(6, '0')}`);
      button.innerHTML = `<span class="roster-card-art"><span class="roster-card-symbol">${character.icon}</span><img class="roster-card-portrait" alt="" /></span><span class="roster-card-number">${String(index + 1).padStart(2, '0')}</span><span class="roster-card-meta"><strong>${character.name}</strong><small>${character.title}</small></span>`;
      button.setAttribute('aria-label', `Select ${character.name}`);
      button.addEventListener('click', () => this.selectCharacter(character.id));
      characterSelect.appendChild(button);
    }
    try {
      const portraits = this.showcase.renderPortraits(CHARACTERS.map((character) => character.id));
      characterSelect.querySelectorAll<HTMLButtonElement>('.roster-card').forEach((button) => {
        const portrait = portraits.get(button.dataset.character as CharacterId);
        if (portrait) button.querySelector<HTMLImageElement>('.roster-card-portrait')!.src = portrait;
      });
    } catch (error) { console.warn('Racer portraits unavailable; using selection symbols.', error); }
    void loadImportedKarts().then((ready) => {
      if (!ready) return;
      const portraits = this.showcase.renderPortraits(['mickey', 'stitch']);
      for (const character of ['mickey', 'stitch'] as const) {
        const portrait = portraits.get(character);
        const image = characterSelect.querySelector<HTMLImageElement>(`.roster-card[data-character="${character}"] .roster-card-portrait`);
        if (portrait && image) image.src = portrait;
      }
    }).catch((error) => console.warn('Detailed racer portraits unavailable.', error));
    this.refreshCharacterSelect();
  }

  private selectCharacter(character: CharacterId) {
    if (this.mode !== 'menu' || character === this.selectedCharacter) return;
    this.audio.start();
    this.selectedCharacter = character;
    try { localStorage.setItem('genie-midnight-character', character); } catch { /* Optional preference. */ }
    const player = this.racers[0];
    this.replaceVisual(player, character);
    this.showcase.select(character);
    this.refreshCharacterSelect();
    this.audio.play('pickup');
  }

  private replaceVisual(racer: Racer, character: CharacterId) {
    if (racer.character === character) return;
    this.scene.remove(racer.visual.group);
    racer.visual.dispose();
    racer.character = character;
    racer.visual = this.makeVisual(character);
    racer.visual.group.position.copy(racer.position);
    racer.visual.group.rotation.y = racer.yaw;
    this.scene.add(racer.visual.group);
  }

  private refreshCharacterSelect() {
    const character = CHARACTER_BY_ID[this.selectedCharacter];
    const index = CHARACTERS.findIndex((entry) => entry.id === character.id) + 1;
    const indexText = `${String(index).padStart(2, '0')} / ${String(CHARACTERS.length).padStart(2, '0')}`;
    menu.style.setProperty('--selected-accent', `#${character.accent.toString(16).padStart(6, '0')}`);
    menu.style.setProperty('--selected-color', `#${character.color.toString(16).padStart(6, '0')}`);
    characterSelect.querySelectorAll<HTMLButtonElement>('.character-choice').forEach((button) => {
      const selected = button.dataset.character === character.id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    characterDetail.innerHTML = `<div class="roster-ability"><span class="ability-key">PASSIVE</span><div><strong>${character.passiveName}</strong><p>${character.passive}</p></div></div><div class="roster-ability"><span class="ability-key">E</span><div><strong>${character.signatureName}</strong><p>${character.signature}</p></div></div><div class="roster-ability"><span class="ability-key">Q</span><div><strong>${character.ultimateName}</strong><p>${character.ultimate}</p></div></div>`;
    el<HTMLElement>('showcase-name').textContent = character.name;
    el<HTMLElement>('showcase-role').textContent = character.title;
    el<HTMLElement>('showcase-index').textContent = indexText;
    el<HTMLElement>('profile-index').textContent = indexText;
    el<HTMLElement>('profile-icon').textContent = character.icon;
    el<HTMLElement>('profile-name').textContent = character.name;
    el<HTMLElement>('profile-role').textContent = character.title;
    el<HTMLElement>('racer-showcase').style.setProperty('--showcase-accent', `#${character.accent.toString(16).padStart(6, '0')}`);
  }

  private makePickups() {
    const orbMat = new THREE.MeshStandardMaterial({ color: 0x6bd4ff, emissive: 0x51c4e7, emissiveIntensity: 1.25, metalness: 0.24, roughness: 0.19, transparent: true, opacity: 0.86 });
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffe5a4, toneMapped: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffdd86, toneMapped: false });
    PICKUP_LAYOUT.forEach(({ route, progress, lateral }, i) => {
      const road = this.track.routeAt(route, progress);
      const group = new THREE.Group();
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), orbMat);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.37, 0), starMat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.085, 8, 28), ringMat);
      const crossRing = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.05, 6, 24), ringMat);
      crossRing.rotation.x = Math.PI / 2.6;
      group.add(orb, core, ring, crossRing);
      group.position.copy(road.position).addScaledVector(road.right, lateral);
      group.position.y += 1.6;
      this.scene.add(group);
      this.pickups.push({ mesh: group, position: group.position, route, progress, baseY: group.position.y, respawn: 0, collected: false, phase: i * 1.7 });
    });
  }

  private bindInput() {
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyR', 'KeyQ', 'KeyF'];
    window.addEventListener('keydown', (event) => {
      if (gameKeys.includes(event.code)) event.preventDefault();
      if (this.plutoPreview) this.audio.start();
      if (event.repeat) return;
      this.keys.add(event.code);
      if (event.code === 'Escape') {
        if (this.mode === 'race') this.pauseGame();
        else if (this.mode === 'paused') this.resumeGame();
      }
      if (this.mode !== 'race') return;
      if (event.code === 'KeyF' || event.code === 'Space') this.performTrick(this.racers[0]);
      if (event.code === 'KeyE') this.useSignature(this.racers[0]);
      if (event.code === 'KeyR') this.useItem(this.racers[0]);
      if (event.code === 'KeyQ') this.activateUltimate(this.racers[0]);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      if (event.code === 'KeyE' && this.wishHolding) this.castWish();
      if (event.code === 'KeyE' && this.laserLocking) this.castLaserLock();
    });
    window.addEventListener('blur', () => { this.keys.clear(); if (this.mode === 'race') this.pauseGame(); });
    if (this.plutoPreview) window.addEventListener('pointerdown', () => this.audio.start());
    el<HTMLButtonElement>('play').addEventListener('click', () => this.startRace());
    el<HTMLButtonElement>('resume').addEventListener('click', () => this.resumeGame());
    el<HTMLButtonElement>('restart').addEventListener('click', () => this.startRace());
    el<HTMLButtonElement>('again').addEventListener('click', () => this.startRace());
    el<HTMLButtonElement>('back-menu').addEventListener('click', () => {
      this.resetRace();
      this.mode = 'menu';
      this.cameraReady = false;
      hud.classList.add('hidden');
      results.classList.add('hidden');
      menu.classList.remove('hidden');
    });
    el<HTMLButtonElement>('mute').addEventListener('click', (event) => {
      this.audio.setMuted(!this.audio.muted);
      (event.currentTarget as HTMLButtonElement).textContent = `Sound: ${this.audio.muted ? 'off' : 'on'}`;
    });
    const musicLevel = el<HTMLInputElement>('music-level');
    const effectsLevel = el<HTMLInputElement>('effects-level');
    const mix = this.audio.getMix();
    musicLevel.value = String(Math.round(mix.music * 100));
    effectsLevel.value = String(Math.round(mix.effects * 100));
    const updateMix = () => this.audio.setMix(Number(musicLevel.value) / 100, Number(effectsLevel.value) / 100);
    musicLevel.addEventListener('input', updateMix);
    effectsLevel.addEventListener('input', updateMix);
    document.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((button) => {
      const action = button.dataset.touch!;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.touch.add(action);
        if (action === 'wish') this.useSignature(this.racers[0]);
        if (action === 'item') this.useItem(this.racers[0]);
        if (action === 'trick') this.performTrick(this.racers[0]);
        if (action === 'ultimate') this.activateUltimate(this.racers[0]);
      });
      const release = (event: PointerEvent) => {
        event.preventDefault();
        this.touch.delete(action);
        if (action === 'wish' && this.wishHolding) this.castWish();
        if (action === 'wish' && this.laserLocking) this.castLaserLock();
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
    });
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.showcase.resize();
  }

  private startRace() {
    this.audio.start();
    this.audio.resetRaceMusic();
    this.resetRace();
    this.mode = 'countdown';
    this.countdownElapsed = 0;
    this.countShown = 4;
    hud.classList.remove('hidden');
    menu.classList.add('hidden');
    pause.classList.add('hidden');
    results.classList.add('hidden');
    countdown.classList.remove('hidden');
    this.updateHUD();
    this.showBanner('GET READY', 2.2);
  }

  private resetRace() {
    this.ufo.reset();
    this.pluto.reset();
    this.plutoTongue.reset();
    this.plutoGliderStarted = false;
    plutoAlert.classList.add('hidden');
    this.plasmaVolleys.length = 0;
    this.plasmaCombos.clear();
    this.plasmaTotalHits = this.ufoTotalHits = 0;
    this.ufoBeamVictims.clear();
    this.lastUfoImpactSound = -10;
    this.ufoPhase = 'none';
    stitchAlert.classList.add('hidden');
    stitchIntro.classList.add('hidden');
    this.stitchIntroTime = 0;
    this.ambientUltBlend = 0;
    atmosphereShade.style.opacity = '0';
    this.setStorm(0);
    this.lapClock = 0;
    this.raceClock = 0;
    delete hud.dataset.handlingStart;
    delete hud.dataset.handlingEnd;
    this.finishCount = 0;
    this.collisionAudit = { frames: 0, roadFrames: 0, obstacleFrames: 0, racerFrames: 0, maxRoad: 0, maxObstacle: 0, maxRacer: 0, examples: [] };
    const rivals = CHARACTERS.map((character) => character.id).filter((id) => id !== this.selectedCharacter);
    if (this.plutoPreview) {
      rivals.splice(rivals.indexOf('mickey'), 1);
      rivals.unshift('mickey');
    } else for (let i = rivals.length - 1; i > 0; i--) { const pick = Math.floor(Math.random() * (i + 1)); [rivals[i], rivals[pick]] = [rivals[pick], rivals[i]]; }
    for (let i = 1; i < RACER_COUNT; i++) this.replaceVisual(this.racers[i], rivals[i - 1]);
    const starts = this.raceStarts();
    this.racers.forEach((racer, i) => {
      const point = this.track.at(starts[i]);
      racer.position.copy(point.position).addScaledVector(point.right, racer.aiLane);
      racer.previousPosition.copy(racer.position);
      racer.yaw = Math.atan2(point.tangent.x, point.tangent.z);
      racer.moveYaw = racer.yaw;
      racer.yawRate = 0;
      racer.speed = 0;
      racer.progress = starts[i];
      racer.lap = 1;
      racer.finishPlace = 0;
      racer.boostTime = racer.padBoostTime = racer.shieldTime = racer.oceanBarrierTime = racer.ultimateTime = racer.stunTime = 0;
      racer.ultimateMeter = this.debugPowers || this.plutoPreview && racer.character === 'mickey' ? 100 : 0;
      racer.signatureCooldown = racer.curseTime = racer.iceSpeedTime = racer.luckyEscapeCooldown = racer.wobbleTime = racer.hauntedTime = racer.hotHeadTime = racer.laserReadyTime = racer.powerTick = 0;
      const requestedItem = new URLSearchParams(window.location.search).get('debugItem');
      racer.item = this.debugPowers && i === 0 ? requestedItem && requestedItem in ITEMS ? requestedItem as ItemId : 'spark' : null;
      racer.tripleSparks = racer.fogTime = racer.featherTime = racer.mirrorTime = 0;
      racer.wishUpgrade = false;
      racer.hitCooldown = racer.offTrackTime = racer.lastPad = 0;
      racer.drifting = false;
      racer.driftDirection = 0;
      racer.driftCharge = 0;
      racer.jumpTime = 0;
      racer.trickReady = racer.trickBoost = false;
      racer.trickAnim = racer.slipCharge = racer.slipCooldown = 0;
      racer.tricksLanded = racer.draftBoosts = 0;
      racer.compassTime = 0;
      racer.compassTarget = null;
      racer.compassShortcut = null;
      racer.visual.setOceanBarrier?.(false);
      racer.lastSafe.copy(racer.position);
      racer.lastSafeProgress = starts[i];
      racer.aiRoute = this.aiRouteForLap(i, 1);
      racer.aiLine = racer.aiLane;
      racer.aiAbilityTimer = 7 + i * 1.2;
      racer.aiUltimateTimer = this.plutoPreview ? racer.character === 'mickey' ? 3.5 : Infinity : 40 + i * 3;
      racer.ultimateHit.clear();
      racer.visual.group.position.copy(racer.position);
      racer.itemOrbit.visible = false;
      racer.visual.group.rotation.y = racer.yaw;
      racer.visual.setShield(false);
      racer.visual.setUltimate(false);
      racer.visual.setPlutoPresent?.(true);
      racer.visual.setGlider?.(false);
      racer.visual.setStunned(false);
    });
    this.cameraYaw = this.racers[0].yaw;
    this.projectiles.forEach((projectile) => { this.scene.remove(projectile.mesh); disposeTransient(projectile.mesh); });
    this.projectiles.length = 0;
    this.powerFields.forEach((field) => { this.scene.remove(field.mesh); disposeTransient(field.mesh); });
    this.powerFields.length = 0;
    this.pulses.forEach((pulse) => { this.scene.remove(pulse.mesh); disposeTransient(pulse.mesh); });
    this.pulses.length = 0;
    this.flashes.forEach((flash) => { this.scene.remove(flash.sprite); flash.sprite.material.dispose(); });
    this.flashes.length = 0;
    this.dashDragons.forEach((dragon) => { this.scene.remove(dragon.group); disposeTransient(dragon.group); });
    this.dashDragons.length = 0;
    this.pickups.forEach((pickup) => { pickup.collected = false; pickup.mesh.visible = true; pickup.respawn = 0; });
    this.wishHolding = false;
    this.laserLocking = false;
    this.laserLockElapsed = 0;
    this.laserLockTarget = -1;
    if (this.racers[0].visual instanceof KartVisual) this.racers[0].visual.setWishPicker(false, 0);
    this.lastCartWarningCycle = -1;
    this.lastBirdSound = -10;
    this.announcementTime = 0;
    ultimateAnnouncement.classList.add('hidden');
    ultimateVeil.classList.add('hidden');
    wishPicker.classList.add('hidden');
    this.keys.clear();
  }

  private pauseGame() {
    this.mode = 'paused';
    this.audio.setPaused(true);
    pause.classList.remove('hidden');
    this.keys.clear();
    this.wishHolding = false;
    this.laserLocking = false;
    if (this.racers[0].visual instanceof KartVisual) this.racers[0].visual.setWishPicker(false, 0);
    wishPicker.classList.add('hidden');
  }

  private resumeGame() {
    this.mode = 'race';
    this.audio.setPaused(false);
    pause.classList.add('hidden');
    this.lastFrame = performance.now();
  }

  private showBanner(message: string, duration = 1.2) {
    banner.textContent = message;
    banner.classList.remove('hidden');
    this.bannerTime = duration;
  }

  private syncGamepad() {
    const gamepad = navigator.getGamepads?.().find((pad) => pad !== null);
    if (!gamepad) {
      this.gamepadSteer = this.gamepadAccel = this.gamepadBrake = 0;
      this.gamepadDrift = false;
      return;
    }
    this.gamepadSteer = Math.abs(gamepad.axes[0] || 0) > 0.13 ? gamepad.axes[0] : 0;
    this.gamepadAccel = Math.max(gamepad.buttons[7]?.value || 0, gamepad.buttons[0]?.pressed ? 1 : 0);
    this.gamepadBrake = gamepad.buttons[6]?.value || 0;
    this.gamepadDrift = Boolean(gamepad.buttons[2]?.pressed);
    const wish = Boolean(gamepad.buttons[1]?.pressed);
    const ultimate = Boolean(gamepad.buttons[3]?.pressed);
    if (this.mode === 'race') {
      if (wish && !this.gamepadWishHeld) this.useSignature(this.racers[0]);
      if (!wish && this.gamepadWishHeld && this.wishHolding) this.castWish();
      if (!wish && this.gamepadWishHeld && this.laserLocking) this.castLaserLock();
      if (ultimate && !this.gamepadUltimateHeld) this.activateUltimate(this.racers[0]);
    }
    this.gamepadWishHeld = wish;
    this.gamepadUltimateHeld = ultimate;
  }

  private beginWish() {
    if (this.mode !== 'race' || this.wishHolding || this.racers[0].stunTime > 0 || this.racers[0].signatureCooldown > 0) return;
    this.wishHolding = true;
    this.wishElapsed = 0;
    this.wishIndex = 0;
    wishPicker.classList.remove('hidden');
    this.updateWishPicker();
  }

  private updateWishPicker() {
    const choices = wishPicker.querySelectorAll<HTMLElement>('.wish-option');
    choices.forEach((choice, index) => choice.classList.toggle('active', index === this.wishIndex));
    if (this.racers[0].visual instanceof KartVisual) this.racers[0].visual.setWishPicker(this.wishHolding, this.wishIndex);
  }

  private castWish() {
    if (!this.wishHolding) return;
    this.wishHolding = false;
    wishPicker.classList.add('hidden');
    if (this.racers[0].visual instanceof KartVisual) this.racers[0].visual.setWishPicker(false, 0);
    const choices: Wish[] = ['boost', 'shield', 'shot'];
    this.racers[0].signatureCooldown = CHARACTER_BY_ID.genie.signatureCooldown;
    this.useWish(this.racers[0], choices[this.wishIndex]);
  }

  private projectileAimSign(racer: Racer) {
    return racer.id === 0 && this.keys.has('ArrowDown') ? -1 : 1;
  }

  private projectileDirection(racer: Racer, sign = this.projectileAimSign(racer)) {
    return new THREE.Vector3(Math.sin(racer.yaw) * sign, 0, Math.cos(racer.yaw) * sign);
  }

  private findLaserTarget(racer: Racer) {
    const forward = this.projectileDirection(racer);
    const range = racer.laserReadyTime > 0 ? 56 : 44;
    return this.racers.filter((other) => {
      if (other.id === racer.id || other.stunTime > 0 || other.fogTime > 0 || Math.abs(other.position.y - racer.position.y) > 4) return false;
      const gap = other.position.clone().sub(racer.position).setY(0);
      return gap.length() < range && gap.dot(forward) > gap.length() * 0.7;
    }).sort((a, b) => a.position.distanceToSquared(racer.position) - b.position.distanceToSquared(racer.position))[0];
  }

  private beginLaserLock() {
    this.laserLocking = true;
    this.laserLockElapsed = 0;
    this.laserLockTarget = -1;
    this.showBanner('LASER LOCK · HOLD ON TARGET', 0.9);
  }

  private castLaserLock() {
    if (!this.laserLocking) return;
    this.laserLocking = false;
    if (this.mode !== 'race') return;
    const racer = this.racers[0];
    if (racer.character !== 'buzz' || racer.stunTime > 0 || racer.signatureCooldown > 0) return;
    const starCommand = racer.laserReadyTime > 0;
    const target = this.laserLockElapsed >= (starCommand ? 0.2 : 0.33) ? this.laserLockTarget : -1;
    racer.signatureCooldown = CHARACTER_BY_ID.buzz.signatureCooldown;
    racer.laserReadyTime = 0;
    const origin = racer.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.makeFlash(origin, 0xb0ff73, 5, 0.38);
    this.burst(origin, 0x73d94b, 0xe6ff9c, 20);
    this.launchPower(racer, 'laser', 0xb0ff73, starCommand ? 66 : target >= 0 ? 62 : 52, 1.65, target);
    this.showBanner(target >= 0 ? 'LASER LOCK · FIRED!' : 'LASER SHOT!', 0.9);
    this.audio.playSignature('buzz');
    this.laserLockTarget = -1;
  }

  private useItem(racer: Racer) {
    if (this.mode !== 'race' || racer.stunTime > 0) return;
    if (!racer.item && racer.tripleSparks > 0) {
      racer.tripleSparks--;
      this.launchPower(racer, 'star', 0xffbb7e, 45, 3.4);
      if (racer.id === 0) this.showBanner(`TRIPLE SPARK · ${racer.tripleSparks} LEFT`, 0.9);
      return;
    }
    const item = racer.item;
    if (!item) return;
    racer.item = null;
    const here = racer.position.clone().add(new THREE.Vector3(0, 1.7, 0));
    const color = Number.parseInt(ITEMS[item].color.slice(1), 16);
    this.makeFlash(here, color, 5.2, 0.37);
    this.burst(here, color, 0xffffff, 14);
    if (racer.id === 0) this.showBanner(ITEMS[item].name.toUpperCase(), 1);
    switch (item) {
      case 'dash':
        racer.boostTime = Math.max(racer.boostTime, 2.65);
        racer.speed = Math.max(racer.speed, raceSpeed(41));
        this.racerSound('boost', racer);
        break;
      case 'mirror':
        racer.mirrorTime = 12;
        racer.shieldTime = Math.max(racer.shieldTime, 12);
        this.makePulse(racer.position, color, 0.7, 5);
        this.racerSound('shield', racer);
        break;
      case 'spark':
        this.launchPower(racer, 'star', color, 47, 4);
        break;
      case 'firefly': {
        const forward = this.projectileDirection(racer);
        const target = this.racers.filter((other) => other.id !== racer.id && other.fogTime <= 0 && other.position.clone().sub(racer.position).dot(forward) > 0 && other.position.distanceTo(racer.position) < 90)
          .sort((a, b) => a.position.distanceTo(racer.position) - b.position.distanceTo(racer.position))[0];
        this.launchPower(racer, 'firefly', color, 33, 3.8, target?.id ?? -1);
        break;
      }
      case 'tornado':
        this.launchPower(racer, 'tornado', color, 27, 4.5);
        break;
      case 'clock':
        this.dropField(racer, 'clock', color, 5.2, 7, -4);
        this.racerSound('wish', racer);
        break;
      case 'fog':
        racer.fogTime = 4.2;
        this.makePulse(racer.position, color, 1, 5.5);
        this.racerSound('shield', racer);
        break;
      case 'horn':
        this.makePulse(racer.position, color, 0.85, 12);
        for (const other of this.racers) {
          if (other.id === racer.id || other.ultimateTime > 0 || other.position.distanceTo(racer.position) > 13) continue;
          const away = other.position.clone().sub(racer.position).setY(0).normalize();
          other.position.addScaledVector(away, 4.8);
          other.speed *= 0.62;
          other.wobbleTime = Math.max(other.wobbleTime, 0.8);
          other.hitCooldown = Math.max(other.hitCooldown, 0.65);
          this.makeFlash(other.position.clone().add(new THREE.Vector3(0, 1, 0)), color, 4, 0.3);
        }
        this.racerSound('hit', racer);
        break;
      case 'feather':
        racer.featherTime = 7;
        racer.boostTime = Math.max(racer.boostTime, 1.2);
        this.startJump(racer, 1.3, 1.9);
        this.racerSound('boost', racer);
        break;
      case 'anchor':
        this.dropField(racer, 'anchor', color, 2.6, 13, -4);
        this.racerSound('hit', racer);
        break;
      case 'triple':
        racer.tripleSparks = 3;
        this.makePulse(racer.position, color, 0.75, 5);
        this.racerSound('shield', racer);
        break;
    }
  }

  private useSignature(racer: Racer) {
    if (this.mode !== 'race' || racer.stunTime > 0 || racer.signatureCooldown > 0) return;
    let plutoTarget = -1;
    if (racer.character === 'mickey') {
      const aim = this.projectileDirection(racer);
      plutoTarget = this.racers.filter((other) => other.id !== racer.id && other.stunTime <= 0 && other.position.distanceTo(racer.position) <= 52
        && (racer.id !== 0 || other.position.clone().sub(racer.position).dot(aim) > 0))
        .sort((a, b) => a.position.distanceToSquared(racer.position) - b.position.distanceToSquared(racer.position))[0]?.id ?? -1;
      if (plutoTarget < 0) {
        if (racer.id === 0) this.showBanner('PLUTO · NO RACER IN RANGE', 0.85);
        return;
      }
    }
    if (racer.character === 'genie' && racer.id === 0) { this.beginWish(); return; }
    if (racer.character === 'buzz' && racer.id === 0) { this.beginLaserLock(); return; }
    if (racer.character === 'maleficent' && racer.ultimateTime > 0) {
      racer.signatureCooldown = 1.35;
      for (const side of [-0.95, 0, 0.95]) this.launchPower(racer, 'dragonfire', 0x9bfa72, 42, 0.9, -1, side, side === 0);
      const mouth = racer.position.clone().add(new THREE.Vector3(Math.sin(racer.yaw) * 4.2, 2.2, Math.cos(racer.yaw) * 4.2));
      this.makeFlash(mouth, 0x7dff60, 5.6, 0.38);
      this.burst(mouth, 0xa3ff76, 0xdffff0, 24);
      if (racer.id === 0) this.showBanner('DRAGON BREATH!', 0.9);
      return;
    }
    const def = CHARACTER_BY_ID[racer.character];
    racer.signatureCooldown = def.signatureCooldown;
    const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
    const braking = racer.id === 0 && (this.keys.has('KeyS') || this.gamepadBrake > 0.2 || this.debugBrake);
    const origin = racer.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.makeFlash(origin, def.accent, 4.8, 0.38);
    this.burst(origin, def.color, def.accent, 20);
    if (racer.id === 0) this.showBanner(def.signatureName.toUpperCase(), 1);
    if (racer.id === 0) this.audio.playSignature(racer.character);
    else this.audio.playAt('wish', racer.position);
    switch (racer.character) {
      case 'genie':
        this.useWish(racer, 'boost');
        break;
      case 'mickey':
        this.plutoTongue.fire(racer.id, plutoTarget, this.racers);
        this.makeFlash(racer.position.clone().add(new THREE.Vector3(0, 2.8, 0)), 0xff829e, 3.2, 0.22);
        break;
      case 'stitch':
        this.firePlasmaBurst(racer);
        break;
      case 'elsa':
        for (let n = 0; n < 4; n++) this.dropField(racer, 'ice', 0x9fefff, 3.6, 8, -2 - n * 2.6);
        break;
      case 'moana':
        if (braking) {
          racer.oceanBarrierTime = Math.max(racer.oceanBarrierTime, 3.2);
          const rear = racer.position.clone().addScaledVector(forward, -2.7);
          this.makePulse(rear, 0x66e9e9, 0.65, 3.6);
          if (racer.id === 0) this.showBanner('OCEAN BARRIER · REAR GUARD', 1.1);
          this.racerSound('shield', racer);
        } else this.launchPower(racer, 'wave', 0x58e8db, 30, 1.25);
        break;
      case 'buzz': {
        const aim = this.projectileDirection(racer);
        const targets = this.racers.filter((other) => other.id !== racer.id && other.stunTime <= 0 && other.fogTime <= 0 && other.position.clone().sub(racer.position).dot(aim) > 0 && other.position.distanceTo(racer.position) < 42);
        targets.sort((a, b) => a.position.distanceTo(racer.position) - b.position.distanceTo(racer.position));
        this.launchPower(racer, 'laser', 0xb0ff73, racer.laserReadyTime > 0 ? 62 : 52, 1.65, targets[0]?.id ?? -1);
        racer.laserReadyTime = 0;
        break;
      }
      case 'maleficent':
        this.launchPower(racer, 'curse', 0x89fa74, 39, 3.5);
        break;
      case 'hades':
        this.dropField(racer, 'soul', 0x55a8ff, 4.8, 9, -3.3);
        break;
      case 'jack': {
        const currentRoute = this.track.nearest(racer.position, racer.progress).point.route;
        const next = this.pickups.filter((pickup) => !pickup.collected && pickup.route === currentRoute)
          .map((pickup) => ({ pickup, ahead: wrap(pickup.progress - racer.progress) }))
          .filter((entry) => entry.ahead > 0.012 && entry.ahead < 0.11)
          .sort((a, b) => a.ahead - b.ahead)[0];
        const shortcut = currentRoute === 'main' ? ([
          { route: 'alley', progress: 0.045 },
          { route: 'roof', progress: 0.19 },
          { route: 'garden', progress: 0.37 },
        ] as const).map((entry) => ({ ...entry, ahead: wrap(entry.progress - racer.progress) }))
          .filter((entry) => entry.ahead > 0.012 && entry.ahead < 0.11)
          .sort((a, b) => a.ahead - b.ahead)[0] : undefined;
        if (shortcut && (!next || shortcut.ahead < next.ahead)) {
          racer.compassShortcut = { route: shortcut.route, progress: shortcut.progress };
          racer.compassTarget = null;
          racer.compassTime = 6;
          if (racer.id !== 0 || this.demoMode) racer.aiRoute = shortcut.route;
          const entrance = this.track.at(shortcut.progress).position;
          this.makePulse(entrance, 0xffd77d, 1.15, 6);
          this.makeFlash(entrance, 0xffdd85, 6, 0.7);
          if (racer.id === 0) this.showBanner(`COMPASS · ${shortcut.route.toUpperCase()} SHORTCUT AHEAD`, 1.4);
        } else if (next) {
          racer.compassTarget = next.pickup;
          racer.compassShortcut = null;
          racer.compassTime = 6;
          this.makePulse(next.pickup.mesh.position, 0xffd77d, 1.15, 6);
          this.makeFlash(next.pickup.mesh.position, 0xffdd85, 6, 0.7);
          if (racer.id === 0) this.showBanner(`COMPASS · ${next.pickup.route.toUpperCase()} SPARK AHEAD`, 1.4);
        }
        racer.boostTime = Math.max(racer.boostTime, 1.1);
        break;
      }
      case 'mulan':
        racer.boostTime = Math.max(racer.boostTime, 1.55);
        racer.speed = Math.max(racer.speed, raceSpeed(39));
        this.makePulse(racer.position, 0x71e4cf, 0.4, 3.2);
        this.spawnDashDragon(racer);
        break;
    }
  }

  private useWish(racer: Racer, wish: Wish) {
    if (racer.stunTime > 0) return;
    const upgraded = racer.wishUpgrade;
    racer.wishUpgrade = false;
    if (wish === 'boost') {
      racer.boostTime = Math.max(racer.boostTime, upgraded ? 2.7 : 1.8);
      const ignition = racer.position.clone().add(new THREE.Vector3(0, 0.7, 0));
      this.burst(ignition, 0x55dfff, 0xffd56c, 18);
      if (racer.id === 0) this.showBanner('WISH: BOOST', 0.9);
      this.racerSound('boost', racer);
    } else if (wish === 'shield') {
      racer.shieldTime = Math.max(racer.shieldTime, upgraded ? 6 : 4);
      this.burst(racer.position.clone().add(new THREE.Vector3(0, 2.3, 0)), 0x71e7ff, 0xc9f6ff, 14);
      if (racer.id === 0) this.showBanner('WISH: SHIELD', 0.9);
      this.racerSound('shield', racer);
    } else {
      const mesh = makeProjectile();
      const direction = this.projectileDirection(racer);
      mesh.position.copy(racer.position).addScaledVector(direction, 3.6);
      mesh.position.y += 2.1;
      mesh.rotation.y = racer.yaw + (this.projectileAimSign(racer) < 0 ? Math.PI : 0);
      this.makeFlash(mesh.position, 0xff7561, 4.8, 0.4);
      this.burst(mesh.position, 0xffbd66, 0xff4d5b, 16);
      this.scene.add(mesh);
      this.projectiles.push({ owner: racer.id, mesh, velocity: direction.multiplyScalar(Math.max(upgraded ? 52 : 44, racer.speed + 12)), life: 3, kind: 'star', color: 0xffb35e, bounces: 0, target: -1 });
      if (racer.id === 0) this.showBanner('WISH: STAR SHOT', 0.9);
      this.racerSound('shot', racer);
    }
  }

  private activateUltimate(racer: Racer) {
    if (this.mode !== 'race' || racer.ultimateTime > 0 || racer.stunTime > 0 || racer.ultimateMeter < 100) return;
    if (this.racers.some((other) => other.ultimateTime > 0) || this.ufo.active || this.pluto.active) {
      if (racer.id === 0) this.showBanner('ANOTHER ULTIMATE IS ACTIVE · WAIT', 1.1);
      return;
    }
    if (racer.character === 'stitch' && !this.ufo.start(racer.id, this.racers)) return;
    if (racer.character === 'mickey' && !this.pluto.start(racer.id, this.plutoPreview ? 0 : -1)) return;
    racer.ultimateMeter = 0;
    racer.ultimateTime = racer.character === 'stitch' ? STITCH_UFO_DURATION : PLUTO_ULTIMATE_DURATION;
    if (racer.character !== 'stitch') {
      racer.shieldTime = Math.max(racer.shieldTime, racer.ultimateTime);
      racer.boostTime = Math.max(racer.boostTime, racer.ultimateTime);
      racer.speed = Math.max(racer.speed, raceSpeed(34));
    }
    if (racer.character === 'maleficent') racer.signatureCooldown = 0;
    racer.ultimateHit.clear();
    racer.powerTick = 0;
    racer.visual.setUltimate(racer.character !== 'stitch');
    const def = CHARACTER_BY_ID[racer.character];
    const shadeColor = racer.character === 'stitch' ? new THREE.Color(0x1b1236) : new THREE.Color(def.color).multiplyScalar(0.22);
    atmosphereShade.style.setProperty('--atmosphere-color', `#${shadeColor.getHexString()}`);
    this.bannerTime = 0;
    banner.classList.add('hidden');
    if (racer.character === 'stitch') {
      this.announcementTime = 0;
      ultimateAnnouncement.classList.add('hidden');
      this.stitchIntroTime = 4.2;
      stitchIntro.classList.remove('hidden');
    } else {
      this.announcementTime = 1.35;
      ultimateAnnouncement.innerHTML = `<span>${def.icon}</span><div><small>${racer.id === 0 ? 'YOUR' : 'RIVAL'} ULTIMATE · ${def.name.toUpperCase()}</small><strong>${def.ultimateName.toUpperCase()}</strong></div>`;
      ultimateAnnouncement.style.setProperty('--ultimate-color', `#${def.accent.toString(16).padStart(6, '0')}`);
      ultimateAnnouncement.classList.remove('hidden');
    }
    if (racer.id === 0 && racer.character !== 'stitch') {
      ultimateVeil.style.setProperty('--ultimate-color', `#${def.accent.toString(16).padStart(6, '0')}`);
      ultimateVeil.classList.remove('hidden');
    }
    this.makePulse(racer.position, def.accent, 0.7, 5.8);
    this.makeFlash(racer.position.clone().add(new THREE.Vector3(0, 2.2, 0)), def.accent, 7, 0.55);
    this.burst(racer.position.clone().add(new THREE.Vector3(0, 1.7, 0)), def.color, def.accent, 36);
    if (racer.character === 'mickey') {
      this.plutoGliderStarted = false;
      racer.visual.setPlutoPresent?.(false);
      racer.visual.setGlider?.(false);
      plutoAlert.textContent = 'PLUTO IS COMING · WATCH THE ROAD';
      plutoAlert.classList.remove('hidden');
    }
    if (racer.character === 'mulan') this.launchPower(racer, 'dragon', 0x74e3cf, 54, 5);
    if (racer.character === 'stitch' || racer.character === 'mickey' || racer.id === 0) this.audio.playUltimate(racer.character);
    else this.audio.playAt('ultimate', racer.position);
  }

  private firePlasmaBurst(racer: Racer) {
    const aimSign = this.projectileAimSign(racer);
    const forward = this.projectileDirection(racer, aimSign);
    const target = this.racers.filter((other) => other.id !== racer.id && other.stunTime <= 0)
      .map((other) => ({ other, delta: other.position.clone().sub(racer.position) }))
      .filter(({ delta }) => delta.lengthSq() < 165 * 165 && delta.dot(forward) > -16)
      .sort((a, b) => a.delta.lengthSq() - b.delta.lengthSq())[0]?.other.id ?? -1;
    const volley = { owner: racer.id, target, cast: ++this.plasmaCast, remaining: 3, timer: 0, aimSign };
    this.plasmaVolleys.push(volley);
    this.launchPlasmaShot(volley);
  }

  private launchPlasmaShot(volley: { owner: number; target: number; cast: number; remaining: number; timer: number; aimSign: number }) {
    const racer = this.racers[volley.owner];
    if (!racer || volley.remaining <= 0) return;
    const shot = 3 - volley.remaining;
    this.launchPower(racer, 'plasma', shot === 2 ? 0x8feeff : 0x67dfff, Math.max(115, racer.speed + 45), 3.8, volley.target, (shot - 1) * 0.58, false, volley.aimSign);
    if (racer.id !== 0 || shot > 0) this.racerSound('plasma-shot', racer);
    this.projectiles[this.projectiles.length - 1].cast = volley.cast;
    volley.remaining--;
    volley.timer = 0.12;
  }

  private updatePlasmaVolleys(dt: number) {
    for (let i = this.plasmaVolleys.length - 1; i >= 0; i--) {
      const volley = this.plasmaVolleys[i];
      volley.timer -= dt;
      if (volley.timer <= 0 && volley.remaining > 0) this.launchPlasmaShot(volley);
      if (volley.remaining <= 0) this.plasmaVolleys.splice(i, 1);
    }
  }

  private updateStitchUfo(dt: number) {
    const wasActive = this.ufo.active;
    const previousPhase = this.ufoPhase;
    const { impacts, locks, phase } = this.ufo.update(dt, this.racers);
    this.ufoPhase = this.ufo.active ? phase : 'none';
    if (phase === 'tracking' && previousPhase === 'inbound') this.audio.play('ufo-barrage');
    if (locks > 0) this.audio.play('ufo-lock');
    if (phase === 'sweep' && previousPhase !== 'sweep') this.audio.play('ufo-warning');
    if (phase === 'beam' && previousPhase !== 'beam') this.audio.play('ufo-beam');
    let nearImpact = false;
    for (const impact of impacts) {
      const strike = impact.position.clone().add(new THREE.Vector3(0, 0.3, 0));
      this.makePulse(strike, impact.kind === 'beam' ? 0x91f9ff : 0x9b78ff, 0.45, impact.kind === 'beam' ? 3.3 : 5.4);
      this.makeFlash(strike.clone().add(new THREE.Vector3(0, 1.3, 0)), 0x9cefff, impact.kind === 'beam' ? 4.2 : 6.8, 0.25);
      this.burst(strike.clone().add(new THREE.Vector3(0, 1.5, 0)), 0x66edff, 0xa370ff, impact.kind === 'beam' ? 5 : 12);
      nearImpact ||= impact.position.distanceTo(this.racers[0].position) < 55;
      for (const racer of this.racers) {
        if (impact.target !== undefined && racer.id !== impact.target) continue;
        if (racer.id === this.ufo.owner || racer.stunTime > 0 || racer.hitCooldown > 0) continue;
        if (Math.abs(racer.position.y - impact.position.y) > 3.4) continue;
        let distance = Math.hypot(racer.position.x - impact.position.x, racer.position.z - impact.position.z);
        if (impact.previous) {
          const segment = impact.position.clone().sub(impact.previous).setY(0);
          const offset = racer.position.clone().sub(impact.previous).setY(0);
          const t = clamp(offset.dot(segment) / Math.max(0.001, segment.lengthSq()), 0, 1);
          distance = offset.addScaledVector(segment, -t).length();
        }
        if (distance > impact.radius + 1.25) continue;
        this.stun(racer, impact.kind === 'beam' ? 0.65 : 0.48);
        this.ufoTotalHits++;
        if (impact.kind === 'beam') this.ufoBeamVictims.add(racer.id);
        if (racer.id === 0) this.showBanner('UFO PLASMA HIT!', 0.8);
      }
    }
    if (nearImpact && this.raceClock - this.lastUfoImpactSound > 0.24) {
      this.audio.play('ufo-impact');
      this.lastUfoImpactSound = this.raceClock;
    }
    if (!this.ufo.active) {
      stitchAlert.classList.add('hidden');
      if (wasActive) this.racers.forEach((racer) => { if (racer.character === 'stitch') racer.ultimateTime = 0; });
    } else {
      const threat = this.ufo.getLockedThreat(0);
      stitchAlert.textContent = threat ? 'PLASMA LOCKED · EVADE!' : phase === 'beam' ? this.ufo.beamTarget === 0 ? 'LEADER BEAM · DODGE!' : 'LEADER BEAM FIRING' : phase === 'sweep' ? this.ufo.beamTarget === 0 ? 'BEAM LOCKING ON YOU' : 'BEAM LOCKING ON LEADER' : phase === 'inbound' ? 'EXPERIMENT 626 · INBOUND' : phase === 'locked' ? 'PLASMA TARGETS LOCKED' : 'UFO TARGETING THE TRACK';
      stitchAlert.dataset.phase = phase;
      stitchAlert.classList.toggle('hidden', this.stitchIntroTime > 0);
    }
  }

  private updatePluto(dt: number) {
    const tongueHits = this.plutoTongue.update(dt, this.racers);
    for (const hit of tongueHits) {
      const target = this.racers[hit.target];
      const owner = this.racers[hit.owner];
      if (!target || !owner || target.hitCooldown > 0) continue;
      this.stun(target, 0.9);
      target.speed *= 0.75;
      owner.boostTime = Math.max(owner.boostTime, 1.15);
      owner.ultimateMeter = Math.min(100, owner.ultimateMeter + 7);
      this.makePulse(hit.position, 0xff759d, 0.42, 3.4);
      this.makeFlash(hit.position, 0xffc3d1, 4.5, 0.3);
      this.burst(hit.position, 0xff739e, 0xffdb8b, 26);
      this.audio.playAt('pluto-tongue-hit', hit.position);
      if (target.id === 0) this.showBanner('PLUTO LICKED YOU!', 0.95);
      if (owner.id === 0) this.showBanner('PLUTO HIT · GOOD BOY BOOST!', 1.0);
    }
    if (!this.pluto.active) return;
    const owner = this.racers[this.pluto.owner];
    const ageBefore = this.pluto.elapsed;
    const impacts = this.pluto.update(dt, this.racers);
    if (owner && !this.plutoGliderStarted && ageBefore < 3.85 && this.pluto.elapsed >= 3.85) {
      this.plutoGliderStarted = true;
      this.startJump(owner, 4.0, 8.0);
      owner.trickReady = false;
      owner.boostTime = Math.max(owner.boostTime, 5.5);
      this.audio.playAt('pluto-glide', owner.position);
      if (owner.id === 0) this.showBanner('MAGIC GLIDER · STEER THROUGH THE SKY', 1.7);
    }
    for (const impact of impacts) {
      this.makePulse(impact.position, 0xffbd74, 0.85, 8.2);
      this.makeFlash(impact.position.clone().add(new THREE.Vector3(0, 2.2, 0)), 0xffd78a, 11, 0.5);
      this.burst(impact.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xf6b476, 0xe7c696, 60);
      this.audio.playAt('pluto-slam', impact.position);
    }
    for (const racer of this.racers) {
      if (racer.id === this.pluto.owner || racer.jumpTime > 0 && racer.jumpPower > 2) continue;
      const mark = this.pluto.hazardAt(racer);
      if (!mark) continue;
      const road = this.track.nearest(racer.position, racer.progress);
      const direction = mark.lane === 0 ? 1 : mark.lane === 2 ? -1 : road.lateral < 0 ? -1 : 1;
      racer.position.addScaledVector(mark.right, direction * Math.min(2.3, dt * 28));
      racer.speed = Math.min(racer.speed, raceSpeed(16));
      if (!mark.hit.has(racer.id)) {
        mark.hit.add(racer.id);
        this.stun(racer, 0.85);
        this.makePulse(racer.position, 0xff8155, 0.5, 3.8);
        if (racer.id === 0) this.showBanner('BROKEN ROAD · FIND AN OPEN LANE!', 1.2);
      }
    }
    const age = this.pluto.elapsed;
    plutoAlert.textContent = age < 3.85 ? 'GIANT PLUTO INBOUND · WATCH THE TRACK' : age < 5.5 ? 'PAW SLAM · MOVE OUT OF THE GOLD LANE' : age < 11.8 ? 'BROKEN ROAD · SECOND STRIKE COMING' : 'PAW SLAM · FIND A CLEAR LINE';
    if (!this.pluto.active) {
      plutoAlert.classList.add('hidden');
      owner?.visual.setPlutoPresent?.(true);
      owner?.visual.setGlider?.(false);
    }
  }

  private launchPower(racer: Racer, kind: Projectile['kind'], color: number, speed: number, life: number, target = -1, side = 0, playSound = true, aimSign = this.projectileAimSign(racer)) {
    const direction = this.projectileDirection(racer, aimSign);
    const right = new THREE.Vector3(direction.z, 0, -direction.x);
    const aimedTarget = target >= 0 && racer.id === 0 && (!this.racers[target] || this.racers[target].position.clone().sub(racer.position).dot(direction) <= 0) ? -1 : target;
    const mesh = new THREE.Group();
    const bright = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const pale = new THREE.MeshBasicMaterial({ color: kind === 'dragonfire' ? 0xe5ff9a : 0xffffff, toneMapped: false });
    let coreGeometry: THREE.BufferGeometry = kind === 'tornado' ? new THREE.ConeGeometry(1.45, 3.4, 12, 1, true) : new THREE.IcosahedronGeometry(kind === 'dragon' ? 1.05 : kind === 'cannon' ? 0.66 : 0.75, 1);
    if (kind === 'star') {
      const star = new THREE.Shape();
      for (let point = 0; point < 10; point++) {
        const angle = point * Math.PI / 5 - Math.PI / 2;
        const radius = point % 2 ? 0.48 : 1.08;
        const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius;
        if (point === 0) star.moveTo(x, y); else star.lineTo(x, y);
      }
      star.closePath();
      coreGeometry = new THREE.ExtrudeGeometry(star, { depth: 0.3, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.13, bevelThickness: 0.12 });
    }
    if (kind === 'laser') coreGeometry = new THREE.CylinderGeometry(0.19, 0.39, 3.4, 12);
    if (kind === 'firefly') coreGeometry = new THREE.SphereGeometry(0.55, 12, 8);
    if (kind === 'dragonfire') coreGeometry = new THREE.ConeGeometry(0.72, 2.6, 14, 3);
    if (kind === 'wave') coreGeometry = new THREE.TorusGeometry(2.5, 0.38, 9, 30, Math.PI * 1.7);
    const core = new THREE.Mesh(coreGeometry, kind === 'cannon' ? new THREE.MeshBasicMaterial({ color: 0x32445a, toneMapped: false }) : bright);
    if (kind === 'laser') core.rotation.x = Math.PI / 2;
    if (kind === 'dragonfire') { core.rotation.x = Math.PI / 2; core.position.z = 0.65; }
    if (kind === 'wave') core.rotation.z = 0.15;
    mesh.add(core);
    if (kind === 'dragonfire') {
      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(1.12, 3.25, 16, 4), new THREE.MeshBasicMaterial({ color: 0x73ee68, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      outerFlame.rotation.x = Math.PI / 2;
      outerFlame.position.z = 0.26;
      mesh.add(outerFlame);
    } else {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(kind === 'dragon' ? 1.55 : 1.05, 0.12, 6, 24), new THREE.MeshBasicMaterial({ color: kind === 'cannon' ? color : 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false }));
      mesh.add(halo);
    }
    if (kind === 'tornado') {
      core.position.y = 0.7;
      for (let n = 0; n < 3; n++) {
        const spiral = new THREE.Mesh(new THREE.TorusGeometry(0.55 + n * 0.35, 0.09, 5, 18), pale);
        spiral.rotation.x = Math.PI / 2;
        spiral.position.y = -0.5 + n * 0.8;
        mesh.add(spiral);
      }
    }
    if (kind === 'plasma') {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1.04, 18, 12), new THREE.MeshBasicMaterial({ color: 0x9f78ff, transparent: true, opacity: 0.47, depthWrite: false, toneMapped: false }));
      mesh.add(shell);
      for (const angle of [0, Math.PI / 2]) {
        const filament = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.075, 6, 28), new THREE.MeshBasicMaterial({ color: 0x9deeff, transparent: true, opacity: 0.88, depthWrite: false, toneMapped: false }));
        filament.rotation.y = angle;
        mesh.add(filament);
      }
      for (let n = 0; n < 4; n++) {
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), pale);
        const angle = n * Math.PI / 2;
        spark.position.set(Math.cos(angle) * 1.23, Math.sin(angle) * 1.23, 0);
        mesh.add(spark);
      }
    } else if (kind === 'dragonfire') {
      for (let n = 0; n < 5; n++) {
        const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.26 + (n % 2) * 0.08, 1.25 + (n % 3) * 0.22, 8), n % 2 ? pale : bright);
        tongue.rotation.x = Math.PI / 2;
        tongue.position.set((n - 2) * 0.36, (n % 2 ? 0.22 : -0.16), -0.45 - n * 0.18);
        mesh.add(tongue);
      }
    } else if (kind === 'curse') {
      for (let n = 0; n < 3; n++) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.27, 1.25, 8), new THREE.MeshBasicMaterial({ color: n === 1 ? 0xd9ff84 : color, transparent: true, opacity: 0.83, depthWrite: false, side: THREE.DoubleSide }));
        flame.position.set((n - 1) * 0.45, 0.7 + (n % 2) * 0.22, -0.1);
        flame.rotation.z = (n - 1) * -0.25;
        mesh.add(flame);
      }
    } else if (kind === 'dragon') {
      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.8, 9), bright);
      snout.rotation.x = Math.PI / 2; snout.position.z = 1.02; mesh.add(snout);
      const bodyPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, -0.2),
        new THREE.Vector3(-0.42, -0.14, -1.14),
        new THREE.Vector3(0.38, 0.12, -2.25),
        new THREE.Vector3(-0.25, 0.05, -3.32),
        new THREE.Vector3(0, 0.23, -4.12),
      ]);
      const body = new THREE.Mesh(new THREE.TubeGeometry(bodyPath, 26, 0.43, 9, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false }));
      mesh.add(body);
      for (let n = 0; n < 4; n++) {
        const along = bodyPath.getPoint((n + 1) / 5);
        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.21 - n * 0.025, 0.72 - n * 0.08, 6), pale);
        spine.position.set(along.x, along.y + 0.45, along.z);
        spine.rotation.z = -0.23;
        mesh.add(spine);
        if (n < 3) {
          const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.23 - n * 0.035, 8, 6), pale);
          pearl.position.set(along.x, along.y - 0.1, along.z);
          mesh.add(pearl);
        }
      }
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 7), pale);
        horn.position.set(side * 0.66, 0.73, -0.25); horn.rotation.z = side * -0.34; mesh.add(horn);
        const eyeDot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), pale);
        eyeDot.position.set(side * 0.65, 0.17, 0.48); mesh.add(eyeDot);
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0); finShape.lineTo(side * 1.2, 0.67); finShape.lineTo(side * 0.54, -0.46); finShape.closePath();
        const fin = new THREE.Mesh(new THREE.ShapeGeometry(finShape), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.67, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        fin.position.set(0, 0.16, -1.2);
        fin.rotation.y = side * 0.24;
        mesh.add(fin);
      }
    } else if (kind === 'cannon') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.11, 6, 18), pale);
      band.rotation.y = Math.PI / 2; mesh.add(band);
    } else if (kind === 'laser') {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 12), pale);
      tip.rotation.x = Math.PI / 2; tip.position.z = 1.75; mesh.add(tip);
    } else if (kind === 'wave') {
      for (let n = 0; n < 5; n++) {
        const foam = new THREE.Mesh(new THREE.SphereGeometry(0.23 + n * 0.045, 8, 6), pale);
        foam.position.set(-1.55 + n * 0.78, 1.63 + Math.sin(n) * 0.22, 0.14);
        mesh.add(foam);
      }
    }
    mesh.position.copy(racer.position).addScaledVector(direction, 3.3).addScaledVector(right, side);
    mesh.position.y += 1.65;
    mesh.rotation.y = racer.yaw + (aimSign < 0 ? Math.PI : 0);
    this.scene.add(mesh);
    this.projectiles.push({ owner: racer.id, mesh, velocity: direction.multiplyScalar(Math.max(speed, racer.speed + 12)).addScaledVector(right, side * 10), life, kind, color, bounces: kind === 'star' ? 2 : 0, target: aimedTarget });
    if (kind !== 'dragonfire') this.makePulse(mesh.position, color, 0.35, 1.6);
    if (playSound) {
      const sound = kind === 'dragonfire' || kind === 'curse' ? 'fire'
        : kind === 'wave' ? 'water'
          : kind === 'laser' || kind === 'plasma' ? 'laser'
            : kind === 'cannon' ? 'cannon' : 'shot';
      this.racerSound(sound, racer);
    }
  }

  private dropField(racer: Racer, kind: PowerField['kind'], color: number, radius: number, life: number, back = -2.6) {
    const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
    const position = racer.position.clone().addScaledVector(forward, back);
    const ground = this.track.nearest(position, racer.progress).point.position.y;
    const mesh = new THREE.Group();
    const disk = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
    disk.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.82, 0.14, 6, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    if (kind === 'ice') {
      const width = radius * 0.82;
      const length = radius * 0.64;
      const outline = [
        new THREE.Vector2(-width * 0.84, -length), new THREE.Vector2(-width, -length * 0.42),
        new THREE.Vector2(-width * 0.91, length * 0.62), new THREE.Vector2(-width * 0.69, length),
        new THREE.Vector2(width * 0.79, length), new THREE.Vector2(width, length * 0.34),
        new THREE.Vector2(width * 0.88, -length * 0.72), new THREE.Vector2(width * 0.61, -length),
      ];
      const frostShape = new THREE.Shape(outline);
      const frost = new THREE.Mesh(new THREE.ShapeGeometry(frostShape), new THREE.MeshBasicMaterial({ color: 0x9deaff, transparent: true, opacity: 0.27, depthWrite: false, side: THREE.DoubleSide }));
      frost.rotation.x = -Math.PI / 2;
      mesh.add(frost);
      const edgePoints = outline.map((point) => new THREE.Vector3(point.x, 0.035, -point.y));
      const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edgePoints), new THREE.LineBasicMaterial({ color: 0xc6f5ff, transparent: true, opacity: 0.52, depthWrite: false }));
      mesh.add(edge);
      for (let glint = 0; glint < 5; glint++) {
        const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.8 + glint % 3 * 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide }));
        streak.rotation.x = -Math.PI / 2;
        streak.rotation.z = -0.3;
        streak.position.set((glint - 2) * width * 0.37, 0.045, (glint % 2 ? -1 : 1) * length * 0.36);
        mesh.add(streak);
      }
      for (const side of [-1, 1]) for (const along of [-0.56, 0.56]) {
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52 + (along > 0 ? 0.13 : 0), 5), new THREE.MeshBasicMaterial({ color: 0xd4f8ff, transparent: true, opacity: 0.82, depthWrite: false }));
        crystal.position.set(side * width * 0.91, 0.27, along * length);
        crystal.rotation.z = -side * 0.18;
        mesh.add(crystal);
      }
    } else mesh.add(disk, ring);
    if (kind === 'anchor') {
      disk.material.opacity = 0.55;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.34, 2.7, 10), new THREE.MeshStandardMaterial({ color: 0xa9bbca, metalness: 0.7, roughness: 0.32 }));
      shaft.position.y = 1.4;
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.19, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0xd7e3e6, metalness: 0.65, roughness: 0.3 }));
      hook.rotation.z = Math.PI;
      hook.position.y = 0.42;
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.13, 8, 16), new THREE.MeshStandardMaterial({ color: 0xe6eef2, metalness: 0.65, roughness: 0.27 }));
      crown.position.y = 2.9;
      mesh.add(shaft, hook, crown);
    }
    if (kind === 'star') {
      const shape = new THREE.Shape();
      for (let point = 0; point < 10; point++) {
        const angle = point * Math.PI / 5 - Math.PI / 2;
        const size = point % 2 ? 0.62 : 1.35;
        const x = Math.cos(angle) * size;
        const y = Math.sin(angle) * size;
        if (point === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.08, bevelThickness: 0.06 }), new THREE.MeshBasicMaterial({ color: 0xffdf74, toneMapped: false }));
      star.position.y = 1.45;
      mesh.add(star);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      core.position.set(0, 1.45, 0.25);
      mesh.add(core);
    } else if (kind !== 'ice') for (let shard = 0; shard < 5; shard++) {
      const angle = shard * Math.PI * 2 / 5;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.5, 7), new THREE.MeshBasicMaterial({ color: shard % 2 ? color : 0xffffff, transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide }));
      spike.position.set(Math.cos(angle) * radius * 0.62, 0.64, Math.sin(angle) * radius * 0.62);
      spike.rotation.z = Math.sin(angle) * 0.24;
      mesh.add(spike);
    }
    mesh.position.set(position.x, ground + 0.18, position.z);
    if (kind === 'star') mesh.rotation.y = racer.yaw + Math.PI;
    if (kind === 'ice') mesh.rotation.y = racer.yaw;
    this.scene.add(mesh);
    this.powerFields.push({ owner: racer.id, kind, mesh, life, radius, victims: new Set() });
    if (this.powerFields.length > 90) {
      const old = this.powerFields.shift()!;
      this.scene.remove(old.mesh);
      disposeTransient(old.mesh);
    }
  }

  private pushWave(racer: Racer, radius: number, color: number) {
    const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
    this.makePulse(racer.position.clone().addScaledVector(forward, 4), color, 0.6, radius / 2);
    for (const other of this.racers) {
      if (other.id === racer.id || other.ultimateTime > 0 || other.hitCooldown > 0) continue;
      const offset = other.position.clone().sub(racer.position);
      if (offset.length() > radius || offset.dot(forward) < 0) continue;
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const side = Math.sign(offset.dot(right)) || 1;
      other.position.addScaledVector(right, side * 3.8);
      other.speed *= 0.68;
      other.wobbleTime = Math.max(other.wobbleTime, 0.9);
      other.hitCooldown = Math.max(other.hitCooldown, 0.55);
      this.burst(other.position.clone().add(new THREE.Vector3(0, 1.4, 0)), color, 0xffffff, 12);
      racer.ultimateMeter = Math.min(100, racer.ultimateMeter + 5);
    }
  }

  private updatePowerFields(dt: number) {
    for (let i = this.powerFields.length - 1; i >= 0; i--) {
      const field = this.powerFields[i];
      field.life -= dt;
      if (field.kind !== 'ice') field.mesh.rotation.y += dt * (field.kind === 'anchor' ? 0.2 : field.kind === 'star' ? 0.7 : 1.3);
      field.mesh.scale.setScalar(0.9 + Math.sin(this.elapsed * 5 + i) * 0.06);
      for (const racer of this.racers) {
        if (racer.id === field.owner && field.kind === 'ice' && racer.character === 'elsa') {
          if (Math.abs(racer.position.y - field.mesh.position.y) <= 3 && Math.hypot(racer.position.x - field.mesh.position.x, racer.position.z - field.mesh.position.z) <= field.radius + 1) {
            racer.iceSpeedTime = Math.max(racer.iceSpeedTime, 0.45);
          }
          continue;
        }
        if (racer.id === field.owner || racer.ultimateTime > 0 || racer.hitCooldown > 0 || field.victims.has(racer.id)) continue;
        if (Math.abs(racer.position.y - field.mesh.position.y) > 3) continue;
        if (Math.hypot(racer.position.x - field.mesh.position.x, racer.position.z - field.mesh.position.z) > field.radius + 1) continue;
        field.victims.add(racer.id);
        if (field.kind === 'ice') {
          racer.wobbleTime = Math.max(racer.wobbleTime, racer.character === 'elsa' ? 0.3 : 1.6);
          racer.speed *= 0.82;
          this.racerSound('ice', racer);
        } else if (field.kind === 'soul') {
          racer.wobbleTime = Math.max(racer.wobbleTime, 1.25);
          racer.hauntedTime = Math.max(racer.hauntedTime, 1.8);
          racer.speed *= 0.73;
        } else if (field.kind === 'star') {
          this.stun(racer, 0.7);
          this.burst(racer.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xffdd6e, 0xffffff, 18);
        } else if (field.kind === 'clock') {
          racer.curseTime = Math.max(racer.curseTime, 3.2);
          racer.speed *= 0.52;
          this.makePulse(racer.position, 0xd5a2ff, 0.5, 3);
        } else if (field.kind === 'anchor') {
          const away = racer.position.clone().sub(field.mesh.position).setY(0).normalize();
          racer.position.addScaledVector(away, 3);
          racer.speed *= 0.35;
          this.stun(racer, 0.55);
        } else this.stun(racer, 0.7);
        if (field.kind !== 'ice') {
          const fieldSound = ({ soul: 'field-soul', star: 'field-star', dragonfire: 'field-fire', clock: 'field-clock', anchor: 'field-anchor' } as const)[field.kind];
          this.racerSound(fieldSound, racer);
        }
        racer.hitCooldown = Math.max(racer.hitCooldown, 0.75);
        this.makeFlash(racer.position.clone().add(new THREE.Vector3(0, 1, 0)), field.kind === 'ice' ? 0xa5f4ff : field.kind === 'star' ? 0xffd978 : 0x87a4ff, 3.5, 0.32);
        const owner = this.racers[field.owner];
        owner.ultimateMeter = Math.min(100, owner.ultimateMeter + 5);
      }
      if (field.life <= 0) { this.scene.remove(field.mesh); disposeTransient(field.mesh); this.powerFields.splice(i, 1); }
    }
  }

  private makePulse(position: THREE.Vector3, color = 0x72ddf5, duration = 0.75, growth = 3.8) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(2, 0.13, 5, 32), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y += 0.5;
    this.scene.add(mesh);
    this.pulses.push({ mesh, age: 0, duration, growth });
  }

  private makeFlash(position: THREE.Vector3, color: number, size = 3.5, duration = 0.34) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture, color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sprite.position.copy(position);
    sprite.scale.set(size, size, 1);
    this.scene.add(sprite);
    this.flashes.push({ sprite, age: 0, duration, size });
  }

  private burst(position: THREE.Vector3, first: number, second: number, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      const velocity = new THREE.Vector3(Math.sin(angle) * speed, (Math.random() - 0.15) * speed, Math.cos(angle) * speed);
      this.sparks.spawn(position, velocity, i % 2 ? first : second, 0.28 + Math.random() * 0.3);
    }
  }

  private spawnDashDragon(racer: Racer) {
    const group = new THREE.Group();
    const body = new THREE.MeshBasicMaterial({ color: 0x5df9db, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const glow = new THREE.MeshBasicMaterial({ color: 0xf4ffca, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.15, 0.85, -1.35), new THREE.Vector3(-1.55, 1.15, -0.3),
      new THREE.Vector3(-0.75, 1.7, 0.65), new THREE.Vector3(0.65, 1.92, 1.13),
      new THREE.Vector3(1.22, 2.25, 1.85),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.16, 7, false), body));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), glow);
    head.position.set(1.22, 2.25, 1.88);
    head.scale.set(1.03, 0.74, 1.3);
    group.add(head);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.72, 9), glow);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(1.28, 2.17, 2.35);
    group.add(snout);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.52, 7), glow);
      horn.position.set(1.22 + side * 0.19, 2.56, 1.6);
      horn.rotation.z = side * 0.38;
      group.add(horn);
    }
    group.position.copy(racer.position);
    group.rotation.y = racer.yaw;
    this.scene.add(group);
    this.dashDragons.push({ group, racerId: racer.id, age: 0, duration: 0.76, materials: [body, glow] });
  }

  private updateDashDragons(dt: number) {
    for (let i = this.dashDragons.length - 1; i >= 0; i--) {
      const dragon = this.dashDragons[i];
      dragon.age += dt;
      const racer = this.racers[dragon.racerId];
      dragon.group.position.copy(racer.position);
      dragon.group.rotation.y = racer.yaw + dragon.age * 6;
      dragon.group.scale.setScalar(0.85 + Math.sin(dragon.age * 8) * 0.12);
      const fade = Math.min(1, (dragon.duration - dragon.age) / 0.23);
      dragon.materials[0].opacity = 0.75 * Math.max(0, fade);
      dragon.materials[1].opacity = 0.88 * Math.max(0, fade);
      if (dragon.age >= dragon.duration) {
        this.scene.remove(dragon.group);
        disposeTransient(dragon.group);
        this.dashDragons.splice(i, 1);
      }
    }
  }

  private frame(now: number) {
    const frameMs = now - this.lastFrame;
    const dt = clamp(frameMs / 1000, 0, 0.033);
    this.lastFrame = now;
    if (frameMs > 0) this.smoothedFps += (Math.min(120, 1000 / frameMs) - this.smoothedFps) * 0.05;
    hud.dataset.fps = String(Math.round(this.smoothedFps));
    const audioStatus = this.audio.getStatus();
    hud.dataset.audioState = audioStatus.context;
    hud.dataset.audioSamples = `${audioStatus.samplesLoaded}/${audioStatus.samplesExpected}`;
    hud.dataset.audioLoops = audioStatus.loops.join(',');
    hud.dataset.audioBoost = String(audioStatus.boostActive);
    hud.dataset.audioDriftCues = `${audioStatus.driftCueCount}/${audioStatus.lastDriftCue}`;
    hud.dataset.audioRivals = `${audioStatus.rivalsAudible}/${audioStatus.rivalVoices}`;
    hud.dataset.audioUfo = String(audioStatus.ufoDrone);
    hud.dataset.audioUfoTheme = String(audioStatus.ufoTheme);
    hud.dataset.audioMusic = audioStatus.musicPhase;
    hud.dataset.audioMix = `${Math.round(audioStatus.musicLevel * 100)}/${Math.round(audioStatus.effectsLevel * 100)}`;
    if (this.mode !== 'paused') this.elapsed += dt;
    if (this.mode === 'menu') this.showcase.update(dt);
    this.syncGamepad();
    if (this.mode === 'countdown') this.updateCountdown(dt);
    if (this.mode === 'race') { this.lapClock += dt; this.raceClock += dt; this.updateRace(dt); }
    const ultimateAtmosphere = this.mode === 'race' ? this.ufo.active ? 'ufo' : this.racers.some((racer) => racer.ultimateTime > 0) ? 'ultimate' : 'none' : 'none';
    if (this.mode !== 'paused') {
      const targetStorm = ultimateAtmosphere === 'ufo' ? 1 : 0;
      const nextStorm = this.stormBlend + (targetStorm - this.stormBlend) * (1 - Math.exp(-dt * (targetStorm ? 0.48 : 1.25)));
      if (Math.abs(nextStorm - this.stormBlend) > 0.001) this.setStorm(nextStorm);
      atmosphereShade.classList.toggle('siren', this.ufo.active && this.ufo.elapsed < STITCH_UFO_INBOUND_DURATION);
      const targetAmbient = ultimateAtmosphere === 'ultimate' ? 1 : 0;
      this.ambientUltBlend += (targetAmbient - this.ambientUltBlend) * (1 - Math.exp(-dt * (targetAmbient ? 3 : 1.8)));
      this.sunlight.intensity = 2.15 - this.stormBlend * 1.03 - this.ambientUltBlend * 0.19;
      atmosphereShade.style.opacity = String(Math.min(0.5, this.stormBlend * 0.4 + this.ambientUltBlend * 0.16));
    }
    if (this.mode === 'race' && !countdown.classList.contains('hidden')) {
      this.countdownElapsed += dt;
      if (this.countdownElapsed > 3.75) countdown.classList.add('hidden');
    }
    if (this.mode !== 'paused') {
      this.track.update(this.elapsed, dt, this.mode === 'race' ? this.racers.map((racer) => racer.position) : []);
      if (this.mode === 'race' && this.track.birdLaunches > 0 && this.elapsed - this.lastBirdSound > 2 && this.track.zone(this.racers[0].progress) === 'ROOFTOP RUN') {
        this.audio.play('birds');
        this.lastBirdSound = this.elapsed;
      }
      if (this.mode === 'race' && marketCartState(this.elapsed).warning) {
        const cycle = Math.floor(this.elapsed / 9);
        const progressGap = Math.abs(this.racers[0].progress - MARKET_CROSSING_PROGRESS);
        if (cycle !== this.lastCartWarningCycle && Math.min(progressGap, 1 - progressGap) < 0.07) {
          this.audio.play('cart-warning');
          this.showBanner('CART CROSSING AHEAD!', 1.35);
          this.lastCartWarningCycle = cycle;
        }
      }
      this.updatePickups(dt);
      this.updateCamera(dt);
      this.sparks.update(dt);
      this.updatePulses(dt);
      this.updateFlashes(dt);
      this.updateDashDragons(dt);
      this.audio.setListener(this.racers[0].position.x, this.racers[0].position.y, this.racers[0].position.z, this.racers[0].yaw);
      const themeRacer = this.racers.find((racer) => racer.id === 0 && racer.ultimateTime > 0 && racer.character !== 'stitch')
        ?? this.racers.find((racer) => racer.ultimateTime > 0 && racer.character !== 'stitch');
      this.audio.update(this.racers[0].speed, this.racers[0].drifting, this.racers[0].ultimateTime > 0, this.racers[0].boostTime > 0, this.mode === 'race', this.track.zone(this.racers[0].progress), this.racers[0].lap >= 3, this.track.fountainPosition, ultimateAtmosphere, this.ufo.elapsed, themeRacer?.character ?? null, themeRacer ? PLUTO_ULTIMATE_DURATION - themeRacer.ultimateTime : 0);
      this.audio.updateRivals(this.racers, this.mode === 'race');
      if (this.stitchIntroTime > 0) {
        this.stitchIntroTime -= dt;
        if (this.stitchIntroTime <= 0) stitchIntro.classList.add('hidden');
      }
      if (this.announcementTime > 0) {
        this.announcementTime -= dt;
        if (this.announcementTime <= 0) ultimateAnnouncement.classList.add('hidden');
      }
      if (this.racers[0].ultimateTime <= 0) ultimateVeil.classList.add('hidden');
      if (this.bannerTime > 0) {
        this.bannerTime -= dt;
        if (this.bannerTime <= 0) banner.classList.add('hidden');
      }
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((time) => this.frame(time));
  }

  private updateCountdown(dt: number) {
    this.countdownElapsed += dt;
    const remaining = 3 - Math.floor(this.countdownElapsed);
    if (remaining > 0 && remaining !== this.countShown) {
      this.countShown = remaining;
      countdown.textContent = String(remaining);
      this.audio.playCountdown(remaining);
    }
    if (this.countdownElapsed >= 3 && this.mode === 'countdown') {
      countdown.textContent = 'GO!';
      this.audio.play('go');
      this.audio.beginRaceMusic();
      this.mode = 'race';
      this.racers[0].boostTime = this.keys.has('KeyW') ? 0.9 : 0;
      this.showBanner('DRIFT · RELEASE FOR BOOST', 2.3);
    }
    if (this.countdownElapsed > 3.75) countdown.classList.add('hidden');
  }

  private updateRace(dt: number) {
    for (const racer of this.racers) racer.previousPosition.copy(racer.position);
    if (this.wishHolding) {
      this.wishElapsed += dt;
      const newIndex = Math.floor(this.wishElapsed / 0.32) % 3;
      if (newIndex !== this.wishIndex) {
        this.wishIndex = newIndex;
        this.updateWishPicker();
        this.audio.play('wish');
      }
    }
    if (this.laserLocking) {
      this.laserLockElapsed += dt;
      const player = this.racers[0];
      const target = this.findLaserTarget(player);
      const locked = this.laserLockElapsed >= (player.laserReadyTime > 0 ? 0.2 : 0.33) ? target?.id ?? -1 : -1;
      if (locked >= 0 && locked !== this.laserLockTarget) {
        this.makePulse(this.racers[locked].position, 0xb4ff67, 0.34, 2.4);
        this.audio.play('wish');
      }
      this.laserLockTarget = locked;
    }
    if (this.demoMode && !this.debugDrive) this.updateAI(this.racers[0], dt);
    else this.updatePlayer(dt);
    for (let i = 1; i < this.racers.length; i++) this.updateAI(this.racers[i], dt);
    this.updatePlasmaVolleys(dt);
    this.updateSlipstreams(dt);
    for (const racer of this.racers) this.updateRacerTimers(racer, dt);
    this.updatePowerFields(dt);
    this.checkRacerCollisions();
    this.checkObstacleCollisions();
    const projectileKnockback = this.updateProjectiles(dt);
    this.updateStitchUfo(dt);
    this.updatePluto(dt);
    // Racer bumps and powers can move karts after their individual road checks.
    for (const racer of this.racers) this.keepOnCourse(racer);
    if (projectileKnockback) this.checkObstacleCollisions();
    // Wall and obstacle pushes can re-overlap a pack after its first bump.
    // The first pass applies effects to new contacts; later passes only relax geometry.
    for (let pass = 0; pass < 5; pass++) {
      const racerContact = this.checkRacerCollisions(pass === 0);
      const obstacleContact = this.checkObstacleCollisions(pass === 0);
      let railContact = false;
      for (const racer of this.racers) {
        const x = racer.position.x;
        const z = racer.position.z;
        this.keepOnCourse(racer);
        railContact ||= Math.hypot(racer.position.x - x, racer.position.z - z) > 0.01;
      }
      if (!racerContact && !obstacleContact && !railContact) break;
    }
    this.emitMagicTrails();
    for (const racer of this.racers) {
      racer.visual.group.position.copy(racer.position);
      racer.visual.group.rotation.y = racer.yaw;
      racer.itemOrbit.visible = racer.tripleSparks > 0 && (racer.id === 0 || racer.fogTime <= 0);
      if (racer.tripleSparks > 0) {
        racer.itemOrbit.position.copy(racer.position).add(new THREE.Vector3(0, 1.55, 0));
        racer.itemOrbit.rotation.y += dt * 3.4;
        racer.itemOrbit.children.forEach((orb, index) => { orb.visible = index < racer.tripleSparks; });
      }
      racer.visual.group.rotation.z = racer.trickAnim > 0 ? Math.sin((1 - racer.trickAnim / 0.65) * Math.PI) * 0.24 : 0;
      racer.visual.setGroundOffset(this.track.nearest(racer.position, racer.progress).point.position.y - racer.position.y);
      racer.visual.setShield(racer.shieldTime > 0 && racer.ultimateTime <= 0);
      racer.visual.setOceanBarrier?.(racer.oceanBarrierTime > 0);
      racer.visual.setUltimate(racer.ultimateTime > 0 && racer.character !== 'stitch' && racer.character !== 'mickey');
      if (racer.character === 'mickey') {
        racer.visual.setPlutoPresent?.(!(this.pluto.active && this.pluto.owner === racer.id));
        racer.visual.setGlider?.(racer.jumpTime > 0 && racer.jumpPower > 2);
      }
      racer.visual.setStunned(racer.stunTime > 0);
      racer.visual.update(dt, racer.speed, racer.steerVisual, racer.drifting, racer.boostTime > 0, racer.stunTime > 0);
    }
    this.updateHUD();
    this.drawMinimap();
  }

  private updatePlayer(dt: number) {
    const player = this.racers[0];
    const chargeScript = this.debugDrive === 'charge';
    const keyProbe = this.debugDrive === 'keys';
    const scriptedTurn = this.debugDrive && !keyProbe && this.raceClock >= 2.2 && this.raceClock < (chargeScript ? 4.25 : 2.75);
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.touch.has('left');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.touch.has('right');
    const accel = this.debugDrive || this.keys.has('KeyW') || this.touch.has('accel') ? 1 : this.gamepadAccel;
    const brake = !this.debugDrive && this.keys.has('KeyS') ? 1 : this.gamepadBrake;
    const scriptedSteer = scriptedTurn ? chargeScript
      ? this.raceClock < 2.55 ? 0.3 : this.raceClock < 3.1 ? -0.22 : this.raceClock < 3.7 ? 0.22 : -0.22
      : 1 : 0;
    const steer = this.debugDrive && !keyProbe ? scriptedSteer : screenSteer(left, right, this.gamepadSteer);
    const driftPressed = this.debugDrive && !keyProbe ? (this.debugDrive === 'corner' || chargeScript) && scriptedTurn : this.keys.has('Space') || this.touch.has('drift') || this.gamepadDrift;
    player.steerVisual = steer;
    if (player.stunTime > 0) {
      player.speed = 0;
      player.yawRate = 0;
      return;
    }
    const roadBefore = this.track.nearest(player.position, player.progress);
    const offRoad = !roadBefore.onRoad && player.jumpTime <= 0;
    const stats = CHARACTER_BY_ID[player.character];
    const iceGrip = player.iceSpeedTime > 0 && !offRoad;
    const stitchRampage = player.character === 'stitch' && player.ultimateTime > 0;
    const maxSpeed = raceSpeed(player.padBoostTime > 0 ? 53 : player.ultimateTime > 0 && !stitchRampage ? 43 : player.boostTime > 0 ? 40 : offRoad && player.featherTime <= 0 ? 20 : iceGrip ? 34 : 31) * stats.speed * (stitchRampage ? 1.05 : 1);
    const carriedOverspeed = player.speed > maxSpeed;
    if (accel > 0 && !carriedOverspeed) player.speed += raceSpeed(player.padBoostTime > 0 ? 32 : player.ultimateTime > 0 && !stitchRampage ? 28 : iceGrip ? 22 : 19) * (player.curseTime > 0 ? 0.52 : 1) * (player.hotHeadTime > 0 ? 1.45 : 1) * stats.acceleration * accel * dt;
    else player.speed += player.speed > 0 ? -Math.min(player.speed, 5.3 * dt) : Math.min(-player.speed, 5.3 * dt);
    if (brake > 0) player.speed -= 29 * brake * dt;
    if (player.boostTime > 0) player.speed += raceSpeed(11) * dt;
    player.speed = Math.max(-raceSpeed(8), player.speed);
    if (player.speed > maxSpeed) {
      const excess = player.speed - maxSpeed;
      player.speed = carriedOverspeed ? player.speed - Math.min(excess, (10 + excess * 0.7) * dt) : maxSpeed;
    }

    if (driftPressed && player.speed > 10 && (player.drifting || Math.abs(steer) > 0.18)) {
      if (!player.drifting) {
        player.drifting = true;
        player.driftDirection = Math.sign(steer);
        this.startJump(player, 0.19, 0.24);
        this.audio.play('drift');
      }
      if (Math.abs(steer) > 0.18) {
        const oldStage = driftBoostStage(player.driftCharge);
        player.driftCharge += dt;
        const newStage = driftBoostStage(player.driftCharge);
        if (newStage > oldStage && newStage !== 0) this.audio.playDriftCharge(newStage);
      }
    } else if (player.drifting) {
      this.releaseDrift(player);
    }
    const boostHandling = player.padBoostTime > 0 ? 1.2 : player.ultimateTime > 0 ? 1.12 : 1;
    const heading = advanceHeading(player, { steer, speed: player.speed, handling: stats.handling * (player.wobbleTime > 0 ? 0.62 : 1), drifting: player.drifting, driftDirection: player.driftDirection,
      boostHandling, wobble: player.wobbleTime > 0 ? Math.sin(this.elapsed * 19) * 0.22 : 0, dt });
    player.yawRate = heading.yawRate;
    player.yaw = heading.yaw;
    player.moveYaw = heading.moveYaw;
    player.position.x += Math.sin(player.moveYaw) * player.speed * dt;
    player.position.z += Math.cos(player.moveYaw) * player.speed * dt;
    this.followRoadHeight(player, dt);
    const road = this.keepOnCourse(player, dt);
    this.updateProgress(player, road.point.progress);
    if (road.onRoad || player.jumpTime > 0) {
      player.offTrackTime = 0;
      if (player.jumpTime <= 0) {
        player.lastSafe.copy(road.point.position).addScaledVector(road.point.tangent, 2);
        player.lastSafeProgress = road.point.progress;
      }
    } else {
      player.offTrackTime += dt;
      if (player.featherTime <= 0 && (player.ultimateTime <= 0 || player.character !== 'moana')) player.speed = Math.min(player.speed, raceSpeed(20));
      if (road.distance > road.point.width / 2 + 14 || player.offTrackTime > 2.2) this.respawn(player);
    }
    if (player.drifting && Math.abs(steer) > 0.15 && player.speed > 12) {
      this.driftSparksTimer -= dt;
      if (this.driftSparksTimer <= 0) {
        this.driftSparksTimer = 0.04;
        this.emitDriftSparks(player);
      }
    }
    this.checkPads(player);
  }

  private updateAI(racer: Racer, dt: number) {
    if (racer.stunTime > 0) { racer.speed = 0; racer.drifting = false; racer.driftDirection = 0; racer.driftCharge = 0; return; }
    const ahead = wrap(racer.progress + Math.max(0.014, racer.speed * (racer.padBoostTime > 0 ? 1.05 : 0.75) / this.track.length));
    let route: RouteName = 'main';
    if (racer.aiRoute === 'alley' && ahead > 0.045 && ahead < 0.16) route = 'alley';
    if (racer.aiRoute === 'roof' && ahead > 0.19 && ahead < 0.33) route = 'roof';
    if (racer.aiRoute === 'garden' && ahead > 0.37 && ahead < GARDEN_ROUTE_END) route = 'garden';
    const roadUnderKart = this.track.nearest(racer.position, racer.progress);
    if (roadUnderKart.onRoad && roadUnderKart.point.route !== 'main') route = roadUnderKart.point.route;
    const target = this.track.routeAt(route, ahead);
    const currentTangent = this.track.routeAt(route, racer.progress).tangent;
    const bend = target.tangent.dot(new THREE.Vector3(-currentTangent.z, 0, currentTangent.x));
    if (Math.abs(bend) > 0.2 && racer.speed > 17) {
      if (!racer.drifting) {
        racer.drifting = true;
        this.startJump(racer, 0.19, 0.24);
      }
      racer.driftCharge += dt;
      if (Math.random() < dt * 12) this.emitDriftSparks(racer);
    } else if (racer.drifting) {
      this.releaseDrift(racer);
    }
    const laneLimit = target.width / 2 - 2.6;
    let desiredLane = clamp(racer.aiLane + clamp(bend * 4, -2.4, 2.4), -laneLimit, laneLimit);
    if (route !== 'main' || racer.id === 0 || (racer.id + racer.lap) % 3 !== 0) {
      for (const pad of BOOST_PAD_LAYOUT) {
        if (pad.route !== route || !pad.width) continue;
        const distance = wrap(pad.progress - racer.progress) * this.track.length;
        if (distance > 80) continue;
        desiredLane += (pad.lateral! - desiredLane) * clamp((80 - distance) / 40, 0, 1);
      }
    }
    let closestHazard = Infinity;
    let hazardLane = 0;
    let hazardRadius = 0;
    for (const obstacle of this.track.obstacles) {
      if (obstacle.broken || obstacle.route !== route || Math.abs(obstacle.position.y - racer.position.y) > 3.3) continue;
      const distance = wrap(obstacle.progress - racer.progress) * this.track.length;
      if (distance > 55 || distance >= closestHazard) continue;
      const obstaclePoint = this.track.routeAt(route, obstacle.progress);
      const predictedLane = obstacle.kind === 'cart' && Math.abs(obstacle.progress - MARKET_CROSSING_PROGRESS) < 0.005
        ? marketCartState(this.elapsed + distance / Math.max(18, racer.speed)).lateral * MARKET_CROSSING_TRAVEL
        : obstacle.position.clone().sub(obstaclePoint.position).dot(obstaclePoint.right);
      if (Math.abs(predictedLane) > obstaclePoint.width / 2 + obstacle.radius) continue;
      closestHazard = distance;
      hazardLane = predictedLane;
      hazardRadius = obstacle.radius;
    }
    const clearance = hazardRadius + 4.4;
    if (closestHazard < Infinity && Math.abs(desiredLane - hazardLane) < clearance) {
      const options = [hazardLane - clearance, hazardLane + clearance].filter((lane) => Math.abs(lane) <= laneLimit);
      if (options.length) {
        desiredLane = options.sort((a, b) => Math.abs(a - desiredLane) + Math.abs(a - racer.aiLine) * 0.2 - Math.abs(b - desiredLane) - Math.abs(b - racer.aiLine) * 0.2)[0];
      }
    }
    const ufoThreat = this.ufo.getLockedThreat(racer.id);
    if (ufoThreat && Math.hypot(ufoThreat.x - racer.position.x, ufoThreat.z - racer.position.z) < 48) {
      const dangerLane = ufoThreat.clone().sub(target.position).dot(target.right);
      if (Math.abs(desiredLane - dangerLane) < 7.5) desiredLane = clamp(dangerLane + (desiredLane < dangerLane ? -9 : 9), -laneLimit, laneLimit);
    }
    const plutoLane = this.pluto.avoidLane(racer, route);
    if (plutoLane !== null && racer.id !== this.pluto.owner) desiredLane = clamp(plutoLane, -laneLimit, laneLimit);
    racer.aiLine += clamp(desiredLane - racer.aiLine, -dt * 14, dt * 14);
    const direction = target.position.clone().addScaledVector(target.right, racer.aiLine).sub(racer.position);
    const targetYaw = Math.atan2(direction.x, direction.z);
    const error = angleDiff(targetYaw, racer.yaw);
    const steer = clamp(error * 2.4, -1, 1);
    racer.steerVisual = steer;
    racer.yaw += (steer + (racer.wobbleTime > 0 ? Math.sin(this.elapsed * 17) * 0.2 : 0)) * (1.65 - Math.min(racer.speed / raceSpeed(125), 0.3)) * (racer.drifting ? 1.5 : 1) * (racer.padBoostTime > 0 ? 1.2 : 1) * CHARACTER_BY_ID[racer.character].handling * dt;
    racer.moveYaw += angleDiff(racer.yaw, racer.moveYaw) * Math.min(1, dt * 5);
    let targetSpeed = 27.7 + Math.sin(racer.id * 1.7) * 1.8 + Math.sin(this.elapsed * 0.5 + racer.id) * 1.1;
    if (Math.abs(error) > 0.5) targetSpeed = 22;
    if (racer.boostTime > 0) targetSpeed = racer.ultimateTime > 0 && racer.character !== 'stitch' ? 41 : 37;
    if (racer.padBoostTime > 0) targetSpeed = 49;
    if (racer.ultimateTime > 0) targetSpeed = racer.character === 'stitch' ? targetSpeed * 1.05 : 41;
    if (racer.iceSpeedTime > 0 && racer.boostTime <= 0 && racer.padBoostTime <= 0 && racer.ultimateTime <= 0) targetSpeed += 3;
    targetSpeed = raceSpeed(targetSpeed) * CHARACTER_BY_ID[racer.character].speed;
    racer.speed += (targetSpeed - racer.speed) * Math.min(1, dt * (targetSpeed > racer.speed ? (racer.curseTime > 0 ? 0.55 : 1.2) * CHARACTER_BY_ID[racer.character].acceleration : 2.2));
    racer.position.x += Math.sin(racer.moveYaw) * racer.speed * dt;
    racer.position.z += Math.cos(racer.moveYaw) * racer.speed * dt;
    this.followRoadHeight(racer, dt);
    const road = this.keepOnCourse(racer, dt);
    this.updateProgress(racer, road.point.progress);
    if (!road.onRoad && racer.jumpTime <= 0) {
      racer.position.addScaledVector(road.point.position.clone().sub(racer.position), Math.min(1, dt * 2));
    }
    racer.aiAbilityTimer -= dt;
    if (racer.trickReady && !racer.trickBoost && racer.jumpDuration > 0 && racer.jumpTime / racer.jumpDuration < 0.62) this.performTrick(racer);
    if (racer.aiAbilityTimer <= 0) {
      racer.aiAbilityTimer = 4 + Math.random() * 4;
      if (!(this.plutoPreview && racer.id === 0)) {
        this.useSignature(racer);
        if ((racer.item || racer.tripleSparks > 0) && Math.random() < 0.55) this.useItem(racer);
      }
    }
    racer.aiUltimateTimer -= dt;
    if (racer.aiUltimateTimer <= 0 && racer.ultimateMeter >= 100 && !this.racers.some((other) => other.ultimateTime > 0) && !this.ufo.active && !this.pluto.active) {
      racer.aiUltimateTimer = 15 + Math.random() * 8;
      this.activateUltimate(racer);
    }
    this.checkPads(racer);
  }

  private followRoadHeight(racer: Racer, dt: number) {
    const road = this.track.nearest(racer.position, racer.progress);
    let jump = 0;
    if (racer.jumpTime > 0) {
      const wasAirborne = racer.jumpTime;
      racer.jumpTime = Math.max(0, racer.jumpTime - dt);
      const phase = 1 - racer.jumpTime / racer.jumpDuration;
      jump = Math.sin(Math.PI * phase) * racer.jumpPower;
      if (wasAirborne > 0 && racer.jumpTime === 0) {
        racer.trickReady = false;
        if (racer.trickBoost) {
          racer.tricksLanded++;
          racer.boostTime = Math.max(racer.boostTime, 1.35);
          racer.speed = Math.max(racer.speed, raceSpeed(38));
          racer.ultimateMeter = Math.min(100, racer.ultimateMeter + 8);
          this.makePulse(racer.position, CHARACTER_BY_ID[racer.character].accent, 0.4, 3.5);
          this.burst(racer.position.clone().add(new THREE.Vector3(0, 0.8, 0)), CHARACTER_BY_ID[racer.character].accent, 0xffffff, 22);
          if (racer.id === 0) { this.showBanner('TRICK LANDING BOOST!', 1.1); this.audio.play('boost'); }
          racer.trickBoost = false;
        }
      }
    }
    const targetHeight = road.point.position.y + jump + 0.12;
    racer.position.y += (targetHeight - racer.position.y) * Math.min(1, dt * 12);
  }

  private keepOnCourse(racer: Racer, dt = 0): RoadHit {
    const road = this.track.nearest(racer.position, racer.progress);
    if (road.distance > Math.max(28, road.point.width / 2 + 7)) {
      this.respawn(racer);
      return this.track.nearest(racer.position, racer.progress);
    }
    const limit = Math.max(1, road.point.width / 2 - 1.55);
    const excess = Math.abs(road.lateral) - limit;
    if (excess > 0) {
      racer.position.addScaledVector(road.point.right, -Math.sign(road.lateral) * excess);
      racer.speed = railScrapeSpeed(racer.speed, excess, dt);
      const heading = slideHeadingAlongRail(racer, racer.speed, road.lateral, road.point.right, road.point.tangent, dt);
      if (heading !== racer) {
        racer.yaw = heading.yaw;
        racer.moveYaw = heading.moveYaw;
        racer.yawRate = heading.yawRate;
      }
      if (racer.drifting && excess > 0.8) {
        racer.drifting = false;
        racer.driftDirection = 0;
        racer.driftCharge = 0;
      }
    }
    return this.track.nearest(racer.position, racer.progress);
  }

  private startJump(racer: Racer, duration: number, power: number) {
    racer.jumpTime = duration;
    racer.jumpDuration = duration;
    racer.jumpPower = power;
    if (duration >= 0.65) { racer.trickReady = true; racer.trickBoost = false; }
  }

  private performTrick(racer: Racer) {
    if (!racer.trickReady || racer.trickBoost || racer.jumpDuration <= 0) return;
    const phase = 1 - racer.jumpTime / racer.jumpDuration;
    if (phase < 0.14 || phase > 0.85) return;
    racer.trickBoost = true;
    racer.trickAnim = 0.65;
    const color = CHARACTER_BY_ID[racer.character].accent;
    this.makeFlash(racer.position.clone().add(new THREE.Vector3(0, 1.7, 0)), color, 5.5, 0.35);
    this.burst(racer.position.clone().add(new THREE.Vector3(0, 1.2, 0)), color, 0xffffff, 18);
    if (racer.id === 0) { this.showBanner('AIR TRICK!', 0.8); this.audio.play('trick'); }
  }

  private updateSlipstreams(dt: number) {
    for (const racer of this.racers) {
      if (racer.slipCooldown > 0 || racer.speed < 15 || racer.stunTime > 0) { racer.slipCharge = Math.max(0, racer.slipCharge - dt * 2); continue; }
      const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const drafting = this.racers.some((other) => {
        if (other.id === racer.id || other.speed < 14 || Math.abs(other.position.y - racer.position.y) > 2.6) return false;
        const gap = other.position.clone().sub(racer.position);
        return gap.dot(forward) > 3 && gap.dot(forward) < 24 && Math.abs(gap.dot(right)) < 4.3;
      });
      racer.slipCharge = Math.max(0, racer.slipCharge + (drafting ? dt : -dt * 1.7));
      if (drafting && Math.random() < dt * 24) {
        const wake = racer.position.clone().addScaledVector(forward, 3 + Math.random() * 3);
        wake.y += 0.7 + Math.random() * 0.9;
        this.sparks.spawn(wake, forward.clone().multiplyScalar(-6), 0x9beeff, 0.3);
      }
      if (racer.slipCharge >= 1.2) {
        racer.draftBoosts++;
        racer.slipCharge = 0;
        racer.slipCooldown = 5;
        racer.boostTime = Math.max(racer.boostTime, 1.15);
        racer.ultimateMeter = Math.min(100, racer.ultimateMeter + 6);
        this.makePulse(racer.position, 0x9beeff, 0.5, 3);
        if (racer.id === 0) { this.showBanner('SLIPSTREAM BOOST!', 1); this.audio.play('draft'); }
      }
    }
  }

  private releaseDrift(racer: Racer) {
    racer.drifting = false;
    racer.driftDirection = 0;
    const charge = racer.driftCharge;
    racer.driftCharge = 0;
    const stage = driftBoostStage(charge);
    if (stage === 0) return;
    racer.boostTime = Math.max(racer.boostTime, [0, 0.65, 1.2, 1.8][stage] * (racer.character === 'mulan' ? 1.28 : 1));
    racer.ultimateMeter = Math.min(100, racer.ultimateMeter + 8 + stage * 5);
    const stats = CHARACTER_BY_ID[racer.character];
    const speedCap = raceSpeed(racer.padBoostTime > 0 ? 53 : racer.ultimateTime > 0 && racer.character !== 'stitch' ? 43 : racer.id === 0 ? 40 : 37) * stats.speed;
    racer.speed = Math.max(racer.speed, Math.min(speedCap, racer.speed + raceSpeed([0, 3.3, 5.2, 7.3][stage]) * stats.speed));
    const color = [0, 0x61d8ff, 0xffc866, 0xd799ff][stage];
    this.makePulse(racer.position, color, 0.4, 2.3 + stage * 0.7);
    if (racer.id === 0) {
      this.showBanner(['', 'BLUE DRIFT BOOST', 'GOLD DRIFT BOOST', 'COSMIC DRIFT BOOST'][stage], 0.95);
      this.makeFlash(racer.position.clone().add(new THREE.Vector3(0, 1.3, 0)), color, 3.2 + stage * 0.9, 0.25);
      this.burst(racer.position.clone().add(new THREE.Vector3(0, 0.65, 0)), color, 0xffffff, 5 + stage * 4);
      this.camera.fov = Math.min(82, this.camera.fov + stage * 1.35);
      this.camera.updateProjectionMatrix();
      this.audio.playDriftBoost(stage);
    }
  }

  private emitDriftSparks(racer: Racer) {
    const right = new THREE.Vector3(Math.cos(racer.yaw), 0, -Math.sin(racer.yaw));
    const back = new THREE.Vector3(-Math.sin(racer.yaw), 0, -Math.cos(racer.yaw));
    const color = driftBoostStage(racer.driftCharge) === 3 ? 0xd799ff : driftBoostStage(racer.driftCharge) === 2 ? 0xffc866 : 0x61d8ff;
    for (const side of [-1, 1]) {
      const origin = racer.position.clone().addScaledVector(right, side * 1.5).addScaledVector(back, 1.2);
      origin.y += 0.3;
      for (let i = 0; i < 2; i++) {
        const velocity = back.clone().multiplyScalar(5 + Math.random() * 4).addScaledVector(right, side * (1 + Math.random() * 3));
        velocity.y = 2 + Math.random() * 3;
        this.sparks.spawn(origin, velocity, color, 0.25 + Math.random() * 0.2);
      }
    }
  }

  private emitMagicTrails() {
    const tick = Math.floor(this.elapsed * 22);
    if (tick === this.lastMagicTrailTick) return;
    this.lastMagicTrailTick = tick;
    for (const racer of this.racers) {
      if (racer.boostTime <= 0 && racer.ultimateTime <= 0 && racer.fogTime <= 0 && racer.featherTime <= 0 && racer.tripleSparks <= 0 && racer.curseTime <= 0 && racer.iceSpeedTime <= 0 && racer.hauntedTime <= 0) continue;
      const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
      const side = new THREE.Vector3(Math.cos(racer.yaw), 0, -Math.sin(racer.yaw));
      if (racer.hauntedTime > 0 && tick % 2 === 0) {
        const angle = this.elapsed * 9 + racer.id;
        const ghost = racer.position.clone().add(new THREE.Vector3(Math.cos(angle) * 1.55, 1.15 + Math.sin(angle * 1.7) * 0.42, Math.sin(angle) * 1.55));
        this.sparks.spawn(ghost, new THREE.Vector3(0, 1.2, 0), tick % 4 ? 0x66d7ff : 0xcab6ff, 0.6);
      }
      if (racer.iceSpeedTime > 0 && tick % 2 === 0) {
        for (const lateral of [-1.12, 1.12]) {
          const position = racer.position.clone().addScaledVector(forward, -1.6).addScaledVector(side, lateral);
          position.y += 0.42;
          this.sparks.spawn(position, new THREE.Vector3(-forward.x * 1.8, 0.55 + Math.random() * 0.7, -forward.z * 1.8), tick % 4 ? 0x9ceaff : 0xffffff, 0.38);
        }
      }
      if (racer.curseTime > 0) {
        for (const lateral of [-1.43, 1.43]) {
          const tireFlame = racer.position.clone().addScaledVector(forward, -1.18).addScaledVector(side, lateral);
          tireFlame.y += 0.65;
          this.sparks.spawn(tireFlame, new THREE.Vector3(side.x * lateral * 0.45, 1.8 + Math.random(), side.z * lateral * 0.45), tick % 2 ? 0xa5ff67 : 0x62e968, 0.4);
        }
      }
      if (racer.fogTime > 0 && tick % 3 === 0) {
        for (let n = 0; n < 4; n++) {
          const angle = tick * 0.22 + n * Math.PI / 2;
          const position = racer.position.clone().add(new THREE.Vector3(Math.cos(angle) * 2.2, 0.65 + n * 0.35, Math.sin(angle) * 2.2));
          this.sparks.spawn(position, new THREE.Vector3(0, 0.75, 0), 0xc5b7f2, 0.6);
        }
      }
      if (racer.featherTime > 0 && tick % 4 === 0) this.sparks.spawn(racer.position.clone().add(new THREE.Vector3(Math.sin(tick) * 1.8, 2.2, Math.cos(tick) * 1.8)), new THREE.Vector3(0, 1.2, 0), 0xffe89b, 0.8);
      if (racer.tripleSparks > 0 && tick % 3 === 0) {
        for (let n = 0; n < racer.tripleSparks; n++) {
          const angle = this.elapsed * 4 + n * Math.PI * 2 / racer.tripleSparks;
          this.sparks.spawn(racer.position.clone().add(new THREE.Vector3(Math.cos(angle) * 2.3, 1.4, Math.sin(angle) * 2.3)), new THREE.Vector3(0, 0.2, 0), 0xffbc8c, 0.5);
        }
      }
      if (racer.boostTime <= 0 && racer.ultimateTime <= 0) continue;
      for (const lateral of [-0.82, 0.82]) {
        const position = racer.position.clone().addScaledVector(forward, -2.15).addScaledVector(side, lateral);
        position.y += 0.62;
        const velocity = forward.clone().multiplyScalar(-4 - Math.random() * 3).addScaledVector(side, lateral * 0.7);
        velocity.y = 0.7 + Math.random() * 1.3;
        const def = CHARACTER_BY_ID[racer.character];
        this.sparks.spawn(position, velocity, racer.ultimateTime > 0 && tick % 3 === 0 ? def.accent : def.color, 0.36);
      }
    }
  }

  private checkPads(racer: Racer) {
    if (racer.lastPad > 0) return;
    const route = this.track.nearest(racer.position, racer.progress).point.route;
    for (const pad of this.track.boostPads) {
      if (touchesBoostPad(pad, racer.position, route)) {
        racer.boostTime = Math.max(racer.boostTime, pad.boostSeconds);
        racer.padBoostTime = Math.max(racer.padBoostTime, pad.boostSeconds);
        racer.speed = Math.max(racer.speed, raceSpeed(44));
        racer.lastPad = 1.25;
        racer.ultimateMeter = Math.min(100, racer.ultimateMeter + 6);
        if (racer.character === 'buzz') racer.laserReadyTime = 12;
        this.startJump(racer, 0.7, 1.15);
        this.makePulse(racer.position, 0x6feeff, 0.65, 5.2);
        this.burst(racer.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0x75edff, 0xffd675, 22);
        if (racer.id === 0) { this.showBanner(pad.halfWidth < 8 ? 'APEX CARPET BOOST!' : 'MAGIC CARPET BOOST', 1.1); this.audio.play('pad'); }
        break;
      }
    }
  }

  private updateRacerTimers(racer: Racer, dt: number) {
    if (racer.speed > 10 && racer.ultimateTime <= 0) {
      const route = this.track.nearest(racer.position, racer.progress).point.route;
      racer.ultimateMeter = Math.min(100, racer.ultimateMeter + dt * (0.85 + (route !== 'main' && racer.character === 'moana' ? 0.85 : 0)));
    }
    if (racer.ultimateTime > 0 && racer.character !== 'stitch') this.updateUltimatePower(racer, dt);
    racer.boostTime = Math.max(0, racer.boostTime - dt);
    racer.padBoostTime = Math.max(0, racer.padBoostTime - dt);
    racer.shieldTime = Math.max(0, racer.shieldTime - dt);
    racer.oceanBarrierTime = Math.max(0, racer.oceanBarrierTime - dt);
    racer.mirrorTime = Math.max(0, racer.mirrorTime - dt);
    racer.fogTime = Math.max(0, racer.fogTime - dt);
    racer.featherTime = Math.max(0, racer.featherTime - dt);
    racer.ultimateTime = Math.max(0, racer.ultimateTime - dt);
    racer.signatureCooldown = Math.max(0, racer.signatureCooldown - dt);
    racer.curseTime = Math.max(0, racer.curseTime - dt);
    racer.iceSpeedTime = Math.max(0, racer.iceSpeedTime - dt);
    racer.luckyEscapeCooldown = Math.max(0, racer.luckyEscapeCooldown - dt);
    racer.wobbleTime = Math.max(0, racer.wobbleTime - dt);
    racer.hauntedTime = Math.max(0, racer.hauntedTime - dt);
    racer.hotHeadTime = Math.max(0, racer.hotHeadTime - dt);
    racer.laserReadyTime = Math.max(0, racer.laserReadyTime - dt);
    racer.compassTime = Math.max(0, racer.compassTime - dt);
    if (racer.compassShortcut && wrap(racer.progress - racer.compassShortcut.progress) < 0.012) {
      racer.compassShortcut = null;
      racer.compassTime = 0;
    }
    racer.trickAnim = Math.max(0, racer.trickAnim - dt);
    racer.slipCooldown = Math.max(0, racer.slipCooldown - dt);
    racer.stunTime = Math.max(0, racer.stunTime - dt);
    racer.hitCooldown = Math.max(0, racer.hitCooldown - dt);
    racer.lastPad = Math.max(0, racer.lastPad - dt);
  }

  private updateUltimatePower(racer: Racer, dt: number) {
    racer.powerTick -= dt;
    if (racer.powerTick > 0) return;
    const def = CHARACTER_BY_ID[racer.character];
    const position = racer.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    this.makeFlash(position, def.accent, 3.3, 0.25);
    switch (racer.character) {
      case 'genie': racer.powerTick = 0.95; break;
      case 'mickey': this.makePulse(racer.position, 0xffdb6e, 0.5, 2.3); racer.powerTick = 2.2; break;
      case 'stitch': racer.powerTick = 1; break;
      case 'elsa':
        this.dropField(racer, 'ice', 0xa9f2ff, 4, 5, -2.8);
        for (const other of this.racers) if (other.id !== racer.id && other.position.distanceTo(racer.position) < 9) other.wobbleTime = Math.max(other.wobbleTime, 0.7);
        racer.powerTick = 2.1;
        break;
      case 'moana': this.pushWave(racer, 8, 0x6fece5); racer.powerTick = 2.0; break;
      case 'buzz': this.launchPower(racer, 'laser', 0xa6ff76, 58, 1.25); racer.powerTick = 2.3; break;
      case 'maleficent':
        this.dropField(racer, 'dragonfire', 0xa1f576, 4.5, 6, -3);
        racer.powerTick = 2.2;
        break;
      case 'hades': this.dropField(racer, 'soul', 0x77b6ff, 4.1, 5.2, -2.7); racer.powerTick = 2.1; break;
      case 'jack':
        this.launchPower(racer, 'cannon', 0xffd58d, 34, 1.8, -1, -2);
        this.launchPower(racer, 'cannon', 0xffd58d, 34, 1.8, -1, 2);
        racer.powerTick = 2.8;
        break;
      case 'mulan': this.makePulse(racer.position, 0x79e7d5, 0.45, 2.5); racer.powerTick = 1.8; break;
    }
  }

  private updateProgress(racer: Racer, progress: number) {
    const before = racer.progress;
    if (before > 0.84 && progress < 0.16 && racer.speed > 0) {
      racer.lap++;
      racer.aiRoute = this.aiRouteForLap(racer.id, racer.lap);
      if (racer.lap >= 4 && racer.finishPlace === 0) racer.finishPlace = ++this.finishCount;
      if (racer.id === 0) {
        const lapTime = this.lapClock;
        this.lapClock = 0;
        const isBest = !this.demoMode && lapTime >= 25 && lapTime < this.bestLap;
        if (isBest) {
          this.bestLap = lapTime;
          try { localStorage.setItem('genie-midnight-best-lap', String(lapTime)); } catch { /* Storage is optional. */ }
        }
        if (racer.lap >= 4) {
          this.finishRace();
        }
        else if (racer.lap === 3) this.showBanner('FINAL LAP · GIVE IT EVERYTHING!', 2.4);
        else this.showBanner(isBest ? `NEW BEST LAP · ${formatLapTime(lapTime)}` : `LAP ${racer.lap} · ${formatLapTime(lapTime)}`, 2);
        this.audio.play(racer.lap === 3 ? 'final-lap' : 'lap');
      }
    } else if (before < 0.16 && progress > 0.84 && racer.speed < 0) {
      racer.lap = Math.max(1, racer.lap - 1);
    }
    racer.progress = progress;
  }

  private finishRace() {
    if (this.mode !== 'race') return;
    const player = this.racers[0];
    const rank = player.finishPlace;
    this.mode = 'finished';
    this.ufo.reset();
    this.pluto.reset();
    this.plutoTongue.reset();
    plutoAlert.classList.add('hidden');
    player.visual.setPlutoPresent?.(true);
    player.visual.setGlider?.(false);
    this.ufoPhase = 'none';
    stitchAlert.classList.add('hidden');
    stitchIntro.classList.add('hidden');
    this.stitchIntroTime = 0;
    this.wishHolding = false;
    this.laserLocking = false;
    wishPicker.classList.add('hidden');
    if (player.visual instanceof KartVisual) player.visual.setWishPicker(false, 0);
    results.classList.remove('hidden');
    el<HTMLElement>('results-place').textContent = rank === 1 ? 'FIRST PLACE!' : rank === 2 ? 'SECOND PLACE!' : rank === 3 ? 'THIRD PLACE!' : `${rank}TH PLACE!`;
    el<HTMLElement>('results-summary').textContent = `${CHARACTER_BY_ID[player.character].name} finished Agrabah Circuit · ${player.tricksLanded} trick boost${player.tricksLanded === 1 ? '' : 's'} · ${player.draftBoosts} slipstream${player.draftBoosts === 1 ? '' : 's'}.`;
    el<HTMLElement>('results-time').textContent = formatLapTime(this.raceClock);
    this.audio.play('lap');
  }

  private respawn(racer: Racer) {
    const point = this.track.at(racer.lastSafeProgress);
    racer.position.copy(point.position);
    racer.previousPosition.copy(racer.position);
    racer.yaw = Math.atan2(point.tangent.x, point.tangent.z);
    racer.moveYaw = racer.yaw;
    racer.progress = point.progress;
    racer.speed = raceSpeed(12);
    racer.yawRate = 0;
    racer.drifting = false;
    racer.driftDirection = 0;
    racer.driftCharge = 0;
    racer.padBoostTime = 0;
    racer.offTrackTime = 0;
    racer.shieldTime = Math.max(racer.shieldTime, 1.2);
    if (racer.id === 0) {
      this.showBanner('MAGIC RECOVERY', 1.3);
      this.cameraYaw = racer.yaw;
      const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
      this.camera.position.copy(racer.position).addScaledVector(forward, -9).add(new THREE.Vector3(0, 4, 0));
      this.cameraLook.copy(racer.position).addScaledVector(forward, 8).add(new THREE.Vector3(0, 2, 0));
    }
  }

  private checkRacerCollisions(applyEffects = true) {
    let contact = false;
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];
        if (Math.abs(a.position.y - b.position.y) > 3.5) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= 4.15) continue;
        contact = true;
        const normal = distance > 0.01
          ? new THREE.Vector3(dx / distance, 0, dz / distance)
          : new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
        const separation = (4.15 - distance) * 0.5;
        a.position.addScaledVector(normal, -separation);
        b.position.addScaledVector(normal, separation);
        if (!applyEffects) continue;
        if (a.ultimateTime > 0 && a.character !== 'stitch' && !a.ultimateHit.has(b.id)) this.ultimateBump(a, b, normal);
        if (b.ultimateTime > 0 && b.character !== 'stitch' && !b.ultimateHit.has(a.id)) this.ultimateBump(b, a, normal.clone().negate());
        if (a.character === 'moana' && a.oceanBarrierTime > 0 && b.hitCooldown <= 0 && b.ultimateTime <= 0 && normal.dot(new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw))) < -0.3) {
          this.repelFromOceanBarrier(a, b, normal);
          continue;
        }
        if (b.character === 'moana' && b.oceanBarrierTime > 0 && a.hitCooldown <= 0 && a.ultimateTime <= 0 && normal.dot(new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw))) > 0.3) {
          this.repelFromOceanBarrier(b, a, normal.clone().negate());
          continue;
        }
        if (a.ultimateTime <= 0 && b.ultimateTime <= 0 && a.hitCooldown <= 0 && b.hitCooldown <= 0) {
          if (a.character === 'maleficent' && normal.dot(new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw))) < -0.35) { b.speed *= 0.65; b.wobbleTime = Math.max(b.wobbleTime, 0.55); this.makeFlash(b.position, 0x94f36e, 3, 0.25); }
          if (b.character === 'maleficent' && normal.dot(new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw))) > 0.35) { a.speed *= 0.65; a.wobbleTime = Math.max(a.wobbleTime, 0.55); this.makeFlash(a.position, 0x94f36e, 3, 0.25); }
          a.speed *= a.character === 'stitch' ? 0.95 : 0.88;
          b.speed *= b.character === 'stitch' ? 0.95 : 0.88;
          if (a.character === 'hades') a.hotHeadTime = Math.max(a.hotHeadTime, 1.7);
          if (b.character === 'hades') b.hotHeadTime = Math.max(b.hotHeadTime, 1.7);
          a.hitCooldown = b.hitCooldown = 0.35;
          if (a.id === 0 || b.id === 0) this.audio.play('hit');
          else this.audio.playAt('hit', a.position);
        }
      }
    }
    return contact;
  }

  private repelFromOceanBarrier(defender: Racer, attacker: Racer, outward: THREE.Vector3) {
    attacker.position.addScaledVector(outward, 2.6);
    attacker.speed *= 0.48;
    attacker.wobbleTime = Math.max(attacker.wobbleTime, 0.85);
    defender.hitCooldown = Math.max(defender.hitCooldown, 0.4);
    attacker.hitCooldown = Math.max(attacker.hitCooldown, 0.65);
    const impact = attacker.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    this.makeFlash(impact, 0x6ff4ec, 4.4, 0.35);
    this.burst(impact, 0x43cfc9, 0xd7ffef, 18);
    this.makePulse(defender.position.clone().addScaledVector(outward, 2), 0x7be9dd, 0.45, 2.9);
    if (defender.id === 0) this.showBanner('OCEAN BARRIER REPEL!', 0.9);
    this.racerSound('shield', defender);
  }

  private ultimateBump(attacker: Racer, victim: Racer, direction: THREE.Vector3) {
    attacker.ultimateHit.add(victim.id);
    const strong = attacker.character === 'genie' || attacker.character === 'stitch' || attacker.character === 'mulan';
    if (strong) this.stun(victim, attacker.character === 'genie' ? 1.25 : 0.95, true);
    else if (victim.ultimateTime <= 0) { victim.speed *= 0.46; victim.wobbleTime = Math.max(victim.wobbleTime, 1.1); }
    victim.position.addScaledVector(direction, strong ? 2.3 : 3.1);
    const impact = victim.position.clone().add(new THREE.Vector3(0, 1.8, 0));
    const def = CHARACTER_BY_ID[attacker.character];
    this.makeFlash(impact, def.accent, 5.5, 0.42);
    this.burst(impact, def.color, def.accent, 24);
    if (attacker.id === 0) this.showBanner(strong ? 'POWER KNOCKOUT!' : 'POWER PUSH!', 1.1);
  }

  private stun(racer: Racer, duration: number, ignoreShield = false) {
    if (!ignoreShield && racer.hitCooldown > 0) return;
    if (!ignoreShield && racer.tripleSparks > 0) {
      racer.tripleSparks--;
      racer.hitCooldown = Math.max(racer.hitCooldown, 0.45);
      this.makePulse(racer.position, 0xffbc8c, 0.4, 3);
      if (racer.id === 0) this.showBanner('SPARK GUARD!', 0.7);
      this.racerSound('shield', racer);
      return;
    }
    if (!ignoreShield && (racer.shieldTime > 0 || racer.ultimateTime > 0 && racer.character !== 'stitch')) {
      const impact = racer.position.clone().add(new THREE.Vector3(0, 1.8, 0));
      this.makeFlash(impact, 0xffd98c, 5, 0.38);
      this.burst(impact, 0xffe8b0, 0x7de8ff, 20);
      if (racer.ultimateTime <= 0) { racer.shieldTime = 0; racer.mirrorTime = 0; }
      racer.hitCooldown = Math.max(racer.hitCooldown, 0.55);
      if (racer.id === 0) this.showBanner('SHIELD BLOCK!', 0.9);
      this.racerSound('shield', racer);
      return;
    }
    if (ignoreShield) {
      racer.shieldTime = 0;
      if (racer.character !== 'stitch') racer.ultimateTime = 0;
      racer.boostTime = 0;
      racer.padBoostTime = 0;
    }
    racer.stunTime = Math.max(racer.stunTime, duration);
    racer.speed = 0;
    racer.drifting = false;
    racer.driftDirection = 0;
    racer.driftCharge = 0;
    if (racer.character === 'hades') racer.hotHeadTime = 2.2;
    racer.hitCooldown = Math.max(racer.hitCooldown, duration + 0.5);
    this.racerSound('stun', racer);
  }

  private checkObstacleCollisions(applyEffects = true) {
    let contact = false;
    for (const racer of this.racers) {
      for (const obstacle of this.track.obstacles) {
        if (obstacle.broken || Math.abs(racer.position.y - obstacle.position.y) > 3) continue;
        const distance = Math.hypot(racer.position.x - obstacle.position.x, racer.position.z - obstacle.position.z);
        if (distance >= obstacle.radius + 1.7) continue;
        contact = true;
        if (racer.character === 'buzz' && racer.ultimateTime > 0 && (obstacle.kind === 'crate' || obstacle.kind === 'urn')) {
          if (obstacle.kind === 'crate') {
            obstacle.broken = true;
            obstacle.respawn = 12;
            obstacle.mesh.visible = false;
            this.burst(obstacle.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xbfff7e, 0xffffff, 12);
          }
          continue;
        }
        const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
        const normal = distance > 0.05
          ? new THREE.Vector3((racer.position.x - obstacle.position.x) / distance, 0, (racer.position.z - obstacle.position.z) / distance)
          : forward.clone().negate();
        const clearance = obstacle.radius + 1.85;
        racer.position.addScaledVector(normal, clearance - distance);
        const roadAfter = this.keepOnCourse(racer);
        const remaining = Math.hypot(racer.position.x - obstacle.position.x, racer.position.z - obstacle.position.z);
        if (remaining < clearance - 0.04) {
          // An edge barrier can oppose the radial push; move along the road instead.
          const tangent = roadAfter.point.tangent.clone().setY(0).normalize();
          const along = (racer.position.x - obstacle.position.x) * tangent.x + (racer.position.z - obstacle.position.z) * tangent.z;
          const sign = along < 0 ? -1 : 1;
          const travel = -sign * along + Math.sqrt(along * along + clearance * clearance - remaining * remaining) + 0.15;
          racer.position.addScaledVector(tangent, sign * travel);
          this.keepOnCourse(racer);
        }
        // Keep collision geometry solid during hit grace without applying another hit.
        if (!applyEffects || racer.hitCooldown > 0) continue;
        if (obstacle.kind === 'crate') {
          obstacle.broken = true;
          obstacle.respawn = 12;
          obstacle.mesh.visible = false;
          if (racer.ultimateTime <= 0 || racer.character === 'stitch') racer.speed *= racer.character === 'stitch' ? 0.82 : 0.58;
          if (racer.id === 0) this.showBanner(racer.ultimateTime > 0 ? 'CRATE SMASH!' : 'CRATE HIT', 0.8);
        } else if (racer.ultimateTime > 0 && racer.character !== 'stitch') {
          racer.speed *= 0.88;
          if (racer.id === 0) this.showBanner('HEAVY OBSTACLE!', 0.8);
        } else if (racer.shieldTime > 0) {
          const impact = racer.position.clone().add(new THREE.Vector3(0, 1.8, 0));
          this.makeFlash(impact, 0xffd98c, 4.8, 0.36);
          this.burst(impact, 0xffdfa4, 0x82e9ff, 18);
          racer.shieldTime = 0;
          racer.mirrorTime = 0;
          if (racer.id === 0) this.showBanner('SHIELD BLOCK!', 0.8);
        } else {
          racer.speed *= racer.character === 'stitch' ? 0.78 : obstacle.kind === 'boulder' ? 0.38 : 0.55;
          if (racer.character === 'hades') racer.hotHeadTime = Math.max(racer.hotHeadTime, 2.2);
          if (obstacle.kind === 'boulder') this.stun(racer, 0.38);
          if (racer.id === 0) this.showBanner(obstacle.kind === 'boulder' ? 'BOULDER HIT!' : obstacle.kind === 'urn' ? 'PALACE URN HIT!' : obstacle.kind === 'marketIsland' ? 'MARKET ISLAND HIT!' : 'CART HIT!', 0.8);
        }
        racer.hitCooldown = Math.max(racer.hitCooldown, obstacle.kind === 'boulder' ? 1.7 : 1.45);
        const impactSound = ({ crate: 'crate-hit', marketIsland: 'market-hit', boulder: 'boulder-hit', urn: 'urn-hit', cart: 'cart-hit' } as const)[obstacle.kind];
        this.racerSound(impactSound, racer);
        // Resolve any other overlap on this frame; hitCooldown prevents a second impact.
      }
    }
    return contact;
  }

  private updateProjectiles(dt: number) {
    let displacedRacer = false;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      const previousProjectile = projectile.mesh.position.clone();
      projectile.life -= dt;
      if (projectile.target >= 0 && (projectile.kind === 'laser' || projectile.kind === 'firefly' || projectile.kind === 'plasma')) {
        const target = this.racers[projectile.target];
        if (target && target.stunTime <= 0 && target.fogTime <= 0) {
          const lead = projectile.kind === 'plasma' ? 0.12 : 0;
          const aim = target.position.clone().add(new THREE.Vector3(Math.sin(target.moveYaw) * target.speed * lead, 0, Math.cos(target.moveYaw) * target.speed * lead));
          const desired = aim.sub(projectile.mesh.position).setY(0).normalize().multiplyScalar(projectile.velocity.length());
          projectile.velocity.lerp(desired, Math.min(1, dt * (projectile.kind === 'plasma' ? 5.4 : projectile.kind === 'firefly' ? 0.95 : 1.8)));
          if (projectile.kind === 'plasma') projectile.velocity.normalize().multiplyScalar(Math.max(115, this.racers[projectile.owner].speed + 45));
        }
      }
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      if (projectile.kind === 'laser' || projectile.kind === 'dragon' || projectile.kind === 'dragonfire' || projectile.kind === 'wave' || projectile.kind === 'firefly' || projectile.kind === 'plasma') projectile.mesh.rotation.y = Math.atan2(projectile.velocity.x, projectile.velocity.z);
      else projectile.mesh.children[0].rotation.y += dt * 8;
      if (projectile.kind === 'plasma' || projectile.kind === 'curse') projectile.mesh.rotation.z += dt * 4;
      if (projectile.bounces > 0) {
        const road = this.track.nearest(projectile.mesh.position);
        if (Math.abs(road.lateral) > road.point.width / 2 - 1.5) {
          projectile.velocity.addScaledVector(road.point.right, -2 * projectile.velocity.dot(road.point.right));
          projectile.bounces--;
          this.makePulse(projectile.mesh.position, projectile.color, 0.35, 1.8);
        }
      }
      for (let spark = 0; spark < 2; spark++) {
        const velocity = projectile.velocity.clone().multiplyScalar(-0.17).add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4));
        this.sparks.spawn(projectile.mesh.position, velocity, spark === 0 ? projectile.color : 0xffffff, 0.32 + Math.random() * 0.18);
      }
      let remove = projectile.life <= 0;
      let hit: { racer: Racer; time: number; rearGuard: boolean } | null = null;
      for (const racer of this.racers) {
        if (racer.id === projectile.owner || racer.stunTime > 0 || racer.hitCooldown > 0) continue;
        const racerStart = racer.previousPosition.distanceToSquared(racer.position) < 144 ? racer.previousPosition : racer.position;
        const start = previousProjectile.clone().sub(racerStart);
        const end = projectile.mesh.position.clone().sub(racer.position);
        start.y -= KART_HITBOX_HEIGHT;
        end.y -= KART_HITBOX_HEIGHT;
        const radius = projectile.kind === 'dragon' ? 3.8 : projectile.kind === 'dragonfire' ? 3.5 : projectile.kind === 'wave' || projectile.kind === 'tornado' ? 4.3 : projectile.kind === 'firefly' ? 2.3 : 2.8;
        let time = sweptSphereHit(start, end, radius);
        let rearGuard = false;
        if (racer.character === 'moana' && racer.oceanBarrierTime > 0) {
          const guardTime = sweptSphereHit(start, end, 4.5);
          if (guardTime !== null) {
            const contact = start.clone().lerp(end, guardTime);
            const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
            if (contact.dot(forward) < -0.5 && (time === null || guardTime <= time)) {
              time = guardTime;
              rearGuard = true;
            }
          }
        }
        if (time !== null && (!hit || time < hit.time)) hit = { racer, time, rearGuard };
      }
      if (hit) {
        const { racer, rearGuard } = hit;
        const currentProjectile = projectile.mesh.position.clone();
        projectile.mesh.position.copy(previousProjectile).lerp(currentProjectile, hit.time);
        if (rearGuard) {
          this.makePulse(projectile.mesh.position, 0x6ff4ec, 0.42, 2.4);
          this.burst(projectile.mesh.position, 0x56ddd7, 0xd4fff4, 17);
          racer.hitCooldown = Math.max(racer.hitCooldown, 0.25);
          if (racer.id === 0) this.showBanner('OCEAN BARRIER BLOCK!', 0.9);
          this.racerSound('shield', racer);
        } else if (racer.mirrorTime > 0) {
          racer.mirrorTime = 0;
          racer.shieldTime = 0;
          this.stun(this.racers[projectile.owner], 0.65);
          if (racer.id === 0) this.showBanner('MIRROR REFLECT!', 0.9);
        } else if (projectile.kind === 'plasma') {
          if (racer.shieldTime > 0 || racer.ultimateTime > 0 && racer.character !== 'stitch') this.stun(racer, 0.3);
          else {
            const combo = this.plasmaCombos.get(racer.id);
            const count = combo && combo.cast === projectile.cast && this.raceClock - combo.last < 1.5 ? combo.count + 1 : 1;
            this.plasmaCombos.set(racer.id, { cast: projectile.cast ?? -1, count, last: this.raceClock });
            this.plasmaTotalHits++;
            racer.speed *= count >= 3 ? 0.72 : 0.92;
            if (count >= 3) {
              this.stun(racer, 0.55);
              if (projectile.owner === 0) this.showBanner('PLASMA BURST · SPINOUT!', 1.15);
            } else {
              racer.wobbleTime = Math.max(racer.wobbleTime, 0.16);
              racer.hitCooldown = Math.max(racer.hitCooldown, 0.07);
            }
            this.racers[projectile.owner].ultimateMeter = Math.min(100, this.racers[projectile.owner].ultimateMeter + 4);
          }
        } else if (projectile.kind === 'curse' || projectile.kind === 'dragonfire') {
          if (racer.shieldTime > 0) this.stun(racer, 0.3);
          else {
            racer.curseTime = Math.max(racer.curseTime, projectile.kind === 'dragonfire' ? 3 : 4);
            racer.speed *= projectile.kind === 'dragonfire' ? 0.58 : 0.74;
            if (projectile.kind === 'dragonfire') racer.wobbleTime = Math.max(racer.wobbleTime, 0.8);
            racer.hitCooldown = Math.max(racer.hitCooldown, 0.6);
          }
        } else if (projectile.kind === 'tornado') {
          const side = racer.position.clone().sub(projectile.mesh.position).setY(0).normalize();
          racer.position.addScaledVector(side, 5.5);
          displacedRacer = true;
          racer.speed *= 0.52;
          racer.wobbleTime = Math.max(racer.wobbleTime, 1.25);
          racer.hitCooldown = Math.max(racer.hitCooldown, 0.75);
        } else if (projectile.kind === 'wave') {
          const side = new THREE.Vector3(projectile.velocity.z, 0, -projectile.velocity.x).normalize();
          const sign = Math.sign(racer.position.clone().sub(projectile.mesh.position).dot(side)) || 1;
          racer.position.addScaledVector(side, sign * 3.1);
          displacedRacer = true;
          racer.speed *= 0.62;
          racer.wobbleTime = Math.max(racer.wobbleTime, 0.9);
          racer.hitCooldown = Math.max(racer.hitCooldown, 0.65);
        } else if (racer.character === 'jack' && racer.luckyEscapeCooldown <= 0 && Math.random() < 0.18 && racer.shieldTime <= 0) {
          racer.luckyEscapeCooldown = 25;
          racer.speed *= 0.84;
          racer.wobbleTime = Math.max(racer.wobbleTime, 0.35);
          if (racer.id === 0) this.showBanner('LUCKY ESCAPE!', 0.85);
        } else this.stun(racer, projectile.kind === 'dragon' ? 1.1 : projectile.kind === 'laser' ? 0.55 : 0.85);
        if (projectile.kind === 'plasma') this.audio.playAt('plasma-hit', projectile.mesh.position);
        this.makeFlash(projectile.mesh.position, projectile.color, 4.2, 0.3);
        this.burst(projectile.mesh.position, projectile.color, 0xffffff, 16);
        this.makePulse(projectile.mesh.position, projectile.color, 0.32, 1.7);
        const owner = this.racers[projectile.owner];
        if (!rearGuard) owner.ultimateMeter = Math.min(100, owner.ultimateMeter + 8);
        if (projectile.owner === 0) {
          const powerName = projectile.kind === 'dragonfire' ? 'DRAGON BREATH' : projectile.kind.toUpperCase();
          this.showBanner(rearGuard ? `${powerName} BLOCKED!` : `${powerName} HIT!`, 1);
        }
        remove = true;
      }
      if (remove) {
        this.scene.remove(projectile.mesh);
        disposeTransient(projectile.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    return displacedRacer;
  }

  private updatePickups(dt: number) {
    for (const pickup of this.pickups) {
      if (pickup.collected) {
        pickup.respawn -= dt;
        if (pickup.respawn <= 0) { pickup.collected = false; pickup.mesh.visible = true; }
      } else {
        pickup.mesh.rotation.y += dt * 2.2;
        pickup.mesh.position.y = pickup.baseY + Math.sin(this.elapsed * 3 + pickup.phase) * 0.12;
        if (this.mode === 'race') {
          for (const racer of this.racers) {
            if (!racer.item && racer.position.distanceTo(pickup.mesh.position) < 3.1) {
              pickup.collected = true;
              pickup.respawn = 10;
              pickup.mesh.visible = false;
              if (racer.compassTarget === pickup) { racer.compassTime = 0; racer.compassTarget = null; }
              const upgraded = racer.character === 'genie' && Math.random() < 0.28;
              racer.boostTime = Math.max(racer.boostTime, upgraded ? 1.5 : 0.65);
              const rank = [...this.racers].sort((a, b) => (b.lap - 1 + b.progress) - (a.lap - 1 + a.progress)).findIndex((other) => other.id === racer.id) + 1;
              racer.item = rollItem(rank, this.racers.length);
              racer.ultimateMeter = Math.min(100, racer.ultimateMeter + 7);
              if (upgraded) racer.wishUpgrade = true;
              const sparkle = racer.position.clone().add(new THREE.Vector3(0, 1.4, 0));
              this.makePulse(racer.position, upgraded ? 0xffd778 : 0x82eaff, 0.5, upgraded ? 4.4 : 2.8);
              this.burst(sparkle, upgraded ? 0xffd778 : 0x89eeff, 0xfff0bd, upgraded ? 20 : 10);
              if (racer.id === 0) {
                this.showBanner(upgraded ? `PHENOMENAL POWER · ${ITEMS[racer.item].name.toUpperCase()}!` : `${ITEMS[racer.item].name.toUpperCase()} READY!`, 0.9);
                this.racerSound('pickup', racer);
              }
              break;
            }
          }
        }
      }
    }
  }

  private updatePulses(dt: number) {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i];
      pulse.age += dt;
      const factor = pulse.age / pulse.duration;
      pulse.mesh.scale.setScalar(1 + factor * pulse.growth);
      (pulse.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - factor) * 0.7;
      if (pulse.age >= pulse.duration) {
        this.scene.remove(pulse.mesh);
        disposeTransient(pulse.mesh);
        this.pulses.splice(i, 1);
      }
    }
  }

  private updateFlashes(dt: number) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const flash = this.flashes[i];
      flash.age += dt;
      const factor = flash.age / flash.duration;
      flash.sprite.scale.setScalar(flash.size * (1 + factor * 0.55));
      (flash.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, (1 - factor) * 0.95);
      if (factor >= 1) {
        this.scene.remove(flash.sprite);
        flash.sprite.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number) {
    const player = this.racers[0];
    this.sunlight.position.set(player.position.x - 75, player.position.y + 130, player.position.z - 85);
    this.sunlight.target.position.copy(player.position);
    this.sunlight.target.updateMatrixWorld();
    const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    if (this.mode === 'menu') {
      const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
      const target = player.position.clone().addScaledVector(forward, 3).add(new THREE.Vector3(0, 2.5, 0));
      const desired = player.position.clone().addScaledVector(forward, -17).addScaledVector(right, 6 + Math.sin(this.elapsed * 0.35) * 1.5).add(new THREE.Vector3(0, 6.2, 0));
      if (!this.cameraReady) {
        this.camera.position.copy(desired);
        this.cameraLook.copy(target);
        this.cameraReady = true;
      } else {
        this.camera.position.lerp(desired, Math.min(1, dt * 2));
        this.cameraLook.lerp(target, Math.min(1, dt * 2));
      }
    } else {
      // The chase view follows travel direction with a little lag, exposing the kart's drift angle.
      this.cameraYaw = advanceChaseYaw(this.cameraYaw, player.moveYaw, player.drifting, dt);
      const chaseForward = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
      const insideCave = player.progress > 0.665 && player.progress < 0.78;
      const targetDistance = insideCave ? 13.3 : player.padBoostTime > 0 ? 16 : player.ultimateTime > 0 ? 15.5 : player.boostTime > 0 ? 15 : 14.3;
      this.cameraDistance += (targetDistance - this.cameraDistance) * Math.min(1, dt * 4);
      const distance = this.cameraDistance;
      const desired = player.position.clone().addScaledVector(chaseForward, -distance).add(new THREE.Vector3(0, 4.55 + player.speed * 0.012, 0));
      this.camera.position.copy(desired);
      const target = player.position.clone().addScaledVector(chaseForward, 12).add(new THREE.Vector3(0, 2.4, 0));
      this.cameraLook.copy(target);
      const targetFov = player.padBoostTime > 0 ? 77 : player.ultimateTime > 0 ? 77 : player.boostTime > 0 ? 72 : 67 + Math.min(player.speed / raceSpeed(31), 1) * 2;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 2.3);
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.cameraLook);
    if (this.mode === 'race') {
      const player = this.racers[0];
      const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
      for (const rival of this.racers.slice(1)) {
        const offset = rival.position.clone().sub(player.position);
        const blocksChaseView = offset.dot(forward) < -0.45 && Math.abs(offset.dot(right)) < 3.5 && rival.position.distanceTo(this.camera.position) < 12;
        rival.visual.group.visible = !blocksChaseView && rival.fogTime <= 0;
      }
    }
  }

  private updateHUD() {
    const player = this.racers[0];
    if (this.debugCollision) {
      let roadExcess = 0;
      let obstaclePenetration = 0;
      let racerPenetration = 0;
      let obstacleExample = '';
      let racerExample = '';
      for (const racer of this.racers) {
        const road = this.track.nearest(racer.position, racer.progress);
        roadExcess = Math.max(roadExcess, Math.abs(road.lateral) - Math.max(1, road.point.width / 2 - 1.55));
        for (const obstacle of this.track.obstacles) {
          if (obstacle.broken || Math.abs(racer.position.y - obstacle.position.y) > 3) continue;
          const penetration = obstacle.radius + 1.7 - Math.hypot(racer.position.x - obstacle.position.x, racer.position.z - obstacle.position.z);
          if (penetration > obstaclePenetration) {
            obstaclePenetration = penetration;
            obstacleExample = `${racer.id}:${obstacle.kind}@${obstacle.progress.toFixed(3)}`;
          }
        }
      }
      for (let i = 0; i < this.racers.length; i++) {
        for (let j = i + 1; j < this.racers.length; j++) {
          const a = this.racers[i];
          const b = this.racers[j];
          if (Math.abs(a.position.y - b.position.y) > 3.5) continue;
          const penetration = 4.15 - Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
          if (penetration > racerPenetration) {
            racerPenetration = penetration;
            if (penetration > 0.15) racerExample = `${a.id}:${b.id}@${a.progress.toFixed(3)}`;
          }
        }
      }
      const audit = this.collisionAudit;
      audit.frames++;
      if (roadExcess > 0.15) audit.roadFrames++;
      if (obstaclePenetration > 0.15) {
        audit.obstacleFrames++;
        if (audit.examples.length < 5) audit.examples.push(obstacleExample);
      }
      if (racerPenetration > 0.15) {
        audit.racerFrames++;
        if (audit.examples.length < 5) audit.examples.push(racerExample);
      }
      audit.maxRoad = Math.max(audit.maxRoad, roadExcess);
      audit.maxObstacle = Math.max(audit.maxObstacle, obstaclePenetration);
      audit.maxRacer = Math.max(audit.maxRacer, racerPenetration);
      hud.dataset.collisionAudit = JSON.stringify(audit);
    }
    if (this.debugDrive) {
      const road = this.track.nearest(player.position, player.progress);
      const trace = JSON.stringify({ clock: Number(this.raceClock.toFixed(2)), progress: Number(player.progress.toFixed(3)),
        x: Number(player.position.x.toFixed(2)), z: Number(player.position.z.toFixed(2)), yaw: Number(player.yaw.toFixed(3)),
        moveYaw: Number(player.moveYaw.toFixed(3)), cameraYaw: Number(this.cameraYaw.toFixed(3)),
        lateral: Number(road.lateral.toFixed(2)), roadHalfWidth: Number((road.point.width / 2).toFixed(2)),
        speed: Number(player.speed.toFixed(1)), stun: Number(player.stunTime.toFixed(2)) });
      if (this.raceClock >= 2.2 && !hud.dataset.handlingStart) hud.dataset.handlingStart = trace;
      if (this.raceClock >= 2.75 && !hud.dataset.handlingEnd) hud.dataset.handlingEnd = trace;
    }
    hud.dataset.state = JSON.stringify(this.racers.map((racer) => {
      const road = this.track.nearest(racer.position, racer.progress);
      return { id: racer.id, character: racer.character, lap: racer.lap, p: Number(racer.progress.toFixed(3)), x: Number(racer.position.x.toFixed(2)), y: Number(racer.position.y.toFixed(2)), z: Number(racer.position.z.toFixed(2)), yaw: Number(racer.yaw.toFixed(3)), moveYaw: Number(racer.moveYaw.toFixed(3)), yawRate: Number(racer.yawRate.toFixed(2)), route: road.point.route, lateral: Number(road.lateral.toFixed(2)), roadHalfWidth: Number((road.point.width / 2).toFixed(2)), onRoad: road.onRoad, aiRoute: racer.aiRoute, aiLine: Number(racer.aiLine.toFixed(1)), speed: Math.round(racer.speed), drift: Number(racer.driftCharge.toFixed(2)), jump: Number(racer.jumpTime.toFixed(2)), trickReady: racer.trickReady, trickBoost: racer.trickBoost, tricks: racer.tricksLanded, drafts: racer.draftBoosts, slip: Number(racer.slipCharge.toFixed(2)), padBoost: Number(racer.padBoostTime.toFixed(2)), iceSpeed: Number(racer.iceSpeedTime.toFixed(2)), stun: Number(racer.stunTime.toFixed(2)), hitGrace: Number(racer.hitCooldown.toFixed(2)), ultimate: Number(racer.ultimateTime.toFixed(2)), meter: Math.round(racer.ultimateMeter), signatureCooldown: Number(racer.signatureCooldown.toFixed(1)), item: racer.item, tripleSparks: racer.tripleSparks };
    }));
    if (this.debugPowers) hud.dataset.effects = JSON.stringify({ projectiles: this.projectiles.map((projectile) => ({ kind: projectile.kind, speed: Math.round(projectile.velocity.length()), target: projectile.target, velocity: projectile.velocity.toArray().map((n) => Math.round(n)) })), fields: this.powerFields.map((field) => field.kind), plasmaHits: this.plasmaTotalHits, plasmaCombos: [...this.plasmaCombos.entries()].map(([target, combo]) => ({ target, count: combo.count })), ufo: { active: this.ufo.active, owner: this.ufo.owner, age: Number(this.ufo.elapsed.toFixed(2)), phase: this.ufoPhase, warnings: this.ufo.warnings, hits: this.ufoTotalHits, beamTarget: this.ufo.beamTarget, beamVictims: [...this.ufoBeamVictims] } });
    const standings = [...this.racers].sort((a, b) => (b.lap - 1 + b.progress) - (a.lap - 1 + a.progress));
    const rank = standings.findIndex((racer) => racer.id === 0) + 1;
    const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
    positionText.innerHTML = `${rank}<span>${suffix}</span><em> / ${RACER_COUNT}</em>`;
    lapText.textContent = `LAP ${Math.min(3, player.lap)} / 3`;
    zoneText.textContent = this.track.zone(player.progress);
    lapTimeText.textContent = `${formatLapTime(this.lapClock)} · BEST ${Number.isFinite(this.bestLap) ? formatLapTime(this.bestLap) : '--:--.--'}`;
    speedText.textContent = String(Math.round(Math.max(0, player.speed) * 3.6));
    const road = this.track.nearest(player.position, player.progress);
    if (player.drifting) {
      const charge = player.driftCharge;
      const stage = driftBoostStage(charge);
      surfaceText.textContent = stage === 3 ? 'COSMIC DRIFT BOOST READY' : stage === 2 ? 'GOLD DRIFT BOOST READY' : stage === 1 ? 'BLUE DRIFT BOOST READY' : 'DRIFT · KEEP STEERING';
      boostFill.style.width = `${clamp(charge / 1.9, 0, 1) * 100}%`;
      boostFill.style.background = stage === 3 ? '#d799ff' : stage === 2 ? '#ffd075' : '#65dbf9';
    } else {
      surfaceText.textContent = player.slipCharge > 0.1 ? `DRAFTING · ${Math.round(player.slipCharge / 1.2 * 100)}%` : player.compassTime > 0 && player.compassShortcut ? `COMPASS → ${player.compassShortcut.route.toUpperCase()} SHORTCUT` : player.compassTime > 0 && player.compassTarget ? `COMPASS → ${player.compassTarget.route.toUpperCase()} SPARK` : player.iceSpeedTime > 0 ? 'FROZEN GRIP · ICE SPEED' : road.onRoad ? road.point.route === 'main' ? 'ROAD' : `${road.point.route.toUpperCase()} ROUTE` : 'OFF ROAD';
      boostFill.style.width = `${clamp(Math.max(player.boostTime / 3, player.slipCharge / 1.2), 0, 1) * 100}%`;
      boostFill.style.background = '';
    }
    const def = CHARACTER_BY_ID[player.character];
    aimCue.textContent = this.keys.has('ArrowDown') ? '↓ AIMING BACKWARD' : this.keys.has('ArrowUp') ? '↑ AIMING FORWARD' : '↑ FORWARD · ↓ BACKWARD';
    aimCue.classList.toggle('backward', this.keys.has('ArrowDown'));
    const dragonBreath = player.character === 'maleficent' && player.ultimateTime > 0;
    wishTile.querySelector('strong')!.textContent = dragonBreath ? 'DRAGON BREATH' : def.signatureName.toUpperCase();
    wishTile.querySelector('small')!.textContent = this.wishHolding ? 'CHOOSE · RELEASE E' : this.laserLocking ? this.laserLockTarget >= 0 ? 'TARGET LOCKED · RELEASE E' : 'LOCKING · HOLD ON RIVAL' : player.signatureCooldown > 0 ? `RECHARGING · ${player.signatureCooldown.toFixed(1)}s` : player.character === 'genie' ? 'READY · HOLD E TO CHOOSE' : player.character === 'buzz' ? 'READY · HOLD E TO LOCK' : 'READY · PRESS E';
    signatureFill.style.width = `${this.laserLocking ? clamp(this.laserLockElapsed / (player.laserReadyTime > 0 ? 0.2 : 0.33), 0, 1) * 100 : clamp(1 - player.signatureCooldown / (dragonBreath ? 1.35 : def.signatureCooldown), 0, 1) * 100}%`;
    wishTile.classList.toggle('cooling', player.signatureCooldown > 0);
    wishTile.classList.toggle('ready', player.signatureCooldown <= 0);
    ultimateTile.querySelector('strong')!.textContent = def.ultimateName.toUpperCase();
    const otherUltimateActive = this.racers.some((racer) => racer.id !== player.id && racer.ultimateTime > 0) || this.ufo.active || this.pluto.active;
    ultimateTile.querySelector('small')!.textContent = player.ultimateTime > 0 ? `${player.ultimateTime.toFixed(1)}s ACTIVE` : player.ultimateMeter >= 100 && otherUltimateActive ? 'WAIT · RIVAL ULTIMATE ACTIVE' : player.ultimateMeter >= 100 ? 'READY · PRESS Q' : `CHARGING · ${Math.floor(player.ultimateMeter)}%`;
    ultimateFill.style.width = `${player.ultimateMeter}%`;
    ultimateTile.classList.toggle('active', player.ultimateTime > 0);
    ultimateTile.classList.toggle('ready', player.ultimateMeter >= 100 && player.ultimateTime <= 0 && !otherUltimateActive);
    const heldItem = player.item ? ITEMS[player.item] : player.tripleSparks > 0 ? ITEMS.triple : null;
    itemIcon.firstChild!.textContent = heldItem?.icon ?? '?';
    itemIcon.style.color = heldItem?.color ?? '#9aa9b8';
    itemIcon.style.borderColor = heldItem?.color ?? '#eee7d5';
    itemCaption.innerHTML = heldItem ? `${heldItem.name.toUpperCase()}${player.tripleSparks > 0 && !player.item ? ` · ${player.tripleSparks} LEFT` : ''}<br><small>R · ${heldItem.hint.toUpperCase()}</small>` : 'WONDER ORB<br><small>COLLECT AN ORB FOR AN ITEM</small>';
  }

  private drawMinimap() {
    const ctx = mapContext;
    ctx.clearRect(0, 0, 200, 170);
    const mapPoint = (position: THREE.Vector3) => ({ x: 100 + (position.x - this.mapTransform.centerX) * this.mapTransform.scale, y: 85 + (position.z - this.mapTransform.centerZ) * this.mapTransform.scale });
    const drawRoute = (points: RoadPoint[], color: string, width: number, dashed: boolean) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(dashed ? [5, 5] : []);
      ctx.beginPath();
      points.forEach((point, index) => {
        const screen = mapPoint(point.position);
        if (index === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      if (points === this.track.mainSamples) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    };
    drawRoute(this.track.mainSamples, '#213453', 12, false);
    drawRoute(this.track.mainSamples, '#f1e5d8', 5, false);
    drawRoute(this.track.alleySamples, '#e6c76f', 2, true);
    drawRoute(this.track.roofSamples, '#77d9eb', 2, true);
    drawRoute(this.track.gardenSamples, '#b5e8a2', 2, true);
    const compass = this.racers[0];
    const compassPosition = compass.compassShortcut ? this.track.at(compass.compassShortcut.progress).position : compass.compassTarget && !compass.compassTarget.collected ? compass.compassTarget.mesh.position : null;
    if (compass.compassTime > 0 && compassPosition) {
      const mark = mapPoint(compassPosition);
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, 7 + Math.sin(this.elapsed * 10) * 1.8, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffdc83';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    for (const racer of this.racers) {
      const screen = mapPoint(racer.position);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, racer.id === 0 ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = racer.id === 0 ? '#56dafa' : `#${CHARACTER_BY_ID[racer.character].accent.toString(16).padStart(6, '0')}`;
      ctx.fill();
      ctx.strokeStyle = '#172341';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

new GenieRace();
