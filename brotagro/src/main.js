/* Arena Survivor — local co-op prototype with no external dependencies. */
const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = document.querySelector('#ui');
const W = canvas.width;
const H = canvas.height;
ctx.imageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;

const WORLD = { width: 3200, height: 2200 };
const JEAN_BERNARD = {
  id: 'jean-bernard', name: 'Jean Bernard', title: 'Burst Rifleman', maxHp: 30,
  damage: 30, resistance: 0, burstsPerSecond: 1, crit: 0, moveSpeed: 230, range: 230,
  burstGap: .14, sprite: 'assets/sprites/characters/jean-bernard.png',
};
const PORMANOVE = {
  id: 'pormanove', name: 'Pormanove', title: 'Maw Laser', maxHp: 38,
  damage: 18, resistance: 0, burstsPerSecond: 0, crit: 0, moveSpeed: 205, range: 255,
  laserTick: .20, sprite: 'assets/sprites/characters/pormanove.png',
};
const CHARACTERS = [JEAN_BERNARD, PORMANOVE];
const SLIME = { maxHp: 40, damage: 5, speed: 76, radius: 23, sprite: 'assets/sprites/enemies/slime.png' };
const UPGRADES = [
  { id: 'maxHp', icon: '♥', name: 'Max HP', detail: '+5 maximum health', base: 8 },
  { id: 'damage', icon: '✦', name: 'Damage', detail: '+5 damage per shot', base: 10 },
  { id: 'resistance', icon: '◈', name: 'Resistance', detail: '+1 resistance', base: 9 },
  { id: 'burstsPerSecond', icon: '↯', name: 'Attack Speed', detail: '+0.20 Attack Speed', base: 12 },
  { id: 'crit', icon: '✹', name: 'Crit Chance', detail: '+5% critical chance', base: 10 },
  { id: 'moveSpeed', icon: '➜', name: 'Move Speed', detail: '+15 move speed', base: 8 },
  { id: 'range', icon: '◎', name: 'Range', detail: '+45 auto-attack range', base: 8 },
];
const images = { 'jean-bernard': image(JEAN_BERNARD.sprite), pormanove: image(PORMANOVE.sprite), slime: image(SLIME.sprite) };
const keys = new Set();
const keyHits = new Set();
const mouse = { x: W / 2, y: H / 2, down: false };
const padEdges = new Map();
const session = { players: [] };
let state = 'menu';
let game = null;
let lastTime = performance.now();
let shopActivePlayer = 0;
let characterFocus = 0;
let upgradeDetailIndex = 0;
const UPGRADE_COLUMNS = 4;

function image(src) { const img = new Image(); img.src = src; return img; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function getCharacter(subject) { return CHARACTERS.find(character => character.id === (subject?.characterId || subject?.id)) || JEAN_BERNARD; }
function isLaserCharacter(subject) { return getCharacter(subject).id === PORMANOVE.id; }
function resistanceMultiplier(resistance) { return 100 / (100 + resistance * 10); }
function resistanceReduction(resistance) { return (1 - resistanceMultiplier(resistance)) * 100; }
function damageTaken(rawDamage, resistance) { return Math.max(1, Math.round(rawDamage * resistanceMultiplier(resistance))); }
function laserEvolution(player) {
  const stacks = player?.slimeStacks || 0;
  if (stacks >= 100) return { tier: 'overload', label: 'OVERLOAD · AREA BEAM', pierces: true, beamRadius: 32, beamMultiplier: 1.35, impactRadius: 122, impactMultiplier: 1.6, outerWidth: 92, coreWidth: 34 };
  if (stacks >= 50) return { tier: 'piercing', label: 'PIERCING BEAM', pierces: true, beamRadius: 9, beamMultiplier: 1, impactRadius: 0, impactMultiplier: 0, outerWidth: 30, coreWidth: 11 };
  return { tier: 'standard', label: 'FOCUSED BEAM', pierces: false, beamRadius: 0, beamMultiplier: 1, impactRadius: 0, impactMultiplier: 0, outerWidth: 15, coreWidth: 7 };
}
function pointSegmentDistance(point, fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY;
  const lengthSquared = dx * dx + dy * dy || 1;
  const progress = clamp(((point.x - fromX) * dx + (point.y - fromY) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (fromX + dx * progress), point.y - (fromY + dy * progress));
}
function laserBeamLine(player, target, extendToRange = false) {
  const fromX = player.x, fromY = player.y + 10;
  const angle = Math.atan2(target.y - fromY, target.x - fromX);
  const length = extendToRange ? player.stats.range : Math.hypot(target.x - fromX, target.y - fromY);
  return { fromX, fromY, toX: fromX + Math.cos(angle) * length, toY: fromY + Math.sin(angle) * length };
}
function healthValues(player) {
  const stats = player?.stats || getCharacter(player);
  const current = player?.stats ? clamp(Math.ceil(player.hp), 0, stats.maxHp) : stats.maxHp;
  return { current, max: stats.maxHp, percentage: clamp(current / stats.maxHp * 100, 0, 100) };
}
function esc(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
function pads() { return [...navigator.getGamepads()].filter(Boolean); }
function getPad(index) { return index === null ? null : navigator.getGamepads()[index]; }
function padName(pad) { return esc((pad.id || 'Manette').replace(/\s*\([^)]*\)/, '').slice(0, 42)); }
function button(pad, index) { return Boolean(pad && pad.buttons[index] && pad.buttons[index].pressed); }
function padEdge(pad, control, down) {
  const key = `${pad.index}:${control}`;
  const wasDown = padEdges.get(key) || false;
  padEdges.set(key, down);
  return down && !wasDown;
}
function resetEdges() { padEdges.clear(); keyHits.clear(); }
function takeKey(key) { key = key.toLowerCase(); if (!keyHits.has(key)) return false; keyHits.delete(key); return true; }
function anyPadAction(player) { const pad = getPad(player.padIndex); return pad && (button(pad, 0) || button(pad, 9)); }

window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (!keys.has(key)) keyHits.add(key);
  keys.add(key);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter'].includes(key)) event.preventDefault();
  sound.unlock();
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
canvas.addEventListener('mousemove', event => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) * W / rect.width;
  mouse.y = (event.clientY - rect.top) * H / rect.height;
});
canvas.addEventListener('mousedown', () => { mouse.down = true; sound.unlock(); });
window.addEventListener('mouseup', () => { mouse.down = false; });
window.addEventListener('gamepadconnected', () => { if (state === 'lobby') renderLobby(); });
window.addEventListener('gamepaddisconnected', () => { if (state === 'lobby') renderLobby(); });

const sound = {
  context: null,
  unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') this.context.resume();
  },
  tone(from, to, duration, type = 'square', volume = .04) {
    const audio = this.context;
    if (!audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + duration);
  },
  click() { this.tone(260, 340, .055, 'square', .025); },
  shot(second) { this.tone(second ? 155 : 190, second ? 72 : 88, .095, 'square', .055); },
  reload() { this.tone(390, 590, .09, 'triangle', .028); },
  hit() { this.tone(145, 75, .07, 'sawtooth', .026); },
  kill() { this.tone(170, 310, .12, 'triangle', .035); },
  collect() { this.tone(600, 850, .07, 'sine', .025); },
  hurt() { this.tone(105, 50, .12, 'sawtooth', .055); },
  buy() { this.tone(390, 690, .12, 'triangle', .045); },
};

