/**
 * eventsModel.js
 * ---------------------------------------------------------------
 * The events domain: the taxonomies the Event Proposal form asks
 * for, the extra fields a proposed event carries beyond what the
 * original sample data had, and the store that remembers what this
 * member has proposed, registered for and RSVP'd to.
 *
 * Loaded after data.js (and after dashboardData.js where that
 * exists). It never replaces an event — it fills in the fields the
 * events pathway needs and leaves everything already there alone,
 * so the map, filters and calendar keep reading exactly what they
 * read before.
 *
 * WHERE THE BACKEND PLUGS IN
 * Everything a member does lives in LIF.eventStore, which is a
 * localStorage-backed object with a deliberately small surface:
 * read(), write(), and a handful of typed helpers. Swap those three
 * for API calls and every screen in the pathway follows, because
 * none of them touch localStorage directly.
 *
 * ONE HONEST LIMITATION, STATED UP FRONT
 * The spec's pathway has real server-side legs — the confirmation
 * email, the private message, the Google Workspace proposal
 * repository, the 24h/1h reminder mails, the review by the LiF
 * Events group. Those cannot exist in a frontend build. Rather than
 * pretend, every one of them is recorded as an "outbox" entry the
 * UI can show ("this is the email that would go out, here is who
 * it goes to, here is when"), so the wiring is visible and testable
 * before the mail service exists. See LIF.eventStore.outbox().
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

/* ===============================================================
 * 1. TAXONOMIES FROM THE PROPOSAL FORM
 * ============================================================= */

/* The spec's five event types replace the generic set the sample
   data shipped with. LEGACY_TYPES maps the old ids onto the new
   ones so nine already-written sample events don't need rewriting
   and no filter suddenly matches nothing. */
LIF.EVENT_TYPES = [
  { id: 'summit',        name: 'Summit',                     desc: 'A larger gathering, often multi-session, with several voices.' },
  { id: 'wisdom-circle', name: 'Wisdom Circle',              desc: 'A held conversation in a circle — one topic, everyone speaks.' },
  { id: 'collaboration', name: 'Collaboration / co-creation',desc: 'People making something together, not just discussing it.' },
  { id: 'playdate',      name: 'Playdate / activity',        desc: 'Doing something. Hands, bodies, place.' },
  { id: 'meet-greet',    name: 'Meet & greet / casual',      desc: 'Low-stakes conversation. No agenda beyond meeting each other.' }
];

LIF.LEGACY_TYPES = {
  workshop: 'collaboration', discussion: 'wisdom-circle', meetup: 'meet-greet',
  networking: 'meet-greet', activity: 'playdate'
};

/* Payment models. These are the options the proposal form offers and
   the registration flow branches on; `needsPayment` is what sends a
   registrant to the payment step instead of straight to confirmed. */
LIF.PAYMENT_MODELS = [
  { id: 'free',          name: 'Free',                        needsPayment: false, desc: 'No money changes hands.' },
  { id: 'sliding-scale', name: 'Sliding scale / pay what you can', needsPayment: true, desc: 'You set the range; the guest picks their place in it.' },
  { id: 'gift',          name: 'Gift',                        needsPayment: true,  desc: 'Given freely; guests may give back if they wish.' },
  { id: 'gratitude',     name: 'Honorarium / gratitude',      needsPayment: true,  desc: 'A suggested appreciation for the host’s offering.' }
];

/* The public hub's cost filter predates this and uses its own three
   ids. Map one onto the other so a sliding-scale event still shows
   up under the "Sliding Scale" filter chip. */
LIF.PAYMENT_TO_COST = { free: 'free', 'sliding-scale': 'sliding-scale', gift: 'donation', gratitude: 'donation' };
LIF.COST_TO_PAYMENT = { free: 'free', 'sliding-scale': 'sliding-scale', donation: 'gift' };

LIF.ACCESS_LEVELS = [
  { id: 'open',    name: 'Open',                desc: 'Anyone on the hub can find it and register.' },
  { id: 'private', name: 'Private / invite only',desc: 'Only invited people see it. It still sits on the master LiF calendar.' }
];

LIF.RECORDING_MODES = [
  { id: 'live',     name: 'Live only — not recorded' },
  { id: 'recorded', name: 'Will be recorded' }
];

LIF.RECORDING_ACCESS = [
  { id: 'registered', name: 'Everyone who registered' },
  { id: 'attendees',  name: 'Only those who actually attended' },
  { id: 'public',     name: 'Public — event page and the library' },
  { id: 'private',    name: 'Private — host and LiF only' }
];

LIF.EVENT_STATUSES = [
  { id: 'draft',     name: 'Draft',     desc: 'Started, not yet submitted. Only you can see it.' },
  { id: 'pending',   name: 'Pending',   desc: 'Submitted. A LiF steward is reviewing it.' },
  { id: 'active',    name: 'Active',    desc: 'Approved, on the LiF calendar, open to the hub.' },
  { id: 'complete',  name: 'Complete',  desc: 'It happened. Recordings and follow-up live on the event page.' },
  { id: 'cancelled', name: 'Cancelled', desc: 'Called off. Registrants were notified.' }
];

LIF.HOST_KINDS = [
  { id: 'individual', name: 'Just me (plus co-hosts)' },
  { id: 'group',      name: 'A group I belong to' }
];

LIF.RESOURCE_ASKS = [
  { id: 'meeting-link', name: 'A meeting link created for me', desc: 'LiF sets up the Zoom room and sends you the link. Leave off if you already have one.' },
  { id: 'payment',      name: 'The payment function',          desc: 'Wires your event to the LiF payment apps so guests can pay or gift on the hub.' },
  { id: 'invitation',   name: 'Help with the invitation',      desc: 'Someone from LiF works on wording and images with you before it goes out.' }
];

LIF.POST_EVENT_ACTIONS = [
  { id: 'forum',      name: 'Open a discussion forum',    desc: 'A thread for everyone who came, linked from the event page and the follow-up email.' },
  { id: 'group',      name: 'Propose a group',            desc: 'Turn the people in the room into a standing circle.' },
  { id: 'resources',  name: 'Share resources',            desc: 'Slides, notes, links, reading — uploaded to the event page.' },
  { id: 'recording',  name: 'Publish the recording',      desc: 'Released to whoever you chose when you proposed the event.' },
  { id: 'survey',     name: 'Ask for feedback',           desc: 'A short questionnaire with an open text field, linked everywhere the event is.' }
];

