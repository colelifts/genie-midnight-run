import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeBranchSamples, makeMainCurve, roadArrowRotation, touchesBoostPad } from '../src/track.ts';

const curve = makeMainCurve();
const count = 640;
const positions = Array.from({ length: count }, (_, i) => curve.getPointAt(i / count));
const tangents = Array.from({ length: count }, (_, i) => curve.getTangentAt(i / count));

function turnRadius(a, b, c) {
  const incoming = b.clone().sub(a);
  const outgoing = c.clone().sub(b);
  const angle = incoming.angleTo(outgoing);
  return angle < 1e-8 ? Infinity : (incoming.length() + outgoing.length()) / (2 * angle);
}

function crosses(a, b, c, d) {
  const ax = b.x - a.x;
  const az = b.z - a.z;
  const bx = d.x - c.x;
  const bz = d.z - c.z;
  const denominator = ax * bz - az * bx;
  if (Math.abs(denominator) < 1e-8) return false;
  const cx = c.x - a.x;
  const cz = c.z - a.z;
  const t = (cx * bz - cz * bx) / denominator;
  const u = (cx * az - cz * ax) / denominator;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

let smallestMainRadius = Infinity;
let closestSeparateRoad = Infinity;
for (let i = 0; i < count; i++) {
  smallestMainRadius = Math.min(smallestMainRadius, turnRadius(positions[(i + count - 1) % count], positions[i], positions[(i + 1) % count]));
  const arrowForward = new THREE.Vector3(0, 1, 0).applyEuler(roadArrowRotation(tangents[i]));
  assert.ok(arrowForward.dot(tangents[i]) > 0.999, `Road arrow points away from travel at ${i / count}`);
  for (let j = i + 1; j < count; j++) {
    const gap = Math.min(j - i, count - j + i);
    if (gap < 32) continue;
    assert.ok(!crosses(positions[i], positions[(i + 1) % count], positions[j], positions[(j + 1) % count]), `Main route crosses itself near ${i / count} and ${j / count}`);
    if (tangents[i].dot(tangents[j]) < 0.75) {
      closestSeparateRoad = Math.min(closestSeparateRoad, positions[i].distanceTo(positions[j]));
    }
  }
}
assert.ok(smallestMainRadius > 35, `Main road is too wide for its tightest turn: ${smallestMainRadius.toFixed(1)}m radius`);
assert.ok(closestSeparateRoad > 52, `Separate 50m road sections overlap: ${closestSeparateRoad.toFixed(1)}m between centers`);

for (const [route, start, end, offset, height, width] of [
  ['alley', 0.045, 0.16, -48, 0, 24],
  ['roof', 0.19, 0.33, -62, 5.4, 26],
]) {
  const samples = makeBranchSamples(curve, route, start, end, offset, height, width);
  assert.ok(samples[0].position.distanceTo(curve.getPointAt(start)) < 0.1, `${route} entrance is disconnected`);
  assert.ok(samples.at(-1).position.distanceTo(curve.getPointAt(end)) < 0.1, `${route} exit is disconnected`);
  assert.ok(samples[0].tangent.dot(curve.getTangentAt(start)) > 0.98, `${route} entrance points against the main road`);
  assert.ok(samples.at(-1).tangent.dot(curve.getTangentAt(end)) > 0.98, `${route} exit points against the main road`);
  let minimumRadius = Infinity;
  for (let i = 1; i < samples.length - 1; i++) {
    minimumRadius = Math.min(minimumRadius, turnRadius(samples[i - 1].position, samples[i].position, samples[i + 1].position));
  }
  assert.ok(minimumRadius > width / 2 + 6, `${route} road folds on a ${minimumRadius.toFixed(1)}m turn`);
  console.log(`${route}: ${minimumRadius.toFixed(1)}m minimum turn radius; joins aligned`);
}

const pad = {
  position: new THREE.Vector3(),
  tangent: new THREE.Vector3(0, 0, 1),
  right: new THREE.Vector3(1, 0, 0),
  halfWidth: 19.5,
  halfLength: 2.65,
  route: 'main',
  mesh: new THREE.Group(),
};
assert.ok(touchesBoostPad(pad, new THREE.Vector3(0, 0, 0), 'main'));
assert.ok(!touchesBoostPad(pad, new THREE.Vector3(0, 0, 8), 'main'), 'Boost activates before the visible carpet');
assert.ok(!touchesBoostPad(pad, new THREE.Vector3(23, 0, 0), 'main'), 'Boost activates outside the visible carpet');
assert.ok(!touchesBoostPad(pad, new THREE.Vector3(0, 5.4, 0), 'main'), 'Boost activates through another road');
assert.ok(!touchesBoostPad(pad, new THREE.Vector3(0, 0, 0), 'roof'), 'Boost activates on the wrong route');

console.log(`Main course: ${curve.getLength().toFixed(0)}m long; ${smallestMainRadius.toFixed(1)}m minimum turn radius; ${closestSeparateRoad.toFixed(1)}m closest separate road centers`);
