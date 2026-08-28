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
    this.updateHud();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
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
    this.unitSlot.addEventListener('dragend', () => { this.draggedUnit = false; });

    this.canvas.addEventListener('dragover', (event) => {
      if (this.draggedUnit) event.preventDefault();
    });
    this.canvas.addEventListener('drop', (event) => {
      event.preventDefault();
      if (!this.draggedUnit) return;
      const x = event.clientX;
      const y = event.clientY;
      if (this.isWater(x, y)) {
        this.draggedUnit = false;
        return;
      }
      this.towers.push(new Tower(x, y));
      this.draggedUnit = false;
    });
  }

  isWater(x, y) {
    if (!this.map.complete || !this.map.naturalWidth) return false;
    const sample = document.createElement('canvas');
    sample.width = sample.height = 1;
    const context = sample.getContext('2d', { willReadFrequently: true });
    const sourceX = Math.max(0, Math.min(this.map.naturalWidth - 1, x / innerWidth * this.map.naturalWidth));
    const sourceY = Math.max(0, Math.min(this.map.naturalHeight - 1, y / innerHeight * this.map.naturalHeight));
    context.drawImage(this.map, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return b > r * 1.25 && b > g * 1.05;
  }

  updateHud() {
    this.hud.wave.textContent = String(this.waveManager.wave);
    this.hud.coreHealth.style.width = `${this.core.hp}%`;
  }

  loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    const mobs = this.waveManager.update(dt);
    for (const tower of this.towers) tower.update(dt, mobs);
    for (const mob of mobs) {
      if (mob.reachedCore && !mob.coreDamaged) {
        this.core.damage(mob.damage);
        mob.coreDamaged = true;
      }
    }

    this.updateHud();
    this.ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const tower of this.towers) tower.draw(this.ctx);
    for (const mob of mobs) mob.draw(this.ctx);

    if (this.core.hp <= 0) {
      this.running = false;
      return;
    }
    requestAnimationFrame(this.loop);
  }
}