function showMenu() {
  state = 'menu'; game = null; session.players = []; resetEdges();
  ui.innerHTML = `
  <section class="screen">
      <div class="eyebrow">Local co-op · survivor arena</div>
      <h1 class="logo">ARENA<br><em>SURVIVOR</em></h1>
      <p class="subtitle">Build your survivor, hold the arena, and survive escalating waves together.</p>
      <button id="play-local" class="primary">Play local co-op</button>
      <p class="hint">Controller: A / Start to continue. Audio starts after your first interaction.</p>
    </section>`;
  byId('play-local').onclick = () => { sound.unlock(); sound.click(); showLobby(); };
}

function showLobby() {
  state = 'lobby'; session.players = []; resetEdges(); renderLobby();
}

function renderLobby() {
  const available = pads();
  const slots = Array.from({ length: 4 }, (_, slot) => {
    const pad = available[slot];
    const joined = pad && session.players.some(p => p.padIndex === pad.index);
    if (!pad) return `<div class="controller-slot"><span class="pad-icon">—</span><span><strong>Player slot ${slot + 1}</strong><small>Waiting for a controller</small></span><span>OFFLINE</span></div>`;
    return `<div class="controller-slot ${joined ? 'joined' : 'connected'}"><span class="pad-icon">G</span><span><strong>${padName(pad)}</strong><small>Player slot ${slot + 1}</small></span><span>${joined ? 'JOINED' : 'PRESS A TO JOIN'}</span></div>`;
  }).join('');
  const canContinue = session.players.length > 0;
  ui.innerHTML = `
    <section class="screen">
      <div class="eyebrow">01 · party setup</div><h1 class="logo small">LOCAL CO-OP</h1>
      <p class="subtitle">Press <b>A</b> on each controller to join. Up to four players can enter the arena.</p>
      <div class="lobby-card"><div class="controller-list">${slots}</div><div class="lobby-actions"><button id="keyboard-join" class="ghost">Add keyboard player</button> <button id="to-select" class="primary" ${canContinue ? '' : 'disabled'}>Continue</button></div></div>
      <p class="hint">Controller: A joins, Start/Menu continues, B goes back. Keyboard support is available for solo testing.</p>
      <button id="back-menu" class="ghost">Back</button>
    </section>`;
  byId('keyboard-join').onclick = () => { sound.unlock(); addKeyboard(); };
  byId('to-select').onclick = () => { sound.unlock(); sound.click(); if (session.players.length) showCharacterSelect(); };
  byId('back-menu').onclick = showMenu;
}

function addKeyboard() {
  if (session.players.some(p => p.kind === 'keyboard') || session.players.length >= 4) return;
  session.players.push({ id: 'keyboard', kind: 'keyboard', padIndex: null, label: 'Keyboard', ready: false });
  sound.click(); renderLobby();
}
function joinPad(pad) {
  if (session.players.some(p => p.padIndex === pad.index) || session.players.length >= 4) return;
  session.players.push({ id: `pad-${pad.index}`, kind: 'pad', padIndex: pad.index, label: padName(pad), ready: false });
  sound.click(); renderLobby();
}

