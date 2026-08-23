/**
 * dashboardData.js
 * ---------------------------------------------------------------
 * Everything the Personal Dashboard needs that `data.js` doesn't
 * already carry. Loaded AFTER data.js, so it can both add new
 * collections (subsectors, resources, commons, the notification
 * feed) and patch a few extra fields onto the existing ones
 * (updatedAt timestamps, map coordinates for people).
 *
 * The shapes here are the contract for the backend. When accounts
 * are real, `LIF.MEMBER` is the object your session endpoint should
 * return - every panel on the dashboard reads from it and nothing
 * else. Notice that nothing is precomputed: "suggestions" and
 * "new since last visit" are DERIVED at render time from
 * MEMBER.preferences and MEMBER.lastVisit (see dashboardPage.js),
 * so changing a preference updates the dashboard immediately
 * rather than waiting on a server round-trip.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

/* Subsectors used to live here. They moved to data.js when the event
 * proposal form (js/eventProposal.js) needed the same tree on the
 * public hub, which does not load this file. One taxonomy, one home.
 */

/* Languages the platform itself can be displayed in. The selector in
 * the dashboard header is the same "preferred language" the sign-up
 * form sets; it re-labels the whole shell on change. */
LIF.UI_LANGUAGES = [
  { code: 'en', label: 'English',    native: 'English' },
  { code: 'es', label: 'Spanish',    native: 'Español' },
  { code: 'fr', label: 'French',     native: 'Français' },
  { code: 'ar', label: 'Arabic',     native: 'العربية' },
  { code: 'hi', label: 'Hindi',      native: 'हिन्दी' },
  { code: 'zh', label: 'Mandarin',   native: '中文' },
  { code: 'pt', label: 'Portuguese', native: 'Português' }
];

LIF.PROFICIENCIES = ['Native/fluent', 'Intermediate', 'Beginner'];

LIF.NOTIFY_FREQUENCIES = [
  { id: 'as-occurs',   name: 'As it happens' },
  { id: 'daily',       name: 'Daily digest' },
  { id: 'weekly',      name: 'Weekly digest' },
  { id: 'monthly',     name: 'Monthly digest' },
  { id: 'since-visit', name: 'Only when I sign in' }
];

LIF.NOTIFY_CHANNELS = [
  { id: 'playground', name: 'Playground only',    desc: 'Waiting here on your dashboard. Nothing lands in your inbox.' },
  { id: 'email',      name: 'Email only',         desc: 'Sent to your verified address at the frequency you choose.' },
  { id: 'both',       name: 'Playground + email', desc: 'Both, at the frequency you choose.' }
];

/* ---------------------------------------------------------------
 * A few more groups and people so each dashboard bucket
 * (registered / bookmarked / suggested) has something distinct in
 * it. Appended rather than replacing what data.js defines.
 * ------------------------------------------------------------- */
LIF.GROUPS.push(
  { id: 'grp-4', name: 'Watershed Stewards Assembly',    description: 'Neighbours restoring a shared creek system, meeting on the land monthly.',      sector: 'environment', memberCount: 41 },
  { id: 'grp-5', name: 'Peace Education Practitioners',  description: 'Teachers and facilitators trading curriculum for conflict-transformation work.', sector: 'relations',  memberCount: 67 },
  { id: 'grp-6', name: 'Caring Business Roundtable',     description: 'Founders running their companies on the caring-economy frame.',                  sector: 'economics',  memberCount: 28 },
  { id: 'grp-7', name: 'Neurodiversity Family Circle',   description: 'Parents, carers and self-advocates sharing what actually helps.',                sector: 'health',     memberCount: 52 }
);

