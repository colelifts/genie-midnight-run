import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ALLEY_OFFSET, ALLEY_ROAD_WIDTH, BOOST_PAD_LAYOUT, BOOST_PAD_LENGTH, branchCoversMainEdge, CAVE_ARCH_SHAPE, CAVE_ARCH_SPANS, CAVE_TUNNEL_SHAPE, clearOfOtherRoutes, GARDEN_OFFSET, GARDEN_ROAD_WIDTH, GARDEN_ROUTE_END, MAIN_ROAD_WIDTH, makeBranchSamples, makeMainCurve, MARKET_BANNER_SPANS, MARKET_CROSSING_PROGRESS, MARKET_CROSSING_TRAVEL, MARKET_GATE_SPANS, marketCartState, OBSTACLE_LAYOUT, overMainPavement, PICKUP_LAYOUT, ROOF_OFFSET, ROOF_ROAD_WIDTH, touchesBoostPad, TURN_SIGN_SPANS, turnSignDirection } from '../src/track.ts';

const curve = makeMainCurve();
const count = 640;
const positions = Array.from({ length: count }, (_, i) => curve.getPointAt(i / count));
const tangents = Array.from({ length: count }, (_, i) => curve.getTangentAt(i / count));
const mainSamples = positions.map((position, i) => ({ position, tangent: tangents[i], right: new THREE.Vector3(-tangents[i].z, 0, tangents[i].x).normalize(), progress: i / count, width: MAIN_ROAD_WIDTH, route: 'main' }));

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
let tightestTurnProgress = 0;
let closestSeparateRoad = Infinity;
for (let i = 0; i < count; i++) {
  const radius = turnRadius(positions[(i + count - 1) % count], positions[i], positions[(i + 1) % count]);
  if (radius < smallestMainRadius) {
    smallestMainRadius = radius;
    tightestTurnProgress = i / count;
  }
  for (let j = i + 1; j < count; j++) {
    const gap = Math.min(j - i, count - j + i);
    if (gap < 32) continue;
    assert.ok(!crosses(positions[i], positions[(i + 1) % count], positions[j], positions[(j + 1) % count]), `Main route crosses itself near ${i / count} and ${j / count}`);
    if (tangents[i].dot(tangents[j]) < 0.75) {
      closestSeparateRoad = Math.min(closestSeparateRoad, positions[i].distanceTo(positions[j]));
    }
  }
}
assert.ok(MAIN_ROAD_WIDTH >= 34 && MAIN_ROAD_WIDTH <= 40, 'The main road should hold several racers without becoming an empty plaza');
assert.ok(curve.getLength() >= 1500 && curve.getLength() <= 1950, 'The lap is outside the intended course length');
assert.ok(smallestMainRadius > MAIN_ROAD_WIDTH / 2 + 4, `Main road folds at ${tightestTurnProgress.toFixed(3)}: ${smallestMainRadius.toFixed(1)}m radius`);
assert.ok(closestSeparateRoad > MAIN_ROAD_WIDTH + 4, `Separate ${MAIN_ROAD_WIDTH}m road sections overlap: ${closestSeparateRoad.toFixed(1)}m between centers`);
const turnDirections = [];
for (let i = 0; i < 200; i++) {
  const forward = curve.getTangentAt(i / 200).normalize();
  const upcoming = curve.getTangentAt((i / 200 + 0.02) % 1).normalize();
  const turn = upcoming.dot(new THREE.Vector3(-forward.z, 0, forward.x));
  if (Math.abs(turn) < 0.18) continue;
  const direction = Math.sign(turn);
  if (turnDirections.at(-1) !== direction) turnDirections.push(direction);
}
if (turnDirections[0] === turnDirections.at(-1)) turnDirections.pop();
assert.ok(turnDirections.length >= 20, `Course needs at least 20 alternating drift turns; found ${turnDirections.length}`);

