# Colour Exploration Workbench (browser)

Draw a graph, write a rule, play the adversary, and let the exact game search
every adversarial execution — in the browser, with no dependencies.  All logic
is Rust compiled to `wasm32-unknown-unknown` (`game-wasm/`, no crates, plain
C-ABI exports: `alloc`, `dealloc`, `run`, `free_result`); the page
(`site/index.html`) is one HTML file with inline CSS and JavaScript and no
libraries or web fonts.

## Build

    sh workbench/build.sh          # needs: rustup target add wasm32-unknown-unknown

produces `site/game.wasm` (~84 KB), and `site/standalone.html`, which inlines
the engine (base64) so it opens from a `file://` URL.  `site/index.html` +
`site/game.wasm` are for serving over HTTP (any static server, e.g.
`python3 -m http.server` inside `site/`).

## What the page does

* **Drawing.** Modes *Add vertex* (click empty space), *Add edge* (click two
  vertices), *Move* (drag), *Delete* (click a vertex or an edge), *Set start*
  (click; or double-click a vertex).  Keyboard `N E M D S`.  Up to 32
  vertices, degree at most 15.  Import/export as `n start u-v,u-v,...`, the
  `cegis` instance format; presets include the two hand-drawn sketches.
* **Rules.** A table of `own.bag -> paint>target` rows (the `rule_final.txt`
  format, importable), plus a default for rows the table does not list:
  nothing (the play stops at the first undefined row and asks for its action,
  so a rule can be written while playing), σ* or any `sweep(c,t,p)`, the
  flip-sweeps, `eat3`, `chase3`, or chase-white-else-stay.  Rows in the table
  always win over the default.
* **Play.** Step by step: the page shows the row read, the action, and the
  neighbours the adversary may serve; when there are several you click the one
  the agent reaches (or *Auto step*, which serves a visited vertex farthest
  from the unvisited region).  A repeated position ends the play as trapped,
  with the never-visited vertices marked.
* **Analysis.** *Search all executions* runs the exact game in a Web Worker:
  every position the adversary can reach is enumerated up to a cap; the
  verdict is *explores* (no adversarial execution leaves a vertex unvisited;
  the adversary's longest obstruction is offered for replay) or *fails* (one
  trapping execution is offered for replay).  An undefined row met during the
  search is reported with the path that reaches it.  *Run walks* tries the
  three deterministic and N random adversary walks first, a cheap way to find
  a failure, never a proof of success.

## Protocol (for other front ends)

`run` takes UTF-8 text lines `key value`: `cmd step|exact|walks|answer`,
`k`, `graph n s u-v,...`, `default NAME`, `cap`, `walks`, `budget`,
`colours c0 c1 ...`, `cur v`, `vis v1 v2 ...`, `row own.bag`, and a block
`table` … `end` of `row paint>target` lines.  It returns a `u32` little-endian
length followed by JSON: for `step` the row, its source, action, options and
the automatic choice; for `exact`/`walks` `{status: explores|fails|undefined|
overflow|unrefuted, positions, method, trace:{repeat_at, unvisited, steps:[{cur,
row, paint, target, options, next}]}}`.  `cargo test` in `game-wasm/` checks
the engine against the native `cegis` numbers on Sketch I.
