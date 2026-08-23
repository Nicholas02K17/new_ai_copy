/**
 * groupPage.js
 * ---------------------------------------------------------------
 * One page, two faces, decided by what the viewer is authorized to
 * do rather than by a URL:
 *
 *   Group Details (§4.2) — the authoritative record. What a Guest,
 *   a non-member or an invitee sees. One context-appropriate
 *   primary action; private metadata never leaks into it.
 *
 *   Group Home (§9)      — what a Member sees. Welcome, what is
 *   alive now, ways to engage, and the enabled Group Areas.
 *
 * The doc is emphatic that these are one record, not two pages:
 * "Every Group card opens one authoritative Group Details record."
 * So there is one renderer and one data source, and the difference
 * between the two faces is a permission check, never a second copy
 * of the Group's information.
 *
 * Everything the doc marks "Prototype required" carries the
 * PROTOTYPE — REQUIRES LiF APPROVAL label on screen.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.groupPage = (function () {
  var U = LIF.util;
  var h = U.escapeHtml;
  var G = LIF.groups;

  var group = null;
  var area = 'home';          // which Group Area is open
  var panel = null;           // request | invitation | leave | report | announce | settings | notifications | call | connect
  var draft = {};             // scratch state for whichever panel is open
  var mapObj = null;

  function q(n) { return new URLSearchParams(location.search).get(n); }

  /* Every unapproved asset says so, per §22's prototype rule. */
  function proto(inner) {
    return '<div class="g-proto"><span class="g-proto-tag">' + h(LIF.PROTOTYPE_LABEL) + '</span>' + inner + '</div>';
  }

  /* =========================================================
   * 1. SHARED PIECES
   * ======================================================= */
  function stateBadge(g) {
    return '<span class="gbadge gbadge--state g-state-' + h(g.status) + '">' + h(G.stateMeta(g.status).name) + '</span>';
  }

  function hero(g) {
    var sector = U.getSector(g.sector);
    var member = G.isMember(g.id);
    return '<header class="g-hero">' +
      '<div class="g-cover" style="background:' + G.coverCss(g) + '"></div>' +
      '<div class="g-hero-body">' +
        '<div class="gcard-tags">' +
          stateBadge(g) +
          (sector ? '<span class="gbadge">' + h(sector.name) + '</span>' : '') +
          (g.subsector ? '<span class="gbadge">' + h(g.subsector) + '</span>' : '') +
          '<span class="gbadge">' + h(G.structureMeta(g.structure).name) + '</span>' +
          '<span class="gbadge">' + h(g.format) + '</span>' +
          '<span class="gbadge">' + h(g.languages.primary) + '</span>' +
          (g.access.discoverability === 'private' ? '<span class="gbadge gbadge--lock">Private</span>' : '') +
          (g.originEventId ? '<span class="gbadge">Grew from an Event</span>' : '') +
        '</div>' +
        '<h1 class="g-title">' + h(g.name) + '</h1>' +
        '<p class="g-summary">' + h(g.description) + '</p>' +
        '<p class="g-meta mono">' + h(G.countLabel(g)) +
          (G.capacityNote(g) ? ' · ' + h(G.capacityNote(g)) : '') +
          (member ? ' · you are a Member' : '') + '</p>' +
      '</div>' +
    '</header>';
  }

  function statusBanner(g) {
    if (g.status === 'active') return '';
    var tone = g.status === 'archived' ? 'done'
      : (g.status === 'paused' || g.status === 'closing') ? 'warn'
      : g.status === 'quiet' ? 'quiet' : 'wait';
    return '<div class="g-banner g-banner--' + tone + '">' +
      '<strong>' + h(G.stateMeta(g.status).name) + '</strong>' +
      '<span>' + h(g.statusNote || G.stateMeta(g.status).desc) + '</span>' +
      (g.status === 'quiet' && G.isSteward(g)
        ? '<button class="g-btn g-btn--sm" type="button" data-do="confirm-activity">Confirm what is alive now</button>'
        : '') +
    '</div>';
  }

  /** §4.2: one context-appropriate primary action. */
  function primaryActionHtml(g) {
    var a = G.primaryAction(g);
    var cls = 'g-cta' + (a.enabled ? '' : ' g-cta--off');
    var btn;
    switch (a.id) {
      case 'request':  btn = '<button class="' + cls + '" type="button" data-do="open-request">' + h(a.label) + '</button>'; break;
      case 'accept':
      case 'apply':    btn = '<button class="' + cls + '" type="button" data-do="open-invitation">' + h(a.label) + '</button>'; break;
      case 'open':     btn = '<button class="' + cls + '" type="button" data-do="open-home">' + h(a.label) + '</button>'; break;
      case 'follow':   btn = '<button class="' + cls + '" type="button" data-do="follow">' +
                         h(G.isFollowing(g.id) ? '✓ Following' : a.label) + '</button>'; break;
      case 'signup':   btn = '<a class="' + cls + '" href="register.html">' + h(a.label) + '</a>'; break;
      default:         btn = '<div class="' + cls + '">' + h(a.label) + '</div>';
    }
    return btn + (a.note ? '<p class="g-cta-note">' + h(a.note) + '</p>' : '');
  }

  /* =========================================================
   * 2. GROUP DETAILS — the outside view (§4.2)
   * ======================================================= */
  function detailsView(g) {
    var stewards = (g.stewards || []).filter(function (s) { return s.public; });
    var events = G.groupEvents(g).filter(function (e) { return e.visibility === 'public'; });
    var related = (g.connections.groups || []).map(G.get).filter(function (x) { return x && G.canDiscover(x); });
    var publicResources = G.resources(g.id).filter(function (r) { return r.audience === 'public'; });

    return '<div class="g-grid">' +
      '<div class="g-main">' +

        '<section class="g-card">' +
          '<h2>What this Group is here for</h2>' +
          '<div class="g-prose">' + para(g.purpose) + '</div>' +
          (g.whoFor ? '<div class="g-aside"><strong>Who this is for</strong><p>' + h(g.whoFor) + '</p></div>' : '') +
          (g.activityPlan
            ? '<div class="g-aside"><strong>What is alive now</strong><p>' + h(g.activityPlan) + '</p></div>'
            : '') +
        '</section>' +

        '<section class="g-card">' +
          '<h2>How it gathers</h2>' +
          '<dl class="g-dl">' +
            row('Structure', G.structureMeta(g.structure).name + ' — ' + G.structureMeta(g.structure).desc) +
            row('Format', g.format + (g.location && g.location.city ? ' · ' + [g.location.city, g.location.country].filter(Boolean).join(', ') : '')) +
            row('Language', [g.languages.primary].concat(g.languages.supported || []).join(', ') +
              (g.languages.supported && g.languages.supported.length
                ? ' — supported languages depend on who is present; English stays available as an alternative.'
                : '')) +
            row('Accessibility', g.accessibility.notes || 'Not yet described. Ask before you decide — ' + g.accessibility.contact) +
            row('Meeting rhythm', g.participation || 'Not yet described') +
            row('Members', G.countLabel(g) + (G.capacityNote(g) ? ' · ' + G.capacityNote(g) : '')) +
          '</dl>' +
        '</section>' +

        (g.agreements.length
          ? '<section class="g-card"><h2>What is expected here</h2>' +
            '<ul class="g-plain-list">' + g.agreements.map(function (a) { return '<li>' + h(a) + '</li>'; }).join('') + '</ul>' +
            '<p class="g-hint">Group agreements add to the LiF Community Guidelines. They never override them, or your rights and safety standards.</p>' +
            '</section>'
          : '') +

        '<section class="g-card">' +
          '<h2>How you come in</h2>' +
          '<p class="g-prose"><p>' + h(accessMeaning(g)) + '</p></p>' +
          (g.access.instructions ? '<div class="g-aside"><strong>From the stewards</strong><p>' + h(g.access.instructions) + '</p></div>' : '') +
          (g.access.joinMethod === 'request' && g.access.sharedInfoNote
            ? '<div class="g-aside"><strong>What stewards see from your request</strong><p>' + h(g.access.sharedInfoNote) + '</p></div>'
            : '') +
          (g.access.joinMethod === 'request' && g.access.questions.length
            ? '<p class="g-hint">You will be asked: ' + g.access.questions.map(function (x) { return h(x.label); }).join(' · ') + '</p>'
            : '') +
        '</section>' +

        (stewards.length
          ? '<section class="g-card"><h2>Who stewards it</h2>' +
            '<ul class="g-people">' + stewards.map(function (s) {
              return '<li><span class="g-avatar">' + h(U.initials(s.name)) + '</span>' +
                '<div><strong>' + h(s.name) + '</strong><br><span class="g-hint">' +
                h((LIF.GROUP_ROLES.find(function (r) { return r.id === s.role; }) || {}).name || s.role) + '</span></div></li>';
            }).join('') + '</ul>' +
            '<p class="g-hint">Only stewards who chose to be publicly visible are listed. Member information follows the same visibility rules.</p>' +
            '</section>'
          : '') +

        (events.length || related.length || publicResources.length
          ? '<section class="g-card"><h2>Connected across LiF</h2>' +
            (events.length
              ? '<h3 class="g-h3">Public Events</h3><ul class="g-related">' + events.map(function (e) {
                  return '<li><a href="event.html?id=' + h(e.id) + '"><strong>' + h(e.title) + '</strong> ' +
                    h(U.formatDateRange(e.start, e.end)) + '</a></li>';
                }).join('') + '</ul>'
              : '') +
            (publicResources.length
              ? '<h3 class="g-h3">Public Resources</h3><ul class="g-related">' + publicResources.map(function (r) {
                  return '<li><a href="' + h(r.url) + '" target="_blank" rel="noopener">' + h(r.title) + '</a></li>';
                }).join('') + '</ul>'
              : '') +
            (related.length
              ? '<h3 class="g-h3">Related Groups</h3><ul class="g-related">' + related.map(function (x) {
                  return '<li><a href="group.html?id=' + h(x.id) + '"><strong>' + h(x.name) + '</strong> ' + h(x.description) + '</a></li>';
                }).join('') + '</ul>'
              : '') +
            '<p class="g-hint">Each of these appears only where its own visibility permits it. Connecting Groups never implies a merger.</p>' +
            '</section>'
          : '') +

        (g.originEventId && LIF.events && LIF.events.get(g.originEventId)
          ? '<section class="g-card"><h2>Where it came from</h2>' +
            '<p class="g-prose"><p>This Group grew out of <a href="event.html?id=' + h(g.originEventId) + '">' +
            h(LIF.events.get(g.originEventId).title) + '</a>. The Event’s information carries into this space.</p></p></section>'
          : '') +

      '</div>' +
      sidePanel(g) +
    '</div>';
  }

  function accessMeaning(g) {
    var disc = { discoverable: 'Anyone authorized to browse the Playground can find this Group.',
                 unlisted: 'This Group is not listed in discovery. You are seeing it because you have the link or an invitation.',
                 private: 'This Group is private. You are seeing it because you were invited or belong to it.' }[g.access.discoverability];
    var join = g.access.joinMethod === 'invitation'
      ? 'Participation begins only from an invitation a steward sends. There is no way to ask.'
      : 'Participation begins with a Request Access that a steward reads. There is no public instant join anywhere on the Playground.';
    return disc + ' ' + join;
  }

  /* =========================================================
   * 3. GROUP HOME — the inside view (§9)
   * ======================================================= */
  function enabledAreas(g) {
    return LIF.GROUP_AREAS.filter(function (a) {
      if (a.id === 'home' || a.id === 'help') return true;
      return g.areas[a.id];
    });
  }

  function areaNav(g) {
    return '<nav class="g-areanav" aria-label="Group Areas">' + enabledAreas(g).map(function (a) {
      var count = areaCount(g, a.id);
      return '<button type="button" class="g-areatab' + (area === a.id ? ' is-on' : '') + '" ' +
        'data-do="set-area" data-value="' + a.id + '"' + (area === a.id ? ' aria-current="page"' : '') + '>' +
        h(a.name.replace(' / About', '').replace(', agreements and reporting', '')) +
        (count ? '<span class="g-pip">' + count + '</span>' : '') + '</button>';
    }).join('') + '</nav>';
  }

  function areaCount(g, id) {
    switch (id) {
      case 'discussions': return G.threads(g.id).length;
      case 'announcements': return G.announcements(g.id).length;
      case 'resources': return G.resources(g.id).length;
      case 'events': return G.groupEvents(g).length;
      case 'activities': return G.activities(g.id).filter(function (a) { return a.state !== 'done'; }).length;
      case 'members': return g.memberCount;
      case 'updates': return G.calls(g.id).length;
      default: return 0;
    }
  }

  function homeView(g) {
    return '<div class="g-grid">' +
      '<div class="g-main">' + areaNav(g) + areaBody(g) + '</div>' +
      sidePanel(g) +
    '</div>';
  }

  function areaBody(g) {
    switch (area) {
      case 'home': return areaHome(g);
      case 'announcements': return areaAnnouncements(g);
      case 'members': return areaMembers(g);
      case 'discussions': return areaDiscussions(g);
      case 'chat': return areaChat(g);
      case 'resources': return areaResources(g);
      case 'events': return areaEvents(g);
      case 'activities': return areaActivities(g);
      case 'meetings': return areaMeetings(g);
      case 'updates': return areaUpdates(g);
      case 'help': return areaHelp(g);
      default: return '';
    }
  }

  /** §9 / §23A: Group Home answers four questions, in this order,
      before any counts or administration. */
  function areaHome(g) {
    var pinned = G.announcements(g.id).filter(function (a) { return a.pinned; });
    var nextEvent = G.groupEvents(g).filter(function (e) { return e.status === 'active'; })
      .sort(function (a, b) { return new Date(a.start) - new Date(b.start); })[0];
    var openCall = G.calls(g.id)[0];
    var latestThread = G.threads(g.id)[0];

    return '<section class="g-card g-welcome">' +
        '<p class="g-eyebrow">Welcome back</p>' +
        '<h2>' + h(g.name) + '</h2>' +
        '<p class="g-prose"><p>' + h(g.purpose) + '</p></p>' +
      '</section>' +

      '<section class="g-card">' +
        '<h2>What is alive now</h2>' +
        (g.activityPlan
          ? '<p class="g-prose"><p>' + h(g.activityPlan) + '</p></p>'
          : '<p class="g-hint">No current focus set. ' + (G.isSteward(g) ? 'Set one so people know where to put themselves.' : 'Ask a steward what is happening.') + '</p>') +
        (g.lastUpdate
          ? '<div class="g-update"><p>' + h(g.lastUpdate.text) + '</p>' +
            '<footer>' + h(g.lastUpdate.by) + ' · <span class="mono">' + h(rel(g.lastUpdate.at)) + '</span></footer></div>'
          : '') +
        (G.activityStale(g) && G.isSteward(g)
          ? proto('<p>Activity was last confirmed ' + h(rel(g.activityConfirmedAt)) + '. Groups that go unconfirmed show as <strong>Quiet</strong> in discovery rather than being recommended as active.</p>' +
            '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="confirm-activity">Confirm what is alive now</button>')
          : '') +
      '</section>' +

      '<section class="g-card">' +
        '<h2>Ways to engage</h2>' +
        '<div class="g-ways">' +
          (g.areas.discussions ? way('Join a conversation', latestThread ? latestThread.title : 'Start the first thread', 'set-area', 'discussions') : '') +
          (openCall ? way('Respond to a call', openCall.need, 'set-area', 'updates') : '') +
          (nextEvent ? way('Attend an Event', nextEvent.title + ' · ' + U.formatDateRange(nextEvent.start), 'set-area', 'events') : '') +
          (g.areas.resources ? way('View a Resource', G.resources(g.id).length + ' shared here', 'set-area', 'resources') : '') +
          (g.areas.activities ? way('Pick something up', G.activities(g.id).filter(function (a) { return a.state === 'open'; }).length + ' open', 'set-area', 'activities') : '') +
          way('Offer support', 'Ask a steward what would help', 'set-area', 'help') +
        '</div>' +
      '</section>' +

      (pinned.length
        ? '<section class="g-card"><h2>Pinned</h2>' + pinned.map(announcementHtml).join('') + '</section>'
        : '') +

      connectionsCard(g);
  }

  function way(title, sub, action, value) {
    return '<button type="button" class="g-way" data-do="' + action + '" data-value="' + value + '">' +
      '<strong>' + h(title) + '</strong><span>' + h(sub) + '</span></button>';
  }

  function connectionsCard(g) {
    var related = (g.connections.groups || []).map(G.get).filter(Boolean);
    var events = G.groupEvents(g);
    if (!related.length && !events.length && !g.originEventId) return '';
    return '<section class="g-card"><h2>Connections</h2>' +
      (g.originEventId && LIF.events && LIF.events.get(g.originEventId)
        ? '<p class="g-hint">Grew out of <a href="event.html?id=' + h(g.originEventId) + '">' + h(LIF.events.get(g.originEventId).title) + '</a>.</p>'
        : '') +
      (events.length
        ? '<ul class="g-related">' + events.map(function (e) {
            return '<li><a href="event.html?id=' + h(e.id) + '"><strong>' + h(e.title) + '</strong> ' + h(U.formatDateRange(e.start)) + '</a></li>';
          }).join('') + '</ul>'
        : '') +
      (related.length
        ? '<ul class="g-related">' + related.map(function (x) {
            return '<li><a href="group.html?id=' + h(x.id) + '"><strong>' + h(x.name) + '</strong></a></li>';
          }).join('') + '</ul>'
        : '') +
      (G.can(g, 'manage-settings')
        ? '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="open-connect">Connect with another Group</button>'
        : '') +
    '</section>';
  }

  /* ---- Announcements (§12) ---- */
  function announcementHtml(a) {
    return '<article class="g-ann' + (a.pinned ? ' is-pinned' : '') + '">' +
      '<div class="g-ann-head"><strong>' + h(a.title) + '</strong>' +
        (a.pinned ? '<span class="gbadge">pinned</span>' : '') + '</div>' +
      '<p>' + h(a.body) + '</p>' +
      '<footer>' + h(a.by) + ' · <span class="mono">' + h(rel(a.at)) + '</span> · to ' + h(a.audience.replace('-', ' ')) + '</footer>' +
    '</article>';
  }

  function areaAnnouncements(g) {
    var list = G.announcements(g.id);
    return '<section class="g-card">' +
      '<div class="g-card-head"><h2>Announcements</h2>' +
        (G.can(g, 'publish-announcement')
          ? '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="open-announce">Write an announcement</button>'
          : '') + '</div>' +
      (list.length ? list.map(announcementHtml).join('')
        : '<p class="g-hint">Nothing announced yet. Announcements come from stewards and go out on each Member’s own notification settings.</p>') +
      (!G.can(g, 'publish-announcement')
        ? '<p class="g-hint">Only a role with the Publish Announcement capability can send one.</p>' : '') +
    '</section>';
  }

  /* ---- Members and stewards (§10) ---- */
  function areaMembers(g) {
    var stewards = g.stewards || [];
    var mine = G.membership(g.id);
    return '<section class="g-card">' +
      '<h2>Members and stewards</h2>' +
      '<p class="g-hint">' + h(G.countLabel(g)) + '. Member information shows according to each person’s own visibility choices — this list is not a directory of everyone.</p>' +
      '<ul class="g-people">' + stewards.map(function (s) {
        return '<li><span class="g-avatar">' + h(U.initials(s.name)) + '</span>' +
          '<div><strong>' + h(s.name) + '</strong><br><span class="g-hint">' +
          h((LIF.GROUP_ROLES.find(function (r) { return r.id === s.role; }) || {}).name || s.role) + '</span></div>' +
          (G.can(g, 'remove') && s.memberId !== G.memberId()
            ? '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="role-preview" data-value="' + h(s.name) + '">Change role</button>'
            : '') +
        '</li>';
      }).join('') + '</ul>' +

      (mine ? '<div class="g-aside"><strong>Your place here</strong>' +
        '<p>' + h((LIF.GROUP_ROLES.find(function (r) { return r.id === mine.role; }) || {}).name || mine.role) +
        ' since ' + h(new Date(mine.joinedAt).toLocaleDateString()) + '. ' +
        'You can ' + h(capabilityList(g)) + '.</p></div>' : '') +

      (G.can(g, 'invite')
        ? '<div class="g-card-head"><h3 class="g-h3">Invite someone</h3></div>' +
          proto('<p>An invitation from a Group Admin — or a role you give direct-access authority — grants membership when accepted. ' +
            'Every other invitation opens Request Access instead, and the wording of the invitation matches which one it is.</p>' +
            '<div class="g-row"><input class="g-input" id="gInvitee" placeholder="Name or email"><select class="g-input" id="gInviteKind">' +
            '<option value="direct">Direct access — grants membership</option>' +
            '<option value="apply">Invitation to apply — opens Request Access</option>' +
            '</select><button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="send-invite">Preview and send</button></div>')
        : '') +

      (G.can(g, 'approve') ? reviewQueue(g) : '') +
    '</section>';
  }

  function capabilityList(g) {
    var caps = LIF.GROUP_CAPABILITIES.filter(function (c) { return G.can(g, c); });
    var names = { view: 'read', post: 'post', comment: 'comment', react: 'react', share: 'share',
      'add-resource': 'add Resources', 'publish-announcement': 'publish Announcements',
      'create-event': 'create Events', invite: 'invite people', approve: 'review access requests',
      remove: 'change roles', 'manage-settings': 'manage settings', moderate: 'moderate',
      'view-audit': 'view the audit record', 'close-group': 'close the Group' };
    return caps.map(function (c) { return names[c] || c; }).join(', ');
  }

  /** §22: the reviewer workspace, as a prototype. */
  function reviewQueue(g) {
    var reqs = G.myRequests().filter(function (r) { return r.group.id === g.id && r.request.status === 'pending'; });
    return '<h3 class="g-h3">Access requests</h3>' + proto(
      (reqs.length
        ? reqs.map(function (r) {
            return '<div class="g-request">' +
              '<strong>' + h(G.memberName()) + '</strong> <span class="mono">' + h(rel(r.request.at)) + '</span>' +
              Object.keys(r.request.answers).map(function (k) {
                return '<p class="g-q"><em>' + h(questionLabel(g, k)) + '</em><br>' + h(r.request.answers[k]) + '</p>';
              }).join('') +
              '<div class="g-row">' + LIF.ACCESS_DECISIONS.map(function (d) {
                return '<button class="g-btn g-btn--sm" type="button" data-do="decide" data-value="' + d.id + '" title="' + h(d.desc) + '">' + h(d.name) + '</button>';
              }).join('') + '</div>' +
              '<input class="g-input" id="gDecisionReason" placeholder="Member-facing reasoning — they will read this">' +
              '<input class="g-input" id="gDecisionPrivate" placeholder="Reviewer-only note — never shown to them">' +
            '</div>';
          }).join('')
        : '<p class="g-hint">No requests waiting. When one arrives you get Approve, More Information Needed, Waitlist and Decline — each needs a respectful member-facing reason and a clear next action.</p>'));
  }

  function questionLabel(g, key) {
    var q = (g.access.questions || []).find(function (x) { return x.key === key; });
    return q ? q.label : key;
  }

  /* ---- Discussions (§11) ---- */
  function areaDiscussions(g) {
    var list = G.threads(g.id);
    var can = G.canParticipate(g);
    return '<section class="g-card">' +
      '<div class="g-card-head"><h2>Discussions</h2>' +
        (can ? '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="new-thread">New thread</button>' : '') +
      '</div>' +
      (draft.newThread
        ? '<div class="g-subform">' +
            '<input class="g-input" id="gThreadTitle" placeholder="What is this about?">' +
            '<textarea class="g-input" id="gThreadBody" rows="4" placeholder="Say the thing."></textarea>' +
            '<div class="g-row"><button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="post-thread">Post</button>' +
            '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="cancel-thread">Cancel</button></div>' +
          '</div>'
        : '') +
      (list.length ? list.map(function (t) { return threadHtml(g, t); }).join('')
        : '<p class="g-hint">No threads yet. Durable topics live here; the faster back-and-forth belongs in Chat.</p>') +
    '</section>';
  }

  function threadHtml(g, t) {
    var open = draft.openThread === t.id;
    return '<article class="g-thread' + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="g-thread-head" data-do="toggle-thread" data-value="' + h(t.id) + '">' +
        '<strong>' + h(t.title) + '</strong>' +
        '<span class="g-hint">' + h(t.author) + ' · ' + t.posts.length + ' post' + (t.posts.length === 1 ? '' : 's') + ' · ' + h(rel(t.at)) + '</span>' +
      '</button>' +
      (open
        ? '<div class="g-thread-body">' +
            t.posts.map(function (p, i) {
              return '<div class="g-post">' +
                '<div class="g-post-head"><strong>' + h(p.author) + '</strong> <span class="mono">' + h(rel(p.at)) + '</span>' +
                  (p.edited ? ' <span class="gbadge">edited</span>' : '') + '</div>' +
                '<p>' + h(p.text) + '</p>' +
                '<div class="g-post-actions">' +
                  '<button type="button" data-do="react" data-value="' + h(t.id) + '" data-i="' + i + '">♡ ' + (p.reactions || 0) + '</button>' +
                  (p.author === G.memberName() && G.canParticipate(g)
                    ? '<button type="button" data-do="edit-post" data-value="' + h(t.id) + '" data-i="' + i + '">Edit</button>' : '') +
                '</div>' +
              '</div>';
            }).join('') +
            '<div class="g-thread-foot">' +
              '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="follow-thread" data-value="' + h(t.id) + '">' +
                (t.following ? '✓ Following this thread' : 'Follow this thread') + '</button>' +
              '<span class="g-hint">Muting a thread does not mute the Group, and a direct reply or mention can still reach you when the Group is muted — that is your choice to make.</span>' +
            '</div>' +
            (G.canParticipate(g)
              ? '<div class="g-row"><input class="g-input" id="gReply-' + h(t.id) + '" placeholder="Reply">' +
                '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="reply" data-value="' + h(t.id) + '">Reply</button></div>'
              : '<p class="g-hint">' + h(G.isReadOnly(g) ? 'This Group is archived. Everything is readable; nothing new can be added.' : 'Participation is limited while the Group is ' + G.stateMeta(g.status).name.toLowerCase() + '.') + '</p>') +
          '</div>'
        : '') +
    '</article>';
  }

  /* ---- Chat (§11) ---- */
  function areaChat(g) {
    var msgs = G.chat(g.id);
    return '<section class="g-card">' +
      '<h2>Chat</h2>' +
      '<p class="g-hint">Faster than a thread. Retained while this Group is active and archived with it, subject to the disclosed privacy and legal rules.</p>' +
      '<div class="g-chat">' + (msgs.length ? msgs.map(function (m) {
        return '<div class="g-chat-line"><strong>' + h(m.author) + '</strong> <span class="mono">' + h(new Date(m.at).toLocaleTimeString()) + '</span><p>' + h(m.text) + '</p></div>';
      }).join('') : '<p class="g-hint">Nothing here yet.</p>') + '</div>' +
      (G.canParticipate(g)
        ? '<div class="g-row"><input class="g-input" id="gChat" placeholder="Say something"><button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="send-chat">Send</button></div>'
        : '') +
    '</section>';
  }

  /* ---- Resources (§13) ---- */
  function areaResources(g) {
    var list = G.resources(g.id);
    return '<section class="g-card">' +
      '<div class="g-card-head"><h2>Resources</h2>' +
        (G.can(g, 'add-resource')
          ? '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="new-resource">Add a Resource</button>' : '') +
      '</div>' +
      '<p class="g-hint">Each Resource has its own audience — a discoverable Group does not make every Resource public. The Playground keeps the authoritative title, contributor, audience, permissions and link health even when the file lives in Google Workspace.</p>' +
      (draft.newResource
        ? '<div class="g-subform">' +
            '<input class="g-input" id="gResTitle" placeholder="Title">' +
            '<input class="g-input" id="gResUrl" placeholder="https://… or a file you have uploaded">' +
            '<select class="g-input" id="gResAudience">' +
              '<option value="group">Visible to this Group</option>' +
              '<option value="stewards">Stewards only</option>' +
            '</select>' +
            '<div class="g-row"><button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="save-resource">Add</button>' +
            '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="cancel-resource">Cancel</button></div>' +
          '</div>'
        : '') +
      (list.length
        ? '<ul class="g-reslist">' + list.map(function (r) {
            return '<li>' +
              '<a href="' + h(r.url) + '" target="_blank" rel="noopener"><strong>' + h(r.title) + '</strong></a>' +
              '<span class="g-hint">' + h(r.by) + ' · ' + h(r.storage) + ' · audience: ' + h(r.audience.replace(/-/g, ' ')) + '</span>' +
              (G.can(g, 'add-resource') && r.audience === 'group'
                ? '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="to-library" data-value="' + h(r.id) + '">Propose for the Library</button>'
                : '') +
            '</li>';
          }).join('') + '</ul>'
        : '<p class="g-hint">Nothing shared yet.</p>') +
    '</section>';
  }

  /* ---- Events (§14) ---- */
  function areaEvents(g) {
    var list = G.groupEvents(g);
    return '<section class="g-card">' +
      '<div class="g-card-head"><h2>Events and calendar</h2>' +
        (G.can(g, 'create-event')
          ? '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-propose-event data-group="' + h(g.id) + '">Create a Group Event</button>' : '') +
      '</div>' +
      '<p class="g-hint">Group Events use the shared Events pathway — the same registration, attendance, reminder, payment, cancellation, privacy and follow-up rules as every other LiF Event. Being in this Group is not the same as being registered for its Events.</p>' +
      (list.length
        ? '<ul class="g-related">' + list.map(function (e) {
            var st = LIF.events.registrationState(e);
            return '<li><a href="event.html?id=' + h(e.id) + '">' +
              '<strong>' + h(e.title) + '</strong> ' + h(U.formatDateRange(e.start, e.end)) +
              ' <span class="gbadge">' + h(st.code === 'registered' ? 'you are registered' : st.label) + '</span></a></li>';
          }).join('') + '</ul>'
        : '<p class="g-hint">No Events yet.</p>') +
    '</section>';
  }

  /* ---- Activities ---- */
  function areaActivities(g) {
    var list = G.activities(g.id);
    return '<section class="g-card">' +
      '<div class="g-card-head"><h2>Activities</h2>' +
        (G.canParticipate(g) ? '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="new-activity">Add</button>' : '') +
      '</div>' +
      (draft.newActivity
        ? '<div class="g-row"><input class="g-input" id="gActivity" placeholder="What needs doing?">' +
          '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="save-activity">Add</button></div>'
        : '') +
      (list.length
        ? '<ul class="g-activities">' + list.map(function (a) {
            return '<li class="is-' + h(a.state) + '">' +
              '<button type="button" data-do="cycle-activity" data-value="' + h(a.id) + '" class="g-act-state">' + h(a.state) + '</button>' +
              '<span>' + h(a.title) + '</span>' +
              (a.assignee ? '<span class="g-hint">' + h(a.assignee) + '</span>' : '') +
            '</li>';
          }).join('') + '</ul>'
        : '<p class="g-hint">Nothing on the board.</p>') +
    '</section>';
  }

  /* ---- Meeting links ---- */
  function areaMeetings(g) {
    return '<section class="g-card"><h2>Live meeting links</h2>' +
      proto('<p>Zoom and Google Meet links for this Group live here. A Playground role does not imply access to the external service — Workspace and meeting-provider access is validated separately.</p>' +
        '<div class="g-row"><input class="g-input" value="https://example.org/meet/' + h(g.slug) + '" readonly>' +
        '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="copy-meet">Copy</button></div>') +
    '</section>';
  }

  /* ---- Updates and Calls for Engagement (§12) ---- */
  function areaUpdates(g) {
    var list = G.calls(g.id);
    return '<section class="g-card">' +
      '<div class="g-card-head"><h2>Calls for Engagement</h2>' +
        (G.canParticipate(g) ? '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="new-call">Post a call</button>' : '') +
      '</div>' +
      '<p class="g-hint">Structured so it can be searched and acted on, rather than lost in a thread: what is needed, when, where, how to respond and when it closes.</p>' +
      (draft.newCall
        ? '<div class="g-subform">' +
            '<input class="g-input" id="gCallNeed" placeholder="What is needed?">' +
            '<input class="g-input" id="gCallTiming" placeholder="When">' +
            '<input class="g-input" id="gCallWhere" placeholder="Where, or online">' +
            '<input class="g-input" id="gCallRoute" placeholder="How to respond">' +
            '<input class="g-input" id="gCallCloses" type="date">' +
            '<div class="g-row"><button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="save-call">Post</button>' +
            '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="cancel-call">Cancel</button></div>' +
          '</div>'
        : '') +
      (list.length
        ? list.map(function (c) {
            return '<article class="g-call">' +
              '<h3>' + h(c.need) + '</h3>' +
              '<dl class="g-dl g-dl--tight">' +
                row('When', c.timing) + row('Where', c.where) + row('How to respond', c.route) +
                row('Closes', c.closes || 'No closing date') +
              '</dl>' +
              (c.responses.length
                ? '<ul class="g-plain-list">' + c.responses.map(function (r) {
                    return '<li><strong>' + h(r.by) + '</strong> — ' + h(r.text) + '</li>';
                  }).join('') + '</ul>'
                : '') +
              (G.canParticipate(g)
                ? '<div class="g-row"><input class="g-input" id="gCallReply-' + h(c.id) + '" placeholder="I can help with…">' +
                  '<button class="g-btn g-btn--primary g-btn--sm" type="button" data-do="respond-call" data-value="' + h(c.id) + '">Respond</button></div>'
                : '') +
            '</article>';
          }).join('')
        : '<p class="g-hint">No open calls.</p>') +
    '</section>';
  }

  /* ---- Help, agreements, reporting (§17) ---- */
  function areaHelp(g) {
    var mine = G.membership(g.id);
    return '<section class="g-card">' +
      '<h2>Help and agreements</h2>' +
      (g.agreements.length
        ? '<h3 class="g-h3">This Group’s agreements</h3><ul class="g-plain-list">' +
          g.agreements.map(function (a) { return '<li>' + h(a) + '</li>'; }).join('') + '</ul>'
        : '') +
      '<p class="g-hint">Group agreements supplement the LiF Community Guidelines. They never override them, your rights or LiF safety standards.</p>' +

      '<h3 class="g-h3">Who to reach</h3>' +
      '<ul class="g-plain-list">' +
        (g.stewards || []).map(function (s) { return '<li>' + h(s.name) + ' — ' + h((LIF.GROUP_ROLES.find(function (r) { return r.id === s.role; }) || {}).name || s.role) + '</li>'; }).join('') +
        '<li>Accessibility and accommodation — ' + h(g.accessibility.contact) + '</li>' +
        '<li>LiF support — support@loveisfoundation.org</li>' +
      '</ul>' +

      '<h3 class="g-h3">Report or resolve a concern</h3>' +
      '<p class="g-hint">Reports route by category and severity. A report is never routed only to the person it is about, or to a close-role peer of theirs.</p>' +
      '<button class="g-btn g-btn--ghost" type="button" data-do="open-report">Report a concern</button>' +
      (G.myReports().filter(function (r) { return r.groupId === g.id; }).length
        ? '<h3 class="g-h3">Your reports</h3><ul class="g-plain-list">' +
          G.myReports().filter(function (r) { return r.groupId === g.id; }).map(function (r) {
            return '<li>' + h((LIF.REPORT_CATEGORIES.find(function (c) { return c.id === r.category; }) || {}).name) +
              ' — <strong>' + h((LIF.REPORT_STATES.find(function (s) { return s.id === r.state; }) || {}).name) + '</strong>' +
              '<br><span class="g-hint">Routed to ' + h(r.route) + '. Confidential case detail is never shown here.</span></li>';
          }).join('') + '</ul>'
        : '') +

      (mine
        ? '<h3 class="g-h3">Leaving</h3>' +
          '<p class="g-hint">You can leave at any time. We will show you exactly what changes before you confirm.</p>' +
          '<button class="g-btn g-btn--danger" type="button" data-do="open-leave">Leave this Group</button>'
        : '') +
    '</section>';
  }

  /* =========================================================
   * 4. SIDE PANEL — primary action, your place, notifications
   * ======================================================= */
  function sidePanel(g) {
    var mine = G.membership(g.id);
    var tasks = G.isCreator(g) ? G.activationTasks(g) : [];
    /* A Member reading Group Home does not need a button that opens
       Group Home. The primary action is for people who are not in
       yet; inside, the panel leads with where you stand. */
    var inside = G.isMember(g.id);

    return '<aside class="g-side">' +
      '<div class="g-side-inner">' +
        (inside ? insideBlock(g, mine) : primaryActionHtml(g)) +

        (g.status === 'forming' && tasks.length
          ? '<div class="g-tasks"><strong>Before it opens</strong>' +
            tasks.map(function (t) {
              return '<div class="g-task"><span>' + h(t.label) + '</span><em>' + h(t.why) + '</em></div>';
            }).join('') + '</div>'
          : '') +

        (mine && mine.state === 'active'
          ? '<div class="g-side-block">' +
              '<strong>Your notifications here</strong>' +
              '<p class="g-hint">' + h(notificationSummary(g)) + '</p>' +
              '<button class="g-linkbtn" type="button" data-do="open-notifications">Customize</button>' +
              '<button class="g-linkbtn" type="button" data-do="mute">' + (mine.muted ? 'Unmute this Group' : 'Mute this Group') + '</button>' +
            '</div>'
          : '') +

        (!mine && !G.isGuest() && G.primaryAction(g).id !== 'follow'
          ? '<button class="g-linkbtn" type="button" data-do="follow">' +
            (G.isFollowing(g.id) ? '✓ Following — you will hear when things change' : 'Follow without joining') + '</button>'
          : '') +

        '<div class="g-side-block">' +
          '<strong>At a glance</strong>' +
          '<ul class="g-glance">' +
            '<li>' + h(G.structureMeta(g.structure).name) + '</li>' +
            '<li>' + h(g.format) + (g.location && g.location.city ? ' · ' + h(g.location.city) : '') + '</li>' +
            '<li>' + h([g.languages.primary].concat(g.languages.supported || []).join(', ')) + '</li>' +
            '<li>' + h(G.countLabel(g)) + '</li>' +
            '<li>' + h((LIF.GROUP_DISCOVERABILITY.find(function (d) { return d.id === g.access.discoverability; }) || {}).name) + '</li>' +
          '</ul>' +
        '</div>' +

        (G.can(g, 'manage-settings')
          ? '<button class="g-linkbtn" type="button" data-do="open-settings">Group settings</button>' : '') +
      '</div>' +
    '</aside>';
  }

  /** Where you stand, for someone already inside. */
  function insideBlock(g, mine) {
    var role = (LIF.GROUP_ROLES.find(function (r) { return r.id === mine.role; }) || {}).name || 'Member';
    return '<div class="g-standing">' +
      '<strong>' + h(role) + '</strong>' +
      '<span>since ' + h(new Date(mine.joinedAt).toLocaleDateString()) + '</span>' +
      (G.isReadOnly(g)
        ? '<em>This Group is archived. Everything is readable; nothing new can be added.</em>'
        : (g.status === 'paused' || g.status === 'closing'
          ? '<em>Participation is limited while the Group is ' + h(G.stateMeta(g.status).name.toLowerCase()) + '.</em>'
          : '')) +
    '</div>';
  }

  function notificationSummary(g) {
    var m = G.membership(g.id);
    if (m && m.muted) return 'Muted. You still receive essential membership, privacy, governance and safety notices — nothing else.';
    var imm = LIF.GROUP_NOTIFY_CATEGORIES.filter(function (c) {
      return G.effectiveNotification(g.id, c.id).value === 'immediate';
    }).map(function (c) { return c.name.toLowerCase(); });
    return imm.length
      ? 'Immediate for ' + imm.join(', ') + '. Everything else is a weekly digest.'
      : 'Weekly digest. Joining did not subscribe you to everything.';
  }

  /* =========================================================
   * 5. PANELS
   * ======================================================= */
  function panelHtml(g) {
    if (!panel) return '';
    var body =
      panel === 'request' ? requestPanel(g) :
      panel === 'invitation' ? invitationPanel(g) :
      panel === 'leave' ? leavePanel(g) :
      panel === 'report' ? reportPanel(g) :
      panel === 'announce' ? announcePanel(g) :
      panel === 'notifications' ? notificationsPanel(g) :
      panel === 'settings' ? settingsPanel(g) :
      panel === 'connect' ? connectPanel(g) :
      panel === 'welcome' ? welcomePanel(g) : '';
    return '<div class="g-scrim" data-do="close-panel"></div>' +
      '<div class="g-panel" role="dialog" aria-modal="true">' +
        '<button class="g-panel-x" type="button" data-do="close-panel" aria-label="Close">×</button>' +
        body +
      '</div>';
  }

  /** §5.2 steps 1–2. */
  function requestPanel(g) {
    return '<h2>Request Access to ' + h(g.name) + '</h2>' +
      (g.access.instructions ? '<p class="g-lead">' + h(g.access.instructions) + '</p>' : '') +
      (G.isFull(g) ? '<div class="g-notice">This Group is full. Your request joins the waitlist and you will hear when a place opens.</div>' : '') +
      '<div class="g-notice g-notice--quiet"><strong>What the stewards will see</strong><p>' +
        h(g.access.sharedInfoNote || 'Your Playground Name, your public profile fields and your answers below.') + '</p></div>' +
      (g.access.questions || []).map(function (q) {
        return '<label class="g-label">' + h(q.label) + (q.required ? ' <span class="g-req">required</span>' : ' <span class="g-opt">optional</span>') + '</label>' +
          '<textarea class="g-input" rows="3" data-answer="' + h(q.key) + '">' + h(draft.answers && draft.answers[q.key] || '') + '</textarea>';
      }).join('') +
      (g.agreements.length
        ? '<div class="g-notice g-notice--quiet"><strong>This Group’s agreements</strong><ul>' +
          g.agreements.map(function (a) { return '<li>' + h(a) + '</li>'; }).join('') + '</ul></div>'
        : '') +
      '<label class="g-check"><input type="checkbox" data-do="consent"' + (draft.consent ? ' checked' : '') + '>' +
        '<span>I have read the agreements and I am happy for the stewards to see the information described above.</span></label>' +
      '<div class="g-panel-foot">' +
        '<button class="g-btn g-btn--ghost" type="button" data-do="close-panel">Not now</button>' +
        '<button class="g-btn g-btn--primary" type="button" data-do="submit-request">Send request</button>' +
      '</div>';
  }

  /** §5.1 and §5.3 — and the difference between the two kinds. */
  function invitationPanel(g) {
    var inv = G.invitationFor(g.id);
    if (!inv) return '<h2>No open invitation</h2>';
    var direct = inv.kind === 'direct';
    return '<h2>' + h(inv.fromName) + ' invited you to ' + h(g.name) + '</h2>' +
      (inv.message ? '<blockquote class="g-quote">' + h(inv.message) + '<footer>— ' + h(inv.fromName) + '</footer></blockquote>' : '') +
      '<div class="g-notice"><strong>What this invitation means</strong><p>' +
        (direct
          ? 'It carries direct-access authority, so accepting makes you a Member straight away. No further review.'
          : 'It is an invitation to apply. Accepting opens Request Access, and a steward still reviews it — the wording here matches what actually happens.') +
      '</p></div>' +
      '<div class="g-notice g-notice--quiet"><strong>What this Group is for</strong><p>' + h(g.purpose) + '</p>' +
        (g.activityPlan ? '<p><strong>Alive now:</strong> ' + h(g.activityPlan) + '</p>' : '') + '</div>' +
      (g.agreements.length
        ? '<div class="g-notice g-notice--quiet"><strong>Agreements</strong><ul>' +
          g.agreements.map(function (a) { return '<li>' + h(a) + '</li>'; }).join('') + '</ul></div>'
        : '') +
      (!G.iAmHereComplete()
        ? '<div class="g-notice">Your required I Am Here profile fields are not complete yet. They need finishing before membership can be created.</div>'
        : '') +
      '<div class="g-panel-foot">' +
        '<button class="g-btn g-btn--ghost" type="button" data-do="decline-invitation">Decline</button>' +
        '<button class="g-btn g-btn--primary" type="button" data-do="accept-invitation">' +
          (direct ? 'Accept and join' : 'Continue to Request Access') + '</button>' +
      '</div>';
  }

  /** §5.1 step 4 + §16 volume safeguard. */
  function welcomePanel(g) {
    return '<h2>Welcome to ' + h(g.name) + ', ' + h(G.preferredName()) + '.</h2>' +
      '<p class="g-lead">' + h(g.purpose) + '</p>' +
      (g.activityPlan ? '<div class="g-notice"><strong>What is alive now</strong><p>' + h(g.activityPlan) + '</p></div>' : '') +
      '<div class="g-notice g-notice--quiet"><strong>Where to begin</strong><ul>' +
        enabledAreas(g).filter(function (a) { return a.id !== 'home'; }).slice(0, 4).map(function (a) {
          return '<li>' + h(a.name) + ' — ' + h(a.desc) + '</li>';
        }).join('') + '</ul></div>' +
      '<div class="g-notice"><strong>Your notifications, as they stand now</strong>' +
        '<p>' + h(notificationSummary(g)) + '</p>' +
        '<p class="g-hint">Joining a Group does not subscribe you to every message in it. You can change this now or any time.</p>' +
        '<div class="g-row">' +
          '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="open-notifications">Customize</button>' +
          '<button class="g-btn g-btn--ghost g-btn--sm" type="button" data-do="mute">Mute this Group</button>' +
        '</div>' +
      '</div>' +
      '<div class="g-panel-foot">' +
        '<button class="g-btn g-btn--primary" type="button" data-do="close-panel">Open Group Home</button>' +
      '</div>';
  }

  /** §18: consequences BEFORE the confirm. */
  function leavePanel(g) {
    var cons = G.leaveConsequences(g.id);
    var blocked = G.lastAdmin(g);
    return '<h2>Leave ' + h(g.name) + '?</h2>' +
      '<div class="g-notice"><strong>What changes</strong><ul>' +
        cons.map(function (c) { return '<li>' + h(c) + '</li>'; }).join('') + '</ul></div>' +
      (blocked
        ? '<div class="g-notice g-notice--stop"><strong>Not yet</strong><p>You are the last accountable Group Admin. Name a replacement, or ask LiF to start recovery, and this Group will not be left without stewardship.</p></div>'
        : '<label class="g-label">Anything you would like to say? <span class="g-opt">entirely optional</span></label>' +
          '<textarea class="g-input" rows="3" id="gLeaveReason" placeholder="No pressure. This is private."></textarea>') +
      '<div class="g-panel-foot">' +
        '<button class="g-btn g-btn--ghost" type="button" data-do="close-panel">Stay</button>' +
        (blocked ? '' : '<button class="g-btn g-btn--danger" type="button" data-do="confirm-leave">Leave the Group</button>') +
      '</div>';
  }

  function reportPanel(g) {
    return '<h2>Report a concern</h2>' +
      '<p class="g-lead">Reports route by category and severity. Yours never goes only to the person it is about, or to a close-role peer of theirs.</p>' +
      '<label class="g-label">What kind of concern?</label>' +
      '<select class="g-input" id="gReportCat">' + LIF.REPORT_CATEGORIES.map(function (c) {
        return '<option value="' + c.id + '">' + h(c.name) + (c.urgent ? ' — routed urgently' : '') + '</option>';
      }).join('') + '</select>' +
      '<label class="g-label">What happened?</label>' +
      '<textarea class="g-input" rows="5" id="gReportNote" placeholder="As much or as little as you want to write."></textarea>' +
      '<div class="g-notice g-notice--quiet"><p>You will see the status move through Received, More Information Needed, Reviewing, Escalated or Resolved. You will not see confidential case information, and neither will anyone who should not.</p></div>' +
      '<div class="g-panel-foot">' +
        '<button class="g-btn g-btn--ghost" type="button" data-do="close-panel">Cancel</button>' +
        '<button class="g-btn g-btn--primary" type="button" data-do="submit-report">Send report</button>' +
      '</div>';
  }

  /** §12: audience, channels, recipient count and preview before send. */
  function announcePanel(g) {
    var aud = draft.audience || 'all-members';
    var prev = G.audiencePreview(g.id, aud);
    return '<h2>Write an announcement</h2>' +
      '<label class="g-label">Title</label><input class="g-input" id="gAnnTitle">' +
      '<label class="g-label">Message</label><textarea class="g-input" rows="5" id="gAnnBody"></textarea>' +
      '<label class="g-label">Audience</label>' +
      '<select class="g-input" data-do="set-audience">' +
        '<option value="all-members"' + (aud === 'all-members' ? ' selected' : '') + '>All Members</option>' +
        '<option value="stewards"' + (aud === 'stewards' ? ' selected' : '') + '>Stewards only</option>' +
      '</select>' +
      '<label class="g-check"><input type="checkbox" id="gAnnPin"><span>Pin it to Group Home</span></label>' +
      '<div class="g-notice"><strong>Before it goes</strong>' +
        '<ul><li>Audience: ' + h(prev.audience.replace('-', ' ')) + '</li>' +
        '<li>Recipients: ' + prev.recipients + '</li>' +
        '<li>Channels: ' + h(prev.channels) + '</li></ul>' +
        '<p class="g-hint">' + h(prev.note) + '</p></div>' +
      '<div class="g-panel-foot">' +
        '<button class="g-btn g-btn--ghost" type="button" data-do="close-panel">Cancel</button>' +
        '<button class="g-btn g-btn--primary" type="button" data-do="send-announcement">Send</button>' +
      '</div>';
  }

  /** §16: the effective setting, always findable. */
  function notificationsPanel(g) {
    return '<h2>Your notifications for ' + h(g.name) + '</h2>' +
      '<p class="g-lead">Global defaults, then this Group, then each thread. The most specific one wins — and you can always see which is deciding.</p>' +
      '<div class="g-notify">' + LIF.GROUP_NOTIFY_CATEGORIES.map(function (c) {
        var eff = G.effectiveNotification(g.id, c.id);
        return '<div class="g-notify-row">' +
          '<div><strong>' + h(c.name) + '</strong><br><span class="g-hint">Currently ' + h(eff.value) + ' · ' + h(eff.source) + '</span></div>' +
          '<select class="g-input" data-notify="' + c.id + '">' + LIF.GROUP_NOTIFY_CADENCE.map(function (o) {
            return '<option value="' + o.id + '"' + (eff.value === o.id ? ' selected' : '') + '>' + h(o.name) + '</option>';
          }).join('') + '</select>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="g-notice g-notice--quiet"><p>Essential notices — material membership, access, role, safety, privacy and governance changes — are always delivered, whatever you set here.</p></div>' +
      '<div class="g-panel-foot"><button class="g-btn g-btn--primary" type="button" data-do="close-panel">Done</button></div>';
  }

  function settingsPanel(g) {
    return '<h2>' + h(g.name) + ' settings</h2>' +
      proto('<p>Stewards can reorder enabled Group Areas within limits, and switch approved Areas on or off without rebuilding the Group. Required purpose, access and safety information always stays visible. A Member’s own hide and reorder choices never change the shared layout for anyone else.</p>' +
        '<div class="g-checks">' + LIF.GROUP_AREAS.map(function (a) {
          var on = a.core || g.areas[a.id];
          return '<label class="g-check' + (a.core ? ' is-locked' : '') + '">' +
            '<input type="checkbox" data-do="toggle-area" data-value="' + a.id + '"' +
            (on ? ' checked' : '') + (a.core ? ' disabled' : '') + '>' +
            '<span>' + h(a.name) + (a.core ? ' <span class="g-lock">always on</span>' : '') + '</span></label>';
        }).join('') + '</div>' +
        '<h3 class="g-h3">Lifecycle</h3>' +
        '<div class="g-row">' + ['active', 'quiet', 'paused', 'closing', 'archived'].map(function (s) {
          return '<button class="g-btn g-btn--sm' + (g.status === s ? ' is-on' : '') + '" type="button" data-do="set-status" data-value="' + s + '">' +
            h(G.stateMeta(s).name) + '</button>';
        }).join('') + '</div>' +
        '<p class="g-hint">Closing requires a plan for Members, content, Events, Resources, external tools and connected Groups. Voluntary Group actions and LiF safety intervention are separate pathways.</p>') +
      '<div class="g-panel-foot"><button class="g-btn g-btn--primary" type="button" data-do="close-panel">Done</button></div>';
  }

  function connectPanel(g) {
    var others = G.exploreGroups().filter(function (x) { return x.id !== g.id; });
    return '<h2>Connect with another Group</h2>' +
      '<p class="g-lead">Consent-based and lightweight. Shared Events, linked Resources, cross-posted calls and a visible related-Group link. Neither Group dissolves and no content moves.</p>' +
      '<label class="g-label">Which Group?</label>' +
      '<select class="g-input" id="gConnectTarget">' + others.map(function (x) {
        return '<option value="' + h(x.id) + '">' + h(x.name) + '</option>';
      }).join('') + '</select>' +
      '<label class="g-label">What are you proposing?</label>' +
      '<select class="g-input" id="gConnectKind">' + LIF.GROUP_RELATIONSHIPS.map(function (r) {
        return '<option value="' + r.id + '">' + h(r.name) + (r.launch ? '' : ' — not available at launch') + '</option>';
      }).join('') + '</select>' +
      '<p class="g-hint">Merge is defined and held in the data model, but it needs each Group’s documented consent process and LiF technical and safety review — so Connect is the launch pathway.</p>' +
      '<div class="g-panel-foot">' +
        '<button class="g-btn g-btn--ghost" type="button" data-do="close-panel">Cancel</button>' +
        '<button class="g-btn g-btn--primary" type="button" data-do="send-connect">Propose it</button>' +
      '</div>';
  }

  /* =========================================================
   * 6. RENDER
   * ======================================================= */
  function para(t) {
    return String(t || '').split('\n').filter(Boolean).map(function (p) { return '<p>' + h(p) + '</p>'; }).join('');
  }
  function row(k, v) { return '<div><dt>' + h(k) + '</dt><dd>' + h(v || '—') + '</dd></div>'; }
  function rel(iso) {
    var mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return mins + ' min ago';
    if (mins < 1440) return Math.round(mins / 60) + ' h ago';
    return Math.round(mins / 1440) + ' d ago';
  }

  function render() {
    var root = document.getElementById('groupPage');
    if (!group) {
      root.innerHTML = '<section class="g-card"><h1>No such Group</h1>' +
        '<p class="g-prose"><p>That link points at a Group this Playground does not have, or one you are not authorized to see. Those two look the same on purpose.</p></p>' +
        '<a class="g-btn g-btn--primary" href="index.html#groups">Explore Groups</a></section>';
      return;
    }
    if (!G.canSeeDetails(group)) {
      root.innerHTML = '<section class="g-card g-card--gate"><h1>Not open to you</h1>' +
        '<p class="g-prose"><p>This Group is ' +
        h((LIF.GROUP_DISCOVERABILITY.find(function (d) { return d.id === group.access.discoverability; }) || {}).name.toLowerCase()) +
        '. Nothing about it — not its Members, not its content, not its metadata — shows to anyone outside it.</p></p>' +
        '<a class="g-btn g-btn--primary" href="index.html#groups">Explore Groups</a></section>';
      return;
    }

    document.title = group.name + ' — LiF Playground';
    var inside = G.isMember(group.id);

    root.innerHTML =
      statusBanner(group) +
      hero(group) +
      (inside ? homeView(group) : detailsView(group)) +
      panelHtml(group);

    if (!inside && group.location && group.location.lat != null) mountMap();
  }

  function mountMap() {
    if (typeof L === 'undefined') return;
    var node = document.getElementById('gMap');
    if (!node) return;
    if (mapObj) { mapObj.remove(); mapObj = null; }
    mapObj = L.map(node, { scrollWheelZoom: false }).setView([group.location.lat, group.location.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapObj);
    L.marker([group.location.lat, group.location.lng]).addTo(mapObj);
  }

  /* =========================================================
   * 7. ACTIONS
   * ======================================================= */
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }
  function toast(m) { if (U.showToast) U.showToast(m); }

  function onClick(e) {
    var el = e.target.closest('[data-do]');
    if (!el) return;
    var v = el.dataset.value;
    var i = el.dataset.i != null ? +el.dataset.i : null;
    var g = group;

    switch (el.dataset.do) {
      case 'set-area': area = v; panel = null; render(); return;
      case 'close-panel': panel = null; draft = {}; render(); return;

      case 'open-request': panel = 'request'; draft = { answers: {}, consent: false }; render(); return;
      case 'consent': draft.consent = el.checked; return;
      case 'submit-request': {
        var missing = (g.access.questions || []).filter(function (q) {
          return q.required && !(draft.answers[q.key] || '').trim();
        });
        if (missing.length) { toast('Still needed: ' + missing.map(function (q) { return q.label; }).join(', ')); return; }
        if (!draft.consent) { toast('Please confirm you are happy with what the stewards will see.'); return; }
        G.requestAccess(g.id, draft.answers);
        panel = null; draft = {};
        toast('Request sent. Request Pending — you can withdraw it from your dashboard while it is open.');
        render();
        return;
      }

      case 'open-invitation': panel = 'invitation'; render(); return;
      case 'accept-invitation': {
        var inv = G.invitationFor(g.id);
        var res = G.acceptInvitation(inv.id);
        if (res && res.openedRequestAccess) {
          panel = 'request'; draft = { answers: {}, consent: false };
          toast('That invitation opens Request Access — a steward still reviews it.');
        } else {
          panel = 'welcome';
          toast('Welcome to ' + g.name + '.');
        }
        render();
        return;
      }
      case 'decline-invitation': {
        var inv2 = G.invitationFor(g.id);
        G.declineInvitation(inv2.id);
        panel = null;
        toast('Declined. Nothing is shared with the Group beyond that you answered.');
        render();
        return;
      }

      case 'open-home': area = 'home'; render(); return;
      case 'follow':
        toast(G.toggleFollow(g.id) ? 'Following. You will hear when this Group opens or changes.' : 'No longer following.');
        render();
        return;

      case 'open-leave': panel = 'leave'; render(); return;
      case 'confirm-leave': {
        var r = G.leaveGroup(g.id, val('gLeaveReason'));
        if (!r.ok) { toast(r.message || 'Could not leave.'); return; }
        panel = null;
        toast('You have left ' + g.name + '. You can ask to come back if access allows.');
        render();
        return;
      }

      case 'open-report': panel = 'report'; render(); return;
      case 'submit-report': {
        var cat = document.getElementById('gReportCat').value;
        if (!val('gReportNote')) { toast('Tell us what happened, in as few words as you like.'); return; }
        G.report(g.id, cat, val('gReportNote'));
        panel = null; area = 'help';
        toast('Report received. You will see its status here — never confidential case detail.');
        render();
        return;
      }

      case 'open-announce': panel = 'announce'; draft = { audience: 'all-members' }; render(); return;
      case 'set-audience': return;
      case 'send-announcement': {
        if (!val('gAnnTitle')) { toast('An announcement needs a title.'); return; }
        G.publishAnnouncement(g.id, {
          title: val('gAnnTitle'), body: val('gAnnBody'),
          audience: draft.audience || 'all-members',
          pinned: document.getElementById('gAnnPin').checked
        });
        panel = null; area = 'announcements';
        toast('Sent, on each Member’s own notification settings.');
        render();
        return;
      }

      case 'open-notifications': panel = 'notifications'; render(); return;
      case 'mute':
        toast(G.toggleMute(g.id)
          ? 'Muted. Essential membership, privacy, governance and safety notices still reach you.'
          : 'Unmuted.');
        render();
        return;

      case 'open-settings': panel = 'settings'; render(); return;
      case 'toggle-area':
        g.areas[v] = !g.areas[v];
        if (!g.areas[area]) area = 'home';
        render();
        return;
      case 'set-status':
        g.status = v;
        g.statusNote = v === 'quiet' ? 'Marked Quiet. It will not be recommended as active.' : '';
        toast('Lifecycle set to ' + G.stateMeta(v).name + '.');
        render();
        return;
      case 'confirm-activity':
        G.confirmActivity(g.id, g.activityPlan);
        toast('Confirmed. This Group shows as Active in discovery again.');
        render();
        return;

      case 'open-connect': panel = 'connect'; render(); return;
      case 'send-connect': {
        var res2 = G.relate(g.id, document.getElementById('gConnectTarget').value, document.getElementById('gConnectKind').value);
        toast(res2.message);
        if (res2.ok) panel = null;
        render();
        return;
      }

      /* --- discussions --- */
      case 'new-thread': draft.newThread = true; render(); return;
      case 'cancel-thread': draft.newThread = false; render(); return;
      case 'post-thread': {
        if (!val('gThreadTitle')) { toast('Give the thread a title.'); return; }
        var t = G.createThread(g.id, val('gThreadTitle'), val('gThreadBody'));
        draft.newThread = false; draft.openThread = t.id;
        render();
        return;
      }
      case 'toggle-thread': draft.openThread = draft.openThread === v ? null : v; render(); return;
      case 'reply': {
        var text = val('gReply-' + v);
        if (!text) { toast('Write something first.'); return; }
        G.replyToThread(g.id, v, text);
        render();
        return;
      }
      case 'follow-thread':
        toast(G.toggleThreadFollow(g.id, v)
          ? 'Following this thread. Muting the Group would not have stopped this one.'
          : 'Muted this thread only. The Group is untouched.');
        render();
        return;
      case 'react': G.reactToPost(g.id, v, i); render(); return;
      case 'edit-post': {
        var current = G.threads(g.id).find(function (x) { return x.id === v; }).posts[i].text;
        var next = prompt('Edit your post. It will be marked as edited.', current);
        if (next != null) { G.editPost(g.id, v, i, next); render(); }
        return;
      }

      case 'send-chat': {
        if (!val('gChat')) return;
        G.sendChat(g.id, val('gChat'));
        render();
        return;
      }

      /* --- resources --- */
      case 'new-resource': draft.newResource = true; render(); return;
      case 'cancel-resource': draft.newResource = false; render(); return;
      case 'save-resource': {
        if (!val('gResTitle')) { toast('The Resource needs a title.'); return; }
        G.addResource(g.id, {
          title: val('gResTitle'), url: val('gResUrl') || '#', kind: 'Link',
          audience: document.getElementById('gResAudience').value,
          storage: /docs\.google|drive\.google/.test(val('gResUrl')) ? 'workspace' : 'playground'
        });
        draft.newResource = false;
        render();
        return;
      }
      case 'to-library':
        G.proposeResourceToLibrary(g.id, v);
        toast('Proposed. Publication to the shared Library is a separate reviewed pathway — the Group’s own visibility is unchanged.');
        render();
        return;

      /* --- activities --- */
      case 'new-activity': draft.newActivity = true; render(); return;
      case 'save-activity': {
        if (!val('gActivity')) return;
        G.addActivity(g.id, val('gActivity'));
        draft.newActivity = false;
        render();
        return;
      }
      case 'cycle-activity': G.cycleActivity(g.id, v); render(); return;

      /* --- calls --- */
      case 'new-call': draft.newCall = true; render(); return;
      case 'cancel-call': draft.newCall = false; render(); return;
      case 'save-call': {
        if (!val('gCallNeed')) { toast('Say what is needed.'); return; }
        G.createCall(g.id, {
          need: val('gCallNeed'), timing: val('gCallTiming'), where: val('gCallWhere'),
          route: val('gCallRoute'), closes: val('gCallCloses')
        });
        draft.newCall = false;
        render();
        return;
      }
      case 'respond-call': {
        var rt = val('gCallReply-' + v);
        if (!rt) return;
        G.respondToCall(g.id, v, rt);
        render();
        return;
      }

      /* --- stewardship prototypes --- */
      case 'send-invite': {
        var who = val('gInvitee');
        if (!who) { toast('Name or email first.'); return; }
        var kind = document.getElementById('gInviteKind').value;
        toast(kind === 'direct'
          ? 'Preview shown to you first: ' + who + ' would receive your identity, the Group purpose and current focus, what access means, and a secure link. Accepting would grant membership.'
          : 'Preview shown to you first: ' + who + ' would receive an invitation to apply — accepting opens Request Access, and a steward still reviews it.');
        return;
      }
      case 'role-preview':
        toast('Changing ' + v + '’s role shows an impact preview first, then notifies them and writes an audit record. The last accountable Group Admin cannot be removed until a replacement is in place.');
        return;
      case 'decide': {
        var reason = val('gDecisionReason');
        if (!reason) { toast('A member-facing reason is required — they read it.'); return; }
        G.decideRequest(g.id, v, reason, val('gDecisionPrivate'));
        toast('Recorded. Your private note stays private; only the reason and the next action reach them.');
        render();
        return;
      }
      case 'copy-meet':
        U.copyToClipboard('https://example.org/meet/' + g.slug);
        return;
    }
  }

  function onInput(e) {
    var a = e.target.closest('[data-answer]');
    if (a) { draft.answers = draft.answers || {}; draft.answers[a.dataset.answer] = a.value; return; }
  }

  function onChange(e) {
    var n = e.target.closest('[data-notify]');
    if (n) {
      G.setGroupNotification(group.id, n.dataset.notify, n.value);
      render();
      return;
    }
    var aud = e.target.closest('[data-do="set-audience"]');
    if (aud) { draft.audience = aud.value; render(); return; }
    onInput(e);
  }

  /* =========================================================
   * 8. BOOT
   * ======================================================= */
  function init() {
    var id = q('id') || q('group');
    group = id ? G.get(id) : null;
    area = q('area') || 'home';
    if (group && G.isMember(group.id)) G.markRead(group.id);
    render();

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('lif:groupschange', function () {
      if (group) { group = G.get(group.id) || group; render(); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  return { render: render };
})();