/* Reminders the spec asks for. Duplicates of the confirmation mail. */
LIF.REMINDER_SCHEDULE = [
  { id: 'day',  label: '24 hours before', offsetMinutes: 24 * 60 },
  { id: 'hour', label: '1 hour before',   offsetMinutes: 60 }
];

/* A sector-themed default cover, so an event with no uploaded image
   still looks like itself rather than like a broken <img>. Two stops
   per sector, used as a CSS gradient. */
LIF.SECTOR_COVERS = {
  spirituality:   ['#755091', '#C89CD8'],
  science:        ['#4C749D', '#98C5E6'],
  relations:      ['#BF6314', '#F5C98A'],
  media:          ['#6250A3', '#B1A1E8'],
  justice:        ['#8B1A1A', '#EF2D2D'],
  infrastructure: ['#355B82', '#7CABD3'],
  health:         ['#5A7A44', '#A9CF9B'],
  governance:     ['#9B7605', '#E7C95A'],
  environment:    ['#3E5F2D', '#8CB776'],
  education:      ['#658FBA', '#D5E7F6'],
  economics:      ['#C49A13', '#F3E1A0'],
  arts:           ['#9164A9', '#EEE3F7']
};

/* ===============================================================
 * 2. NORMALISATION
 * Every event in the app goes through this once at load, so the
 * rest of the pathway can rely on the full shape existing without
 * defensive checks in twenty places.
 * ============================================================= */
(function normalise() {
  var HOUR = 3600000;

  function minutesBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 60000); }

  LIF.EVENTS.forEach(function (e) {
    /* --- type: move legacy ids onto the spec's five --- */
    if (LIF.LEGACY_TYPES[e.type]) { e.legacyType = e.type; e.type = LIF.LEGACY_TYPES[e.type]; }

    /* --- identity --- */
    if (!e.eventId) e.eventId = 'LIF-' + e.id.replace(/^evt-/, '').toUpperCase();
    if (!e.seriesId) e.seriesId = e.eventId;
    if (e.occurrence == null) e.occurrence = 1;

    /* --- status: derived from the clock unless already set --- */
    if (!e.status) e.status = new Date(e.end || e.start) < new Date() ? 'complete' : 'active';

    /* --- host, as an object. The samples carry a plain string. --- */
    if (typeof e.host === 'string') {
      e.hostName = e.host;
      e.hostDetail = e.hostDetail || {
        kind: e.host === 'Love is Foundation' ? 'lif' : 'individual',
        name: e.host, email: 'events@loveisfoundation.org',
        memberId: null, coHosts: [], groupId: null,
        responsesTo: ['events@loveisfoundation.org']
      };
    }

    /* --- sessions: one per calendar block. Single-date events get a
           one-item array so multi-day and single-day render alike. --- */
    if (!e.sessions) e.sessions = [{ start: e.start, end: e.end || e.start }];
    if (!e.timezone) e.timezone = (e.start.match(/([+-]\d{2}:\d{2})$/) || [null, 'Z'])[1];
    if (e.recurrenceNote == null) e.recurrenceNote = e.sessions.length > 1 ? e.sessions.length + ' sessions' : '';

    /* --- payment: derived from the old `cost` string --- */
    if (!e.payment) {
      var model = LIF.COST_TO_PAYMENT[e.cost] || 'free';
      e.payment = {
        model: model,
        min: model === 'sliding-scale' ? 0 : null,
        max: model === 'sliding-scale' ? 60 : null,
        suggested: model === 'free' ? null : 25,
        currency: 'USD',
        note: model === 'sliding-scale'
          ? 'Pay anywhere in the range, including nothing. No one is asked why.'
          : (model === 'gift' ? 'Given freely. A gift back is welcome, never expected.' : '')
      };
    }

    /* --- capacity as a range, keeping the old numeric field --- */
    if (e.participants == null) {
      e.participants = { min: e.capacity ? Math.max(3, Math.round(e.capacity * 0.15)) : null, max: e.capacity || null };
    }
    if (e.overflowPlan == null) e.overflowPlan = 'If more people want in than there is room for, a second session is offered.';
    if (e.underMinPlan == null) e.underMinPlan = 'If we do not reach the minimum, the event is postponed rather than cancelled and everyone is told a week ahead.';
    if (e.audienceNote == null) e.audienceNote = '';

    /* --- registration window --- */
    if (!e.registerBy) {
      var by = new Date(new Date(e.start).getTime() - 24 * HOUR);
      e.registerBy = by.toISOString();
    }
    /* `access` is the host's open/invite-only choice; `visibility`
       is the separate organization gate. An Ashoka-members event is
       open to register for - it is just only visible to members. */
    if (e.access == null) e.access = e.visibility === 'private' ? 'private' : 'open';
    if (e.inviteNote == null) e.inviteNote = '';

    /* --- recording --- */
    if (!e.recording) {
      e.recording = { mode: 'live', access: 'registered', url: null };
    }

    /* --- languages: the old field is a single string --- */
    if (!e.languages) e.languages = [e.language].filter(Boolean);

    /* --- everything the post-event pathway hangs off --- */
    if (!e.postEvent) {
      e.postEvent = { hostNote: '', resources: [], recordingUrl: null, surveyUrl: null,
                      threadId: null, groupId: null, followUpSentAt: null, actions: [] };
    }
    if (!e.resourceAsks) e.resourceAsks = [];
    if (e.attended == null) e.attended = e.status === 'complete' ? Math.round((e.registered || 0) * 0.72) : 0;
    if (e.durationMinutes == null) e.durationMinutes = minutesBetween(e.start, e.end || e.start);
    if (!e.coverImage) e.coverImage = null;
    if (!e.mentorPlaydate) e.mentorPlaydate = { wanted: false, ask: '' };
    if (e.firstTime == null) e.firstTime = true;
  });
})();

/* ===============================================================
 * 3. EXTRA SAMPLE EVENTS
 * The nine originals are all upcoming, public and open — which
 * means four of the five statuses and half the pathway had nothing
 * to demonstrate. These five exist so every state in the spec is
 * visible in one session without editing any data by hand.
 * ============================================================= */