function baseBurstsPerSecond(player) {
  const stats = player?.stats || getCharacter(player);
  if (isLaserCharacter(player)) return 0;
  // Critical Chance contributes 20% of its displayed value to the permanent burst rate.
  return stats.burstsPerSecond + stats.crit * .20;
}
function effectiveBurstsPerSecond(player) {
  return baseBurstsPerSecond(player) + (player?.waveBurstBonus || 0);
}
function passiveBurstGain(player) {
  // The temporary gain only uses the non-temporary rate, preventing it from compounding itself.
  return baseBurstsPerSecond(player) * .50;
}
function passiveDescription(player) {
  const stats = player?.stats || getCharacter(player);
  if (isLaserCharacter(player)) {
    const stacks = player?.slimeStacks || 0;
    const nextStack = 10 - stacks % 10 || 10;
    const stackDamage = player?.stackDamageBonus || 0;
    const evolution = laserEvolution(player);
    return `<div class="passive-description">
      <p>Attack Speed bonuses become <b>Damage</b> instead <span class="ratio-badge"><i>↯ → ✦</i> 1 : 10</span></p>
      <p>Slime stacks: <b>${stacks}</b>. Gain <b>+2 Damage</b> every 10 stacks <span class="ratio-badge"><i>✦</i> ${nextStack} to next</span></p>
      <p>Current stack damage: <b>+${stackDamage} Damage</b>.</p>
      <p>Laser evolution: <b>${evolution.label}</b>. <b>50</b> stacks pierce; <b>100</b> stacks create a huge area beam.</p>
    </div>`;
  }
  const critBonus = stats.crit * .20;
  const waveGain = passiveBurstGain(player);
  const waveBonus = player?.waveBurstBonus || 0;
  return `<div class="passive-description">
    <p>Gain <b>+${critBonus.toFixed(2)} Attack Speed</b> from Critical Chance <span class="ratio-badge"><i>✹</i> 20%</span></p>
    <p>Every 3 seconds, gain <b>+${waveGain.toFixed(2)} temporary Attack Speed</b> <span class="ratio-badge"><i>↯</i> 50%</span></p>
    <p>Current wave bonus: <b>+${waveBonus.toFixed(2)} Attack Speed</b>. It resets when the wave ends.</p>
    <p>Reload time scales with current Attack Speed <span class="ratio-badge"><i>↯</i> 100%</span></p>
  </div>`;
}
function reloadDelay(player, attackSpeed = effectiveBurstsPerSecond(player)) {
  if (isLaserCharacter(player)) return 0;
  return Math.max(.10, 1 / Math.max(.01, attackSpeed) - JEAN_BERNARD.burstGap);
}
function characterStats(player) {
  const s = player && player.stats ? player.stats : getCharacter(player);
  const laser = isLaserCharacter(player);
  const health = healthValues(player);
  const attackSpeed = effectiveBurstsPerSecond(player);
  return `<div class="stat-list">
    <div class="stat-row"><span>Health</span><b>${health.current} / ${health.max}</b><small>current / maximum</small></div>
    <div class="stat-row"><span>${laser ? 'Laser Damage' : 'Damage'}</span><b>${s.damage}</b><small>${laser ? 'damage per second' : 'damage per bullet'}</small></div>
    <div class="stat-row"><span>Resistance</span><b>${s.resistance}</b><small>${resistanceReduction(s.resistance).toFixed(1)}% damage reduction</small></div>
    <div class="stat-row"><span>Attack Speed</span><b>${laser ? 'CONVERTED' : formatSpeed(attackSpeed)}</b><small>${laser ? 'becomes laser damage' : `${reloadDelay(player, attackSpeed).toFixed(2)} sec reload delay`}</small></div>
    <div class="stat-row"><span>Crit Chance</span><b>${s.crit}%</b><small>critical hits deal 2× damage</small></div>
    <div class="stat-row"><span>Move Speed</span><b>${s.moveSpeed}</b><small>units per second</small></div>
    <div class="stat-row"><span>Range</span><b>${s.range}</b><small>auto-attack distance</small></div>
  </div>`;
}
function upgradeDetailHtml(player, upgrade) {
  const stats = player.stats;
  const health = healthValues(player);
  const nextResistance = stats.resistance + 1;
  const laser = isLaserCharacter(player);
  let value = '';
  let rows = '';
  if (upgrade.id === 'maxHp') {
    value = `${health.max} <em>→</em> ${health.max + 5}`;
    rows = `<p><span>Current health</span><b>${health.current} / ${health.max}</b></p><p><span>Maximum health</span><b>+5 HP</b></p><p><span>Next wave</span><b>${health.max + 5} / ${health.max + 5}</b></p>`;
  } else if (upgrade.id === 'damage') {
    value = `${stats.damage} <em>→</em> ${stats.damage + 5}`;
    rows = `<p><span>${laser ? 'Laser damage / sec' : 'Damage per bullet'}</span><b>${stats.damage + 5}</b></p><p><span>Critical ${laser ? 'damage / sec' : 'bullet damage'}</span><b>${(stats.damage + 5) * 2}</b></p>`;
  } else if (upgrade.id === 'resistance') {
    value = `${resistanceReduction(stats.resistance).toFixed(1)}% <em>→</em> ${resistanceReduction(nextResistance).toFixed(1)}%`;
    rows = `<p><span>Resistance</span><b>${stats.resistance} → ${nextResistance}</b></p><p><span>100 raw damage received</span><b>${damageTaken(100, stats.resistance)} → ${damageTaken(100, nextResistance)}</b></p><p><span>Damage reduction</span><b>${resistanceReduction(nextResistance).toFixed(1)}%</b></p>`;
  } else if (upgrade.id === 'burstsPerSecond') {
    if (laser) {
      value = `${stats.damage} <em>→</em> ${stats.damage + 2}`;
      rows = `<p><span>Attack Speed bonus</span><b>converted</b></p><p><span>Laser damage / sec</span><b>${stats.damage} → ${stats.damage + 2}</b></p><p><span>Critical laser / sec</span><b>${stats.damage * 2} → ${(stats.damage + 2) * 2}</b></p>`;
    } else {
      const speed = effectiveBurstsPerSecond(player);
      const nextSpeed = speed + .20;
      value = `${formatSpeed(speed)} <em>→</em> ${formatSpeed(nextSpeed)}`;
      rows = `<p><span>Attack Speed</span><b>+0.20</b></p><p><span>Reload delay</span><b>${reloadDelay(player, speed).toFixed(2)}s → ${reloadDelay(player, nextSpeed).toFixed(2)}s</b></p><p><span>Two-shot salvo</span><b>fires faster</b></p>`;
    }
  } else if (upgrade.id === 'crit') {
    value = `${stats.crit}% <em>→</em> ${stats.crit + 5}%`;
    const jeanRatio = laser ? '' : `<p><span>Attack Speed from passive</span><b>+${(stats.crit * .20).toFixed(2)} → +${((stats.crit + 5) * .20).toFixed(2)}</b></p>`;
    rows = `<p><span>Critical chance</span><b>+5%</b></p><p><span>Critical damage</span><b>2× damage</b></p>${jeanRatio}`;
  } else if (upgrade.id === 'moveSpeed') {
    value = `${stats.moveSpeed} <em>→</em> ${stats.moveSpeed + 15}`;
    rows = `<p><span>Move Speed</span><b>+15 units / sec</b></p><p><span>New movement speed</span><b>${stats.moveSpeed + 15} units / sec</b></p>`;
  } else if (upgrade.id === 'range') {
    value = `${stats.range} <em>→</em> ${stats.range + 45}`;
    rows = `<p><span>Auto-attack range</span><b>+45 distance</b></p><p><span>New range</span><b>${stats.range + 45}</b></p><p><span>Arena marker</span><b>dotted circle expands</b></p>`;
  }
  return `<div class="upgrade-detail"><p class="detail-kicker">${upgrade.icon} STAT DETAILS</p><h2>${upgrade.name}</h2><div class="detail-value">${value}</div><div class="detail-rows">${rows}</div><p class="detail-hint">Hover a card or use the D-pad to inspect its exact effect.</p></div>`;
}
function updateUpgradeDetail(player, index) {
  upgradeDetailIndex = clamp(index, 0, UPGRADES.length - 1);
  const target = byId('upgrade-detail-panel');
  if (target) target.innerHTML = upgradeDetailHtml(player, UPGRADES[upgradeDetailIndex]);
  document.querySelectorAll('[data-upgrade]').forEach((element, cardIndex) => element.classList.toggle('inspected', cardIndex === upgradeDetailIndex));
}
function showCharacterSelect() {
  state = 'select'; resetEdges(); characterFocus = 0;
  for (const player of session.players) { player.ready = false; player.characterId ||= JEAN_BERNARD.id; }
  ui.innerHTML = `
    <section class="screen">
      <div class="eyebrow">02 · character select</div><h1 class="logo small">CHOOSE YOUR SURVIVOR</h1>
      <div class="character-grid" id="character-options"></div>
      <div class="selection-side select-party"><h2>Party ready check</h2><div id="ready-list"></div><p class="hint">Each player selects their survivor with left/right, presses A to ready up, and can press B to return.</p></div>
      <button id="select-back" class="ghost">Back to lobby</button>
    </section>`;
  byId('select-back').onclick = showLobby;
  renderCharacterOptions();
  renderReadyList();
}
function renderCharacterOptions() {
  const host = byId('character-options'); if (!host) return;
  const focusedPlayer = session.players[characterFocus];
  host.innerHTML = CHARACTERS.map(character => {
    const chosenBy = session.players.map((player, index) => player.characterId === character.id ? `P${index + 1}` : '').filter(Boolean).join(' · ');
    const selected = focusedPlayer?.characterId === character.id;
    return `<button class="character-option ${selected ? 'selected' : ''}" data-character="${character.id}"><div class="portrait-frame"><img src="${character.sprite}" alt="${character.name}"></div><h2 class="character-name">${character.name}</h2><p class="tag">${character.title}</p>${characterStats(character)}<div class="weapon-note"><b>Passive</b>${passiveDescription(character)}</div><span class="character-picked">${chosenBy ? `Selected by ${chosenBy}` : 'Available'}</span></button>`;
  }).join('');
  document.querySelectorAll('[data-character]').forEach(buttonElement => buttonElement.onclick = () => {
    const player = session.players[characterFocus]; if (!player || player.ready) return;
    player.characterId = buttonElement.dataset.character; sound.unlock(); sound.click(); renderCharacterOptions(); renderReadyList();
  });
}
function renderReadyList() {
  const host = byId('ready-list'); if (!host) return;
  host.innerHTML = session.players.map((player, index) => { const character = getCharacter(player); return `<article class="player-ready ${player.ready ? 'ready' : ''} ${index === characterFocus ? 'focus' : ''}"><img class="mini-portrait" src="${character.sprite}" alt=""><div><h3>Player ${index + 1} · ${character.name}</h3><p>${player.kind === 'keyboard' ? 'Keyboard' : player.label}</p></div><span class="status">${player.ready ? 'READY ✓' : 'PICKING'}</span></article>`; }).join('');
}

