// ============================================
// PORMANOV'S ADVENTURE - Jeu Type Brotato
// ============================================

// Configuration du canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Redimensionnement du canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================
// GESTION DES SPRITES
// ============================================
const sprites = {
    pormanov: new Image(),
    shuriken: new Image(),
    map: new Image(),
    menuEntreVagues: new Image(),
    champSelect: new Image(),
    healthBars: []
};

// Chargement des sprites
sprites.pormanov.src = 'sprites/pormanov.png';
sprites.shuriken.src = 'sprites/Shuriken.png';
sprites.map.src = 'sprites/map.png';
sprites.menuEntreVagues.src = 'sprites/menuentrelesvagues.png';
sprites.champSelect.src = 'sprites/Champselect.png';

// Chargement des barres de vie (1-31)
for (let i = 1; i <= 31; i++) {
    const img = new Image();
    img.src = `sprites/${i}.png`;
    sprites.healthBars[i] = img;
}

// Compteur de sprites chargés
let spritesLoaded = 0;
const totalSprites = Object.keys(sprites).length + sprites.healthBars.length;

// ============================================
// ÉTAT DU JEU
// ============================================
const GameState = {
    MENU: 'menu',
    CHARACTER_SELECT: 'character_select',
    CONTROLS: 'controls',
    PLAYING: 'playing',
    PAUSED: 'paused',
    WAVE_COMPLETE: 'wave_complete',
    GAME_OVER: 'game_over'
};

let currentState = GameState.MENU;
let selectedCharacter = 'pormanov';

// ============================================
// JOUEURS
// ============================================
class Player {
    constructor(x, y, playerId, controls) {
        this.x = x;
        this.y = y;
        this.playerId = playerId;
        this.controls = controls;
        this.width = 40;
        this.height = 40;
        this.speed = 5;
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.alive = true;
        this.wave = 1;
        this.kills = 0;
        this.shootCooldown = 0;
        this.shootDelay = 15; // frames entre chaque tir
        this.dashCooldown = 0;
        this.dashDelay = 60;
        this.isDashing = false;
        this.dashDuration = 10;
        this.dashTimer = 0;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.angle = 0;
    }

    update(input, enemies) {
        if (!this.alive) return;

        // Gestion du dash
        if (this.isDashing) {
            this.dashTimer--;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        } else {
            // Déplacement normal
            let dx = 0;
            let dy = 0;

            if (input[this.controls.up]) dy -= 1;
            if (input[this.controls.down]) dy += 1;
            if (input[this.controls.left]) dx -= 1;
            if (input[this.controls.right]) dx += 1;

            // Normalisation pour mouvement diagonal
            if (dx !== 0 || dy !== 0) {
                const length = Math.sqrt(dx * dx + dy * dy);
                dx /= length;
                dy /= length;
            }

            this.x += dx * this.speed;
            this.y += dy * this.speed;

            // Limites de l'écran
            this.x = Math.max(this.width/2, Math.min(canvas.width - this.width/2, this.x));
            this.y = Math.max(this.height/2, Math.min(canvas.height - this.height/2, this.y));

            // Visée avec le stick droit ou la souris
            if (input.aimX !== undefined || input.aimY !== undefined) {
                this.angle = Math.atan2(input.aimY, input.aimX);
            }
        }

        // Tir
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
        if (input.shoot && this.shootCooldown <= 0 && !this.isDashing) {
            this.shoot();
            this.shootCooldown = this.shootDelay;
        }

        // Dash
        if (this.dashCooldown > 0) {
            this.dashCooldown--;
        }
        if (input.dash && this.dashCooldown <= 0 && !this.isDashing) {
            this.startDash();
        }

        // Invincibilité après dégâts
        if (this.invincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }
    }

    shoot() {
        // Créer un shuriken dans la direction visée
        const velocity = {
            x: Math.cos(this.angle) * 12,
            y: Math.sin(this.angle) * 12
        };
        projectiles.push(new Projectile(
            this.x + Math.cos(this.angle) * 30,
            this.y + Math.sin(this.angle) * 30,
            velocity,
            this.playerId
        ));
    }

    startDash() {
        this.isDashing = true;
        this.dashTimer = this.dashDuration;
        this.dashCooldown = this.dashDelay;
        this.invincible = true;
        this.invincibleTimer = this.dashDuration;
    }

    takeDamage(amount) {
        if (this.invincible || !this.alive) return;
        
        this.health -= amount;
        this.invincible = true;
        this.invincibleTimer = 30; // 0.5 seconde d'invincibilité

        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }

