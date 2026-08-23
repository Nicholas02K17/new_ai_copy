/**
 * map.js
 * ---------------------------------------------------------------
 * Leaflet + OpenStreetMap tiles power the map (no API key needed).
 * The baseline app used the Google Maps JS API - if you'd rather use
 * that (or Mapbox) once you have a key, this is the only file that
 * touches the map library directly, so it's a contained swap.
 *
 * Design decision from the meeting transcript: online events don't
 * get a pin (a location doesn't mean anything for them) - only
 * in-person and hybrid events show up here. Online events render as
 * a card strip beneath the map instead (see app.js renderEventsView).
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.mapModule = (function () {
  var U = LIF.util;
  var map = null;
  var markers = [];

  function ensureMap() {
    if (map) return map;
    map = L.map('map', { scrollWheelZoom: true, worldCopyJump: true }).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    return map;
  }

  function pinHtml(evt) {
    var aspect = U.getAspect(evt.aspect);
    var chakraClass = 'chakra-' + (aspect ? aspect.chakra : 'heart');
    var locked = evt.visibility === 'organization';
    return (
      '<div class="pin ' + chakraClass + '">' +
        '<svg viewBox="0 0 30 40" aria-hidden="true">' +
          '<path class="pin-body" d="M15 0C6.7 0 0 6.7 0 15c0 10 15 25 15 25s15-15 15-25C30 6.7 23.3 0 15 0z"/>' +
          (locked ? '' : '<circle cx="15" cy="15" r="6" fill="#fff"/>') +
        '</svg>' +
        (locked ? '<svg class="pin-lock" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 10V8a6 6 0 0112 0v2h1a1 1 0 011 1v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9a1 1 0 011-1h1zm2 0h8V8a4 4 0 00-8 0v2z"/></svg>' : '') +
      '</div>'
    );
  }

  function popupHtml(evt) {
    var locked = evt.visibility === 'organization';
    var title = locked ? evt.host + ' members-only event' : evt.title;
    var summary = locked ? 'Sign in with a ' + evt.host + ' membership to see full details.' : evt.summary;
    return (
      '<div class="map-popup-title">' + U.escapeHtml(title) + '</div>' +
      '<div class="map-popup-meta">' + U.escapeHtml(U.formatDateRange(evt.start, evt.end)) + '</div>' +
      '<div style="font-size:13px;margin-bottom:8px;max-width:220px;">' + U.escapeHtml(summary) + '</div>' +
      '<button class="map-popup-btn" data-open-event="' + evt.id + '">View details \u2192</button>'
    );
  }

  function clearMarkers() {
    markers.forEach(function (m) { m.remove(); });
    markers = [];
  }

  function render(events) {
    var m = ensureMap();
    clearMarkers();

    var pinEvents = events.filter(function (e) { return e.format !== 'online' && e.location; });

    pinEvents.forEach(function (evt) {
      var marker = L.marker([evt.location.lat, evt.location.lng], {
        icon: L.divIcon({ html: pinHtml(evt), className: '', iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -34] })
      }).addTo(m);
      marker.bindPopup(popupHtml(evt));
      marker.on('popupopen', function (e) {
        var btn = e.popup.getElement().querySelector('[data-open-event]');
        if (btn) btn.addEventListener('click', function () { LIF.eventDetail.open(evt.id); });
      });
      markers.push(marker);
    });

    if (pinEvents.length) {
      var bounds = L.latLngBounds(pinEvents.map(function (e) { return [e.location.lat, e.location.lng]; }));
      m.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
    } else {
      m.setView([20, 0], 2);
    }

    return pinEvents.length;
  }

  function invalidateSize() {
    if (map) setTimeout(function () { map.invalidateSize(); }, 60);
  }

  return { render: render, invalidateSize: invalidateSize };
})();
