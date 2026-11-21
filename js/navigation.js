const VALID_SECTIONS = new Set(['home', 'forecast', 'map', 'favorites']);

export function initNavigation(onSectionChange) {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggleBtn');

  if (sidebar && toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('is-collapsed');
    });
  }

  document.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-section');
      if (target) switchSection(target, onSectionChange);
    });
  });

  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-goto');
      if (target) switchSection(target, onSectionChange);
    });
  });
}

export function switchSection(sectionName, onSectionChange) {
  const target = VALID_SECTIONS.has(sectionName) ? sectionName : 'home';

  document.querySelectorAll('.section-view').forEach((sec) => {
    const isMatch = sec.getAttribute('data-view') === target;
    sec.hidden = !isMatch;
    sec.classList.toggle('is-active', isMatch);
  });

  document.querySelectorAll('[data-section]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-section') === target);
  });

  if (typeof onSectionChange === 'function') {
    onSectionChange(target);
  }
}
