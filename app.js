const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const UNITS = {
  brutus: {
    name: 'Brutus', role: 'G', cost: 2, hp: 260, armor: 55, damage: 23,
    speed: 4.4, range: 5.2, attackRate: 1.35, specialRate: 18,
    image: 'brutus-warrior.png'
  },
  sage: {
    name: 'Sage', role: 'S', cost: 3, hp: 175, armor: 10, damage: 13,
    speed: 4, range: 10, attackRate: 1.65, specialRate: 15,
    image: 'sage-healer.png'
  },
  hex: {
    name: 'Hex', role: 'M', cost: 3, hp: 145, armor: 5, damage: 31,
    speed: 3.65, range: 15, attackRate: 1.9, specialRate: 13,
    image: 'hex-mage.png'
  }
};

const DIFFICULTIES = {
  easy: { label: 'EASY', spawnRate: 4.65, hp: .9, damage: .88, think: .25 },
  normal: { label: 'NORMAL', spawnRate: 3.55, hp: 1, damage: 1, think: .58 },
  hard: { label: 'HARD', spawnRate: 2.7, hp: 1.12, damage: 1.1, think: .9 }
};

let selectedDifficulty = 'normal';
let game = null;
let frame = 0;
let deferredPrompt;
let soundOn = true;
let audioContext;
let toastTimer;

function freshGame() {
  return {
    running: true,
    paused: false,
    time: 180,
    energy: 5,
    enemyEnergy: 5,
    units: [],
    towers: {
      player: { hp: 2200, maxHp: 2200, shield: 0, cooldown: 0 },
      enemy: { hp: 2200, maxHp: 2200, shield: 0, cooldown: 0 }
    },
    skills: { heal: 0, shield: 0, enemyHeal: 28, enemyShield: 38 },
    aiTimer: 1.7,
    emoteTimer: 19,
    id: 0,
    lastTime: performance.now(),
    frenzyShown: false
  };
}

function startMatch() {
  cancelAnimationFrame(frame);
  game = freshGame();
  $('#units').replaceChildren();
  $('#game').classList.remove('hidden');
  $('#intro').classList.add('hidden');
  $('#how').classList.add('hidden');
  $$('.client-nav').forEach((item) => item.classList.toggle('active', item.id === 'battleNav'));
  $('#difficultyLabel').textContent = `${DIFFICULTIES[selectedDifficulty].label} RIVAL`;
  $('#frenzyBanner').classList.remove('show');
  enableControls(true);
  updateHud();
  $('#game').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('READY · SET · BARK!', 'start');
  sfx('start');
  frame = requestAnimationFrame(loop);
}

function openTutorial() {
  $('#tutorialDifficulty').textContent = DIFFICULTIES[selectedDifficulty].label;
  $('#tutorialDialog').showModal();
}

function loop(now) {
  if (!game?.running) return;
  const dt = Math.min((now - game.lastTime) / 1000, .1);
  game.lastTime = now;
  if (!game.paused) step(dt);
  frame = requestAnimationFrame(loop);
}

function step(dt) {
  game.time = Math.max(0, game.time - dt);
  const frenzy = game.time <= 60;
  const regen = frenzy ? 1.2 : .6;
  game.energy = Math.min(10, game.energy + regen * dt);
  game.enemyEnergy = Math.min(10, game.enemyEnergy + regen * dt);

  if (frenzy && !game.frenzyShown) {
    game.frenzyShown = true;
    $('#frenzyBanner').classList.add('show');
    showToast('DOUBLE ENERGY!', 'frenzy');
    sfx('frenzy');
    setTimeout(() => $('#frenzyBanner').classList.remove('show'), 4200);
  }

  Object.keys(game.skills).forEach((key) => game.skills[key] = Math.max(0, game.skills[key] - dt));
  updateAI(dt);
  updateUnits(dt);
  updateTowers(dt);
  updateHud();

  if (game.towers.player.hp <= 0 || game.towers.enemy.hp <= 0 || game.time <= 0) finishMatch();
}

