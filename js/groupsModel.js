/**
 * groupsModel.js
 * ---------------------------------------------------------------
 * The Groups domain, built to the Groups Human Mapping v1.0.
 *
 * Same shape as the events pathway: taxonomies, a normaliser that
 * fills in every field the rest of the pathway relies on, a
 * localStorage-backed store with a three-function surface, and a
 * pure-function API over both. No DOM in this file.
 *
 * THREE RULES FROM THE DOC THAT SHAPE EVERYTHING ELSE
 *
 *   1. "Discoverable Groups do not use public instant join."
 *      There is no join() in this API. Participation begins through
 *      requestAccess() or acceptInvitation(), and the invitation has
 *      to carry direct-access authority or it opens Request Access
 *      instead. The old one-click "Join group" button is gone.
 *
 *   2. Discoverability, content visibility and membership are three
 *      separate rules, not one "public/private" flag. canDiscover(),
 *      canSeeDetails() and canParticipate() are separate functions
 *      and a Group can be any combination of them.
 *
 *   3. Proposal Draft and Pending are PROPOSAL states. A provisioned
 *      Group uses Forming / Active / Quiet / Paused / Closing /
 *      Archived. They are deliberately kept in one `status` field
 *      with a `isProposalState` helper rather than two fields that
 *      can disagree.
 *
 * TERMINOLOGY: Group Areas, never Modules. Member, Connection,
 * Invitation to Connect. Enforced in the copy throughout.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

/* ===============================================================
 * 1. TAXONOMIES
 * ============================================================= */

/* §25: the five launch structures. A structure is a starting
   configuration - a set of recommended Group Areas - not a separate
   platform. `areas` below is what gets switched on by default. */
LIF.GROUP_STRUCTURES = [
  { id: 'collaboration', name: 'Collaboration / Working',
    desc: 'People making something together, with tasks and a shared plan.',
    areas: ['discussions', 'resources', 'activities', 'events', 'meetings', 'updates'] },
  { id: 'discussion', name: 'Discussion / Forum',
    desc: 'A durable place for topics, threads and considered replies.',
    areas: ['discussions', 'resources', 'updates'] },
  { id: 'casual', name: 'Casual / Social',
    desc: 'Low-stakes company. Chat, the odd gathering, no agenda.',
    areas: ['chat', 'events', 'updates'] },
  { id: 'learning', name: 'Learning / Practice Circle',
    desc: 'A group learning or practising something together over time.',
    areas: ['discussions', 'resources', 'events', 'meetings', 'updates'] },
  { id: 'support', name: 'Support / Peer Circle',
    desc: 'Peer support held with care. Smaller, slower, more private by default.',
    areas: ['discussions', 'meetings', 'updates'] }
];

/* §8: the shared core is always on and cannot be switched off; the
   optional Areas are what a Group chooses. `core: true` is what
   stops the settings screen offering to remove Help or Members. */
LIF.GROUP_AREAS = [
  { id: 'home',          name: 'Group Home / About',      core: true,  desc: 'Purpose, what is alive now, where to begin.' },
  { id: 'announcements', name: 'Announcements',            core: true,  desc: 'Steward notices, pinned and recent.' },
  { id: 'members',       name: 'Members and stewards',     core: true,  desc: 'Who is here, according to visibility rules.' },
  { id: 'help',          name: 'Help, agreements, reporting', core: true, desc: 'Agreements, role contacts, report a concern, LiF support.' },
  { id: 'discussions',   name: 'Discussion threads',       core: false, desc: 'Durable topics with replies.' },
  { id: 'chat',          name: 'Real-time chat',           core: false, desc: 'Faster conversation. Retained while the Group is active, archived with it.' },
  { id: 'resources',     name: 'Resources and files',      core: false, desc: 'Uploaded here or linked from approved external services.' },
  { id: 'events',        name: 'Events and calendar',      core: false, desc: 'Group Events use the shared Events pathway, never a separate one.' },
  { id: 'activities',    name: 'Activities, tasks, projects', core: false, desc: 'A board for what the Group is actually doing.' },
  { id: 'meetings',      name: 'Live meeting links',       core: false, desc: 'Zoom or Google Meet links for the Group.' },
  { id: 'updates',       name: 'Activity updates and Calls for Engagement', core: false, desc: 'What is alive now, and structured asks the Group can act on.' }
];

/* §19: proposal states and provisioned states, kept in one list
   with the boundary marked rather than in two lists that can drift. */
LIF.GROUP_STATES = [
  { id: 'draft',    name: 'Proposal Draft',         proposal: true,  desc: 'Being prepared. Visible only to you.' },
  { id: 'pending',  name: 'Proposal Pending Review',proposal: true,  desc: 'Submitted to LiF. Not yet an active Group.' },
  { id: 'forming',  name: 'Forming',                proposal: false, desc: 'Approved, while stewardship and setup complete.' },
  { id: 'active',   name: 'Active',                 proposal: false, desc: 'Open according to its discovery and access settings.' },
  { id: 'quiet',    name: 'Quiet',                  proposal: false, desc: 'Low or unconfirmed activity. Labelled honestly in discovery.' },
  { id: 'paused',   name: 'Paused',                 proposal: false, desc: 'Participation limited while the Group regroups or gets support.' },
  { id: 'closing',  name: 'Closing',                proposal: false, desc: 'A closure plan is underway. New joining may be restricted.' },
  { id: 'archived', name: 'Archived',               proposal: false, desc: 'Read-only, retained according to the closure plan.' }
];

/* §19: these never come back as an active recommendation. */
LIF.GROUP_INACTIVE_STATES = ['paused', 'closing', 'archived'];

/* §3.1 / §4.1 / §5: discoverability and join method are separate.
   Note what is NOT here: instant join. */
LIF.GROUP_DISCOVERABILITY = [
  { id: 'discoverable', name: 'Discoverable',  desc: 'Appears in Explore Groups, search, filters and the Map.' },
  { id: 'unlisted',     name: 'Unlisted',      desc: 'Not in discovery. Reachable by a direct link or an invitation.' },
  { id: 'private',      name: 'Private',       desc: 'Invitation only. Nothing shows to anyone outside it.' }
];

LIF.GROUP_JOIN_METHODS = [
  { id: 'request',    name: 'Request Access',        desc: 'Anyone authorized to discover it may ask. A steward reviews.' },
  { id: 'invitation', name: 'Invitation only',       desc: 'Participation begins only from an invitation a steward sends.' }
];

/* §4.1 approved direction: the Group chooses how its size shows. */
LIF.GROUP_COUNT_DISPLAY = [
  { id: 'exact',       name: 'Exact number',       desc: 'e.g. 86 Members.' },
  { id: 'approximate', name: 'Approximate range',  desc: 'e.g. 50–100 Members.' },
  { id: 'hidden',      name: 'Hidden',             desc: 'Not shown. Capacity still shows when it affects Request Access.' }
];

/* §5.2 step 4: the four review outcomes, and nothing else. */
LIF.ACCESS_DECISIONS = [
  { id: 'approve',   name: 'Approve',                terminal: true,  desc: 'Creates the membership and opens Group Home.' },
  { id: 'more-info', name: 'More Information Needed',terminal: false, desc: 'Goes back to the person with a question. The request stays open.' },
  { id: 'waitlist',  name: 'Waitlist',               terminal: false, desc: 'Held for a place. The person is told where they stand.' },
  { id: 'decline',   name: 'Decline',                terminal: true,  desc: 'Closed with respectful member-facing reasoning.' }
];

/* §23: membership is a state machine, not a boolean. */
LIF.MEMBERSHIP_STATES = [
  { id: 'none',      name: 'Not a Member' },
  { id: 'invited',   name: 'Invited' },
  { id: 'requested', name: 'Request Pending' },
  { id: 'waitlisted',name: 'Waitlisted' },
  { id: 'active',    name: 'Member' },
  { id: 'paused',    name: 'Paused' },
  { id: 'left',      name: 'Left' },
  { id: 'removed',   name: 'Removed' },
  { id: 'banned',    name: 'Banned' }
];

/* §10: a role is a named bundle of capabilities. The capabilities
   are what actually gate anything - the role name is for people. */
LIF.GROUP_CAPABILITIES = [
  'view', 'post', 'comment', 'react', 'share',
  'add-resource', 'publish-announcement', 'create-event',
  'invite', 'approve', 'remove', 'manage-settings', 'moderate',
  'view-audit', 'close-group'
];

LIF.GROUP_ROLES = [
  { id: 'member', name: 'Member', desc: 'Participate in permitted Group Areas and use enabled contribution actions.',
    caps: ['view', 'post', 'comment', 'react', 'share'] },
  { id: 'moderator', name: 'Moderator', desc: 'Support conversations, content and specified membership reviews.',
    caps: ['view', 'post', 'comment', 'react', 'share', 'add-resource', 'moderate', 'approve'] },
  { id: 'admin', name: 'Group Admin', desc: 'Manage Group settings, access, roles and accountable stewardship.',
    caps: ['view', 'post', 'comment', 'react', 'share', 'add-resource', 'publish-announcement',
           'create-event', 'invite', 'approve', 'remove', 'manage-settings', 'moderate', 'view-audit', 'close-group'] },
  { id: 'platform-admin', name: 'Platform Admin', desc: 'LiF-wide review, safety, support, configuration and recovery.',
    caps: LIF.GROUP_CAPABILITIES.slice() }
];

/* §10: named optional roles, added only where they clarify
   responsibility. Each is a member role plus a few capabilities. */
LIF.GROUP_STEWARD_ROLES = [
  { id: 'membership-steward', name: 'Membership Steward', caps: ['approve', 'invite'] },
  { id: 'resource-curator',   name: 'Resource Curator',   caps: ['add-resource'] },
  { id: 'event-host',         name: 'Event Host',         caps: ['create-event'] },
  { id: 'project-coordinator',name: 'Project Coordinator',caps: ['post', 'add-resource'] },
  { id: 'care-support',       name: 'Care / Conflict Support', caps: ['moderate'] }
];

/* §11.1: five distinct communication modes, launched as distinct
   things rather than one feed pretending to be all of them. */
LIF.GROUP_COMM_MODES = [
  { id: 'announcement', name: 'Announcement', desc: 'Steward-originated, defined audience, delivery record.' },
  { id: 'discussion',   name: 'Discussion thread', desc: 'A durable topic with replies.' },
  { id: 'chat',         name: 'Chat', desc: 'Faster conversation. Retention is disclosed.' },
  { id: 'comment',      name: 'Comment', desc: 'A response attached to a Resource, update or Activity.' },
  { id: 'reaction',     name: 'Reaction', desc: 'Acknowledgement that does not trigger a wave of notifications.' }
];