LIF.EVENTS.push(
  /* --- COMPLETE, with the whole post-event pathway populated:
         recording, host note, resources, survey, discussion thread,
         and a group that grew out of it. --- */
  {
    id: 'evt-201', eventId: 'LIF-201', seriesId: 'LIF-201', occurrence: 1,
    status: 'complete',
    title: 'Water Justice Listening Session',
    summary: 'Neighbours, hydrologists and city staff in one room, listening before deciding.',
    description: 'We spent two hours hearing from people who live closest to the creek before anyone talked policy. The recording, the transcript notes and the map we drew together are all on this page.',
    aspect: 'nature-nurture', sector: 'environment', subsector: 'Water',
    format: 'hybrid', type: 'wisdom-circle',
    start: '2026-08-06T18:00:00-07:00', end: '2026-08-06T20:00:00-07:00',
    durationLabel: '2 Hours', commitment: 'one-time', cost: 'free', language: 'English',
    location: { venue: 'Southeast Community Room', city: 'Portland', region: 'Oregon', country: 'USA', lat: 45.5051, lng: -122.6300 },
    onlineLink: 'https://example.org/join/water-justice-listening',
    host: 'Alex Rivera',
    hostDetail: { kind: 'individual', name: 'Alex Rivera', email: 'alex.rivera@example.org', memberId: 'mem-001',
                  coHosts: [{ name: 'Mei Tanaka', email: 'mei@example.org' }], groupId: null,
                  responsesTo: ['alex.rivera@example.org'] },
    organization: null, visibility: 'public', access: 'open',
    capacity: 45, registered: 38, attended: 31,
    participants: { min: 8, max: 45 },
    tags: ['water', 'listening', 'policy'],
    updatedAt: '2026-08-08T09:00:00-07:00',
    recording: { mode: 'recorded', access: 'registered', url: 'https://example.org/recordings/water-justice-listening' },
    postEvent: {
      hostNote: 'Thank you for coming, and for staying with the hard part of the conversation. The recording is below, along with the notes and the map we drew. I have opened a thread — the question about the culvert deserves more than the ten minutes we gave it.',
      resources: [
        { name: 'Session notes (shared doc)', url: 'https://example.org/docs/water-justice-notes' },
        { name: 'The map we drew together',   url: 'https://example.org/docs/water-justice-map' }
      ],
      recordingUrl: 'https://example.org/recordings/water-justice-listening',
      surveyUrl: 'https://example.org/survey/water-justice-listening',
      threadId: 'thr-201', groupId: null,
      followUpSentAt: '2026-08-07T11:00:00-07:00',
      actions: ['recording', 'resources', 'forum', 'survey']
    }
  },

  /* --- ACTIVE but registration has CLOSED. Demonstrates the closed
         button state everywhere plus "tell me if it opens again". --- */
  {
    id: 'evt-202', eventId: 'LIF-202', seriesId: 'LIF-202', occurrence: 1,
    status: 'active',
    title: 'Deep Adaptation Summit: Three Days of Honest Planning',
    summary: 'A three-day summit on planning honestly for what is already arriving. Registration has closed.',
    description: 'Three days, twelve sessions, one question: what does honest planning look like when the forecasts are this bad and the people are this willing? Registration closed early — the room filled.',
    aspect: 'engagement-communion', sector: 'governance', subsector: 'Bio-regional planning',
    format: 'hybrid', type: 'summit',
    start: '2026-09-18T09:00:00-07:00', end: '2026-09-20T16:00:00-07:00',
    sessions: [
      { start: '2026-09-18T09:00:00-07:00', end: '2026-09-18T16:00:00-07:00' },
      { start: '2026-09-19T09:00:00-07:00', end: '2026-09-19T16:00:00-07:00' },
      { start: '2026-09-20T09:00:00-07:00', end: '2026-09-20T16:00:00-07:00' }
    ],
    recurrenceNote: 'Three consecutive days, same room, same hours.',
    durationLabel: 'Full Day', commitment: 'multiple-sessions', cost: 'sliding-scale', language: 'English',
    location: { venue: 'Cascadia Commons Hall', city: 'Seattle', region: 'Washington', country: 'USA', lat: 47.6062, lng: -122.3321 },
    onlineLink: 'https://example.org/join/deep-adaptation-summit',
    host: 'Love is Foundation',
    organization: null, visibility: 'public', access: 'open',
    capacity: 120, registered: 120,
    participants: { min: 40, max: 120 },
    registerBy: '2026-08-15T23:59:00-07:00',
    tags: ['summit', 'planning', 'adaptation'],
    updatedAt: '2026-08-16T08:00:00-07:00',
    payment: { model: 'sliding-scale', min: 0, max: 240, suggested: 90, currency: 'USD',
               note: 'Three days at whatever you can carry. Nobody is turned away, and nobody is asked why.' },
    recording: { mode: 'recorded', access: 'attendees', url: null }
  },

  /* --- PRIVATE / invite only. On the master calendar, invisible to
         everyone but the invited. This member is invited. --- */
  {
    id: 'evt-203', eventId: 'LIF-203', seriesId: 'LIF-203', occurrence: 1,
    status: 'active',
    title: 'Watershed Stewards: Winter Planning (invite only)',
    summary: 'A closed planning session for the people already tending the creek.',
    description: 'Not a public gathering — this is the standing stewards planning the winter work. If you are on the invitation list it is because you have been on the bank with us.',
    aspect: 'nature-nurture', sector: 'environment', subsector: 'Regenerative',
    format: 'online', type: 'collaboration',
    start: '2026-09-09T18:30:00-07:00', end: '2026-09-09T20:00:00-07:00',
    durationLabel: '90 Minutes', commitment: 'ongoing', cost: 'free', language: 'English',
    location: null, onlineLink: 'https://example.org/join/stewards-winter-planning',
    host: 'Watershed Stewards Assembly',
    hostDetail: { kind: 'group', name: 'Watershed Stewards Assembly', email: 'stewards@example.org',
                  memberId: null, coHosts: [], groupId: 'grp-4', responsesTo: ['stewards@example.org'] },
    organization: null, visibility: 'private', access: 'private',
    inviteNote: 'Invitations go by private message to everyone who came to two or more work mornings this year.',
    invitedMemberIds: ['mem-001'],
    capacity: 20, registered: 11,
    participants: { min: 5, max: 20 },
    tags: ['planning', 'stewardship'],
    updatedAt: '2026-08-20T16:40:00-07:00'
  },

  /* --- CANCELLED, under the minimum. The spec asks the proposal
         form what should happen in exactly this case; here is what
         it looks like when it does. --- */
  {
    id: 'evt-204', eventId: 'LIF-204', seriesId: 'LIF-204', occurrence: 1,
    status: 'cancelled',
    cancelledReason: 'Four people registered against a minimum of eight. Rather than run it thin, the host is re-offering it in November — everyone who registered has been told and will get first refusal.',
    title: 'Compassionate Listening Practicum',
    summary: 'A practicum in staying present when a conversation gets hard. Cancelled — under minimum.',
    description: 'Paired practice, three rounds, with debriefs. Cancelled for this date and being re-offered in November.',
    aspect: 'presence-being', sector: 'relations', subsector: 'Conflict Management',
    format: 'online', type: 'wisdom-circle',
    start: '2026-08-28T17:00:00-07:00', end: '2026-08-28T19:00:00-07:00',
    durationLabel: '2 Hours', commitment: 'one-time', cost: 'donation', language: 'English',
    location: null, onlineLink: null,
    host: 'Nadia Haddad',
    hostDetail: { kind: 'individual', name: 'Nadia Haddad', email: 'nadia@example.org', memberId: 'ppl-9',
                  coHosts: [], groupId: null, responsesTo: ['nadia@example.org'] },
    organization: null, visibility: 'public', access: 'open',
    capacity: 16, registered: 4,
    participants: { min: 8, max: 16 },
    tags: ['listening', 'practice'],
    updatedAt: '2026-08-19T12:00:00-07:00'
  },

  /* --- A REPEAT of an earlier event: same content, same series, new
         dates, id suffixed "-2" exactly as the spec describes. --- */
  {
    id: 'evt-002-2', eventId: 'LIF-002-2', seriesId: 'LIF-002', occurrence: 2,
    repeatOf: 'evt-002',
    status: 'active',
    title: 'Money as Love: Exploring Enoughness',
    summary: 'The same workshop, run again in October for people who could not make September.',
    description: 'What changes when we treat money as a form of love rather than a source of fear? This workshop unpacks the LiF Enoughness frame and walks through the Money as Love app, with time for questions and small-group reflection.',
    aspect: 'source-resources', sector: 'economics', subsector: 'Caring economy',
    format: 'online', type: 'collaboration',
    start: '2026-10-09T10:00:00-07:00', end: '2026-10-09T11:30:00-07:00',
    durationLabel: '90 Minutes', commitment: 'one-time', cost: 'sliding-scale', language: 'Spanish',
    location: null, onlineLink: 'https://example.org/join/money-as-love-oct',
    host: 'Love is Foundation',
    organization: null, visibility: 'public', access: 'open',
    capacity: 100, registered: 12,
    participants: { min: 10, max: 100 },
    tags: ['enoughness', 'money-as-love', 'economics'],
    updatedAt: '2026-08-22T09:15:00-07:00'
  }
);

