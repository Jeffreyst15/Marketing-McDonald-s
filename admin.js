  const STORAGE_KEY = 'mcdJuegoJugadores';
  const ADMIN_PASSWORD = 'mcdonalds2026';

  const passGate = document.getElementById('passGate');
  const passInput = document.getElementById('passInput');
  const passBtn = document.getElementById('passBtn');
  const passError = document.getElementById('passError');
  const adminWrap = document.getElementById('adminWrap');

  const topBanner = document.getElementById('topBanner');
  const summaryRow = document.getElementById('summaryRow');
  const tablaBody = document.getElementById('tablaBody');
  const emptyMsg = document.getElementById('emptyMsg');
  const exportBtn = document.getElementById('exportBtn');
  const resetBtn = document.getElementById('resetBtn');

  function loadRecords(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e){ return []; }
  }

  function compareRecords(a, b){
    if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos; // más aciertos primero
    if (a.tiempo !== b.tiempo) return a.tiempo - b.tiempo;         // menos tiempo primero
    return a.errores - b.errores;                                   // menos errores primero
  }

  function formatTime(s){
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const r = String(s % 60).padStart(2, '0');
    return m + ':' + r;
  }

  function formatFecha(iso){
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function tryLogin(){
    if (passInput.value === ADMIN_PASSWORD){
      passGate.classList.remove('show');
      adminWrap.style.display = 'block';
      render();
    } else {
      passError.textContent = 'Contraseña incorrecta. Probá de nuevo.';
      passInput.value = '';
      passInput.focus();
    }
  }
  passBtn.addEventListener('click', tryLogin);
  passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
  setTimeout(() => passInput.focus(), 200);

  function render(){
    const records = loadRecords().slice().sort(compareRecords);

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

    const totalJugadores = records.length;
    const completaron = records.filter(r => r.completado).length;
    const promedioAciertos = (records.reduce((s, r) => s + r.aciertos, 0) / totalJugadores).toFixed(1);
    const promedioTiempo = Math.round(records.reduce((s, r) => s + r.tiempo, 0) / totalJugadores);

    summaryRow.innerHTML =
      '<div class="summary-card"><span class="n">' + totalJugadores + '</span><span class="l">Jugadores</span></div>' +
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
        '<td>' + (r.completado ? '✅ Completo' : '⏰ Tiempo agotado') + '</td>' +
        '<td class="mono small">' + formatFecha(r.fecha) + '</td>';
      tablaBody.appendChild(tr);
    });
  }

  resetBtn.addEventListener('click', () => {
    if (confirm('¿Seguro que querés borrar todos los resultados guardados? Esta acción no se puede deshacer.')){
      localStorage.removeItem(STORAGE_KEY);
      render();
    }
  });

  exportBtn.addEventListener('click', () => {
    const records = loadRecords().slice().sort(compareRecords);
    if (records.length === 0){ alert('No hay datos para exportar.'); return; }
    const header = ['Puesto', 'Nombre', 'Carrera', 'Tiempo (s)', 'Aciertos', 'Errores', 'Estado', 'Fecha'];
    const rows = records.map((r, i) => [
      i + 1, r.nombre, r.carrera, r.tiempo, r.aciertos, r.errores,
      r.completado ? 'Completo' : 'Tiempo agotado', r.fecha
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
