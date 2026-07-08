(() => {
  'use strict';

  // ---------- Config ----------
  const GRID_SIZE = 20;              // 20x20 cells
  const BASE_SPEED_MS = 150;         // starting tick interval
  const MIN_SPEED_MS = 60;           // fastest the snake will ever move
  const SPEEDUP_PER_LEVEL = 10;      // ms shaved off per level
  const FOOD_PER_LEVEL = 4;          // foods eaten before leveling up

  const COLORS = {
    bg: '#08051a',
    grid: '#12102a',
    snakeHead: '#08d9d6',
    snakeBody: '#2ee6c4',
    food: '#ff2e63',
    foodGlow: 'rgba(255,46,99,0.5)'
  };

  // ---------- DOM ----------
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const levelEl = document.getElementById('level');
  const startOverlay = document.getElementById('startOverlay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const finalScoreEl = document.getElementById('finalScore');
  const newBestBadge = document.getElementById('newBestBadge');
  const startBtn = document.getElementById('startBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const retryBtn = document.getElementById('retryBtn');
  const muteBtn = document.getElementById('muteBtn');
  const soundOnIcon = document.getElementById('soundOnIcon');
  const soundOffIcon = document.getElementById('soundOffIcon');
  const dpadBtns = document.querySelectorAll('.dpad-btn');

  // Canvas is styled to 100% width/height via CSS; keep an internal
  // resolution independent of the CSS box so pixels stay crisp.
  const CELL_PX = canvas.width / GRID_SIZE;

  // ---------- Sound (procedural, no assets, session-only mute) ----------
  let audioCtx = null;
  let muted = false;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
  }

  function beep(freq, durationMs, type = 'square', volume = 0.05) {
    if (muted || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  }

  const sfx = {
    eat: () => beep(660, 90, 'square', 0.06),
    levelUp: () => { beep(523, 90); setTimeout(() => beep(784, 140), 90); },
    gameOver: () => { beep(220, 160, 'sawtooth', 0.06); setTimeout(() => beep(110, 260, 'sawtooth', 0.06), 150); },
    turn: () => beep(320, 30, 'square', 0.02)
  };

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.setAttribute('aria-pressed', String(muted));
    soundOnIcon.style.display = muted ? 'none' : '';
    soundOffIcon.style.display = muted ? '' : 'none';
  });

  // ---------- Game state ----------
  let snake, direction, pendingDirection, food, score, best = 0, level, tickMs;
  let running = false;
  let paused = false;
  let lastTick = 0;
  let rafId = null;

  function resetState() {
    const mid = Math.floor(GRID_SIZE / 2);
    snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid }
    ];
    direction = { x: 1, y: 0 };
    pendingDirection = direction;
    score = 0;
    level = 1;
    tickMs = BASE_SPEED_MS;
    placeFood();
    updateHud();
  }

  function placeFood() {
    let candidate;
    do {
      candidate = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
    } while (snake.some(seg => seg.x === candidate.x && seg.y === candidate.y));
    food = candidate;
  }

  function updateHud() {
    scoreEl.textContent = String(score).padStart(3, '0');
    bestEl.textContent = String(best).padStart(3, '0');
    levelEl.textContent = String(level).padStart(2, '0');
  }

  // ---------- Input ----------
  const KEY_MAP = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 }
  };

  function setDirection(next) {
    // Prevent reversing directly into the snake's own neck.
    if (snake.length > 1 && next.x === -direction.x && next.y === -direction.y) return;
    pendingDirection = next;
    sfx.turn();
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (running) togglePause();
      return;
    }
    const dir = KEY_MAP[e.key];
    if (dir && running && !paused) setDirection(dir);
  });

  dpadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!running || paused) return;
      const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      setDirection(map[btn.dataset.dir]);
    });
  });

  // Swipe controls
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    if (!touchStart || !running || paused) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; // ignore taps
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      setDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
    touchStart = null;
  });

  // ---------- Game loop ----------
  function step(timestamp) {
    if (!running || paused) return;
    rafId = requestAnimationFrame(step);
    if (timestamp - lastTick < tickMs) return;
    lastTick = timestamp;

    direction = pendingDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      return gameOver();
    }
    // Self collision
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      return gameOver();
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 10;
      sfx.eat();
      if (score % (FOOD_PER_LEVEL * 10) === 0) levelUp();
      placeFood();
    } else {
      snake.pop();
    }

    updateHud();
    draw();
  }

  function levelUp() {
    level += 1;
    tickMs = Math.max(MIN_SPEED_MS, BASE_SPEED_MS - (level - 1) * SPEEDUP_PER_LEVEL);
    sfx.levelUp();
  }

  function draw() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_PX, 0);
      ctx.lineTo(i * CELL_PX, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_PX);
      ctx.lineTo(canvas.width, i * CELL_PX);
      ctx.stroke();
    }

    // Food with a soft glow pulse
    const pulse = 2 + Math.sin(Date.now() / 150) * 1.5;
    ctx.shadowColor = COLORS.foodGlow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_PX + CELL_PX / 2,
      food.y * CELL_PX + CELL_PX / 2,
      CELL_PX / 2 - 2 + pulse * 0.15,
      0, Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? COLORS.snakeHead : COLORS.snakeBody;
      const pad = 1.5;
      ctx.fillRect(seg.x * CELL_PX + pad, seg.y * CELL_PX + pad, CELL_PX - pad * 2, CELL_PX - pad * 2);
    });
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(rafId);
    sfx.gameOver();
    const isNewBest = score > best;
    if (isNewBest) best = score;
    finalScoreEl.textContent = `Score: ${score}`;
    newBestBadge.classList.toggle('hidden', !isNewBest);
    updateHud();
    show(gameOverOverlay);
  }

  function togglePause() {
    paused = !paused;
    if (paused) {
      show(pauseOverlay);
    } else {
      hide(pauseOverlay);
      lastTick = 0;
      rafId = requestAnimationFrame(step);
    }
  }

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function startGame() {
    ensureAudio();
    resetState();
    hide(startOverlay);
    hide(pauseOverlay);
    hide(gameOverOverlay);
    running = true;
    paused = false;
    lastTick = 0;
    draw();
    rafId = requestAnimationFrame(step);
  }

  startBtn.addEventListener('click', startGame);
  retryBtn.addEventListener('click', startGame);
  resumeBtn.addEventListener('click', togglePause);

  // Initial paint so the board isn't blank behind the start overlay.
  resetState();
  draw();
})();
