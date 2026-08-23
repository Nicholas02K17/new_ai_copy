/**
 * data.js
 * ---------------------------------------------------------------
 * Placeholder "database". Every screen in the hub reads from the
 * LIF.* arrays below. When the real backend is ready, replace the
 * contents of this file with fetch() calls that hit your API and
 * populate the same shapes - nothing else in the app needs to change.
 * ---------------------------------------------------------------
 */

window.LIF = window.LIF || {};

/* ---------------------------------------------------------------
 * The Seven Aspects.
 * Names, pairing-words, and colors all come straight from the LiF
 * flower-of-life logo and its accompanying "interrelationship
 * synergies" notes: each aspect is one of the logo's seven circles,
 * and the hex colors in theme.css were pixel-sampled from that same
 * logo file, not guessed. "description" is a one-phrase distillation
 * of that aspect's notes, used as a hover tooltip on the aspect wheel.
 * The "chakra" field is just this aspect's own id again - it's kept
 * only because every component that builds a color-class name from
 * it (map pins, cards, badges, the modal) already expects a field
 * with that name; nothing here is actually about chakras anymore.
 * ------------------------------------------------------------- */
LIF.ASPECTS = [
  { id: 'source-resources',     name: 'Source - Resources',     tagline: 'Life', chakra: 'source-resources',
    description: 'Volunteers, funding, and resources in service of the whole.' },
  { id: 'divine-potential',     name: 'Divine Human Potential', tagline: null,   chakra: 'divine-potential',
    description: 'Unification of all aspects of being.' },
  { id: 'presence-being',       name: 'Presence - Being',       tagline: 'Me',   chakra: 'presence-being',
    description: 'Willing to pause and return to love.' },
  { id: 'engagement-communion', name: 'Engagement - Communion', tagline: 'We',   chakra: 'engagement-communion',
    description: 'A collaborative convening platform for shared discovery.' },
  { id: 'nature-nurture',       name: 'Nature - Nurture',       tagline: null,   chakra: 'nature-nurture',
    description: 'The whole Earth is a sacred site.' },
  { id: 'community-inclusion',  name: 'Community - Inclusion',  tagline: 'Us',   chakra: 'community-inclusion',
    description: 'Inclusive, shared space - no barriers based on money.' },
  { id: 'service-offerings',    name: 'Services - Offerings',   tagline: 'Flow', chakra: 'service-offerings',
    description: 'Courses, trainings, and offerings that flow from source to form.' }
];

/* ---------------------------------------------------------------
 * The 12 sectors / areas of interest.
 * Pulled from the actual copy_map categorydata (your production
 * category tree) rather than re-inventing shorter labels, so this
 * stays consistent with what's already live.
 * ------------------------------------------------------------- */
LIF.SECTORS = [
  { id: 'spirituality',   name: 'Spirituality & Religion' },
  { id: 'science',        name: 'Science & Technology' },
  { id: 'relations',      name: 'Relations & Peace' },
  { id: 'media',          name: 'Media & Communication' },
  { id: 'justice',        name: 'Justice & Restoration' },
  { id: 'infrastructure', name: 'Infrastructure & Resources' },
  { id: 'health',         name: 'Health & Wellbeing' },
  { id: 'governance',     name: 'Governance & Community' },
  { id: 'environment',    name: 'Environment, Food & Water' },
  { id: 'education',      name: 'Education & Learning' },
  { id: 'economics',      name: 'Economics & Business' },
  { id: 'arts',           name: 'Arts & Culture' }
];

LIF.FORMATS = [
  { id: 'in-person', name: 'In Person' },
  { id: 'online',    name: 'Online' },
  { id: 'hybrid',    name: 'Hybrid' }
];

LIF.EVENT_TYPES = [
  { id: 'workshop',   name: 'Workshop' },
  { id: 'discussion', name: 'Discussion' },
  { id: 'meetup',     name: 'Meetup' },
  { id: 'networking', name: 'Networking' },
  { id: 'activity',   name: 'Activity' }
];