function deploy(type, side = 'player') {
  if (!game?.running || game.paused) return false;
  const def = UNITS[type];
  const energyKey = side === 'player' ? 'energy' : 'enemyEnergy';
  if (game[energyKey] + .001 < def.cost) return false;
  game[energyKey] -= def.cost;
  const aiScale = side === 'enemy' ? DIFFICULTIES[selectedDifficulty] : { hp: 1, damage: 1 };
  const unit = {
    ...def,
    id: ++game.id,
    type,
    side,
    x: side === 'player' ? 13.5 : 86.5,
    hp: Math.round(def.hp * aiScale.hp),
    maxHp: Math.round(def.hp * aiScale.hp),
    shield: def.armor,
    damage: Math.round(def.damage * aiScale.damage),
    attackCooldown: .4,
    specialCooldown: def.specialRate * .55,
    burnTime: 0,
    burnTick: 0,
    dead: false
  };
  game.units.push(unit);
  createUnitElement(unit);
  sfx('spawn');
  updateHud();
  return true;
}

function createUnitElement(unit) {
  const el = document.createElement('div');
  el.id = `unit-${unit.id}`;
  el.className = `unit ${unit.type} ${unit.side === 'enemy' ? 'enemy' : ''}`;
  el.innerHTML = `<div class="unit-bar"><i></i><b></b></div><span class="unit-level">${unit.role}</span><img src="${unit.image}" alt="${unit.name}" />`;
  $('#units').append(el);
  paintUnit(unit);
}

function paintUnit(unit) {
  const el = $(`#unit-${unit.id}`);
  if (!el) return;
  el.style.left = `${unit.x}%`;
  el.querySelector('.unit-bar i').style.width = `${Math.max(0, unit.hp / unit.maxHp * 100)}%`;
  el.querySelector('.unit-bar b').style.width = `${Math.min(100, unit.shield / unit.maxHp * 100)}%`;
  el.classList.toggle('shielded', unit.shield > 1);
  el.classList.toggle('burning', unit.burnTime > 0);
}

function updateUnits(dt) {
  for (const unit of game.units) {
    if (unit.dead) continue;
    unit.attackCooldown -= dt;
    unit.specialCooldown -= dt;
    if (unit.burnTime > 0) {
      unit.burnTime -= dt;
      unit.burnTick -= dt;
      if (unit.burnTick <= 0) {
        unit.burnTick = 1;
        damageUnit(unit, 8, false);
      }
    }
    if (unit.hp <= 0) continue;

    const foes = game.units.filter((other) => !other.dead && other.side !== unit.side && other.hp > 0);
    const nearest = foes.sort((a, b) => Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x))[0];
    const towerInRange = unit.side === 'player' ? unit.x >= 79 : unit.x <= 21;
    const foeInRange = nearest && Math.abs(nearest.x - unit.x) <= unit.range;

    if (unit.specialCooldown <= 0 && useUnitSpecial(unit, foes)) {
      unit.specialCooldown = unit.specialRate;
      continue;
    }

    if (foeInRange && unit.attackCooldown <= 0) {
      attackUnit(unit, nearest);
    } else if (towerInRange && unit.attackCooldown <= 0) {
      attackTower(unit);
    } else if (!foeInRange && !towerInRange) {
      unit.x += (unit.side === 'player' ? 1 : -1) * unit.speed * dt;
    }
    paintUnit(unit);
  }
  game.units = game.units.filter((unit) => !unit.remove);
}

