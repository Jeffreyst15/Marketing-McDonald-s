import { supabase, CONFIGURADO } from './supabase-init.js';

// Banco de estrategias: 10 tarjetas distribuidas parejo en las 5 eras de marketing
const STRATEGIES = [
  { era: 1, text: "Estandarización total (Speedee Service)" },
  { era: 1, text: "Menú reducido y fijo" },
  { era: 2, text: "Happy Meal para el segmento infantil" },
  { era: 2, text: "Campaña emocional global 'i'm lovin' it'" },
  { era: 3, text: "Rediseño saludable del menú" },
  { era: 3, text: "Abastecimiento sostenible certificado" },
  { era: 4, text: "App con programa de lealtad" },
  { era: 4, text: "Kioscos de autoservicio" },
  { era: 5, text: "Menú personalizado con IA (Dynamic Yield)" },
  { era: 5, text: "Pedidos por voz con IA en el drive-thru" },
];

const MAX_SECONDS = 300; // 5 minutos
const SESSION_ID_KEY = 'mcdJugadorId'; // por pestaña, así una misma compu soporta varias pestañas simultáneas

// ---- Referencias del DOM ----
const configScreen = document.getElementById('configScreen');
const pool = document.getElementById('pool');
const bins = Array.from(document.querySelectorAll('.bin'));
const statCorrect = document.getElementById('statCorrect');
const statWrong = document.getElementById('statWrong');
const statTime = document.getElementById('statTime');
const timeStat = document.getElementById('timeStat');
const playAgainBtn = document.getElementById('playAgainBtn');
const overlay = document.getElementById('overlay');
const modalEmoji = document.getElementById('modalEmoji');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');
const congratsBadge = document.getElementById('congratsBadge');
const resTiempo = document.getElementById('resTiempo');
const resAciertos = document.getElementById('resAciertos');
const resErrores = document.getElementById('resErrores');
const resPuesto = document.getElementById('resPuesto');
const hint = document.getElementById('hint');

const gateOverlay = document.getElementById('gateOverlay');
const nombreInput = document.getElementById('nombreInput');
const carreraInput = document.getElementById('carreraInput');
const startBtn = document.getElementById('startBtn');
const gateError = document.getElementById('gateError');

const waitingOverlay = document.getElementById('waitingOverlay');
const waitingName = document.getElementById('waitingName');

let selectedCard = null;
let correct = 0, wrong = 0;
let seconds = 0, timerId = null, finished = false, roundActive = false;
let playerName = '', playerCareer = '', jugadorId = null;
let sesionChannel = null;

// ---- Utilidades ----
function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function formatTime(s){
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const r = String(s % 60).padStart(2, '0');
  return m + ':' + r;
}
function compareRecords(a, b){
  if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
  if (a.tiempo !== b.tiempo) return a.tiempo - b.tiempo;
  return a.errores - b.errores;
}

// ---- Pantallas ----
function showScreen(name){
  gateOverlay.classList.toggle('show', name === 'gate');
  waitingOverlay.classList.toggle('show', name === 'waiting');
  overlay.classList.toggle('show', name === 'results');
}

// ---- Anotarse en la sala ----
async function tryJoin(){
  const n = nombreInput.value.trim();
  const c = carreraInput.value.trim();
  if (!n || !c){
    gateError.textContent = 'Completá tu nombre completo y tu carrera para continuar.';
    return;
  }
  gateError.textContent = '';
  startBtn.disabled = true;

  try {
    const { data: sesionData } = await supabase.from('sesion').select('estado').eq('id', 1).single();
    const estadoActual = sesionData ? sesionData.estado : 'espera';

    const { data, error } = await supabase
      .from('jugadores')
      .insert({ nombre: n, carrera: c, estado: 'esperando' })
      .select()
      .single();
    if (error) throw error;

    playerName = n; playerCareer = c; jugadorId = data.id;
    sessionStorage.setItem(SESSION_ID_KEY, jugadorId);

    if (estadoActual === 'jugando'){
      hint.textContent = 'El juego ya está en curso — vas a entrar en la próxima ronda.';
    }
    enterWaitingRoom();
  } catch (e){
    console.error(e);
    gateError.textContent = 'No se pudo conectar. Revisá tu conexión e intentá de nuevo.';
  } finally {
    startBtn.disabled = false;
  }
}

function enterWaitingRoom(){
  waitingName.textContent = playerName;
  showScreen('waiting');
  listenSesion();
}