LIF.COMMITMENTS = [
  { id: 'one-time',         name: 'One-Time Event' },
  { id: 'multiple-sessions',name: 'Multiple Sessions' },
  { id: 'ongoing',          name: 'Ongoing' }
];

LIF.COSTS = [
  { id: 'donation',      name: 'Donation' },
  { id: 'free',          name: 'Free' },
  { id: 'sliding-scale', name: 'Sliding Scale' }
];

LIF.LANGUAGES = ['English', 'Spanish', 'French', 'Arabic', 'Hindi', 'Mandarin', 'Urdu', 'Other'];

LIF.DURATIONS = [
  { id: 'upto-1h', name: 'Up to 1 Hour', maxMinutes: 60 },
  { id: '2h',      name: '2 Hours',      maxMinutes: 120 },
  { id: '3h',      name: '3 Hours',      maxMinutes: 180 },
  { id: 'half-day',name: 'Half Day',     maxMinutes: 300 },
  { id: 'full-day',name: 'Full Day',     maxMinutes: 600 }
];

LIF.RADII_KM = [5, 10, 25, 50, 100];

/* ---------------------------------------------------------------
 * Sample / test events.
 * evt-001 is the specific "test event" - the rest exist so the map,
 * filters, and calendar have enough variety to actually demonstrate
 * the filtering logic. Swap this whole array for your API response
 * whenever the backend is ready; the shape is the contract.
 * ------------------------------------------------------------- */
