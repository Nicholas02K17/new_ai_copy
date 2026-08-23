/**
 * groupsHub.js
 * ---------------------------------------------------------------
 * The Groups landing and discovery screen — §3 of the Groups Human
 * Mapping. It replaces the old one-line Groups grid, which offered
 * a "Join group" button the doc explicitly rules out.
 *
 *   My Groups      — what you belong to, follow, have asked to join,
 *                    or have been invited to. All four, because the
 *                    doc lists all four.
 *   Explore Groups — only what this viewer is authorized to discover.
 *
 * The filters are §3.2's list. Two of its rules are easy to get
 * wrong and are handled explicitly:
 *
 *   - "For Me ... never blocks broader search." It is a toggle over
 *     the results, not a mode that hides the rest of the interface.
 *   - "online-only Groups are not forced into a physical-distance
 *     filter." A distance filter narrows located Groups and leaves
 *     online ones alone rather than silently dropping them.
 *
 * Match explanations are visibility-safe: they are built only from
 * the viewer's own preferences and the Group's published fields, so
 * an unpublished field can never leak through a "why this matched".
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.groupsHub = (function () {
  var U = LIF.util;
  var h = U.escapeHtml;
  var G = LIF.groups;

  var tab = 'explore';        // mine | explore
  var showFilters = false;
  var viewMode = 'cards';     // cards | map
  var mapObj = null, markers = [];

  var f = {
    q: '', sectors: [], subsectors: [], formats: [], languages: [],
    structures: [], access: [], states: [], radiusKm: null, forMe: false
  };

  /* =========================================================
   * 1. THE GROUP CARD (§4.1)
   * Every field in the doc's card table, and one primary action.
   * ======================================================= */
  function card(g, why) {
    var sector = U.getSector(g.sector);
    var action = G.primaryAction(g);
    var km = g.location && g.location.lat != null ? G.distanceKm(g.location.lat, g.location.lng) : null;

    return '<article class="gcard" data-group="' + h(g.id) + '">' +
      '<a class="gcard-link" href="group.html?id=' + h(g.id) + '" aria-label="Open ' + h(g.name) + '">' +
        '<div class="gcard-cover" style="background:' + G.coverCss(g) + '"></div>' +
        '<div class="gcard-body">' +
          '<h4>' + h(g.name) + '</h4>' +
          '<p class="gcard-desc">' + h(g.description) + '</p>' +
          '<div class="gcard-tags">' +
            '<span class="gbadge gbadge--state g-state-' + h(g.status) + '">' + h(G.stateMeta(g.status).name) + '</span>' +
            (sector ? '<span class="gbadge">' + h(sector.name) + '</span>' : '') +
            (g.subsector ? '<span class="gbadge">' + h(g.subsector) + '</span>' : '') +
            '<span class="gbadge">' + h(G.structureMeta(g.structure).name) + '</span>' +
            '<span class="gbadge">' + h(g.format) +
              (g.location && g.location.city ? ' · ' + h(g.location.city) : '') +
              (km != null && isFinite(km) ? ' · ' + Math.round(km) + ' km' : '') + '</span>' +
            '<span class="gbadge">' + h(g.languages.primary) + '</span>' +
            (g.access.discoverability === 'private' ? '<span class="gbadge gbadge--lock">Private</span>' : '') +
          '</div>' +
          (g.activityPlan ? '<p class="gcard-alive"><strong>Alive now:</strong> ' + h(g.activityPlan) + '</p>' : '') +
          (why && why.length ? '<p class="gcard-why">' + h(why.join(' · ')) + '</p>' : '') +
        '</div>' +
      '</a>' +
      '<div class="gcard-foot">' +
        '<span class="gcard-count">' + h(G.countLabel(g)) +
          (G.capacityNote(g) ? ' · ' + h(G.capacityNote(g)) : '') + '</span>' +
        actionButton(g, action) +
      '</div>' +
    '</article>';
  }

  /** One primary action per card, matching what will actually happen. */
  function actionButton(g, a) {
    if (!a.enabled) return '<span class="gcard-action is-off">' + h(a.label) + '</span>';
    if (a.id === 'signup') return '<a class="gcard-action" href="register.html">' + h(a.label) + '</a>';
    if (a.id === 'follow') {
      return '<button class="gcard-action" type="button" data-do="follow" data-value="' + h(g.id) + '">' +
        h(G.isFollowing(g.id) ? '✓ Following' : a.label) + '</button>';
    }
    /* Everything else routes to the one authoritative Group Details
       record rather than trying to act from the card. */
    return '<a class="gcard-action" href="group.html?id=' + h(g.id) + '">' + h(a.label) + '</a>';
  }

  /* =========================================================
   * 2. MY GROUPS (§3.1)
   * ======================================================= */
  function mineBody() {
    var joined = G.myGroups();
    var invites = G.myInvitations();
    var requests = G.myRequests();
    var follows = G.myFollows();
    var proposals = G.proposals().concat(G.drafts());

    if (!joined.length && !invites.length && !requests.length && !follows.length && !proposals.length) {
      return '<div class="g-empty"><h4>You are not in any Groups yet</h4>' +
        '<p>Explore what is here, or propose the Group you wish existed.</p>' +
        '<div class="g-row"><button class="g-btn g-btn--primary" type="button" data-do="tab" data-value="explore">Explore Groups</button>' +
        '<button class="g-btn g-btn--ghost" type="button" data-propose-group>Propose a Group</button></div></div>';
    }

    return (invites.length
      ? section('Invitations', invites.map(function (x) {
          return '<article class="g-invite">' +
            '<div><strong>' + h(x.group.name) + '</strong>' +
              '<span class="gbadge">' + h(x.invitation.kind === 'direct' ? 'grants membership' : 'opens Request Access') + '</span>' +
              '<p class="g-hint">' + h(x.invitation.fromName) + ' — ' + h(x.invitation.message || '') + '</p></div>' +
            '<a class="g-btn g-btn--primary g-btn--sm" href="group.html?id=' + h(x.group.id) + '">Respond</a>' +
          '</article>';
        }).join(''))
      : '') +

      (requests.length
        ? section('Waiting on a steward', requests.map(function (x) {
            var st = x.request.status;
            return '<article class="g-invite">' +
              '<div><strong>' + h(x.group.name) + '</strong>' +
                '<span class="gbadge">' + h(st === 'waitlist' ? 'Waitlisted' : st === 'more-info' ? 'More information needed' : 'Request Pending') + '</span>' +
                (x.request.reviewerNote ? '<p class="g-hint">' + h(x.request.reviewerNote) + '</p>' : '') + '</div>' +
              '<div class="g-row">' +
                '<a class="g-btn g-btn--ghost g-btn--sm" href="group.html?id=' + h(x.group.id) + '">View</a>' +
                (st === 'pending' || st === 'more-info'
                  ? '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="withdraw" data-value="' + h(x.group.id) + '">Withdraw</button>'
                  : '') +
              '</div>' +
            '</article>';
          }).join(''))
        : '') +

      (joined.length ? section('Groups you belong to', grid(joined)) : '') +
      (follows.length ? section('Following', grid(follows)) : '') +

      (proposals.length
        ? section('Your proposals', proposals.map(function (p) {
            var pending = p.status === 'pending';
            return '<article class="g-invite">' +
              '<div><strong>' + h(p.name || 'Untitled proposal') + '</strong>' +
                '<span class="gbadge">' + h(pending ? 'Pending Review' : 'Draft') + '</span>' +
                (p.groupRef ? ' <span class="gbadge mono">' + h(p.groupRef) + '</span>' : '') +
                '<p class="g-hint">' + h(pending
                  ? 'With LiF. You may hear back with approval, changes requested, an offer of support, or a suggestion to connect with an existing Group.'
                  : 'Not submitted. Only you can see it.') + '</p></div>' +
              '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-propose-group>' +
                (pending ? 'Propose another' : 'Continue') + '</button>' +
            '</article>';
          }).join(''))
        : '');
  }

  function section(title, inner) {
    return '<section class="g-hub-section"><h3>' + h(title) + '</h3>' + inner + '</section>';
  }
  function grid(list) {
    return '<div class="gcard-grid">' + list.map(function (g) { return card(g); }).join('') + '</div>';
  }

  /* =========================================================
   * 3. EXPLORE (§3.2)
   * ======================================================= */
  function results() {
    var list = G.filter(f);
    /* Recommendations are sorted, but Quiet, Paused, Closing and
       Archived sink rather than being surfaced as active. */
    return list.sort(function (a, b) {
      var ra = G.recommendable(a) ? 0 : 1, rb = G.recommendable(b) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return G.matchReasons(b).length - G.matchReasons(a).length;
    });
  }

  function exploreBody() {
    var list = results();
    if (!list.length) {
      return '<div class="g-empty"><h4>Nothing matches yet</h4>' +
        '<p>Widen a filter, or clear them to see everything you are authorized to discover.</p>' +
        '<button class="g-btn g-btn--ghost" type="button" data-do="clear">Clear filters</button></div>';
    }
    if (viewMode === 'map') {
      var located = list.filter(function (g) { return g.location && g.location.lat != null; });
      var online = list.filter(function (g) { return !g.location || g.location.lat == null; });
      return '<div class="g-map" id="gHubMap"></div>' +
        (online.length
          ? '<section class="g-hub-section"><h3>Online-only Groups</h3>' +
            '<p class="g-hint">These have no place to pin. They are never dropped by a distance filter either.</p>' +
            grid(online) + '</section>'
          : '') +
        (!located.length ? '<p class="g-hint">None of these Groups have coordinates, so the map is empty.</p>' : '');
    }
    return '<p class="g-count">' + list.length + ' Group' + (list.length === 1 ? '' : 's') +
      (f.forMe ? ' matching what interests you' : '') + '</p>' +
      '<div class="gcard-grid">' + list.map(function (g) {
        return card(g, f.forMe || tab === 'explore' ? G.matchReasons(g) : null);
      }).join('') + '</div>';
  }

  /* =========================================================
   * 4. FILTER BAR
   * ======================================================= */
  function chips(label, key, options, current) {
    return '<div class="g-filter-group"><span class="g-filter-label">' + h(label) + '</span>' +
      '<div class="g-chips">' + options.map(function (o) {
        var on = current.indexOf(o.id) !== -1;
        return '<button type="button" class="g-chip' + (on ? ' is-on' : '') + '" ' +
          'data-do="toggle-filter" data-key="' + key + '" data-value="' + h(o.id) + '">' + h(o.name) + '</button>';
      }).join('') + '</div></div>';
  }

  function filterBar() {
    var active = countActive();
    return '<div class="g-toolbar">' +
      '<div class="g-tabs" role="tablist">' +
        '<button type="button" class="g-tab' + (tab === 'mine' ? ' is-on' : '') + '" data-do="tab" data-value="mine">' +
          'My Groups<span class="g-pip">' + (G.myGroups().length + G.myInvitations().length + G.myRequests().length) + '</span></button>' +
        '<button type="button" class="g-tab' + (tab === 'explore' ? ' is-on' : '') + '" data-do="tab" data-value="explore">' +
          'Explore<span class="g-pip">' + G.exploreGroups().length + '</span></button>' +
      '</div>' +

      '<div class="g-search">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<input type="search" id="gSearch" placeholder="Search Groups by name…" value="' + h(f.q) + '" aria-label="Search Groups">' +
      '</div>' +

      '<button type="button" class="g-chip' + (f.forMe ? ' is-on' : '') + '" data-do="for-me" ' +
        'title="Matches what interests you. It narrows the list — it never blocks the wider search.">For Me</button>' +

      '<div class="g-seg">' +
        '<button type="button" class="' + (viewMode === 'cards' ? 'is-on' : '') + '" data-do="view" data-value="cards">Cards</button>' +
        '<button type="button" class="' + (viewMode === 'map' ? 'is-on' : '') + '" data-do="view" data-value="map">Map</button>' +
      '</div>' +

      '<button type="button" class="g-btn g-btn--ghost g-btn--sm" data-do="filters">' +
        'Filters' + (active ? ' <span class="g-pip">' + active + '</span>' : '') + '</button>' +
      '<button type="button" class="g-btn g-btn--primary g-btn--sm" data-propose-group>Propose a Group</button>' +
    '</div>' +

    (showFilters
      ? '<div class="g-filters">' +
          chips('Interest / sector', 'sectors', LIF.SECTORS, f.sectors) +
          chips('Structure', 'structures', LIF.GROUP_STRUCTURES, f.structures) +
          chips('Format', 'formats', LIF.FORMATS, f.formats) +
          chips('Language', 'languages',
            LIF.LANGUAGES.map(function (l) { return { id: l, name: l }; }), f.languages) +
          chips('How you come in', 'access', LIF.GROUP_JOIN_METHODS, f.access) +
          chips('Current activity', 'states',
            LIF.GROUP_STATES.filter(function (s) { return !s.proposal; }), f.states) +
          '<div class="g-filter-group"><span class="g-filter-label">Distance</span>' +
            '<div class="g-chips">' + [10, 25, 50, 100, null].map(function (km) {
              var on = f.radiusKm === km;
              return '<button type="button" class="g-chip' + (on ? ' is-on' : '') + '" data-do="radius" data-value="' + (km == null ? '' : km) + '">' +
                (km == null ? 'Anywhere' : 'Within ' + km + ' km') + '</button>';
            }).join('') + '</div>' +
            '<p class="g-hint">Narrows Groups that have a place. Online-only Groups are never dropped by a distance filter.</p>' +
          '</div>' +
          '<button type="button" class="g-btn g-btn--ghost g-btn--sm" data-do="clear">Clear all</button>' +
        '</div>'
      : '');
  }

  function countActive() {
    var n = 0;
    ['sectors', 'structures', 'formats', 'languages', 'access', 'states'].forEach(function (k) { n += f[k].length; });
    if (f.radiusKm != null) n++;
    return n;
  }

  /* =========================================================
   * 5. RENDER
   * ======================================================= */
  function render() {
    var mount = U.$('#groupsGrid');
    if (!mount) return;
    mount.className = 'g-hub';
    mount.innerHTML = filterBar() +
      (tab === 'mine' ? mineBody() : exploreBody()) +
      (G.isGuest()
        ? '<p class="g-hint g-guest-note">You are browsing as a Guest. Public Group cards and approved public details are open to you; joining, requesting access or taking part needs a profile with the required I Am Here fields completed.</p>'
        : '');

    if (tab === 'explore' && viewMode === 'map') mountMap();
  }

  function mountMap() {
    if (typeof L === 'undefined') return;
    var node = document.getElementById('gHubMap');
    if (!node) return;
    if (mapObj) { mapObj.remove(); mapObj = null; markers = []; }
    mapObj = L.map(node, { scrollWheelZoom: false }).setView([30, -20], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapObj);

    var located = results().filter(function (g) { return g.location && g.location.lat != null; });
    located.forEach(function (g) {
      var m = L.marker([g.location.lat, g.location.lng]).addTo(mapObj);
      m.bindPopup('<strong>' + h(g.name) + '</strong><br>' + h(G.countLabel(g)) +
        '<br><a href="group.html?id=' + h(g.id) + '">Open Group Details →</a>');
      markers.push(m);
    });
    if (located.length) {
      mapObj.fitBounds(located.map(function (g) { return [g.location.lat, g.location.lng]; }), { padding: [40, 40], maxZoom: 9 });
    }
    setTimeout(function () { mapObj.invalidateSize(); }, 60);
  }

  /* =========================================================
   * 6. WIRING
   * ======================================================= */
  function onClick(e) {
    var el = e.target.closest('#groupsGrid [data-do]');
    if (!el) return;
    var v = el.dataset.value;
    switch (el.dataset.do) {
      case 'tab': tab = v; render(); return;
      case 'view': viewMode = v; render(); return;
      case 'filters': showFilters = !showFilters; render(); return;
      case 'for-me': f.forMe = !f.forMe; render(); return;
      case 'radius': f.radiusKm = v === '' ? null : +v; render(); return;
      case 'toggle-filter': {
        var arr = f[el.dataset.key];
        var i = arr.indexOf(v);
        if (i === -1) arr.push(v); else arr.splice(i, 1);
        render();
        return;
      }
      case 'clear':
        f = { q: f.q, sectors: [], subsectors: [], formats: [], languages: [],
              structures: [], access: [], states: [], radiusKm: null, forMe: false };
        render();
        return;
      case 'follow':
        U.showToast(G.toggleFollow(v) ? 'Following. You will hear when it opens or changes.' : 'No longer following.');
        render();
        return;
      case 'withdraw':
        G.withdrawRequest(v);
        U.showToast('Request withdrawn.');
        render();
        return;
    }
  }

  function init() {
    document.addEventListener('click', onClick);
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'gSearch') {
        f.q = e.target.value;
        clearTimeout(init._t);
        init._t = setTimeout(function () {
          render();
          var s = document.getElementById('gSearch');
          if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
        }, 200);
      }
    });
    document.addEventListener('lif:groupschange', function () {
      if (U.$('#groupsGrid') && !U.$('.view[data-view="groups"]').classList.contains('hidden')) render();
    });
    if (location.hash === '#groups' && LIF.app) {
      LIF.state.preferences.groups = true;
      LIF.app.applyPreferences();
      LIF.app.setView('groups');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { render: render };
})();
