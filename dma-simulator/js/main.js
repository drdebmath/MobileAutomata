import { GRAPH_TYPES, buildGraph } from "./graph.js";
import { STRATEGIES, buildPhi } from "./strategies.js";
import { createState, step, TERMINATION } from "./dma.js";
import { createVisualization } from "./visualization.js";
import { createDashboard } from "./dashboard.js";
import { renderTransitionEditor, collectDegrees } from "./transitionEditor.js";

const PLAY_INTERVAL_MS = 700;

const els = {
    graphType: document.getElementById("graph-type"),
    graphParams: document.getElementById("graph-params"),
    startNode: document.getElementById("start-node"),
    build: document.getElementById("btn-build"),
    strategy: document.getElementById("strategy"),
    strategyParams: document.getElementById("strategy-params"),
    applyStrategy: document.getElementById("btn-apply-strategy"),
    transEditor: document.getElementById("trans-editor"),
    pebbleBudget: document.getElementById("pebble-budget"),
    infinitePebbles: document.getElementById("infinite-pebbles"),
    termination: document.getElementById("termination"),
    step: document.getElementById("btn-step"),
    play: document.getElementById("btn-play"),
    pause: document.getElementById("btn-pause"),
    reset: document.getElementById("btn-reset"),
    viz: document.getElementById("visualization"),
};

const dashboard = createDashboard();

let graph = null;
let viz = null;
let state = null;
let phi = null;
let playTimer = null;

// ----- parameter form helpers -----
function renderParamInputs(container, defs, prefix) {
    container.innerHTML = "";
    for (const p of defs) {
        const wrap = document.createElement("label");
        wrap.className = "field";
        const span = document.createElement("span");
        span.textContent = p.label ?? p.key;
        wrap.appendChild(span);
        let input;
        if (p.textarea) {
            input = document.createElement("textarea");
            input.value = p.default;
        } else {
            input = document.createElement("input");
            input.type = "number";
            input.value = p.default;
            if (p.min !== undefined) input.min = p.min;
            if (p.max !== undefined) input.max = p.max;
            if (p.step !== undefined) input.step = p.step;
        }
        input.dataset.key = p.key;
        input.dataset.kind = p.textarea ? "text" : "number";
        input.id = `${prefix}-${p.key}`;
        wrap.appendChild(input);
        container.appendChild(wrap);
    }
}

function readParams(container) {
    const params = {};
    for (const el of container.querySelectorAll("[data-key]")) {
        params[el.dataset.key] = el.dataset.kind === "number" ? Number(el.value) : el.value;
    }
    return params;
}

function renderGraphParams() {
    renderParamInputs(els.graphParams, GRAPH_TYPES[els.graphType.value].params, "g");
}

function renderStrategyParams() {
    renderParamInputs(els.strategyParams, STRATEGIES[els.strategy.value].params, "s");
}

function populateSelectors() {
    for (const [k, v] of Object.entries(GRAPH_TYPES)) {
        const opt = document.createElement("option");
        opt.value = k; opt.textContent = v.label;
        els.graphType.appendChild(opt);
    }
    els.graphType.value = "tree";

    for (const [k, v] of Object.entries(STRATEGIES)) {
        const opt = document.createElement("option");
        opt.value = k; opt.textContent = v.label;
        els.strategy.appendChild(opt);
    }
    els.strategy.value = "basicPebble";

    for (const [k, v] of Object.entries(TERMINATION)) {
        const opt = document.createElement("option");
        opt.value = v; opt.textContent = humanize(v);
        els.termination.appendChild(opt);
    }
    els.termination.value = TERMINATION.allPebbled;
}

function humanize(slug) {
    return slug.replace(/-/g, " ").replace(/^./, c => c.toUpperCase());
}

// ----- core operations -----
function pebbleBudget() {
    if (els.infinitePebbles.checked) return Infinity;
    return Math.max(0, parseInt(els.pebbleBudget.value, 10) || 0);
}

