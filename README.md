# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/elmatana-c0deX/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/elmatana-c0deX/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads one sealed DefiLlama snapshot of the protocol universe, finds
the protocols that record no token yet, ranks them by what their launch would be worth, and
shows how to farm each one before it happens.

**The model (radar-3)** — one function prices every protocol from the snapshot's own
figures; no name is special-cased. What changed from the median-multiple model it replaces:
every number is now *fitted* to the snapshot, and the fit is *tested blind* before it is
allowed to price the board.

- **Fitted size curve** — log market cap is regressed on log TVL over the snapshot's 128
  protocols whose token trades at a real price, with shrunken per-category offsets and
  growth/age terms as candidates. Five candidate term sets are priced on five seeded 60/40
  blind splits (fit on one side, test on the other); only the winner prices the board. On
  this snapshot the plain curve wins at **246% median held-out error**, against 386% for the
  old category-median model — the full table ships in the dashboard's method section.
- **Launch odds** — a logistic model fitted on all 758 protocols (55% record a token;
  AUC 0.70) over TVL, years listed and 7-day growth: each row's odds are the share of
  look-alike protocols that already record a token.
- **Costed farm verdicts** — every farm plan is costed to the dollar (gas plus the carry on
  its capital) and netted against the launch it farms: at a stated 5% community allocation,
  each row states the break-even crowd its plan pays for itself at, graded **FARM**
  (25,000+), **THIN** (2,500+) or **SKIP**.
- **Rank ranges** — the winning model is refitted on 80 bootstrap resamples of the priced
  peers; each detail view shows the 10th–90th percentile range of its rank across refits.

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
