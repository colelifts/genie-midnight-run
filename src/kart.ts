import * as THREE from 'three';

const blueSkin = new THREE.MeshStandardMaterial({ color: 0x367edc, roughness: 0.62, metalness: 0.04, flatShading: true });
const lightBlue = new THREE.MeshStandardMaterial({ color: 0x63a9f2, roughness: 0.6, flatShading: true });
const darkHair = new THREE.MeshStandardMaterial({ color: 0x17243e, roughness: 0.74, flatShading: true });
const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xfff9eb });
const pupil = new THREE.MeshBasicMaterial({ color: 0x101a38 });
const smile = new THREE.MeshBasicMaterial({ color: 0x24233e });
const gold = new THREE.MeshStandardMaterial({ color: 0xffbb48, metalness: 0.38, roughness: 0.34, emissive: 0x6a3908, emissiveIntensity: 0.2 });
const goldLight = new THREE.MeshStandardMaterial({ color: 0xffd977, metalness: 0.46, roughness: 0.29 });
const tire = new THREE.MeshStandardMaterial({ color: 0x25273a, roughness: 0.94 });
const purple = new THREE.MeshStandardMaterial({ color: 0x70448f, roughness: 0.64 });
const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x40dbfa });
const innerLamp = new THREE.MeshStandardMaterial({ color: 0x76502e, metalness: 0.4, roughness: 0.68, side: THREE.DoubleSide });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.castShadow = true;
  return item;
}