function refreshEditor() {
    const degrees = graph ? collectDegrees(graph.adj) : [];
    renderTransitionEditor(els.transEditor, phi, degrees, () => {});
}

function applyStrategy() {
    if (!graph) return;
    const degrees = collectDegrees(graph.adj);
    phi = buildPhi(els.strategy.value, degrees, readParams(els.strategyParams));
    refreshEditor();
}

function buildAndRender() {
    stopPlay();
    const type = els.graphType.value;
    let params;
    try {
        params = readParams(els.graphParams);
        graph = buildGraph(type, params);
    } catch (err) {
        alert(`Could not build graph: ${err.message}`);
        return;
    }
    if (graph.numNodes === 0) { alert("Empty graph."); return; }

    const start = Number.isFinite(parseInt(els.startNode.value, 10))
        ? parseInt(els.startNode.value, 10)
        : graph.rootId;
    const rootId = (start >= 0 && start < graph.numNodes) ? start : graph.rootId;
    els.startNode.value = rootId;
    els.startNode.max = graph.numNodes - 1;
    graph.rootId = rootId;

    if (viz) viz.destroy();
    viz = createVisualization(els.viz, graph);

    applyStrategy();
    resetWalk();
}

function resetWalk() {
    if (!graph || !viz) return;
    stopPlay();
    graph.nodes.forEach(n => { n.hasPebble = false; });
    viz.syncPebbles(graph.nodes);
    const root = graph.rootId;
    state = createState(root, graph.adj[root].length, pebbleBudget());
    viz.setAgentNode(root);
    dashboard.clear();
    dashboard.set({
        node: root,
        carried: state.carried === Infinity ? "∞" : state.carried,
        placed: 0,
    });
    enableControls();
}

function doStep() {
    if (!graph || !viz || !phi) return;
    const result = step(state, graph.nodes, graph.adj, phi, { termination: els.termination.value });
    viz.syncPebbles(graph.nodes);
    viz.setAgentNode(state.currentNode);

    const placed = graph.nodes.filter(n => n.hasPebble).length;
    dashboard.set({
        input: result.inputDescr ?? "-",
        node: state.currentNode,
        entry: state.entryPort ?? "⊥",
        status: result.status + (result.haltReason ? ` (${result.haltReason})` : ""),
        action: result.action,
        exit: result.exitPort,
        carried: state.carried === Infinity ? "∞" : state.carried,
        placed,
    });

    if (result.terminated) {
        stopPlay();
        els.step.disabled = true;
        els.play.disabled = true;
    }
}

function startPlay() {
    if (!graph || state.terminated) return;
    els.play.disabled = true;
    els.step.disabled = true;
    els.pause.disabled = false;
    playTimer = setInterval(doStep, PLAY_INTERVAL_MS);
}

function stopPlay() {
    els.play.disabled = false;
    els.step.disabled = false;
    els.pause.disabled = true;
    if (playTimer != null) { clearInterval(playTimer); playTimer = null; }
}

function enableControls() {
    els.step.disabled = false;
    els.play.disabled = false;
    els.pause.disabled = true;
}

// ----- wiring -----
function init() {
    populateSelectors();
    renderGraphParams();
    renderStrategyParams();

    els.graphType.addEventListener("change", renderGraphParams);
    els.strategy.addEventListener("change", renderStrategyParams);
    els.applyStrategy.addEventListener("click", applyStrategy);
    els.build.addEventListener("click", buildAndRender);
    els.step.addEventListener("click", doStep);
    els.play.addEventListener("click", startPlay);
    els.pause.addEventListener("click", stopPlay);
    els.reset.addEventListener("click", resetWalk);
    els.infinitePebbles.addEventListener("change", () => {
        els.pebbleBudget.disabled = els.infinitePebbles.checked;
    });

    buildAndRender();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