LIF.PEOPLE.push(
  { id: 'ppl-6',  name: 'Sofia Marchetti', city: 'Assisi',   country: 'Italy',  bio: 'Interfaith facilitator hosting the Assisi circle.',          aspects: ['community-inclusion'],  sectors: ['spirituality', 'relations'],     language: 'English' },
  { id: 'ppl-7',  name: 'Ade Okonkwo',     city: 'Portland', country: 'USA',    bio: 'Restorative-justice mediator working with schools.',         aspects: ['engagement-communion'], sectors: ['justice', 'education'],          language: 'English' },
  { id: 'ppl-8',  name: 'Mei Tanaka',      city: 'Vancouver',country: 'Canada', bio: 'Watershed ecologist and community organiser.',               aspects: ['nature-nurture'],       sectors: ['environment', 'governance'],     language: 'English' },
  /* Two unconnected members overlapping the demo profile's own
     sectors, so "playmates you might know" has something honest to
     find rather than demoing as an empty tab. */
  { id: 'ppl-9',  name: 'Nadia Haddad',    city: 'Seattle',  country: 'USA',    bio: 'Runs peace-education workshops for school districts.',       aspects: ['engagement-communion'], sectors: ['relations', 'education'],        language: 'English' },
  { id: 'ppl-10', name: 'Tomas Berg',      city: 'Portland', country: 'USA',    bio: 'Stormwater engineer turned neighbourhood rain-garden nerd.', aspects: ['nature-nurture'],       sectors: ['environment', 'infrastructure'], language: 'English' }
);

/* ---------------------------------------------------------------
 * Four more events, near the demo member and inside their stated
 * sectors. The nine events in data.js were written to exercise the
 * public hub's filters, and only two of them touch this member's
 * interests - both already registered. Without these the suggestion
 * engine would have nothing honest to surface and the "Suggested"
 * tab would demo as empty. Same shape as data.js.
 * ------------------------------------------------------------- */
