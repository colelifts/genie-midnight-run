import * as THREE from 'three';
import { CHARACTER_BY_ID, type CharacterId } from './characters';

const paint = (color: number, metalness = 0.08, roughness = 0.48) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
const glow = (color: number, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, toneMapped: false, side: THREE.DoubleSide });
const dark = paint(0x242536, 0.04, 0.85);
const cream = paint(0xffe9c7);
const white = paint(0xf5f4ee);
const eye = glow(0x1a2440);

function add(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
const ball = (parent: THREE.Group, radius: number, material: THREE.Material, x: number, y: number, z: number, widthSegments = 16) =>
  add(parent, new THREE.SphereGeometry(radius, widthSegments, 12), material, x, y, z);
const box = (parent: THREE.Group, width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number) =>
  add(parent, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
const cone = (parent: THREE.Group, radius: number, height: number, material: THREE.Material, x: number, y: number, z: number, sides = 12) =>
  add(parent, new THREE.ConeGeometry(radius, height, sides), material, x, y, z);

function curvedFlame(parent: THREE.Group, material: THREE.Material, x: number, baseY: number, z: number, radius: number, height: number, curlX: number, curlZ: number) {
  const geometry = new THREE.ConeGeometry(radius, height, 10, 5);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const rise = Math.max(0, Math.min(1, (positions.getY(i) + height / 2) / height));
    positions.setXYZ(i, positions.getX(i) + curlX * rise * rise, positions.getY(i), positions.getZ(i) + curlZ * rise * rise);
  }
  geometry.computeVertexNormals();
  const flame = add(parent, geometry, material, x, baseY + height / 2, z);
  flame.castShadow = false;
  flame.receiveShadow = false;
  flame.userData.hadesFlamePhase = x * 7 + z * 11 + height * 2;
  return flame;
}

function branch(parent: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material) {
  const direction = to.clone().sub(from);
  const part = add(parent, new THREE.CylinderGeometry(radius * 0.87, radius, direction.length(), 10), material);
  part.position.copy(from).add(to).multiplyScalar(0.5);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return part;
}

function figure(id: CharacterId) {
  const root = new THREE.Group();
  const model = CHARACTER_BY_ID[id];
  const suit = paint(id === 'hades' ? 0x34374e : model.color, 0.04, 0.66);
  const accent = paint(model.accent, 0.25, 0.4);
  const skin = paint(id === 'stitch' ? 0x447bd6 : id === 'hades' ? 0x6b9fe0 : id === 'maleficent' ? 0xb4b4b0 : id === 'mickey' ? 0x202532 : id === 'elsa' ? 0xf9ddcf : id === 'moana' ? 0xc58964 : id === 'jack' ? 0xb48662 : id === 'mulan' ? 0xd8a27c : 0xf2c7ac);
  const hair = paint(id === 'elsa' ? 0xf3e7c1 : id === 'hades' ? 0x54d8ff : id === 'stitch' ? 0x31558b : 0x252238, 0.02, 0.7);
  const torso = ball(root, 0.78, suit, 0, 1.2, -0.08);
  torso.scale.set(1, 0.96, 0.69);
  const neck = ball(root, 0.27, skin, 0, 1.83, 0.03);
  neck.scale.y = 1.1;
  const head = ball(root, id === 'stitch' ? 0.76 : 0.68, skin, 0, 2.43, 0);
  head.scale.set(id === 'stitch' ? 1.05 : 0.95, id === 'stitch' ? 0.75 : 1.04, 0.84);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Vector3(side * 0.68, 1.55, 0.02);
    const elbow = new THREE.Vector3(side * 1.06, 1.04, 0.35);
    const hand = new THREE.Vector3(side * 0.88, 0.77, 0.86);
    ball(root, 0.28, suit, shoulder.x, shoulder.y, shoulder.z);
    branch(root, shoulder, elbow, 0.25, suit);
    branch(root, elbow, hand, 0.21, id === 'mickey' || id === 'buzz' ? white : skin);
    ball(root, 0.24, id === 'mickey' || id === 'buzz' ? white : skin, hand.x, hand.y, hand.z);
    if (id !== 'mickey' && id !== 'stitch' && id !== 'buzz') {
      const eyeWhite = ball(root, 0.13, white, side * 0.23, 2.47, 0.53);
      eyeWhite.scale.set(0.86, 1.16, 0.4);
      ball(root, 0.067, eye, side * 0.23, 2.45, 0.61).scale.z = 0.58;
      ball(root, 0.024, white, side * 0.205, 2.49, 0.65).scale.z = 0.36;
      branch(root, new THREE.Vector3(side * 0.13, 2.68, 0.53), new THREE.Vector3(side * 0.34, id === 'maleficent' ? 2.73 : 2.66, 0.5), 0.042, hair);
      const cheek = ball(root, 0.1, skin, side * 0.43, 2.21, 0.43);
      cheek.scale.set(0.88, 0.56, 0.54);
      ball(root, 0.14, skin, side * 0.59, 2.34, -0.02).scale.set(0.47, 1, 0.6);
    }
  }
  if (id !== 'mickey' && id !== 'stitch' && id !== 'buzz') {
    const nose = ball(root, 0.115, skin, 0, 2.25, 0.6);
    nose.scale.set(0.73, 1.08, 0.85);
    const smile = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.16, 2.08, 0.57),
      new THREE.Vector3(0, id === 'hades' || id === 'maleficent' ? 2.09 : 2.045, 0.625),
      new THREE.Vector3(0.16, 2.08, 0.57),
    ]);
    add(root, new THREE.TubeGeometry(smile, 8, 0.026, 5, false), eye);
  }
  if (id === 'mickey') {
    ball(root, 0.33, paint(0x202532), -0.62, 2.95, -0.14).scale.z = 0.45;
    ball(root, 0.33, paint(0x202532), 0.62, 2.95, -0.14).scale.z = 0.45;
    ball(root, 0.55, paint(0x202532), 0, 2.49, -0.11);
    ball(root, 0.43, cream, 0, 2.28, 0.38).scale.set(1, 0.76, 0.42);
    for (const side of [-1, 1]) {
      ball(root, 0.14, white, side * 0.2, 2.55, 0.44).scale.z = 0.32;
      ball(root, 0.07, eye, side * 0.2, 2.52, 0.5);
    }
    ball(root, 0.16, dark, 0, 2.27, 0.62);
    const smile = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.28, 2.15, 0.52), new THREE.Vector3(0, 2.02, 0.58), new THREE.Vector3(0.28, 2.15, 0.52)]);
    add(root, new THREE.TubeGeometry(smile, 10, 0.035, 6, false), eye);
    box(root, 0.95, 0.34, 0.7, paint(0xc52e38), 0, 0.87, -0.03);
    for (const side of [-1, 1]) ball(root, 0.09, paint(0xffd56e), side * 0.23, 1.01, 0.34);
  } else if (id === 'stitch') {
    for (const side of [-1, 1]) {
      const ear = ball(root, 0.58, skin, side * 0.86, 2.6, -0.08);
      ear.scale.set(0.4, 1.12, 0.34);
      ear.rotation.z = side * -0.55;
      const inner = ball(root, 0.42, paint(0xd97da8), side * 0.9, 2.62, 0.2);
      inner.scale.set(0.28, 0.86, 0.18);
      inner.rotation.z = side * -0.55;
      ball(root, 0.2, dark, side * 0.22, 2.48, 0.49).scale.z = 0.35;
      ball(root, 0.08, white, side * 0.17, 2.53, 0.56);
    }
    ball(root, 0.21, dark, 0, 2.2, 0.58).scale.set(1.25, 0.8, 0.86);
    const grin = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.28, 2.05, 0.47), new THREE.Vector3(0, 1.98, 0.52), new THREE.Vector3(0.28, 2.05, 0.47)]);
    add(root, new THREE.TubeGeometry(grin, 10, 0.035, 6, false), eye);
    ball(root, 0.55, paint(0x9bc2e5), 0, 1.2, 0.45).scale.set(0.65, 0.75, 0.22);
  } else if (id === 'elsa') {
    ball(root, 0.7, hair, 0, 2.66, -0.19).scale.set(0.98, 0.75, 0.7);
    branch(root, new THREE.Vector3(-0.39, 2.82, 0.22), new THREE.Vector3(0.26, 2.65, 0.48), 0.12, hair);
    const braid = new THREE.CatmullRomCurve3([new THREE.Vector3(0.32, 2.65, -0.4), new THREE.Vector3(0.6, 2.28, -0.46), new THREE.Vector3(0.74, 1.84, -0.15), new THREE.Vector3(0.78, 1.45, 0.27)]);
    add(root, new THREE.TubeGeometry(braid, 18, 0.19, 8, false), hair);
    const cape = cone(root, 0.84, 1.6, paint(0xbdeefa, 0.08, 0.68), 0, 0.95, -0.47);
    cape.scale.z = 0.42;
    for (let n = 0; n < 3; n++) {
      const crystal = cone(root, 0.2, 0.45, glow(0xe5ffff, 0.75), (n - 1) * 0.42, 1.36, 0.54);
      crystal.rotation.z = (n - 1) * 0.22;
    }
  } else if (id === 'moana') {
    const ocean = paint(0x3dafa7, 0.08, 0.47);
    const coral = paint(0xc94f44, 0.04, 0.72);
    const shell = paint(0xf8e5b7, 0.12, 0.43);
    ball(root, 0.78, hair, 0, 2.44, -0.31).scale.set(1.14, 1.24, 0.79);
    for (const side of [-1, 1]) {
      const lock = ball(root, 0.34, hair, side * 0.52, 1.97, -0.22);
      lock.scale.set(0.69, 1.65, 0.7);
      lock.rotation.z = side * 0.18;
      const frontLock = ball(root, 0.2, hair, side * 0.53, 2.5, 0.22);
      frontLock.scale.set(0.84, 1.54, 0.65);
      frontLock.rotation.z = side * 0.28;
      branch(root, new THREE.Vector3(side * 0.2, 1.75, 0.5), new THREE.Vector3(side * 0.09, 1.56, 0.59), 0.034, shell);
    }
    ball(root, 0.22, hair, -0.22, 2.91, 0.13).scale.set(1.45, 0.45, 0.7);
    box(root, 0.92, 0.35, 0.72, coral, 0, 1.27, 0.23);
    for (let n = -2; n <= 2; n++) {
      const tooth = box(root, 0.13, 0.09, 0.05, shell, n * 0.19, 1.46, 0.62);
      tooth.rotation.z = n * 0.08;
    }
    const pendant = ball(root, 0.16, ocean, 0, 1.53, 0.67);
    pendant.scale.set(0.72, 1.07, 0.47);
    ball(root, 0.065, glow(0x7df0d2), 0, 1.55, 0.75).scale.z = 0.3;
    const skirt = cone(root, 0.7, 0.75, paint(0xe6d5ac), 0, 0.76, -0.06);
    skirt.scale.z = 0.7;
    for (const side of [-1, 1]) box(root, 0.3, 0.12, 0.08, ocean, side * 0.26, 0.89, 0.48).rotation.z = side * 0.28;
  } else if (id === 'buzz') {
    ball(root, 0.73, white, 0, 1.23, -0.02).scale.set(1.05, 0.88, 0.76);
    const helmet = ball(root, 0.78, new THREE.MeshPhongMaterial({ color: 0xe4faff, transparent: true, opacity: 0.26, depthWrite: false, shininess: 96 }), 0, 2.42, 0);
    helmet.castShadow = false;
    const cowl = ball(root, 0.59, paint(0x7753a7, 0.08, 0.43), 0, 2.62, -0.2);
    cowl.scale.set(0.98, 0.67, 0.76);
    ball(root, 0.62, skin, 0, 2.38, 0).scale.set(0.9, 1, 0.85);
    for (const side of [-1, 1]) {
      const faceEye = ball(root, 0.115, white, side * 0.21, 2.45, 0.52);
      faceEye.scale.set(0.82, 1.1, 0.36);
      ball(root, 0.055, eye, side * 0.21, 2.43, 0.565);
      branch(root, new THREE.Vector3(side * 0.12, 2.63, 0.48), new THREE.Vector3(side * 0.32, 2.62, 0.45), 0.042, hair);
    }
    ball(root, 0.085, skin, 0, 2.25, 0.56).scale.z = 0.7;
    const buzzSmile = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.13, 2.13, 0.5), new THREE.Vector3(0, 2.1, 0.56), new THREE.Vector3(0.13, 2.13, 0.5)]);
    add(root, new THREE.TubeGeometry(buzzSmile, 8, 0.024, 5, false), eye);
    box(root, 1.1, 0.27, 0.55, paint(0x7dc34a), 0, 1.67, 0.31);
    for (const side of [-1, 1]) box(root, 0.38, 0.5, 0.55, paint(0x8a58b8), side * 0.72, 1.51, -0.08);
    ball(root, 0.12, glow(0xe53b51), 0.23, 1.63, 0.61);
    ball(root, 0.12, glow(0x5eda6e), -0.1, 1.63, 0.61);
  } else if (id === 'maleficent') {
    const hood = cone(root, 0.75, 1.25, dark, 0, 2.84, -0.21);
    hood.scale.z = 0.75;
    for (const side of [-1, 1]) {
      const horn = cone(root, 0.25, 1.48, dark, side * 0.43, 3.21, -0.16);
      horn.rotation.z = side * -0.31;
    }
    const cloak = cone(root, 1.05, 1.8, paint(0x332849), 0, 0.85, -0.5);
    cloak.scale.z = 0.62;
    ball(root, 0.11, glow(0x84fc6d), 0, 1.52, 0.53);
  } else if (id === 'hades') {
    const flameBlue = glow(0x338de4, 0.9);
    const flameCyan = glow(0x7be9ff, 0.88);
    const flameCore = glow(0xc7faff, 0.92);
    ball(root, 0.54, paint(0x285b9a), 0, 3.02, -0.1).scale.set(1.1, 0.42, 0.9);
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2;
      const x = Math.sin(angle) * 0.42;
      const z = Math.cos(angle) * 0.34 - 0.1;
      const height = 1.04 + (i % 4) * 0.21;
      curvedFlame(root, i % 2 ? flameBlue : flameCyan, x, 3.02, z, 0.23, height, Math.sin(angle) * 0.72 + (i % 2 ? 0.16 : -0.11), Math.cos(angle) * 0.33);
    }
    for (let i = 0; i < 3; i++) curvedFlame(root, flameCore, (i - 1) * 0.2, 3.1, 0.2, 0.11, 1.08 + i * 0.12, (i - 1) * 0.24, 0.08);
    const robe = cone(root, 0.95, 1.6, paint(0x333853), 0, 0.85, -0.26);
    robe.scale.z = 0.67;
    box(root, 0.8, 0.19, 0.6, paint(0x654a7c), 0, 1.55, 0.18);
    for (const side of [-1, 1]) {
      const brow = branch(root, new THREE.Vector3(side * 0.1, 2.68, 0.54), new THREE.Vector3(side * 0.36, 2.76, 0.48), 0.055, paint(0x314363));
      brow.castShadow = false;
    }
  } else if (id === 'jack') {
    const hatMaterial = paint(0x312629, 0.05, 0.8);
    const hatBrim = ball(root, 0.82, hatMaterial, 0, 3.02, 0);
    hatBrim.scale.set(1.4, 0.18, 0.78);
    add(root, new THREE.CylinderGeometry(0.49, 0.56, 0.49, 14), hatMaterial, 0, 3.26, -0.08).scale.z = 0.83;
    const flapShape = new THREE.Shape();
    flapShape.moveTo(-0.83, 0);
    flapShape.quadraticCurveTo(-0.61, 0.39, 0, 0.31);
    flapShape.quadraticCurveTo(0.61, 0.39, 0.83, 0);
    flapShape.quadraticCurveTo(0, -0.2, -0.83, 0);
    const flapGeometry = new THREE.ExtrudeGeometry(flapShape, { depth: 0.08, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.035, bevelThickness: 0.025 });
    for (const angle of [0, 2.1, -2.1]) {
      const flap = add(root, flapGeometry, hatMaterial, Math.sin(angle) * 0.22, 3.07, Math.cos(angle) * 0.32);
      flap.rotation.y = angle;
    }
    box(root, 0.93, 0.09, 0.12, paint(0x956f49), 0, 3.35, 0.44);
    box(root, 1.08, 0.14, 0.78, paint(0x9a3c3b), 0, 2.94, -0.03);
    for (const side of [-1, 1]) {
      const braid = ball(root, 0.17, hair, side * 0.51, 2.0, -0.17);
      braid.scale.set(0.68, 2.9, 0.7);
      for (let n = 0; n < 3; n++) ball(root, 0.075, n === 1 ? accent : cream, side * 0.51, 1.67 + n * 0.24, 0.02);
    }
    cone(root, 0.25, 0.43, hair, 0, 1.95, 0.48).rotation.x = Math.PI;
    box(root, 1.08, 0.55, 0.75, paint(0x74543c), 0, 1.27, -0.05);
    box(root, 0.12, 0.65, 0.12, accent, 0, 1.21, 0.39);
    for (const side of [-1, 1]) {
      const coat = box(root, 0.3, 0.94, 0.56, paint(0x3a2c2a), side * 0.57, 1.05, 0.15);
      coat.rotation.z = side * -0.14;
    }
    const sash = box(root, 1.05, 0.17, 0.13, paint(0x9f3c42), 0, 1.17, 0.47);
    sash.rotation.z = -0.23;
  } else if (id === 'mulan') {
    const armor = paint(0x315d68, 0.14, 0.59);
    const gold = paint(0xe8be77, 0.36, 0.38);
    ball(root, 0.68, hair, 0, 2.61, -0.22).scale.set(1.03, 0.85, 0.73);
    for (const side of [-1, 1]) {
      ball(root, 0.2, hair, side * 0.37, 2.69, 0.24).scale.set(0.8, 0.78, 0.82);
      const strand = ball(root, 0.14, hair, side * 0.5, 2.22, 0.11);
      strand.scale.set(0.62, 2.1, 0.68);
      const shoulderGuard = ball(root, 0.31, armor, side * 0.7, 1.61, 0.05);
      shoulderGuard.scale.set(1, 0.57, 1.08);
      box(root, 0.09, 0.56, 0.08, gold, side * 0.38, 1.28, 0.57).rotation.z = side * 0.5;
    }
    const bun = ball(root, 0.32, hair, 0, 3.1, -0.42);
    bun.scale.z = 0.85;
    branch(root, new THREE.Vector3(-0.42, 3.08, -0.36), new THREE.Vector3(0.44, 3.08, -0.36), 0.055, gold);
    box(root, 1.12, 0.35, 0.62, paint(0xb43843), 0, 1.37, 0.22);
    box(root, 0.62, 0.34, 0.1, armor, 0, 1.32, 0.61);
    for (const side of [-1, 1]) box(root, 0.18, 0.75, 0.12, gold, side * 0.5, 1.31, 0.18).rotation.z = side * 0.25;
    const crest = add(root, new THREE.OctahedronGeometry(0.13, 0), gold, 0, 1.32, 0.69);
    crest.scale.set(0.8, 1.18, 0.38);
    box(root, 0.86, 0.16, 0.56, gold, 0, 0.94, 0.27);
  }
  return root;
}