/* Run the five new ones through the same normaliser, so they carry
   every derived field the originals got. Idempotent by design. */
(function normaliseAdded() {
  var pending = LIF.EVENTS.filter(function (e) { return !e.postEvent || !e.payment || !e.sessions; });
  pending.forEach(function (e) {
    if (LIF.LEGACY_TYPES[e.type]) { e.legacyType = e.type; e.type = LIF.LEGACY_TYPES[e.type]; }
    if (!e.eventId) e.eventId = 'LIF-' + e.id.replace(/^evt-/, '').toUpperCase();
    if (!e.seriesId) e.seriesId = e.eventId;
    if (e.occurrence == null) e.occurrence = 1;
    if (!e.status) e.status = new Date(e.end || e.start) < new Date() ? 'complete' : 'active';
    if (typeof e.host === 'string' && !e.hostDetail) {
      e.hostDetail = { kind: e.host === 'Love is Foundation' ? 'lif' : 'individual', name: e.host,
                       email: 'events@loveisfoundation.org', memberId: null, coHosts: [], groupId: null,
                       responsesTo: ['events@loveisfoundation.org'] };
    }
    if (typeof e.host === 'string') e.hostName = e.host;
    if (!e.sessions) e.sessions = [{ start: e.start, end: e.end || e.start }];
    if (!e.timezone) e.timezone = (e.start.match(/([+-]\d{2}:\d{2})$/) || [null, 'Z'])[1];
    if (e.recurrenceNote == null) e.recurrenceNote = '';
    if (!e.payment) {
      var model = LIF.COST_TO_PAYMENT[e.cost] || 'free';
      e.payment = { model: model, min: null, max: null, suggested: model === 'free' ? null : 25, currency: 'USD', note: '' };
    }
    if (e.participants == null) e.participants = { min: null, max: e.capacity || null };
    if (e.overflowPlan == null) e.overflowPlan = '';
    if (e.underMinPlan == null) e.underMinPlan = '';
    if (e.audienceNote == null) e.audienceNote = '';
    if (!e.registerBy) e.registerBy = new Date(new Date(e.start).getTime() - 86400000).toISOString();
    /* `access` is the host's open/invite-only choice; `visibility`
       is the separate organization gate. An Ashoka-members event is
       open to register for - it is just only visible to members. */
    if (e.access == null) e.access = e.visibility === 'private' ? 'private' : 'open';
    if (e.inviteNote == null) e.inviteNote = '';
    if (!e.recording) e.recording = { mode: 'live', access: 'registered', url: null };
    if (!e.languages) e.languages = [e.language].filter(Boolean);
    if (!e.postEvent) e.postEvent = { hostNote: '', resources: [], recordingUrl: null, surveyUrl: null, threadId: null, groupId: null, followUpSentAt: null, actions: [] };
    if (!e.resourceAsks) e.resourceAsks = [];
    if (e.attended == null) e.attended = 0;
    if (e.durationMinutes == null) e.durationMinutes = Math.round((new Date(e.end || e.start) - new Date(e.start)) / 60000);
    if (!e.coverImage) e.coverImage = null;
    if (!e.mentorPlaydate) e.mentorPlaydate = { wanted: false, ask: '' };
    if (e.firstTime == null) e.firstTime = true;
  });
})();

/* ===============================================================
 * 4. THE STORE
 * Everything this member has done in the events pathway. One
 * localStorage key, one shape, three primitives — swap read/write
 * for API calls and the whole pathway follows.
 * ============================================================= */
