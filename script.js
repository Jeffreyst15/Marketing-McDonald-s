  const slides = Array.from(document.querySelectorAll('.slide'));
  const total = slides.length;
  const progressBar = document.getElementById('progressBar');
  const counter = document.getElementById('counter');
  const dotBtns = Array.from(document.querySelectorAll('.dot-btn'));
  const chipBtns = Array.from(document.querySelectorAll('.chip-btn'));
  const toTopBtn = document.getElementById('toTop');

  // Navegación: clic en un punto o en un chip lleva a esa sección con scroll suave
  function goToSection(id) {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  dotBtns.forEach(btn => btn.addEventListener('click', () => goToSection(btn.dataset.target)));
  chipBtns.forEach(btn => btn.addEventListener('click', () => goToSection(btn.dataset.target)));

  // Botón "volver arriba"
  if (toTopBtn) {
    toTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Resalta el punto correspondiente a la sección visible
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const idx = slides.indexOf(entry.target);
      if (idx === -1 || !entry.isIntersecting) return;
      dotBtns.forEach(d => d.classList.remove('active'));
      if (dotBtns[idx]) dotBtns[idx].classList.add('active');
      if (counter) counter.textContent = (idx + 1) + '/' + total;
    });
  }, { threshold: 0.5 });
  slides.forEach(s => spy.observe(s));

  // Anima tarjetas y bloques al entrar en pantalla
  const revealEls = document.querySelectorAll('.reveal');
  const rio = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        rio.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => rio.observe(el));

  // Barra de progreso según el avance real del scroll + mostrar botón "arriba"
  function onScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + '%';
    if (toTopBtn) toTopBtn.classList.toggle('show', scrollTop > window.innerHeight * 0.6);
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