LIF.EVENTS.push(
  {
    id: 'evt-101',
    title: 'Watershed Care Morning: Johnson Creek',
    summary: 'Two hours of hands-on streambank care with the people who tend this creek year-round.',
    description: 'Invasive removal, native planting, and a short walk through what the creek has done over the last decade. Tools, gloves and coffee provided. No experience needed - just boots you do not mind wrecking.',
    aspect: 'nature-nurture', sector: 'environment', subsector: 'Water',
    format: 'in-person', type: 'activity',
    start: '2026-09-05T09:00:00-07:00', end: '2026-09-05T11:30:00-07:00',
    durationLabel: '3 Hours', commitment: 'ongoing', cost: 'free', language: 'English',
    location: { venue: 'Johnson Creek Restoration Site', city: 'Portland', region: 'Oregon', country: 'USA', lat: 45.4720, lng: -122.5980 },
    onlineLink: null, host: 'Watershed Stewards Assembly', organization: null, visibility: 'public',
    capacity: 30, registered: 17, tags: ['water', 'restoration', 'hands-on'],
    updatedAt: '2026-08-21T11:20:00-07:00'
  },
  {
    id: 'evt-102',
    title: 'Neighbourhood Peace Circle Training',
    summary: 'Learn to hold a peace circle on your own block - the format, the questions, and what to do when it gets hard.',
    description: 'A practical training for neighbours who want to convene difficult conversations well. Runs hybrid: in the room at the community centre, or online in a smaller breakout group.',
    aspect: 'engagement-communion', sector: 'relations', subsector: 'Peace Education',
    format: 'hybrid', type: 'workshop',
    start: '2026-09-12T13:00:00-07:00', end: '2026-09-12T16:00:00-07:00',
    durationLabel: '3 Hours', commitment: 'one-time', cost: 'sliding-scale', language: 'English',
    location: { venue: 'Southeast Community Centre', city: 'Portland', region: 'Oregon', country: 'USA', lat: 45.5120, lng: -122.6210 },
    onlineLink: 'https://example.org/join/peace-circle-training', host: 'Peace Education Practitioners', organization: null, visibility: 'public',
    capacity: 24, registered: 11, tags: ['peace-education', 'facilitation', 'neighbourhood']
  },
  {
    id: 'evt-103',
    title: 'Rain Garden Build Day',
    summary: 'Build a working rain garden in one Saturday, then take the plans home to your own street.',
    description: 'A full-day build with the stormwater crew: dig, shape, plant, and learn how the same design scales down to a single downspout. Lunch is shared - bring something if you can.',
    aspect: 'nature-nurture', sector: 'environment', subsector: 'Regenerative',
    format: 'in-person', type: 'activity',
    start: '2026-09-19T09:30:00-07:00', end: '2026-09-19T15:30:00-07:00',
    durationLabel: 'Full Day', commitment: 'one-time', cost: 'free', language: 'English',
    location: { venue: 'Lents Neighbourhood Commons', city: 'Portland', region: 'Oregon', country: 'USA', lat: 45.4670, lng: -122.5700 },
    onlineLink: null, host: 'Regenerative Design Circle', organization: null, visibility: 'public',
    capacity: 20, registered: 14, tags: ['regenerative', 'water', 'build']
  },
  {
    /* The other side of the gate. data.js's evt-009 is an Ashoka
       members-only event this member CANNOT see; this one belongs to
       the organization they are verified with, so it appears in full
       here and unlocked in search - which is the whole point of the
       verified-membership rule. */
    id: 'evt-105',
    title: 'Terra Commons Stewards Briefing',
    summary: 'Quarterly briefing for verified Terra Commons members on land, funding and what is next.',
    description: 'Where the collective is putting its effort next season, what the land registry has taken on, and an open half-hour for stewards to raise anything. Members only.',
    aspect: 'community-inclusion', sector: 'environment', subsector: 'Regenerative',
    format: 'hybrid', type: 'meetup',
    start: '2026-09-09T17:00:00-07:00', end: '2026-09-09T18:30:00-07:00',
    durationLabel: 'Up to 1 Hour', commitment: 'ongoing', cost: 'free', language: 'English',
    location: { venue: 'Terra Commons Field House', city: 'Portland', region: 'Oregon', country: 'USA', lat: 45.5450, lng: -122.6500 },
    onlineLink: 'https://example.org/join/terra-stewards', host: 'Terra Commons Collective',
    organization: 'terra-commons', visibility: 'organization',
    capacity: 35, registered: 19, tags: ['members-only', 'stewardship', 'briefing'],
    updatedAt: '2026-08-20T09:10:00-07:00'
  },
  {
    id: 'evt-104',
    title: 'Climate Grief Listening Circle',
    summary: 'An online circle for people carrying climate grief, held in the compassionate-listening format.',
    description: 'Not a strategy session and not a debrief. Ninety minutes of structured listening for people who work on climate and are tired. Cameras optional.',
    aspect: 'presence-being', sector: 'environment', subsector: 'Climate',
    format: 'online', type: 'discussion',
    start: '2026-09-26T18:00:00-07:00', end: '2026-09-26T19:30:00-07:00',
    durationLabel: 'Up to 1 Hour', commitment: 'ongoing', cost: 'donation', language: 'English',
    location: null, onlineLink: 'https://example.org/join/climate-grief-circle',
    host: 'Love is Foundation', organization: null, visibility: 'public',
    capacity: 40, registered: 22, tags: ['climate', 'listening', 'wellbeing']
  }
);

/* Coordinates for the Connections map view. Kept out of data.js's
 * PEOPLE records because the people directory itself doesn't plot
 * anyone - only the dashboard's playmate map does. */
var PERSON_COORDS = {
  'ppl-1': [34.0522, -118.2437], 'ppl-2': [19.4326, -99.1332], 'ppl-3': [12.9716, 77.5946],
  'ppl-4': [5.6037, -0.1870],    'ppl-5': [59.3293, 18.0686],  'ppl-6': [43.0707, 12.6197],
  'ppl-7': [45.5152, -122.6784], 'ppl-8': [49.2827, -123.1207],
  'ppl-9': [47.6062, -122.3321], 'ppl-10': [45.5231, -122.6765]
};
LIF.PEOPLE.forEach(function (p) {
  var c = PERSON_COORDS[p.id];
  if (c) { p.lat = c[0]; p.lng = c[1]; }
});

/* "Updated since last visit" is a real comparison, not a flag, so
 * events and groups need a last-touched timestamp. Anything without
 * one is simply treated as unchanged. */