function useUnitSpecial(unit, foes) {
  if (unit.type === 'brutus') {
    const allies = game.units.filter((ally) => !ally.dead && ally.side === unit.side && Math.abs(ally.x - unit.x) < 13);
    allies.forEach((ally) => {
      ally.shield = Math.min(ally.maxHp * .45, ally.shield + ally.maxHp * (ally.id === unit.id ? .2 : .1));
      paintUnit(ally);
    });
    flashUnit(unit, 'shielded');
    showToast(unit.side === 'player' ? 'PAW WALL!' : 'RIVAL GUARD!');
    sfx('shield');
    return true;
  }

  if (unit.type === 'sage') {
    const wounded = game.units
      .filter((ally) => !ally.dead && ally.side === unit.side && ally.hp < ally.maxHp * .88)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!wounded) return false;
    wounded.hp = Math.min(wounded.maxHp, wounded.hp + 72);
    flashUnit(wounded, 'healing');
    showToast(unit.side === 'player' ? 'GOOD AS NEW!' : 'RIVAL MEND!');
    sfx('heal');
    paintUnit(wounded);
    return true;
  }

  if (unit.type === 'hex') {
    const target = foes.filter((foe) => Math.abs(foe.x - unit.x) <= unit.range * 1.45)[0];
    if (!target) return false;
    foes.filter((foe) => Math.abs(foe.x - target.x) < 9).forEach((foe) => {
      damageUnit(foe, 44, true);
      foe.burnTime = 3;
      foe.burnTick = .35;
    });
    flashUnit(unit, 'attacking');
    showToast(unit.side === 'player' ? 'PAW-FIRE!' : 'RIVAL BLAST!');
    sfx('magic');
    return true;
  }
  return false;
}

function attackUnit(attacker, target) {
  const critical = Math.random() < (attacker.type === 'hex' ? .22 : .1);
  const amount = Math.round(attacker.damage * (critical ? 1.55 : 1));
  damageUnit(target, amount, critical);
  attacker.attackCooldown = attacker.attackRate;
  flashUnit(attacker, 'attacking');
  if (critical) showToast('CRITICAL!');
  sfx(critical ? 'critical' : 'hit');
}

function damageUnit(unit, amount, strong) {
  if (unit.dead) return;
  let remaining = amount;
  if (unit.shield > 0) {
    const blocked = Math.min(unit.shield, remaining);
    unit.shield -= blocked;
    remaining -= blocked;
  }
  unit.hp = Math.max(0, unit.hp - remaining);
  flashUnit(unit, 'hurt');
  if (strong) unit.x += unit.side === 'player' ? -1.2 : 1.2;
  if (unit.hp <= 0) killUnit(unit);
  paintUnit(unit);
}

function killUnit(unit) {
  if (unit.dead) return;
  unit.dead = true;
  const el = $(`#unit-${unit.id}`);
  el?.classList.add('dead');
  setTimeout(() => {
    el?.remove();
    unit.remove = true;
  }, 560);
  sfx('down');
}

function attackTower(unit) {
  const targetSide = unit.side === 'player' ? 'enemy' : 'player';
  const critical = Math.random() < .08;
  damageTower(targetSide, Math.round(unit.damage * (critical ? 1.5 : 1)));
  unit.attackCooldown = unit.attackRate;
  flashUnit(unit, 'attacking');
  if (critical) showToast('TOWER CRIT!');
  sfx('tower');
}

function damageTower(side, amount) {
  const tower = game.towers[side];
  let remaining = amount;
  if (tower.shield > 0) {
    const blocked = Math.min(tower.shield, remaining);
    tower.shield -= blocked;
    remaining -= blocked;
  }
  tower.hp = Math.max(0, tower.hp - remaining);
  const towerEl = side === 'player' ? $('.tower.home') : $('.tower.rival');
  towerEl.classList.remove('damaged');
  void towerEl.offsetWidth;
  towerEl.classList.add('damaged');
}

function updateTowers(dt) {
  for (const side of ['player', 'enemy']) {
    const tower = game.towers[side];
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;
    const targets = game.units
      .filter((unit) => !unit.dead && unit.side !== side && (side === 'player' ? unit.x < 32 : unit.x > 68))
      .sort((a, b) => side === 'player' ? a.x - b.x : b.x - a.x);
    if (targets[0]) {
      damageUnit(targets[0], tower.hp < tower.maxHp * .35 ? 48 : 34, false);
      tower.cooldown = tower.hp < tower.maxHp * .35 ? .9 : 1.35;
      sfx('zap');
    }
  }
}

