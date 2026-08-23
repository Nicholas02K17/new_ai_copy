/**
 * hubEvents.js
 * ---------------------------------------------------------------
 * Two small things the events hub owes the spec, kept out of the
 * files that already do a job:
 *
 *   1. Hover preview. "Hover over, show a brief description and can
 *      click through if interested." One floating card, delegated
 *      off any element carrying data-open-event, so it works for
 *      list cards, the online strip and map popups alike without
 *      any of them knowing about it.
 *
 *   2. The proposal entry point in the header, and a deep link:
 *      #propose opens the proposal pathway straight from a URL,
 *      which is what an email or a private message will link to.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.hubEvents = (function () {
  var U = LIF.util;
  var h = U.escapeHtml;

  var tip = null;
  var overId = null;
  var showTimer = null;

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'ev-hover hidden';
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    return tip;
  }

  function html(evt) {
    var st = LIF.events.registrationState(evt);
    var locked = evt.visibility === 'organization';
    var where = evt.location ? evt.location.city + ', ' + evt.location.country : 'Online';
    return '<p class="ev-hover-when">' + h(U.formatDateRange(evt.start, evt.end)) + ' · ' + h(where) + '</p>' +
      '<h5>' + h(locked ? evt.host + ' members-only event' : evt.title) + '</h5>' +
      '<p>' + h(locked ? 'Sign in to see the full details.' : evt.summary) + '</p>' +
      '<div class="ev-hover-foot">' +
        '<span>Click for details &amp; registration →</span>' +
        '<span class="ev-hover-status">' + h(st.code === 'open' ? 'Open' : st.label) + '</span>' +
      '</div>';
  }

  function place(e) {
    if (!tip || tip.classList.contains('hidden')) return;
    var pad = 14;
    var w = tip.offsetWidth, hgt = tip.offsetHeight;
    var x = e.clientX + pad;
    var y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
    if (y + hgt > window.innerHeight - 8) y = Math.max(8, e.clientY - hgt - pad);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function show(evt, e) {
    ensureTip();
    tip.innerHTML = html(evt);
    tip.classList.remove('hidden');
    place(e);
  }

  function hide() {
    overId = null;
    clearTimeout(showTimer);
    if (tip) tip.classList.add('hidden');
  }

  function onOver(e) {
    var card = e.target.closest('[data-open-event]');
    if (!card) { if (overId) hide(); return; }
    var id = card.dataset.openEvent;
    if (id === overId) return;
    overId = id;
    var evt = LIF.events.get(id);
    if (!evt) return;
    clearTimeout(showTimer);
    /* A short delay so sweeping the cursor across a grid of cards
       does not strobe a tooltip at every one. */
    var ev = e;
    showTimer = setTimeout(function () { if (overId === id) show(evt, ev); }, 260);
  }

  function init() {
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mousemove', function (e) {
      if (overId) place(e);
    });
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('[data-open-event]')) hide();
    });
    document.addEventListener('click', hide);
    window.addEventListener('scroll', hide, true);

    if (location.hash === '#propose') LIF.eventProposal.open();

    /* A member's own proposal should show up on the hub without a
       reload once the pathway closes. */
    document.addEventListener('lif:eventproposed', function () {
      if (LIF.app && LIF.app.refreshEvents) LIF.app.refreshEvents();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { hide: hide };
})();
