# Genie's Midnight Run

A browser kart racing prototype with ten selectable racers, three-lap races, drifting, shortcuts, track hazards, signature abilities, and ultimate powers. The Agrabah circuit includes a market, rooftops, palace garden, and desert cave. Several character and kart models were carried over from the user's earlier Godot kart project; the other visuals are original game geometry. Audio sources and licenses are listed in [AUDIO_CREDITS.md](AUDIO_CREDITS.md).

## Play online

Open **https://colelifts.github.io/genie-midnight-run/** on a laptop or another device. GitHub Pages hosts the game, so the developer's local server does not need to stay open.

Every update pushed to `main` triggers `.github/workflows/deploy.yml`. The deployment is complete after the workflow succeeds and the public game is checked.

## Local development

Run `npm install` once, then `npm run dev` for a local preview. Run `npm run build:pages` before publishing; it checks map geometry, collisions, handling, UFO targeting, TypeScript, and the production build.

## Controls

| Action | Keyboard |
| --- | --- |
| Accelerate / brake | W / S or Up / Down |
| Steer | A / D or Left / Right |
| Drift and hop | Space |
| Signature ability | E |
| Ultimate | Q when charged |
| Wonder Orb item | R |
| Pause | Escape |

Genie and Buzz can hold E to aim or select their signature power. The character select screen shows each racer's passive, E ability, and Q ultimate. The ultimate powers last about 18–20 seconds and have their own music.

Append `?demo=1` to the URL to watch an automatic drive around the course for inspection.