function updateAI(dt) {
  const profile = DIFFICULTIES[selectedDifficulty];
  game.aiTimer -= dt;
  if (game.aiTimer <= 0) {
    const affordable = Object.keys(UNITS).filter((type) => UNITS[type].cost <= game.enemyEnergy);
    if (affordable.length) {
      let choice = affordable[Math.floor(Math.random() * affordable.length)];
      if (Math.random() < profile.think) {
        const playerTypes = game.units.filter((unit) => unit.side === 'player' && !unit.dead).map((unit) => unit.type);
        if (playerTypes.includes('brutus') && affordable.includes('hex')) choice = 'hex';
        else if (playerTypes.length > 2 && affordable.includes('sage')) choice = 'sage';
        else if (affordable.includes('brutus')) choice = 'brutus';
      }
      deploy(choice, 'enemy');
    }
    game.aiTimer = profile.spawnRate * (.78 + Math.random() * .44);
  }

  if (game.skills.enemyHeal <= 0) {
    teamHeal('enemy', 95, false);
    game.skills.enemyHeal = 36;
  }
  if (game.skills.enemyShield <= 0) {
    teamShield('enemy', 85, false);
    game.skills.enemyShield = 43;
  }
  game.emoteTimer -= dt;
  if (game.emoteTimer <= 0) {
    showEmote('enemy', ['NICE!', 'WOOF?!', 'TO THE MOON!'][Math.floor(Math.random() * 3)]);
    game.emoteTimer = 22 + Math.random() * 15;
  }
}

function teamHeal(side, amount, announce = true) {
  game.units.filter((unit) => !unit.dead && unit.side === side).forEach((unit) => {
    unit.hp = Math.min(unit.maxHp, unit.hp + amount);
    flashUnit(unit, 'healing');
    paintUnit(unit);
  });
  const tower = game.towers[side];
  tower.hp = Math.min(tower.maxHp, tower.hp + amount * .65);
  if (announce) showToast('PACK MEND!');
  sfx('heal');
}

function teamShield(side, amount, announce = true) {
  game.units.filter((unit) => !unit.dead && unit.side === side).forEach((unit) => {
    unit.shield = Math.min(unit.maxHp * .5, unit.shield + amount);
    paintUnit(unit);
  });
  game.towers[side].shield = Math.min(350, game.towers[side].shield + amount);
  if (announce) showToast('GUARD RALLY!');
  sfx('shield');
}

function useHeal() {
  if (!game?.running || game.paused || game.skills.heal > 0) return;
  teamHeal('player', 110);
  game.skills.heal = 36;
  updateHud();
}

function useShield() {
  if (!game?.running || game.paused || game.skills.shield > 0) return;
  teamShield('player', 100);
  game.skills.shield = 42;
  updateHud();
}

function flashUnit(unit, className) {
  const el = $(`#unit-${unit.id}`);
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), className === 'healing' ? 800 : 390);
}

function showToast(text) {
  const toast = $('#toast');
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 650);
}

function showEmote(side, text) {
  const bubble = side === 'player' ? $('#playerEmote') : $('#enemyEmote');
  bubble.textContent = text;
  bubble.classList.add('show');
  setTimeout(() => bubble.classList.remove('show'), 2200);
}

function updateHud() {
  if (!game) return;
  const player = game.towers.player;
  const enemy = game.towers.enemy;
  const seconds = Math.max(0, Math.ceil(game.time));
  $('#clock').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('#phase').textContent = game.time <= 60 ? 'FRENZY' : 'BATTLE';
  $('.timer').classList.toggle('frenzy', game.time <= 60);
  $('#energy').textContent = game.energy.toFixed(1);
  $('#playerHp').textContent = Math.ceil(player.hp);
  $('#enemyHp').textContent = Math.ceil(enemy.hp);
  $('#playerShield').textContent = player.shield ? `+${Math.ceil(player.shield)} guard` : '';
  $('#enemyShield').textContent = enemy.shield ? `+${Math.ceil(enemy.shield)} guard` : '';
  $('#playerBar').style.width = `${player.hp / player.maxHp * 100}%`;
  $('#enemyBar').style.width = `${enemy.hp / enemy.maxHp * 100}%`;
  $('#playerShieldBar').style.width = `${player.shield / player.maxHp * 100}%`;
  $('#enemyShieldBar').style.width = `${enemy.shield / enemy.maxHp * 100}%`;

  $$('.card').forEach((button) => {
    button.disabled = !game.running || game.paused || game.energy < UNITS[button.dataset.unit].cost;
  });
  $('#healSkill').disabled = !game.running || game.paused || game.skills.heal > 0;
  $('#shieldSkill').disabled = !game.running || game.paused || game.skills.shield > 0;
  $('#healText').textContent = game.skills.heal > 0 ? `${Math.ceil(game.skills.heal)}s` : 'READY';
  $('#shieldText').textContent = game.skills.shield > 0 ? `${Math.ceil(game.skills.shield)}s` : 'READY';
  $$('#energyPips i').forEach((pip, index) => pip.classList.toggle('on', index < Math.floor(game.energy)));
}

