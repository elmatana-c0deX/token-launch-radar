# Token Launch Radar

An entry for make.fun's **token-radar-01** bounty: a radar that reads one sealed DefiLlama
snapshot of the protocol universe, finds the protocols that record no token yet, ranks them by
what their launch would be worth, and shows how to farm each one before it happens.

## Run it

```
node main.ts --input <snapshot.json> --output <dir>
```

Node 22.18+, standard library only. The program writes `board.json` (the ranked board),
`data.js` (the dashboard's data), copies `dashboard/` and `screenshots/` into the output, and
writes `dossier.json` with the vendored make.fun library (`vendor/makefun-board.ts`).

## The model

One function prices every protocol from the snapshot's own figures — no name is special-cased:

```
implied value = TVL × category multiple × growth factor × age factor
```

- **Category multiple** — the median market-cap/TVL ratio of the snapshot's own tokenized
  protocols in the same category; pooled across a category family when a category has fewer
  than 3 tokenized peers; the all-market median when no family applies.
- **Growth factor** — `clamp(1 + change_7d × 0.02, 0.75, 1.40)` from the 7-day TVL change.
- **Age factor** — +5% per year the protocol has run with no token recorded, capped at 5 years.

The board covers the snapshot's whole watchlist and adds early finds below its $50M floor that
pass the same exclusion rule the watchlist was built with (no versioned products, no wrapped or
staked products of tokens that already trade, no exchange entries, no children of tokenized
parents). Every row carries a farm plan whose steps state what they cost and how long they
take, generated from the protocol's own category, chains, TVL and age.

## The dashboard

`dashboard/` is a static page — no framework, no network. It renders the board (sortable,
filterable by category and chain, watchlist toggle, search), a detail view for every protocol
with its own model arithmetic and farm plan, and the live-token comparison set the multiples
are learned from.

MIT licensed (see `LICENSE`).
