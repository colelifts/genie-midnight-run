export type CharacterId = 'genie' | 'mickey' | 'stitch' | 'elsa' | 'moana' | 'buzz' | 'maleficent' | 'hades' | 'jack' | 'mulan';

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  title: string;
  icon: string;
  color: number;
  accent: number;
  kartColor: number;
  speed: number;
  acceleration: number;
  handling: number;
  weight: number;
  passiveName: string;
  passive: string;
  signatureName: string;
  signature: string;
  signatureCooldown: number;
  ultimateName: string;
  ultimate: string;
}

export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'genie', name: 'Genie', title: 'Wild Card Magic', icon: '✦', color: 0x54adf2, accent: 0xffcf72, kartColor: 0xc69044,
    speed: 1, acceleration: 1, handling: 1, weight: 1,
    passiveName: 'Phenomenal Power', passive: 'Wish sparks can upgrade your next wish.',
    signatureName: 'Three Wishes', signature: 'Time the cycling choice: boost, shield, or star shot.', signatureCooldown: 9,
    ultimateName: 'Cosmic Showstopper', ultimate: 'Surge forward shielded; a giant spirit knocks rivals out on contact.',
  },
  {
    id: 'mickey', name: 'Mickey Mouse', title: 'Balanced Magic', icon: '★', color: 0xe64453, accent: 0xffd66f, kartColor: 0xc63543,
    speed: 1, acceleration: 1.02, handling: 1.02, weight: 0.95,
    passiveName: 'Good Boy Boost', passive: 'When Pluto lands a tongue hit, Mickey gets a short boost and more ultimate charge.',
    signatureName: 'Pluto Tongue', signature: 'Pluto auto-aims his tongue at the nearest racer within 52 metres.', signatureCooldown: 10,
    ultimateName: 'Pluto Paw Slam', ultimate: 'Pluto grows giant and blocks one third of the road with each of two paw strikes. Mickey glides over the first.',
  },
  {
    id: 'stitch', name: 'Stitch', title: 'Chaotic Aggressor', icon: 'ϟ', color: 0x4b86ed, accent: 0xbce7ff, kartColor: 0x344fb0,
    speed: 1.01, acceleration: 1.02, handling: 0.98, weight: 1.05,
    passiveName: 'Alien Instinct', passive: 'Plasma hits charge the UFO faster; Stitch keeps momentum through bumps.',
    signatureName: 'Plasma Burst', signature: 'Fire three fast homing plasma bolts. Land the full volley for a spinout.', signatureCooldown: 18,
    ultimateName: '626 Rampage', ultimate: 'Call a UFO that darkens the sky, locks blast zones on rivals, and sweeps the road with plasma.',
  },
  {
    id: 'elsa', name: 'Elsa', title: 'Technical Control', icon: '❄', color: 0x95eaff, accent: 0xe4fbff, kartColor: 0x9adceb,
    speed: 0.99, acceleration: 1, handling: 1.08, weight: 0.94,
    passiveName: 'Frozen Grip', passive: 'Ice has less effect on Elsa’s handling.',
    signatureName: 'Frost Trail', signature: 'Leave slick ice that slides rivals outward and gives Elsa a small speed lift while she rides it.', signatureCooldown: 11,
    ultimateName: 'Into the Storm', ultimate: 'Freeze the entire circuit. Elsa gains grip and speed while rivals slide on frosted roads. Leave extra ice patches in your wake.',
  },
  {
    id: 'moana', name: 'Moana', title: 'Momentum Wayfinder', icon: '≈', color: 0x35c9be, accent: 0xffd58b, kartColor: 0x705b42,
    speed: 1.01, acceleration: 1.02, handling: 1, weight: 1,
    passiveName: 'Wayfinder', passive: 'Shortcuts charge extra ultimate energy.',
    signatureName: 'Ocean Push', signature: 'Push rivals with a forward wave, or raise a rear barrier while braking.', signatureCooldown: 10,
    ultimateName: "Ocean's Chosen", ultimate: 'Summon ocean currents on the road edges. Surf them for speed while they pull rivals inward; sweeping waves knock nearby racers aside.',
  },
  {
    id: 'buzz', name: 'Buzz Lightyear', title: 'Precision Pilot', icon: '✧', color: 0x9cdb72, accent: 0xcba4ff, kartColor: 0xeff1e4,
    speed: 1.02, acceleration: 0.99, handling: 1.02, weight: 0.97,
    passiveName: 'Star Command', passive: 'Jumping from boost carpets improves the next laser lock.',
    signatureName: 'Laser Lock', signature: 'Hold E on a racer ahead to lock on, then release a dodgable green laser.', signatureCooldown: 11,
    ultimateName: 'To Infinity', ultimate: 'Deploy wings, skim small hazards, and fire quick mini lasers while speeding up.',
  },
  {
    id: 'maleficent', name: 'Maleficent', title: 'Dark Power', icon: '♜', color: 0x9b67d6, accent: 0x81ef80, kartColor: 0x252036,
    speed: 1.04, acceleration: 0.96, handling: 0.98, weight: 1.05,
    passiveName: 'Dark Thorns', passive: 'Rear impacts recoil against the attacker.',
    signatureName: 'Boost Hex', signature: 'Hex a nearby rival. Their next boost misfires unless they break the curse with a clean drift.', signatureCooldown: 11,
    ultimateName: "Dragon's Wrath", ultimate: 'Become a giant dragon for 12 seconds. Aim with the mouse and click or press E to burn the road for 3 seconds. Powerful, but slower to turn.',
  },
  {
    id: 'hades', name: 'Hades', title: 'Underworld Trickster', icon: '♠', color: 0x6eaaff, accent: 0xc087ef, kartColor: 0x242c52,
    speed: 1.02, acceleration: 1, handling: 0.99, weight: 0.99,
    passiveName: 'Hot Head', passive: 'A hit briefly boosts acceleration.',
    signatureName: 'Soul Flame', signature: 'Drop blue fire that haunts and unsteadies the next rival.', signatureCooldown: 10,
    ultimateName: 'Underworld Unleashed', ultimate: 'Blue flame speed, immunity to light hazards, and a trail of soul fire.',
  },
  {
    id: 'jack', name: 'Jack Sparrow', title: 'Pirate Trickster', icon: '☠', color: 0xc49a69, accent: 0xffd47e, kartColor: 0x604736,
    speed: 1, acceleration: 1.01, handling: 1.03, weight: 0.96,
    passiveName: 'Lucky Escape', passive: 'A rare projectile glances off instead of stunning Jack; this can happen once every 25 seconds.',
    signatureName: 'Cursed Compass', signature: 'Reveal the next shortcut or pickup and gain a small burst of speed.', signatureCooldown: 9,
    ultimateName: "Dead Man's Chest", ultimate: 'Ghostly cannons fire to both sides while the pirate kart speeds on.',
  },
  {
    id: 'mulan', name: 'Mulan', title: 'Agile Strategist', icon: '◇', color: 0xd95154, accent: 0x76dbc4, kartColor: 0x9d373d,
    speed: 1.02, acceleration: 1.01, handling: 1.06, weight: 0.95,
    passiveName: 'Discipline', passive: 'Clean drift boosts last a little longer.',
    signatureName: 'Dragon Dash', signature: 'Dash through a corner with a small jade dragon circling the kart; your drift stays active.', signatureCooldown: 10,
    ultimateName: 'Honor Guardian', ultimate: 'A dragon spirit races ahead, knocking rivals aside along its path.',
  },
];

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((character) => [character.id, character])) as Record<CharacterId, CharacterDefinition>;