var UPDATED_AT = {
  'evt-001': '2026-08-19T09:20:00-07:00',
  'evt-003': '2026-08-20T14:05:00-07:00',
  'evt-005': '2026-08-21T08:00:00-04:00',
  'evt-006': '2026-08-17T12:00:00-07:00',
  'evt-008': '2026-08-10T10:00:00+02:00',
  'grp-1':   '2026-08-20T17:40:00-07:00',
  'grp-4':   '2026-08-21T11:15:00-07:00',
  'grp-2':   '2026-08-02T09:00:00-07:00'
};
LIF.EVENTS.forEach(function (e) { if (UPDATED_AT[e.id]) e.updatedAt = UPDATED_AT[e.id]; });
LIF.GROUPS.forEach(function (g) { if (UPDATED_AT[g.id]) g.updatedAt = UPDATED_AT[g.id]; });

/* Groups carry a language, a home location and a subsector too, so
 * the same preference matching that powers event suggestions works
 * on them without a second code path. */
var GROUP_META = {
  'grp-1': { language: 'English', lat: 45.5152, lng: -122.6784, subsector: 'Regenerative' },
  'grp-2': { language: 'English', lat: 43.0707, lng: 12.6197,   subsector: 'Interfaith' },
  'grp-3': { language: 'English', lat: 37.7749, lng: -122.4194, subsector: 'Caring economy' },
  'grp-4': { language: 'English', lat: 45.5231, lng: -122.6765, subsector: 'Water' },
  'grp-5': { language: 'English', lat: 45.5900, lng: -122.5900, subsector: 'Peace Education' },
  'grp-6': { language: 'English', lat: 47.6062, lng: -122.3321, subsector: 'Caring business' },
  'grp-7': { language: 'English', lat: 51.5074, lng: -0.1278,   subsector: 'Neurodiversity' }
};
LIF.GROUPS.forEach(function (g) { Object.assign(g, GROUP_META[g.id] || {}); });

/* ---------------------------------------------------------------
 * Resources - the reference library. Saved vs suggested follows the
 * same pattern as everywhere else: `saved` is an explicit member
 * action, suggestions are derived from preferences at render time.
 * ------------------------------------------------------------- */
LIF.RESOURCES = [
  { id: 'res-1', title: 'The Enoughness Frame: A Short Reader',       kind: 'Guide',      sector: 'economics',    subsector: 'Caring economy',      minutes: 18, summary: 'The founding essay behind Money as Love, with reflection prompts for groups.' },
  { id: 'res-2', title: 'Hosting a Circle: Facilitator Field Notes',  kind: 'Toolkit',    sector: 'relations',    subsector: 'Partnership',         minutes: 25, summary: 'What experienced LiF hosts do in the first ten minutes, and why it matters.' },
  { id: 'res-3', title: 'Regenerative Land Practice Starter Pack',    kind: 'Toolkit',    sector: 'environment',  subsector: 'Regenerative',        minutes: 40, summary: 'Soil, water and planting basics for a first plot, with a season-one checklist.' },
  { id: 'res-4', title: 'Compassionate Listening in Conflict',        kind: 'Course',     sector: 'relations',    subsector: 'Conflict Management', minutes: 90, summary: 'A four-part recorded course on staying present when a conversation gets hard.' },
  { id: 'res-5', title: 'Watershed Mapping for Neighbourhoods',       kind: 'Guide',      sector: 'environment',  subsector: 'Water',               minutes: 22, summary: 'How to read your local watershed and find the people already caring for it.' },
  { id: 'res-6', title: 'Interfaith Hosting Agreements',              kind: 'Template',   sector: 'spirituality', subsector: 'Interfaith',          minutes: 10, summary: 'The shared-ground agreements the Assisi circle opens every gathering with.' },
  { id: 'res-7', title: 'Restorative Practice in Schools',            kind: 'Case study', sector: 'justice',      subsector: 'Restorative justice', minutes: 30, summary: 'Three years of restorative circles in one district, told by the mediators who ran them.' },
  { id: 'res-8', title: 'Story Structure for Systems Change',         kind: 'Course',     sector: 'media',        subsector: 'Transformative',      minutes: 60, summary: 'Narrative craft for people who need a system to move, not just an audience to feel.' }
];

