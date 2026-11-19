# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/elmatana-c0deX/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/elmatana-c0deX/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads one sealed DefiLlama snapshot of the protocol universe, finds
the protocols that record no token yet, ranks them by what their launch would be worth, and
shows how to farm each one before it happens.

**The model** — one function prices every protocol from the snapshot's own figures; no name
is special-cased:

```
implied value = TVL × category multiple × growth factor × age factor
```

- **Category multiple** — the median market-cap/TVL ratio of the snapshot's own tokenized
  protocols in the same category; pooled across a category family when a category has fewer
  than 3 tokenized peers; the all-market median when no family applies.
- **Growth factor** — `clamp(1 + change_7d × 0.02, 0.75, 1.40)` from the 7-day TVL change.
- **Age factor** — +5% per year the protocol has run with no token recorded, capped at 5
  years: seasoning is proof of demand.

The board covers the snapshot's whole watchlist and adds early finds below its $50M floor
that pass the same exclusion rule the watchlist was built with (no versioned products, no
wrapped or staked products of tokens that already trade, no exchange entries, no children of
tokenized parents). Every row carries a farm plan whose steps state what they cost and how
long they take, generated from the protocol's own category, chains, TVL and age.

**The dashboard** (`dashboard/`) is a static page — no framework, no network. It renders the
board (sortable, filterable by category and chain, watchlist toggle, search), a detail view
for every protocol with its own model arithmetic and farm plan, and the live-token comparison
set the multiples are learned from.

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