function createPlayer(lobbyPlayer, slot) {
  const character = getCharacter(lobbyPlayer);
  return {
    ...lobbyPlayer, slot, x: WORLD.width / 2 + (slot - (session.players.length - 1) / 2) * 74, y: WORLD.height / 2,
    characterId: character.id, radius: 22, hp: character.maxHp, stats: { ...character }, aim: 0, alive: true, moving: false, walkTime: 0,
    salvo: 'ready', salvoTimer: 0, rifle: 0, scrap: 0, purchases: {}, shopSelection: 0, freeUpgradeClaimed: false, lastUpgrade: null, waveBurstBonus: 0, passiveTimer: 3, flash: 0,
    laserTarget: null, laserTimer: 0, slimeStacks: 0, stackDamageBonus: 0,
  };
}
function makeDecorations() {
  let seed = 92821;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: 290 }, () => ({ x: random() * WORLD.width, y: random() * WORLD.height, type: random() > .78 ? 'rock' : 'grass', size: 3 + Math.floor(random() * 5) }));
}
function startRun() {
  game = { wave: 0, players: session.players.map(createPlayer), enemies: [], bullets: [], drops: [], particles: [], damageTexts: [], camera: { x: WORLD.width / 2, y: WORLD.height / 2 }, decorations: makeDecorations(), banner: 0, shake: 0 };
  startWave(1);
}
function startWave(number) {
  state = 'playing'; resetEdges();
  game.wave = number; game.enemies = []; game.bullets = []; game.drops = []; game.damageTexts = []; game.banner = 1.7;
  const living = game.players.filter(p => p.alive);
  for (const player of game.players) { player.hp = player.stats.maxHp; player.alive = true; player.salvo = 'ready'; player.salvoTimer = 0; player.waveBurstBonus = 0; player.passiveTimer = 3; player.laserTarget = null; player.laserTimer = 0; }
  // Infinite progression comes from the scaling enemy stats; keep the random horde size bounded for stable local co-op performance.
  const count = Math.min(80, 12 + number * 4 + Math.floor(Math.random() * (5 + number * 2)));
  game.waveEnemyTotal = count;
  for (let i = 0; i < count; i++) spawnSlime(i, count);
  showHud(); sound.tone(170, 300, .18, 'triangle', .035);
}
function spawnSlime(index, count) {
  // Staggered lanes keep arrivals readable instead of spawning one overlapping blob.
  const laneCount = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(count))));
  const lane = index % laneCount;
  const row = Math.floor(index / laneCount);
  const spread = (lane / Math.max(1, laneCount - 1) - .5) * (W + 180);
  const x = clamp(game.camera.x + spread + (Math.random() - .5) * 34, 30, WORLD.width - 30);
  const y = clamp(game.camera.y - H / 2 - 105 - row * 58 - Math.random() * 34, 30, WORLD.height - 30);
  const waveScale = game.wave - 1;
  const maxHp = SLIME.maxHp + waveScale * 9 + Math.floor(Math.random() * (4 + waveScale * 2));
  const damage = SLIME.damage + Math.floor(waveScale * .8) + (Math.random() > .78 ? 1 : 0);
  const speed = SLIME.speed + game.wave * 5 + Math.random() * (9 + waveScale * 2);
  const frontliner = index % 4 === 0;
  const formationRadius = frontliner ? 40 + Math.random() * 8 : 76 + (index % 3) * 27 + Math.random() * 12;
  game.enemies.push({ x, y, radius: SLIME.radius, hp: maxHp, maxHp, damage, speed, attackTimer: 0, flash: 0, dead: false, targetSlot: index % Math.max(1, game.players.length), formationAngle: (lane / laneCount) * Math.PI * 2 + (Math.random() - .5) * .32, formationRadius });
}

function showHud() {
  ui.innerHTML = `<div class="hud"><div class="hud-left" id="player-hud"></div><div class="hud-right"><div class="wave-label" id="wave-hud"></div><div class="hud-card" id="enemy-hud"></div></div></div><div id="wave-banner"></div>`;
  updateHud();
}
function updateHud() {
  const playerHud = byId('player-hud'); if (!playerHud || !game) return;
  playerHud.innerHTML = game.players.map((p, i) => {
    const character = getCharacter(p);
    const health = healthValues(p);
    const mode = isLaserCharacter(p) ? (p.laserTarget ? `<span class="laser-status">LASER LOCKED</span>` : `<span class="salvo">SEEKING TARGET</span>`) : p.salvo === 'reload' ? `<span class="reload">RELOADING</span>` : p.salvo === 'second' ? `<span class="salvo">BURST 1 / 2</span>` : `<span class="salvo">AUTO FIRE READY</span>`;
    const temporary = p.waveBurstBonus > 0 ? ` <span class="reload">(+${p.waveBurstBonus.toFixed(2)})</span>` : '';
    const evolution = laserEvolution(p);
    const special = isLaserCharacter(p) ? `<span class="laser-status">✦ ${p.slimeStacks} STACKS · +${p.stackDamageBonus} DMG<br>${evolution.label}</span>` : `<span class="salvo">↯ ${formatSpeed(effectiveBurstsPerSecond(p))} Attack Speed</span>${temporary}`;
    const healthState = health.percentage <= 28 ? 'critical' : health.percentage <= 55 ? 'warning' : '';
    return `<div class="hud-card ${p.alive ? '' : 'dead'}"><div class="hud-title"><span class="player-label">P${i + 1} · ${character.name.toUpperCase()}</span><span class="scrap">✦ ${p.scrap}</span></div><div class="health-line"><span>HEALTH</span><b>${health.current} / ${health.max}</b></div><div class="hp-bar ${healthState}" aria-label="Health ${health.current} out of ${health.max}"><i style="width:${health.percentage}%"></i></div>${special}<br>${p.alive ? mode : '<span class="reload">DOWN</span>'}</div>`;
  }).join('');
  byId('wave-hud').textContent = `WAVE ${String(game.wave).padStart(2, '0')} · ∞`;
  byId('enemy-hud').textContent = `${game.enemies.length} SLIME${game.enemies.length !== 1 ? 'S' : ''} REMAINING`;
  const banner = byId('wave-banner'); if (banner) banner.innerHTML = game.banner > 0 ? `<span class="wave-banner">WAVE ${game.wave}</span>` : '';
}

