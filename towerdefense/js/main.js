import { Game } from './game.js';

const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const playButton = document.getElementById('play-button');
const canvas = document.getElementById('game-canvas');
const map = document.getElementById('map-image');

const game = new Game({
  canvas,
  map,
  hud: {
    currency: document.getElementById('currency-value'),
    wave: document.getElementById('wave-value'),
    coreHealth: document.getElementById('core-health-fill')
  },
  unitSlot: document.getElementById('unit-slot')
});

playButton.addEventListener('click', () => {
  menu.hidden = true;
  hud.hidden = false;
  game.start();
});

map.addEventListener('error', () => {
  console.error('Impossible de charger la carte : map/map.png');
});
