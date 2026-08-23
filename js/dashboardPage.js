/**
 * dashboardPage.js
 * ---------------------------------------------------------------
 * The Personal Dashboard.
 *
 * Three ideas hold the whole screen together:
 *
 *  1. ONE FEATURE REGISTRY. Every feature (Profile, Events, Groups,
 *     Playmates, Organizations, Opportunities, Commons, Resources)
 *     is a single entry in FEATURES below, carrying its icon, its
 *     colour, how to count it, and how to render its detail. Add a
 *     feature to that array and it appears in all three layouts, in
 *     the notification matrix, and in the Customize panel at once.
 *
 *  2. THREE LAYOUTS, ONE RENDERER. Constellation (cards ringing a
 *     central map/calendar), Cards (a plain grid), and Sidebar (a
 *     rail plus a detail pane) are the three display options the
 *     spec asks for. They share the same card renderer and the same
 *     detail renderer - only where the output is placed changes.
 *
 *  3. NOTHING IS PRECOMPUTED. "Suggestions", "new since last visit"
 *     and every count are derived at render time from
 *     MEMBER.preferences, MEMBER.privacy and MEMBER.lastVisit. Turn
 *     a sector off in Preferences and the suggestion counts on the
 *     cards change immediately - which is the point of the whole
 *     preferences system, and the fastest way to see it working.
 *
 * Actions that need a real server route through `pending()`, which
 * shows a toast naming what would happen. (utils.js's
 * backendPlaceholder() also opens a placeholder tab - fine on a
 * one-action page, far too disruptive on a dashboard where most
 * buttons are still stubs.)
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.dashboardPage = (function () {
  var U = LIF.util;
  var M = LIF.MEMBER;
  var $ = U.$, $all = U.$all, h = U.escapeHtml;

  /* view state that isn't part of the member's saved profile */
  var view = { feature: 'events', tab: null, drawerMode: null };
  var mapObj = null, connMapObj = null;
  var calendars = {};   // keyed by element id - the focus panel and the Events tab can both hold one

  /* =========================================================
   * 0. ICONS
   * ======================================================= */
  var ICONS = {
    profile:      '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.2 4-6.4 8-6.4s8 2.2 8 6.4"/>',
    events:       '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    groups:       '<circle cx="9" cy="9" r="3.4"/><path d="M2.5 20c0-3.3 3-5.2 6.5-5.2s6.5 1.9 6.5 5.2"/><path d="M17 8.2A3 3 0 0117 14M18.5 20c0-2 .6-3.7-1-4.8"/>',
    connections:  '<path d="M12 20.5S3.5 15.2 3.5 9.4A4.6 4.6 0 0112 7a4.6 4.6 0 018.5 2.4c0 5.8-8.5 11.1-8.5 11.1z"/>',
    organizations:'<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9.5 21v-5h5v5M9.5 11h1.5M13 11h1.5"/>',
    opportunities:'<path d="M12 2.5l2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.3 6.7 19.2l1.1-6.1L3.4 8.9l6-.8z"/>',
    commons:      '<path d="M12 21c0-6 3.5-10.5 8.5-11-0.3 5.8-3.8 9.6-8.5 11z"/><path d="M12 21c0-5-2.9-8.8-7-9.3.2 4.8 3.1 8 7 9.3z"/><path d="M12 21v-4"/>',
    resources:    '<path d="M4 4.5A1.5 1.5 0 015.5 3H11v17H5.5A1.5 1.5 0 014 18.5z"/><path d="M20 4.5A1.5 1.5 0 0018.5 3H13v17h5.5a1.5 1.5 0 001.5-1.5z"/>',
    bell:         '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
    bellOff:      '<path d="M18 8a6 6 0 00-9.3-5M5.5 5.5A6 6 0 006 8c0 7-3 9-3 9h13"/><path d="M13.7 21a2 2 0 01-3.4 0"/><path d="M3 3l18 18"/>',
    arrow:        '<path d="M5 12h13M13 6l6 6-6 6"/>',
    lock:         '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 018 0v3.5"/>',
    check:        '<path d="M20 6L9 17l-5-5"/>',
    info:         '<circle cx="12" cy="12" r="9.2"/><path d="M12 11v5.5M12 7.6v.9"/>',
    bookmark:     '<path d="M6 3.5h12v17l-6-4.2-6 4.2z"/>',
    close:        '<path d="M18 6L6 18M6 6l12 12"/>',
    spark:        '<path d="M12 4.5l1.6 4.2 4.2 1.6-4.2 1.6L12 16.1l-1.6-4.2L6.2 10.3l4.2-1.6z"/>',
    pin:          '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>'
  };
  function svg(name, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"' +
      (extra || '') + '>' + (ICONS[name] || '') + '</svg>';
  }

  /* =========================================================
   * 1. THE FEATURE REGISTRY
   * Each entry knows its own counts and its own detail body.
   * ======================================================= */
  var FEATURES = [
    { key: 'profile',       name: 'Profile',       blurb: 'Who the playground sees' },
    { key: 'events',        name: 'Events',        blurb: 'What you are going to' },
    { key: 'groups',        name: 'Groups',        blurb: 'Circles you belong to' },
    { key: 'connections',   name: 'Playmates',     blurb: 'People you co-create with' },
    { key: 'commons',       name: 'Commons',       blurb: 'What we tend together' },
    { key: 'resources',     name: 'Resources',     blurb: 'Saved and suggested' },
    { key: 'opportunities', name: 'Opportunities', blurb: 'Ways to get involved' },
    { key: 'organizations', name: 'Organizations', blurb: 'Your verified memberships' }
  ];

  function feature(key) { return FEATURES.find(function (f) { return f.key === key; }); }

  /* Organizations only exists for members with a verified partner
     membership - the spec is explicit that it otherwise shouldn't
     appear at all. Everything else is the member's own choice. */
  function isAvailable(key) {
    if (key === 'organizations') return M.organizations.verified.length > 0;
    return true;
  }
  function visibleFeatures() {
    return FEATURES.filter(function (f) { return isAvailable(f.key) && M.dashboard.visibleFeatures[f.key] !== false; });
  }

  /* =========================================================
   * 2. DERIVATIONS - suggestions, "new since last visit", counts
   * ======================================================= */
  function ts(iso) { return iso ? new Date(iso).getTime() : 0; }
  function lastVisitTs() { return ts(M.lastVisit); }

  function relTime(iso) {
    var diff = Date.now() - ts(iso);
    var past = diff >= 0;
    var mins = Math.round(Math.abs(diff) / 60000);
    var out;
    if (mins < 60) out = mins + (mins === 1 ? ' minute' : ' minutes');
    else if (mins < 1440) { var hrs = Math.round(mins / 60); out = hrs + (hrs === 1 ? ' hour' : ' hours'); }
    else if (mins < 43200) { var d = Math.round(mins / 1440); out = d + (d === 1 ? ' day' : ' days'); }
    else { var mo = Math.round(mins / 43200); out = mo + (mo === 1 ? ' month' : ' months'); }
    return past ? out + ' ago' : 'in ' + out;
  }

  function kmFromMember(lat, lng) {
    if (lat == null || lng == null) return null;
    return U.haversineKm(M.lat, M.lng, lat, lng);
  }

  /* One matcher for everything. Returns null when nothing lines up,
     otherwise a score plus the human-readable reasons - the reasons
     are shown on the card as "why you're seeing this", because a
     recommendation nobody can explain is just noise.

     Only three signals are STRONG enough to justify a suggestion on
     their own: the sector, the subsector, and being inside your
     radius. Language and "it's online" are tie-breakers that raise
     an already-relevant item, never reasons in themselves - or the
     Suggested tab quietly fills up with everything in English. */
  function match(item, opts) {
    opts = opts || {};
    var p = M.preferences, score = 0, why = [], strong = false;

    if (item.sector && p.sectors.indexOf(item.sector) !== -1) {
      score += 3; strong = true;
      var s = U.getSector(item.sector);
      why.push(s ? s.name + ' is one of your sectors' : 'sector match');
    }
    if (item.subsector && p.subsectors.indexOf(item.subsector) !== -1) {
      score += 2; strong = true;
      why.push(item.subsector + ' is one of your subsectors');
    }

    var lat = opts.lat != null ? opts.lat : (item.location ? item.location.lat : item.lat);
    var lng = opts.lng != null ? opts.lng : (item.location ? item.location.lng : item.lng);
    var km = kmFromMember(lat, lng);
    if (km != null && km <= p.radiusKm) {
      score += 2; strong = true;
      why.push(Math.round(km) + ' km away, inside your ' + p.radiusKm + ' km radius');
    } else if (item.format === 'online' || item.location === null) {
      score += 1;
      why.push('online, so distance is no barrier');
    }

    if (item.language && p.languages.indexOf(item.language) !== -1) score += 1;

    return strong ? { score: score, why: why } : null;
  }

  function canSuggest() { return M.privacy.recommendations; }

  function suggestedEvents() {
    if (!canSuggest() || !M.preferences.wantEvents) return [];
    var taken = M.events.registered.concat(M.events.bookmarked);
    return LIF.EVENTS
      .filter(function (e) { return taken.indexOf(e.id) === -1 && isVisibleToMember(e); })
      .map(function (e) { var m = match(e); return m ? { item: e, match: m } : null; })
      .filter(Boolean)
      .sort(function (a, b) { return b.match.score - a.match.score; });
  }

  function suggestedGroups() {
    if (!canSuggest() || !M.preferences.wantGroups) return [];
    var taken = M.groups.registered.concat(M.groups.bookmarked);
    return LIF.GROUPS
      .filter(function (g) { return taken.indexOf(g.id) === -1; })
      .map(function (g) { var m = match(g); return m ? { item: g, match: m } : null; })
      .filter(Boolean)
      .sort(function (a, b) { return b.match.score - a.match.score; });
  }

  function suggestedResources() {
    if (!canSuggest()) return [];
    return LIF.RESOURCES
      .filter(function (r) { return M.resources.saved.indexOf(r.id) === -1; })
      .map(function (r) { var m = match(r); return m ? { item: r, match: m } : null; })
      .filter(Boolean)
      .sort(function (a, b) { return b.match.score - a.match.score; });
  }

  function suggestedCommons() {
    if (!canSuggest()) return [];
    return LIF.COMMONS
      .filter(function (c) { return M.commons.tending.indexOf(c.id) === -1; })
      .map(function (c) { var m = match(c); return m ? { item: c, match: m } : null; })
      .filter(Boolean)
      .sort(function (a, b) { return b.match.score - a.match.score; });
  }

  /* People you might know: shared sectors, not already connected. */
  function suggestedPeople() {
    if (!canSuggest()) return [];
    var known = M.connections.concat(M.connectionRequests);
    return LIF.PEOPLE
      .filter(function (p) { return known.indexOf(p.id) === -1; })
      .map(function (p) {
        var shared = (p.sectors || []).filter(function (s) { return M.preferences.sectors.indexOf(s) !== -1; });
        var km = kmFromMember(p.lat, p.lng);
        var score = shared.length * 3 + (km != null && km <= M.preferences.radiusKm ? 2 : 0);
        if (!score) return null;
        var why = [];
        if (shared.length) why.push('You both work in ' + shared.map(function (s) { var x = U.getSector(s); return x ? x.name : s; }).join(' and '));
        if (km != null && km <= M.preferences.radiusKm) why.push(Math.round(km) + ' km away');
        return { item: p, match: { score: score, why: why } };
      })
      .filter(Boolean)
      .sort(function (a, b) { return b.match.score - a.match.score; });
  }

  /* Organization-gated content follows the same rule the events hub
     uses: public to everyone, organization-only to verified members. */
  function isVisibleToMember(evt) {
    if (evt.visibility !== 'organization') return true;
    return M.organizations.verified.indexOf(evt.organization) !== -1;
  }

  function updatedEvents() {
    var mine = M.events.registered.concat(M.events.bookmarked);
    return mine.map(U.getEvent).filter(function (e) { return e && ts(e.updatedAt) > lastVisitTs(); });
  }
  function updatedGroups() {
    var mine = M.groups.registered.concat(M.groups.bookmarked);
    return mine.map(getGroup).filter(function (g) { return g && ts(g.updatedAt) > lastVisitTs(); });
  }

  function getGroup(id) { return LIF.GROUPS.find(function (g) { return g.id === id; }); }
  function getPerson(id) { return LIF.PEOPLE.find(function (p) { return p.id === id; }); }
  function getResource(id) { return LIF.RESOURCES.find(function (r) { return r.id === id; }); }
  function getCommons(id) { return LIF.COMMONS.find(function (c) { return c.id === id; }); }
  function getOpportunity(id) { return LIF.OPPORTUNITIES.find(function (o) { return o.id === id; }); }

  function newActivityCount() {
    if (!M.privacy.receiveActivity) return 0;
    return LIF.PLAYMATE_ACTIVITY.filter(function (a) { return ts(a.at) > lastVisitTs(); }).length;
  }

  function profileCompleteness() {
    var filled = 0, total = 0;
    Object.keys(M.fields).forEach(function (k) { total++; if (String(M.fields[k].value || '').trim()) filled++; });
    total += 4;
    if (M.intro.trim()) filled++;
    if (M.languages.length) filled++;
    if (M.sectors.length) filled++;
    if (M.avatarUrl) filled++;
    return Math.round(filled / total * 100);
  }

  /* The stat tiles each card shows. Ordered most-to-least owned:
     what you've committed to, then what you saved, then what the
     playground is offering you. */
  function statsFor(key) {
    switch (key) {
      case 'profile': return [
        { n: profileCompleteness() + '%', label: 'Complete' },
        { n: Object.keys(M.fields).filter(function (k) { return M.fields[k].public; }).length, label: 'Public fields' },
        { n: M.sectors.length, label: 'Sectors' }
      ];
      case 'events': return [
        { n: registeredEvents().length, label: 'Registered' },
        { n: M.events.bookmarked.length, label: 'Bookmarked' },
        { n: suggestedEvents().length, label: 'Suggested' },
        { n: updatedEvents().length, label: 'New', isNew: true },
        { n: eventTasks().length, label: 'To do', isNew: eventTasks().length > 0 }
      ];
      case 'groups': return [
        { n: joinedGroups().length, label: 'My Groups' },
        { n: groupInvitations().length, label: 'Invitations' },
        { n: groupRequests().length, label: 'Requests' },
        { n: suggestedGroupsV2().length, label: 'Suggested' },
        { n: groupTasks().length, label: 'To do', isNew: groupTasks().length > 0 }
      ];
      case 'connections': return [
        { n: M.connections.length, label: 'Playmates' },
        { n: M.connectionRequests.length, label: 'Requests' },
        { n: suggestedPeople().length, label: 'Suggested' },
        { n: newActivityCount(), label: 'New', isNew: true }
      ];
      case 'commons': return [
        { n: M.commons.tending.length, label: 'Tending' },
        { n: LIF.COMMONS.length, label: 'Open' },
        { n: suggestedCommons().length, label: 'Suggested' }
      ];
      case 'resources': return [
        { n: M.resources.saved.length, label: 'Saved' },
        { n: suggestedResources().length, label: 'Suggested' },
        { n: LIF.RESOURCES.length, label: 'In library' }
      ];
      case 'opportunities': return [
        { n: M.opportunities.saved.length, label: 'Saved' },
        { n: LIF.OPPORTUNITIES.length, label: 'Open roles' }
      ];
      case 'organizations': return [
        { n: M.organizations.verified.length, label: 'Verified' },
        { n: memberOnlyEvents().length, label: 'Member events' }
      ];
      default: return [];
    }
  }

  function memberOnlyEvents() {
    return LIF.EVENTS.filter(function (e) {
      return e.visibility === 'organization' && M.organizations.verified.indexOf(e.organization) !== -1;
    });
  }

  /* the one-line "here's what's actually waiting" under each card */
  function peekFor(key) {
    switch (key) {
      case 'profile': {
        var hidden = Object.keys(M.fields).filter(function (k) { return !M.fields[k].public; }).length;
        return hidden + ' field' + (hidden === 1 ? '' : 's') + ' kept private · <b>' + h(M.preferredLanguage.toUpperCase()) + '</b> interface';
      }
      case 'events': {
        var todo = eventTasks();
        if (todo.length) {
          return '<b>' + todo.length + ' thing' + (todo.length === 1 ? '' : 's') + ' waiting on you</b> — ' +
            h(todo[0].task.label.toLowerCase()) + ' for ' + h(todo[0].event.title);
        }
        var next = nextEvent();
        return next ? 'Next up: <b>' + h(next.title) + '</b>, ' + h(relTime(next.start)) : 'Nothing on your calendar yet.';
      }
      case 'groups': {
        var todo = groupTasks();
        if (todo.length) {
          return '<b>' + todo.length + ' waiting on you</b> \u2014 ' + h(todo[0].label.toLowerCase()) +
            ' in ' + h(todo[0].group.name);
        }
        var g = joinedGroups()[0];
        if (!g) return 'You have not joined a Group yet.';
        var n = LIF.groups.newSince(g.id);
        return n ? '<b>' + n + ' new</b> in ' + h(g.name) + ' since your last visit.'
                 : 'Most active: <b>' + h(g.name) + '</b>';
      }
      case 'connections': {
        if (M.connectionRequests.length) {
          var p = getPerson(M.connectionRequests[0]);
          return '<b>' + h(p ? p.name : 'Someone') + '</b> is waiting on your reply.';
        }
        var a = LIF.PLAYMATE_ACTIVITY[0], who = a && getPerson(a.personId);
        return who ? '<b>' + h(who.name) + '</b> ' + h(a.verb) + ' ' + h(a.target) : 'No playmate activity yet.';
      }
      case 'commons': {
        var c = getCommons(M.commons.tending[0]);
        return c ? 'You tend <b>' + h(c.name) + '</b> with ' + c.stewards + ' others.' : 'Nothing tended yet.';
      }
      case 'resources': {
        var s = suggestedResources()[0];
        return s ? 'Suggested: <b>' + h(s.item.title) + '</b>' : M.resources.saved.length + ' saved for later.';
      }
      case 'opportunities': return LIF.OPPORTUNITIES.length + ' roles open across the ecosystem.';
      case 'organizations': {
        var org = U.getOrganization(M.organizations.verified[0]);
        return org ? 'Verified with <b>' + h(org.name) + '</b>' : '';
      }
      default: return '';
    }
  }

  /* =========================================================
   * 3b. EVENTS, RECONCILED
   * Two things claim to know what this member is registered for:
   * the profile record (M.events.registered) and the events store
   * (which is what the registration flow actually writes to). They
   * are merged here, once, so no panel can disagree with the event
   * page about the same fact.
   * ======================================================= */
  function registeredEvents() {
    var ids = M.events.registered.slice();
    LIF.events.myRegistrations().forEach(function (r) {
      if (ids.indexOf(r.event.id) === -1) ids.push(r.event.id);
    });
    return ids.map(U.getEvent).filter(Boolean)
      .sort(function (a, b) { return ts(a.start) - ts(b.start); });
  }

  /* The same reconciliation the events panel needed. LIF.MEMBER
     says which Groups this person belongs to; the groups store is
     what the Group pages actually write to. Read the store, so no
     panel can disagree with a Group page about the same fact. */
  function joinedGroups() { return LIF.groups.myGroups(); }
  function followedGroups() { return LIF.groups.myFollows(); }
  function groupInvitations() { return LIF.groups.myInvitations(); }
  function groupRequests() { return LIF.groups.myRequests(); }
  function groupProposals() {
    var out = M.groups.proposed.map(function (id) { return LIF.PROPOSALS[id]; }).filter(Boolean);
    LIF.groups.proposals().forEach(function (x) { out.push(x); });
    LIF.groups.drafts().forEach(function (x) { if (x.name) out.push(Object.assign({}, x, { status: 'Draft' })); });
    return out;
  }
  function suggestedGroupsV2() {
    return LIF.groups.suggested().map(function (r) { return { item: r.group, match: { why: r.why } }; });
  }
  /** Anything in Groups still waiting on this member. */
  function groupTasks() {
    var out = [];
    groupInvitations().forEach(function (x) {
      out.push({ group: x.group, label: x.invitation.kind === 'direct'
        ? 'Accept or decline your invitation' : 'Respond to an invitation to apply' });
    });
    groupRequests().forEach(function (x) {
      if (x.request.status === 'more-info') out.push({ group: x.group, label: 'A steward asked you something' });
    });
    joinedGroups().forEach(function (g) {
      if (LIF.groups.isSteward(g) && LIF.groups.activityStale(g)) {
        out.push({ group: g, label: 'Confirm what is alive now' });
      }
    });
    return out;
  }

  /** Events this member is hosting, whatever their status. */
  function hostedEvents() {
    return LIF.EVENTS.filter(function (e) { return LIF.events.isHost(e); })
      .sort(function (a, b) { return ts(b.start) - ts(a.start); });
  }

  /** Proposals: the two hand-written samples plus anything really
      submitted through the proposal pathway this session. */
  function myProposals() {
    var out = M.events.proposed.map(function (id) { return LIF.PROPOSALS[id]; }).filter(Boolean);
    LIF.events.proposals().forEach(function (p) {
      if (!out.some(function (x) { return x.id === p.id; })) out.push(p);
    });
    LIF.events.drafts().forEach(function (p) {
      if (p.title) out.push(Object.assign({}, p, { status: 'Draft' }));
    });
    return out;
  }

  /** Everything still waiting on this member across all events. */
  function eventTasks() { return LIF.events.allTasks(); }

  function nextEvent() {
    var now = Date.now();
    return registeredEvents().filter(function (e) {
      return e.status === 'active' && ts(e.end || e.start) >= now;
    })[0] || registeredEvents()[0];
  }

  function unreadNotifications() {
    return LIF.NOTIFICATION_FEED.filter(function (n) {
      return n.unread && M.notifications.features[n.feature] !== false;
    });
  }

  /* =========================================================
   * 3. PERSISTENCE
   * Display choices are the member's, so they should survive a
   * refresh. localStorage stands in for the `dashboard` field on
   * the profile record - swap the two functions when that exists.
   * ======================================================= */
  var STORE_KEY = 'lif.dashboard.v1';
  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        dashboard: M.dashboard, preferences: M.preferences,
        privacy: M.privacy, notifications: M.notifications
      }));
    } catch (e) { /* private browsing, quota, etc - never fatal */ }
  }
  function restore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      ['dashboard', 'preferences', 'privacy', 'notifications'].forEach(function (k) {
        if (saved[k]) M[k] = Object.assign(M[k], saved[k]);
      });
    } catch (e) { /* ignore malformed state rather than blocking the page */ }
  }

  function pending(label) {
    U.showToast(label + ' — saved on your screen only. This is the call the backend will take over.');
  }

  /* =========================================================
   * 4. FEATURE CARD + RAIL
   * ======================================================= */
  function bellHtml(key) {
    var on = M.notifications.features[key] !== false;
    return '<button class="bell-toggle ' + (on ? 'is-on' : '') + '" data-action="toggle-bell" data-key="' + key + '" type="button" ' +
      'title="' + (on ? 'Notifications on for ' + h(feature(key).name) : 'Notifications off') + '" ' +
      'aria-label="' + (on ? 'Turn off' : 'Turn on') + ' notifications for ' + h(feature(key).name) + '">' +
      svg(on ? 'bell' : 'bellOff') + '</button>';
  }

  function cardHtml(f, slot) {
    var stats = statsFor(f.key);
    return '<article class="feature-card" data-feature="' + f.key + '" data-slot="' + slot + '" ' +
      'data-action="open-feature" data-key="' + f.key + '" role="button" tabindex="0" ' +
      'style="animation-delay:' + (slot * 45) + 'ms">' +
      '<div class="fc-head">' +
        '<span class="fc-icon">' + svg(f.key) + '</span>' +
        '<span><span class="fc-title">' + h(f.name) + '</span><br><span class="fc-sub">' + h(f.blurb) + '</span></span>' +
        bellHtml(f.key) +
      '</div>' +
      '<div class="fc-stats">' + stats.map(function (s) {
        return '<span class="stat ' + (s.isNew && s.n > 0 ? 'stat--new' : '') + '">' +
          '<span class="stat-num">' + h(String(s.n)) + '</span>' +
          '<span class="stat-label">' + h(s.label) + '</span></span>';
      }).join('') + '</div>' +
      '<div class="fc-peek">' + peekFor(f.key) + '</div>' +
      '<div class="fc-cta">Open ' + svg('arrow') + '</div>' +
      '</article>';
  }

  function railHtml() {
    var items = visibleFeatures().map(function (f) {
      var stats = statsFor(f.key);
      var newStat = stats.find(function (s) { return s.isNew; });
      var badge = newStat && newStat.n > 0
        ? '<span class="rail-count has-new">' + newStat.n + ' new</span>'
        : '<span class="rail-count">' + h(String(stats[0] ? stats[0].n : '')) + '</span>';
      return '<button class="rail-item ' + (view.feature === f.key ? 'is-active' : '') + '" data-feature="' + f.key + '" ' +
        'data-action="open-feature" data-key="' + f.key + '" type="button">' +
        '<span class="rail-icon">' + svg(f.key) + '</span>' +
        '<span class="rail-name">' + h(f.name) + '</span>' + badge + '</button>';
    }).join('');
    return '<nav class="feature-rail">' + items +
      '<div class="rail-sep"></div>' +
      '<button class="rail-item" data-action="open-notifications" data-feature="events" type="button">' +
      '<span class="rail-icon">' + svg('bell') + '</span><span class="rail-name">Notifications</span>' +
      '<span class="rail-count ' + (unreadNotifications().length ? 'has-new' : '') + '">' + unreadNotifications().length + '</span></button>' +
      '</nav>';
  }

  /* =========================================================
   * 5. CENTRE FOCUS PANEL (map / calendar)
   * ======================================================= */
  function focusPanelHtml() {
    var isMap = M.dashboard.centreFocus === 'map';
    var mine = myMappableEvents();
    return '<section class="focus-panel">' +
      '<div class="focus-head">' +
        '<h3 class="focus-title">' + (isMap ? 'My map' : 'My calendar') +
          '<small>' + (isMap
            ? 'Where your events and playmates are'
            : 'Everything you are registered for or watching') + '</small></h3>' +
        '<div class="seg">' +
          '<button type="button" data-action="set-focus" data-focus="map" class="' + (isMap ? 'is-active' : '') + '">Map</button>' +
          '<button type="button" data-action="set-focus" data-focus="calendar" class="' + (!isMap ? 'is-active' : '') + '">Calendar</button>' +
        '</div>' +
      '</div>' +
      '<div class="focus-body">' +
        (isMap ? '<div id="dashMap"></div>' : '<div id="dashCalendar"></div>') +
      '</div>' +
      '<div class="focus-foot">' +
        '<span class="legend-key"><i class="legend-dot" style="--k:var(--a-engagement)"></i> ' + mine.registered.length + ' registered</span>' +
        '<span class="legend-key"><i class="legend-dot" style="--k:var(--rose)"></i> ' + mine.bookmarked.length + ' bookmarked</span>' +
        (isMap ? '<span class="legend-key"><i class="legend-dot" style="--k:var(--a-presence)"></i> ' + M.connections.length + ' playmates</span>' : '') +
        '<span style="margin-left:auto"><a class="link-btn" href="index.html">Browse the whole playground →</a></span>' +
      '</div>' +
      '</section>';
  }

  function myMappableEvents() {
    return {
      registered: M.events.registered.map(U.getEvent).filter(Boolean),
      bookmarked: M.events.bookmarked.map(U.getEvent).filter(Boolean)
    };
  }

  function pinIcon(color) {
    return L.divIcon({
      className: '', iconSize: [22, 22], iconAnchor: [11, 20],
      html: '<div class="dash-pin" style="background:' + color + '"></div>'
    });
  }

  function mountMap() {
    var el = document.getElementById('dashMap');
    if (!el || typeof L === 'undefined') return;
    if (mapObj) { mapObj.remove(); mapObj = null; }
    mapObj = L.map(el, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 18
    }).addTo(mapObj);

    var pts = [];
    var mine = myMappableEvents();
    function addEvent(evt, color) {
      if (!evt.location) return;
      L.marker([evt.location.lat, evt.location.lng], { icon: pinIcon(color) })
        .addTo(mapObj)
        .bindPopup('<b>' + h(evt.title) + '</b><br>' + h(U.formatDateRange(evt.start)) + '<br>' + h(evt.location.city));
      pts.push([evt.location.lat, evt.location.lng]);
    }
    mine.registered.forEach(function (e) { addEvent(e, '#0070C0'); });
    mine.bookmarked.forEach(function (e) { addEvent(e, '#BD5F72'); });

    M.connections.map(getPerson).filter(Boolean).forEach(function (p) {
      if (p.lat == null) return;
      L.marker([p.lat, p.lng], { icon: pinIcon('#205E9C') })
        .addTo(mapObj)
        .bindPopup('<b>' + h(p.name) + '</b><br>' + h(p.city + ', ' + p.country));
      pts.push([p.lat, p.lng]);
    });

    L.marker([M.lat, M.lng], { icon: pinIcon('#C0923B') }).addTo(mapObj).bindPopup('<b>You are here</b><br>' + h(M.fields.city.value));
    pts.push([M.lat, M.lng]);

    if (pts.length > 1) mapObj.fitBounds(pts, { padding: [34, 34] });
    else mapObj.setView([M.lat, M.lng], 9);
    setTimeout(function () { mapObj.invalidateSize(); }, 60);
  }

  function mountCalendar(elId) {
    var el = document.getElementById(elId);
    if (!el || typeof FullCalendar === 'undefined') return;
    var mine = myMappableEvents();
    var evts = mine.registered.map(function (e) { return calEvent(e, '#0070C0'); })
      .concat(mine.bookmarked.map(function (e) { return calEvent(e, '#BD5F72'); }));
    if (calendars[elId]) { calendars[elId].destroy(); delete calendars[elId]; }
    var cal = new FullCalendar.Calendar(el, {
      initialView: 'dayGridMonth',
      initialDate: mine.registered.length ? mine.registered[0].start : undefined,
      height: '100%',
      headerToolbar: { left: 'prev,next', center: 'title', right: 'dayGridMonth,listMonth' },
      buttonText: { today: 'Today', month: 'Month', list: 'List' },
      events: evts,
      eventClick: function (info) { info.jsEvent.preventDefault(); openFeature('events', 'registered'); }
    });
    cal.render();
    calendars[elId] = cal;
  }

  function calEvent(e, color) {
    return { id: e.id, title: e.title, start: e.start, end: e.end, backgroundColor: color, borderColor: color, textColor: '#FFFDF6' };
  }

  /* =========================================================
   * 6. BOARD
   * ======================================================= */
  function renderBoard() {
    var board = $('#board');
    var feats = visibleFeatures();
    var html = railHtml();
    feats.forEach(function (f, i) { html += cardHtml(f, i + 1); });
    html += focusPanelHtml();
    html += '<section class="rail-detail" id="railDetail"></section>';
    board.innerHTML = html;

    $('#stage').dataset.layout = M.dashboard.layout;
    $all('#layoutSwitch button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.layout === M.dashboard.layout);
    });

    if (M.dashboard.layout === 'sidebar') {
      renderInto($('#railDetail'), view.feature);
    } else if (M.dashboard.centreFocus === 'map') {
      mountMap();
    } else {
      mountCalendar('dashCalendar');
    }

    renderHeaderBits();
  }

  function renderHeaderBits() {
    var unread = unreadNotifications().length;
    var badge = $('#bellCount');
    badge.textContent = unread;
    badge.classList.toggle('hidden', unread === 0);
    $('#bellBtn').classList.toggle('is-on', view.drawerMode === 'notifications');
    $('#topAvatar').textContent = U.initials(M.fields.firstName.value + ' ' + M.fields.lastName.value);

    var name = M.fields.preferredName.value || M.fields.firstName.value;
    $('#welcomeHeading').innerHTML = 'Welcome home, <em>' + h(name) + '</em>';

    var newCount = updatedEvents().length + updatedGroups().length + newActivityCount();
    var since = U.formatDateRange(M.lastVisit).split(' · ')[0];
    $('#welcomeSub').innerHTML =
      (newCount
        ? '<b>' + newCount + ' update' + (newCount === 1 ? '' : 's') + '</b> since your last visit on ' + h(since) + '. '
        : 'Nothing new since ' + h(since) + '. ') +
      'Your dashboard shows what you follow — the search above still reaches the whole playground.';
  }

  /* =========================================================
   * 7. DETAIL RENDERING
   * One renderer, three homes: the drawer (constellation + cards
   * layouts), the rail-detail pane (sidebar layout), or the
   * notifications/customize drawers.
   * ======================================================= */
  var TABS = {
    profile:       [['details', 'Details'], ['interests', 'Interests'], ['preferences', 'Preferences'], ['privacy', 'Privacy']],
    events:        [['registered', 'Registered'], ['bookmarked', 'Bookmarked'], ['suggested', 'Suggested'], ['updated', 'Updated'], ['hosting', 'Hosting'], ['proposed', 'Proposed'], ['calendar', 'My calendar']],
    groups:        [['registered', 'My Groups'], ['invitations', 'Invitations'], ['requests', 'Requests'], ['suggested', 'Suggested'], ['following', 'Following'], ['updated', 'Updated'], ['proposed', 'Proposed']],
    connections:   [['playmates', 'Playmates'], ['requests', 'Requests'], ['suggested', 'Suggested'], ['activity', 'Activity']],
    commons:       [['tending', 'Tending'], ['explore', 'Explore']],
    resources:     [['saved', 'Saved'], ['suggested', 'Suggested'], ['library', 'Library']],
    opportunities: [['saved', 'Saved'], ['open', 'Open roles']],
    organizations: [['memberships', 'Memberships'], ['events', 'Member events']]
  };

  var BLURBS = {
    profile:       'Everything other members can see about you, and everything they cannot. Each field has its own switch.',
    events:        'Everything you are registered for, watching, or being offered — plus the events you have proposed.',
    groups:        'The Groups you belong to, follow, have asked to join or been invited to \u2014 plus the ones you have proposed.',
    connections:   'Your playmates. Activity only flows both ways when both of you have agreed to share it.',
    commons:       'Shared things members tend together — a fund, a document, a map, a practice.',
    resources:     'The library. Saved is what you kept; suggested is drawn from your sectors and subsectors.',
    opportunities: 'Volunteer roles, staff positions and partnership openings across the ecosystem.',
    organizations: 'Partner organizations where your membership is verified, and the member-only events that unlocks.'
  };

  function tabsHtml(key, active) {
    return '<div class="detail-tabs">' + (TABS[key] || []).map(function (t) {
      var count = tabCount(key, t[0]);
      return '<button class="tab ' + (t[0] === active ? 'is-active' : '') + '" data-action="set-tab" data-tab="' + t[0] + '" type="button">' +
        h(t[1]) + (count != null ? '<span class="pip">' + count + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function tabCount(key, tab) {
    var d = dataFor(key, tab);
    return Array.isArray(d) ? d.length : null;
  }

  /* The single source of truth for "what is in this tab". */
  function dataFor(key, tab) {
    switch (key + ':' + tab) {
      case 'events:registered': return registeredEvents();
      case 'events:hosting':    return hostedEvents();
      case 'events:bookmarked': return M.events.bookmarked.map(U.getEvent).filter(Boolean);
      case 'events:suggested':  return suggestedEvents();
      case 'events:updated':    return updatedEvents();
      case 'events:proposed':   return myProposals();
      case 'groups:registered':  return joinedGroups();
      case 'groups:following':   return followedGroups();
      case 'groups:invitations': return groupInvitations();
      case 'groups:requests':    return groupRequests();
      case 'groups:suggested':   return suggestedGroupsV2();
      case 'groups:updated':     return updatedGroups();
      case 'groups:proposed':    return groupProposals();
      case 'connections:playmates': return M.connections.map(getPerson).filter(Boolean);
      case 'connections:requests':  return M.connectionRequests.map(getPerson).filter(Boolean);
      case 'connections:suggested': return suggestedPeople();
      case 'connections:activity':  return M.privacy.receiveActivity ? LIF.PLAYMATE_ACTIVITY : [];
      case 'commons:tending':   return M.commons.tending.map(getCommons).filter(Boolean);
      case 'commons:explore':   return LIF.COMMONS;
      case 'resources:saved':   return M.resources.saved.map(getResource).filter(Boolean);
      case 'resources:suggested': return suggestedResources();
      case 'resources:library': return LIF.RESOURCES;
      case 'opportunities:saved': return M.opportunities.saved.map(getOpportunity).filter(Boolean);
      case 'opportunities:open':  return LIF.OPPORTUNITIES;
      case 'organizations:memberships': return M.organizations.verified.map(U.getOrganization).filter(Boolean);
      case 'organizations:events':      return memberOnlyEvents();
      default: return null;
    }
  }

  function detailHtml(key, tab) {
    var f = feature(key);
    var body;
    if (key === 'profile') body = profileBody(tab);
    else if (key === 'events' && tab === 'calendar') body = '<div style="height:520px"><div id="detailCalendar" style="height:100%"></div></div>';
    else if (key === 'connections') body = connectionsBody(tab);
    else body = listBody(key, tab);

    return '<div class="detail-head" data-feature="' + key + '">' +
        '<span class="fc-icon">' + svg(key) + '</span>' +
        '<div><h2 class="detail-title">' + h(f.name) + '</h2>' +
        '<p class="detail-desc">' + h(BLURBS[key]) + '</p></div>' +
        '<div class="detail-head-actions">' +
          (key === 'events' ? '<button class="btn btn--sm btn--gold" type="button" data-propose-event>Propose an event</button>' : '') +
          (key === 'groups' ? '<button class="btn btn--sm btn--gold" type="button" data-propose-group>Propose a Group</button>' : '') +
          bellHtml(key) +
          (view.drawerMode ? '<button class="icon-btn" data-action="close-drawer" type="button" aria-label="Close">' + svg('close') + '</button>' : '') +
        '</div>' +
      '</div>' +
      tabsHtml(key, tab) +
      '<div class="detail-body" data-feature="' + key + '">' + body + '</div>';
  }

  /* ---- generic list body, used by everything except profile ---- */
  function listBody(key, tab) {
    var rows = dataFor(key, tab) || [];
    var notes = '';

    if (tab === 'suggested' && !canSuggest()) {
      return note('Recommendations are switched off in your privacy settings, so nothing is being suggested. ' +
        '<button class="link-btn" data-action="open-feature" data-key="profile" data-tab="privacy" type="button">Turn them back on</button>');
    }
    if (tab === 'suggested') {
      notes = note('Matched against your sectors, subsectors, a ' + M.preferences.radiusKm + ' km radius and your languages. ' +
        '<button class="link-btn" data-action="open-feature" data-key="profile" data-tab="preferences" type="button">Adjust what you are matched on</button>');
    }
    if (tab === 'updated') {
      notes = note('Changed since your last visit on ' + h(U.formatDateRange(M.lastVisit)) + '.');
    }
    if (key === 'organizations' && tab === 'events') {
      notes = note('These are visible to you because your membership is verified. Signed-out visitors see only that they exist.');
    }

    if (!rows.length) return notes + emptyFor(key, tab);
    return notes + '<div class="item-list">' + rows.map(function (r) { return rowHtml(key, tab, r); }).join('') + '</div>';
  }

  function note(inner) {
    return '<div class="detail-note">' + svg('info') + '<div>' + inner + '</div></div>';
  }

  function emptyFor(key, tab) {
    var copy = {
      'events:registered': ['Nothing on your calendar', 'When you register for an event it lands here, and on your map.'],
      'events:bookmarked': ['No bookmarks yet', 'Bookmark an event to keep an eye on it without committing.'],
      'events:suggested':  ['No matches right now', 'Widen your radius or add a sector, and suggestions will appear.'],
      'events:updated':    ['Nothing has changed', 'Updates to events you follow will collect here between visits.'],
      'events:proposed':   ['You have not proposed an event', 'Anyone can propose one. A steward reviews it before it goes live.'],
      'events:hosting':    ['You are not hosting anything yet', 'Propose a gathering and it appears here from the moment you submit it.'],
      'groups:registered': ['You are not in a Group yet', 'Explore what is here, or propose the Group you wish existed.'],
      'groups:invitations':['No invitations', 'An invitation from a Group Admin grants membership when you accept. Every other kind opens Request Access.'],
      'groups:requests':   ['Nothing waiting', 'Requests you send appear here with their state until a steward decides.'],
      'groups:following':  ['Not following anything', 'Follow a Group to hear when it opens or changes, without joining it.'],
      'groups:proposed':   ['You have not proposed a Group', 'Any eligible Member can. LiF reads it for ecosystem awareness and connection, not as a gate.'],
      'groups:updated':    ['No group news', 'Changes in Groups you belong to or follow show up here.'],
      'connections:requests': ['No pending requests', 'Connection requests from other members appear here.'],
      'connections:activity': ['Activity sharing is off', 'Turn on "receive activity updates" in Privacy to see what your playmates are up to.']
    }[key + ':' + tab] || ['Nothing here yet', 'This fills up as you move around the playground.'];
    return '<div class="empty"><h4>' + h(copy[0]) + '</h4><p>' + h(copy[1]) + '</p>' +
      '<a class="btn btn--sm" href="index.html">Explore the playground</a></div>';
  }

  /* One row renderer, branching on what kind of thing it got. Keeps
     bookmark/mute/why-am-I-seeing-this consistent across features. */
  function rowHtml(key, tab, raw) {
    var item = raw.item || raw;
    var why = raw.match ? raw.match.why : null;

    if (key === 'events' && item.start) return eventRow(item, why, tab);
    if (key === 'groups' && raw.invitation) return groupInviteRow(raw);
    if (key === 'groups' && raw.request) return groupRequestRow(raw);
    if (key === 'groups' && item.memberCount != null) return groupRow(item, why, tab);
    if (key === 'resources') return resourceRow(item, why);
    if (key === 'commons') return commonsRow(item, why);
    if (key === 'opportunities') return opportunityRow(item);
    if (key === 'organizations' && tab === 'memberships') return orgRow(item);
    if (key === 'organizations') return eventRow(item, null, tab);
    if (item.status) return proposalRow(item);
    return '';
  }

  function whyHtml(why) {
    if (!why || !why.length) return '';
    return '<div class="item-why">' + svg('spark') + h(why.join(' · ')) + '</div>';
  }

  function muteBtn(id) {
    var muted = M.notifications.mutedItems.indexOf(id) !== -1;
    return '<button class="bell-toggle ' + (muted ? '' : 'is-on') + '" data-action="toggle-mute" data-id="' + id + '" type="button" ' +
      'title="' + (muted ? 'Notifications muted for this one' : 'Notifications on for this one') + '" ' +
      'aria-label="Toggle notifications for this item">' + svg(muted ? 'bellOff' : 'bell') + '</button>';
  }

  function bookmarkBtn(type, id) {
    var list = type === 'event' ? M.events.bookmarked
      : type === 'group' ? M.groups.bookmarked
      : type === 'resource' ? M.resources.saved
      : type === 'opportunity' ? M.opportunities.saved : [];
    var on = list.indexOf(id) !== -1;
    return '<button class="bell-toggle ' + (on ? 'is-on' : '') + '" data-action="toggle-bookmark" data-type="' + type + '" data-id="' + id + '" type="button" ' +
      'title="' + (on ? 'Saved' : 'Save for later') + '" aria-label="' + (on ? 'Remove bookmark' : 'Bookmark') + '">' + svg('bookmark') + '</button>';
  }

  /* The event card the spec describes: what it is, where you stand
     with it, and - the part that makes it a card rather than a list
     item - whatever is still waiting on you. */
  function eventRow(evt, why, tab) {
    var aspect = U.getAspect(evt.aspect);
    var sector = U.getSector(evt.sector);
    var where = evt.location ? evt.location.city + ', ' + evt.location.country : 'Online';
    var km = evt.location ? kmFromMember(evt.location.lat, evt.location.lng) : null;
    var isNew = ts(evt.updatedAt) > lastVisitTs();
    var locked = evt.visibility === 'organization';

    var st = LIF.events.registrationState(evt);
    var reg = LIF.events.registrationFor(evt.id);
    var tasks = LIF.events.tasksFor(evt.id);
    var attendable = LIF.events.isAttendable(evt) && reg;

    return '<article class="item-row">' +
      '<span class="item-mark" style="--mark:var(--a-' + aspectKey(aspect) + ')"></span>' +
      '<div class="item-main">' +
        '<div class="item-title">' + h(evt.title) +
          (evt.status !== 'active' ? ' <span class="badge badge--status-' + h(evt.status) + '">' +
            h(LIF.events.statusMeta(evt.status).name) + '</span>' : '') +
          (isNew && tab !== 'updated' ? ' <span class="badge badge--new">updated</span>' : '') +
          (locked ? ' <span class="badge badge--lock">' + svg('lock') + ' members only</span>' : '') +
          (evt.access === 'private' ? ' <span class="badge badge--lock">invite only</span>' : '') + '</div>' +
        '<div class="item-meta">' +
          '<span class="mono">' + h(U.formatDateRange(evt.start, evt.end)) + '</span>' +
          '<span>' + h(where) + (km != null ? ' · ' + Math.round(km) + ' km' : '') + '</span>' +
          '<span class="badge">' + h(evt.format) + '</span>' +
          (sector ? '<span class="badge badge--feat">' + h(sector.name) + '</span>' : '') +
          '<span class="badge">' + h(LIF.events.paymentLabel(evt)) + '</span>' +
          (reg && reg.rsvp ? '<span class="badge badge--live">RSVP ' + h(reg.rsvp.replace('-', ' ')) + '</span>' : '') +
        '</div>' +
        '<p class="item-summary">' + h(evt.summary) + '</p>' +
        whyHtml(why) +
        (tasks.length
          ? '<div class="item-todo">' + svg('spark') + '<span>Waiting on you:</span>' + tasks.map(function (t) {
              return '<button class="item-todo-btn" type="button" data-action="event-task" ' +
                'data-id="' + h(evt.id) + '" data-task="' + h(t.action) + '">' + h(t.label) + '</button>';
            }).join('') + '</div>'
          : '') +
        (evt.status === 'complete' && LIF.events.canSeeRecording(evt)
          ? '<div class="item-todo item-todo--calm">' + svg('spark') +
            '<a class="item-todo-btn" href="' + h(evt.postEvent.recordingUrl) + '" target="_blank" rel="noopener">Watch the recording</a>' +
            '<a class="item-todo-btn" href="event.html?id=' + h(evt.id) + '">Continue the conversation</a></div>'
          : '') +
      '</div>' +
      '<div class="item-actions">' + bookmarkBtn('event', evt.id) + muteBtn(evt.id) +
        (attendable
          ? '<a class="btn btn--sm btn--gold" href="' + h(evt.onlineLink || '#') + '" target="_blank" rel="noopener">Attend</a>'
          : st.canRegister
            ? '<button class="btn btn--sm btn--gold" type="button" data-register-event="' + h(evt.id) + '">Register</button>'
            : st.code === 'registered'
              ? '<span class="badge badge--live">registered</span>'
              : '<span class="badge">' + h(st.label) + '</span>') +
        '<a class="btn btn--sm" href="event.html?id=' + h(evt.id) + '">Event page</a>' +
      '</div></article>';
  }

  function aspectKey(aspect) {
    var map = {
      'source-resources': 'source', 'divine-potential': 'divine', 'presence-being': 'presence',
      'engagement-communion': 'engagement', 'nature-nurture': 'nature',
      'community-inclusion': 'community', 'service-offerings': 'service'
    };
    return aspect ? (map[aspect.id] || 'divine') : 'divine';
  }

  /* The Group card the Human Mapping describes: identity, focus,
     format, language, access, ACCURATE activity status, and one
     context-appropriate action. Never a one-click join \u2014 the doc
     rules that out for discoverable Groups. */
  function groupRow(g, why, tab) {
    var sector = U.getSector(g.sector);
    var isNew = ts(g.updatedAt) > lastVisitTs();
    var state = LIF.groups.membershipState(g.id);
    var action = LIF.groups.primaryAction(g);
    var unread = LIF.groups.newSince(g.id);
    var mine = LIF.groups.membership(g.id);

    return '<article class="item-row">' +
      '<span class="item-mark" style="--mark:var(--a-community)"></span>' +
      '<div class="item-main">' +
        '<div class="item-title">' + h(g.name) +
          (g.status !== 'active' ? ' <span class="badge badge--status-' + h(g.status) + '">' +
            h(LIF.groups.stateMeta(g.status).name) + '</span>' : '') +
          (isNew && tab !== 'updated' ? ' <span class="badge badge--new">updated</span>' : '') +
          (g.access.discoverability === 'private' ? ' <span class="badge badge--lock">private</span>' : '') +
          (mine && mine.role !== 'member' ? ' <span class="badge badge--live">' +
            h((LIF.GROUP_ROLES.find(function (r) { return r.id === mine.role; }) || {}).name) + '</span>' : '') +
        '</div>' +
        '<div class="item-meta">' +
          '<span>' + h(LIF.groups.countLabel(g)) + '</span>' +
          (sector ? '<span class="badge badge--feat">' + h(sector.name) + '</span>' : '') +
          '<span class="badge">' + h(LIF.groups.structureMeta(g.structure).name) + '</span>' +
          '<span class="badge">' + h(g.format) + '</span>' +
          '<span class="badge">' + h(g.languages.primary) + '</span>' +
          (state === 'active' ? '<span class="badge badge--live">Member</span>' : '') +
        '</div>' +
        '<p class="item-summary">' + h(g.description) + '</p>' +
        (g.activityPlan ? '<p class="item-summary"><strong>Alive now:</strong> ' + h(g.activityPlan) + '</p>' : '') +
        whyHtml(why) +
        (unread
          ? '<div class="item-todo item-todo--calm">' + svg('spark') +
            '<a class="item-todo-btn" href="group.html?id=' + h(g.id) + '">' + unread + ' new since your last visit</a></div>'
          : '') +
        (LIF.groups.isSteward(g) && LIF.groups.activityStale(g)
          ? '<div class="item-todo">' + svg('spark') + '<span>Waiting on you:</span>' +
            '<a class="item-todo-btn" href="group.html?id=' + h(g.id) + '">Confirm what is alive now</a></div>'
          : '') +
      '</div>' +
      '<div class="item-actions">' + muteBtn(g.id) +
        '<a class="btn btn--sm btn--gold" href="group.html?id=' + h(g.id) + '">' +
          h(state === 'active' ? 'Open' : action.label) + '</a>' +
      '</div></article>';
  }

  /* An open invitation. The two kinds do different things, so the
     row says which before anyone clicks. */
  function groupInviteRow(raw) {
    var g = raw.group, inv = raw.invitation;
    var direct = inv.kind === 'direct';
    return '<article class="item-row">' +
      '<span class="item-mark" style="--mark:var(--a-community)"></span>' +
      '<div class="item-main">' +
        '<div class="item-title">' + h(g.name) +
          ' <span class="badge badge--live">' + h(direct ? 'grants membership' : 'opens Request Access') + '</span></div>' +
        '<div class="item-meta"><span>from ' + h(inv.fromName) + '</span>' +
          '<span class="mono">' + h(relTime(inv.at)) + '</span></div>' +
        (inv.message ? '<p class="item-summary">\u201C' + h(inv.message) + '\u201D</p>' : '') +
      '</div>' +
      '<div class="item-actions">' +
        '<a class="btn btn--sm btn--gold" href="group.html?id=' + h(g.id) + '">Respond</a>' +
      '</div></article>';
  }

  /* A request waiting on a steward, with the state the doc names. */
  function groupRequestRow(raw) {
    var g = raw.group, r = raw.request;
    var label = { pending: 'Request Pending', 'more-info': 'More Information Needed',
                  waitlist: 'Waitlisted', approve: 'Approved', decline: 'Declined' }[r.status] || r.status;
    return '<article class="item-row">' +
      '<span class="item-mark" style="--mark:var(--gold)"></span>' +
      '<div class="item-main">' +
        '<div class="item-title">' + h(g.name) + ' <span class="badge badge--warn">' + h(label) + '</span></div>' +
        '<div class="item-meta"><span class="mono">asked ' + h(relTime(r.at)) + '</span></div>' +
        '<p class="item-summary">' + h(r.reviewerNote ||
          'A steward reviews every request and comes back with a reason and a clear next action, whichever way it goes.') + '</p>' +
      '</div>' +
      '<div class="item-actions">' +
        (r.status === 'pending' || r.status === 'more-info'
          ? '<button class="btn btn--sm" type="button" data-action="withdraw-request" data-id="' + h(g.id) + '">Withdraw</button>'
          : '') +
        '<a class="btn btn--sm" href="group.html?id=' + h(g.id) + '">View</a>' +
      '</div></article>';
  }

  function resourceRow(r, why) {
    var sector = U.getSector(r.sector);
    return '<article class="item-row">' +
      '<span class="item-mark"></span>' +
      '<div class="item-main">' +
        '<div class="item-title">' + h(r.title) + '</div>' +
        '<div class="item-meta"><span class="badge">' + h(r.kind) + '</span>' +
          (sector ? '<span class="badge badge--feat">' + h(sector.name) + '</span>' : '') +
          '<span>' + r.minutes + ' min</span></div>' +
        '<p class="item-summary">' + h(r.summary) + '</p>' + whyHtml(why) +
      '</div>' +
      '<div class="item-actions">' + bookmarkBtn('resource', r.id) +
        '<button class="btn btn--sm" data-action="pending" data-label="Opening ' + h(r.title) + '" type="button">Read</button>' +
      '</div></article>';
  }

  function commonsRow(c, why) {
    var sector = U.getSector(c.sector);
    var tending = M.commons.tending.indexOf(c.id) !== -1;
    return '<article class="item-row">' +
      '<span class="item-mark"></span>' +
      '<div class="item-main">' +
        '<div class="item-title">' + h(c.name) + (tending ? ' <span class="badge badge--live">tending</span>' : '') + '</div>' +
        '<div class="item-meta"><span class="badge">' + h(c.kind) + '</span>' +
          (sector ? '<span class="badge badge--feat">' + h(sector.name) + '</span>' : '') +
          '<span>' + c.stewards + ' stewards · ' + c.contributions + ' contributions</span></div>' +
        '<p class="item-summary">' + h(c.summary) + '</p>' + whyHtml(why) +
      '</div>' +
      '<div class="item-actions">' + muteBtn(c.id) +
        '<button class="btn btn--sm ' + (tending ? '' : 'btn--primary') + '" data-action="pending" data-label="' +
        (tending ? 'Opening ' + h(c.name) : 'Joining the stewards of ' + h(c.name)) + '" type="button">' + (tending ? 'Open' : 'Tend') + '</button>' +
      '</div></article>';
  }

  function opportunityRow(o) {
    return '<article class="item-row">' +
      '<span class="item-mark"></span>' +
      '<div class="item-main">' +
        '<div class="item-title">' + h(o.title) + '</div>' +
        '<div class="item-meta"><span class="badge badge--feat">' + h(o.type) + '</span></div>' +
        '<p class="item-summary">' + h(o.description) + '</p>' +
      '</div>' +
      '<div class="item-actions">' + bookmarkBtn('opportunity', o.id) +
        '<button class="btn btn--sm" data-action="pending" data-label="Expressing interest in ' + h(o.title) + '" type="button">I am interested</button>' +
      '</div></article>';
  }

  function orgRow(org) {
    var count = LIF.EVENTS.filter(function (e) { return e.organization === org.id; }).length;
    return '<article class="item-row">' +
      '<span class="item-mark"></span>' +
      '<div class="item-main">' +
        '<div class="item-title">' + h(org.name) + ' <span class="badge badge--live">' + svg('check') + ' verified</span></div>' +
        '<div class="item-meta"><span>' + h(org.tagline) + '</span><span>' + count + ' event' + (count === 1 ? '' : 's') + ' on the hub</span></div>' +
        '<p class="item-summary">' + h(org.description) + '</p>' +
      '</div>' +
      '<div class="item-actions">' + muteBtn(org.id) +
        '<button class="btn btn--sm" data-action="pending" data-label="Opening ' + h(org.name) + '" type="button">Open</button>' +
      '</div></article>';
  }

  /* Two shapes land here: the two hand-written sample proposals in
     dashboardData.js, and anything really submitted through the
     proposal pathway, which carries a system-assigned event ID.
     One renderer, branching on which. */
  function proposalRow(p) {
    var real = !!p.eventId;
    var status = real ? (p.status === 'Draft' ? 'Draft' : 'Pending') : p.status;
    var when = p.submittedAt || p.submitted || p.updatedAt;
    var evtId = real ? 'evt-' + String(p.eventId).toLowerCase().replace(/[^a-z0-9]+/g, '-') : null;
    var note = real
      ? (p.status === 'Draft'
        ? 'Not submitted yet - only you can see this one.'
        : 'With the LiF Events group. You will hear back by email, or a call if there is a lot to talk through.')
      : p.note;

    return '<article class="item-row">' +
      '<span class="item-mark" style="--mark:var(--gold)"></span>' +
      '<div class="item-main">' +
        '<div class="item-title">' + h(p.title || 'Untitled proposal') +
          ' <span class="badge badge--warn">' + h(status) + '</span>' +
          (real ? ' <span class="badge mono">' + h(p.eventId) + '</span>' : '') + '</div>' +
        '<div class="item-meta">' +
          '<span>Proposed ' + h(p.kind || 'event') + '</span>' +
          (when ? '<span class="mono">' + (p.status === 'Draft' ? 'saved ' : 'submitted ') + h(relTime(when)) + '</span>' : '') +
        '</div>' +
        '<p class="item-summary">' + h(note) + '</p>' +
      '</div>' +
      '<div class="item-actions">' +
        (evtId && p.status !== 'Draft'
          ? '<a class="btn btn--sm" href="event.html?id=' + h(evtId) + '">See it</a>'
          : '') +
        '<button class="btn btn--sm" data-propose-event type="button">' +
          (p.status === 'Draft' ? 'Finish it' : 'Propose another') + '</button>' +
      '</div></article>';
  }

  /* ---- connections, which has its own map/cards/list switch ---- */
  function connectionsBody(tab) {
    var rows = dataFor('connections', tab) || [];

    if (tab === 'activity') {
      if (!M.privacy.receiveActivity) return emptyFor('connections', 'activity');
      return note('You see this because you agreed to receive playmate activity, and because these members agreed to share theirs. Both halves are required.') +
        '<div class="item-list">' + rows.map(function (a) {
          var p = getPerson(a.personId);
          if (!p) return '';
          return '<article class="item-row"><span class="avatar avatar--sm">' + h(U.initials(p.name)) + '</span>' +
            '<div class="item-main"><div class="item-title">' + h(p.name) + ' <span style="font-weight:500;color:var(--ink-soft)">' + h(a.verb) + '</span> ' + h(a.target) + '</div>' +
            '<div class="item-meta mono">' + h(relTime(a.at)) + '</div></div></article>';
        }).join('') + '</div>';
    }

    var v = M.dashboard.connectionsView;
    var switcher = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:13px;flex-wrap:wrap">' +
      '<div class="seg">' +
        ['map', 'cards', 'list'].map(function (mode) {
          return '<button type="button" data-action="set-conn-view" data-view="' + mode + '" class="' + (v === mode ? 'is-active' : '') + '">' +
            mode.charAt(0).toUpperCase() + mode.slice(1) + '</button>';
        }).join('') +
      '</div>' +
      '<input class="text-input" style="flex:1;min-width:180px" id="connFilter" placeholder="Filter by name, city, or sector…" aria-label="Filter playmates">' +
      '</div>';

    if (!rows.length) return switcher + emptyFor('connections', tab);

    var people = rows.map(function (r) { return r.item || r; });
    var whys = {};
    rows.forEach(function (r) { if (r.match) whys[r.item.id] = r.match.why; });

    var body;
    if (v === 'map') {
      body = '<div id="connMap"></div>';
    } else if (v === 'cards') {
      body = '<div class="mini-grid" id="connResults">' + people.map(function (p) { return personCard(p, whys[p.id], tab); }).join('') + '</div>';
    } else {
      body = '<div class="item-list" id="connResults">' + people.map(function (p) { return personRow(p, whys[p.id], tab); }).join('') + '</div>';
    }
    return switcher + body;
  }

  function personCard(p, why, tab) {
    return '<article class="person-card" data-person="' + p.id + '" data-search="' + h((p.name + ' ' + p.city + ' ' + p.country + ' ' + (p.sectors || []).join(' ')).toLowerCase()) + '">' +
      '<span class="avatar">' + h(U.initials(p.name)) + '</span>' +
      '<div><div class="person-name">' + h(p.name) + '</div>' +
      '<div class="person-meta">' + h(p.city + ', ' + p.country) + '</div></div>' +
      '<p class="person-bio">' + h(p.bio) + '</p>' +
      (why ? '<div class="item-why">' + svg('spark') + h(why.join(' · ')) + '</div>' : '') +
      '<div style="display:flex;gap:6px;justify-content:center">' + connActionBtn(p, tab) + '</div>' +
      '</article>';
  }

  function personRow(p, why, tab) {
    return '<article class="item-row" data-search="' + h((p.name + ' ' + p.city + ' ' + p.country + ' ' + (p.sectors || []).join(' ')).toLowerCase()) + '">' +
      '<span class="avatar avatar--sm">' + h(U.initials(p.name)) + '</span>' +
      '<div class="item-main"><div class="item-title">' + h(p.name) + '</div>' +
      '<div class="item-meta"><span>' + h(p.city + ', ' + p.country) + '</span>' +
      (p.sectors || []).map(function (s) { var x = U.getSector(s); return x ? '<span class="badge badge--feat">' + h(x.name) + '</span>' : ''; }).join('') + '</div>' +
      '<p class="item-summary">' + h(p.bio) + '</p>' +
      (why ? '<div class="item-why">' + svg('spark') + h(why.join(' · ')) + '</div>' : '') +
      '</div><div class="item-actions">' + connActionBtn(p, tab) + '</div></article>';
  }

  function connActionBtn(p, tab) {
    if (tab === 'requests') {
      return '<button class="btn btn--sm btn--primary" data-action="pending" data-label="Accepting ' + h(p.name) + '" type="button">Accept</button>' +
        '<button class="btn btn--sm btn--ghost" data-action="pending" data-label="Declining politely" type="button">Later</button>';
    }
    if (tab === 'suggested') {
      return '<button class="btn btn--sm btn--primary" data-action="pending" data-label="Sending a connection request to ' + h(p.name) + '" type="button">Connect</button>';
    }
    return '<button class="btn btn--sm" data-action="pending" data-label="Opening ' + h(p.name) + '’s profile" type="button">View</button>';
  }

  function mountConnMap() {
    var el = document.getElementById('connMap');
    if (!el || typeof L === 'undefined') return;
    if (connMapObj) { connMapObj.remove(); connMapObj = null; }
    connMapObj = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(connMapObj);
    var rows = dataFor('connections', view.tab) || [];
    var pts = [];
    rows.map(function (r) { return r.item || r; }).forEach(function (p) {
      if (p.lat == null) return;
      L.marker([p.lat, p.lng], { icon: pinIcon('#205E9C') }).addTo(connMapObj)
        .bindPopup('<b>' + h(p.name) + '</b><br>' + h(p.city + ', ' + p.country) + '<br>' + h(p.bio));
      pts.push([p.lat, p.lng]);
    });
    L.marker([M.lat, M.lng], { icon: pinIcon('#C0923B') }).addTo(connMapObj).bindPopup('<b>You</b>');
    pts.push([M.lat, M.lng]);
    if (pts.length > 1) connMapObj.fitBounds(pts, { padding: [30, 30] });
    else connMapObj.setView([M.lat, M.lng], 8);
    setTimeout(function () { connMapObj.invalidateSize(); }, 60);
  }

  /* =========================================================
   * 8. PROFILE
   * ======================================================= */
  function profileBody(tab) {
    if (tab === 'interests')   return interestsSection();
    if (tab === 'preferences') return preferencesSection();
    if (tab === 'privacy')     return privacySection();
    return detailsSection();
  }

  function profileHero() {
    var pct = profileCompleteness();
    return '<div class="profile-hero">' +
      '<span class="avatar avatar--lg">' + h(U.initials(M.fields.firstName.value + ' ' + M.fields.lastName.value)) + '</span>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="profile-hero-name">' + h(M.fields.preferredName.value || M.fields.firstName.value) + ' ' + h(M.fields.lastName.value) +
          ' <span style="font-size:.8rem;color:var(--ink-faint);font-family:inherit">' + h(M.fields.pronouns.value) + '</span></div>' +
        '<div class="profile-hero-meta">' + h(M.fields.city.value + ', ' + M.fields.country.value) + '</div>' +
        '<div style="margin-top:9px" class="meter"><i style="width:' + pct + '%"></i></div>' +
        '<div style="margin-top:5px;font-size:.76rem;color:var(--ink-faint)">Profile ' + pct + '% complete' +
          (M.isDemoProfile ? ' <span class="demo-flag">sample profile</span>' : '') + '</div>' +
      '</div>' +
      '<button class="btn btn--sm" data-action="pending" data-label="Uploading a profile picture" type="button">Add photo</button>' +
      '</div>';
  }

  function detailsSection() {
    var rows = Object.keys(M.fields).map(function (k) {
      var f = M.fields[k];
      return '<div class="field-row">' +
        '<span class="field-label">' + h(f.label) + (f.required ? ' *' : '') + '</span>' +
        '<span class="field-value">' + h(f.value) + '</span>' +
        '<span class="field-vis">' +
          '<span class="vis-label ' + (f.public ? 'is-public' : '') + '">' + (f.public ? 'Public' : 'Private') + '</span>' +
          '<label class="switch" title="' + (f.locked ? 'Always public - needed for member search and the map locator' : 'Show this to other members') + '">' +
            '<input type="checkbox" data-change="field-public" data-field="' + k + '" ' + (f.public ? 'checked' : '') + (f.locked ? ' disabled' : '') + '>' +
            '<span class="switch-track"></span><span class="switch-thumb"></span></label>' +
        '</span></div>';
    }).join('');

    var langs = M.languages.map(function (l) {
      return '<span class="badge badge--feat">' + h(l.name) + ' · ' + h(l.proficiency) + '</span>';
    }).join(' ');

    var socials = M.socials.filter(function (s) { return s.handle; }).map(function (s) {
      return '<span class="badge">' + h(s.network) + ' · ' + h(s.handle) + (s.public ? '' : ' (private)') + '</span>';
    }).join(' ');

    return profileHero() +
      '<div class="section"><div class="section-head"><h4>Your fields</h4></div>' +
      '<p class="section-hint">Every field has its own switch. First name and postal code stay public — member search and the map locator are built on them. Everything public is searchable by other members.</p>' +
      rows + '</div>' +

      '<div class="section"><div class="section-head"><h4>Introduction</h4></div>' +
      '<textarea class="text-input" data-change="intro" aria-label="Introduction">' + h(M.intro) + '</textarea></div>' +

      '<div class="section"><div class="section-head"><h4>Languages</h4></div>' +
      '<div class="chip-wrap">' + langs + '<button class="btn btn--sm" data-action="pending" data-label="Adding a language" type="button">+ Add</button></div></div>' +

      '<div class="section"><div class="section-head"><h4>Social links</h4></div>' +
      '<div class="chip-wrap">' + (socials || '<span class="section-hint">None added.</span>') +
      '<button class="btn btn--sm" data-action="pending" data-label="Adding a social link" type="button">+ Add</button></div></div>' +

      saveBar();
  }

  function interestsSection() {
    var sectorChips = LIF.SECTORS.map(function (s) {
      var on = M.sectors.indexOf(s.id) !== -1;
      return '<button class="chip ' + (on ? 'is-on' : '') + '" data-action="toggle-sector" data-id="' + s.id + '" type="button">' + h(s.name) + '</button>';
    }).join('');

    /* Subsectors only exist beneath a chosen sector - exactly the
       dependent-dropdown behaviour the profile spec describes, just
       rendered as chips so all the choices stay visible at once. */
    var subBlocks = M.sectors.map(function (sid) {
      var s = U.getSector(sid);
      var subs = (LIF.SUBSECTORS[sid] || []).map(function (name) {
        var on = M.subsectors.indexOf(name) !== -1;
        return '<button class="chip chip--sub ' + (on ? 'is-on' : '') + '" data-action="toggle-subsector" data-name="' + h(name) + '" type="button">' + h(name) + '</button>';
      }).join('');
      return '<div style="margin-top:13px"><div style="font-size:.78rem;font-weight:700;color:var(--ink-soft);margin-bottom:6px">' +
        h(s ? s.name : sid) + '</div><div class="chip-wrap">' + subs + '</div></div>';
    }).join('');

    return '<div class="section"><div class="section-head"><h4>Your 12 core sectors</h4></div>' +
      '<p class="section-hint">Pick the sectors you work in. These drive who can find you, and they seed the preferences that fill your suggestions.</p>' +
      '<div class="chip-wrap">' + sectorChips + '</div></div>' +

      '<div class="section"><div class="section-head"><h4>Subsectors</h4></div>' +
      '<p class="section-hint">Only the subsectors under the sectors you chose appear here. Missing one? Request it and a steward will add it to the taxonomy.</p>' +
      (M.sectors.length ? subBlocks : '<div class="empty"><h4>Choose a sector first</h4><p>Subsectors appear once you pick at least one sector above.</p></div>') +
      '<div style="margin-top:15px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<input class="text-input" style="flex:1;min-width:220px" id="newSubsector" placeholder="Request a new subsector…">' +
        '<button class="btn btn--sm" data-action="request-subsector" type="button">Request</button></div></div>' +

      '<div class="section"><div class="section-head"><h4>Associations</h4></div>' +
      '<p class="section-hint">Organizations you are associated with. Verified partner memberships unlock that organization’s member-only content.</p>' +
      '<input class="text-input" data-change="associations" value="' + h(M.fields.associations.value) + '" aria-label="Associations">' +
      '</div>' + saveBar();
  }

  function preferencesSection() {
    var p = M.preferences;
    var sectorChips = LIF.SECTORS.map(function (s) {
      var on = p.sectors.indexOf(s.id) !== -1;
      return '<button class="chip ' + (on ? 'is-on' : '') + '" data-action="toggle-pref-sector" data-id="' + s.id + '" type="button">' + h(s.name) + '</button>';
    }).join('');

    var subChips = p.sectors.map(function (sid) {
      return (LIF.SUBSECTORS[sid] || []).map(function (name) {
        var on = p.subsectors.indexOf(name) !== -1;
        return '<button class="chip chip--sub ' + (on ? 'is-on' : '') + '" data-action="toggle-pref-subsector" data-name="' + h(name) + '" type="button">' + h(name) + '</button>';
      }).join('');
    }).join('');

    var langChips = LIF.LANGUAGES.map(function (l) {
      var on = p.languages.indexOf(l) !== -1;
      return '<button class="chip ' + (on ? 'is-on' : '') + '" data-action="toggle-pref-language" data-name="' + h(l) + '" type="button">' + h(l) + '</button>';
    }).join('');

    var totals = suggestedEvents().length + suggestedGroups().length + suggestedResources().length +
      suggestedCommons().length + suggestedPeople().length;

    return note('These six preferences are the only thing your suggestions are built from. Change one and every count on your dashboard updates as you watch — right now they are producing <b>' + totals + ' suggestions</b> across the playground.') +

      '<div class="section"><div class="section-head"><h4>Sectors</h4></div><div class="chip-wrap">' + sectorChips + '</div></div>' +

      '<div class="section"><div class="section-head"><h4>Subsectors</h4></div>' +
      '<p class="section-hint">Drawn from the sectors above.</p>' +
      '<div class="chip-wrap">' + (subChips || '<span class="section-hint">Pick a sector to narrow further.</span>') + '</div></div>' +

      '<div class="section"><div class="section-head"><h4>Distance</h4></div>' +
      '<p class="section-hint">How far you are willing to travel. Online events are always included, whatever this says.</p>' +
      '<div class="range-row"><input type="range" min="5" max="500" step="5" value="' + p.radiusKm + '" data-change="radius" aria-label="Radius in kilometres">' +
      '<span class="range-val" id="radiusVal">' + p.radiusKm + ' km</span></div></div>' +

      '<div class="section"><div class="section-head"><h4>Languages</h4></div><div class="chip-wrap">' + langChips + '</div></div>' +

      '<div class="section"><div class="section-head"><h4>Suggest me…</h4></div>' +
      toggleRow('Events', 'Include event suggestions on my dashboard.', p.wantEvents, 'pref-events') +
      toggleRow('Groups', 'Include group suggestions on my dashboard.', p.wantGroups, 'pref-groups') +
      '</div>' + saveBar();
  }

  function toggleRow(label, desc, checked, changeKey, extra) {
    return '<label class="toggle-row">' +
      '<span class="toggle-copy"><span class="toggle-label">' + h(label) + '</span><br><span class="toggle-desc">' + h(desc) + '</span></span>' +
      '<span class="switch"><input type="checkbox" data-change="' + changeKey + '" ' + (extra || '') + (checked ? ' checked' : '') + '>' +
      '<span class="switch-track"></span><span class="switch-thumb"></span></span></label>';
  }

  function privacySection() {
    return '<div class="section"><div class="section-head"><h4>Sharing agreements</h4></div>' +
      '<p class="section-hint">Activity only flows between two members when both have agreed — you must share, and they must have chosen to receive.</p>' +
      toggleRow('Share my activity with playmates', 'Let people you are connected to see what you register for, join and propose.', M.privacy.shareActivity, 'privacy-share') +
      toggleRow('Receive activity from playmates', 'Show me what my playmates are doing, when they have agreed to share it.', M.privacy.receiveActivity, 'privacy-receive') +
      toggleRow('Recommend groups and events', 'Use my preferences to suggest things. Turning this off empties every "Suggested" tab.', M.privacy.recommendations, 'privacy-recommend') +
      '</div>' +

      '<div class="section"><div class="section-head"><h4>What other members can see</h4></div>' +
      '<p class="section-hint">A live summary of your field switches. Change any of them under Profile → Details.</p>' +
      '<div class="chip-wrap">' + Object.keys(M.fields).map(function (k) {
        var f = M.fields[k];
        return '<span class="badge ' + (f.public ? 'badge--live' : 'badge--lock') + '">' + h(f.label) + ' · ' + (f.public ? 'public' : 'private') + '</span>';
      }).join('') + '</div></div>' +

      '<div class="section"><div class="section-head"><h4>Community guidelines</h4></div>' +
      '<p class="section-hint">You agreed to how we play together when you joined. You can reread them any time.</p>' +
      '<button class="btn btn--sm" data-action="pending" data-label="Opening the community guidelines" type="button">Read the guidelines</button></div>' +

      '<div class="section"><div class="section-head"><h4>Sign-in</h4></div>' +
      '<p class="section-hint">You sign in with a six-digit code emailed to you. This device is remembered for 30 days.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn--sm" data-action="pending" data-label="Forgetting this device" type="button">Forget this device</button>' +
      '<button class="btn btn--sm btn--danger" data-action="pending" data-label="Signing out everywhere" type="button">Sign out everywhere</button></div></div>' +
      saveBar();
  }

  function saveBar(noteText) {
    return '<div class="save-bar">' +
      '<button class="btn btn--gold" data-action="save-profile" type="button">' + svg('check') + ' Save changes</button>' +
      '<span class="save-note" id="saveNote">' + h(noteText || 'Required fields are checked before anything saves.') + '</span></div>';
  }

  /* =========================================================
   * 9. NOTIFICATIONS DRAWER (the master list)
   * ======================================================= */
  var notifFilter = 'all';

  function notificationsHtml() {
    var feed = LIF.NOTIFICATION_FEED.filter(function (n) { return M.notifications.features[n.feature] !== false; });
    var shown = notifFilter === 'all' ? feed
      : notifFilter === 'unread' ? feed.filter(function (n) { return n.unread; })
      : feed.filter(function (n) { return n.feature === notifFilter; });

    var muted = LIF.NOTIFICATION_FEED.length - feed.length;

    var filters = [['all', 'All'], ['unread', 'Unread']]
      .concat(FEATURES.filter(function (f) { return isAvailable(f.key); }).map(function (f) { return [f.key, f.name]; }))
      .map(function (t) {
        return '<button class="chip ' + (notifFilter === t[0] ? 'is-on' : '') + '" data-action="notif-filter" data-id="' + t[0] + '" type="button">' + h(t[1]) + '</button>';
      }).join('');

    var list = shown.length ? shown.map(function (n) {
      return '<article class="notif-row ' + (n.unread ? 'is-unread' : '') + '">' +
        '<span class="notif-dot" style="--nd:var(--a-' + notifColor(n.feature) + ')"></span>' +
        '<div style="flex:1;min-width:0"><div class="notif-title">' + h(n.title) + '</div>' +
        '<div class="notif-body">' + h(n.body) + '</div>' +
        '<div class="notif-time">' + h(relTime(n.at)) + ' · ' + h(feature(n.feature) ? feature(n.feature).name : n.feature) + '</div></div>' +
        '<div class="item-actions"><button class="btn btn--sm" data-action="pending" data-label="Opening “' + h(n.title) + '”" type="button">Open</button></div>' +
        '</article>';
    }).join('') : '<div class="empty"><h4>Nothing here</h4><p>Either everything is read, or this feature’s notifications are switched off below.</p></div>';

    return '<div class="detail-head" data-feature="events">' +
        '<span class="fc-icon">' + svg('bell') + '</span>' +
        '<div><h2 class="detail-title">Notifications</h2>' +
        '<p class="detail-desc">Your master list — everything from every feature, in one place, with the switches that control it.</p></div>' +
        '<div class="detail-head-actions">' +
          '<button class="btn btn--sm" data-action="mark-all-read" type="button">Mark all read</button>' +
          '<button class="icon-btn" data-action="close-drawer" type="button" aria-label="Close">' + svg('close') + '</button>' +
        '</div></div>' +
      '<div class="detail-body">' +
        '<div class="notif-filter">' + filters + '</div>' +
        (muted ? note(muted + ' notification' + (muted === 1 ? ' is' : 's are') + ' hidden because you switched that feature off below.') : '') +
        '<div class="item-list">' + list + '</div>' +

        '<div class="section"><div class="section-head"><h4>What you hear about</h4></div>' +
        '<p class="section-hint">Feature-level switches. Muting a single event or group is separate — do that on the item itself, and it will not touch these.</p>' +
        FEATURES.filter(function (f) { return isAvailable(f.key); }).map(function (f) {
          var on = M.notifications.features[f.key] !== false;
          return '<div class="matrix-row" data-feature="' + f.key + '">' +
            '<span class="matrix-icon">' + svg(f.key) + '</span>' +
            '<span class="matrix-name">' + h(f.name) + '</span>' +
            '<label class="switch"><input type="checkbox" data-change="notif-feature" data-key="' + f.key + '" ' + (on ? 'checked' : '') + '>' +
            '<span class="switch-track"></span><span class="switch-thumb"></span></label></div>';
        }).join('') + '</div>' +

        '<div class="section"><div class="section-head"><h4>Muted individually</h4></div>' +
        '<p class="section-hint">Events, groups and commons you silenced one at a time.</p>' +
        '<div class="chip-wrap">' + (M.notifications.mutedItems.length
          ? M.notifications.mutedItems.map(function (id) {
              var name = itemName(id);
              return '<button class="chip" data-action="toggle-mute" data-id="' + id + '" type="button">' + h(name) + ' ×</button>';
            }).join('')
          : '<span class="section-hint">Nothing muted.</span>') + '</div></div>' +

        '<div class="section"><div class="section-head"><h4>How they reach you</h4></div>' +
        '<div class="radio-stack">' + LIF.NOTIFY_CHANNELS.map(function (c) {
          var on = M.notifications.channel === c.id;
          return '<label class="radio-card ' + (on ? 'is-on' : '') + '">' +
            '<input type="radio" name="notif-channel" data-change="notif-channel" value="' + c.id + '" ' + (on ? 'checked' : '') + '>' +
            '<span><span class="radio-title">' + h(c.name) + '</span><br><span class="radio-desc">' + h(c.desc) + '</span></span></label>';
        }).join('') + '</div>' +
        '<div style="margin-top:13px"><div class="field-label" style="width:auto;margin-bottom:5px">Frequency</div>' +
        '<select class="select-input text-input" data-change="notif-frequency">' + LIF.NOTIFY_FREQUENCIES.map(function (f) {
          return '<option value="' + f.id + '" ' + (M.notifications.frequency === f.id ? 'selected' : '') + '>' + h(f.name) + '</option>';
        }).join('') + '</select></div></div>' +
        saveBar('Switches apply the moment you flip them. Saving only confirms the digest settings.') +
      '</div>';
  }

  function notifColor(key) {
    return {
      events: 'engagement', groups: 'community', connections: 'presence', commons: 'nature',
      resources: 'divine', opportunities: 'service', organizations: 'source', profile: 'divine'
    }[key] || 'divine';
  }

  function itemName(id) {
    var e = U.getEvent(id); if (e) return e.title;
    var g = getGroup(id);   if (g) return g.name;
    var c = getCommons(id); if (c) return c.name;
    var o = U.getOrganization(id); if (o) return o.name;
    return id;
  }

  /* =========================================================
   * 10. CUSTOMIZE DRAWER
   * ======================================================= */
  function customizeHtml() {
    var layouts = [
      ['constellation', 'Constellation', 'Your features ring a central map or calendar. Each card shows its own counts; open one for the full list.'],
      ['cards', 'Cards', 'A plain grid of the same cards, in whatever order you have them. Best on a narrow screen.'],
      ['sidebar', 'Sidebar', 'A rail of features on the left, the one you pick filling the space beside it.']
    ].map(function (l) {
      var on = M.dashboard.layout === l[0];
      return '<label class="radio-card ' + (on ? 'is-on' : '') + '">' +
        '<input type="radio" name="layout" data-change="layout" value="' + l[0] + '" ' + (on ? 'checked' : '') + '>' +
        '<span><span class="radio-title">' + h(l[1]) + '</span><br><span class="radio-desc">' + h(l[2]) + '</span></span></label>';
    }).join('');

    var feats = FEATURES.map(function (f) {
      var available = isAvailable(f.key);
      var on = available && M.dashboard.visibleFeatures[f.key] !== false;
      return '<div class="matrix-row" data-feature="' + f.key + '">' +
        '<span class="matrix-icon">' + svg(f.key) + '</span>' +
        '<span class="matrix-name">' + h(f.name) +
          (available ? '' : '<br><span class="matrix-muted">Appears once a partner organization verifies your membership.</span>') + '</span>' +
        '<label class="switch"><input type="checkbox" data-change="feature-visible" data-key="' + f.key + '" ' +
        (on ? 'checked' : '') + (available ? '' : ' disabled') + '>' +
        '<span class="switch-track"></span><span class="switch-thumb"></span></label></div>';
    }).join('');

    return '<div class="detail-head" data-feature="profile">' +
        '<span class="fc-icon">' + svg('profile') + '</span>' +
        '<div><h2 class="detail-title">Customize your dashboard</h2>' +
        '<p class="detail-desc">This only changes your own view. Hiding a feature here never leaves anything — you stay registered, and it is all still reachable from search.</p></div>' +
        '<div class="detail-head-actions"><button class="icon-btn" data-action="close-drawer" type="button" aria-label="Close">' + svg('close') + '</button></div>' +
      '</div>' +
      '<div class="detail-body">' +
        '<div class="section"><div class="section-head"><h4>Layout</h4></div>' +
        '<div class="radio-stack">' + layouts + '</div></div>' +

        '<div class="section"><div class="section-head"><h4>What sits in the centre</h4></div>' +
        '<p class="section-hint">Only used by the constellation layout.</p>' +
        '<div class="seg" style="display:inline-flex">' +
          '<button type="button" data-action="set-focus" data-focus="map" class="' + (M.dashboard.centreFocus === 'map' ? 'is-active' : '') + '">Map</button>' +
          '<button type="button" data-action="set-focus" data-focus="calendar" class="' + (M.dashboard.centreFocus === 'calendar' ? 'is-active' : '') + '">Calendar</button>' +
        '</div></div>' +

        '<div class="section"><div class="section-head"><h4>Features on your dashboard</h4></div>' +
        '<p class="section-hint">Show only what you actually use. Everything stays searchable either way.</p>' +
        feats + '</div>' +

        '<div class="section"><div class="section-head"><h4>Colour</h4></div>' +
        '<p class="section-hint">Your own theme, drawn from the LiF chakra palette. It follows you across every ' +
          'page of the playground, and changes nothing for anyone else.</p>' +
        themeRow() + '</div>' +

        '<div class="section"><div class="section-head"><h4>Interface language</h4></div>' +
        '<p class="section-hint">Your preferred language, applied every time you sign in.</p>' +
        '<select class="select-input text-input" data-change="language">' + LIF.UI_LANGUAGES.map(function (l) {
          return '<option value="' + l.code + '" ' + (M.preferredLanguage === l.code ? 'selected' : '') + '>' + h(l.native + ' — ' + l.label) + '</option>';
        }).join('') + '</select></div>' +

        '<div class="section"><button class="btn" data-action="reset-dashboard" type="button">Reset to the default layout</button></div>' +
      '</div>';
  }

  /* The theme picker itself lives in js/theme.js and is shared with
     the public hub and the event page; this is just the doorway. */
  function themeRow() {
    var t = LIF.theme.get();
    var tokens = LIF.theme.tokens();
    var fam = t.palette === 'house' ? LIF.theme.house : LIF.theme.palettes.find(function (x) { return x.id === t.palette; });
    var paper = LIF.theme.papers.find(function (x) { return x.id === t.paper; });
    var ramp = fam.rows[Math.min(t.row, fam.rows.length - 1)];

    return '<button class="theme-row" type="button" data-action="open-theme">' +
      '<span class="theme-row-ramp">' + ramp.map(function (hex) {
        return '<i style="background:' + hex + '"></i>';
      }).join('') + '</span>' +
      '<span class="theme-row-copy">' +
        '<strong>' + h(fam.name) + (t.row ? ' 2' : '') + ' on ' + h(paper.name.toLowerCase()) + ' paper</strong>' +
        '<span>' + h(tokens['--accent']) + (t.tint ? ' \u00B7 paper tinted to match' : '') + '</span>' +
      '</span>' +
      '<span class="theme-row-go">Change</span>' +
    '</button>';
  }

  /* =========================================================
   * 11. DRAWER PLUMBING
   * ======================================================= */
  function renderInto(container, key) {
    if (!container) return;
    var tab = view.tab || (TABS[key] ? TABS[key][0][0] : null);
    view.tab = tab;
    container.dataset.feature = key;
    container.innerHTML = detailHtml(key, tab);
    afterDetailRender(key, tab);
  }

  function afterDetailRender(key, tab) {
    if (key === 'events' && tab === 'calendar') mountCalendar('detailCalendar');
    if (key === 'connections' && M.dashboard.connectionsView === 'map' && tab !== 'activity') mountConnMap();

    var filter = $('#connFilter');
    if (filter) {
      filter.addEventListener('input', U.debounce(function () {
        var q = filter.value.trim().toLowerCase();
        $all('#connResults [data-search]').forEach(function (node) {
          node.classList.toggle('hidden', q && node.dataset.search.indexOf(q) === -1);
        });
      }, 160));
    }
  }

  function openFeature(key, tab) {
    view.feature = key;
    view.tab = tab || (TABS[key] ? TABS[key][0][0] : null);

    if (M.dashboard.layout === 'sidebar') {
      view.drawerMode = null;
      closeDrawer(true);
      $all('.rail-item').forEach(function (n) { n.classList.toggle('is-active', n.dataset.key === key); });
      renderInto($('#railDetail'), key);
      return;
    }
    view.drawerMode = 'feature';
    var drawer = $('#detailDrawer');
    drawer.dataset.feature = key;
    drawer.innerHTML = detailHtml(key, view.tab);
    afterDetailRender(key, view.tab);
    showDrawer();
    $all('.feature-card').forEach(function (c) { c.classList.toggle('is-open', c.dataset.key === key); });
  }

  function openDrawer(mode) {
    view.drawerMode = mode;
    var drawer = $('#detailDrawer');
    drawer.dataset.feature = mode === 'notifications' ? 'events' : 'profile';
    drawer.innerHTML = mode === 'notifications' ? notificationsHtml() : customizeHtml();
    showDrawer();
    renderHeaderBits();
  }

  function showDrawer() {
    $('#detailDrawer').classList.remove('hidden');
    $('#scrim').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer(silent) {
    $('#detailDrawer').classList.add('hidden');
    $('#scrim').classList.add('hidden');
    document.body.style.overflow = '';
    view.drawerMode = null;
    $all('.feature-card').forEach(function (c) { c.classList.remove('is-open'); });
    if (!silent) renderHeaderBits();
  }

  /* Re-render whatever detail is currently on screen, in place. */
  function refreshDetail() {
    if (view.drawerMode === 'notifications') { $('#detailDrawer').innerHTML = notificationsHtml(); }
    else if (view.drawerMode === 'customize') { $('#detailDrawer').innerHTML = customizeHtml(); }
    else if (view.drawerMode === 'feature') {
      $('#detailDrawer').innerHTML = detailHtml(view.feature, view.tab);
      afterDetailRender(view.feature, view.tab);
    } else if (M.dashboard.layout === 'sidebar') {
      renderInto($('#railDetail'), view.feature);
    }
  }

  function refreshAll() { renderBoard(); refreshDetail(); }

  /* =========================================================
   * 12. GLOBAL SEARCH
   * The dashboard is filtered by your preferences; this is not.
   * It reaches everything public in the playground plus whatever
   * your verified memberships unlock.
   * ======================================================= */
  function runSearch(q) {
    var box = $('#searchResults');
    q = q.trim().toLowerCase();
    if (q.length < 2) { box.classList.add('hidden'); return; }

    function hits(list, type, label, toText, colorVar) {
      return list.filter(function (i) { return toText(i).toLowerCase().indexOf(q) !== -1; })
        .slice(0, 4)
        .map(function (i) {
          var locked = type === 'event' && !isVisibleToMember(i);
          return { type: type, label: label, color: colorVar, locked: locked, item: i };
        });
    }

    var groups = [
      { label: 'Events',        rows: hits(LIF.EVENTS, 'event', 'Events', function (e) { return e.title + ' ' + e.summary + ' ' + (e.tags || []).join(' '); }, '--a-engagement') },
      { label: 'Groups',        rows: hits(LIF.GROUPS, 'group', 'Groups', function (g) { return g.name + ' ' + g.description; }, '--a-community') },
      { label: 'People',        rows: hits(LIF.PEOPLE, 'person', 'People', function (p) { return p.name + ' ' + p.city + ' ' + p.country + ' ' + p.bio; }, '--a-presence') },
      { label: 'Resources',     rows: hits(LIF.RESOURCES, 'resource', 'Resources', function (r) { return r.title + ' ' + r.summary + ' ' + r.kind; }, '--rose') },
      { label: 'Commons',       rows: hits(LIF.COMMONS, 'commons', 'Commons', function (c) { return c.name + ' ' + c.summary + ' ' + c.kind; }, '--a-nature') },
      { label: 'Opportunities', rows: hits(LIF.OPPORTUNITIES, 'opportunity', 'Opportunities', function (o) { return o.title + ' ' + o.description + ' ' + o.type; }, '--a-service') },
      { label: 'Organizations', rows: hits(LIF.ORGANIZATIONS, 'org', 'Organizations', function (o) { return o.name + ' ' + o.description; }, '--a-source') }
    ].filter(function (g) { return g.rows.length; });

    var total = groups.reduce(function (n, g) { return n + g.rows.length; }, 0);

    box.innerHTML = '<div class="search-scope">Searching the whole playground — not just your dashboard. ' +
      '<b>' + total + '</b> match' + (total === 1 ? '' : 'es') + '. Private items appear only where you have access.</div>' +
      (total ? groups.map(function (g) {
        return '<div class="search-group-label">' + h(g.label) + '</div>' + g.rows.map(function (r) {
          var i = r.item;
          var title = r.locked ? (i.host + ' members-only event') : (i.title || i.name);
          var meta = i.summary || i.description || i.bio || i.tagline || '';
          return '<button class="search-hit" data-action="search-hit" data-type="' + r.type + '" data-id="' + i.id + '" type="button">' +
            '<span class="search-hit-dot" style="--hit:var(' + r.color + ')"></span>' +
            '<span style="min-width:0"><span class="search-hit-title">' + h(title) + '</span><br>' +
            '<span class="search-hit-meta">' + h(String(meta).slice(0, 74)) + '</span></span>' +
            (r.locked ? '<span class="search-hit-lock">members only</span>' : '') + '</button>';
        }).join('');
      }).join('') : '<div class="empty" style="margin:8px"><h4>No matches</h4><p>Try a different word, or browse the full hub.</p></div>');

    box.classList.remove('hidden');
  }

  var SEARCH_TARGET = {
    event: ['events', 'registered'], group: ['groups', 'registered'], person: ['connections', 'playmates'],
    resource: ['resources', 'library'], commons: ['commons', 'explore'],
    opportunity: ['opportunities', 'open'], org: ['organizations', 'memberships']
  };

  /* =========================================================
   * 13. EVENT WIRING (delegated, so re-rendering never unbinds)
   * ======================================================= */
  var ACTIONS = {
    'open-feature': function (el) {
      $('#searchResults').classList.add('hidden');
      openFeature(el.dataset.key, el.dataset.tab || null);
    },
    'set-tab': function (el) {
      view.tab = el.dataset.tab;
      refreshDetail();
    },
    'close-drawer': function () { closeDrawer(); },
    'open-notifications': function () { openDrawer('notifications'); },
    'open-customize': function () { openDrawer('customize'); },

    'toggle-bell': function (el) {
      var key = el.dataset.key;
      M.notifications.features[key] = M.notifications.features[key] === false;
      persist();
      U.showToast('Notifications ' + (M.notifications.features[key] ? 'on' : 'off') + ' for ' + feature(key).name + '.');
      refreshAll();
    },

    /* Muting one item is deliberately NOT a profile-level change -
       the spec draws that line explicitly. It only touches the
       master list. */
    'toggle-mute': function (el) {
      var id = el.dataset.id;
      var i = M.notifications.mutedItems.indexOf(id);
      if (i === -1) M.notifications.mutedItems.push(id); else M.notifications.mutedItems.splice(i, 1);
      persist();
      U.showToast(i === -1
        ? 'Muted “' + itemName(id) + '”. Your profile-level notifications are untouched.'
        : 'Unmuted “' + itemName(id) + '”.');
      refreshDetail();
    },

    'toggle-bookmark': function (el) {
      var type = el.dataset.type, id = el.dataset.id;
      var list = type === 'event' ? M.events.bookmarked
        : type === 'group' ? M.groups.bookmarked
        : type === 'resource' ? M.resources.saved
        : M.opportunities.saved;
      var i = list.indexOf(id);
      if (i === -1) list.push(id); else list.splice(i, 1);
      U.showToast(i === -1 ? 'Saved to your dashboard.' : 'Removed from your dashboard.');
      refreshAll();
    },

    'set-focus': function (el) {
      M.dashboard.centreFocus = el.dataset.focus;
      persist(); refreshAll();
    },
    'set-conn-view': function (el) {
      M.dashboard.connectionsView = el.dataset.view;
      persist(); refreshDetail();
    },
    'set-layout': function (el) {
      M.dashboard.layout = el.dataset.layout;
      persist();
      closeDrawer(true);
      renderBoard();
    },

    'toggle-sector': function (el) { toggleIn(M.sectors, el.dataset.id); pruneSubsectors(); refreshAll(); },
    'toggle-subsector': function (el) { toggleIn(M.subsectors, el.dataset.name); refreshAll(); },
    'toggle-pref-sector': function (el) { toggleIn(M.preferences.sectors, el.dataset.id); prunePrefSubsectors(); persist(); refreshAll(); },
    'toggle-pref-subsector': function (el) { toggleIn(M.preferences.subsectors, el.dataset.name); persist(); refreshAll(); },
    'toggle-pref-language': function (el) { toggleIn(M.preferences.languages, el.dataset.name); persist(); refreshAll(); },

    'request-subsector': function () {
      var input = $('#newSubsector');
      if (!input || !input.value.trim()) { U.showToast('Type the subsector you want first.'); return; }
      U.showToast('Requested “' + input.value.trim() + '”. A steward reviews new subsectors before they join the taxonomy.');
      input.value = '';
    },

    'notif-filter': function (el) { notifFilter = el.dataset.id; refreshDetail(); },
    'mark-all-read': function () {
      LIF.NOTIFICATION_FEED.forEach(function (n) { n.unread = false; });
      U.showToast('All caught up.');
      refreshAll();
    },

    'save-profile': function () {
      var missing = Object.keys(M.fields).filter(function (k) {
        return M.fields[k].required && !String(M.fields[k].value || '').trim();
      });
      var note = $('#saveNote');
      if (missing.length) {
        note.textContent = 'Still needed: ' + missing.map(function (k) { return M.fields[k].label; }).join(', ') + '.';
        note.classList.add('is-error');
        return;
      }
      note.classList.remove('is-error');
      note.textContent = 'Saved on your screen. The backend will take this call over.';
      persist();
      U.showToast('Profile saved.');
      renderBoard();
    },

    'reset-dashboard': function () {
      M.dashboard.layout = 'constellation';
      M.dashboard.centreFocus = 'map';
      M.dashboard.connectionsView = 'cards';
      Object.keys(M.dashboard.visibleFeatures).forEach(function (k) { M.dashboard.visibleFeatures[k] = true; });
      persist();
      U.showToast('Back to the default layout.');
      closeDrawer(true);
      renderBoard();
    },

    'search-hit': function (el) {
      var target = SEARCH_TARGET[el.dataset.type];
      $('#searchResults').classList.add('hidden');
      $('#globalSearch').value = '';
      if (target) openFeature(target[0], target[1]);
      U.showToast('The full detail view for this opens once the backend is wired up.');
    },

    /* An event card's outstanding task, acted on in place. The RSVP
       and payment ones reopen the registration flow, which is where
       both of those actually live. */
    'event-task': function (el) {
      var id = el.dataset.id, task = el.dataset.task;
      var evt = LIF.events.get(id);
      if (!evt) return;
      if (task === 'rsvp' || task === 'pay') LIF.eventRegistration.open(id);
      else if (task === 'survey' && evt.postEvent.surveyUrl) window.open(evt.postEvent.surveyUrl, '_blank', 'noopener');
      else if (task === 'followup') location.href = 'event.html?id=' + id;
    },

    'open-theme': function () { LIF.theme.open(); },

    'withdraw-request': function (el) {
      LIF.groups.withdrawRequest(el.dataset.id);
      U.showToast('Request withdrawn. Nothing is kept beyond the audit record.');
      refreshAll();
    },

    'pending': function (el) { pending(el.dataset.label || 'That action'); }
  };

  function toggleIn(arr, val) {
    var i = arr.indexOf(val);
    if (i === -1) arr.push(val); else arr.splice(i, 1);
  }
  function pruneSubsectors() {
    M.subsectors = M.subsectors.filter(function (name) {
      return M.sectors.some(function (sid) { return (LIF.SUBSECTORS[sid] || []).indexOf(name) !== -1; });
    });
  }
  function prunePrefSubsectors() {
    M.preferences.subsectors = M.preferences.subsectors.filter(function (name) {
      return M.preferences.sectors.some(function (sid) { return (LIF.SUBSECTORS[sid] || []).indexOf(name) !== -1; });
    });
  }

  var CHANGES = {
    'field-public': function (el) {
      M.fields[el.dataset.field].public = el.checked;
      refreshDetail(); renderHeaderBits();
    },
    'intro':        function (el) { M.intro = el.value; },
    'associations': function (el) { M.fields.associations.value = el.value; },
    /* Fires on release, not on every tick - see the input listener
       below, which only moves the label while the thumb is dragging. */
    'radius':       function (el) {
      M.preferences.radiusKm = +el.value;
      persist();
      refreshAll();
    },
    'pref-events':  function (el) { M.preferences.wantEvents = el.checked; persist(); refreshAll(); },
    'pref-groups':  function (el) { M.preferences.wantGroups = el.checked; persist(); refreshAll(); },
    'privacy-share':     function (el) { M.privacy.shareActivity = el.checked; persist(); refreshAll(); },
    'privacy-receive':   function (el) { M.privacy.receiveActivity = el.checked; persist(); refreshAll(); },
    'privacy-recommend': function (el) { M.privacy.recommendations = el.checked; persist(); refreshAll(); },
    'notif-feature':  function (el) { M.notifications.features[el.dataset.key] = el.checked; persist(); refreshAll(); },
    'notif-channel':  function (el) { M.notifications.channel = el.value; persist(); refreshDetail(); },
    'notif-frequency':function (el) { M.notifications.frequency = el.value; persist(); U.showToast('Digest frequency updated.'); },
    'feature-visible':function (el) { M.dashboard.visibleFeatures[el.dataset.key] = el.checked; persist(); renderBoard(); },
    'layout':         function (el) { M.dashboard.layout = el.value; persist(); renderBoard(); refreshDetail(); },
    'language':       function (el) {
      M.preferredLanguage = el.value;
      $('#langSelect').value = el.value;
      persist();
      announceLanguage();
    }
  };

  /* The language selector is real in intent but not yet in effect:
     it stores the choice and says so plainly rather than pretending
     to translate. Wire it to your translation layer here - note the
     spec's ask that static templates (event and group invitations)
     get translated too, which a client-side widget alone will not do. */
  function announceLanguage() {
    var l = LIF.UI_LANGUAGES.find(function (x) { return x.code === M.preferredLanguage; });
    U.showToast('Preferred language set to ' + (l ? l.label : M.preferredLanguage) +
      '. Translation is wired at the platform level, including invitation templates.');
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (el && ACTIONS[el.dataset.action]) {
        e.preventDefault();
        ACTIONS[el.dataset.action](el);
        return;
      }
      /* clicking outside the search results closes them */
      if (!e.target.closest('.global-search')) $('#searchResults').classList.add('hidden');
    });

    document.addEventListener('change', function (e) {
      var el = e.target.closest('[data-change]');
      if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el);
    });
    document.addEventListener('input', function (e) {
      var el = e.target.closest('[data-change="radius"]');
      if (!el) return;
      M.preferences.radiusKm = +el.value;
      var out = $('#radiusVal');
      if (out) out.textContent = el.value + ' km';
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#searchResults').classList.contains('hidden')) $('#searchResults').classList.add('hidden');
        else if (view.drawerMode) closeDrawer();
      }
      if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('feature-card')) {
        openFeature(e.target.dataset.key);
      }
    });

    $('#scrim').addEventListener('click', function () { closeDrawer(); });
    $('#bellBtn').addEventListener('click', function () { openDrawer('notifications'); });
    $('#customizeBtn').addEventListener('click', function () { openDrawer('customize'); });
    $('#avatarBtn').addEventListener('click', function () { openFeature('profile', 'details'); });

    $all('#layoutSwitch button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        M.dashboard.layout = btn.dataset.layout;
        persist();
        closeDrawer(true);
        renderBoard();
      });
    });

    var search = $('#globalSearch');
    search.addEventListener('input', U.debounce(function () { runSearch(search.value); }, 180));
    search.addEventListener('focus', function () { if (search.value.trim().length > 1) runSearch(search.value); });

    $('#langSelect').addEventListener('change', function () {
      M.preferredLanguage = this.value;
      persist();
      announceLanguage();
    });

    window.addEventListener('resize', U.debounce(function () {
      if (mapObj) mapObj.invalidateSize();
      if (connMapObj) connMapObj.invalidateSize();
    }, 200));
  }

  /* =========================================================
   * 14. INIT
   * ======================================================= */
  function init() {
    restore();

    $('#langSelect').innerHTML = LIF.UI_LANGUAGES.map(function (l) {
      return '<option value="' + l.code + '">' + h(l.native) + '</option>';
    }).join('');
    $('#langSelect').value = M.preferredLanguage;

    bind();

    /* Registering, RSVPing or proposing anywhere in the app writes to
       the events store and fires this. The dashboard is a view of that
       store, so it simply re-reads rather than trying to patch itself. */
    document.addEventListener('lif:eventschange', U.debounce(function () { refreshAll(); }, 60));
    document.addEventListener('lif:groupschange', U.debounce(function () { refreshAll(); }, 60));
    document.addEventListener('lif:themechange', function () {
      if (view.drawerMode === 'customize') refreshDetail();
    });

    renderBoard();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { openFeature: openFeature, refreshAll: refreshAll };
})();