function sphere(radius: number, material: THREE.Material, x = 0, y = 0, z = 0, segments = 16) {
  return mesh(new THREE.SphereGeometry(radius, segments, 10), material, x, y, z);
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

function makeRadialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 1, 64, 64, 63);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.22, 'rgba(255,255,255,0.65)');
  gradient.addColorStop(0.58, 'rgba(255,255,255,0.14)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

const radialTexture = makeRadialTexture();

function glowSprite(color: number, size: number, opacity: number) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture, color, opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

function limb(start: THREE.Vector3, end: THREE.Vector3, top: number, bottom: number, material: THREE.Material) {
  const direction = end.clone().sub(start);
  const part = mesh(new THREE.CylinderGeometry(top, bottom, direction.length(), 11, 1), material);
  part.position.copy(start).add(end).multiplyScalar(0.5);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return part;
}

function taperedTube(curve: THREE.CatmullRomCurve3, count: number, firstRadius: number, lastRadius: number, material: THREE.Material) {
  const radial = 12;
  const frames = curve.computeFrenetFrames(count, false);
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= count; i++) {
    const progress = i / count;
    const point = curve.getPointAt(progress);
    const radius = firstRadius * (1 - progress) + lastRadius * progress;
    for (let j = 0; j <= radial; j++) {
      const angle = j / radial * Math.PI * 2;
      const vertex = point.clone().addScaledVector(frames.normals[i], Math.cos(angle) * radius).addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
      vertices.push(vertex.x, vertex.y, vertex.z);
      uvs.push(j / radial, progress);
      if (i < count && j < radial) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(geometry, material);
}

function createGenieFigure(ultimatePose = false): THREE.Group {
  const figure = new THREE.Group();
  const torsoProfile = [
    [0.43, 0], [0.58, 0.17], [0.72, 0.42], [0.88, 0.78],
    [0.91, 1.06], [0.76, 1.31], [0.42, 1.47],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const torso = mesh(new THREE.LatheGeometry(torsoProfile, 18), blueSkin, 0, 0.54, -0.14);
  torso.scale.z = 0.69;
  figure.add(torso);
  const sash = mesh(new THREE.CylinderGeometry(0.58, 0.55, 0.22, 12), purple, 0, 0.67, -0.16);
  sash.scale.z = 0.87;
  figure.add(sash);
  const neck = mesh(new THREE.CylinderGeometry(0.31, 0.37, 0.42, 10), blueSkin, 0, 2.04, -0.1);
  figure.add(neck);
  const collar = mesh(new THREE.CylinderGeometry(0.41, 0.39, 0.16, 10), goldLight, 0, 1.91, -0.1);
  figure.add(collar);
  const head = sphere(0.69, blueSkin, 0, 2.59, -0.06, 14);
  head.scale.set(0.88, 1.02, 0.82);
  figure.add(head);
  const chin = sphere(0.37, blueSkin, 0, 2.19, 0.37, 10);
  chin.scale.set(1.02, 0.65, 0.69);
  figure.add(chin);
  const hairCap = sphere(0.46, darkHair, 0, 3.02, -0.22, 11);
  hairCap.scale.set(0.93, 0.35, 0.8);
  figure.add(hairCap);
  const ponytail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 3.04, -0.34),
    new THREE.Vector3(0.04, 3.53, -0.43),
    new THREE.Vector3(-0.13, 3.83, -0.51),
    new THREE.Vector3(-0.51, 3.86, -0.55),
    new THREE.Vector3(-0.7, 3.52, -0.61),
  ]);
  const hair = mesh(new THREE.TubeGeometry(ponytail, 20, 0.25, 9, false), darkHair);
  figure.add(hair);
  const tip = mesh(new THREE.ConeGeometry(0.24, 0.56, 9), darkHair, -0.7, 3.42, -0.6);
  tip.rotation.z = Math.PI - 0.28;
  figure.add(tip);
  const tie = mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.21, 10), goldLight, 0.025, 3.21, -0.38);
  figure.add(tie);
  if (!ultimatePose) {
    const beard = mesh(new THREE.ConeGeometry(0.21, 0.57, 9), darkHair, 0, 1.99, 0.46);
    beard.rotation.x = Math.PI;
    figure.add(beard);
  }
  for (const side of [-1, 1]) {
    const ear = sphere(0.24, blueSkin, side * 0.63, 2.56, 0, 8);
    ear.scale.x = 0.6;
    figure.add(ear);
    const earring = mesh(new THREE.TorusGeometry(0.19, 0.055, 7, 14), goldLight, side * 0.68, 2.31, 0.06);
    earring.rotation.y = Math.PI / 2;
    figure.add(earring);
    if (!ultimatePose) {
      const eye = sphere(0.21, eyeWhite, side * 0.25, 2.61, 0.5, 9);
      eye.scale.set(0.74, 1.15, 0.35);
      figure.add(eye);
      const iris = sphere(0.09, pupil, side * 0.26, 2.57, 0.59, 8);
      iris.scale.z = 0.38;
      figure.add(iris);
      const brow = sphere(0.21, darkHair, side * 0.25, 2.86, 0.45, 8);
      brow.scale.set(1, 0.21, 0.3);
      brow.rotation.z = side * -0.16;
      figure.add(brow);
    }
    const shoulder = new THREE.Vector3(side * 0.85, 1.63, 0.02);
    const raised = ultimatePose && side === -1;
    const elbow = raised ? new THREE.Vector3(-1.48, 2.04, 0.15) : new THREE.Vector3(side * 1.17, 1.06, 0.29);
    const wrist = raised ? new THREE.Vector3(-1.27, 2.72, 0.31) : new THREE.Vector3(side * 0.95, 0.75, 0.86);
    const shoulderBall = sphere(0.34, blueSkin, shoulder.x, shoulder.y, shoulder.z, 11);
    shoulderBall.scale.set(1.12, 0.9, 1.1);
    figure.add(shoulderBall);
    figure.add(limb(shoulder, elbow, 0.27, 0.32, blueSkin));
    const elbowBall = sphere(0.28, blueSkin, elbow.x, elbow.y, elbow.z, 10);
    figure.add(elbowBall);
    figure.add(limb(elbow, wrist, 0.28, 0.23, lightBlue));
    const cuff = limb(wrist.clone().addScaledVector(elbow.clone().sub(wrist).normalize(), 0.13), wrist.clone().addScaledVector(wrist.clone().sub(elbow).normalize(), 0.14), 0.33, 0.31, goldLight);
    figure.add(cuff);
    const hand = sphere(0.25, blueSkin, wrist.x, wrist.y, wrist.z, 10);
    if (raised) hand.scale.set(1.05, 1.14, 0.9);
    figure.add(hand);
  }
  if (!ultimatePose) {
    const nose = sphere(0.16, blueSkin, 0, 2.43, 0.59, 8);
    nose.scale.z = 1.35;
    figure.add(nose);
    const mouth = sphere(0.24, smile, 0, 2.15, 0.58, 10);
    mouth.scale.set(1, 0.15, 0.12);
    figure.add(mouth);
  }
  return figure;
}

