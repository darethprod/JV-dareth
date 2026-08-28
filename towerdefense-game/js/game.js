// Configuration du jeu
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// État du jeu
let gameState = {
    isPlaying: false,
    money: 150,
    playerHP: 100,
    maxPlayerHP: 100,
    wave: 1,
    enemiesKilled: 0,
    selectedTower: null
};

// Assets
const assets = {
    map: new Image(),
    slime: new Image(),
    proletaire: new Image(),
    billet: new Image(),
    menuUnite: new Image()
};

assets.map.src = 'assets/map/map.png';
assets.slime.src = 'assets/enemies/slime.png';
assets.proletaire.src = 'assets/towers/proletaire/tour.png';
assets.billet.src = 'assets/hud/billet.png';
assets.menuUnite.src = 'assets/hud/menudesunité.png';

// Dimensions du canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Chemin des ennemis (points de passage)
const enemyPath = [
    { x: 0, y: canvas.height * 0.3 },
    { x: canvas.width * 0.2, y: canvas.height * 0.3 },
    { x: canvas.width * 0.2, y: canvas.height * 0.6 },
    { x: canvas.width * 0.5, y: canvas.height * 0.6 },
    { x: canvas.width * 0.5, y: canvas.height * 0.4 },
    { x: canvas.width * 0.8, y: canvas.height * 0.4 },
    { x: canvas.width * 0.8, y: canvas.height * 0.7 },
    { x: canvas.width, y: canvas.height * 0.7 }
];

// Classe Tour
class Tower {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.range = 150;
        this.damage = 2;
        this.attackSpeed = 1000; // ms entre les attaques
        this.lastAttack = 0;
        this.target = null;
        this.angle = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Dessiner la tour
        const imgSize = 50;
        ctx.drawImage(assets.proletaire, -imgSize/2, -imgSize/2, imgSize, imgSize);
        
        ctx.restore();
        
        // Cercle de portée (seulement si survolé)
        if (this === hoveredTower) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    update(enemies, currentTime) {
        // Trouver la cible la plus proche
        let closestEnemy = null;
        let closestDist = Infinity;

        for (const enemy of enemies) {
            const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (dist <= this.range && dist < closestDist) {
                closestDist = dist;
                closestEnemy = enemy;
            }
        }

        this.target = closestEnemy;

        if (this.target) {
            // Calculer l'angle vers la cible
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

            // Attaquer
            if (currentTime - this.lastAttack >= this.attackSpeed) {
                this.attack();
                this.lastAttack = currentTime;
            }
        }
    }

    attack() {
        if (this.target) {
            this.target.hp -= this.damage;
            // Animation de projectile pourrait être ajoutée ici
        }
    }
}

// Classe Ennemi (Slime)
class Enemy {
    constructor() {
        this.pathIndex = 0;
        this.x = enemyPath[0].x;
        this.y = enemyPath[0].y;
        this.speed = 1.5;
        this.hp = 5;
        this.maxHp = 5;
        this.damage = 1;
        this.size = 40;
        this.reachedEnd = false;
    }

    update() {
        if (this.reachedEnd) return;

        const target = enemyPath[this.pathIndex + 1];
        if (!target) {
            this.reachedEnd = true;
            gameState.playerHP -= this.damage;
            updateLifeBar();
            return;
        }

        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < this.speed) {
            this.x = target.x;
            this.y = target.y;
            this.pathIndex++;
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }

    draw() {
        // Dessiner le slime
        ctx.drawImage(assets.slime, this.x - this.size/2, this.y - this.size/2, this.size, this.size);

        // Barre de vie au-dessus de la tête
        const barWidth = 30;
        const barHeight = 5;
        const hpPercent = this.hp / this.maxHp;

        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barWidth/2, this.y - this.size/2 - 10, barWidth, barHeight);
        
        ctx.fillStyle = hpPercent > 0.5 ? '#00FF00' : hpPercent > 0.25 ? '#FFFF00' : '#FF0000';
        ctx.fillRect(this.x - barWidth/2, this.y - this.size/2 - 10, barWidth * hpPercent, barHeight);
    }
}

// Variables de jeu
const towers = [];
const enemies = [];
let hoveredTower = null;
let enemySpawnTimer = 0;
let enemiesToSpawn = 5;
let waveInProgress = false;

// Gestion de la souris
let mouseX = 0;
let mouseY = 0;
let canPlaceTower = false;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    // Vérifier si on survole une tour
    hoveredTower = null;
    for (const tower of towers) {
        const dist = Math.hypot(mouseX - tower.x, mouseY - tower.y);
        if (dist < 30) {
            hoveredTower = tower;
            break;
        }
    }
});

