/**
 * utils.js
 * ---------------------------------------------------------------
 * Small stateless helpers shared across the app: DOM shortcuts,
 * date/time formatting, distance math for the location filter, and
 * the "backend placeholder" pattern used by every button that needs
 * a real server behind it eventually (register, save profile, join
 * group, message someone, etc).
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.util = (function () {

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $all(selector, root) { return Array.from((root || document).querySelectorAll(selector)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      if (key === 'class') node.className = attrs[key];
      else if (key === 'html') node.innerHTML = attrs[key];
      else if (key.indexOf('on') === 0 && typeof attrs[key] === 'function') node.addEventListener(key.slice(2), attrs[key]);
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      if (child == null) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  /* ---- ISO datetime parsing without browser-timezone conversion ----
   * Events carry their own UTC offset (the venue's local time). We
   * read that offset directly instead of letting the browser convert
   * to the viewer's local time, so "4:00 PM" always means 4pm at the
   * venue, not 4pm wherever Nicholas happens to be testing this. */
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2}|Z)$/;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function parseIsoParts(iso) {
    var m = ISO_RE.exec(iso);
    if (!m) return null;
    return {
      year: +m[1], month: +m[2], day: +m[3],
      hour: +m[4], minute: +m[5], second: +m[6],
      offset: m[7]
    };
  }

  function weekdayFromParts(p) {
    // Zeller-ish shortcut: rely on Date for the day-of-week only,
    // constructed as a UTC date so the calendar date itself doesn't shift.
    var d = new Date(Date.UTC(p.year, p.month - 1, p.day));
    return DAYS[d.getUTCDay()];
  }

  function formatTime(p) {
    var h = p.hour % 12; if (h === 0) h = 12;
    var ampm = p.hour < 12 ? 'AM' : 'PM';
    var min = p.minute < 10 ? '0' + p.minute : String(p.minute);
    return h + ':' + min + ' ' + ampm;
  }

  function formatDate(p) {
    return DAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()] + ', ' + MONTHS[p.month - 1] + ' ' + p.day;
  }

  function formatDateRange(startIso, endIso) {
    var s = parseIsoParts(startIso);
    var e = endIso ? parseIsoParts(endIso) : null;
    if (!s) return '';
    var out = formatDate(s) + ' \u00B7 ' + formatTime(s);
    if (e) out += ' \u2013 ' + formatTime(e);
    return out;
  }

  function timeOfDayBucket(iso) {
    var p = parseIsoParts(iso);
    if (!p) return null;
    if (p.hour < 12) return 'morning';
    if (p.hour < 17) return 'afternoon';
    if (p.hour < 21) return 'evening';
    return 'night';
  }

  function durationMinutes(startIso, endIso) {
    if (!startIso || !endIso) return null;
    return Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  }

  /* ---- distance ---- */
  function haversineKm(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function initials(name) {
    return String(name).split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
  }

  /* ---- lookups ---- */
  function getAspect(id) { return LIF.ASPECTS.find(function (a) { return a.id === id; }); }
  function getSector(id) { return LIF.SECTORS.find(function (s) { return s.id === id; }); }
  function getOrganization(id) { return LIF.ORGANIZATIONS.find(function (o) { return o.id === id; }); }
  function getEvent(id) { return LIF.EVENTS.find(function (e) { return e.id === id; }); }

  /* ---- toast ---- */
  var toastTimer;
  function showToast(message) {
    var toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    requestAnimationFrame(function () { toast.classList.add('toast--visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('toast--visible');
      setTimeout(function () { toast.classList.add('hidden'); }, 200);
    }, 3200);
  }

  /* ---- the backend-placeholder pattern ----
   * Every action that needs a real server (register, save profile,
   * send a message, join a group...) routes through here. It's
   * intentionally loud about being a placeholder, and opens
   * google.com per your note, rather than silently doing nothing. */
  function backendPlaceholder(actionLabel) {
    showToast(actionLabel + ' \u2014 this will call the real backend once it exists. Opening a placeholder for now.');
    window.open('https://www.google.com', '_blank', 'noopener');
  }

  /* ---- genuine frontend-only actions (no backend needed) ---- */
  function buildGoogleCalendarUrl(evt) {
    var fmt = function (iso) { return iso.replace(/[-:]/g, '').split('.')[0].replace(/[+-]\d{2}:?\d{2}$|Z$/, 'Z'); };
    // Google Calendar wants UTC timestamps; derive them from the real instant.
    var toUtcStamp = function (iso) {
      var d = new Date(iso);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    var params = new URLSearchParams({
      action: 'TEMPLATE',
      text: evt.title,
      dates: toUtcStamp(evt.start) + '/' + toUtcStamp(evt.end || evt.start),
      details: evt.summary + (evt.onlineLink ? ('\n\nJoin: ' + evt.onlineLink) : ''),
      location: evt.location ? [evt.location.venue, evt.location.city, evt.location.country].filter(Boolean).join(', ') : (evt.onlineLink || 'Online')
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  function buildIcsAndDownload(evt) {
    var toUtcStamp = function (iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; };
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LiF Hub//Event//EN', 'BEGIN:VEVENT',
      'UID:' + evt.id + '@lif-hub', 'DTSTAMP:' + toUtcStamp(new Date().toISOString()),
      'DTSTART:' + toUtcStamp(evt.start), 'DTEND:' + toUtcStamp(evt.end || evt.start),
      'SUMMARY:' + evt.title.replace(/,/g, '\\,'),
      'DESCRIPTION:' + (evt.description || evt.summary || '').replace(/,/g, '\\,').replace(/\n/g, '\\n'),
      'LOCATION:' + (evt.location ? [evt.location.venue, evt.location.city].filter(Boolean).join(', ') : (evt.onlineLink || 'Online')).replace(/,/g, '\\,'),
      'END:VEVENT', 'END:VCALENDAR'
    ];
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = evt.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function buildMailtoInvite(evt) {
    var subject = 'Join me at ' + evt.title;
    var body = 'I thought you might like this:\n\n' + evt.title + '\n' + formatDateRange(evt.start, evt.end) +
      '\n\n' + evt.summary + '\n\n' + (evt.onlineLink ? ('Join link: ' + evt.onlineLink) : 'Details on the LiF Hub.');
    return 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast('Link copied.'); }, function () { showToast('Could not copy - copy it manually: ' + text); });
    } else {
      showToast('Copy not supported in this browser.');
    }
  }

  return {
    $: $, $all: $all, el: el, escapeHtml: escapeHtml, debounce: debounce,
    parseIsoParts: parseIsoParts, formatDateRange: formatDateRange, formatDate: formatDate,
    formatTime: formatTime, weekdayFromParts: weekdayFromParts, timeOfDayBucket: timeOfDayBucket,
    durationMinutes: durationMinutes, haversineKm: haversineKm,
    initials: initials, getAspect: getAspect, getSector: getSector, getOrganization: getOrganization, getEvent: getEvent,
    showToast: showToast, backendPlaceholder: backendPlaceholder,
    buildGoogleCalendarUrl: buildGoogleCalendarUrl, buildIcsAndDownload: buildIcsAndDownload,
    buildMailtoInvite: buildMailtoInvite, copyToClipboard: copyToClipboard
  };
})();