function listenSesion(){
  if (sesionChannel) supabase.removeChannel(sesionChannel);
  sesionChannel = supabase
    .channel('sesion-jugador-' + jugadorId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sesion', filter: 'id=eq.1' }, (payload) => {
      const data = payload.new || {};
      if (data.estado === 'jugando' && !roundActive){
        beginRoundForPlayer(data.iniciado_en);
      }
    })
    .subscribe();
}

function elapsedSince(iniciadoEn){
  if (!iniciadoEn) return 0;
  const inicioMs = new Date(iniciadoEn).getTime();
  if (isNaN(inicioMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - inicioMs) / 1000));
}

async function beginRoundForPlayer(iniciadoEn){
  roundActive = true;
  showScreen(null);
  if (jugadorId){
    try { await supabase.from('jugadores').update({ estado: 'jugando' }).eq('id', jugadorId); }
    catch (e){ console.error(e); }
  }
  resetGame();
  startTimerFrom(elapsedSince(iniciadoEn));
}

// ---- Lógica del tablero ----
// El cronómetro arranca apenas el administrador da inicio (sincronizado para
// todos los jugadores), no cuando cada uno toca su primera tarjeta.
function runTimer(){
  if (timerId) return;
  timerId = setInterval(() => {
    seconds++;
    statTime.textContent = formatTime(Math.min(seconds, MAX_SECONDS));
    if (seconds >= MAX_SECONDS - 30 && seconds < MAX_SECONDS){
      timeStat.classList.add('warning');
    }
    if (seconds >= MAX_SECONDS){
      endGame('timeout');
    }
  }, 1000);
}
function startTimerFrom(elapsed){
  seconds = Math.min(elapsed, MAX_SECONDS);
  statTime.textContent = formatTime(seconds);
  timeStat.classList.toggle('warning', seconds >= MAX_SECONDS - 30 && seconds < MAX_SECONDS);
  if (finished) return;
  if (seconds >= MAX_SECONDS){ endGame('timeout'); return; }
  runTimer();
}
function stopTimer(){ clearInterval(timerId); timerId = null; }

function updateBinCount(era){
  const bin = bins.find(b => b.dataset.era == era);
  const total = parseInt(bin.dataset.total, 10);
  const done = document.querySelectorAll('.card-btn[data-era="' + era + '"].placed').length;
  bin.querySelector('.c').textContent = done;
  if (done >= total) bin.classList.add('complete');
}

function selectCard(card){
  if (finished) return;
  runTimer(); // red de seguridad: por si el timer no arrancó al inicio de la ronda
  if (selectedCard) selectedCard.classList.remove('selected');
  if (selectedCard === card){ selectedCard = null; hint.textContent = 'Elegí una tarjeta ↓'; return; }
  selectedCard = card;
  card.classList.add('selected');
  hint.textContent = 'Ahora tocá la era de marketing correspondiente ↑';
}

function handleBinClick(bin){
  if (!selectedCard || finished) return;
  const era = bin.dataset.era;
  const cardEra = selectedCard.dataset.era;

  if (era === cardEra){
    correct++;
    statCorrect.textContent = correct;
    selectedCard.classList.remove('selected');
    selectedCard.classList.add('correct', 'placed');
    selectedCard.disabled = true;
    updateBinCount(era);
    const doneCard = selectedCard;
    selectedCard = null;
    hint.textContent = '¡Bien! Elegí la próxima tarjeta ↓';
    setTimeout(() => {
      doneCard.style.display = 'none';
      checkFinished();
    }, 260);
  } else {
    wrong++;
    statWrong.textContent = wrong;
    bin.classList.add('shake');
    selectedCard.classList.add('wrong');
    hint.textContent = 'No es esa era — probá de nuevo ↓';
    setTimeout(() => {
      bin.classList.remove('shake');
      if (selectedCard) selectedCard.classList.remove('wrong');
    }, 350);
  }
}

function checkFinished(){
  const remaining = document.querySelectorAll('.card-btn:not(.placed)').length;
  if (remaining === 0) endGame('completed');
}

