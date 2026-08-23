/**
 * eventDetail.js
 * ---------------------------------------------------------------
 * The full event view - opened from a map pin, a card, or the
 * calendar. Registration is a backend placeholder (per your note);
 * calendar export, the invite link, and copy-link are real, since
 * those genuinely don't need a server.
 *
 * Organization-private events (visibility: "organization") always
 * render in their gated state here, since there's no real sign-in
 * yet - this demonstrates what a non-member sees, per the framework
 * doc's Organization Access section.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.eventDetail = (function () {
  var U = LIF.util;

  function labelFor(list, id) {
    var found = list.find(function (x) { return x.id === id; });
    return found ? found.name : id;
  }

  function metaRow(label, value) {
    return '<div class="modal-meta-row"><strong>' + label + '</strong><span>' + U.escapeHtml(value) + '</span></div>';
  }

  function buildBadges(evt, gated) {
    var aspect = U.getAspect(evt.aspect);
    var sector = U.getSector(evt.sector);
    var badges = [];
    if (aspect) badges.push('<span class="badge badge--chakra">' + U.escapeHtml(aspect.name) + '</span>');
    if (!gated && sector) badges.push('<span class="badge">' + U.escapeHtml(sector.name) + '</span>');
    badges.push('<span class="badge">' + labelFor(LIF.FORMATS, evt.format) + '</span>');
    if (!gated) badges.push('<span class="badge">' + labelFor(LIF.EVENT_TYPES, evt.type) + '</span>');
    if (gated) badges.push('<span class="badge badge--lock">Members only \u00B7 ' + U.escapeHtml(evt.host) + '</span>');
    return badges.join('');
  }

  function buildActions(gated) {
    if (gated) {
      return '<button class="btn-primary" data-action="signin">Sign in</button>' +
        '<button class="btn-secondary" data-action="close">Close</button>';
    }
    return '<button class="btn-primary" data-action="register">Register</button>' +
      '<button class="btn-secondary" data-action="gcal">Add to Google Calendar</button>' +
      '<button class="btn-secondary" data-action="ics">Download .ics</button>' +
      '<button class="btn-secondary" data-action="invite">Invite a friend</button>' +
      '<button class="btn-text" data-action="copy">Copy link</button>';
  }

  function render(evt) {
    var gated = evt.visibility === 'organization';
    var aspect = U.getAspect(evt.aspect);
    var chakraClass = 'chakra-' + (aspect ? aspect.chakra : 'heart');
    var modalEl = U.$('#eventModal .modal');
    modalEl.className = 'modal ' + chakraClass;

    var title = gated ? evt.host + ' Members-Only Event' : evt.title;
    var whereValue = evt.location
      ? [evt.location.venue, evt.location.city, evt.location.country].filter(Boolean).join(', ')
      : (evt.format === 'hybrid' ? 'Online (in-person option also available)' : 'Online');

    var body = '';
    body += '<div class="modal-badges">' + buildBadges(evt, gated) + '</div>';
    body += '<h2 class="modal-title">' + U.escapeHtml(title) + '</h2>';
    body += metaRow('When', U.formatDateRange(evt.start, evt.end));
    body += metaRow('Duration', evt.durationLabel + ' \u00B7 ' + labelFor(LIF.COMMITMENTS, evt.commitment));
    if (!gated) {
      body += metaRow('Where', whereValue);
      body += metaRow('Cost', labelFor(LIF.COSTS, evt.cost));
      body += metaRow('Language', evt.language);
    }
    body += metaRow('Host', evt.host);

    if (gated) {
      var org = U.getOrganization(evt.organization);
      body += '<div class="modal-gate">' + U.escapeHtml((org && org.memberOnlyNote) || 'Sign in to see full details.') + ' This card is here to show how organization-private events look to a member versus a non-member.</div>';
    } else {
      body += '<p class="modal-description">' + U.escapeHtml(evt.description) + '</p>';
      body += '<div class="modal-capacity">' + evt.registered + ' / ' + evt.capacity + ' registered' + (evt.onlineLink ? ' \u00B7 join link sent after registering' : '') + '</div>';
    }

    body += '<div class="modal-actions">' + buildActions(gated) + '</div>';

    U.$('#eventModal .modal-body').innerHTML = body;
    bindActions(evt);
  }

  function bindActions(evt) {
    var actionsEl = U.$('#eventModal .modal-actions');
    actionsEl.onclick = function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      if (action === 'register') U.backendPlaceholder('Registering for "' + evt.title + '"');
      else if (action === 'signin') U.backendPlaceholder('Signing in');
      else if (action === 'close') close();
      else if (action === 'gcal') window.open(U.buildGoogleCalendarUrl(evt), '_blank', 'noopener');
      else if (action === 'ics') U.buildIcsAndDownload(evt);
      else if (action === 'invite') window.location.href = U.buildMailtoInvite(evt);
      else if (action === 'copy') U.copyToClipboard(window.location.href.split('#')[0] + '#event=' + evt.id);
    };
  }

  function open(id) {
    var evt = U.getEvent(id);
    if (!evt) return;
    LIF.state.selectedEventId = id;
    render(evt);
    U.$('#eventModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    U.$('#eventModal').classList.add('hidden');
    document.body.style.overflow = '';
    LIF.state.selectedEventId = null;
  }

  function init() {
    var overlay = U.$('#eventModal');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    U.$('#eventModal .modal-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close(); });
  }

  return { init: init, open: open, close: close };
})();
