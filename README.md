# LiF Hub — frontend prototype

A frontend-only build of the LiF Interactive Engagement Hub: an events map, a master calendar,
directories for People / Groups / Organizations / Opportunities, a personal dashboard, the full
events and gatherings pathway (§6), a per-member theme drawn from the chakra palette (§7), and a
"More Features" panel so each member can build their own minimal-to-full view of the hub.

Everything that needs a real server (sign in, connect with someone, join a group, edit a profile)
is wired to a single obvious placeholder for now. Everything that doesn't need a server is fully
working today — the map, the filters, the calendar, add-to-calendar and share links, the theme
picker, and the whole events pathway from proposing a gathering through registering for one to
the recordings afterwards. The events pathway keeps its state in one small store, and writes the
emails it cannot send to a visible outbox rather than pretending they went out (§6.7).

---

## 1. File structure

Paste these straight into a VS Code project with this layout:

```
lif-hub/
├── index.html              ← the events hub — map, calendar, directories
├── dashboard.html          ← the personal dashboard (see §5) — where a signed-in member lands
├── event.html              ← one event's own page (see §6) — where every register link lands
├── login.html              ← sign in with a one-time code
├── register.html           ← sign up
├── package.json            ← optional, just gives you `npm start`
├── README.md
├── css/
│   ├── theme.css            ← colors, fonts, spacing (design tokens only)
│   ├── main.css             ← layout & every component's styling
│   ├── dashboard.css        ← the dashboard page's own stylesheet
│   ├── events.css           ← the events pathway: proposal wizard, registration, event page
│   └── palette.css          ← the chakra palette + the theme picker (see §7) — loaded LAST
└── js/
    ├── theme.js              ← the theme engine + picker. Loaded in <head>, before anything paints
    ├── data.js               ← ALL sample content lives here (see §4) — this is what you swap for real API calls
    ├── state.js               ← one shared object: current view, active filters, feature toggles
    ├── utils.js                ← DOM helpers, date formatting, distance math, the backend-placeholder pattern
    ├── eventsModel.js           ← the events domain: taxonomies, statuses, the store, LIF.events
    ├── map.js                    ← Leaflet map + event pins
    ├── filters.js                 ← the aspect wheel + full filter drawer + the filtering logic itself
    ├── eventDetail.js              ← the event quick-look modal on the hub
    ├── eventProposal.js             ← the proposal pathway + the invitation builder
    ├── eventRegistration.js          ← registration, payment step, confirmation, calendar links
    ├── eventPage.js                   ← event.html — details, register, post-event, host tools
    ├── hubEvents.js                    ← the hub's hover preview and the #propose deep link
    ├── dashboard.js                     ← personal dashboard sidebar
    ├── directory.js                      ← People / Groups / Organizations / Opportunities grids
    ├── calendarView.js                    ← FullCalendar wrapper
    ├── customize.js                        ← the "More Features" panel
    ├── app.js                               ← wires the hub together — loaded last
    ├── dashboardData.js                      ← the signed-in member + resources, commons, notifications
    └── dashboardPage.js                       ← the whole personal dashboard (its own page, own shell)
```

The three pages share `data.js`, `utils.js`, `theme.js` and the whole events pathway, and nothing
else — `dashboard.html` never loads the hub's layout code, `index.html` never loads the
dashboard's. No page can break another's layout.

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

**Chakra palette — now the whole sheet, and the member picks.** `css/theme.css` still holds the
logo-sampled defaults, but every swatch on the palette sheet (both rows, all seven families) is
now transcribed in `css/palette.css` and offered to the member through a theme picker. See §7.

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
The **Events** tab stays in the nav at all times as the anchor for the events area, with the other
views appearing beside it as they're switched on. Two things about that tab, learned the hard way:
it's tinted rather than filled when it's the current view, so it never reads as a call to action
you're supposed to press — and it carries a **live count of the events the current filters leave**,
so it responds to something even when it's the tab you're already on. A control that never changes
reads as broken.
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

## 6. Events and gatherings — the whole pathway

This is the events spec built end to end: propose → invitation → review → pending → active →
register → attend → recordings and follow-up → repeat. Five files carry it, and they are layered
so the domain has no idea a UI exists.

### 6.1 The shape of it

| File | What it owns |
|---|---|
| `js/eventsModel.js` | The taxonomies the proposal form asks for, the fields every event carries, and `LIF.events` — the whole domain API. No DOM in this file at all. |
| `js/eventProposal.js` | The proposal pathway and the invitation builder. |
| `js/eventRegistration.js` | Registration, the payment step, the confirmation, and `LIF.calendarLinks`. |
| `js/eventPage.js` + `event.html` | One event's own page, in whichever of its four states it is in, plus the host's tools. |
| `js/hubEvents.js` | The hub's hover preview, and `#propose` as a deep link. |

