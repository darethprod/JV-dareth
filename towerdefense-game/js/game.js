// Configuration du jeu
const GameConfig = {
    CANVAS_WIDTH: window.innerWidth,
    CANVAS_HEIGHT: window.innerHeight,
    PLAYER_MAX_HEALTH: 100,
    STARTING_MONEY: 100,
    PATH_COLOR: '#654321',
    WATER_COLOR: '#4169E1',
    GRASS_COLOR: '#228B22',
    TILE_SIZE: 40
};

// Définition des unités
const Units = {
    proletaire: {
        name: 'Prolétaire',
        cost: 50,
        damage: 10,
        range: 150,
        attackSpeed: 1000, // ms entre les attaques
        hp: 100,
        description: 'Unité de base du jeu. Attaque les ennemis à distance.',
        passive: 'Aucun passif',
        image: 'assets/prolétaire.png',
        attackImages: [
            'assets/attack_animation/1.png',
            'assets/attack_animation/2.png',
            'assets/attack_animation/3.png'
        ],
        projectileImages: [
            'assets/attack_animation/projectile1.png',
            'assets/attack_animation/projectile2.png',
            'assets/attack_animation/projectile3.png'
        ]
    }
};

// Définition des ennemis
const Enemies = {
    slime: {
        name: 'Slime',
        hp: 5,
        damage: 1,
        speed: 1,
        reward: 10,
        image: 'assets/slime.png'
    }
};

