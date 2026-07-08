# Circuit Viper — Snake (Arcade Cabinet Edition)

A frontend-only Snake game styled as a retro arcade cabinet. Pure HTML/CSS/JS
— no build step, no frameworks, no backend.

## Run it

Just open `index.html` in a browser. No server or install required.

## Project structure

```
build_athon/
├── index.html      # Markup: cabinet frame, screen, HUD, overlays, D-pad
├── css/
│   └── style.css   # Design tokens, marquee-bulb animation, layout, responsive rules
├── js/
│   └── game.js     # Game loop, input handling, collision, scoring, sound
├── vercel.json     # Vercel static deployment config
├── netlify.toml    # Netlify static deployment config
└── README.md
```

## Features (intermediate-level scope)

- Canvas-based grid movement with a `requestAnimationFrame` game loop
  decoupled from render rate (tick-based timing, not frame-based)
- Progressive difficulty: speed increases every few foods eaten, shown as
  a level counter
- Procedurally generated sound effects via the Web Audio API — no audio
  files needed
- Full keyboard (arrows / WASD), on-screen D-pad, and swipe/touch support
- Pause/resume (Space bar or pause overlay)
- Session best score tracking (resets on page reload — no browser storage
  is used, by design)
- Responsive layout: on-screen D-pad only appears on narrow/touch viewports
- Respects `prefers-reduced-motion` for the marquee animation
- Visible keyboard focus states on every interactive control

## Design notes

The visual direction is a 1980s Japanese arcade cabinet: a beveled cabinet
shell, a lit marquee with chasing bulb lights (the signature detail),
a CRT-style screen with scanlines, and a saturated indigo/pink/teal/yellow
palette rather than a neutral UI look. `Press Start 2P` is used sparingly
for numerals and headings; body text uses a monospace face for readability.

## Deploying

This is a static site (no build step), so both Vercel and Netlify can serve
it as-is.

### Vercel

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Framework preset: **Other**. Leave build command empty and output
   directory as `.` (the included `vercel.json` handles this).
4. Deploy — Vercel will serve `index.html` at the root.

Or via CLI:

```bash
npm i -g vercel
vercel --prod
```

### Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** →
   **Import an existing project**, and pick this repo.
2. Build command: leave empty. Publish directory: `.` (already set in
   `netlify.toml`).
3. Deploy.

Or via CLI:

```bash
npm i -g netlify-cli
netlify deploy --prod
```

## Ideas for extending it

- Persist best score with `localStorage` if deploying outside an
  environment that blocks it
- Add obstacles or a second food type worth bonus points
- Add a simple leaderboard via a small backend (would move this out of
  "frontend-only" scope)