function kartDecorations(id: CharacterId, body: THREE.Group, primary: THREE.Material, accent: THREE.Material) {
  if (id === 'mickey') {
    for (const side of [-1, 1]) ball(body, 0.23, accent, side * 0.9, 1.16, 1.65);
    box(body, 1.8, 0.17, 0.5, accent, 0, 1.16, 1.38);
  } else if (id === 'stitch') {
    for (const side of [-1, 1]) {
      const thruster = add(body, new THREE.CylinderGeometry(0.47, 0.35, 1.1, 14), accent, side * 0.88, 1.37, -1.95);
      thruster.rotation.x = Math.PI / 2;
      ball(body, 0.3, glow(0x58eaff), side * 0.88, 1.37, -2.56).scale.z = 0.35;
    }
    box(body, 2.45, 0.19, 0.36, primary, 0, 1.65, -1.41);
  } else if (id === 'elsa') {
    for (const side of [-1, 1]) {
      const runner = branch(body, new THREE.Vector3(side * 1.18, 0.4, -1.65), new THREE.Vector3(side * 1.18, 0.4, 2), 0.12, accent);
      runner.castShadow = true;
      const crystal = cone(body, 0.37, 0.8, glow(0xbefaff, 0.83), side * 0.75, 1.4, 1.35, 5);
      crystal.rotation.z = side * 0.3;
    }
  } else if (id === 'moana') {
    const water = paint(0x3bbcb4, 0.32, 0.38);
    for (const side of [-1, 1]) {
      branch(body, new THREE.Vector3(side * 1.05, 0.7, -1.5), new THREE.Vector3(side * 1.05, 0.86, 1.8), 0.15, accent);
      const curl = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.74, 1.31, 0.6),
        new THREE.Vector3(side * 0.91, 1.37, 1.14),
        new THREE.Vector3(side * 0.57, 1.57, 1.58),
        new THREE.Vector3(side * 0.31, 1.56, 1.38),
      ]);
      add(body, new THREE.TubeGeometry(curl, 16, 0.065, 6, false), water);
    }
    const bow = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.05, 1.33),
      new THREE.Vector3(0, 1.24, 1.9),
      new THREE.Vector3(0, 1.64, 2.18),
      new THREE.Vector3(0, 1.82, 2.02),
    ]);
    add(body, new THREE.TubeGeometry(bow, 16, 0.18, 8, false), accent);
    ball(body, 0.19, water, 0, 1.7, 2.12).scale.set(0.9, 0.6, 0.4);
    const mast = branch(body, new THREE.Vector3(0, 1.3, -1.52), new THREE.Vector3(0, 3.7, -1.62), 0.11, primary);
    mast.castShadow = true;
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0); sailShape.lineTo(1.25, 0.28); sailShape.lineTo(0, 1.85); sailShape.closePath();
    const sail = add(body, new THREE.ShapeGeometry(sailShape), paint(0xeee0bc), 0, 1.85, -1.62);
    sail.rotation.y = Math.PI;
  } else if (id === 'buzz') {
    for (const side of [-1, 1]) {
      const wing = box(body, 1.62, 0.13, 0.69, primary, side * 1.39, 1.33, -0.92);
      wing.rotation.z = side * 0.22;
      box(body, 0.35, 0.1, 0.65, accent, side * 2.13, 1.5, -0.92);
    }
    cone(body, 0.33, 0.7, accent, 0, 1.22, 1.92).rotation.x = Math.PI / 2;
  } else if (id === 'maleficent') {
    for (const side of [-1, 1]) cone(body, 0.3, 0.85, primary, side * 0.85, 1.54, 1.35).rotation.z = side * 0.35;
    cone(body, 0.45, 0.9, glow(0x63f873, 0.83), 0, 1.48, -1.76).rotation.x = Math.PI;
  } else if (id === 'hades') {
    for (const side of [-1, 1]) cone(body, 0.35, 1.1, glow(0x4ae3ff, 0.78), side * 0.78, 1.43, -1.79).rotation.x = Math.PI;
    box(body, 2.4, 0.28, 0.38, accent, 0, 1.31, 1.65);
  } else if (id === 'jack') {
    box(body, 2.4, 0.57, 2.82, primary, 0, 0.88, 0.08);
    for (const side of [-1, 1]) {
      box(body, 0.14, 0.58, 3.05, accent, side * 1.12, 1.42, 0.06);
      ball(body, 0.18, accent, side * 0.64, 1.22, 1.68);
    }
    const prow = cone(body, 0.55, 1.2, accent, 0, 1.08, 1.94);
    prow.rotation.x = Math.PI / 2;
  } else if (id === 'mulan') {
    box(body, 2.52, 0.19, 0.41, accent, 0, 1.24, 1.5);
    for (const side of [-1, 1]) cone(body, 0.24, 0.62, accent, side * 0.94, 1.5, 1.35).rotation.z = side * 0.28;
    const dragon = cone(body, 0.31, 0.76, glow(0x7df1d0, 0.88), 0, 1.46, 1.9);
    dragon.rotation.x = Math.PI / 2;
    const sword = branch(body, new THREE.Vector3(-0.82, 1.87, -1.23), new THREE.Vector3(0.28, 2.48, -1.22), 0.05, paint(0xd8e9e6, 0.55, 0.25));
    sword.castShadow = true;
    branch(body, new THREE.Vector3(-0.84, 1.9, -1.24), new THREE.Vector3(-0.58, 1.65, -1.24), 0.09, paint(0x816143, 0.25, 0.53));
    ball(body, 0.13, accent, -0.8, 1.77, -1.24);
  }
}

