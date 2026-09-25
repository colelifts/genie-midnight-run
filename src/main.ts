import * as THREE from 'three';
import './style.css';
import { GameAudio } from './audio';
import { KartVisual, makeProjectile } from './kart';
import { MARKET_CROSSING_PROGRESS, marketCartState, PICKUP_LAYOUT, RaceTrack, touchesBoostPad, type RoadHit, type RoadPoint, type RouteName } from './track';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>('game');
const minimap = el<HTMLCanvasElement>('minimap');
const mapContext = minimap.getContext('2d')!;
const hud = el<HTMLDivElement>('hud');
const menu = el<HTMLDivElement>('menu');
const pause = el<HTMLDivElement>('pause');
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
const banner = el<HTMLDivElement>('banner');

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrap = (value: number) => ((value % 1) + 1) % 1;
const angleDiff = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
const formatLapTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;

type GameMode = 'menu' | 'countdown' | 'race' | 'paused';
type Wish = 'boost' | 'shield' | 'shot';

interface Racer {
  id: number;
  visual: KartVisual;
  position: THREE.Vector3;
  yaw: number;
  moveYaw: number;
  speed: number;
  progress: number;
  lap: number;
  boostTime: number;
  padBoostTime: number;
  shieldTime: number;
  ultimateTime: number;
  stunTime: number;
  hitCooldown: number;
  offTrackTime: number;
  lastPad: number;
  drifting: boolean;
  driftCharge: number;
  jumpTime: number;
  jumpDuration: number;
  jumpPower: number;
  lastSafe: THREE.Vector3;
  lastSafeProgress: number;
  aiRoute: RouteName;
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
}

interface Pickup {
  mesh: THREE.Group;
  position: THREE.Vector3;
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
  readonly pickups: Pickup[] = [];
  readonly pulses: Pulse[] = [];
  readonly flashes: Flash[] = [];
  readonly keys = new Set<string>();
  readonly touch = new Set<string>();
  readonly demoMode = new URLSearchParams(window.location.search).has('demo');
  mode: GameMode = 'menu';
  private elapsed = 0;
  private countdownElapsed = 0;
  private countShown = 4;
  private bannerTime = 0;
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
  private bestLap = Infinity;
  private cameraLook = new THREE.Vector3();
  private cameraDistance = 13.1;
  private cameraReady = false;
  private mapTransform = { centerX: 0, centerZ: 0, scale: 0.25 };
  private smoothedFps = 60;
  private lastFrame = performance.now();

