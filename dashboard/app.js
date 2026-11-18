// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan. No network: every byte it shows is in data.js. The farm plan
// a detail shows is the plan board.json carries for that row, not a second derivation: the page and
// the board cannot disagree.
(function () {
  'use strict';

  const RADAR = window.RADAR;
  if (!RADAR) return;
  const root = document.getElementById('board');
  let ui = { q: '', category: 'all', chain: 'all', watchlistOnly: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const money = (n) => {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return moneyFmt.format(n);
  };
  const pct = (n) => {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  };
  const ageText = (days) => {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  };
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  // radar-2: size is a power of TVL (diminishing returns), growth is penalised harder down than it is
  // rewarded up, maturity rises with the age a protocol has run with no token.
  const recompute = (row, model) => {
    const raw = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    const growth = Math.min(model.growth_cap, Math.max(model.growth_floor, raw));
    const growthMult = growth >= 0 ? 1 + (growth / 100) * model.growth_weight_up : 1 + (growth / 100) * model.growth_weight_down;
    const age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    const maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    const sizeBase = Math.round(model.size_scale * Math.pow(Math.max(row.tvl_usd, 1), model.size_exponent));
    return Math.max(1, Math.round(sizeBase * growthMult * maturity));
  };

  // A tiny element helper: h('div', {class: 'x'}, child, 'text', [more]) builds a node.
  // Attribute keys starting with 'on' become listeners; 'class' sets the class name.
  const h = (tag, attrs, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined) continue;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const kid of kids) {
      if (kid === null || kid === undefined || kid === false) continue;
      if (Array.isArray(kid)) { for (const c of kid) if (c) node.appendChild(c); continue; }
      node.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return node;
  };

  const readHash = () => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const q = params.get('q'); if (q) ui.q = q;
    const p = params.get('p'); if (p) ui.selected = p;
    const cat = params.get('category'); if (cat) ui.category = cat;
    const ch = params.get('chain'); if (ch) ui.chain = ch;
    if (params.get('wl') === '1') ui.watchlistOnly = true;
  };
  const writeHash = () => {
    const params = new URLSearchParams();
    if (ui.q) params.set('q', ui.q);
    if (ui.category !== 'all') params.set('category', ui.category);
    if (ui.chain !== 'all') params.set('chain', ui.chain);
    if (ui.watchlistOnly) params.set('wl', '1');
    if (ui.selected) params.set('p', ui.selected);
    const next = params.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  };

  const visibleRows = () => {
    const q = ui.q.trim().toLowerCase();
    return RADAR.rows.filter((r) => {
      if (ui.category !== 'all' && r.category !== ui.category) return false;
      if (ui.chain !== 'all' && !(r.chains || []).includes(ui.chain)) return false;
      if (ui.watchlistOnly && !r.watchlist) return false;
      if (!q) return true;
      const hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    });
  };
  const orderedRows = (list) => {
    const key = ui.sort;
    return list.slice().sort((a, b) => {
      let av; let bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -ui.dir;
      if (av > bv) return ui.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  };

  const topBar = () => h('header', { class: 'top' },
    h('div', { class: 'brand' }, h('span', { class: 'mark' }), h('span', { class: 'brand-name' }, 'Token Radar')),
    h('div', { class: 'top-meta' },
      h('span', {}, 'Snapshot ' + RADAR.as_of),
      h('span', {}, 'DefiLlama protocol index'),
      h('span', {}, RADAR.model_version + ' model')
    )
  );

  const intro = () => h('section', { class: 'lede' },
    h('div', {},
      h('h1', {}, RADAR.watchlist_size + ' watchlist protocols, ranked by implied value'),
      h('p', {}, 'The watchlist is the floor: every protocol with at least $' + Math.round(RADAR.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + RADAR.early_size + ' pre-token protocols below that floor. Implied value is a model, not a promise.')
    ),
    h('div', { class: 'facts' },
      h('div', { class: 'fact' }, h('span', {}, 'Watchlist covered'), h('b', {}, RADAR.watchlist_size + ' / ' + RADAR.watchlist_size)),
      h('div', { class: 'fact' }, h('span', {}, 'Pre-token rows scored'), h('b', {}, String(RADAR.board_size))),
      h('div', { class: 'fact' }, h('span', {}, 'Early rows below the floor'), h('b', {}, String(RADAR.early_size))),
      h('div', { class: 'fact' }, h('span', {}, 'Live-token protocols set aside'), h('b', {}, String(RADAR.live_size)))
    )
  );

  const filters = () => {
    const categories = [...new Set(RADAR.rows.map((r) => r.category || 'Other'))].sort();
    const chains = [...new Set(RADAR.rows.flatMap((r) => r.chains || []))].sort();
    const search = h('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: ui.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', () => { ui.q = search.value; writeHash(); draw(); });
    const select = h('select', { id: 'category', 'aria-label': 'Filter by category' },
      h('option', { value: 'all' }, 'All categories'),
      categories.map((c) => h('option', { value: c, selected: c === ui.category ? 'selected' : null }, c))
    );
    select.addEventListener('change', () => { ui.category = select.value; writeHash(); draw(); });
    const chainSelect = h('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      h('option', { value: 'all' }, 'All chains'),
      chains.map((c) => h('option', { value: c, selected: c === ui.chain ? 'selected' : null }, c))
    );
    chainSelect.addEventListener('change', () => { ui.chain = chainSelect.value; writeHash(); draw(); });
    const wl = h('button', { type: 'button', class: 'toggle', 'aria-pressed': ui.watchlistOnly ? 'true' : 'false', onclick: () => { ui.watchlistOnly = !ui.watchlistOnly; writeHash(); draw(); } }, 'Watchlist only');
    const pre = h('button', { type: 'button', 'aria-pressed': ui.tab === 'pre-token' ? 'true' : 'false', onclick: () => { ui.tab = 'pre-token'; draw(); } }, 'Pre-token');
    const live = h('button', { type: 'button', 'aria-pressed': ui.tab === 'live' ? 'true' : 'false', onclick: () => { ui.tab = 'live'; draw(); } }, 'Live token');
    return h('div', { class: 'controls' },
      h('div', { class: 'field' }, h('label', { for: 'q' }, 'Search'), search),
      h('div', { class: 'field' }, h('label', { for: 'category' }, 'Category'), select),
      h('div', { class: 'field' }, h('label', { for: 'chain' }, 'Chain'), chainSelect),
      h('div', { class: 'field' }, h('span', { class: 'sub' }, 'Scope'), wl),
      h('div', { class: 'field' }, h('span', { class: 'sub' }, 'Token status'), h('div', { class: 'tabs' }, pre, live)),
      h('span', { class: 'count' }, ui.tab === 'pre-token' ? visibleRows().length + ' rows shown' : RADAR.live.length + ' live-token protocols')
    );
  };

  const sortableTh = (key, label) => h('th', { scope: 'col' },
    h('button', { type: 'button', onclick: () => { if (ui.sort === key) ui.dir = -ui.dir; else { ui.sort = key; ui.dir = -1; } draw(); } },
      label,
      ui.sort === key ? h('span', { 'aria-hidden': 'true' }, ui.dir < 0 ? ' v' : ' ^') : null
    )
  );

  const boardView = () => {
    const list = orderedRows(visibleRows());
    if (list.length === 0) {
      return h('div', { class: 'panel' }, h('div', { class: 'empty' },
        h('h2', {}, 'No protocol matches that filter'),
        h('p', {}, 'Clear the search or pick another category to see the board again.'),
        h('button', { class: 'button primary', type: 'button', onclick: () => { ui.q = ''; ui.category = 'all'; ui.chain = 'all'; ui.watchlistOnly = false; writeHash(); draw(); } }, 'Clear filters')
      ));
    }
    const max = list[0].implied_value_usd || 1;
    const tbody = h('tbody');
    for (const r of list) {
      const growth = r.change_7d === null ? 'n/a' : pct(r.change_7d);
      const growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      const tr = h('tr', {
        'data-selected': ui.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: () => showDetail(r.slug),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(r.slug); } }
      },
        h('td', { class: 'num' }, String(r.rank)),
        h('td', {}, h('div', { class: 'name' },
          h('div', { class: 'name-line' }, h('b', {}, r.name), r.watchlist ? h('span', { class: 'badge' }, 'Watchlist') : null),
          h('span', { class: 'sub' }, (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain'))
        )),
        h('td', { class: 'num' }, money(r.tvl_usd)),
        h('td', { class: 'num ' + growthClass }, growth),
        h('td', { class: 'num' }, ageText(r.age_days)),
        h('td', {}, h('div', { class: 'implied' },
          h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          h('span', { class: 'num' }, money(r.implied_value_usd))
        )),
        h('td', {}, h('span', { class: 'status' }, 'no token'))
      );
      tbody.appendChild(tr);
    }
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', {},
          h('caption', { class: 'sub' }, 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.'),
          h('thead', {}, h('tr', {},
            sortableTh('implied', 'Rank'),
            sortableTh('name', 'Protocol'),
            sortableTh('tvl', 'TVL'),
            sortableTh('growth', '7d'),
            sortableTh('age', 'Age'),
            sortableTh('implied', 'Implied value'),
            h('th', { scope: 'col' }, 'Token')
          )),
          tbody
        )
      )
    );
  };

  const liveView = () => {
    const tbody = h('tbody');
    for (const r of RADAR.live) {
      tbody.appendChild(h('tr', {},
        h('td', { class: 'num' }, 'live'),
        h('td', {}, h('div', { class: 'name' }, h('b', {}, r.name), h('span', { class: 'sub' }, (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain')))),
        h('td', { class: 'num' }, money(r.tvl_usd)),
        h('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg') }, pct(r.change_7d)),
        h('td', { class: 'num' }, money(r.mcap_usd)),
        h('td', {}, h('span', { class: 'status' }, 'already trades'))
      ));
    }
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', {},
          h('caption', { class: 'sub' }, 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.'),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Status'), h('th', { scope: 'col' }, 'Protocol'), h('th', { scope: 'col' }, 'TVL'), h('th', { scope: 'col' }, '7d'), h('th', { scope: 'col' }, 'Market cap'), h('th', { scope: 'col' }, 'Token'))),
          tbody
        )
      )
    );
  };

  const modelNote = () => {
    const m = RADAR.model;
    return h('section', { class: 'panel model' },
      h('h2', {}, 'How implied value is computed'),
      h('p', { class: 'sub' }, 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.'),
      h('div', { class: 'formula' },
        'implied = round( ' + m.size_scale + ' x tvl_usd^' + m.size_exponent + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight_up + ' up / ' + m.growth_weight_down + ' down) x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )'
      ),
      h('p', { class: 'sub' }, 'Size is a power of TVL below 1, so a protocol ten times larger is worth about five times as much, not ten. Growth is penalised harder on the way down than it is rewarded on the way up. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. The early radar is every pre-token protocol below the watchlist floor, by TVL, and the live-token protocols are set aside with their market caps shown.')
    );
  };

  const dialog = h('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', () => { ui.selected = null; writeHash(); });

  const showDetail = (slug) => {
    const row = RADAR.rows.filter((r) => r.slug === slug)[0];
    if (!row) return;
    ui.selected = slug;
    writeHash();
    dialog.textContent = '';
    // The farm plan is the row's own plan from board.json, carried in data.js: the page shows the
    // board's words, not a second copy of them.
    const steps = row.farm_steps || [];
    dialog.appendChild(h('div', { class: 'detail-head' },
      h('div', {},
        h('span', { class: 'brand-name' }, 'Rank ' + row.rank + ' of ' + RADAR.board_size + (row.watchlist ? ' · Watchlist' : ' · Early radar')),
        h('h2', { id: 'detail-title' }, row.name),
        h('p', { class: 'sub' }, (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' · listed ' + (row.listed_at || 'date unknown'))
      ),
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close details', onclick: () => dialog.close() }, 'Close')
    ));
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', {}, 'Implied value'),
      h('div', { class: 'equation' },
        h('div', {}, h('span', {}, 'TVL'), h('b', { class: 'num' }, money(row.tvl_usd))),
        h('div', {}, h('span', {}, 'Size base (75 x TVL^0.7)'), h('b', { class: 'num' }, money(row.size_base))),
        h('div', {}, h('span', {}, 'Seven-day growth'), h('b', { class: 'num' }, pct(row.change_7d))),
        h('div', {}, h('span', {}, 'Age with no token'), h('b', { class: 'num' }, ageText(row.age_days))),
        h('div', {}, h('span', {}, 'Growth multiplier'), h('b', { class: 'num' }, String(row.growth_multiplier))),
        h('div', {}, h('span', {}, 'Maturity multiplier'), h('b', { class: 'num' }, String(row.maturity_multiplier))),
        h('div', {}, h('span', {}, 'Implied value'), h('b', { class: 'num' }, money(row.implied_value_usd)))
      ),
      h('p', { class: 'sub' }, 'Model ' + RADAR.model_version + ': the same function scores every protocol. The page recomputes this row as ' + money(recompute(row, RADAR.model)) + (recompute(row, RADAR.model) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price. The protocol records no token.')
    ));
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', {}, 'Farm plan'),
      h('ol', { class: 'steps' }, steps.map((s) => {
        const at = s.indexOf(' Cost: ');
        const action = at >= 0 ? s.slice(0, at) : s;
        const tail = at >= 0 ? s.slice(at + 1) : '';
        return h('li', {}, h('b', {}, action), h('span', { class: 'cost' }, tail));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  };

  const draw = () => {
    root.textContent = '';
    const shell = h('div', { class: 'shell' });
    shell.appendChild(topBar());
    shell.appendChild(intro());
    shell.appendChild(filters());
    shell.appendChild(ui.tab === 'pre-token' ? boardView() : liveView());
    if (ui.tab === 'pre-token') shell.appendChild(modelNote());
    root.appendChild(shell);
    root.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) root.appendChild(dialog);
    if (ui.selected) showDetail(ui.selected);
  };

  readHash();
  draw();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