LIF.EVENTS = [
  {
    id: 'evt-001',
    isTestEvent: true,
    title: 'Global Co-Creation Circle',
    summary: 'A heart-centered gathering for LiF co-creators to connect and explore new collaborations.',
    description: 'A heart-centered gathering for LiF co-creators to connect, share what they\'re building, and explore new collaborations. Open to members and friends of the ecosystem - come as you are, leave with a few new threads to pull on.',
    aspect: 'engagement-communion',
    sector: 'relations',
    subsector: 'Partnership',
    format: 'hybrid',
    type: 'networking',
    start: '2026-08-30T16:00:00-07:00',
    end: '2026-08-30T18:00:00-07:00',
    durationLabel: '2 Hours',
    commitment: 'one-time',
    cost: 'free',
    language: 'English',
    location: { venue: 'Sedona Creative Life Center', city: 'Sedona', region: 'Arizona', country: 'USA', lat: 34.8697, lng: -111.7610 },
    onlineLink: 'https://example.org/join/global-cocreation-circle',
    host: 'Love is Foundation',
    organization: null,
    visibility: 'public',
    capacity: 60,
    registered: 24,
    tags: ['co-creation', 'community', 'connection']
  },
  {
    id: 'evt-002',
    title: 'Money as Love: Exploring Enoughness',
    summary: 'A workshop unpacking the LiF Enoughness frame and the Money as Love app.',
    description: 'What changes when we treat money as a form of love rather than a source of fear? This workshop unpacks the LiF Enoughness frame and walks through the Money as Love app, with time for questions and small-group reflection.',
    aspect: 'source-resources',
    sector: 'economics',
    subsector: 'Caring economy',
    format: 'online',
    type: 'workshop',
    start: '2026-09-04T10:00:00-07:00',
    end: '2026-09-04T11:30:00-07:00',
    durationLabel: '90 Minutes',
    commitment: 'one-time',
    cost: 'sliding-scale',
    language: 'English',
    location: null,
    onlineLink: 'https://example.org/join/money-as-love',
    host: 'Love is Foundation',
    organization: null,
    visibility: 'public',
    capacity: 100,
    registered: 47,
    tags: ['enoughness', 'money-as-love', 'economics']
  },
  {
    id: 'evt-003',
    title: 'Regenerative Living Design Lab',
    summary: 'A full-day, hands-on lab in regenerative design at Findhorn Ecovillage.',
    description: 'A full-day, hands-on lab exploring regenerative design principles - soil, water, energy, and community - hosted at Findhorn Ecovillage. Bring boots you don\'t mind getting muddy.',
    aspect: 'nature-nurture',
    sector: 'environment',
    subsector: 'Regenerative',
    format: 'in-person',
    type: 'workshop',
    start: '2026-09-12T09:00:00+01:00',
    end: '2026-09-12T17:00:00+01:00',
    durationLabel: 'Full Day',
    commitment: 'one-time',
    cost: 'donation',
    language: 'English',
    location: { venue: 'Findhorn Ecovillage', city: 'Findhorn', region: 'Moray', country: 'Scotland, UK', lat: 57.6552, lng: -3.6088 },
    onlineLink: null,
    host: 'Love is Foundation',
    organization: null,
    visibility: 'public',
    capacity: 30,
    registered: 18,
    tags: ['regenerative', 'ecovillage', 'land']
  },
  {
    id: 'evt-004',
    title: 'Sacred Feminine Storytelling Circle',
    summary: 'A weekly online circle for sharing stories through the lens of the sacred feminine.',
    description: 'A weekly online circle where members share personal stories through the lens of the sacred feminine. Held in Spanish. New faces always welcome - just listen the first time if that feels right.',
    aspect: 'divine-potential',
    sector: 'arts',
    subsector: 'Performance',
    format: 'online',
    type: 'discussion',
    start: '2026-09-06T17:00:00-07:00',
    end: '2026-09-06T18:00:00-07:00',
    durationLabel: 'Up to 1 Hour',
    commitment: 'ongoing',
    cost: 'free',
    language: 'Spanish',
    location: null,
    onlineLink: 'https://example.org/join/storytelling-circle',
    host: 'Love is Foundation',
    organization: null,
    visibility: 'public',
    capacity: 40,
    registered: 31,
    tags: ['storytelling', 'sacred-feminine', 'weekly']
  },
  {
    id: 'evt-005',
    title: 'Youth Governance Council: Co-Creating Policy for the Commons',
    summary: 'A public joint gathering with Ashoka exploring youth-led governance models.',
    description: 'A public joint gathering with Ashoka bringing young changemakers together to explore governance models for shared resources. Open to all - no Ashoka affiliation required for this one.',
    aspect: 'community-inclusion',
    sector: 'governance',
    subsector: 'Public policy',
    format: 'in-person',
    type: 'meetup',
    start: '2026-09-20T13:00:00-04:00',
    end: '2026-09-20T16:00:00-04:00',
    durationLabel: '3 Hours',
    commitment: 'one-time',
    cost: 'free',
    language: 'English',
    location: { venue: 'Ashoka Hub', city: 'Arlington', region: 'Virginia', country: 'USA', lat: 38.8816, lng: -77.0910 },
    onlineLink: null,
    host: 'Ashoka',
    organization: 'ashoka',
    visibility: 'public',
    capacity: 50,
    registered: 12,
    tags: ['youth', 'governance', 'commons']
  },
  {
    id: 'evt-006',
    title: 'Body Wisdom & Movement Meditation',
    summary: 'A gentle in-person/online movement practice for reconnecting with the body.',
    description: 'A gentle movement and meditation practice for reconnecting with the body\'s own wisdom. Runs as a short series - drop into one session or come for all four.',
    aspect: 'presence-being',
    sector: 'health',
    subsector: 'Integrative',
    format: 'hybrid',
    type: 'activity',
    start: '2026-09-08T08:00:00-06:00',
    end: '2026-09-08T09:00:00-06:00',
    durationLabel: 'Up to 1 Hour',
    commitment: 'multiple-sessions',
    cost: 'sliding-scale',
    language: 'English',
    location: { venue: 'Boulder Creek Pavilion', city: 'Boulder', region: 'Colorado', country: 'USA', lat: 40.0150, lng: -105.2705 },
    onlineLink: 'https://example.org/join/body-wisdom',
    host: 'Love is Foundation',
    organization: null,
    visibility: 'public',
    capacity: 25,
    registered: 9,
    tags: ['movement', 'meditation', 'embodiment']
  },
  {
    id: 'evt-007',
    title: 'Storytelling for Systems Change: A Media Co-Lab',
    summary: 'A donation-based online co-lab for changemakers who tell stories for a living.',
    description: 'A donation-based online co-lab for journalists, filmmakers, and communicators exploring how narrative can move systems, not just opinions.',
    aspect: 'service-offerings',
    sector: 'media',
    subsector: 'Transformative',
    format: 'online',
    type: 'workshop',
    start: '2026-09-15T11:00:00-07:00',
    end: '2026-09-15T13:00:00-07:00',
    durationLabel: '2 Hours',
    commitment: 'one-time',
    cost: 'donation',
    language: 'English',
    location: null,
    onlineLink: 'https://example.org/join/media-co-lab',
    host: 'Love is Foundation',
    organization: null,
    visibility: 'public',
    capacity: 80,
    registered: 38,
    tags: ['media', 'storytelling', 'systems-change']
  },
  {
    id: 'evt-008',
    title: 'Interfaith Circle: Weaving Wisdom Traditions',
    summary: 'A monthly hybrid gathering exploring shared threads across wisdom traditions.',
    description: 'A monthly hybrid gathering exploring the shared threads that run across the world\'s wisdom traditions. Held in a community hall near the Basilica gardens - online option available for the full session.',
    aspect: 'community-inclusion',
    sector: 'spirituality',
    subsector: 'Interfaith',
    format: 'hybrid',
    type: 'discussion',
    start: '2026-09-25T16:00:00+02:00',
    end: '2026-09-25T18:00:00+02:00',
    durationLabel: '2 Hours',
    commitment: 'ongoing',
    cost: 'free',
    language: 'English',
    location: { venue: 'Basilica Gardens Community Hall', city: 'Assisi', region: 'Umbria', country: 'Italy', lat: 43.0707, lng: 12.6197 },
    onlineLink: 'https://example.org/join/interfaith-circle',
    host: 'Love is Foundation',
    organization: null,
    visibility: 'public',
    capacity: 45,
    registered: 21,
    tags: ['interfaith', 'wisdom-traditions', 'monthly']
  },
  {
    id: 'evt-009',
    title: 'Ashoka Fellows Quarterly Convening',
    summary: 'An Ashoka-members-only convening - shown here to demonstrate organization-gated events.',
    description: 'Full details are visible to signed-in Ashoka Fellows. This card exists to demonstrate how organization-private events look to members versus non-members on the hub.',
    aspect: 'community-inclusion',
    sector: 'governance',
    subsector: 'Community initiatives',
    format: 'in-person',
    type: 'meetup',
    start: '2026-09-21T09:00:00-04:00',
    end: '2026-09-21T12:00:00-04:00',
    durationLabel: '3 Hours',
    commitment: 'one-time',
    cost: 'free',
    language: 'English',
    location: { venue: 'Ashoka Hub', city: 'Arlington', region: 'Virginia', country: 'USA', lat: 38.8820, lng: -77.0905 },
    onlineLink: null,
    host: 'Ashoka',
    organization: 'ashoka',
    visibility: 'organization',
    capacity: 40,
    registered: 33,
    tags: ['ashoka', 'fellows', 'members-only']
  }
];