function ultimateApparition(id: CharacterId) {
  const group = new THREE.Group();
  const model = CHARACTER_BY_ID[id];
  const spirit = glow(model.accent, 0.56);
  const highlight = glow(0xf1ffff, 0.8);
  if (id === 'mickey' || id === 'stitch') {
    const character = figure(id);
    character.scale.setScalar(id === 'stitch' ? 1.14 : 1.02);
    const discarded = new Set<THREE.Material>();
    character.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material !== dark && material !== cream && material !== white && material !== eye) discarded.add(material);
        object.material = spirit;
        object.castShadow = false;
      }
    });
    discarded.forEach((material) => material.dispose());
    group.add(character);
  } else if (id === 'mulan' || id === 'maleficent') {
    const dragonPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.7), new THREE.Vector3(-0.55, 0.8, -0.5),
      new THREE.Vector3(0.38, 1.7, -0.3), new THREE.Vector3(0.15, 2.65, 0.15),
    ]);
    add(group, new THREE.TubeGeometry(dragonPath, 22, 0.42, 9, false), spirit);
    const head = ball(group, 0.73, spirit, 0.15, 2.65, 0.24);
    head.scale.set(1.08, 0.73, 0.94);
    const snout = cone(group, 0.45, 1.22, spirit, 0.15, 2.55, 1.05, 9);
    snout.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const horn = cone(group, 0.16, 0.88, highlight, 0.15 + side * 0.47, 3.28, -0.06, 8);
      horn.rotation.z = side * -0.28;
      ball(group, 0.13, highlight, 0.15 + side * 0.47, 2.8, 0.7);
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0); wingShape.lineTo(side * 2.45, 1.3); wingShape.lineTo(side * 1.8, -0.32); wingShape.lineTo(side * 0.35, -0.4); wingShape.closePath();
      const wing = add(group, new THREE.ShapeGeometry(wingShape), spirit, 0.15, 1.55, -0.43);
      wing.rotation.y = side * 0.24;
    }
    if (id === 'maleficent') {
      for (let n = 0; n < 3; n++) cone(group, 0.23, 0.7, spirit, (n - 1) * 0.46, 0.65, -0.8 - n * 0.16);
    }
  } else if (id === 'elsa') {
    ball(group, 0.64, highlight, 0, 1.7, 0);
    for (let n = 0; n < 8; n++) {
      const angle = n * Math.PI / 4;
      const from = new THREE.Vector3(Math.cos(angle) * 0.47, 1.7 + Math.sin(angle) * 0.47, 0);
      const to = new THREE.Vector3(Math.cos(angle) * 2.05, 1.7 + Math.sin(angle) * 2.05, 0);
      branch(group, from, to, 0.12, spirit);
      const shard = cone(group, 0.32, 0.9, highlight, to.x, to.y, 0, 5);
      shard.rotation.z = -angle - Math.PI / 2;
    }
  } else if (id === 'moana') {
    const wave = add(group, new THREE.TorusGeometry(2.15, 0.43, 9, 40, Math.PI * 1.65), spirit, 0, 1.35, 0);
    wave.rotation.z = Math.PI * 0.18;
    for (let n = 0; n < 5; n++) ball(group, 0.24 + n * 0.04, highlight, -1.5 + n * 0.69, 2.63 + Math.sin(n) * 0.22, 0.15);
  } else if (id === 'buzz') {
    ball(group, 0.63, spirit, 0, 1.7, 0).scale.set(0.75, 1.4, 0.7);
    for (const side of [-1, 1]) {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0); wingShape.lineTo(side * 2.65, 1.55); wingShape.lineTo(side * 1.85, -0.4); wingShape.closePath();
      add(group, new THREE.ShapeGeometry(wingShape), spirit, 0, 1.2, 0);
      cone(group, 0.35, 1.7, highlight, side * 0.55, -0.1, -0.3).rotation.x = Math.PI;
    }
  } else if (id === 'hades') {
    for (let n = 0; n < 7; n++) {
      const angle = n * Math.PI * 2 / 7;
      const flame = cone(group, 0.52, 2.4 + (n % 3) * 0.45, n % 2 ? spirit : highlight, Math.sin(angle) * 0.85, 1.25, Math.cos(angle) * 0.65);
      flame.rotation.z = Math.sin(angle) * -0.2;
    }
  } else if (id === 'jack') {
    branch(group, new THREE.Vector3(0, 0, -0.1), new THREE.Vector3(0, 3.3, -0.1), 0.14, spirit);
    for (const side of [-1, 1]) {
      const sailShape = new THREE.Shape();
      sailShape.moveTo(0, 0); sailShape.lineTo(side * 1.8, 0.25); sailShape.lineTo(0, 1.9); sailShape.closePath();
      add(group, new THREE.ShapeGeometry(sailShape), side === 1 ? spirit : highlight, 0, side === 1 ? 1.15 : 0.85, 0);
    }
    const prow = cone(group, 0.46, 1.2, spirit, 0, 0.25, 0.65);
    prow.rotation.x = Math.PI / 2;
  }
  group.position.set(0, 2.5, -0.3);
  group.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = false; });
  return group;
}