const branches = [];
for (const [route, start, end, offset, height, width] of [
  ['alley', 0.045, 0.16, ALLEY_OFFSET, 0, ALLEY_ROAD_WIDTH],
  ['roof', 0.19, 0.33, ROOF_OFFSET, 5.4, ROOF_ROAD_WIDTH],
  ['garden', 0.37, GARDEN_ROUTE_END, GARDEN_OFFSET, 0, GARDEN_ROAD_WIDTH],
]) {
  const samples = makeBranchSamples(curve, route, start, end, offset, height, width);
  branches.push(samples);
  assert.ok(samples[0].position.distanceTo(curve.getPointAt(start)) < 0.1, `${route} entrance is disconnected`);
  assert.ok(samples.at(-1).position.distanceTo(curve.getPointAt(end)) < 0.1, `${route} exit is disconnected`);
  assert.ok(samples[0].tangent.dot(curve.getTangentAt(start)) > 0.98, `${route} entrance points against the main road`);
  assert.ok(samples.at(-1).tangent.dot(curve.getTangentAt(end)) > 0.98, `${route} exit points against the main road`);
  let minimumRadius = Infinity;
  for (let i = 1; i < samples.length - 1; i++) {
    minimumRadius = Math.min(minimumRadius, turnRadius(samples[i - 1].position, samples[i].position, samples[i + 1].position));
  }
  assert.ok(minimumRadius > width / 2 + 6, `${route} road folds on a ${minimumRadius.toFixed(1)}m turn`);
  const mainDistance = curve.getLength() * (end - start);
  const branchDistance = samples.slice(1).reduce((distance, point, i) => distance + point.position.distanceTo(samples[i].position), 0);
  const firstPad = BOOST_PAD_LAYOUT.filter((pad) => pad.route === route).sort((a, b) => a.progress - b.progress)[0];
  assert.ok(firstPad, `${route} needs a carpet boost`);
  const padIndex = Math.floor((firstPad.progress - start) / (end - start) * (samples.length - 1));
  const distanceToPad = samples.slice(1, padIndex + 1).reduce((distance, point, i) => distance + point.position.distanceTo(samples[i].position), 0);
  const boostedSeconds = distanceToPad / 31 + (branchDistance - distanceToPad) / 49;
  if (route === 'garden') {
    assert.ok(branchDistance < mainDistance * 0.91, 'Garden cut must save distance to justify its narrow hazards');
    assert.ok(GARDEN_ROAD_WIDTH <= 24 && OBSTACLE_LAYOUT.filter((item) => item.route === 'garden').length >= 2, 'Garden cut needs a meaningful challenge');
  } else {
    assert.ok(firstPad.boostSeconds >= 5, `${route} needs an early carpet boost`);
    assert.ok(branchDistance > mainDistance * 1.08, `${route} has no distance cost when the pad is missed`);
    assert.ok(boostedSeconds < mainDistance / 31 * 0.95, `${route} does not reward hitting its carpet boost`);
  }
  for (const side of [-1, 1]) {
    const edge = (point) => point.position.clone().addScaledVector(point.right, side * (point.width / 2 + 0.5));
    assert.ok(overMainPavement(mainSamples, edge(samples[0]), 1), `${route} entrance curb does not join the main road`);
    assert.ok(overMainPavement(mainSamples, edge(samples.at(-1)), 1), `${route} exit curb does not join the main road`);
    assert.ok(!overMainPavement(mainSamples, edge(samples[45]), 1), `${route} remains buried in the main road`);
  }
  console.log(`${route}: ${minimumRadius.toFixed(1)}m minimum turn radius; joins aligned`);
}

