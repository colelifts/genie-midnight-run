import * as THREE from 'three';
import './style.css';
import { GameAudio } from './audio';
import { CharacterKartVisual, type RaceVisual } from './characterKart';
import { CHARACTERS, CHARACTER_BY_ID, type CharacterId } from './characters';
import { KartVisual, makeProjectile } from './kart';
import { MARKET_CROSSING_PROGRESS, marketCartState, PICKUP_LAYOUT, RaceTrack, touchesBoostPad, type RoadHit, type RoadPoint, type RouteName } from './track';

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
const ultimateTile = el<HTMLDivElement>('ultimate-tile');
const signatureFill = el<HTMLDivElement>('signature-fill');
const ultimateFill = el<HTMLDivElement>('ultimate-fill');
const banner = el<HTMLDivElement>('banner');
const characterSelect = el<HTMLDivElement>('character-select');
const characterDetail = el<HTMLDivElement>('character-detail');
const itemCaption = document.querySelector<HTMLElement>('.item-caption')!;
const ultimateAnnouncement = el<HTMLDivElement>('ultimate-announcement');
const ultimateVeil = el<HTMLDivElement>('ultimate-veil');

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrap = (value: number) => ((value % 1) + 1) % 1;
const angleDiff = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
const formatLapTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
const RACER_COUNT = 8;
const START_LANES = [0, -4, 4, -4, 4, -4, 4, 0];

type GameMode = 'menu' | 'countdown' | 'race' | 'paused' | 'finished';
type Wish = 'boost' | 'shield' | 'shot';

interface Racer {
  id: number;
  character: CharacterId;
  visual: RaceVisual;
  position: THREE.Vector3;
  yaw: number;
  moveYaw: number;
  speed: number;
  progress: number;
  lap: number;
  finishPlace: number;
  boostTime: number;
  padBoostTime: number;
  shieldTime: number;
  ultimateTime: number;
  ultimateMeter: number;
  signatureCooldown: number;
  itemCharges: number;
  wishUpgrade: boolean;
  curseTime: number;
  wobbleTime: number;
  hotHeadTime: number;
  laserReadyTime: number;
  powerTick: number;
  stunTime: number;
  hitCooldown: number;
  offTrackTime: number;
  lastPad: number;
  drifting: boolean;
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
  lastSafe: THREE.Vector3;
  lastSafeProgress: number;
  aiRoute: RouteName;
  aiLane: number;
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
  kind: 'star' | 'plasma' | 'laser' | 'curse' | 'dragon' | 'cannon' | 'wave';
  color: number;
  bounces: number;
  target: number;
}

