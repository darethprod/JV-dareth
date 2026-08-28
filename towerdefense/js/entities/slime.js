export class Slime {
  constructor(path, hp = 5) {
    this.path = path;
    this.pathIndex = 0;
    this.x = path[0].x;
    this.y = path[0].y;
    this.hp = hp;
    this.maxHp = hp;
    this.damage = 1;
    this.speed = 34;
    this.dead = false;
    this.reachedCore = false;
  }

  update(dt) {
    if (this.dead || this.reachedCore) return;
    const target = this.path[this.pathIndex + 1];
    if (!target) {
      this.reachedCore = true;
      return;
    }
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (distance <= step) {
      this.x = target.x;
      this.y = target.y;
      this.pathIndex += 1;
    } else {
      this.x += dx / distance * step;
      this.y += dy / distance * step;
    }
  }

  draw(ctx) {
    if (this.dead || this.reachedCore) return;
    ctx.save();
    ctx.fillStyle = '#6fbd57';
    ctx.strokeStyle = '#284b21';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(this.x - 10, this.y - 22, 20, 3);
    ctx.fillStyle = '#d33';
    ctx.fillRect(this.x - 10, this.y - 22, 20 * (this.hp / this.maxHp), 3);
    ctx.restore();
  }
}
