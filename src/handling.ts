export const RACE_SPEED_SCALE = 1.3;
export const raceSpeed = (speed: number) => speed * RACE_SPEED_SCALE;
// The chase camera looks toward +Z, so world -X is screen right.
export const screenSteer = (left: boolean, right: boolean, gamepadAxis = 0) =>
  Math.max(-1, Math.min(1, (left ? 1 : 0) - (right ? 1 : 0) - gamepadAxis));
export const driftBoostStage = (charge: number): 0 | 1 | 2 | 3 =>
  charge >= 1.9 ? 3 : charge >= 1.18 ? 2 : charge >= 0.58 ? 1 : 0;

export interface HeadingState {
  yaw: number;
  moveYaw: number;
  yawRate: number;
}

export interface HeadingInput {
  steer: number;
  speed: number;
  handling: number;
  drifting: boolean;
  driftDirection: number;
  boostHandling: number;
  wobble: number;
  dt: number;
}

const angleDiff = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

/** Speed-aware arcade steering with a controllable, weighty drift. */
export function advanceHeading(state: HeadingState, input: HeadingInput): HeadingState {
  const { steer, speed, handling, drifting, driftDirection, boostHandling, wobble, dt } = input;
  // Keep the corner radius usable at both race and boost speeds. Keyboard
  // steering is all-or-nothing, so the drift should build rather than snap.
  const speedFraction = Math.min(Math.abs(speed) / raceSpeed(53), 1);
  const boostTurnScale = Math.max(1, Math.min(1.35, Math.abs(speed) / raceSpeed(31)));
  const turnRate = (1.34 - speedFraction * 0.19) * (drifting ? 1.55 : 1)
    * boostTurnScale * boostHandling * handling;
  // The held drift button never supplies steering. Opposite input trims the
  // drift instead of instantly throwing the kart into a reverse turn.
  const countersteering = drifting && steer * driftDirection < -0.1;
  const driftSteer = countersteering ? steer * 0.62 : steer;
  // Positive yaw turns the kart toward +X (right), matching D/right input.
  const desiredYawRate = (driftSteer + wobble) * turnRate * Math.min(1, Math.abs(speed) / raceSpeed(6));
  const turnResponse = Math.abs(driftSteer) < 0.05 ? 20 : 7;
  const yawRate = state.yawRate + (desiredYawRate - state.yawRate) * (1 - Math.exp(-dt * turnResponse));
  let yaw = state.yaw + yawRate * dt;
  const travelResponse = drifting ? 9.5 + (boostTurnScale - 1) * 5 : 12;
  // Coast through the last bit of steering momentum, then bring the kart
  // body back in line with its travel. This avoids a frozen travel vector on
  // release without pulling the kart wide just to match its visual slide.
  const coasting = !drifting && Math.abs(steer) < 0.05 && Math.abs(wobble) < 0.05;
  const moveYaw = coasting
    ? state.moveYaw + yawRate * dt * 0.5
    : state.moveYaw + angleDiff(yaw, state.moveYaw) * (1 - Math.exp(-dt * travelResponse));
  if (coasting) yaw += angleDiff(moveYaw, yaw) * (1 - Math.exp(-dt * 14));
  return { yaw, moveYaw, yawRate };
}

export function advanceChaseYaw(cameraYaw: number, moveYaw: number, drifting: boolean, dt: number) {
  return cameraYaw + angleDiff(moveYaw, cameraYaw) * (1 - Math.exp(-dt * (drifting ? 10 : 8)));
}

/** Ease a kart into a rail slide without instantly replacing the driver's heading. */
export function slideHeadingAlongRail(
  state: HeadingState,
  speed: number,
  lateral: number,
  right: { x: number; z: number },
  tangent: { x: number; z: number },
  dt: number,
): HeadingState {
  if (dt <= 0 || Math.abs(speed) < 0.01 || Math.abs(lateral) < 0.01) return state;
  const travelSign = Math.sign(speed);
  const travelX = Math.sin(state.moveYaw) * travelSign;
  const travelZ = Math.cos(state.moveYaw) * travelSign;
  const outward = (travelX * right.x + travelZ * right.z) * Math.sign(lateral);
  if (outward <= 0) return state;
  const along = travelX * tangent.x + travelZ * tangent.z;
  const railDirection = (along < -0.01 ? -1 : 1) * travelSign;
  const railYaw = Math.atan2(tangent.x * railDirection, tangent.z * railDirection);
  const yawCorrection = Math.max(-4 * dt, Math.min(4 * dt, angleDiff(railYaw, state.yaw)));
  const travelCorrection = Math.max(-6 * dt, Math.min(6 * dt, angleDiff(railYaw, state.moveYaw)));
  return { yaw: state.yaw + yawCorrection, moveYaw: state.moveYaw + travelCorrection, yawRate: state.yawRate * Math.exp(-dt * 12) };
}

/** Wall contact should cost some speed, but never compound into a near-stop each frame. */
export function railScrapeSpeed(speed: number, excess: number, dt: number) {
  return speed * Math.exp(-dt * (0.35 + Math.min(excess, 4) * 0.25));
}
