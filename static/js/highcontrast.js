(function () {
  const storageKey = 'atomview-high-contrast';
  const themeAttribute = 'data-theme';
  const toggleSelector = '.contrast-toggle';

  function applyTheme(enabled) {
    const themeValue = enabled ? 'high-contrast' : 'default';
    document.documentElement.setAttribute(themeAttribute, themeValue);
    document.body.setAttribute(themeAttribute, themeValue);

    const toggles = Array.from(document.querySelectorAll(toggleSelector));
    toggles.forEach((toggle) => {
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.classList.toggle('is-active', enabled);

      const label = toggle.querySelector('.contrast-toggle-label');
      if (label) {
        label.textContent = enabled ? 'Normal contrast' : 'High contrast';
      }

      const icon = toggle.querySelector('.contrast-toggle-icon');
      if (icon) {
        icon.textContent = enabled ? '◐' : '◑';
      }
    });

    localStorage.setItem(storageKey, String(enabled));
  }

  function initTheme() {
    const savedPreference = localStorage.getItem(storageKey);
    const enabled = savedPreference === 'true';
    applyTheme(enabled);
  }

  function bindToggle() {
    const toggles = Array.from(document.querySelectorAll(toggleSelector));
    if (!toggles.length) {
      return;
    }

    toggles.forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const enabled = document.documentElement.getAttribute(themeAttribute) !== 'high-contrast';
        applyTheme(enabled);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindToggle();
      initTheme();
    });
  } else {
    bindToggle();
    initTheme();
  }
})();