        updateHealthDisplay(this.playerId);
    }

    draw() {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Effet de dash
        if (this.isDashing) {
            ctx.globalAlpha = 0.7;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ffff';
        }

        // Effet d'invincibilité
        if (this.invincible && Math.floor(Date.now() / 50) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Rotation du personnage vers la direction
        ctx.rotate(this.angle);

        // Dessiner le sprite de Pormanov
        if (sprites.pormanov.complete) {
            ctx.drawImage(
                sprites.pormanov,
                -this.width/2,
                -this.height/2,
                this.width,
                this.height
            );
        } else {
            // Sprite de remplacement si non chargé
            ctx.fillStyle = this.playerId === 1 ? '#4488ff' : '#ff4444';
            ctx.beginPath();
            ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    getHealthSpriteIndex() {
        // Mapper la vie (0-100) à l'index de sprite (1-31)
        const ratio = this.health / this.maxHealth;
        const index = Math.ceil(ratio * 31);
        return Math.max(1, Math.min(31, index));
    }
}

// ============================================
// PROJECTILES (SHURIKENS)
// ============================================
class Projectile {
    constructor(x, y, velocity, ownerId) {
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.ownerId = ownerId;
        this.width = 20;
        this.height = 20;
        this.damage = 25;
        this.active = true;
        this.rotation = 0;
        this.rotationSpeed = 0.3;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.rotation += this.rotationSpeed;

        // Désactiver si hors écran
        if (this.x < 0 || this.x > canvas.width || 
            this.y < 0 || this.y > canvas.height) {
            this.active = false;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (sprites.shuriken.complete) {
            ctx.drawImage(
                sprites.shuriken,
                -this.width/2,
                -this.height/2,
                this.width,
                this.height
            );
        } else {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI / 2) * i;
                ctx.lineTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
            }
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}

// ============================================
// ENNEMIS (Trash Mobs)
// ============================================
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 35;
        this.height = 35;
        this.speed = 2 + Math.random() * 1.5;
        this.health = 30 + (currentWave * 10);
        this.maxHealth = this.health;
        this.damage = 10;
        this.active = true;
        this.angle = 0;
    }

    update(players) {
        // Trouver le joueur le plus proche
        let closestPlayer = null;
        let closestDist = Infinity;

        players.forEach(player => {
            if (!player.alive) return;
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestPlayer = player;
            }
        });

        if (closestPlayer) {
            // Se déplacer vers le joueur
            const dx = closestPlayer.x - this.x;
            const dy = closestPlayer.y - this.y;
            this.angle = Math.atan2(dy, dx);
            
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;

            // Collision avec le joueur
            if (closestDist < (this.width + closestPlayer.width) / 2) {
                closestPlayer.takeDamage(this.damage);
                this.active = false; // L'ennemi se sacrifie
            }
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.active = false;
            // Ajouter un kill au joueur qui a tiré
            players.forEach(p => {
                if (p.playerId === lastShooterId) {
                    p.kills++;
                }
            });
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Différentes couleurs selon le type
        const colors = ['#ff4444', '#ff8844', '#ff4488', '#88ff44'];
        ctx.fillStyle = colors[this.type % colors.length];
        
        // Forme d'ennemi
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, -10);
        ctx.closePath();
        ctx.fill();

        // Yeux
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-5, -5, 4, 0, Math.PI * 2);
        ctx.arc(-5, 5, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ============================================
// VARIABLES GLOBALES DU JEU
// ============================================
let players = [];
let projectiles = [];
let enemies = [];
let currentWave = 1;
let enemiesPerWave = 10;
let enemiesRemaining = 0;
let waveTimer = 0;
let gameStartTime = 0;
let totalKills = 0;
let lastShooterId = 1;

// Inputs
const keys = {};
const gamepads = [null, null];
const aimInput = { aimX: 0, aimY: 0 };

// Contrôles par défaut
const defaultControlsP1 = {
    up: 'KeyW',
    down: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    shoot: 'Space',
    dash: 'ShiftLeft'
};

const defaultControlsP2 = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    shoot: 'Enter',
    dash: 'ShiftRight'
};

// ============================================
// GESTION DES ENTRÉES
// ============================================
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    // Navigation dans les menus
    if (currentState === GameState.MENU) {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
            navigateMenu(-1);
        }
        if (e.code === 'KeyS' || e.code === 'ArrowDown') {
            navigateMenu(1);
        }
        if (e.code === 'Enter' || e.code === 'KeyA') {
            activateMenuButton();
        }
    }
    
    if (e.code === 'KeyP' || e.code === 'Escape') {
        togglePause();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Support manette
window.addEventListener('gamepadconnected', (e) => {
    console.log('Manette connectée:', e.gamepad.index);
    gamepads[e.gamepad.index] = e.gamepad;
});

window.addEventListener('gamepaddisconnected', (e) => {
    console.log('Manette déconnectée:', e.gamepad.index);
    gamepads[e.gamepad.index] = null;
});

function getInput(playerId) {
    const input = {
        up: false,
        down: false,
        left: false,
        right: false,
        shoot: false,
        dash: false,
        aimX: 0,
        aimY: 0
    };

    // Clavier
    const controls = playerId === 1 ? defaultControlsP1 : defaultControlsP2;
    input.up = keys[controls.up];
    input.down = keys[controls.down];
    input.left = keys[controls.left];
    input.right = keys[controls.right];
    input.shoot = keys[controls.shoot];
    input.dash = keys[controls.dash];

    // Manette
    const gamepad = gamepads[playerId - 1];
    if (gamepad) {
        const deadzone = 0.2;
        const leftStickX = gamepad.axes[0];
        const leftStickY = gamepad.axes[1];
        const rightStickX = gamepad.axes[2];
        const rightStickY = gamepad.axes[3];

        if (Math.abs(leftStickX) > deadzone) {
            input.right = leftStickX > 0;
            input.left = leftStickX < 0;
        }
        if (Math.abs(leftStickY) > deadzone) {
            input.down = leftStickY > 0;
            input.up = leftStickY < 0;
        }

        input.shoot = gamepad.buttons[0].pressed || gamepad.buttons[2].pressed; // A ou X
        input.dash = gamepad.buttons[1].pressed; // B

        // Visée avec stick droit
        if (Math.abs(rightStickX) > deadzone || Math.abs(rightStickY) > deadzone) {
            input.aimX = rightStickX;
            input.aimY = rightStickY;
        }
    }

    // Si pas de visée à la manette, utiliser la souris pour le joueur 1
    if (playerId === 1 && input.aimX === 0 && input.aimY === 0) {
        // La visée sera mise à jour par le mouvement de la souris
    }

    return input;
}

// Suivi de la souris pour la visée
canvas.addEventListener('mousemove', (e) => {
    if (players.length > 0 && players[0].alive) {
        const dx = e.clientX - players[0].x;
        const dy = e.clientY - players[0].y;
        players[0].angle = Math.atan2(dy, dx);
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (currentState === GameState.PLAYING && players.length > 0) {
        // Clic gauche pour tirer
        if (e.button === 0) {
            keys['Space'] = true;
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        keys['Space'] = false;
    }
});

// ============================================
// NAVIGATION DANS LES MENUS
// ============================================
let menuIndex = 0;
const menuButtons = ['btn-start-game', 'btn-character-select', 'btn-controls', 'btn-quit'];

function navigateMenu(direction) {
    const buttons = document.querySelectorAll('.menu-btn');
    buttons.forEach((btn, index) => {
        btn.style.borderColor = 'rgba(100, 150, 255, 0.5)';
    });
    
    menuIndex = (menuIndex + direction + buttons.length) % buttons.length;
    buttons[menuIndex].style.borderColor = 'rgba(100, 150, 255, 1)';
}

function activateMenuButton() {
    const buttons = document.querySelectorAll('.menu-btn');
    if (buttons[menuIndex]) {
        buttons[menuIndex].click();
    }
}

// ============================================
// GESTION DES ÉCRANS
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.menu-screen').forEach(screen => {
        screen.classList.add('hidden');
        screen.classList.remove('active');
    });
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
        screen.classList.add('active');
    }
}

