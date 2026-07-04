(function() {
  document.addEventListener('focusin', function(e) {
    var el = e.target;
    if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search')) {
      var section = el.closest('.ideas-filters, .projects-filters, .surveys-filters');
      if (!section) section = el.closest('.filter-controls');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.filter-buttons > .filter-btn');
    if (btn) {
      btn.closest('.filter-buttons').querySelectorAll('.filter-btn').forEach(function(b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    }
  });
})();