canvas.addEventListener('click', (e) => {
    if (gameState.selectedTower && canPlaceTower) {
        placeTower(mouseX, mouseY);
    }
});

// Sélection de tour depuis le menu
document.getElementById('tower-slot').addEventListener('click', function() {
    if (gameState.selectedTower === 'proletaire') {
        gameState.selectedTower = null;
        this.classList.remove('selected');
    } else {
        gameState.selectedTower = 'proletaire';
        document.querySelectorAll('.tower-slot').forEach(slot => slot.classList.remove('selected'));
        this.classList.add('selected');
    }
});

function placeTower(x, y) {
    // Vérifier si on peut placer ici (pas sur le chemin, pas sur une autre tour)
    if (!isValidPlacement(x, y)) {
        canPlaceTower = false;
        return;
    }

    const cost = 50;
    if (gameState.money >= cost) {
        gameState.money -= cost;
        towers.push(new Tower(x, y));
        updateMoneyDisplay();
        gameState.selectedTower = null;
        document.getElementById('tower-slot').classList.remove('selected');
        canPlaceTower = false;
    }
}

function isValidPlacement(x, y) {
    // Vérifier la distance avec les autres tours
    for (const tower of towers) {
        const dist = Math.hypot(x - tower.x, y - tower.y);
        if (dist < 60) return false;
    }

    // Vérifier si sur le chemin (simplifié)
    // Dans un vrai jeu, il faudrait vérifier plus précisément
    return true;
}

// Mise à jour des affichages HUD
function updateMoneyDisplay() {
    document.getElementById('money-amount').textContent = gameState.money;
}

function updateLifeBar() {
    document.getElementById('player-hp').textContent = Math.max(0, gameState.playerHP);
    
    if (gameState.playerHP <= 0) {
        gameOver();
    }
}

// Démarrage du jeu
document.getElementById('btn-jouer').addEventListener('click', () => {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    gameState.isPlaying = true;
    gameState.money = 150;
    gameState.playerHP = 100;
    updateMoneyDisplay();
    startWave();
    gameLoop();
});

function startWave() {
    waveInProgress = true;
    enemiesToSpawn = 5 + gameState.wave * 2;
    enemySpawnTimer = 0;
}

function gameOver() {
    gameState.isPlaying = false;
    alert('Game Over! Vague atteinte: ' + gameState.wave);
    location.reload();
}

// Boucle de jeu principale
function gameLoop(currentTime = 0) {
    if (!gameState.isPlaying) return;

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner la map en plein écran
    ctx.drawImage(assets.map, 0, 0, canvas.width, canvas.height);

    // Mettre à jour et dessiner les tours
    for (const tower of towers) {
        tower.update(enemies, currentTime);
        tower.draw();
    }

    // Spawner les ennemis
    if (waveInProgress && enemiesToSpawn > 0) {
        enemySpawnTimer++;
        if (enemySpawnTimer > 60) { // Spawn toutes les 60 frames (~1 seconde)
            enemies.push(new Enemy());
            enemiesToSpawn--;
            enemySpawnTimer = 0;
        }
    } else if (waveInProgress && enemiesToSpawn === 0 && enemies.length === 0) {
        // Vague terminée
        waveInProgress = false;
        gameState.wave++;
        gameState.money += 50; // Bonus de fin de vague
        updateMoneyDisplay();
        setTimeout(startWave, 2000); // Nouvelle vague après 2 secondes
    }

    // Mettre à jour et dessiner les ennemis
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        enemy.draw();

        // Supprimer les ennemis morts
        if (enemy.hp <= 0) {
            gameState.money += 10; // Reward pour avoir tué un ennemi
            updateMoneyDisplay();
            enemies.splice(i, 1);
            gameState.enemiesKilled++;
        }

        // Supprimer les ennemis qui ont atteint la fin
        if (enemy.reachedEnd) {
            enemies.splice(i, 1);
        }
    }

    // Dessiner la zone de placement si une tour est sélectionnée
    if (gameState.selectedTower) {
        canPlaceTower = isValidPlacement(mouseX, mouseY);
        
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 150, 0, Math.PI * 2);
        ctx.strokeStyle = canPlaceTower ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.drawImage(assets.proletaire, mouseX - 25, mouseY - 25, 50, 50);
    }

    requestAnimationFrame(gameLoop);
}