function hideAllScreens() {
    document.querySelectorAll('.menu-screen').forEach(screen => {
        screen.classList.add('hidden');
        screen.classList.remove('active');
    });
}

// ============================================
// INITIALISATION DU JEU
// ============================================
function initGame(numPlayers = 1) {
    players = [];
    projectiles = [];
    enemies = [];
    currentWave = 1;
    waveTimer = 0;
    totalKills = 0;
    gameStartTime = Date.now();

    // Position de départ des joueurs
    const startPos = [
        { x: canvas.width / 2 - 50, y: canvas.height / 2 },
        { x: canvas.width / 2 + 50, y: canvas.height / 2 }
    ];

    const controls = [defaultControlsP1, defaultControlsP2];

    for (let i = 0; i < numPlayers; i++) {
        players.push(new Player(
            startPos[i].x,
            startPos[i].y,
            i + 1,
            controls[i]
        ));
    }

    startWave();
}

function startWave() {
    enemiesPerWave = 10 + (currentWave * 5);
    enemiesRemaining = enemiesPerWave;
    waveTimer = 0;

    // Faire apparaître les ennemis autour de la carte
    spawnEnemies(enemiesPerWave);

    updateHUD();
}

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        // Position aléatoire sur les bords
        let x, y;
        const side = Math.floor(Math.random() * 4);
        
        switch(side) {
            case 0: // Haut
                x = Math.random() * canvas.width;
                y = -50;
                break;
            case 1: // Bas
                x = Math.random() * canvas.width;
                y = canvas.height + 50;
                break;
            case 2: // Gauche
                x = -50;
                y = Math.random() * canvas.height;
                break;
            case 3: // Droite
                x = canvas.width + 50;
                y = Math.random() * canvas.height;
                break;
        }

        const type = Math.floor(Math.random() * 4);
        enemies.push(new Enemy(x, y, type));
    }
}

