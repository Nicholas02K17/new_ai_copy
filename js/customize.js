/**
 * customize.js
 * ---------------------------------------------------------------
 * The "build your own hub" panel. The site starts minimal (map +
 * basic search only) and each switch here reveals one more section.
 * app.js's applyPreferences() does the actual showing/hiding based
 * on LIF.state.preferences - this file just renders the switches.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.customize = (function () {
  var U = LIF.util;

  var FEATURES = [
    { key: 'dashboard', label: 'Personal dashboard', desc: 'A sidebar peek at your profile, events, groups and connections - the full version lives on its own page.' },
    { key: 'calendar', label: 'Master calendar', desc: 'See every event on one calendar.' },
    { key: 'people', label: 'People directory', desc: 'Browse and connect with other members.' },
    { key: 'groups', label: 'Groups', desc: 'Discover and join co-creation groups.' },
    { key: 'organizations', label: 'Organizations', desc: 'See partner organizations and their events.' },
    { key: 'opportunities', label: 'Get involved', desc: 'Volunteer, staff, and partnership opportunities.' },
    { key: 'advancedFilters', label: 'Advanced filters', desc: 'Show every filter - sectors, date, cost, language - instead of just the quick ones.' }
  ];

  /* The theme picker is shared with the dashboard and the event page
     (js/theme.js); this is only the doorway into it, showing the
     member's current ramp so the panel says what it does. */
  function themeRowHtml() {
    if (!LIF.theme) return '';
    var t = LIF.theme.get();
    var fam = t.palette === 'house' ? LIF.theme.house
      : LIF.theme.palettes.find(function (x) { return x.id === t.palette; });
    var paper = LIF.theme.papers.find(function (x) { return x.id === t.paper; });
    var ramp = fam.rows[Math.min(t.row, fam.rows.length - 1)];
    return '<button class="theme-row" type="button" data-theme-open>' +
      '<span class="theme-row-ramp">' + ramp.map(function (hex) {
        return '<i style="background:' + hex + '"></i>';
      }).join('') + '</span>' +
      '<span class="theme-row-copy">' +
        '<strong>Your theme: ' + U.escapeHtml(fam.name) + (t.row ? ' 2' : '') + '</strong>' +
        '<span>' + U.escapeHtml(paper.name.toLowerCase()) + ' paper' + (t.tint ? ', tinted' : '') + '</span>' +
      '</span>' +
      '<span class="theme-row-go">Change</span>' +
    '</button>';
  }

  function render() {
    var panel = U.$('#customizePanel');
    var prefs = LIF.state.preferences;
    panel.innerHTML =
      '<div class="panel-header"><h2 style="margin:0;font-size:1.375rem;">Customize your hub</h2>' +
      '<button class="icon-btn" id="closeCustomizeBtn" aria-label="Close customize panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>' +
      '<p class="panel-intro">The hub starts minimal: just the map and a basic search. Switch on whatever you actually want to see - it only affects your own view.</p>' +
      themeRowHtml() +
      FEATURES.map(function (f) {
        var checked = prefs[f.key] ? 'checked' : '';
        return '<label class="toggle-row">' +
          '<span><span class="toggle-row-label">' + f.label + '</span><br><span class="toggle-row-desc">' + f.desc + '</span></span>' +
          '<span class="switch"><input type="checkbox" data-feature-toggle="' + f.key + '" ' + checked + '>' +
          '<span class="switch-track"></span><span class="switch-thumb"></span></span>' +
          '</label>';
      }).join('');
    panel.querySelector('#closeCustomizeBtn').addEventListener('click', close);
    U.$all('[data-feature-toggle]', panel).forEach(function (input) {
      input.addEventListener('change', function () {
        LIF.state.preferences[input.dataset.featureToggle] = input.checked;
        LIF.app.applyPreferences();
      });
    });
  }

  function open() {
    render();
    U.$('#customizePanel').classList.remove('hidden');
    U.$('#scrimCustomize').classList.remove('hidden');
  }

  function close() {
    U.$('#customizePanel').classList.add('hidden');
    U.$('#scrimCustomize').classList.add('hidden');
  }

  function init() {
    U.$('#scrimCustomize').addEventListener('click', close);
    document.addEventListener('lif:themechange', function () {
      if (!U.$('#customizePanel').classList.contains('hidden')) render();
    });
  }

  return { open: open, close: close, init: init };
})();