**Everything a member does lives in one place**: `LIF.eventStore`, a localStorage-backed object
with a three-function surface — `read()`, `write()`, `queue()`. Registrations, RSVPs, drafts,
proposals, notify-me requests and the discussion threads all sit in it. Swap those three functions
for API calls and every screen follows, because no screen touches localStorage itself.

### 6.2 The proposal pathway

`Propose an event` sits in the header on all three pages. It opens on a welcome screen that greets
the member by their **preferred name** and asks the spec's question: form, or interactive pathway?

Those are **two renderers over one field definition** — the `FIELDS` array near the top of
`eventProposal.js`. That was the main design decision here. Every question in the spec appears
once, with its label, its spoken-aloud phrasing for the guided path, its help prompt, its
validation and its place in the review summary. Two hand-maintained copies of a 21-question form
would have drifted within a week.

- **Form** — everything at once, grouped into seven sections.
- **Guided** — one question at a time, with the form building itself in a sidebar. Every answered
  line is clickable to go back to it. Switching between the two modes mid-way keeps every answer.

Dependent fields appear only when they apply: a subsector dropdown once you pick a sector (plus
"suggest a new subsector" and an "Other" box), a location block for in-person and hybrid, a
sliding-scale range once you choose sliding scale, an invite-list question once you choose private,
a recording-access dropdown once you say you will record. Required fields are validated with
sentences rather than asterisks — *"In-person and hybrid events need at least a venue and a city."*

A draft saves as you type and is offered back on the welcome screen next time.