function formatSpeed(value) { return `${value.toFixed(2)}`; }
function applyUpgrade(player, upgrade) {
  if (player.freeUpgradeClaimed) { sound.tone(100, 75, .08, 'square', .025); return false; }
  player.purchases[upgrade.id] = (player.purchases[upgrade.id] || 0) + 1;
  let selectedName = upgrade.name;
  if (upgrade.id === 'maxHp') { player.stats.maxHp += 5; player.hp = Math.min(player.stats.maxHp, player.hp + 5); }
  if (upgrade.id === 'damage') player.stats.damage += 5;
  if (upgrade.id === 'resistance') player.stats.resistance += 1;
  if (upgrade.id === 'burstsPerSecond') {
    if (isLaserCharacter(player)) { player.stats.damage += 2; }
    else player.stats.burstsPerSecond = +(player.stats.burstsPerSecond + .2).toFixed(2);
  }
  if (upgrade.id === 'crit') player.stats.crit += 5;
  if (upgrade.id === 'moveSpeed') player.stats.moveSpeed += 15;
  if (upgrade.id === 'range') player.stats.range += 45;
  player.freeUpgradeClaimed = true; player.lastUpgrade = selectedName;
  sound.buy(); return true;
}
function showUpgradeSelection() {
  state = 'upgrade'; resetEdges(); shopActivePlayer = 0;
  for (const player of game.players) { player.freeUpgradeClaimed = false; player.lastUpgrade = null; player.waveBurstBonus = 0; player.passiveTimer = 3; }
  upgradeDetailIndex = game.players[0]?.shopSelection || 0;
  renderUpgradeSelection();
}
function renderUpgradeSelection() {
  const player = game.players[shopActivePlayer] || game.players[0];
  if (!player) return;
  upgradeDetailIndex = clamp(upgradeDetailIndex, 0, UPGRADES.length - 1);
  const character = getCharacter(player);
  const cardHtml = UPGRADES.map((upgrade, index) => {
    const unavailable = player.freeUpgradeClaimed;
    const converted = isLaserCharacter(player) && upgrade.id === 'burstsPerSecond';
    const name = upgrade.name;
    const detail = converted ? '+2 laser damage (converted)' : upgrade.detail;
    return `<button class="upgrade ${unavailable ? 'claimed' : ''} ${player.shopSelection === index ? 'focused' : ''} ${upgradeDetailIndex === index ? 'inspected' : ''}" data-upgrade="${upgrade.id}" data-upgrade-index="${index}" ${unavailable ? 'disabled' : ''}><span class="icon">${upgrade.icon}</span><h3>${name}</h3><p>${detail}</p><span class="reward">FREE PICK</span></button>`;
  }).join('');
  const pickStatus = player.freeUpgradeClaimed ? `Selected: ${player.lastUpgrade}` : 'Choose one free upgrade for this wave.';
  const shopHelp = isLaserCharacter(player)
    ? 'Attack Speed bonuses are converted to laser damage for Pormanove.'
    : 'Attack Speed shortens the delay before Jean Bernard starts his next two-shot burst.';
  const roster = game.players.map((p, index) => { const rosterCharacter = getCharacter(p); return `<article class="co-op-player ${p.freeUpgradeClaimed ? 'done' : ''} ${index === shopActivePlayer ? 'active' : ''}"><img src="${rosterCharacter.sprite}" alt=""><div><strong>Player ${index + 1} · ${rosterCharacter.name}</strong><small>${p.freeUpgradeClaimed ? `Selected · ${p.lastUpgrade}` : 'Choosing upgrade'}</small></div><span>${p.freeUpgradeClaimed ? 'READY' : 'PICK 1'}</span></article>`; }).join('');
  ui.innerHTML = `
    <section class="screen shop-screen upgrade-screen">
      <header class="shop-header"><div><div class="eyebrow">Intermission</div><h1>Choose your upgrade</h1><p>Wave ${game.wave} cleared. Each survivor gets one free stat upgrade before the next wave.</p></div><div class="wave-label">NEXT WAVE<br>${String(game.wave + 1).padStart(2, '0')}</div></header>
      <div class="co-op-roster">${roster}</div>
      <div class="intermission-grid">
        <aside class="stats-panel"><h2>Survivor stats</h2><p class="panel-subtitle">Current values · Player ${shopActivePlayer + 1}</p><div class="active-player"><img src="${character.sprite}" alt=""><div><h3>${character.name}</h3></div></div>${characterStats(player)}<div class="stat-group"><h3>PASSIVE · COMBAT RHYTHM</h3>${passiveDescription(player)}</div></aside>
        <section class="shop-panel"><h2>Free stat choice</h2><p class="shop-help">${pickStatus} ${shopHelp}</p><div class="upgrade-grid">${cardHtml}</div><div class="player-selector">${game.players.map((p, i) => `<button class="player-tab ${i === shopActivePlayer ? 'active' : ''}" data-player="${i}">P${i + 1} · ${p.freeUpgradeClaimed ? 'DONE' : 'PICK 1'}</button>`).join('')}</div><p class="shop-instructions">D-pad: inspect stat · A: confirm free choice · Start: continue</p></section>
        <aside class="inventory-panel stat-detail-panel"><div id="upgrade-detail-panel">${upgradeDetailHtml(player, UPGRADES[upgradeDetailIndex])}</div><div class="mini-loadout"><span>LOADOUT · EMPTY</span><div><i>+</i><i>+</i><i>+</i><i>+</i><i>+</i><i>+</i></div></div></aside>
      </div>
    </section>`;
  document.querySelectorAll('[data-upgrade]').forEach(buttonElement => {
    const index = Number(buttonElement.dataset.upgradeIndex);
    buttonElement.onmouseenter = () => updateUpgradeDetail(player, index);
    buttonElement.onfocus = () => updateUpgradeDetail(player, index);
    buttonElement.onclick = () => { sound.unlock(); const upgrade = UPGRADES.find(u => u.id === buttonElement.dataset.upgrade); if (applyUpgrade(player, upgrade)) { if (game.players.every(p => p.freeUpgradeClaimed)) { showStore(); return; } const next = game.players.findIndex(p => !p.freeUpgradeClaimed); if (next >= 0) { shopActivePlayer = next; upgradeDetailIndex = game.players[next].shopSelection; } renderUpgradeSelection(); } };
  });
  document.querySelectorAll('[data-player]').forEach(buttonElement => buttonElement.onclick = () => { sound.unlock(); shopActivePlayer = Number(buttonElement.dataset.player); upgradeDetailIndex = game.players[shopActivePlayer].shopSelection; sound.click(); renderUpgradeSelection(); });
}