/* §16: notification categories and cadences. Channels deliberately
   match the Personal Dashboard's rather than inventing new ones. */
LIF.GROUP_NOTIFY_CATEGORIES = [
  { id: 'announcements', name: 'Announcements' },
  { id: 'discussions',   name: 'Discussions and posts' },
  { id: 'replies',       name: 'Replies and mentions' },
  { id: 'events',        name: 'Events' },
  { id: 'resources',     name: 'Resources' },
  { id: 'membership',    name: 'Membership and role changes' },
  { id: 'calls',         name: 'Calls for Engagement' },
  { id: 'activity',      name: 'Activity updates' }
];

LIF.GROUP_NOTIFY_CADENCE = [
  { id: 'immediate',  name: 'Immediate' },
  { id: 'daily',      name: 'Daily digest' },
  { id: 'weekly',     name: 'Weekly digest' },
  { id: 'highlights', name: 'Highlights only' },
  { id: 'off',        name: 'Off' }
];

/* §17: care-centered language. "kick" is explicitly ruled out. */
LIF.MODERATION_ACTIONS = [
  { id: 'warning',   name: 'Warning' },
  { id: 'restrict',  name: 'Pause / restriction' },
  { id: 'temp-remove', name: 'Temporary removal' },
  { id: 'remove',    name: 'Removal' },
  { id: 'ban',       name: 'Ban' }
];

LIF.REPORT_STATES = [
  { id: 'received',  name: 'Received' },
  { id: 'more-info', name: 'More Information Needed' },
  { id: 'reviewing', name: 'Reviewing' },
  { id: 'escalated', name: 'Escalated' },
  { id: 'resolved',  name: 'Resolved' }
];

LIF.REPORT_CATEGORIES = [
  { id: 'safety',      name: 'Urgent safety concern', urgent: true },
  { id: 'harassment',  name: 'Harassment or harm',    urgent: true },
  { id: 'guidelines',  name: 'Community Guidelines',  urgent: false },
  { id: 'privacy',     name: 'Privacy or data',       urgent: false },
  { id: 'spam',        name: 'Spam or off-topic',     urgent: false },
  { id: 'other',       name: 'Something else',        urgent: false }
];

/* §15: relationships between Groups, weakest to strongest. Merge is
   defined but deliberately not implemented at launch. */
LIF.GROUP_RELATIONSHIPS = [
  { id: 'connect',     name: 'Connect',     launch: true,  desc: 'A lightweight, consent-based link. Shared Events, linked Resources, cross-posted calls.' },
  { id: 'collaborate', name: 'Collaborate', launch: true,  desc: 'A defined shared activity. Neither Group dissolves.' },
  { id: 'merge',       name: 'Merge',       launch: false, desc: 'Higher impact. Needs each Group’s documented consent and LiF technical and safety review.' }
];

/* Reused from the events pathway rather than duplicated. */
LIF.GROUP_COVERS = LIF.SECTOR_COVERS;

/* Every prototype asset the doc requires must say so on screen. */
LIF.PROTOTYPE_LABEL = 'PROTOTYPE — REQUIRES LiF APPROVAL';

/* ===============================================================
 * 2. NORMALISATION
 * The seven sample groups carry five fields between them. This
 * fills in the rest so no screen has to guard for a missing field.
 * ============================================================= */
(function normaliseGroups() {
  function structureFor(g) {
    if (g.structure) return g.structure;
    return { environment: 'collaboration', relations: 'learning', economics: 'discussion',
             health: 'support', spirituality: 'discussion' }[g.sector] || 'discussion';
  }

  LIF.GROUPS.forEach(function (g) {
    if (!g.structure) g.structure = structureFor(g);
    if (!g.status) g.status = 'active';
    if (!g.slug) g.slug = g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (!g.purpose) g.purpose = g.description;
    if (!g.whoFor) g.whoFor = '';
    if (!g.activityPlan) g.activityPlan = '';
    if (!g.lastUpdate) g.lastUpdate = null;

    if (!g.format) g.format = g.lat != null ? 'hybrid' : 'online';
    if (!g.location && g.lat != null) {
      g.location = { city: g.city || '', region: '', country: g.country || '', lat: g.lat, lng: g.lng };
    }
    if (!g.languages) g.languages = { primary: g.language || 'English', supported: [] };
    if (!g.accessibility) {
      g.accessibility = { notes: '', contact: 'accessibility@loveisfoundation.org' };
    }

    if (!g.access) {
      g.access = {
        discoverability: 'discoverable',
        joinMethod: 'request',
        instructions: 'Tell the stewards a little about what brings you. They read every request.',
        questions: [
          { key: 'why', label: 'What brings you to this Group?', required: true },
          { key: 'offer', label: 'Anything you would like to offer or learn here?', required: false }
        ],
        sharedInfoNote: 'Stewards see your Playground Name, your public profile fields and your answers below. Nothing else.',
        allowInvites: true
      };
    }

    if (!g.countDisplay) g.countDisplay = 'exact';
    if (g.capacity === undefined) g.capacity = null;

    if (!g.stewards) {
      g.stewards = [{ memberId: 'ppl-1', name: 'A LiF steward', role: 'admin', public: true }];
    }

    /* Areas: the structure's recommended defaults plus the core four. */
    if (!g.areas) {
      var rec = (LIF.GROUP_STRUCTURES.find(function (s) { return s.id === g.structure; }) || {}).areas || [];
      g.areas = {};
      LIF.GROUP_AREAS.forEach(function (a) {
        g.areas[a.id] = a.core || rec.indexOf(a.id) !== -1;
      });
    }

    if (!g.agreements) {
      g.agreements = [
        'What is said here stays here unless we agree otherwise.',
        'Speak from your own experience. Leave room for others to do the same.',
        'Disagreement is welcome. Contempt is not.'
      ];
    }
    if (!g.connections) g.connections = { groups: [], events: [], organizations: [] };
    if (!g.originEventId) g.originEventId = null;
    if (!g.tags) g.tags = [g.subsector].filter(Boolean);
    if (!g.createdAt) g.createdAt = '2026-02-01T09:00:00-07:00';
    if (!g.updatedAt) g.updatedAt = g.createdAt;
    if (!g.activityConfirmedAt) g.activityConfirmedAt = g.updatedAt;
    if (!g.statusNote) g.statusNote = '';
  });
})();

/* ===============================================================
 * 3. MORE SAMPLE GROUPS
 * The seven originals are all Active, discoverable and open to a
 * request - which left most of the doc's states with nothing to
 * show. These five make every lifecycle state, both join methods
 * and all three count displays visible in one session.
 * ============================================================= */
LIF.GROUPS.push(
  /* --- FORMING: approved, still setting up. Not yet joinable. --- */
  {
    id: 'grp-8', name: 'Bioregional Water Council', slug: 'bioregional-water-council',
    description: 'A cross-watershed council forming now, connecting the creek groups to city policy.',
    purpose: 'Six neighbourhood creek groups keep meeting the same wall at the same city department. This council is the shared table: one voice into policy, and a place to keep each other honest about what we are asking for.',
    whoFor: 'Anyone already tending a watershed in this bioregion, and the people inside the agencies who want to help.',
    activityPlan: 'First convening in October, then monthly. Working towards a joint submission by spring.',
    sector: 'environment', subsector: 'Water', structure: 'collaboration',
    status: 'forming',
    statusNote: 'Approved. We are confirming a second Admin and finishing the agreements before opening for requests.',
    format: 'hybrid',
    location: { city: 'Portland', region: 'Oregon', country: 'USA', lat: 45.5152, lng: -122.6784 },
    languages: { primary: 'English', supported: ['Spanish'] },
    memberCount: 6, countDisplay: 'exact', capacity: null,
    access: { discoverability: 'discoverable', joinMethod: 'request',
      instructions: 'Requests open once we are set up. Follow the Group to be told when.',
      questions: [{ key: 'why', label: 'Which watershed do you tend?', required: true }],
      sharedInfoNote: 'Stewards see your Playground Name, your public profile fields and your answer.',
      allowInvites: true },
    stewards: [{ memberId: 'mem-001', name: 'Alex Rivera', role: 'admin', public: true }],
    tags: ['water', 'policy'], createdAt: '2026-08-12T09:00:00-07:00', updatedAt: '2026-08-20T09:00:00-07:00'
  },

  /* --- QUIET: real, but the stewards have not confirmed activity.
         The doc is explicit that this must be labelled honestly in
         discovery rather than recommended as active. --- */
  {
    id: 'grp-9', name: 'Quantum Foundations Reading Circle', slug: 'quantum-foundations-reading-circle',
    description: 'A slow reading circle through the foundations literature. Quiet since June.',
    purpose: 'One paper a month, read properly, discussed without anyone pretending to understand more than they do.',
    whoFor: 'Physicists, philosophers of science, and stubborn amateurs.',
    activityPlan: '',
    sector: 'science', subsector: 'Quantum physics', structure: 'learning',
    status: 'quiet',
    statusNote: 'No steward has confirmed current activity since June, so this shows as Quiet rather than Active.',
    format: 'online', location: null,
    languages: { primary: 'English', supported: [] },
    memberCount: 23, countDisplay: 'approximate', capacity: null,
    stewards: [{ memberId: 'ppl-3', name: 'Priya Nandakumar', role: 'admin', public: true }],
    tags: ['reading', 'physics'], createdAt: '2025-09-01T09:00:00-07:00',
    updatedAt: '2026-06-04T09:00:00-07:00', activityConfirmedAt: '2026-06-04T09:00:00-07:00'
  },

  /* --- PRIVATE + invitation only, and this member is invited.
         Demonstrates the direct-access invitation path. --- */
  {
    id: 'grp-10', name: 'Compassionate Listening Peer Circle', slug: 'compassionate-listening-peer-circle',
    description: 'A small peer circle for people holding hard conversations in their work.',
    purpose: 'Eight people, twice a month, practising listening on the conversations we are actually dreading. Confidential by agreement, small by design.',
    whoFor: 'Practitioners who sit with conflict as part of their work and need somewhere to be the one who is held.',
    activityPlan: 'Second and fourth Tuesday. Currently working through de-escalation in public meetings.',
    sector: 'relations', subsector: 'Conflict Management', structure: 'support',
    status: 'active',
    format: 'online', location: null,
    languages: { primary: 'English', supported: [] },
    memberCount: 8, countDisplay: 'hidden', capacity: 10,
    access: { discoverability: 'private', joinMethod: 'invitation',
      instructions: 'This circle grows by invitation only, from people already in it.',
      questions: [], sharedInfoNote: '', allowInvites: true },
    stewards: [{ memberId: 'ppl-9', name: 'Nadia Haddad', role: 'admin', public: true }],
    agreements: [
      'Confidential. Nothing leaves the circle, including in anonymised form.',
      'No fixing. We are here to be heard, not solved.',
      'You may pass at any point without explaining.'
    ],
    tags: ['listening', 'peer support'], createdAt: '2026-01-15T09:00:00-08:00', updatedAt: '2026-08-19T09:00:00-07:00'
  },

  /* --- PAUSED: participation limited while the group regroups. --- */
  {
    id: 'grp-11', name: 'Restorative Schools Practitioners', slug: 'restorative-schools-practitioners',
    description: 'Paused until September while the stewards rest and rework the agreements.',
    purpose: 'Mediators and teachers running restorative circles inside school systems, trading what actually works.',
    whoFor: 'Anyone doing restorative practice in a school, at any level of experience.',
    activityPlan: '',
    sector: 'justice', subsector: 'Restorative justice', structure: 'discussion',
    status: 'paused',
    statusNote: 'Paused by the stewards until September. Existing Members keep access; notifications are limited and new requests are held.',
    format: 'online', location: null,
    languages: { primary: 'English', supported: [] },
    memberCount: 74, countDisplay: 'exact', capacity: null,
    stewards: [{ memberId: 'ppl-7', name: 'Ade Okonkwo', role: 'admin', public: true }],
    tags: ['schools', 'restorative'], createdAt: '2024-11-01T09:00:00-07:00', updatedAt: '2026-07-30T09:00:00-07:00'
  },

  /* --- ARCHIVED, and grown out of a completed Event. Shows both
         the read-only end state and the Event-to-Group link. --- */
  {
    id: 'grp-12', name: 'Johnson Creek Culvert Working Group', slug: 'johnson-creek-culvert-working-group',
    description: 'Formed after the Water Justice Listening Session. Work complete, kept read-only.',
    purpose: 'A time-boxed group formed to answer one question the listening session could not: what happens to the culvert.',
    whoFor: 'The people who stayed behind after the session.',
    activityPlan: '',
    sector: 'environment', subsector: 'Water', structure: 'collaboration',
    status: 'archived',
    statusNote: 'The work finished in August and the group archived itself. Everything here is readable; nothing new can be added.',
    format: 'online', location: null,
    languages: { primary: 'English', supported: [] },
    memberCount: 11, countDisplay: 'exact', capacity: null,
    stewards: [{ memberId: 'mem-001', name: 'Alex Rivera', role: 'admin', public: true }],
    originEventId: 'evt-201',
    connections: { groups: ['grp-4'], events: ['evt-201'], organizations: [] },
    tags: ['water', 'culvert'], createdAt: '2026-08-08T09:00:00-07:00', updatedAt: '2026-08-21T09:00:00-07:00'
  }
);

