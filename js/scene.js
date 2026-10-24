/* 水墨 Scene painter — turns a tiny text spec ("night moon river boat") into an
   ink-wash style SVG string. Deterministic per seed, so each poem always gets the
   same picture. No images are downloaded: every painting is ~3–8 KB of markup built
   on the fly. */
(function (global) {
  'use strict';

  var W = 300, H = 200;
  var INK = '#2b2724', PAPER = '#f2ebdd';

  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function n(v) { return Math.round(v * 10) / 10; }

  function paint(spec, seed, opt) {
    opt = opt || {};
    var words = {};
    String(spec || '').replace(/:/g, ' ').split(/\s+/).forEach(function (w) { if (w) words[w] = 1; });
    var has = function (w) { return !!words[w]; };
    var any = function (list) { return list.some(has); };
    var R = mulberry(hash(String(seed) + '|' + spec));
    var r = function (a, b) { return a + (b - a) * R(); };
    var chance = function (p) { return R() < p; };
    var uid = 'g' + hash(String(seed) + spec).toString(36);
    var gid = 0, defs = [];
    var nid = function () { return uid + '_' + (gid++); };
    var L = { sky: [], far: [], mid: [], near: [], water: [], ground: [], obj: [], air: [], fx: [], glow: [], frame: [] };

    var time = has('night') ? 'night' : has('dusk') ? 'dusk' : has('dawn') ? 'dawn' : 'day';
    var season = ['spring', 'summer', 'autumn', 'winter'].filter(has)[0] ||
      (any(['snow', 'plum']) ? 'winter' : any(['maple', 'chrysanthemum', 'geese', 'reeds', 'leaves']) ? 'autumn' :
        has('lotus') ? 'summer' : any(['peach', 'willow', 'swallows', 'petals', 'oriole', 'butterfly']) ? 'spring' : '');
    var snowy = has('snow');
    var desert = has('desert');
    var water = any(['river', 'lake', 'sea', 'boat', 'sail', 'fisher', 'lotus']);
    var horizon = water ? r(110, 126) : desert ? r(125, 140) : r(126, 142);
    var side = chance(0.5) ? 'L' : 'R';

    // 三远 — Guo Xi's three ways to build a landscape: 平远 level distance (low ridges, wide space),
    // 深远 deep distance (ridge behind ridge, mist between), 高远 high distance (one towering peak)
    var comp = 'level';
    if (has('peaks') || has('waterfall') || has('mountains')) {
      var cr = R();
      comp = has('waterfall') || cr < (has('mountains') ? 0.22 : 0.45) ? 'high' : cr < 0.72 ? 'deep' : 'level';
    } else if (!water && !desert && !has('sea') && chance(0.3)) comp = 'deep';
    // colour manner: 水墨 plain ink, 浅绛 pale ochre washes, 青绿 blue-green mineral colours (a Tang favourite)
    var era = opt.era || '';
    var wts = /唐|隋|南北朝|魏晋/.test(era) ? [0.4, 0.2] : /宋|元|金/.test(era) ? [0.5, 0.35] : [0.5, 0.3];
    var sr0 = R(), manner = sr0 < wts[0] ? 'ink' : sr0 < wts[0] + wts[1] ? 'ochre' : 'green';
    // where the inscription goes: the open side of the sky (the peak, if any, stands on the other side)
    var peakSide = side;
    var inscribe = comp === 'high' ? (peakSide === 'L' ? 'R' : 'L') : side;

    function grad(stops, vertical, x2) {
      var id = nid();
      defs.push('<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (vertical === false ? (x2 || 1) : 0) +
        '" y2="' + (vertical === false ? 0 : 1) + '">' + stops.map(function (s) {
          return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
        }).join('') + '</linearGradient>');
      return 'url(#' + id + ')';
    }
    function radial(color, o) {
      var id = nid();
      defs.push('<radialGradient id="' + id + '"><stop offset="0" stop-color="' + color + '" stop-opacity="' + o +
        '"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></radialGradient>');
      return 'url(#' + id + ')';
    }

    /* ---------- sky ---------- */
    var skyTop = { dawn: '#e6c9bf', day: '#dce3e1', dusk: '#dea57f', night: '#36405a' }[time];
    var skyLow = { dawn: '#f3e6d6', day: PAPER, dusk: '#f0d9bd', night: '#9b9a96' }[time];
    if (snowy) { skyTop = time === 'night' ? '#3d4452' : '#c9cbc8'; skyLow = time === 'night' ? '#a3a3a0' : '#efeeea'; }
    if (has('rain') && time === 'day') { skyTop = '#bfc4c4'; }
    L.sky.push('<rect width="' + W + '" height="' + H + '" fill="' + grad([[0, skyTop], [0.75, skyLow]]) + '"/>');

    if (has('stars') || (time === 'night' && !has('rain') && !snowy && chance(0.6))) {
      for (var si = 0; si < 26; si++) {
        L.glow.push('<circle cx="' + n(r(4, W - 4)) + '" cy="' + n(r(4, horizon * 0.55)) + '" r="' + n(r(0.3, 0.9)) +
          '" fill="#fffbe8" opacity="' + n(r(0.4, 0.9)) + '"/>');
      }
    }

    var lightX = side === 'L' ? r(180, 260) : r(40, 120);
    if (has('sun') || ((time === 'dusk' || time === 'dawn') && !has('moon') && !has('crescent') && !has('rain'))) {
      var low = time === 'dusk' || time === 'dawn';
      var sy = low ? horizon - r(4, 22) : r(28, 55), sr = low ? r(13, 18) : r(9, 13);
      if (desert) { sr += 3; sy = horizon - r(10, 18); }
      L.sky.push('<circle cx="' + n(lightX) + '" cy="' + n(sy) + '" r="' + n(sr * 2.2) + '" fill="' + radial('#e8a070', 0.35) + '"/>');
      L.sky.push('<circle cx="' + n(lightX) + '" cy="' + n(sy) + '" r="' + n(sr) + '" fill="' + (low ? '#cf5530' : '#c43e2c') + '" opacity=".88"/>');
      if (water) reflect(lightX, sr, '#cf5530', 0.5);
    }
    if (has('moon') || has('crescent')) {
      var mx = lightX, my = r(26, 52), mr = r(10, 13.5);
      L.glow.push('<circle cx="' + n(mx) + '" cy="' + n(my) + '" r="' + n(mr * 3) + '" fill="' + radial('#fff6d0', time === 'night' ? 0.45 : 0.3) + '"/>');
      if (has('crescent')) {
        var dir = chance(0.5) ? 1 : -1;
        L.glow.push('<path d="M' + n(mx) + ',' + n(my - mr) + 'A' + n(mr) + ',' + n(mr) + ' 0 1,' + (dir > 0 ? 0 : 1) + ' ' + n(mx) + ',' + n(my + mr) +
          'A' + n(mr * 0.78) + ',' + n(mr) + ' 0 1,' + (dir > 0 ? 1 : 0) + ' ' + n(mx) + ',' + n(my - mr) + 'Z" fill="#f8f1d4"/>');
      } else {
        L.glow.push('<circle cx="' + n(mx) + '" cy="' + n(my) + '" r="' + n(mr) + '" fill="#f8f1d4"/>');
        L.glow.push('<circle cx="' + n(mx - mr * 0.3) + '" cy="' + n(my + mr * 0.15) + '" r="' + n(mr * 0.28) + '" fill="#e8dfbd" opacity=".5"/>');
      }
      if (water) reflect(mx, mr, '#f8f1d4', 0.7, true);
    }

    function reflect(x, w, color, o, glow) {
      var out = glow ? L.glow : L.water;
      for (var i = 0; i < 6; i++) {
        var yy = horizon + 5 + i * r(4, 7), ww = w * r(0.5, 1.3) * (1 - i * 0.08);
        out.push('<path d="M' + n(x - ww) + ',' + n(yy) + 'h' + n(ww * 2) + '" stroke="' + color + '" stroke-width="' + n(r(1, 2.2)) + '" opacity="' + n(o * (1 - i * 0.12)) + '" stroke-linecap="round"/>');
      }
    }

    if (has('clouds') || (!has('rain') && chance(0.35))) {
      var cc = has('clouds') ? 3 + Math.floor(r(0, 3)) : 2;
      for (var ci = 0; ci < cc; ci++) {
        var cx = r(10, W - 10), cy = r(18, horizon * 0.55), cw = r(30, 70);
        var col = time === 'night' ? '#c9ccd6' : '#ffffff';
        for (var k = 0; k < 3; k++) {
          L.sky.push('<ellipse cx="' + n(cx + r(-cw / 3, cw / 3)) + '" cy="' + n(cy + r(-3, 3)) + '" rx="' + n(cw * r(0.35, 0.6)) + '" ry="' + n(r(3, 7)) +
            '" fill="' + col + '" opacity="' + n(r(0.35, 0.6)) + '"/>');
        }
      }
    }

    /* ---------- mountains ---------- */
    function ridge(base, hMax, peaks, sharp) {
      var pk = [];
      for (var i = 0; i < peaks; i++) pk.push({ c: r(-20, W + 20), h: r(0.45, 1) * hMax, w: r(20, 60) * (sharp ? 0.35 : 1) });
      var pts = [];
      for (var x = -10; x <= W + 10; x += sharp ? 4 : 6) {
        var y = 0;
        for (var j = 0; j < pk.length; j++) { var d = (x - pk[j].c) / pk[j].w; y = Math.max(y, pk[j].h * Math.exp(-d * d)); }
        y += r(-1, 1) * hMax / 30;
        pts.push([x, base - Math.max(0, y)]);
      }
      return pts;
    }
    function smooth(pts) {
      var d = 'M' + n(pts[0][0]) + ',' + n(pts[0][1]);
      for (var i = 1; i < pts.length - 1; i++) {
        d += 'Q' + n(pts[i][0]) + ',' + n(pts[i][1]) + ' ' + n((pts[i][0] + pts[i + 1][0]) / 2) + ',' + n((pts[i][1] + pts[i + 1][1]) / 2);
      }
      var last = pts[pts.length - 1];
      return d + 'L' + n(last[0]) + ',' + n(last[1]);
    }
    function wash(layer, op) { // fill for a mountain mass in the painting's colour manner
      if (snowy) return grad([[0, '#ffffff', 0.95], [0.5, '#d9dbdc', 0.9], [1, INK, op * 0.4]]);
      var far = layer === 'far';
      if (manner === 'green') return grad([[0, far ? '#5f7f95' : '#2c5a6e', op * 1.15], [0.55, far ? '#7f9c98' : '#4c876e', op * 0.8], [1, '#a9c09a', op * 0.1]]);
      if (manner === 'ochre') return grad([[0, far ? '#77736f' : '#5e4636', op * 1.05], [0.5, far ? '#a0866a' : '#a8774c', op * 0.55], [1, '#c9a982', op * 0.08]]);
      return grad([[0, INK, op], [1, INK, op * 0.06]]);
    }
    function mountain(layer, base, hMax, peaks, op, sharp, tint) {
      var pts = ridge(base, hMax, peaks, sharp), line = smooth(pts);
      var fill = tint && !snowy ? grad([[0, tint, op], [1, tint, op * 0.06]]) : wash(layer, op);
      L[layer].push('<path d="' + line + 'L' + (W + 10) + ',' + n(base + 6) + 'L-10,' + n(base + 6) + 'Z" fill="' + fill + '"/>');
      L[layer].push('<path d="' + line + '" fill="none" stroke="' + INK + '" stroke-opacity="' + n(Math.min(0.85, op * (snowy ? 1.2 : 0.9))) + '" stroke-width="' + (sharp ? 0.9 : 0.7) + '"/>');
      if (opt.detail && layer !== 'far') { // 皴 texture strokes
        for (var i = 0; i < pts.length; i += 3) {
          var p = pts[i];
          if (base - p[1] < 10) continue;
          L[layer].push('<path d="M' + n(p[0]) + ',' + n(p[1] + r(3, 8)) + 'q' + n(r(-3, 3)) + ',' + n(r(4, 8)) + ' ' + n(r(-2, 2)) + ',' + n(r(8, 16)) +
            '" stroke="' + INK + '" stroke-opacity="' + n(op * 0.5) + '" stroke-width=".5" fill="none"/>');
        }
      }
      return pts;
    }
    function mist(y, o, layer) {
      for (var i = 0; i < 3; i++) {
        L[layer || 'near'].push('<ellipse cx="' + n(r(0, W)) + '" cy="' + n(y + r(-4, 4)) + '" rx="' + n(r(60, 130)) + '" ry="' + n(r(4, 9)) + '" fill="' + skyLow + '" opacity="' + n(o) + '"/>');
      }
    }
    function tallPeak() { // 高远: a towering main peak with a lesser one leaning on it
      var dir = peakSide === 'L' ? 1 : -1, px = peakSide === 'L' ? r(48, 92) : r(208, 252);
      var top = r(14, 30), base = horizon + 4;
      peakX = px; peakTop = top;
      [[px + dir * r(34, 46), top + r(26, 40), r(30, 40), 0.4], [px, top, r(52, 70), 0.62]].forEach(function (pk) {
        var x0 = pk[0], t = pk[1], w = pk[2], op = pk[3], l = [], rr = [];
        var b1 = r(1.5, 3.5), b2 = r(1.5, 3.5);
        for (var i = 0; i <= 8; i++) { // a pointed summit, flanks broken by shoulders and ledges
          var f = i / 8, yy = t + (base - t) * f;
          l.push([x0 - w * Math.pow(f, 1.1) - Math.abs(Math.sin(f * Math.PI * b1)) * w * 0.12 * f + r(-2, 2) * f, yy]);
          rr.push([x0 + w * 0.85 * Math.pow(f, 1.05) + Math.abs(Math.sin(f * Math.PI * b2)) * w * 0.1 * f + r(-2, 2) * f, yy]);
        }
        var d = 'M' + l.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).reverse().join('L') + 'L' + rr.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join('L');
        L.mid.push('<path d="' + d + 'Z" fill="' + wash('mid', op) + '"/>');
        L.mid.push('<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-opacity="' + n(op * 1.1) + '" stroke-width=".8" stroke-linejoin="round"/>');
        for (var k = 0; k < (opt.detail ? 26 : 12); k++) { // 披麻皴 hemp-fibre texture strokes down the slopes
          var ff = r(0.12, 0.85), side2 = chance(0.5) ? l : rr, idx = Math.min(7, Math.floor(ff * 8));
          var sx = side2[idx][0] + (side2 === l ? 1 : -1) * r(3, w * 0.5 * ff), sy = side2[idx][1] + r(0, 6);
          L.mid.push('<path d="M' + n(sx) + ',' + n(sy) + 'q' + n(r(-3, 3)) + ',' + n(r(5, 9)) + ' ' + n(r(-2, 2)) + ',' + n(r(10, 18)) + '" stroke="' + INK + '" stroke-opacity="' + n(op * 0.45) + '" stroke-width=".5" fill="none"/>');
        }
        for (var m = 0; m < 6; m++) { // 苔点 moss dots on the ridge
          var q = (chance(0.5) ? l : rr)[Math.floor(r(1, 6))];
          L.mid.push('<circle cx="' + n(q[0] + r(-2, 2)) + '" cy="' + n(q[1] + r(-1, 2)) + '" r="' + n(r(0.6, 1.2)) + '" fill="' + INK + '" opacity=".6"/>');
        }
      });
      mist(top + (base - top) * r(0.5, 0.65), 0.75, 'mid'); // a cloud band across the waist
    }

    var bigMountains = has('mountains') || has('peaks'), peakX = 0, peakTop = 0;
    if (comp === 'deep') { // ridge behind ridge, each paler, mist between
      mountain('far', horizon - r(24, 32), r(16, 28), 4, 0.1);
      mist(horizon - r(22, 28), 0.6, 'far');
      mountain('far', horizon - r(10, 16), r(16, 30), 4, 0.16);
      mist(horizon - r(9, 14), 0.55, 'far');
    }
    if (!(has('sea') && !bigMountains)) {
      mountain('far', horizon + 1, bigMountains ? r(45, 75) : r(14, 30), 4, bigMountains ? 0.22 : 0.15);
    }
    if (comp === 'high') tallPeak();
    if (has('mountains') && comp !== 'high') { mountain('mid', horizon + 2, r(28, 50), 3, 0.5); mist(horizon - 4, 0.55); }
    if (has('peaks') && comp !== 'high') { mountain('mid', horizon + 3, r(70, 100), 4, 0.58, true); mist(horizon - r(10, 25), 0.6); }
    if (has('mist')) { mist(horizon - r(8, 30), 0.7); mist(horizon - r(0, 6), 0.6); }

    if (has('waterfall')) {
      var fx = side === 'L' ? r(205, 245) : r(55, 95), ft = r(25, 45);
      var cl = side === 'L' ? 1 : -1;
      if (comp === 'high') { cl = peakSide === 'L' ? 1 : -1; fx = peakX + cl * r(4, 10); ft = peakTop + r(30, 42); } // falls down the great peak's face
      else L.mid.push('<path d="M' + n(fx - 30 * cl) + ',' + n(horizon + 6) + 'L' + n(fx - 22 * cl) + ',' + n(ft + 10) + 'Q' + n(fx - 12 * cl) + ',' + n(ft - 8) + ' ' + n(fx) + ',' + n(ft) +
        'L' + n(fx + 8 * cl) + ',' + n(ft + 4) + 'Q' + n(fx + 26 * cl) + ',' + n(ft - 6) + ' ' + n(fx + 36 * cl) + ',' + n(ft + 18) + 'L' + n(fx + 44 * cl) + ',' + n(horizon + 6) + 'Z" fill="' +
        grad([[0, INK, 0.75], [1, INK, 0.25]]) + '"/>');
      L.mid.push('<path d="M' + n(fx) + ',' + n(ft) + 'L' + n(fx + 8 * cl) + ',' + n(ft + 4) + 'L' + n(fx + 10 * cl) + ',' + n(horizon + 6) + 'L' + n(fx - 2 * cl) + ',' + n(horizon + 6) + 'Z" fill="#f7f4ec" opacity=".95"/>');
      for (var wi = 0; wi < 5; wi++) {
        var wx = fx + cl * r(1, 8);
        L.mid.push('<path d="M' + n(wx) + ',' + n(ft + r(4, 20)) + 'v' + n(r(20, 50)) + '" stroke="#9fb0b5" stroke-width=".5" opacity=".7"/>');
      }
      L.near.push('<ellipse cx="' + n(fx + 4 * cl) + '" cy="' + n(horizon + 5) + '" rx="22" ry="5" fill="#ffffff" opacity=".7"/>');
    }

    /* ---------- ground / water ---------- */
    var groundCol = desert ? ['#e4cf9f', '#cfb27a'] : snowy ? ['#fbfbf8', '#e9eaea'] :
      season === 'autumn' ? ['#e6d7b8', '#d3bf98'] : season === 'spring' || season === 'summer' ? ['#e2e2c8', '#cdd0ac'] : ['#e8dfcc', '#d6c9ae'];
    if (has('frost')) groundCol = ['#eef1f2', '#dde4e8'];
    var landX0 = 0, landX1 = W, shoreTop;
    // two compositions for water scenes: a bank on one side, or a foreground bank across the bottom
    var bankMode = water && !has('sea') && chance(0.4);
    function onLand(x, y) {
      if (!water) return true;
      if (bankMode) return y > shoreTop + 3;
      return side === 'L' ? x <= landX1 : x >= landX0;
    }

    if (water) {
      var wcol = time === 'dusk' ? ['#ead2b7', '#d7c3ad'] : time === 'dawn' ? ['#ead9cf', '#d3d4d0'] : ['#dfe5e3', '#c6d0d0'];
      L.water.push('<rect y="' + n(horizon) + '" width="' + W + '" height="' + n(H - horizon) + '" fill="' + grad([[0, wcol[0]], [1, wcol[1]]]) + '"/>');
      for (var ri = 0; ri < (has('sea') ? 6 : 12); ri++) {
        var ry = r(horizon + 4, H - 4), rw = r(6, 22) * (0.4 + (ry - horizon) / (H - horizon));
        var rx = r(0, W);
        L.water.push('<path d="M' + n(rx) + ',' + n(ry) + 'h' + n(rw) + '" stroke="' + INK + '" stroke-opacity=".25" stroke-width=".6"/>');
      }
      if (has('sea')) {
        for (var wv = 0; wv < 5; wv++) {
          var wy = horizon + 10 + wv * (H - horizon) / 5.5, d = 'M-5,' + n(wy);
          for (var xx = -5; xx < W; xx += 18) d += 'q4.5,-' + n(r(3, 6)) + ' 9,0t9,0';
          L.water.push('<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-opacity="' + n(0.18 + wv * 0.06) + '" stroke-width=".8"/>');
        }
      }
      if (bankMode) {
        shoreTop = H - r(24, 32);
        var edge = 'M-2,' + n(shoreTop + r(-3, 3)) + 'Q' + n(W * r(0.2, 0.4)) + ',' + n(shoreTop - r(3, 8)) + ' ' + n(W * 0.55) + ',' + n(shoreTop + r(0, 4)) +
          'T' + (W + 2) + ',' + n(shoreTop + r(-4, 3));
        L.ground.push('<path d="' + edge + 'L' + (W + 2) + ',' + H + 'L-2,' + H + 'Z" fill="' + grad([[0, groundCol[0]], [1, groundCol[1]]]) + '"/>');
        L.ground.push('<path d="' + edge + '" fill="none" stroke="' + INK + '" stroke-opacity=".35" stroke-width=".7"/>');
        landX0 = 8; landX1 = W - 8;
      } else {
      // shore
      var sx = side === 'L' ? 0 : W, dir = side === 'L' ? 1 : -1;
      var a = r(0.26, 0.36) * W, b = r(0.42, 0.52) * W;
      shoreTop = horizon + r(4, 9);
      var shore = 'M' + sx + ',' + n(shoreTop) + 'Q' + n(sx + dir * a * 0.6) + ',' + n(shoreTop - 3) + ' ' + n(sx + dir * a) + ',' + n(shoreTop + 8) +
        'Q' + n(sx + dir * b) + ',' + n(H - 20) + ' ' + n(sx + dir * (b + 20)) + ',' + H + 'L' + sx + ',' + H + 'Z';
      if (!has('sea') || bigMountains) {
        L.ground.push('<path d="' + shore + '" fill="' + grad([[0, groundCol[0]], [1, groundCol[1]]]) + '"/>');
        L.ground.push('<path d="' + shore.replace(/L[\d.]+,[\d.]+L[\d.]+,[\d.]+Z$/, '') + '" fill="none" stroke="' + INK + '" stroke-opacity=".35" stroke-width=".7"/>');
        if (side === 'L') { landX0 = 6; landX1 = a * 0.95; } else { landX0 = W - a * 0.95; landX1 = W - 6; }
      } else { landX0 = landX1 = -1; }
      }
    } else {
      shoreTop = horizon;
      L.ground.push('<rect y="' + n(horizon) + '" width="' + W + '" height="' + n(H - horizon) + '" fill="' + grad([[0, groundCol[0]], [1, groundCol[1]]]) + '"/>');
      if (desert) {
        for (var di = 0; di < 3; di++) {
          var dy = horizon + 12 + di * 18;
          L.ground.push('<path d="M-10,' + n(dy + 8) + 'Q' + n(r(40, 120)) + ',' + n(dy - r(4, 10)) + ' ' + n(r(150, 200)) + ',' + n(dy + 4) + 'T' + (W + 10) + ',' + n(dy) +
            '" fill="none" stroke="#a88a55" stroke-opacity=".5" stroke-width=".8"/>');
        }
      }
    }
    if (has('hills')) {
      var hcol = snowy ? '#9a9c9c' : season === 'autumn' ? '#8f6e3e' : season === 'winter' ? '#77736c' : '#5f7d56';
      mountain('near', (water ? horizon : horizon + 8), r(14, 24), 3, 0.5, false, hcol);
    }
    if (has('fields') && !water) {
      var fc = season === 'autumn' ? '#c9a24a' : season === 'winter' ? '#b8b0a0' : '#8fae63';
      for (var fi = 0; fi < 9; fi++) {
        var fy = horizon + 6 + fi * (H - horizon) / 9.5;
        L.ground.push('<path d="M-5,' + n(fy) + 'Q' + n(W / 2) + ',' + n(fy + r(-5, 5)) + ' ' + (W + 5) + ',' + n(fy + r(-3, 3)) + '" stroke="' + fc + '" stroke-width="' + n(1 + fi * 0.4) + '" opacity=".55" fill="none"/>');
      }
    }

    /* ---------- placing things on land ---------- */
    var flip = side === 'R';
    var DRAW = {
      pine: pine, willow: willow, plum: plum, bamboo: bamboo, chrysanthemum: chrys,
      peach: function (x, y, s) { return canopyTree(x, y, s, ['#eaa1b0', '#f3c1cb', '#e48a9c'], 14); },
      maple: function (x, y, s) { return canopyTree(x, y, s, ['#c4472f', '#d9733a', '#b5342a'], 14); },
      pavilion: pavilion, tower: tower, temple: temple, palace: palace, cottage: cottage,
      person: function (x, y, s) { return person(x, y, s * 1.1, flip); },
      two: function (x, y, s) { return person(x - 6 * s, y, s * 1.1, false) + person(x + 6 * s, y, s * 1.05, true, '#4a423c'); },
      horse: function (x, y, s) { return horseP(x, y, s, flip); },
      rider: function (x, y, s) { return horseP(x, y, s, flip) + person(x + (flip ? 3 : -3) * s, y - 15 * s, s * 0.85, flip); },
      jar: jar, cup: cup, candle: candle,
      lady: function (x, y, s) { return lady(x, y, s * 1.1, flip); },
      child: function (x, y, s) { return child(x, y, s, !flip); },
      elder: function (x, y, s) { return elder(x, y, s * 1.1, flip); },
      ox: function (x, y, s) { return ox(x, y, s, flip, has('child')); },
    };
    function baseY(x, depth) { // depth 0 (far) .. 1 (near)
      return bankMode ? shoreTop + 5 + depth * (H - shoreTop - 8) : shoreTop + 8 + depth * (H - shoreTop - 14);
    }
    function scaleAt(y) { return 0.55 + 0.75 * (y - horizon) / (H - horizon); }

    var landItems = [];
    var push = function (w, kind) { if (has(w)) landItems.push(kind || w); };
    ['palace', 'temple', 'tower', 'pavilion', 'cottage'].forEach(function (w) { push(w); });
    ['pine', 'willow', 'plum', 'peach', 'bamboo', 'maple'].forEach(function (w) { push(w); });
    push('chrysanthemum'); push('two'); push('person'); push('lady'); push('elder'); push('rider'); push('horse'); push('ox');
    if (!has('ox')) push('child'); // with an ox, the child rides it (牧童骑牛)
    var objects = ['jar', 'cup', 'candle'].filter(has);

    if (landX0 >= 0 && landItems.length) {
      var span = landX1 - landX0, slots = landItems.length;
      landItems.forEach(function (kind, i) {
        var big = ['palace', 'temple', 'tower', 'pavilion', 'cottage', 'pine', 'willow', 'maple', 'peach', 'bamboo', 'plum'].indexOf(kind) >= 0;
        var x = landX0 + span * (i + 0.5) / slots + r(-span / slots / 4, span / slots / 4);
        if (water && !bankMode) {
          // keep things on the bank (the shore curves away toward the water)
          var far = side === 'L' ? x / landX1 : (W - x) / (W - landX0);
          x = side === 'L' ? Math.min(x, landX1 - 8) : Math.max(x, landX0 + 8);
          var depth = big ? r(0.1, 0.45) : r(0.45, 0.8);
          if (far > 0.75) depth = Math.max(depth, 0.5);
          var y = baseY(x, depth);
        } else {
          var y = baseY(x, big ? r(0.05, 0.4) : r(0.4, 0.85));
        }
        landItems[i] = { kind: kind, x: x, y: y };
      });
    } else if (landItems.length) {
      landItems = landItems.map(function (kind, i) {
        return { kind: kind, x: W * (i + 0.5) / landItems.length, y: horizon - 2, far: true };
      });
    }
    landItems.sort(function (p, q) { return p.y - q.y; });
    var childAt = null;
    landItems.forEach(function (it) {
      var s = it.far ? 0.35 : scaleAt(it.y);
      var fn = DRAW[it.kind];
      if (fn) L.obj.push(fn(it.x, it.y, s));
      if (it.kind === 'cottage' && has('smoke')) L.obj.push(chimney(it.x + 6 * s, it.y - 22 * s, s));
      if (it.kind === 'child' || (it.kind === 'ox' && has('child'))) childAt = { x: it.x, y: it.y - (it.kind === 'ox' ? 16 * s : 8 * s) };
      if (['person', 'two', 'lady', 'elder'].indexOf(it.kind) >= 0 && objects.length) {
        objects.forEach(function (o, k) { L.obj.push(DRAW[o](it.x + (k + 1) * 9 * s * (side === 'L' ? 1 : -1), it.y + 1, s)); });
        objects = [];
      }
      if (it.kind === 'willow' && has('oriole')) { L.air.push(oriole(it.x + r(-14, 14) * s, it.y - r(35, 50) * s, s)); words.oriole = 0; }
    });
    objects.forEach(function (o, k) { // still life in the foreground corner
      var x = side === 'L' ? 24 + k * 16 : W - 24 - k * 16;
      L.obj.push(DRAW[o](x, H - 10, 1.2));
    });

    /* ---------- water things ---------- */
    function waterX() { return bankMode ? r(W * 0.15, W * 0.85) : side === 'L' ? r(W * 0.55, W * 0.85) : r(W * 0.15, W * 0.45); }
    if (has('reeds') && bankMode) L.obj.push(reeds(r(30, W - 30), shoreTop + 6, 0.9));
    else if (has('reeds') && water) L.obj.push(reeds(side === 'L' ? r(W * 0.32, W * 0.42) : r(W * 0.58, W * 0.68), H - r(18, 35), 1));
    else if (has('reeds')) L.obj.push(reeds(r(30, W - 30), H - 15, 1));
    if (has('bridge')) {
      var bx = water ? (side === 'L' ? W * 0.45 : W * 0.55) : r(80, 220), by = water ? horizon + r(16, 26) : horizon + 20;
      L.obj.push(bridge(bx, by, water ? 1 : 0.8));
    }
    if (has('boat') || has('fisher')) {
      var bx2 = waterX(), by2 = bankMode ? r(horizon + 12, shoreTop - 6) : r(horizon + 30, H - 18);
      L.obj.push(boat(bx2, by2, scaleAt(by2) * 1.1, has('fisher'), false));
    }
    if (has('sail')) {
      var sx2 = waterX(), sy2 = horizon + r(3, 10);
      L.obj.push(boat(sx2, sy2, 0.45, false, true));
    }
    if (has('lotus')) L.obj.push(bankMode ? lotus(r(W * 0.25, W * 0.75), shoreTop - r(3, 10)) : lotus(side === 'L' ? r(W * 0.5, W * 0.8) : r(W * 0.2, W * 0.5), H - r(12, 22)));

    /* ---------- far structures ---------- */
    if (has('wall')) L.near.push(wall(horizon + (water ? -1 : r(4, 12))));
    if (has('fort')) L.near.push(fort(side === 'L' ? r(170, 230) : r(70, 130), horizon + (water ? 0 : r(4, 10))));
    if (has('smoke') && !has('cottage')) L.near.push(beacon(side === 'L' ? r(150, 260) : r(40, 150), horizon + 4));
    if (has('flag')) L.obj.push(flag(side === 'L' ? r(110, 160) : r(140, 190), horizon + r(18, 30)));
    if (has('grass') || (!water && !desert && !snowy && chance(0.5))) {
      for (var gi = 0; gi < 14; gi++) {
        var gx = r(0, W), gy = r(horizon + 10, H - 2);
        if (!onLand(gx, gy)) continue;
        var gc = season === 'autumn' ? '#9c7a3e' : '#5d7a4a';
        L.ground.push('<path d="M' + n(gx) + ',' + n(gy) + 'q' + n(r(-2, 2)) + ',-' + n(r(3, 6)) + ' ' + n(r(-3, 3)) + ',-' + n(r(5, 9)) + 'M' + n(gx + 2) + ',' + n(gy) + 'q1,-3 ' + n(r(1, 4)) + ',-' + n(r(4, 7)) +
          '" stroke="' + gc + '" stroke-width=".6" fill="none" opacity=".7"/>');
      }
    }
    if (has('flowers')) {
      var fcs = ['#d8657a', '#e9b44c', '#ffffff', '#c86fb0'];
      for (var fl = 0; fl < 22; fl++) {
        var flx = r(0, W), fly = r(horizon + 12, H - 4);
        if (!onLand(flx, fly)) continue;
        L.ground.push('<circle cx="' + n(flx) + '" cy="' + n(fly) + '" r="' + n(r(0.8, 1.8)) + '" fill="' + fcs[fl % 4] + '" opacity=".9"/>');
      }
    }

    /* ---------- air ---------- */
    if (has('geese')) L.air.push(geese(r(60, 240), r(30, horizon * 0.5)));
    if (has('crane')) L.air.push(crane(r(70, 230), r(25, horizon * 0.5), r(0.9, 1.2)));
    if (has('crows')) for (var cw = 0; cw < 6; cw++) L.air.push(bird(r(40, 260), r(30, horizon - 20), r(0.9, 1.4), INK, 1.1));
    if (has('birds')) for (var bd = 0; bd < 4; bd++) L.air.push(bird(r(60, 240), r(20, horizon * 0.6), r(0.6, 1), INK, 0.7));
    if (has('swallows')) for (var sw = 0; sw < 3; sw++) L.air.push(swallow(r(60, 240), r(40, horizon - 10), r(0.9, 1.3)));
    if (has('oriole')) L.air.push(oriole(r(80, 220), r(50, horizon - 10), 1));
    if (has('kite')) { // 纸鸢, its string running down to the child
      var kx = r(90, 210), ky = r(22, 50), hold = childAt || { x: r(60, 240), y: horizon + 30 };
      L.air.push('<path d="M' + n(hold.x) + ',' + n(hold.y) + 'Q' + n((hold.x + kx) / 2 + 15) + ',' + n((hold.y + ky) / 2 + 20) + ' ' + n(kx) + ',' + n(ky + 6) + '" stroke="' + INK + '" stroke-width=".35" fill="none" opacity=".7"/>' +
        '<path d="M' + n(kx) + ',' + n(ky - 7) + 'L' + n(kx + 5) + ',' + n(ky) + 'L' + n(kx) + ',' + n(ky + 7) + 'L' + n(kx - 5) + ',' + n(ky) + 'Z" fill="#c8352a" stroke="#6b2a20" stroke-width=".4"/>' +
        '<path d="M' + n(kx) + ',' + n(ky - 7) + 'V' + n(ky + 7) + 'M' + n(kx - 5) + ',' + n(ky) + 'H' + n(kx + 5) + '" stroke="#e9c46a" stroke-width=".4"/>' +
        '<path d="M' + n(kx) + ',' + n(ky + 7) + 'q4,5 0,9t0,9" stroke="#c8352a" stroke-width=".7" fill="none"/>');
    }
    if (has('butterfly')) for (var bf = 0; bf < 2; bf++) L.air.push(butterfly(landX0 >= 0 && water ? r(landX0 + 5, landX1) : r(80, 220), r(horizon - 10, H - 30), r(0.9, 1.2)));

    /* ---------- weather ---------- */
    if (has('rain')) {
      for (var rn = 0; rn < 90; rn++) {
        var rx2 = r(-20, W + 10), ry2 = r(-10, H), rl = r(6, 14);
        L.fx.push('<path d="M' + n(rx2) + ',' + n(ry2) + 'l' + n(rl * 0.3) + ',' + n(rl) + '" stroke="#5a6670" stroke-opacity=".35" stroke-width=".5"/>');
      }
    }
    if (snowy) {
      for (var sn = 0; sn < 80; sn++) {
        L.fx.push('<circle cx="' + n(r(0, W)) + '" cy="' + n(r(0, H)) + '" r="' + n(r(0.5, 1.7)) + '" fill="#ffffff" opacity="' + n(r(0.6, 1)) + '"/>');
      }
    }
    if (has('frost')) {
      for (var fr = 0; fr < 30; fr++) {
        L.fx.push('<circle cx="' + n(r(0, W)) + '" cy="' + n(r(horizon + 4, H)) + '" r="' + n(r(0.3, 0.8)) + '" fill="#ffffff" opacity=".9"/>');
      }
    }
    if (has('wind')) {
      for (var wd = 0; wd < 4; wd++) {
        var wx2 = r(10, W - 90), wy2 = r(30, H - 40);
        L.fx.push('<path d="M' + n(wx2) + ',' + n(wy2) + 'q' + n(r(20, 35)) + ',-' + n(r(6, 12)) + ' ' + n(r(50, 80)) + ',0q10,3 6,8q-5,3 -9,-1" fill="none" stroke="' + INK + '" stroke-opacity=".28" stroke-width=".7"/>');
      }
    }
    if (has('petals') || has('leaves')) {
      var pc = has('petals') ? ['#e8a0ad', '#f2c4cc', '#d9707f'] : ['#c4472f', '#d98a3a', '#b5342a'];
      for (var pi = 0; pi < 22; pi++) {
        var px = r(0, W), py = r(10, H - 5);
        L.fx.push('<ellipse cx="' + n(px) + '" cy="' + n(py) + '" rx="' + n(r(1.2, 2.2)) + '" ry="' + n(r(0.6, 1)) + '" transform="rotate(' + Math.round(r(0, 180)) + ' ' + n(px) + ' ' + n(py) + ')" fill="' + pc[pi % 3] + '" opacity=".85"/>');
      }
    }
    if (has('lantern')) L.glow.push(lantern(side === 'L' ? r(30, 70) : r(230, 270), r(20, 40)));

    if (time === 'night') L.fx.push('<rect width="' + W + '" height="' + H + '" fill="#141a2c" opacity=".26"/>');
    if (time === 'dusk') L.fx.push('<rect width="' + W + '" height="' + H + '" fill="#c86a3a" opacity=".07"/>');

    if (has('window')) L.frame.push(windowFrame());

    // 题款 inscription: the title in a column of brush script, the poet's name beside it
    var BRUSH = 'font-family="\'Ma Shan Zheng\',\'LXGW WenKai Screen\',KaiTi,STKaiti,serif"';
    var tx = inscribe === 'L' ? 18 : W - 18, inward = inscribe === 'L' ? 1 : -1;
    if (has('window')) tx += inward * 18;
    if (opt.detail && opt.title) {
      var chars = Array.from(opt.title.replace(/[·・].*$/, '').replace(/（.*?）/g, '')).slice(0, 8);
      chars.forEach(function (ch, i) {
        L.frame.push('<text x="' + tx + '" y="' + (34 + i * 13) + '" font-size="12" text-anchor="middle" fill="' + INK + '" opacity=".82" ' + BRUSH + '>' + esc(ch) + '</text>');
      });
      if (opt.poet) {
        var nx = tx + inward * 12, name = Array.from(opt.poet).slice(0, 4), ny = 34 + Math.max(0, chars.length - name.length) * 13;
        name.forEach(function (ch, i) {
          L.frame.push('<text x="' + nx + '" y="' + n(ny + i * 9.5) + '" font-size="8.5" text-anchor="middle" fill="' + INK + '" opacity=".7" ' + BRUSH + '>' + esc(ch) + '</text>');
        });
      }
    }

    if (opt.detail) { // ink that bleeds a little at the edges, and the grain of the paper
      defs.push('<filter id="' + uid + '_ink" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="' + (hash(uid) % 97) + '"/>' +
        '<feDisplacementMap in="SourceGraphic" scale="3"/></filter>' +
        '<filter id="' + uid + '_paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/>' +
        '<feColorMatrix values="0 0 0 0 .35 0 0 0 0 .28 0 0 0 0 .2 0 0 0 -1.6 .9"/></filter>');
      ['far', 'mid', 'near'].forEach(function (k) { L[k] = ['<g filter="url(#' + uid + '_ink)">'].concat(L[k], ['</g>']); });
      L.fx.push('<rect width="' + W + '" height="' + H + '" filter="url(#' + uid + '_paper)" opacity=".22"/>');
    }

    var body = ['sky', 'far', 'mid', 'near', 'water', 'ground', 'obj', 'air', 'fx', 'glow', 'frame'].map(function (k) { return L[k].join(''); }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" role="img"' +
      (opt.label ? ' aria-label="' + esc(opt.label) + '"' : ' aria-hidden="true"') + '><defs>' + defs.join('') + '</defs>' + body + '</svg>';

    /* ======== motif painters (closures share R/defs) ======== */
    function trunk(x, y, h, s, bend, w) {
      return '<path d="M' + n(x - w * s) + ',' + n(y) + 'Q' + n(x + bend * s * 0.5) + ',' + n(y - h * s * 0.5) + ' ' + n(x + bend * s) + ',' + n(y - h * s) +
        'L' + n(x + bend * s + w * s * 0.4) + ',' + n(y - h * s) + 'Q' + n(x + bend * s * 0.5 + w * s) + ',' + n(y - h * s * 0.5) + ' ' + n(x + w * s) + ',' + n(y) + 'Z" fill="#3a302a"/>';
    }
    function pine(x, y, s) {
      var bend = r(-10, 10), h = r(48, 62), out = trunk(x, y, h, s, bend, 2.2);
      for (var i = 0; i < 4; i++) {
        var t = 0.45 + i * 0.17, cx = x + bend * s * t + r(-10, 10) * s, cy = y - h * s * t;
        for (var k = 0; k < 4; k++) {
          out += '<ellipse cx="' + n(cx + r(-9, 9) * s) + '" cy="' + n(cy + r(-2, 2) * s) + '" rx="' + n(r(6, 11) * s) + '" ry="' + n(r(2.4, 3.6) * s) + '" fill="#26332b" opacity=".82"/>';
        }
        if (snowy) out += '<ellipse cx="' + n(cx) + '" cy="' + n(cy - 2.5 * s) + '" rx="' + n(10 * s) + '" ry="' + n(1.6 * s) + '" fill="#ffffff"/>';
      }
      return out;
    }
    function willow(x, y, s) {
      var bend = r(-6, 6), h = r(38, 48), out = trunk(x, y, h, s, bend, 2.6);
      var cx = x + bend * s, cy = y - h * s, col = season === 'autumn' ? '#a3a05a' : '#7fa35a';
      out += '<ellipse cx="' + n(cx) + '" cy="' + n(cy + 6 * s) + '" rx="' + n(22 * s) + '" ry="' + n(14 * s) + '" fill="' + col + '" opacity=".22"/>';
      var tilt = has('wind') ? 8 : 0;
      for (var i = 0; i < 18; i++) {
        var sx = cx + r(-20, 20) * s, sy = cy + r(-6, 4) * s, len = r(22, 42) * s;
        out += '<path d="M' + n(sx) + ',' + n(sy) + 'q' + n(r(-4, 4) * s + tilt) + ',' + n(len * 0.5) + ' ' + n(r(-3, 3) * s + tilt * 1.5) + ',' + n(len) + '" stroke="' + col + '" stroke-width="' + n(0.7 * s) + '" fill="none" opacity=".9"/>';
      }
      return out;
    }
    function branchy(x, y, s, col, w) {
      var out = '', pts = [[x, y]], ang = side === 'L' ? -1.1 : -2.0, px = x, py = y;
      for (var i = 0; i < 5; i++) {
        ang += r(-0.5, 0.5); var len = r(9, 15) * s;
        px += Math.cos(ang) * len; py += Math.sin(ang) * len; pts.push([px, py]);
      }
      var d = 'M' + pts.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join('L');
      out += '<path d="' + d + '" stroke="' + col + '" stroke-width="' + n(w * s) + '" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';
      for (var j = 1; j < pts.length - 1; j++) {
        var a2 = ang + r(-1.4, 1.4), l2 = r(8, 14) * s;
        out += '<path d="M' + n(pts[j][0]) + ',' + n(pts[j][1]) + 'l' + n(Math.cos(a2) * l2) + ',' + n(Math.sin(a2) * l2) + '" stroke="' + col + '" stroke-width="' + n(w * 0.45 * s) + '" stroke-linecap="round"/>';
      }
      return { svg: out, pts: pts };
    }
    function plum(x, y, s) {
      var b = branchy(x, y, s * 1.2, '#2b2320', 2.6), out = b.svg;
      b.pts.forEach(function (p) {
        for (var k = 0; k < 4; k++) {
          var bx = p[0] + r(-8, 8) * s, by = p[1] + r(-8, 8) * s;
          out += '<circle cx="' + n(bx) + '" cy="' + n(by) + '" r="' + n(r(1.3, 2) * s) + '" fill="' + (chance(0.7) ? '#c8394d' : '#f6f0ea') + '" stroke="#b5303f" stroke-width=".3"/>';
        }
      });
      if (snowy) out += '<path d="M' + n(b.pts[1][0] - 4) + ',' + n(b.pts[1][1] - 1) + 'h8" stroke="#fff" stroke-width="1.2"/>';
      return out;
    }
    function canopyTree(x, y, s, cols, rad) {
      var h = r(30, 40), bend = r(-6, 6), out = trunk(x, y, h, s, bend, 2.2), cx = x + bend * s, cy = y - h * s;
      for (var i = 0; i < 40; i++) {
        var a = r(0, Math.PI * 2), d = Math.sqrt(R()) * rad * s;
        out += '<circle cx="' + n(cx + Math.cos(a) * d * 1.2) + '" cy="' + n(cy + Math.sin(a) * d * 0.8) + '" r="' + n(r(1.6, 3.2) * s) + '" fill="' + cols[i % cols.length] + '" opacity=".85"/>';
      }
      return out;
    }
    function bamboo(x, y, s) {
      var out = '';
      for (var i = 0; i < 4; i++) {
        var bx = x + (i - 1.5) * 5 * s, h = r(50, 75) * s, lean = r(-4, 4) * s;
        out += '<path d="M' + n(bx) + ',' + n(y) + 'q' + n(lean * 0.3) + ',' + n(-h / 2) + ' ' + n(lean) + ',' + n(-h) + '" stroke="#3f5a3a" stroke-width="' + n(1.6 * s) + '" fill="none" stroke-dasharray="' + n(9 * s) + ' ' + n(0.8 * s) + '"/>';
        for (var k = 0; k < 4; k++) {
          var ly = y - h * r(0.45, 1), lx = bx + lean * ((y - ly) / h), dirx = chance(0.5) ? 1 : -1;
          out += '<path d="M' + n(lx) + ',' + n(ly) + 'q' + n(dirx * 4 * s) + ',' + n(-1.5 * s) + ' ' + n(dirx * 10 * s) + ',' + n(r(0, 3) * s) + 'q' + n(-dirx * 5 * s) + ',' + n(0.5 * s) + ' ' + n(-dirx * 10 * s) + ',' + n(-r(0, 3) * s) + 'Z" fill="#2f4630" opacity=".85"/>';
        }
      }
      return out;
    }
    function chrys(x, y, s) {
      var out = '';
      for (var f = 0; f < 4; f++) out += '<path d="M' + n(x - 14 * s + f * 9 * s) + ',' + n(y) + 'v' + n(-16 * s) + '" stroke="#7a6244" stroke-width="' + n(0.9 * s) + '"/>';
      out += '<path d="M' + n(x - 16 * s) + ',' + n(y - 11 * s) + 'h' + n(32 * s) + 'M' + n(x - 16 * s) + ',' + n(y - 5 * s) + 'h' + n(32 * s) + '" stroke="#7a6244" stroke-width="' + n(0.7 * s) + '"/>';
      for (var i = 0; i < 6; i++) {
        var fx = x + r(-14, 14) * s, fy = y - r(2, 14) * s;
        out += '<circle cx="' + n(fx) + '" cy="' + n(fy) + '" r="' + n(2.4 * s) + '" fill="#e0a92e" stroke="#b97f1a" stroke-width=".4" stroke-dasharray="1 .6"/>';
      }
      return out;
    }
    function roof(x, y, w, s, col) { // upturned eaves
      var hw = w / 2;
      return '<path d="M' + n(x - hw - 4 * s) + ',' + n(y - 2 * s) + 'Q' + n(x - hw) + ',' + n(y) + ' ' + n(x - hw * 0.6) + ',' + n(y - 4 * s) + 'L' + n(x - hw * 0.3) + ',' + n(y - 9 * s) +
        'L' + n(x + hw * 0.3) + ',' + n(y - 9 * s) + 'L' + n(x + hw * 0.6) + ',' + n(y - 4 * s) + 'Q' + n(x + hw) + ',' + n(y) + ' ' + n(x + hw + 4 * s) + ',' + n(y - 2 * s) +
        'Q' + n(x + hw) + ',' + n(y + 1.5 * s) + ' ' + n(x) + ',' + n(y + 1 * s) + 'Q' + n(x - hw) + ',' + n(y + 1.5 * s) + ' ' + n(x - hw - 4 * s) + ',' + n(y - 2 * s) + 'Z" fill="' + (col || '#2f2a28') + '"/>' +
        (snowy ? '<path d="M' + n(x - hw * 0.5) + ',' + n(y - 6 * s) + 'h' + n(hw) + '" stroke="#fff" stroke-width="' + n(1.5 * s) + '"/>' : '');
    }
    function pavilion(x, y, s) {
      return '<rect x="' + n(x - 13 * s) + '" y="' + n(y - 3 * s) + '" width="' + n(26 * s) + '" height="' + n(3 * s) + '" fill="#8c8478"/>' +
        '<path d="M' + n(x - 9 * s) + ',' + n(y - 3 * s) + 'v' + n(-14 * s) + 'M' + n(x + 9 * s) + ',' + n(y - 3 * s) + 'v' + n(-14 * s) + 'M' + n(x) + ',' + n(y - 3 * s) + 'v' + n(-14 * s) + '" stroke="#8e3a2c" stroke-width="' + n(1.4 * s) + '"/>' +
        roof(x, y - 17 * s, 24 * s, s) + '<path d="M' + n(x) + ',' + n(y - 26 * s) + 'v' + n(-4 * s) + '" stroke="#2f2a28" stroke-width="' + n(s) + '"/>';
    }
    function tower(x, y, s) {
      var out = '<rect x="' + n(x - 17 * s) + '" y="' + n(y - 5 * s) + '" width="' + n(34 * s) + '" height="' + n(5 * s) + '" fill="#8c8478"/>', yy = y - 5 * s;
      for (var i = 0; i < 3; i++) {
        var w = (26 - i * 6) * s, h = (11 - i) * s;
        out += '<rect x="' + n(x - w / 2) + '" y="' + n(yy - h) + '" width="' + n(w) + '" height="' + n(h) + '" fill="#9b4a35"/>';
        out += '<path d="M' + n(x - w / 2 + 2 * s) + ',' + n(yy - h + 2 * s) + 'h' + n(w - 4 * s) + '" stroke="#e7d9b8" stroke-width="' + n(0.8 * s) + '" stroke-dasharray="' + n(2 * s) + ' ' + n(1.2 * s) + '"/>';
        yy -= h;
        out += roof(x, yy, w + 6 * s, s);
        yy -= 7 * s;
      }
      return out + '<path d="M' + n(x) + ',' + n(yy + 3 * s) + 'v' + n(-5 * s) + '" stroke="#2f2a28" stroke-width="' + n(s) + '"/>';
    }
    function temple(x, y, s) {
      var out = '', yy = y;
      out += '<rect x="' + n(x + 6 * s) + '" y="' + n(y - 8 * s) + '" width="' + n(18 * s) + '" height="' + n(8 * s) + '" fill="#a65a40"/>' + roof(x + 15 * s, y - 8 * s, 20 * s, s * 0.8);
      for (var i = 0; i < 6; i++) {
        var w = (12 - i * 1.4) * s, h = 6 * s;
        out += '<rect x="' + n(x - w / 2) + '" y="' + n(yy - h) + '" width="' + n(w) + '" height="' + n(h) + '" fill="#d8ccb4" stroke="#6b5a48" stroke-width=".4"/>';
        yy -= h;
        out += '<path d="M' + n(x - w / 2 - 3 * s) + ',' + n(yy + 1 * s) + 'Q' + n(x) + ',' + n(yy - 1.5 * s) + ' ' + n(x + w / 2 + 3 * s) + ',' + n(yy + 1 * s) + '" stroke="#2f2a28" stroke-width="' + n(1.6 * s) + '" fill="none"/>';
      }
      return out + '<path d="M' + n(x) + ',' + n(yy) + 'v' + n(-8 * s) + '" stroke="#2f2a28" stroke-width="' + n(0.9 * s) + '"/>';
    }
    function palace(x, y, s) {
      var w = 54 * s;
      return '<path d="M' + n(x - w / 2 - 6 * s) + ',' + n(y) + 'h' + n(w + 12 * s) + 'l' + n(-4 * s) + ',' + n(-6 * s) + 'h' + n(-(w + 4 * s)) + 'Z" fill="#d6d0c4" stroke="#8c8478" stroke-width=".5"/>' +
        '<rect x="' + n(x - w / 2) + '" y="' + n(y - 20 * s) + '" width="' + n(w) + '" height="' + n(14 * s) + '" fill="#a8392c"/>' +
        '<path d="M' + n(x - w / 2 + 4 * s) + ',' + n(y - 20 * s) + 'v' + n(14 * s) + 'm' + n(w / 4) + ',0v' + n(-14 * s) + 'm' + n(w / 4) + ',0v' + n(14 * s) + 'm' + n(w / 4) + ',0v' + n(-14 * s) + '" stroke="#5f1f17" stroke-width="' + n(0.8 * s) + '" fill="none"/>' +
        roof(x, y - 20 * s, w + 8 * s, s * 1.3) + roof(x, y - 31 * s, w * 0.6, s * 1.1);
    }
    function cottage(x, y, s) {
      return '<rect x="' + n(x - 11 * s) + '" y="' + n(y - 11 * s) + '" width="' + n(22 * s) + '" height="' + n(11 * s) + '" fill="#e6d8bd" stroke="' + INK + '" stroke-width=".5"/>' +
        '<rect x="' + n(x - 2.5 * s) + '" y="' + n(y - 7 * s) + '" width="' + n(5 * s) + '" height="' + n(7 * s) + '" fill="#4a3c30"/>' +
        (time === 'night' ? '<rect x="' + n(x + 5 * s) + '" y="' + n(y - 8 * s) + '" width="' + n(4 * s) + '" height="' + n(3.5 * s) + '" fill="#f1c564"/>' : '') +
        '<path d="M' + n(x - 15 * s) + ',' + n(y - 10 * s) + 'L' + n(x - 7 * s) + ',' + n(y - 21 * s) + 'L' + n(x + 7 * s) + ',' + n(y - 21 * s) + 'L' + n(x + 15 * s) + ',' + n(y - 10 * s) + 'Z" fill="' + (snowy ? '#f4f4f2' : '#8a7354') + '" stroke="' + INK + '" stroke-width=".5"/>' +
        '<path d="M' + n(x - 10 * s) + ',' + n(y - 13 * s) + 'l' + n(4 * s) + ',' + n(-5 * s) + 'M' + n(x - 3 * s) + ',' + n(y - 13 * s) + 'l' + n(3 * s) + ',' + n(-6 * s) + 'M' + n(x + 5 * s) + ',' + n(y - 13 * s) + 'l' + n(2 * s) + ',' + n(-6 * s) + '" stroke="#5e4c36" stroke-width=".5"/>';
    }
    function chimney(x, y, s) {
      var d = 'M' + n(x) + ',' + n(y);
      for (var i = 0; i < 4; i++) d += 'q' + n(4 * s) + ',' + n(-4 * s) + ' 0,' + n(-8 * s) + 't0,' + n(-8 * s);
      return '<path d="' + d + '" stroke="#8a8a8a" stroke-width="' + n(1.4 * s) + '" fill="none" opacity=".45"/>';
    }
    function person(x, y, s, flip, robe) {
      var f = flip ? -1 : 1, c = robe || INK;
      return '<path d="M' + n(x - 3 * s) + ',' + n(y - 12 * s) + 'Q' + n(x - 6 * s) + ',' + n(y - 4 * s) + ' ' + n(x - 7 * s * f) + ',' + n(y) + 'L' + n(x + 6 * s * f) + ',' + n(y) +
        'Q' + n(x + 4 * s * f) + ',' + n(y - 6 * s) + ' ' + n(x + 3 * s) + ',' + n(y - 12 * s) + 'Z" fill="' + c + '" opacity=".88"/>' +
        '<path d="M' + n(x + 2 * s * f) + ',' + n(y - 10 * s) + 'q' + n(5 * s * f) + ',' + n(2 * s) + ' ' + n(7 * s * f) + ',' + n(6 * s) + '" stroke="' + c + '" stroke-width="' + n(1.6 * s) + '" fill="none" opacity=".85"/>' +
        '<circle cx="' + n(x) + '" cy="' + n(y - 14.5 * s) + '" r="' + n(2.6 * s) + '" fill="' + c + '"/>' +
        '<path d="M' + n(x - 1.5 * s) + ',' + n(y - 17 * s) + 'h' + n(3 * s) + 'v' + n(-1.6 * s) + 'h' + n(-3 * s) + 'Z" fill="' + c + '"/>';
    }
    function lady(x, y, s, flip) { // long trailing gown, hair in a high bun, a sash lifting in the air
      var f = flip ? -1 : 1, robe = ['#a4493d', '#8b5a7a', '#5b7d8c', '#b3664a'][Math.floor(r(0, 4))];
      return '<path d="M' + n(x - 2.4 * s) + ',' + n(y - 13 * s) + 'Q' + n(x - 4 * s) + ',' + n(y - 5 * s) + ' ' + n(x - 7 * s * f) + ',' + n(y + 0.5 * s) +
        'Q' + n(x) + ',' + n(y + 1.5 * s) + ' ' + n(x + 9 * s * f) + ',' + n(y) + 'Q' + n(x + 4 * s * f) + ',' + n(y - 5 * s) + ' ' + n(x + 2.4 * s) + ',' + n(y - 13 * s) + 'Z" fill="' + robe + '" opacity=".9"/>' +
        '<path d="M' + n(x - 2.5 * s * f) + ',' + n(y - 10 * s) + 'q' + n(-6 * s * f) + ',' + n(2 * s) + ' ' + n(-8 * s * f) + ',' + n(7 * s) + 'q' + n(-1 * s * f) + ',' + n(3 * s) + ' ' + n(2 * s * f) + ',' + n(6 * s) + '" stroke="#e8d3a8" stroke-width="' + n(0.6 * s) + '" fill="none"/>' +
        '<path d="M' + n(x + 2 * s * f) + ',' + n(y - 11 * s) + 'q' + n(4 * s * f) + ',' + n(2 * s) + ' ' + n(4 * s * f) + ',' + n(6 * s) + '" stroke="' + robe + '" stroke-width="' + n(1.8 * s) + '" fill="none" stroke-linecap="round"/>' +
        '<circle cx="' + n(x) + '" cy="' + n(y - 15 * s) + '" r="' + n(2.3 * s) + '" fill="#efe2cc" stroke="' + INK + '" stroke-width=".3"/>' +
        '<path d="M' + n(x - 2.4 * s) + ',' + n(y - 15.5 * s) + 'q0,' + n(-3 * s) + ' ' + n(2.4 * s) + ',' + n(-3 * s) + 'q' + n(2.4 * s) + ',0 ' + n(2.4 * s) + ',' + n(3 * s) + 'Z" fill="' + INK + '"/>' +
        '<ellipse cx="' + n(x - 0.6 * s * f) + '" cy="' + n(y - 19.2 * s) + '" rx="' + n(1.9 * s) + '" ry="' + n(1.4 * s) + '" fill="' + INK + '"/>' +
        '<path d="M' + n(x + 0.8 * s) + ',' + n(y - 19.5 * s) + 'l' + n(2.6 * s * f) + ',' + n(-1.2 * s) + '" stroke="#c8352a" stroke-width="' + n(0.5 * s) + '"/>';
    }
    function child(x, y, s, flip) { // 总角: two tufts of hair
      var f = flip ? -1 : 1, c = '#4f6b8a';
      return '<path d="M' + n(x - 2 * s) + ',' + n(y - 7 * s) + 'L' + n(x - 4 * s) + ',' + n(y - 1 * s) + 'L' + n(x - 1.5 * s) + ',' + n(y - 1 * s) + 'L' + n(x - 1.5 * s) + ',' + n(y) +
        'M' + n(x + 1.5 * s) + ',' + n(y) + 'L' + n(x + 1.5 * s) + ',' + n(y - 1 * s) + 'L' + n(x + 4 * s) + ',' + n(y - 1 * s) + 'L' + n(x + 2 * s) + ',' + n(y - 7 * s) + 'Z" fill="' + c + '" stroke="' + c + '" stroke-width=".6" stroke-linejoin="round"/>' +
        '<path d="M' + n(x + 1.5 * s * f) + ',' + n(y - 6 * s) + 'l' + n(3.5 * s * f) + ',' + n(-3 * s) + '" stroke="' + c + '" stroke-width="' + n(1.1 * s) + '" stroke-linecap="round"/>' +
        '<circle cx="' + n(x) + '" cy="' + n(y - 9 * s) + '" r="' + n(2.1 * s) + '" fill="#efe2cc" stroke="' + INK + '" stroke-width=".3"/>' +
        '<circle cx="' + n(x - 1.8 * s) + '" cy="' + n(y - 11 * s) + '" r="' + n(1 * s) + '" fill="' + INK + '"/><circle cx="' + n(x + 1.8 * s) + '" cy="' + n(y - 11 * s) + '" r="' + n(1 * s) + '" fill="' + INK + '"/>';
    }
    function elder(x, y, s, flip) { // stooping, with a staff
      var f = flip ? -1 : 1;
      return person(x, y, s * 0.95, flip, '#5a4d42') +
        '<path d="M' + n(x + 6 * s * f) + ',' + n(y - 13 * s) + 'L' + n(x + 8 * s * f) + ',' + n(y) + '" stroke="#5e4c36" stroke-width="' + n(0.8 * s) + '" stroke-linecap="round"/>' +
        '<path d="M' + n(x - 1 * s) + ',' + n(y - 12.5 * s) + 'q' + n(1 * s * f) + ',' + n(3 * s) + ' 0,' + n(4 * s) + '" stroke="#e8e2d6" stroke-width="' + n(0.9 * s) + '" fill="none"/>';
    }
    function ox(x, y, s, flip, rider) { // 黄牛, with the herd-boy on its back
      var f = flip ? -1 : 1, k = 0.9 * s, col = '#6b4a32';
      var out = '<path d="M' + n(x - 12 * k * f) + ',' + n(y - 8 * k) + 'Q' + n(x - 13 * k * f) + ',' + n(y - 16 * k) + ' ' + n(x - 4 * k * f) + ',' + n(y - 15 * k) +
        'L' + n(x + 7 * k * f) + ',' + n(y - 15.5 * k) + 'Q' + n(x + 11 * k * f) + ',' + n(y - 16 * k) + ' ' + n(x + 12 * k * f) + ',' + n(y - 13 * k) +
        'L' + n(x + 16 * k * f) + ',' + n(y - 10 * k) + 'L' + n(x + 15 * k * f) + ',' + n(y - 7 * k) + 'L' + n(x + 11 * k * f) + ',' + n(y - 8 * k) +
        'Q' + n(x + 9 * k * f) + ',' + n(y - 6 * k) + ' ' + n(x + 8 * k * f) + ',' + n(y - 6 * k) + 'L' + n(x - 10 * k * f) + ',' + n(y - 6 * k) + 'Z" fill="' + col + '" opacity=".92"/>';
      [-10, -6, 5, 8].forEach(function (lx) { out += '<path d="M' + n(x + lx * k * f) + ',' + n(y - 7 * k) + 'V' + n(y) + '" stroke="' + col + '" stroke-width="' + n(1.4 * k) + '"/>'; });
      out += '<path d="M' + n(x + 11.5 * k * f) + ',' + n(y - 14.5 * k) + 'q' + n(1 * k * f) + ',' + n(-3 * k) + ' ' + n(-1.5 * k * f) + ',' + n(-4 * k) + 'M' + n(x + 13 * k * f) + ',' + n(y - 14 * k) + 'q' + n(2 * k * f) + ',' + n(-3 * k) + ' ' + n(0.5 * k * f) + ',' + n(-4.5 * k) +
        '" stroke="#d9c8a6" stroke-width="' + n(0.7 * k) + '" fill="none"/>' +
        '<path d="M' + n(x - 12 * k * f) + ',' + n(y - 13 * k) + 'q' + n(-3 * k * f) + ',' + n(3 * k) + ' ' + n(-2 * k * f) + ',' + n(8 * k) + '" stroke="' + col + '" stroke-width=".6" fill="none"/>';
      if (rider) out += child(x - 1 * k * f, y - 14.5 * k, s * 0.85, flip);
      return out;
    }
    function horseP(x, y, s, flip) {
      var f = flip ? -1 : 1, k = 0.9 * s, ox = x - 18 * k * f, oy = y - 27 * k;
      var pts = [[8, 12], [10, 8], [20, 8], [26, 9], [30, 4], [31, 2], [34, 2], [35, 4], [36, 7], [33, 8], [31, 9], [30, 12], [29, 17], [28, 18], [29, 27], [27, 27], [26, 19], [22, 20], [16, 20], [12, 19], [11, 27], [9, 27], [9, 18], [6, 15], [4, 16], [2, 20], [3, 14], [6, 12]];
      return '<path d="M' + pts.map(function (p) { return n(ox + p[0] * k * f) + ',' + n(oy + p[1] * k); }).join('L') + 'Z" fill="' + INK + '" opacity=".85" stroke="' + INK + '" stroke-width=".6" stroke-linejoin="round"/>';
    }
    function boat(x, y, s, fisher, sail) {
      var out = '';
      out += '<path d="M' + n(x - 15 * s) + ',' + n(y - 2 * s) + 'Q' + n(x) + ',' + n(y + 5 * s) + ' ' + n(x + 15 * s) + ',' + n(y - 3 * s) + 'L' + n(x + 11 * s) + ',' + n(y + 1.5 * s) +
        'Q' + n(x) + ',' + n(y + 5 * s) + ' ' + n(x - 11 * s) + ',' + n(y + 1.5 * s) + 'Z" fill="#3a302a"/>';
      if (sail) {
        out += '<path d="M' + n(x) + ',' + n(y - 1 * s) + 'v' + n(-28 * s) + '" stroke="#3a302a" stroke-width="' + n(1 * s) + '"/>' +
          '<path d="M' + n(x + 1 * s) + ',' + n(y - 27 * s) + 'Q' + n(x + 12 * s) + ',' + n(y - 16 * s) + ' ' + n(x + 11 * s) + ',' + n(y - 4 * s) + 'L' + n(x + 1 * s) + ',' + n(y - 4 * s) + 'Z" fill="#e9e1cf" stroke="#3a302a" stroke-width=".5"/>';
      } else {
        out += '<path d="M' + n(x - 7 * s) + ',' + n(y) + 'Q' + n(x - 2 * s) + ',' + n(y - 9 * s) + ' ' + n(x + 5 * s) + ',' + n(y) + 'Z" fill="#8a7354" stroke="#3a302a" stroke-width=".4"/>';
      }
      if (fisher) {
        var fx = x + 10 * s, fy = y - 1 * s;
        out += '<path d="M' + n(fx - 2.5 * s) + ',' + n(fy) + 'L' + n(fx) + ',' + n(fy - 7 * s) + 'L' + n(fx + 2.5 * s) + ',' + n(fy) + 'Z" fill="#5b4a3a"/>' +
          '<path d="M' + n(fx - 4.5 * s) + ',' + n(fy - 7 * s) + 'L' + n(fx) + ',' + n(fy - 10.5 * s) + 'L' + n(fx + 4.5 * s) + ',' + n(fy - 7 * s) + 'Z" fill="#c9b47f" stroke="#3a302a" stroke-width=".4"/>' +
          '<path d="M' + n(fx + 1 * s) + ',' + n(fy - 4 * s) + 'L' + n(fx + 20 * s) + ',' + n(fy - 18 * s) + '" stroke="#3a302a" stroke-width="' + n(0.6 * s) + '"/>' +
          '<path d="M' + n(fx + 20 * s) + ',' + n(fy - 18 * s) + 'L' + n(fx + 21 * s) + ',' + n(fy + 6 * s) + '" stroke="#3a302a" stroke-width=".3"/>';
      } else if (!sail && chance(0.6)) {
        out += person(x - 10 * s, y - 1 * s, s * 0.55, side === 'R');
      }
      out += '<path d="M' + n(x - 13 * s) + ',' + n(y + 4 * s) + 'h' + n(26 * s) + 'M' + n(x - 8 * s) + ',' + n(y + 7 * s) + 'h' + n(16 * s) + '" stroke="' + INK + '" stroke-opacity=".25" stroke-width=".6"/>';
      return out;
    }
    function bridge(x, y, s) {
      var w = 34 * s;
      return '<path d="M' + n(x - w) + ',' + n(y) + 'Q' + n(x) + ',' + n(y - 22 * s) + ' ' + n(x + w) + ',' + n(y) + 'L' + n(x + w - 4 * s) + ',' + n(y) + 'Q' + n(x) + ',' + n(y - 16 * s) + ' ' + n(x - w + 4 * s) + ',' + n(y) + 'Z" fill="#9a9182" stroke="' + INK + '" stroke-width=".6"/>' +
        '<path d="M' + n(x - w + 3 * s) + ',' + n(y - 3 * s) + 'Q' + n(x) + ',' + n(y - 25 * s) + ' ' + n(x + w - 3 * s) + ',' + n(y - 3 * s) + '" stroke="' + INK + '" stroke-width=".6" fill="none"/>' +
        (water ? '<path d="M' + n(x - w + 4 * s) + ',' + n(y) + 'Q' + n(x) + ',' + n(y + 16 * s) + ' ' + n(x + w - 4 * s) + ',' + n(y) + '" stroke="#8a8478" stroke-width="' + n(2 * s) + '" fill="none" opacity=".35"/>' : '');
    }
    function reeds(x, y, s) {
      var out = '', col = season === 'spring' || season === 'summer' ? '#6d8a4f' : '#a38b5c';
      for (var i = 0; i < 12; i++) {
        var rx = x + r(-18, 18) * s, h = r(18, 34) * s, lean = r(-6, 6) * s;
        out += '<path d="M' + n(rx) + ',' + n(y) + 'q' + n(lean * 0.3) + ',' + n(-h / 2) + ' ' + n(lean) + ',' + n(-h) + '" stroke="' + col + '" stroke-width=".7" fill="none"/>';
        if (chance(0.6)) out += '<ellipse cx="' + n(rx + lean) + '" cy="' + n(y - h - 2) + '" rx="1.2" ry="3.5" fill="' + (season === 'autumn' || season === 'winter' ? '#e8dfc8' : col) + '" stroke="' + col + '" stroke-width=".3" transform="rotate(' + n(lean * 3) + ' ' + n(rx + lean) + ' ' + n(y - h - 2) + ')"/>';
      }
      return out;
    }
    function lotus(x, y) {
      var out = '';
      for (var i = 0; i < 6; i++) {
        var lx = x + r(-40, 40), ly = y + r(-6, 8), lw = r(6, 11);
        out += '<ellipse cx="' + n(lx) + '" cy="' + n(ly) + '" rx="' + n(lw) + '" ry="' + n(lw * 0.35) + '" fill="#5e8a59" opacity=".85"/>';
      }
      for (var j = 0; j < 3; j++) {
        var fx = x + r(-30, 30), fy = y - r(6, 16);
        out += '<path d="M' + n(fx) + ',' + n(fy + 3) + 'q1,6 0,' + n(r(10, 16)) + '" stroke="#5e8a59" stroke-width=".7" fill="none"/>' +
          '<path d="M' + n(fx) + ',' + n(fy - 6) + 'q4,4 0,9q-4,-5 0,-9Z" fill="#e690a2"/>' +
          '<path d="M' + n(fx - 1) + ',' + n(fy + 3) + 'q-6,-2 -6,-7q4,1 6,7Z M' + n(fx + 1) + ',' + n(fy + 3) + 'q6,-2 6,-7q-4,1 -6,7Z" fill="#ec9fb0"/>';
      }
      return out;
    }
    function wall(y) {
      var out = '<rect x="-2" y="' + n(y - 9) + '" width="' + (W + 4) + '" height="9" fill="#8a8073"/>';
      for (var x = 0; x < W; x += 7) out += '<rect x="' + x + '" y="' + n(y - 12) + '" width="4" height="3.2" fill="#8a8073"/>';
      var gx = side === 'L' ? r(170, 240) : r(60, 130);
      out += '<path d="M' + n(gx - 5) + ',' + n(y) + 'v-5a5,5 0 0,1 10,0v5Z" fill="#3a3430"/>';
      out += '<rect x="' + n(gx - 12) + '" y="' + n(y - 19) + '" width="24" height="7" fill="#9b4a35"/>' + roof(gx, y - 19, 28, 0.9);
      return out;
    }
    function fort(x, y) {
      return '<path d="M' + n(x - 30) + ',' + n(y) + 'L' + n(x - 26) + ',' + n(y - 14) + 'H' + n(x + 26) + 'L' + n(x + 30) + ',' + n(y) + 'Z" fill="#a8916a" stroke="#6b5a40" stroke-width=".6"/>' +
        Array.from({ length: 9 }, function (_, i) { return '<rect x="' + n(x - 26 + i * 6) + '" y="' + n(y - 17) + '" width="3.4" height="3" fill="#a8916a"/>'; }).join('') +
        '<path d="M' + n(x - 4) + ',' + n(y) + 'v-6a4,4 0 0,1 8,0v6Z" fill="#4a3c2c"/>' +
        '<rect x="' + n(x - 9) + '" y="' + n(y - 24) + '" width="18" height="7" fill="#8e6a48"/>' + roof(x, y - 24, 22, 0.8);
    }
    function beacon(x, y) {
      return '<path d="M' + n(x - 3) + ',' + n(y) + 'h6l-1,-6h-4Z" fill="#7a6a52"/>' +
        '<path d="M' + n(x) + ',' + n(y - 6) + 'C' + n(x - 2) + ',' + n(y - 30) + ' ' + n(x + 2) + ',' + n(y - 50) + ' ' + n(x) + ',' + n(y - 85) + '" stroke="' + grad([[0, '#6d6d6d', 0], [1, '#5a5a5a', 0.7]]) + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    }
    function flag(x, y) {
      var wave = 'M' + n(x) + ',' + n(y - 32) + 'q6,-3 12,0t12,0v9q-6,-3 -12,0t-12,0Z';
      return '<path d="M' + n(x) + ',' + n(y) + 'v-34" stroke="#3a302a" stroke-width="1"/><path d="' + wave + '" fill="#b8322a" opacity=".9"/>';
    }
    function geese(x, y) {
      var out = '', count = 7, dx = side === 'L' ? 1 : -1;
      for (var i = 0; i < count; i++) {
        var row = Math.ceil(i / 2), wing = i % 2 ? 1 : -1;
        out += bird(x - dx * row * 8, y + wing * row * 5 * (i ? 1 : 0), 0.9, INK, 0.8);
      }
      return out;
    }
    function bird(x, y, s, col, w) {
      return '<path d="M' + n(x - 4 * s) + ',' + n(y - 1 * s) + 'Q' + n(x - 2 * s) + ',' + n(y - 3 * s) + ' ' + n(x) + ',' + n(y) + 'Q' + n(x + 2 * s) + ',' + n(y - 3 * s) + ' ' + n(x + 4 * s) + ',' + n(y - 1 * s) +
        '" stroke="' + col + '" stroke-width="' + n(w * s) + '" fill="none" stroke-linecap="round"/>';
    }
    function crane(x, y, s) {
      var f = side === 'L' ? 1 : -1;
      return '<path d="M' + n(x - 18 * s * f) + ',' + n(y + 4 * s) + 'L' + n(x - 8 * s * f) + ',' + n(y + 1 * s) + 'L' + n(x + 9 * s * f) + ',' + n(y) + 'L' + n(x + 20 * s * f) + ',' + n(y - 3 * s) + '" stroke="' + INK + '" stroke-width="' + n(0.9 * s) + '" fill="none"/>' +
        '<ellipse cx="' + n(x) + '" cy="' + n(y) + '" rx="' + n(7 * s) + '" ry="' + n(2.6 * s) + '" fill="#fbfaf6" stroke="' + INK + '" stroke-width=".4"/>' +
        '<path d="M' + n(x - 2 * s * f) + ',' + n(y - 1 * s) + 'Q' + n(x - 6 * s * f) + ',' + n(y - 14 * s) + ' ' + n(x - 16 * s * f) + ',' + n(y - 20 * s) + 'Q' + n(x - 4 * s * f) + ',' + n(y - 16 * s) + ' ' + n(x + 3 * s * f) + ',' + n(y - 1 * s) + 'Z" fill="#fbfaf6" stroke="' + INK + '" stroke-width=".4"/>' +
        '<path d="M' + n(x - 12 * s * f) + ',' + n(y - 17 * s) + 'L' + n(x - 16 * s * f) + ',' + n(y - 20 * s) + 'L' + n(x - 9 * s * f) + ',' + n(y - 14 * s) + 'Z" fill="' + INK + '"/>' +
        '<circle cx="' + n(x + 20 * s * f) + '" cy="' + n(y - 3.3 * s) + '" r="' + n(1 * s) + '" fill="#c0392b"/>';
    }
    function swallow(x, y, s) {
      var f = chance(0.5) ? 1 : -1;
      return '<path d="M' + n(x - 7 * s) + ',' + n(y - 3 * s) + 'Q' + n(x - 2 * s) + ',' + n(y - 1 * s) + ' ' + n(x) + ',' + n(y) + 'Q' + n(x + 2 * s) + ',' + n(y - 1 * s) + ' ' + n(x + 7 * s) + ',' + n(y - 3 * s) +
        'Q' + n(x + 3 * s) + ',' + n(y + 1 * s) + ' ' + n(x + 1 * s) + ',' + n(y + 1.5 * s) + 'L' + n(x + 3 * s * f) + ',' + n(y + 6 * s) + 'L' + n(x) + ',' + n(y + 3 * s) + 'L' + n(x - 3 * s * f) + ',' + n(y + 6 * s) +
        'L' + n(x - 1 * s) + ',' + n(y + 1.5 * s) + 'Q' + n(x - 3 * s) + ',' + n(y + 1 * s) + ' ' + n(x - 7 * s) + ',' + n(y - 3 * s) + 'Z" fill="' + INK + '"/>';
    }
    function oriole(x, y, s) {
      return '<ellipse cx="' + n(x) + '" cy="' + n(y) + '" rx="' + n(4 * s) + '" ry="' + n(2.4 * s) + '" fill="#e0b53a"/>' +
        '<circle cx="' + n(x + 3.4 * s) + '" cy="' + n(y - 1.6 * s) + '" r="' + n(1.7 * s) + '" fill="#e0b53a"/>' +
        '<path d="M' + n(x - 2 * s) + ',' + n(y - 1 * s) + 'q' + n(2 * s) + ',' + n(2 * s) + ' ' + n(4 * s) + ',0" stroke="' + INK + '" stroke-width="' + n(0.9 * s) + '" fill="none"/>' +
        '<path d="M' + n(x - 4 * s) + ',' + n(y) + 'l' + n(-3 * s) + ',' + n(1.5 * s) + '" stroke="' + INK + '" stroke-width="' + n(1 * s) + '"/>' +
        '<path d="M' + n(x + 5 * s) + ',' + n(y - 1.6 * s) + 'l' + n(1.4 * s) + ',' + n(0.4 * s) + '" stroke="#c0392b" stroke-width="' + n(0.8 * s) + '"/>';
    }
    function butterfly(x, y, s) {
      var c = chance(0.5) ? '#e2a23a' : '#d97a9a';
      return '<ellipse cx="' + n(x - 2.5 * s) + '" cy="' + n(y - 1.5 * s) + '" rx="' + n(2.8 * s) + '" ry="' + n(2 * s) + '" fill="' + c + '" transform="rotate(-25 ' + n(x) + ' ' + n(y) + ')"/>' +
        '<ellipse cx="' + n(x + 2.5 * s) + '" cy="' + n(y - 1.5 * s) + '" rx="' + n(2.8 * s) + '" ry="' + n(2 * s) + '" fill="' + c + '" transform="rotate(25 ' + n(x) + ' ' + n(y) + ')"/>' +
        '<path d="M' + n(x) + ',' + n(y - 2 * s) + 'v' + n(4 * s) + '" stroke="' + INK + '" stroke-width="' + n(0.7 * s) + '"/>';
    }
    function lantern(x, y) {
      return '<path d="M' + n(x) + ',0V' + n(y - 7) + '" stroke="#3a302a" stroke-width=".6"/>' +
        '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="16" fill="' + radial('#ffb347', 0.45) + '"/>' +
        '<ellipse cx="' + n(x) + '" cy="' + n(y) + '" rx="6" ry="7.5" fill="#c8352a"/>' +
        '<path d="M' + n(x - 3) + ',' + n(y - 7) + 'h6M' + n(x - 3) + ',' + n(y + 7) + 'h6M' + n(x) + ',' + n(y + 7.5) + 'v5" stroke="#e2b04a" stroke-width="1"/>';
    }
    function windowFrame() { // a slim lattice window frame; a round moon-gate mask hid too much of the scene
      var out = '', wood = '#3b2f28', m = 10;
      out += '<path d="M0,0H' + W + 'V' + H + 'H0Z M' + m + ',' + m + 'V' + (H - m) + 'H' + (W - m) + 'V' + m + 'Z" fill="' + wood + '" fill-rule="evenodd" opacity=".9"/>';
      for (var i = 1; i < 4; i++) {
        out += '<path d="M' + m + ',' + (m + i * 7) + 'h' + (i * 7) + 'v' + (-i * 7) + 'M' + (W - m) + ',' + (m + i * 7) + 'h' + (-i * 7) + 'v' + (-i * 7) +
          'M' + m + ',' + (H - m - i * 7) + 'h' + (i * 7) + 'v' + (i * 7) + 'M' + (W - m) + ',' + (H - m - i * 7) + 'h' + (-i * 7) + 'v' + (i * 7) + '" stroke="' + wood + '" stroke-width="1.4" fill="none" opacity=".8"/>';
      }
      return out;
    }
    function candle(x, y, s) {
      return '<circle cx="' + n(x) + '" cy="' + n(y - 16 * s) + '" r="' + n(12 * s) + '" fill="' + radial('#ffcf6b', 0.55) + '"/>' +
        '<rect x="' + n(x - 2 * s) + '" y="' + n(y - 12 * s) + '" width="' + n(4 * s) + '" height="' + n(10 * s) + '" fill="#c0392b"/>' +
        '<path d="M' + n(x - 5 * s) + ',' + n(y - 2 * s) + 'h' + n(10 * s) + 'l' + n(-2 * s) + ',' + n(2 * s) + 'h' + n(-6 * s) + 'Z" fill="#6b5444"/>' +
        '<path d="M' + n(x) + ',' + n(y - 18 * s) + 'q' + n(2.2 * s) + ',' + n(3 * s) + ' 0,' + n(5.5 * s) + 'q' + n(-2.2 * s) + ',' + n(-2.5 * s) + ' 0,' + n(-5.5 * s) + 'Z" fill="#ffb83a"/>';
    }
    function jar(x, y, s) {
      return '<path d="M' + n(x - 3 * s) + ',' + n(y - 13 * s) + 'h' + n(6 * s) + 'l' + n(1 * s) + ',' + n(2 * s) + 'q' + n(5 * s) + ',' + n(2 * s) + ' ' + n(5 * s) + ',' + n(6 * s) + 'q0,' + n(5 * s) + ' ' + n(-4 * s) + ',' + n(5 * s) +
        'h' + n(-8 * s) + 'q' + n(-4 * s) + ',0 ' + n(-4 * s) + ',' + n(-5 * s) + 'q0,' + n(-4 * s) + ' ' + n(5 * s) + ',' + n(-6 * s) + 'Z" fill="#6b4a32"/>' +
        '<rect x="' + n(x - 2.5 * s) + '" y="' + n(y - 9 * s) + '" width="' + n(5 * s) + '" height="' + n(5 * s) + '" fill="#c8352a" transform="rotate(45 ' + n(x) + ' ' + n(y - 6.5 * s) + ')"/>';
    }
    function cup(x, y, s) {
      return '<path d="M' + n(x - 4 * s) + ',' + n(y - 6 * s) + 'h' + n(8 * s) + 'q0,' + n(4 * s) + ' ' + n(-4 * s) + ',' + n(4.5 * s) + 'q' + n(-4 * s) + ',' + n(-0.5 * s) + ' ' + n(-4 * s) + ',' + n(-4.5 * s) + 'Z" fill="#c9b37a" stroke="#6b5444" stroke-width=".4"/>' +
        '<path d="M' + n(x) + ',' + n(y - 1.5 * s) + 'v' + n(1.5 * s) + 'M' + n(x - 2 * s) + ',' + n(y) + 'h' + n(4 * s) + '" stroke="#6b5444" stroke-width="' + n(0.6 * s) + '"/>';
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  }

  global.Scene = { paint: paint, W: W, H: H };
})(window);
