/**
 * eventPage.js
 * ---------------------------------------------------------------
 * The event's own page — every link in the pathway lands here:
 * a card, a map pin, a calendar entry, an email, a private message,
 * a friend's profile. It is the only place registration actually
 * happens, which is why every one of those routes to it rather
 * than trying to register in place.
 *
 * The page renders one of four faces depending on where the event
 * is in its life:
 *
 *   pending    – the proposer's own view while a steward reads it
 *   active     – details + register / closed / already-registered
 *   complete   – recordings, notes, survey, continue the conversation
 *   cancelled  – what happened and what the host is doing instead
 *
 * Plus a fifth, only for the host: the tools panel — edit, cancel,
 * repeat with new dates, and the post-event follow-up composer.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.eventPage = (function () {
  var U = LIF.util;
  var h = U.escapeHtml;
  var E = LIF.events;

  var evt = null;
  var mapObj = null;
  var followUp = null;   // the host's in-progress follow-up
  var repeatDraft = null;

  /* =========================================================
   * Helpers
   * ======================================================= */
  function q(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function label(list, id) {
    var f = list.find(function (x) { return x.id === id; });
    return f ? f.name : id;
  }
  function whenLine(e) {
    if (e.sessions.length === 1) return U.formatDateRange(e.start, e.end);
    return e.sessions.length + ' sessions · ' + U.formatDate(U.parseIsoParts(e.start)) +
      ' to ' + U.formatDate(U.parseIsoParts(e.sessions[e.sessions.length - 1].end));
  }
  function whereLine(e) {
    if (e.location) {
      return [e.location.venue, e.location.city, e.location.region, e.location.country].filter(Boolean).join(', ') +
        (e.format === 'hybrid' ? ' — and online' : '');
    }
    return e.format === 'hybrid' ? 'Online, with an in-person option' : 'Online';
  }
  function daysUntil(iso) {
    return Math.ceil((new Date(iso) - new Date()) / 86400000);
  }

  /* =========================================================
   * Sections
   * ======================================================= */
  function statusBanner(e) {
    var st = E.registrationState(e);
    var meta = E.statusMeta(e.status);
    if (e.status === 'active' && st.code === 'open') return '';
    var tone = e.status === 'cancelled' ? 'bad' : e.status === 'complete' ? 'done' : e.status === 'pending' ? 'wait' : 'warn';
    return '<div class="ev-banner ev-banner--' + tone + '">' +
      '<strong>' + h(meta.name) + '</strong>' +
      '<span>' + h(e.cancelledReason || st.why || meta.desc) + '</span>' +
    '</div>';
  }

  function hero(e) {
    var aspect = U.getAspect(e.aspect);
    var sector = U.getSector(e.sector);
    return '<header class="ev-hero">' +
      '<div class="ev-cover" style="background:' + E.coverCss(e) + '"></div>' +
      '<div class="ev-hero-body">' +
        '<div class="ev-badges">' +
          '<span class="ev-badge ev-badge--status ev-status-' + h(e.status) + '">' + h(E.statusMeta(e.status).name) + '</span>' +
          (aspect ? '<span class="ev-badge">' + h(aspect.name) + '</span>' : '') +
          (sector ? '<span class="ev-badge">' + h(sector.name) + '</span>' : '') +
          (e.subsector ? '<span class="ev-badge">' + h(e.subsector) + '</span>' : '') +
          '<span class="ev-badge">' + h(E.typeName(e.type)) + '</span>' +
          '<span class="ev-badge">' + h(label(LIF.FORMATS, e.format)) + '</span>' +
          (e.access === 'private' ? '<span class="ev-badge ev-badge--lock">Invitation only</span>' : '') +
          (e.occurrence > 1 ? '<span class="ev-badge">Session ' + e.occurrence + ' of this series</span>' : '') +
        '</div>' +
        '<h1 class="ev-title">' + h(e.title) + '</h1>' +
        '<p class="ev-summary">' + h(e.summary) + '</p>' +
        '<p class="ev-id mono">' + h(e.eventId) + '</p>' +
      '</div>' +
    '</header>';
  }

  function detailsCard(e) {
    var rows = [
      ['When', h(whenLine(e)) + (e.recurrenceNote ? '<br><em>' + h(e.recurrenceNote) + '</em>' : '') +
        '<br><small class="mono">times shown at the venue’s own clock (UTC' + h(e.timezone) + ')</small>'],
      ['Where', h(whereLine(e))],
      ['Host', hostLine(e)],
      ['Cost', h(E.paymentLabel(e)) + (e.payment.note ? '<br><small>' + h(e.payment.note) + '</small>' : '')],
      ['Language', h((e.languages || [e.language]).join(', '))],
      ['Duration', h(e.durationLabel) + ' · ' + h(label(LIF.COMMITMENTS, e.commitment))],
      ['Recording', e.recording.mode === 'recorded'
        ? 'Recorded — shared with ' + h(label(LIF.RECORDING_ACCESS, e.recording.access).toLowerCase())
        : 'Live only. Nothing is recorded.'],
      ['Register by', h(E.fmtDay(e.registerBy))]
    ];
    if (e.participants && (e.participants.min || e.participants.max)) {
      rows.push(['Places', (e.registered || 0) + ' registered' +
        (e.participants.max ? ' of ' + e.participants.max : '') +
        (e.participants.min ? '<br><small>Runs with at least ' + e.participants.min + '</small>' : '')]);
    }

    return '<section class="ev-card">' +
      '<h2>The details</h2>' +
      '<dl class="ev-dl">' + rows.map(function (r) {
        return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
      }).join('') + '</dl>' +
      (e.sessions.length > 1
        ? '<h3 class="ev-h3">Every session</h3><ol class="ev-sessions">' + e.sessions.map(function (s) {
            return '<li><span class="mono">' + h(U.formatDateRange(s.start, s.end)) + '</span></li>';
          }).join('') + '</ol>'
        : '') +
    '</section>';
  }

  function hostLine(e) {
    var d = e.hostDetail || {};
    var out = h(d.name || e.host);
    if (d.kind === 'group') out += ' <small>(a group)</small>';
    if (d.coHosts && d.coHosts.length) {
      out += '<br><small>with ' + d.coHosts.map(function (c) { return h(c.name); }).join(', ') + '</small>';
    }
    if (d.responsesTo && d.responsesTo.length) {
      out += '<br><small>replies go to ' + d.responsesTo.map(h).join(', ') + '</small>';
    }
    return out;
  }

  function aboutCard(e) {
    return '<section class="ev-card">' +
      '<h2>About this gathering</h2>' +
      '<div class="ev-prose">' + h(e.description).split('\n').filter(Boolean)
        .map(function (p) { return '<p>' + p + '</p>'; }).join('') + '</div>' +
      (e.audienceNote
        ? '<div class="ev-aside"><strong>Who this is for</strong><p>' + h(e.audienceNote) + '</p></div>'
        : '') +
      (e.access === 'private' && e.inviteNote
        ? '<div class="ev-aside"><strong>How people are invited</strong><p>' + h(e.inviteNote) + '</p></div>'
        : '') +
      (e.overflowPlan || e.underMinPlan
        ? '<div class="ev-aside"><strong>If numbers do not land where we hope</strong>' +
          (e.overflowPlan ? '<p>Too many: ' + h(e.overflowPlan) + '</p>' : '') +
          (e.underMinPlan ? '<p>Too few: ' + h(e.underMinPlan) + '</p>' : '') + '</div>'
        : '') +
      (e.tags && e.tags.length
        ? '<div class="ev-tags">' + e.tags.map(function (t) { return '<span class="ev-tag">' + h(t) + '</span>'; }).join('') + '</div>'
        : '') +
    '</section>';
  }

  function locationCard(e) {
    if (!e.location || e.location.lat == null) return '';
    return '<section class="ev-card">' +
      '<h2>Getting there</h2>' +
      '<p class="ev-prose"><p>' + h(whereLine(e)) + '</p></p>' +
      '<div class="ev-map" id="evMap"></div>' +
    '</section>';
  }

  /* --- the register panel, which is the whole point of the page --- */
  function registerPanel(e) {
    var st = E.registrationState(e);
    var reg = E.registrationFor(e.id);
    var L = LIF.calendarLinks;
    var pct = e.participants.max ? Math.min(100, Math.round((e.registered / e.participants.max) * 100)) : null;
    var days = daysUntil(e.start);

    var button;
    if (st.code === 'open') {
      button = '<button class="ev-cta" type="button" data-register-event="' + h(e.id) + '">Register' +
        (e.payment.model !== 'free' ? ' · ' + h(E.paymentLabel(e)) : '') + '</button>';
    } else if (st.code === 'registered') {
      button = '<div class="ev-cta ev-cta--done">✓ You are registered</div>' +
        (E.isAttendable(e)
          ? '<a class="ev-cta ev-cta--attend" href="' + h(e.onlineLink || '#') + '" target="_blank" rel="noopener">Attend now</a>'
          : '') +
        '<button class="ev-linkbtn" type="button" data-register-event="' + h(e.id) + '">Manage my registration</button>';
    } else {
      button = '<div class="ev-cta ev-cta--closed">' + h(st.label) + '</div>' +
        (st.code === 'closed' || st.code === 'full'
          ? '<button class="ev-linkbtn" type="button" data-do="notify">' +
            (E.wantsNotice(e.id) ? '✓ You will be told if it reopens' : 'Tell me if it reopens or runs again') + '</button>'
          : '');
    }

    var tasks = E.tasksFor(e.id);

    return '<aside class="ev-panel">' +
      '<div class="ev-panel-inner">' +
        '<p class="ev-panel-when mono">' + h(whenLine(e)) + '</p>' +
        (e.status === 'active' && days >= 0
          ? '<p class="ev-panel-count">' + (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : 'In ' + days + ' days') + '</p>'
          : '') +
        button +
        (st.why && st.code !== 'registered' ? '<p class="ev-panel-why">' + h(st.why) + '</p>' : '') +

        /* The spec's "invite people who are not on the playground yet"
           case: they can read everything on this page, and only need
           an account at the point of registering. Say so here rather
           than at the point of refusal. */
        (st.code === 'open'
          ? '<p class="ev-panel-note">Anyone can read this page. Registering needs a LiF Playground profile — ' +
            'signing up takes a minute and brings you straight back here.</p>'
          : '') +

        (pct != null
          ? '<div class="ev-meter"><span style="width:' + pct + '%"></span></div>' +
            '<p class="ev-panel-note">' + e.registered + ' of ' + e.participants.max + ' places taken</p>'
          : '') +

        (tasks.length
          ? '<div class="ev-tasks"><strong>Waiting on you</strong>' + tasks.map(function (t) {
              return '<button type="button" class="ev-task" data-do="task" data-value="' + h(t.action) + '">' + h(t.label) + '</button>';
            }).join('') + '</div>'
          : '') +

        (reg && reg.rsvp
          ? '<p class="ev-panel-note">RSVP: <strong>' + h(reg.rsvp.replace('-', ' ')) + '</strong></p>'
          : '') +

        '<div class="ev-panel-links">' +
          '<a href="' + h(L.google(e)) + '" target="_blank" rel="noopener">Google Calendar</a>' +
          '<a href="' + h(L.outlook(e)) + '" target="_blank" rel="noopener">Outlook</a>' +
          '<a href="' + h(L.yahoo(e)) + '" target="_blank" rel="noopener">Yahoo</a>' +
          '<button type="button" data-do="ics">.ics file</button>' +
          '<a href="' + h(L.mailtoInvite(e)) + '">Invite a friend</a>' +
          '<button type="button" data-do="copy">Copy link</button>' +
        '</div>' +

        (e.recording.mode === 'recorded'
          ? '<p class="ev-panel-note ev-rec">● This session ' + (e.status === 'complete' ? 'was' : 'will be') + ' recorded.</p>'
          : '<p class="ev-panel-note">Live only — ' + (e.status === 'complete' ? 'nothing was recorded.' : 'not recorded.') + '</p>') +

        (reg
          ? '<p class="ev-panel-note">Reminders ' + (reg.reminders ? 'on' : 'off') +
            ' <button type="button" class="ev-linkbtn ev-linkbtn--inline" data-do="toggle-reminders">change</button></p>'
          : '') +
      '</div>' +
    '</aside>';
  }

  /* --- after the event --- */
  function postEventCard(e) {
    if (e.status !== 'complete') return '';
    var pe = e.postEvent;
    var canWatch = E.canSeeRecording(e);
    var reg = E.registrationFor(e.id);

    return '<section class="ev-card ev-card--after">' +
      '<h2>After the gathering</h2>' +
      (pe.hostNote
        ? '<blockquote class="ev-hostnote">' + h(pe.hostNote) +
          '<footer>— ' + h((e.hostDetail && e.hostDetail.name) || e.host) + '</footer></blockquote>'
        : '<p class="ev-prose"><p>The host has not posted a follow-up yet. When they do it lands here, in your inbox ' +
          'and on your event card.</p></p>') +

      (pe.recordingUrl
        ? (canWatch
          ? '<a class="ev-btn ev-btn--primary" href="' + h(pe.recordingUrl) + '" target="_blank" rel="noopener">Watch the recording</a>'
          : '<div class="ev-locked">The recording is shared with ' +
            h(label(LIF.RECORDING_ACCESS, e.recording.access).toLowerCase()) + '. ' +
            (reg ? 'Your registration does not cover it.' : 'You were not registered for this one.') + '</div>')
        : (e.recording.mode === 'recorded'
          ? '<p class="ev-hint">A recording was made and is still being prepared.</p>' : '')) +

      (pe.resources && pe.resources.length
        ? '<h3 class="ev-h3">What was shared</h3><ul class="ev-resources">' + pe.resources.map(function (r) {
            return '<li><a href="' + h(r.url) + '" target="_blank" rel="noopener">' + h(r.name) + '</a></li>';
          }).join('') + '</ul>'
        : '') +

      (pe.surveyUrl
        ? '<div class="ev-aside"><strong>How was it?</strong>' +
          '<p>A short questionnaire, with room to say whatever the tick boxes miss.</p>' +
          '<a class="ev-btn ev-btn--ghost" href="' + h(pe.surveyUrl) + '" target="_blank" rel="noopener">Share your input</a></div>'
        : '') +

      '<div class="ev-after-actions">' +
        '<button class="ev-btn ev-btn--ghost" type="button" data-do="thread">Continue the conversation</button>' +
        '<button class="ev-btn ev-btn--ghost" type="button" data-do="propose-group">Create a group from this event</button>' +
      '</div>' +
      threadHtml(e) +
    '</section>';
  }

  var threadOpen = false;
  function threadHtml(e) {
    if (!threadOpen) return '';
    var posts = E.thread(e.id);
    return '<div class="ev-thread">' +
      '<h3 class="ev-h3">Continuing the conversation</h3>' +
      '<p class="ev-hint">Everyone who came can post here. A group can grow out of it — the button above starts that ' +
        'pathway and links the new group to this event ID.</p>' +
      (posts.length
        ? '<ul class="ev-posts">' + posts.map(function (p) {
            return '<li><strong>' + h(p.author) + '</strong> <span class="mono">' + h(new Date(p.at).toLocaleString()) + '</span>' +
              '<p>' + h(p.text) + '</p></li>';
          }).join('') + '</ul>'
        : '<p class="ev-hint">Nothing here yet. Say the thing you did not get to say on the night.</p>') +
      '<textarea class="ev-input" id="evPost" rows="3" placeholder="Add to the conversation…"></textarea>' +
      '<button class="ev-btn ev-btn--primary" type="button" data-do="post">Post</button>' +
    '</div>';
  }

  /* --- the host's own controls --- */
  function hostTools(e) {
    if (!E.isHost(e)) return '';
    var siblings = LIF.EVENTS.filter(function (x) { return x.seriesId === e.seriesId; });

    return '<section class="ev-card ev-card--host">' +
      '<h2>Host tools</h2>' +
      '<p class="ev-hint">Only you and LiF admins see this panel. Editing details notifies everyone registered.</p>' +

      '<div class="ev-after-actions">' +
        '<button class="ev-btn ev-btn--ghost" type="button" data-do="edit">Edit event details</button>' +
        '<button class="ev-btn ev-btn--ghost" type="button" data-do="repeat">Run it again on new dates</button>' +
        (e.status === 'active'
          ? '<button class="ev-btn ev-btn--danger" type="button" data-do="cancel-event">Cancel this event</button>'
          : '') +
      '</div>' +

      (siblings.length > 1
        ? '<p class="ev-hint">This series has ' + siblings.length + ' occurrences: ' +
          siblings.map(function (s) {
            return '<a href="event.html?id=' + h(s.id) + '">' + h(s.eventId) + '</a>';
          }).join(', ') + '.</p>'
        : '') +

      (repeatDraft ? repeatForm(e) : '') +
      (e.status === 'complete' ? followUpComposer(e) : '') +
    '</section>';
  }

  function repeatForm(e) {
    return '<div class="ev-subform">' +
      '<h3 class="ev-h3">New dates, same event</h3>' +
      '<p class="ev-hint">Same title, same content, same series. It gets this event’s ID with a number appended — ' +
        '<code>' + h(e.seriesId) + '-N</code> — so it is easy to reference. Change the content substantially and it ' +
        'needs a fresh proposal instead.</p>' +
      repeatDraft.map(function (s, i) {
        return '<div class="ev-session-row">' +
          '<input class="ev-input" type="date" data-rep="date" data-i="' + i + '" value="' + h(s.date) + '">' +
          '<input class="ev-input" type="time" data-rep="start" data-i="' + i + '" value="' + h(s.startTime) + '">' +
          '<span>to</span>' +
          '<input class="ev-input" type="time" data-rep="end" data-i="' + i + '" value="' + h(s.endTime) + '">' +
        '</div>';
      }).join('') +
      '<div class="ev-after-actions">' +
        '<button class="ev-btn ev-btn--ghost" type="button" data-do="repeat-add">+ Another date</button>' +
        '<button class="ev-btn ev-btn--primary" type="button" data-do="repeat-save">Create the repeat</button>' +
        '<button class="ev-btn ev-btn--ghost" type="button" data-do="repeat-cancel">Never mind</button>' +
      '</div>' +
    '</div>';
  }

  function followUpComposer(e) {
    var f = followUp = followUp || {
      note: e.postEvent.hostNote || '',
      actions: (e.postEvent.actions || []).slice(),
      recordingUrl: e.postEvent.recordingUrl || '',
      surveyUrl: e.postEvent.surveyUrl || '',
      audience: 'registered',
      replyTo: ((e.hostDetail && e.hostDetail.responsesTo) || []).join(', ')
    };

    return '<div class="ev-subform">' +
      '<h3 class="ev-h3">' + (e.postEvent.followUpSentAt ? 'Update your follow-up' : 'Send your follow-up') + '</h3>' +
      '<p class="ev-hint">Goes out from the LiF Events address with your address on the reply-to line, so replies ' +
        'reach you and not the LiF inbox.</p>' +

      '<label class="ev-label">A note from you</label>' +
      '<textarea class="ev-input" rows="5" data-fu="note" placeholder="Thank them. Say what struck you. Point at what is next.">' + h(f.note) + '</textarea>' +

      '<label class="ev-label">Include</label>' +
      '<div class="ev-checks">' + LIF.POST_EVENT_ACTIONS.map(function (a) {
        var on = f.actions.indexOf(a.id) !== -1;
        return '<label class="ev-check"><input type="checkbox" data-fu-action="' + a.id + '"' + (on ? ' checked' : '') + '>' +
          '<span><strong>' + h(a.name) + '</strong><br><span class="ev-hint">' + h(a.desc) + '</span></span></label>';
      }).join('') + '</div>' +

      (f.actions.indexOf('recording') !== -1
        ? '<label class="ev-label">Recording link</label>' +
          '<input class="ev-input" type="url" data-fu="recordingUrl" value="' + h(f.recordingUrl) + '" placeholder="https://…">'
        : '') +
      (f.actions.indexOf('survey') !== -1
        ? '<label class="ev-label">Feedback form link</label>' +
          '<input class="ev-input" type="url" data-fu="surveyUrl" value="' + h(f.surveyUrl) + '" placeholder="https://…">'
        : '') +

      '<label class="ev-label">Who receives it</label>' +
      '<select class="ev-input" data-fu="audience">' +
        ['registered', 'attendees', 'public'].map(function (a) {
          var name = a === 'registered' ? 'Everyone who registered'
            : a === 'attendees' ? 'Only those who came' : 'Everyone — also published to the library';
          return '<option value="' + a + '"' + (f.audience === a ? ' selected' : '') + '>' + name + '</option>';
        }).join('') +
      '</select>' +

      '<label class="ev-label">Replies go to</label>' +
      '<input class="ev-input" type="text" data-fu="replyTo" value="' + h(f.replyTo) + '">' +

      '<div class="ev-after-actions">' +
        '<button class="ev-btn ev-btn--primary" type="button" data-do="send-followup">' +
          (e.postEvent.followUpSentAt ? 'Send the update' : 'Send it') + '</button>' +
      '</div>' +
      (e.postEvent.followUpSentAt
        ? '<p class="ev-hint">Last sent ' + h(new Date(e.postEvent.followUpSentAt).toLocaleString()) + '.</p>'
        : '') +
    '</div>';
  }

  /* --- other occurrences and closely related events --- */
  function relatedCard(e) {
    var series = LIF.EVENTS.filter(function (x) { return x.seriesId === e.seriesId && x.id !== e.id; });
    var similar = LIF.EVENTS.filter(function (x) {
      return x.id !== e.id && x.seriesId !== e.seriesId && x.sector === e.sector &&
        x.status === 'active' && E.canSee(x);
    }).slice(0, 3);
    if (!series.length && !similar.length) return '';

    return '<section class="ev-card">' +
      (series.length
        ? '<h2>Other dates for this event</h2><ul class="ev-related">' + series.map(function (s) {
            return '<li><a href="event.html?id=' + h(s.id) + '"><strong>' + h(s.eventId) + '</strong> ' +
              h(U.formatDateRange(s.start, s.end)) + ' <span class="ev-badge ev-status-' + h(s.status) + '">' +
              h(E.statusMeta(s.status).name) + '</span></a></li>';
          }).join('') + '</ul>'
        : '') +
      (similar.length
        ? '<h2' + (series.length ? ' class="ev-h2-second"' : '') + '>Others in ' +
            h((U.getSector(e.sector) || {}).name || 'this sector') + '</h2>' +
          '<ul class="ev-related">' + similar.map(function (s) {
            return '<li><a href="event.html?id=' + h(s.id) + '"><strong>' + h(s.title) + '</strong> ' +
              h(U.formatDateRange(s.start, s.end)) + '</a></li>';
          }).join('') + '</ul>'
        : '') +
    '</section>';
  }

  function invitationCard(e) {
    if (!e.invitation) return '';
    var inv = e.invitation;
    return '<section class="ev-card">' +
      '<h2>The invitation as it goes out</h2>' +
      '<div class="ev-invite-preview">' +
        '<p class="inv-welcome">' + h(inv.welcome) + '</p>' +
        '<h3>' + h(inv.headline) + '</h3>' +
        '<div class="ev-prose">' + h(inv.body).split('\n').filter(Boolean).map(function (p) { return '<p>' + p + '</p>'; }).join('') + '</div>' +
        (inv.bring ? '<p><strong>Come with:</strong> ' + h(inv.bring) + '</p>' : '') +
        (inv.closing ? '<p><em>' + h(inv.closing) + '</em></p>' : '') +
      '</div>' +
    '</section>';
  }

  function pendingNotice(e) {
    if (e.status !== 'pending') return '';
    return '<section class="ev-card ev-card--pending">' +
      '<h2>Where your proposal is</h2>' +
      '<ol class="ev-timeline">' +
        '<li class="is-done">Submitted — ' + h(new Date(e.updatedAt).toLocaleString()) + '</li>' +
        '<li class="is-done">Filed in the LiF Events proposal repository and the proposal group notified</li>' +
        '<li class="is-now">A steward is reading it. They will come back by email, or a call if there is a lot to ' +
          'talk through</li>' +
        '<li>Approved and put on the LiF calendar — status changes to Active</li>' +
        '<li>Invitation notifications go out to members whose preferences match</li>' +
      '</ol>' +
      '<p class="ev-hint">Nobody else can see this page while it is pending. Your event ID (' + h(e.eventId) +
        ') is already yours and will not change.</p>' +
    '</section>';
  }

  function gateNotice(e) {
    return '<main class="ev-page"><section class="ev-card ev-card--gate">' +
      '<h1>This event is not open to you</h1>' +
      '<p class="ev-prose"><p>' +
        (e.access === 'private'
          ? 'It is invitation only. It sits on the master LiF calendar, but only invited people and registrants can ' +
            'see the details.'
          : 'It is open to verified members of ' + h((U.getOrganization(e.organization) || {}).name || 'a partner organization') +
            '. Connect your membership on your profile and it will appear.') +
      '</p></section></main>';
  }

  /* =========================================================
   * Render
   * ======================================================= */
  function render() {
    var root = document.getElementById('eventPage');
    if (!evt) {
      root.innerHTML = '<section class="ev-card"><h1>No such event</h1>' +
        '<p class="ev-prose"><p>That link points at an event this hub does not have. It may have been removed, or ' +
        'the ID may be mistyped.</p></p>' +
        '<a class="ev-btn ev-btn--primary" href="index.html">Back to the events hub</a></section>';
      return;
    }
    if (!E.canSee(evt)) { root.outerHTML = gateNotice(evt); return; }

    document.title = evt.title + ' — LiF Playground';

    root.innerHTML =
      statusBanner(evt) +
      hero(evt) +
      '<div class="ev-grid">' +
        '<div class="ev-main">' +
          pendingNotice(evt) +
          aboutCard(evt) +
          detailsCard(evt) +
          locationCard(evt) +
          postEventCard(evt) +
          invitationCard(evt) +
          hostTools(evt) +
          relatedCard(evt) +
        '</div>' +
        registerPanel(evt) +
      '</div>';

    if (evt.location && evt.location.lat != null) mountMap();
  }

  function mountMap() {
    if (typeof L === 'undefined') return;
    var node = document.getElementById('evMap');
    if (!node) return;
    if (mapObj) { mapObj.remove(); mapObj = null; }
    mapObj = L.map(node, { scrollWheelZoom: false, attributionControl: true })
      .setView([evt.location.lat, evt.location.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapObj);
    L.marker([evt.location.lat, evt.location.lng]).addTo(mapObj)
      .bindPopup('<strong>' + h(evt.location.venue || evt.title) + '</strong>');
  }

  /* =========================================================
   * Actions
   * ======================================================= */
  function onClick(e) {
    var el = e.target.closest('[data-do]');
    if (!el) return;
    var v = el.dataset.value;

    switch (el.dataset.do) {
      case 'ics': LIF.calendarLinks.download(evt); U.showToast('Calendar file downloaded.'); return;
      case 'copy': U.copyToClipboard(LIF.calendarLinks.pageUrl(evt)); return;

      case 'notify':
        var on = E.toggleNotifyMe(evt.id);
        U.showToast(on ? 'You will be told if this reopens or runs again.' : 'You will not be notified about this one.');
        render();
        return;

      case 'toggle-reminders': {
        var reg = E.registrationFor(evt.id);
        E.setReminders(evt.id, !reg.reminders);
        U.showToast(!reg.reminders ? 'Reminders on.' : 'Reminders off for this event.');
        render();
        return;
      }

      case 'task':
        if (v === 'rsvp' || v === 'pay') LIF.eventRegistration.open(evt.id);
        else if (v === 'survey' && evt.postEvent.surveyUrl) window.open(evt.postEvent.surveyUrl, '_blank', 'noopener');
        else if (v === 'followup') { document.querySelector('.ev-card--host').scrollIntoView({ behavior: 'smooth' }); }
        return;

      case 'thread': threadOpen = !threadOpen; render(); return;
      case 'post': {
        var box = document.getElementById('evPost');
        if (!box || !box.value.trim()) { U.showToast('Write something first.'); return; }
        E.postToThread(evt.id, box.value.trim());
        render();
        return;
      }

      case 'propose-group':
        U.showToast('Group creation opens the Group Proposal pathway, pre-linked to ' + evt.eventId +
          ' so the event’s information carries into the group space. That pathway is the next one to build.');
        return;

      case 'edit':
        U.showToast('Editing an active event notifies everyone registered. The edit form reuses the proposal ' +
          'fields — wire it to the same pathway when the backend can accept changes.');
        return;

      case 'cancel-event':
        if (!confirm('Cancel "' + evt.title + '"? Everyone registered is notified.')) return;
        evt.status = 'cancelled';
        evt.cancelledReason = 'Cancelled by the host.';
        LIF.eventStore.queue({ kind: 'email', to: evt.registered + ' registered guests', eventId: evt.eventId,
          template: 'event-cancelled', subject: 'Cancelled: ' + evt.title,
          body: 'Everyone registered is told, and the event drops off the LiF calendar.' });
        U.showToast('Cancelled. Everyone registered has been notified.');
        render();
        return;

      case 'repeat':
        repeatDraft = [{ date: '', startTime: '', endTime: '' }];
        render();
        return;
      case 'repeat-add': repeatDraft.push({ date: '', startTime: '', endTime: '' }); render(); return;
      case 'repeat-cancel': repeatDraft = null; render(); return;
      case 'repeat-save': {
        var valid = repeatDraft.filter(function (s) { return s.date && s.startTime && s.endTime; });
        if (!valid.length) { U.showToast('Give it at least one date with a start and an end.'); return; }
        var tz = evt.timezone || '-07:00';
        var made = E.repeat(evt.id, valid.map(function (s) {
          return { start: s.date + 'T' + s.startTime + ':00' + tz, end: s.date + 'T' + s.endTime + ':00' + tz };
        }));
        repeatDraft = null;
        U.showToast('Created ' + made.eventId + '. Same content, new dates, no new proposal needed.');
        location.search = '?id=' + made.id;
        return;
      }

      case 'send-followup': {
        var actions = followUp.actions;
        E.saveFollowUp(evt.id, {
          hostNote: followUp.note,
          actions: actions,
          recordingUrl: actions.indexOf('recording') !== -1 ? followUp.recordingUrl : evt.postEvent.recordingUrl,
          surveyUrl: actions.indexOf('survey') !== -1 ? followUp.surveyUrl : evt.postEvent.surveyUrl
        });
        if (evt.hostDetail) evt.hostDetail.responsesTo = followUp.replyTo.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        followUp = null;
        U.showToast('Follow-up queued to everyone you chose, with your address on the reply-to line.');
        render();
        return;
      }
    }
  }

  function onInput(e) {
    var r = e.target.closest('[data-rep]');
    if (r && repeatDraft) {
      var i = +r.dataset.i;
      var k = r.dataset.rep === 'date' ? 'date' : r.dataset.rep === 'start' ? 'startTime' : 'endTime';
      repeatDraft[i][k] = r.value;
      return;
    }
    var f = e.target.closest('[data-fu]');
    if (f && followUp) followUp[f.dataset.fu] = f.value;
  }

  function onChange(e) {
    var a = e.target.closest('[data-fu-action]');
    if (a && followUp) {
      var id = a.dataset.fuAction;
      var i = followUp.actions.indexOf(id);
      if (i === -1) followUp.actions.push(id); else followUp.actions.splice(i, 1);
      render();
      return;
    }
    onInput(e);
  }

  /* =========================================================
   * Boot
   * ======================================================= */
  function init() {
    var id = q('id') || (location.hash.match(/event=([\w-]+)/) || [])[1];
    evt = id ? E.get(id) : null;
    render();

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('lif:eventschange', function () {
      if (evt) { evt = E.get(evt.id) || evt; render(); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { render: render };
})();