/* Run the five new ones through the normaliser too. */
(function normaliseAdded() {
  LIF.GROUPS.filter(function (g) { return !g.areas || !g.access || !g.agreements; }).forEach(function (g) {
    if (!g.slug) g.slug = g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!g.access) {
      g.access = { discoverability: 'discoverable', joinMethod: 'request',
        instructions: 'Tell the stewards what brings you.', questions: [
          { key: 'why', label: 'What brings you to this Group?', required: true }
        ], sharedInfoNote: 'Stewards see your Playground Name, your public profile fields and your answers.', allowInvites: true };
    }
    if (!g.areas) {
      var rec = (LIF.GROUP_STRUCTURES.find(function (s) { return s.id === g.structure; }) || {}).areas || [];
      g.areas = {};
      LIF.GROUP_AREAS.forEach(function (a) { g.areas[a.id] = a.core || rec.indexOf(a.id) !== -1; });
    }
    if (!g.agreements) {
      g.agreements = ['Speak from your own experience.', 'Disagreement is welcome. Contempt is not.'];
    }
    if (!g.accessibility) g.accessibility = { notes: '', contact: 'accessibility@loveisfoundation.org' };
    if (!g.connections) g.connections = { groups: [], events: [], organizations: [] };
    if (!g.originEventId) g.originEventId = null;
    if (!g.whoFor) g.whoFor = '';
    if (!g.activityPlan) g.activityPlan = '';
    if (!g.lastUpdate) g.lastUpdate = null;
    if (!g.statusNote) g.statusNote = '';
    if (!g.activityConfirmedAt) g.activityConfirmedAt = g.updatedAt;
    if (g.capacity === undefined) g.capacity = null;
    if (!g.countDisplay) g.countDisplay = 'exact';
  });
})();

/* A current focus and a latest update on the busier Groups, so
   "What is alive now" on Group Home has something real to say. */
(function seedAliveNow() {
  var ALIVE = {
    'grp-1': { plan: 'Designing the spring planting plan for three sites. Drawings due end of September.',
               update: { text: 'Site B soil results came back — we are going to need more compost than planned. Notes in Resources.', at: '2026-08-21T14:00:00-07:00', by: 'Kwame Mensah' } },
    'grp-4': { plan: 'Winter work planning. Next work morning is on the creek, Sept 6.',
               update: { text: 'Tools are sorted for Sept 6. Still short two people who can drive a truck.', at: '2026-08-22T08:30:00-07:00', by: 'Mei Tanaka' } },
    'grp-5': { plan: 'Building a shared curriculum bank for conflict-transformation work in schools.',
               update: { text: 'Three new modules added this week. The de-escalation one still needs a reviewer.', at: '2026-08-20T11:00:00-07:00', by: 'Nadia Haddad' } },
    'grp-2': { plan: 'Preparing the Assisi gathering in November.',
               update: { text: 'Venue confirmed. We can hold forty.', at: '2026-08-17T09:00:00+02:00', by: 'Sofia Marchetti' } },
    'grp-10': { plan: 'Working through de-escalation in public meetings.',
                update: { text: 'Next circle moves to the 27th — a clash with the school board meeting.', at: '2026-08-18T19:00:00-07:00', by: 'Nadia Haddad' } }
  };
  Object.keys(ALIVE).forEach(function (id) {
    var g = LIF.GROUPS.find(function (x) { return x.id === id; });
    if (!g) return;
    g.activityPlan = ALIVE[id].plan;
    g.lastUpdate = ALIVE[id].update;
  });
})();

/* ===============================================================
 * 4. THE STORE
 * ============================================================= */
LIF.groupStore = (function () {
  var KEY = 'lif.groups.v1';

  var EMPTY = {
    memberships: {},   // groupId -> { state, role, caps[], joinedAt, notify{}, muted }
    follows: [],       // groupId[] - watching without belonging
    requests: {},      // groupId -> { at, answers, status, reviewerNote, decidedAt, history[] }
    invitations: {},   // inviteId -> { groupId, kind, fromName, message, at, state }
    proposals: {},     // proposalId -> full proposal record
    drafts: {},        // proposalId -> partially filled proposal
    threads: {},       // groupId -> [{ id, title, author, at, posts[], following }]
    chat: {},          // groupId -> [{ author, text, at }]
    announcements: {}, // groupId -> [{ id, title, body, at, by, audience, pinned }]
    calls: {},         // groupId -> [{ id, need, timing, where, route, closes, at, by }]
    resources: {},     // groupId -> [{ id, title, url, kind, audience, by, at }]
    activities: {},    // groupId -> [{ id, title, state, assignee }]
    reports: [],       // [{ id, groupId, category, note, at, state }]
    reads: {},         // groupId -> ISO of last visit
    outbox: [],
    seeded: false
  };

  var cache = null;

  function read() {
    if (cache) return cache;
    try {
      var raw = localStorage.getItem(KEY);
      cache = raw ? Object.assign(JSON.parse(JSON.stringify(EMPTY)), JSON.parse(raw))
                  : JSON.parse(JSON.stringify(EMPTY));
    } catch (e) { cache = JSON.parse(JSON.stringify(EMPTY)); }
    return cache;
  }

  function write(next) {
    cache = next || cache;
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* private mode */ }
    document.dispatchEvent(new CustomEvent('lif:groupschange'));
    return cache;
  }

  function reset() {
    cache = JSON.parse(JSON.stringify(EMPTY));
    try { localStorage.removeItem(KEY); } catch (e) {}
    document.dispatchEvent(new CustomEvent('lif:groupschange'));
  }

  /* §16: "Every automatic notification has a trigger, audience,
     channel, template, delivery status and audit record." A frontend
     cannot deliver one, so each is recorded with all six fields and
     shown on screen instead of mimed. */
  function queue(entry) {
    var s = read();
    s.outbox.unshift(Object.assign({
      at: new Date().toISOString(),
      id: 'gmsg-' + (s.outbox.length + 1),
      channel: 'playground+email',
      delivery: 'queued'
    }, entry));
    s.outbox = s.outbox.slice(0, 80);
    write(s);
    return s.outbox[0];
  }

  /* The in-Playground half, which a frontend genuinely can do. */
  function notify(entry) {
    if (!LIF.NOTIFICATION_FEED) return null;
    var n = Object.assign({
      id: 'ntf-grp-' + (LIF.NOTIFICATION_FEED.length + 1),
      feature: 'groups', unread: true, at: new Date().toISOString()
    }, entry);
    LIF.NOTIFICATION_FEED.unshift(n);
    return n;
  }

  return { read: read, write: write, reset: reset, queue: queue, notify: notify,
           outbox: function () { return read().outbox; }, KEY: KEY };
})();

/* ===============================================================
 * 5. THE DOMAIN API
 * ============================================================= */
