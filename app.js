const $ = (s) => document.querySelector(s);
const unitTypes = {
  scout: { emoji: '🐕', cost: 2, hp: 38, damage: 7, speed: 1.25, name: 'Scout' },
  bulldog: { emoji: '🐶', cost: 4, hp: 90, damage: 12, speed: .65, name: 'Bulldog' },
  hound: { emoji: '🐺', cost: 6, hp: 62, damage: 23, speed: .85, name: 'Hound' }
};
let game, interval, deferredPrompt;
function reset() {
  clearInterval(interval);
  game = { playerHp: 100, enemyHp: 100, energy: 8, enemyEnergy: 8, time: 100, units: [], skill: 0, running: true, id: 0 };
  $('#units').innerHTML = '';
  $('#game').classList.remove('hidden'); $('#how').classList.add('hidden'); $('#intro').classList.add('hidden');
  document.querySelectorAll('.card, .skill').forEach(b => b.disabled = false);
  update(); interval = setInterval(tick, 250);
}
function deploy(type, side) {
  const def = unitTypes[type]; const energyKey = side === 'player' ? 'energy' : 'enemyEnergy';
  if (!game.running || game[energyKey] < def.cost) return false;
  game[energyKey] -= def.cost;
  const unit = { ...def, id: ++game.id, side, x: side === 'player' ? 14 : 86, hp: def.hp, attackTimer: 0, stunned: 0 };
  game.units.push(unit); renderUnit(unit); return true;
}
function renderUnit(u) {
  const el = document.createElement('div'); el.id = `u${u.id}`; el.className = `unit ${u.side === 'enemy' ? 'enemy' : ''}`;
  el.innerHTML = `<span class="emoji">${u.emoji}</span><small>${u.name}</small>`; $('#units').append(el); paint(u);
}
function paint(u) { const el = $(`#u${u.id}`); if (el) el.style.left = `calc(${u.x}% - 20px)`; }
function flash(text) { const el = $('#flash'); el.textContent = text; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 220); }
function hurtTower(side, amount) { if (side === 'player') game.playerHp = Math.max(0, game.playerHp - amount); else game.enemyHp = Math.max(0, game.enemyHp - amount); flash(`-${amount}`); }
function tick() {
  if (!game.running) return;
  game.time -= .25;
  const refill = game.time <= 30 ? .34 : .17; game.energy = Math.min(10, game.energy + refill); game.enemyEnergy = Math.min(10, game.enemyEnergy + refill);
  if (Math.random() < .035) { const options = Object.keys(unitTypes).filter(k => unitTypes[k].cost <= game.enemyEnergy); if (options.length) deploy(options[Math.floor(Math.random() * options.length)], 'enemy'); }
  for (const u of [...game.units]) {
    if (u.stunned > 0) { u.stunned -= .25; continue; }
    const foe = game.units.filter(v => v.side !== u.side && v.hp > 0).sort((a,b) => Math.abs(a.x-u.x)-Math.abs(b.x-u.x))[0];
    u.attackTimer -= .25;
    if (foe && Math.abs(foe.x-u.x) < 7) { if (u.attackTimer <= 0) { foe.hp -= u.damage; u.attackTimer = 1; flash('WOOF!'); } }
    else if ((u.side === 'player' && u.x > 77) || (u.side === 'enemy' && u.x < 23)) { if (u.attackTimer <= 0) { hurtTower(u.side === 'player' ? 'enemy' : 'player', u.damage); u.attackTimer = 1.1; } }
    else { u.x += (u.side === 'player' ? 1 : -1) * u.speed; paint(u); }
  }
  game.units.filter(u => u.hp <= 0).forEach(u => $(`#u${u.id}`)?.remove()); game.units = game.units.filter(u => u.hp > 0);
  game.skill = Math.max(0, game.skill - .25); update();
  if (game.playerHp <= 0 || game.enemyHp <= 0 || game.time <= 0) finish(game.enemyHp < game.playerHp ? true : game.enemyHp === game.playerHp ? null : false);
}
function update() { const m = Math.max(0, game.time); $('#clock').textContent = `${Math.floor(m/60)}:${String(Math.floor(m%60)).padStart(2,'0')}`; $('#energy').textContent = Math.floor(game.energy); $('#playerHp').textContent=Math.ceil(game.playerHp); $('#enemyHp').textContent=Math.ceil(game.enemyHp); $('#playerBar').style.width=`${game.playerHp}%`;$('#enemyBar').style.width=`${game.enemyHp}%`; document.querySelectorAll('.card').forEach(b => b.disabled = !game.running || game.energy < unitTypes[b.dataset.unit].cost); $('#skill').disabled = !game.running || game.skill > 0; $('#skillText').textContent = game.skill > 0 ? `${Math.ceil(game.skill)}s` : 'READY'; }
function finish(won) { game.running=false; clearInterval(interval); document.querySelectorAll('.card, .skill').forEach(b => b.disabled = true); $('#resultLabel').textContent = won === null ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT'; $('#resultTitle').textContent = won === null ? 'Evenly matched.' : won ? 'Good dogs win.' : 'The rival pack held.'; $('#resultCopy').textContent = won === null ? 'Both kennels are still standing. Try a more aggressive pack next time.' : won ? 'Your pack took the rival kennel. A fine day for the underdogs.' : 'Regroup, save energy, and make your Pack Howl count.'; $('#result').showModal(); }
$('#play').onclick=reset; $('#again').onclick=()=>{ $('#result').close(); reset(); }; document.querySelectorAll('.card').forEach(b=>b.onclick=()=>deploy(b.dataset.unit,'player')); $('#skill').onclick=()=>{ if(game.skill>0)return; game.skill=18; game.units.filter(u=>u.side==='enemy').forEach(u=>u.stunned=3); flash('PACK HOWL!'); update(); };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js'); window.addEventListener('beforeinstallprompt', e=>{e.preventDefault();deferredPrompt=e;$('#install').classList.remove('hidden')}); $('#install').onclick=async()=>{deferredPrompt?.prompt();await deferredPrompt?.userChoice;deferredPrompt=null;$('#install').classList.add('hidden')};