// ---- Fin de partida: guardar resultado y calcular puesto ----
async function endGame(reason){
  if (finished) return;
  finished = true;
  stopTimer();
  timeStat.classList.remove('warning');

  const resultado = {
    estado: 'terminado',
    tiempo: seconds,
    aciertos: correct,
    errores: wrong,
    completado: reason === 'completed',
    terminado_en: new Date().toISOString()
  };

  let rank = '-', total = '-';
  try {
    if (jugadorId) await supabase.from('jugadores').update(resultado).eq('id', jugadorId);
    const { data: terminados } = await supabase.from('jugadores').select('*').eq('estado', 'terminado');
    const lista = (terminados || []).slice().sort(compareRecords);
    const idx = lista.findIndex(r => r.id === jugadorId);
    rank = idx === -1 ? lista.length : idx + 1;
    total = lista.length;
  } catch (e){
    console.error('No se pudo guardar/calcular el resultado:', e);
  }

  modalEmoji.textContent = reason === 'completed' ? '🎉' : '⏰';
  modalTitle.textContent = reason === 'completed' ? '¡Completado!' : '¡Tiempo agotado!';
  modalText.textContent = reason === 'completed'
    ? 'Clasificaste las 10 estrategias en ' + formatTime(seconds) + ' con ' + wrong + ' error(es).'
    : 'Se acabaron los 5 minutos. Clasificaste ' + correct + ' de 10 estrategias con ' + wrong + ' error(es).';

  resTiempo.textContent = formatTime(seconds);
  resAciertos.textContent = correct;
  resErrores.textContent = wrong;
  resPuesto.textContent = rank + ' / ' + total;

  congratsBadge.innerHTML = '';
  if (rank === 1){
    const banner = document.createElement('div');
    banner.className = 'congrats-banner';
    banner.textContent = '🏆 ¡Felicidades, ' + playerName + '! Tenés el mejor puntaje hasta ahora: más aciertos, menor tiempo y menos errores.';
    congratsBadge.appendChild(banner);
  }

  showScreen('results');
}

function buildPool(){
  pool.innerHTML = '';
  const shuffled = shuffle(STRATEGIES);
  shuffled.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'card-btn';
    btn.dataset.era = item.era;
    btn.textContent = item.text;
    btn.addEventListener('click', () => selectCard(btn));
    pool.appendChild(btn);
  });
}

function resetGame(){
  correct = 0; wrong = 0; seconds = 0; finished = false; selectedCard = null;
  statCorrect.textContent = '0';
  statWrong.textContent = '0';
  statTime.textContent = '00:00';
  timeStat.classList.remove('warning');
  hint.textContent = 'Elegí una tarjeta para empezar ↓';
  stopTimer();
  bins.forEach(b => {
    b.classList.remove('complete');
    b.querySelector('.c').textContent = '0';
  });
  buildPool();
}

// ---- Volver a anotarse para otra ronda ----
function resetForNextRound(){
  stopTimer();
  roundActive = false;
  finished = false;
  jugadorId = null;
  sessionStorage.removeItem(SESSION_ID_KEY);
  if (sesionChannel){ supabase.removeChannel(sesionChannel); sesionChannel = null; }
  nombreInput.value = '';
  carreraInput.value = '';
  gateError.textContent = '';
  showScreen('gate');
  setTimeout(() => nombreInput.focus(), 200);
}

// ---- Reanudar sesión guardada (si recargó la página) ----
async function resumeIfJoined(){
  const savedId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!savedId){ showScreen('gate'); return; }
  try {
    const { data } = await supabase.from('jugadores').select('*').eq('id', savedId).single();
    if (data && data.estado !== 'terminado'){
      jugadorId = savedId;
      playerName = data.nombre;
      playerCareer = data.carrera;
      const { data: sesionData } = await supabase.from('sesion').select('estado, iniciado_en').eq('id', 1).single();
      const estadoActual = sesionData ? sesionData.estado : 'espera';
      if (estadoActual === 'jugando'){
        beginRoundForPlayer(sesionData ? sesionData.iniciado_en : null);
      } else {
        enterWaitingRoom();
      }
      return;
    }
  } catch (e){ console.error(e); }
  sessionStorage.removeItem(SESSION_ID_KEY);
  showScreen('gate');
}

// ---- Eventos ----
bins.forEach(bin => bin.addEventListener('click', () => handleBinClick(bin)));
playAgainBtn.addEventListener('click', resetForNextRound);
startBtn.addEventListener('click', tryJoin);
[nombreInput, carreraInput].forEach(inp => {
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryJoin(); });
});

// ---- Arranque ----
if (!CONFIGURADO){
  configScreen.style.display = 'flex';
  showScreen(null);
} else {
  resumeIfJoined();
}
