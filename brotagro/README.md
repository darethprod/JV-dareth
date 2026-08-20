# Arena Survivor

A local co-op 2D survival prototype. Open `index.html` directly in Chrome, Edge, or Firefox.

## Controls

- Controller: left stick or D-pad to move. Combat is fully automatic and targets the nearest enemy. A joins, readies, confirms an upgrade, and starts the empty shop wave; Start/Menu also continues; B goes back or returns to the main menu after defeat. In the upgrade screen, use the D-pad in all four directions to inspect and choose stats.
- Keyboard (testing): ZQSD/WASD or arrow keys to move. Enter confirms and Escape goes back. In the upgrade screen, use all arrow keys to inspect the grid.

## Current rules

- Jean Bernard: 30 HP, 30 damage per shot, automatic two-shot alternating bursts, then a reload delay. Auto-attack starts at 230 range and only targets enemies inside the dotted range circle.
- Pormanove: 38 HP and a continuous mouth laser that targets the nearest enemy in range. His laser deals damage per second and Attack Speed bonuses are converted into damage.
- Attack Speed directly reduces the time before the next burst begins.
- Crit ratio: every 1% Crit Chance gives +0.20 Attack Speed.
- Passive — Combat Rhythm: every 3 seconds during a wave, Jean Bernard gains temporary Attack Speed equal to 50% of his non-temporary Attack Speed. This bonus resets at the end of every wave.
- Pormanove passive — Maw of Greed: each Slime killed grants one stack; every 10 stacks grant +2 permanent laser damage for the current run.
- Slime: 40 HP and 5 damage.
- Slimes enter the arena from the top of the screen in a random, increasingly difficult number. Enemy health, damage, and speed continue to grow on infinite waves. Damage numbers appear over every successful hit.
- At each intermission, every survivor selects exactly one free stat upgrade. Max HP is included (+5 maximum health); health is refilled for the next wave. Once the whole party is ready, the game opens a shared full-screen Shop tab. Materials are retained for future item and equipment systems, not spent on stats.
- Range is a free stat choice alongside the other stats and adds 45 auto-attack range per selection.
- Health bars show exact current/max values in the HUD and above survivors. The intermission screen includes numeric stat breakdowns; hovering a stat card or moving to it with a controller shows its exact current and next values, including Resistance damage reduction.

Provided sprites are organized in `assets/sprites/characters` and `assets/sprites/enemies`.
