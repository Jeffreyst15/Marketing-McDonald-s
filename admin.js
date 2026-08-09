import { supabase, CONFIGURADO } from './supabase-init.js';

const ADMIN_PASSWORD = 'mcdonalds2026';

const configScreen = document.getElementById('configScreen');
const passGate = document.getElementById('passGate');
const passInput = document.getElementById('passInput');
const passBtn = document.getElementById('passBtn');
const passError = document.getElementById('passError');
const adminWrap = document.getElementById('adminWrap');

const statusPill = document.getElementById('statusPill');
const lobbyCount = document.getElementById('lobbyCount');
const lobbyList = document.getElementById('lobbyList');
const lobbyEmpty = document.getElementById('lobbyEmpty');
const startRoundBtn = document.getElementById('startRoundBtn');
const newRoundBtn = document.getElementById('newRoundBtn');

const topBanner = document.getElementById('topBanner');
const summaryRow = document.getElementById('summaryRow');
const tablaBody = document.getElementById('tablaBody');
const emptyMsg = document.getElementById('emptyMsg');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');

let sesionActual = { estado: 'espera' };
let todosLosJugadores = [];

function compareRecords(a, b){
  if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
  if (a.tiempo !== b.tiempo) return a.tiempo - b.tiempo;
  return a.errores - b.errores;
}
function formatTime(s){
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const r = String(s % 60).padStart(2, '0');
  return m + ':' + r;
}
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ---- Login (contraseña simple del lado del cliente) ----
function tryLogin(){
  if (passInput.value === ADMIN_PASSWORD){
    passGate.classList.remove('show');
    adminWrap.style.display = 'block';
    startListening();
  } else {
    passError.textContent = 'Contraseña incorrecta. Probá de nuevo.';
    passInput.value = '';
    passInput.focus();
  }
}
passBtn.addEventListener('click', tryLogin);
passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });

// ---- Carga + suscripción en tiempo real ----
async function fetchAndRenderAll(){
  try {
    const { data: sesionData } = await supabase.from('sesion').select('*').eq('id', 1).single();
    sesionActual = sesionData || { estado: 'espera' };

    const { data: jugadoresData } = await supabase
      .from('jugadores')
      .select('*')
      .order('unido_en', { ascending: true });
    todosLosJugadores = jugadoresData || [];

    renderLobby();
    renderResultados();
  } catch (e){
    console.error('Error cargando datos:', e);
  }
}

function startListening(){
  fetchAndRenderAll();

  supabase
    .channel('admin-sesion')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sesion', filter: 'id=eq.1' }, () => fetchAndRenderAll())
    .subscribe();

  supabase
    .channel('admin-jugadores')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadores' }, () => fetchAndRenderAll())
    .subscribe();
}

function renderStatus(){
  const enJuego = sesionActual.estado === 'jugando';
  statusPill.textContent = enJuego ? '🟢 Juego en curso' : '🟡 Sala de espera';
  statusPill.classList.toggle('live', enJuego);
  const enSala = todosLosJugadores.filter(j => j.estado !== 'terminado').length;
  startRoundBtn.disabled = enJuego || enSala === 0;
}

function renderLobby(){
  const enSala = todosLosJugadores.filter(j => j.estado !== 'terminado');
  lobbyCount.textContent = enSala.length + (enSala.length === 1 ? ' anotado' : ' anotados');
  lobbyList.innerHTML = '';
  lobbyEmpty.style.display = enSala.length === 0 ? 'block' : 'none';

  enSala.forEach(j => {
    const li = document.createElement('li');
    const estadoTxt = j.estado === 'jugando' ? '🎮 jugando' : '⏳ esperando';
    li.innerHTML = '<b>' + escapeHtml(j.nombre) + '</b><span>' + escapeHtml(j.carrera) + ' · ' + estadoTxt + '</span>';
    lobbyList.appendChild(li);
  });

  renderStatus();
}

