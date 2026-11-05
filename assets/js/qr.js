/* Generatore QR minimale (modalità byte, correzione errori L, versioni 1-20). */
(function (root) {
  'use strict';
  var ECC = [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28];
  var BLK = [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7];

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataWords(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v]; }
  function utf8(s) {
    var o = [], i, c;
    s = unescape(encodeURIComponent(s));
    for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); o.push(c); }
    return o;
  }
  // Reed-Solomon
  var EXP = [], LOG = [];
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsDiv(n) {
    var r = [], i; for (i = 0; i < n - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) { r[j] = mul(r[j], root); if (j + 1 < n) r[j] ^= r[j + 1]; }
      root = mul(root, 2);
    }
    return r;
  }
  function rsRem(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= mul(c, f); });
    });
    return r;
  }

  function make(text) {
    var bytes = utf8(text), ver, cap;
    for (ver = 1; ver <= 19; ver++) {
      cap = dataWords(ver) * 8;
      if (4 + (ver <= 9 ? 8 : 16) + bytes.length * 8 <= cap) break;
    }
    if (ver > 19) throw new Error('QR: testo troppo lungo');
    // bitstream
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }
    // blocks + ecc
    var nb = BLK[ver], el = ECC[ver], raw = Math.floor(rawModules(ver) / 8), shortN = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var blocks = [], div = rsDiv(el), off = 0;
    for (i = 0; i < nb; i++) {
      var len = shortLen - el + (i < shortN ? 0 : 1);
      var d = data.slice(off, off + len); off += len;
      var e = rsRem(d, div);
      if (i < shortN) d.push(0);
      blocks.push(d.concat(e));
    }
    var all = [];
    for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (bl, j) { if (i !== shortLen - el || j >= shortN) all.push(bl[i]); });

    // matrix
    var N = ver * 4 + 17, M = [], F = [];
    for (i = 0; i < N; i++) { M.push(new Array(N).fill(false)); F.push(new Array(N).fill(false)); }
    function set(x, y, dark) { M[y][x] = dark; F[y][x] = true; }
    for (i = 0; i < N; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < N && y >= 0 && y < N) set(x, y, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(N - 4, 3); finder(3, N - 4);
    var pos = [];
    if (ver > 1) { var na = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2; pos = [6]; for (var p = N - 7; pos.length < na; p -= step) pos.splice(1, 0, p); }
    pos.forEach(function (ax, ia) { pos.forEach(function (ay, ib) {
      if ((ia === 0 && ib === 0) || (ia === 0 && ib === pos.length - 1) || (ia === pos.length - 1 && ib === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    function drawFormat(mask) {
      var d = (1 << 3) | mask, r = d; for (var q = 0; q < 10; q++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var f = ((d << 10) | r) ^ 0x5412, q2;
      for (q2 = 0; q2 <= 5; q2++) set(8, q2, ((f >>> q2) & 1) !== 0);
      set(8, 7, ((f >>> 6) & 1) !== 0); set(8, 8, ((f >>> 7) & 1) !== 0); set(7, 8, ((f >>> 8) & 1) !== 0);
      for (q2 = 9; q2 < 15; q2++) set(14 - q2, 8, ((f >>> q2) & 1) !== 0);
      for (q2 = 0; q2 < 8; q2++) set(N - 1 - q2, 8, ((f >>> q2) & 1) !== 0);
      for (q2 = 8; q2 < 15; q2++) set(8, N - 15 + q2, ((f >>> q2) & 1) !== 0);
      set(8, N - 8, true);
    }
    drawFormat(0);
    if (ver >= 7) {
      var rr = ver; for (i = 0; i < 12; i++) rr = (rr << 1) ^ ((rr >>> 11) * 0x1F25);
      var vb = (ver << 12) | rr;
      for (i = 0; i < 18; i++) { var bt = ((vb >>> i) & 1) !== 0, a = N - 11 + i % 3, bb = Math.floor(i / 3); set(a, bb, bt); set(bb, a, bt); }
    }
    // dati a zig-zag
    var bi = 0;
    for (var right = N - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < N; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? N - 1 - vert : vert;
        if (!F[y][x] && bi < all.length * 8) { M[y][x] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
    function applyMask(m) {
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        var inv;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break; case 1: inv = y % 2 === 0; break; case 2: inv = x % 3 === 0; break; case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break; case 5: inv = x * y % 2 + x * y % 3 === 0; break;
          case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break; default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (!F[y][x] && inv) M[y][x] = !M[y][x];
      }
    }
    function penalty() {
      var s = 0, x, y, run, c, dark = 0;
      for (y = 0; y < N; y++) { run = 1; for (x = 1; x < N; x++) { if (M[y][x] === M[y][x - 1]) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
      for (x = 0; x < N; x++) { run = 1; for (y = 1; y < N; y++) { if (M[y][x] === M[y - 1][x]) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
      for (y = 0; y < N - 1; y++) for (x = 0; x < N - 1; x++) { c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) s += 3; }
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (M[y][x]) dark++;
      s += (Math.ceil(Math.abs(dark * 20 - N * N * 10) / (N * N)) - 1) * 10;
      return s;
    }
    var best = 0, bestP = Infinity;
    for (var m = 0; m < 8; m++) { applyMask(m); drawFormat(m); var pe = penalty(); if (pe < bestP) { bestP = pe; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { size: N, version: ver, get: function (x, y) { return M[y][x]; } };
  }
  root.NSKQR = { make: make };
})(window);