function updateFrontEnd() {
  if (state === 'menu') {
    const keyboardStart = takeKey('enter') || takeKey(' ');
    const controllerStart = pads().some(pad => padEdge(pad, 'menu-start', button(pad, 0) || button(pad, 9)));
    if (keyboardStart || controllerStart) { sound.unlock(); sound.click(); showLobby(); return; }
  }
  if (state === 'lobby') {
    const keyboardBack = takeKey('escape');
    const controllerBack = pads().some(pad => padEdge(pad, 'lobby-back', button(pad, 1)));
    if (keyboardBack || controllerBack) { sound.click(); showMenu(); return; }
    for (const pad of pads()) {
      if (padEdge(pad, 'join', button(pad, 0))) { sound.unlock(); joinPad(pad); }
      if (padEdge(pad, 'start', button(pad, 9)) && session.players.length) { sound.unlock(); showCharacterSelect(); return; }
    }
    if (takeKey('enter')) { if (!session.players.some(p => p.kind === 'keyboard')) addKeyboard(); else showCharacterSelect(); }
  }
  if (state === 'select') {
    for (const [index, player] of session.players.entries()) {
      const pad = getPad(player.padIndex);
      const pressed = player.kind === 'keyboard' ? takeKey('enter') : pad && padEdge(pad, 'ready', button(pad, 0));
      const back = player.kind === 'keyboard' ? index === 0 && takeKey('escape') : pad && padEdge(pad, 'select-back', button(pad, 1));
      const left = player.kind === 'keyboard' ? takeKey('arrowleft') : pad && padEdge(pad, 'character-left', button(pad, 14) || (pad.axes[0] || 0) < -.7);
      const right = player.kind === 'keyboard' ? takeKey('arrowright') : pad && padEdge(pad, 'character-right', button(pad, 15) || (pad.axes[0] || 0) > .7);
      if (back) { if (player.ready) { player.ready = false; characterFocus = index; sound.click(); renderCharacterOptions(); renderReadyList(); } else { showLobby(); return; } }
      if ((left || right) && !player.ready) { const current = CHARACTERS.findIndex(character => character.id === player.characterId); player.characterId = CHARACTERS[(current + (right ? 1 : CHARACTERS.length - 1)) % CHARACTERS.length].id; characterFocus = index; sound.unlock(); sound.click(); renderCharacterOptions(); renderReadyList(); }
      if (pressed) { sound.unlock(); player.ready = !player.ready; characterFocus = index; sound.click(); renderCharacterOptions(); renderReadyList(); }
    }
    if (session.players.length && session.players.every(p => p.ready)) startRun();
  }
  if (state === 'upgrade') updateUpgradeInput();
  if (state === 'shop') updateStoreInput();
  if (state === 'defeat') {
    const retry = takeKey('enter') || takeKey(' ') || game.players.some(player => { const pad = getPad(player.padIndex); return pad && padEdge(pad, 'defeat-retry', button(pad, 0)); });
    const quit = takeKey('escape') || game.players.some(player => { const pad = getPad(player.padIndex); return pad && padEdge(pad, 'defeat-quit', button(pad, 1)); });
    if (retry) startRun(); else if (quit) showMenu();
  }
}
function updateUpgradeInput() {
  for (const [index, player] of game.players.entries()) {
    const pad = getPad(player.padIndex);
    const left = player.kind === 'keyboard' ? index === 0 && takeKey('arrowleft') : pad && padEdge(pad, 'shop-left', button(pad, 14) || (pad.axes[0] || 0) < -.7);
    const right = player.kind === 'keyboard' ? index === 0 && takeKey('arrowright') : pad && padEdge(pad, 'shop-right', button(pad, 15) || (pad.axes[0] || 0) > .7);
    const up = player.kind === 'keyboard' ? index === 0 && takeKey('arrowup') : pad && padEdge(pad, 'shop-up', button(pad, 12) || (pad.axes[1] || 0) < -.7);
    const down = player.kind === 'keyboard' ? index === 0 && takeKey('arrowdown') : pad && padEdge(pad, 'shop-down', button(pad, 13) || (pad.axes[1] || 0) > .7);
    const buy = player.kind === 'keyboard' ? index === 0 && takeKey('enter') : pad && padEdge(pad, 'shop-buy', button(pad, 0));
    const next = player.kind === 'keyboard' ? index === 0 && takeKey(' ') : pad && padEdge(pad, 'shop-next', button(pad, 9));
    let delta = 0;
    if (left) delta = -1;
    else if (right) delta = 1;
    else if (up) delta = -UPGRADE_COLUMNS;
    else if (down) delta = UPGRADE_COLUMNS;
    if (delta) { player.shopSelection = (player.shopSelection + delta + UPGRADES.length) % UPGRADES.length; shopActivePlayer = index; upgradeDetailIndex = player.shopSelection; sound.click(); renderUpgradeSelection(); }
    if (buy) { shopActivePlayer = index; upgradeDetailIndex = player.shopSelection; if (applyUpgrade(player, UPGRADES[player.shopSelection])) { if (game.players.every(p => p.freeUpgradeClaimed)) { showStore(); return; } const remaining = game.players.findIndex(p => !p.freeUpgradeClaimed); if (remaining >= 0) { shopActivePlayer = remaining; upgradeDetailIndex = game.players[remaining].shopSelection; } renderUpgradeSelection(); } }
    if (next && game.players.every(p => p.freeUpgradeClaimed)) { showStore(); return; }
  }
}

