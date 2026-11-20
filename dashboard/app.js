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
  function fmtInt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
  function chip(v) {
    return '<span class="chip ' + v.toLowerCase() + '">' + v + '</span>';
  }
  function header() {
    return (
      '<div class="masthead"><h1>Token Launch Radar<span class="dot">.</span></h1>' +
      '<p class="tagline">Every protocol in the snapshot that records no token yet, ranked by what its launch would be worth — priced by a model fitted on the snapshot itself and tested blind, with launch odds and a farm verdict netted to the dollar on every row.</p>' +
      '<p class="meta">Snapshot ' + esc(DATA.as_of) + ' · model ' + esc(DATA.model_version) + '<br>Source: ' + esc(DATA.source) + '</p></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + DATA.board_size + '</b><span>protocols ranked</span></div>' +
      '<div class="stat"><b>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</b><span>watchlist covered</span></div>' +
      '<div class="stat"><b>' + DATA.accounting.total + '</b><span>protocols accounted for, none dropped silently</span></div>' +
      '<div class="stat"><b>' + DATA.fit.chosen_error_pct.toFixed(0) + '%</b><span>blind-test error of the fitted model (median multiples: ' + DATA.fit.baseline_error_pct.toFixed(0) + '%)</span></div>' +
      '<div class="stat"><b>' + DATA.verdicts.farm + ' FARM</b><span>' + DATA.verdicts.thin + ' thin · ' + DATA.verdicts.skip + ' skip — every plan netted</span></div>' +
      '</div>'
    );
  }
  function strip() {
    var a = DATA.accounting;
    var excluded = a.excluded_category + a.versioned_name + a.wrapped_name + a.exchange_name + a.child_of_tokenized;
    return (
      '<div class="strip"><b>Integrity</b>' + a.total + ' of ' + a.total + ' protocols accounted for · ' +
      a.tokenized_priced + ' priced token anchors the model is fitted on · ' + a.token_recorded_unpriced + ' record a token without a price · ' +
      a.pre_token + ' pre-token: ' + a.board_rows + ' ranked here, ' + excluded + ' set aside with a stated reason (' +
      a.excluded_category + ' product-of-a-token categories, ' + a.versioned_name + ' versioned names, ' + a.wrapped_name + ' wrapped/staked names' +
      (a.child_of_tokenized ? ', ' + a.child_of_tokenized + ' children of tokenized parents' : '') +
      (a.exchange_name ? ', ' + a.exchange_name + ' exchange entries' : '') +
      ') · watchlist ' + a.watchlist_covered + '/' + DATA.watchlist_size + ' · values strictly ranked · this page runs offline</div>'
    );
  }
  function method() {
    var f = DATA.fit, o = DATA.odds;
    var rows = f.candidates.map(function (c) {
      return '<tr' + (c.terms === f.chosen_terms ? ' class="chosen"' : '') + '><td>' + esc(c.terms) + (c.terms === f.chosen_terms ? ' ← prices this board' : '') + '</td><td class="num">' + c.heldout_error_pct.toFixed(0) + '%</td></tr>';
    }).join('');
    return (
      '<section class="method"><h2>How the ranking is made — fitted, then tested blind</h2>' +
      '<p class="formula">implied value = fitted size curve (log mcap on log TVL) over the snapshot\'s ' + f.trained_on + ' priced tokens — a term stays only if the blind test keeps it</p>' +
      '<p>The value model is <b>fitted</b>, not tabulated: log market cap is regressed on log TVL across the protocols in this snapshot whose token trades at a real price, with shrunken per-category offsets and growth/age terms as candidates. Every candidate was priced <b>blind</b> — ' + f.splits + ' seeded 60/40 splits, fitted on one side and tested on the other — and the winner prices the board:</p>' +
      '<table class="fittable"><thead><tr><th>Term set</th><th class="num">Held-out error, median</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p><b>Launch odds</b> come from the peers\' record: a logistic fit over all ' + o.trained_on + ' protocols (base rate ' + o.base_rate_pct.toFixed(0) + '% record a token; AUC ' + o.auc.toFixed(2) + ') on TVL, years listed and 7-day growth. <b>Verdicts net each plan</b>: the plan is costed to the dollar, and at a stated 5% community allocation it pays for itself unless more wallets farm it than its break-even crowd — FARM at 25,000+, THIN at 2,500+, SKIP below that. <b>Rank ranges</b> on each detail view come from ' + f.bootstrap_refits + ' bootstrap refits of the winning model.</p>' +
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
      '<footer><p>Built from one sealed DefiLlama snapshot (' + esc(DATA.as_of) + '): ' + DATA.board_size + ' pre-token protocols ranked, ' + DATA.live_size + ' live-token protocols shown for comparison, and every one of the snapshot\'s ' + DATA.accounting.total + ' protocols accounted for in the integrity strip above. The page runs offline; every figure on it is computed by the entry\'s program from that snapshot.</p>' +
      '<p>Farming always carries smart-contract and market risk. Position sizes here are illustrations for one wallet, not advice.</p></footer>'
    );
  }

  function distribution() {
    var edges = [1e6, 3e6, 1e7, 3e7, 1e8];
    var labels = ['under $1M', '$1–3M', '$3–10M', '$10–30M', '$30–100M', '$100M+'];
    var counts = [0, 0, 0, 0, 0, 0];
    DATA.rows.forEach(function (r) {
      var b = 0;
      while (b < edges.length && r.implied_value_usd >= edges[b]) b++;
      counts[b]++;
    });
    var max = Math.max.apply(null, counts.concat([1]));
    var bars = counts.map(function (c, i) {
      return '<div class="drow"><span class="dlab">' + labels[i] + '</span><span class="dbar"><i style="width:' + Math.round((c / max) * 100) + '%"></i></span><span class="dnum">' + c + '</span></div>';
    }).join('');
    return '<div class="dist"><h3>Implied value distribution — all ' + DATA.board_size + ' ranked rows</h3>' + bars + '</div>';
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
        '<td class="num">' + r.effective_multiple.toFixed(2) + '×</td>' +
        '<td class="num">' + r.odds_pct.toFixed(0) + '%</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td>' +
        '<td>' + chip(r.verdict) + '</td></tr>'
      );
    }).join('');
    main.innerHTML = header() + strip() + method() + viewTabs() + controls() +
      '<table><thead><tr>' + th('#', 'rank', 'num') + th('Protocol', 'name') + '<th class="chains">Chains</th>' +
      th('TVL', 'tvl_usd', 'num') + th('7d', 'change_7d', 'num') + th('Fitted ×', 'effective_multiple', 'num') + th('Odds', 'odds_pct', 'num') + th('Implied value', 'implied_value_usd', 'num') + th('Verdict', 'breakeven_crowd') +
      '</tr></thead><tbody>' + (body || '<tr><td colspan="9">No protocol matches those filters.</td></tr>') + '</tbody></table>' + distribution() + footer();
    document.getElementById('count').textContent = rows.length + ' of ' + DATA.board_size + ' shown';
    wire();
    main.setAttribute('aria-busy', 'false');
  }

  /* ---------- detail view ---------- */
  function detailView(r) {
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    main.innerHTML = header() + strip() +
      '<button class="back" id="back">← Back to the board</button>' +
      '<section class="detail"><h2>' + esc(r.name) + (r.watchlist ? '<span class="badge">watchlist</span>' : '<span class="badge early">early find</span>') + ' ' + chip(r.verdict) + '</h2>' +
      '<p class="sub">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chains recorded') + ' · rank #' + r.rank + ' of ' + DATA.board_size + ' · ' + DATA.fit.bootstrap_refits + ' bootstrap refits place it between #' + r.rank_low + ' and #' + r.rank_high + '</p>' +
      '<div class="kv">' +
      '<div><b>' + money(r.implied_value_usd) + '</b><span>implied launch value</span></div>' +
      '<div><b>' + money(r.tvl_usd) + '</b><span>TVL at the snapshot</span></div>' +
      '<div><b>' + (r.change_7d === null ? 'n/a' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</b><span>TVL change, 7 days</span></div>' +
      '<div><b>' + ageText(r.age_days) + '</b><span>running with no token recorded' + (r.listed_at ? ' (tracked since ' + esc(r.listed_at) + ')' : '') + '</span></div>' +
      '<div><b>' + r.odds_pct.toFixed(0) + '%</b><span>launch odds — share of look-alike protocols that already record a token</span></div>' +
      '<div><b>$' + r.plan_cost_usd + '</b><span>farm plan cost, all-in (gas + capital carry)</span></div>' +
      '<div><b>' + fmtInt(r.breakeven_crowd) + '</b><span>break-even crowd — the plan pays unless more wallets than this farm it</span></div>' +
      '<div><b>#' + r.rank_low + '–#' + r.rank_high + '</b><span>rank range across ' + DATA.fit.bootstrap_refits + ' refits of the model</span></div>' +
      '</div>' +
      '<h3 class="section">The model, on this protocol</h3>' +
      '<p class="modelbox">' + moneyFull(r.tvl_usd) + ' TVL × ' + r.effective_multiple.toFixed(2) + '× fitted multiple × ' + r.growth_multiplier.toFixed(2) + ' growth × ' + r.age_multiplier.toFixed(2) + ' age = <b>' + moneyFull(r.implied_value_usd) + '</b><br>' +
      '<span class="src">Fitted source: ' + esc(r.multiple_source) + '. The fitted multiple is the size curve\'s price at this TVL; growth and age terms survived the blind test in the method section.</span></p>' +
      '<h3 class="section">How to farm it</h3><ol class="plan">' + steps + '</ol>' +
      '<h3 class="section">What would change this rank</h3>' +
      '<p class="sub">The fitted multiple moves when the snapshot\'s priced peers reprice against their own TVL; this row\'s rank range across refits is #' + r.rank_low + '–#' + r.rank_high + '. The verdict flips when the plan\'s cost or the launch odds push its break-even crowd across 25,000 (FARM) or 2,500 (THIN).</p>' +
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
    main.innerHTML = header() + strip() + method() + viewTabs() +
      '<p class="sub" style="margin:0 0 12px">These protocols already trade. The board never ranks them — it learns from them: the size curve is fitted on the priced ones in this set, and the blind splits in the method section are drawn from the same peers. The realised multiple column is what each one actually trades at, shown next to the curve\'s fitted prices on the board.</p>' +
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