  constructor() {
    try {
      const saved = Number(localStorage.getItem('genie-midnight-best-lap'));
      if (saved > 0 && Number.isFinite(saved)) this.bestLap = saved;
    } catch { /* Racing still works when browser storage is unavailable. */ }
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
    this.makePickups();
    this.bindInput();
    Object.defineProperty(window, '__kartDebug', {
      configurable: true,
      get: () => ({
        mode: this.mode,
        elapsed: Math.round(this.elapsed * 10) / 10,
        trackLength: Math.round(this.track.length),
        racers: this.racers.map((racer) => ({
          id: racer.id, lap: racer.lap, progress: Math.round(racer.progress * 1000) / 1000,
          speed: Math.round(racer.speed),
          position: racer.position.toArray().map((n) => Math.round(n * 10) / 10),
          stun: Math.round(racer.stunTime * 10) / 10,
          ultimate: Math.round(racer.ultimateTime * 10) / 10,
        })),
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
    return this.demoMode && Number.isFinite(demoStart) && demoStart >= 0 && demoStart < 1
      ? [demoStart, wrap(demoStart + 0.015), wrap(demoStart + 0.031)] : [0.006, 0.021, 0.037];
  }

  private makeRacers() {
    const starts = this.raceStarts();
    const accents: Array<'gold' | 'cyan' | 'violet'> = ['gold', 'cyan', 'violet'];
    const demoRoute = new URLSearchParams(window.location.search).get('demoRoute');
    for (let i = 0; i < 3; i++) {
      const start = this.track.at(starts[i]);
      const yaw = Math.atan2(start.tangent.x, start.tangent.z);
      const visual = new KartVisual(accents[i]);
      visual.group.position.copy(start.position);
      visual.group.rotation.y = yaw;
      this.scene.add(visual.group);
      const racer: Racer = {
        id: i, visual, position: start.position.clone(), yaw, moveYaw: yaw, speed: 0, progress: starts[i], lap: 1,
        boostTime: 0, padBoostTime: 0, shieldTime: 0, ultimateTime: 0, stunTime: 0, hitCooldown: 0, offTrackTime: 0, lastPad: 0,
        drifting: false, driftCharge: 0, jumpTime: 0, jumpDuration: 0, jumpPower: 0,
        lastSafe: start.position.clone(), lastSafeProgress: starts[i], aiRoute: i === 0 && this.demoMode && (demoRoute === 'alley' || demoRoute === 'roof' || demoRoute === 'garden') ? demoRoute : i === 1 ? 'alley' : i === 2 ? 'roof' : 'main',
        aiAbilityTimer: 10 + i * 5, aiUltimateTimer: 48 + i * 13, ultimateHit: new Set<number>(), steerVisual: 0,
      };
      this.racers.push(racer);
    }
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
      this.pickups.push({ mesh: group, position: group.position, baseY: group.position.y, respawn: 0, collected: false, phase: i * 1.7 });
    });
  }

  private bindInput() {
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyQ'];
    window.addEventListener('keydown', (event) => {
      if (gameKeys.includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.keys.add(event.code);
      if (event.code === 'Escape') {
        if (this.mode === 'race') this.pauseGame();
        else if (this.mode === 'paused') this.resumeGame();
      }
      if (this.mode !== 'race') return;
      if (event.code === 'KeyE') this.beginWish();
      if (event.code === 'KeyQ') this.activateUltimate(this.racers[0]);
      if (event.code === 'Digit1') this.useWish(this.racers[0], 'boost');
      if (event.code === 'Digit2') this.useWish(this.racers[0], 'shield');
      if (event.code === 'Digit3') this.useWish(this.racers[0], 'shot');
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      if (event.code === 'KeyE' && this.wishHolding) this.castWish();
    });
    window.addEventListener('blur', () => { this.keys.clear(); if (this.mode === 'race') this.pauseGame(); });
    el<HTMLButtonElement>('play').addEventListener('click', () => this.startRace());
    el<HTMLButtonElement>('resume').addEventListener('click', () => this.resumeGame());
    el<HTMLButtonElement>('restart').addEventListener('click', () => this.startRace());
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
        if (action === 'wish') this.beginWish();
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
    countdown.classList.remove('hidden');
    this.showBanner('GET READY', 2.2);
  }

  private resetRace() {
    this.lapClock = 0;
    const starts = this.raceStarts();
    this.racers.forEach((racer, i) => {
      const point = this.track.at(starts[i]);
      racer.position.copy(point.position);
      racer.yaw = Math.atan2(point.tangent.x, point.tangent.z);
      racer.moveYaw = racer.yaw;
      racer.speed = 0;
      racer.progress = starts[i];
      racer.lap = 1;
      racer.boostTime = racer.padBoostTime = racer.shieldTime = racer.ultimateTime = racer.stunTime = 0;
      racer.hitCooldown = racer.offTrackTime = racer.lastPad = 0;
      racer.drifting = false;
      racer.driftCharge = 0;
      racer.jumpTime = 0;
      racer.lastSafe.copy(point.position);
      racer.lastSafeProgress = starts[i];
      racer.aiAbilityTimer = 10 + i * 5;
      racer.aiUltimateTimer = 48 + i * 13;
      racer.ultimateHit.clear();
      racer.visual.group.position.copy(racer.position);
      racer.visual.group.rotation.y = racer.yaw;
      racer.visual.setShield(false);
      racer.visual.setUltimate(false);
      racer.visual.setStunned(false);
    });
    this.projectiles.forEach((projectile) => this.scene.remove(projectile.mesh));
    this.projectiles.length = 0;
    this.pulses.forEach((pulse) => this.scene.remove(pulse.mesh));
    this.pulses.length = 0;
    this.flashes.forEach((flash) => { this.scene.remove(flash.sprite); flash.sprite.material.dispose(); });
    this.flashes.length = 0;
    this.pickups.forEach((pickup) => { pickup.collected = false; pickup.mesh.visible = true; pickup.respawn = 0; });
    this.wishHolding = false;
    this.lastCartWarningCycle = -1;
    this.lastBirdSound = -10;
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
      if (wish && !this.gamepadWishHeld) this.beginWish();
      if (!wish && this.gamepadWishHeld && this.wishHolding) this.castWish();
      if (ultimate && !this.gamepadUltimateHeld) this.activateUltimate(this.racers[0]);
    }
    this.gamepadWishHeld = wish;
    this.gamepadUltimateHeld = ultimate;
  }

  private beginWish() {
    if (this.mode !== 'race' || this.wishHolding || this.racers[0].stunTime > 0) return;
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
    this.useWish(this.racers[0], choices[this.wishIndex]);
  }

  private useWish(racer: Racer, wish: Wish) {
    if (racer.stunTime > 0) return;
    if (wish === 'boost') {
      racer.boostTime = Math.max(racer.boostTime, 1.8);
      const ignition = racer.position.clone().add(new THREE.Vector3(0, 0.7, 0));
      this.burst(ignition, 0x55dfff, 0xffd56c, 18);
      if (racer.id === 0) this.showBanner('WISH: BOOST', 0.9);
      this.audio.play('boost');
    } else if (wish === 'shield') {
      racer.shieldTime = Math.max(racer.shieldTime, 4);
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
      this.projectiles.push({ owner: racer.id, mesh, velocity: direction.multiplyScalar(44), life: 3 });
      if (racer.id === 0) this.showBanner('WISH: STAR SHOT', 0.9);
      this.audio.play('shot');
    }
  }

  private activateUltimate(racer: Racer) {
    if (this.mode !== 'race' || racer.ultimateTime > 0 || racer.stunTime > 0) return;
    racer.ultimateTime = 5;
    racer.shieldTime = Math.max(racer.shieldTime, 5);
    racer.boostTime = Math.max(racer.boostTime, 5);
    if (racer.speed > 5) racer.speed = Math.max(racer.speed, 34);
    racer.ultimateHit.clear();
    racer.visual.setUltimate(true);
    if (racer.id === 0) this.showBanner('COSMIC SHOWSTOPPER!', 0.7);
    this.audio.play('ultimate');
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
    if (this.mode === 'race') { this.lapClock += dt; this.updateRace(dt); }
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
      this.audio.update(this.racers[0].speed, this.racers[0].drifting, this.racers[0].ultimateTime > 0, this.mode === 'race', this.track.zone(this.racers[0].progress));
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
    for (const racer of this.racers) this.updateRacerTimers(racer, dt);
    this.checkRacerCollisions();
    this.checkObstacleCollisions();
    this.updateProjectiles(dt);
    this.emitMagicTrails();
    for (const racer of this.racers) {
      racer.visual.group.position.copy(racer.position);
      racer.visual.group.rotation.y = racer.yaw;
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
    const maxSpeed = player.padBoostTime > 0 ? 53 : player.ultimateTime > 0 ? 41 : player.boostTime > 0 ? 40 : offRoad ? 20 : 31;
    if (accel > 0) player.speed += (player.padBoostTime > 0 ? 32 : player.ultimateTime > 0 ? 28 : 19) * accel * dt;
    else player.speed -= (player.speed > 0 ? 5.3 : 2.5) * dt;
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
    const turnRate = (1.5 - Math.min(Math.abs(player.speed) / 50, 0.5)) * (player.drifting ? 1.25 : 1) * boostHandling;
    player.yaw -= steer * turnRate * dt * Math.min(1, Math.abs(player.speed) / 6);
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
      player.speed = Math.min(player.speed, 20);
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
    const direction = target.position.clone().sub(racer.position);
    let targetYaw = Math.atan2(direction.x, direction.z);
    for (const obstacle of this.track.obstacles) {
      if (obstacle.broken) continue;
      const distance = racer.position.distanceTo(obstacle.position);
      if (distance < 13 && distance > 3 && Math.abs(angleDiff(Math.atan2(obstacle.position.x - racer.position.x, obstacle.position.z - racer.position.z), racer.yaw)) < 0.5) {
        targetYaw += racer.id === 1 ? 0.35 : -0.35;
      }
    }
    const error = angleDiff(targetYaw, racer.yaw);
    const steer = clamp(error * 2.4, -1, 1);
    racer.steerVisual = steer;
    racer.yaw += steer * (1.2 - Math.min(racer.speed / 100, 0.25)) * (racer.drifting ? 1.25 : 1) * (racer.padBoostTime > 0 ? 1.3 : 1) * dt;
    racer.moveYaw += angleDiff(racer.yaw, racer.moveYaw) * Math.min(1, dt * 5);
    let targetSpeed = 27 + racer.id * 0.6 + Math.sin(this.elapsed * 0.5 + racer.id) * 1.4;
    if (Math.abs(error) > 0.5) targetSpeed = 22;
    if (racer.boostTime > 0) targetSpeed = racer.ultimateTime > 0 ? 41 : 37;
    if (racer.padBoostTime > 0) targetSpeed = 49;
    if (racer.ultimateTime > 0) targetSpeed = 41;
    racer.speed += (targetSpeed - racer.speed) * Math.min(1, dt * (targetSpeed > racer.speed ? 1.2 : 2.2));
    racer.position.x += Math.sin(racer.moveYaw) * racer.speed * dt;
    racer.position.z += Math.cos(racer.moveYaw) * racer.speed * dt;
    this.followRoadHeight(racer, dt);
    const road = this.keepOnCourse(racer);
    this.updateProgress(racer, road.point.progress);
    if (!road.onRoad && racer.jumpTime <= 0) {
      racer.position.addScaledVector(road.point.position.clone().sub(racer.position), Math.min(1, dt * 2));
    }
    racer.aiAbilityTimer -= dt;
    if (racer.aiAbilityTimer <= 0) {
      racer.aiAbilityTimer = 11 + Math.random() * 8;
      this.useWish(racer, Math.random() > 0.4 ? 'boost' : 'shield');
    }
    racer.aiUltimateTimer -= dt;
    if (racer.aiUltimateTimer <= 0) {
      racer.aiUltimateTimer = 43 + Math.random() * 14;
      this.activateUltimate(racer);
    }
    this.checkPads(racer);
  }

  private followRoadHeight(racer: Racer, dt: number) {
    const road = this.track.nearest(racer.position, racer.progress);
    let jump = 0;
    if (racer.jumpTime > 0) {
      racer.jumpTime = Math.max(0, racer.jumpTime - dt);
      const phase = 1 - racer.jumpTime / racer.jumpDuration;
      jump = Math.sin(Math.PI * phase) * racer.jumpPower;
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
  }

  private releaseDrift(racer: Racer) {
    racer.drifting = false;
    const charge = racer.driftCharge;
    racer.driftCharge = 0;
    if (charge < 0.58) return;
    const stage = charge >= 1.9 ? 3 : charge >= 1.18 ? 2 : 1;
    racer.boostTime = Math.max(racer.boostTime, [0, 0.65, 1.2, 1.8][stage]);
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
        this.sparks.spawn(position, velocity, racer.ultimateTime > 0 && tick % 3 === 0 ? 0xffdb70 : 0x51e7ff, 0.36);
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
        this.startJump(racer, 0.7, 1.15);
        this.makePulse(racer.position, 0x6feeff, 0.65, 5.2);
        this.burst(racer.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0x75edff, 0xffd675, 22);
        if (racer.id === 0) { this.showBanner(pad.halfWidth < 8 ? 'APEX CARPET BOOST!' : 'MAGIC CARPET BOOST', 1.1); this.audio.play('pad'); }
        break;
      }
    }
  }

  private updateRacerTimers(racer: Racer, dt: number) {
    racer.boostTime = Math.max(0, racer.boostTime - dt);
    racer.padBoostTime = Math.max(0, racer.padBoostTime - dt);
    racer.shieldTime = Math.max(0, racer.shieldTime - dt);
    racer.ultimateTime = Math.max(0, racer.ultimateTime - dt);
    racer.stunTime = Math.max(0, racer.stunTime - dt);
    racer.hitCooldown = Math.max(0, racer.hitCooldown - dt);
    racer.lastPad = Math.max(0, racer.lastPad - dt);
  }

  private updateProgress(racer: Racer, progress: number) {
    const before = racer.progress;
    if (before > 0.84 && progress < 0.16 && racer.speed > 0) {
      racer.lap++;
      if (racer.id === 0) {
        const lapTime = this.lapClock;
        this.lapClock = 0;
        const isBest = !this.demoMode && lapTime < this.bestLap;
        if (isBest) {
          this.bestLap = lapTime;
          try { localStorage.setItem('genie-midnight-best-lap', String(lapTime)); } catch { /* Storage is optional. */ }
        }
        this.showBanner(isBest ? `NEW BEST LAP · ${formatLapTime(lapTime)}` : `LAP ${racer.lap} · ${formatLapTime(lapTime)}`, 2);
        this.audio.play('lap');
      }
    } else if (before < 0.16 && progress > 0.84 && racer.speed < 0) {
      racer.lap = Math.max(1, racer.lap - 1);
    }
    racer.progress = progress;
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
        if (a.ultimateTime > 0 && !a.ultimateHit.has(b.id)) {
          this.stun(b, 1.25, true);
          const impact = b.position.clone().add(new THREE.Vector3(0, 1.8, 0));
          this.makeFlash(impact, 0x8befff, 5.5, 0.42);
          this.burst(impact, 0x7ceaff, 0xffd876, 24);
          a.ultimateHit.add(b.id);
          b.position.addScaledVector(normal, 2.3);
          if (a.id === 0) this.showBanner('COSMIC KNOCKOUT!', 1.2);
        }
        if (b.ultimateTime > 0 && !b.ultimateHit.has(a.id)) {
          this.stun(a, 1.25, true);
          const impact = a.position.clone().add(new THREE.Vector3(0, 1.8, 0));
          this.makeFlash(impact, 0x8befff, 5.5, 0.42);
          this.burst(impact, 0x7ceaff, 0xffd876, 24);
          b.ultimateHit.add(a.id);
          a.position.addScaledVector(normal, -2.3);
          if (a.id === 0) this.showBanner('STUNNED!', 1.1);
        }
        if (a.ultimateTime <= 0 && b.ultimateTime <= 0 && a.hitCooldown <= 0 && b.hitCooldown <= 0) {
          a.speed *= 0.88;
          b.speed *= 0.88;
          a.hitCooldown = b.hitCooldown = 0.35;
          if (a.id === 0) this.audio.play('hit');
        }
      }
    }
  }

