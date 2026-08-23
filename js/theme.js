/**
 * theme.js
 * ---------------------------------------------------------------
 * "Choose your own theme" — the member picks a colour family from
 * the LiF chakra palette and the whole playground re-tunes to it.
 *
 * HOW IT WORKS
 * Every stylesheet in this project already references named tokens
 * (--accent, --gold, --paper, --ink…) rather than raw hex, so a
 * theme is nothing more than a set of values written onto
 * document.documentElement. Nothing here knows about any component;
 * no component knows about this file.
 *
 * WHY IT LOADS IN <head>
 * apply() runs the moment this script parses, before the body is
 * painted, so a member who picked "Crown" never sees a flash of the
 * default purple first.
 *
 * WHAT IT DOES NOT TOUCH
 * The seven aspect colours (--a-source … --a-service) are semantic:
 * a map pin's colour tells you which LiF Aspect an event belongs to.
 * Re-tinting those would make the map lie, so they stay fixed no
 * matter which theme is on.
 *
 * PERSISTENCE
 * localStorage under `lif.theme.v1`, exactly the way the dashboard
 * persists its layout. When accounts are real this belongs on the
 * profile record as a `theme` field so it follows the member across
 * devices — swap read()/write() below and nothing else changes.
 * ------------------------------------------------------------- */

window.LIF = window.LIF || {};

