/**
 * dashboard.js
 * ---------------------------------------------------------------
 * The collapsible personal dashboard sidebar - the AT-A-GLANCE view
 * that rides along with the events map. The full dashboard is its own
 * page now (dashboard.html + js/dashboardPage.js); this stays as the
 * quick peek you get without leaving the map, and links across to it.
 *
 * Reads entirely from LIF.CURRENT_MEMBER, which is clearly flagged as
 * a sample profile - swap it for the real session data once accounts
 * exist. Visibility is controlled by the "dashboard" feature toggle
 * in More Features.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.dashboard = (function () {
  var U = LIF.util;
  var initials = U.initials;

  function render() {
    var panel = U.$('#dashboardSidebar');
    if (!panel) return;
    var m = LIF.CURRENT_MEMBER;

    var interestTags = m.interestedAspects.map(function (id) {
      var a = U.getAspect(id);
      return a ? '<span class="badge badge--chakra chakra-' + a.chakra + '">' + U.escapeHtml(a.name) + '</span>' : '';
    }).join(' ') + ' ' + m.interestedSectors.map(function (id) {
      var s = U.getSector(id);
      return s ? '<span class="badge">' + U.escapeHtml(s.name) + '</span>' : '';
    }).join(' ');

    var upcomingHtml = m.upcomingEventIds.map(function (id) {
      var evt = U.getEvent(id);
      if (!evt) return '';
      var aspect = U.getAspect(evt.aspect);
      return '<div class="dash-mini-event" data-open-event="' + evt.id + '">' +
        '<div class="dash-mini-event-dot chakra-' + (aspect ? aspect.chakra : 'heart') + '"></div>' +
        '<div><div class="dash-mini-event-title">' + U.escapeHtml(evt.title) + '</div>' +
        '<div class="dash-mini-event-date">' + U.escapeHtml(U.formatDateRange(evt.start)) + '</div></div>' +
        '</div>';
    }).join('') || '<p style="font-size:13px;color:var(--ink-faint);">No upcoming events yet - events you register for will show up here.</p>';

    var groupsHtml = m.groupIds.map(function (id) {
      var g = LIF.GROUPS.find(function (x) { return x.id === id; });
      return g ? '<div class="dash-note">' + U.escapeHtml(g.name) + '</div>' : '';
    }).join('') || '<p style="font-size:13px;color:var(--ink-faint);">Not part of any groups yet.</p>';

    var connectionsHtml = m.connectionIds.map(function (id) {
      var p = LIF.PEOPLE.find(function (x) { return x.id === id; });
      return p ? '<span class="avatar avatar--sm" title="' + U.escapeHtml(p.name) + '">' + initials(p.name) + '</span>' : '';
    }).join(' ') || '<p style="font-size:13px;color:var(--ink-faint);">No connections yet.</p>';

    var notesHtml = m.notifications.map(function (n) { return '<div class="dash-note">' + U.escapeHtml(n) + '</div>'; }).join('');

    panel.innerHTML =
      '<h3>My hub</h3>' +
      '<div class="dash-profile">' +
      '<div class="avatar">' + initials(m.name) + '</div>' +
      '<div><div class="dash-profile-name">' + U.escapeHtml(m.name) + '</div>' +
      '<div class="dash-profile-meta">' + U.escapeHtml(m.location) + '</div>' +
      (m.isDemoProfile ? '<span class="dash-demo-flag">sample profile</span>' : '') +
      '</div></div>' +
      '<div class="dash-section"><h3>Interested in</h3><div style="display:flex;flex-wrap:wrap;gap:4px;">' + interestTags + '</div></div>' +
      '<div class="dash-section"><h3>Upcoming events</h3>' + upcomingHtml + '</div>' +
      '<div class="dash-section"><h3>My groups</h3>' + groupsHtml + '</div>' +
      '<div class="dash-section"><h3>Connections</h3><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">' + connectionsHtml + '</div></div>' +
      '<div class="dash-section"><h3>Updates since last visit</h3>' + notesHtml + '</div>' +
      '<a class="btn-text" id="editProfileBtn" href="dashboard.html" style="padding-left:0;display:inline-block;">Open my full dashboard \u2192</a>';

    U.$all('[data-open-event]', panel).forEach(function (node) {
      node.addEventListener('click', function () { LIF.eventDetail.open(node.dataset.openEvent); });
    });
    // The full dashboard (dashboard.html) is a real page now, so this
    // is a plain link rather than a backend placeholder.
  }

  return { render: render };
})();