// ============================================
// BOUCLE DE JEU PRINCIPALE
// ============================================
function gameLoop() {
    if (currentState === GameState.PLAYING) {
        update();
        draw();
    } else if (currentState === GameState.MENU || 
               currentState === GameState.CHARACTER_SELECT ||
               currentState === GameState.CONTROLS) {
        // Animation de fond du menu
        drawMenuBackground();
    }

    // Polling des manettes
    pollGamepads();

    requestAnimationFrame(gameLoop);
}

function pollGamepads() {
    navigator.getGamepads().forEach((gamepad, index) => {
        if (gamepad) {
            gamepads[index] = gamepad;
        }
    });
}

function update() {
    // Mise à jour des joueurs
    players.forEach(player => {
        const input = getInput(player.playerId);
        player.update(input, enemies);
    });

    // Vérifier si tous les joueurs sont morts
    if (players.every(p => !p.alive)) {
        gameOver();
        return;
    }

    // Mise à jour des projectiles
    projectiles.forEach(proj => proj.update());
    projectiles = projectiles.filter(p => p.active);

    // Mise à jour des ennemis
    enemies.forEach(enemy => enemy.update(players));
    enemies = enemies.filter(e => e.active);

    // Collisions projectile-ennemi
    projectiles.forEach(proj => {
        enemies.forEach(enemy => {
            const dist = Math.hypot(proj.x - enemy.x, proj.y - enemy.y);
            if (dist < (proj.width + enemy.width) / 2) {
                enemy.takeDamage(proj.damage);
                proj.active = false;
                lastShooterId = proj.ownerId;
            }
        });
    });

    // Compter les ennemis restants
    enemiesRemaining = enemies.length;
    updateHUD();

    // Vérifier si la vague est terminée
    if (enemiesRemaining === 0 && currentState === GameState.PLAYING) {
        waveComplete();
    }

    // Timer de la vague
    waveTimer = Math.floor((Date.now() - gameStartTime) / 1000);
}