/* ---------------------------------------------------------------
 * The Commons - shared, member-tended things. Distinct from Groups:
 * a group is people who meet; a commons is a thing being tended
 * together (a fund, a document, a map, a shared practice).
 * ------------------------------------------------------------- */
LIF.COMMONS = [
  { id: 'cmn-1', name: 'The Seed Fund',              kind: 'Shared resource', sector: 'economics',   subsector: 'Symbiotic economy',              stewards: 14, contributions: 62,  summary: 'A member-pooled fund that underwrites first-time gatherings for co-creators without a budget.' },
  { id: 'cmn-2', name: 'Living Glossary',            kind: 'Open document',   sector: 'education',   subsector: 'Adult, transformative education', stewards: 31, contributions: 208, summary: 'How the ecosystem defines its own words - edited in the open, never frozen.' },
  { id: 'cmn-3', name: 'Regenerative Land Registry', kind: 'Shared map',      sector: 'environment', subsector: 'Regenerative',                   stewards: 22, contributions: 87,  summary: 'Plots, orchards and watersheds tended by members, mapped so neighbours can find each other.' },
  { id: 'cmn-4', name: 'Welcome Home Library',       kind: 'Practice',        sector: 'relations',   subsector: 'Partnership',                    stewards: 9,  contributions: 45,  summary: 'The greetings, openings and closings members have written for welcoming newcomers.' }
];

/* ---------------------------------------------------------------
 * THE MEMBER.
 * This is the session object. Everything the profile spec asks for
 * lives here: the field-level public/private toggles, the sector
 * and subsector interests, the notification matrix, the privacy
 * agreements, and the engagement record that fills the dashboard.
 * ------------------------------------------------------------- */
LIF.MEMBER = {
  id: 'mem-001',
  isDemoProfile: true,

  /* --- required identity fields. `public` decides whether the field
     is searchable and visible to other members. firstName and postal
     are locked public: the spec makes them mandatory for member
     search and the map locator. --- */
  fields: {
    firstName:     { label: 'First name',    value: 'Alex',                    public: true,  locked: true,  required: true },
    lastName:      { label: 'Surname',       value: 'Rivera',                  public: true,  locked: false, required: true },
    country:       { label: 'Country',       value: 'United States',           public: true,  locked: false, required: true },
    city:          { label: 'City',          value: 'Portland',                public: true,  locked: false, required: true },
    postal:        { label: 'Postal / ZIP',  value: '97214',                   public: true,  locked: true,  required: true },
    email:         { label: 'Email',         value: 'alex.rivera@example.org', public: false, locked: false, required: true },
    phone:         { label: 'Phone',         value: '+1 503 555 0184',         public: false, locked: false, required: true },
    preferredName: { label: 'Preferred name',value: 'Alex',                    public: true,  locked: false, required: false },
    pronouns:      { label: 'Pronouns',      value: 'they/them',               public: true,  locked: false, required: false },
    associations:  { label: 'Associations',  value: 'Terra Commons Collective, Portland Watershed Council', public: true, locked: false, required: false }
  },

  intro: 'Community organiser working where water policy meets neighbourhood care. I tend a small regenerative plot on the east side, and I am slowly learning to facilitate without over-planning.',

  avatarUrl: null,
  lat: 45.5152,
  lng: -122.6784,

  languages: [
    { name: 'English', proficiency: 'Native/fluent', public: true },
    { name: 'Spanish', proficiency: 'Intermediate',  public: true }
  ],
  preferredLanguage: 'en',

  socials: [
    { network: 'LinkedIn',  handle: 'in/alexrivera', public: true },
    { network: 'Instagram', handle: '@alex.tends',   public: true },
    { network: 'X',         handle: '',              public: false }
  ],

  sectors: ['environment', 'relations'],
  subsectors: ['Regenerative', 'Water', 'Partnership', 'Peace Education'],

  /* --- what every "suggested for you" list is matched against --- */
  preferences: {
    sectors: ['environment', 'relations'],
    subsectors: ['Regenerative', 'Water', 'Partnership'],
    radiusKm: 100,
    languages: ['English'],
    wantEvents: true,
    wantGroups: true
  },

  /* --- the three privacy agreements from the profile spec --- */
  privacy: {
    shareActivity:   true,   // playmates may see what I do
    receiveActivity: true,   // send me what my playmates do
    recommendations: true    // suggest groups and events from my preferences
  },

  /* --- notification matrix. `features` are the profile-level
     switches. Individual events and groups can be muted on their own
     (mutedItems) without touching the feature-level switch - that
     distinction is explicit in the spec. --- */
  notifications: {
    channel: 'both',
    frequency: 'weekly',
    features: {
      events: true, groups: true, connections: true, organizations: true,
      opportunities: false, commons: true, resources: false, profile: true
    },
    mutedItems: ['evt-005']
  },

  /* --- engagement record: what fills every dashboard panel --- */
  events:      { registered: ['evt-001', 'evt-003', 'evt-005'], bookmarked: ['evt-006', 'evt-008'], proposed: ['evt-prop-1'] },
  groups:      { registered: ['grp-1', 'grp-5'],                bookmarked: ['grp-2'],              proposed: ['grp-prop-1'] },
  connections: ['ppl-1', 'ppl-4', 'ppl-7', 'ppl-8'],
  connectionRequests: ['ppl-6'],
  organizations: { verified: ['terra-commons'], pending: [] },  // empty verified list hides the card entirely
  opportunities: { saved: ['opp-1', 'opp-4'] },
  commons:       { tending: ['cmn-3', 'cmn-1'] },
  resources:     { saved: ['res-3', 'res-2'] },

  lastVisit: '2026-08-14T19:30:00-07:00',

  /* --- dashboard display settings the member controls --- */
  dashboard: {
    layout: 'constellation',   // constellation | cards | sidebar
    centreFocus: 'map',        // map | calendar
    connectionsView: 'cards',  // map | cards | list
    visibleFeatures: {
      profile: true, events: true, groups: true, connections: true,
      organizations: true, opportunities: true, commons: true, resources: true
    }
  }
};

