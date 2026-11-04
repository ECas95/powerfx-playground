// Display a useful fallback if a module cannot be loaded (for example, a stale Pages deployment).
window.addEventListener('load',()=>{
  if(window.__powerFxLearningReady)return;
  const node=document.getElementById('lesson-list');
  if(node){const alert=document.createElement('p');alert.className='learn-placeholder';alert.textContent='Learning Lab could not initialize. Refresh the page (Ctrl+Shift+R), then check that learn.js, learn-core.js and lessons.js are available.';node.replaceChildren(alert);}
});
