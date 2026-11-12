'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Power-ups ────────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_TTL         = 10;
const POWERUP_TYPES       = ['speed', 'triple', 'shield'];

const SPEED_COLOR      = '#ffd84d';
const BOOST_DURATION   = 5;
const BOOST_MULTIPLIER = 2;

const TRIPLE_COLOR    = '#ff5db1';
const TRIPLE_DURATION = 5;

const SHIELD_COLOR    = '#5fd0ff';
const SHIELD_DURATION = 6;

// ── Estrella fugaz ───────────────────────────────────────────────────────────
const STAR_COLOR        = '#9fd8ff';
const STAR_POINTS       = 250;
const STAR_TTL          = 5;
const STAR_RADIUS       = 10;
const STAR_SPAWN_MIN    = 6;
const STAR_SPAWN_MAX    = 14;

// ── Skins ────────────────────────────────────────────────────────────────────
const SKIN_KEY        = 'asteroids.skin';
const SKIN_NOTICE_TTL = 2;

const SKINS = [
  {
    id: 'classic',
    name: 'CLÁSICO',
    color: '#fff',
    flame: 'rgba(255, 130, 0, 0.85)',
    verts: [[20, 0], [-12, -9], [-7, 0], [-12, 9]],
  },
  {
    id: 'dart',
    name: 'DART',
    color: '#4dd8ff',
    flame: 'rgba(120, 200, 255, 0.85)',
    verts: [[22, 0], [-10, -5], [-4, 0], [-10, 5]],
  },
  {
    id: 'stealth',
    name: 'STEALTH',
    color: '#7dff8a',
    flame: 'rgba(125, 255, 138, 0.85)',
    verts: [[18, 0], [-14, -13], [-6, 0], [-14, 13]],
  },
  {
    id: 'interceptor',
    name: 'INTERCEPTOR',
    color: '#ff6ad5',
    flame: 'rgba(255, 106, 213, 0.85)',
    verts: [[20, 0], [0, -3], [-3, -11], [-9, -11], [-7, 0], [-9, 11], [-3, 11], [0, 3]],
  },
];

let currentSkinIndex = loadSkinIndex();
let skinNoticeTimer  = 0;

function loadSkinIndex() {
  try {
    const id = localStorage.getItem(SKIN_KEY);
    const i  = SKINS.findIndex(s => s.id === id);
    if (i >= 0) return i;
  } catch { /* localStorage no disponible */ }
  return 0;
}

function saveSkin() {
  try { localStorage.setItem(SKIN_KEY, SKINS[currentSkinIndex].id); } catch { /* ídem */ }
}

function currentSkin() {
  return SKINS[currentSkinIndex];
}