export interface RaceVisual {
  readonly group: THREE.Group;
  readonly driver: THREE.Group;
  setShield(active: boolean): void;
  setUltimate(active: boolean): void;
  setStunned(active: boolean): void;
  setGroundOffset(offset: number): void;
  update(dt: number, speed: number, steer: number, drifting: boolean, boosting: boolean, stunned: boolean): void;
  dispose(): void;
}

export class CharacterKartVisual implements RaceVisual {
  readonly group = new THREE.Group();
  readonly driver: THREE.Group;
  readonly body = new THREE.Group();
  private readonly wheels: THREE.Group[] = [];
  private readonly flames: THREE.Mesh[] = [];
  private readonly hairFlames: THREE.Mesh[] = [];
  private readonly hairEmbers: THREE.Mesh[] = [];
  private readonly shield: THREE.Mesh;
  private readonly aura = new THREE.Group();
  private readonly ultimateLight: THREE.PointLight;
  private readonly stunHalo = new THREE.Group();
  private readonly contactShadow: THREE.Mesh;
  private elapsed = 0;

  constructor(readonly id: CharacterId) {
    const model = CHARACTER_BY_ID[id];
    const primary = paint(model.kartColor, id === 'buzz' ? 0.16 : 0.23, 0.46);
    const accent = paint(model.accent, 0.34, 0.42);
    const trim = paint(model.color, 0.29, 0.35);
    this.contactShadow = add(this.group, new THREE.PlaneGeometry(5.2, 5.6), new THREE.MeshBasicMaterial({ color: 0x15131f, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }), 0, 0.08, 0);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.castShadow = false;
    box(this.body, 2.52, 0.38, 3.65, dark, 0, 0.73, 0);
    const hull = ball(this.body, 1.37, primary, 0, 1.15, 0.14);
    hull.scale.set(1.05, 0.42, 1.5);
    const hood = ball(this.body, 1.07, primary, 0, 1.08, 1.14);
    hood.scale.set(1.04, 0.38, 0.76);
    box(this.body, 1.63, 0.2, 1.13, dark, 0, 1.45, -0.63);
    const back = box(this.body, 1.72, 0.63, 0.25, accent, 0, 1.64, -1.32);
    back.rotation.x = -0.16;
    for (const side of [-1, 1]) {
      const sideTrim = branch(this.body, new THREE.Vector3(side * 1.07, 1.17, -1.38), new THREE.Vector3(side * 1.07, 1.17, 1.55), 0.11, accent);
      sideTrim.castShadow = true;
      ball(this.body, 0.2, glow(model.accent), side * 0.73, 1.03, 1.76).scale.z = 0.5;
      box(this.body, 0.44, 0.19, 0.37, trim, side * 0.76, 0.87, -1.78);
    }
    kartDecorations(id, this.body, primary, accent);
    this.driver = figure(id);
    if (id === 'hades') {
      this.driver.traverse((part) => {
        if (part instanceof THREE.Mesh && typeof part.userData.hadesFlamePhase === 'number') this.hairFlames.push(part);
      });
      for (let i = 0; i < 7; i++) {
        const ember = ball(this.driver, 0.055 + (i % 3) * 0.018, glow(i % 2 ? 0x7deaff : 0xd2ffff, 0.78), 0, 3.3, 0);
        ember.castShadow = false;
        ember.receiveShadow = false;
        this.hairEmbers.push(ember);
      }
    }
    this.driver.position.set(0, 1.75, -0.52);
    this.driver.scale.setScalar(0.82);
    this.body.add(this.driver);
    this.group.add(this.body);
    for (const x of [-1.44, 1.44]) for (const z of [-1.22, 1.22]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.7, z);
      const tire = add(wheel, new THREE.CylinderGeometry(0.7, 0.7, 0.53, 20), dark);
      tire.rotation.z = Math.PI / 2;
      const hub = add(wheel, new THREE.CylinderGeometry(0.35, 0.35, 0.6, 16), accent);
      hub.rotation.z = Math.PI / 2;
      const cap = add(wheel, new THREE.CylinderGeometry(0.15, 0.15, 0.64, 12), trim);
      cap.rotation.z = Math.PI / 2;
      this.wheels.push(wheel);
      this.group.add(wheel);
    }
    for (const x of [-0.76, 0.76]) {
      const nozzle = add(this.body, new THREE.CylinderGeometry(0.27, 0.31, 0.54, 12), trim, x, 0.96, -2.03);
      nozzle.rotation.x = Math.PI / 2;
      const flame = cone(this.body, 0.34, 1.4, glow(id === 'maleficent' ? 0x61f672 : id === 'hades' ? 0x53c8ff : model.accent, 0.72), x, 0.96, -2.66);
      flame.rotation.x = -Math.PI / 2;
      flame.visible = false;
      this.flames.push(flame);
    }
    this.shield = add(this.group, new THREE.SphereGeometry(2.76, 28, 18), new THREE.MeshPhongMaterial({ color: model.accent, emissive: model.color, emissiveIntensity: 0.3, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, shininess: 90 }), 0, 2.3, 0);
    this.shield.castShadow = false;
    this.shield.visible = false;
    const apparition = ultimateApparition(id);
    this.aura.add(apparition);
    for (let i = 0; i < 2; i++) {
      const ring = add(this.aura, new THREE.TorusGeometry(3.2 + i * 0.4, 0.08, 8, 48), glow(i ? model.color : model.accent, 0.75), 0, 0.36 + i * 0.1, 0);
      ring.rotation.x = Math.PI / 2;
    }
    this.ultimateLight = new THREE.PointLight(model.accent, 0, 14, 2);
    this.ultimateLight.position.set(0, 2.1, 0);
    this.aura.add(this.ultimateLight);
    this.aura.visible = false;
    this.group.add(this.aura);
    for (let i = 0; i < 4; i++) {
      const gem = cone(this.stunHalo, 0.21, 0.37, glow(i % 2 ? 0xffd46e : 0xd9f5ff), Math.sin(i * Math.PI / 2) * 1, 0, Math.cos(i * Math.PI / 2) * 1, 5);
      gem.rotation.x = Math.PI / 2;
    }
    this.stunHalo.position.y = 4.5;
    this.stunHalo.visible = false;
    this.group.add(this.stunHalo);
  }

  setShield(active: boolean) { this.shield.visible = active; }
  setUltimate(active: boolean) { this.aura.visible = active; this.ultimateLight.intensity = active ? 2.2 : 0; }
  setStunned(active: boolean) { this.stunHalo.visible = active; }
  setGroundOffset(offset: number) {
    const jump = Math.max(0, -offset);
    this.contactShadow.position.y = offset + 0.08;
    this.contactShadow.scale.setScalar(1 + Math.min(1, jump / 6) * 0.33);
    (this.contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.3 * Math.max(0.22, 1 - jump / 8);
  }
  update(dt: number, speed: number, steer: number, drifting: boolean, boosting: boolean, stunned: boolean) {
    this.elapsed += dt;
    for (const wheel of this.wheels) wheel.rotation.x += speed * dt / 0.7;
    const lean = Math.max(-0.15, Math.min(0.15, -steer * (drifting ? 0.15 : 0.08)));
    this.body.rotation.z += (lean - this.body.rotation.z) * Math.min(1, dt * 7);
    this.body.position.y = Math.sin(this.elapsed * (3.4 + speed * 0.1)) * (speed > 1 ? 0.045 : 0.016);
    this.driver.rotation.y = steer * 0.06 + Math.sin(this.elapsed * 1.5) * 0.025;
    this.driver.rotation.z += ((stunned ? Math.sin(this.elapsed * 13) * 0.2 : -steer * (drifting ? 0.13 : 0.055)) - this.driver.rotation.z) * Math.min(1, dt * 8);
    this.driver.rotation.x += ((boosting ? -0.1 : 0.025) - this.driver.rotation.x) * Math.min(1, dt * 6);
    this.driver.position.y = 1.75 + Math.sin(this.elapsed * (4 + speed * 0.09)) * (speed > 1 ? 0.025 : 0.012);
    this.aura.position.y = Math.sin(this.elapsed * 3) * 0.13;
    this.aura.rotation.y = Math.sin(this.elapsed * 0.8) * 0.07;
    this.stunHalo.rotation.y += dt * 4;
    for (let i = 0; i < this.hairFlames.length; i++) {
      const flame = this.hairFlames[i];
      const phase = flame.userData.hadesFlamePhase as number;
      flame.scale.set(1 + Math.sin(this.elapsed * 7 + phase) * 0.045, 0.96 + Math.sin(this.elapsed * 8.5 + phase) * 0.11, 1);
      flame.rotation.z = Math.sin(this.elapsed * 4.2 + phase) * 0.095;
      flame.rotation.x = Math.cos(this.elapsed * 3.5 + phase) * 0.055;
    }
    for (let i = 0; i < this.hairEmbers.length; i++) {
      const ember = this.hairEmbers[i];
      const rise = (this.elapsed * (0.75 + i * 0.08) + i / this.hairEmbers.length) % 1;
      const angle = i * 2.4 + rise * 1.7;
      ember.position.set(Math.sin(angle) * (0.17 + rise * 0.36), 3.12 + rise * 1.24, Math.cos(angle) * (0.13 + rise * 0.24));
      ember.scale.setScalar(0.65 + Math.sin(rise * Math.PI) * 0.9);
    }
    for (const flame of this.flames) {
      flame.visible = boosting;
      flame.scale.y = 0.8 + Math.sin(this.elapsed * 21) * 0.18;
    }
    this.body.rotation.y = stunned ? Math.sin(this.elapsed * 12) * 0.22 : this.body.rotation.y * Math.max(0, 1 - dt * 8);
  }

  dispose() {
    const shared = new Set<THREE.Material>([dark, cream, white, eye]);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse((part) => {
      if (part instanceof THREE.Mesh) geometries.add(part.geometry);
      if (part instanceof THREE.Mesh || part instanceof THREE.Sprite) {
        for (const material of Array.isArray(part.material) ? part.material : [part.material]) if (!shared.has(material)) materials.add(material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
