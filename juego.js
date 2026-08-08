  // Banco de estrategias: 10 tarjetas distribuidas en 4 eras de marketing
  const STRATEGIES = [
    { era: 1, text: "Estandarización total (Speedee Service)" },
    { era: 1, text: "Menú reducido y fijo" },
    { era: 1, text: "Precio bajo y uniforme" },
    { era: 2, text: "Happy Meal para el segmento infantil" },
    { era: 2, text: "Campaña emocional global 'i'm lovin' it'" },
    { era: 3, text: "Rediseño saludable del menú" },
    { era: 3, text: "Abastecimiento sostenible certificado" },
    { era: 3, text: "Alianzas de responsabilidad social (RMHC)" },
    { era: 4, text: "App con programa de lealtad" },
    { era: 4, text: "Kioscos de autoservicio" },
  ];

  const MAX_SECONDS = 300; // 5 minutos
  const STORAGE_KEY = 'mcdJuegoJugadores';

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

  let selectedCard = null;
  let correct = 0, wrong = 0;
  let seconds = 0, timerId = null, finished = false;
  let playerName = '', playerCareer = '';

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

  function startTimer(){
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
  function stopTimer(){
    clearInterval(timerId);
    timerId = null;
  }

  function updateBinCount(era){
    const bin = bins.find(b => b.dataset.era == era);
    const total = parseInt(bin.dataset.total, 10);
    const done = document.querySelectorAll('.card-btn[data-era="' + era + '"].placed').length;
    bin.querySelector('.c').textContent = done;
    if (done >= total) bin.classList.add('complete');
  }

  function selectCard(card){
    if (finished) return;
    startTimer();
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
    if (remaining === 0){
      endGame('completed');
    }
  }

  function compareRecords(a, b){
    if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos; // más aciertos primero
    if (a.tiempo !== b.tiempo) return a.tiempo - b.tiempo;         // menos tiempo primero
    return a.errores - b.errores;                                   // menos errores primero
  }

  function loadRecords(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e){ return []; }
  }

  function saveRecord(record){
    const records = loadRecords();
    records.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function computeRank(id){
    const records = loadRecords().slice().sort(compareRecords);
    const idx = records.findIndex(r => r.id === id);
    return { rank: idx === -1 ? records.length : idx + 1, total: records.length };
  }

  function endGame(reason){
    if (finished) return;
    finished = true;
    stopTimer();
    timeStat.classList.remove('warning');

    const record = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      nombre: playerName,
      carrera: playerCareer,
      tiempo: seconds,
      aciertos: correct,
      errores: wrong,
      completado: reason === 'completed',
      fecha: new Date().toISOString()
    };
    saveRecord(record);
    const { rank, total } = computeRank(record.id);

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

    overlay.classList.add('show');
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
    overlay.classList.remove('show');
    stopTimer();
    bins.forEach(b => {
      b.classList.remove('complete');
      b.querySelector('.c').textContent = '0';
    });
    buildPool();
  }

  function showGate(){
    nombreInput.value = '';
    carreraInput.value = '';
    gateError.textContent = '';
    gateOverlay.classList.add('show');
    setTimeout(() => nombreInput.focus(), 200);
  }

  function tryStart(){
    const n = nombreInput.value.trim();
    const c = carreraInput.value.trim();
    if (!n || !c){
      gateError.textContent = 'Completá tu nombre completo y tu carrera para continuar.';
      return;
    }
    playerName = n;
    playerCareer = c;
    gateOverlay.classList.remove('show');
    resetGame();
  }

  function abortAndShowGate(){
    stopTimer();
    overlay.classList.remove('show');
    showGate();
  }

  bins.forEach(bin => bin.addEventListener('click', () => handleBinClick(bin)));
  playAgainBtn.addEventListener('click', abortAndShowGate);
  startBtn.addEventListener('click', tryStart);
  [nombreInput, carreraInput].forEach(inp => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryStart(); });
  });

  hint.textContent = 'Completá tus datos para empezar ↓';