/* Member-proposed items awaiting review. They appear only on the
 * proposer's own dashboard until a steward approves them. */
LIF.PROPOSALS = {
  'evt-prop-1': { id: 'evt-prop-1', kind: 'event', title: 'Willamette Riverbank Restoration Day', status: 'In review',      submitted: '2026-08-16T10:00:00-07:00', note: 'A LiF steward is reviewing this. You will get a notification either way.' },
  'grp-prop-1': { id: 'grp-prop-1', kind: 'group', title: 'Portland Water Justice Circle',        status: 'Needs a detail', submitted: '2026-08-11T13:20:00-07:00', note: 'The reviewer asked for a meeting rhythm before this goes live.' }
};

/* ---------------------------------------------------------------
 * The master notification feed. In production this is a paged API
 * call; here it's a fixed list. `feature` maps onto the notification
 * matrix above, so muting a feature filters this list live.
 * ------------------------------------------------------------- */
LIF.NOTIFICATION_FEED = [
  { id: 'ntf-1',  feature: 'events',        title: 'Global Co-Creation Circle moved rooms',           body: 'Now in the Garden Room at Sedona Creative Life Center. Same time.',   at: '2026-08-19T09:20:00-07:00', unread: true,  link: { type: 'event',       id: 'evt-001' } },
  { id: 'ntf-2',  feature: 'groups',        title: '3 new members joined Regenerative Design Circle', body: 'Mei Tanaka, Ade Okonkwo and one other joined this week.',            at: '2026-08-20T17:40:00-07:00', unread: true,  link: { type: 'group',       id: 'grp-1' } },
  { id: 'ntf-3',  feature: 'connections',   title: 'Sofia Marchetti wants to connect',                body: 'Interfaith facilitator in Assisi. You are both in Relations & Peace.', at: '2026-08-21T08:12:00-07:00', unread: true,  link: { type: 'person',      id: 'ppl-6' } },
  { id: 'ntf-4',  feature: 'groups',        title: 'Watershed Stewards Assembly set a date',          body: 'Next gathering is on the creek, Sept 6. Registration is open.',       at: '2026-08-21T11:15:00-07:00', unread: true,  link: { type: 'group',       id: 'grp-4' } },
  { id: 'ntf-5',  feature: 'commons',       title: 'Regenerative Land Registry added 4 plots',        body: 'Two of them are inside your 100 km radius.',                          at: '2026-08-20T07:55:00-07:00', unread: true,  link: { type: 'commons',     id: 'cmn-3' } },
  { id: 'ntf-6',  feature: 'connections',   title: 'Kwame Mensah posted an update',                   body: 'Shared the first harvest photos from the youth cooperative.',         at: '2026-08-18T06:30:00-07:00', unread: false, link: { type: 'person',      id: 'ppl-4' } },
  { id: 'ntf-7',  feature: 'events',        title: 'Body Wisdom Practice is nearly full',             body: '9 of 25 places left on a session you bookmarked.',                    at: '2026-08-17T12:00:00-07:00', unread: false, link: { type: 'event',       id: 'evt-006' } },
  { id: 'ntf-8',  feature: 'organizations', title: 'Terra Commons published a member briefing',       body: 'Visible to you because your membership is verified.',                 at: '2026-08-16T15:00:00-07:00', unread: false, link: { type: 'org',         id: 'terra-commons' } },
  { id: 'ntf-9',  feature: 'profile',       title: 'Your event proposal is in review',                body: 'Willamette Riverbank Restoration Day was submitted on Aug 16.',       at: '2026-08-16T10:02:00-07:00', unread: false, link: { type: 'proposal',    id: 'evt-prop-1' } },
  { id: 'ntf-10', feature: 'opportunities', title: 'New role: Community Support Coordinator',         body: 'Part-time, remote. Shown because you saved a similar role.',          at: '2026-08-15T09:00:00-07:00', unread: false, link: { type: 'opportunity', id: 'opp-2' } },
  { id: 'ntf-11', feature: 'resources',     title: 'Watershed Mapping for Neighbourhoods added',      body: 'New in Environment, Food & Water.',                                   at: '2026-08-13T11:30:00-07:00', unread: false, link: { type: 'resource',    id: 'res-5' } },
  { id: 'ntf-12', feature: 'events',        title: 'Peace Circle recording is up',                    body: 'From the session you attended in July.',                              at: '2026-08-12T16:45:00-07:00', unread: false, link: { type: 'event',       id: 'evt-003' } }
];

