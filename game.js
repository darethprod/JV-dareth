// ============================================
// CONFIGURATION DU JEU
// ============================================

const GAME_CONFIG = {
    WAVE_DURATION: 60, // 1 minute par vague (en secondes)
    TOTAL_WAVES: 10,
    BASE_HP: 10,
    BASE_DAMAGE: 5,
    MAX_PLAYERS: 4,
    SLIME_DAMAGE: 1,
    SLIME_SPAWN_COUNT_BASE: 10,
    SLIME_HITBOX_RADIUS: 20
};

// ============================================
// GESTION DES SPRITES
// ============================================

const SPRITES = {
    CHARACTER_IDLE: 'sprites/The mad/themad.png',
    CHARACTER_ATTACK_1: 'sprites/The mad/themad1.png',
    CHARACTER_ATTACK_2: 'sprites/The mad/themad2.png',
    SLIME: 'sprites/trashmob/slime/slime.png',
    MENU_SELECT: 'sprites/hud/menu/selectiondepsersonnage.png',
    MENU_WAVE: 'sprites/hud/menu/menuentrelesvagues.png',
    STATS: {
        PV: 'sprites/hud/stats/PV.png',
        DAMAGE: 'sprites/hud/stats/damage.png',
        AS: 'sprites/hud/stats/as.png',
        MAGIC: 'sprites/hud/stats/Magiquedamage.png',
        RESISTANCE: 'sprites/hud/stats/resistance.png',
        CRIT: 'sprites/hud/stats/crit.png'
    }
};

// ============================================
// CLASSES DU JEU
// ============================================

class Player {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.baseHP = GAME_CONFIG.BASE_HP;
        this.baseDamage = GAME_CONFIG.BASE_DAMAGE;
        this.hp = this.baseHP;
        this.maxHP = this.baseHP;
        this.damage = this.baseDamage;
        this.attackSpeed = 0; // % bonus
        this.magicDamage = 0;
        this.resistance = 0; // %
        this.critChance = 0; // %
        this.critMultiplier = 2.0;
        
        // Application du passif de The Mad (+10% all stats, +50% attack speed)
        this.applyCharacterPassive();
        
        this.attackCooldown = 0;
        this.baseAttackSpeed = 1000; // ms entre les attaques
        this.currentAttackSpeed = this.baseAttackSpeed * 0.5; // -50% grâce au passif
        
        this.targetAngle = 0;
        this.isAttacking = false;
        this.attackFrame = 0;
        
        this.velocity = { x: 0, y: 0 };
        this.speed = 200; // pixels par seconde
        