function createRivalFigure(color: number): THREE.Group {
  const figure = new THREE.Group();
  const outfit = new THREE.MeshStandardMaterial({ color, roughness: 0.68, flatShading: true });
  const helmet = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.76), roughness: 0.48, flatShading: true });
  const glove = new THREE.MeshStandardMaterial({ color: 0x293147, roughness: 0.85 });
  const torso = sphere(0.8, outfit, 0, 1.18, -0.11, 12);
  torso.scale.set(1, 0.99, 0.7);
  figure.add(torso);
  const collar = mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.18, 12), helmet, 0, 1.82, -0.08);
  figure.add(collar);
  const head = sphere(0.62, helmet, 0, 2.46, -0.04, 14);
  head.scale.set(0.98, 0.87, 1.02);
  figure.add(head);
  const visor = mesh(new THREE.BoxGeometry(1.02, 0.16, 0.5), helmet, 0, 2.44, 0.42);
  visor.rotation.x = -0.08;
  figure.add(visor);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Vector3(side * 0.72, 1.48, -0.05);
    const elbow = new THREE.Vector3(side * 1.03, 1.04, 0.33);
    const wrist = new THREE.Vector3(side * 0.83, 0.78, 0.8);
    figure.add(sphere(0.29, outfit, shoulder.x, shoulder.y, shoulder.z, 10));
    figure.add(limb(shoulder, elbow, 0.26, 0.3, outfit));
    figure.add(limb(elbow, wrist, 0.26, 0.22, outfit));
    figure.add(sphere(0.23, glove, wrist.x, wrist.y, wrist.z, 9));
  }
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
  readonly contactShadow: THREE.Mesh;
  readonly wheels: THREE.Group[] = [];
  readonly shield: THREE.Group;
  readonly ghost: THREE.Group;
  readonly stunHalo = new THREE.Group();
  readonly driver: THREE.Group;
  private readonly exhaust: THREE.Mesh[] = [];
  private readonly boostFlames: THREE.Mesh[] = [];
  private readonly boostRibbons: THREE.Mesh[] = [];
  private readonly ultimateRings: THREE.Mesh[] = [];
  private elapsed = 0;

  constructor(accent: 'gold' | 'cyan' | 'violet' = 'gold') {
    const trim = accent === 'cyan' ? new THREE.MeshStandardMaterial({ color: 0x67dce6, metalness: 0.25, roughness: 0.45 })
      : accent === 'violet' ? new THREE.MeshStandardMaterial({ color: 0xc29cf3, metalness: 0.2, roughness: 0.5 }) : goldLight;
    const lampPaint = accent === 'cyan' ? new THREE.MeshStandardMaterial({ color: 0x327460, metalness: 0.37, roughness: 0.47 })
      : accent === 'violet' ? new THREE.MeshStandardMaterial({ color: 0x9a3f56, metalness: 0.36, roughness: 0.46 }) : gold;
    const chassis = mesh(new THREE.BoxGeometry(2.45, 0.34, 3.25), tire, 0, 0.72, -0.06);
    this.body.add(chassis);
    this.contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 5.6), new THREE.MeshBasicMaterial({ map: radialTexture, color: 0x161421, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.085;
    this.group.add(this.contactShadow);
    const lampProfile = [
      [0.04, 0.74], [0.75, 0.75], [1.18, 0.87], [1.42, 1.12],
      [1.45, 1.34], [1.3, 1.52], [1.03, 1.64], [0.83, 1.74], [0.82, 1.83],
    ].map(([radius, height]) => new THREE.Vector2(radius, height));
    const lampBody = mesh(new THREE.LatheGeometry(lampProfile, 32), lampPaint, 0, 0, -0.1);
    lampBody.scale.z = 1.23;
    this.body.add(lampBody);
    const innerBowl = mesh(new THREE.CylinderGeometry(0.78, 0.93, 0.18, 22), innerLamp, 0, 1.72, -0.16);
    innerBowl.scale.z = 1.22;
    this.body.add(innerBowl);
    const rimTop = mesh(new THREE.TorusGeometry(0.83, 0.105, 10, 32), goldLight, 0, 1.81, -0.15);
    rimTop.rotation.x = Math.PI / 2;
    rimTop.scale.y = 1.2;
    this.body.add(rimTop);
    const lowerBand = mesh(new THREE.TorusGeometry(1.27, 0.07, 8, 32), goldLight, 0, 1.04, -0.1);
    lowerBand.rotation.x = Math.PI / 2;
    lowerBand.scale.y = 1.23;
    this.body.add(lowerBand);
    const spoutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.87, 1.3, 0.49),
      new THREE.Vector3(1.36, 1.23, 0.96),
      new THREE.Vector3(1.98, 1.29, 1.52),
      new THREE.Vector3(2.48, 1.55, 1.87),
      new THREE.Vector3(2.68, 1.72, 1.95),
    ]);
    const spout = taperedTube(spoutCurve, 28, 0.4, 0.2, lampPaint);
    this.body.add(spout);
    const tip = mesh(new THREE.TorusGeometry(0.33, 0.105, 10, 20), goldLight, 2.72, 1.73, 1.98);
    tip.rotation.y = Math.PI / 2;
    tip.rotation.z = -0.3;
    this.body.add(tip);
    const spoutOpening = mesh(new THREE.CircleGeometry(0.27, 16), innerLamp, 2.76, 1.73, 1.98);
    spoutOpening.rotation.y = Math.PI / 2;
    this.body.add(spoutOpening);
    const handle = mesh(new THREE.TorusGeometry(0.76, 0.22, 10, 22), lampPaint, -0.96, 1.45, -1.47);
    handle.rotation.y = Math.PI / 2;
    this.body.add(handle);
    const seat = mesh(new THREE.BoxGeometry(1.49, 0.2, 1.24), purple, 0, 1.88, -0.42);
    this.body.add(seat);
    const seatShape = new THREE.Shape();
    seatShape.moveTo(-0.78, 0);
    seatShape.lineTo(0.78, 0);
    seatShape.lineTo(0.89, 0.52);
    seatShape.quadraticCurveTo(0, 0.82, -0.89, 0.52);
    seatShape.closePath();
    const seatBack = mesh(new THREE.ExtrudeGeometry(seatShape, { depth: 0.26, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.08, bevelSegments: 2 }), purple, 0, 1.68, -1.32);
    this.body.add(seatBack);
    const lampCap = mesh(new THREE.CylinderGeometry(0.16, 0.23, 0.29, 12), trim, 0, 1.91, -1.52);
    this.body.add(lampCap);
    const lampKnob = sphere(0.18, trim, 0, 2.09, -1.52, 10);
    this.body.add(lampKnob);
    const lantern = new THREE.Group();
    const glass = mesh(new THREE.BoxGeometry(0.43, 0.55, 0.36), new THREE.MeshBasicMaterial({ color: 0xffa536, toneMapped: false }), 0, 0, 0);
    lantern.add(glass);
    for (const x of [-0.29, 0.29]) {
      for (const z of [-0.25, 0.25]) {
        const frame = mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.77, 8), gold, x, 0, z);
        lantern.add(frame);
      }
    }
    const lanternRoof = mesh(new THREE.ConeGeometry(0.46, 0.4, 4), goldLight, 0, 0.48, 0);
    lanternRoof.rotation.y = Math.PI / 4;
    lantern.add(lanternRoof);
    const lanternBase = mesh(new THREE.CylinderGeometry(0.31, 0.21, 0.14, 8), gold, 0, -0.43, 0);
    lantern.add(lanternBase);
    const lampHalo = glowSprite(0xff9636, 2.2, 0.43);
    lampHalo.position.set(0, 0, -0.33);
    lantern.add(lampHalo);
    lantern.position.set(0, 1.19, -1.94);
    if (accent === 'gold') lantern.add(new THREE.PointLight(0xffb450, 2.2, 7, 2));
    this.body.add(lantern);

    this.driver = accent === 'gold' ? createGenieFigure() : createRivalFigure(accent === 'cyan' ? 0x4caa47 : 0xc3494f);
    this.driver.position.set(0, 1.77, -0.53);
    this.driver.scale.setScalar(0.83);
    this.body.add(this.driver);
    for (const x of [-1.45, 1.45]) {
      for (const z of [-1.25, 1.25]) {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(x, 0.73, z);
        const tyreMesh = mesh(new THREE.CylinderGeometry(0.73, 0.73, 0.57, 18), tire);
        tyreMesh.rotation.z = Math.PI / 2;
        wheelGroup.add(tyreMesh);
        const hub = mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.61, 14), trim);
        hub.rotation.z = Math.PI / 2;
        wheelGroup.add(hub);
        const hubCap = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.64, 10), goldLight);
        hubCap.rotation.z = Math.PI / 2;
        wheelGroup.add(hubCap);
        for (const side of [-1, 1]) {
          const rim = mesh(new THREE.TorusGeometry(0.45, 0.065, 8, 22), goldLight, side * 0.32, 0, 0);
          rim.rotation.y = Math.PI / 2;
          wheelGroup.add(rim);
        }
        for (let i = 0; i < 12; i++) {
          const angle = i / 12 * Math.PI * 2;
          const tread = mesh(new THREE.BoxGeometry(0.56, 0.075, 0.25), tire, 0, Math.sin(angle) * 0.72, Math.cos(angle) * 0.72);
          tread.rotation.x = angle;
          wheelGroup.add(tread);
        }
        this.wheels.push(wheelGroup);
        this.group.add(wheelGroup);
        const wheelGlow = mesh(new THREE.PlaneGeometry(2.2, 2.35), new THREE.MeshBasicMaterial({ map: radialTexture, color: 0x19dff8, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), x, 0.105, z);
        wheelGlow.rotation.x = -Math.PI / 2;
        wheelGlow.castShadow = false;
        this.group.add(wheelGlow);
      }
    }
    for (const x of [-0.7, 0.7]) {
      const exhaust = sphere(0.23, cyanGlow, x, 0.99, -2.1, 7);
      exhaust.scale.set(0.7, 0.7, 1.1);
      this.exhaust.push(exhaust);
      this.body.add(exhaust);
      const flame = mesh(new THREE.ConeGeometry(0.27, 1.45, 10), new THREE.MeshBasicMaterial({ color: 0x208aff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }), x, 0.94, -2.68);
      flame.rotation.x = -Math.PI / 2;
      flame.visible = false;
      this.boostFlames.push(flame);
      this.body.add(flame);
    }
    const underglow = mesh(new THREE.PlaneGeometry(3.4, 4.2), new THREE.MeshBasicMaterial({ map: radialTexture, color: 0x1fdbef, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 0.12, 0);
    underglow.rotation.x = -Math.PI / 2;
    this.body.add(underglow);
    this.body.scale.x = -1;
    this.group.add(this.body);

    for (const x of [-1.45, 1.45]) {
      const vertices: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      const levels = [0, 2.2, 4.6, 7.5, 10.5];
      for (let i = 0; i < levels.length; i++) {
        const distance = levels[i];
        const width = 0.09 + distance * 0.013;
        const intensity = Math.pow(1 - distance / 10.5, 1.3);
        for (const side of [-1, 1]) {
          vertices.push(x + side * width, 0.1, -1.15 - distance);
          colors.push(0.02 * intensity, 0.52 * intensity, 0.76 * intensity);
        }
        if (i > 0) indices.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      const ribbon = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      ribbon.visible = false;
      ribbon.renderOrder = 2;
      this.boostRibbons.push(ribbon);
      this.group.add(ribbon);
    }

    this.shield = new THREE.Group();
    const shieldGeometry = new THREE.IcosahedronGeometry(2.68, 1);
    const bubble = mesh(shieldGeometry, new THREE.MeshPhongMaterial({ color: 0x45c9f3, emissive: 0x117d9d, emissiveIntensity: 0.32, transparent: true, opacity: 0.33, depthWrite: false, side: THREE.DoubleSide, flatShading: true, shininess: 92 }), 0, 2.3, 0);
    this.shield.add(bubble);
    const seams = new THREE.LineSegments(new THREE.EdgesGeometry(shieldGeometry, 9), new THREE.LineBasicMaterial({ color: 0x9ceeff, transparent: true, opacity: 0.11, depthWrite: false }));
    seams.position.y = 2.3;
    this.shield.add(seams);
    const rim = new THREE.Mesh(new THREE.SphereGeometry(2.74, 28, 18), new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vNormal; void main() { float edge = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.3); gl_FragColor = vec4(0.26, 0.88, 1.0, edge * 0.78); }',
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    rim.position.y = 2.3;
    this.shield.add(rim);
    this.shield.visible = false;
    this.group.add(this.shield);

    this.ghost = new THREE.Group();
    const apparition = createGenieFigure(true);
    const ghostMeshes: THREE.Mesh[] = [];
    apparition.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        ghostMeshes.push(object);
        const isHair = object.material === darkHair;
        const isGold = object.material === goldLight || object.material === gold;
        object.material = new THREE.MeshBasicMaterial({ color: isHair ? 0x284b80 : isGold ? 0xffd17a : 0x2b80e3, transparent: true, opacity: isHair ? 0.8 : isGold ? 0.62 : 0.68, depthWrite: true, side: THREE.FrontSide, toneMapped: false });
        object.castShadow = false;
      }
    });
    for (const object of ghostMeshes) {
      const contour = new THREE.Mesh(object.geometry, new THREE.MeshBasicMaterial({ color: 0x67cbff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false, toneMapped: false }));
      contour.position.copy(object.position);
      contour.rotation.copy(object.rotation);
      contour.scale.copy(object.scale).multiplyScalar(1.055);
      contour.renderOrder = 1;
      apparition.add(contour);
    }
    apparition.scale.setScalar(2.4);
    apparition.position.set(2.7, 0.8, 1.5);
    this.ghost.add(apparition);
    for (let i = 0; i < 2; i++) {
      const ring = mesh(new THREE.TorusGeometry(5.2 + i * 0.42, 0.095, 8, 70), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x35dfff : 0xffc563, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }), 0, 0.2 + i * 0.08, 0);
      ring.rotation.x = Math.PI / 2;
      this.ultimateRings.push(ring);
      this.ghost.add(ring);
    }
    const starGeoAura = starGeometry(0.48, 0.21);
    for (let i = 0; i < 12; i++) {
      const star = mesh(starGeoAura, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0xffdf75, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const angle = i / 12 * Math.PI * 2;
      star.position.set(Math.sin(angle) * 5, 0.38, Math.cos(angle) * 5);
      star.rotation.x = -Math.PI / 2;
      this.ghost.add(star);
    }
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
  setGroundOffset(offset: number) {
    const jump = Math.max(0, -offset);
    this.contactShadow.position.y = offset + 0.085;
    this.contactShadow.scale.setScalar(1 + Math.min(1, jump / 6) * 0.35);
    (this.contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.38 * Math.max(0.25, 1 - jump / 8);
  }

  update(dt: number, speed: number, steer: number, drifting: boolean, boosting: boolean, stunned: boolean) {
    this.elapsed += dt;
    for (const wheel of this.wheels) wheel.rotation.x += speed * dt / 0.72;
    const lean = Math.max(-0.12, Math.min(0.12, -steer * (drifting ? 0.12 : 0.07)));
    this.body.rotation.z += (lean - this.body.rotation.z) * Math.min(1, dt * 7);
    this.body.position.y = 0.03 + Math.sin(this.elapsed * (3.5 + speed * 0.11)) * (speed > 1 ? 0.035 : 0.015);
    this.driver.rotation.y = Math.sin(this.elapsed * 1.5) * 0.03 + steer * 0.06;
    this.driver.rotation.z += ((stunned ? Math.sin(this.elapsed * 13) * 0.2 : -steer * (drifting ? 0.12 : 0.05)) - this.driver.rotation.z) * Math.min(1, dt * 8);
    this.driver.rotation.x += ((boosting ? -0.09 : 0.02) - this.driver.rotation.x) * Math.min(1, dt * 6);
    this.ghost.position.y = Math.sin(this.elapsed * 3.2) * 0.13;
    this.ghost.rotation.y = Math.sin(this.elapsed * 0.85) * 0.045;
    this.ultimateRings[0].scale.setScalar(1 + Math.sin(this.elapsed * 7) * 0.025);
    this.ultimateRings[1].scale.setScalar(1 + Math.cos(this.elapsed * 7) * 0.035);
    this.stunHalo.rotation.y += dt * 4;
    this.stunHalo.position.y = 4.55 + Math.sin(this.elapsed * 8) * 0.12;
    for (const exhaust of this.exhaust) exhaust.scale.z = boosting ? 2.4 + Math.sin(this.elapsed * 20) * 0.3 : 0.8 + speed / 55;
    for (const flame of this.boostFlames) {
      flame.visible = boosting;
      flame.scale.set(1, 1 + Math.sin(this.elapsed * 22) * 0.22, 1);
    }
    for (const ribbon of this.boostRibbons) ribbon.visible = boosting;
    if (stunned) this.body.rotation.y = Math.sin(this.elapsed * 12) * 0.25;
    else this.body.rotation.y *= Math.max(0, 1 - dt * 8);
  }

  dispose() {
    const shared = new Set<THREE.Material>([blueSkin, lightBlue, darkHair, eyeWhite, pupil, smile, gold, goldLight, tire, purple, cyanGlow, innerLamp]);
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

export function makeProjectile(): THREE.Group {
  const group = new THREE.Group();
  const core = mesh(new THREE.IcosahedronGeometry(0.72, 1), new THREE.MeshBasicMaterial({ color: 0xe72d48, toneMapped: false }));
  group.add(core);
  const shell = mesh(new THREE.IcosahedronGeometry(0.88, 1), new THREE.MeshBasicMaterial({ color: 0xff6756, transparent: true, opacity: 0.26, depthWrite: false, toneMapped: false }));
  group.add(shell);
  const glowRing = mesh(new THREE.TorusGeometry(0.93, 0.09, 8, 20), new THREE.MeshBasicMaterial({ color: 0xffbc58, transparent: true, opacity: 0.84, toneMapped: false }));
  group.add(glowRing);
  const tail = mesh(new THREE.ConeGeometry(0.42, 3.4, 10), new THREE.MeshBasicMaterial({ color: 0xff5c4a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0, 0, -2.08);
  tail.rotation.x = -Math.PI / 2;
  group.add(tail);
  const halo = glowSprite(0xff5147, 4.2, 0.58);
  group.add(halo);
  return group;
}
