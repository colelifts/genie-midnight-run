import assert from 'node:assert/strict';
import { advanceChaseYaw, advanceHeading, raceSpeed, slideHeadingAlongRail } from '../src/handling.ts';

const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

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
      drifting: drifting && steering, boostHandling, wobble: 0, dt });
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
assert.ok(drift.turnAtRelease > normal.turnAtRelease * 1.45, 'Drifting must turn substantially more than regular steering');
assert.ok(drift.maxSlip < 0.25, 'Kart travel must stay within 14 degrees of its heading');
assert.ok(drift.maxCameraAngle < 0.43, 'Camera must keep the road visible during a drift');
assert.ok(Math.abs(drift.yawRate) < 0.08, 'The kart must stop rotating soon after steer release');
assert.ok(Math.abs(drift.turnAtRelease - drift30.turnAtRelease) < 0.06, 'Steering must remain stable at 30 and 60 fps');
assert.ok(boosted.maxSlip < 0.28 && boosted.maxCameraAngle < 0.49, 'Boost speed must remain controllable');
assert.ok(raceSpeed(53) / boosted.rateAtRelease < 26, 'A boost drift must still negotiate the course bends');
assert.ok(Math.abs(drift.turnAtRelease - leftDrift.turnAtRelease) < 1e-6, 'Left and right drift must be symmetric');
const idle = advanceHeading({ yaw: 0, moveYaw: 0, yawRate: 0 }, { steer: 0, speed: raceSpeed(31), handling: 1,
  drifting: false, boostHandling: 1, wobble: 0, dt: 1 / 30 });
assert.deepEqual(idle, { yaw: 0, moveYaw: 0, yawRate: 0 }, 'No steering input must not auto steer');
const straight = { yaw: Math.PI / 4, moveYaw: Math.PI / 4, yawRate: 0.7 };
const railRight = { x: 1, z: 0 };
const railTangent = { x: 0, z: 1 };
const sliding = slideHeadingAlongRail(straight, raceSpeed(31), 16, railRight, railTangent);
assert.deepEqual(sliding, { yaw: 0, moveYaw: 0, yawRate: 0 }, 'Outward rail contact must slide forward along the road');
assert.equal(slideHeadingAlongRail(straight, raceSpeed(31), -16, railRight, railTangent), straight, 'Inward movement must retain player heading');
assert.equal(slideHeadingAlongRail(straight, raceSpeed(31), 0, railRight, railTangent), straight, 'No rail contact must not auto steer');
console.log(`Handling: drift turns ${(drift.turnAtRelease / normal.turnAtRelease).toFixed(2)}× normal; ${(drift.maxSlip * 180 / Math.PI).toFixed(1)}° max slip; ${(drift.maxCameraAngle * 180 / Math.PI).toFixed(1)}° max camera angle; 30/60 fps stable`);