/* Playmate activity - only assembled when privacy.receiveActivity is
 * on, and only from connections whose own shareActivity is on.
 * Modelled here as a flat feed with that sharing already resolved. */
LIF.PLAYMATE_ACTIVITY = [
  { id: 'act-1', personId: 'ppl-4', verb: 'registered for', target: 'Regenerative Futures: Land, Food & Community', at: '2026-08-21T09:00:00-07:00' },
  { id: 'act-2', personId: 'ppl-8', verb: 'joined',         target: 'Watershed Stewards Assembly',                   at: '2026-08-20T18:20:00-07:00' },
  { id: 'act-3', personId: 'ppl-1', verb: 'saved',          target: 'Story Structure for Systems Change',            at: '2026-08-19T14:10:00-07:00' },
  { id: 'act-4', personId: 'ppl-7', verb: 'proposed',       target: 'Restorative Circles for School Staff',          at: '2026-08-18T10:05:00-07:00' }
];

/* Backwards compatibility: index.html's sidebar dashboard still reads
 * LIF.CURRENT_MEMBER. Point that object at the same person so the two
 * views can never disagree. */
if (LIF.CURRENT_MEMBER) {
  LIF.CURRENT_MEMBER.upcomingEventIds = LIF.MEMBER.events.registered;
  LIF.CURRENT_MEMBER.groupIds = LIF.MEMBER.groups.registered;
  LIF.CURRENT_MEMBER.connectionIds = LIF.MEMBER.connections;
}
