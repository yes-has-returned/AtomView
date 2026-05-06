const sidebar = document.getElementById('sidebar');
const btn = document.getElementById('toggle-btn');
const arrow = document.getElementById('arrow');

const rightSidebar = document.getElementById('right-sidebar');
const rightBtn = document.getElementById('right-toggle-btn');
const rightArrow = document.getElementById('right-arrow');

btn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  
  if (sidebar.classList.contains('collapsed')) {
    arrow.innerText = '▶'; // Point toward the screen when hidden
  } else {
    arrow.innerText = '◀'; // Point toward the wall when visible
  }
});

rightBtn.addEventListener('click', () => {
  rightSidebar.classList.toggle('collapsed');
  rightArrow.classList.toggle('rotated');
});