**Then the invitation builder.** Everything from the proposal migrates into a template. Required
detail blocks and the registration button are locked and cannot be removed — the rest the creator
adds and arranges: cover image, headline, opening line, body, what-to-bring, closing line, and
which details show. Two live previews sit beside it: the full invitation, and the **event card**
(the summary that shows on the hub, in search, and on a member's dashboard), which is separately
editable because a good card is rarely the first 120 characters of a good description.

**Submit** assigns the event ID (`LIF-YYYY-NNN`, sequential within the year), sets the status to
Pending, and shows the spec's thank-you. The event appears immediately on the proposer's dashboard
under **Events → Proposed** and gets its own event page, showing them exactly what a reviewer sees.

### 6.3 Registration

Register buttons appear on the hub modal, the event page, dashboard event cards and (in a real
build) emails and private messages. **All of them route to the same flow**, and all of them read
the same state — so when registration closes, every one of them says *"Registration closed"*
rather than only the event page.

The flow is: your details (prefilled from your profile, all of it overridable without touching the
profile), then a payment step only if the event asks for money, then confirmation. Confirmation
carries the RSVP buttons, add-to-calendar links for **Google, Outlook, Office 365, Yahoo and
.ics**, an invite-a-friend mailto, a copy-link button, and the reminder schedule with an opt-out.

Sliding scale means what it says: the slider goes to the bottom of the range and paying nothing is
a normal outcome, not an exception the UI apologises for.

### 6.4 Outstanding tasks

The spec asks that event cards carry what the member still has to do. `LIF.events.tasksFor(id)`
computes that from state rather than storing it: an unanswered RSVP, a stuck payment, an unfilled
post-event survey, a follow-up a host has not sent. It surfaces on the event card, in the event
page's register panel, and in the Events card's one-line peek on the dashboard.

### 6.5 After the event

A completed event's page carries the host's note, the recording (gated by the host's own choice —
registered / attendees / public / private, enforced in `canSeeRecording()`), the shared resources,
the feedback survey, a **Continue the conversation** thread, and a **Create a group from this
event** button that hands off to the group pathway with the event ID attached.

The host gets a composer for all of it: a note, tick boxes for what to include, who receives it,
and a reply-to line that defaults to their own address — so replies reach the host and not the LiF
Events inbox.

### 6.6 Repeating an event

From the host tools: new dates, same content. It keeps the series ID with `-N` appended
(`LIF-201` → `LIF-201-2`), resets the registration count, and skips the proposal process entirely,
which is the whole point. `evt-002-2` in the sample data is a repeat that already exists, so you
can see what one looks like before making one.

### 6.7 What is queued rather than sent

The spec's pathway has real server-side legs: a confirmation email, a private message, a Google
Workspace proposal repository, the LiF Events group notification, 24-hour and 1-hour reminders, the
post-event follow-up. None of those can exist in a frontend build.

Rather than mime them, **every one is written to an outbox** (`LIF.eventStore.outbox()`) with its
kind, its recipient, its subject, its template and — for reminders — the exact time it should fire.
The proposal's thank-you screen and the registration confirmation both show you the queue. That
makes the wiring visible and testable now, and gives whoever builds the mail service a list to read
rather than a spec to re-derive.

### 6.8 The five sample events added for this

The nine originals were all upcoming, public and open, which left four of the five statuses with
nothing to demonstrate. `eventsModel.js` adds five more so every state in the spec is visible in
one session:

| Event | Demonstrates |
|---|---|
| `evt-201` Water Justice Listening Session | **Complete**, hosted by the demo member, with the whole post-event pathway filled in: recording, host note, resources, survey, thread. |
| `evt-202` Deep Adaptation Summit | **Registration closed** and full, multi-day (three sessions), sliding scale. The "tell me if it reopens" path. |
| `evt-203` Watershed Stewards Winter Planning | **Private / invite only**. Visible because the demo member is on the invitation list; invisible to anyone else. |
| `evt-204` Compassionate Listening Practicum | **Cancelled** for not reaching its minimum — the exact case the proposal form asks about. |
| `evt-002-2` Money as Love (October) | A **repeat**: same series, same content, new dates, `-2` on the ID. |

---

## 7. Choose your own theme

Every member picks their own colour from the LiF chakra palette, and the whole playground re-tunes
to it — buttons, links, focus rings, highlights, badges, the paper underneath, the ambient wash
behind the page. It changes only their own view and reverts in one click.

**How it works.** Every stylesheet in this project already referenced named tokens rather than raw
hex, so a theme is nothing more than a set of values written onto `document.documentElement`. No
component knows the theme system exists, and the theme system knows about no component.

**What the picker offers:**

- **The palette sheet, transcribed** — seven families, both rows, six shades each, laid out the way
  the palette document is. Plus **LiF House**, the logo's own purple and gold, so "put it back" is
  one click. Every swatch is live: click and the page changes under you.
- **Paper** — Cream (what the hub shipped with), Ivory, Cool, and **Deep**, a genuine dark ground.
- **Tint the paper to match** — pulls a trace of the chosen colour into every neutral, so the theme
  reads as one room rather than one coloured button.

**Details that matter:**

- `js/theme.js` is loaded in `<head>` and applies synchronously, so a member who chose Crown never
  sees a flash of purple before their own colour arrives.
- Text on the accent is chosen by **WCAG relative luminance**, not by guessing — pick the lightest
  swatch in a family and the button text goes dark automatically.
- On the Deep ground, a very dark swatch would disappear, so the pick shifts up the ramp. The
  member's choice of family is honoured either way.
- `color-scheme` is set alongside, which is the difference between a dark theme and a dark theme
  with white dropdowns punched through it.
- **The seven Aspect colours never change.** A map pin's colour is how the map tells you which
  Aspect an event belongs to; re-tinting those would make it lie. The picker says so, and shows
  them.

**The one thing to know before editing:** `css/palette.css` must load **after** `main.css` and
`dashboard.css`. Both of those still carried a handful of literal cream/gold values from before
themes existed; rather than edit two working stylesheets, palette.css re-points exactly those rules
at tokens. It is the whole diff, in one file.

The choice persists to `localStorage` under `lif.theme.v1`. When accounts are real this belongs on
the profile record as a `theme` field so it follows the member across devices — swap `read()` and
`write()` in `theme.js` and nothing else changes.

---

## 8. Known simplifications (fine for a first pass, worth knowing about)

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
- **The proposal review step is not a real review.** Submitting sets the status to Pending and
  files the notifications in the outbox; nothing moves it to Active, because that is a steward's
  decision made in Google Workspace. To see an Active event, use one of the samples.
- **Editing an active event is still a placeholder.** The edit form should reuse the proposal
  fields — the pathway is built, it just needs a backend that can accept a change and notify
  everyone registered. Cancelling an event, by contrast, works.
- **Group creation from an event names the handoff but does not make the group.** The Group
  Proposal pathway is the next one to build; the button already carries the event ID it should be
  linked to.
- **The payment step records an amount, it does not take money.** It marks the registration
  `recorded` and says on screen that the LiF payment apps take over from there.
- **A cover image uploaded in the proposal is held as a data URL** in localStorage, which is fine
  for a prototype and wrong for production — large images will blow the storage quota. Point it at
  your media upload endpoint when there is one.
- **No drag-and-drop card ordering.** The dashboard offers three fixed layouts and per-feature
  on/off switches, matching what the team landed on, rather than free-form dragging. Cards fill the
  constellation ring in registry order; hiding one closes the ring up rather than leaving a hole.
  If free ordering is wanted later, it's one array of keys on `MEMBER.dashboard` plus a sort.

## 9. Libraries used (all via CDN, no install needed)

| Library | Version | Why |
|---|---|---|
| [Leaflet](https://leafletjs.com/) | 1.9.4 | The map. No API key required. |
| [FullCalendar](https://fullcalendar.io/) | 6.1.21 (pinned) | The master calendar, per the meeting's action item. |
| [Fraunces](https://fonts.google.com/specimen/Fraunces) / [Karla](https://fonts.google.com/specimen/Karla) / [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | — | Google Fonts, loaded in `index.html`. |

Map tiles are © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