/* ---------------------------------------------------------------
 * Sample organizations. Ashoka is used because the framework doc
 * itself uses Ashoka as the illustrative example for org-gated
 * events - this is a hypothetical demo pairing, not a claim that
 * a real partnership exists. Terra Commons is entirely fictional.
 * ------------------------------------------------------------- */
LIF.ORGANIZATIONS = [
  {
    id: 'ashoka',
    name: 'Ashoka',
    tagline: 'Example partner organization',
    description: 'Used here as the illustrative example from the framework doc: members get access to Ashoka-only events automatically, while everyone else still sees the public events Ashoka co-creates with LiF.',
    memberOnlyNote: 'Sign in and connect your Ashoka membership to see Fellows-only events in full.',
    focusSectors: ['governance', 'economics'],
    website: 'https://www.ashoka.org'
  },
  {
    id: 'terra-commons',
    name: 'Terra Commons Collective',
    tagline: 'Fictional demo organization',
    description: 'A fictional regenerative-land network used to demonstrate what a second co-creation partner looks like on the hub.',
    memberOnlyNote: null,
    focusSectors: ['environment', 'education'],
    website: null
  }
];

/* ---------------------------------------------------------------
 * Sample people (Member Connection Hub). Entirely fictional.
 * ------------------------------------------------------------- */