LIF.eventStore = (function () {
  var KEY = 'lif.events.v1';

  var EMPTY = {
    registrations: {},   // eventId -> { at, fields, payment, rsvp, reminders, attended }
    proposals: {},       // proposalId -> full proposal record
    drafts: {},          // proposalId -> partially filled proposal
    notifyMe: [],        // event ids the member asked to be told about
    outbox: [],          // every message the backend would have sent
    threads: {}          // eventId -> [{ author, text, at }]
  };

  var cache = null;

  function read() {
    if (cache) return cache;
    try {
      var raw = localStorage.getItem(KEY);
      cache = raw ? Object.assign({}, EMPTY, JSON.parse(raw)) : JSON.parse(JSON.stringify(EMPTY));
    } catch (e) {
      cache = JSON.parse(JSON.stringify(EMPTY));
    }
    return cache;
  }

  function write(next) {
    cache = next || cache;
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* private mode — never fatal */ }
    document.dispatchEvent(new CustomEvent('lif:eventschange'));
    return cache;
  }

  function reset() {
    cache = JSON.parse(JSON.stringify(EMPTY));
    try { localStorage.removeItem(KEY); } catch (e) {}
    document.dispatchEvent(new CustomEvent('lif:eventschange'));
  }

  /* --- the in-playground notification, which IS something a
         frontend can do honestly: it drops straight into the same
         feed the dashboard bell already reads. The email half of
         the same event goes to the outbox below. --- */
  function notify(entry) {
    if (!LIF.NOTIFICATION_FEED) return null;
    var n = Object.assign({
      id: 'ntf-live-' + (LIF.NOTIFICATION_FEED.length + 1),
      feature: 'events', unread: true, at: new Date().toISOString()
    }, entry);
    LIF.NOTIFICATION_FEED.unshift(n);
    return n;
  }

  /* --- the outbox: every email / private message the backend owes.
         Written here rather than sent, so the pathway is visible
         and testable before a mail service exists. --- */
  function queue(entry) {
    var s = read();
    s.outbox.unshift(Object.assign({ at: new Date().toISOString(), id: 'msg-' + (s.outbox.length + 1) }, entry));
    s.outbox = s.outbox.slice(0, 60);
    write(s);
    return s.outbox[0];
  }

  return {
    read: read, write: write, reset: reset, queue: queue, notify: notify,
    outbox: function () { return read().outbox; },
    KEY: KEY
  };
})();

/* ===============================================================
 * 5. THE DOMAIN API
 * Everything the four event screens ask about an event. Pure
 * functions over LIF.EVENTS plus the store — no DOM in this file.
 * ============================================================= */
