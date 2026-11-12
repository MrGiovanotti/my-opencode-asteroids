# AGENTS.md

## What this is

Asteroids clone in plain HTML5 Canvas. **All game logic lives in `game.js`** (single file, ~400 lines). No build step, no dependencies, no bundler, no tests, no linter.

## Running / verifying

- Open `index.html` directly in a browser, or `npx serve .` → `http://localhost:3000`.
- There is no automated verification. Test changes by playing the game in the browser.

## Gotchas

- Canvas size is **duplicated**: `width`/`height` in `index.html` must match the `W`/`H` consts at the top of `game.js`. Update both together.
- No module system: `game.js` is loaded via a plain `<script>` tag, so ordering and global scope matter; don't use `import`/`export`.
- Input uses a `justPressed` map consumed by `pressed(code)` (edge-detection: calling it clears the flag). Use `keys[code]` for held state, `pressed()` for single-fire actions like shooting.
- UI text, code comments, and README are in Spanish — keep new strings and comments consistent.
- Structure inside `game.js`: classes `Bullet`, `Asteroid`, `Ship`, `Particle`, then game state functions, then `update(dt)` / `draw()`, with the `requestAnimationFrame` loop at the bottom.
- Ship skins are data-driven: each entry in the `SKINS` array defines `id`, `name`, `color`, `flame`, and `verts` (polygon points, nose on +X). Add a new skin by appending an object there — `Ship.draw()`, `drawLifeIcon()`, and bullet spawn distance all derive from the active skin. Selection cycles with `C` and persists in `localStorage` (`asteroids.skin`).
