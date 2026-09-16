/* ESTUFA 01 · theme.js — claro/escuro persistente + meta theme-color */
(function () {
  'use strict';
  var KEY = 'estufa_theme';
  var root = document.documentElement;

  function system() {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch (e) { return 'dark'; }
  }
  function current() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return root.getAttribute('data-theme') || system();
  }
  function paint(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#e9f2ea' : '#0b1810');
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
      b.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      var icon = b.querySelector('.theme-icon');
      if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
      var label = b.querySelector('.theme-label');
      if (label) label.textContent = theme === 'light' ? 'Claro' : 'Escuro';
      b.title = theme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro';
    });
  }
  function apply(theme) {
    paint(theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
  }
  window.EstufaTheme = {
    toggle: function () {
      apply(current() === 'light' ? 'dark' : 'light');
      try { window.dispatchEvent(new CustomEvent('theme:changed')); } catch (e) {}
    },
    apply: apply,
    current: current
  };
  paint(current());
  try {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
      try {
        if (!localStorage.getItem(KEY)) paint(system());
      } catch (e) {}
    });
  } catch (e) {}
})();