LIF.events = (function () {
  var store = LIF.eventStore;

  function now() { return new Date(); }

  function member() {
    return LIF.MEMBER || null;
  }
  function memberName() {
    var m = member();
    if (m) return (m.fields.preferredName.value || m.fields.firstName.value) + ' ' + m.fields.lastName.value;
    return (LIF.CURRENT_MEMBER && LIF.CURRENT_MEMBER.name) || 'Friend';
  }
  function preferredName() {
    var m = member();
    if (m) return m.fields.preferredName.value || m.fields.firstName.value;
    if (LIF.CURRENT_MEMBER && LIF.CURRENT_MEMBER.preferredName) return LIF.CURRENT_MEMBER.preferredName;
    return ((LIF.CURRENT_MEMBER && LIF.CURRENT_MEMBER.name) || 'Friend').split(' ')[0];
  }
  function memberEmail() {
    var m = member();
    if (m) return m.fields.email.value;
    return (LIF.CURRENT_MEMBER && LIF.CURRENT_MEMBER.email) || 'you@example.org';
  }
  function memberId() {
    var m = member();
    return m ? m.id : 'mem-001';
  }

  function all() { return LIF.EVENTS; }
  function get(id) { return LIF.EVENTS.find(function (e) { return e.id === id || e.eventId === id; }) || null; }

  /* --- visibility: what this member is allowed to see at all --- */
  function canSee(evt) {
    if (!evt) return false;
    if (evt.visibility === 'private' || evt.access === 'private') {
      var invited = (evt.invitedMemberIds || []).indexOf(memberId()) !== -1;
      return invited || isHost(evt) || !!registrationFor(evt.id);
    }
    if (evt.visibility === 'organization') {
      var m = member();
      return !!(m && m.organizations.verified.indexOf(evt.organization) !== -1);
    }
    return true;
  }

  /** Public, sortable, hub-visible events — the spec's "all public
      events are visible on the hub" line, minus what is private. */
  function publicEvents() {
    return LIF.EVENTS.filter(function (e) {
      return e.status !== 'draft' && e.status !== 'pending' &&
        (e.visibility === 'public' || e.visibility === 'organization');
    });
  }

  function isHost(evt) {
    if (!evt) return false;
    var d = evt.hostDetail;
    if (!d) return false;
    if (d.memberId && d.memberId === memberId()) return true;
    var m = member();
    if (d.groupId && m && m.groups.registered.indexOf(d.groupId) !== -1) return false; // membership ≠ hosting
    return false;
  }

  /* --- registration window --- */
  function registrationState(evt) {
    if (!evt) return { code: 'unknown', label: 'Unavailable', canRegister: false };
    if (evt.status === 'cancelled') return { code: 'cancelled', label: 'Cancelled', canRegister: false,
      why: evt.cancelledReason || 'This event was called off.' };
    if (evt.status === 'complete') return { code: 'complete', label: 'This event has happened', canRegister: false,
      why: 'Recordings and follow-up are on the event page.' };
    if (evt.status === 'pending') return { code: 'pending', label: 'Awaiting review', canRegister: false,
      why: 'A LiF steward is reviewing this proposal. It opens for registration once it is approved.' };
    if (evt.status === 'draft') return { code: 'draft', label: 'Draft', canRegister: false,
      why: 'Not submitted yet — only you can see this.' };
    if (registrationFor(evt.id)) return { code: 'registered', label: 'You are registered', canRegister: false };
    if (new Date(evt.registerBy) < now()) return { code: 'closed', label: 'Registration closed', canRegister: false,
      why: 'Registration closed on ' + fmtDay(evt.registerBy) + '.' };
    if (evt.participants && evt.participants.max && evt.registered >= evt.participants.max) {
      return { code: 'full', label: 'Full', canRegister: false,
        why: evt.overflowPlan || 'This one filled up. Ask to be told if another session opens.' };
    }
    return { code: 'open', label: 'Register', canRegister: true };
  }

  function isOpen(evt) { return registrationState(evt).code === 'open'; }

  function fmtDay(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* --- registration --- */
  function registrationFor(eventId) { return store.read().registrations[eventId] || null; }
  function myRegistrations() {
    var regs = store.read().registrations;
    return Object.keys(regs).map(function (id) {
      var e = get(id);
      return e ? { event: e, registration: regs[id] } : null;
    }).filter(Boolean);
  }

  /** Registers, queues the confirmation mail and the two reminders,
      and bumps the event's own counter so the hub agrees with the
      dashboard immediately. */
  function register(eventId, form) {
    var evt = get(eventId);
    if (!evt) return null;
    var s = store.read();
    var rec = {
      eventId: eventId,
      at: new Date().toISOString(),
      fields: form.fields || {},
      payment: form.payment || null,
      rsvp: null,                        // null = not answered yet — an outstanding task
      reminders: form.reminders !== false,
      questionnaire: form.questionnaire || {},
      attended: false
    };
    s.registrations[eventId] = rec;
    store.write(s);
    evt.registered = (evt.registered || 0) + 1;

    store.queue({
      kind: 'email', to: rec.fields.email || memberEmail(),
      subject: 'You are registered: ' + evt.title,
      eventId: eventId, template: 'registration-confirmation',
      body: 'Full details, the attend link, add-to-calendar options, an invite-a-friend link, and when your reminders will arrive.'
    });
    store.queue({
      kind: 'message', to: memberName(),
      subject: 'Registered for ' + evt.title,
      eventId: eventId, template: 'registration-pm',
      body: 'Your dashboard and calendar have been updated.'
    });
    store.notify({
      title: 'You are registered for ' + evt.title,
      body: fmtDay(evt.start) + '. Your calendar and dashboard are updated.' +
        (rec.rsvp ? '' : ' An RSVP is still waiting on you.'),
      link: { type: 'event', id: eventId }
    });
    if (rec.reminders) {
      LIF.REMINDER_SCHEDULE.forEach(function (r) {
        store.queue({
          kind: 'reminder', to: rec.fields.email || memberEmail(),
          subject: 'Reminder: ' + evt.title,
          eventId: eventId, template: 'registration-confirmation',
          sendAt: new Date(new Date(evt.start).getTime() - r.offsetMinutes * 60000).toISOString(),
          body: 'A duplicate of your confirmation email, ' + r.label.toLowerCase() + '.'
        });
      });
    }
    return rec;
  }

  function cancelRegistration(eventId) {
    var s = store.read();
    if (!s.registrations[eventId]) return false;
    delete s.registrations[eventId];
    store.write(s);
    var evt = get(eventId);
    if (evt) evt.registered = Math.max(0, (evt.registered || 1) - 1);
    store.queue({ kind: 'email', to: memberEmail(), eventId: eventId, template: 'registration-cancelled',
      subject: 'Cancelled: ' + (evt ? evt.title : eventId),
      body: 'Your place has been released and your calendars updated.' });
    return true;
  }

  function setRsvp(eventId, value) {
    var s = store.read();
    if (!s.registrations[eventId]) return null;
    s.registrations[eventId].rsvp = value;   // 'going' | 'maybe' | 'not-going'
    store.write(s);
    return s.registrations[eventId];
  }

  function setReminders(eventId, on) {
    var s = store.read();
    if (!s.registrations[eventId]) return null;
    s.registrations[eventId].reminders = !!on;
    store.write(s);
    return s.registrations[eventId];
  }

  function toggleNotifyMe(eventId) {
    var s = store.read();
    var i = s.notifyMe.indexOf(eventId);
    if (i === -1) s.notifyMe.push(eventId); else s.notifyMe.splice(i, 1);
    store.write(s);
    return i === -1;
  }
  function wantsNotice(eventId) { return store.read().notifyMe.indexOf(eventId) !== -1; }

  /* --- the outstanding-task list the spec asks event cards to
         carry ("e.g. rsvp to event calendar invite") --- */
  function tasksFor(eventId) {
    var evt = get(eventId);
    var reg = registrationFor(eventId);
    var out = [];
    if (!evt) return out;
    if (reg && !reg.rsvp && evt.status === 'active') {
      out.push({ id: 'rsvp', label: 'RSVP to the calendar invite', action: 'rsvp' });
    }
    if (reg && reg.payment && reg.payment.status === 'pending') {
      out.push({ id: 'pay', label: 'Finish your payment', action: 'pay' });
    }
    if (evt.status === 'complete' && reg && evt.postEvent.surveyUrl && !reg.surveyDone) {
      out.push({ id: 'survey', label: 'Share how it went', action: 'survey' });
    }
    if (isHost(evt) && evt.status === 'complete' && !evt.postEvent.followUpSentAt) {
      out.push({ id: 'followup', label: 'Send your follow-up', action: 'followup' });
    }
    return out;
  }

  function allTasks() {
    return myRegistrations().reduce(function (acc, r) {
      tasksFor(r.event.id).forEach(function (t) { acc.push({ event: r.event, task: t }); });
      return acc;
    }, []);
  }

  /** Is the attend link live? Open from 15 minutes before the start
      until the end, which is when the "Attend" button appears. */
  function isAttendable(evt) {
    if (!evt || evt.status !== 'active') return false;
    if (evt.format === 'in-person') return false;
    var t = now().getTime();
    return t >= new Date(evt.start).getTime() - 15 * 60000 && t <= new Date(evt.end || evt.start).getTime();
  }

  /** Can this member reach the recording? Host's choice decides. */
  function canSeeRecording(evt) {
    if (!evt || !evt.postEvent.recordingUrl) return false;
    var access = evt.recording.access;
    if (access === 'public') return true;
    if (access === 'private') return isHost(evt);
    var reg = registrationFor(evt.id);
    if (access === 'registered') return !!reg || isHost(evt);
    if (access === 'attendees') return !!(reg && reg.attended) || isHost(evt);
    return false;
  }

  /* --- proposals --- */
  function nextProposalId() {
    var s = store.read();
    return 'evt-prop-' + (Object.keys(s.proposals).length + Object.keys(s.drafts).length + 2);
  }

  /** The system-assigned event ID the spec calls for, stamped at
      submission: LIF-YYYY-NNN, sequential within the year. */
  function mintEventId() {
    var year = new Date().getFullYear();
    var used = LIF.EVENTS.map(function (e) { return e.eventId; })
      .concat(Object.keys(LIF.eventStore.read().proposals).map(function (k) {
        return LIF.eventStore.read().proposals[k].eventId;
      }))
      .filter(function (x) { return x && x.indexOf('LIF-' + year + '-') === 0; })
      .map(function (x) { return parseInt(x.split('-')[2], 10); })
      .filter(function (n) { return !isNaN(n); });
    var next = (used.length ? Math.max.apply(null, used) : 0) + 1;
    return 'LIF-' + year + '-' + String(next).padStart(3, '0');
  }

  function saveDraft(proposal) {
    var s = store.read();
    proposal.id = proposal.id || nextProposalId();
    proposal.updatedAt = new Date().toISOString();
    s.drafts[proposal.id] = proposal;
    store.write(s);
    return proposal;
  }

  function getDraft(id) { return store.read().drafts[id] || null; }
  function drafts() {
    var d = store.read().drafts;
    return Object.keys(d).map(function (k) { return d[k]; });
  }

  /** Submit: assign the event ID, set status pending, queue the
      confirmation mail + private message + the note to the LiF
      Events proposal group and its Workspace repository entry. */
  function submitProposal(proposal) {
    var s = store.read();
    proposal.id = proposal.id || nextProposalId();
    proposal.eventId = proposal.eventId || mintEventId();
    proposal.status = 'pending';
    proposal.submittedAt = new Date().toISOString();
    proposal.proposedBy = { memberId: memberId(), name: memberName(), email: memberEmail() };
    s.proposals[proposal.id] = proposal;
    delete s.drafts[proposal.id];
    store.write(s);

    store.queue({
      kind: 'email', to: memberEmail(), eventId: proposal.eventId, template: 'proposal-received',
      subject: 'Your event proposal: ' + proposal.title,
      body: 'Thank you. Your proposal has an ID (' + proposal.eventId + ') and is with the LiF Events group. ' +
            'You will hear back by email or a call if anything needs clarifying.'
    });
    store.queue({
      kind: 'message', to: memberName(), eventId: proposal.eventId, template: 'proposal-received-pm',
      subject: 'Proposal received: ' + proposal.title,
      body: 'It is on your dashboard under Events → Proposed, with status Pending.'
    });
    store.queue({
      kind: 'workspace', to: 'LiF Events Proposal Group', eventId: proposal.eventId, template: 'proposal-repository',
      subject: proposal.title + ' — ' + new Date(proposal.submittedAt).toISOString().slice(0, 16).replace('T', ' '),
      body: 'Filed in the LiF Events proposal repository as an individual form, titled with the event name and the ' +
            'creation date stamp. The proposal group is notified.'
    });

    store.notify({
      feature: 'profile',
      title: 'Your event proposal is with the LiF Events group',
      body: proposal.title + ' was submitted as ' + proposal.eventId + '. Status: Pending.',
      link: { type: 'proposal', id: proposal.id }
    });

    /* Put it on the hub immediately as a pending event, so the
       member can see their own proposal exactly as a reviewer will. */
    var evt = proposalToEvent(proposal);
    if (evt && !get(evt.id)) LIF.EVENTS.push(evt);

    return proposal;
  }

  function proposals() {
    var p = store.read().proposals;
    return Object.keys(p).map(function (k) { return p[k]; });
  }

  /** Turn a submitted proposal into the event record the rest of the
      app understands. The shapes were designed to line up, so this
      is mostly a rename plus the derived fields. */
  function proposalToEvent(p) {
    if (!p.sessions || !p.sessions.length) return null;
    var first = p.sessions[0];
    var last = p.sessions[p.sessions.length - 1];
    return {
      id: 'evt-' + p.eventId.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      eventId: p.eventId, seriesId: p.seriesId || p.eventId, occurrence: p.occurrence || 1,
      repeatOf: p.repeatOf || null,
      status: p.status,
      isMine: true,
      title: p.title,
      summary: (p.invitation && p.invitation.card && p.invitation.card.blurb) || trimTo(p.description, 150),
      description: p.description,
      aspect: p.aspect || 'engagement-communion',
      sector: p.sector, subsector: p.subsector || null,
      format: p.format, type: p.type,
      start: first.start, end: last.end,
      sessions: p.sessions, recurrenceNote: p.recurrenceNote || '', timezone: p.timezone,
      durationLabel: durationLabel(first.start, first.end),
      durationMinutes: Math.round((new Date(first.end) - new Date(first.start)) / 60000),
      commitment: p.sessions.length > 1 ? 'multiple-sessions' : 'one-time',
      cost: LIF.PAYMENT_TO_COST[p.payment.model] || 'free',
      payment: p.payment,
      language: (p.languages && p.languages[0]) || 'English',
      languages: p.languages || ['English'],
      location: p.location || null,
      onlineLink: p.onlineLink || null,
      host: p.hostDetail.name,
      hostName: p.hostDetail.name,
      hostDetail: p.hostDetail,
      organization: null,
      visibility: p.access === 'private' ? 'private' : 'public',
      access: p.access,
      inviteNote: p.inviteNote || '',
      invitedMemberIds: p.invitedMemberIds || [],
      capacity: p.participants.max,
      participants: p.participants,
      overflowPlan: p.overflowPlan || '', underMinPlan: p.underMinPlan || '',
      audienceNote: p.audienceNote || '',
      registerBy: p.registerBy,
      registered: 0, attended: 0,
      recording: p.recording,
      resourceAsks: p.resourceAsks || [],
      mentorPlaydate: p.mentorPlaydate || { wanted: false, ask: '' },
      firstTime: p.firstTime !== false,
      coverImage: p.coverImage || null,
      invitation: p.invitation || null,
      tags: p.tags || [],
      postEvent: { hostNote: '', resources: [], recordingUrl: null, surveyUrl: null, threadId: null, groupId: null, followUpSentAt: null, actions: [] },
      updatedAt: p.submittedAt || new Date().toISOString()
    };
  }

  /* Same word-boundary trim the proposal form uses, so a card blurb
     never ends mid-word. */
  function trimTo(text, n) {
    var s = String(text || '').trim();
    if (s.length <= n) return s;
    var cut = s.slice(0, n);
    var sp = cut.lastIndexOf(' ');
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.—-]+$/, '') + '…';
  }

  function durationLabel(start, end) {
    var mins = Math.round((new Date(end) - new Date(start)) / 60000);
    if (mins <= 60) return mins + ' Minutes';
    if (mins % 60 === 0) return (mins / 60) + ' Hours';
    if (mins >= 420) return 'Full Day';
    if (mins >= 240) return 'Half Day';
    return Math.round(mins / 60 * 10) / 10 + ' Hours';
  }

  /* --- repeat an event: same content, same series, new dates, and
         the "-N" suffix the spec asks for. --- */
  function repeat(sourceId, sessions) {
    var src = get(sourceId);
    if (!src || !sessions || !sessions.length) return null;
    var siblings = LIF.EVENTS.filter(function (e) { return e.seriesId === src.seriesId; });
    var n = Math.max.apply(null, siblings.map(function (e) { return e.occurrence || 1; })) + 1;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = src.seriesId.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + n;
    copy.eventId = src.seriesId + '-' + n;
    copy.occurrence = n;
    copy.repeatOf = src.id;
    copy.status = 'active';
    copy.sessions = sessions;
    copy.start = sessions[0].start;
    copy.end = sessions[sessions.length - 1].end;
    copy.registered = 0;
    copy.attended = 0;
    copy.registerBy = new Date(new Date(copy.start).getTime() - 86400000).toISOString();
    copy.postEvent = { hostNote: '', resources: [], recordingUrl: null, surveyUrl: null, threadId: null, groupId: null, followUpSentAt: null, actions: [] };
    copy.updatedAt = new Date().toISOString();
    LIF.EVENTS.push(copy);
    LIF.eventStore.queue({
      kind: 'message', to: memberName(), eventId: copy.eventId, template: 'event-repeated',
      subject: 'New dates for ' + copy.title,
      body: 'Same content, same event ID with “-' + n + '” appended, so it stays easy to reference. ' +
            'No new proposal was needed because the title and content are unchanged.'
    });
    return copy;
  }

  /* --- post-event: what the host does after --- */
  function saveFollowUp(eventId, data) {
    var evt = get(eventId);
    if (!evt) return null;
    Object.assign(evt.postEvent, data, { followUpSentAt: new Date().toISOString() });
    evt.updatedAt = new Date().toISOString();
    LIF.eventStore.queue({
      kind: 'email', to: 'Everyone flagged to receive it', eventId: evt.eventId, template: 'post-event-followup',
      subject: 'After ' + evt.title,
      replyTo: (evt.hostDetail && evt.hostDetail.responsesTo) || [],
      body: 'Sent from the LiF Events address with a reply-to pointing at the host, so replies reach them and not ' +
            'the LiF inbox. Carries the host’s note plus whichever links they chose to include.'
    });
    return evt.postEvent;
  }

  function thread(eventId) { return store.read().threads[eventId] || []; }
  function postToThread(eventId, text) {
    var s = store.read();
    s.threads[eventId] = s.threads[eventId] || [];
    s.threads[eventId].push({ author: memberName(), text: text, at: new Date().toISOString() });
    store.write(s);
    return s.threads[eventId];
  }

  /* --- small display helpers every screen wants --- */
  function statusMeta(id) {
    return LIF.EVENT_STATUSES.find(function (s) { return s.id === id; }) || LIF.EVENT_STATUSES[2];
  }
  function typeName(id) {
    var t = LIF.EVENT_TYPES.find(function (x) { return x.id === id; });
    return t ? t.name : id;
  }
  function paymentLabel(evt) {
    var p = evt.payment || { model: 'free' };
    var m = LIF.PAYMENT_MODELS.find(function (x) { return x.id === p.model; });
    if (!m) return 'Free';
    if (p.model === 'sliding-scale' && p.max != null) return 'Sliding scale · $' + (p.min || 0) + '–$' + p.max;
    if (p.model === 'gratitude' && p.suggested) return 'Gratitude · $' + p.suggested + ' suggested';
    return m.name;
  }
  function coverCss(evt) {
    var stops = LIF.SECTOR_COVERS[evt.sector] || ['#755091', '#C89CD8'];
    if (evt.coverImage) return 'url(' + evt.coverImage + ') center/cover';
    return 'linear-gradient(135deg, ' + stops[0] + ' 0%, ' + stops[1] + ' 100%)';
  }

  return {
    all: all, get: get, publicEvents: publicEvents, canSee: canSee, isHost: isHost,
    registrationState: registrationState, isOpen: isOpen, isAttendable: isAttendable,
    register: register, cancelRegistration: cancelRegistration, registrationFor: registrationFor,
    myRegistrations: myRegistrations, setRsvp: setRsvp, setReminders: setReminders,
    toggleNotifyMe: toggleNotifyMe, wantsNotice: wantsNotice,
    tasksFor: tasksFor, allTasks: allTasks, canSeeRecording: canSeeRecording,
    saveDraft: saveDraft, getDraft: getDraft, drafts: drafts,
    submitProposal: submitProposal, proposals: proposals, proposalToEvent: proposalToEvent,
    mintEventId: mintEventId, nextProposalId: nextProposalId, repeat: repeat,
    saveFollowUp: saveFollowUp, thread: thread, postToThread: postToThread,
    statusMeta: statusMeta, typeName: typeName, paymentLabel: paymentLabel, coverCss: coverCss,
    durationLabel: durationLabel, fmtDay: fmtDay,
    memberName: memberName, preferredName: preferredName, memberEmail: memberEmail, memberId: memberId
  };
})();