LIF.theme = (function () {

  /* =========================================================
   * 1. THE PALETTE
   * Transcribed from the LiF chakra palette sheet — seven
   * families, each with two rows of six shades running dark to
   * light. Four families ship identical rows on the sheet; they
   * are kept as two rows anyway so a future revision only has to
   * change numbers here, never structure.
   * ======================================================= */
  var PALETTES = [
    { id: 'root', name: 'Root', note: 'Grounding, vitality, the body’s own red.',
      rows: [
        ['#6B0F0F', '#8B1A1A', '#B91C1C', '#DC2626', '#EF2D2D', '#F87171'],
        ['#6B0F0F', '#8B1A1A', '#B91C1C', '#DC2626', '#EF2D2D', '#F87171']
      ] },
    { id: 'sacral', name: 'Sacral', note: 'Creativity and flow. The one family whose second row really differs.',
      rows: [
        ['#6D300A', '#9A4A0D', '#BF6314', '#D97C24', '#EB9C47', '#F5C98A'],
        ['#7A2E00', '#A84400', '#D45E00', '#F07800', '#F99B3A', '#FDCB8A']
      ] },
    { id: 'solar-plexus', name: 'Solar Plexus', note: 'Will and warmth — closest to the LiF gold already in use.',
      rows: [
        ['#6E5102', '#9B7605', '#C49A13', '#D8B22D', '#E7C95A', '#F3E1A0'],
        ['#6E5102', '#9B7605', '#C49A13', '#D8B22D', '#E7C95A', '#F3E1A0']
      ] },
    { id: 'heart', name: 'Heart', note: 'Care and growing things. Quietest of the seven.',
      rows: [
        ['#3E5F2D', '#5A7A44', '#74965E', '#8CB776', '#A9CF9B', '#DCEAD2'],
        ['#3E5F2D', '#5A7A44', '#74965E', '#8CB776', '#A9CF9B', '#DCEAD2']
      ] },
    { id: 'throat', name: 'Throat', note: 'Voice and clarity. Reads well for long stretches of text.',
      rows: [
        ['#355B82', '#4C749D', '#658FBA', '#7CABD3', '#98C5E6', '#D5E7F6'],
        ['#355B82', '#4C749D', '#658FBA', '#7CABD3', '#98C5E6', '#D5E7F6']
      ] },
    { id: 'third-eye', name: 'Third Eye', note: 'Insight and pattern-seeing.',
      rows: [
        ['#4A3AB6', '#6250A3', '#7B65BE', '#9580D6', '#B1A1E8', '#E4DCF7'],
        ['#4A3AB6', '#6250A3', '#7B65BE', '#9580D6', '#B1A1E8', '#E4DCF7']
      ] },
    { id: 'crown', name: 'Crown', note: 'Unification — nearest to the logo’s centre circle.',
      rows: [
        ['#5B3A79', '#755091', '#9164A9', '#AC7AC0', '#C89CD8', '#EEE3F7'],
        ['#5B3A79', '#755091', '#9164A9', '#AC7AC0', '#C89CD8', '#EEE3F7']
      ] }
  ];

  /* The look the hub shipped with, kept as a named option so
     "put it back the way it was" is one click, not a memory test. */
  var HOUSE = {
    id: 'house', name: 'LiF House', note: 'The logo’s own purple and gold. What the hub ships with.',
    rows: [['#3A1A5C', '#4A2070', '#7030A0', '#8F5BBF', '#B99AD6', '#EBE2F2']]
  };

  /* =========================================================
   * 2. SURFACES
   * The colour family sets the accent; the paper tone sets what
   * the accent sits on. Kept separate because they are genuinely
   * separate choices — plenty of people want a green accent on
   * warm paper, or the house gold on a dark screen.
   * ======================================================= */
  var PAPERS = [
    { id: 'cream', name: 'Cream', desc: 'The warm paper the sign-up and dashboard pages were built on.',
      dark: false,
      v: { base: '#F7F1E4', deep: '#EEE4CC', paper: '#FFFCF5', paper2: '#FBF6EA',
           ink: '#241F17', inkSoft: '#6B6152', inkFaint: '#9A9082',
           line: '#E7DCC2', lineSoft: '#F0E8D6' } },
    { id: 'ivory', name: 'Ivory', desc: 'Near-white and neutral. Highest contrast for long reading.',
      dark: false,
      v: { base: '#F6F5F2', deep: '#E9E7E1', paper: '#FFFFFF', paper2: '#FAFAF8',
           ink: '#1E1C19', inkSoft: '#5F5C55', inkFaint: '#93908A',
           line: '#E3E1DB', lineSoft: '#EFEEE9' } },
    { id: 'cool', name: 'Cool', desc: 'A cooler grey ground. Lets a strong accent sit forward.',
      dark: false,
      v: { base: '#F0F2F5', deep: '#E1E5EA', paper: '#FFFFFF', paper2: '#F7F9FB',
           ink: '#191D23', inkSoft: '#576070', inkFaint: '#8B93A0',
           line: '#DDE2E9', lineSoft: '#EBEEF2' } },
    { id: 'deep', name: 'Deep', desc: 'A dark ground for evening use. Your accent carries the page.',
      dark: true,
      v: { base: '#16141C', deep: '#100F16', paper: '#211E2A', paper2: '#1A1822',
           ink: '#F3EFE7', inkSoft: '#B4ADBE', inkFaint: '#877F93',
           line: '#332E3E', lineSoft: '#282433' } }
  ];

  var DEFAULT = { palette: 'house', row: 0, shade: 2, paper: 'cream', tint: true };

  /* =========================================================
   * 3. COLOUR MATH
   * Small and self-contained on purpose: mixing in JS rather than
   * with CSS color-mix() means the computed values are inspectable
   * in devtools and there is no support question to think about.
   * ======================================================= */
  function toRgb(hex) {
    var s = String(hex).replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      var n = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return n.length === 1 ? '0' + n : n;
    }).join('');
  }
  /** mix(a, b, t) — t is how much of b lands in the result. */
  function mix(a, b, t) {
    var x = toRgb(a), y = toRgb(b);
    return toHex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; }));
  }
  function rgba(hex, alpha) {
    var c = toRgb(hex);
    return 'rgba(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', ' + alpha + ')';
  }
  /** WCAG relative luminance — used to decide black-or-white text. */
  function luminance(hex) {
    return toRgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }).reduce(function (l, v, i) { return l + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  /** The readable text colour to lay on top of `bg`. */
  function onColor(bg, darkInk, lightInk) {
    return contrast(bg, lightInk || '#FFFDF6') >= contrast(bg, darkInk || '#1B1712')
      ? (lightInk || '#FFFDF6') : (darkInk || '#1B1712');
  }

  /* =========================================================
   * 4. STATE
   * ======================================================= */
  var STORE_KEY = 'lif.theme.v1';
  var current = null;

  function palette(id) {
    if (id === 'house') return HOUSE;
    return PALETTES.find(function (p) { return p.id === id; }) || HOUSE;
  }
  function paper(id) {
    return PAPERS.find(function (p) { return p.id === id; }) || PAPERS[0];
  }
  function shades(t) {
    var p = palette(t.palette);
    return p.rows[Math.min(t.row, p.rows.length - 1)];
  }

  function read() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return Object.assign({}, DEFAULT);
      return Object.assign({}, DEFAULT, JSON.parse(raw));
    } catch (e) { return Object.assign({}, DEFAULT); }
  }
  function write(t) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(t)); } catch (e) { /* private mode — never fatal */ }
  }

  /* =========================================================
   * 5. APPLYING A THEME
   * One function, one place. Everything it writes is a token that
   * theme.css / main.css / dashboard.css already read.
   * ======================================================= */
  function tokensFor(t) {
    var sh = shades(t);
    var pap = paper(t.paper);
    var v = pap.v;
    var dark = pap.dark;

    /* The chosen swatch is the accent. On a dark ground a very dark
       swatch would vanish, so shift the pick lighter there — the
       member's choice of family is honoured either way. */
    var idx = Math.max(0, Math.min(sh.length - 1, t.shade));
    if (dark && idx < 2) idx = Math.min(sh.length - 1, idx + 2);
    var accent = sh[idx];

    /* A hover/pressed state that always moves in the readable
       direction, whichever end of the ramp the accent came from. */
    var strong = dark ? mix(accent, sh[sh.length - 1], 0.28) : mix(accent, sh[0], 0.38);
    var soft = dark ? mix(v.paper, accent, 0.20) : mix('#FFFFFF', sh[sh.length - 1], 0.72);

    /* "Tint the page" pulls a little of the accent hue into every
       neutral, so the theme reads as a whole room rather than one
       coloured button. Off by default on Deep, where it muddies. */
    var w = t.tint ? (dark ? 0.10 : 0.055) : 0;
    var tinted = function (hex, extra) { return w ? mix(hex, accent, w * (extra || 1)) : hex; };

    var base = tinted(v.base), deepBg = tinted(v.deep, 1.2);
    var paperBg = tinted(v.paper, 0.5), paper2 = tinted(v.paper2, 0.8);
    var line = tinted(v.line, 1.4), lineSoft = tinted(v.lineSoft, 1.1);
    var onAccent = onColor(accent);
    var shadowRgb = dark ? '0, 0, 0' : toRgb(mix('#3A321E', accent, 0.25)).join(', ');

    return {
      /* the raw ramp, exposed so any component can reach for a
         lighter or darker step of the member's own colour */
      '--theme-1': sh[0], '--theme-2': sh[1], '--theme-3': sh[2],
      '--theme-4': sh[3], '--theme-5': sh[4], '--theme-6': sh[5],

      /* accent set — read by theme.css (hub) */
      '--accent': accent,
      '--accent-strong': strong,
      '--accent-soft': soft,
      '--accent-contrast': onAccent,

      /* dashboard.css calls its accent "gold"; same job, so alias it
         rather than editing every rule that mentions it */
      '--gold': accent,
      '--gold-soft': dark ? mix(accent, v.paper, 0.45) : sh[Math.min(sh.length - 1, idx + 2)],
      '--on-accent': onAccent,
      '--accent-ring': rgba(accent, dark ? 0.32 : 0.16),
      '--accent-wash': dark ? mix(v.paper, accent, 0.16) : mix('#FFFFFF', accent, 0.10),

      /* surfaces */
      '--cream': base, '--cream-deep': deepBg,
      '--paper': paperBg, '--paper-2': paper2, '--paper-raised': paperBg,
      '--ink': v.ink, '--ink-soft': v.inkSoft, '--ink-muted': v.inkSoft, '--ink-faint': v.inkFaint,
      '--line': line, '--line-soft': lineSoft, '--line-strong': tinted(v.line, 2),
      '--tint-warm': dark ? mix(v.paper, accent, 0.22) : mix(paperBg, accent, 0.10),
      '--glass': dark ? rgba(mix(v.base, accent, w), 0.86) : rgba(mix(v.paper, accent, w), 0.88),
      '--scrim-bg': dark ? 'rgba(6, 5, 10, .62)' : rgba(mix('#241F17', accent, 0.2), 0.34),
      '--field-bg': dark ? mix(v.paper, '#000000', 0.14) : paperBg,

      /* the page's own ambient wash, behind everything */
      '--bg-glow-a': dark ? mix(v.base, accent, 0.16) : mix(base, accent, 0.14),
      '--bg-glow-b': dark ? mix(v.base, accent, 0.08) : mix(deepBg, accent, 0.10),

      '--shadow-sm': '0 1px 2px rgba(' + shadowRgb + ', ' + (dark ? '.5' : '.07') + ')',
      '--shadow-md': '0 10px 30px -12px rgba(' + shadowRgb + ', ' + (dark ? '.7' : '.28') + ')',
      '--shadow-lg': '0 26px 60px -22px rgba(' + shadowRgb + ', ' + (dark ? '.85' : '.42') + ')'
    };
  }

  function apply(t) {
    current = t || current || read();
    var root = document.documentElement;
    var tok = tokensFor(current);
    Object.keys(tok).forEach(function (k) { root.style.setProperty(k, tok[k]); });
    root.setAttribute('data-paper', current.paper);
    root.setAttribute('data-palette', current.palette);
    root.setAttribute('data-scheme', paper(current.paper).dark ? 'dark' : 'light');
    /* Native form controls and scrollbars follow this, which is the
       difference between "dark theme" and "dark theme with white
       dropdowns punched through it". */
    root.style.colorScheme = paper(current.paper).dark ? 'dark' : 'light';
    return current;
  }

  function set(patch, opts) {
    current = Object.assign({}, current || read(), patch);
    apply(current);
    write(current);
    if (!opts || !opts.silent) {
      document.dispatchEvent(new CustomEvent('lif:themechange', { detail: current }));
      renderPanel();
    }
    return current;
  }

  function reset() {
    current = Object.assign({}, DEFAULT);
    apply(current);
    write(current);
    renderPanel();
    toast('Theme back to the LiF house colours.');
  }

  function toast(msg) {
    if (LIF.util && LIF.util.showToast && document.getElementById('toast')) LIF.util.showToast(msg);
  }

  /* =========================================================
   * 6. THE PICKER
   * Injected rather than written into each page's HTML, so adding
   * the theme picker to a new page is one <script> tag and a
   * button carrying data-theme-open.
   * ======================================================= */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureShell() {
    if (document.getElementById('themePanel')) return;
    var scrim = document.createElement('div');
    scrim.id = 'themeScrim';
    scrim.className = 'theme-scrim hidden';
    scrim.addEventListener('click', close);

    var panel = document.createElement('aside');
    panel.id = 'themePanel';
    panel.className = 'theme-panel hidden';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Choose your theme');

    document.body.appendChild(scrim);
    document.body.appendChild(panel);

    panel.addEventListener('click', function (e) {
      var el = e.target.closest('[data-theme-action]');
      if (!el) return;
      var a = el.dataset.themeAction;
      if (a === 'close') close();
      else if (a === 'reset') reset();
      else if (a === 'swatch') set({ palette: el.dataset.palette, row: +el.dataset.row, shade: +el.dataset.shade });
      else if (a === 'paper') set({ paper: el.dataset.paper });
      else if (a === 'tint') set({ tint: el.dataset.on === 'true' });
    });
  }

  function swatchRow(p, rowIndex) {
    var row = p.rows[rowIndex];
    var label = p.name + (rowIndex ? ' 2' : '');
    return '<div class="tp-row">' +
      '<div class="tp-row-label">' + esc(label) + '</div>' +
      '<div class="tp-swatches">' + row.map(function (hex, i) {
        var on = current.palette === p.id && current.row === rowIndex && current.shade === i;
        return '<button type="button" class="tp-swatch' + (on ? ' is-on' : '') + '"' +
          ' style="--sw:' + hex + ';--sw-ink:' + onColor(hex) + '"' +
          ' data-theme-action="swatch" data-palette="' + p.id + '" data-row="' + rowIndex + '" data-shade="' + i + '"' +
          ' title="' + esc(label + ' ' + hex) + '" aria-pressed="' + on + '">' +
          '<span class="tp-swatch-hex">' + esc(hex) + '</span></button>';
      }).join('') + '</div></div>';
  }

  function paletteBlock(p) {
    return '<section class="tp-family' + (current.palette === p.id ? ' is-on' : '') + '">' +
      '<header class="tp-family-head"><h4>' + esc(p.name) + '</h4><p>' + esc(p.note) + '</p></header>' +
      p.rows.map(function (_, i) { return swatchRow(p, i); }).join('') +
      '</section>';
  }

  function panelHtml() {
    var sh = shades(current);
    var pap = paper(current.paper);
    var accent = tokensFor(current)['--accent'];

    return '<header class="tp-head">' +
        '<div><p class="tp-eyebrow">Make it yours</p><h2>Choose your theme</h2></div>' +
        '<button type="button" class="tp-x" data-theme-action="close" aria-label="Close theme picker">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</header>' +

      '<div class="tp-body">' +
        '<p class="tp-intro">Pick any colour from the LiF palette and the whole playground re-tunes to it — buttons, ' +
          'links, highlights, the paper underneath. It only changes your own view, and you can put it back in one click.</p>' +

        '<div class="tp-preview" style="--pv:' + accent + '">' +
          '<div class="tp-preview-chip"></div>' +
          '<div class="tp-preview-copy">' +
            '<strong>' + esc(palette(current.palette).name) + (current.row ? ' 2' : '') + ' · ' + esc(accent) + '</strong>' +
            '<span>on ' + esc(pap.name.toLowerCase()) + ' paper' + (current.tint ? ', tinted to match' : '') + '</span>' +
          '</div>' +
          '<button type="button" class="tp-preview-btn">Register</button>' +
        '</div>' +

        '<div class="tp-section">' +
          '<h3>Paper</h3>' +
          '<p class="tp-hint">What your colour sits on.</p>' +
          '<div class="tp-papers">' + PAPERS.map(function (p) {
            var on = current.paper === p.id;
            return '<button type="button" class="tp-paper' + (on ? ' is-on' : '') + '" data-theme-action="paper" data-paper="' + p.id + '" aria-pressed="' + on + '">' +
              '<span class="tp-paper-chip" style="background:' + p.v.paper + ';border-color:' + p.v.line + '">' +
                '<i style="background:' + p.v.ink + '"></i><i style="background:' + p.v.inkFaint + '"></i></span>' +
              '<span class="tp-paper-name">' + esc(p.name) + '</span>' +
              '<span class="tp-paper-desc">' + esc(p.desc) + '</span></button>';
          }).join('') + '</div>' +
          '<label class="tp-tint">' +
            '<input type="checkbox" ' + (current.tint ? 'checked' : '') + ' data-theme-action="tint" data-on="' + (!current.tint) + '">' +
            '<span><strong>Tint the paper to match</strong><br>' +
            '<span class="tp-hint">Pulls a trace of your colour into the backgrounds and borders. Off keeps them neutral.</span></span>' +
          '</label>' +
        '</div>' +

        '<div class="tp-section">' +
          '<h3>Your colour</h3>' +
          '<p class="tp-hint">Darker shades on the left carry text and buttons best; the lighter ones on the right read as ' +
            'a wash. Every swatch is live — click and the page changes under you.</p>' +
          paletteBlock(HOUSE) +
          PALETTES.map(paletteBlock).join('') +
        '</div>' +

        '<div class="tp-section tp-foot">' +
          '<button type="button" class="tp-reset" data-theme-action="reset">Back to LiF house colours</button>' +
          '<p class="tp-hint">Saved on this device. Once accounts carry a <code>theme</code> field it will follow you ' +
            'to any browser you sign in from.</p>' +
        '</div>' +

        '<div class="tp-section">' +
          '<h3>What never changes</h3>' +
          '<p class="tp-hint">The seven Aspect colours stay fixed in every theme — a pin’s colour is how the map tells ' +
            'you which Aspect an event belongs to, so re-tinting those would make it lie.</p>' +
          '<div class="tp-aspects">' + ['source', 'divine', 'presence', 'engagement', 'nature', 'community', 'service']
            .map(function (a) { return '<span class="tp-aspect" style="background:var(--a-' + a + ')"></span>'; }).join('') +
          '</div>' +
        '</div>' +

        '<p class="tp-note">Current ramp: ' + sh.map(function (x) { return '<code>' + esc(x) + '</code>'; }).join(' ') + '</p>' +
      '</div>';
  }

  function renderPanel() {
    var panel = document.getElementById('themePanel');
    if (!panel || panel.classList.contains('hidden')) return;
    var scrollTop = panel.querySelector('.tp-body') ? panel.querySelector('.tp-body').scrollTop : 0;
    panel.innerHTML = panelHtml();
    var body = panel.querySelector('.tp-body');
    if (body) body.scrollTop = scrollTop;
  }

  function open() {
    ensureShell();
    var panel = document.getElementById('themePanel');
    panel.innerHTML = panelHtml();
    panel.classList.remove('hidden');
    document.getElementById('themeScrim').classList.remove('hidden');
    document.body.classList.add('theme-panel-open');
    var first = panel.querySelector('.tp-x');
    if (first) first.focus();
  }

  function close() {
    var panel = document.getElementById('themePanel');
    if (!panel) return;
    panel.classList.add('hidden');
    document.getElementById('themeScrim').classList.add('hidden');
    document.body.classList.remove('theme-panel-open');
  }

  function isOpen() {
    var p = document.getElementById('themePanel');
    return !!p && !p.classList.contains('hidden');
  }

  /* =========================================================
   * 7. BOOT
   * apply() first and synchronously — the wiring can wait for
   * DOM, the colours cannot.
   * ======================================================= */
  apply(read());

  function init() {
    ensureShell();
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-theme-open]')) { e.preventDefault(); open(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    open: open, close: close, apply: apply, set: set, reset: reset,
    get: function () { return Object.assign({}, current); },
    tokens: function () { return tokensFor(current); },
    palettes: PALETTES, house: HOUSE, papers: PAPERS,
    mix: mix, onColor: onColor, rgba: rgba
  };
})();
