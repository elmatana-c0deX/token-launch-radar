# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/elmatana-c0deX/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/elmatana-c0deX/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads one sealed DefiLlama snapshot of the protocol universe, finds
the protocols that record no token yet, ranks them by what their launch would be worth, and
shows how to farm each one before it happens.

**The model (radar-4)** — one function prices every protocol from the snapshot's own
figures; no name is special-cased. What changed from radar-3: the board now ranks by
*expected value* — a fitted launch value times fitted launch odds — and the fit must win
*three* out-of-sample tests, not one, before it is allowed to price the board.

- **Winsorized fitted size curve, triple-tested** — log market cap is regressed on log TVL
  over the snapshot's 128 protocols whose token trades at a real price. The winning term
  set fits the curve, clamps its residuals at the 90th percentile, and refits, so a handful
  of wild launches cannot bend the curve. Six candidate term sets are scored on five seeded
  60/40 blind splits, an age-ordered walk-forward (a 60/40 split and a rolling fit), and
  leave-one-out; the board goes to the set with the most protocol wins, and a set that
  loses any protocol by more than 15% is ineligible. On this snapshot the winsorized curve
  wins at **243% median blind error** (plain curve 246%, category-median model 386%) — the
  full table ships in the dashboard's method section.
- **Launch odds** — a logistic model fitted on all 758 protocols (55% record a token) over
  TVL, years listed and its square, 7-day growth, chain count and the category family:
  cross-validated AUC **0.73**, Brier **0.21**. Each row's odds are the share of look-alike
  protocols that already record a token.
- **Expected-value ranking** — `implied_value_usd` is the fitted launch value times the
  launch odds, so a protocol the record says is unlikely to launch cannot top the board on
  size alone. The pure fitted value rides in every row (`fitted_value_usd`), so the
  arithmetic stays auditable.
- **Costed, dated farm verdicts** — every farm plan is dated against the snapshot and
  costed to the dollar (gas plus the carry on its stated deposit), then netted against the
  expected value it farms: at a stated 5% community allocation, each row states the
  break-even crowd its plan pays for itself at, graded **FARM** (25,000+), **THIN**
  (2,500+) or **SKIP**.
- **Rank ranges** — the winning model is refitted on 200 bootstrap resamples of the priced
  peers; each detail view shows the 10th–90th percentile range of its rank across refits.
- **Self-test** — the generator runs nine integrity checks on every build (the accounting
  closes, ranks run 1..N, verdicts recompute from their rows, a second build matches the
  first byte for byte, …) and prints the results on the dashboard.

The board covers the snapshot's whole watchlist and every other rankable pre-token protocol
that passes the same exclusion rule the watchlist was built with (no versioned products, no
wrapped or staked products of tokens that already trade, no exchange entries, no children of
tokenized parents). An integrity strip on the dashboard accounts for all 758 protocols in
the snapshot — ranked, set aside with a stated reason, or counted among the token anchors.

**The dashboard** (`dashboard/`) is a static page — no framework, no network. It renders the
board (sortable, filterable by category and chain, watchlist toggle, search), a detail view
for every protocol with its own model arithmetic, odds, plan costing and farm plan, and the
live-token comparison set the fitted curve is learned from.

## Run it

```sh
node main.ts --input <snapshot.json> --output <dir>
```

Node 22.18+, standard library only. The program writes `board.json` (the ranked board),
`data.js` (the dashboard's data), copies `dashboard/` and `screenshots/` into the output, and
writes `dossier.json` with the vendored make.fun library (`vendor/makefun-board.ts`).

MIT licensed (see `LICENSE`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=86s7eb98&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
