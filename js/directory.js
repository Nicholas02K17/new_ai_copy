/**
 * directory.js
 * ---------------------------------------------------------------
 * Card-grid views for the four lighter-weight nav tabs: People,
 * Groups, Organizations, Opportunities. These stay simple grids
 * rather than full map experiences, since the map's job (per your
 * request) is specifically event pins now, not people pins.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.directory = (function () {
  var U = LIF.util;

  function aspectSectorTags(aspectIds, sectorIds) {
    var a = (aspectIds || []).map(function (id) {
      var asp = U.getAspect(id);
      return asp ? '<span class="badge badge--chakra chakra-' + asp.chakra + '">' + U.escapeHtml(asp.name) + '</span>' : '';
    }).join('');
    var s = (sectorIds || []).map(function (id) {
      var sec = U.getSector(id);
      return sec ? '<span class="badge">' + U.escapeHtml(sec.name) + '</span>' : '';
    }).join('');
    return a + s;
  }

  function renderPeople() {
    var grid = U.$('#peopleGrid');
    if (!grid) return;
    grid.innerHTML = LIF.PEOPLE.map(function (p) {
      return '<div class="directory-card">' +
        '<div class="directory-card-header"><div class="avatar">' + U.initials(p.name) + '</div>' +
        '<div><h4>' + U.escapeHtml(p.name) + '</h4><div class="directory-card-sub">' + U.escapeHtml(p.city + ', ' + p.country) + '</div></div></div>' +
        '<p>' + U.escapeHtml(p.bio) + '</p>' +
        '<div class="directory-card-tags">' + aspectSectorTags(p.aspects, p.sectors) + '</div>' +
        '<button class="btn-secondary" data-connect="' + p.id + '" type="button">Connect</button>' +
        '</div>';
    }).join('');
    U.$all('[data-connect]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = LIF.PEOPLE.find(function (x) { return x.id === btn.dataset.connect; });
        U.backendPlaceholder('Connecting with ' + (p ? p.name : 'this member'));
      });
    });
  }

  function renderGroups() {
    var grid = U.$('#groupsGrid');
    if (!grid) return;
    grid.innerHTML = LIF.GROUPS.map(function (g) {
      var sector = U.getSector(g.sector);
      return '<div class="directory-card">' +
        '<h4>' + U.escapeHtml(g.name) + '</h4>' +
        '<div class="directory-card-sub">' + g.memberCount + ' members</div>' +
        '<p>' + U.escapeHtml(g.description) + '</p>' +
        '<div class="directory-card-tags">' + (sector ? '<span class="badge">' + U.escapeHtml(sector.name) + '</span>' : '') + '</div>' +
        '<button class="btn-secondary" data-join="' + g.id + '" type="button">Join group</button>' +
        '</div>';
    }).join('');
    U.$all('[data-join]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var g = LIF.GROUPS.find(function (x) { return x.id === btn.dataset.join; });
        U.backendPlaceholder('Joining ' + (g ? g.name : 'this group'));
      });
    });
  }

  function renderOrganizations() {
    var grid = U.$('#organizationsGrid');
    if (!grid) return;
    grid.innerHTML = LIF.ORGANIZATIONS.map(function (o) {
      var sectorTags = (o.focusSectors || []).map(function (id) {
        var s = U.getSector(id);
        return s ? '<span class="badge">' + U.escapeHtml(s.name) + '</span>' : '';
      }).join('');
      return '<div class="directory-card">' +
        '<div class="directory-card-header"><div class="avatar">' + U.initials(o.name) + '</div>' +
        '<div><h4>' + U.escapeHtml(o.name) + '</h4><div class="directory-card-sub">' + U.escapeHtml(o.tagline) + '</div></div></div>' +
        '<p>' + U.escapeHtml(o.description) + '</p>' +
        '<div class="directory-card-tags">' + sectorTags + '</div>' +
        '<button class="btn-secondary" data-view-org="' + o.id + '" type="button">View public events</button>' +
        '</div>';
    }).join('');
    U.$all('[data-view-org]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var o = LIF.ORGANIZATIONS.find(function (x) { return x.id === btn.dataset.viewOrg; });
        LIF.state.filters.search = o ? o.name : '';
        LIF.app.setView('events');
        LIF.app.syncToolbarUI();
        LIF.app.refreshEvents();
      });
    });
  }

  function renderOpportunities() {
    var grid = U.$('#opportunitiesGrid');
    if (!grid) return;
    grid.innerHTML = LIF.OPPORTUNITIES.map(function (o) {
      return '<div class="directory-card">' +
        '<span class="opportunity-type">' + U.escapeHtml(o.type) + '</span>' +
        '<h4>' + U.escapeHtml(o.title) + '</h4>' +
        '<p>' + U.escapeHtml(o.description) + '</p>' +
        '<button class="btn-secondary" data-interested="' + o.id + '" type="button">I\u2019m interested</button>' +
        '</div>';
    }).join('');
    U.$all('[data-interested]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var o = LIF.OPPORTUNITIES.find(function (x) { return x.id === btn.dataset.interested; });
        U.backendPlaceholder('Registering interest in ' + (o ? o.title : 'this opportunity'));
      });
    });
  }

  return {
    renderPeople: renderPeople, renderGroups: renderGroups,
    renderOrganizations: renderOrganizations, renderOpportunities: renderOpportunities
  };
})();
