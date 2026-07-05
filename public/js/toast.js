const TOAST_CONTAINER_ID = 'toast-container';

function getContainer() {
  let el = document.getElementById(TOAST_CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOAST_CONTAINER_ID;
    document.body.appendChild(el);
  }
  return el;
}

let toastId = 0;

window.showToast = function showToast(message, type = 'info', duration = 3500) {
  const container = getContainer();
  const id = ++toastId;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.id = `toast-${id}`;
  toast.setAttribute('role', 'alert');

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    xp: '⭐',
    warning: '⚠️',
    celebration: '🎉',
  };

  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
  }, duration);

  return id;
};
