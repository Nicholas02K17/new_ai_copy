# LiF Hub — frontend prototype

A frontend-only build of the LiF Interactive Engagement Hub: an events map, a master calendar,
directories for People / Groups / Organizations / Opportunities, a personal dashboard, and a
"More Features" panel so each member can build their own minimal-to-full view of the hub.

Everything that needs a real server (register for an event, sign in, connect with someone, join a
group, edit a profile) is wired to a single obvious placeholder for now. Everything that doesn't
need a server (map, filters, calendar, adding an event to your own calendar, sharing an event
link) is fully working today.

---

## 1. File structure

Paste these straight into a VS Code project with this layout:

```
lif-hub/
├── index.html              ← the events hub — map, calendar, directories
├── dashboard.html          ← the personal dashboard (see §5) — where a signed-in member lands
├── login.html              ← sign in with a one-time code
├── register.html           ← sign up
├── package.json            ← optional, just gives you `npm start`
├── README.md
├── css/
│   ├── theme.css            ← colors, fonts, spacing (design tokens only)
│   ├── main.css             ← layout & every component's styling
│   └── dashboard.css        ← the dashboard page's own stylesheet
└── js/
    ├── data.js               ← ALL sample content lives here (see §4) — this is what you swap for real API calls
    ├── state.js               ← one shared object: current view, active filters, feature toggles
    ├── utils.js                ← DOM helpers, date formatting, distance math, the backend-placeholder pattern
    ├── map.js                  ← Leaflet map + event pins
    ├── filters.js               ← the aspect wheel + full filter drawer + the filtering logic itself
    ├── eventDetail.js            ← the event detail modal
    ├── dashboard.js                ← personal dashboard sidebar
    ├── directory.js                 ← People / Groups / Organizations / Opportunities grids
    ├── calendarView.js               ← FullCalendar wrapper
    ├── customize.js                   ← the "More Features" panel
    ├── app.js                          ← wires it all together — loaded last
    ├── dashboardData.js                 ← the signed-in member + resources, commons, notifications
    └── dashboardPage.js                  ← the whole personal dashboard (its own page, own shell)
```

`dashboard.html` loads only four of these — `data.js`, `dashboardData.js`, `utils.js`,
`dashboardPage.js` — so the dashboard and the events hub share their data and helpers but
nothing else. Neither page can break the other's layout.

No `src/`, no build output folder, no `node_modules` to commit — there's nothing to compile.

## 2. Running it

**Easiest:** double-click `index.html`. This project uses plain `<script>` tags (not ES modules),
so unlike a lot of modern frontend boilerplate it actually works straight off disk.

**Recommended anyway**, since it's closer to how it'll behave once it's live: run it through a
local server —

- VS Code: install the "Live Server" extension, right-click `index.html` → *Open with Live Server*, or
- Terminal: `npm start` (runs `serve` via `npx`, no install needed), or
- `python3 -m http.server 5500` and visit `http://localhost:5500`

One reason to prefer a server: "Use my current location" (in the distance filter) uses
`navigator.geolocation`, which some browsers restrict on plain `file://` pages. Everything else
works identically either way.

## 3. Key decisions, and why

**Vanilla JS, no framework, no build step.** Every file attaches to a single global, `window.LIF`,
so there's nothing to `npm install` and no bundler config to fight with mid-sprint. Trade-off: you
write a bit more DOM-wiring code by hand than you would in React — but there's also nothing to
break between your machine and whatever HostPapa serves it as.

**Leaflet + OpenStreetMap, not Google Maps.** The baseline code had a live Google Maps API key
embedded in it, but it's domain-restricted to the old site and isn't yours to carry over, and a
new key means billing setup. Leaflet needs no key and is free at any traffic level; OpenStreetMap's
public tiles are fine for development and normal usage, but if the hub gets heavy traffic later,
OSM's usage policy asks high-volume sites to use a paid tile provider (Mapbox, MapTiler, Stadia —
all drop-in swaps, isolated entirely to `map.js`).

**FullCalendar, pinned to v6.1.21 exactly.** The meeting transcript's action item called for
fullcalendar.io specifically. It's loaded from a CDN rather than vendored, pinned to an exact
version rather than "latest": v7.0.0 shipped on 2026-06-19 — literally the day after 6.1.21 — and
is a genuinely different architecture underneath (Preact-based, a multi-file theme system). npm's
"latest" tag now points to 7.0.2, so pulling in FullCalendar without a pin would silently hand you
the untested new major version. 6.1.21 is the last release of the older, better-documented line,
which felt like the safer choice for a team building fast without time to debug an unfamiliar
major version mid-sprint. Worth revisiting once v7 has more real-world track record.

**Chakra palette — top row only.** Every color in `css/theme.css` is the first-row hex you sent;
none of the "-2" rows were used. If you finalize those later, that file is the only place they
need to change — every component references the named variables, never raw hex.

