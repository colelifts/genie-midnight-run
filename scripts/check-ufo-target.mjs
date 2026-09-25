import assert from 'node:assert/strict';
import { frontmostRival } from '../src/stitchUfo.ts';

const field = [
  { id: 0, lap: 3, progress: 0.25 },
  { id: 1, lap: 3, progress: 0.12 },
  { id: 2, lap: 2, progress: 0.98 },
  { id: 3, lap: 2, progress: 0.85 },
];
assert.equal(frontmostRival(field, 0)?.id, 1, 'A leading caster beams the racer in second place');
assert.equal(frontmostRival(field, 1)?.id, 0, 'A trailing caster beams the overall leader');
assert.equal(frontmostRival(field, 3)?.id, 0, 'Lap count outranks track progress');
assert.equal(frontmostRival([{ id: 0, lap: 1, progress: 0.5 }], 0), undefined, 'Never beam the caster');
console.log('UFO beam selects only the frontmost rival.');
