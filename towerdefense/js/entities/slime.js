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
    this.coreDamaged = false;
    this.sprite = new Image();
    this.sprite.src = 'trashmobs/slime.png';
  }

  update(dt) {
    if (this.dead || this.reachedCore) return;
    const target = this.path[this.pathIndex + 1];
    if (!target) { this.reachedCore = true; return; }
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
    const size = 32;
    if (this.sprite.complete && this.sprite.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.sprite, this.x - size / 2, this.y - size / 2, size, size);
    }
    ctx.fillStyle = '#1b120d';
    ctx.fillRect(this.x - 11, this.y - 21, 22, 3);
    ctx.fillStyle = '#b9362d';
    ctx.fillRect(this.x - 11, this.y - 21, 22 * Math.max(0, this.hp / this.maxHp), 3);
    ctx.restore();
  }
}