function enableControls(enabled) {
  $$('.card, .skill, .emotes button').forEach((button) => button.disabled = !enabled);
}

function finishMatch() {
  if (!game?.running) return;
  game.running = false;
  cancelAnimationFrame(frame);
  enableControls(false);
  const playerScore = game.towers.player.hp + game.towers.player.shield;
  const enemyScore = game.towers.enemy.hp + game.towers.enemy.shield;
  const won = playerScore > enemyScore ? true : playerScore < enemyScore ? false : null;
  $('#resultLabel').textContent = won === null ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
  $('#resultTitle').textContent = won === null ? 'A perfect standoff.' : won ? 'The kennel stands!' : 'Back to training.';
  $('#resultCopy').textContent = won === null
    ? 'Both packs held the floor. Change your summon timing and settle it in the rematch.'
    : won
      ? 'Your pack controlled the final push and sent the rival home with its tail tucked.'
      : 'The rival broke through. Protect Sage, counter with Hex, and save energy for the frenzy.';
  $('#resultPlayerHp').textContent = Math.ceil(game.towers.player.hp);
  $('#resultEnemyHp').textContent = Math.ceil(game.towers.enemy.hp);
  sfx(won ? 'win' : 'down');
  $('#result').showModal();
}

function pauseMatch() {
  if (!game?.running || game.paused) return;
  game.paused = true;
  updateHud();
  $('#pauseDialog').showModal();
}

function resumeMatch() {
  if (!game?.running) return;
  game.paused = false;
  game.lastTime = performance.now();
  $('#pauseDialog').close();
  updateHud();
}

