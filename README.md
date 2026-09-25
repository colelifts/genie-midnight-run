# Genie's Midnight Run

A playable browser prototype of the endless Genie-only kart race. It uses original procedural proxy geometry and original synthesized sounds; it does not contain ripped film or game assets.

## Play

On Windows, double-click `play.cmd`. It installs the small development dependencies on first run and starts a local server. Open the URL printed in the terminal, usually <http://127.0.0.1:5173/>. Keep that terminal open while playing.

Or run `npm install` followed by `npm run dev` in this folder. `npm run build` verifies TypeScript and creates the production files in `dist/`.

## Controls

| Action | Keyboard | Controller |
| --- | --- | --- |
| Accelerate / brake | W / S or Up / Down | Right / left trigger |
| Steer | A / D or Left / Right | Left stick |
| Drift and hop | Space | X |
| Three Wishes | Hold E, release on Boost, Shield, or Shot | Hold B, release |
| Quick-test wishes | 1 Boost, 2 Shield, 3 Shot | — |
| Cosmic Showstopper | Q | Y |
| Pause | Escape | — |

Wishes have no cooldown in this test build. The Ultimate can be used again immediately after its five-second effect ends. During the Ultimate, Genie is faster and shielded; a kart he bumps is stunned for 1.25 seconds with circling birds and stars. Each opponent can be stunned once per Ultimate activation. The race has no finish condition, so laps continue until you pause or close the page.

## Course

The Agrabah circuit has a market alley, an optional rooftop route with a magic-carpet boost pad, palace-garden curves, and a desert cave. Market carts, breakable crates, and moving boulders are the current obstacles. Gold wish sparks provide a small boost, with a 12% chance for Genie's passive to upgrade it into a longer boost and brief shield.

Append `?demo=1` to the URL to watch an automatic drive around the course for inspection.
