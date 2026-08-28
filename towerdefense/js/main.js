import { Game } from './game.js';

const menu = document.querySelector('#menu');
const hud = document.querySelector('#hud');
const playButton = document.querySelector('#play-button');

const game = new Game({
  canvas: document.querySelector('#game-canvas'),
  map: document.querySelector('#map-image'),
  hud: {
    currency: document.querySelector('#currency-value'),
    wave: document.querySelector('#wave-value'),
    coreHealth: document.querySelector('#core-health-fill')
  },
  unitSlot: document.querySelector('#unit-slot')
});

playButton.addEventListener('click', () => {
  menu.hidden = true;
  hud.hidden = false;
  game.start();
});
