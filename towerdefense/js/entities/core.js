export class Core {
  constructor(hp) {
    this.hp = hp;
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount);
  }
}
