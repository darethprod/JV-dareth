import { WaveManager } from './systems/waves.js';
import { Core } from './entities/core.js';
import { Tower } from './entities/tower.js';

export class Game {
  constructor({ canvas, map, hud, unitSlot }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = map;
    this.hud = hud;
    this.unitSlot = unitSlot;
    this.core = new Core(100);
    this.waveManager = new WaveManager();
    this.towers = [];
    this.running = false;
    this.lastTime = 0;
    this.draggedUnit = false;

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', this.resize);
    this.bindUnitPlacement();
    this.resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.waveManager.startWave();
    requestAnimationFrame(this.loop);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  bindUnitPlacement() {
    this.unitSlot.addEventListener('dragstart', (event) => {
      this.draggedUnit = true;
      event.dataTransfer?.setData('text/plain', 'proletaire');
    });

    this.unitSlot.addEventListener('dragend', () => {
      this.draggedUnit = false;
    });

    this.map.addEventListener('dragover', (event) => event.preventDefault());
    this.map.addEventListener('drop', (event) => {
      event.preventDefault();
      if (!this.draggedUnit) return;
      const rect = this.map.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (this.isWater(x, y, rect.width, rect.height)) return;
      this.towers.push(new Tower(x, y));
      this.draggedUnit = false;
    });
  }

  // The map remains the source of truth for terrain. Placement is rejected on
  // the blue water pixels; no extra map geometry is introduced here.
  isWater(x, y, width, height) {
    const source = document.createElement('canvas');
    const size = 1;
    source.width = size;
    source.height = size;
    const sctx = source.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(this.map, x / width * this.map.naturalWidth, y / height * this.map.naturalHeight, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = sctx.getImageData(0, 0, 1, 1).data;
    return b > r * 1.25 && b > g * 1.05;
  }

  loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this.lastTime) / 1000 || 0, 0.05);
    this.lastTime = timestamp;

    const mobs = this.waveManager.update(dt);
    for (const tower of this.towers) tower.update(dt, mobs);
    for (const mob of mobs) {
      if (mob.reachedCore) this.core.damage(mob.damage);
    }

    this.hud.wave.textContent = this.waveManager.wave;
    this.hud.coreHealth.style.width = `${this.core.hp}%`;

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const mob of mobs) mob.draw(this.ctx);
    for (const tower of this.towers) tower.draw(this.ctx);

    if (this.core.hp <= 0) this.running = false;
    requestAnimationFrame(this.loop);
  }
}