let openBarrierSections = 0;
for (let i = 0; i < count; i += 3) {
  const a = mainSamples[i];
  const b = mainSamples[(i + 3) % count];
  for (const side of [-1, 1]) {
    const edgeA = a.position.clone().addScaledVector(a.right, side * (a.width / 2 + 0.26));
    const edgeB = b.position.clone().addScaledVector(b.right, side * (b.width / 2 + 0.26));
    const middle = edgeA.clone().add(edgeB).multiplyScalar(0.5);
    const open = [edgeA, middle, edgeB].some((edge) => branchCoversMainEdge(branches, edge));
    if (open) {
      openBarrierSections++;
      continue;
    }
    for (const edge of [edgeA, middle, edgeB]) {
      for (const branch of branches) {
        for (const point of branch) {
          if (Math.abs(edge.y - point.position.y) > 2.7) continue;
          const distance = Math.hypot(edge.x - point.position.x, edge.z - point.position.z);
          assert.ok(distance > point.width / 2 + 1, `Barrier obstructs ${point.route} near ${point.progress.toFixed(3)}`);
        }
      }
    }
  }
}
assert.ok(openBarrierSections >= 18 && openBarrierSections <= 80, `Unexpected number of shortcut openings: ${openBarrierSections}`);

const routeSamples = [...mainSamples, ...branches.flat()];
assert.equal(marketCartState(0).lateral, 1, 'Market cart should start parked clear of the road');
assert.ok(marketCartState(3.1).warning && !marketCartState(3.1).crossing, 'Cart needs warning before it enters the road');
assert.ok(marketCartState(7).crossing && Math.abs(marketCartState(7).lateral) < 0.01, 'Cart should cross the racing line');
assert.equal(marketCartState(9).lateral, -1, 'Cart should park on the opposite side');
assert.ok(marketCartState(12.1).warning && !marketCartState(12.1).crossing, 'Return crossing needs warning');
assert.equal(marketCartState(18).lateral, 1, 'Crossing cycle should connect without a teleport');
assert.ok(MARKET_CROSSING_TRAVEL > MAIN_ROAD_WIDTH / 2 + 2, 'Parked cart must clear the racing lane');
const pointFor = ({ route, progress }) => {
  if (route === 'main') return mainSamples[Math.floor(progress * count)];
  const branch = route === 'alley' ? branches[0] : route === 'roof' ? branches[1] : branches[2];
  const start = branch[0].progress;
  const end = branch.at(-1).progress;
  return branch[Math.floor(Math.max(0, Math.min(1, (progress - start) / (end - start))) * (branch.length - 1))];
};
assert.ok(OBSTACLE_LAYOUT.length >= 20, 'The course is too empty of hazards');
const obstacles = OBSTACLE_LAYOUT.map((item) => {
  const point = pointFor(item);
  const radius = item.kind === 'boulder' ? 2.65 : item.kind === 'urn' ? 2.25 : item.kind === 'cart' ? 2.15 : 2.1;
  assert.ok(Math.abs(item.lateral) + radius + 1.7 + (item.kind === 'boulder' ? 2.2 : 0) < point.width / 2, `${item.kind} at ${item.progress} crowds the road edge`);
  const position = point.position.clone().addScaledVector(point.right, item.lateral);
  assert.ok(clearOfOtherRoutes(routeSamples, position, radius + 1.7, item.route), `${item.kind} at ${item.progress} obstructs another route`);
  return { ...item, position, radius };
});
const crossingPoint = pointFor({ route: 'main', progress: MARKET_CROSSING_PROGRESS });
for (let step = 0; step <= 20; step++) {
  const lateral = -MARKET_CROSSING_TRAVEL + step / 20 * MARKET_CROSSING_TRAVEL * 2;
  const cartPosition = crossingPoint.position.clone().addScaledVector(crossingPoint.right, lateral);
  assert.ok(clearOfOtherRoutes(routeSamples, cartPosition, 2.15, 'main'), 'Crossing cart reaches another route');
  for (const obstacle of obstacles) {
    if (Math.abs(cartPosition.y - obstacle.position.y) > 3) continue;
    assert.ok(cartPosition.distanceTo(obstacle.position) > 7, `Crossing cart clips ${obstacle.kind} at ${obstacle.progress}`);
  }
  for (const pad of BOOST_PAD_LAYOUT) {
    if (pad.route !== 'main') continue;
    const padPoint = pointFor(pad);
    assert.ok(cartPosition.distanceTo(padPoint.position) > BOOST_PAD_LENGTH / 2 + 4, `Crossing cart clips boost at ${pad.progress}`);
  }
}
for (let i = 0; i < obstacles.length; i++) {
  for (let j = i + 1; j < obstacles.length; j++) {
    const a = obstacles[i];
    const b = obstacles[j];
    if (Math.abs(a.position.y - b.position.y) > 3) continue;
    assert.ok(a.position.distanceTo(b.position) > a.radius + b.radius + 2.5, `Hazards overlap at ${a.progress} and ${b.progress}`);
  }
}
for (const route of ['alley', 'roof', 'garden']) assert.ok(PICKUP_LAYOUT.some((pickup) => pickup.route === route), `${route} has no shortcut reward`);
for (const pickup of PICKUP_LAYOUT) {
  const point = pointFor(pickup);
  const position = point.position.clone().addScaledVector(point.right, pickup.lateral);
  assert.ok(Math.abs(pickup.lateral) + 3.1 < point.width / 2 + 0.5, `Pickup at ${pickup.progress} is unreachable from the road`);
  assert.ok(clearOfOtherRoutes(routeSamples, position, 3.1, pickup.route), `Pickup at ${pickup.progress} floats into another route`);
  for (const obstacle of obstacles) {
    if (Math.abs(position.y - obstacle.position.y) > 3) continue;
    assert.ok(position.distanceTo(obstacle.position) > obstacle.radius + 3.9, `Pickup at ${pickup.progress} overlaps ${obstacle.kind} at ${obstacle.progress}`);
  }
}
for (const pad of BOOST_PAD_LAYOUT) {
  assert.ok(pad.boostSeconds >= (pad.width ? 2.3 : pad.route === 'main' || pad.route === 'garden' ? 3 : 5), `Boost at ${pad.progress} is too short`);
  const point = pointFor(pad);
  const padPosition = point.position.clone().addScaledVector(point.right, pad.lateral ?? 0);
  const halfWidth = (pad.width ?? point.width * 0.78) / 2;
  assert.ok(Math.abs(pad.lateral ?? 0) + halfWidth + 1.2 < point.width / 2, `Boost carpet at ${pad.progress} runs off the road`);
  if (pad.width) {
    const upcoming = curve.getTangentAt(pad.progress + 0.02).normalize();
    assert.ok(Math.abs(upcoming.dot(point.right)) > 0.2, `Precision boost at ${pad.progress} is not on a turn`);
    assert.ok(Math.sign(pad.lateral) === Math.sign(upcoming.dot(point.right)), `Precision boost at ${pad.progress} is outside the turn`);
  }
  for (const obstacle of obstacles) {
    if (Math.abs(padPosition.y - obstacle.position.y) > 3) continue;
    const toObstacle = obstacle.position.clone().sub(padPosition);
    const lateral = Math.abs(toObstacle.dot(point.right));
    const longitudinal = Math.abs(toObstacle.dot(point.tangent));
    assert.ok(lateral > halfWidth + obstacle.radius + 1.7 || longitudinal > BOOST_PAD_LENGTH / 2 + obstacle.radius + 2, `Boost carpet at ${pad.progress} overlaps ${obstacle.kind} at ${obstacle.progress}`);
  }
}
const clearBanners = MARKET_BANNER_SPANS.filter((progress) => {
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress);
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
  return [-1, 1].every((side) => clearOfOtherRoutes(routeSamples, point.clone().addScaledVector(right, side * (MAIN_ROAD_WIDTH / 2 + 3)), 1, 'main'));
});
assert.deepEqual(clearBanners, [0.025, 0.17, 0.89, 0.93, 0.97], 'A market banner post blocks a shortcut');

