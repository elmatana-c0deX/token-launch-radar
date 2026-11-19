// Token Launch Radar — the page. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders three things: the ranked board, one protocol's detail view, and the live-token
// comparison set the model's multiples are learned from. No network: every byte is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var main = document.getElementById('board');

  /* ---------- formatting ---------- */
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function moneyFull(n) {
    return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(n) {
    if (n === null || n === undefined) return '<span class="sub">n/a</span>';
    var cls = n > 0 ? 'up' : n < 0 ? 'down' : '';
    return '<span class="' + cls + '">' + (n > 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ageText(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days < 60) return days + 'd';
    if (days < 730) return Math.round(days / 30.4) + ' mo';
    return (days / 365).toFixed(1) + ' yrs';
  }

  /* ---------- state ---------- */
  var state = { view: 'board', q: '', category: '', chain: '', watchOnly: false, sort: 'rank', dir: 1, slug: null };

  function categories() {
    var set = {};
    DATA.rows.forEach(function (r) { if (r.category) set[r.category] = 1; });
    return Object.keys(set).sort();
  }
  function chains() {
    var set = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { set[c] = 1; }); });
    return Object.keys(set).sort();
  }
  function visibleRows() {
    var rows = DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      var x = a[key], y = b[key];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      if (typeof x === 'string') return state.dir * x.localeCompare(y);
      return state.dir * (x - y);
    });
    return rows;
  }

  /* ---------- chrome ---------- */
  function header() {
    var total = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    return (
      '<div class="masthead"><h1>Token Launch Radar<span class="dot">.</span></h1>' +
      '<p class="tagline">Every protocol in the snapshot that records no token yet, ranked by what its launch would be worth — and how to farm it before it happens.</p>' +
      '<p class="meta">Snapshot ' + esc(DATA.as_of) + ' · model ' + esc(DATA.model_version) + '<br>Source: ' + esc(DATA.source) + '</p></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + DATA.board_size + '</b><span>protocols ranked</span></div>' +
      '<div class="stat"><b>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</b><span>watchlist covered</span></div>' +
      '<div class="stat"><b>' + DATA.early_size + '</b><span>early finds below the $50M floor</span></div>' +
      '<div class="stat"><b>' + money(total) + '</b><span>total implied launch value</span></div>' +
      '<div class="stat"><b>' + DATA.global_multiple.toFixed(2) + '×</b><span>all-market median mcap / TVL</span></div>' +
      '</div>'
    );
  }
  function method() {
    var m = DATA.model;
    return (
      '<section class="method"><h2>How the ranking is made</h2>' +
      '<p class="formula">implied value = TVL × category multiple × growth factor × age factor</p>' +
      '<p>The <b>category multiple</b> is the median market-cap/TVL ratio of the protocols in this same snapshot whose token already trades — learned per category from the data itself, pooled across a category family when a category has fewer than ' + m.min_comparables + ' tokenized peers, and the all-market median (' + DATA.global_multiple.toFixed(2) + '×) when no family applies. The <b>growth factor</b> clamps 1 + (7-day TVL change × ' + m.growth_weight + ') into [' + m.growth_floor + ', ' + m.growth_cap + ']. The <b>age factor</b> adds ' + (m.age_step * 100) + '% per year the protocol has run with no token, capped at ' + m.age_cap_years + ' years: seasoning is proof of demand. No protocol is scored by name — one function prices every row, and each detail view shows its own arithmetic.</p>' +
      '<small>Implied values are this model\'s claim about a hypothetical launch at the snapshot\'s figures — not a prediction that a token will exist. A protocol "records no token" in DefiLlama\'s data; that is what the board can know.</small></section>'
    );
  }
  function viewTabs() {
    return (
      '<div class="views">' +
      '<button data-view="board" aria-pressed="' + (state.view === 'board') + '">The board</button>' +
      '<button data-view="live" aria-pressed="' + (state.view === 'live') + '">Live tokens — where the multiples come from</button>' +
      '</div>'
    );
  }
  function footer() {
    return (
      '<footer><p>Built from one sealed DefiLlama snapshot (' + esc(DATA.as_of) + '): ' + DATA.board_size + ' pre-token protocols ranked, ' + DATA.live_size + ' live-token protocols shown for comparison. The page runs offline; every figure on it is computed by the entry\'s program from that snapshot.</p>' +
      '<p>Farming always carries smart-contract and market risk. Position sizes here are illustrations for one wallet, not advice.</p></footer>'
    );
  }

  /* ---------- board view ---------- */
  function controls() {
    var catOpts = '<option value="">All categories</option>' + categories().map(function (c) {
      return '<option' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var chainOpts = '<option value="">All chains</option>' + chains().map(function (c) {
      return '<option' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    return (
      '<div class="controls">' +
      '<input type="search" id="q" placeholder="Search protocols…" value="' + esc(state.q) + '" aria-label="Search protocols">' +
      '<select id="cat" aria-label="Filter by category">' + catOpts + '</select>' +
      '<select id="chain" aria-label="Filter by chain">' + chainOpts + '</select>' +
      '<label class="check"><input type="checkbox" id="watch"' + (state.watchOnly ? ' checked' : '') + '> Watchlist only</label>' +
      '<span class="count" id="count"></span></div>'
    );
  }
  function th(label, key, cls) {
    var arrow = state.sort === key ? (state.dir === 1 ? ' ↑' : ' ↓') : '';
    return '<th class="sortable ' + (cls || '') + '" data-sort="' + key + '">' + label + arrow + '</th>';
  }
  function boardView() {
    var rows = visibleRows();
    var body = rows.map(function (r) {
      return (
        '<tr data-slug="' + esc(r.slug) + '"><td class="rank">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' +
        (r.watchlist ? '<span class="badge">watchlist</span>' : '<span class="badge early">early</span>') +
        '<div class="sub">' + esc(r.category || 'Uncategorised') + '</div></td>' +
        '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + r.category_multiple.toFixed(2) + '×</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>'
      );
    }).join('');
    main.innerHTML = header() + method() + viewTabs() + controls() +
      '<table><thead><tr>' + th('#', 'rank', 'num') + th('Protocol', 'name') + '<th class="chains">Chains</th>' +
      th('TVL', 'tvl_usd', 'num') + th('7d', 'change_7d', 'num') + th('Multiple', 'category_multiple', 'num') + th('Implied value', 'implied_value_usd', 'num') +
      '</tr></thead><tbody>' + (body || '<tr><td colspan="7">No protocol matches those filters.</td></tr>') + '</tbody></table>' + footer();
    document.getElementById('count').textContent = rows.length + ' of ' + DATA.board_size + ' shown';
    wire();
    main.setAttribute('aria-busy', 'false');
  }

  /* ---------- detail view ---------- */
  function detailView(r) {
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    main.innerHTML = header() +
      '<button class="back" id="back">← Back to the board</button>' +
      '<section class="detail"><h2>' + esc(r.name) + (r.watchlist ? '<span class="badge">watchlist</span>' : '<span class="badge early">early find</span>') + '</h2>' +
      '<p class="sub">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chains recorded') + ' · rank #' + r.rank + ' of ' + DATA.board_size + '</p>' +
      '<div class="kv">' +
      '<div><b>' + money(r.implied_value_usd) + '</b><span>implied launch value</span></div>' +
      '<div><b>' + money(r.tvl_usd) + '</b><span>TVL at the snapshot</span></div>' +
      '<div><b>' + (r.change_7d === null ? 'n/a' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</b><span>TVL change, 7 days</span></div>' +
      '<div><b>' + ageText(r.age_days) + '</b><span>running with no token recorded' + (r.listed_at ? ' (tracked since ' + esc(r.listed_at) + ')' : '') + '</span></div>' +
      '</div>' +
      '<h3 class="section">The model, on this protocol</h3>' +
      '<p class="modelbox">' + moneyFull(r.tvl_usd) + ' TVL × ' + r.category_multiple.toFixed(2) + '× multiple × ' + r.growth_multiplier.toFixed(2) + ' growth × ' + r.age_multiplier.toFixed(2) + ' age = <b>' + moneyFull(r.implied_value_usd) + '</b><br>' +
      '<span class="src">Multiple source: ' + esc(r.multiple_source) + '. Growth factor from the 7-day TVL change; age factor from the tracked-since date.</span></p>' +
      '<h3 class="section">How to farm it</h3><ol class="plan">' + steps + '</ol>' +
      '<h3 class="section">What would change this rank</h3>' +
      '<p class="sub">Sustained TVL growth raises the growth factor toward its ' + DATA.model.growth_cap + ' cap; a falling TVL cuts it toward ' + DATA.model.growth_floor + '. The multiple moves only when the snapshot\'s tokenized peers in its category reprice against their own TVL.</p>' +
      '</section>' + footer();
    document.getElementById('back').addEventListener('click', function () { state.view = 'board'; state.slug = null; render(); window.scrollTo(0, 0); });
    main.setAttribute('aria-busy', 'false');
  }

  /* ---------- live view ---------- */
  function liveView() {
    var body = DATA.live.map(function (r) {
      return '<tr><td><span class="name">' + esc(r.name) + '</span><div class="sub">' + esc(r.category || 'Uncategorised') + '</div></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + money(r.mcap_usd) + '</td>' +
        '<td class="num">' + (r.multiple === null ? '—' : r.multiple.toFixed(2) + '×') + '</td><td class="num">' + pct(r.change_7d) + '</td></tr>';
    }).join('');
    main.innerHTML = header() + method() + viewTabs() +
      '<p class="sub" style="margin:0 0 12px">These protocols already trade. The board never ranks them — it learns from them: each category\'s multiple is the median of these realised mcap/TVL ratios, so the radar\'s prices are the market\'s own, carried across to the protocols still to launch.</p>' +
      '<table><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">Realised multiple</th><th class="num">7d</th></tr></thead><tbody>' + body + '</tbody></table>' + footer();
    wire();
    main.setAttribute('aria-busy', 'false');
  }

  /* ---------- wiring ---------- */
  function wire() {
    var tabs = main.querySelectorAll('.views button');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () { state.view = this.getAttribute('data-view'); render(); });
    }
    if (state.view !== 'board') return;
    document.getElementById('q').addEventListener('input', function () { state.q = this.value; refreshTable(); });
    document.getElementById('cat').addEventListener('change', function () { state.category = this.value; refreshTable(); });
    document.getElementById('chain').addEventListener('change', function () { state.chain = this.value; refreshTable(); });
    document.getElementById('watch').addEventListener('change', function () { state.watchOnly = this.checked; refreshTable(); });
    var heads = main.querySelectorAll('th.sortable');
    for (var j = 0; j < heads.length; j++) {
      heads[j].addEventListener('click', function () {
        var k = this.getAttribute('data-sort');
        if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
        if (k === 'rank') state.dir = 1;
        boardView();
      });
    }
    bindRows();
  }
  function bindRows() {
    var trs = main.querySelectorAll('tbody tr[data-slug]');
    for (var i = 0; i < trs.length; i++) {
      trs[i].addEventListener('click', function () {
        var slug = this.getAttribute('data-slug');
        var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
        if (row) { state.slug = slug; detailView(row); window.scrollTo(0, 0); }
      });
    }
  }
  function refreshTable() {
    boardView();
    var q = document.getElementById('q');
    q.focus();
    q.setSelectionRange(q.value.length, q.value.length);
  }
  function render() {
    if (state.view === 'live') liveView(); else boardView();
  }
  render();
})();
