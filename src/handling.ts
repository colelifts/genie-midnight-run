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
  boostHandling: number;
  wobble: number;
  dt: number;
}

const angleDiff = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

/** Arcade steering: quick trajectory response, with a small visible drift angle. */
export function advanceHeading(state: HeadingState, input: HeadingInput): HeadingState {
  const { steer, speed, handling, drifting, boostHandling, wobble, dt } = input;
  const turnRate = (1.52 - Math.min(Math.abs(speed) / raceSpeed(50), 1) * 0.45)
    * (drifting ? 1.72 : 1) * boostHandling * handling;
  const desiredYawRate = -(steer + wobble) * turnRate * Math.min(1, Math.abs(speed) / raceSpeed(6));
  const turnResponse = Math.abs(steer) < 0.05 ? 13 : drifting ? 11 : 10;
  const yawRate = state.yawRate + (desiredYawRate - state.yawRate) * (1 - Math.exp(-dt * turnResponse));
  const yaw = state.yaw + yawRate * dt;
  const travelResponse = drifting ? 10.5 : 14;
  const moveYaw = state.moveYaw + angleDiff(yaw, state.moveYaw) * (1 - Math.exp(-dt * travelResponse));
  return { yaw, moveYaw, yawRate };
}

export function advanceChaseYaw(cameraYaw: number, moveYaw: number, drifting: boolean, dt: number) {
  return cameraYaw + angleDiff(moveYaw, cameraYaw) * (1 - Math.exp(-dt * (drifting ? 10 : 12)));
}