  private stun(racer: Racer, duration: number, ignoreShield = false) {
    if (!ignoreShield && (racer.shieldTime > 0 || racer.ultimateTime > 0)) {
      const impact = racer.position.clone().add(new THREE.Vector3(0, 1.8, 0));
      this.makeFlash(impact, 0xffd98c, 5, 0.38);
      this.burst(impact, 0xffe8b0, 0x7de8ff, 20);
      if (racer.ultimateTime <= 0) racer.shieldTime = 0;
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
          if (racer.ultimateTime <= 0) racer.speed *= 0.58;
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
          racer.speed *= obstacle.kind === 'boulder' ? 0.38 : 0.55;
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
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      projectile.mesh.children[0].rotation.y += dt * 8;
      for (let spark = 0; spark < 2; spark++) {
        const velocity = projectile.velocity.clone().multiplyScalar(-0.17).add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4));
        this.sparks.spawn(projectile.mesh.position, velocity, spark === 0 ? 0xffd676 : 0xff5264, 0.32 + Math.random() * 0.18);
      }
      let remove = projectile.life <= 0;
      for (const racer of this.racers) {
        if (racer.id === projectile.owner || racer.stunTime > 0) continue;
        if (racer.position.distanceTo(projectile.mesh.position) < 2.8) {
          this.stun(racer, 0.85);
          this.makeFlash(projectile.mesh.position, 0xff8b68, 3.6, 0.3);
          this.burst(projectile.mesh.position, 0xffc46e, 0xff5264, 15);
          this.makePulse(projectile.mesh.position, 0xff526e, 0.32, 1.5);
          if (projectile.owner === 0) this.showBanner('STAR HIT!', 1);
          remove = true;
          break;
        }
      }
      if (remove) {
        this.scene.remove(projectile.mesh);
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
              const upgraded = Math.random() < 0.12;
              racer.boostTime = Math.max(racer.boostTime, upgraded ? 2.4 : 0.65);
              if (upgraded) racer.shieldTime = Math.max(racer.shieldTime, 2);
              const sparkle = racer.position.clone().add(new THREE.Vector3(0, 1.4, 0));
              this.makePulse(racer.position, upgraded ? 0xffd778 : 0x82eaff, 0.5, upgraded ? 4.4 : 2.8);
              this.burst(sparkle, upgraded ? 0xffd778 : 0x89eeff, 0xfff0bd, upgraded ? 20 : 10);
              if (racer.id === 0) {
                this.showBanner(upgraded ? 'PHENOMENAL POWER · UPGRADED!' : 'WISH SPARK!', 0.9);
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
    hud.dataset.state = JSON.stringify(this.racers.map((racer) => ({ id: racer.id, lap: racer.lap, p: Number(racer.progress.toFixed(3)), x: Number(racer.position.x.toFixed(2)), y: Number(racer.position.y.toFixed(2)), z: Number(racer.position.z.toFixed(2)), yaw: Number(racer.yaw.toFixed(3)), route: this.track.nearest(racer.position, racer.progress).point.route, speed: Math.round(racer.speed), drift: Number(racer.driftCharge.toFixed(2)), padBoost: Number(racer.padBoostTime.toFixed(2)), stun: Number(racer.stunTime.toFixed(2)), hitGrace: Number(racer.hitCooldown.toFixed(2)), ultimate: Number(racer.ultimateTime.toFixed(2)) })));
    const standings = [...this.racers].sort((a, b) => (b.lap - 1 + b.progress) - (a.lap - 1 + a.progress));
    const rank = standings.findIndex((racer) => racer.id === 0) + 1;
    const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd';
    positionText.innerHTML = `${rank}<span>${suffix}</span><em> / 3</em>`;
    lapText.textContent = `LAP ${player.lap} · ENDLESS`;
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
      surfaceText.textContent = road.onRoad ? road.point.route === 'main' ? 'ROAD' : `${road.point.route.toUpperCase()} ROUTE` : 'OFF ROAD';
      boostFill.style.width = `${clamp(player.boostTime / 3, 0, 1) * 100}%`;
      boostFill.style.background = '';
    }
    wishTile.querySelector('small')!.textContent = this.wishHolding ? 'CHOOSE · RELEASE E' : player.ultimateTime > 0 ? 'ULTIMATE ACTIVE · NO COOLDOWN' : player.shieldTime > 0 ? 'SHIELD ACTIVE · NO COOLDOWN' : 'HOLD E · RELEASE TO CHOOSE';
    ultimateTile.querySelector('small')!.textContent = player.ultimateTime > 0 ? `${player.ultimateTime.toFixed(1)}s ACTIVE` : 'READY · NO COOLDOWN';
    ultimateTile.classList.toggle('active', player.ultimateTime > 0);
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
    for (const racer of this.racers) {
      const screen = mapPoint(racer.position);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, racer.id === 0 ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = racer.id === 0 ? '#56dafa' : racer.id === 1 ? '#ffc56d' : '#c396f9';
      ctx.fill();
      ctx.strokeStyle = '#172341';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

new GenieRace();
