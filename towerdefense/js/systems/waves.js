import { Slime } from '../entities/slime.js';

export class WaveManager {
  constructor(map) {
    this.map = map;
    this.wave = 1;
    this.mobs = [];
    this.spawnTimer = 0;
    this.toSpawn = 0;
    this.path = [];
  }

  preparePath() {
    const cols = 80;
    const rows = Math.max(30, Math.round(cols * innerHeight / innerWidth));
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = cols;
    mapCanvas.height = rows;
    const ctx = mapCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(this.map, 0, 0, cols, rows);
    const image = ctx.getImageData(0, 0, cols, rows).data;

    const water = (x, y) => {
      const i = (y * cols + x) * 4;
      const r = image[i], g = image[i + 1], b = image[i + 2];
      return b > r * 1.25 && b > g * 1.05;
    };

    const start = this.findLandOnEdge(0, rows, water);
    const goal = this.findLandOnEdge(cols - 1, rows, water);
    if (!start || !goal) return false;

    const queue = [start];
    const previous = new Map([[`${start.x},${start.y}`, null]]);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    while (queue.length) {
      const current = queue.shift();
      if (current.x === goal.x && current.y === goal.y) break;
      for (const [dx, dy] of dirs) {
        const x = current.x + dx, y = current.y + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows || water(x, y)) continue;
        const key = `${x},${y}`;
        if (previous.has(key)) continue;
        previous.set(key, current);
        queue.push({x, y});
      }
    }

    const goalKey = `${goal.x},${goal.y}`;
    if (!previous.has(goalKey)) return false;
    const points = [];
    let current = goal;
    while (current) {
      points.push({x: current.x / cols * innerWidth, y: current.y / rows * innerHeight});
      current = previous.get(`${current.x},${current.y}`);
    }
    points.reverse();
    this.path = this.simplifyPath(points);
    return this.path.length > 1;
  }

  findLandOnEdge(x, rows, water) {
    for (let y = Math.floor(rows * 0.2); y < Math.floor(rows * 0.8); y++) {
      if (!water(x, y)) return {x, y};
    }
    return null;
  }

  simplifyPath(points) {
    if (points.length < 3) return points;
    const result = [points[0]];
    let previousDirection = null;
    for (let i = 1; i < points.length; i++) {
      const dx = Math.sign(points[i].x - points[i - 1].x);
      const dy = Math.sign(points[i].y - points[i - 1].y);
      const direction = `${dx},${dy}`;
      if (previousDirection && direction !== previousDirection) result.push(points[i - 1]);
      previousDirection = direction;
    }
    result.push(points[points.length - 1]);
    return result;
  }

  startWave() {
    this.toSpawn = this.wave + 4;
    this.spawnTimer = 0;
  }

  update(dt) {
    if (this.toSpawn > 0 && this.path.length > 1) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.mobs.push(new Slime(this.path, 5 + (this.wave - 1)));
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
}