for (const progress of MARKET_GATE_SPANS) {
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).normalize();
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
  for (const side of [-1, 1]) {
    const tower = point.clone().addScaledVector(right, side * (MAIN_ROAD_WIDTH / 2 + 3));
    for (const branch of branches) {
      for (const sample of branch) {
        if (Math.abs(tower.y - sample.position.y) > 18) continue;
        const distance = Math.hypot(tower.x - sample.position.x, tower.z - sample.position.z);
        assert.ok(distance > sample.width / 2 + 4, `Market gate tower blocks ${sample.route} near ${sample.progress.toFixed(3)}`);
      }
    }
  }
}

const pad = {
  position: new THREE.Vector3(),
  tangent: new THREE.Vector3(0, 0, 1),
  right: new THREE.Vector3(1, 0, 0),
  halfWidth: MAIN_ROAD_WIDTH * 0.39,
  halfLength: BOOST_PAD_LENGTH / 2,
  route: 'main',
  mesh: new THREE.Group(),
};
assert.ok(touchesBoostPad(pad, new THREE.Vector3(0, 0, 0), 'main'));
assert.ok(!touchesBoostPad(pad, new THREE.Vector3(0, 0, 8), 'main'), 'Boost activates before the visible carpet');
assert.ok(!touchesBoostPad(pad, new THREE.Vector3(MAIN_ROAD_WIDTH * 0.45, 0, 0), 'main'), 'Boost activates outside the visible carpet');
assert.ok(!touchesBoostPad(pad, new THREE.Vector3(0, 5.4, 0), 'main'), 'Boost activates through another road');
assert.ok(!touchesBoostPad(pad, new THREE.Vector3(0, 0, 0), 'roof'), 'Boost activates on the wrong route');

