# MobileAutomata
A simulator for Mobile Automata on Graphs

## Colour Exploration Workbench

[`workbench.html`](workbench.html) is a second, self-contained simulator for the
colour model (one deterministic agent, `k` colours, rows `own.bag`, actions
`paint>target`, an adversary choosing among same-coloured neighbours): draw a
graph by clicking, write a rule table or grow it row by row while playing, play
the adversary yourself, and search **every** adversarial execution with the
exact game.  Everything runs in Rust compiled to WebAssembly with no
dependencies; the source is in [`workbench/`](workbench/) and
`sh workbench/build.sh` rebuilds the page.