function showMenu() {
  cancelAnimationFrame(frame);
  if (game) game.running = false;
  if ($('#result').open) $('#result').close();
  if ($('#pauseDialog').open) $('#pauseDialog').close();
  if ($('#featureDialog').open) $('#featureDialog').close();
  if ($('#tutorialDialog').open) $('#tutorialDialog').close();
  $('#game').classList.add('hidden');
  $('#intro').classList.remove('hidden');
  $('#how').classList.remove('hidden');
  $$('.client-nav').forEach((item) => item.classList.toggle('active', item.id === 'home'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function sfx(type) {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const tones = {
      spawn:[340,.08,'sine'], hit:[145,.045,'square'], critical:[520,.12,'sawtooth'], tower:[95,.08,'square'],
      zap:[690,.045,'sine'], heal:[610,.16,'sine'], shield:[260,.16,'triangle'], magic:[430,.2,'sawtooth'],
      down:[110,.16,'sawtooth'], frenzy:[740,.25,'square'], start:[420,.16,'triangle'], win:[880,.28,'sine']
    };
    const [frequency, duration, wave] = tones[type] || tones.hit;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    if (type === 'heal' || type === 'win') oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, audioContext.currentTime + duration);
    gain.gain.setValueAtTime(.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (_) {
    soundOn = false;
  }
}

for (let i = 0; i < 10; i++) $('#energyPips').append(document.createElement('i'));

$$('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
  selectedDifficulty = button.dataset.difficulty;
  $$('[data-difficulty]').forEach((item) => item.classList.toggle('selected', item === button));
}));
$$('.card').forEach((button) => button.addEventListener('click', () => deploy(button.dataset.unit)));
$$('.emotes button').forEach((button) => button.addEventListener('click', () => showEmote('player', button.dataset.emote)));

const featurePreviews = {
  vs: {
    icon: '⚔', eyebrow: 'COMPETITIVE MODE', title: 'VS Arena',
    copy: 'Challenge another pack in friendly rooms and ranked seasons. Fair-match rules keep power readable and every victory skill-driven.',
    status: 'MATCHMAKING FOUNDATION IN PROGRESS'
  },
  market: {
    icon: '◇', eyebrow: 'PLAYER MARKET', title: 'Market',
    copy: 'A curated place for cosmetic heroes, skins, emotes, and collectible editions—designed around transparent listings, not pay-to-win power.',
    status: 'ECONOMY DESIGN READY FOR TESTING'
  },
  collection: {
    icon: '♢', eyebrow: 'YOUR PACK', title: 'Collection',
    copy: 'Build a personal roster, inspect hero roles and rarity, equip visual variants, and showcase the history of every collectible you own.',
    status: 'INVENTORY & LOADOUT PROTOTYPE NEXT'
  },
  barracks: {
    icon: '⚑', eyebrow: 'HERO RECRUITMENT', title: 'The Barracks',
    copy: 'Spend account-bound Treats earned from play to recruit new hero and cosmetic variants. Every combat role keeps normalized stats; optional PAW collector editions never buy battle power.',
    status: 'TREATS SINK · NO PAY-TO-WIN'
  },
  wallet: {
    icon: '◎', eyebrow: 'OPTIONAL IDENTITY', title: 'Wallet',
    copy: 'Connect a Solana profile only when you want portable collectibles or market access. Playing the core game never requires a wallet.',
    status: 'OFFLINE IN THIS WEB PROTOTYPE'
  }
};

$$('.coming[data-feature]').forEach((button) => button.addEventListener('click', () => {
  const feature = featurePreviews[button.dataset.feature];
  $('#featureIcon').textContent = feature.icon;
  $('#featureEyebrow').textContent = feature.eyebrow;
  $('#featureTitle').textContent = feature.title;
  $('#featureCopy').textContent = feature.copy;
  $('#featureStatus').textContent = feature.status;
  $('#featureDialog').showModal();
}));

$('#play').addEventListener('click', openTutorial);
$('#battleNav').addEventListener('click', openTutorial);
$('#home').addEventListener('click', showMenu);
$('#healSkill').addEventListener('click', useHeal);
$('#shieldSkill').addEventListener('click', useShield);
$('#pause').addEventListener('click', pauseMatch);
$('#resume').addEventListener('click', resumeMatch);
$('#quitMatch').addEventListener('click', showMenu);
$('#again').addEventListener('click', () => { $('#result').close(); startMatch(); });
$('#menuFromResult').addEventListener('click', showMenu);
$('#closeFeature').addEventListener('click', () => $('#featureDialog').close());
$('#closeTutorial').addEventListener('click', () => $('#tutorialDialog').close());
$('#startBattle').addEventListener('click', () => { $('#tutorialDialog').close(); startMatch(); });
$('#sound').addEventListener('click', () => {
  soundOn = !soundOn;
  $('#sound').classList.toggle('muted', !soundOn);
  $('#sound').textContent = soundOn ? '♪' : '×';
  if (soundOn) sfx('start');
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && game?.running) game.paused ? resumeMatch() : pauseMatch();
  if (!game?.running || game.paused) return;
  if (event.key === '1') deploy('brutus');
  if (event.key === '2') deploy('sage');
  if (event.key === '3') deploy('hex');
  if (event.key.toLowerCase() === 'q') useHeal();
  if (event.key.toLowerCase() === 'w') useShield();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game?.running && !game.paused) pauseMatch();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  $('#install').classList.remove('hidden');
});
$('#install').addEventListener('click', async () => {
  deferredPrompt?.prompt();
  await deferredPrompt?.userChoice;
  deferredPrompt = null;
  $('#install').classList.add('hidden');
});