assert.ok(CAVE_ARCH_SHAPE.pillarOutset - CAVE_ARCH_SHAPE.pillarHalfWidth > 0.4, 'Cave pillar clips the road edge');
assert.ok(CAVE_ARCH_SHAPE.crystalOutset - CAVE_ARCH_SHAPE.crystalRadius > 2, 'Cave crystal clips the road edge');
assert.ok(CAVE_ARCH_SHAPE.ceilingY - CAVE_ARCH_SHAPE.ceilingHalfHeight > 9, 'Cave ceiling is too low');
assert.ok(CAVE_TUNNEL_SHAPE.wallOutset - CAVE_TUNNEL_SHAPE.wallRadius > 3, 'Cave wall clips the road edge');
assert.ok(CAVE_TUNNEL_SHAPE.roofCenterY > 17 && CAVE_TUNNEL_SHAPE.roofEdgeY > 7, 'Cave roof is too low');
assert.ok(CAVE_ARCH_SPANS.every((progress) => progress > 0.665 && progress < 0.78), 'Cave arch is outside the cave');
for (const progress of TURN_SIGN_SPANS) {
  const tangent = curve.getTangentAt(progress).normalize();
  const upcoming = curve.getTangentAt(progress + 0.035).normalize();
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
  const turn = upcoming.dot(right);
  assert.ok(Math.abs(turn) > 0.2, `Turn sign at ${progress} does not warn of a meaningful turn`);
  assert.equal(turnSignDirection(tangent, upcoming), turn >= 0 ? 'right' : 'left', `Turn sign points against the bend at ${progress}`);
  const point = curve.getPointAt(progress);
  assert.ok([-1, 1].some((side) => clearOfOtherRoutes(routeSamples, point.clone().addScaledVector(right, side * (MAIN_ROAD_WIDTH / 2 + 5.6)), 5.1, 'main')), `Turn sign at ${progress} cannot be placed clear of the shortcuts`);
}

console.log(`Main course: ${curve.getLength().toFixed(0)}m long; ${turnDirections.length} alternating turn sections; ${smallestMainRadius.toFixed(1)}m minimum turn radius; ${closestSeparateRoad.toFixed(1)}m closest separate road centers; ${openBarrierSections} open barrier sections; ${clearBanners.length} safe market banners`);
