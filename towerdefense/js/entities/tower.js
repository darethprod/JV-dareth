export class Tower {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.range = 120;
    this.cooldown = 0;
    this.angle = 0;
    this.selected = false;
    this.sprite = new Image();
    this.sprite.src = 'unité/prolétaire/prolétaire.png';
    this.projectile = new Image();
    this.projectile.src = 'unité/prolétaire/attaque animation/projectile1.png';
  }

  update(dt, mobs) {
    this.cooldown -= dt;
    const target = mobs.find((mob) => !mob.dead && Math.hypot(mob.x - this.x, mob.y - this.y) <= this.range);
    if (!target) return;
    this.angle = Math.atan2(target.y - this.y, target.x - this.x);
    if (this.cooldown > 0) return;
    target.hp = Math.max(0, target.hp - 1);
    if (target.hp <= 0) target.dead = true;
    this.cooldown = 0.75;
  }

  draw(ctx) {
    ctx.save();
    if (this.selected) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244,230,166,.12)';
      ctx.strokeStyle = 'rgba(244,230,166,.7)';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (this.sprite.complete && this.sprite.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.sprite, -18, -18, 36, 36);
    }
    ctx.restore();
  }
}
