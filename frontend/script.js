// Carrusel de portfolio (hero)
(function runPortfolioCarousel() {
  const root = document.getElementById('portfolioCarousel');
  if (!root) return;

  const slides = Array.from(root.querySelectorAll('.carousel__slide'));
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const dotsContainer = document.getElementById('carouselDots');

  let current = 0;
  let autoplayTimer = null;

  // Generar los dots dinámicamente según la cantidad de slides
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Ir al proyecto ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });
  const dots = Array.from(dotsContainer.children);

  function goTo(index) {
    slides[current].classList.remove('is-active');
    dots[current].removeAttribute('aria-current');

    current = (index + slides.length) % slides.length;

    slides[current].classList.add('is-active');
    dots[current].setAttribute('aria-current', 'true');
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  nextBtn.addEventListener('click', () => { next(); resetAutoplay(); });
  prevBtn.addEventListener('click', () => { prev(); resetAutoplay(); });

  function startAutoplay() {
    autoplayTimer = setInterval(next, 8000);
  }
  function resetAutoplay() {
    clearInterval(autoplayTimer);
    startAutoplay();
  }

  // root.addEventListener('mouseenter', () => clearInterval(autoplayTimer));
  // root.addEventListener('mouseleave', startAutoplay);
  // root.addEventListener('focusin', () => clearInterval(autoplayTimer));
  // root.addEventListener('focusout', startAutoplay);

  goTo(0);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion) startAutoplay();
})();

(function handleSignup() {
  // const endpoint = "https://xjj7s56cdplbhdclqctgxqvlum0shdrk.lambda-url.us-east-1.on.aws/"; //lambda endpoint
  const endpoint = "https://s2vyrfc7e8.execute-api.us-east-1.amazonaws.com/dev/contact"; // api cateway endpoint
  
  const form = document.getElementById('signupForm');
  const status = document.getElementById('signupStatus');
  if (!form || !status) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const emailInput = form.elements.namedItem('email');
  const messageInput = form.elements.namedItem('message');
  const websiteInput = form.elements.namedItem('website'); // honeypot

  const setStatus = (message, type = 'info') => {
    status.textContent = message;
    status.setAttribute('data-state', type || 'info');
  };

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = (emailInput && emailInput.value ? emailInput.value.trim() : '');
    const message = (messageInput && messageInput.value ? messageInput.value.trim() : '');
    const website = (websiteInput && websiteInput.value ? websiteInput.value.trim() : '');


    if (!email || !message) {
      setStatus('Completá tu email y tu mensaje para enviar la consulta.', 'error');
      if (!email) emailInput?.focus();
      else messageInput?.focus();
      return;
    }

    if (!isValidEmail(email)) {
      setStatus('Ingresá un email válido para seguir.', 'error');
      emailInput?.focus();
      return;
    }

    const payload = {
      email,
      message,
      website,
      submittedAt: new Date().toISOString()
    };

    if (submitButton) submitButton.disabled = true;
    setStatus('Enviando tu consulta...', 'loading');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      form.reset();
      // setStatus(`Listo. Te escribimos a ${email} en breve.`, 'success');
      setStatus(`Hemos recibido tu consulta. Te escribimos a ${email} en breve.`, 'success');
    } catch (error) {
      console.error('Signup submission failed:', error);
      const isTimeout = error.name === 'AbortError';
      setStatus(
        isTimeout
          ? 'La solicitud tardó demasiado. Intentá de nuevo.'
          : 'No pudimos enviar tu consulta ahora. Intentá de nuevo más tarde.',
        'error'
      );
    } finally {
      clearTimeout(timeoutId);
      if (submitButton) submitButton.disabled = false;
    }
  });

})();