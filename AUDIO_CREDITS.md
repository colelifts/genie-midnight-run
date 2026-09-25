# Audio sources

The shipped audio is edited and compressed for the browser game. All music and effects below came from the linked source pages.

| Files in `public/audio` | Original work | Creator | License | Changes |
|---|---|---|---|---|
| `desert-menu.mp3`, `desert-race-intro.mp3`, `desert-race.mp3` | [Desert calmness and fighting (orchestral)](https://opengameart.org/content/desert-calmness-and-fighting-orchestral-141) | Dizzy Crow | CC0 | Used the Desert Loop, Fight Intro, and Fight Loop; loudness balanced and encoded to MP3. The fight intro starts at race GO and crossfades into the loop. |
| `engine.wav` | [Car Engine Loop 96kHz, 4s](https://opengameart.org/content/car-engine-loop-96khz-4s) | qubodup | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Used the 44.1 kHz recording; filtered, crossfaded into a seamless 3.82-second loop, and level balanced. Playback pitch follows kart speed; nearby rivals use quieter, spatially panned and distance-filtered voices. |
| `boost-start.wav`, `boost-loop.wav`, `boost-end.wav` | [Racing Speed Boost Sound](https://opengameart.org/content/racing-speed-boost-sound) | Iwan Gabovitch (qubodup) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Used the original 48 kHz PCM start, loop, and end sections; dynamically crossfaded and pitched during boosts. |
| `skid.wav` | [Car tire squeal skid loop](https://opengameart.org/content/car-tire-squeal-skid-loop) | audible-edge (Tom Haigh); edited by qubodup | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Filtered, loudness balanced, converted to 44.1 kHz mono PCM. |
| `spell-spark.mp3`, `spell-surge.mp3`, `spell-grand.mp3` | [Magic Spell SFX](https://opengameart.org/content/magic-spell-sfx) | JaggedStone | CC0 | Used magical_1, magical_4, magical_7; loudness balanced and encoded to MP3. |
| `boost-whoosh.mp3`, `time-whoosh.mp3` | [Wind, hit, time morph](https://opengameart.org/content/wind-hit-time-morph) | qubodup | CC0 | Used megaswosh2 and slomo1; loudness balanced and encoded to MP3. |
| `impact-light.mp3`, `impact-mid.mp3`, `impact-heavy.mp3` | [10 Impact/Shield Blocks](https://opengameart.org/content/10-impactshield-blocks) | StarNinjas | CC0 | Used impacts 6, 9, and 4; loudness balanced and encoded to MP3. |
| `birds.mp3` | [Bird chirping sounds](https://opengameart.org/content/bird-chirping-sounds) | syncopika | CC0 | Loudness balanced and encoded to MP3. |
| `water-splash.mp3` | [40 CC0 water / splash / slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | rubberduck | CC0 | Used splash_11; filtered, loudness balanced, faded, and encoded to MP3. |
| `laser-shot.mp3` | [Theremin Laser SFX](https://opengameart.org/content/theremin-laser-sfx) | Zane Little Music | CC0 | Used Short/Sharp 1; filtered, loudness balanced, faded, and encoded to MP3. |
| `fire-blast.mp3` | [Fire Staff Sound Effects](https://opengameart.org/content/fire-staff-sound-effects) | LEGIT Audio | CC0 | Used Fire Staff 20; trimmed silence, loudness balanced, faded, and encoded to MP3. |
| `cannon-blast.mp3` | [Battle at sea](https://opengameart.org/content/battle-at-sea) | Thimras | CC0 | Used cannon_fire_1; trimmed, filtered, loudness balanced, faded, and encoded to MP3. |
| `ice-crackle.mp3` | [Ice spells](https://opengameart.org/content/ice-spells) | bart | CC0 | Used coldsnap; trimmed silence, filtered, loudness balanced, faded, and encoded to MP3. |

The game layers, pitch shifts, fades, and mixes these recordings at runtime. Wind and fountain ambience are generated with filtered broadband noise.
