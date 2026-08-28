// Configuration du jeu
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Waypoints du chemin (extraits de la map)
const waypoints = [
    {x: 110, y: 264},
    {x: 111, y: 144},
    {x: 174, y: 260},
    {x: 195, y: 542},
    {x: 251, y: 496},
    {x: 268, y: 490},
    {x: 576, y: 440},
    {x: 632, y: 695},
    {x: 1099, y: 450},
    {x: 1150, y: 206},
    {x: 1439, y: 206}  // Fin du chemin
];

// Dimensions de la map originale
const MAP_WIDTH = 1440;
const MAP_HEIGHT = 720;

// État du jeu
let gameState = {
    money: 100,
    coreHealth: 100,
    currentWave: 0,
    isPlaying: false,
    isGameOver: false,
    selectedUnit: null
};

// Images
const images = {};
function loadImages() {
    return new Promise((resolve) => {
        const imageSources = {
            map: 'assets/map.png',
            slime: 'assets/slime.png',
            proletaire: 'assets/prolétaire.png',
            projectile: 'assets/projectile.png',
            billet: 'assets/billet.png'
        };
        
        let loadedCount = 0;
        const totalImages = Object.keys(imageSources).length;
        
        for (const [key, src] of Object.entries(imageSources)) {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                loadedCount++;
                if (loadedCount === totalImages) {
                    resolve();
                }
            };
            images[key] = img;
        }
    });
}

// Adapter le canvas à l'espace disponible (75% de la largeur de l'écran)
function resizeCanvas() {
    const containerWidth = window.innerWidth * 0.75;
    const containerHeight = window.innerHeight;
    
    // Calculer le ratio pour garder les proportions de la map
    const scaleX = containerWidth / MAP_WIDTH;
    const scaleY = containerHeight / MAP_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    canvas.width = MAP_WIDTH * scale;
    canvas.height = MAP_HEIGHT * scale;
    
    return scale;
}

let currentScale = 1;

// Classes du jeu
class Enemy {
    constructor(wave) {
        this.waypointIndex = 0;
        this.x = waypoints[0].x;
        this.y = waypoints[0].y;
        this.speed = 1.5 + (wave * 0.1);
        this.maxHealth = 5;
        this.health = this.maxHealth;
        this.damage = 1;
        this.size = 30;
        this.reachedEnd = false;
    }
    
    update() {
        if (this.waypointIndex >= waypoints.length - 1) {
            this.reachedEnd = true;
            return;
        }
        
        const target = waypoints[this.waypointIndex + 1];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.speed) {
            this.x = target.x;
            this.y = target.y;
            this.waypointIndex++;
        } else {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }
    
    draw(ctx, scale) {
        const screenX = this.x * scale;
        const screenY = this.y * scale;
        const screenSize = this.size * scale;
        
        // Dessiner le slime
        ctx.drawImage(images.slime, screenX - screenSize/2, screenY - screenSize/2, screenSize, screenSize);
        
        // Barre de vie au-dessus de la tête
        const barWidth = screenSize;
        const barHeight = 5 * scale;
        const barY = screenY - screenSize/2 - 10;
        
        // Fond de la barre
        ctx.fillStyle = '#333';
        ctx.fillRect(screenX - barWidth/2, barY, barWidth, barHeight);
        
        // Vie actuelle
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillRect(screenX - barWidth/2, barY, barWidth * healthPercent, barHeight);
    }
    
    takeDamage(amount) {
        this.health -= amount;
        return this.health <= 0;
    }
}

