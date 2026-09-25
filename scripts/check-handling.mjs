import assert from 'node:assert/strict';
import { advanceChaseYaw, advanceHeading, driftBoostStage, raceSpeed, railScrapeSpeed, slideHeadingAlongRail } from '../src/handling.ts';

const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
assert.deepEqual([0, 0.57, 0.58, 1.17, 1.18, 1.89, 1.9].map(driftBoostStage),
  [0, 0, 1, 1, 2, 2, 3], 'Drift audio and boost levels must switch at the same charges');

function run(hz, drifting, speed = raceSpeed(31), direction = 1, boostHandling = 1) {
  const dt = 1 / hz;
  let state = { yaw: 0, moveYaw: 0, yawRate: 0 };
  let cameraYaw = 0;
  let maxSlip = 0;
  let maxCameraAngle = 0;
  let turnAtRelease = 0;
  let rateAtRelease = 0;
  for (let frame = 0; frame < hz; frame++) {
    const steering = frame * dt < 0.7;
    state = advanceHeading(state, { steer: steering ? direction : 0, speed, handling: 1,
      drifting: drifting && steering, driftDirection: drifting && steering ? direction : 0, boostHandling, wobble: 0, dt });
    cameraYaw = advanceChaseYaw(cameraYaw, state.moveYaw, drifting && steering, dt);
    maxSlip = Math.max(maxSlip, angle(state.yaw, state.moveYaw));
    maxCameraAngle = Math.max(maxCameraAngle, angle(state.yaw, cameraYaw));
    if (steering) { turnAtRelease = Math.abs(state.moveYaw); rateAtRelease = Math.abs(state.yawRate); }
  }
  return { ...state, turnAtRelease, rateAtRelease, maxSlip, maxCameraAngle };
}

const normal = run(60, false);
const drift = run(60, true);
const drift30 = run(30, true);
const boosted = run(60, true, raceSpeed(53), 1, 1.2);
const leftDrift = run(60, true, raceSpeed(31), -1);
assert.ok(normal.turnAtRelease > 0 && drift.moveYaw > 0, 'Right input must turn and travel right');
assert.ok(leftDrift.moveYaw < 0, 'Left input must turn and travel left');
assert.ok(drift.turnAtRelease > normal.turnAtRelease * 1.3, 'Drifting must turn substantially more than regular steering');
assert.ok(drift.turnAtRelease < 1.15, 'A short drift must not snap the kart across the road');
assert.ok(drift.maxSlip > normal.maxSlip && drift.maxSlip < 0.28, 'Drift should show weight without sending travel sideways');
assert.ok(drift.maxCameraAngle < 0.62, 'Camera must keep the road visible during a drift');
assert.ok(Math.abs(drift.yawRate) < 0.08, 'The kart must stop rotating soon after steer release');
assert.ok(Math.abs(drift.turnAtRelease - drift30.turnAtRelease) < 0.06, 'Steering must remain stable at 30 and 60 fps');
assert.ok(boosted.maxSlip < 0.3 && boosted.maxCameraAngle < 0.65, 'Boost speed must remain controllable');
assert.ok(raceSpeed(31) / drift.rateAtRelease > 18 && raceSpeed(31) / drift.rateAtRelease < 23,
  'A full racing-speed drift must fit the tightest main-course bend');
assert.ok(raceSpeed(53) / boosted.rateAtRelease > 19 && raceSpeed(53) / boosted.rateAtRelease < 25,
  'A pad boost drift must still fit the course bends without snapping');
assert.ok(Math.abs(drift.turnAtRelease - leftDrift.turnAtRelease) < 1e-6, 'Left and right drift must be symmetric');
const idle = advanceHeading({ yaw: 0, moveYaw: 0, yawRate: 0 }, { steer: 0, speed: raceSpeed(31), handling: 1,
  drifting: false, driftDirection: 0, boostHandling: 1, wobble: 0, dt: 1 / 30 });
assert.deepEqual(idle, { yaw: 0, moveYaw: 0, yawRate: 0 }, 'No steering input must not auto steer');
const freeHeading = advanceHeading({ yaw: 0.7, moveYaw: 0.7, yawRate: 0 }, { steer: 0, speed: raceSpeed(31), handling: 1,
  drifting: false, driftDirection: 0, boostHandling: 1, wobble: 0, dt: 1 / 30 });
