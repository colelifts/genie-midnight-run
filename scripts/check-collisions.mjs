import assert from 'node:assert/strict';
import { sweptSphereHit } from '../src/collision.ts';

const point = (x, y = 0, z = 0) => ({ x, y, z });
const near = (actual, expected) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

near(sweptSphereHit(point(-8), point(8), 2), 0.375);
near(sweptSphereHit(point(-8), point(2), 2), 0.6); // Both target and projectile moved.
near(sweptSphereHit(point(1), point(9), 2), 0); // Already overlapping.
assert.equal(sweptSphereHit(point(-8, 2.01), point(8, 2.01), 2), null);
assert.equal(sweptSphereHit(point(-8, 4), point(8, 4), 2), null); // Above the kart.
assert.equal(sweptSphereHit(point(-8), point(-9), 2), null); // Moving away.
assert.equal(sweptSphereHit(point(-8), point(-8), 2), null);
const first = sweptSphereHit(point(-8), point(8), 2);
const second = sweptSphereHit(point(-12), point(4), 2);
assert.ok(first < second, 'The nearer racer is hit first even when racer array order differs');
console.log('Swept projectile hitboxes: crossings, moving targets, near misses, and hit order pass');
