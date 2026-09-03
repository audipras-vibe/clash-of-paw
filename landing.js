document.querySelectorAll('[data-launch]').forEach((link) => link.addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const screen = document.querySelector('#launchScreen');
  screen.classList.add('show');
  screen.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => { window.location.href = link.href; }, 900);
}));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
