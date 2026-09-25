import * as THREE from 'three';

const blueSkin = new THREE.MeshLambertMaterial({ color: 0x3689d7, flatShading: true });
const lightBlue = new THREE.MeshLambertMaterial({ color: 0x65bbef, flatShading: true });
const darkHair = new THREE.MeshLambertMaterial({ color: 0x172440, flatShading: true });
const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xfff9eb });
const pupil = new THREE.MeshBasicMaterial({ color: 0x101a38 });
const smile = new THREE.MeshBasicMaterial({ color: 0x24233e });
const gold = new THREE.MeshLambertMaterial({ color: 0xe8ad42, metalness: 0.12, flatShading: true } as THREE.MeshLambertMaterialParameters);
const goldLight = new THREE.MeshLambertMaterial({ color: 0xffd67b, flatShading: true });
const tire = new THREE.MeshLambertMaterial({ color: 0x25273a, flatShading: true });
const purple = new THREE.MeshLambertMaterial({ color: 0x70448f, flatShading: true });
const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x40dbfa });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.castShadow = true;
  return item;
}

function sphere(radius: number, material: THREE.Material, x = 0, y = 0, z = 0, segments = 10) {
  return mesh(new THREE.SphereGeometry(radius, segments, 7), material, x, y, z);
}

function starGeometry(outer: number, inner: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 === 0 ? outer : inner;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function createGenieFigure(): THREE.Group {
  const figure = new THREE.Group();
  const torso = sphere(0.76, blueSkin, 0, 1.12, -0.15);
  torso.scale.set(1.04, 1.08, 0.75);
  figure.add(torso);
  const sash = mesh(new THREE.CylinderGeometry(0.6, 0.53, 0.18, 9), purple, 0, 0.68, -0.15);
  figure.add(sash);
  const neck = mesh(new THREE.CylinderGeometry(0.34, 0.39, 0.42, 8), blueSkin, 0, 1.9, -0.12);
  figure.add(neck);
  const head = sphere(0.72, blueSkin, 0, 2.42, -0.06, 11);
  head.scale.set(0.92, 1.04, 0.9);
  figure.add(head);
  const chin = sphere(0.37, blueSkin, 0, 2.02, 0.31, 8);
  chin.scale.set(1.05, 0.68, 0.72);
  figure.add(chin);
  const hair = sphere(0.31, darkHair, 0, 3.14, -0.25, 8);
  hair.scale.set(0.88, 1.4, 1.2);
  figure.add(hair);
  const tuft = mesh(new THREE.ConeGeometry(0.31, 0.65, 7), darkHair, 0.04, 3.56, -0.45);
  tuft.rotation.x = -0.58;
  figure.add(tuft);
  const beard = mesh(new THREE.ConeGeometry(0.22, 0.62, 7), darkHair, 0, 1.77, 0.43);
  beard.rotation.x = Math.PI;
  figure.add(beard);
  for (const side of [-1, 1]) {
    const ear = sphere(0.22, blueSkin, side * 0.68, 2.39, 0, 7);
    ear.scale.x = 0.6;
    figure.add(ear);
    const eye = sphere(0.21, eyeWhite, side * 0.25, 2.5, 0.53, 8);
    eye.scale.set(0.74, 1.15, 0.35);
    figure.add(eye);
    const iris = sphere(0.09, pupil, side * 0.26, 2.47, 0.62, 7);
    iris.scale.z = 0.38;
    figure.add(iris);
    const brow = sphere(0.19, darkHair, side * 0.25, 2.76, 0.49, 7);
    brow.scale.set(1, 0.21, 0.3);
    brow.rotation.z = side * -0.16;
    figure.add(brow);
    const upperArm = sphere(0.29, blueSkin, side * 0.74, 1.46, -0.05, 8);
    upperArm.scale.set(0.78, 1.18, 0.78);
    upperArm.rotation.z = side * 0.36;
    figure.add(upperArm);
    const forearm = sphere(0.25, lightBlue, side * 0.86, 0.99, 0.37, 8);
    forearm.scale.set(0.78, 1.1, 0.83);
    forearm.rotation.x = -0.55;
    figure.add(forearm);
    const cuff = mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.22, 8), goldLight, side * 0.91, 0.75, 0.57);
    cuff.rotation.x = -0.45;
    figure.add(cuff);
    const hand = sphere(0.24, blueSkin, side * 0.92, 0.63, 0.73, 7);
    figure.add(hand);
  }
  const nose = sphere(0.14, blueSkin, 0, 2.28, 0.61, 7);
  nose.scale.z = 1.35;
  figure.add(nose);
  const mouth = sphere(0.24, smile, 0, 2.04, 0.52, 8);
  mouth.scale.set(1, 0.15, 0.12);
  figure.add(mouth);
  return figure;
}

