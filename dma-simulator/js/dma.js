// DMA simulator core. Φ is a lookup table; the agent has a carried-pebble
// counter that the table cannot inspect (memorylessness).

import { key } from "./strategies.js";

export const TERMINATION = {
    never: "never",
    allPebbled: "all-pebbled",
    returnToStart: "return-to-start",
    exhausted: "exhausted",
};

export function createState(rootId, rootDegree, pebbleBudget) {
    return {
        currentNode: rootId,
        startNode: rootId,
        entryPort: null,    // null indicates the initial (⊥, ξ) input
        rootDegree,
        carried: pebbleBudget === Infinity ? Infinity : Math.max(0, pebbleBudget),
        initialBudget: pebbleBudget,
        initialized: false,
        terminated: false,
        haltReason: null,
    };
}

export function step(state, nodes, adj, phi, { termination }) {
    if (state.terminated) {
        return { status: "Terminated", action: "Halt", exitPort: "-", terminated: true };
    }

    const u = state.currentNode;
    const node = nodes[u];
    const d = adj[u].length;
    const b = node.hasPebble ? "f" : "e";

    let op;
    let inputDescr;
    if (!state.initialized) {
        op = phi.start ?? { action: "abstain", port: 0 };
        state.initialized = true;
        inputDescr = `(⊥, ${state.rootDegree})`;
    } else {
        op = phi.trans[key(d, state.entryPort, b)];
        inputDescr = `(${state.entryPort}, ${d}, ${b})`;
        if (!op) {
            state.terminated = true;
            state.haltReason = "Φ undefined";
            return {
                status: "No transition",
                action: "Halt",
                exitPort: "-",
                terminated: true,
                inputDescr,
            };
        }
    }

    // Resolve action on the current node BEFORE moving.
    let actionDescr = op.action;
    if (op.action === "drop") {
        if (!node.hasPebble && state.carried !== 0) {
            node.hasPebble = true;
            if (state.carried !== Infinity) state.carried -= 1;
        } else {
            actionDescr = node.hasPebble ? "drop (no-op: full)" : "drop (no-op: no pebble)";
        }
    } else if (op.action === "pick") {
        if (node.hasPebble) {
            node.hasPebble = false;
            if (state.carried !== Infinity) state.carried += 1;
        } else {
            actionDescr = "pick (no-op: empty)";
        }
    }

    // Move via op.port.
    if (op.port < 0 || op.port >= d) {
        state.terminated = true;
        state.haltReason = "Invalid port";
        return {
            status: "Invalid port",
            action: actionDescr,
            exitPort: op.port,
            terminated: true,
            inputDescr,
        };
    }
    const edge = adj[u].find(n => n.port === op.port);
    state.currentNode = edge.neighbor;
    state.entryPort = edge.neighborPort;

    const result = {
        status: b === "f" ? "Full" : "Empty",
        action: actionDescr,
        exitPort: op.port,
        inputDescr,
        terminated: false,
    };
    applyTermination(state, nodes, termination, result);
    return result;
}

function applyTermination(state, nodes, termination, result) {
    if (termination === TERMINATION.never) return;

    const allPebbled = nodes.every(n => n.hasPebble);
    const exhausted = state.initialBudget !== Infinity &&
        state.initialBudget > 0 &&
        state.carried === 0;
    const atStart = state.currentNode === state.startNode;

    let halt = false;
    let reason = null;
    if (termination === TERMINATION.allPebbled && allPebbled) {
        halt = true; reason = "All nodes pebbled";
    } else if (termination === TERMINATION.returnToStart && allPebbled && atStart) {
        halt = true; reason = "Returned to start with all pebbled";
    } else if (termination === TERMINATION.exhausted && exhausted) {
        halt = true; reason = "Pebble budget exhausted";
    }
    if (halt) {
        state.terminated = true;
        state.haltReason = reason;
        result.terminated = true;
        result.haltReason = reason;
    }
}
