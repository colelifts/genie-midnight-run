import * as THREE from 'three';
import { CharacterKartVisual, type RaceVisual } from './characterKart';
import { CHARACTER_BY_ID, type CharacterId } from './characters';
import { KartVisual } from './kart';

export class RacerShowcase {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  private readonly turntable = new THREE.Group();
  private readonly keyLight = new THREE.DirectionalLight(0xffe8bd, 3);
  private readonly rimLight = new THREE.PointLight(0x8bdfff, 2.6, 16);
  private readonly accentLight = new THREE.PointLight(0xffc767, 2, 13);
  private readonly accentRing: THREE.Mesh;
  private visual: RaceVisual | null = null;
  private activeCharacter: CharacterId | null = null;
  private elapsed = 0;
  private renderTime = 0;
  private width = 0;
  private height = 0;

  constructor(private readonly canvas: HTMLCanvasElement, character: CharacterId) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.19;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(new THREE.HemisphereLight(0xc9dcff, 0x856f9b, 1.5));
    this.keyLight.position.set(-5, 10, 8);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(512, 512);
    this.keyLight.shadow.camera.left = -7;
    this.keyLight.shadow.camera.right = 7;
    this.keyLight.shadow.camera.top = 8;
    this.keyLight.shadow.camera.bottom = -7;
    this.scene.add(this.keyLight);
    this.rimLight.position.set(4, 5, -5);
    this.scene.add(this.rimLight);
    this.accentLight.position.set(-4, 2.2, 1);
    this.scene.add(this.accentLight);
    const stageMaterial = new THREE.MeshStandardMaterial({ color: 0x352849, metalness: 0.38, roughness: 0.42 });
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.55, 0.46, 64), stageMaterial);
    stage.position.y = -0.32;
    stage.receiveShadow = true;
    this.turntable.add(stage);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(4.14, 4.14, 0.05, 64), new THREE.MeshStandardMaterial({ color: 0x584064, metalness: 0.47, roughness: 0.4 }));
    top.position.y = -0.065;
    top.receiveShadow = true;
    this.turntable.add(top);
    this.accentRing = new THREE.Mesh(new THREE.TorusGeometry(4.22, 0.095, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffd681, toneMapped: false }));
    this.accentRing.rotation.x = Math.PI / 2;
    this.accentRing.position.y = -0.035;
    this.turntable.add(this.accentRing);
    for (let n = 0; n < 16; n++) {
      const angle = n * Math.PI / 8;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.04, 0.45), new THREE.MeshBasicMaterial({ color: 0xffe8b3, toneMapped: false }));
      tick.position.set(Math.sin(angle) * 3.82, -0.018, Math.cos(angle) * 3.82);
      tick.rotation.y = angle;
      this.turntable.add(tick);
    }
    this.scene.add(this.turntable);
    this.camera.position.set(7.6, 5.6, 10.5);
    this.camera.lookAt(0, 2, 0);
    this.select(character);
    this.resize();
  }

  select(character: CharacterId) {
    if (this.activeCharacter === character) return;
    if (this.visual) {
      this.turntable.remove(this.visual.group);
      this.visual.dispose();
    }
    this.activeCharacter = character;
    this.visual = character === 'genie' ? new KartVisual('gold') : new CharacterKartVisual(character);
    this.turntable.add(this.visual.group);
    const color = CHARACTER_BY_ID[character].accent;
    (this.accentRing.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.accentLight.color.setHex(color);
    this.rimLight.color.setHex(color);
    this.renderTime = 0;
  }

  resize() {
    const width = Math.max(1, Math.round(this.canvas.clientWidth));
    const height = Math.max(1, Math.round(this.canvas.clientHeight));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  update(dt: number) {
    this.elapsed += dt;
    this.renderTime += dt;
    if (this.renderTime < 1 / 30) return;
    const step = this.renderTime;
    this.renderTime = 0;
    this.resize();
    this.turntable.rotation.y = -0.16 + Math.sin(this.elapsed * 0.48) * 0.3;
    this.visual?.update(step, 5, Math.sin(this.elapsed * 0.7) * 0.18, false, false, false);
    this.renderer.render(this.scene, this.camera);
  }
}
