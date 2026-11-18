# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sengajabgttt/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sengajabgttt/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks pre-token protocols by implied value from the sealed DefiLlama snapshot (2026-11-14, 758 protocols). The radar-2 model scores every row with one function of the snapshot's own figures — size as a power of TVL (75 × TVL^0.7, diminishing returns), seven-day growth (rewarded up, penalised harder down), and the age a protocol has run with no token — and writes a 226-row board covering all 40 watchlist protocols plus 186 early pre-token protocols below the floor. Each row carries an 8-step farm plan with costs and times, derived from the protocol's category, chains, TVL and age. The dashboard is a static page (no network): sortable board, search, category and chain filters, a watchlist-only toggle, a per-protocol detail view with the model breakdown and farm plan, and a live-token view set aside with market caps. `main.ts` (Node 22, standard library only) reads the snapshot, writes `board.json`, `data.js` and `dossier.json`, and copies `dashboard/` and `screenshots/` to the output.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