**Aspects mapped to chakras.** The framework doc's 7 Aspects and the palette's 7 chakras are
paired in `js/data.js` (`LIF.ASPECTS`) in the order both were listed. That pairing is a judgment
call, not a spec — if your team had a different aspect-to-chakra intention, it's one array to edit
and everything (pins, badges, the aspect wheel, the calendar) updates automatically.

**Sectors use your real taxonomy.** Rather than re-deriving shorter labels from the framework doc,
`LIF.SECTORS` uses the actual 12-category tree from your production `copy_map` data
(Spirituality & Religion, Science & Technology, etc.), so this stays consistent with what's
already live.

**Map pins are events, not people**, per your note — clicking one opens the event's full detail,
never a person. Online-only events don't get a pin (a location doesn't mean much for them); they
show as a card strip under the map instead, and picking the "Online" quick filter switches
straight to the list view automatically, following the split your team landed on
Aug 13 (in-person/hybrid → map, virtual → cards).

**Minimalist by default.** On first load, only the events map/list and basic search show up.
"More Features" (top-right) reveals switches for the personal dashboard, calendar, and the
People/Groups/Organizations/Opportunities tabs, plus an "advanced filters" switch that reveals
the full filter drawer (sectors, date, time, cost, language, and the rest of the framework doc's
filter list) — the aspect wheel, search, format, and map/list toggle stay on always, since those
felt core rather than optional. This mirrors the toggle-based approach (rather than full
drag-and-drop) your team landed on for the dashboard in the same meeting.

**One placeholder pattern, used everywhere.** Every action needing a real backend — Register,
Sign In, Connect, Join Group, Express Interest, Edit Profile — calls
`LIF.util.backendPlaceholder()` in `js/utils.js`, which shows a toast explaining what would happen
and opens google.com. When your backend exists, that's the one function to change; nothing else
in the app needs to know.

**A few things are real, not placeholders**, since they don't need a server at all: downloading an
`.ics` file, an "Add to Google Calendar" link, a `mailto:` invite-a-friend link, and copying a
shareable link (`#event=<id>`, so a pasted link opens straight to that event).

**Organization-gated events.** Per the framework doc's Ashoka example, one sample event
(`evt-009`, "Ashoka Fellows Quarterly Convening") is marked `visibility: "organization"`. Since
there's no real sign-in yet, it always renders in its "signed-out" state — a members-only badge
and a locked pin, with the fuller details held back — so you can see what that gating looks like
before auth exists. A second event (`evt-005`) is hosted *with* Ashoka but kept public, matching
the doc's "public jointly created events" case.

**On the live map.co-creators.website reference:** this environment can't browse live URLs, so
this was built from the baseline code you sent (`copy_map.zip`) and the meeting transcript rather
than the live page directly. Worth noting either way: you mentioned on the call that the live
version currently has no real CSS applied, so there wasn't much visual behavior to match yet.

## 4. The test event — and the sample data around it

`js/data.js` → `LIF.EVENTS[0]` (`evt-001`, flagged `isTestEvent: true`) is the requested test
event: **"Global Co-Creation Circle,"** a hybrid networking gathering in Sedona, AZ, with a full
set of fields filled in (description, capacity, registration count, tags, aspect, sector, cost,
language, online link). Open it in the app to see every field the detail modal supports.

Eight more sample events sit alongside it — enough spread across aspects, sectors, formats, and
dates that the filters, map, and calendar all have something real to demonstrate. All of it lives
in one array; swap it for a real API response whenever the backend's ready and nothing else in the
app needs to change, since every screen reads from `LIF.EVENTS`, `LIF.PEOPLE`, `LIF.GROUPS`,
`LIF.ORGANIZATIONS`, and `LIF.OPPORTUNITIES` rather than hardcoding anything itself.

## 5. The personal dashboard

`dashboard.html` is where a verified member lands after signing in. It's a separate page with its
own shell, carrying the warm cream/gold "Welcome Home" language from `login.html` and
`register.html` rather than the denser utility styling of the events hub — arriving here should
feel like the same room you signed up in. What it borrows from `theme.css` is the part that *is*
the brand: the seven aspect colours sampled from the logo, one per feature, so the ring of cards
reads as the logo's own circles.

**Three layouts, switchable by the member** — all three from the spec, all sharing one card
renderer and one detail renderer, so they can never drift apart:

| Layout | What it is |
|---|---|
| **Constellation** | Feature cards ringing a central map or calendar. Each card shows its own counts; click one to open it. This is the mockup's arrangement. |
| **Cards** | The same cards in a plain responsive grid. What the constellation collapses to on a narrow screen anyway. |
| **Sidebar** | A rail of features on the left, the selected one filling the space beside it. |

The choice, the centre focus (map vs calendar), the visible features and every preference persist
to `localStorage` — standing in for a `dashboard` field on the member's profile record. Swap
`persist()` / `restore()` in `dashboardPage.js` when that field exists, and the layout follows
them across devices instead of living on one browser.