function draw() {
    // Fond
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessiner la grille de fond
    drawGrid();

    // Dessiner les projectiles
    projectiles.forEach(proj => proj.draw());

    // Dessiner les ennemis
    enemies.forEach(enemy => enemy.draw());

    // Dessiner les joueurs
    players.forEach(player => player.draw());
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 50;

    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawMenuBackground() {
    // Animation simple pour le fond du menu
    const time = Date.now() / 1000;
    const gradient = ctx.createRadialGradient(
        canvas.width / 2 + Math.sin(time) * 100,
        canvas.height / 2 + Math.cos(time) * 100,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width
    );
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ============================================
// GESTION DU HUD
// ============================================
function updateHUD() {
    document.getElementById('current-wave').textContent = currentWave;
    document.getElementById('enemies-count').textContent = enemiesRemaining;

    const minutes = Math.floor(waveTimer / 60);
    const seconds = waveTimer % 60;
    document.getElementById('wave-timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateHealthDisplay(playerId) {
    const player = players.find(p => p.playerId === playerId);
    if (!player) return;

    const healthImgId = playerId === 1 ? 'p1-health-img' : 'p2-health-img';
    const healthElement = document.getElementById(healthImgId);
    
    const spriteIndex = player.getHealthSpriteIndex();
    if (sprites.healthBars[spriteIndex]) {
        healthElement.src = sprites.healthBars[spriteIndex].src;
    }

    // Mettre à jour le compteur de vague pour ce joueur
    const waveElement = document.getElementById(`p${playerId}-wave`);
    if (waveElement) {
        waveElement.textContent = player.wave;
    }
}

// ============================================
// ÉTATS DU JEU
// ============================================
function waveComplete() {
    currentState = GameState.WAVE_COMPLETE;
    currentWave++;
    
    document.getElementById('completed-wave').textContent = currentWave - 1;
    showScreen('wave-complete-screen');

    // Compte à rebours avant la prochaine vague
    let countdown = 5;
    const timerElement = document.getElementById('next-wave-timer');
    
    const countdownInterval = setInterval(() => {
        countdown--;
        timerElement.textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            hideAllScreens();
            currentState = GameState.PLAYING;
            startWave();
        }
    }, 1000);
}

function gameOver() {
    currentState = GameState.GAME_OVER;
    
    const minutes = Math.floor(waveTimer / 60);
    const seconds = waveTimer % 60;
    const totalTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    document.getElementById('final-waves').textContent = currentWave - 1;
    document.getElementById('final-kills').textContent = totalKills;
    document.getElementById('final-time').textContent = totalTime;

    showScreen('game-over-screen');
    document.getElementById('hud').classList.add('hidden');
}

function togglePause() {
    if (currentState === GameState.PLAYING) {
        currentState = GameState.PAUSED;
        showScreen('pause-screen');
    } else if (currentState === GameState.PAUSED) {
        currentState = GameState.PLAYING;
        hideAllScreens();
    }
}

// ============================================
// ÉVÉNEMENTS DES BOUTONS DE MENU
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Bouton Nouvelle Partie
    document.getElementById('btn-start-game').addEventListener('click', () => {
        hideAllScreens();
        canvas.style.display = 'block';
        document.getElementById('hud').classList.remove('hidden');
        initGame(1); // Commencer avec 1 joueur par défaut
        currentState = GameState.PLAYING;
        gameLoop();
    });

    // Bouton Sélection Personnage
    document.getElementById('btn-character-select').addEventListener('click', () => {
        showScreen('character-select');
        currentState = GameState.CHARACTER_SELECT;
    });

    // Bouton Contrôles
    document.getElementById('btn-controls').addEventListener('click', () => {
        showScreen('controls-screen');
        currentState = GameState.CONTROLS;
    });

    // Bouton Quitter (du menu)
    document.getElementById('btn-quit').addEventListener('click', () => {
        // Dans un navigateur, on ne peut pas vraiment "quitter"
        // On affiche juste un message
        alert('Merci d\'avoir joué à Pormanov\'s Adventure! \nPour quitter, fermez simplement l\'onglet.');
    });

    // Retour depuis la sélection de personnage
    document.addEventListener('keydown', (e) => {
        if ((currentState === GameState.CHARACTER_SELECT || 
             currentState === GameState.CONTROLS) && 
            (e.code === 'KeyB' || e.code === 'Escape')) {
            showScreen('main-menu');
            currentState = GameState.MENU;
        }
    });

    // Bouton Reprendre (pause)
    document.getElementById('btn-resume').addEventListener('click', () => {
        togglePause();
    });

    // Bouton Quitter la partie
    document.getElementById('btn-quit-match').addEventListener('click', () => {
        location.reload(); // Recharger la page pour revenir au menu
    });

    // Bouton Rejouer
    document.getElementById('btn-restart').addEventListener('click', () => {
        hideAllScreens();
        canvas.style.display = 'block';
        document.getElementById('hud').classList.remove('hidden');
        initGame(players.length);
        currentState = GameState.PLAYING;
    });

    // Bouton Menu Principal (game over)
    document.getElementById('btn-main-menu').addEventListener('click', () => {
        location.reload();
    });

    // Initialiser l'affichage des barres de vie
    updateHealthDisplay(1);
    updateHealthDisplay(2);

    // Démarrer la boucle de rendu pour le menu
    gameLoop();
});

// ============================================
// SUPPORT MULTIJOUEUR LOCAL
// ============================================
function addPlayer2() {
    if (players.length < 2) {
        const startPos = { x: canvas.width / 2 + 50, y: canvas.height / 2 };
        players.push(new Player(
            startPos.x,
            startPos.y,
            2,
            defaultControlsP2
        ));
        document.getElementById('player2-health').classList.remove('hidden');
        updateHealthDisplay(2);
    }
}

// Détecter automatiquement une deuxième manette et ajouter le joueur 2
setInterval(() => {
    if (currentState === GameState.PLAYING && 
        players.length === 1 && 
        gamepads[1] !== null) {
        addPlayer2();
    }
}, 2000);

// Raccourci pour ajouter le joueur 2 avec la touche Start de la manette 2
window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && currentState === GameState.PLAYING && players.length < 2) {
        addPlayer2();
    }
});

console.log('🎮 Pormanov\'s Adventure - Prêt à jouer!');
console.log('Utilisez ZQSD ou la manette pour vous déplacer');
console.log('Souris ou stick droit pour viser, Clic ou Bouton A pour tirer');
