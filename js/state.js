/**
 * state.js
 * ---------------------------------------------------------------
 * One shared, mutable object holding "what the UI currently looks
 * like": which nav view is open, what filters are active, and which
 * optional features the member has switched on via "More Features".
 *
 * NOTE ON PERSISTENCE: LIF.state.preferences resets on page refresh
 * in this build. That's intentional for now - once this is running
 * on your own server (not inside a preview sandbox), swap
 * loadPreferences()/savePreferences() below for localStorage, or
 * better, a real "preferences" field on the member's profile so it
 * follows them across devices.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.state = {
  activeView: 'events', // events | calendar | people | groups | organizations | opportunities

  // Which optional sections are switched on. Minimalist by default -
  // only the events/map experience shows until the member opts in.
  preferences: {
    dashboard: false,
    calendar: false,
    people: false,
    groups: false,
    organizations: false,
    opportunities: false,
    advancedFilters: false
  },

  // Events view state
  eventViewMode: 'map', // map | list

  filters: {
    search: '',
    aspects: [],       // array of aspect ids, empty = all
    sectors: [],        // array of sector ids, empty = all
    format: 'all',      // all | in-person | online | hybrid
    types: [],
    date: 'any',         // any | today | tomorrow | this-week | this-weekend | next-week | this-month | custom
    customDateStart: null,
    customDateEnd: null,
    time: [],             // morning | afternoon | evening | night
    radiusKm: null,        // null = anywhere
    durations: [],
    commitments: [],
    costs: [],
    languages: [],
    forMeOnly: false
  },

  selectedEventId: null,
  selectedOrgId: null,

  // Reference point for the location-radius filter. Defaults to a
  // rough "somewhere central" point; replaced by the browser's real
  // location if the member grants permission (see utils.js).
  myLocation: { lat: 39.8283, lng: -98.5795, isReal: false }
};

function loadPreferences() {
  // In-memory only for this build - see note above.
  return LIF.state.preferences;
}

function savePreferences(prefs) {
  // In-memory only for this build - see note above.
  LIF.state.preferences = prefs;
}

LIF.loadPreferences = loadPreferences;
LIF.savePreferences = savePreferences;