class Tower {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.range = 150;
        this.damage = 10;
        this.attackSpeed = 1; // attaques par seconde
        this.lastAttackTime = 0;
        this.angle = 0;
        this.target = null;
        this.projectiles = [];
    }
    
    update(enemies, currentTime) {
        // Trouver la cible la plus proche
        this.target = null;
        let minDistance = Infinity;
        
        for (const enemy of enemies) {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= this.range && distance < minDistance) {
                minDistance = distance;
                this.target = enemy;
            }
        }
        
        // Mettre à jour l'angle vers la cible
        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            this.angle = Math.atan2(dy, dx);
            
            // Attaquer si le cooldown est écoulé
            if (currentTime - this.lastAttackTime >= 1000 / this.attackSpeed) {
                this.shoot();
                this.lastAttackTime = currentTime;
            }
        }
        
        // Mettre à jour les projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update();
            
            if (proj.hit) {
                this.projectiles.splice(i, 1);
            }
        }
    }
    
    shoot() {
        if (this.target) {
            this.projectiles.push(new Projectile(this.x, this.y, this.target, this.damage));
        }
    }
    
    draw(ctx, scale) {
        const screenX = this.x * scale;
        const screenY = this.y * scale;
        const size = 40 * scale;
        
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.angle);
        
        // Dessiner la tour
        ctx.drawImage(images.proletaire, -size/2, -size/2, size, size);
        
        ctx.restore();
        
        // Dessiner les projectiles
        for (const proj of this.projectiles) {
            proj.draw(ctx, scale);
        }
    }
    
    drawRange(ctx, scale) {
        const screenX = this.x * scale;
        const screenY = this.y * scale;
        const screenRange = this.range * scale;
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRange, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Projectile {
    constructor(x, y, target, damage) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = 8;
        this.size = 10;
        this.hit = false;
    }
    
    update() {
        if (!this.target || this.target.health <= 0) {
            this.hit = true;
            return;
        }
        
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.speed) {
            // Toucher la cible
            const killed = this.target.takeDamage(this.damage);
            if (killed) {
                gameState.money += 5; // Reward pour avoir tué un ennemi
                updateMoneyDisplay();
            }
            this.hit = true;
        } else {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }
    
    draw(ctx, scale) {
        const screenX = this.x * scale;
        const screenY = this.y * scale;
        const screenSize = this.size * scale;
        
        ctx.drawImage(images.projectile, screenX - screenSize/2, screenY - screenSize/2, screenSize, screenSize);
    }
}

// Variables globales
let towers = [];
let enemies = [];
let waveInProgress = false;
let enemiesToSpawn = 0;
let spawnTimer = 0;
let spawnInterval = 60; // frames entre chaque spawn

// Gestion des vagues
function startWave() {
    if (waveInProgress) return;
    
    gameState.currentWave++;
    waveInProgress = true;
    enemiesToSpawn = 5 + Math.floor(gameState.currentWave * 1.5);
    spawnTimer = 0;
    
    console.log(`Vague ${gameState.currentWave} commencée - ${enemiesToSpawn} ennemis`);
}

function updateWave() {
    if (!waveInProgress) return;
    
    if (enemiesToSpawn > 0) {
        spawnTimer++;
        if (spawnTimer >= spawnInterval) {
            enemies.push(new Enemy(gameState.currentWave));
            enemiesToSpawn--;
            spawnTimer = 0;
        }
    } else if (enemies.length === 0) {
        waveInProgress = false;
        console.log(`Vague ${gameState.currentWave} terminée!`);
        
        // Prochaine vague automatique après un délai
        setTimeout(() => {
            if (!gameState.isGameOver && gameState.coreHealth > 0) {
                startWave();
            }
        }, 2000);
    }
}

// Vérifier si une position est sur l'eau
function isOnWater(x, y) {
    // Coordonnées approximatives des zones d'eau basées sur l'analyse de la map
    // Zone d'eau principale: x > 269, y > 233
    if (x > 269 && y > 233) {
        // Vérifier plus précisément
        if (y < 709 && x < 1428) {
            return true;
        }
    }
    return false;
}

// Vérifier si une position est sur le chemin
function isOnPath(x, y) {
    // Vérifier la distance par rapport aux segments du chemin
    for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        
        // Distance point-segment
        const dist = pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
        if (dist < 30) { // Largeur du chemin
            return true;
        }
    }
    return false;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
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