function renderResultados(){
  const records = todosLosJugadores.filter(j => j.estado === 'terminado').slice().sort(compareRecords);

  if (records.length === 0){
    emptyMsg.style.display = 'block';
    topBanner.innerHTML = '';
    summaryRow.innerHTML = '';
    tablaBody.innerHTML = '';
    return;
  }
  emptyMsg.style.display = 'none';

  const best = records[0];
  topBanner.innerHTML =
    '<span class="top-banner">🏆 <b>' + escapeHtml(best.nombre) + '</b> (' + escapeHtml(best.carrera) +
    ') tiene el mejor puntaje: ' + best.aciertos + ' aciertos, ' + best.errores +
    ' errores, en ' + formatTime(best.tiempo) + '.</span>';

  const total = records.length;
  const completaron = records.filter(r => r.completado).length;
  const promedioAciertos = (records.reduce((s, r) => s + r.aciertos, 0) / total).toFixed(1);
  const promedioTiempo = Math.round(records.reduce((s, r) => s + r.tiempo, 0) / total);

  summaryRow.innerHTML =
    '<div class="summary-card"><span class="n">' + total + '</span><span class="l">Terminaron</span></div>' +
    '<div class="summary-card"><span class="n">' + completaron + '</span><span class="l">Completaron</span></div>' +
    '<div class="summary-card"><span class="n">' + promedioAciertos + '</span><span class="l">Aciertos promedio</span></div>' +
    '<div class="summary-card"><span class="n">' + formatTime(promedioTiempo) + '</span><span class="l">Tiempo promedio</span></div>';

  tablaBody.innerHTML = '';
  records.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.classList.add('gold');
    else if (i === 1) tr.classList.add('silver');
    else if (i === 2) tr.classList.add('bronze');
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
    tr.innerHTML =
      '<td class="mono">' + medal + '</td>' +
      '<td>' + escapeHtml(r.nombre) + '</td>' +
      '<td>' + escapeHtml(r.carrera) + '</td>' +
      '<td class="mono">' + formatTime(r.tiempo) + '</td>' +
      '<td class="mono ok">' + r.aciertos + '</td>' +
      '<td class="mono bad">' + r.errores + '</td>' +
      '<td>' + (r.completado ? '✅ Completo' : '⏰ Tiempo agotado') + '</td>';
    tablaBody.appendChild(tr);
  });
}

// ---- Controles del administrador ----
startRoundBtn.addEventListener('click', async () => {
  startRoundBtn.disabled = true;
  try {
    const { error } = await supabase.from('sesion').update({ estado: 'jugando', iniciado_en: new Date().toISOString() }).eq('id', 1);
    if (error) throw error;
  } catch (e){
    console.error(e);
    alert('No se pudo iniciar el juego. Revisá tu conexión e intentá de nuevo.');
    startRoundBtn.disabled = false;
  }
});

newRoundBtn.addEventListener('click', async () => {
  try {
    const { error } = await supabase.from('sesion').update({ estado: 'espera', iniciado_en: null }).eq('id', 1);
    if (error) throw error;
  } catch (e){
    console.error(e);
    alert('No se pudo reiniciar la sala. Revisá tu conexión e intentá de nuevo.');
  }
});

resetBtn.addEventListener('click', async () => {
  if (!confirm('¿Seguro que querés borrar todos los jugadores y resultados guardados? Esta acción no se puede deshacer.')) return;
  resetBtn.disabled = true;
  try {
    const { error: delError } = await supabase.from('jugadores').delete().not('id', 'is', null);
    if (delError) throw delError;
    const { error: sesError } = await supabase.from('sesion').update({ estado: 'espera', iniciado_en: null }).eq('id', 1);
    if (sesError) throw sesError;
  } catch (e){
    console.error(e);
    alert('Ocurrió un error borrando los datos. Probá de nuevo.');
  } finally {
    resetBtn.disabled = false;
  }
});

exportBtn.addEventListener('click', () => {
  const records = todosLosJugadores.filter(j => j.estado === 'terminado').slice().sort(compareRecords);
  if (records.length === 0){ alert('No hay datos para exportar.'); return; }
  const header = ['Puesto', 'Nombre', 'Carrera', 'Tiempo (s)', 'Aciertos', 'Errores', 'Estado'];
  const rows = records.map((r, i) => [
    i + 1, r.nombre, r.carrera, r.tiempo, r.aciertos, r.errores,
    r.completado ? 'Completo' : 'Tiempo agotado'
  ]);
  const csv = [header, ...rows]
    .map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'resultados_juego_mcdonalds.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ---- Arranque ----
if (!CONFIGURADO){
  configScreen.style.display = 'flex';
  passGate.classList.remove('show');
} else {
  setTimeout(() => passInput.focus(), 200);
}
