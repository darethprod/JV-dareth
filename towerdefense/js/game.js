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
    this.waveManager = new WaveManager(map);
    this.towers = [];
    this.running = false;
    this.lastTime = 0;
    this.draggedUnit = false;
    this.selectedTower = null;

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', this.resize);
    this.bindUnitPlacement();
    this.resize();
    this.updateHud();
  }

  start() {
    if (this.running) return;
    const launch = () => {
      if (!this.waveManager.preparePath()) {
        console.error('Impossible de trouver le chemin sur la carte fournie.');
        return;
      }
      this.running = true;
      this.lastTime = performance.now();
      this.waveManager.startWave();
      requestAnimationFrame(this.loop);
    };
    if (this.map.complete && this.map.naturalWidth) launch();
    else this.map.addEventListener('load', launch, { once: true });
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  bindUnitPlacement() {
    this.unitSlot.addEventListener('dragstart', (event) => {
      this.draggedUnit = true;
      event.dataTransfer?.setData('text/plain', 'proletaire');
    });
    this.unitSlot.addEventListener('dragend', () => { this.draggedUnit = false; });
    this.canvas.addEventListener('dragover', (event) => { if (this.draggedUnit) event.preventDefault(); });
    this.canvas.addEventListener('drop', (event) => {
      event.preventDefault();
      if (!this.draggedUnit) return;
      const x = event.clientX, y = event.clientY;
      if (!this.isWater(x, y)) this.towers.push(new Tower(x, y));
      this.draggedUnit = false;
    });
    this.canvas.addEventListener('click', (event) => {
      this.selectedTower = this.towers.find((tower) => Math.hypot(tower.x - event.clientX, tower.y - event.clientY) < 24) || null;
      for (const tower of this.towers) tower.selected = tower === this.selectedTower;
    });
  }

  isWater(x, y) {
    if (!this.map.complete || !this.map.naturalWidth) return true;
    const sample = document.createElement('canvas');
    sample.width = sample.height = 1;
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(this.map, x / innerWidth * this.map.naturalWidth, y / innerHeight * this.map.naturalHeight, 1, 1, 0, 0, 1, 1);
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
    for (const mob of mobs) if (mob.reachedCore && !mob.coreDamaged) { this.core.damage(mob.damage); mob.coreDamaged = true; }
    this.updateHud();
    this.ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const tower of this.towers) tower.draw(this.ctx);
    for (const mob of mobs) mob.draw(this.ctx);
    if (this.core.hp <= 0) { this.running = false; return; }
    requestAnimationFrame(this.loop);
  }
}