interface PowerField {
  owner: number;
  kind: 'ice' | 'soul' | 'dragonfire';
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
  readonly projectiles: Projectile[] = [];
  readonly powerFields: PowerField[] = [];
  readonly pickups: Pickup[] = [];
  readonly pulses: Pulse[] = [];
  readonly flashes: Flash[] = [];
  readonly keys = new Set<string>();
  readonly touch = new Set<string>();
  readonly demoMode = new URLSearchParams(window.location.search).has('demo');
  readonly debugPowers = window.location.hostname === '127.0.0.1' && new URLSearchParams(window.location.search).has('debugPowers');
  mode: GameMode = 'menu';
  private elapsed = 0;
  private countdownElapsed = 0;
  private countShown = 4;
  private bannerTime = 0;
  private announcementTime = 0;
  private wishHolding = false;
  private wishElapsed = 0;
  private wishIndex = 0;
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
  private bestLap = Infinity;
  private cameraLook = new THREE.Vector3();
  private cameraDistance = 13.1;
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
    sunlight.shadow.camera.left = -390;
    sunlight.shadow.camera.right = 390;
    sunlight.shadow.camera.top = 390;
    sunlight.shadow.camera.bottom = -390;
    sunlight.shadow.camera.near = 1;
    sunlight.shadow.camera.far = 650;
    sunlight.shadow.bias = -0.0004;
    this.scene.add(sunlight);
    const moonFill = new THREE.DirectionalLight(0x809cff, 0.62);
    moonFill.position.set(90, 80, 45);
    this.scene.add(moonFill);
    this.makeSky();
    this.makeStars();
    this.track = new RaceTrack(this.scene);
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
        powerFields: this.powerFields.length,
      }),
    });
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    requestAnimationFrame((now) => this.frame(now));
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
    for (let i = 0; i < positions.count; i++) {
      const up = Math.max(0, positions.getY(i) / 540);
      const color = up < 0.32 ? horizon.clone().lerp(middle, up / 0.32) : middle.clone().lerp(zenith, Math.min(1, (up - 0.32) / 0.68));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
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

  private raceStarts() {
    const requestedStart = new URLSearchParams(window.location.search).get('demoStart');
    const demoStart = requestedStart === null ? NaN : Number(requestedStart);
    const base = this.demoMode && Number.isFinite(demoStart) && demoStart >= 0 && demoStart < 1 ? demoStart : 0.006;
    return Array.from({ length: RACER_COUNT }, (_, i) => wrap(base + (i === 0 ? 0 : Math.ceil(i / 2) * 0.006)));
  }

  private makeRacers() {
    const starts = this.raceStarts();
    const demoRoute = new URLSearchParams(window.location.search).get('demoRoute');
    const candidates = CHARACTERS.map((character) => character.id).filter((id) => id !== this.selectedCharacter);
    for (let i = 0; i < RACER_COUNT; i++) {
      const start = this.track.at(starts[i]);
      const gridPosition = start.position.clone().addScaledVector(start.right, START_LANES[i]);
      const yaw = Math.atan2(start.tangent.x, start.tangent.z);
      const character: CharacterId = i === 0 ? this.selectedCharacter : candidates[i - 1];
      const visual = this.makeVisual(character);
      visual.group.position.copy(gridPosition);
      visual.group.rotation.y = yaw;
      this.scene.add(visual.group);
      const racer: Racer = {
        id: i, character, visual, position: gridPosition.clone(), yaw, moveYaw: yaw, speed: 0, progress: starts[i], lap: 1, finishPlace: 0,
        boostTime: 0, padBoostTime: 0, shieldTime: 0, ultimateTime: 0, ultimateMeter: 0, signatureCooldown: 0, itemCharges: 1, wishUpgrade: false, curseTime: 0, wobbleTime: 0, hotHeadTime: 0, laserReadyTime: 0, powerTick: 0, stunTime: 0, hitCooldown: 0, offTrackTime: 0, lastPad: 0,
        drifting: false, driftCharge: 0, jumpTime: 0, jumpDuration: 0, jumpPower: 0, trickReady: false, trickBoost: false, trickAnim: 0, slipCharge: 0, slipCooldown: 0, tricksLanded: 0, draftBoosts: 0, compassTime: 0, compassTarget: null,
        lastSafe: gridPosition.clone(), lastSafeProgress: starts[i], aiRoute: i === 0 && this.demoMode && (demoRoute === 'alley' || demoRoute === 'roof' || demoRoute === 'garden') ? demoRoute : i % 3 === 1 ? 'alley' : i % 3 === 2 ? 'roof' : 'garden', aiLane: START_LANES[i],
        aiAbilityTimer: 7 + i * 1.2, aiUltimateTimer: 40 + i * 3, ultimateHit: new Set<number>(), steerVisual: 0,
      };
      this.racers.push(racer);
    }
  }

  private makeVisual(character: CharacterId): RaceVisual {
    return character === 'genie' ? new KartVisual('gold') : new CharacterKartVisual(character);
  }

  private makeCharacterSelect() {
    for (const character of CHARACTERS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-choice';
      button.dataset.character = character.id;
      button.style.setProperty('--racer-accent', `#${character.accent.toString(16).padStart(6, '0')}`);
      button.innerHTML = `<span class="character-icon">${character.icon}</span><span class="character-name">${character.name}</span>`;
      button.setAttribute('aria-label', `Select ${character.name}`);
      button.addEventListener('click', () => this.selectCharacter(character.id));
      characterSelect.appendChild(button);
    }
    this.refreshCharacterSelect();
  }

  private selectCharacter(character: CharacterId) {
    if (this.mode !== 'menu' || character === this.selectedCharacter) return;
    this.selectedCharacter = character;
    try { localStorage.setItem('genie-midnight-character', character); } catch { /* Optional preference. */ }
    const player = this.racers[0];
    this.replaceVisual(player, character);
    this.refreshCharacterSelect();
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
    characterSelect.querySelectorAll<HTMLButtonElement>('.character-choice').forEach((button) => {
      const selected = button.dataset.character === character.id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    characterDetail.innerHTML = `<strong>${character.name}</strong><span class="character-role">${character.title}</span><div class="power-line"><b>Passive · ${character.passiveName}:</b> ${character.passive}</div><div class="power-line"><b>E · ${character.signatureName}:</b> ${character.signature}</div><div class="power-line"><b>Q · ${character.ultimateName}:</b> ${character.ultimate}</div>`;
  }

  private makePickups() {
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd064 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x88e3f4 });
    PICKUP_LAYOUT.forEach(({ route, progress, lateral }, i) => {
      const road = this.track.routeAt(route, progress);
      const group = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), starMat);
      group.add(core);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 4, 12), ringMat);
      group.add(ring);
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
    });
    window.addEventListener('blur', () => { this.keys.clear(); if (this.mode === 'race') this.pauseGame(); });
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
  }

  private startRace() {
    this.audio.start();
    this.resetRace();
    this.mode = 'countdown';
    this.countdownElapsed = 0;
    this.countShown = 4;
    hud.classList.remove('hidden');
    menu.classList.add('hidden');
    pause.classList.add('hidden');
    results.classList.add('hidden');
    countdown.classList.remove('hidden');
    this.showBanner('GET READY', 2.2);
  }

  private resetRace() {
    this.lapClock = 0;
    this.raceClock = 0;
    this.finishCount = 0;
    const rivals = CHARACTERS.map((character) => character.id).filter((id) => id !== this.selectedCharacter);
    for (let i = rivals.length - 1; i > 0; i--) { const pick = Math.floor(Math.random() * (i + 1)); [rivals[i], rivals[pick]] = [rivals[pick], rivals[i]]; }
    for (let i = 1; i < RACER_COUNT; i++) this.replaceVisual(this.racers[i], rivals[i - 1]);
    const starts = this.raceStarts();
    this.racers.forEach((racer, i) => {
      const point = this.track.at(starts[i]);
      racer.position.copy(point.position).addScaledVector(point.right, racer.aiLane);
      racer.yaw = Math.atan2(point.tangent.x, point.tangent.z);
      racer.moveYaw = racer.yaw;
      racer.speed = 0;
      racer.progress = starts[i];
      racer.lap = 1;
      racer.finishPlace = 0;
      racer.boostTime = racer.padBoostTime = racer.shieldTime = racer.ultimateTime = racer.stunTime = 0;
      racer.ultimateMeter = this.debugPowers ? 100 : 0;
      racer.signatureCooldown = racer.curseTime = racer.wobbleTime = racer.hotHeadTime = racer.laserReadyTime = racer.powerTick = 0;
      racer.itemCharges = 1;
      racer.wishUpgrade = false;
      racer.hitCooldown = racer.offTrackTime = racer.lastPad = 0;
      racer.drifting = false;
      racer.driftCharge = 0;
      racer.jumpTime = 0;
      racer.trickReady = racer.trickBoost = false;
      racer.trickAnim = racer.slipCharge = racer.slipCooldown = 0;
      racer.tricksLanded = racer.draftBoosts = 0;
      racer.compassTime = 0;
      racer.compassTarget = null;
      racer.lastSafe.copy(racer.position);
      racer.lastSafeProgress = starts[i];
      racer.aiAbilityTimer = 7 + i * 1.2;
      racer.aiUltimateTimer = 40 + i * 3;
      racer.ultimateHit.clear();
      racer.visual.group.position.copy(racer.position);
      racer.visual.group.rotation.y = racer.yaw;
      racer.visual.setShield(false);
      racer.visual.setUltimate(false);
      racer.visual.setStunned(false);
    });
    this.projectiles.forEach((projectile) => { this.scene.remove(projectile.mesh); disposeTransient(projectile.mesh); });
    this.projectiles.length = 0;
    this.powerFields.forEach((field) => { this.scene.remove(field.mesh); disposeTransient(field.mesh); });
    this.powerFields.length = 0;
    this.pulses.forEach((pulse) => { this.scene.remove(pulse.mesh); disposeTransient(pulse.mesh); });
    this.pulses.length = 0;
    this.flashes.forEach((flash) => { this.scene.remove(flash.sprite); flash.sprite.material.dispose(); });
    this.flashes.length = 0;
    this.pickups.forEach((pickup) => { pickup.collected = false; pickup.mesh.visible = true; pickup.respawn = 0; });
    this.wishHolding = false;
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
    pause.classList.remove('hidden');
    this.keys.clear();
    this.wishHolding = false;
    wishPicker.classList.add('hidden');
  }

  private resumeGame() {
    this.mode = 'race';
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
  }

  private castWish() {
    if (!this.wishHolding) return;
    this.wishHolding = false;
    wishPicker.classList.add('hidden');
    const choices: Wish[] = ['boost', 'shield', 'shot'];
    this.racers[0].signatureCooldown = CHARACTER_BY_ID.genie.signatureCooldown;
    this.useWish(this.racers[0], choices[this.wishIndex]);
  }

  private useItem(racer: Racer) {
    if (this.mode !== 'race' || racer.stunTime > 0 || racer.itemCharges <= 0) return;
    racer.itemCharges--;
    const choices: Wish[] = ['boost', 'shield', 'shot'];
    this.useWish(racer, choices[Math.floor(Math.random() * choices.length)]);
  }

  private useSignature(racer: Racer) {
    if (this.mode !== 'race' || racer.stunTime > 0 || racer.signatureCooldown > 0) return;
    if (racer.character === 'genie' && racer.id === 0) { this.beginWish(); return; }
    const def = CHARACTER_BY_ID[racer.character];
    racer.signatureCooldown = def.signatureCooldown;
    const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
    const braking = racer.id === 0 && (this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const origin = racer.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.makeFlash(origin, def.accent, 4.8, 0.38);
    this.burst(origin, def.color, def.accent, 20);
    if (racer.id === 0) this.showBanner(def.signatureName.toUpperCase(), 1);
    this.audio.play('wish');
    switch (racer.character) {
      case 'genie':
        this.useWish(racer, 'boost');
        break;
      case 'mickey':
        if (braking) this.dropField(racer, 'soul', 0xffda6f, 4.5, 8, -3.2);
        else this.launchPower(racer, 'star', 0xffd866, 42, 2.8);
        break;
      case 'stitch':
        this.launchPower(racer, 'plasma', 0x64b8ff, 46, 3.2);
        break;
      case 'elsa':
        for (let n = 0; n < 4; n++) this.dropField(racer, 'ice', 0x9fefff, 3.6, 8, -2 - n * 2.6);
        break;
      case 'moana':
        if (braking) {
          racer.shieldTime = Math.max(racer.shieldTime, 2.8);
          this.makePulse(racer.position, 0x66e9e9, 0.65, 4.5);
        } else this.launchPower(racer, 'wave', 0x58e8db, 30, 1.25);
        break;
      case 'buzz': {
        const targets = this.racers.filter((other) => other.id !== racer.id && other.stunTime <= 0 && other.position.clone().sub(racer.position).dot(forward) > 0 && other.position.distanceTo(racer.position) < 42);
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
        const next = this.pickups.filter((pickup) => !pickup.collected)
          .map((pickup) => ({ pickup, ahead: wrap(pickup.progress - racer.progress) }))
          .filter((entry) => entry.ahead > 0.012 && entry.ahead < 0.27)
          .sort((a, b) => a.ahead - b.ahead)[0]?.pickup;
        if (next) {
          racer.compassTarget = next;
          racer.compassTime = 6;
          this.makePulse(next.mesh.position, 0xffd77d, 1.15, 6);
          this.makeFlash(next.mesh.position, 0xffdd85, 6, 0.7);
          if (racer.id === 0) this.showBanner(`COMPASS · ${next.route.toUpperCase()} SPARK AHEAD`, 1.4);
        }
        racer.boostTime = Math.max(racer.boostTime, 1.1);
        break;
      }
      case 'mulan':
        racer.boostTime = Math.max(racer.boostTime, 1.55);
        racer.speed = Math.max(racer.speed, 39);
        this.makePulse(racer.position, 0x71e4cf, 0.4, 3.2);
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
      this.audio.play('boost');
    } else if (wish === 'shield') {
      racer.shieldTime = Math.max(racer.shieldTime, upgraded ? 6 : 4);
      this.burst(racer.position.clone().add(new THREE.Vector3(0, 2.3, 0)), 0x71e7ff, 0xc9f6ff, 14);
      if (racer.id === 0) this.showBanner('WISH: SHIELD', 0.9);
      this.audio.play('shield');
    } else {
      const mesh = makeProjectile();
      const direction = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
      mesh.position.copy(racer.position).addScaledVector(direction, 3.6);
      mesh.position.y += 2.1;
      mesh.rotation.y = racer.yaw;
      this.makeFlash(mesh.position, 0xff7561, 4.8, 0.4);
      this.burst(mesh.position, 0xffbd66, 0xff4d5b, 16);
      this.scene.add(mesh);
      this.projectiles.push({ owner: racer.id, mesh, velocity: direction.multiplyScalar(upgraded ? 52 : 44), life: 3, kind: 'star', color: 0xffb35e, bounces: 0, target: -1 });
      if (racer.id === 0) this.showBanner('WISH: STAR SHOT', 0.9);
      this.audio.play('shot');
    }
  }

  private activateUltimate(racer: Racer) {
    if (this.mode !== 'race' || racer.ultimateTime > 0 || racer.stunTime > 0 || racer.ultimateMeter < 100) return;
    racer.ultimateMeter = 0;
    racer.ultimateTime = racer.character === 'genie' ? 5 : 4.6;
    racer.shieldTime = Math.max(racer.shieldTime, racer.ultimateTime);
    racer.boostTime = Math.max(racer.boostTime, racer.ultimateTime);
    racer.speed = Math.max(racer.speed, 34);
    racer.ultimateHit.clear();
    racer.powerTick = 0;
    racer.visual.setUltimate(true);
    const def = CHARACTER_BY_ID[racer.character];
    if (racer.id === 0) this.showBanner(`${def.ultimateName.toUpperCase()}!`, 1);
    if (racer.id === 0) {
      this.announcementTime = 1.35;
      ultimateAnnouncement.innerHTML = `<span>${def.icon}</span><div><small>${def.name.toUpperCase()} ULTIMATE</small><strong>${def.ultimateName.toUpperCase()}</strong></div>`;
      ultimateAnnouncement.style.setProperty('--ultimate-color', `#${def.accent.toString(16).padStart(6, '0')}`);
      ultimateVeil.style.setProperty('--ultimate-color', `#${def.accent.toString(16).padStart(6, '0')}`);
      ultimateAnnouncement.classList.remove('hidden');
      ultimateVeil.classList.remove('hidden');
    }
    this.makePulse(racer.position, def.accent, 0.7, 5.8);
    this.makeFlash(racer.position.clone().add(new THREE.Vector3(0, 2.2, 0)), def.accent, 7, 0.55);
    this.burst(racer.position.clone().add(new THREE.Vector3(0, 1.7, 0)), def.color, def.accent, 36);
    if (racer.character === 'mickey') this.pushWave(racer, 13, 0xffd866);
    if (racer.character === 'mulan') this.launchPower(racer, 'dragon', 0x74e3cf, 54, 5);
    if (racer.id === 0) this.audio.playUltimate(racer.character);
    else this.audio.play('ultimate');
  }

  private launchPower(racer: Racer, kind: Projectile['kind'], color: number, speed: number, life: number, target = -1, side = 0) {
    const direction = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
    const right = new THREE.Vector3(direction.z, 0, -direction.x);
    const mesh = new THREE.Group();
    const bright = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const pale = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    let coreGeometry: THREE.BufferGeometry = new THREE.IcosahedronGeometry(kind === 'dragon' ? 1.05 : kind === 'cannon' ? 0.66 : 0.75, 1);
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
    if (kind === 'wave') coreGeometry = new THREE.TorusGeometry(2.5, 0.38, 9, 30, Math.PI * 1.7);
    const core = new THREE.Mesh(coreGeometry, kind === 'cannon' ? new THREE.MeshBasicMaterial({ color: 0x32445a, toneMapped: false }) : bright);
    if (kind === 'laser') core.rotation.x = Math.PI / 2;
    if (kind === 'wave') core.rotation.z = 0.15;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(kind === 'dragon' ? 1.55 : 1.05, 0.12, 6, 24), new THREE.MeshBasicMaterial({ color: kind === 'cannon' ? color : 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false }));
    mesh.add(core, halo);
    if (kind === 'plasma') {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1.04, 14, 10), new THREE.MeshBasicMaterial({ color: 0xbceaff, transparent: true, opacity: 0.35, depthWrite: false }));
      mesh.add(shell);
      for (let n = 0; n < 4; n++) {
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), pale);
        const angle = n * Math.PI / 2;
        spark.position.set(Math.cos(angle) * 1.23, Math.sin(angle) * 1.23, 0);
        mesh.add(spark);
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
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 7), pale);
        horn.position.set(side * 0.66, 0.73, -0.25); horn.rotation.z = side * -0.34; mesh.add(horn);
        const eyeDot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), pale);
        eyeDot.position.set(side * 0.65, 0.17, 0.48); mesh.add(eyeDot);
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
    mesh.rotation.y = racer.yaw;
    this.scene.add(mesh);
    this.projectiles.push({ owner: racer.id, mesh, velocity: direction.multiplyScalar(speed).addScaledVector(right, side * 10), life, kind, color, bounces: kind === 'plasma' ? 1 : 0, target });
    this.makePulse(mesh.position, color, 0.35, 1.6);
    this.audio.play('shot');
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
    mesh.add(disk, ring);
    for (let shard = 0; shard < (kind === 'ice' ? 6 : 5); shard++) {
      const angle = shard * Math.PI * 2 / (kind === 'ice' ? 6 : 5);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(kind === 'ice' ? 0.34 : 0.48, kind === 'ice' ? 1.2 : 1.5, kind === 'ice' ? 5 : 7), new THREE.MeshBasicMaterial({ color: shard % 2 ? color : 0xffffff, transparent: true, opacity: kind === 'ice' ? 0.67 : 0.52, depthWrite: false, side: THREE.DoubleSide }));
      spike.position.set(Math.cos(angle) * radius * 0.62, kind === 'ice' ? 0.5 : 0.64, Math.sin(angle) * radius * 0.62);
      spike.rotation.z = Math.sin(angle) * 0.24;
      mesh.add(spike);
    }
    mesh.position.set(position.x, ground + 0.18, position.z);
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
      field.mesh.rotation.y += dt * (field.kind === 'ice' ? 0.2 : 1.3);
      field.mesh.scale.setScalar(0.9 + Math.sin(this.elapsed * 5 + i) * 0.06);
      for (const racer of this.racers) {
        if (racer.id === field.owner || racer.ultimateTime > 0 || racer.hitCooldown > 0 || field.victims.has(racer.id)) continue;
        if (Math.abs(racer.position.y - field.mesh.position.y) > 3) continue;
        if (Math.hypot(racer.position.x - field.mesh.position.x, racer.position.z - field.mesh.position.z) > field.radius + 1) continue;
        field.victims.add(racer.id);
        if (field.kind === 'ice') {
          racer.wobbleTime = Math.max(racer.wobbleTime, racer.character === 'elsa' ? 0.3 : 1.6);
          racer.speed *= 0.82;
        } else if (field.kind === 'soul') {
          racer.wobbleTime = Math.max(racer.wobbleTime, 1.25);
          racer.speed *= 0.73;
        } else this.stun(racer, 0.7);
        racer.hitCooldown = Math.max(racer.hitCooldown, 0.75);
        this.makeFlash(racer.position.clone().add(new THREE.Vector3(0, 1, 0)), field.kind === 'ice' ? 0xa5f4ff : 0x87a4ff, 3.5, 0.32);
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

  private frame(now: number) {
    const frameMs = now - this.lastFrame;
    const dt = clamp(frameMs / 1000, 0, 0.033);
    this.lastFrame = now;
    if (frameMs > 0) this.smoothedFps += (Math.min(120, 1000 / frameMs) - this.smoothedFps) * 0.05;
    hud.dataset.fps = String(Math.round(this.smoothedFps));
    if (this.mode !== 'paused') this.elapsed += dt;
    this.syncGamepad();
    if (this.mode === 'countdown') this.updateCountdown(dt);
    if (this.mode === 'race') { this.lapClock += dt; this.raceClock += dt; this.updateRace(dt); }
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
      this.audio.update(this.racers[0].speed, this.racers[0].drifting, this.racers[0].ultimateTime > 0, this.mode === 'race', this.track.zone(this.racers[0].progress), this.racers[0].lap >= 3);
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
      this.audio.play('count');
    }
    if (this.countdownElapsed >= 3 && this.mode === 'countdown') {
      countdown.textContent = 'GO!';
      this.audio.play('go');
      this.mode = 'race';
      this.racers[0].boostTime = this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 0.9 : 0;
      this.showBanner('DRIFT · RELEASE FOR BOOST', 2.3);
    }
    if (this.countdownElapsed > 3.75) countdown.classList.add('hidden');
  }

  private updateRace(dt: number) {
    if (this.wishHolding) {
      this.wishElapsed += dt;
      const newIndex = Math.floor(this.wishElapsed / 0.32) % 3;
      if (newIndex !== this.wishIndex) {
        this.wishIndex = newIndex;
        this.updateWishPicker();
        this.audio.play('wish');
      }
    }
    if (this.demoMode) this.updateAI(this.racers[0], dt);
    else this.updatePlayer(dt);
    for (let i = 1; i < this.racers.length; i++) this.updateAI(this.racers[i], dt);
    this.updateSlipstreams(dt);
    for (const racer of this.racers) this.updateRacerTimers(racer, dt);
    this.updatePowerFields(dt);
    this.checkRacerCollisions();
    this.checkObstacleCollisions();
    this.updateProjectiles(dt);
    this.emitMagicTrails();
    for (const racer of this.racers) {
      racer.visual.group.position.copy(racer.position);
      racer.visual.group.rotation.y = racer.yaw;
      racer.visual.group.rotation.z = racer.trickAnim > 0 ? Math.sin((1 - racer.trickAnim / 0.65) * Math.PI) * 0.24 : 0;
      racer.visual.setGroundOffset(this.track.nearest(racer.position, racer.progress).point.position.y - racer.position.y);
      racer.visual.setShield(racer.shieldTime > 0 && racer.ultimateTime <= 0);
      racer.visual.setUltimate(racer.ultimateTime > 0);
      racer.visual.setStunned(racer.stunTime > 0);
      racer.visual.update(dt, racer.speed, racer.steerVisual, racer.drifting, racer.boostTime > 0, racer.stunTime > 0);
    }
    this.updateHUD();
    this.drawMinimap();
  }

  private updatePlayer(dt: number) {
    const player = this.racers[0];
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.touch.has('left');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.touch.has('right');
    const accel = this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.touch.has('accel') ? 1 : this.gamepadAccel;
    const brake = this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : this.gamepadBrake;
    const steer = clamp((right ? 1 : 0) - (left ? 1 : 0) + this.gamepadSteer, -1, 1);
    const driftPressed = this.keys.has('Space') || this.touch.has('drift') || this.gamepadDrift;
    player.steerVisual = steer;
    if (player.stunTime > 0) {
      player.speed = 0;
      return;
    }
    const roadBefore = this.track.nearest(player.position, player.progress);
    const offRoad = !roadBefore.onRoad && player.jumpTime <= 0;
    const stats = CHARACTER_BY_ID[player.character];
    const maxSpeed = (player.padBoostTime > 0 ? 53 : player.ultimateTime > 0 ? 43 : player.boostTime > 0 ? 40 : offRoad ? 20 : 31) * stats.speed;
    if (accel > 0) player.speed += (player.padBoostTime > 0 ? 32 : player.ultimateTime > 0 ? 28 : 19) * (player.curseTime > 0 ? 0.52 : 1) * (player.hotHeadTime > 0 ? 1.45 : 1) * stats.acceleration * accel * dt;
    else player.speed += player.speed > 0 ? -Math.min(player.speed, 5.3 * dt) : Math.min(-player.speed, 5.3 * dt);
    if (brake > 0) player.speed -= 29 * brake * dt;
    if (player.boostTime > 0) player.speed += 11 * dt;
    player.speed = clamp(player.speed, -8, maxSpeed);

    if (driftPressed && player.speed > 10) {
      if (!player.drifting) {
        player.drifting = true;
        this.startJump(player, 0.42, 0.42);
      }
      if (Math.abs(steer) > 0.18) player.driftCharge += dt;
    } else if (player.drifting) {
      this.releaseDrift(player);
    }
    const boostHandling = player.padBoostTime > 0 ? 1.7 : player.ultimateTime > 0 ? 1.35 : 1;
    const turnRate = (1.5 - Math.min(Math.abs(player.speed) / 50, 0.5)) * (player.drifting ? 1.25 : 1) * boostHandling * stats.handling * (player.wobbleTime > 0 ? 0.62 : 1);
    player.yaw -= (steer + (player.wobbleTime > 0 ? Math.sin(this.elapsed * 19) * 0.22 : 0)) * turnRate * dt * Math.min(1, Math.abs(player.speed) / 6);
    if (Math.abs(steer) < 0.12 && roadBefore.onRoad && !player.drifting && player.speed > 8) {
      const roadYaw = Math.atan2(roadBefore.point.tangent.x, roadBefore.point.tangent.z);
      player.yaw += clamp(angleDiff(roadYaw, player.yaw), -0.8 * dt, 0.8 * dt);
    }
    player.moveYaw += angleDiff(player.yaw, player.moveYaw) * Math.min(1, dt * (player.drifting ? 3.6 : 7.5));
    player.position.x += Math.sin(player.moveYaw) * player.speed * dt;
    player.position.z += Math.cos(player.moveYaw) * player.speed * dt;
    this.followRoadHeight(player, dt);
    const road = this.keepOnCourse(player);
    this.updateProgress(player, road.point.progress);
    if (road.onRoad || player.jumpTime > 0) {
      player.offTrackTime = 0;
      if (player.jumpTime <= 0) {
        player.lastSafe.copy(road.point.position).addScaledVector(road.point.tangent, 2);
        player.lastSafeProgress = road.point.progress;
      }
    } else {
      player.offTrackTime += dt;
      if (player.ultimateTime <= 0 || player.character !== 'moana') player.speed = Math.min(player.speed, 20);
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
    if (racer.stunTime > 0) { racer.speed = 0; racer.drifting = false; racer.driftCharge = 0; return; }
    const ahead = wrap(racer.progress + Math.max(0.014, racer.speed * (racer.padBoostTime > 0 ? 1.05 : 0.75) / this.track.length));
    let route: RouteName = 'main';
    if (racer.aiRoute === 'alley' && ahead > 0.045 && ahead < 0.16) route = 'alley';
    if (racer.aiRoute === 'roof' && ahead > 0.19 && ahead < 0.33) route = 'roof';
    if ((racer.aiRoute === 'garden' || racer.id === 1) && ahead > 0.37 && ahead < 0.53) route = 'garden';
    const target = this.track.routeAt(route, ahead);
    const currentTangent = this.track.routeAt(route, racer.progress).tangent;
    const bend = target.tangent.dot(new THREE.Vector3(-currentTangent.z, 0, currentTangent.x));
    if (Math.abs(bend) > 0.2 && racer.speed > 17) {
      if (!racer.drifting) {
        racer.drifting = true;
        this.startJump(racer, 0.32, 0.28);
      }
      racer.driftCharge += dt;
      if (Math.random() < dt * 12) this.emitDriftSparks(racer);
    } else if (racer.drifting) {
      this.releaseDrift(racer);
    }
    const direction = target.position.clone().addScaledVector(target.right, racer.aiLane).sub(racer.position);
    let targetYaw = Math.atan2(direction.x, direction.z);
    for (const obstacle of this.track.obstacles) {
      if (obstacle.broken) continue;
      const distance = racer.position.distanceTo(obstacle.position);
      if (distance < 13 && distance > 3 && Math.abs(angleDiff(Math.atan2(obstacle.position.x - racer.position.x, obstacle.position.z - racer.position.z), racer.yaw)) < 0.5) {
        targetYaw += racer.id % 2 ? 0.35 : -0.35;
      }
    }
    const error = angleDiff(targetYaw, racer.yaw);
    const steer = clamp(error * 2.4, -1, 1);
    racer.steerVisual = steer;
    racer.yaw += (steer + (racer.wobbleTime > 0 ? Math.sin(this.elapsed * 17) * 0.2 : 0)) * (1.2 - Math.min(racer.speed / 100, 0.25)) * (racer.drifting ? 1.25 : 1) * (racer.padBoostTime > 0 ? 1.3 : 1) * CHARACTER_BY_ID[racer.character].handling * dt;
    racer.moveYaw += angleDiff(racer.yaw, racer.moveYaw) * Math.min(1, dt * 5);
    let targetSpeed = 27.7 + Math.sin(racer.id * 1.7) * 1.8 + Math.sin(this.elapsed * 0.5 + racer.id) * 1.1;
    if (Math.abs(error) > 0.5) targetSpeed = 22;
    if (racer.boostTime > 0) targetSpeed = racer.ultimateTime > 0 ? 41 : 37;
    if (racer.padBoostTime > 0) targetSpeed = 49;
    if (racer.ultimateTime > 0) targetSpeed = 41;
    targetSpeed *= CHARACTER_BY_ID[racer.character].speed;
    racer.speed += (targetSpeed - racer.speed) * Math.min(1, dt * (targetSpeed > racer.speed ? (racer.curseTime > 0 ? 0.55 : 1.2) * CHARACTER_BY_ID[racer.character].acceleration : 2.2));
    racer.position.x += Math.sin(racer.moveYaw) * racer.speed * dt;
    racer.position.z += Math.cos(racer.moveYaw) * racer.speed * dt;
    this.followRoadHeight(racer, dt);
    const road = this.keepOnCourse(racer);
    this.updateProgress(racer, road.point.progress);
    if (!road.onRoad && racer.jumpTime <= 0) {
      racer.position.addScaledVector(road.point.position.clone().sub(racer.position), Math.min(1, dt * 2));
    }
    racer.aiAbilityTimer -= dt;
    if (racer.trickReady && !racer.trickBoost && racer.jumpDuration > 0 && racer.jumpTime / racer.jumpDuration < 0.62) this.performTrick(racer);
    if (racer.aiAbilityTimer <= 0) {
      racer.aiAbilityTimer = 4 + Math.random() * 4;
      this.useSignature(racer);
      if (racer.itemCharges > 0 && Math.random() < 0.4) this.useItem(racer);
    }
    racer.aiUltimateTimer -= dt;
    if (racer.aiUltimateTimer <= 0 && racer.ultimateMeter >= 100) {
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
          racer.speed = Math.max(racer.speed, 38);
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

  private keepOnCourse(racer: Racer): RoadHit {
    const road = this.track.nearest(racer.position, racer.progress);
    if (road.distance > Math.max(28, road.point.width / 2 + 7)) {
      this.respawn(racer);
      return this.track.nearest(racer.position, racer.progress);
    }
    const limit = Math.max(1, road.point.width / 2 - 1.55);
    const excess = Math.abs(road.lateral) - limit;
    if (excess > 0) {
      racer.position.addScaledVector(road.point.right, -Math.sign(road.lateral) * excess);
      racer.speed *= Math.max(0.58, 1 - excess * 0.14);
      if (racer.drifting && excess > 0.6) {
        racer.drifting = false;
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
    const charge = racer.driftCharge;
    racer.driftCharge = 0;
    if (charge < 0.58) return;
    const stage = charge >= 1.9 ? 3 : charge >= 1.18 ? 2 : 1;
    racer.boostTime = Math.max(racer.boostTime, [0, 0.65, 1.2, 1.8][stage] * (racer.character === 'mulan' ? 1.28 : 1));
    racer.ultimateMeter = Math.min(100, racer.ultimateMeter + (8 + stage * 5) * (racer.character === 'mickey' ? 1.45 : 1));
    if (racer.id === 0) {
      this.showBanner(['', 'BLUE DRIFT BOOST', 'GOLD DRIFT BOOST', 'COSMIC DRIFT BOOST'][stage], 0.95);
      this.audio.play('drift');
      this.audio.play('boost');
    }
  }

  private emitDriftSparks(racer: Racer) {
    const right = new THREE.Vector3(Math.cos(racer.yaw), 0, -Math.sin(racer.yaw));
    const back = new THREE.Vector3(-Math.sin(racer.yaw), 0, -Math.cos(racer.yaw));
    const color = racer.driftCharge >= 1.9 ? 0xd799ff : racer.driftCharge >= 1.18 ? 0xffc866 : 0x61d8ff;
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
      if (racer.boostTime <= 0 && racer.ultimateTime <= 0) continue;
      const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
      const side = new THREE.Vector3(Math.cos(racer.yaw), 0, -Math.sin(racer.yaw));
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
        racer.speed = Math.max(racer.speed, 44);
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
    if (racer.ultimateTime > 0) this.updateUltimatePower(racer, dt);
    racer.boostTime = Math.max(0, racer.boostTime - dt);
    racer.padBoostTime = Math.max(0, racer.padBoostTime - dt);
    racer.shieldTime = Math.max(0, racer.shieldTime - dt);
    racer.ultimateTime = Math.max(0, racer.ultimateTime - dt);
    racer.signatureCooldown = Math.max(0, racer.signatureCooldown - dt);
    racer.curseTime = Math.max(0, racer.curseTime - dt);
    racer.wobbleTime = Math.max(0, racer.wobbleTime - dt);
    racer.hotHeadTime = Math.max(0, racer.hotHeadTime - dt);
    racer.laserReadyTime = Math.max(0, racer.laserReadyTime - dt);
    racer.compassTime = Math.max(0, racer.compassTime - dt);
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
      case 'genie': racer.powerTick = 0.55; break;
      case 'mickey': this.makePulse(racer.position, 0xffdb6e, 0.5, 2.3); racer.powerTick = 0.75; break;
      case 'stitch': this.burst(position, 0x74b7ff, 0xffffff, 10); racer.powerTick = 0.38; break;
      case 'elsa':
        this.dropField(racer, 'ice', 0xa9f2ff, 4, 5, -2.8);
        for (const other of this.racers) if (other.id !== racer.id && other.position.distanceTo(racer.position) < 9) other.wobbleTime = Math.max(other.wobbleTime, 0.7);
        racer.powerTick = 0.58;
        break;
      case 'moana': this.pushWave(racer, 8, 0x6fece5); racer.powerTick = 0.68; break;
      case 'buzz': this.launchPower(racer, 'laser', 0xa6ff76, 58, 1.25); racer.powerTick = 0.9; break;
      case 'maleficent': this.dropField(racer, 'dragonfire', 0xa1f576, 4.5, 6, -3); racer.powerTick = 0.68; break;
      case 'hades': this.dropField(racer, 'soul', 0x77b6ff, 4.1, 5.2, -2.7); racer.powerTick = 0.52; break;
      case 'jack':
        this.launchPower(racer, 'cannon', 0xffd58d, 34, 1.8, -1, -2);
        this.launchPower(racer, 'cannon', 0xffd58d, 34, 1.8, -1, 2);
        racer.powerTick = 1.05;
        break;
      case 'mulan': this.makePulse(racer.position, 0x79e7d5, 0.45, 2.5); racer.powerTick = 0.7; break;
    }
  }

  private updateProgress(racer: Racer, progress: number) {
    const before = racer.progress;
    if (before > 0.84 && progress < 0.16 && racer.speed > 0) {
      racer.lap++;
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
    this.wishHolding = false;
    wishPicker.classList.add('hidden');
    results.classList.remove('hidden');
    el<HTMLElement>('results-place').textContent = rank === 1 ? 'FIRST PLACE!' : rank === 2 ? 'SECOND PLACE!' : rank === 3 ? 'THIRD PLACE!' : `${rank}TH PLACE!`;
    el<HTMLElement>('results-summary').textContent = `${CHARACTER_BY_ID[player.character].name} finished Agrabah Circuit · ${player.tricksLanded} trick boost${player.tricksLanded === 1 ? '' : 's'} · ${player.draftBoosts} slipstream${player.draftBoosts === 1 ? '' : 's'}.`;
    el<HTMLElement>('results-time').textContent = formatLapTime(this.raceClock);
    this.audio.play('lap');
  }

  private respawn(racer: Racer) {
    const point = this.track.at(racer.lastSafeProgress);
    racer.position.copy(point.position);
    racer.yaw = Math.atan2(point.tangent.x, point.tangent.z);
    racer.moveYaw = racer.yaw;
    racer.progress = point.progress;
    racer.speed = 12;
    racer.padBoostTime = 0;
    racer.offTrackTime = 0;
    racer.shieldTime = Math.max(racer.shieldTime, 1.2);
    if (racer.id === 0) {
      this.showBanner('MAGIC RECOVERY', 1.3);
      const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
      this.camera.position.copy(racer.position).addScaledVector(forward, -9).add(new THREE.Vector3(0, 4, 0));
      this.cameraLook.copy(racer.position).addScaledVector(forward, 8).add(new THREE.Vector3(0, 2, 0));
    }
  }

  private checkRacerCollisions() {
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];
        if (Math.abs(a.position.y - b.position.y) > 3.5) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= 4.15 || distance < 0.01) continue;
        const normal = new THREE.Vector3(dx / distance, 0, dz / distance);
        const separation = (4.15 - distance) * 0.5;
        a.position.addScaledVector(normal, -separation);
        b.position.addScaledVector(normal, separation);
        if (a.ultimateTime > 0 && !a.ultimateHit.has(b.id)) this.ultimateBump(a, b, normal);
        if (b.ultimateTime > 0 && !b.ultimateHit.has(a.id)) this.ultimateBump(b, a, normal.clone().negate());
        if (a.ultimateTime <= 0 && b.ultimateTime <= 0 && a.hitCooldown <= 0 && b.hitCooldown <= 0) {
          if (a.character === 'maleficent' && normal.dot(new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw))) < -0.35) { b.speed *= 0.65; b.wobbleTime = Math.max(b.wobbleTime, 0.55); this.makeFlash(b.position, 0x94f36e, 3, 0.25); }
          if (b.character === 'maleficent' && normal.dot(new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw))) > 0.35) { a.speed *= 0.65; a.wobbleTime = Math.max(a.wobbleTime, 0.55); this.makeFlash(a.position, 0x94f36e, 3, 0.25); }
          a.speed *= a.character === 'stitch' ? 0.95 : 0.88;
          b.speed *= b.character === 'stitch' ? 0.95 : 0.88;
          if (a.character === 'hades') a.hotHeadTime = Math.max(a.hotHeadTime, 1.7);
          if (b.character === 'hades') b.hotHeadTime = Math.max(b.hotHeadTime, 1.7);
          a.hitCooldown = b.hitCooldown = 0.35;
          if (a.id === 0) this.audio.play('hit');
        }
      }
    }
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
    if (!ignoreShield && (racer.shieldTime > 0 || racer.ultimateTime > 0)) {
      const impact = racer.position.clone().add(new THREE.Vector3(0, 1.8, 0));
      this.makeFlash(impact, 0xffd98c, 5, 0.38);
      this.burst(impact, 0xffe8b0, 0x7de8ff, 20);
      if (racer.ultimateTime <= 0) racer.shieldTime = 0;
      racer.hitCooldown = Math.max(racer.hitCooldown, 0.55);
      if (racer.id === 0) this.showBanner('SHIELD BLOCK!', 0.9);
      this.audio.play('shield');
      return;
    }
    if (ignoreShield) {
      racer.shieldTime = 0;
      racer.ultimateTime = 0;
      racer.boostTime = 0;
      racer.padBoostTime = 0;
    }
    racer.stunTime = Math.max(racer.stunTime, duration);
    racer.speed = 0;
    if (racer.character === 'hades') racer.hotHeadTime = 2.2;
    racer.hitCooldown = Math.max(racer.hitCooldown, duration + 0.5);
    this.audio.play('stun');
  }

  private checkObstacleCollisions() {
    for (const racer of this.racers) {
      if (racer.hitCooldown > 0) continue;
      for (const obstacle of this.track.obstacles) {
        if (obstacle.broken || Math.abs(racer.position.y - obstacle.position.y) > 3) continue;
        const distance = Math.hypot(racer.position.x - obstacle.position.x, racer.position.z - obstacle.position.z);
        if (distance >= obstacle.radius + 1.7) continue;
        const forward = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
        const normal = distance > 0.05
          ? new THREE.Vector3((racer.position.x - obstacle.position.x) / distance, 0, (racer.position.z - obstacle.position.z) / distance)
          : forward.clone().negate();
        racer.position.addScaledVector(normal, obstacle.radius + (obstacle.kind === 'boulder' ? 3.5 : 2.05) - distance);
        racer.position.addScaledVector(forward, -0.75);
        this.keepOnCourse(racer);
        racer.hitCooldown = obstacle.kind === 'boulder' ? 1.7 : 1.45;
        if (obstacle.kind === 'crate') {
          obstacle.broken = true;
          obstacle.respawn = 12;
          obstacle.mesh.visible = false;
          if (racer.ultimateTime <= 0) racer.speed *= racer.character === 'stitch' ? 0.82 : 0.58;
          if (racer.id === 0) this.showBanner(racer.ultimateTime > 0 ? 'CRATE SMASH!' : 'CRATE HIT', 0.8);
        } else if (racer.ultimateTime > 0) {
          racer.speed *= 0.88;
          if (racer.id === 0) this.showBanner('HEAVY OBSTACLE!', 0.8);
        } else if (racer.shieldTime > 0) {
          const impact = racer.position.clone().add(new THREE.Vector3(0, 1.8, 0));
          this.makeFlash(impact, 0xffd98c, 4.8, 0.36);
          this.burst(impact, 0xffdfa4, 0x82e9ff, 18);
          racer.shieldTime = 0;
          if (racer.id === 0) this.showBanner('SHIELD BLOCK!', 0.8);
        } else {
          racer.speed *= racer.character === 'stitch' ? 0.78 : obstacle.kind === 'boulder' ? 0.38 : 0.55;
          if (racer.character === 'hades') racer.hotHeadTime = Math.max(racer.hotHeadTime, 2.2);
          if (obstacle.kind === 'boulder') this.stun(racer, 0.38);
          if (racer.id === 0) this.showBanner(obstacle.kind === 'boulder' ? 'BOULDER HIT!' : obstacle.kind === 'urn' ? 'PALACE URN HIT!' : 'CART HIT!', 0.8);
        }
        this.audio.play('hit');
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.life -= dt;
      if (projectile.target >= 0 && projectile.kind === 'laser') {
        const target = this.racers[projectile.target];
        if (target && target.stunTime <= 0) {
          const desired = target.position.clone().sub(projectile.mesh.position).setY(0).normalize().multiplyScalar(projectile.velocity.length());
          projectile.velocity.lerp(desired, Math.min(1, dt * 1.8));
        }
      }
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      if (projectile.kind === 'laser' || projectile.kind === 'dragon' || projectile.kind === 'wave') projectile.mesh.rotation.y = Math.atan2(projectile.velocity.x, projectile.velocity.z);
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
      for (const racer of this.racers) {
        if (racer.id === projectile.owner || racer.stunTime > 0 || racer.hitCooldown > 0) continue;
        if (racer.position.distanceTo(projectile.mesh.position) < (projectile.kind === 'dragon' ? 3.8 : projectile.kind === 'wave' ? 4.3 : 2.8)) {
          if (projectile.kind === 'curse') { racer.curseTime = Math.max(racer.curseTime, 4); racer.speed *= 0.74; }
          else if (projectile.kind === 'wave') {
            const side = new THREE.Vector3(projectile.velocity.z, 0, -projectile.velocity.x).normalize();
            const sign = Math.sign(racer.position.clone().sub(projectile.mesh.position).dot(side)) || 1;
            racer.position.addScaledVector(side, sign * 3.1);
            racer.speed *= 0.62;
            racer.wobbleTime = Math.max(racer.wobbleTime, 0.9);
            racer.hitCooldown = Math.max(racer.hitCooldown, 0.65);
          }
          else if (racer.character === 'jack' && Math.random() < 0.18 && racer.shieldTime <= 0) { racer.speed *= 0.84; }
          else this.stun(racer, projectile.kind === 'dragon' ? 1.1 : projectile.kind === 'laser' ? 0.55 : 0.85);
          this.makeFlash(projectile.mesh.position, projectile.color, 4.2, 0.3);
          this.burst(projectile.mesh.position, projectile.color, 0xffffff, 16);
          this.makePulse(projectile.mesh.position, projectile.color, 0.32, 1.7);
          const owner = this.racers[projectile.owner];
          owner.ultimateMeter = Math.min(100, owner.ultimateMeter + 8);
          if (projectile.owner === 0) this.showBanner(`${projectile.kind.toUpperCase()} HIT!`, 1);
          remove = true;
          break;
        }
      }
      if (remove) {
        this.scene.remove(projectile.mesh);
        disposeTransient(projectile.mesh);
        this.projectiles.splice(i, 1);
      }
    }
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
            if (racer.position.distanceTo(pickup.mesh.position) < 3.1) {
              pickup.collected = true;
              pickup.respawn = 10;
              pickup.mesh.visible = false;
              if (racer.compassTarget === pickup) { racer.compassTime = 0; racer.compassTarget = null; }
              const upgraded = racer.character === 'genie' && Math.random() < 0.28;
              racer.boostTime = Math.max(racer.boostTime, upgraded ? 1.5 : 0.65);
              racer.itemCharges = Math.min(2, racer.itemCharges + 1);
              racer.ultimateMeter = Math.min(100, racer.ultimateMeter + 7);
              if (upgraded) racer.wishUpgrade = true;
              const sparkle = racer.position.clone().add(new THREE.Vector3(0, 1.4, 0));
              this.makePulse(racer.position, upgraded ? 0xffd778 : 0x82eaff, 0.5, upgraded ? 4.4 : 2.8);
              this.burst(sparkle, upgraded ? 0xffd778 : 0x89eeff, 0xfff0bd, upgraded ? 20 : 10);
              if (racer.id === 0) {
                this.showBanner(upgraded ? 'PHENOMENAL POWER · WISH UPGRADED!' : 'WISH SPARK · ITEM READY!', 0.9);
                this.audio.play('pickup');
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
      const insideCave = player.progress > 0.665 && player.progress < 0.78;
      const targetDistance = insideCave ? 12.7 : player.padBoostTime > 0 ? 14.6 : player.ultimateTime > 0 ? 14.1 : player.boostTime > 0 ? 13.5 : 13.1;
      this.cameraDistance += (targetDistance - this.cameraDistance) * Math.min(1, dt * 4);
      const distance = this.cameraDistance;
      const desired = player.position.clone().addScaledVector(forward, -distance).add(new THREE.Vector3(0, 4.55 + player.speed * 0.012, 0));
      this.camera.position.copy(desired);
      const target = player.position.clone().addScaledVector(forward, 12).add(new THREE.Vector3(0, 2.4, 0));
      this.cameraLook.copy(target);
      const targetFov = player.padBoostTime > 0 ? 77 : player.ultimateTime > 0 ? 77 : player.boostTime > 0 ? 72 : 67 + Math.min(player.speed / 31, 1) * 2;
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
        rival.visual.group.visible = !blocksChaseView;
      }
    }
  }

  private updateHUD() {
    const player = this.racers[0];
    hud.dataset.state = JSON.stringify(this.racers.map((racer) => ({ id: racer.id, character: racer.character, lap: racer.lap, p: Number(racer.progress.toFixed(3)), x: Number(racer.position.x.toFixed(2)), y: Number(racer.position.y.toFixed(2)), z: Number(racer.position.z.toFixed(2)), yaw: Number(racer.yaw.toFixed(3)), route: this.track.nearest(racer.position, racer.progress).point.route, speed: Math.round(racer.speed), drift: Number(racer.driftCharge.toFixed(2)), jump: Number(racer.jumpTime.toFixed(2)), trickReady: racer.trickReady, trickBoost: racer.trickBoost, tricks: racer.tricksLanded, drafts: racer.draftBoosts, slip: Number(racer.slipCharge.toFixed(2)), padBoost: Number(racer.padBoostTime.toFixed(2)), stun: Number(racer.stunTime.toFixed(2)), hitGrace: Number(racer.hitCooldown.toFixed(2)), ultimate: Number(racer.ultimateTime.toFixed(2)), meter: Math.round(racer.ultimateMeter), signatureCooldown: Number(racer.signatureCooldown.toFixed(1)), items: racer.itemCharges })));
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
      surfaceText.textContent = charge >= 1.9 ? 'COSMIC DRIFT BOOST READY' : charge >= 1.18 ? 'GOLD DRIFT BOOST READY' : charge >= 0.58 ? 'BLUE DRIFT BOOST READY' : 'DRIFT · KEEP STEERING';
      boostFill.style.width = `${clamp(charge / 1.9, 0, 1) * 100}%`;
      boostFill.style.background = charge >= 1.9 ? '#d799ff' : charge >= 1.18 ? '#ffd075' : '#65dbf9';
    } else {
      surfaceText.textContent = player.slipCharge > 0.1 ? `DRAFTING · ${Math.round(player.slipCharge / 1.2 * 100)}%` : player.compassTime > 0 && player.compassTarget ? `COMPASS → ${player.compassTarget.route.toUpperCase()} SPARK` : road.onRoad ? road.point.route === 'main' ? 'ROAD' : `${road.point.route.toUpperCase()} ROUTE` : 'OFF ROAD';
      boostFill.style.width = `${clamp(Math.max(player.boostTime / 3, player.slipCharge / 1.2), 0, 1) * 100}%`;
      boostFill.style.background = '';
    }
    const def = CHARACTER_BY_ID[player.character];
    wishTile.querySelector('strong')!.textContent = def.signatureName.toUpperCase();
    wishTile.querySelector('small')!.textContent = this.wishHolding ? 'CHOOSE · RELEASE E' : player.signatureCooldown > 0 ? `RECHARGING · ${player.signatureCooldown.toFixed(1)}s` : player.character === 'genie' ? 'READY · HOLD E TO CHOOSE' : 'READY · PRESS E';
    signatureFill.style.width = `${clamp(1 - player.signatureCooldown / def.signatureCooldown, 0, 1) * 100}%`;
    wishTile.classList.toggle('cooling', player.signatureCooldown > 0);
    wishTile.classList.toggle('ready', player.signatureCooldown <= 0);
    ultimateTile.querySelector('strong')!.textContent = def.ultimateName.toUpperCase();
    ultimateTile.querySelector('small')!.textContent = player.ultimateTime > 0 ? `${player.ultimateTime.toFixed(1)}s ACTIVE` : player.ultimateMeter >= 100 ? 'READY · PRESS Q' : `CHARGING · ${Math.floor(player.ultimateMeter)}%`;
    ultimateFill.style.width = `${player.ultimateMeter}%`;
    ultimateTile.classList.toggle('active', player.ultimateTime > 0);
    ultimateTile.classList.toggle('ready', player.ultimateMeter >= 100 && player.ultimateTime <= 0);
    itemCaption.innerHTML = `RANDOM WISH ITEM · ${player.itemCharges} READY<br><small>R · BOOST / SHIELD / STAR SHOT</small>`;
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
    if (compass.compassTime > 0 && compass.compassTarget && !compass.compassTarget.collected) {
      const mark = mapPoint(compass.compassTarget.mesh.position);
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
