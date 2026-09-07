# MobileAutomata

Simulators for mobile automata exploring graphs.

* **Colour Exploration Workbench** — served at <https://drdebmath.github.io/MobileAutomata/>
  from [`docs/`](docs/): one deterministic agent with `k` colours, rows `own.bag`,
  actions `paint>target`, an adversary choosing among same-coloured neighbours.
  Draw a graph by clicking, write a rule table or grow it row by row while playing,
  play the adversary yourself, and search **every** adversarial execution with the
  exact game.  Rust compiled to WebAssembly, no dependencies.  Source and build
  script in [`workbench/`](workbench/) (`sh workbench/build.sh` rewrites
  `docs/index.html`).
* **DMA Graph Exploration Simulator** — the original cytoscape-based simulator,
  now in [`dma-simulator/`](dma-simulator/) (open its `index.html`).

## Hosting

GitHub Pages serves the `docs/` folder of `main` (Settings → Pages → Deploy from a
branch → `main` / `docs`).  The served site is a single file, `docs/index.html`,
with the WebAssembly engine inlined, so nothing else is needed.
