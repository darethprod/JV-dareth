import { Slime } from '../entities/slime.js';

export class WaveManager {
  constructor() {
    this.wave = 1;
    this.mobs = [];
    this.spawnTimer = 0;
    this.toSpawn = 0;
    this.path = this.buildPath();
  }

  startWave() {
    this.toSpawn = this.wave + 4;
    this.spawnTimer = 0;
  }

  update(dt) {
    if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const hp = 5 + (this.wave - 1);
        this.mobs.push(new Slime(this.path, hp));
        this.toSpawn -= 1;
        this.spawnTimer = Math.max(0.25, 0.85 - this.wave * 0.02);
      }
    }

    for (const mob of this.mobs) mob.update(dt);
    this.mobs = this.mobs.filter((mob) => !mob.dead && !mob.reachedCore);

    if (this.toSpawn === 0 && this.mobs.length === 0 && this.wave < 20) {
      this.wave += 1;
      this.startWave();
    }
    return this.mobs;
  }

  // Initial path approximation follows the visible map from its left entry
  // toward the core. This is kept isolated so the path can use the map data
  // explicitly when more map metadata is provided.
  buildPath() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return [
      { x: w * 0.02, y: h * 0.52 },
      { x: w * 0.18, y: h * 0.52 },
      { x: w * 0.32, y: h * 0.42 },
      { x: w * 0.48, y: h * 0.42 },
      { x: w * 0.62, y: h * 0.55 },
      { x: w * 0.78, y: h * 0.55 },
      { x: w * 0.96, y: h * 0.5 }
    ];
  }
}
