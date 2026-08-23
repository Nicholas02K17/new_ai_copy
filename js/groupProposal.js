/**
 * groupProposal.js
 * ---------------------------------------------------------------
 * "Propose a New Group" — §6 of the Groups Human Mapping.
 *
 *   welcome → 7 steps → preview → validate → submitted
 *
 * WHY THIS IS A STEPPED PATHWAY AND THE EVENT ONE IS NOT
 * The Events doc asked for a choice between a form and a guided
 * walkthrough. This doc asks for something different: "a resumable
 * multi-step pathway with autosave, visible status and Save and
 * Continue". So this is steps with a persistent draft, and you can
 * close it mid-sentence and come back to the same box.
 *
 * THE OTHER RULE THAT SHAPES IT (§6.3 approved direction)
 * "Enforce requiredness at submission so early drafting remains
 * welcoming." Nothing blocks while you write. Validation happens
 * once, at the Validate step, and it explains consequences rather
 * than just marking fields red — including what the access and
 * privacy choices will actually mean for the people who find it.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.groupProposal = (function () {

  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  var P = null;
  var step = 0;              // index into STEPS
  var view = 'welcome';      // welcome | steps | preview | validate | done
  var openHelp = {};
  var problems = [];
  var root = null;

  /* =========================================================
   * 1. THE STEPS
   * §6.3's field table, grouped into the pathway's steps. `req`
   * marks what §6.3's approved direction calls conditionally
   * required — enough for informed review, enforced at submission.
   * ======================================================= */
  var STEPS = [
    { id: 'identity', title: 'Identity', lead: 'What is it called, and how would you describe it in a line?' },
    { id: 'purpose', title: 'Purpose', lead: 'Why this Group, who it serves, and what you hope grows from it.' },
    { id: 'classification', title: 'Focus', lead: 'Where it sits in the LiF areas of focus, so the right people find it.' },
    { id: 'structure', title: 'Shape', lead: 'How it gathers, where, and in what language.' },
    { id: 'access', title: 'Access', lead: 'Who can find it, and how someone comes in.' },
    { id: 'people', title: 'People', lead: 'Who stewards it, and who is already with you.' },
    { id: 'areas', title: 'Group Areas', lead: 'What this Group needs to do its work. You can change these later without rebuilding.' }
  ];

  function blank() {
    var G = LIF.groups;
    return {
      id: null, groupRef: null, status: 'draft',
      /* identity */
      name: '', description: '', cardSummary: '', image: null,
      /* purpose */
      purpose: '', whoFor: '', activityPlan: '', contribution: '',
      /* classification */
      sector: '', subsector: '', subsectorSuggestion: '', tags: [],
      /* structure + delivery */
      structure: '', format: '', location: null,
      languages: { primary: 'English', supported: [] },
      accessibility: { notes: '', contact: 'accessibility@loveisfoundation.org' },
      /* access */
      discoverability: 'discoverable', joinMethod: 'request',
      accessInstructions: 'Tell the stewards a little about what brings you.',
      accessQuestions: [{ key: 'why', label: 'What brings you to this Group?', required: true }],
      sharedInfoNote: 'Stewards see your Playground Name, your public profile fields and your answers. Nothing else.',
      allowInvites: true,
      countDisplay: 'exact', capacity: null,
      /* people */
      stewards: [], initialMembers: [],
      /* participation */
      participation: '', agreements: [],
      /* areas + connections */
      areas: null,
      originEventId: null, relatedGroups: []
    };
  }

  /* =========================================================
   * 2. STEP BODIES
   * ======================================================= */
  function field(key, label, control, opts) {
    opts = opts || {};
    return '<div class="gp-field" data-field="' + key + '">' +
      '<div class="gp-label-row">' +
        '<label class="gp-label">' + h(label) +
          (opts.req ? ' <span class="gp-req">needed to submit</span>' : '') + '</label>' +
        (opts.help ? '<button type="button" class="gp-help-btn" data-do="help" data-value="' + key + '" ' +
          'aria-expanded="' + !!openHelp[key] + '" aria-label="Help with this">?</button>' : '') +
      '</div>' +
      (opts.help && openHelp[key] ? '<p class="gp-help">' + h(opts.help) + '</p>' : '') +
      control +
      (opts.hint ? '<p class="gp-hint">' + h(opts.hint) + '</p>' : '') +
    '</div>';
  }

  function text(key, placeholder, value) {
    return '<input class="gp-input" type="text" data-set="' + key + '" value="' + h(value) + '" placeholder="' + h(placeholder || '') + '">';
  }
  function area(key, placeholder, value, rows) {
    return '<textarea class="gp-input gp-textarea" rows="' + (rows || 4) + '" data-set="' + key + '" placeholder="' + h(placeholder || '') + '">' + h(value) + '</textarea>';
  }
  function cards(items, current, action) {
    return '<div class="gp-cards">' + items.map(function (i) {
      return '<button type="button" class="gp-card' + (current === i.id ? ' is-on' : '') + '" ' +
        'data-do="' + action + '" data-value="' + i.id + '">' +
        '<strong>' + h(i.name) + '</strong><span>' + h(i.desc || '') + '</span></button>';
    }).join('') + '</div>';
  }

  function stepIdentity() {
    return field('name', 'Group name', text('name', 'e.g. Bioregional Water Council', P.name),
        { req: true, help: 'Say what it is. People scanning a list of forty Groups read the name and nothing else.' }) +
      field('description', 'Short description',
        area('description', 'One or two sentences. This is what shows on the Group card.', P.description, 3),
        { req: true, hint: 'Shown on the card in Explore Groups, search results and the Map.' }) +
      field('cardSummary', 'Card summary',
        text('cardSummary', 'Leave blank to use the short description', P.cardSummary),
        { hint: 'Optional. Use it when the card needs to read tighter than the description.' }) +
      field('image', 'Group image',
        '<div class="gp-cover" style="background:' + coverPreview() + '">' +
          (P.image ? '' : '<span>Default — your sector’s colours</span>') + '</div>' +
        '<div class="gp-row"><input class="gp-input" type="file" accept="image/*" data-do="pick-image">' +
        (P.image ? '<button class="gp-btn gp-btn--ghost" type="button" data-do="clear-image">Remove</button>' : '') + '</div>',
        { hint: 'Optional. Without one the Group takes its sector’s colours, which looks intentional rather than empty.' });
  }

  function stepPurpose() {
    return field('purpose', 'What is this Group here for?',
        area('purpose', 'The intention. What made you want to start it.', P.purpose, 5),
        { req: true, help: 'This is the field a reviewer reads first, and the one a new Member reads on Group Home. Write it for them, not for us.' }) +
      field('whoFor', 'Who is it for?',
        area('whoFor', 'Who belongs here, and who would get the most from it.', P.whoFor, 3),
        { req: true, hint: 'Naming the room you are hoping for usually sharpens the purpose too.' }) +
      field('activityPlan', 'What will be alive at the start?',
        area('activityPlan', 'e.g. Monthly circle, first Tuesday. Working towards a shared curriculum by spring.', P.activityPlan, 3),
        { help: 'Group Home leads with this. It is also what keeps the Group showing as Active rather than Quiet — stewards are asked to confirm it periodically.' }) +
      field('contribution', 'What do you hope it contributes to the wider ecosystem?',
        area('contribution', 'Optional.', P.contribution, 3),
        { hint: 'Groups stay connected to the whole rather than becoming silos. This is where you say how.' });
  }

  function stepClassification() {
    var subs = LIF.SUBSECTORS[P.sector] || [];
    return field('sector', 'Interest / sector',
        '<select class="gp-input" data-set="sector"><option value="">Choose…</option>' +
          LIF.SECTORS.map(function (s) {
            return '<option value="' + s.id + '"' + (P.sector === s.id ? ' selected' : '') + '>' + h(s.name) + '</option>';
          }).join('') + '</select>',
        { req: true, help: 'This drives discovery, the filters and the “For Me” match. Pick the closest one.' }) +
      (subs.length
        ? field('subsector', 'Subsector / focus',
            '<select class="gp-input" data-set="subsector"><option value="">Choose…</option>' +
              subs.map(function (s) {
                return '<option value="' + h(s) + '"' + (P.subsector === s ? ' selected' : '') + '>' + h(s) + '</option>';
              }).join('') + '</select>' +
            '<div class="gp-row gp-row--tight">' +
              '<input class="gp-input" type="text" id="gpNewSub" placeholder="Propose a missing term" value="' + h(P.subsectorSuggestion) + '">' +
              '<button class="gp-btn gp-btn--ghost" type="button" data-do="suggest-sub">Propose</button>' +
            '</div>',
            { hint: 'A missing term goes through the same LiF-wide proposal and review that What Interests Me uses — there is no separate Group-only taxonomy.' })
        : '') +
      field('tags', 'Tags',
        (P.tags.length
          ? '<div class="gp-chips">' + P.tags.map(function (t, i) {
              return '<span class="gp-chip is-static">' + h(t) +
                '<button type="button" class="gp-chip-x" data-do="drop-tag" data-i="' + i + '" aria-label="Remove">×</button></span>';
            }).join('') + '</div>'
          : '<p class="gp-hint">None yet.</p>') +
        '<div class="gp-row"><input class="gp-input" type="text" id="gpTag" placeholder="Add a tag">' +
        '<button class="gp-btn gp-btn--ghost" type="button" data-do="add-tag">Add</button></div>',
        { hint: 'Optional. Words someone might actually search for.' });
  }

  function stepStructure() {
    var loc = P.location || {};
    return field('structure', 'How does this Group gather?',
        cards(LIF.GROUP_STRUCTURES, P.structure, 'set-structure'),
        { req: true, help: 'A starting configuration, not a separate platform. It sets which Group Areas switch on by default — you can change any of them on the next step and again later.' }) +
      field('format', 'Where does it happen?',
        cards([
          { id: 'in-person', name: 'In person', desc: 'A place. It can appear on the Map.' },
          { id: 'online', name: 'Online', desc: 'No physical distance filter is applied to it.' },
          { id: 'hybrid', name: 'Hybrid', desc: 'Both. It can appear on the Map.' }
        ], P.format, 'set-format'),
        { req: true }) +
      (P.format === 'in-person' || P.format === 'hybrid'
        ? field('location', 'Where',
            '<div class="gp-grid2">' +
              '<input class="gp-input" type="text" data-set="loc-city" placeholder="City" value="' + h(loc.city || '') + '">' +
              '<input class="gp-input" type="text" data-set="loc-region" placeholder="Region / state" value="' + h(loc.region || '') + '">' +
              '<input class="gp-input" type="text" data-set="loc-country" placeholder="Country" value="' + h(loc.country || '') + '">' +
              '<input class="gp-input" type="number" step="0.0001" data-set="loc-lat" placeholder="Latitude (optional)" value="' + h(loc.lat == null ? '' : loc.lat) + '">' +
              '<input class="gp-input" type="number" step="0.0001" data-set="loc-lng" placeholder="Longitude (optional)" value="' + h(loc.lng == null ? '' : loc.lng) + '">' +
            '</div>',
            { hint: 'Coordinates are optional. Without them the Group still lists and filters by location range — it just does not get a Map pin.' })
        : '') +
      field('languages', 'Language',
        '<label class="gp-sublabel">Primary language</label>' +
        '<select class="gp-input" data-set="lang-primary">' + LIF.LANGUAGES.map(function (l) {
          return '<option value="' + h(l) + '"' + (P.languages.primary === l ? ' selected' : '') + '>' + h(l) + '</option>';
        }).join('') + '</select>' +
        '<label class="gp-sublabel">Also supported</label>' +
        '<div class="gp-chips">' + LIF.LANGUAGES.filter(function (l) { return l !== P.languages.primary; }).map(function (l) {
          var on = P.languages.supported.indexOf(l) !== -1;
          return '<button type="button" class="gp-chip' + (on ? ' is-on' : '') + '" data-do="toggle-lang" data-value="' + h(l) + '">' + h(l) + '</button>';
        }).join('') + '</div>',
        { help: 'Declare one primary language and be honest about the limits of the rest. English stays available across the Playground when preferred-language content is not.' }) +
      field('accessibility', 'Accessibility',
        area('access-notes', 'Meeting accessibility, communication modes, translation availability — whatever someone needs to know before they decide.', P.accessibility.notes, 3) +
        '<label class="gp-sublabel">Accommodation contact</label>' +
        '<input class="gp-input" type="email" data-set="access-contact" value="' + h(P.accessibility.contact) + '">',
        { hint: 'Shown on Group Details before anyone joins, not after.' }) +
      field('participation', 'Meeting rhythm and expectations',
        area('participation', 'e.g. Twice monthly, ninety minutes. Come when you can; tell us when you cannot.', P.participation, 3),
        { hint: 'What someone is actually signing up to.' }) +
      field('agreements', 'Group agreements',
        (P.agreements.length
          ? '<ul class="gp-agreements">' + P.agreements.map(function (a, i) {
              return '<li>' + h(a) + '<button type="button" class="gp-chip-x" data-do="drop-agreement" data-i="' + i + '" aria-label="Remove">×</button></li>';
            }).join('') + '</ul>'
          : '<p class="gp-hint">None yet. Most Groups add two or three.</p>') +
        '<div class="gp-row"><input class="gp-input" type="text" id="gpAgreement" placeholder="e.g. What is said here stays here.">' +
        '<button class="gp-btn gp-btn--ghost" type="button" data-do="add-agreement">Add</button></div>',
        { hint: 'Shown before anyone joins. Group agreements may add to the LiF Community Guidelines but never override them.' });
  }

  function stepAccess() {
    return field('discoverability', 'Who can find this Group?',
        cards(LIF.GROUP_DISCOVERABILITY, P.discoverability, 'set-discoverability'),
        { req: true, help: 'Discoverability, what content is visible, and who may join are three separate settings. This one is only about being findable.' }) +
      field('joinMethod', 'How does someone come in?',
        cards(LIF.GROUP_JOIN_METHODS, P.joinMethod, 'set-join'),
        { req: true, help: 'There is no public instant join on the Playground. Either a steward reviews a request, or a steward sends an invitation.' }) +
      (P.joinMethod === 'request'
        ? field('accessInstructions', 'What do you want people to know before they ask?',
            area('accessInstructions', '', P.accessInstructions, 2)) +
          field('accessQuestions', 'Your Request Access questions',
            (P.accessQuestions.length
              ? '<ul class="gp-agreements">' + P.accessQuestions.map(function (q, i) {
                  return '<li>' + h(q.label) + (q.required ? ' <em>required</em>' : '') +
                    '<button type="button" class="gp-chip-x" data-do="drop-question" data-i="' + i + '" aria-label="Remove">×</button></li>';
                }).join('') + '</ul>'
              : '<p class="gp-hint">No questions. People can still add a note.</p>') +
            '<div class="gp-row"><input class="gp-input" type="text" id="gpQuestion" placeholder="e.g. Which watershed do you tend?">' +
            '<label class="gp-inline-check"><input type="checkbox" id="gpQuestionReq"> required</label>' +
            '<button class="gp-btn gp-btn--ghost" type="button" data-do="add-question">Add</button></div>',
            { hint: 'Kept short. Every question is one more reason someone closes the tab.' }) +
          field('sharedInfoNote', 'What stewards see from a request',
            area('sharedInfoNote', '', P.sharedInfoNote, 2),
            { hint: 'Shown to the person before they submit. Say it plainly.' })
        : '') +
      field('allowInvites', 'Invitations',
        '<label class="gp-check"><input type="checkbox" data-do="toggle-invites"' + (P.allowInvites ? ' checked' : '') + '>' +
        '<span><strong>Members may invite others</strong><br><span class="gp-hint">Their invitations open Request Access. Only a Group Admin, or a role you give the authority to, can send an invitation that grants membership directly.</span></span></label>') +
      field('countDisplay', 'How should the Group’s size show?',
        cards(LIF.GROUP_COUNT_DISPLAY, P.countDisplay, 'set-count'),
        { hint: 'Capacity still shows clearly wherever it affects Request Access, whichever you pick.' }) +
      field('capacity', 'Maximum Members',
        '<input class="gp-input" type="number" min="1" data-set="capacity" value="' + h(P.capacity == null ? '' : P.capacity) + '" placeholder="Leave blank for no limit">',
        { hint: 'When a Group is full, new requests join a waitlist rather than being refused.' });
  }

  function stepPeople() {
    return '<div class="gp-readback"><strong>' + h(LIF.groups.memberName()) + '</strong>' +
        '<span>' + h(LIF.groups.memberEmail()) + '</span>' +
        '<em>You are the creator, and the first Group Admin. That is a responsibility, not a rank.</em></div>' +
      field('stewards', 'Who else will steward this?',
        (P.stewards.length
          ? '<ul class="gp-agreements">' + P.stewards.map(function (s, i) {
              return '<li>' + h(s.name) + ' — ' + h((LIF.GROUP_ROLES.find(function (r) { return r.id === s.role; }) || {}).name || s.role) +
                '<button type="button" class="gp-chip-x" data-do="drop-steward" data-i="' + i + '" aria-label="Remove">×</button></li>';
            }).join('') + '</ul>'
          : '<p class="gp-hint">None yet.</p>') +
        '<div class="gp-row">' +
          '<input class="gp-input" type="text" id="gpSteward" placeholder="Name or email search">' +
          '<select class="gp-input" id="gpStewardRole">' +
            LIF.GROUP_ROLES.filter(function (r) { return r.id === 'admin' || r.id === 'moderator'; }).map(function (r) {
              return '<option value="' + r.id + '">' + h(r.name) + '</option>';
            }).join('') + '</select>' +
          '<button class="gp-btn gp-btn--ghost" type="button" data-do="add-steward">Add</button>' +
        '</div>',
        { req: true, help: 'A second Group Admin matters: the last accountable Admin cannot leave until someone replaces them. You can add one now or as an activation task after approval.' }) +
      field('initialMembers', 'Anyone already with you?',
        (P.initialMembers.length
          ? '<div class="gp-chips">' + P.initialMembers.map(function (m, i) {
              return '<span class="gp-chip is-static">' + h(m) +
                '<button type="button" class="gp-chip-x" data-do="drop-initial" data-i="' + i + '" aria-label="Remove">×</button></span>';
            }).join('') + '</div>'
          : '<p class="gp-hint">None yet.</p>') +
        '<div class="gp-row"><input class="gp-input" type="text" id="gpInitial" placeholder="Name or email">' +
        '<button class="gp-btn gp-btn--ghost" type="button" data-do="add-initial">Add</button></div>',
        { hint: 'They receive an invitation once the Group is approved, not now.' });
  }

  function stepAreas() {
    var rec = (LIF.GROUP_STRUCTURES.find(function (s) { return s.id === P.structure; }) || {}).areas || [];
    if (!P.areas) P.areas = rec.slice();
    return '<p class="gp-lead">One shared workspace. These are the Group Areas — not modules — and they can be switched on or off later without rebuilding anything.</p>' +
      '<div class="gp-checks">' + LIF.GROUP_AREAS.map(function (a) {
        var on = a.core || P.areas.indexOf(a.id) !== -1;
        var recommended = rec.indexOf(a.id) !== -1;
        return '<label class="gp-check' + (a.core ? ' is-locked' : '') + '">' +
          '<input type="checkbox" data-do="toggle-area" data-value="' + a.id + '"' +
            (on ? ' checked' : '') + (a.core ? ' disabled' : '') + '>' +
          '<span><strong>' + h(a.name) + '</strong>' +
            (a.core ? ' <span class="gp-lock">always on</span>' : (recommended ? ' <span class="gp-rec">recommended for ' + h(LIF.groups.structureMeta(P.structure).name) + '</span>' : '')) +
            '<br><span class="gp-hint">' + h(a.desc) + '</span></span></label>';
      }).join('') + '</div>' +
      field('connections', 'Did this grow out of something?',
        '<label class="gp-sublabel">An Event it came from</label>' +
        '<select class="gp-input" data-set="origin-event"><option value="">Nothing in particular</option>' +
          LIF.EVENTS.filter(function (e) { return e.status === 'complete'; }).map(function (e) {
            return '<option value="' + e.id + '"' + (P.originEventId === e.id ? ' selected' : '') + '>' + h(e.title) + '</option>';
          }).join('') + '</select>' +
        '<label class="gp-sublabel">Groups it relates to</label>' +
        '<div class="gp-chips">' + LIF.groups.exploreGroups().slice(0, 8).map(function (g) {
          var on = P.relatedGroups.indexOf(g.id) !== -1;
          return '<button type="button" class="gp-chip' + (on ? ' is-on' : '') + '" data-do="toggle-related" data-value="' + g.id + '">' + h(g.name) + '</button>';
        }).join('') + '</div>',
        { hint: 'Connecting is consent-based — the other Group decides. Nothing merges and no content moves.' });
  }

  var BODIES = {
    identity: stepIdentity, purpose: stepPurpose, classification: stepClassification,
    structure: stepStructure, access: stepAccess, people: stepPeople, areas: stepAreas
  };

  /* =========================================================
   * 3. PREVIEW — the card and the Details, exactly as they will
   * appear (§6.2 step 4).
   * ======================================================= */
  function coverPreview() {
    if (P.image) return 'url(' + P.image + ') center/cover';
    var stops = (LIF.SECTOR_COVERS && LIF.SECTOR_COVERS[P.sector]) || ['#755091', '#C89CD8'];
    return 'linear-gradient(135deg, ' + stops[0] + ', ' + stops[1] + ')';
  }

  function previewGroup() {
    var g = LIF.groups.proposalToGroup(Object.assign({}, P, { groupRef: P.groupRef || 'LIFG-preview', status: 'active' }));
    g.memberCount = 1 + P.initialMembers.length;
    return g;
  }

  function previewBody() {
    var g = previewGroup();
    var sector = LIF.SECTORS.find(function (s) { return s.id === P.sector; });
    var access = LIF.GROUP_DISCOVERABILITY.find(function (d) { return d.id === P.discoverability; }) || {};
    var join = LIF.GROUP_JOIN_METHODS.find(function (j) { return j.id === P.joinMethod; }) || {};

    return '<div class="gp-preview">' +
      '<div class="gp-preview-col">' +
        '<p class="gp-preview-label">The Group card, as people will see it</p>' +
        '<article class="gcard">' +
          '<div class="gcard-cover" style="background:' + coverPreview() + '"></div>' +
          '<div class="gcard-body">' +
            '<h4>' + h(P.name || 'Your Group') + '</h4>' +
            '<p class="gcard-desc">' + h(P.cardSummary || P.description || '') + '</p>' +
            '<div class="gcard-tags">' +
              (sector ? '<span class="gbadge">' + h(sector.name) + '</span>' : '') +
              (P.subsector ? '<span class="gbadge">' + h(P.subsector) + '</span>' : '') +
              (P.structure ? '<span class="gbadge">' + h(LIF.groups.structureMeta(P.structure).name) + '</span>' : '') +
              (P.format ? '<span class="gbadge">' + h(P.format) + '</span>' : '') +
              '<span class="gbadge">' + h(P.languages.primary) + '</span>' +
              '<span class="gbadge gbadge--state">Active</span>' +
            '</div>' +
            '<div class="gcard-foot">' +
              '<span class="gcard-count">' + h(LIF.groups.countLabel(g)) + '</span>' +
              '<span class="gcard-action">' + h(P.joinMethod === 'invitation' ? 'Invitation only' : 'Request Access') + '</span>' +
            '</div>' +
          '</div>' +
        '</article>' +

        '<p class="gp-preview-label">What a reviewer will read</p>' +
        '<div class="gp-summary">' +
          summaryRow('Purpose', P.purpose) +
          summaryRow('Who it is for', P.whoFor) +
          summaryRow('What is alive at the start', P.activityPlan) +
          summaryRow('Contribution to the ecosystem', P.contribution) +
          summaryRow('Meeting rhythm', P.participation) +
          summaryRow('Stewards', [LIF.groups.memberName() + ' (Group Admin)']
            .concat(P.stewards.map(function (s) { return s.name; })).join(', ')) +
          summaryRow('Already with you', P.initialMembers.join(', ')) +
        '</div>' +
      '</div>' +

      '<div class="gp-preview-col">' +
        '<p class="gp-preview-label">Group Details</p>' +
        '<div class="gp-details-preview">' +
          '<h3>' + h(P.name || 'Your Group') + '</h3>' +
          '<p>' + h(P.purpose || '') + '</p>' +
          (P.whoFor ? '<p><strong>Who this is for:</strong> ' + h(P.whoFor) + '</p>' : '') +
          '<dl class="gp-dl">' +
            row('Structure', P.structure ? LIF.groups.structureMeta(P.structure).name : '—') +
            row('Format', [P.format, P.location && P.location.city].filter(Boolean).join(' · ') || '—') +
            row('Language', [P.languages.primary].concat(P.languages.supported).join(', ')) +
            row('Accessibility', P.accessibility.notes || 'Not yet described') +
            row('Discoverability', access.name || '—') +
            row('Joining', join.name || '—') +
            row('Members shown as', (LIF.GROUP_COUNT_DISPLAY.find(function (c) { return c.id === P.countDisplay; }) || {}).name) +
            (P.capacity ? row('Capacity', P.capacity + ' Members') : '') +
          '</dl>' +
          (P.agreements.length
            ? '<h4>Agreements</h4><ul class="gp-plain-list">' + P.agreements.map(function (a) { return '<li>' + h(a) + '</li>'; }).join('') + '</ul>'
            : '') +
          '<h4>Group Areas</h4>' +
          '<p class="gp-hint">' + LIF.GROUP_AREAS.filter(function (a) {
            return a.core || (P.areas || []).indexOf(a.id) !== -1;
          }).map(function (a) { return h(a.name); }).join(' · ') + '</p>' +
          '<div class="gp-primary-preview">' +
            (P.joinMethod === 'invitation' ? 'Invitation only' : 'Request Access') +
          '</div>' +
          '<p class="gp-hint">One primary action. Someone who is not authorized never sees private metadata.</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function summaryRow(k, v) {
    return '<div class="gp-summary-row"><dt>' + h(k) + '</dt><dd>' + (v ? h(v) : '<em>not answered</em>') + '</dd></div>';
  }
  function row(k, v) {
    return '<div><dt>' + h(k) + '</dt><dd>' + h(v || '—') + '</dd></div>';
  }

  /* =========================================================
   * 4. VALIDATE — §6.2 step 5: missing required fields,
   * conditional fields, AND access/privacy consequences.
   * ======================================================= */
  function validate() {
    problems = [];
    function need(cond, stepId, fieldKey, text) {
      if (!cond) problems.push({ level: 'need', step: stepId, field: fieldKey, text: text });
    }
    need(P.name.trim(), 'identity', 'name', 'The Group needs a name.');
    need(P.description.trim().length >= 15, 'identity', 'description', 'A short description — one or two sentences is enough. This is the whole card.');
    need(P.purpose.trim().length >= 30, 'purpose', 'purpose', 'Say what the Group is here for. A reviewer cannot make a relational decision without it.');
    need(P.whoFor.trim(), 'purpose', 'whoFor', 'Who is this for? Intended participants are needed for informed review.');
    need(P.sector, 'classification', 'sector', 'Pick the interest or sector it belongs to.');
    need(P.structure, 'structure', 'structure', 'Pick how the Group gathers.');
    need(P.format, 'structure', 'format', 'In person, online or hybrid?');
    need(!(P.format === 'in-person' || P.format === 'hybrid') || (P.location && P.location.city),
      'structure', 'location', 'In-person and hybrid Groups need at least a city.');
    need(P.discoverability, 'access', 'discoverability', 'Choose who can find the Group.');
    need(P.joinMethod, 'access', 'joinMethod', 'Choose how someone comes in.');

    /* §6.2 step 5 explicitly asks for access and privacy
       CONSEQUENCES, not just missing fields. These are not errors —
       they are what the choice will actually mean. */
    var consequences = [];
    if (P.discoverability === 'discoverable') {
      consequences.push('Anyone authorized to browse will find this Group in Explore, search, filters and — if it has coordinates — the Map.');
    } else if (P.discoverability === 'unlisted') {
      consequences.push('This Group will not appear in discovery. People reach it only by a direct link or an invitation, so you will need to share it yourself.');
    } else {
      consequences.push('Nothing about this Group shows to anyone outside it. It grows only from invitations you send.');
    }
    if (P.joinMethod === 'request') {
      consequences.push('Every request waits on a steward. If nobody reviews them, people sit in Request Pending — that is a real commitment of your time.');
    } else {
      consequences.push('Nobody can ask to join. The Group grows only when a steward sends an invitation.');
    }
    if (P.countDisplay === 'hidden') {
      consequences.push('Your Member count is hidden. Capacity still shows wherever it affects Request Access, because people deserve to know if a Group is full before they ask.');
    }
    if (P.discoverability === 'private' && P.allowInvites) {
      consequences.push('This is a private Group where Members may invite others. Their invitations open Request Access rather than granting membership, so you keep the final say.');
    }
    if (!P.stewards.some(function (s) { return s.role === 'admin'; })) {
      consequences.push('You are currently the only Group Admin. You will not be able to leave the Group until a second one is in place — you can add one now or as an activation task after approval.');
    }
    if (P.areas && P.areas.indexOf('chat') !== -1) {
      consequences.push('Chat is retained while the Group is active and archived with it. That retention is disclosed to Members.');
    }
    if (P.areas && P.areas.indexOf('events') !== -1) {
      consequences.push('Group Events use the shared Events pathway — the same registration, reminders, payment, cancellation and follow-up rules as every other LiF Event.');
    }

    return { problems: problems, consequences: consequences, checks: LIF.groups.proposalChecks(P) };
  }

  function validateBody() {
    var v = validate();
    return '<div class="gp-validate">' +
      (v.problems.length
        ? '<div class="gp-alert gp-alert--need"><strong>Still needed before this can go to review</strong>' +
          '<ul>' + v.problems.map(function (p) {
            return '<li>' + h(p.text) + ' <button type="button" class="gp-edit" data-do="goto-field" ' +
              'data-value="' + p.step + '" data-field="' + p.field + '">go there</button></li>';
          }).join('') + '</ul></div>'
        : '<div class="gp-alert gp-alert--ok"><strong>Everything a reviewer needs is here.</strong>' +
          '<p>Nothing was blocked while you drafted — requiredness only applies at submission, so you could write in any order.</p></div>') +

      '<section class="gp-vsection"><h4>What your access and privacy choices will mean</h4>' +
        '<ul class="gp-consequences">' + v.consequences.map(function (c) { return '<li>' + h(c) + '</li>'; }).join('') + '</ul>' +
      '</section>' +

      (v.checks.length
        ? '<section class="gp-vsection"><h4>Automated checks</h4>' +
          '<ul class="gp-checks-list">' + v.checks.map(function (c) {
            return '<li class="is-' + c.level + '">' + h(c.text) + '</li>';
          }).join('') + '</ul>' +
          '<p class="gp-hint">These flag; they do not decide. A human LiF steward makes the relational and contextual call.</p>' +
        '</section>'
        : '') +

      '<section class="gp-vsection"><h4>What happens when you submit</h4>' +
        '<ol class="gp-next">' +
          '<li>The proposal becomes <strong>Pending Review</strong> and gets a reference you can quote.</li>' +
          '<li>You get a confirmation with next steps, a support contact and a link to the status.</li>' +
          '<li>It appears on your dashboard under <strong>Groups → Proposed</strong>.</li>' +
          '<li>Automated checks run for completeness, duplicate names and possible overlap — then a human steward reads it.</li>' +
          '<li>You may hear back with an approval, a request for changes, an offer of support or mentoring, or a suggestion to connect with an existing Group. LiF will not merge or reroute your proposal without your consent.</li>' +
          '<li>On approval the Group becomes <strong>Forming</strong> while you finish any activation tasks, then goes to its approved visible state.</li>' +
        '</ol>' +
        '<p class="gp-hint">Review is for ecosystem awareness, orientation and connection with similar work. It is not meant to feel like an unexplained gate.</p>' +
      '</section>' +
    '</div>';
  }

  /* =========================================================
   * 5. DONE
   * ======================================================= */
  function doneBody() {
    var out = LIF.groupStore.outbox().filter(function (m) { return m.groupId === P.id; });
    return '<div class="gp-done">' +
      '<div class="gp-done-mark">✓</div>' +
      '<h2>Thank you, ' + h(LIF.groups.preferredName()) + '.</h2>' +
      '<p class="gp-lead">Your proposal is with LiF. You will hear back — and if there is a lot to talk through, that may be a conversation rather than an email.</p>' +
      '<div class="gp-done-id"><span>Proposal reference</span><strong>' + h(P.groupRef) + '</strong>' +
        '<span class="gp-status-pill">Pending Review</span></div>' +
      '<div class="gp-done-block">' +
        '<h4>Your next steps</h4>' +
        '<ul class="gp-plain-list">' +
          '<li>Track it on your dashboard under <strong>Groups → Proposed</strong>.</li>' +
          '<li>Nothing is visible to anyone else while it is pending.</li>' +
          '<li>Support contact: <strong>groups@loveisfoundation.org</strong></li>' +
        '</ul>' +
      '</div>' +
      (out.length
        ? '<div class="gp-done-block"><h4>What just went out</h4>' +
          '<ul class="gp-outbox">' + out.map(function (m) {
            return '<li><span class="gp-kind">' + h(m.kind) + '</span><div><strong>' + h(m.subject) + '</strong><br>' +
              '<span class="gp-hint">To ' + h(m.to) + ' — ' + h(m.body) + '</span></div></li>';
          }).join('') + '</ul>' +
          '<p class="gp-hint">Queued, not sent — there is no mail service behind this build. Each carries its trigger, audience, channel, template and delivery state, which is what a real one will read.</p></div>'
        : '') +
      '<div class="gp-done-actions">' +
        '<a class="gp-btn gp-btn--primary" href="group.html?id=' + encodeURIComponent(proposalGroupId()) + '">See your proposal</a>' +
        '<a class="gp-btn gp-btn--ghost" href="dashboard.html">Go to my dashboard</a>' +
        '<button class="gp-btn gp-btn--ghost" type="button" data-do="close">Close</button>' +
      '</div>' +
    '</div>';
  }

  function proposalGroupId() {
    return 'grp-' + String(P.groupRef || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  /* =========================================================
   * 6. SHELL
   * ======================================================= */
  function welcomeBody() {
    var d = LIF.groups.drafts();
    return '<div class="gp-welcome">' +
      '<p class="gp-eyebrow">Propose a new Group</p>' +
      '<h2>Welcome, ' + h(LIF.groups.preferredName()) + '.</h2>' +
      '<p class="gp-lead">A Group is a gathering place, not a broadcast channel. This pathway asks what it is for, who it serves and how someone comes in — in seven short steps, saved as you go.</p>' +
      '<div class="gp-why">' +
        '<h4>Why LiF reads it first</h4>' +
        '<p>So the ecosystem knows what is forming, so you can be pointed at people already doing similar work, and so a Group starts with enough stewardship to last. It is not meant to feel like an unexplained gate, and you can be offered support or a mentor rather than a verdict.</p>' +
      '</div>' +
      '<div class="gp-welcome-actions">' +
        '<button class="gp-btn gp-btn--primary" type="button" data-do="start">Start a proposal</button>' +
      '</div>' +
      (d.length
        ? '<div class="gp-drafts"><h4>Or pick up where you left off</h4>' +
          d.map(function (x) {
            return '<button type="button" class="gp-draft" data-do="load-draft" data-value="' + h(x.id) + '">' +
              '<strong>' + h(x.name || 'Untitled proposal') + '</strong>' +
              '<span>saved ' + h(new Date(x.updatedAt).toLocaleString()) + '</span></button>';
          }).join('') + '</div>'
        : '') +
      '<p class="gp-hint gp-welcome-note">Nothing is required while you write. The pathway only checks what a reviewer needs at the moment you submit.</p>' +
    '</div>';
  }

  function stepNav() {
    return '<nav class="gp-steps">' + STEPS.map(function (s, i) {
      var cls = view === 'steps' && i === step ? ' is-on' : (stepComplete(s.id) ? ' is-done' : '');
      return '<button type="button" class="gp-stepdot' + cls + '" data-do="goto-step" data-value="' + i + '">' +
        '<i>' + (i + 1) + '</i>' + h(s.title) + '</button>';
    }).join('') +
      '<button type="button" class="gp-stepdot' + (view === 'preview' ? ' is-on' : '') + '" data-do="go-preview"><i>◉</i>Preview</button>' +
      '<button type="button" class="gp-stepdot' + (view === 'validate' ? ' is-on' : '') + '" data-do="go-validate"><i>✓</i>Check</button>' +
    '</nav>';
  }

  /** A step counts as done when nothing in it is still needed. */
  function stepComplete(id) {
    var v = validate();
    return !v.problems.some(function (p) { return p.step === id; });
  }

  function shellHtml() {
    var s = STEPS[step];
    var body =
      view === 'welcome' ? welcomeBody() :
      view === 'preview' ? previewBody() :
      view === 'validate' ? validateBody() :
      view === 'done' ? doneBody() :
      '<div class="gp-step"><p class="gp-step-of">Step ' + (step + 1) + ' of ' + STEPS.length + '</p>' +
        '<h2>' + h(s.title) + '</h2><p class="gp-lead">' + h(s.lead) + '</p>' +
        BODIES[s.id]() + '</div>';

    return '<div class="gp-shell">' +
      '<header class="gp-head">' +
        '<div><p class="gp-eyebrow">Group proposal</p><h1>' + h(P.name || 'A new Group') + '</h1></div>' +
        '<div class="gp-head-right">' +
          '<span class="gp-status">' + h(view === 'done' ? 'Pending Review' : 'Draft') + '</span>' +
          '<button class="gp-x-big" type="button" data-do="close" aria-label="Close">×</button>' +
        '</div>' +
      '</header>' +
      (view === 'welcome' || view === 'done' ? '' : stepNav()) +
      '<div class="gp-scroll">' + body + '</div>' +
      (view === 'welcome' || view === 'done' ? '' :
        '<footer class="gp-foot">' +
          '<button class="gp-btn gp-btn--ghost" type="button" data-do="back">Back</button>' +
          '<span class="gp-foot-note" id="gpFootNote">Saved automatically.</span>' +
          (view === 'validate'
            ? '<button class="gp-btn gp-btn--primary" type="button" data-do="submit">Submit for review</button>'
            : '<button class="gp-btn gp-btn--primary" type="button" data-do="forward">Save &amp; continue</button>') +
        '</footer>') +
    '</div>';
  }

  /* =========================================================
   * 7. WIRING
   * ======================================================= */
  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'groupProposalRoot';
    root.className = 'gp-root hidden';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    return root;
  }

  function render(keepFocus) {
    var active = document.activeElement;
    var key = active && active.dataset ? (active.dataset.set || active.id) : null;
    var caret = active && active.selectionStart != null ? active.selectionStart : null;
    var scroll = root.querySelector('.gp-scroll') ? root.querySelector('.gp-scroll').scrollTop : 0;

    root.innerHTML = shellHtml();

    var sc = root.querySelector('.gp-scroll');
    if (sc) sc.scrollTop = scroll;
    if (keepFocus && key) {
      var el = root.querySelector('[data-set="' + key + '"]') || root.querySelector('#' + key);
      if (el) {
        el.focus();
        if (caret != null && el.setSelectionRange && /text|search|url|email|tel/.test(el.type || 'text')) {
          try { el.setSelectionRange(caret, caret); } catch (e) {}
        }
      }
    }
  }

  var RESHAPE = { sector: 1, 'lang-primary': 1 };

  function onInput(e) {
    var el = e.target.closest('[data-set]');
    if (!el) return;
    write(el.dataset.set, el.value);
    if (RESHAPE[el.dataset.set]) render(true);
    scheduleSave();
  }

  function onChange(e) {
    var el = e.target.closest('[data-set]');
    if (el) { write(el.dataset.set, el.value); render(true); scheduleSave(); return; }
    var f = e.target.closest('[data-do="pick-image"]');
    if (f && f.files && f.files[0]) {
      var r = new FileReader();
      r.onload = function () { P.image = r.result; render(); scheduleSave(); };
      r.readAsDataURL(f.files[0]);
    }
  }

  function write(key, value) {
    var num = function (v) { return v === '' ? null : +v; };
    switch (key) {
      case 'name': case 'description': case 'cardSummary': case 'purpose': case 'whoFor':
      case 'activityPlan': case 'contribution': case 'participation':
      case 'accessInstructions': case 'sharedInfoNote':
        P[key] = value; break;
      case 'sector':
        P.sector = value;
        if ((LIF.SUBSECTORS[value] || []).indexOf(P.subsector) === -1) P.subsector = '';
        break;
      case 'subsector': P.subsector = value; break;
      case 'lang-primary':
        P.languages.primary = value;
        P.languages.supported = P.languages.supported.filter(function (l) { return l !== value; });
        break;
      case 'access-notes': P.accessibility.notes = value; break;
      case 'access-contact': P.accessibility.contact = value; break;
      case 'capacity': P.capacity = num(value); break;
      case 'origin-event': P.originEventId = value || null; break;
      case 'loc-city': case 'loc-region': case 'loc-country':
        P.location = P.location || {};
        P.location[key.slice(4)] = value;
        break;
      case 'loc-lat': P.location = P.location || {}; P.location.lat = num(value); break;
      case 'loc-lng': P.location = P.location || {}; P.location.lng = num(value); break;
    }
  }

  function onClick(e) {
    var el = e.target.closest('[data-do]');
    if (!el) return;
    var v = el.dataset.value;
    var i = el.dataset.i != null ? +el.dataset.i : null;

    switch (el.dataset.do) {
      case 'close': close(); return;
      case 'start': view = 'steps'; step = 0; render(); return;
      case 'load-draft': P = LIF.groups.getDraft(v) || P; view = 'steps'; step = 0; render(); return;
      case 'help': openHelp[v] = !openHelp[v]; render(); return;

      case 'goto-step': view = 'steps'; step = +v; render(); return;
      case 'go-preview': view = 'preview'; render(); save(); return;
      case 'go-validate': view = 'validate'; render(); save(); return;
      case 'goto-field': {
        view = 'steps';
        step = Math.max(0, STEPS.findIndex(function (s) { return s.id === v; }));
        render();
        var node = root.querySelector('[data-field="' + el.dataset.field + '"]');
        if (node) { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); node.classList.add('is-flash'); }
        return;
      }
      case 'back':
        if (view === 'validate') view = 'preview';
        else if (view === 'preview') { view = 'steps'; step = STEPS.length - 1; }
        else if (step > 0) step--;
        else view = 'welcome';
        render(); return;
      case 'forward':
        if (view === 'steps' && step < STEPS.length - 1) step++;
        else if (view === 'steps') view = 'preview';
        else if (view === 'preview') view = 'validate';
        render(); save(); return;

      case 'submit': submit(); return;

      /* --- per-field --- */
      case 'set-structure':
        P.structure = v;
        P.areas = (LIF.GROUP_STRUCTURES.find(function (s) { return s.id === v; }) || {}).areas.slice();
        render(); return;
      case 'set-format': P.format = v; render(); return;
      case 'set-discoverability':
        P.discoverability = v;
        /* A private Group cannot also take open requests - the doc
           makes invitation the only way in. Keep the two honest. */
        if (v === 'private') P.joinMethod = 'invitation';
        render(); return;
      case 'set-join': P.joinMethod = v; render(); return;
      case 'set-count': P.countDisplay = v; render(); return;
      case 'toggle-invites': P.allowInvites = !P.allowInvites; render(); return;
      case 'toggle-lang': toggle(P.languages.supported, v); render(); return;
      case 'toggle-area': toggle(P.areas = P.areas || [], v); render(); return;
      case 'toggle-related': toggle(P.relatedGroups, v); render(); return;
      case 'clear-image': P.image = null; render(); return;

      case 'add-tag': {
        var t = root.querySelector('#gpTag');
        if (!t.value.trim()) { note('Type a tag first.'); return; }
        P.tags.push(t.value.trim()); render(); save(); return;
      }
      case 'drop-tag': P.tags.splice(i, 1); render(); return;

      case 'add-agreement': {
        var a = root.querySelector('#gpAgreement');
        if (!a.value.trim()) { note('Type the agreement first.'); return; }
        P.agreements.push(a.value.trim()); render(); save(); return;
      }
      case 'drop-agreement': P.agreements.splice(i, 1); render(); return;

      case 'add-question': {
        var q = root.querySelector('#gpQuestion');
        if (!q.value.trim()) { note('Type the question first.'); return; }
        P.accessQuestions.push({
          key: 'q' + (P.accessQuestions.length + 1),
          label: q.value.trim(),
          required: root.querySelector('#gpQuestionReq').checked
        });
        render(); save(); return;
      }
      case 'drop-question': P.accessQuestions.splice(i, 1); render(); return;

      case 'add-steward': {
        var sName = root.querySelector('#gpSteward');
        if (!sName.value.trim()) { note('Name or email first.'); return; }
        P.stewards.push({ name: sName.value.trim(), role: root.querySelector('#gpStewardRole').value });
        render(); save(); return;
      }
      case 'drop-steward': P.stewards.splice(i, 1); render(); return;

      case 'add-initial': {
        var m = root.querySelector('#gpInitial');
        if (!m.value.trim()) { note('Name or email first.'); return; }
        P.initialMembers.push(m.value.trim()); render(); save(); return;
      }
      case 'drop-initial': P.initialMembers.splice(i, 1); render(); return;

      case 'suggest-sub': {
        var ns = root.querySelector('#gpNewSub');
        if (!ns.value.trim()) { note('Type the term first.'); return; }
        P.subsectorSuggestion = ns.value.trim();
        toast('Noted. “' + P.subsectorSuggestion + '” goes through the same LiF-wide taxonomy review that What Interests Me uses — not a separate Group-only process.');
        render(); return;
      }
    }
  }

  function toggle(arr, v) {
    var i = arr.indexOf(v);
    if (i === -1) arr.push(v); else arr.splice(i, 1);
  }

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 600);
  }
  function save() {
    if (!P || view === 'done') return;
    LIF.groups.saveDraft(P);
    note('Saved ' + new Date().toLocaleTimeString() + '.');
  }
  function note(msg) {
    var n = root && root.querySelector('#gpFootNote');
    if (n) n.textContent = msg;
  }
  function toast(msg) {
    if (LIF.util && LIF.util.showToast && document.getElementById('toast')) LIF.util.showToast(msg);
    else note(msg);
  }

  function submit() {
    var v = validate();
    if (v.problems.length) {
      view = 'validate';
      render();
      toast('A few things a reviewer needs are still missing.');
      return;
    }
    var saved = LIF.groups.submitProposal(P);
    P.groupRef = saved.groupRef;
    P.id = saved.id;
    P.status = 'pending';
    view = 'done';
    render();
    if (LIF.MEMBER && LIF.MEMBER.groups.proposed.indexOf(saved.id) === -1) LIF.MEMBER.groups.proposed.push(saved.id);
    document.dispatchEvent(new CustomEvent('lif:groupproposed', { detail: saved }));
  }

  /* =========================================================
   * 8. PUBLIC
   * ======================================================= */
  function open(opts) {
    opts = opts || {};
    ensureRoot();
    P = opts.proposal || blank();
    if (opts.originEventId) P.originEventId = opts.originEventId;
    view = opts.view || 'welcome';
    step = 0; openHelp = {}; problems = [];
    render();
    root.classList.remove('hidden');
    document.body.classList.add('gp-open');
  }

  function close() {
    if (!root) return;
    if (view !== 'done' && P && (P.name || P.purpose)) save();
    root.classList.add('hidden');
    document.body.classList.remove('gp-open');
    document.dispatchEvent(new CustomEvent('lif:groupschange'));
  }

  function init() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-propose-group]');
      if (!el) return;
      e.preventDefault();
      open({ originEventId: el.dataset.originEvent || null });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root && !root.classList.contains('hidden')) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { open: open, close: close };
})();