function showStore() {
  state = 'shop'; resetEdges();
  ui.innerHTML = `
    <section class="screen store-screen">
      <header class="shop-header"><div><div class="eyebrow">Intermission · Party shop</div><h1>Shop</h1><p>Everyone has chosen an upgrade. This space belongs to the whole party.</p></div><div class="wave-label">NEXT WAVE<br>${String(game.wave + 1).padStart(2, '0')}</div></header>
      <div class="store-tabs"><button class="store-tab active">SHOP</button><button class="store-tab" disabled>LOADOUT · SOON</button></div>
      <main class="store-canvas"><div class="empty-store"><span>+</span><h2>Shop is empty for now</h2><p>Future items, equipment, and material purchases will appear here.</p></div></main>
      <div class="store-footer"><span>✦ Materials are saved for future shop content.</span><button id="start-wave" class="primary">Start wave ${game.wave + 1}</button></div>
    </section>`;
  byId('start-wave').onclick = () => { sound.unlock(); sound.click(); startWave(game.wave + 1); };
}
function updateStoreInput() {
  const keyboardStart = takeKey('enter') || takeKey(' ');
  const controllerStart = game.players.some(player => { const pad = getPad(player.padIndex); return pad && padEdge(pad, 'store-start', button(pad, 0) || button(pad, 9)); });
  if (keyboardStart || controllerStart) startWave(game.wave + 1);
}
function inputForPlayer(player) {
  const pad = getPad(player.padIndex);
  let x = 0, y = 0;
  if (player.kind === 'keyboard') {
    x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('q') || keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('z') || keys.has('w') || keys.has('arrowup') ? 1 : 0);
  } else if (pad) {
    x = pad.axes[0] || 0; y = pad.axes[1] || 0;
    if (Math.abs(x) < .18) x = (button(pad, 15) ? 1 : 0) - (button(pad, 14) ? 1 : 0);
    if (Math.abs(y) < .18) y = (button(pad, 13) ? 1 : 0) - (button(pad, 12) ? 1 : 0);
  }
  return { x, y };
}
function updatePlayer(player, dt) {
  if (!player.alive) return;
  const input = inputForPlayer(player); const moveLength = Math.hypot(input.x, input.y);
  player.moving = moveLength > .12;
  if (player.moving) { player.x += input.x / Math.max(1, moveLength) * player.stats.moveSpeed * dt; player.y += input.y / Math.max(1, moveLength) * player.stats.moveSpeed * dt; player.walkTime = (player.walkTime || 0) + dt; }
  player.x = clamp(player.x, player.radius, WORLD.width - player.radius); player.y = clamp(player.y, player.radius, WORLD.height - player.radius);
  const nearest = game.enemies.filter(enemy => !enemy.dead && distance(player, enemy) <= player.stats.range).reduce((closest, enemy) => !closest || distance(player, enemy) < distance(player, closest) ? enemy : closest, null);
  if (nearest) player.aim = Math.atan2(nearest.y - player.y, nearest.x - player.x);
  player.flash = Math.max(0, player.flash - dt);
  if (isLaserCharacter(player)) {
    player.laserTarget = nearest;
    if (!nearest) { player.laserTimer = 0; return; }
    player.laserTimer -= dt;
    while (player.laserTimer <= 0 && !nearest.dead) {
      dealLaserDamage(player, nearest);
      player.laserTimer += PORMANOVE.laserTick;
    }
    return;
  }
  player.passiveTimer -= dt;
  if (player.passiveTimer <= 0) {
    player.waveBurstBonus = +(player.waveBurstBonus + passiveBurstGain(player)).toFixed(2);
    player.passiveTimer += 3;
    sound.tone(520, 760, .1, 'sine', .025);
  }
  if (player.salvo === 'second' || player.salvo === 'reload') {
    player.salvoTimer -= dt;
    if (player.salvo === 'second' && player.salvoTimer <= 0) { fireBullet(player, true); player.salvo = 'reload'; player.salvoTimer = Math.max(.10, 1 / effectiveBurstsPerSecond(player) - JEAN_BERNARD.burstGap); sound.reload(); }
    else if (player.salvo === 'reload' && player.salvoTimer <= 0) player.salvo = 'ready';
  }
  if (nearest && player.salvo === 'ready') { fireBullet(player, false); player.salvo = 'second'; player.salvoTimer = JEAN_BERNARD.burstGap; }
}
function dealLaserDamage(player, enemy) {
  const critical = Math.random() * 100 < player.stats.crit;
  const damage = player.stats.damage * PORMANOVE.laserTick * (critical ? 2 : 1);
  enemy.hp -= damage; enemy.flash = .08;
  game.damageTexts.push({ x: enemy.x + (Math.random() - .5) * 10, y: enemy.y - 24, value: Math.max(1, Math.round(damage)), critical, life: .52, vy: critical ? -46 : -35 });
  sound.tone(critical ? 510 : 360, critical ? 690 : 470, .035, 'sine', .014);
  if (enemy.hp <= 0) killEnemy(enemy, player);
}
function fireBullet(player, second) {
  player.rifle = second ? 1 : 0;
  const spread = second ? .035 : -.035;
  const angle = player.aim + spread;
  const critical = Math.random() * 100 < player.stats.crit;
  game.bullets.push({ x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20, vx: Math.cos(angle) * 800, vy: Math.sin(angle) * 800, radius: critical ? 5 : 4, damage: player.stats.damage * (critical ? 2 : 1), range: player.stats.range, traveled: 0, life: 1.05, owner: player, critical });
  sound.shot(second);
}
function hurtPlayer(player, damage) {
  player.hp -= damageTaken(damage, player.stats.resistance); player.flash = .12; game.shake = .15; sound.hurt();
  if (player.hp <= 0) { player.hp = 0; player.alive = false; }
}
function killEnemy(enemy, owner) {
  if (enemy.dead) return; enemy.dead = true; sound.kill();
  if (owner && isLaserCharacter(owner)) {
    owner.slimeStacks++;
    if (owner.slimeStacks % 10 === 0) { owner.stats.damage += 2; owner.stackDamageBonus += 2; sound.tone(330, 900, .22, 'triangle', .05); }
  }
  // Let the material pickups visibly travel to their owner, including after the final kill.
  for (let i = 0; i < 3; i++) game.drops.push({ x: enemy.x + (Math.random() - .5) * 18, y: enemy.y + (Math.random() - .5) * 18, value: 1, owner, life: 3 });
  for (let i = 0; i < 7; i++) game.particles.push({ x: enemy.x, y: enemy.y, vx: (Math.random() - .5) * 140, vy: (Math.random() - .5) * 140, life: .35, color: '#85cf60' });
}
function updateGame(dt) {
  for (const player of game.players) updatePlayer(player, dt);
  const living = game.players.filter(player => player.alive);
  if (!living.length) { showDefeat(); return; }
  const average = living.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
  const targetX = average.x / living.length, targetY = average.y / living.length;
  game.camera.x += (targetX - game.camera.x) * Math.min(1, dt * 5); game.camera.y += (targetY - game.camera.y) * Math.min(1, dt * 5);
  game.camera.x = clamp(game.camera.x, W / 2, WORLD.width - W / 2); game.camera.y = clamp(game.camera.y, H / 2, WORLD.height - H / 2);
  for (const bullet of game.bullets) { const traveled = Math.hypot(bullet.vx, bullet.vy) * dt; bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.traveled += traveled; bullet.life -= dt; }
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const target = living.reduce((near, player) => distance(enemy, player) < distance(enemy, near) ? player : near, living[0]);
    const dx = target.x - enemy.x, dy = target.y - enemy.y, length = Math.hypot(dx, dy) || 1;
    if (length > enemy.radius + target.radius - 4) { enemy.x += dx / length * enemy.speed * dt; enemy.y += dy / length * enemy.speed * dt; }
    enemy.attackTimer -= dt; enemy.flash = Math.max(0, enemy.flash - dt);
    if (length < enemy.radius + target.radius && enemy.attackTimer <= 0) { hurtPlayer(target, enemy.damage); enemy.attackTimer = Math.max(.48, .95 - game.wave * .015); }
    for (const bullet of game.bullets) if (bullet.life > 0 && enemy.hp > 0 && distance(enemy, bullet) < enemy.radius + bullet.radius) { enemy.hp -= bullet.damage; enemy.flash = .08; bullet.life = 0; game.damageTexts.push({ x: enemy.x + (Math.random() - .5) * 11, y: enemy.y - 22, value: Math.round(bullet.damage), critical: bullet.critical, life: .6, vy: bullet.critical ? -43 : -34 }); sound.hit(); if (enemy.hp <= 0) killEnemy(enemy, bullet.owner); }
  }
  for (const drop of game.drops) {
    drop.life -= dt;
    const recipient = drop.owner && drop.owner.alive ? drop.owner : living.reduce((closest, player) => !closest || distance(drop, player) < distance(drop, closest) ? player : closest, null);
    if (!recipient) continue;
    const dx = recipient.x - drop.x, dy = recipient.y - drop.y, length = Math.hypot(dx, dy) || 1;
    const speed = 150 + (3 - drop.life) * 230;
    drop.x += dx / length * speed * dt; drop.y += dy / length * speed * dt;
    if (length < recipient.radius + 12) { recipient.scrap += drop.value; drop.life = 0; sound.collect(); }
  }
  for (const particle of game.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
  for (const text of game.damageTexts) { text.y += text.vy * dt; text.life -= dt; }
  game.enemies = game.enemies.filter(e => !e.dead); game.bullets = game.bullets.filter(b => b.life > 0 && b.traveled < b.range && b.x >= 0 && b.x <= WORLD.width && b.y >= 0 && b.y <= WORLD.height); game.drops = game.drops.filter(d => d.life > 0); game.particles = game.particles.filter(p => p.life > 0); game.damageTexts = game.damageTexts.filter(text => text.life > 0);
  game.banner = Math.max(0, game.banner - dt); game.shake = Math.max(0, game.shake - dt);
  if (!game.enemies.length && !game.drops.length) showUpgradeSelection(); else updateHud();
}
function showDefeat() {
  state = 'defeat'; resetEdges(); sound.tone(130, 45, .5, 'sawtooth', .055);
  ui.innerHTML = `<section class="screen"><div class="eyebrow">Wave reached · ${game.wave}</div><h1 class="logo small">SQUAD DOWN</h1><p class="subtitle">The Slimes overran the arena. Regroup, refine your build, and try another run.</p><button id="retry" class="primary">Play again</button><button id="quit" class="ghost">Main menu</button><p class="hint">Controller: A to play again · B to return to the main menu.</p></section>`;
  byId('retry').onclick = () => { sound.unlock(); startRun(); }; byId('quit').onclick = showMenu;
}

