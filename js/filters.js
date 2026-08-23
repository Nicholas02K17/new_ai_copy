/**
 * filters.js
 * ---------------------------------------------------------------
 * Everything about narrowing down the event list: the radial Aspect
 * Wheel, the full filter drawer (behind "Advanced Filters" in More
 * Features), and the pure function that turns LIF.state.filters into
 * a filtered array. app.js calls getFilteredEvents() and hands the
 * result to whichever view is currently on screen.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.filters = (function () {
  var U = LIF.util;

  /* ================= Aspect wheel (the LiF flower logo, clickable) =================
     A recreation of your flower-of-life logo's seven circles rather than
     an embedded image, so each circle can be its own clickable filter
     region - same click-to-filter behavior as before, new shape. Position
     and color per circle come straight from your logo file and its notes:
     centre = Divine Human Potential (purple); the six petals sit at the
     compass position their own notes describe (top/upper-right/lower-
     right/bottom/lower-left/upper-left). */
  var WHEEL_ANGLES = {
    'presence-being': -90,        // top
    'engagement-communion': -30,  // upper-right
    'nature-nurture': 30,         // lower-right
    'community-inclusion': 90,    // bottom
    'service-offerings': 150,     // lower-left
    'source-resources': 210       // upper-left
    // 'divine-potential' is the centre circle - no angle, handled below.
  };

  function polar(cx, cy, r, angleDeg) {
    var rad = angleDeg * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function renderAspectWheel() {
    var slot = U.$('#aspectWheelSlot');
    if (!slot) return;
    var cx = 32, cy = 32, r = 15.5;
    var active = LIF.state.filters.aspects;
    // Draw the centre circle (Divine Human Potential) last so its full
    // disc stays clickable rather than being covered by the six petals.
    var ordered = LIF.ASPECTS.slice().sort(function (a, b) {
      return (a.id === 'divine-potential' ? 1 : 0) - (b.id === 'divine-potential' ? 1 : 0);
    });
    var circles = ordered.map(function (a) {
      var angle = WHEEL_ANGLES[a.id];
      var center = (angle == null) ? { x: cx, y: cy } : polar(cx, cy, r, angle);
      var isActive = active.indexOf(a.id) !== -1;
      var isDimmed = active.length > 0 && !isActive;
      var cls = 'wheel-circle chakra-' + a.chakra + (isActive ? ' is-active' : '') + (isDimmed ? ' is-dimmed' : '');
      var label = a.name + (a.tagline ? ' (' + a.tagline + ')' : '');
      return '<circle class="' + cls + '" cx="' + center.x.toFixed(2) + '" cy="' + center.y.toFixed(2) + '" r="' + r +
        '" data-aspect="' + a.id + '"><title>' + U.escapeHtml(label + (a.description ? ' - ' + a.description : '')) + '</title></circle>';
    }).join('');
    slot.innerHTML = '<svg class="aspect-wheel" viewBox="0 0 64 64" role="img" aria-label="Filter events by LiF Aspect - click a circle">' + circles + '</svg>';
    slot.querySelector('svg').addEventListener('click', function (e) {
      var circle = e.target.closest('[data-aspect]');
      if (!circle) return;
      toggleValue('aspects', circle.getAttribute('data-aspect'));
      renderAspectWheel();
      renderDrawer();
      LIF.app.refreshEvents();
    });
  }

  /* ================= shared helpers ================= */
  function toggleValue(key, value) {
    var arr = LIF.state.filters[key];
    var idx = arr.indexOf(value);
    if (idx === -1) arr.push(value); else arr.splice(idx, 1);
  }

  function checkboxGroup(label, key, options, openByDefault) {
    var current = LIF.state.filters[key];
    var rows = options.map(function (opt) {
      var id = typeof opt === 'string' ? opt : opt.id;
      var name = typeof opt === 'string' ? opt : opt.name;
      var checked = current.indexOf(id) !== -1 ? 'checked' : '';
      return '<label class="filter-checkbox"><input type="checkbox" data-filter-key="' + key + '" value="' + U.escapeHtml(id) + '" ' + checked + '> ' + U.escapeHtml(name) + '</label>';
    }).join('');
    return '<details class="filter-group"' + (openByDefault ? ' open' : '') + '><summary>' + label + '</summary><div class="filter-options">' + rows + '</div></details>';
  }

  function forMeToggleHtml() {
    var checked = LIF.state.filters.forMeOnly ? 'checked' : '';
    return '<label class="toggle-row" style="border-bottom:2px solid var(--line-strong);padding-bottom:16px;margin-bottom:12px;cursor:pointer;">' +
      '<span><span class="toggle-row-label">For me</span><br><span class="toggle-row-desc">Match ' + U.escapeHtml(LIF.CURRENT_MEMBER.name) + '\u2019s profile interests</span></span>' +
      '<span class="switch"><input type="checkbox" id="forMeToggle" ' + checked + '><span class="switch-track"></span><span class="switch-thumb"></span></span>' +
      '</label>';
  }

  function dateGroupHtml() {
    var f = LIF.state.filters;
    var options = [
      ['any', 'Any time'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['this-week', 'This Week'],
      ['this-weekend', 'This Weekend'], ['next-week', 'Next Week'], ['this-month', 'This Month'], ['custom', 'Custom range']
    ];
    var opts = options.map(function (o) { return '<option value="' + o[0] + '"' + (f.date === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    var customRow = f.date === 'custom'
      ? '<div style="display:flex;gap:8px;margin-top:8px;"><input type="date" id="customDateStart" value="' + (f.customDateStart || '') + '" style="flex:1;padding:6px;border-radius:8px;border:1px solid var(--line-strong);"><input type="date" id="customDateEnd" value="' + (f.customDateEnd || '') + '" style="flex:1;padding:6px;border-radius:8px;border:1px solid var(--line-strong);"></div>'
      : '';
    return '<details class="filter-group" open><summary>Date</summary>' +
      '<select id="dateFilterSelect" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);margin-top:6px;">' + opts + '</select>' +
      customRow + '</details>';
  }

  function radiusGroupHtml() {
    var f = LIF.state.filters;
    var anywhere = f.radiusKm == null;
    return '<details class="filter-group"><summary>Location</summary>' +
      '<label class="filter-checkbox"><input type="checkbox" id="radiusAnywhere" ' + (anywhere ? 'checked' : '') + '> Anywhere (ignore distance)</label>' +
      '<div class="range-row" style="' + (anywhere ? 'opacity:.4;pointer-events:none;' : '') + '">' +
      '<input type="range" id="radiusSlider" min="5" max="100" step="5" value="' + (f.radiusKm || 100) + '">' +
      '<span class="range-value" id="radiusValue">' + (f.radiusKm || 100) + ' km</span></div>' +
      '<button class="btn-text" id="useMyLocationBtn" type="button" style="padding-left:0;">Use my current location</button>' +
      '<div style="font-size:11px;color:var(--ink-faint);font-family:var(--font-mono);">' +
      (LIF.state.myLocation.isReal ? 'Using your device location' : 'Using a default reference point until you share yours') + '</div>' +
      '</details>';
  }

  function renderDrawer() {
    var container = U.$('#filterDrawer');
    if (!container) return;
    container.innerHTML =
      '<div class="panel-header"><h3 style="margin:0;">Filters</h3><button class="icon-btn" id="closeDrawerBtn" aria-label="Close filters"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>' +
      forMeToggleHtml() +
      checkboxGroup('Aspects', 'aspects', LIF.ASPECTS, true) +
      checkboxGroup('Sectors', 'sectors', LIF.SECTORS) +
      checkboxGroup('Event Type', 'types', LIF.EVENT_TYPES, true) +
      dateGroupHtml() +
      checkboxGroup('Time of Day', 'time', [{ id: 'morning', name: 'Morning' }, { id: 'afternoon', name: 'Afternoon' }, { id: 'evening', name: 'Evening' }, { id: 'night', name: 'Night' }]) +
      radiusGroupHtml() +
      checkboxGroup('Session Duration', 'durations', LIF.DURATIONS) +
      checkboxGroup('Event Commitment', 'commitments', LIF.COMMITMENTS) +
      checkboxGroup('Cost Structure', 'costs', LIF.COSTS) +
      checkboxGroup('Language', 'languages', LIF.LANGUAGES) +
      '<div class="filter-drawer-footer"><button class="btn-secondary" id="clearFiltersBtn" type="button">Clear all filters</button></div>';
    bindDrawerEvents(container);
  }

  function bindDrawerEvents(container) {
    container.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('[data-filter-key]')) {
        toggleValue(t.dataset.filterKey, t.value);
        if (t.dataset.filterKey === 'aspects') renderAspectWheel();
        LIF.app.refreshEvents();
      } else if (t.id === 'forMeToggle') {
        LIF.state.filters.forMeOnly = t.checked;
        LIF.app.refreshEvents();
      } else if (t.id === 'dateFilterSelect') {
        LIF.state.filters.date = t.value;
        renderDrawer();
        LIF.app.refreshEvents();
      } else if (t.id === 'customDateStart') {
        LIF.state.filters.customDateStart = t.value; LIF.app.refreshEvents();
      } else if (t.id === 'customDateEnd') {
        LIF.state.filters.customDateEnd = t.value; LIF.app.refreshEvents();
      } else if (t.id === 'radiusAnywhere') {
        LIF.state.filters.radiusKm = t.checked ? null : 100;
        renderDrawer(); LIF.app.refreshEvents();
      } else if (t.id === 'radiusSlider') {
        LIF.state.filters.radiusKm = +t.value;
        U.$('#radiusValue').textContent = t.value + ' km';
        LIF.app.refreshEvents();
      }
    });
    container.addEventListener('input', function (e) {
      if (e.target.id === 'radiusSlider') U.$('#radiusValue').textContent = e.target.value + ' km';
    });
    container.addEventListener('click', function (e) {
      if (e.target.id === 'clearFiltersBtn') clearAllFilters();
      if (e.target.id === 'useMyLocationBtn') requestMyLocation();
      if (e.target.closest('#closeDrawerBtn')) LIF.app.toggleFilterDrawer(false);
    });
  }

  function requestMyLocation() {
    if (!navigator.geolocation) { U.showToast('Location is not available in this browser.'); return; }
    U.showToast('Requesting your location\u2026');
    navigator.geolocation.getCurrentPosition(function (pos) {
      LIF.state.myLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, isReal: true };
      U.showToast('Using your current location for the distance filter.');
      renderDrawer();
      LIF.app.refreshEvents();
    }, function () {
      U.showToast('Could not get your location - using the default reference point.');
    });
  }

  function clearAllFilters() {
    LIF.state.filters = {
      search: '', aspects: [], sectors: [], format: 'all', types: [], date: 'any',
      customDateStart: null, customDateEnd: null, time: [], radiusKm: null,
      durations: [], commitments: [], costs: [], languages: [], forMeOnly: false
    };
    renderAspectWheel();
    renderDrawer();
    LIF.app.syncToolbarUI();
    LIF.app.refreshEvents();
  }

  function countActive() {
    var f = LIF.state.filters;
    return f.aspects.length + f.sectors.length + f.types.length + (f.format !== 'all' ? 1 : 0) +
      (f.date !== 'any' ? 1 : 0) + f.time.length + (f.radiusKm != null ? 1 : 0) + f.durations.length +
      f.commitments.length + f.costs.length + f.languages.length + (f.forMeOnly ? 1 : 0);
  }

  /* ================= filtering logic ================= */
  function durationBucketId(minutes) {
    if (minutes == null) return null;
    if (minutes <= 60) return 'upto-1h';
    if (minutes <= 120) return '2h';
    if (minutes <= 180) return '3h';
    if (minutes <= 300) return 'half-day';
    return 'full-day';
  }

  function eventDayUTC(evt) {
    var p = U.parseIsoParts(evt.start);
    return new Date(Date.UTC(p.year, p.month - 1, p.day));
  }

  function todayUTC() {
    var now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  function matchesDate(evt, f) {
    if (f.date === 'any') return true;
    var evtDay = eventDayUTC(evt);
    var today = todayUTC();
    var diffDays = Math.round((evtDay - today) / 86400000);
    var dow = evtDay.getUTCDay();
    if (f.date === 'today') return diffDays === 0;
    if (f.date === 'tomorrow') return diffDays === 1;
    if (f.date === 'this-week') return diffDays >= 0 && diffDays <= 6;
    if (f.date === 'this-weekend') return diffDays >= 0 && diffDays <= 6 && (dow === 0 || dow === 6);
    if (f.date === 'next-week') return diffDays >= 7 && diffDays <= 13;
    if (f.date === 'this-month') {
      var now = new Date();
      var p = U.parseIsoParts(evt.start);
      return diffDays >= 0 && p.year === now.getFullYear() && p.month === now.getMonth() + 1;
    }
    if (f.date === 'custom') {
      if (!f.customDateStart || !f.customDateEnd) return true;
      var s = new Date(f.customDateStart + 'T00:00:00Z');
      var e = new Date(f.customDateEnd + 'T00:00:00Z');
      return evtDay >= s && evtDay <= e;
    }
    return true;
  }

  function getFilteredEvents() {
    var f = LIF.state.filters;
    var member = LIF.CURRENT_MEMBER;
    return LIF.EVENTS.filter(function (evt) {
      if (f.search) {
        var q = f.search.toLowerCase();
        var hay = (evt.title + ' ' + evt.summary + ' ' + evt.host + ' ' + (evt.tags || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (f.aspects.length && f.aspects.indexOf(evt.aspect) === -1) return false;
      if (f.sectors.length && f.sectors.indexOf(evt.sector) === -1) return false;
      if (f.format !== 'all' && evt.format !== f.format) return false;
      if (f.types.length && f.types.indexOf(evt.type) === -1) return false;
      if (f.commitments.length && f.commitments.indexOf(evt.commitment) === -1) return false;
      if (f.costs.length && f.costs.indexOf(evt.cost) === -1) return false;
      if (f.languages.length && f.languages.indexOf(evt.language) === -1) return false;
      if (f.time.length && f.time.indexOf(U.timeOfDayBucket(evt.start)) === -1) return false;
      if (f.durations.length) {
        var bucket = durationBucketId(U.durationMinutes(evt.start, evt.end));
        if (f.durations.indexOf(bucket) === -1) return false;
      }
      if (!matchesDate(evt, f)) return false;
      if (f.radiusKm != null && evt.location) {
        var dist = U.haversineKm(LIF.state.myLocation.lat, LIF.state.myLocation.lng, evt.location.lat, evt.location.lng);
        if (dist > f.radiusKm) return false;
      }
      if (f.forMeOnly) {
        var matches = member.interestedAspects.indexOf(evt.aspect) !== -1 || member.interestedSectors.indexOf(evt.sector) !== -1;
        if (!matches) return false;
      }
      return true;
    });
  }

  return {
    renderAspectWheel: renderAspectWheel, renderDrawer: renderDrawer, clearAllFilters: clearAllFilters,
    countActive: countActive, getFilteredEvents: getFilteredEvents
  };
})();
