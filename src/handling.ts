export const RACE_SPEED_SCALE = 1.3;
export const raceSpeed = (speed: number) => speed * RACE_SPEED_SCALE;

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

/** Speed-aware arcade steering with a committed, countersteerable drift. */
export function advanceHeading(state: HeadingState, input: HeadingInput): HeadingState {
  const { steer, speed, handling, drifting, driftDirection, boostHandling, wobble, dt } = input;
  // Normal racing speed stays calm. Above it, scale steering only enough to
  // keep a boost from making the kart too wide for the course's sharp bends.
  const speedFraction = Math.min(Math.abs(speed) / raceSpeed(53), 1);
  const boostTurnScale = Math.max(1, Math.min(1.35, Math.abs(speed) / raceSpeed(31)));
  const turnRate = (1.24 - speedFraction * 0.24) * (drifting ? 1.5 : 1)
    * boostTurnScale * boostHandling * handling;
  // Holding drift keeps a gentle arc; steering into it tightens the turn,
  // and steering against it opens the line without an abrupt reversal.
  const driftSteer = drifting ? 0.4 * driftDirection + 0.6 * steer : steer;
  // Positive yaw turns the kart toward +X (right), matching D/right input.
  const desiredYawRate = (driftSteer + wobble) * turnRate * Math.min(1, Math.abs(speed) / raceSpeed(6));
  const turnResponse = Math.abs(driftSteer) < 0.05 ? 11 : drifting ? 8 : 9;
  const yawRate = state.yawRate + (desiredYawRate - state.yawRate) * (1 - Math.exp(-dt * turnResponse));
  const yaw = state.yaw + yawRate * dt;
  const travelResponse = drifting ? 7.6 : 12;
  const moveYaw = state.moveYaw + angleDiff(yaw, state.moveYaw) * (1 - Math.exp(-dt * travelResponse));
  return { yaw, moveYaw, yawRate };
}

export function advanceChaseYaw(cameraYaw: number, moveYaw: number, drifting: boolean, dt: number) {
  return cameraYaw + angleDiff(moveYaw, cameraYaw) * (1 - Math.exp(-dt * (drifting ? 7 : 8)));
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