**Nothing is precomputed.** "Suggested", "New since last visit" and every number on every card are
derived at render time from `MEMBER.preferences`, `MEMBER.privacy` and `MEMBER.lastVisit`. Open
**Profile → Preferences**, drag the distance slider or switch a sector off, and the counts on the
cards move while you watch. That's not a demo trick — it's the whole point of the preferences
system, and it means the backend only ever has to return state, never opinions.

The matcher (`match()`) treats **sector, subsector and being inside your radius** as strong enough
to justify a suggestion on their own. Language and "it's online" only raise something already
relevant — otherwise the Suggested tab quietly fills up with everything in English.
Every suggestion shows *why* it was suggested, because a recommendation nobody can explain is
just noise.

**Where the spec's details landed:**

- **Field-level privacy** — every profile field has its own public/private switch, under
  Profile → Details. First name and postal code are locked public, since member search and the map
  locator are built on them. Profile → Privacy shows a live summary of the result.
- **Sectors → subsectors** — the subsector chips only exist beneath a sector you've chosen
  (the spec's dependent dropdown), plus a "request a new subsector" box. Full 12-sector tree in
  `LIF.SUBSECTORS`.
- **Two levels of notification, kept separate** — the bell on a feature card is the *profile-level*
  switch; the bell on an individual event or group mutes only that item and deliberately does
  **not** touch your profile. Both feed the master list behind the header bell, which also holds
  the channel (playground / email / both) and frequency settings.
- **Organizations only exists if you're a verified member** of a partner organization — with an
  empty `organizations.verified`, the card doesn't render at all and the Customize row explains
  why. `evt-105` (Terra Commons) is gated *and* visible to the demo member; `evt-009` (Ashoka) is
  gated and isn't. Both sides of the rule are visible in one session.
- **Activity sharing is two-sided** — you see a playmate's activity only if you agreed to receive
  and they agreed to share. Turning either switch off in Privacy empties the tab immediately.
- **Global search sits in the header, not in a panel.** The dashboard reflects your preferences,
  but it must never fence you off from the rest of the playground — so search spans events,
  groups, people, resources, commons, opportunities and organizations regardless of what your
  dashboard is showing, and marks anything you don't have access to as members-only.

**What's real and what isn't.** The layouts, counts, suggestion matching, filtering, bookmarking,
muting, the map, the calendar and every preference are all working. Actions that genuinely need a
server — registering, joining, connecting, uploading a photo, opening a full detail page — route
through one function, `pending()`, which names what would happen. (It's a local variant of
`utils.js`'s `backendPlaceholder()`: that one also opens a placeholder tab, which is fine on a
one-action page and far too disruptive on a dashboard where most buttons are still stubs.)

The language selector stores the choice and says so plainly rather than pretending to translate.
Worth flagging for whoever wires the real thing: the spec asks that **static templates — event and
group invitations — get translated too**, and a client-side translation widget alone won't do
that. It needs to happen server-side, at the point those templates are rendered.

## 6. Known simplifications (fine for a first pass, worth knowing about)

- **The dashboard uses a hardcoded demo member** — `LIF.MEMBER` in `js/dashboardData.js`, labeled
  "sample profile" in the UI. There's no real session yet; that object is exactly the shape your
  session endpoint should return. (`LIF.CURRENT_MEMBER` in `data.js` still drives the small
  sidebar peek on the events hub, and `dashboardData.js` keeps the two pointed at the same person
  so they can't disagree.)
- **`dashboardData.js` adds five events and two people to the sample set.** The nine events in
  `data.js` were written to exercise the public hub's filters, and only two of them touch the demo
  member's interests — both already registered. Without something nearby and on-topic, the
  suggestion engine would have had nothing honest to surface and every "Suggested" tab would have
  demoed as empty. They're marked and commented where they're added.
- **Filters live on the Events tab.** The calendar view reads the same filtered results, but the
  filter controls themselves only appear while you're on Events — switch there to change what's
  filtered, then flip back to Calendar.
- **No drag-and-drop card ordering.** The dashboard offers three fixed layouts and per-feature
  on/off switches, matching what the team landed on, rather than free-form dragging. Cards fill the
  constellation ring in registry order; hiding one closes the ring up rather than leaving a hole.
  If free ordering is wanted later, it's one array of keys on `MEMBER.dashboard` plus a sort.

## 7. Libraries used (all via CDN, no install needed)

| Library | Version | Why |
|---|---|---|
| [Leaflet](https://leafletjs.com/) | 1.9.4 | The map. No API key required. |
| [FullCalendar](https://fullcalendar.io/) | 6.1.21 (pinned) | The master calendar, per the meeting's action item. |
| [Fraunces](https://fonts.google.com/specimen/Fraunces) / [Karla](https://fonts.google.com/specimen/Karla) / [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | — | Google Fonts, loaded in `index.html`. |

Map tiles are © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