LIF.PEOPLE = [
  { id: 'ppl-1', name: 'Amara Chen', city: 'Los Angeles', country: 'USA', bio: 'Weaving art and ritual into community spaces.', aspects: ['divine-potential'], sectors: ['arts', 'spirituality'], language: 'English' },
  { id: 'ppl-2', name: 'Diego Fernandez', city: 'Mexico City', country: 'Mexico', bio: 'Building caring-economy tools for local co-ops.', aspects: ['source-resources'], sectors: ['economics', 'governance'], language: 'Spanish' },
  { id: 'ppl-3', name: 'Priya Nandakumar', city: 'Bangalore', country: 'India', bio: 'Integrative health practitioner and researcher.', aspects: ['presence-being'], sectors: ['health', 'science'], language: 'English' },
  { id: 'ppl-4', name: 'Kwame Mensah', city: 'Accra', country: 'Ghana', bio: 'Regenerative farming educator for youth cooperatives.', aspects: ['nature-nurture'], sectors: ['environment', 'education'], language: 'English' },
  { id: 'ppl-5', name: 'Freya Lindqvist', city: 'Stockholm', country: 'Sweden', bio: 'Documentary filmmaker covering systems change.', aspects: ['service-offerings'], sectors: ['media', 'arts'], language: 'English' }
];

/* ---------------------------------------------------------------
 * Sample groups.
 * ------------------------------------------------------------- */
LIF.GROUPS = [
  { id: 'grp-1', name: 'Regenerative Design Circle', description: 'Practitioners and learners co-designing regenerative land projects.', sector: 'environment', memberCount: 86 },
  { id: 'grp-2', name: 'Interfaith Dialogue Collective', description: 'A standing circle exploring shared ground across traditions.', sector: 'spirituality', memberCount: 54 },
  { id: 'grp-3', name: 'Money as Love Study Group', description: 'Reading and discussing the Enoughness frame together, monthly.', sector: 'economics', memberCount: 39 }
];

/* ---------------------------------------------------------------
 * Sample "Get Involved" opportunities.
 * ------------------------------------------------------------- */
LIF.OPPORTUNITIES = [
  { id: 'opp-1', type: 'Volunteer', title: 'Event Hosting Team', description: 'Help welcome guests and run the tech for online gatherings.' },
  { id: 'opp-2', type: 'Staff', title: 'Community Support Coordinator', description: 'Part-time role supporting members through onboarding and questions.' },
  { id: 'opp-3', type: 'SV Partnership', title: 'Regional Hub Pilot', description: 'Bring LiF\'s model to a new region as a social-venture partner.' },
  { id: 'opp-4', type: 'Co-Creation Partner', title: 'Regional Steward', description: 'Champion co-creation gatherings in your own bioregion.' }
];

/* ---------------------------------------------------------------
 * Demo signed-in member, used to power the Personal Dashboard and
 * the "for me" quick filter. Swap for the real session profile.
 * ------------------------------------------------------------- */
LIF.CURRENT_MEMBER = {
  name: 'Alex Rivera',
  isDemoProfile: true,
  location: 'Portland, Oregon, USA',
  languages: ['English'],
  interestedAspects: ['engagement-communion', 'nature-nurture'],
  interestedSectors: ['environment', 'relations'],
  upcomingEventIds: ['evt-001', 'evt-003'],
  groupIds: ['grp-1'],
  connectionIds: ['ppl-1', 'ppl-4'],
  notifications: [
    'Global Co-Creation Circle starts in a few weeks - you\'re registered.',
    '3 new members joined Regenerative Design Circle.',
    'Kwame Mensah shared an update in Regenerative Design Circle.'
  ]
};