function makeBird(): THREE.Group {
  const bird = new THREE.Group();
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xfef3d6, side: THREE.DoubleSide });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(0.35, 0.16);
  wingShape.lineTo(0.62, 0.04);
  wingShape.lineTo(0.28, -0.08);
  wingShape.closePath();
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const a = new THREE.Mesh(wingGeo, wingMat);
  const b = new THREE.Mesh(wingGeo, wingMat);
  b.scale.x = -1;
  bird.add(a, b);
  return bird;
}

export class KartVisual {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly wheels: THREE.Group[] = [];
  readonly shield: THREE.Mesh;
  readonly ghost: THREE.Group;
  readonly stunHalo = new THREE.Group();
  readonly driver: THREE.Group;
  private readonly exhaust: THREE.Mesh[] = [];
  private elapsed = 0;

  constructor(accent: 'gold' | 'cyan' | 'violet' = 'gold') {
    const trim = accent === 'cyan' ? new THREE.MeshLambertMaterial({ color: 0x67dce6, flatShading: true })
      : accent === 'violet' ? new THREE.MeshLambertMaterial({ color: 0xc29cf3, flatShading: true }) : goldLight;
    const chassis = mesh(new THREE.BoxGeometry(2.6, 0.45, 3.55), tire, 0, 0.82, 0);
    this.body.add(chassis);
    const lampBody = sphere(1.3, gold, 0, 1.31, -0.1, 12);
    lampBody.scale.set(1.22, 0.57, 1.38);
    this.body.add(lampBody);
    const rimTop = mesh(new THREE.CylinderGeometry(0.76, 0.89, 0.16, 10), goldLight, 0, 1.72, -0.25);
    this.body.add(rimTop);
    const spout = mesh(new THREE.CylinderGeometry(0.32, 0.52, 1.9, 9), gold, 0, 1.37, 1.69);
    spout.rotation.x = Math.PI / 2;
    spout.rotation.z = -0.1;
    this.body.add(spout);
    const tip = sphere(0.38, goldLight, 0, 1.51, 2.57, 8);
    tip.scale.set(1.3, 0.6, 0.7);
    this.body.add(tip);
    const handle = mesh(new THREE.TorusGeometry(0.7, 0.23, 6, 12), gold, -0.78, 1.45, -1.45);
    handle.rotation.y = Math.PI / 2;
    this.body.add(handle);
    const seat = mesh(new THREE.BoxGeometry(1.55, 0.34, 1.3), purple, 0, 1.79, -0.65);
    this.body.add(seat);
    const seatBack = mesh(new THREE.BoxGeometry(1.6, 0.9, 0.3), purple, 0, 2.17, -1.22);
    seatBack.rotation.x = -0.12;
    this.body.add(seatBack);
    const lampCap = mesh(new THREE.CylinderGeometry(0.18, 0.27, 0.34, 8), trim, 0, 1.99, -1.6);
    this.body.add(lampCap);
    const lampKnob = sphere(0.2, trim, 0, 2.21, -1.6, 8);
    this.body.add(lampKnob);
    const lantern = mesh(new THREE.BoxGeometry(0.54, 0.8, 0.3), gold, 0, 1.21, -1.93);
    this.body.add(lantern);
    const lanternGlow = mesh(new THREE.BoxGeometry(0.35, 0.52, 0.34), new THREE.MeshBasicMaterial({ color: 0xffd679 }), 0, 1.2, -2.08);
    this.body.add(lanternGlow);

    this.driver = createGenieFigure();
    this.driver.position.set(0, 1.69, -0.56);
    this.driver.scale.setScalar(0.72);
    this.body.add(this.driver);
    for (const x of [-1.45, 1.45]) {
      for (const z of [-1.25, 1.25]) {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(x, 0.75, z);
        const tyreMesh = mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.46, 10), tire);
        tyreMesh.rotation.z = Math.PI / 2;
        wheelGroup.add(tyreMesh);
        const hub = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.49, 8), trim);
        hub.rotation.z = Math.PI / 2;
        wheelGroup.add(hub);
        this.wheels.push(wheelGroup);
        this.group.add(wheelGroup);
      }
    }
    for (const x of [-0.7, 0.7]) {
      const exhaust = sphere(0.23, cyanGlow, x, 0.99, -2.1, 7);
      exhaust.scale.set(0.7, 0.7, 1.1);
      this.exhaust.push(exhaust);
      this.body.add(exhaust);
    }
    const underglow = mesh(new THREE.CylinderGeometry(1.1, 1.35, 0.09, 10), new THREE.MeshBasicMaterial({ color: 0x31cde5, transparent: true, opacity: 0.65 }), 0, 0.26, 0);
    this.body.add(underglow);
    this.group.add(this.body);

    this.shield = mesh(new THREE.SphereGeometry(2.75, 14, 10), new THREE.MeshBasicMaterial({ color: 0x61e1fa, transparent: true, opacity: 0.21, depthWrite: false, side: THREE.DoubleSide }), 0, 1.8, 0);
    this.shield.visible = false;
    this.group.add(this.shield);

    this.ghost = new THREE.Group();
    const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0x75bcff, transparent: true, opacity: 0.27, depthWrite: false, side: THREE.DoubleSide });
    const ghostBody = sphere(1.65, ghostMaterial, 0, 1.6, 0, 9);
    ghostBody.scale.set(1.18, 1.08, 0.75);
    const ghostHead = sphere(1.1, ghostMaterial, 0, 3.55, 0.15, 9);
    const ghostHair = mesh(new THREE.ConeGeometry(0.55, 1.4, 7), ghostMaterial, 0, 5.05, -0.27);
    ghostHair.rotation.x = -0.38;
    this.ghost.add(ghostBody, ghostHead, ghostHair);
    for (const side of [-1, 1]) {
      const arm = sphere(0.66, ghostMaterial, side * 1.62, 2.55, 0, 8);
      arm.scale.set(0.8, 1.55, 0.78);
      arm.rotation.z = -side * 0.45;
      this.ghost.add(arm);
    }
    this.ghost.position.set(0, 3.6, -0.4);
    this.ghost.scale.setScalar(0.85);
    this.ghost.visible = false;
    this.group.add(this.ghost);

    const starGeo = starGeometry(0.34, 0.14);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffdf69, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(Math.sin(i * Math.PI * 2 / 3) * 0.9, 0.1 * i, Math.cos(i * Math.PI * 2 / 3) * 0.9);
      this.stunHalo.add(star);
    }
    for (let i = 0; i < 2; i++) {
      const bird = makeBird();
      bird.position.set(Math.sin((i + 0.5) * Math.PI) * 1.15, 0.25, Math.cos((i + 0.5) * Math.PI) * 1.15);
      bird.scale.setScalar(0.75);
      this.stunHalo.add(bird);
    }
    this.stunHalo.position.y = 4.55;
    this.stunHalo.visible = false;
    this.group.add(this.stunHalo);
  }

  setShield(active: boolean) { this.shield.visible = active; }
  setUltimate(active: boolean) { this.ghost.visible = active; }
  setStunned(active: boolean) { this.stunHalo.visible = active; }

  update(dt: number, speed: number, steer: number, drifting: boolean, boosting: boolean, stunned: boolean) {
    this.elapsed += dt;
    for (const wheel of this.wheels) wheel.rotation.x += speed * dt / 0.72;
    const lean = Math.max(-0.12, Math.min(0.12, -steer * (drifting ? 0.12 : 0.07)));
    this.body.rotation.z += (lean - this.body.rotation.z) * Math.min(1, dt * 7);
    this.body.position.y = 0.03 + Math.sin(this.elapsed * (3.5 + speed * 0.11)) * (speed > 1 ? 0.035 : 0.015);
    this.driver.rotation.y = Math.sin(this.elapsed * 1.5) * 0.03 + steer * 0.06;
    this.ghost.position.y = 3.6 + Math.sin(this.elapsed * 4) * 0.2;
    this.stunHalo.rotation.y += dt * 4;
    this.stunHalo.position.y = 4.55 + Math.sin(this.elapsed * 8) * 0.12;
    for (const exhaust of this.exhaust) exhaust.scale.z = boosting ? 2.4 + Math.sin(this.elapsed * 20) * 0.3 : 0.8 + speed / 55;
    if (stunned) this.body.rotation.y = Math.sin(this.elapsed * 12) * 0.25;
    else this.body.rotation.y *= Math.max(0, 1 - dt * 8);
  }
}

export function makeProjectile(): THREE.Group {
  const group = new THREE.Group();
  const core = sphere(0.38, new THREE.MeshBasicMaterial({ color: 0xffd56d }), 0, 0, 0, 8);
  group.add(core);
  const glowRing = mesh(new THREE.TorusGeometry(0.54, 0.08, 5, 12), new THREE.MeshBasicMaterial({ color: 0x81e5ff }));
  group.add(glowRing);
  const star = mesh(starGeometry(0.63, 0.25), new THREE.MeshBasicMaterial({ color: 0xfff2a7, side: THREE.DoubleSide }));
  star.position.z = 0.1;
  group.add(star);
  return group;
}