// Placer une tour
function placeTower(canvasX, canvasY) {
    if (!gameState.selectedUnit) return;
    
    const worldX = canvasX / currentScale;
    const worldY = canvasY / currentScale;
    
    // Vérifier si on peut placer ici
    if (isOnWater(worldX, worldY)) {
        console.log("Cannot build on water!");
        return;
    }
    
    if (isOnPath(worldX, worldY)) {
        console.log("Cannot build on path!");
        return;
    }
    
    // Vérifier si on a assez d'argent
    const unitCost = 50;
    if (gameState.money < unitCost) {
        console.log("Not enough money!");
        return;
    }
    
    // Vérifier s'il y a déjà une tour ici
    for (const tower of towers) {
        const dx = tower.x - worldX;
        const dy = tower.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 40) {
            console.log("Already a tower here!");
            return;
        }
    }
    
    // Placer la tour
    towers.push(new Tower(worldX, worldY));
    gameState.money -= unitCost;
    updateMoneyDisplay();
    
    // Désélectionner l'unité
    gameState.selectedUnit = null;
    document.querySelectorAll('.unit-slot').forEach(slot => slot.classList.remove('selected'));
}

// Mettre à jour l'affichage de la monnaie
function updateMoneyDisplay() {
    document.getElementById('money-amount').textContent = gameState.money;
}

// Mettre à jour la barre de vie du noyau
function updateCoreHealth() {
    const fill = document.getElementById('core-health-fill');
    const text = document.getElementById('core-health-text');
    const percent = (gameState.coreHealth / 100) * 100;
    
    fill.style.width = percent + '%';
    text.textContent = `${gameState.coreHealth} / 100`;
    
    if (gameState.coreHealth <= 0) {
        gameOver();
    }
}

// Game Over
function gameOver() {
    gameState.isGameOver = true;
    gameState.isPlaying = false;
    document.getElementById('final-wave').textContent = `Vague atteinte: ${gameState.currentWave}`;
    document.getElementById('game-over-screen').style.display = 'flex';
}

// Boucle de jeu
let lastTime = 0;
function gameLoop(currentTime) {
    if (!gameState.isPlaying || gameState.isGameOver) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dessiner la map
    ctx.drawImage(images.map, 0, 0, canvas.width, canvas.height);
    
    // Mettre à jour et dessiner les tours
    for (const tower of towers) {
        tower.update(enemies, currentTime);
        tower.draw(ctx, currentScale);
    }
    
    // Mettre à jour la vague
    updateWave();
    
    // Mettre à jour et dessiner les ennemis
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        
        if (enemy.reachedEnd) {
            // Ennemi atteint la fin - infliger des dégâts au noyau
            gameState.coreHealth -= enemy.damage;
            updateCoreHealth();
            enemies.splice(i, 1);
        } else {
            enemy.draw(ctx, currentScale);
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Initialisation
async function init() {
    await loadImages();
    currentScale = resizeCanvas();
    
    // Event listeners
    document.getElementById('play-btn').addEventListener('click', () => {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        gameState.isPlaying = true;
        startWave();
        gameLoop(0);
    });
    
    document.getElementById('restart-btn').addEventListener('click', () => {
        location.reload();
    });
    
    // Sélection d'unité
    document.querySelectorAll('.unit-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            const unitType = slot.dataset.unit;
            
            // Désélectionner toutes les unités
            document.querySelectorAll('.unit-slot').forEach(s => s.classList.remove('selected'));
            
            if (gameState.selectedUnit === unitType) {
                // Désélectionner si déjà sélectionné
                gameState.selectedUnit = null;
                document.getElementById('unit-info-panel').style.display = 'none';
            } else {
                // Sélectionner l'unité
                slot.classList.add('selected');
                gameState.selectedUnit = unitType;
                
                // Afficher les infos
                document.getElementById('unit-info-panel').style.display = 'block';
            }
        });
    });
    
    // Placement de tour au clic sur le canvas
    canvas.addEventListener('click', (e) => {
        if (gameState.selectedUnit) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            placeTower(canvasX, canvasY);
        }
    });
    
    // Gérer le redimensionnement
    window.addEventListener('resize', () => {
        currentScale = resizeCanvas();
    });
}

// Démarrer le jeu
init();