LIF.groups = (function () {
  var store = LIF.groupStore;

  /* --- who is asking --- */
  function memberId() { return LIF.MEMBER ? LIF.MEMBER.id : 'mem-001'; }
  function memberName() {
    if (LIF.MEMBER) {
      return (LIF.MEMBER.fields.preferredName.value || LIF.MEMBER.fields.firstName.value) + ' ' + LIF.MEMBER.fields.lastName.value;
    }
    return (LIF.CURRENT_MEMBER && LIF.CURRENT_MEMBER.name) || 'Friend';
  }
  function preferredName() {
    if (LIF.MEMBER) return LIF.MEMBER.fields.preferredName.value || LIF.MEMBER.fields.firstName.value;
    return (LIF.CURRENT_MEMBER && LIF.CURRENT_MEMBER.preferredName) || memberName().split(' ')[0];
  }
  function memberEmail() {
    if (LIF.MEMBER) return LIF.MEMBER.fields.email.value;
    return (LIF.CURRENT_MEMBER && LIF.CURRENT_MEMBER.email) || 'you@example.org';
  }

  /* §3.1: "A Guest may explore public Group cards ... but must sign
     up and complete the required I Am Here fields before joining,
     requesting access or participating." There is no real auth in
     this build, so isGuest() is the single switch a real session
     would flip - everything gates on it rather than on scattered
     checks. */
  function isGuest() { return !LIF.MEMBER && !LIF.CURRENT_MEMBER; }

  function iAmHereComplete() {
    if (!LIF.MEMBER) return true;
    return Object.keys(LIF.MEMBER.fields).every(function (k) {
      var f = LIF.MEMBER.fields[k];
      return !f.required || String(f.value || '').trim();
    });
  }

  /* --- lookups --- */
  function all() { return LIF.GROUPS; }
  function get(id) {
    return LIF.GROUPS.find(function (g) { return g.id === id || g.slug === id; }) || null;
  }
  function stateMeta(id) {
    return LIF.GROUP_STATES.find(function (s) { return s.id === id; }) || LIF.GROUP_STATES[3];
  }
  function structureMeta(id) {
    return LIF.GROUP_STRUCTURES.find(function (s) { return s.id === id; }) || LIF.GROUP_STRUCTURES[1];
  }
  function isProposalState(g) { return stateMeta(g.status).proposal; }
  function isReadOnly(g) { return g.status === 'archived'; }

  /* --- the three separate visibility rules (§23) --- */

  /** Can this viewer find the Group in Explore, search, filters, Map? */
  function canDiscover(g) {
    if (!g || isProposalState(g)) return isCreator(g);
    if (g.access.discoverability === 'private' || g.access.discoverability === 'unlisted') {
      return !!(membershipState(g.id) !== 'none' || isSteward(g));
    }
    return true;
  }

  /** Can this viewer open the authoritative Group Details record? */
  function canSeeDetails(g) {
    if (!g) return false;
    if (canDiscover(g)) return true;
    /* An unlisted Group is reachable by direct link or invitation. */
    if (g.access.discoverability === 'unlisted') return true;
    return invitationFor(g.id) != null;
  }

  /** Can this viewer post, comment, react - actually take part? */
  function canParticipate(g) {
    if (!g) return false;
    if (isReadOnly(g)) return false;
    if (g.status === 'paused' || g.status === 'closing') return false;
    return membershipState(g.id) === 'active';
  }

  function isCreator(g) {
    return !!g && (g.stewards || []).some(function (s) { return s.memberId === memberId() && s.role === 'admin'; });
  }
  function isSteward(g) {
    var m = membership(g && g.id);
    /* Coerced deliberately: these gate visibility, and a predicate
       that can return null instead of false is a bug waiting for the
       one caller that uses === false. */
    return !!(isCreator(g) || (m && (m.role === 'admin' || m.role === 'moderator')));
  }

  /** The capability check everything gates on. Roles are a bundle. */
  function can(g, capability) {
    if (!g) return false;
    if (isReadOnly(g) && capability !== 'view') return false;
    var m = membership(g.id);
    var role = m ? m.role : (isCreator(g) ? 'admin' : null);
    if (!role) return false;
    var base = (LIF.GROUP_ROLES.find(function (r) { return r.id === role; }) || {}).caps || [];
    var extra = (m && m.caps) || [];
    return base.indexOf(capability) !== -1 || extra.indexOf(capability) !== -1;
  }

  /* --- membership --- */
  function membership(groupId) { return store.read().memberships[groupId] || null; }
  function membershipState(groupId) {
    var m = membership(groupId);
    if (m) return m.state;
    if (store.read().requests[groupId]) {
      var r = store.read().requests[groupId];
      return r.status === 'waitlist' ? 'waitlisted' : (r.status === 'pending' || r.status === 'more-info') ? 'requested' : 'none';
    }
    if (invitationFor(groupId)) return 'invited';
    return 'none';
  }
  function isMember(groupId) { return membershipState(groupId) === 'active'; }

  function myGroups() {
    var s = store.read();
    var ids = Object.keys(s.memberships).filter(function (id) { return s.memberships[id].state === 'active'; });
    return ids.map(get).filter(Boolean);
  }
  function myFollows() { return store.read().follows.map(get).filter(Boolean); }
  function myRequests() {
    var s = store.read();
    return Object.keys(s.requests).map(function (id) {
      var g = get(id);
      return g ? { group: g, request: s.requests[id] } : null;
    }).filter(Boolean);
  }
  function myInvitations() {
    var s = store.read();
    return Object.keys(s.invitations).map(function (k) {
      var inv = s.invitations[k];
      var g = get(inv.groupId);
      return g && inv.state === 'pending' ? { group: g, invitation: Object.assign({ id: k }, inv) } : null;
    }).filter(Boolean);
  }
  function invitationFor(groupId) {
    var s = store.read();
    var key = Object.keys(s.invitations).find(function (k) {
      return s.invitations[k].groupId === groupId && s.invitations[k].state === 'pending';
    });
    return key ? Object.assign({ id: key }, s.invitations[key]) : null;
  }

  /* --- discovery (§3.2) --- */

  /** Explore Groups: only what this viewer is authorized to discover. */
  function exploreGroups() {
    return LIF.GROUPS.filter(function (g) { return canDiscover(g) && !isProposalState(g); });
  }

  /** §12: Paused, Closing and Archived stop being recommended. */
  function recommendable(g) {
    return LIF.GROUP_INACTIVE_STATES.indexOf(g.status) === -1 && !isProposalState(g);
  }

  var defaultFilters = {
    q: '', sectors: [], subsectors: [], formats: [], languages: [],
    structures: [], access: [], states: [], radiusKm: null, forMe: false
  };

  function filter(f) {
    f = Object.assign({}, defaultFilters, f || {});
    var M = LIF.MEMBER;
    return exploreGroups().filter(function (g) {
      if (f.q) {
        /* §3.2 approved direction: search only approved searchable
           fields. Unpublished fields may influence results but must
           never surface - so purpose and description are searched,
           steward notes and access answers never are. */
        var hay = [g.name, g.description, g.purpose, g.whoFor, g.activityPlan, (g.tags || []).join(' ')]
          .join(' ').toLowerCase();
        if (hay.indexOf(f.q.toLowerCase()) === -1) return false;
      }
      if (f.sectors.length && f.sectors.indexOf(g.sector) === -1) return false;
      if (f.subsectors.length && f.subsectors.indexOf(g.subsector) === -1) return false;
      if (f.formats.length && f.formats.indexOf(g.format) === -1) return false;
      if (f.structures.length && f.structures.indexOf(g.structure) === -1) return false;
      if (f.states.length && f.states.indexOf(g.status) === -1) return false;
      if (f.access.length && f.access.indexOf(g.access.joinMethod) === -1) return false;
      if (f.languages.length) {
        var langs = [g.languages.primary].concat(g.languages.supported || []);
        if (!langs.some(function (l) { return f.languages.indexOf(l) !== -1; })) return false;
      }
      /* §3.2: "online-only Groups are not forced into a physical-
         distance filter" - so an online Group passes a radius filter
         rather than being silently dropped by it. */
      if (f.radiusKm != null && g.location && g.location.lat != null && M) {
        if (distanceKm(g.location.lat, g.location.lng) > f.radiusKm) return false;
      }
      if (f.forMe && !matchReasons(g).length) return false;
      return true;
    });
  }

  function distanceKm(lat, lng) {
    var M = LIF.MEMBER;
    if (!M || !LIF.util) return Infinity;
    return LIF.util.haversineKm(M.lat, M.lng, lat, lng);
  }

  /** §3.2: "display a plain-language reason". Built only from the
      viewer's own preferences and the Group's published fields, so
      an unpublished field can never leak through an explanation. */
  function matchReasons(g) {
    var M = LIF.MEMBER;
    var prefs;
    if (M) {
      prefs = M.preferences;
    } else if (LIF.CURRENT_MEMBER) {
      /* The public hub does not load the full member record. Match on
         what it does have rather than silently returning nothing and
         making "For Me" look broken there. */
      prefs = { sectors: LIF.CURRENT_MEMBER.interestedSectors || [], subsectors: [],
                radiusKm: null, languages: LIF.CURRENT_MEMBER.languages || [] };
    } else {
      return [];
    }
    var out = [];
    var sector = LIF.SECTORS.find(function (s) { return s.id === g.sector; });
    if (prefs.sectors.indexOf(g.sector) !== -1 && sector) out.push('Matches your interest in ' + sector.name);
    if (g.subsector && prefs.subsectors.indexOf(g.subsector) !== -1) out.push('You follow ' + g.subsector);
    if (g.location && g.location.lat != null && prefs.radiusKm) {
      var d = distanceKm(g.location.lat, g.location.lng);
      if (d <= prefs.radiusKm) {
        out.push((g.format === 'hybrid' ? 'Hybrid' : 'In-person') + ' Group in your selected range');
      }
    }
    if (out.length && (prefs.languages || []).indexOf(g.languages.primary) !== -1) {
      out.push('Held in ' + g.languages.primary);
    }
    return out;
  }

  function suggested() {
    if (LIF.MEMBER && !LIF.MEMBER.privacy.recommendations) return [];   // §respects the profile switch
    return exploreGroups()
      .filter(function (g) { return recommendable(g) && membershipState(g.id) === 'none'; })
      .map(function (g) { return { group: g, why: matchReasons(g) }; })
      .filter(function (r) { return r.why.length; })
      .sort(function (a, b) { return b.why.length - a.why.length; });
  }

  /* --- how the Group's size is allowed to show (§4.1) --- */
  function countLabel(g) {
    if (g.countDisplay === 'hidden') {
      return g.capacity ? 'Places limited to ' + g.capacity : 'Member count not shown';
    }
    if (g.countDisplay === 'approximate') {
      /* Band width scales with the number. "20-30 Members" is useful;
         "1-25 Members" for a group of 23 is not an approximation, it
         is a shrug. */
      var band = g.memberCount < 50 ? 10 : g.memberCount < 200 ? 25 : 50;
      var lo = Math.floor(g.memberCount / band) * band;
      return (lo || 1) + '–' + (lo + band) + ' Members';
    }
    return g.memberCount + ' Member' + (g.memberCount === 1 ? '' : 's');
  }

  /** Capacity has to stay clear where it affects Request Access,
      whatever the count display says. */
  function capacityNote(g) {
    if (!g.capacity) return '';
    var left = g.capacity - g.memberCount;
    if (left <= 0) return 'Full. New requests join the waitlist.';
    if (left <= 3) return left + ' place' + (left === 1 ? '' : 's') + ' left.';
    return '';
  }
  function isFull(g) { return !!g.capacity && g.memberCount >= g.capacity; }

  /* --- the single primary action on a card or details page (§4.2:
         "One context-appropriate primary action") --- */
  function primaryAction(g) {
    if (!g) return { id: 'none', label: 'Unavailable', enabled: false };
    if (isProposalState(g)) {
      return { id: 'view', label: g.status === 'draft' ? 'Continue your proposal' : 'View your proposal',
        enabled: true, note: stateMeta(g.status).desc };
    }
    var state = membershipState(g.id);
    if (state === 'active') {
      return isReadOnly(g)
        ? { id: 'open', label: 'Open the archive', enabled: true,
            note: 'Read-only. Everything is here to read; nothing new can be added.' }
        : { id: 'open', label: 'Open Group Home', enabled: true };
    }
    if (state === 'requested') return { id: 'pending', label: 'Request pending', enabled: false,
      note: 'A steward is reviewing your request. You can withdraw it from your dashboard.' };
    if (state === 'waitlisted') return { id: 'waitlisted', label: 'Waitlisted', enabled: false,
      note: 'You are on the waitlist. You will hear when a place opens.' };
    if (state === 'banned' || state === 'removed') return { id: 'blocked', label: 'View only', enabled: false,
      note: 'You cannot rejoin this Group.' };

    var inv = invitationFor(g.id);
    if (inv) {
      return inv.kind === 'direct'
        ? { id: 'accept', label: 'Accept invitation', enabled: true,
            note: 'Accepting makes you a Member straight away.' }
        : { id: 'apply', label: 'Respond to invitation to apply', enabled: true,
            note: 'This invitation opens Request Access — a steward still reviews it.' };
    }

    if (isGuest()) return { id: 'signup', label: 'Sign up to take part', enabled: true,
      note: 'You can read the public details now. Joining needs a LiF profile.' };

    if (g.status === 'forming') return { id: 'follow', label: 'Follow to be told when it opens', enabled: true,
      note: g.statusNote || 'Requests open once setup is complete.' };
    if (g.status === 'paused') return { id: 'follow', label: 'Follow', enabled: true,
      note: g.statusNote || 'Paused. New requests are held until it resumes.' };
    if (g.status === 'closing') return { id: 'view', label: 'View only', enabled: false,
      note: 'This Group is closing. New joining is restricted.' };
    if (g.status === 'archived') return { id: 'view', label: 'View archive', enabled: true,
      note: 'Read-only. Nothing new can be added.' };

    if (g.access.joinMethod === 'invitation') return { id: 'invite-only', label: 'Invitation only', enabled: false,
      note: g.access.instructions || 'This Group grows by invitation from people already in it.' };

    return { id: 'request', label: isFull(g) ? 'Join the waitlist' : 'Request Access', enabled: true,
      note: isFull(g) ? 'This Group is full — requests join the waitlist.' : null };
  }

  /* ===========================================================
   * 6. PARTICIPATION PATHWAYS
   * ========================================================= */

  /** §5.2 step 1-2: open a request with the Group's own questions. */
  function requestAccess(groupId, answers) {
    var g = get(groupId);
    if (!g) return null;
    var s = store.read();
    s.requests[groupId] = {
      groupId: groupId,
      at: new Date().toISOString(),
      answers: answers || {},
      status: isFull(g) ? 'waitlist' : 'pending',
      reviewerNote: '',
      decidedAt: null,
      history: [{ at: new Date().toISOString(), what: 'Request submitted' }]
    };
    store.write(s);

    store.queue({
      kind: 'message', to: memberName(), groupId: groupId,
      trigger: 'access-request-submitted', audience: 'requester', template: 'group-request-received',
      subject: 'Your request to join ' + g.name,
      body: 'Request Pending. You can withdraw it while it is open. Stewards see: ' + (g.access.sharedInfoNote || 'your public profile and your answers') + '.'
    });
    store.queue({
      kind: 'email', to: g.stewards.map(function (x) { return x.name; }).join(', '), groupId: groupId,
      trigger: 'access-request-submitted', audience: 'stewards-with-approve-capability',
      template: 'group-request-for-review',
      subject: 'Access request: ' + g.name,
      body: 'One request waiting. Approve, More Information Needed, Waitlist or Decline.'
    });
    store.notify({
      title: 'Request sent to ' + g.name,
      body: 'A steward reviews it and comes back with a reason and a next action either way.',
      link: { type: 'group', id: groupId }
    });
    return s.requests[groupId];
  }

  function withdrawRequest(groupId) {
    var s = store.read();
    if (!s.requests[groupId]) return false;
    delete s.requests[groupId];
    store.write(s);
    return true;
  }

  /** §5.2 step 4-5: the reviewer's four outcomes. Reviewer-only
      notes stay out of everything the requester can see. */
  function decideRequest(groupId, decision, memberFacingReason, privateNote) {
    var g = get(groupId);
    var s = store.read();
    var req = s.requests[groupId];
    if (!g || !req) return null;

    req.status = decision;
    req.reviewerNote = memberFacingReason || '';
    req.privateNote = privateNote || '';        // never rendered to the requester
    req.decidedAt = new Date().toISOString();
    req.history.push({ at: req.decidedAt, what: 'Reviewer chose ' + decision });
    store.write(s);

    if (decision === 'approve') {
      createMembership(groupId, 'member', { via: 'request' });
    }

    var next = {
      approve: 'Open Group Home and see what is alive now.',
      'more-info': 'Answer the steward’s question and your request continues.',
      waitlist: 'Nothing to do. You will hear when a place opens.',
      decline: 'You may ask again later, or explore related Groups.'
    }[decision];

    store.queue({
      kind: 'message', to: memberName(), groupId: groupId,
      trigger: 'access-request-decided', audience: 'requester', template: 'group-request-' + decision,
      subject: g.name + ': ' + (LIF.ACCESS_DECISIONS.find(function (d) { return d.id === decision; }) || {}).name,
      body: (memberFacingReason || '') + ' Next: ' + next
    });
    return req;
  }

  /** §5.1: an invitation carrying direct-access authority creates
      the membership on acceptance. Everything else opens Request
      Access - which is the whole point of the two kinds. */
  function acceptInvitation(inviteId) {
    var s = store.read();
    var inv = s.invitations[inviteId];
    if (!inv || inv.state !== 'pending') return null;
    var g = get(inv.groupId);
    if (!g) return null;

    if (inv.kind !== 'direct') {
      inv.state = 'opened-request';
      store.write(s);
      return { openedRequestAccess: true, group: g };
    }

    inv.state = 'accepted';
    store.write(s);
    createMembership(inv.groupId, inv.role || 'member', { via: 'direct-invitation', from: inv.fromName });
    return { joined: true, group: g };
  }

  function declineInvitation(inviteId) {
    var s = store.read();
    if (!s.invitations[inviteId]) return false;
    s.invitations[inviteId].state = 'declined';
    store.write(s);
    return true;
  }

  /** §5.1 step 3-4 and §16's volume safeguard: one membership
      record, notification defaults applied and SHOWN, welcome sent. */
  function createMembership(groupId, role, meta) {
    var g = get(groupId);
    if (!g) return null;
    var s = store.read();

    var notify = {};
    LIF.GROUP_NOTIFY_CATEGORIES.forEach(function (c) {
      /* Deliberately not everything-on. Joining must not silently
         subscribe a Member to every message in the Group. */
      notify[c.id] = (c.id === 'announcements' || c.id === 'replies' || c.id === 'membership')
        ? 'immediate' : (c.id === 'chat' ? 'off' : 'weekly');
    });

    s.memberships[groupId] = {
      groupId: groupId,
      state: 'active',
      role: role || 'member',
      caps: [],
      joinedAt: new Date().toISOString(),
      via: (meta && meta.via) || 'request',
      notify: notify,
      muted: false
    };
    delete s.requests[groupId];
    s.follows = s.follows.filter(function (id) { return id !== groupId; });
    store.write(s);
    g.memberCount += 1;

    store.queue({
      kind: 'email', to: memberEmail(), groupId: groupId,
      trigger: 'membership-created', audience: 'new-member', template: 'group-welcome-email',
      subject: 'Welcome to ' + g.name,
      body: 'The Group-designed welcome email: what the Group is here for, what is alive now, where to begin, and how your notifications are currently set.'
    });
    store.queue({
      kind: 'message', to: memberName(), groupId: groupId,
      trigger: 'membership-created', audience: 'new-member', template: 'group-welcome-message',
      subject: 'Welcome to ' + g.name,
      body: 'My Playground welcome message, with the Customize and Mute routes for Group notifications.'
    });
    store.notify({
      title: 'Welcome to ' + g.name,
      body: 'You are a Member. Your notifications start on a light setting — you can change them any time.',
      link: { type: 'group', id: groupId }
    });
    return s.memberships[groupId];
  }

  /* §18: leaving, with the consequences shown before it happens. */
  function leaveConsequences(groupId) {
    var g = get(groupId);
    if (!g) return [];
    var out = [
      'You lose access to this Group’s Areas and anything shared only inside it.',
      'Group notifications stop. Nothing else in your Playground changes.'
    ];
    if (g.areas.events) out.push('Registrations you already hold for this Group’s Events are kept — leaving a Group does not cancel an Event place.');
    out.push('Collaborative work stays with the Group under its disclosed agreement. Anything you contributed that is independently yours stays yours, and you keep control of continued sharing.');
    if (isCreator(g) && lastAdmin(g)) {
      out.push('You are the last accountable Group Admin. Another Admin has to be in place, or LiF recovery started, before you can leave.');
    }
    if (g.access.joinMethod === 'invitation' || g.access.discoverability === 'private') {
      out.push('This Group is invitation only, so rejoining needs a new invitation.');
    }
    return out;
  }

  /** §10: "The last accountable Group Admin cannot be removed until
      replacement or LiF recovery is established." */
  function lastAdmin(g) {
    var admins = (g.stewards || []).filter(function (s) { return s.role === 'admin'; });
    return admins.length <= 1 && admins.some(function (s) { return s.memberId === memberId(); });
  }

  function leaveGroup(groupId, reason) {
    var g = get(groupId);
    if (!g) return { ok: false };
    if (lastAdmin(g)) {
      return { ok: false, blocked: 'last-admin',
        message: 'You are the last accountable Group Admin. Name a replacement or ask LiF to start recovery first — the Group cannot be left without stewardship.' };
    }
    var s = store.read();
    if (!s.memberships[groupId]) return { ok: false };
    s.memberships[groupId].state = 'left';
    s.memberships[groupId].leftAt = new Date().toISOString();
    if (reason) s.memberships[groupId].leftReason = reason;
    store.write(s);
    g.memberCount = Math.max(0, g.memberCount - 1);

    store.queue({
      kind: 'audit', to: 'Group audit record', groupId: groupId,
      trigger: 'membership-left', audience: 'stewards', template: 'group-membership-left',
      subject: memberName() + ' left ' + g.name,
      body: 'Membership state set to Left. An audit record is retained; the reason, if given, is optional and private.'
    });
    return { ok: true };
  }

  function rejoinAllowed(groupId) {
    var m = membership(groupId);
    if (!m) return true;
    return m.state !== 'banned' && m.state !== 'removed';
  }

  function toggleFollow(groupId) {
    var s = store.read();
    var i = s.follows.indexOf(groupId);
    if (i === -1) s.follows.push(groupId); else s.follows.splice(i, 1);
    store.write(s);
    return i === -1;
  }
  function isFollowing(groupId) { return store.read().follows.indexOf(groupId) !== -1; }

  /* ===========================================================
   * 7. PARTICIPATION INSIDE A GROUP
   * ========================================================= */
  function threads(groupId) { return store.read().threads[groupId] || []; }
  function createThread(groupId, title, body) {
    var s = store.read();
    s.threads[groupId] = s.threads[groupId] || [];
    var t = {
      id: 'thr-' + groupId + '-' + (s.threads[groupId].length + 1),
      title: title, author: memberName(), at: new Date().toISOString(),
      following: true,
      posts: [{ author: memberName(), text: body, at: new Date().toISOString(), reactions: 0, edited: false }]
    };
    s.threads[groupId].unshift(t);
    store.write(s);
    return t;
  }
  function replyToThread(groupId, threadId, text) {
    var s = store.read();
    var t = (s.threads[groupId] || []).find(function (x) { return x.id === threadId; });
    if (!t) return null;
    t.posts.push({ author: memberName(), text: text, at: new Date().toISOString(), reactions: 0, edited: false });
    store.write(s);
    return t;
  }
  /** §11.2: each thread has its own Follow/Mute, and muting a thread
      is not the same as muting the Group. */
  function toggleThreadFollow(groupId, threadId) {
    var s = store.read();
    var t = (s.threads[groupId] || []).find(function (x) { return x.id === threadId; });
    if (!t) return null;
    t.following = !t.following;
    store.write(s);
    return t.following;
  }
  function reactToPost(groupId, threadId, index) {
    var s = store.read();
    var t = (s.threads[groupId] || []).find(function (x) { return x.id === threadId; });
    if (!t || !t.posts[index]) return null;
    t.posts[index].reactions = (t.posts[index].reactions || 0) + 1;
    store.write(s);
    return t.posts[index].reactions;
  }
  function editPost(groupId, threadId, index, text) {
    var s = store.read();
    var t = (s.threads[groupId] || []).find(function (x) { return x.id === threadId; });
    if (!t || !t.posts[index]) return null;
    t.posts[index].text = text;
    t.posts[index].edited = true;            // §11.2: edits show an edit state
    t.posts[index].editedAt = new Date().toISOString();
    store.write(s);
    return t.posts[index];
  }

  function chat(groupId) { return store.read().chat[groupId] || []; }
  function sendChat(groupId, text) {
    var s = store.read();
    s.chat[groupId] = s.chat[groupId] || [];
    s.chat[groupId].push({ author: memberName(), text: text, at: new Date().toISOString() });
    store.write(s);
    return s.chat[groupId];
  }

  function announcements(groupId) { return store.read().announcements[groupId] || []; }

  /** §12: only a role with publish-announcement may send, and the
      steward sees audience, channels, recipient count and preview
      BEFORE it goes. audiencePreview() is that screen's data. */
  function audiencePreview(groupId, audience) {
    var g = get(groupId);
    if (!g) return null;
    var recipients = audience === 'stewards' ? (g.stewards || []).length : g.memberCount;
    return {
      audience: audience || 'all-members',
      recipients: recipients,
      channels: 'My Playground and email, per each Member’s own settings',
      respectsPreferences: true,
      note: 'Members who muted this Group still receive essential membership, privacy, governance and safety notices — nothing else.'
    };
  }

  function publishAnnouncement(groupId, data) {
    var g = get(groupId);
    if (!g || !can(g, 'publish-announcement')) return null;
    var s = store.read();
    s.announcements[groupId] = s.announcements[groupId] || [];
    var a = {
      id: 'ann-' + groupId + '-' + (s.announcements[groupId].length + 1),
      title: data.title, body: data.body,
      audience: data.audience || 'all-members',
      pinned: !!data.pinned,
      by: memberName(), at: new Date().toISOString()
    };
    s.announcements[groupId].unshift(a);
    store.write(s);

    var prev = audiencePreview(groupId, a.audience);
    store.queue({
      kind: 'email', to: prev.recipients + ' recipients', groupId: groupId,
      trigger: 'announcement-published', audience: a.audience, template: 'group-announcement',
      subject: '[' + g.name + '] ' + a.title,
      body: 'Delivered per each Member’s notification settings. ' + prev.note
    });
    return a;
  }

  /* §12: a Call for Engagement is structured so it can be searched
     and acted on, not a paragraph in a thread. */
  function calls(groupId) { return store.read().calls[groupId] || []; }
  function createCall(groupId, data) {
    var s = store.read();
    s.calls[groupId] = s.calls[groupId] || [];
    var c = Object.assign({
      id: 'call-' + groupId + '-' + (s.calls[groupId].length + 1),
      by: memberName(), at: new Date().toISOString(), responses: []
    }, data);
    s.calls[groupId].unshift(c);
    store.write(s);
    return c;
  }
  function respondToCall(groupId, callId, text) {
    var s = store.read();
    var c = (s.calls[groupId] || []).find(function (x) { return x.id === callId; });
    if (!c) return null;
    c.responses.push({ by: memberName(), text: text, at: new Date().toISOString() });
    store.write(s);
    return c;
  }

  /* §13: a Resource has its own audience. A public Group does not
     make every Resource public. */
  function resources(groupId) { return store.read().resources[groupId] || []; }
  function addResource(groupId, data) {
    var s = store.read();
    s.resources[groupId] = s.resources[groupId] || [];
    var r = Object.assign({
      id: 'gres-' + groupId + '-' + (s.resources[groupId].length + 1),
      by: memberName(), at: new Date().toISOString(),
      audience: 'group',                       // group | stewards | public-pending-review
      storage: 'playground',                   // playground | workspace | external
      linkHealth: 'ok'
    }, data);
    s.resources[groupId].unshift(r);
    store.write(s);
    return r;
  }
  /** §13: publishing to the shared Library is a separate reviewed
      pathway, not a visibility toggle. */
  function proposeResourceToLibrary(groupId, resourceId) {
    var s = store.read();
    var r = (s.resources[groupId] || []).find(function (x) { return x.id === resourceId; });
    if (!r) return null;
    r.audience = 'public-pending-review';
    store.write(s);
    store.queue({
      kind: 'workspace', to: 'LiF Library reviewers', groupId: groupId,
      trigger: 'library-publication-proposed', audience: 'lif-reviewers', template: 'library-review',
      subject: 'Library review: ' + r.title,
      body: 'Publication to the shared Resources Library is a separate reviewed pathway. Group visibility is unchanged until it is approved.'
    });
    return r;
  }

  function activities(groupId) { return store.read().activities[groupId] || []; }
  function addActivity(groupId, title) {
    var s = store.read();
    s.activities[groupId] = s.activities[groupId] || [];
    var a = { id: 'act-' + groupId + '-' + (s.activities[groupId].length + 1),
              title: title, state: 'open', assignee: null, at: new Date().toISOString() };
    s.activities[groupId].push(a);
    store.write(s);
    return a;
  }
  function cycleActivity(groupId, activityId) {
    var s = store.read();
    var a = (s.activities[groupId] || []).find(function (x) { return x.id === activityId; });
    if (!a) return null;
    a.state = { open: 'doing', doing: 'done', done: 'open' }[a.state];
    store.write(s);
    return a.state;
  }

  /* §14: Group Events. The Group relationship is prefilled and the
     shared Events pathway does the rest - there is deliberately no
     group-specific registration, reminder or payment code here. */
  function groupEvents(g) {
    if (!g || !LIF.events) return [];
    return LIF.EVENTS.filter(function (e) {
      var byHost = e.hostDetail && e.hostDetail.groupId === g.id;
      var byLink = (g.connections.events || []).indexOf(e.id) !== -1;
      return (byHost || byLink) && LIF.events.canSee(e);
    });
  }

  /* §12: stewards are periodically asked to confirm activity. If
     they do not, the Group shows Quiet rather than being recommended
     as Active. This is the check that decides. */
  function activityStale(g) {
    var days = (Date.now() - new Date(g.activityConfirmedAt || g.updatedAt)) / 86400000;
    return days > 45;
  }
  function confirmActivity(groupId, plan) {
    var g = get(groupId);
    if (!g) return null;
    g.activityConfirmedAt = new Date().toISOString();
    g.updatedAt = g.activityConfirmedAt;
    if (plan != null) g.activityPlan = plan;
    if (g.status === 'quiet') g.status = 'active';
    document.dispatchEvent(new CustomEvent('lif:groupschange'));
    return g;
  }

  /* §16: the effective setting, which the Member must always be able
     to find. Global default, then Group override, then thread. */
  function effectiveNotification(groupId, category) {
    var m = membership(groupId);
    var global = (LIF.MEMBER && LIF.MEMBER.notifications.features.groups === false) ? 'off' : 'on';
    if (global === 'off') return { value: 'off', source: 'Your global Groups setting is off' };
    if (m && m.muted) return { value: 'off', source: 'You muted this Group' };
    if (m && m.notify && m.notify[category]) return { value: m.notify[category], source: 'This Group’s setting' };
    return { value: 'weekly', source: 'Your global default' };
  }
  function setGroupNotification(groupId, category, value) {
    var s = store.read();
    if (!s.memberships[groupId]) return null;
    s.memberships[groupId].notify[category] = value;
    store.write(s);
    return value;
  }
  function toggleMute(groupId) {
    var s = store.read();
    if (!s.memberships[groupId]) return null;
    s.memberships[groupId].muted = !s.memberships[groupId].muted;
    store.write(s);
    return s.memberships[groupId].muted;
  }

  /* §17: reports route by category and severity, and never only to
     the person reported or a close-role peer. */
  function report(groupId, category, note, about) {
    var s = store.read();
    var cat = LIF.REPORT_CATEGORIES.find(function (c) { return c.id === category; }) || {};
    var r = {
      id: 'rep-' + (s.reports.length + 1),
      groupId: groupId, category: category, note: note, about: about || null,
      at: new Date().toISOString(), state: 'received',
      route: cat.urgent ? 'LiF safety team — urgent escalation' : 'LiF Group Steward, with Group Admins copied where appropriate'
    };
    s.reports.unshift(r);
    store.write(s);
    store.queue({
      kind: 'message', to: memberName(), groupId: groupId,
      trigger: 'report-received', audience: 'reporter', template: 'report-received',
      subject: 'We have your report',
      body: 'Status: Received. Routed to ' + r.route + '. You will see Received, More Information Needed, Reviewing, Escalated or Resolved — never confidential case detail.'
    });
    return r;
  }
  function myReports() { return store.read().reports; }

  /* §15: Connect and Collaborate at launch. Merge is defined in the
     data model so it can be added later, and refused for now. */
  function relate(groupId, otherId, kind) {
    var g = get(groupId), other = get(otherId);
    if (!g || !other) return null;
    if (kind === 'merge') {
      return { ok: false, message: 'Merge needs each Group’s documented consent process and LiF technical and safety review. Connect Groups is the launch pathway; merge requirements are held in the data model for later.' };
    }
    store.queue({
      kind: 'message', to: other.stewards.map(function (s) { return s.name; }).join(', '), groupId: groupId,
      trigger: 'group-relationship-proposed', audience: 'other-group-stewards', template: 'group-connect-proposal',
      subject: g.name + ' would like to ' + kind + ' with ' + other.name,
      body: 'Consent-based. ' + other.name + ' decides whether to proceed. Neither Group dissolves and no content moves.'
    });
    return { ok: true, message: 'Proposed. ' + other.name + '’s stewards decide whether to accept — LiF does not decide it for them.' };
  }

  /* --- read tracking, for "what is new since your last visit" --- */
  function markRead(groupId) {
    var s = store.read();
    s.reads[groupId] = new Date().toISOString();
    store.write(s);
  }
  function newSince(groupId) {
    var since = store.read().reads[groupId];
    if (!since) return 0;
    var t = new Date(since).getTime();
    var n = 0;
    threads(groupId).forEach(function (th) {
      th.posts.forEach(function (p) { if (new Date(p.at).getTime() > t) n++; });
    });
    announcements(groupId).forEach(function (a) { if (new Date(a.at).getTime() > t) n++; });
    return n;
  }

  /* --- proposals (§6) --- */
  function nextProposalId() {
    var s = store.read();
    return 'grp-prop-' + (Object.keys(s.proposals).length + Object.keys(s.drafts).length + 2);
  }
  function mintGroupId() {
    var year = new Date().getFullYear();
    var used = LIF.GROUPS.map(function (g) { return g.groupRef; })
      .filter(function (x) { return x && x.indexOf('LIFG-' + year + '-') === 0; })
      .map(function (x) { return parseInt(x.split('-')[2], 10); })
      .filter(function (n) { return !isNaN(n); });
    var next = (used.length ? Math.max.apply(null, used) : 0) + 1;
    return 'LIFG-' + year + '-' + String(next).padStart(3, '0');
  }
  function saveDraft(p) {
    var s = store.read();
    p.id = p.id || nextProposalId();
    p.status = 'draft';
    p.updatedAt = new Date().toISOString();
    s.drafts[p.id] = p;
    store.write(s);
    return p;
  }
  function getDraft(id) { return store.read().drafts[id] || null; }
  function drafts() {
    var d = store.read().drafts;
    return Object.keys(d).map(function (k) { return d[k]; });
  }
  function proposals() {
    var p = store.read().proposals;
    return Object.keys(p).map(function (k) { return p[k]; });
  }

  function submitProposal(p) {
    var s = store.read();
    p.id = p.id || nextProposalId();
    p.groupRef = p.groupRef || mintGroupId();
    p.status = 'pending';
    p.submittedAt = new Date().toISOString();
    p.proposedBy = { memberId: memberId(), name: memberName(), email: memberEmail() };
    s.proposals[p.id] = p;
    delete s.drafts[p.id];
    store.write(s);

    store.queue({
      kind: 'email', to: memberEmail(), groupId: p.id,
      trigger: 'group-proposal-submitted', audience: 'proposer', template: 'group-proposal-received',
      subject: 'Your Group proposal: ' + p.name,
      body: 'Pending Review, reference ' + p.groupRef + '. Next steps, your support contact and a status link are included. ' +
            'Review is for ecosystem awareness, orientation and connection with similar work — not gatekeeping.'
    });
    store.queue({
      kind: 'email', to: 'LiF Groups review', groupId: p.id,
      trigger: 'group-proposal-submitted', audience: 'lif-reviewers', template: 'group-proposal-review',
      subject: 'Group proposal for review: ' + p.name,
      body: 'Automated checks flag completeness, duplicate names and possible overlap. A human steward makes the relational decision.'
    });
    store.notify({
      feature: 'groups',
      title: 'Your Group proposal is with LiF',
      body: p.name + ' was submitted as ' + p.groupRef + '. Status: Pending Review.',
      link: { type: 'group-proposal', id: p.id }
    });

    var g = proposalToGroup(p);
    if (g && !get(g.id)) LIF.GROUPS.push(g);
    return p;
  }

  /** Automated checks (§7). They flag, they never decide. */
  function proposalChecks(p) {
    var out = [];
    var name = (p.name || '').trim().toLowerCase();
    if (name) {
      var dupe = LIF.GROUPS.find(function (g) { return g.name.toLowerCase() === name; });
      if (dupe) out.push({ level: 'warn', text: 'A Group called “' + dupe.name + '” already exists. A steward will look at whether these are the same thing.' });
    }
    var overlap = LIF.GROUPS.filter(function (g) {
      return g.sector === p.sector && g.subsector && g.subsector === p.subsector && !isProposalState(g);
    });
    if (overlap.length) {
      out.push({ level: 'info', text: overlap.length + ' existing Group' + (overlap.length === 1 ? '' : 's') +
        ' work in ' + p.subsector + ': ' + overlap.map(function (g) { return g.name; }).join(', ') +
        '. A reviewer may suggest connecting rather than starting fresh — the choice stays yours.' });
    }
    return out;
  }

  function proposalToGroup(p) {
    var rec = (LIF.GROUP_STRUCTURES.find(function (s) { return s.id === p.structure; }) || {}).areas || [];
    var areas = {};
    LIF.GROUP_AREAS.forEach(function (a) {
      areas[a.id] = a.core || (p.areas ? p.areas.indexOf(a.id) !== -1 : rec.indexOf(a.id) !== -1);
    });
    return {
      id: 'grp-' + String(p.groupRef).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      groupRef: p.groupRef,
      slug: (p.name || 'group').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      isMine: true,
      name: p.name, description: p.cardSummary || p.description,
      purpose: p.purpose, whoFor: p.whoFor, activityPlan: p.activityPlan || '',
      lastUpdate: null,
      sector: p.sector, subsector: p.subsector || '', tags: p.tags || [],
      structure: p.structure, status: p.status,
      statusNote: p.status === 'pending'
        ? 'Submitted to LiF. Not yet an active Group — only you can see this.'
        : 'Being prepared. Visible only to you.',
      format: p.format, location: p.location || null,
      languages: p.languages || { primary: 'English', supported: [] },
      accessibility: p.accessibility || { notes: '', contact: 'accessibility@loveisfoundation.org' },
      access: {
        discoverability: p.discoverability, joinMethod: p.joinMethod,
        instructions: p.accessInstructions || '', questions: p.accessQuestions || [],
        sharedInfoNote: p.sharedInfoNote || 'Stewards see your Playground Name, your public profile fields and your answers.',
        allowInvites: p.allowInvites !== false
      },
      countDisplay: p.countDisplay || 'exact',
      capacity: p.capacity || null,
      memberCount: 1 + ((p.initialMembers || []).length),
      stewards: [{ memberId: memberId(), name: memberName(), role: 'admin', public: true }]
        .concat((p.stewards || []).map(function (s) {
          return { memberId: null, name: s.name, role: s.role || 'moderator', public: true };
        })),
      areas: areas,
      agreements: p.agreements || [],
      participation: p.participation || '',
      connections: { groups: p.relatedGroups || [], events: p.originEventId ? [p.originEventId] : [], organizations: [] },
      originEventId: p.originEventId || null,
      createdAt: p.submittedAt || new Date().toISOString(),
      updatedAt: p.submittedAt || new Date().toISOString(),
      activityConfirmedAt: p.submittedAt || new Date().toISOString()
    };
  }

  /* §7: approval creates the record, confirms stewardship and shows
     the creator the remaining activation tasks before it goes live. */
  function activationTasks(g) {
    var out = [];
    if (!g) return out;
    var admins = (g.stewards || []).filter(function (s) { return s.role === 'admin'; });
    if (admins.length < 2) out.push({ id: 'second-admin', label: 'Name a second Group Admin', why: 'So the Group is never left without accountable stewardship.' });
    if (!g.agreements.length) out.push({ id: 'agreements', label: 'Write your Group agreements', why: 'Shown before anyone joins.' });
    if (!g.activityPlan) out.push({ id: 'plan', label: 'Set what is alive now', why: 'The first thing a new Member reads on Group Home.' });
    if (!g.access.questions.length && g.access.joinMethod === 'request') {
      out.push({ id: 'questions', label: 'Add your Request Access questions', why: 'What you want to know before saying yes.' });
    }
    return out;
  }

  function coverCss(g) {
    var stops = (LIF.SECTOR_COVERS && LIF.SECTOR_COVERS[g.sector]) || ['#755091', '#C89CD8'];
    if (g.image) return 'url(' + g.image + ') center/cover';
    return 'linear-gradient(135deg, ' + stops[0] + ' 0%, ' + stops[1] + ' 100%)';
  }

  return {
    /* identity */
    memberId: memberId, memberName: memberName, preferredName: preferredName, memberEmail: memberEmail,
    isGuest: isGuest, iAmHereComplete: iAmHereComplete,
    /* lookups */
    all: all, get: get, stateMeta: stateMeta, structureMeta: structureMeta,
    isProposalState: isProposalState, isReadOnly: isReadOnly,
    /* visibility */
    canDiscover: canDiscover, canSeeDetails: canSeeDetails, canParticipate: canParticipate,
    isCreator: isCreator, isSteward: isSteward, can: can,
    /* membership */
    membership: membership, membershipState: membershipState, isMember: isMember,
    myGroups: myGroups, myFollows: myFollows, myRequests: myRequests, myInvitations: myInvitations,
    invitationFor: invitationFor,
    /* discovery */
    exploreGroups: exploreGroups, recommendable: recommendable, filter: filter,
    matchReasons: matchReasons, suggested: suggested, distanceKm: distanceKm,
    countLabel: countLabel, capacityNote: capacityNote, isFull: isFull, primaryAction: primaryAction,
    /* pathways */
    requestAccess: requestAccess, withdrawRequest: withdrawRequest, decideRequest: decideRequest,
    acceptInvitation: acceptInvitation, declineInvitation: declineInvitation,
    createMembership: createMembership,
    leaveConsequences: leaveConsequences, leaveGroup: leaveGroup, lastAdmin: lastAdmin,
    rejoinAllowed: rejoinAllowed, toggleFollow: toggleFollow, isFollowing: isFollowing,
    /* participation */
    threads: threads, createThread: createThread, replyToThread: replyToThread,
    toggleThreadFollow: toggleThreadFollow, reactToPost: reactToPost, editPost: editPost,
    chat: chat, sendChat: sendChat,
    announcements: announcements, publishAnnouncement: publishAnnouncement, audiencePreview: audiencePreview,
    calls: calls, createCall: createCall, respondToCall: respondToCall,
    resources: resources, addResource: addResource, proposeResourceToLibrary: proposeResourceToLibrary,
    activities: activities, addActivity: addActivity, cycleActivity: cycleActivity,
    groupEvents: groupEvents,
    activityStale: activityStale, confirmActivity: confirmActivity,
    /* notifications, care, relationships */
    effectiveNotification: effectiveNotification, setGroupNotification: setGroupNotification,
    toggleMute: toggleMute, report: report, myReports: myReports, relate: relate,
    markRead: markRead, newSince: newSince,
    /* proposals */
    saveDraft: saveDraft, getDraft: getDraft, drafts: drafts, proposals: proposals,
    submitProposal: submitProposal, proposalChecks: proposalChecks, proposalToGroup: proposalToGroup,
    nextProposalId: nextProposalId, mintGroupId: mintGroupId, activationTasks: activationTasks,
    coverCss: coverCss
  };
})();

