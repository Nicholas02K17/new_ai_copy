/**
 * eventProposal.js
 * ---------------------------------------------------------------
 * The member-hosted event pathway, end to end:
 *
 *   welcome → fields → invitation → review → submitted
 *
 * THE ONE DESIGN DECISION WORTH KNOWING
 * The spec offers a proposer two ways through the same questions:
 * a form they fill top to bottom, or an interactive pathway that
 * asks one thing at a time. Those are two renderers over ONE field
 * definition (the FIELDS array below), not two forms. Add a field
 * once and it appears in both, with the same help text, the same
 * validation and the same place in the review summary. Two hand-
 * maintained copies of a 24-field form would drift within a week.
 *
 * Everything the form collects is a plain object matching the
 * proposal shape in eventsModel.js, so submitting is one call:
 * LIF.events.submitProposal(P).
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.eventProposal = (function () {

  function U() { return LIF.util; }
  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* =========================================================
   * 1. STATE
   * ======================================================= */
  var P = null;          // the proposal being built
  var step = 'welcome';  // welcome | fields | invitation | review | done
  var mode = 'form';     // form | guided
  var cursor = 0;        // which field the guided pathway is on
  var errors = {};
  var openHelp = {};

  var TIMEZONES = [
    { id: '-10:00', label: 'Hawaii (UTC−10)' },
    { id: '-08:00', label: 'US Pacific (UTC−8)' },
    { id: '-07:00', label: 'US Mountain (UTC−7)' },
    { id: '-06:00', label: 'US Central (UTC−6)' },
    { id: '-05:00', label: 'US Eastern (UTC−5)' },
    { id: '-03:00', label: 'Brazil / Argentina (UTC−3)' },
    { id: '+00:00', label: 'UTC / London (UTC+0)' },
    { id: '+01:00', label: 'Central Europe (UTC+1)' },
    { id: '+02:00', label: 'Eastern Europe / South Africa (UTC+2)' },
    { id: '+03:00', label: 'East Africa / Moscow (UTC+3)' },
    { id: '+05:30', label: 'India (UTC+5:30)' },
    { id: '+08:00', label: 'China / Singapore (UTC+8)' },
    { id: '+09:00', label: 'Japan / Korea (UTC+9)' },
    { id: '+10:00', label: 'Eastern Australia (UTC+10)' },
    { id: '+12:00', label: 'New Zealand (UTC+12)' }
  ];

  /** The member's own offset, which the calendar step defaults to. */
  function guessTz() {
    var mins = -new Date().getTimezoneOffset();
    var sign = mins < 0 ? '-' : '+';
    var a = Math.abs(mins);
    var tz = sign + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
    return TIMEZONES.some(function (t) { return t.id === tz; }) ? tz : '-07:00';
  }

  function myGroups() {
    var ids = (LIF.MEMBER && LIF.MEMBER.groups.registered) ||
      (LIF.CURRENT_MEMBER && LIF.CURRENT_MEMBER.groupIds) || [];
    return ids.map(function (id) { return LIF.GROUPS.find(function (g) { return g.id === id; }); }).filter(Boolean);
  }

  function blank() {
    var E = LIF.events;
    return {
      id: null, eventId: null, status: 'draft',
      title: '', description: '',
      mentorPlaydate: { wanted: false, ask: '' },
      firstTime: true, repeatOf: null,
      hostDetail: {
        kind: 'individual', name: E.memberName(), email: E.memberEmail(),
        memberId: E.memberId(), coHosts: [], groupId: null,
        responsesTo: [E.memberEmail()]
      },
      coverImage: null,
      sector: '', subsector: '', subsectorSuggestion: '', sectorOther: '',
      aspect: 'engagement-communion',
      format: '', location: null, onlineLink: '',
      type: '',
      timezone: guessTz(),
      sessions: [{ date: '', startTime: '', endTime: '' }],
      recurrenceNote: '',
      payment: { model: '', min: 0, max: 60, suggested: 25, currency: 'USD', note: '' },
      languages: [],
      participants: { min: null, max: null },
      overflowPlan: '', underMinPlan: '',
      audienceNote: '',
      registerBy: '',
      access: '', inviteNote: '', invitedMemberIds: [],
      recording: { mode: 'live', access: 'registered', url: null },
      resourceAsks: [],
      tags: [],
      invitation: null
    };
  }

  /* =========================================================
   * 2. THE FIELD DEFINITION
   * One entry per question the spec asks. `req` marks the
   * starred fields. `when` hides a field until it applies.
   * `ask` is the interactive pathway's phrasing of the same
   * question — a form label and a spoken question are not the
   * same sentence, and pretending they are reads badly.
   * ======================================================= */
  var FIELDS = [
    { key: 'title', group: 'Your idea', req: true, type: 'text',
      label: 'Event title',
      ask: 'What is this gathering called?',
      help: 'Say what it is rather than what it is about. “Water Justice Listening Session” lands better than “A conversation on water”.',
      placeholder: 'e.g. Watershed Care Morning' },

    { key: 'description', group: 'Your idea', req: true, type: 'textarea',
      label: 'Event description',
      ask: 'Tell people what will actually happen.',
      help: 'What you will do together, what to expect, and what someone leaves with. Two or three short paragraphs is plenty.',
      placeholder: 'What happens, who it is for, what people walk away with…' },

    { key: 'mentorPlaydate', group: 'Your idea', type: 'mentor',
      label: 'Would a mentor playdate help?',
      ask: 'Want to think this through with someone first?',
      help: 'A LiF mentor will sit with you to clarify or develop the idea before it goes anywhere. Saying yes does not slow your proposal down.' },

    { key: 'firstTime', group: 'Your idea', type: 'firstTime',
      label: 'First time, or a repeat?',
      ask: 'Is this a new event, or one you have held before?',
      help: 'If it is a repeat with the same title and content, you can point at the original and skip most of this form — new dates, same event ID with a number appended.' },

    { key: 'hostKind', group: 'Who is hosting', type: 'hostKind',
      label: 'Who is hosting',
      ask: 'Are you hosting this yourself, or on behalf of a group?',
      help: 'Your own details come straight off your profile. Co-hosts get the same editing rights as you.' },

    { key: 'responsesTo', group: 'Who is hosting', type: 'emails',
      label: 'Event responses go to',
      ask: 'Where should replies about this event land?',
      help: 'Anyone replying to an event email reaches these addresses, not the LiF Events inbox. Add as many as you like.' },

    { key: 'coverImage', group: 'How it looks', type: 'image',
      label: 'Cover image',
      ask: 'Do you have an image for it?',
      help: 'Optional. Leave it and your event gets a cover in its sector’s colours, which looks intentional rather than empty.' },

    { key: 'sector', group: 'Where it belongs', req: true, type: 'sector',
      label: 'Sector',
      ask: 'Which LiF area of focus is this?',
      help: 'This is what the hub’s filters and the “for me” matcher use, so it decides who gets shown your event. Pick the closest one; you can suggest a subsector that does not exist yet.' },

    { key: 'aspect', group: 'Where it belongs', type: 'select',
      label: 'LiF Aspect',
      ask: 'And which of the seven Aspects does it sit closest to?',
      help: 'This sets your event’s colour on the map and its place on the aspect wheel.',
      options: function () { return LIF.ASPECTS.map(function (a) { return { id: a.id, name: a.name }; }); } },

    { key: 'format', group: 'Where it happens', req: true, type: 'format',
      label: 'Event format',
      ask: 'In person, online, or both?',
      help: 'In-person and hybrid events need an address — that is what puts a pin on the map. Online events show as cards instead.' },

    { key: 'type', group: 'Where it belongs', req: true, type: 'select',
      label: 'Event type',
      ask: 'What kind of gathering is it?',
      help: 'People filter by this, and it sets expectations. A summit and a playdate ask very different things of an attendee.',
      options: function () { return LIF.EVENT_TYPES; } },

    { key: 'sessions', group: 'When', req: true, type: 'sessions',
      label: 'Dates and times',
      ask: 'When is it?',
      help: 'Add a row per day. Multi-day events keep their own start and end time for each date, because they rarely run the same hours.' },

    { key: 'recurrenceNote', group: 'When', type: 'text',
      label: 'Recurrence, in your own words',
      ask: 'Does it repeat? Describe the rhythm.',
      help: 'Free text on purpose — “first Saturday of every month, through spring” is clearer than any recurrence rule builder.',
      placeholder: 'e.g. Monthly, first Saturday, through to March' },

    { key: 'payment', group: 'What it costs', req: true, type: 'payment',
      label: 'Payment',
      ask: 'What are you asking of people, if anything?',
      help: 'Sliding scale means you set the range and the guest picks their place in it, no questions asked. Anything but Free routes registrants through the LiF payment apps.' },

    { key: 'languages', group: 'What it costs', req: true, type: 'languages',
      label: 'Language it is hosted in',
      ask: 'What language will you hold it in?',
      help: 'People filter on this, and the invitation is translated for anyone whose preferred language differs.' },

    { key: 'participants', group: 'Who comes', type: 'participants',
      label: 'Number of participants',
      ask: 'How many people are you hoping for?',
      help: 'A minimum and a maximum. We also ask what you want to happen at either edge, so nobody has to guess on the day.' },

    { key: 'audienceNote', group: 'Who comes', type: 'textarea',
      label: 'Who do you see attending?',
      ask: 'Who will benefit from this, and who will contribute to it?',
      help: 'Written for you as much as for us — naming the room you are hoping for usually sharpens the description too.',
      placeholder: 'Who is this for, and who makes it good?' },

    { key: 'registerBy', group: 'Who comes', req: true, type: 'date',
      label: 'Register by',
      ask: 'When does registration close?',
      help: 'After this, the Register button turns to “Closed” everywhere it appears — cards, emails, old notifications.' },

    { key: 'access', group: 'Who comes', req: true, type: 'access',
      label: 'Access',
      ask: 'Open to the playground, or invitation only?',
      help: 'Private events still sit on the master LiF calendar, but only invited people and registrants can see them.' },

    { key: 'recording', group: 'Afterwards', type: 'recording',
      label: 'Recording',
      ask: 'Will you record it?',
      help: 'Attendees are told either way, before they register. If you record, you decide here who can watch it afterwards.' },

    { key: 'resourceAsks', group: 'What you need', type: 'resources',
      label: 'Resources you need from LiF',
      ask: 'What do you need from us?',
      help: 'Ask for a meeting link and one is created for you. Otherwise paste your own below.' }
  ];

  function fieldsVisible() {
    return FIELDS.filter(function (f) { return !f.when || f.when(P); });
  }
  function fieldByKey(k) { return FIELDS.find(function (f) { return f.key === k; }); }

  /* =========================================================
   * 3. VALIDATION
   * ======================================================= */
  function errorFor(f) {
    var v;
    switch (f.key) {
      case 'title':       return P.title.trim() ? null : 'A title is needed.';
      case 'description': return P.description.trim().length >= 20 ? null : 'A couple of sentences at least, so people know what they are saying yes to.';
      case 'sector':      return P.sector ? null : 'Pick the closest sector.';
      case 'format':
        if (!P.format) return 'Pick a format.';
        if ((P.format === 'in-person' || P.format === 'hybrid') && !(P.location && P.location.venue && P.location.city)) {
          return 'In-person and hybrid events need at least a venue and a city.';
        }
        return null;
      case 'type':        return P.type ? null : 'Pick an event type.';
      case 'sessions':
        v = P.sessions.filter(function (s) { return s.date && s.startTime && s.endTime; });
        if (!v.length) return 'At least one date with a start and end time.';
        var bad = v.find(function (s) { return s.endTime <= s.startTime; });
        return bad ? 'Each session has to end after it starts.' : null;
      case 'payment':     return P.payment.model ? null : 'Choose what you are asking of people, even if that is nothing.';
      case 'languages':   return P.languages.length ? null : 'Pick at least one language.';
      case 'registerBy':  return P.registerBy ? null : 'Set the date registration closes.';
      case 'access':      return P.access ? null : 'Open or invitation only?';
      default: return null;
    }
  }

  function validateAll() {
    errors = {};
    fieldsVisible().forEach(function (f) {
      if (!f.req) return;
      var e = errorFor(f);
      if (e) errors[f.key] = e;
    });
    return Object.keys(errors).length === 0;
  }

  /* =========================================================
   * 4. FIELD RENDERERS
   * Each returns the control only. The two layouts wrap them.
   * ======================================================= */
  function optionList(f) {
    return typeof f.options === 'function' ? f.options() : (f.options || []);
  }

  function control(f) {
    switch (f.type) {

      case 'text':
        return '<input class="ep-input" type="text" data-set="' + f.key + '" value="' + h(P[f.key]) + '" ' +
          'placeholder="' + h(f.placeholder || '') + '">';

      case 'textarea':
        return '<textarea class="ep-input ep-textarea" data-set="' + f.key + '" rows="5" ' +
          'placeholder="' + h(f.placeholder || '') + '">' + h(P[f.key]) + '</textarea>';

      case 'select':
        return '<select class="ep-input" data-set="' + f.key + '">' +
          '<option value="">Choose…</option>' +
          optionList(f).map(function (o) {
            return '<option value="' + h(o.id) + '"' + (P[f.key] === o.id ? ' selected' : '') + '>' + h(o.name) + '</option>';
          }).join('') + '</select>';

      case 'date':
        return '<input class="ep-input" type="date" data-set="' + f.key + '" value="' + h(P[f.key]) + '">';

      /* --- mentor playdate: yes/no plus what they want --- */
      case 'mentor':
        return '<div class="ep-yesno">' +
            radio('mentor-wanted', 'no', 'No thanks', !P.mentorPlaydate.wanted) +
            radio('mentor-wanted', 'yes', 'Yes please', P.mentorPlaydate.wanted) +
          '</div>' +
          (P.mentorPlaydate.wanted
            ? '<textarea class="ep-input ep-textarea" data-set="mentor-ask" rows="3" ' +
              'placeholder="What would help? What are you stuck on?">' + h(P.mentorPlaydate.ask) + '</textarea>'
            : '');

      /* --- first time or a repeat of something already held --- */
      case 'firstTime':
        var prior = LIF.EVENTS.filter(function (e) {
          return e.status === 'complete' && LIF.events.isHost(e);
        });
        return '<div class="ep-yesno">' +
            radio('first-time', 'yes', 'A new event', P.firstTime) +
            radio('first-time', 'no', 'A repeat of one I have held', !P.firstTime) +
          '</div>' +
          (!P.firstTime
            ? (prior.length
              ? '<select class="ep-input" data-set="repeat-of"><option value="">Which one?</option>' +
                prior.map(function (e) {
                  return '<option value="' + e.id + '"' + (P.repeatOf === e.id ? ' selected' : '') + '>' +
                    h(e.title) + ' · ' + h(e.eventId) + '</option>';
                }).join('') + '</select>' +
                (P.repeatOf ? '<div class="ep-inline-note">' + repeatNote() + '</div>' : '')
              : '<div class="ep-inline-note">You have no completed events on the hub yet, so there is nothing to repeat. ' +
                'Carry on as a new event.</div>')
            : '');

      /* --- host: individual (with co-hosts) or a group --- */
      case 'hostKind':
        var groups = myGroups();
        return '<div class="ep-yesno">' +
            radio('host-kind', 'individual', 'Just me', P.hostDetail.kind === 'individual') +
            radio('host-kind', 'group', 'A group I belong to', P.hostDetail.kind === 'group') +
          '</div>' +
          (P.hostDetail.kind === 'individual'
            ? '<div class="ep-readback"><strong>' + h(P.hostDetail.name) + '</strong><span>' + h(P.hostDetail.email) + '</span>' +
                '<em>Pulled from your profile.</em></div>' +
              '<label class="ep-sublabel">Co-hosts</label>' +
              chipList(P.hostDetail.coHosts.map(function (c) { return c.name + ' · ' + c.email; }), 'cohost') +
              '<div class="ep-row">' +
                '<input class="ep-input" type="text" id="epCoName" placeholder="Name or email search">' +
                '<input class="ep-input" type="email" id="epCoEmail" placeholder="Email">' +
                '<button class="ep-btn ep-btn--ghost" type="button" data-do="add-cohost">Add</button>' +
              '</div>'
            : (groups.length
              ? '<select class="ep-input" data-set="host-group"><option value="">Which group?</option>' +
                groups.map(function (g) {
                  return '<option value="' + g.id + '"' + (P.hostDetail.groupId === g.id ? ' selected' : '') + '>' + h(g.name) + '</option>';
                }).join('') + '</select>'
              : '<div class="ep-inline-note">You are not in any groups yet, so there is nothing to host on behalf of.</div>'));

      case 'emails':
        return chipList(P.hostDetail.responsesTo, 'reply-to') +
          '<div class="ep-row">' +
            '<input class="ep-input" type="email" id="epReplyTo" placeholder="another@address.org">' +
            '<button class="ep-btn ep-btn--ghost" type="button" data-do="add-replyto">Add</button>' +
          '</div>';

      case 'image':
        return '<div class="ep-cover" style="background:' + coverPreview() + '">' +
            (P.coverImage ? '' : '<span>Default cover — your sector’s colours</span>') +
          '</div>' +
          '<div class="ep-row">' +
            '<input class="ep-input" type="file" accept="image/*" data-do="pick-cover">' +
            (P.coverImage ? '<button class="ep-btn ep-btn--ghost" type="button" data-do="clear-cover">Remove</button>' : '') +
          '</div>';

      /* --- sector → subsector, dependent, with both escape hatches
             the spec asks for: "other" and "suggest a subsector" --- */
      case 'sector':
        var subs = LIF.SUBSECTORS[P.sector] || [];
        return '<select class="ep-input" data-set="sector"><option value="">Choose a sector…</option>' +
            LIF.SECTORS.map(function (s) {
              return '<option value="' + s.id + '"' + (P.sector === s.id ? ' selected' : '') + '>' + h(s.name) + '</option>';
            }).join('') +
            '<option value="other"' + (P.sector === 'other' ? ' selected' : '') + '>Other — none of these fit</option>' +
          '</select>' +
          (P.sector === 'other'
            ? '<textarea class="ep-input ep-textarea" data-set="sector-other" rows="3" ' +
              'placeholder="Describe the area of focus this belongs to.">' + h(P.sectorOther) + '</textarea>'
            : '') +
          (subs.length
            ? '<label class="ep-sublabel">Subsector</label>' +
              '<select class="ep-input" data-set="subsector"><option value="">Choose…</option>' +
              subs.map(function (s) {
                return '<option value="' + h(s) + '"' + (P.subsector === s ? ' selected' : '') + '>' + h(s) + '</option>';
              }).join('') + '</select>' +
              '<div class="ep-row ep-row--tight">' +
                '<input class="ep-input" type="text" id="epNewSub" placeholder="Suggest a new subsector under ' +
                  h((LIF.SECTORS.find(function (s) { return s.id === P.sector; }) || {}).name || '') + '" ' +
                  'value="' + h(P.subsectorSuggestion) + '">' +
                '<button class="ep-btn ep-btn--ghost" type="button" data-do="suggest-sub">Suggest</button>' +
              '</div>'
            : '');

      /* --- format, with location appearing only when it matters --- */
      case 'format':
        var loc = P.location || {};
        return '<div class="ep-cards">' + LIF.FORMATS.map(function (fm) {
            return '<button type="button" class="ep-card' + (P.format === fm.id ? ' is-on' : '') + '" ' +
              'data-do="set-format" data-value="' + fm.id + '">' +
              '<strong>' + h(fm.name) + '</strong>' +
              '<span>' + h(fm.id === 'in-person' ? 'A place, a pin on the map.'
                : fm.id === 'online' ? 'A link. Shows as a card, not a pin.'
                : 'Both — a room and a link.') + '</span></button>';
          }).join('') + '</div>' +
          ((P.format === 'in-person' || P.format === 'hybrid')
            ? '<label class="ep-sublabel">Location <span class="ep-req">required</span></label>' +
              '<div class="ep-grid2">' +
                '<input class="ep-input" type="text" data-set="loc-venue" placeholder="Venue" value="' + h(loc.venue || '') + '">' +
                '<input class="ep-input" type="text" data-set="loc-city" placeholder="City" value="' + h(loc.city || '') + '">' +
                '<input class="ep-input" type="text" data-set="loc-region" placeholder="Region / state" value="' + h(loc.region || '') + '">' +
                '<input class="ep-input" type="text" data-set="loc-country" placeholder="Country" value="' + h(loc.country || '') + '">' +
                '<input class="ep-input" type="number" step="0.0001" data-set="loc-lat" placeholder="Latitude (optional)" value="' + h(loc.lat == null ? '' : loc.lat) + '">' +
                '<input class="ep-input" type="number" step="0.0001" data-set="loc-lng" placeholder="Longitude (optional)" value="' + h(loc.lng == null ? '' : loc.lng) + '">' +
              '</div>' +
              '<p class="ep-hint">Latitude and longitude are optional — without them the event still lists, it just does not get a map pin.</p>'
            : '') +
          ((P.format === 'online' || P.format === 'hybrid')
            ? '<label class="ep-sublabel">Meeting link</label>' +
              '<input class="ep-input" type="url" data-set="online-link" placeholder="https://… (leave blank and ask LiF to make one)" value="' + h(P.onlineLink) + '">'
            : '');

      /* --- the calendar step --- */
      case 'sessions':
        return '<label class="ep-sublabel">Time zone</label>' +
          '<select class="ep-input" data-set="timezone">' + TIMEZONES.map(function (t) {
            return '<option value="' + t.id + '"' + (P.timezone === t.id ? ' selected' : '') + '>' + h(t.label) + '</option>';
          }).join('') + '</select>' +
          '<p class="ep-hint">Defaulted to your own zone. Everything below is entered in it; guests see it converted to theirs.</p>' +
          '<div class="ep-sessions">' + P.sessions.map(function (s, i) {
            return '<div class="ep-session">' +
              '<span class="ep-session-n">' + (i + 1) + '</span>' +
              '<input class="ep-input" type="date" data-set="session-date" data-i="' + i + '" value="' + h(s.date) + '">' +
              '<input class="ep-input" type="time" data-set="session-start" data-i="' + i + '" value="' + h(s.startTime) + '">' +
              '<span class="ep-dash">to</span>' +
              '<input class="ep-input" type="time" data-set="session-end" data-i="' + i + '" value="' + h(s.endTime) + '">' +
              (P.sessions.length > 1
                ? '<button class="ep-x" type="button" data-do="drop-session" data-i="' + i + '" aria-label="Remove this date">×</button>'
                : '<span class="ep-x-spacer"></span>') +
              '</div>';
          }).join('') + '</div>' +
          '<button class="ep-btn ep-btn--ghost" type="button" data-do="add-session">+ Another date</button>';

      /* --- payment --- */
      case 'payment':
        var pm = P.payment;
        return '<div class="ep-cards">' + LIF.PAYMENT_MODELS.map(function (m) {
            return '<button type="button" class="ep-card' + (pm.model === m.id ? ' is-on' : '') + '" ' +
              'data-do="set-payment" data-value="' + m.id + '">' +
              '<strong>' + h(m.name) + '</strong><span>' + h(m.desc) + '</span></button>';
          }).join('') + '</div>' +
          (pm.model === 'sliding-scale'
            ? '<div class="ep-grid2">' +
                '<label class="ep-mini">Lowest<input class="ep-input" type="number" min="0" data-set="pay-min" value="' + h(pm.min) + '"></label>' +
                '<label class="ep-mini">Highest<input class="ep-input" type="number" min="0" data-set="pay-max" value="' + h(pm.max) + '"></label>' +
              '</div>'
            : '') +
          (pm.model === 'gratitude' || pm.model === 'gift'
            ? '<label class="ep-mini">Suggested amount<input class="ep-input" type="number" min="0" data-set="pay-suggested" value="' + h(pm.suggested) + '"></label>'
            : '') +
          (pm.model && pm.model !== 'free'
            ? '<textarea class="ep-input ep-textarea" data-set="pay-note" rows="2" ' +
              'placeholder="Anything you want people to know about paying — this shows on the registration page.">' + h(pm.note) + '</textarea>' +
              '<p class="ep-hint">Registration routes through the LiF payment apps before confirming a place.</p>'
            : '');

      case 'languages':
        return '<div class="ep-chips">' + LIF.LANGUAGES.map(function (l) {
            var on = P.languages.indexOf(l) !== -1;
            return '<button type="button" class="ep-chip' + (on ? ' is-on' : '') + '" data-do="toggle-language" data-value="' + h(l) + '">' + h(l) + '</button>';
          }).join('') + '</div>';

      case 'participants':
        return '<div class="ep-grid2">' +
            '<label class="ep-mini">Minimum<input class="ep-input" type="number" min="1" data-set="part-min" value="' + h(P.participants.min == null ? '' : P.participants.min) + '"></label>' +
            '<label class="ep-mini">Maximum<input class="ep-input" type="number" min="1" data-set="part-max" value="' + h(P.participants.max == null ? '' : P.participants.max) + '"></label>' +
          '</div>' +
          '<label class="ep-sublabel">If more people want in than there is room for</label>' +
          '<input class="ep-input" type="text" data-set="overflow" placeholder="e.g. I will run a second session" value="' + h(P.overflowPlan) + '">' +
          '<label class="ep-sublabel">If you do not reach the minimum</label>' +
          '<input class="ep-input" type="text" data-set="undermin" placeholder="e.g. Postpone rather than cancel, and tell everyone a week ahead" value="' + h(P.underMinPlan) + '">';

      case 'access':
        return '<div class="ep-cards">' + LIF.ACCESS_LEVELS.map(function (a) {
            return '<button type="button" class="ep-card' + (P.access === a.id ? ' is-on' : '') + '" ' +
              'data-do="set-access" data-value="' + a.id + '"><strong>' + h(a.name) + '</strong><span>' + h(a.desc) + '</span></button>';
          }).join('') + '</div>' +
          (P.access === 'private'
            ? '<label class="ep-sublabel">Who will be invited, and how?</label>' +
              '<textarea class="ep-input ep-textarea" data-set="invite-note" rows="3" ' +
              'placeholder="e.g. Private message to everyone who came to a work morning this year.">' + h(P.inviteNote) + '</textarea>'
            : '');

      case 'recording':
        return '<div class="ep-yesno">' +
            radio('rec-mode', 'live', 'Live only — not recorded', P.recording.mode === 'live') +
            radio('rec-mode', 'recorded', 'It will be recorded', P.recording.mode === 'recorded') +
          '</div>' +
          (P.recording.mode === 'recorded'
            ? '<label class="ep-sublabel">Who gets the recording?</label>' +
              '<select class="ep-input" data-set="rec-access">' + LIF.RECORDING_ACCESS.map(function (r) {
                return '<option value="' + r.id + '"' + (P.recording.access === r.id ? ' selected' : '') + '>' + h(r.name) + '</option>';
              }).join('') + '</select>' +
              '<p class="ep-hint">Attendees are told this before they register, either way.</p>'
            : '');

      case 'resources':
        return '<div class="ep-checks">' + LIF.RESOURCE_ASKS.map(function (r) {
            var on = P.resourceAsks.indexOf(r.id) !== -1;
            var relevant = r.id !== 'meeting-link' || P.format === 'online' || P.format === 'hybrid';
            return '<label class="ep-check' + (relevant ? '' : ' is-dim') + '">' +
              '<input type="checkbox" data-do="toggle-resource" data-value="' + r.id + '"' + (on ? ' checked' : '') +
              (relevant ? '' : ' disabled') + '>' +
              '<span><strong>' + h(r.name) + '</strong><br><span class="ep-hint">' + h(r.desc) +
              (relevant ? '' : ' Only applies to online and hybrid events.') + '</span></span></label>';
          }).join('') + '</div>';

      default:
        return '';
    }
  }

  function radio(name, value, label, checked) {
    return '<label class="ep-radio' + (checked ? ' is-on' : '') + '">' +
      '<input type="radio" name="' + name + '" data-do="' + name + '" data-value="' + value + '"' + (checked ? ' checked' : '') + '>' +
      '<span>' + h(label) + '</span></label>';
  }

  function chipList(items, kind) {
    if (!items || !items.length) return '<p class="ep-hint">None yet.</p>';
    return '<div class="ep-chips">' + items.map(function (t, i) {
      return '<span class="ep-chip is-static">' + h(t) +
        '<button type="button" class="ep-chip-x" data-do="drop-' + kind + '" data-i="' + i + '" aria-label="Remove">×</button></span>';
    }).join('') + '</div>';
  }

  function coverPreview() {
    if (P.coverImage) return 'url(' + P.coverImage + ') center/cover';
    var stops = LIF.SECTOR_COVERS[P.sector] || ['#755091', '#C89CD8'];
    return 'linear-gradient(135deg, ' + stops[0] + ', ' + stops[1] + ')';
  }

  function repeatNote() {
    var src = LIF.events.get(P.repeatOf);
    if (!src) return '';
    return 'Same title and content as <strong>' + h(src.title) + '</strong>. It keeps the event ID <code>' +
      h(src.seriesId) + '</code> with a number appended, so it stays easy to reference. Change the title or the ' +
      'content substantially and it becomes a new proposal instead.';
  }

  /* =========================================================
   * 5. THE TWO LAYOUTS
   * ======================================================= */
  function fieldBlock(f, showAsk) {
    var err = errors[f.key];
    return '<div class="ep-field' + (err ? ' has-error' : '') + '" data-field="' + f.key + '">' +
      '<div class="ep-label-row">' +
        '<label class="ep-label">' + h(showAsk ? f.ask : f.label) +
          (f.req ? ' <span class="ep-req">required</span>' : '') + '</label>' +
        '<button type="button" class="ep-help-btn" data-do="help" data-value="' + f.key + '" ' +
          'aria-expanded="' + !!openHelp[f.key] + '" aria-label="Help with this question">?</button>' +
      '</div>' +
      (openHelp[f.key] || showAsk ? '<p class="ep-help">' + h(f.help) + '</p>' : '') +
      control(f) +
      (err ? '<p class="ep-error">' + h(err) + '</p>' : '') +
      '</div>';
  }

  /** The form: every question at once, grouped. */
  function formLayout() {
    var groups = [];
    fieldsVisible().forEach(function (f) {
      var g = groups.find(function (x) { return x.name === f.group; });
      if (!g) groups.push(g = { name: f.group, fields: [] });
      g.fields.push(f);
    });
    return '<div class="ep-form">' + groups.map(function (g) {
      return '<section class="ep-group"><h3>' + h(g.name) + '</h3>' +
        g.fields.map(function (f) { return fieldBlock(f, false); }).join('') + '</section>';
    }).join('') + '</div>';
  }

  /** The interactive pathway: one question, with the form building
      itself alongside so nothing feels hidden. */
  function guidedLayout() {
    var list = fieldsVisible();
    cursor = Math.max(0, Math.min(cursor, list.length - 1));
    var f = list[cursor];
    /* Count everything answered, not everything behind the cursor -
       several fields arrive pre-filled from the profile, and a
       sidebar that shows six answers while claiming zero reads as
       broken. */
    var done = list.filter(filled).length;

    return '<div class="ep-guided">' +
      '<div class="ep-guided-main">' +
        '<div class="ep-progress"><span style="width:' + Math.round((cursor / list.length) * 100) + '%"></span></div>' +
        '<p class="ep-step-of">Question ' + (cursor + 1) + ' of ' + list.length + ' · ' + h(f.group) + '</p>' +
        fieldBlock(f, true) +
        '<div class="ep-guided-nav">' +
          '<button class="ep-btn ep-btn--ghost" type="button" data-do="prev"' + (cursor === 0 ? ' disabled' : '') + '>Back</button>' +
          (f.req
            ? '<button class="ep-btn ep-btn--primary" type="button" data-do="next">Next</button>'
            : '<button class="ep-btn ep-btn--ghost" type="button" data-do="next">Skip</button>' +
              '<button class="ep-btn ep-btn--primary" type="button" data-do="next">Next</button>') +
        '</div>' +
        '<p class="ep-hint">You can jump to the full form at any point — nothing you have answered is lost.</p>' +
      '</div>' +
      '<aside class="ep-guided-side">' +
        '<h4>Your proposal so far</h4>' +
        '<p class="ep-hint">' + done + ' of ' + list.length + ' answered. Click any line to go back to it.</p>' +
        '<ul class="ep-sofar">' + list.map(function (x, i) {
          var v = summaryValue(x);
          return '<li class="' + (i === cursor ? 'is-current' : (filled(x) ? 'is-done' : 'is-empty')) + '">' +
            '<button type="button" data-do="goto" data-value="' + i + '">' +
              '<span class="ep-sofar-k">' + h(x.label) + '</span>' +
              '<span class="ep-sofar-v">' + (v ? h(v) : '—') + '</span>' +
            '</button></li>';
        }).join('') + '</ul>' +
      '</aside>' +
    '</div>';
  }

  function filled(f) {
    var v = summaryValue(f);
    return !!v && v !== '—';
  }

  /* A one-line human rendering of whatever this field holds. Used
     by the guided sidebar and the review step, so they agree. */
  function summaryValue(f) {
    switch (f.key) {
      case 'title':       return P.title;
      case 'description': return P.description ? P.description.slice(0, 90) + (P.description.length > 90 ? '…' : '') : '';
      case 'mentorPlaydate': return P.mentorPlaydate.wanted ? ('Yes' + (P.mentorPlaydate.ask ? ' — ' + P.mentorPlaydate.ask.slice(0, 60) : '')) : 'No';
      case 'firstTime':   return P.firstTime ? 'A new event' : ('Repeat of ' + ((LIF.events.get(P.repeatOf) || {}).title || 'a previous event'));
      case 'hostKind':
        if (P.hostDetail.kind === 'group') {
          var g = LIF.GROUPS.find(function (x) { return x.id === P.hostDetail.groupId; });
          return g ? g.name : '';
        }
        return P.hostDetail.name + (P.hostDetail.coHosts.length ? ' + ' + P.hostDetail.coHosts.length + ' co-host' + (P.hostDetail.coHosts.length > 1 ? 's' : '') : '');
      case 'responsesTo': return P.hostDetail.responsesTo.join(', ');
      case 'coverImage':  return P.coverImage ? 'Uploaded' : 'Sector default';
      case 'sector':
        var s = LIF.SECTORS.find(function (x) { return x.id === P.sector; });
        return (s ? s.name : (P.sector === 'other' ? 'Other' : '')) + (P.subsector ? ' · ' + P.subsector : '');
      case 'aspect':
        var a = LIF.ASPECTS.find(function (x) { return x.id === P.aspect; });
        return a ? a.name : '';
      case 'format':
        var fm = LIF.FORMATS.find(function (x) { return x.id === P.format; });
        return (fm ? fm.name : '') + (P.location && P.location.city ? ' · ' + P.location.city : '');
      case 'type':        return LIF.events.typeName(P.type);
      case 'sessions':
        var v = P.sessions.filter(function (x) { return x.date && x.startTime; });
        if (!v.length) return '';
        return v.length === 1
          ? v[0].date + ' ' + v[0].startTime + '–' + v[0].endTime
          : v.length + ' dates, ' + v[0].date + ' to ' + v[v.length - 1].date;
      case 'recurrenceNote': return P.recurrenceNote;
      case 'payment':
        if (!P.payment.model) return '';
        var m = LIF.PAYMENT_MODELS.find(function (x) { return x.id === P.payment.model; });
        if (P.payment.model === 'sliding-scale') return 'Sliding scale $' + P.payment.min + '–$' + P.payment.max;
        if (P.payment.model !== 'free') return m.name + ' · $' + P.payment.suggested + ' suggested';
        return m.name;
      case 'languages':   return P.languages.join(', ');
      case 'participants':
        if (P.participants.min == null && P.participants.max == null) return '';
        return (P.participants.min || '?') + '–' + (P.participants.max || '?') + ' people';
      case 'audienceNote': return P.audienceNote ? P.audienceNote.slice(0, 70) + (P.audienceNote.length > 70 ? '…' : '') : '';
      case 'registerBy':  return P.registerBy;
      case 'access':
        var ac = LIF.ACCESS_LEVELS.find(function (x) { return x.id === P.access; });
        return ac ? ac.name : '';
      case 'recording':
        if (P.recording.mode !== 'recorded') return 'Live only';
        var ra = LIF.RECORDING_ACCESS.find(function (x) { return x.id === P.recording.access; });
        return 'Recorded · ' + (ra ? ra.name.toLowerCase() : '');
      case 'resourceAsks':
        return P.resourceAsks.map(function (id) {
          return (LIF.RESOURCE_ASKS.find(function (r) { return r.id === id; }) || {}).name;
        }).filter(Boolean).join(', ');
      default: return '';
    }
  }

  /* =========================================================
   * 6. INVITATION BUILDER
   * The proposal's details migrate in as locked blocks that
   * cannot be deleted; everything else the creator adds.
   * ======================================================= */
  /* Cut at a word boundary. A card blurb that ends "who k" reads as
     a bug, and the two places that shorten prose both hit it. */
  function trimTo(text, n) {
    var s = String(text || '').trim();
    if (s.length <= n) return s;
    var cut = s.slice(0, n);
    var sp = cut.lastIndexOf(' ');
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.—-]+$/, '') + '…';
  }

  function defaultInvitation() {
    return {
      headline: P.title,
      welcome: 'You are warmly invited.',
      body: P.description,
      bring: '',
      closing: 'I would love to see you there.',
      showBlocks: { when: true, where: true, host: true, cost: true, language: true, recording: true, capacity: true },
      card: { title: P.title, blurb: trimTo(P.description, 120) }
    };
  }

  function invitationLayout() {
    var inv = P.invitation = P.invitation || defaultInvitation();
    return '<div class="ep-invite">' +
      '<div class="ep-invite-edit">' +
        '<h3>Build your invitation</h3>' +
        '<p class="ep-hint">Everything from your proposal is already here. The details marked with a lock are ' +
          'required on every LiF invitation and cannot be removed — you can still choose how much of the rest shows.</p>' +

        '<label class="ep-sublabel">Cover</label>' +
        '<div class="ep-cover ep-cover--sm" style="background:' + coverPreview() + '"></div>' +
        '<div class="ep-row"><input class="ep-input" type="file" accept="image/*" data-do="pick-cover"></div>' +

        '<label class="ep-sublabel">Headline <span class="ep-lock">locked field, editable text</span></label>' +
        '<input class="ep-input" type="text" data-set="inv-headline" value="' + h(inv.headline) + '">' +

        '<label class="ep-sublabel">Opening line</label>' +
        '<input class="ep-input" type="text" data-set="inv-welcome" value="' + h(inv.welcome) + '">' +

        '<label class="ep-sublabel">The invitation itself <span class="ep-lock">locked field, editable text</span></label>' +
        '<textarea class="ep-input ep-textarea" data-set="inv-body" rows="6">' + h(inv.body) + '</textarea>' +

        '<label class="ep-sublabel">What to bring / how to prepare</label>' +
        '<textarea class="ep-input ep-textarea" data-set="inv-bring" rows="3" placeholder="Optional.">' + h(inv.bring) + '</textarea>' +

        '<label class="ep-sublabel">Closing line</label>' +
        '<input class="ep-input" type="text" data-set="inv-closing" value="' + h(inv.closing) + '">' +

        '<label class="ep-sublabel">Which details to show</label>' +
        '<div class="ep-checks ep-checks--tight">' +
          [['when', 'Dates and times', true], ['where', 'Where / how to join', true], ['host', 'Who is hosting', false],
           ['cost', 'What it costs', true], ['language', 'Language', false], ['recording', 'Recorded or live', true],
           ['capacity', 'How many places', false]].map(function (b) {
            var locked = b[2];
            return '<label class="ep-check' + (locked ? ' is-locked' : '') + '">' +
              '<input type="checkbox" data-do="toggle-invblock" data-value="' + b[0] + '"' +
              ((inv.showBlocks[b[0]] || locked) ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
              '<span>' + h(b[1]) + (locked ? ' <span class="ep-lock">required</span>' : '') + '</span></label>';
          }).join('') +
        '</div>' +

        '<h4 class="ep-subhead">The event card</h4>' +
        '<p class="ep-hint">The short version that shows on the hub, in search, and on a member’s dashboard. It starts ' +
          'from your title and description; trim it if it reads long.</p>' +
        '<input class="ep-input" type="text" data-set="card-title" value="' + h(inv.card.title) + '">' +
        '<textarea class="ep-input ep-textarea" data-set="card-blurb" rows="3">' + h(inv.card.blurb) + '</textarea>' +
      '</div>' +

      '<aside class="ep-invite-preview">' +
        '<p class="ep-preview-label">Preview</p>' +
        invitationPreview(inv) +
        '<p class="ep-preview-label">Card preview</p>' +
        cardPreview(inv) +
      '</aside>' +
    '</div>';
  }

  function detailRows(inv) {
    var rows = [];
    var v = P.sessions.filter(function (s) { return s.date && s.startTime; });
    if (inv.showBlocks.when && v.length) {
      rows.push(['When', v.map(function (s) { return s.date + ' · ' + s.startTime + '–' + s.endTime; }).join('<br>') +
        (P.recurrenceNote ? '<br><em>' + h(P.recurrenceNote) + '</em>' : '') +
        '<br><small>Times shown in UTC' + h(P.timezone) + '</small>']);
    }
    if (inv.showBlocks.where) {
      rows.push(['Where', P.location && P.location.venue
        ? h([P.location.venue, P.location.city, P.location.country].filter(Boolean).join(', ')) +
          (P.format === 'hybrid' ? '<br><small>Also online</small>' : '')
        : 'Online' + (P.onlineLink ? '<br><small>Link sent on registration</small>' : '')]);
    }
    if (inv.showBlocks.host) rows.push(['Host', h(P.hostDetail.kind === 'group'
      ? ((LIF.GROUPS.find(function (g) { return g.id === P.hostDetail.groupId; }) || {}).name || P.hostDetail.name)
      : P.hostDetail.name)]);
    if (inv.showBlocks.cost) rows.push(['Cost', h(summaryValue(fieldByKey('payment')) || 'Free')]);
    if (inv.showBlocks.language && P.languages.length) rows.push(['Language', h(P.languages.join(', '))]);
    if (inv.showBlocks.recording) rows.push(['Recording', P.recording.mode === 'recorded'
      ? 'Recorded — shared with ' + h(((LIF.RECORDING_ACCESS.find(function (r) { return r.id === P.recording.access; }) || {}).name || '').toLowerCase())
      : 'Live only, not recorded']);
    if (inv.showBlocks.capacity && (P.participants.min || P.participants.max)) {
      rows.push(['Places', h((P.participants.min || '?') + '–' + (P.participants.max || '?') + ' people')]);
    }
    if (P.registerBy) rows.push(['Register by', h(P.registerBy)]);
    return rows;
  }

  function invitationPreview(inv) {
    return '<article class="inv-card">' +
      '<div class="inv-cover" style="background:' + coverPreview() + '"></div>' +
      '<div class="inv-body">' +
        '<p class="inv-welcome">' + h(inv.welcome) + '</p>' +
        '<h2 class="inv-headline">' + h(inv.headline || P.title || 'Your event') + '</h2>' +
        '<div class="inv-badges">' +
          (P.type ? '<span class="inv-badge">' + h(LIF.events.typeName(P.type)) + '</span>' : '') +
          (P.format ? '<span class="inv-badge">' + h(P.format) + '</span>' : '') +
          (P.sector ? '<span class="inv-badge">' + h((LIF.SECTORS.find(function (s) { return s.id === P.sector; }) || {}).name || 'Other') + '</span>' : '') +
        '</div>' +
        '<p class="inv-text">' + h(inv.body || '').replace(/\n+/g, '</p><p class="inv-text">') + '</p>' +
        (inv.bring ? '<div class="inv-bring"><strong>Come with</strong><p>' + h(inv.bring) + '</p></div>' : '') +
        '<dl class="inv-details">' + detailRows(inv).map(function (r) {
          return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
        }).join('') + '</dl>' +
        (inv.closing ? '<p class="inv-closing">' + h(inv.closing) + '</p>' : '') +
        '<button class="inv-register" type="button" disabled>Register' +
          (P.payment.model && P.payment.model !== 'free' ? ' · ' + h(summaryValue(fieldByKey('payment'))) : '') +
        '</button>' +
        '<p class="inv-lockline">The registration button is on every LiF invitation and cannot be removed.</p>' +
      '</div>' +
    '</article>';
  }

  function cardPreview(inv) {
    var v = P.sessions.filter(function (s) { return s.date; })[0];
    return '<article class="inv-mini">' +
      '<div class="inv-mini-cover" style="background:' + coverPreview() + '"></div>' +
      '<div class="inv-mini-body">' +
        '<p class="inv-mini-when">' + h(v ? v.date + ' · ' + (v.startTime || '') : 'Date to come') + '</p>' +
        '<h4>' + h(inv.card.title || P.title || 'Your event') + '</h4>' +
        '<p>' + h(inv.card.blurb || '') + '</p>' +
        '<span class="inv-mini-btn">Register</span>' +
      '</div>' +
    '</article>';
  }

  /* =========================================================
   * 7. REVIEW + DONE
   * ======================================================= */
  function reviewLayout() {
    var groups = [];
    fieldsVisible().forEach(function (f) {
      var g = groups.find(function (x) { return x.name === f.group; });
      if (!g) groups.push(g = { name: f.group, fields: [] });
      g.fields.push(f);
    });
    var problems = Object.keys(errors);

    return '<div class="ep-review">' +
      (problems.length
        ? '<div class="ep-alert">Still needed before this can go: ' +
            problems.map(function (k) { return h(fieldByKey(k).label); }).join(', ') + '.</div>'
        : '<div class="ep-alert ep-alert--ok">Everything required is filled in. Read it once more, then send it.</div>') +
      groups.map(function (g) {
        return '<section class="ep-review-group"><h4>' + h(g.name) + '</h4><dl>' +
          g.fields.map(function (f) {
            var v = summaryValue(f);
            return '<div' + (errors[f.key] ? ' class="is-missing"' : '') + '>' +
              '<dt>' + h(f.label) + '</dt>' +
              '<dd>' + (v ? h(v) : '<em>not answered</em>') +
                ' <button type="button" class="ep-edit" data-do="edit-field" data-value="' + f.key + '">edit</button></dd>' +
              '</div>';
          }).join('') + '</dl></section>';
      }).join('') +
      '<section class="ep-review-group"><h4>Invitation</h4>' +
        '<div class="ep-review-invite">' + invitationPreview(P.invitation || defaultInvitation()) + '</div>' +
        '<button type="button" class="ep-btn ep-btn--ghost" data-do="go-invitation">Edit the invitation</button>' +
      '</section>' +
      '<section class="ep-review-group"><h4>What happens when you send this</h4>' +
        '<ol class="ep-what-next">' +
          '<li>The system assigns your event an ID and sets it to <strong>Pending</strong>.</li>' +
          '<li>An email and a private message go to you with everything below.</li>' +
          '<li>It appears on your dashboard under <strong>Events → Proposed</strong>.</li>' +
          '<li>It is filed in the LiF Events proposal repository, titled with the event name and the date stamp, ' +
              'and the LiF Events Proposal Group is notified.</li>' +
          '<li>A steward reads it and comes back to you — by email, or a call if there is a lot to talk through.</li>' +
          '<li>Once approved it goes on the LiF calendar and the status changes to <strong>Active</strong>.</li>' +
        '</ol>' +
      '</section>' +
    '</div>';
  }

  function doneLayout() {
    return '<div class="ep-done">' +
      '<div class="ep-done-mark">✓</div>' +
      '<h2>Thank you, ' + h(LIF.events.preferredName()) + '.</h2>' +
      '<p class="ep-done-lead">An email and a private message are on their way to you with the details and any updates.</p>' +
      '<div class="ep-done-id"><span>Your event ID</span><strong>' + h(P.eventId) + '</strong>' +
        '<span class="ep-status-pill">Pending</span></div>' +
      '<p>Quote that ID in any conversation about this event. If you run it again later it keeps the same ID with a ' +
        'number appended, so the whole series stays easy to follow.</p>' +
      '<div class="ep-done-outbox">' +
        '<h4>What just went out</h4>' +
        '<ul>' + LIF.eventStore.outbox().filter(function (m) { return m.eventId === P.eventId; }).map(function (m) {
          return '<li><span class="ep-kind ep-kind--' + h(m.kind) + '">' + h(m.kind) + '</span>' +
            '<div><strong>' + h(m.subject) + '</strong><br><span class="ep-hint">To ' + h(m.to) + ' — ' + h(m.body) + '</span></div></li>';
        }).join('') + '</ul>' +
        '<p class="ep-hint">These are queued rather than sent: there is no mail service behind this build yet. ' +
          'The queue is the contract — when one exists, it reads this list.</p>' +
      '</div>' +
      '<div class="ep-done-actions">' +
        '<a class="ep-btn ep-btn--primary" href="event.html?id=' + encodeURIComponent(proposalEventId()) + '">See the event page</a>' +
        '<a class="ep-btn ep-btn--ghost" href="dashboard.html">Go to my dashboard</a>' +
        '<button class="ep-btn ep-btn--ghost" type="button" data-do="close">Close</button>' +
      '</div>' +
    '</div>';
  }

  function proposalEventId() {
    return 'evt-' + String(P.eventId || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  /* =========================================================
   * 8. SHELL
   * ======================================================= */
  var STEPS = [
    ['fields', 'The details'],
    ['invitation', 'The invitation'],
    ['review', 'Review'],
    ['done', 'Sent']
  ];

  function welcomeLayout() {
    return '<div class="ep-welcome">' +
      '<p class="ep-eyebrow">Event proposal</p>' +
      '<h2>Welcome, ' + h(LIF.events.preferredName()) + '.</h2>' +
      '<p class="ep-lead">You are about to propose a gathering. There are around twenty questions, most of them short, ' +
        'and you can stop and come back — a draft saves as you go.</p>' +
      '<p class="ep-lead">How would you rather do it?</p>' +
      '<div class="ep-choice">' +
        '<button type="button" class="ep-choice-card" data-do="mode" data-value="form">' +
          '<span class="ep-choice-icon">☰</span>' +
          '<strong>Give me the form</strong>' +
          '<span>Everything on one page, grouped. Best if you already know what you are running.</span>' +
        '</button>' +
        '<button type="button" class="ep-choice-card" data-do="mode" data-value="guided">' +
          '<span class="ep-choice-icon">◷</span>' +
          '<strong>Walk me through it</strong>' +
          '<span>One question at a time, with the form building itself beside you. You can review and change ' +
            'everything before it goes.</span>' +
        '</button>' +
      '</div>' +
      (LIF.events.drafts().length
        ? '<div class="ep-drafts"><h4>Or pick up where you left off</h4>' +
          LIF.events.drafts().map(function (d) {
            return '<button type="button" class="ep-draft" data-do="load-draft" data-value="' + h(d.id) + '">' +
              '<strong>' + h(d.title || 'Untitled proposal') + '</strong>' +
              '<span>saved ' + h(new Date(d.updatedAt).toLocaleString()) + '</span></button>';
          }).join('') + '</div>'
        : '') +
      '<p class="ep-hint ep-welcome-note">Help prompts sit beside every question — the <b>?</b> button. ' +
        'The language selector at the top switches the interface; the invitation itself is translated for each ' +
        'guest when it is sent, which has to happen server-side.</p>' +
    '</div>';
  }

  function shellHtml() {
    var idx = STEPS.findIndex(function (s) { return s[0] === step; });
    return '<div class="ep-shell">' +
      '<header class="ep-head">' +
        '<div>' +
          '<p class="ep-eyebrow">Propose an event</p>' +
          '<h1>' + h(P.title || 'A new gathering') + '</h1>' +
        '</div>' +
        '<div class="ep-head-right">' +
          '<label class="ep-lang"><span class="ep-sr">Interface language</span>' +
            '<select data-do="lang">' + (LIF.UI_LANGUAGES || [{ code: 'en', native: 'English' }]).map(function (l) {
              return '<option value="' + l.code + '">' + h(l.native) + '</option>';
            }).join('') + '</select></label>' +
          '<button class="ep-x-big" type="button" data-do="close" aria-label="Close">×</button>' +
        '</div>' +
      '</header>' +

      (step === 'welcome' ? '' :
        '<nav class="ep-steps">' + STEPS.map(function (s, i) {
          return '<span class="ep-stepdot' + (i === idx ? ' is-on' : (i < idx ? ' is-done' : '')) + '">' +
            '<i>' + (i + 1) + '</i>' + h(s[1]) + '</span>';
        }).join('') +
        (step === 'fields'
          ? '<div class="ep-modeswitch">' +
              '<button type="button" class="' + (mode === 'form' ? 'is-on' : '') + '" data-do="mode" data-value="form">Form</button>' +
              '<button type="button" class="' + (mode === 'guided' ? 'is-on' : '') + '" data-do="mode" data-value="guided">Guided</button>' +
            '</div>'
          : '') +
        '</nav>') +

      '<div class="ep-scroll">' +
        (step === 'welcome' ? welcomeLayout()
          : step === 'fields' ? (mode === 'guided' ? guidedLayout() : formLayout())
          : step === 'invitation' ? invitationLayout()
          : step === 'review' ? reviewLayout()
          : doneLayout()) +
      '</div>' +

      (step === 'welcome' || step === 'done' ? '' :
        '<footer class="ep-foot">' +
          '<button class="ep-btn ep-btn--ghost" type="button" data-do="back">Back</button>' +
          '<span class="ep-foot-note" id="epFootNote">Draft saved automatically.</span>' +
          (step === 'review'
            ? '<button class="ep-btn ep-btn--primary" type="button" data-do="submit">Propose event</button>'
            : '<button class="ep-btn ep-btn--primary" type="button" data-do="forward">' +
              (step === 'fields' ? 'Save &amp; build the invitation' : 'Review it') + '</button>') +
        '</footer>') +
    '</div>';
  }

  /* =========================================================
   * 9. MOUNT + EVENTS
   * ======================================================= */
  var root = null;

  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'eventProposalRoot';
    root.className = 'ep-root hidden';
    document.body.appendChild(root);

    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    return root;
  }

  var rerenderTimer = null;
  function render(preserveFocus) {
    var active = document.activeElement;
    var key = active && active.dataset ? (active.dataset.set || active.id) : null;
    var caret = active && active.selectionStart != null ? active.selectionStart : null;
    var idx = active && active.dataset ? active.dataset.i : null;
    var scroll = root.querySelector('.ep-scroll') ? root.querySelector('.ep-scroll').scrollTop : 0;

    root.innerHTML = shellHtml();

    var sc = root.querySelector('.ep-scroll');
    if (sc) sc.scrollTop = scroll;
    if (preserveFocus && key) {
      var sel = idx != null
        ? root.querySelector('[data-set="' + key + '"][data-i="' + idx + '"]')
        : (root.querySelector('[data-set="' + key + '"]') || root.querySelector('#' + key));
      if (sel) {
        sel.focus();
        if (caret != null && sel.setSelectionRange && /text|search|url|tel|password/.test(sel.type || 'text')) {
          try { sel.setSelectionRange(caret, caret); } catch (e) {}
        }
      }
    }
  }

  /** Text typing must not re-render on every keystroke (it would
      fight the cursor), so plain inputs write straight to state and
      only the things that change the shape of the form re-render. */
  function onInput(e) {
    var el = e.target.closest('[data-set]');
    if (!el) return;
    write(el.dataset.set, el.value, el);
    if (RESHAPES[el.dataset.set]) render(true);
    scheduleDraft();
  }

  function onChange(e) {
    var el = e.target.closest('[data-set]');
    if (el) { write(el.dataset.set, el.value, el); render(true); scheduleDraft(); return; }
    var f = e.target.closest('[data-do="pick-cover"]');
    if (f && f.files && f.files[0]) {
      var reader = new FileReader();
      reader.onload = function () { P.coverImage = reader.result; render(); scheduleDraft(); };
      reader.readAsDataURL(f.files[0]);
    }
  }

  /* Fields whose value changes which other fields exist. */
  var RESHAPES = { sector: 1, format: 1, timezone: 0 };

  function onClick(e) {
    var el = e.target.closest('[data-do]');
    if (!el) return;
    var v = el.dataset.value;
    var i = el.dataset.i != null ? +el.dataset.i : null;

    switch (el.dataset.do) {
      case 'close': close(); return;
      case 'mode':
        mode = v;
        if (step === 'welcome') step = 'fields';
        render(); return;
      case 'help': openHelp[v] = !openHelp[v]; render(); return;
      case 'load-draft':
        P = LIF.events.getDraft(v) || P;
        step = 'fields'; render(); return;

      /* The guided pathway checks a required answer before moving
         on — catching it here beats collecting six red boxes at the
         end. Optional fields skip freely. */
      case 'next': {
        var list = fieldsVisible();
        var f = list[cursor];
        if (f && f.req) {
          var err = errorFor(f);
          if (err) { errors[f.key] = err; render(); return; }
          delete errors[f.key];
        }
        cursor++;
        if (cursor >= list.length) { cursor = list.length - 1; validateAll(); P.invitation = P.invitation || defaultInvitation(); step = 'invitation'; }
        render(); scheduleDraft(); return;
      }
      case 'prev': cursor--; render(); return;
      case 'goto': cursor = +v; render(); return;

      case 'back':
        if (step === 'fields') step = 'welcome';
        else if (step === 'invitation') step = 'fields';
        else if (step === 'review') step = 'invitation';
        render(); return;

      case 'forward':
        if (step === 'fields') {
          validateAll();
          if (Object.keys(errors).length) {
            mode = 'form';
            render();
            var first = root.querySelector('.ep-field.has-error');
            if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            toast('A few required answers are still missing — they are marked in red.');
            return;
          }
          P.invitation = P.invitation || defaultInvitation();
          step = 'invitation';
        } else if (step === 'invitation') {
          validateAll();
          step = 'review';
        }
        render(); saveDraft(); return;

      case 'go-invitation': step = 'invitation'; render(); return;
      case 'edit-field':
        step = 'fields';
        var list = fieldsVisible();
        cursor = Math.max(0, list.findIndex(function (f) { return f.key === v; }));
        if (mode === 'form') {
          render();
          var node = root.querySelector('[data-field="' + v + '"]');
          if (node) { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); node.classList.add('is-flash'); }
        } else render();
        return;

      case 'submit': submit(); return;

      /* --- per-field actions --- */
      case 'mentor-wanted': P.mentorPlaydate.wanted = v === 'yes'; render(); return;
      case 'first-time': P.firstTime = v === 'yes'; if (P.firstTime) P.repeatOf = null; render(); return;
      case 'host-kind': P.hostDetail.kind = v; render(); return;
      case 'set-format': P.format = v; render(); return;
      case 'set-payment': P.payment.model = v; render(); return;
      case 'set-access': P.access = v; render(); return;
      case 'rec-mode': P.recording.mode = v; render(); return;
      case 'toggle-language': toggle(P.languages, v); render(); return;
      case 'toggle-resource': toggle(P.resourceAsks, v); render(); return;
      case 'toggle-invblock':
        P.invitation.showBlocks[v] = !P.invitation.showBlocks[v];
        render(); return;

      case 'add-session': P.sessions.push({ date: '', startTime: '', endTime: '' }); render(); return;
      case 'drop-session': P.sessions.splice(i, 1); render(); return;

      case 'add-cohost': {
        var n = root.querySelector('#epCoName'), em = root.querySelector('#epCoEmail');
        if (!n.value.trim()) { toast('A name or email to search for, first.'); return; }
        P.hostDetail.coHosts.push({ name: n.value.trim(), email: (em.value || '').trim() || 'unknown@—' });
        render(); scheduleDraft(); return;
      }
      case 'drop-cohost': P.hostDetail.coHosts.splice(i, 1); render(); return;

      case 'add-replyto': {
        var r = root.querySelector('#epReplyTo');
        if (!r.value.trim()) { toast('Type an address first.'); return; }
        P.hostDetail.responsesTo.push(r.value.trim());
        render(); scheduleDraft(); return;
      }
      case 'drop-reply-to': P.hostDetail.responsesTo.splice(i, 1); render(); return;

      case 'clear-cover': P.coverImage = null; render(); return;

      case 'suggest-sub': {
        var s = root.querySelector('#epNewSub');
        if (!s.value.trim()) { toast('Type the subsector you want first.'); return; }
        P.subsectorSuggestion = s.value.trim();
        toast('Noted — “' + P.subsectorSuggestion + '” goes to a steward with your proposal. New subsectors are ' +
          'reviewed before they join the taxonomy.');
        render(); return;
      }

      case 'lang': return;
    }
  }

  function toggle(arr, v) {
    var i = arr.indexOf(v);
    if (i === -1) arr.push(v); else arr.splice(i, 1);
  }

  /** One writer for every input, keyed by its data-set name. */
  function write(key, value, el) {
    var num = function (x) { return x === '' ? null : +x; };
    switch (key) {
      case 'title': case 'description': case 'recurrenceNote': case 'audienceNote':
      case 'registerBy': case 'timezone': case 'aspect': case 'type':
        P[key] = value; break;
      case 'mentor-ask': P.mentorPlaydate.ask = value; break;
      case 'repeat-of':
        P.repeatOf = value || null;
        if (value) {
          var src = LIF.events.get(value);
          if (src) {
            P.title = src.title; P.description = src.description;
            P.sector = src.sector; P.subsector = src.subsector || '';
            P.format = src.format; P.type = src.type; P.aspect = src.aspect;
            P.languages = (src.languages || [src.language]).slice();
            P.location = src.location ? JSON.parse(JSON.stringify(src.location)) : null;
            P.seriesId = src.seriesId;
            toast('Pulled the content across from “' + src.title + '”. Set new dates and anything else that changed.');
          }
        }
        break;
      case 'host-group': P.hostDetail.groupId = value || null; break;
      case 'sector':
        P.sector = value;
        if (!(LIF.SUBSECTORS[value] || []).some(function (s) { return s === P.subsector; })) P.subsector = '';
        break;
      case 'sector-other': P.sectorOther = value; break;
      case 'subsector': P.subsector = value; break;
      case 'online-link': P.onlineLink = value; break;
      case 'loc-venue': case 'loc-city': case 'loc-region': case 'loc-country':
        P.location = P.location || {};
        P.location[key.slice(4)] = value;
        break;
      case 'loc-lat': P.location = P.location || {}; P.location.lat = num(value); break;
      case 'loc-lng': P.location = P.location || {}; P.location.lng = num(value); break;
      case 'session-date':  P.sessions[+el.dataset.i].date = value; break;
      case 'session-start': P.sessions[+el.dataset.i].startTime = value; break;
      case 'session-end':   P.sessions[+el.dataset.i].endTime = value; break;
      case 'pay-min': P.payment.min = num(value); break;
      case 'pay-max': P.payment.max = num(value); break;
      case 'pay-suggested': P.payment.suggested = num(value); break;
      case 'pay-note': P.payment.note = value; break;
      case 'part-min': P.participants.min = num(value); break;
      case 'part-max': P.participants.max = num(value); break;
      case 'overflow': P.overflowPlan = value; break;
      case 'undermin': P.underMinPlan = value; break;
      case 'invite-note': P.inviteNote = value; break;
      case 'rec-access': P.recording.access = value; break;
      case 'inv-headline': P.invitation.headline = value; break;
      case 'inv-welcome': P.invitation.welcome = value; break;
      case 'inv-body': P.invitation.body = value; break;
      case 'inv-bring': P.invitation.bring = value; break;
      case 'inv-closing': P.invitation.closing = value; break;
      case 'card-title': P.invitation.card.title = value; break;
      case 'card-blurb': P.invitation.card.blurb = value; break;
    }
  }

  /* --- the invitation preview should track typing, but only after
         a pause, so the caret never jumps mid-word --- */
  var draftTimer = null;
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      saveDraft();
      if (step === 'invitation') render(true);
    }, 600);
  }

  function saveDraft() {
    if (!P || step === 'done') return;
    LIF.events.saveDraft(P);
    var note = root.querySelector('#epFootNote');
    if (note) note.textContent = 'Draft saved ' + new Date().toLocaleTimeString() + '.';
  }

  /* --- turn the collected answers into the real proposal shape --- */
  function compile() {
    var tz = P.timezone;
    P.sessions = P.sessions.filter(function (s) { return s.date && s.startTime && s.endTime; });
    var out = JSON.parse(JSON.stringify(P));
    out.sessions = P.sessions.map(function (s) {
      return { start: s.date + 'T' + s.startTime + ':00' + tz, end: s.date + 'T' + s.endTime + ':00' + tz };
    });
    out.registerBy = P.registerBy ? P.registerBy + 'T23:59:00' + tz : out.sessions[0].start;
    if (P.hostDetail.kind === 'group') {
      var g = LIF.GROUPS.find(function (x) { return x.id === P.hostDetail.groupId; });
      if (g) out.hostDetail.name = g.name;
    }
    if (P.repeatOf) {
      var src = LIF.events.get(P.repeatOf);
      if (src) out.seriesId = src.seriesId;
    }
    out.tags = [P.subsector].filter(Boolean);
    return out;
  }

  function submit() {
    if (!validateAll()) {
      render();
      toast('A few required answers are missing. They are marked below.');
      return;
    }
    var compiled = compile();
    var saved = LIF.events.submitProposal(compiled);
    P.eventId = saved.eventId;
    P.id = saved.id;
    P.status = 'pending';
    step = 'done';
    render();
    if (LIF.MEMBER && LIF.MEMBER.events.proposed.indexOf(saved.id) === -1) LIF.MEMBER.events.proposed.push(saved.id);
    document.dispatchEvent(new CustomEvent('lif:eventproposed', { detail: saved }));
  }

  function toast(msg) {
    if (LIF.util && LIF.util.showToast && document.getElementById('toast')) LIF.util.showToast(msg);
    else {
      var n = root.querySelector('#epFootNote');
      if (n) n.textContent = msg;
    }
  }

  /* =========================================================
   * 10. PUBLIC
   * ======================================================= */
  function open(opts) {
    opts = opts || {};
    ensureRoot();
    P = opts.proposal || blank();
    step = opts.step || 'welcome';
    mode = opts.mode || 'form';
    cursor = 0; errors = {}; openHelp = {};
    if (opts.repeatOf) {
      P.firstTime = false;
      write('repeat-of', opts.repeatOf, null);
    }
    render();
    root.classList.remove('hidden');
    document.body.classList.add('ep-open');
  }

  function close() {
    if (!root) return;
    if (step !== 'done' && P && (P.title || P.description)) saveDraft();
    root.classList.add('hidden');
    document.body.classList.remove('ep-open');
    document.dispatchEvent(new CustomEvent('lif:eventschange'));
  }

  function init() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-propose-event]');
      if (!el) return;
      e.preventDefault();
      open({ repeatOf: el.dataset.repeatOf || null });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root && !root.classList.contains('hidden')) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { open: open, close: close, repeatNote: repeatNote };
})();
