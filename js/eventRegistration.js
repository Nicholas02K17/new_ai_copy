/**
 * eventRegistration.js
 * ---------------------------------------------------------------
 * Registration, from the button to the confirmation.
 *
 *   details → (payment, only if the event asks for money) → confirmed
 *
 * Registration is the one place in this build that is deliberately
 * NOT a backend placeholder. Everything it does — remembering that
 * you registered, holding your RSVP, queueing the confirmation and
 * the two reminder emails, updating the counts on your dashboard —
 * is real against LIF.eventStore. What it cannot do is put an email
 * in your inbox or take your money, so those two are named plainly
 * on screen rather than mimed.
 *
 * The calendar links, though, are genuinely real: Google, Outlook,
 * Yahoo and a downloadable .ics, all built from the event itself.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

/* ===============================================================
 * Calendar links — no server involved, so these actually work.
 * Exposed separately because the event page and the dashboard
 * both offer "add to your calendar" without going through
 * registration.
 * ============================================================= */
LIF.calendarLinks = (function () {
  function stamp(iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; }
  function where(evt) {
    return evt.location
      ? [evt.location.venue, evt.location.city, evt.location.region, evt.location.country].filter(Boolean).join(', ')
      : (evt.onlineLink || 'Online');
  }
  function details(evt) {
    return (evt.description || evt.summary || '') +
      (evt.onlineLink ? '\n\nJoin: ' + evt.onlineLink : '') +
      '\n\nEvent ID: ' + evt.eventId;
  }

  function google(evt) {
    return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
      action: 'TEMPLATE', text: evt.title,
      dates: stamp(evt.start) + '/' + stamp(evt.end || evt.start),
      details: details(evt), location: where(evt)
    }).toString();
  }

  function outlook(evt) {
    return 'https://outlook.live.com/calendar/0/deeplink/compose?' + new URLSearchParams({
      path: '/calendar/action/compose', rru: 'addevent',
      subject: evt.title, body: details(evt), location: where(evt),
      startdt: new Date(evt.start).toISOString(), enddt: new Date(evt.end || evt.start).toISOString()
    }).toString();
  }

  function office365(evt) {
    return 'https://outlook.office.com/calendar/0/deeplink/compose?' + new URLSearchParams({
      path: '/calendar/action/compose', rru: 'addevent',
      subject: evt.title, body: details(evt), location: where(evt),
      startdt: new Date(evt.start).toISOString(), enddt: new Date(evt.end || evt.start).toISOString()
    }).toString();
  }

  function yahoo(evt) {
    var mins = Math.round((new Date(evt.end || evt.start) - new Date(evt.start)) / 60000);
    return 'https://calendar.yahoo.com/?' + new URLSearchParams({
      v: '60', title: evt.title, st: stamp(evt.start),
      dur: String(Math.floor(mins / 60)).padStart(2, '0') + String(mins % 60).padStart(2, '0'),
      desc: details(evt), in_loc: where(evt)
    }).toString();
  }

  function ics(evt) {
    var esc = function (s) { return String(s || '').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n'); };
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LiF Playground//Events//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + evt.eventId + '@lif-playground',
      'DTSTAMP:' + stamp(new Date().toISOString()),
      'DTSTART:' + stamp(evt.start),
      'DTEND:' + stamp(evt.end || evt.start),
      'SUMMARY:' + esc(evt.title),
      'DESCRIPTION:' + esc(details(evt)),
      'LOCATION:' + esc(where(evt)),
      'STATUS:' + (evt.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'),
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  }

  function download(evt) {
    var blob = new Blob([ics(evt)], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = evt.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function mailtoInvite(evt) {
    var link = pageUrl(evt);
    var body = 'I thought you might like this.\n\n' + evt.title + '\n' +
      new Date(evt.start).toLocaleString() + '\n\n' + (evt.summary || '') + '\n\nDetails and registration:\n' + link;
    return 'mailto:?subject=' + encodeURIComponent('Join me at ' + evt.title) + '&body=' + encodeURIComponent(body);
  }

  /* Derived from href rather than origin + pathname, because on a
     file:// page (this project opens fine by double-clicking) origin
     is the string "null" and the link would come out unusable. */
  function pageUrl(evt) {
    var base = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
    return base + 'event.html?id=' + evt.id;
  }

  return { google: google, outlook: outlook, office365: office365, yahoo: yahoo,
           ics: ics, download: download, mailtoInvite: mailtoInvite, pageUrl: pageUrl };
})();

/* ===============================================================
 * The registration flow itself.
 * ============================================================= */
LIF.eventRegistration = (function () {

  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  var evt = null;
  var step = 'details';
  var form = null;
  var errors = {};
  var root = null;

  /* Questions the hub asks on top of the event's own. Kept here
     rather than in the event record because they are the same on
     every LiF event — the host's extra questions, when there are
     any, come from evt.questionnaire. */
  function baseQuestions(e) {
    var qs = [
      { key: 'why', label: 'What draws you to this?', type: 'textarea', optional: true,
        hint: 'Optional, and only the host sees it. It genuinely helps them prepare.' },
      { key: 'access', label: 'Anything you need to take part fully?', type: 'textarea', optional: true,
        hint: 'Captions, a quiet room, a seat near the door, a translation — ask and it gets arranged where it can be.' }
    ];
    if (e.format !== 'online') {
      qs.push({ key: 'travel', label: 'Getting there', type: 'select', optional: true,
        options: ['Making my own way', 'Would like to share a ride', 'Can offer a ride'],
        hint: 'Used only to put people in touch with each other.' });
    }
    return qs.concat(e.questionnaire || []);
  }

  function prefill(e) {
    var M = LIF.MEMBER;
    var E = LIF.events;
    return {
      fields: {
        name: E.memberName(),
        preferredName: M ? (M.fields.preferredName.value || M.fields.firstName.value) : E.preferredName(),
        email: E.memberEmail(),
        phone: M ? M.fields.phone.value : '',
        pronouns: M ? M.fields.pronouns.value : '',
        city: M ? M.fields.city.value : '',
        language: (M && M.languages[0] && M.languages[0].name) || (e.languages && e.languages[0]) || 'English'
      },
      questionnaire: {},
      reminders: true,
      payment: null
    };
  }

  /* =========================================================
   * Rendering
   * ======================================================= */
  function detailsStep() {
    var st = LIF.events.registrationState(evt);
    var qs = baseQuestions(evt);
    var needsPay = (LIF.PAYMENT_MODELS.find(function (m) { return m.id === evt.payment.model; }) || {}).needsPayment;

    return '<div class="er-body">' +
      '<p class="er-lead">Some of this came from your profile. Change anything that should be different for this ' +
        'event — it will not touch your profile.</p>' +

      '<div class="er-grid2">' +
        field('name', 'Full name', 'text', true) +
        field('preferredName', 'What you like to be called', 'text', false) +
        field('email', 'Email', 'email', true) +
        field('phone', 'Phone', 'tel', false) +
        field('pronouns', 'Pronouns', 'text', false) +
        field('city', 'Where you are joining from', 'text', false) +
      '</div>' +

      '<label class="er-label">Language you would like to take part in</label>' +
      '<select class="er-input" data-set="language">' + LIF.LANGUAGES.map(function (l) {
        return '<option value="' + h(l) + '"' + (form.fields.language === l ? ' selected' : '') + '>' + h(l) + '</option>';
      }).join('') + '</select>' +
      (evt.languages && evt.languages.length && evt.languages.indexOf(form.fields.language) === -1
        ? '<p class="er-note">This event is hosted in ' + h(evt.languages.join(' and ')) +
          '. Your answer is passed to the host so they know translation would help.</p>'
        : '') +

      '<div class="er-qs">' + qs.map(function (q) {
        var v = form.questionnaire[q.key] || '';
        return '<div class="er-q">' +
          '<label class="er-label">' + h(q.label) + (q.optional ? ' <span class="er-opt">optional</span>' : '') + '</label>' +
          (q.type === 'select'
            ? '<select class="er-input" data-q="' + q.key + '"><option value="">Choose…</option>' +
              q.options.map(function (o) { return '<option' + (v === o ? ' selected' : '') + '>' + h(o) + '</option>'; }).join('') + '</select>'
            : '<textarea class="er-input er-textarea" rows="3" data-q="' + q.key + '">' + h(v) + '</textarea>') +
          (q.hint ? '<p class="er-hint">' + h(q.hint) + '</p>' : '') +
        '</div>';
      }).join('') + '</div>' +

      '<div class="er-reminders">' +
        '<label class="er-check"><input type="checkbox" data-do="reminders"' + (form.reminders ? ' checked' : '') + '>' +
          '<span><strong>Send me reminders</strong><br><span class="er-hint">Two: 24 hours before and 1 hour before. ' +
          'Each is a duplicate of your confirmation email, so the join link is always in the newest message. ' +
          'Untick to skip both — you can change your mind on the event page.</span></span></label>' +
      '</div>' +

      (needsPay
        ? '<div class="er-paynote"><strong>' + h(LIF.events.paymentLabel(evt)) + '</strong>' +
          (evt.payment.note ? '<p>' + h(evt.payment.note) + '</p>' : '') +
          '<p class="er-hint">Next step is the payment page.</p></div>'
        : '<div class="er-paynote er-paynote--free"><strong>Free</strong>' +
          '<p class="er-hint">Nothing to pay. Registering confirms your place straight away.</p></div>') +

      (st.code === 'open' && evt.participants.max
        ? '<p class="er-hint">' + evt.registered + ' of ' + evt.participants.max + ' places taken.</p>'
        : '') +
    '</div>' +
    '<footer class="er-foot">' +
      '<button class="er-btn er-btn--ghost" type="button" data-do="close">Not now</button>' +
      '<button class="er-btn er-btn--primary" type="button" data-do="continue">' +
        (needsPay ? 'Continue to payment' : 'Confirm my place') + '</button>' +
    '</footer>';
  }

  function field(key, label, type, required) {
    var err = errors[key];
    return '<label class="er-field' + (err ? ' has-error' : '') + '">' +
      '<span class="er-label">' + h(label) + (required ? ' <span class="er-req">required</span>' : '') + '</span>' +
      '<input class="er-input" type="' + type + '" data-set="' + key + '" value="' + h(form.fields[key]) + '">' +
      (err ? '<span class="er-error">' + h(err) + '</span>' : '') +
    '</label>';
  }

  function paymentStep() {
    var p = evt.payment;
    var amount = form.payment ? form.payment.amount : (p.model === 'sliding-scale' ? Math.round(((p.min || 0) + (p.max || 0)) / 2) : (p.suggested || 0));

    return '<div class="er-body">' +
      '<h3 class="er-h3">' + h(LIF.events.paymentLabel(evt)) + '</h3>' +
      (p.note ? '<p class="er-lead">' + h(p.note) + '</p>' : '') +

      (p.model === 'sliding-scale'
        ? '<div class="er-scale">' +
            '<input type="range" min="' + (p.min || 0) + '" max="' + (p.max || 100) + '" step="1" value="' + amount + '" data-do="amount">' +
            '<div class="er-scale-row"><span>$' + (p.min || 0) + '</span>' +
              '<strong class="er-amount">$<span id="erAmount">' + amount + '</span></strong>' +
              '<span>$' + (p.max || 100) + '</span></div>' +
            '<p class="er-hint">Anywhere on the scale, including the bottom of it. Nobody is asked why, and the host ' +
              'never sees which end you picked.</p>' +
          '</div>'
        : '<div class="er-amount-entry">' +
            '<label class="er-label">Amount</label>' +
            '<div class="er-amount-row"><span>$</span>' +
              '<input class="er-input" type="number" min="0" step="1" value="' + amount + '" data-do="amount-input"></div>' +
            '<p class="er-hint">' + (p.model === 'gift'
              ? 'This is offered as a gift. Give what feels right, including nothing.'
              : 'A suggested appreciation of $' + (p.suggested || 0) + '. Adjust it freely.') + '</p>' +
          '</div>') +

      '<div class="er-placeholder">' +
        '<strong>The payment step itself is not wired up in this build.</strong>' +
        '<p>Confirming below records the amount against your registration and marks it <em>pending</em>, the way it ' +
          'will look between clicking pay and the processor answering. When the LiF payment apps are connected, ' +
          'this screen hands off to them and comes back to the same confirmation.</p>' +
      '</div>' +
    '</div>' +
    '<footer class="er-foot">' +
      '<button class="er-btn er-btn--ghost" type="button" data-do="back">Back</button>' +
      '<button class="er-btn er-btn--primary" type="button" data-do="pay">Confirm my place</button>' +
    '</footer>';
  }

  function confirmedStep() {
    var reg = LIF.events.registrationFor(evt.id);
    var L = LIF.calendarLinks;
    var when = LIF.util
      ? LIF.util.formatDateRange(evt.start, evt.end)
      : new Date(evt.start).toLocaleString();

    return '<div class="er-body er-body--confirmed">' +
      '<div class="er-tick">✓</div>' +
      '<h3 class="er-h3">You are registered for ' + h(evt.title) + '.</h3>' +
      '<p class="er-lead">' + h(when) + ' · ' + h(evt.eventId) + '</p>' +

      '<section class="er-block">' +
        '<h4>Are you coming?</h4>' +
        '<p class="er-hint">Registering holds your place. RSVP tells the host and your calendars.</p>' +
        '<div class="er-rsvp">' +
          ['going', 'maybe', 'not-going'].map(function (v) {
            var label = v === 'going' ? 'Yes, I am coming' : v === 'maybe' ? 'Maybe' : 'I cannot make it';
            return '<button type="button" class="er-rsvp-btn' + (reg && reg.rsvp === v ? ' is-on' : '') + '" ' +
              'data-do="rsvp" data-value="' + v + '">' + label + '</button>';
          }).join('') +
        '</div>' +
        (reg && reg.rsvp
          ? '<p class="er-note">Sent. Your dashboard, the LiF calendar and your own calendar all say ' +
            h(reg.rsvp.replace('-', ' ')) + '.</p>'
          : '<p class="er-note">Until you answer, your event card carries this as an outstanding task.</p>') +
      '</section>' +

      '<section class="er-block">' +
        '<h4>Add it to your own calendar</h4>' +
        '<div class="er-cal">' +
          '<a class="er-btn er-btn--ghost" href="' + h(L.google(evt)) + '" target="_blank" rel="noopener">Google</a>' +
          '<a class="er-btn er-btn--ghost" href="' + h(L.outlook(evt)) + '" target="_blank" rel="noopener">Outlook</a>' +
          '<a class="er-btn er-btn--ghost" href="' + h(L.office365(evt)) + '" target="_blank" rel="noopener">Office 365</a>' +
          '<a class="er-btn er-btn--ghost" href="' + h(L.yahoo(evt)) + '" target="_blank" rel="noopener">Yahoo</a>' +
          '<button class="er-btn er-btn--ghost" type="button" data-do="ics">Download .ics</button>' +
        '</div>' +
        '<p class="er-hint">These open in a new tab, so the playground stays where you left it.</p>' +
      '</section>' +

      (evt.format !== 'in-person'
        ? '<section class="er-block">' +
            '<h4>How you get in on the day</h4>' +
            '<p class="er-hint">The Attend button appears on your dashboard, on the event page and in the reminder ' +
              'email fifteen minutes before the start. ' +
              (evt.recording.mode === 'recorded'
                ? 'This session is being recorded — it will be shared with ' +
                  h(((LIF.RECORDING_ACCESS.find(function (r) { return r.id === evt.recording.access; }) || {}).name || '').toLowerCase()) + '.'
                : 'This session is live only and will not be recorded.') + '</p>' +
          '</section>'
        : '')  +

      '<section class="er-block">' +
        '<h4>Bring someone</h4>' +
        '<div class="er-cal">' +
          '<a class="er-btn er-btn--ghost" href="' + h(L.mailtoInvite(evt)) + '">Invite a friend by email</a>' +
          '<button class="er-btn er-btn--ghost" type="button" data-do="copy">Copy the event link</button>' +
        '</div>' +
        '<p class="er-hint">Anyone can read the event page. They will need a LiF profile to register.</p>' +
      '</section>' +

      '<section class="er-block">' +
        '<h4>Reminders</h4>' +
        '<label class="er-check"><input type="checkbox" data-do="reminders-toggle"' + (reg && reg.reminders ? ' checked' : '') + '>' +
          '<span>Send me the 24-hour and 1-hour reminders. Each one repeats this confirmation.</span></label>' +
      '</section>' +

      '<section class="er-block er-block--quiet">' +
        '<h4>What the backend owes you</h4>' +
        '<ul class="er-outbox">' + LIF.eventStore.outbox().filter(function (m) { return m.eventId === evt.id; })
          .slice(0, 4).map(function (m) {
            return '<li><span class="er-kind">' + h(m.kind) + '</span>' + h(m.subject) +
              (m.sendAt ? ' <em>— queued for ' + h(new Date(m.sendAt).toLocaleString()) + '</em>' : '') + '</li>';
          }).join('') + '</ul>' +
        '<p class="er-hint">Queued, not sent. There is no mail service behind this build — the queue is what one ' +
          'will read.</p>' +
      '</section>' +
    '</div>' +
    '<footer class="er-foot">' +
      '<button class="er-btn er-btn--ghost" type="button" data-do="cancel-reg">Cancel my registration</button>' +
      '<a class="er-btn er-btn--ghost" href="event.html?id=' + h(evt.id) + '">Event page</a>' +
      '<button class="er-btn er-btn--primary" type="button" data-do="close">Done</button>' +
    '</footer>';
  }

  /* --- registration is not possible: say why, and offer the one
         thing that is still useful --- */
  function blockedStep(state) {
    var wants = LIF.events.wantsNotice(evt.id);
    return '<div class="er-body">' +
      '<div class="er-blocked">' +
        '<h3 class="er-h3">' + h(state.label) + '</h3>' +
        '<p class="er-lead">' + h(state.why || '') + '</p>' +
      '</div>' +
      (state.code === 'closed' || state.code === 'full'
        ? '<section class="er-block">' +
            '<h4>Tell me if this changes</h4>' +
            '<p class="er-hint">You will hear if registration reopens, or if another session of the same event is ' +
              'scheduled.</p>' +
            '<button class="er-btn ' + (wants ? 'er-btn--primary' : 'er-btn--ghost') + '" type="button" data-do="notify">' +
              (wants ? '✓ You will be told' : 'Let me know') + '</button>' +
          '</section>'
        : '') +
      (state.code === 'complete'
        ? '<section class="er-block"><h4>It already happened</h4>' +
          '<p class="er-hint">Recordings, notes and the conversation that followed are on the event page.</p>' +
          '<a class="er-btn er-btn--ghost" href="event.html?id=' + h(evt.id) + '">Open the event page</a></section>'
        : '') +
    '</div>' +
    '<footer class="er-foot">' +
      '<button class="er-btn er-btn--ghost" type="button" data-do="close">Close</button>' +
    '</footer>';
  }

  function shellHtml() {
    var state = LIF.events.registrationState(evt);
    var body;
    if (step === 'confirmed') body = confirmedStep();
    else if (!state.canRegister && state.code !== 'registered') body = blockedStep(state);
    else if (state.code === 'registered') { step = 'confirmed'; body = confirmedStep(); }
    else if (step === 'payment') body = paymentStep();
    else body = detailsStep();

    return '<div class="er-dialog" role="dialog" aria-modal="true" aria-label="Register for ' + h(evt.title) + '">' +
      '<header class="er-head" style="--cover:' + LIF.events.coverCss(evt) + '">' +
        '<div class="er-head-inner">' +
          '<p class="er-eyebrow">' + h(LIF.events.typeName(evt.type)) + ' · ' + h(evt.eventId) + '</p>' +
          '<h2>' + h(evt.title) + '</h2>' +
        '</div>' +
        '<button class="er-x" type="button" data-do="close" aria-label="Close">×</button>' +
      '</header>' +
      (step !== 'confirmed' && LIF.events.registrationState(evt).canRegister
        ? '<div class="er-steps">' +
            '<span class="' + (step === 'details' ? 'is-on' : 'is-done') + '">Your details</span>' +
            ((LIF.PAYMENT_MODELS.find(function (m) { return m.id === evt.payment.model; }) || {}).needsPayment
              ? '<span class="' + (step === 'payment' ? 'is-on' : '') + '">Payment</span>' : '') +
            '<span>Confirmed</span>' +
          '</div>'
        : '') +
      body +
    '</div>';
  }

  /* =========================================================
   * Wiring
   * ======================================================= */
  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'eventRegRoot';
    root.className = 'er-root hidden';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    return root;
  }

  function render() { root.innerHTML = shellHtml(); }

  function onInput(e) {
    var s = e.target.closest('[data-set]');
    if (s) { form.fields[s.dataset.set] = s.value; return; }
    var q = e.target.closest('[data-q]');
    if (q) { form.questionnaire[q.dataset.q] = q.value; return; }
    var amt = e.target.closest('[data-do="amount"]');
    if (amt) {
      var out = root.querySelector('#erAmount');
      if (out) out.textContent = amt.value;
      form.payment = { amount: +amt.value, currency: evt.payment.currency || 'USD', model: evt.payment.model, status: 'pending' };
      return;
    }
    var ai = e.target.closest('[data-do="amount-input"]');
    if (ai) form.payment = { amount: +ai.value, currency: evt.payment.currency || 'USD', model: evt.payment.model, status: 'pending' };
  }

  function onChange(e) {
    var s = e.target.closest('[data-set]');
    if (s) form.fields[s.dataset.set] = s.value;
    var q = e.target.closest('[data-q]');
    if (q) form.questionnaire[q.dataset.q] = q.value;
    var r = e.target.closest('[data-do="reminders"]');
    if (r) form.reminders = r.checked;
    var rt = e.target.closest('[data-do="reminders-toggle"]');
    if (rt) {
      LIF.events.setReminders(evt.id, rt.checked);
      toast(rt.checked ? 'Reminders on — 24 hours and 1 hour before.' : 'Reminders off for this event.');
    }
  }

  function onClick(e) {
    var el = e.target.closest('[data-do]');
    if (!el) {
      if (e.target === root) close();
      return;
    }
    switch (el.dataset.do) {
      case 'close': close(); return;
      case 'back': step = 'details'; render(); return;

      case 'continue': {
        errors = {};
        if (!form.fields.name.trim()) errors.name = 'We need a name for the list.';
        if (!/^\S+@\S+\.\S+$/.test(form.fields.email)) errors.email = 'A working email — this is where the join link goes.';
        if (Object.keys(errors).length) { render(); return; }
        var needsPay = (LIF.PAYMENT_MODELS.find(function (m) { return m.id === evt.payment.model; }) || {}).needsPayment;
        if (needsPay) { step = 'payment'; render(); return; }
        finish();
        return;
      }

      case 'pay': finish(); return;

      case 'rsvp':
        LIF.events.setRsvp(evt.id, el.dataset.value);
        toast(el.dataset.value === 'going'
          ? 'RSVP sent. Your calendars and the host now know you are coming.'
          : 'RSVP sent.');
        render();
        return;

      case 'ics': LIF.calendarLinks.download(evt); toast('Calendar file downloaded.'); return;
      case 'copy':
        if (LIF.util) LIF.util.copyToClipboard(LIF.calendarLinks.pageUrl(evt));
        return;

      case 'notify':
        var on = LIF.events.toggleNotifyMe(evt.id);
        toast(on
          ? 'You will be told if this reopens or runs again.'
          : 'You will not be notified about this one.');
        render();
        return;

      case 'cancel-reg':
        if (!confirm('Release your place at "' + evt.title + '"?')) return;
        LIF.events.cancelRegistration(evt.id);
        toast('Your place is released and your calendars updated.');
        close();
        return;
    }
  }

  function finish() {
    /* The amount is recorded against the registration. `status` says
       where it got to: 'recorded' means the hub has it and the LiF
       payment apps have not been called yet, because they do not
       exist in this build. A real processor sets 'paid' or 'failed'
       here, and only a genuinely stuck payment stays 'pending' - which
       is what puts "finish your payment" on the member's event card. */
    if (form.payment) form.payment.status = 'recorded';
    LIF.events.register(evt.id, form);
    step = 'confirmed';
    render();
    document.dispatchEvent(new CustomEvent('lif:registered', { detail: { eventId: evt.id } }));
  }

  function toast(msg) {
    if (LIF.util && LIF.util.showToast && document.getElementById('toast')) LIF.util.showToast(msg);
  }

  /* =========================================================
   * Public
   * ======================================================= */
  function open(eventId) {
    var e = LIF.events.get(eventId);
    if (!e) return;
    evt = e;
    form = prefill(e);
    errors = {};
    step = LIF.events.registrationFor(e.id) ? 'confirmed' : 'details';
    ensureRoot();
    render();
    root.classList.remove('hidden');
    document.body.classList.add('er-open');
  }

  function close() {
    if (!root) return;
    root.classList.add('hidden');
    document.body.classList.remove('er-open');
    document.dispatchEvent(new CustomEvent('lif:eventschange'));
  }

  function init() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-register-event]');
      if (!el) return;
      e.preventDefault();
      open(el.dataset.registerEvent);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root && !root.classList.contains('hidden')) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { open: open, close: close };
})();
