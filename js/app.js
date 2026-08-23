/**
 * app.js
 * ---------------------------------------------------------------
 * Bootstraps the whole hub: nav switching, toolbar wiring, the
 * "More Features" preference system, and the map/list split for the
 * events stage. This is the last script loaded - every other module
 * is ready by the time DOMContentLoaded fires.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.app = (function () {
  var U = LIF.util;

  /* ================= events stage (map + online strip + list) ================= */
  function labelForFormat(id) {
    var f = LIF.FORMATS.find(function (x) { return x.id === id; });
    return f ? f.name : id;
  }

  function eventCardHtml(evt) {
    var aspect = U.getAspect(evt.aspect);
    var chakraClass = 'chakra-' + (aspect ? aspect.chakra : 'heart');
    var locked = evt.visibility === 'organization';
    var title = locked ? evt.host + ' members-only event' : evt.title;
    var summary = locked ? 'Sign in to see full details.' : evt.summary;
    return '<div class="event-card ' + chakraClass + '" data-open-event="' + evt.id + '" role="button" tabindex="0">' +
      '<div class="event-card-aspect">' + (aspect ? U.escapeHtml(aspect.name) : '') + '</div>' +
      '<div class="event-card-title">' + U.escapeHtml(title) + '</div>' +
      '<div class="event-card-meta">' + U.escapeHtml(U.formatDateRange(evt.start)) + '</div>' +
      '<div class="event-card-summary">' + U.escapeHtml(summary) + '</div>' +
      '<div class="event-card-tags"><span class="badge">' + labelForFormat(evt.format) + '</span>' +
      (locked ? '<span class="badge badge--lock">Members only</span>' : '') + '</div>' +
      '</div>';
  }

  function bindCardOpens(container) {
    U.$all('[data-open-event]', container).forEach(function (card) {
      card.addEventListener('click', function () { LIF.eventDetail.open(card.dataset.openEvent); });
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter') LIF.eventDetail.open(card.dataset.openEvent); });
    });
  }

  function emptyStateHtml() {
    return '<div class="empty-state"><h3>No events match yet</h3><p>Try widening a filter, or clear them to see everything.</p></div>';
  }

  function renderEventsStage(filtered) {
    var mapWrap = U.$('#mapWrap'), onlineStrip = U.$('#onlineStrip'), cardGrid = U.$('#cardGrid');

    if (LIF.state.eventViewMode === 'list') {
      mapWrap.classList.add('hidden');
      onlineStrip.classList.add('hidden');
      cardGrid.classList.remove('hidden');
      cardGrid.innerHTML = filtered.length ? filtered.map(eventCardHtml).join('') : emptyStateHtml();
      bindCardOpens(cardGrid);
      return;
    }

    cardGrid.classList.add('hidden');
    mapWrap.classList.remove('hidden');
    LIF.mapModule.render(filtered);
    LIF.mapModule.invalidateSize();

    var onlineEvents = filtered.filter(function (e) { return e.format === 'online'; });
    if (onlineEvents.length) {
      onlineStrip.classList.remove('hidden');
      var row = U.$('#onlineStripRow');
      row.innerHTML = onlineEvents.map(eventCardHtml).join('');
      bindCardOpens(row);
    } else {
      onlineStrip.classList.add('hidden');
    }
  }

  function refreshEvents() {
    var filtered = LIF.filters.getFilteredEvents();
    syncToolbarUI();
    if (LIF.state.activeView === 'events') renderEventsStage(filtered);
    else if (LIF.state.activeView === 'calendar') LIF.calendarView.render(filtered);
  }

  /* ================= toolbar ================= */
  function syncToolbarUI() {
    var f = LIF.state.filters;
    var searchInput = U.$('#searchInput');
    if (searchInput && searchInput.value !== f.search) searchInput.value = f.search;
    U.$all('.format-chip').forEach(function (chip) { chip.classList.toggle('is-active', chip.dataset.format === f.format); });
    U.$all('.view-toggle button').forEach(function (btn) { btn.classList.toggle('is-active', btn.dataset.mode === LIF.state.eventViewMode); });
    var forMeChip = U.$('#forMeChip');
    if (forMeChip) forMeChip.classList.toggle('is-active', f.forMeOnly);
    var count = LIF.filters.countActive();
    var countEl = U.$('#filtersCount');
    if (countEl) { countEl.textContent = String(count); countEl.classList.toggle('hidden', count === 0); }
  }

  function bindToolbar() {
    var searchInput = U.$('#searchInput');
    searchInput.addEventListener('input', U.debounce(function () {
      LIF.state.filters.search = searchInput.value;
      refreshEvents();
    }, 250));

    U.$all('.format-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        LIF.state.filters.format = chip.dataset.format;
        if (chip.dataset.format === 'online') LIF.state.eventViewMode = 'list';
        syncToolbarUI();
        refreshEvents();
      });
    });

    U.$all('.view-toggle button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        LIF.state.eventViewMode = btn.dataset.mode;
        syncToolbarUI();
        refreshEvents();
      });
    });

    U.$('#forMeChip').addEventListener('click', function () {
      LIF.state.filters.forMeOnly = !LIF.state.filters.forMeOnly;
      syncToolbarUI();
      refreshEvents();
    });

    U.$('#filtersToggleBtn').addEventListener('click', function () { toggleFilterDrawer(); });
  }

  /* ================= drawer / dashboard toggles ================= */
  function toggleFilterDrawer(forceState) {
    var el = U.$('#filterDrawer');
    var show = forceState != null ? forceState : el.classList.contains('hidden');
    if (show) LIF.filters.renderDrawer();
    el.classList.toggle('hidden', !show);
  }

  function toggleDashboard(forceState) {
    var el = U.$('#dashboardSidebar');
    var show = forceState != null ? forceState : el.classList.contains('hidden');
    el.classList.toggle('hidden', !show);
    U.$('#dashboardToggleBtn').classList.toggle('is-on', show);
    if (show) LIF.dashboard.render();
    LIF.mapModule.invalidateSize();
  }

  /* ================= nav / views ================= */
  var VIEW_RENDERERS = {
    people: function () { LIF.directory.renderPeople(); },
    groups: function () { LIF.directory.renderGroups(); },
    organizations: function () { LIF.directory.renderOrganizations(); },
    opportunities: function () { LIF.directory.renderOpportunities(); },
    calendar: function () { LIF.calendarView.render(LIF.filters.getFilteredEvents()); },
    events: function () { refreshEvents(); }
  };

  function setView(name) {
    LIF.state.activeView = name;
    U.$all('.nav-item[data-view]').forEach(function (btn) { btn.classList.toggle('is-active', btn.dataset.view === name); });
    U.$all('.view').forEach(function (section) { section.classList.toggle('hidden', section.dataset.view !== name); });
    if (VIEW_RENDERERS[name]) VIEW_RENDERERS[name]();
    if (name === 'events') LIF.mapModule.invalidateSize();
  }

  /* ================= "More Features" preferences ================= */
  function applyPreferences() {
    var prefs = LIF.state.preferences;
    U.$all('[data-feature]').forEach(function (node) {
      node.classList.toggle('hidden', !prefs[node.dataset.feature]);
    });

    var fallbackViews = ['calendar', 'people', 'groups', 'organizations', 'opportunities'];
    if (fallbackViews.indexOf(LIF.state.activeView) !== -1 && !prefs[LIF.state.activeView]) {
      setView('events');
    }
    if (!prefs.dashboard) toggleDashboard(false);
    if (!prefs.advancedFilters) toggleFilterDrawer(false);

    var anyOn = Object.keys(prefs).some(function (k) { return prefs[k]; });
    U.$('#moreFeaturesBtn').classList.toggle('is-on', anyOn);
  }

  /* ================= init ================= */
  function init() {
    U.$all('.nav-item[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () { setView(btn.dataset.view); });
    });
    U.$('#moreFeaturesBtn').addEventListener('click', function () { LIF.customize.open(); });
    U.$('#loginBtn').addEventListener('click', function () { window.location.href = 'login.html'; });    U.$('#dashboardToggleBtn').addEventListener('click', function () { toggleDashboard(); });

    bindToolbar();
    LIF.filters.renderAspectWheel();
    LIF.eventDetail.init();
    LIF.customize.init();
    applyPreferences();
    syncToolbarUI();
    setView('events');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    setView: setView, refreshEvents: refreshEvents, applyPreferences: applyPreferences,
    toggleFilterDrawer: toggleFilterDrawer, toggleDashboard: toggleDashboard, syncToolbarUI: syncToolbarUI
  };
})();
