// CSP-safe fallback when the main workbench bundle fails to initialize.
window.addEventListener('load', () => {
  if (window.__powerFxWorkbenchReady) return;
  const explorer = document.getElementById('examples');
  if (explorer) {
    const message = document.createElement('p');
    message.className = 'empty-hint load-failure';
    message.textContent = 'Unable to load the scenario library. Reload the page (Ctrl+Shift+R). If this continues, verify that workbench.js is available.';
    explorer.replaceChildren(message);
  }
  const count = document.getElementById('example-count');
  if (count) count.textContent = '!';
});