// Gestionnaire de jeu principal
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        this.gameState = 'menu'; // menu, playing, gameover
        this.playerHealth = GameConfig.PLAYER_MAX_HEALTH;
        this.money = GameConfig.STARTING_MONEY;
        this.wave = 1;
        this.maxWaves = 20;
        
        this.path = [];
        this.waterZones = [];
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        
        this.selectedUnitType = null;
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        
        this.lastTime = 0;
        this.enemySpawnTimer = 0;
        this.enemiesToSpawn = 0;
        
        this.init();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        GameConfig.CANVAS_WIDTH = window.innerWidth;
        GameConfig.CANVAS_HEIGHT = window.innerHeight;
    }
    
    init() {
        // Écouteurs d'événements
        window.addEventListener('resize', () => this.resizeCanvas());
        
        document.getElementById('btn-play').addEventListener('click', () => this.startGame());
        
        // Gestion du menu des unités
        document.querySelectorAll('.unit-slot').forEach(slot => {
            slot.addEventListener('click', (e) => this.onUnitSlotClick(e));
        });
        
        // Gestion du canvas pour le placement des tours
        this.canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onCanvasMouseUp(e));
        
        // Panneau d'information
        document.getElementById('close-unit-info').addEventListener('click', () => {
            document.getElementById('unit-info-panel').classList.add('hidden');
        });
        
        // Générer le chemin et les zones d'eau
        this.generatePath();
        this.generateWaterZones();
        
        // Lancer la boucle de jeu
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    generatePath() {
        // Chemin simple en forme de S pour commencer
        const margin = 100;
        const step = 50;
        
        this.path = [
            { x: margin, y: margin },
            { x: GameConfig.CANVAS_WIDTH - margin, y: margin },
            { x: GameConfig.CANVAS_WIDTH - margin, y: GameConfig.CANVAS_HEIGHT / 2 },
            { x: margin, y: GameConfig.CANVAS_HEIGHT / 2 },
            { x: margin, y: GameConfig.CANVAS_HEIGHT - margin },
            { x: GameConfig.CANVAS_WIDTH - margin, y: GameConfig.CANVAS_HEIGHT - margin }
        ];
    }
    
    generateWaterZones() {
        // Quelques zones d'eau décoratives
        this.waterZones = [
            { x: 200, y: 200, width: 100, height: 80 },
            { x: 600, y: 400, width: 150, height: 100 },
            { x: 300, y: 600, width: 120, height: 90 }
        ];
    }
    
    startGame() {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        this.gameState = 'playing';
        this.startWave();
    }
    
    startWave() {
        this.enemiesToSpawn = this.wave * 3; // Nombre d'ennemis augmente avec la vague
        this.enemySpawnTimer = 0;
        console.log(`Vague ${this.wave} commencée!`);
    }
    
    spawnEnemy() {
        const enemyConfig = Enemies.slime;
        const enemy = {
            ...enemyConfig,
            currentHp: enemyConfig.hp,
            x: this.path[0].x,
            y: this.path[0].y,
            pathIndex: 0,
            spriteLoaded: false
        };
        
        // Charger l'image
        const img = new Image();
        img.src = enemyConfig.image;
        img.onload = () => {
            enemy.spriteLoaded = true;
            enemy.image = img;
        };
        enemy.imgElement = img;
        
        this.enemies.push(enemy);
    }
    
    onUnitSlotClick(e) {
        const unitType = e.currentTarget.dataset.unitType;
        
        // Désélectionner les autres slots
        document.querySelectorAll('.unit-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
        
        // Sélectionner le slot cliqué
        e.currentTarget.classList.add('selected');
        this.selectedUnitType = unitType;
        
        // Afficher les informations de l'unité
        this.showUnitInfo(unitType);
    }
    
    showUnitInfo(unitType) {
        const unit = Units[unitType];
        if (!unit) return;
        
        document.getElementById('unit-info-name').textContent = unit.name;
        document.getElementById('unit-info-description').textContent = unit.description;
        document.getElementById('unit-info-stats').innerHTML = `
            <div>Coût: ${unit.cost}</div>
            <div>Dégâts: ${unit.damage}</div>
            <div>Portée: ${unit.range}</div>
            <div>Vie: ${unit.hp}</div>
            <div>Passif: ${unit.passive}</div>
        `;
        
        document.getElementById('unit-info-panel').classList.remove('hidden');
    }
    
    onCanvasMouseDown(e) {
        if (this.gameState !== 'playing' || !this.selectedUnitType) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.isDragging = true;
        this.dragStartPos = { x, y };
    }
    
    onCanvasMouseMove(e) {
        if (!this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Dessiner un aperçu de la portée pendant le glisser-déposer
        this.drawPlacementPreview(x, y);
    }
    
    onCanvasMouseUp(e) {
        if (!this.isDragging || !this.selectedUnitType) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Vérifier si le placement est valide
        if (this.isValidPlacement(x, y)) {
            this.placeTower(x, y, this.selectedUnitType);
        }
        
        this.isDragging = false;
    }
    
    isValidPlacement(x, y) {
        const unit = Units[this.selectedUnitType];
        if (!unit || this.money < unit.cost) return false;
        
        // Vérifier que ce n'est pas sur le chemin
        for (let i = 0; i < this.path.length - 1; i++) {
            const p1 = this.path[i];
            const p2 = this.path[i + 1];
            const dist = this.pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
            if (dist < 40) return false; // Trop près du chemin
        }
        
        // Vérifier que ce n'est pas sur l'eau
        for (const water of this.waterZones) {
            if (x > water.x && x < water.x + water.width &&
                y > water.y && y < water.y + water.height) {
                return false;
            }
        }
        
        // Vérifier que ce n'est pas sur une autre tour
        for (const tower of this.towers) {
            const dx = x - tower.x;
            const dy = y - tower.y;
            if (Math.sqrt(dx * dx + dy * dy) < 50) return false;
        }
        
        return true;
    }
    
    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    placeTower(x, y, unitType) {
        const unit = Units[unitType];
        if (this.money < unit.cost) return;
        
        this.money -= unit.cost;
        this.updateMoneyDisplay();
        
        const tower = {
            ...unit,
            x,
            y,
            target: null,
            lastAttackTime: 0,
            attackFrame: 0
        };
        
        // Charger les images
        const img = new Image();
        img.src = unit.image;
        img.onload = () => {
            tower.spriteLoaded = true;
            tower.image = img;
        };
        tower.imgElement = img;
        
        this.towers.push(tower);
        this.selectedUnitType = null;
        document.querySelectorAll('.unit-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
    }
    
    drawPlacementPreview(x, y) {
        const unit = Units[this.selectedUnitType];
        if (!unit) return;
        
        this.ctx.save();
        this.ctx.globalAlpha = 0.5;
        
        // Dessiner la portée
        this.ctx.beginPath();
        this.ctx.arc(x, y, unit.range, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Dessiner l'emplacement de la tour
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(139, 69, 19, 0.7)';
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        // Spawn des ennemis
        if (this.enemiesToSpawn > 0) {
            this.enemySpawnTimer += deltaTime;
            if (this.enemySpawnTimer >= 1500) { // 1.5 secondes entre chaque ennemi
                this.spawnEnemy();
                this.enemiesToSpawn--;
                this.enemySpawnTimer = 0;
            }
        } else if (this.enemies.length === 0 && this.wave < this.maxWaves) {
            // Vague suivante
            setTimeout(() => {
                this.wave++;
                this.startWave();
            }, 2000);
        } else if (this.enemies.length === 0 && this.wave >= this.maxWaves) {
            // Victoire
            console.log('Victoire! Toutes les vagues terminées!');
        }
        
        // Mettre à jour les ennemis
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            this.updateEnemy(enemy, deltaTime);
            
            // Supprimer les ennemis morts
            if (enemy.currentHp <= 0) {
                this.money += enemy.reward;
                this.updateMoneyDisplay();
                this.enemies.splice(i, 1);
            }
        }
        
        // Mettre à jour les tours
        for (const tower of this.towers) {
            this.updateTower(tower, deltaTime);
        }
        
        // Mettre à jour les projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            this.updateProjectile(projectile, deltaTime);
            
            if (projectile.hit || 
                projectile.x < 0 || projectile.x > GameConfig.CANVAS_WIDTH ||
                projectile.y < 0 || projectile.y > GameConfig.CANVAS_HEIGHT) {
                this.projectiles.splice(i, 1);
            }
        }
    }
    
    updateEnemy(enemy, deltaTime) {
        if (enemy.pathIndex >= this.path.length - 1) {
            // Ennemi arrivé au bout
            this.playerHealth -= enemy.damage;
            this.updateHealthDisplay();
            enemy.currentHp = 0; // Supprimer l'ennemi
            
            if (this.playerHealth <= 0) {
                this.gameOver();
            }
            return;
        }
        
        const target = this.path[enemy.pathIndex + 1];
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < enemy.speed) {
            enemy.pathIndex++;
        } else {
            enemy.x += (dx / distance) * enemy.speed;
            enemy.y += (dy / distance) * enemy.speed;
        }
    }
    
    updateTower(tower, deltaTime) {
        // Trouver une cible
        if (!tower.target || tower.target.currentHp <= 0) {
            tower.target = this.findNearestEnemy(tower);
        }
        
        if (tower.target) {
            const dx = tower.target.x - tower.x;
            const dy = tower.target.y - tower.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= tower.range) {
                // Attaquer
                tower.lastAttackTime += deltaTime;
                if (tower.lastAttackTime >= tower.attackSpeed) {
                    this.shootProjectile(tower, tower.target);
                    tower.lastAttackTime = 0;
                }
            } else {
                tower.target = null;
            }
        }
    }
    
    findNearestEnemy(tower) {
        let nearest = null;
        let minDist = Infinity;
        
        for (const enemy of this.enemies) {
            const dx = enemy.x - tower.x;
            const dy = enemy.y - tower.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDist && distance <= tower.range) {
                minDist = distance;
                nearest = enemy;
            }
        }
        
        return nearest;
    }
    
    shootProjectile(tower, target) {
        const projectile = {
            x: tower.x,
            y: tower.y,
            target: target,
            speed: 5,
            damage: tower.damage,
            hit: false
        };
        
        this.projectiles.push(projectile);
    }
    
    updateProjectile(projectile, deltaTime) {
        if (projectile.target.currentHp <= 0) {
            projectile.hit = true;
            return;
        }
        
        const dx = projectile.target.x - projectile.x;
        const dy = projectile.target.y - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < projectile.speed) {
            // Touché!
            projectile.target.currentHp -= projectile.damage;
            projectile.hit = true;
        } else {
            projectile.x += (dx / distance) * projectile.speed;
            projectile.y += (dy / distance) * projectile.speed;
        }
    }
    
    draw() {
        // Effacer le canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dessiner le fond (herbe)
        this.ctx.fillStyle = GameConfig.GRASS_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dessiner les zones d'eau
        for (const water of this.waterZones) {
            this.ctx.fillStyle = GameConfig.WATER_COLOR;
            this.ctx.fillRect(water.x, water.y, water.width, water.height);
        }
        
        // Dessiner le chemin
        this.drawPath();
        
        // Dessiner les tours
        for (const tower of this.towers) {
            this.drawTower(tower);
        }
        
        // Dessiner les ennemis
        for (const enemy of this.enemies) {
            this.drawEnemy(enemy);
        }
        
        // Dessiner les projectiles
        for (const projectile of this.projectiles) {
            this.drawProjectile(projectile);
        }
        
        // Dessiner l'aperçu de placement si en cours
        if (this.isDragging && this.selectedUnitType) {
            // La position sera dessinée dans mousemove
        }
    }
    
    drawPath() {
        this.ctx.beginPath();
        this.ctx.moveTo(this.path[0].x, this.path[0].y);
        
        for (let i = 1; i < this.path.length; i++) {
            this.ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        
        this.ctx.strokeStyle = GameConfig.PATH_COLOR;
        this.ctx.lineWidth = 60;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
        
        // Bordures du chemin
        this.ctx.strokeStyle = '#4a2810';
        this.ctx.lineWidth = 64;
        this.ctx.globalAlpha = 0.3;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }
    
    drawTower(tower) {
        if (tower.spriteLoaded && tower.image) {
            this.ctx.save();
            this.ctx.translate(tower.x, tower.y);
            
            // Rotation vers la cible
            if (tower.target) {
                const angle = Math.atan2(tower.target.y - tower.y, tower.target.x - tower.x);
                this.ctx.rotate(angle);
            }
            
            this.ctx.drawImage(tower.image, -20, -20, 40, 40);
            this.ctx.restore();
        } else {
            // Fallback: dessiner un cercle
            this.ctx.beginPath();
            this.ctx.arc(tower.x, tower.y, 20, 0, Math.PI * 2);
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fill();
            this.ctx.strokeStyle = '#DEB887';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
    }
    
    drawEnemy(enemy) {
        if (enemy.spriteLoaded && enemy.image) {
            this.ctx.drawImage(enemy.image, enemy.x - 15, enemy.y - 15, 30, 30);
        } else {
            // Fallback: dessiner un cercle vert
            this.ctx.beginPath();
            this.ctx.arc(enemy.x, enemy.y, 15, 0, Math.PI * 2);
            this.ctx.fillStyle = '#32CD32';
            this.ctx.fill();
        }
        
        // Barre de vie au-dessus de l'ennemi
        this.drawEnemyHealthBar(enemy);
    }
    
    drawEnemyHealthBar(enemy) {
        const barWidth = 40;
        const barHeight = 5;
        const x = enemy.x - barWidth / 2;
        const y = enemy.y - 25;
        
        // Fond de la barre
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x, y, barWidth, barHeight);
        
        // Vie actuelle
        const healthPercent = enemy.currentHp / enemy.hp;
        this.ctx.fillStyle = healthPercent > 0.5 ? '#32CD32' : healthPercent > 0.25 ? '#FFD700' : '#FF4444';
        this.ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
    }
    
    drawProjectile(projectile) {
        this.ctx.beginPath();
        this.ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fill();
    }
    
    gameLoop(time) {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        
        this.update(deltaTime);
        this.draw();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    updateHealthDisplay() {
        const healthBar = document.getElementById('player-health-bar');
        const healthText = document.getElementById('player-health-text');
        const percent = (this.playerHealth / GameConfig.PLAYER_MAX_HEALTH) * 100;
        
        healthBar.style.width = `${percent}%`;
        healthText.textContent = `${this.playerHealth}/${GameConfig.PLAYER_MAX_HEALTH}`;
    }
    
    updateMoneyDisplay() {
        document.getElementById('money-text').textContent = this.money;
    }
    
    gameOver() {
        this.gameState = 'gameover';
        alert(`Game Over! Vous avez atteint la vague ${this.wave}`);
        location.reload();
    }
}

// Démarrer le jeu quand la page est chargée
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