assert.deepEqual(freeHeading, { yaw: 0.7, moveYaw: 0.7, yawRate: 0 }, 'Releasing steer must not recenter the kart');
let neutralDrift = { yaw: 0, moveYaw: 0, yawRate: 0 };
let counterDrift = { yaw: 0, moveYaw: 0, yawRate: 0 };
for (let frame = 0; frame < 42; frame++) {
  neutralDrift = advanceHeading(neutralDrift, { steer: 0, speed: raceSpeed(31), handling: 1,
    drifting: true, driftDirection: 1, boostHandling: 1, wobble: 0, dt: 1 / 60 });
  counterDrift = advanceHeading(counterDrift, { steer: -1, speed: raceSpeed(31), handling: 1,
    drifting: true, driftDirection: 1, boostHandling: 1, wobble: 0, dt: 1 / 60 });
}
assert.deepEqual(neutralDrift, { yaw: 0, moveYaw: 0, yawRate: 0 }, 'Holding drift without steering must not turn the kart');
assert.ok(counterDrift.moveYaw < 0, 'Countersteering must open the corner and eventually change direction');
let openingDrift = { yaw: 0, moveYaw: 0, yawRate: 0 };
for (let frame = 0; frame < 30; frame++) openingDrift = advanceHeading(openingDrift, { steer: 1, speed: raceSpeed(31), handling: 1,
  drifting: true, driftDirection: 1, boostHandling: 1, wobble: 0, dt: 1 / 60 });
const beforeCounter = openingDrift.moveYaw;
const beforeCounterYaw = openingDrift.yaw;
for (let frame = 0; frame < 30; frame++) openingDrift = advanceHeading(openingDrift, { steer: -1, speed: raceSpeed(31), handling: 1,
  drifting: true, driftDirection: 1, boostHandling: 1, wobble: 0, dt: 1 / 60 });
assert.ok(openingDrift.yawRate < -0.8 && openingDrift.yaw < beforeCounterYaw && openingDrift.moveYaw < beforeCounter + 0.08,
  'Countersteering must open an established drift without flinging the kart into an opposite turn');
let shortDrift = { yaw: 0, moveYaw: 0, yawRate: 0 };
for (let frame = 0; frame < 33; frame++) shortDrift = advanceHeading(shortDrift, { steer: 1, speed: raceSpeed(31), handling: 1,
  drifting: true, driftDirection: 1, boostHandling: 1, wobble: 0, dt: 1 / 60 });
assert.ok(shortDrift.moveYaw > 0.5 && shortDrift.moveYaw < 0.65,
  'A half-second keyboard drift must turn decisively without crossing most of a wide road');
const exitLine = shortDrift.moveYaw;
for (let frame = 0; frame < 18; frame++) shortDrift = advanceHeading(shortDrift, { steer: 0, speed: raceSpeed(40), handling: 1,
  drifting: false, driftDirection: 0, boostHandling: 1, wobble: 0, dt: 1 / 60 });
assert.ok(shortDrift.moveYaw > exitLine + 0.02 && shortDrift.moveYaw < exitLine + 0.12 && angle(shortDrift.yaw, shortDrift.moveYaw) < 0.04,
  'Drift release must carry a little rotation, then settle without a wide exit');
const straight = { yaw: Math.PI / 4, moveYaw: Math.PI / 4, yawRate: 0.7 };
const railRight = { x: 1, z: 0 };
const railTangent = { x: 0, z: 1 };
const sliding = slideHeadingAlongRail(straight, raceSpeed(31), 16, railRight, railTangent, 1 / 60);
assert.ok(sliding.yaw > 0 && sliding.yaw < straight.yaw, 'Rail contact must guide heading gradually, without snapping');
assert.ok(sliding.moveYaw > 0 && sliding.moveYaw < straight.moveYaw, 'Rail contact must slide travel gradually');
assert.ok(angle(sliding.yaw, straight.yaw) < 0.08, 'One frame of rail contact must not jerk the kart');
assert.equal(slideHeadingAlongRail(straight, raceSpeed(31), -16, railRight, railTangent, 1 / 60), straight, 'Inward movement must retain player heading');
assert.equal(slideHeadingAlongRail(straight, raceSpeed(31), 0, railRight, railTangent, 1 / 60), straight, 'No rail contact must not auto steer');
assert.equal(slideHeadingAlongRail(straight, raceSpeed(31), 16, railRight, railTangent, 0), straight, 'Collision correction outside movement must not steer');
const oneSecond60 = Array.from({ length: 60 }).reduce((speed) => railScrapeSpeed(speed, 1, 1 / 60), raceSpeed(31));
const oneSecond30 = Array.from({ length: 30 }).reduce((speed) => railScrapeSpeed(speed, 1, 1 / 30), raceSpeed(31));
assert.ok(Math.abs(oneSecond60 - oneSecond30) < 1e-10, 'Rail drag must be frame-rate independent');
assert.ok(oneSecond60 > raceSpeed(31) * 0.5, 'A short wall scrape must not stop the kart');
console.log(`Handling: drift turns ${(drift.turnAtRelease / normal.turnAtRelease).toFixed(2)}× normal; ${(drift.maxSlip * 180 / Math.PI).toFixed(1)}° max slip; ${(drift.maxCameraAngle * 180 / Math.PI).toFixed(1)}° max camera angle; 30/60 fps stable`);
