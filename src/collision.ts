type Point3 = { x: number; y: number; z: number };

/** First time a linearly moving relative point enters a spherical hitbox. */
export function sweptSphereHit(start: Point3, end: Point3, radius: number): number | null {
  const c = start.x * start.x + start.y * start.y + start.z * start.z - radius * radius;
  if (c <= 0) return 0;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-8) return null;
  const b = 2 * (start.x * dx + start.y * dy + start.z * dz);
  if (b >= 0) return null;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const entry = (-b - Math.sqrt(discriminant)) / (2 * a);
  return entry >= 0 && entry <= 1 ? entry : null;
}
