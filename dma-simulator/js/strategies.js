// Strategy presets — generate the transition function Φ table for a given
// set of degrees encountered in the graph.
//
// Φ is represented as:
//   {
//     start: { action, port },            // for input (⊥, ξ)
//     trans: { [`${d}|${p}|${b}`]: { action, port } }
//   }
// where action ∈ {"abstain","drop","pick"} and port ∈ {0..d-1}.

export const STRATEGIES = {
    basic: {
        label: "Basic walk (no pebbles)",
        params: [],
        build: (degrees) => basicWalk(degrees, /*withPebbles=*/ false),
    },
    basicPebble: {
        label: "Basic walk with pebbles",
        params: [],
        build: (degrees) => basicWalk(degrees, /*withPebbles=*/ true),
    },
    priority: {
        label: "Priority walk σ(δ,p,q)",
        params: [
            { key: "delta", label: "Special degree δ", default: 3, min: 2 },
            { key: "p", label: "Entry port p", default: 0, min: 0 },
            { key: "q", label: "Exit port q", default: 1, min: 0 },
        ],
        build: (degrees, { delta, p, q }) => priorityWalk(degrees, delta, p, q, false),
    },
    priorityPebble: {
        label: "Priority walk with pebbles",
        params: [
            { key: "delta", label: "Special degree δ", default: 3, min: 2 },
            { key: "p", label: "Entry port p", default: 0, min: 0 },
            { key: "q", label: "Exit port q", default: 1, min: 0 },
        ],
        build: (degrees, { delta, p, q }) => priorityWalk(degrees, delta, p, q, true),
    },
};

export function buildPhi(strategy, degrees, params = {}) {
    return STRATEGIES[strategy].build(degrees, params);
}

// Empty Φ table: every transition defaults to (abstain, port (p+1) mod d).
export function emptyPhi(degrees) {
    return basicWalk(degrees, false);
}

function basicWalk(degrees, withPebbles) {
    const trans = {};
    for (const d of degrees) {
        for (let p = 0; p < d; p++) {
            const nextPort = (p + 1) % d;
            // empty
            trans[key(d, p, "e")] = withPebbles
                ? { action: "drop", port: p }
                : { action: "abstain", port: nextPort };
            // full (only reachable in pebble mode)
            trans[key(d, p, "f")] = { action: "abstain", port: nextPort };
        }
    }
    return { start: { action: withPebbles ? "drop" : "abstain", port: 0 }, trans };
}

function priorityWalk(degrees, delta, p0, q0, withPebbles) {
    const phi = basicWalk(degrees, withPebbles);
    if (!degrees.includes(delta)) return phi;
    if (p0 >= delta || q0 >= delta || p0 === q0) return phi;

    // σ_{(δ,p0,q0)}: standard +1 cycle, except entering by p0 jumps to (p0+1)
    // and visits q0 LAST. Cycle notation (p0, p0+1, ..., q0-1, q0+1, ..., p0-1, q0).
    const cycle = priorityCycle(delta, p0, q0);
    const sigma = {};
    for (let i = 0; i < cycle.length; i++) {
        sigma[cycle[i]] = cycle[(i + 1) % cycle.length];
    }

    for (let p = 0; p < delta; p++) {
        // Full nodes of degree δ: priority walk.
        phi.trans[key(delta, p, "f")] = { action: "abstain", port: sigma[p] };
        if (withPebbles) {
            // Empty nodes: drop + backtrack along entry port.
            phi.trans[key(delta, p, "e")] = { action: "drop", port: p };
        } else {
            // Empty nodes still follow the priority order.
            phi.trans[key(delta, p, "e")] = { action: "abstain", port: sigma[p] };
        }
    }
    return phi;
}

function priorityCycle(d, p, q) {
    // (p, p+1, ..., q-1, q+1, ..., p-1, q) mod d
    const cycle = [];
    let x = p;
    do {
        if (x !== q) cycle.push(x);
        x = (x + 1) % d;
    } while (x !== p);
    cycle.push(q);
    return cycle;
}

export function key(d, p, b) { return `${d}|${p}|${b}`; }
export function parseKey(k) {
    const [d, p, b] = k.split("|");
    return { d: Number(d), p: Number(p), b };
}

export function allKeys(degrees) {
    const out = [];
    for (const d of degrees) {
        for (let p = 0; p < d; p++) {
            out.push(key(d, p, "e"));
            out.push(key(d, p, "f"));
        }
    }
    return out;
}
