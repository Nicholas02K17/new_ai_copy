/**
 * calendarView.js
 * ---------------------------------------------------------------
 * The master calendar, per the meeting's action item: fullcalendar.io
 * rather than linking out to Google Calendar. Reads from the exact
 * same filtered event list as the map/card views, so the framework
 * doc's "calendar, dashboard and map work together" holds true.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.calendarView = (function () {
  var U = LIF.util;
  var calendar = null;

  function chakraVarName(chakra) { return chakra === 'third-eye' ? 'thirdeye' : chakra; }

  function chakraColor(evt) {
    var a = U.getAspect(evt.aspect);
    return 'var(--' + chakraVarName(a ? a.chakra : 'heart') + '-600)';
  }

  function toFcEvents(events) {
    return events.map(function (evt) {
      return {
        id: evt.id,
        title: evt.title,
        start: evt.start,
        end: evt.end,
        backgroundColor: chakraColor(evt),
        borderColor: chakraColor(evt),
        textColor: '#ffffff'
      };
    });
  }

  function ensureCalendar() {
    if (calendar) return calendar;
    var el = U.$('#calendarEl');
    calendar = new FullCalendar.Calendar(el, {
      initialView: 'dayGridMonth',
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listMonth' },
      height: 'auto',
      dayMaxEvents: 3,
      events: [],
      eventClick: function (info) {
        info.jsEvent.preventDefault();
        LIF.eventDetail.open(info.event.id);
      }
    });
    calendar.render();
    return calendar;
  }

  function render(events) {
    var cal = ensureCalendar();
    cal.removeAllEvents();
    toFcEvents(events).forEach(function (e) { cal.addEvent(e); });
    setTimeout(function () { cal.updateSize(); }, 50);
  }

  return { render: render };
})();
