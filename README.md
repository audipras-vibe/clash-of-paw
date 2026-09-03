# Clash of Paw

A dependency-free, installable browser vertical slice of a 1v1 dog tower battler. The public landing page introduces the world and heroes; the dedicated game web-app contains the playable prototype, modes, collection, market, wallet preview, and whitepaper access.

## Play locally

Serve this folder with any static web server and open it in a modern browser. No dependencies or build step are required.

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`. Use **Enter the Kennel** to launch the game client at `/play.html`.

## Controls

- Click a hero card to summon; keyboard shortcuts are `1`, `2`, and `3`.
- Use Pack Mend and Guard Rally with `Q` and `W`.
- Pause with the pause button or `Escape`.
- Choose Easy, Normal, or Hard before starting a match.

## Current vertical slice

- Three-minute matches with double energy in the final minute
- Three heroes with distinct stats and autonomous special abilities
- Tower attacks, armor, shields, healing, critical hits, area damage, and burning
- Three AI difficulties, synthesized sound feedback, emotes, pause, and results
- Responsive desktop and mobile layouts
- Separate marketing landing page and desktop-style game client
- PWA manifest and offline caching
- Versioned game/economy design paper with provisional tokenomics

## Economy position

Treats are proposed as non-transferable game points. PAW is a conditional, fixed-supply ecosystem-token design that remains gated behind product, legal, security, market-integrity, and community review. Neither asset grants competitive power.

## Publish with GitHub Pages

In repository settings, open **Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.

## Character art

Brutus, Sage, and Hex were generated as original dog counterparts using the team-owned Purraria character sheets as visual-role references. The production PNG cutouts live in `assets/characters/`.
