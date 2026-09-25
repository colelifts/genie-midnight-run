export const ITEMS = {
  dash: { name: 'Pixie Dash', icon: '✦', color: '#65e8ff', hint: 'Long speed burst' },
  mirror: { name: 'Magic Mirror', icon: '◇', color: '#b8edff', hint: 'Reflect the next hit' },
  spark: { name: 'Star Spark', icon: '★', color: '#ffd66d', hint: 'Ricocheting star shot' },
  firefly: { name: 'Firefly', icon: '✧', color: '#a7f46e', hint: 'Homing, dodgeable shot' },
  tornado: { name: 'Tornado Jar', icon: '◌', color: '#a4edff', hint: 'Traveling whirlwind' },
  clock: { name: 'Clock Spell', icon: '◷', color: '#d5a2ff', hint: 'Slow zone behind you' },
  fog: { name: 'Phantom Fog', icon: '♧', color: '#b8abed', hint: 'Briefly untargetable' },
  horn: { name: 'Royal Horn', icon: '♛', color: '#ffd187', hint: 'Push nearby rivals away' },
  feather: { name: 'Golden Feather', icon: '❖', color: '#ffe993', hint: 'Float over rough terrain' },
  anchor: { name: 'Anchor', icon: '⚓', color: '#b8c7d9', hint: 'Drop a solid obstacle' },
  triple: { name: 'Triple Spark', icon: '✳', color: '#ffbc8c', hint: 'Three orbiting guards' },
} as const;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

const WEIGHTS: Record<ItemId, [number, number, number]> = {
  dash: [6, 7, 11], mirror: [12, 8, 6], spark: [10, 10, 9],
  firefly: [3, 7, 11], tornado: [2, 5, 9], clock: [8, 8, 6],
  fog: [8, 8, 7], horn: [3, 6, 8], feather: [7, 7, 7],
  anchor: [12, 8, 5], triple: [5, 6, 8],
};

/** Leaders get defense and traps; trailing racers get more passing tools. */
export function rollItem(rank: number, racerCount: number, random = Math.random): ItemId {
  const tier = rank <= Math.ceil(racerCount / 3) ? 0 : rank >= Math.ceil(racerCount * 2 / 3) ? 2 : 1;
  const total = ITEM_IDS.reduce((sum, id) => sum + WEIGHTS[id][tier], 0);
  let ticket = random() * total;
  for (const id of ITEM_IDS) {
    ticket -= WEIGHTS[id][tier];
    if (ticket < 0) return id;
  }
  return ITEM_IDS[ITEM_IDS.length - 1];
}