/* ===============================================================
 * 6. SEED
 * The demo profile says this member belongs to grp-1 and grp-5.
 * Until the store agrees, My Groups and the Group pages would
 * disagree about the same fact. Seeded once, along with one
 * pending request, one direct-access invitation and one
 * invitation-to-apply, so all three entry states are visible.
 * ============================================================= */
(function seedGroups() {
  var s = LIF.groupStore.read();
  if (s.seeded) return;
  s.seeded = true;

  var joined = (LIF.MEMBER && LIF.MEMBER.groups.registered) ||
    (LIF.CURRENT_MEMBER && LIF.CURRENT_MEMBER.groupIds) || [];

  joined.forEach(function (id, i) {
    var g = LIF.groups.get(id);
    if (!g || s.memberships[id]) return;
    var notify = {};
    LIF.GROUP_NOTIFY_CATEGORIES.forEach(function (c) {
      notify[c.id] = (c.id === 'announcements' || c.id === 'replies' || c.id === 'membership') ? 'immediate' : 'weekly';
    });
    s.memberships[id] = {
      groupId: id, state: 'active',
      /* Steward of one of them, so the stewardship surfaces have
         somewhere real to appear. */
      role: i === 0 ? 'admin' : 'member',
      caps: [], joinedAt: '2026-03-04T09:00:00-08:00', via: 'request',
      notify: notify, muted: false
    };
  });

  /* The archived group this member created out of their own event. */
  if (LIF.groups.get('grp-12') && !s.memberships['grp-12']) {
    s.memberships['grp-12'] = { groupId: 'grp-12', state: 'active', role: 'admin', caps: [],
      joinedAt: '2026-08-08T09:00:00-07:00', via: 'creator', notify: {}, muted: false };
  }

  /* One request already waiting on a steward. */
  if (!s.requests['grp-2']) {
    s.requests['grp-2'] = {
      groupId: 'grp-2', at: '2026-08-18T10:00:00-07:00',
      answers: { why: 'I work alongside two interfaith councils and keep hearing about this circle.' },
      status: 'pending', reviewerNote: '', decidedAt: null,
      history: [{ at: '2026-08-18T10:00:00-07:00', what: 'Request submitted' }]
    };
  }

  /* One direct-access invitation (accepting makes you a Member) and
     one invitation to apply (accepting opens Request Access). The
     difference between these two is the whole of §5.3. */
  if (!Object.keys(s.invitations).length) {
    s.invitations['inv-1'] = {
      groupId: 'grp-10', kind: 'direct', role: 'member',
      fromName: 'Nadia Haddad',
      message: 'You held the room at the listening session without needing to be thanked for it. There is a place here if you want one.',
      at: '2026-08-19T18:00:00-07:00', state: 'pending'
    };
    s.invitations['inv-2'] = {
      groupId: 'grp-6', kind: 'apply',
      fromName: 'Diego Fernandez',
      message: 'We could use someone who has actually run a watershed budget. Worth applying.',
      at: '2026-08-20T09:30:00-07:00', state: 'pending'
    };
  }

  /* Enough conversation that Group Home is not an empty shell. */
  if (!Object.keys(s.threads).length) {
    s.threads['grp-1'] = [
      { id: 'thr-grp-1-1', title: 'Compost sourcing for Site B', author: 'Kwame Mensah',
        at: '2026-08-21T15:00:00-07:00', following: true,
        posts: [
          { author: 'Kwame Mensah', text: 'Soil results say we need roughly double what we budgeted. Anyone have a line on bulk compost that is not trucked across three counties?', at: '2026-08-21T15:00:00-07:00', reactions: 3, edited: false },
          { author: 'Mei Tanaka', text: 'The city yard does giveaway days in September. Not enough on its own but it would take the edge off.', at: '2026-08-21T18:20:00-07:00', reactions: 1, edited: false }
        ] },
      { id: 'thr-grp-1-2', title: 'Who is coming to the September site walk?', author: 'Alex Rivera',
        at: '2026-08-19T09:00:00-07:00', following: true,
        posts: [
          { author: 'Alex Rivera', text: 'Putting a rough headcount together. Boots, water, about three hours.', at: '2026-08-19T09:00:00-07:00', reactions: 5, edited: false }
        ] }
    ];
    s.threads['grp-5'] = [
      { id: 'thr-grp-5-1', title: 'The de-escalation module still needs a reviewer', author: 'Nadia Haddad',
        at: '2026-08-20T11:30:00-07:00', following: false,
        posts: [
          { author: 'Nadia Haddad', text: 'It is written but I am too close to it. Anyone who has run this with year nines, I would love your eyes.', at: '2026-08-20T11:30:00-07:00', reactions: 2, edited: false }
        ] }
    ];
  }

  if (!Object.keys(s.announcements).length) {
    s.announcements['grp-1'] = [
      { id: 'ann-grp-1-1', title: 'Site walk moved to the 12th', body: 'The 5th clashes with the watershed work morning. Same time, same meeting point.',
        audience: 'all-members', pinned: true, by: 'Alex Rivera', at: '2026-08-20T08:00:00-07:00' }
    ];
  }

  if (!Object.keys(s.resources).length) {
    s.resources['grp-1'] = [
      { id: 'gres-grp-1-1', title: 'Site B soil results (August)', url: 'https://example.org/docs/site-b-soil',
        kind: 'Document', audience: 'group', storage: 'workspace', linkHealth: 'ok', by: 'Kwame Mensah', at: '2026-08-21T15:10:00-07:00' },
      { id: 'gres-grp-1-2', title: 'Regenerative planting plan — spring draft', url: 'https://example.org/docs/planting-plan',
        kind: 'Plan', audience: 'group', storage: 'playground', linkHealth: 'ok', by: 'Alex Rivera', at: '2026-08-14T10:00:00-07:00' }
    ];
  }

  if (!Object.keys(s.calls).length) {
    s.calls['grp-4'] = [
      { id: 'call-grp-4-1', need: 'Two people who can drive a truck on Sept 6',
        timing: 'Sunday 6 September, 8am–12pm', where: 'Johnson Creek Restoration Site',
        format: 'in-person', route: 'Reply here or message Mei',
        closes: '2026-09-04', by: 'Mei Tanaka', at: '2026-08-22T08:35:00-07:00', responses: [] }
    ];
  }

  if (!Object.keys(s.activities).length) {
    s.activities['grp-1'] = [
      { id: 'act-grp-1-1', title: 'Finish the Site B drawings', state: 'doing', assignee: 'Alex Rivera', at: '2026-08-10T09:00:00-07:00' },
      { id: 'act-grp-1-2', title: 'Source compost', state: 'open', assignee: null, at: '2026-08-21T15:05:00-07:00' },
      { id: 'act-grp-1-3', title: 'Book the September site walk', state: 'done', assignee: 'Mei Tanaka', at: '2026-08-05T09:00:00-07:00' }
    ];
  }

  LIF.groupStore.write(s);
})();

/* Any Group proposal submitted in a previous session goes back onto
   the list so the dashboard and the Group page agree across a
   refresh - same approach the events pathway takes. */
(function rehydrateGroupProposals() {
  LIF.groups.proposals().forEach(function (p) {
    var g = LIF.groups.proposalToGroup(p);
    if (g && !LIF.groups.get(g.id)) LIF.GROUPS.push(g);
  });
})();