/* ---------------------------------------------------------------
 * Seed the store from the demo profile, once.
 * LIF.MEMBER says this person is registered for three events. Until
 * the store knows that too, the dashboard and the event page would
 * disagree about the same fact - one reading the profile, the other
 * reading registrations. Seeding once reconciles them, and leaves
 * exactly one registration without an RSVP so the "outstanding task"
 * behaviour on event cards has something honest to show.
 * ------------------------------------------------------------- */
(function seedRegistrations() {
  if (!LIF.MEMBER) return;
  var s = LIF.eventStore.read();
  if (s.seeded) return;
  s.seeded = true;
  LIF.MEMBER.events.registered.forEach(function (id, i) {
    var e = LIF.events.get(id);
    if (!e || s.registrations[id]) return;
    s.registrations[id] = {
      eventId: id,
      at: '2026-08-10T09:00:00-07:00',
      fields: {
        name: LIF.events.memberName(), email: LIF.events.memberEmail(),
        preferredName: LIF.events.preferredName(), phone: '', pronouns: '', city: '', language: 'English'
      },
      payment: null,
      rsvp: i === 0 ? null : 'going',   // one left unanswered on purpose
      reminders: true,
      questionnaire: {},
      attended: e.status === 'complete'
    };
  });
  /* The completed event this member hosted also counts as attended,
     so the recording-access rules have a real case to test. */
  if (LIF.events.get('evt-201') && !s.registrations['evt-201']) {
    s.registrations['evt-201'] = {
      eventId: 'evt-201', at: '2026-07-28T09:00:00-07:00',
      fields: { name: LIF.events.memberName(), email: LIF.events.memberEmail() },
      payment: null, rsvp: 'going', reminders: true, questionnaire: {}, attended: true
    };
  }
  LIF.eventStore.write(s);
})();

/* Any proposal already submitted in a previous session goes back onto
   the hub as a pending event, so the dashboard's Proposed tab and the
   event page agree with each other across a refresh. */
(function rehydrateProposals() {
  LIF.events.proposals().forEach(function (p) {
    if (p.status !== 'pending' && p.status !== 'active') return;
    var evt = LIF.events.proposalToEvent(p);
    if (evt && !LIF.events.get(evt.id)) LIF.EVENTS.push(evt);
  });
})();
