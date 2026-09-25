# Game deployment

The user's playable game is the public GitHub Pages site at https://colelifts.github.io/genie-midnight-run/. Do not present a localhost URL as the delivered game.

For every game update: make the change in this repository, run `npm run build:pages`, commit and push to `main`, wait for the `Publish Genie Kart` GitHub Actions workflow to succeed, then open the public URL and verify the new version works there. An update is unfinished until the public site has the change.

The GitHub repository is https://github.com/colelifts/genie-midnight-run. Keep secrets and local dependencies out of commits. The deploy workflow publishes `dist/` when `main` changes.