function cycleSkin() {
  currentSkinIndex = (currentSkinIndex + 1) % SKINS.length;
  saveSkin();
  skinNoticeTimer = SKIN_NOTICE_TTL;
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── ShootingStar ─────────────────────────────────────────────────────────────
class ShootingStar {
  constructor() {
    this.x = rand(0, W);
    this.y = rand(0, H);
    const angle = rand(0, Math.PI * 2);
    const speed = rand(220, 280);
    this.vx     = Math.cos(angle) * speed;
    this.vy     = Math.sin(angle) * speed;
    this.rot    = Math.atan2(this.vy, this.vx);
    this.ttl    = STAR_TTL;
    this.radius = STAR_RADIUS;
    this.dead   = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo cuando está por desaparecer
    if (this.ttl < 1 && Math.floor(this.ttl * 6) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    // Estela: línea larga opuesta al movimiento
    ctx.strokeStyle = 'rgba(159, 216, 255, 0.35)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-46, 0);
    ctx.stroke();

    // Estrella de 4 puntas
    ctx.strokeStyle = STAR_COLOR;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo( 10,  0);
    ctx.lineTo(  3, -3);
    ctx.lineTo(  0, -10);
    ctx.lineTo( -3, -3);
    ctx.lineTo(-10,  0);
    ctx.lineTo( -3,  3);
    ctx.lineTo(  0,  10);
    ctx.lineTo(  3,  3);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedBoost    = 0;
    this.tripleShot    = 0;
    this.shield        = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoost    > 0) this.speedBoost    -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;
    if (this.shield        > 0) this.shield        -= dt;

    const boost = this.speedBoost > 0 ? BOOST_MULTIPLIER : 1;
    const ROT   = 3.5 * boost;   // rad/s
    const THRUST = 260 * boost;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = currentSkin().verts[0][0];   // distancia de la nariz según skin
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot <= 0) return [new Bullet(ox, oy, this.angle)];

    // Tres balas paralelas: central y dos desplazadas perpendicularmente
    const SIDE = 8;
    const px   = -Math.sin(this.angle) * SIDE;
    const py   =  Math.cos(this.angle) * SIDE;
    return [
      new Bullet(ox, oy, this.angle),
      new Bullet(ox + px, oy + py, this.angle),
      new Bullet(ox - px, oy - py, this.angle),
    ];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const skin = currentSkin();
    ctx.strokeStyle = this.tripleShot > 0 ? TRIPLE_COLOR
                    : this.speedBoost > 0 ? SPEED_COLOR
                    : skin.color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta según skin activo
    ctx.beginPath();
    ctx.moveTo(skin.verts[0][0], skin.verts[0][1]);
    for (let i = 1; i < skin.verts.length; i++)
      ctx.lineTo(skin.verts[i][0], skin.verts[i][1]);
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = skin.flame;
      ctx.stroke();
    }

    ctx.restore();

    this.drawShield();
  }

  drawShield() {
    if (this.shield <= 0) return;
    // Parpadeo cuando está por expirar
    if (this.shield < 1.5 && Math.floor(this.shield * 6) % 2 === 0) return;

    ctx.strokeStyle = SHIELD_COLOR;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 26, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp (velocidad / triple / escudo) ────────────────────────────────────
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type || POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)];
    const angle = rand(0, Math.PI * 2);
    const speed = 25;
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.ttl  = POWERUP_TTL;
    this.radius = 11;
    this.dead = false;
  }

  color() {
    return this.type === 'shield' ? SHIELD_COLOR
         : this.type === 'triple' ? TRIPLE_COLOR
         : SPEED_COLOR;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo cuando está por expirar
    if (this.ttl < 2 && Math.floor(this.ttl * 6) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = this.color();
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    if (this.type === 'triple') {
      // Tres líneas paralelas: triple disparo
      ctx.beginPath();
      ctx.moveTo(-5, -7);
      ctx.lineTo(-5,  7);
      ctx.moveTo( 0, -7);
      ctx.lineTo( 0,  7);
      ctx.moveTo( 5, -7);
      ctx.lineTo( 5,  7);
    } else if (this.type === 'shield') {
      // Escudo: semicírculo con base
      ctx.beginPath();
      ctx.arc(0, -1, 7, Math.PI, 0);
      ctx.lineTo(-7, 4);
      ctx.lineTo(7, 4);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, 7);
      ctx.lineTo(4, 7);
      ctx.stroke();
    } else {
      // Doble «»: silueta de nave con flechas de velocidad
      ctx.beginPath();
      ctx.moveTo(-6, -5);
      ctx.lineTo( 1,  0);
      ctx.lineTo(-6,  5);
      ctx.moveTo( 4, -5);
      ctx.lineTo(11,  0);
      ctx.lineTo( 4,  5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups, shootingStars;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let starSpawnTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship      = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups  = [];
  shootingStars = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  starSpawnTimer = rand(STAR_SPAWN_MIN, STAR_SPAWN_MAX);
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerups  = [];
  shootingStars = [];
  starSpawnTimer = rand(STAR_SPAWN_MIN, STAR_SPAWN_MAX);
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function dropPowerUp(x, y) {
  powerups.push(new PowerUp(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead       = true;
  ship.speedBoost = 0;
  ship.tripleShot = 0;
  ship.shield     = 0;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (pressed('KeyC')) cycleSkin();
  if (skinNoticeTimer > 0) skinNoticeTimer -= dt;

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    powerups.forEach(p => p.update(dt));
    powerups  = powerups.filter(p => !p.dead);
    shootingStars.forEach(s => s.update(dt));
    shootingStars = shootingStars.filter(s => !s.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    powerups.forEach(p => p.update(dt));
    powerups  = powerups.filter(p => !p.dead);
    shootingStars.forEach(s => s.update(dt));
    shootingStars = shootingStars.filter(s => !s.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerups.forEach(p => p.update(dt));
  shootingStars.forEach(s => s.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerups  = powerups.filter(p => !p.dead);
  shootingStars = shootingStars.filter(s => !s.dead);

  // Aparición de estrella fugaz (tiempo aleatorio)
  starSpawnTimer -= dt;
  if (starSpawnTimer <= 0) {
    shootingStars.push(new ShootingStar());
    starSpawnTimer = rand(STAR_SPAWN_MIN, STAR_SPAWN_MAX);
  }

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        if (Math.random() < POWERUP_DROP_CHANCE) dropPowerUp(a.x, a.y);
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala vs estrella fugaz
  for (const b of bullets) {
    for (const s of shootingStars) {
      if (!s.dead && !b.dead && dist(b, s) < s.radius + 4) {
        b.dead = true;
        s.dead = true;
        score += STAR_POINTS;
        explode(s.x, s.y, 10);
        if (Math.random() < POWERUP_DROP_CHANCE) dropPowerUp(s.x, s.y);
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);
  shootingStars = shootingStars.filter(s => !s.dead);

  // Nave vs asteroide (el escudo bloquea el impacto)
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.shield > 0) {
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          asteroids.push(...a.split());
          if (Math.random() < POWERUP_DROP_CHANCE) dropPowerUp(a.x, a.y);
        } else {
          killShip();
        }
        break;
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead);

  // Nave vs estrella fugaz (el escudo bloquea el impacto)
  if (ship.invincible <= 0) {
    for (const s of shootingStars) {
      if (!s.dead && dist(ship, s) < ship.radius + s.radius) {
        s.dead = true;
        if (ship.shield > 0) {
          score += STAR_POINTS;
          explode(s.x, s.y, 10);
          if (Math.random() < POWERUP_DROP_CHANCE) dropPowerUp(s.x, s.y);
        } else {
          killShip();
        }
        break;
      }
    }
  }
  shootingStars = shootingStars.filter(s => !s.dead);

  // Nave vs power-up
  for (const p of powerups) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === 'triple')      ship.tripleShot = TRIPLE_DURATION;
      else if (p.type === 'shield') ship.shield     = SHIELD_DURATION;
      else                          ship.speedBoost = BOOST_DURATION;
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  const skin = currentSkin();
  const SCALE = 0.45;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = skin.color;
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(skin.verts[0][0] * SCALE, skin.verts[0][1] * SCALE);
  for (let i = 1; i < skin.verts.length; i++)
    ctx.lineTo(skin.verts[i][0] * SCALE, skin.verts[i][1] * SCALE);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  if (ship.speedBoost > 0) {
    ctx.fillStyle = SPEED_COLOR;
    ctx.textAlign = 'left';
    ctx.fillText(`RAPIDO ${ship.speedBoost.toFixed(1)}s`, 14, 46);
  }

  if (ship.tripleShot > 0) {
    ctx.fillStyle = TRIPLE_COLOR;
    ctx.textAlign = 'left';
    ctx.fillText(`TRIPLE ${ship.tripleShot.toFixed(1)}s`, 14, 66);
  }

  if (ship.shield > 0) {
    ctx.fillStyle = SHIELD_COLOR;
    ctx.textAlign = 'left';
    ctx.fillText(`ESCUDO ${ship.shield.toFixed(1)}s`, 14, 86);
  }

  if (skinNoticeTimer > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, skinNoticeTimer).toFixed(2)})`;
    ctx.textAlign = 'left';
    ctx.fillText(`SKIN ${currentSkin().name}`, 14, 106);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  powerups.forEach(p => p.draw());
  shootingStars.forEach(s => s.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