        this.kills = 0;
        this.alive = true;
    }
    
    applyCharacterPassive() {
        // Passif The Mad: +10% toutes les stats
        this.maxHP = Math.floor(this.maxHP * 1.1);
        this.hp = this.maxHP;
        this.damage = Math.floor(this.damage * 1.1);
        this.attackSpeed += 10;
        this.magicDamage = Math.floor(this.magicDamage * 1.1);
        this.resistance += 10;
        this.critChance = Math.min(100, this.critChance + 10);
        
        // Bonus attaque speed supplémentaire +50%
        this.currentAttackSpeed = this.baseAttackSpeed * 0.5 * 0.5;
    }
    
    update(deltaTime, input) {
        if (!this.alive) return;
        
        // Mouvement
        this.velocity.x = 0;
        this.velocity.y = 0;
        
        if (input.up) this.velocity.y = -1;
        if (input.down) this.velocity.y = 1;
        if (input.left) this.velocity.x = -1;
        if (input.right) this.velocity.x = 1;
        
        // Normaliser le vecteur si diagonal
        const length = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (length > 0) {
            this.velocity.x /= length;
            this.velocity.y /= length;
        }
        
        // Appliquer la vitesse
        this.x += this.velocity.x * this.speed * deltaTime;
        this.y += this.velocity.y * this.speed * deltaTime;
        
        // Limites de la carte
        this.x = Math.max(50, Math.min(canvas.width - 50, this.x));
        this.y = Math.max(50, Math.min(canvas.height - 50, this.y));
        
        // Calculer l'angle vers la souris/manette
        if (input.mouseX !== undefined && input.mouseY !== undefined) {
            this.targetAngle = Math.atan2(input.mouseY - this.y, input.mouseX - this.x);
        }
        
        // Gestion de l'attaque automatique
        this.attackCooldown -= deltaTime * 1000;
        if (this.attackCooldown <= 0) {
            this.attack();
        }
    }
    
    attack() {
        this.isAttacking = true;
        this.attackFrame = Date.now();
        this.attackCooldown = this.currentAttackSpeed;
        
        // Trouver l'ennemi le plus proche dans la direction
        const nearestEnemy = game.findNearestEnemy(this);
        if (nearestEnemy) {
            const angleToEnemy = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
            this.targetAngle = angleToEnemy;
            
            // Infliger des dégâts
            let damageDealt = this.calculateDamage();
            nearestEnemy.takeDamage(damageDealt, this);
        }
        
        setTimeout(() => {
            this.isAttacking = false;
        }, 200);
    }
    
    calculateDamage() {
        let damage = this.baseDamage + this.damage;
        
        // Critique
        const isCrit = Math.random() * 100 < this.critChance;
        if (isCrit) {
            damage *= this.critMultiplier;
        }
        
        // Dégâts magiques
        damage += this.magicDamage;
        
        return Math.floor(damage);
    }
    
    takeDamage(amount) {
        // Appliquer la résistance
        const actualDamage = amount * (1 - this.resistance / 100);
        this.hp -= Math.floor(actualDamage);
        
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
        }
    }
    
    heal(amount) {
        this.hp = Math.min(this.maxHP, this.hp + amount);
    }
    
    addStat(stat, value) {
        switch(stat) {
            case 'pv':
                this.maxHP += value;
                this.hp += value;
                break;
            case 'damage':
                this.damage += value;
                break;
            case 'as':
                this.attackSpeed += value;
                this.currentAttackSpeed = this.baseAttackSpeed * (1 - (50 + this.attackSpeed) / 100);
                break;
            case 'magic':
                this.magicDamage += value;
                break;
            case 'resistance':
                this.resistance = Math.min(100, this.resistance + value);
                break;
            case 'crit':
                this.critChance = Math.min(100, this.critChance + value);
                break;
        }
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Rotation vers la cible
        ctx.rotate(this.targetAngle + Math.PI / 2);
        
        // Dessiner le sprite selon l'état d'attaque
        let sprite;
        if (this.isAttacking) {
            // Alterner entre attack1 et attack2 selon la direction
            const angle = this.targetAngle;
            if (angle >= -Math.PI / 2 && angle <= Math.PI / 2) {
                sprite = SPRITES.CHARACTER_ATTACK_1;
            } else {
                sprite = SPRITES.CHARACTER_ATTACK_2;
            }
        } else {
            sprite = SPRITES.CHARACTER_IDLE;
        }
        
        const img = new Image();
        img.src = sprite;
        ctx.drawImage(img, -40, -40, 80, 80);
        
        ctx.restore();
        
        // Barre de HP au-dessus du joueur
        this.drawHealthBar(ctx);
    }
    
    drawHealthBar(ctx) {
        const barWidth = 60;
        const barHeight = 8;
        const x = this.x - barWidth / 2;
        const y = this.y - 60;
        
        // Background
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // HP actuel
        const hpPercent = this.hp / this.maxHP;
        ctx.fillStyle = hpPercent > 0.5 ? '#2ecc71' : hpPercent > 0.25 ? '#f39c12' : '#e74c3c';
        ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
        
        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = 3;
        this.maxHP = 3;
        this.damage = GAME_CONFIG.SLIME_DAMAGE;
        this.speed = 80;
        this.radius = GAME_CONFIG.SLIME_HITBOX_RADIUS;
        this.alive = true;
        this.hitboxRadius = GAME_CONFIG.SLIME_HITBOX_RADIUS;
    }
    
    update(deltaTime, players) {
        if (!this.alive) return;
        
        // Trouver le joueur le plus proche
        let nearestPlayer = null;
        let nearestDist = Infinity;
        
        players.forEach(player => {
            if (!player.alive) return;
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestPlayer = player;
            }
        });
        
        if (nearestPlayer) {
            // Se déplacer vers le joueur
            const angle = Math.atan2(nearestPlayer.y - this.y, nearestPlayer.x - this.x);
            this.x += Math.cos(angle) * this.speed * deltaTime;
            this.y += Math.sin(angle) * this.speed * deltaTime;
            
            // Éviter le stacking avec les autres ennemis
            this.separateFromEnemies();
            
            // Attaquer le joueur si proche
            if (nearestDist < 40) {
                nearestPlayer.takeDamage(this.damage);
            }
        }
    }
    
    separateFromEnemies() {
        game.enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            const dist = Math.hypot(other.x - this.x, other.y - this.y);
            const minDist = this.hitboxRadius + other.hitboxRadius;
            
            if (dist < minDist && dist > 0) {
                const pushAngle = Math.atan2(this.y - other.y, this.x - other.x);
                const pushForce = (minDist - dist) * 0.5;
                this.x += Math.cos(pushAngle) * pushForce;
                this.y += Math.sin(pushAngle) * pushForce;
            }
        });
    }
    
    takeDamage(amount, attacker) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.alive = false;
            if (attacker) {
                attacker.kills++;
            }
        }
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const img = new Image();
        img.src = SPRITES.SLIME;
        ctx.drawImage(img, -30, -30, 60, 60);
        
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.players = [];
        this.enemies = [];
        this.currentWave = 1;
        this.waveTimer = GAME_CONFIG.WAVE_DURATION;
        this.gameState = 'characterSelect'; // characterSelect, playing, waveMenu, end
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.lastTime = 0;
        this.playerInputs = {};
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.setupInputs();
        this.initCharacterSelect();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    setupInputs() {
        // Initialiser les inputs pour chaque joueur
        for (let i = 0; i < GAME_CONFIG.MAX_PLAYERS; i++) {
            this.playerInputs[i] = {
                up: false,
                down: false,
                left: false,
                right: false,
                mouseX: undefined,
                mouseY: undefined
            };
        }
        
        // Keyboard (Joueur 1)
        const keys = {};
        document.addEventListener('keydown', (e) => {
            keys[e.key] = true;
            this.updatePlayerInput(0, keys);
        });
        
        document.addEventListener('keyup', (e) => {
            keys[e.key] = false;
            this.updatePlayerInput(0, keys);
        });
        
        // Mouse (Joueur 1)
        document.addEventListener('mousemove', (e) => {
            this.playerInputs[0].mouseX = e.clientX;
            this.playerInputs[0].mouseY = e.clientY;
        });
        
        // Gamepad support
        window.addEventListener('gamepadconnected', (e) => {
            console.log(`Gamepad connecté: ${e.gamepad.id}`);
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log(`Gamepad déconnecté: ${e.gamepad.id}`);
        });
    }
    
    updatePlayerInput(playerId, keys) {
        this.playerInputs[playerId].up = keys['w'] || keys['W'] || keys['ArrowUp'];
        this.playerInputs[playerId].down = keys['s'] || keys['S'] || keys['ArrowDown'];
        this.playerInputs[playerId].left = keys['a'] || keys['A'] || keys['ArrowLeft'];
        this.playerInputs[playerId].right = keys['d'] || keys['D'] || keys['ArrowRight'];
    }
    
    updateGamepadInputs() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        
        gamepads.forEach((gamepad, index) => {
            if (!gamepad) return;
            
            const input = this.playerInputs[index];
            if (!input) return;
            
            // Axes (stick gauche)
            input.left = gamepad.axes[0] < -0.5;
            input.right = gamepad.axes[0] > 0.5;
            input.up = gamepad.axes[1] < -0.5;
            input.down = gamepad.axes[1] > 0.5;
            
            // Boutons
            if (gamepad.buttons[0].pressed) { // A button
                // Action
            }
            
            // LB/RB pour changer d'onglet dans le menu
            if (this.gameState === 'waveMenu') {
                if (gamepad.buttons[4].pressed) { // LB
                    this.switchTab(-1);
                }
                if (gamepad.buttons[5].pressed) { // RB
                    this.switchTab(1);
                }
            }
        });
    }
    
    initCharacterSelect() {
        const container = document.querySelector('.player-slots');
        container.innerHTML = '';
        
        for (let i = 0; i < GAME_CONFIG.MAX_PLAYERS; i++) {
            const slot = document.createElement('div');
            slot.className = 'player-slot';
            slot.dataset.playerId = i;
            
            const img = document.createElement('img');
            img.src = SPRITES.CHARACTER_IDLE;
            slot.appendChild(img);
            
            slot.addEventListener('click', () => {
                document.querySelectorAll('.player-slot').forEach(s => s.classList.remove('selected'));
                slot.classList.add('selected');
            });
            
            if (i === 0) slot.classList.add('selected');
            container.appendChild(slot);
        }
        
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });
    }
    
    startGame() {
        // Créer les joueurs (1 à 4 joueurs)
        const selectedSlots = document.querySelectorAll('.player-slot.selected');
        const playerCount = Math.max(1, selectedSlots.length);
        
        this.players = [];
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const offset = 100;
        
        const positions = [
            { x: centerX - offset, y: centerY - offset },
            { x: centerX + offset, y: centerY - offset },
            { x: centerX - offset, y: centerY + offset },
            { x: centerX + offset, y: centerY + offset }
        ];
        
        for (let i = 0; i < playerCount; i++) {
            this.players.push(new Player(i, positions[i].x, positions[i].y));
        }
        
        this.currentWave = 1;
        this.waveTimer = GAME_CONFIG.WAVE_DURATION;
        this.gameState = 'playing';
        
        document.getElementById('characterSelectScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        this.createHUD();
        this.spawnWave();
        this.lastTime = Date.now();
        this.gameLoop();
    }
    
    createHUD() {
        const container = document.getElementById('playerHUDs');
        container.innerHTML = '';
        
        this.players.forEach((player, index) => {
            const hud = document.createElement('div');
            hud.className = 'player-hud';
            hud.id = `playerHUD${index}`;
            
            hud.innerHTML = `
                <div class="player-hud-name">JOUEUR ${index + 1}</div>
                <div class="player-hud-stats">
                    <div class="player-hud-stat">
                        <img src="${SPRITES.STATS.PV}" alt="HP">
                        <span>${player.hp}/${player.maxHP}</span>
                    </div>
                    <div class="player-hud-stat">
                        <img src="${SPRITES.STATS.DAMAGE}" alt="DMG">
                        <span>${player.damage}</span>
                    </div>
                    <div class="player-hud-stat">
                        <img src="${SPRITES.STATS.AS}" alt="AS">
                        <span>${player.attackSpeed}%</span>
                    </div>
                </div>
                <div class="hp-bar-container">
                    <div class="hp-bar" style="width: ${(player.hp / player.maxHP) * 100}%"></div>
                </div>
            `;
            
            container.appendChild(hud);
        });
    }
    
    updateHUD() {
        this.players.forEach((player, index) => {
            const hud = document.getElementById(`playerHUD${index}`);
            if (!hud) return;
            
            hud.querySelector('.player-hud-stat:nth-child(1) span').textContent = `${player.hp}/${player.maxHP}`;
            hud.querySelector('.player-hud-stat:nth-child(2) span').textContent = player.damage;
            hud.querySelector('.player-hud-stat:nth-child(3) span').textContent = `${player.attackSpeed}%`;
            hud.querySelector('.hp-bar').style.width = `${(player.hp / player.maxHP) * 100}%`;
        });
        
        document.getElementById('waveTimer').textContent = 
            `WAVE: ${this.currentWave}/${GAME_CONFIG.TOTAL_WAVES} | TIME: ${Math.ceil(this.waveTimer)}s`;
    }
    
    spawnWave() {
        this.enemies = [];
        const enemyCount = GAME_CONFIG.SLIME_SPAWN_COUNT_BASE + (this.currentWave * 5);
        
        for (let i = 0; i < enemyCount; i++) {
            // Spawn aléatoire sur les bords de la map
            let x, y;
            const side = Math.floor(Math.random() * 4);
            
            switch(side) {
                case 0: // Haut
                    x = Math.random() * this.canvas.width;
                    y = -50;
                    break;
                case 1: // Droite
                    x = this.canvas.width + 50;
                    y = Math.random() * this.canvas.height;
                    break;
                case 2: // Bas
                    x = Math.random() * this.canvas.width;
                    y = this.canvas.height + 50;
                    break;
                case 3: // Gauche
                    x = -50;
                    y = Math.random() * this.canvas.height;
                    break;
            }
            
            this.enemies.push(new Enemy(x, y));
        }
    }
    
    findNearestEnemy(player) {
        let nearest = null;
        let nearestDist = Infinity;
        
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        });
        
        return nearest;
    }
    
    checkWinCondition() {
        // Vérifier si tous les joueurs sont morts
        const allDead = this.players.every(p => !p.alive);
        if (allDead) {
            this.endGame(false);
            return true;
        }
        
        // Vérifier si la vague est terminée
        if (this.waveTimer <= 0) {
            this.enemies = this.enemies.filter(e => e.alive);
            if (this.enemies.length === 0) {
                if (this.currentWave >= GAME_CONFIG.TOTAL_WAVES) {
                    this.endGame(true);
                    return true;
                } else {
                    this.showWaveMenu();
                    return true;
                }
            }
        }
        
        return false;
    }
    
    showWaveMenu() {
        this.gameState = 'waveMenu';
        
        document.getElementById('gameScreen').classList.remove('active');
        document.getElementById('waveMenuScreen').classList.add('active');
        
        document.getElementById('waveMenuWaveNum').textContent = this.currentWave;
        
        // Setup des tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                document.getElementById(`${e.target.dataset.tab}Tab`).classList.add('active');
            });
        });
        
        // Setup des upgrades
        document.querySelectorAll('.upgrade-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const stat = e.currentTarget.dataset.stat;
                const values = {
                    pv: 2,
                    damage: 1,
                    as: 5,
                    magic: 1,
                    resistance: 2,
                    crit: 1
                };
                
                this.players.forEach(player => {
                    player.addStat(stat, values[stat]);
                });
                
                // Fermer le menu après sélection
                this.nextWave();
            });
        });
        
        document.getElementById('nextWaveBtn').addEventListener('click', () => {
            this.nextWave();
        });
        
        // Mettre à jour l'affichage des stats
        this.updateCharacterStatsDisplay();
    }
    
    updateCharacterStatsDisplay() {
        if (this.players.length > 0) {
            const player = this.players[0];
            document.getElementById('playerHPDisplay').textContent = player.maxHP;
            document.getElementById('playerDmgDisplay').textContent = player.damage;
            document.getElementById('playerASDisplay').textContent = `${player.attackSpeed}%`;
            document.getElementById('playerCritDisplay').textContent = `${player.critChance}%`;
            document.getElementById('playerResDisplay').textContent = `${player.resistance}%`;
        }
    }
    
    switchTab(direction) {
        const tabs = ['stats', 'character'];
        const currentTab = document.querySelector('.tab-btn.active').dataset.tab;
        const currentIndex = tabs.indexOf(currentTab);
        const newIndex = (currentIndex + direction + tabs.length) % tabs.length;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        document.querySelector(`.tab-btn[data-tab="${tabs[newIndex]}"]`).classList.add('active');
        document.getElementById(`${tabs[newIndex]}Tab`).classList.add('active');
    }
    
    nextWave() {
        document.getElementById('waveMenuScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        this.currentWave++;
        this.waveTimer = GAME_CONFIG.WAVE_DURATION;
        this.gameState = 'playing';
        
        // Respawn les joueurs au centre
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const offset = 100;
        
        const positions = [
            { x: centerX - offset, y: centerY - offset },
            { x: centerX + offset, y: centerY - offset },
            { x: centerX - offset, y: centerY + offset },
            { x: centerX + offset, y: centerY + offset }
        ];
        
        this.players.forEach((player, i) => {
            player.x = positions[i]?.x || centerX;
            player.y = positions[i]?.y || centerY;
            player.alive = true;
            player.hp = player.maxHP;
        });
        
        this.spawnWave();
        this.createHUD();
    }
    
    endGame(victory) {
        this.gameState = 'end';
        
        document.getElementById('gameScreen').classList.remove('active');
        document.getElementById('endScreen').classList.add('active');
        
        const title = document.getElementById('endTitle');
        title.textContent = victory ? 'VICTORY!' : 'GAME OVER';
        title.style.color = victory ? '#2ecc71' : '#e74c3c';
        
        const statsDiv = document.getElementById('endStats');
        statsDiv.innerHTML = this.players.map((p, i) => 
            `<p>JOUEUR ${i + 1}: ${p.kills} KILLS</p>`
        ).join('');
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            location.reload();
        });
    }
    
    gameLoop() {
        if (this.gameState !== 'playing') return;
        
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Update gamepad inputs
        this.updateGamepadInputs();
        
        // Clear canvas
        this.ctx.fillStyle = '#808080';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update timer
        this.waveTimer -= deltaTime;
        if (this.waveTimer < 0) this.waveTimer = 0;
        
        // Update players
        this.players.forEach(player => {
            player.update(deltaTime, this.playerInputs[player.id] || {});
        });
        
        // Update enemies
        this.enemies.forEach(enemy => {
            enemy.update(deltaTime, this.players);
        });
        
        // Nettoyer les ennemis morts
        this.enemies = this.enemies.filter(e => e.alive);
        
        // Draw everything
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.players.forEach(player => player.draw(this.ctx));
        
        // Update HUD
        this.updateHUD();
        
        // Check win/lose condition
        if (!this.checkWinCondition()) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

// ============================================
// INITIALISATION DU JEU
// ============================================

let game;
let canvas;

window.addEventListener('load', () => {
    canvas = document.getElementById('gameCanvas');
    game = new Game();
});
