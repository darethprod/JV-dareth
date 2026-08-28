export class Tower {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.range = 120;
    this.cooldown = 0;
  }

  update(dt, mobs) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const target = mobs.find((mob) => !mob.dead && Math.hypot(mob.x - this.x, mob.y - this.y) <= this.range);
    if (!target) return;
    target.hp = Math.max(0, target.hp - 1);
    if (target.hp <= 0) target.dead = true;
    this.cooldown = 0.75;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = '#6b4424';
    ctx.strokeStyle = '#2b190d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