function draw() {
  ctx.imageSmoothingEnabled = false;
  if (!game || !['playing', 'upgrade', 'shop', 'defeat'].includes(state)) { drawMenuBackdrop(); return; }
  drawArena();
}
function drawMenuBackdrop() {
  ctx.fillStyle = '#101a16'; ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) { ctx.fillStyle = (x / 32 + y / 32) % 2 ? '#14221b' : '#18271e'; ctx.fillRect(x, y, 32, 32); }
}
function drawArena() {
  ctx.fillStyle = '#243d2c'; ctx.fillRect(0, 0, W, H);
  const offsetX = Math.round(W / 2 - game.camera.x + (game.shake ? (Math.random() - .5) * 6 : 0));
  const offsetY = Math.round(H / 2 - game.camera.y + (game.shake ? (Math.random() - .5) * 6 : 0));
  ctx.save(); ctx.translate(offsetX, offsetY);
  const firstX = Math.floor((game.camera.x - W / 2) / 64) * 64, lastX = game.camera.x + W / 2 + 64;
  const firstY = Math.floor((game.camera.y - H / 2) / 64) * 64, lastY = game.camera.y + H / 2 + 64;
  for (let x = firstX; x < lastX; x += 64) for (let y = firstY; y < lastY; y += 64) { ctx.fillStyle = ((x / 64 + y / 64) & 1) ? '#28452f' : '#2b4932'; ctx.fillRect(x, y, 64, 64); ctx.fillStyle = '#315438'; ctx.fillRect(x + 7, y + 12, 3, 3); ctx.fillRect(x + 43, y + 48, 2, 2); }
  for (const decoration of game.decorations) if (decoration.x > game.camera.x - W / 2 - 20 && decoration.x < game.camera.x + W / 2 + 20 && decoration.y > game.camera.y - H / 2 - 20 && decoration.y < game.camera.y + H / 2 + 20) drawDecoration(decoration);
  for (const drop of game.drops) { ctx.fillStyle = '#f7c84b'; ctx.fillRect(Math.round(drop.x - 4), Math.round(drop.y - 4), 8, 8); ctx.fillStyle = '#fff0a0'; ctx.fillRect(Math.round(drop.x - 2), Math.round(drop.y - 3), 4, 3); }
  for (const bullet of game.bullets) { ctx.fillStyle = bullet.critical ? '#ffec75' : '#f4f1c9'; ctx.fillRect(Math.round(bullet.x - bullet.radius), Math.round(bullet.y - bullet.radius), bullet.radius * 2, bullet.radius * 2); }
  for (const enemy of game.enemies) drawEnemy(enemy);
  for (const player of game.players) drawAttackRange(player);
  for (const player of game.players) drawLaser(player);
  for (const player of game.players) drawPlayer(player);
  for (const particle of game.particles) { ctx.fillStyle = particle.color; ctx.globalAlpha = particle.life / .35; ctx.fillRect(Math.round(particle.x - 2), Math.round(particle.y - 2), 4, 4); } ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.font = 'bold 15px system-ui, sans-serif';
  for (const text of game.damageTexts) { ctx.globalAlpha = clamp(text.life / .6, 0, 1); ctx.fillStyle = text.critical ? '#ffe375' : '#f3f8ff'; ctx.fillText(`${text.critical ? '!' : ''}${text.value}`, Math.round(text.x), Math.round(text.y)); }
  ctx.globalAlpha = 1;
  ctx.restore();
}
function drawDecoration(item) {
  const x = Math.round(item.x), y = Math.round(item.y);
  if (item.type === 'rock') { ctx.fillStyle = '#536458'; ctx.fillRect(x - item.size, y - item.size, item.size * 2, item.size * 2); ctx.fillStyle = '#778474'; ctx.fillRect(x - item.size + 2, y - item.size + 1, item.size, 2); }
  else { ctx.fillStyle = '#476e3d'; ctx.fillRect(x, y - item.size, 2, item.size * 2); ctx.fillRect(x - item.size / 2, y, item.size, 2); }
}
function drawEnemy(enemy) {
  const x = Math.round(enemy.x), y = Math.round(enemy.y); if (enemy.flash) { ctx.globalAlpha = .65; ctx.fillStyle = '#f5f7c0'; ctx.fillRect(x - 31, y - 31, 62, 62); ctx.globalAlpha = 1; }
  drawSprite(images.slime, x, y, 58, '#77c45f');
  drawWorldHealthBar(x, y - 42, 46, enemy.hp, enemy.maxHp, '#d95f5f', enemy.hp < enemy.maxHp ? `${Math.max(0, Math.ceil(enemy.hp))} / ${enemy.maxHp}` : '');
}
function drawWorldHealthBar(x, y, width, hp, maxHp, color, label) {
  const ratio = clamp(hp / maxHp, 0, 1);
  const height = 7;
  const left = Math.round(x - width / 2);
  const top = Math.round(y - height / 2);
  ctx.save();
  ctx.fillStyle = '#080c11'; ctx.fillRect(left - 1, top - 1, width + 2, height + 2);
  ctx.fillStyle = '#3a2228'; ctx.fillRect(left, top, width, height);
  if (ratio > 0) {
    const fill = Math.max(2, Math.round(width * ratio));
    ctx.fillStyle = color; ctx.fillRect(left, top, fill, height);
    ctx.globalAlpha = .42; ctx.fillStyle = '#fff'; ctx.fillRect(left + 1, top + 1, Math.max(0, fill - 2), 1); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = '#63768a'; ctx.lineWidth = 1; ctx.strokeRect(left - .5, top - .5, width + 1, height + 1);
  if (label) { ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f5f8ff'; ctx.strokeStyle = '#081018'; ctx.lineWidth = 3; ctx.strokeText(label, x, top - 4); ctx.fillText(label, x, top - 4); }
  ctx.restore();
}
function drawAttackRange(player) {
  if (!player.alive) return;
  ctx.save();
  ctx.globalAlpha = .42;
  ctx.setLineDash([4, 7]);
  ctx.lineDashOffset = -(performance.now() / 45) % 11;
  ctx.strokeStyle = '#72dcff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(Math.round(player.x), Math.round(player.y), player.stats.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
function drawLaser(player) {
  if (!player.alive || !isLaserCharacter(player) || !player.laserTarget || player.laserTarget.dead) return;
  const fromX = Math.round(player.x);
  const fromY = Math.round(player.y + 10);
  const toX = Math.round(player.laserTarget.x);
  const toY = Math.round(player.laserTarget.y);
  const pulse = .72 + Math.sin(performance.now() / 75) * .18;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha = .24 * pulse;
  ctx.strokeStyle = '#b46cff'; ctx.lineWidth = 15;
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
  ctx.globalAlpha = .82;
  ctx.strokeStyle = '#9d5cff'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#f3d8ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
  ctx.fillStyle = '#fff0ff'; ctx.beginPath(); ctx.arc(fromX, fromY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawPlayer(player) {
  if (!player.alive) return;
  // A slight, crisp bob and a subtle lean make the single-frame sprite feel alive.
  const bob = player.moving ? Math.round(Math.sin(player.walkTime * 13) * 2) : 0;
  const x = Math.round(player.x), y = Math.round(player.y + bob);
  const character = getCharacter(player);
  drawSprite(images[character.id], x, y, 70, character.id === PORMANOVE.id ? '#a65ad7' : '#d58c61');
  const health = healthValues(player);
  drawWorldHealthBar(x, y - 45, 50, health.current, health.max, health.percentage <= 28 ? '#e2515d' : health.percentage <= 55 ? '#e3ac55' : '#68d090', `${health.current} / ${health.max}`);
}
function drawSprite(img, x, y, size, fallback) { if (img.complete && img.naturalWidth) ctx.drawImage(img, Math.round(x - size / 2), Math.round(y - size / 2), size, size); else { ctx.fillStyle = fallback; ctx.fillRect(x - size / 2, y - size / 2, size, size); } }
function byId(id) { return document.getElementById(id); }

function loop(now) {
  const dt = Math.min(.05, (now - lastTime) / 1000); lastTime = now;
  if (state === 'playing') updateGame(dt); else updateFrontEnd();
  draw(); requestAnimationFrame(loop);
}
showMenu(); requestAnimationFrame(loop);
