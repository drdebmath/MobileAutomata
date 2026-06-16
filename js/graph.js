// Graph specifications: generators for parametric families and explicit
// presets reproducing the constructions from the paper.
//
// All builders return:
//   {
//     numNodes,
//     edges: [{u, v, portU, portV}],   // explicit ports (deterministic)
//     adj:   [[{neighbor, port, neighborPort}, ...]],
//     nodes: [{id, hasPebble}],
//     layoutHint: "tree" | "circle" | "preset" | "cose",
//     positions?: {[id]: {x, y}},      // optional explicit positions
//     rootId: number,                  // default start node
//   }

export const GRAPH_TYPES = {
    path: {
        label: "Infinite path (approximation)",
        params: [{ key: "n", label: "Nodes", default: 120, min: 20, max: 400 }],
        build: ({ n }) => {
            const edges = range(n - 1).map(i => [i, i + 1]);
            const positions = Object.fromEntries(range(n).map(i => [String(i), { x: i * 80, y: 0 }]));
            return fromEdgeList(n, edges, "preset", positions);
        },
    },
    cycle: {
        label: "Ring (Cycle)",
        params: [{ key: "n", label: "Nodes", default: 16, min: 3, max: 400 }],
        build: ({ n }) => fromEdgeList(n, range(n).map(i => [i, (i + 1) % n]), "circle"),
    },
    tree: {
        label: "Random Tree",
        params: [
            { key: "n", label: "Nodes", default: 15, min: 2, max: 200 },
            { key: "seed", label: "Seed", default: 1 },
        ],
        build: ({ n, seed }) => {
            const rand = mulberry32(seed >>> 0);
            const edges = [];
            for (let i = 1; i < n; i++) edges.push([Math.floor(rand() * i), i]);
            return fromEdgeList(n, edges, "tree");
        },
    },
    classD: {
        label: "Class D (∞-path + finite branches)",
        params: [
            { key: "trunkLen", label: "Visible trunk length", default: 40, min: 8, max: 200 },
            { key: "iStar", label: "Branching node v_i", default: 5, min: 0, max: 200 },
            { key: "branches", label: "Branches at v_i (#)", default: 2, min: 1, max: 6 },
            { key: "branchLen", label: "Branch length", default: 4, min: 1, max: 16 },
        ],
        build: classDTree,
    },
    classCI: {
        label: "Class C_I (two infinite paths)",
        params: [
            { key: "armLen", label: "Visible arm length", default: 100, min: 10, max: 200 },
        ],
        build: classCITree,
    },
    ladder: {
        label: "Finite ladder (Fig. 1)",
        params: [],
        build: finiteLadder,
    },
    triangle: {
        label: "Triangle gadget (Fig. 4)",
        params: [],
        build: triangleGadget,
    },
};

export function buildGraph(type, params) {
    return GRAPH_TYPES[type].build(params);
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function range(n) { return Array.from({ length: n }, (_, i) => i); }

function fromEdgeList(numNodes, edges, layoutHint = "cose", positions = null, rootId = 0) {
    const adj = Array.from({ length: numNodes }, () => []);
    const seen = new Set();
    const builtEdges = [];

    for (const [a, b] of edges) {
        if (a === b) continue;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const portU = adj[a].length;
        const portV = adj[b].length;
        adj[a].push({ neighbor: b, port: portU, neighborPort: portV });
        adj[b].push({ neighbor: a, port: portV, neighborPort: portU });
        builtEdges.push({ u: a, v: b, portU, portV });
    }

    const nodes = Array.from({ length: numNodes }, (_, i) => ({ id: i, hasPebble: false }));
    return { numNodes, edges: builtEdges, adj, nodes, layoutHint, positions, rootId };
}

// Build a graph from an explicit list of port assignments.
// portedEdges: [{u, v, portU, portV}]
function fromPortedEdges(numNodes, portedEdges, layoutHint, positions, rootId = 0) {
    const adj = Array.from({ length: numNodes }, () => []);
    for (const { u, v, portU, portV } of portedEdges) {
        ensureSlot(adj[u], portU, { neighbor: v, port: portU, neighborPort: portV });
        ensureSlot(adj[v], portV, { neighbor: u, port: portV, neighborPort: portU });
    }
    // collapse holes (any slot left undefined is treated as missing)
    for (let i = 0; i < numNodes; i++) adj[i] = adj[i].filter(Boolean);

    const nodes = Array.from({ length: numNodes }, (_, i) => ({ id: i, hasPebble: false }));
    return {
        numNodes,
        edges: portedEdges.slice(),
        adj,
        nodes,
        layoutHint,
        positions,
        rootId,
    };
}

function ensureSlot(arr, idx, val) {
    while (arr.length <= idx) arr.push(undefined);
    arr[idx] = val;
}

function mulberry32(seed) {
    return function () {
        let t = (seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ------------------------------------------------------------------
// Class D: trunk (v, v1, ..., v_{L-1}) with finite paths hanging off v_i.
// Branching node is v_iStar with `branches` paths of length branchLen.
// (The truly infinite trunk is approximated by a finite visible portion.)
// ------------------------------------------------------------------
function classDTree({ trunkLen, iStar, branches, branchLen }) {
    const trunk = Array.from({ length: trunkLen }, (_, i) => i);
    const edges = [];
    for (let i = 0; i + 1 < trunkLen; i++) edges.push([trunk[i], trunk[i + 1]]);

    let next = trunkLen;
    const target = Math.min(iStar, trunkLen - 1);
    for (let b = 0; b < branches; b++) {
        let prev = trunk[target];
        for (let j = 0; j < branchLen; j++) {
            edges.push([prev, next]);
            prev = next;
            next++;
        }
    }
    return fromEdgeList(next, edges, "tree");
}

// ------------------------------------------------------------------
// Class C_I: two finite paths joined at root (truncations of the two
// infinite branches in the paper).
// ------------------------------------------------------------------
function classCITree({ armLen }) {
    const numNodes = 2 * armLen + 1;
    const edges = [];
    // root = 0
    // left arm: 1..armLen
    // right arm: armLen+1..2*armLen
    edges.push([0, 1]);
    for (let i = 1; i < armLen; i++) edges.push([i, i + 1]);
    edges.push([0, armLen + 1]);
    for (let i = armLen + 1; i < 2 * armLen; i++) edges.push([i, i + 1]);
    return fromEdgeList(numNodes, edges, "preset", spreadCIPositions(armLen));
}

function spreadCIPositions(armLen) {
    const pos = {};
    pos[0] = { x: 0, y: 0 };
    for (let i = 1; i <= armLen; i++) pos[i] = { x: -i * 70, y: 0 };
    for (let i = 1; i <= armLen; i++) pos[armLen + i] = { x: i * 70, y: 0 };
    return pos;
}

// ------------------------------------------------------------------
// Finite ladder of Fig. 1, with the paper's port numbering.
// Nodes: v_0..v_6 (ids 0..6) and u_0..u_6 (ids 7..13).
// ------------------------------------------------------------------
function finiteLadder() {
    const V = i => i;          // v_i id
    const U = i => 7 + i;      // u_i id
    const edges = [];

    // v-path v_0..v_6 and u-path u_0..u_6: ports per paper for i=0,1,2.
    // [v_i, p, p, v_{i+1}] for i=0,1,2 and p=0,2,1
    edges.push({ u: V(0), v: V(1), portU: 0, portV: 0 });
    edges.push({ u: V(1), v: V(2), portU: 2, portV: 2 });
    edges.push({ u: V(2), v: V(3), portU: 1, portV: 1 });
    edges.push({ u: V(3), v: V(4), portU: 0, portV: 0 });
    edges.push({ u: U(0), v: U(1), portU: 0, portV: 0 });
    edges.push({ u: U(1), v: U(2), portU: 2, portV: 2 });
    edges.push({ u: U(2), v: U(3), portU: 1, portV: 1 });

    // rungs u_i-v_i for i=1,2,3,4 with ports p=1,0,2,2
    edges.push({ u: U(1), v: V(1), portU: 1, portV: 1 });
    edges.push({ u: U(2), v: V(2), portU: 0, portV: 0 });
    edges.push({ u: U(3), v: V(3), portU: 2, portV: 2 });
    edges.push({ u: U(4), v: V(4), portU: 2, portV: 2 });

    // path u_3 - u_4 - u_5 - v_5 - v_4 : port sequence [a,0,1,b]
    // This explicitly locks the ladder bottleneck so a memoryless agent
    // must backtrack rather than slip through on an alternate port ordering.
    edges.push({ u: U(3), v: U(4), portU: 0, portV: 1 });
    edges.push({ u: U(4), v: U(5), portU: 0, portV: 1 });
    edges.push({ u: U(5), v: V(5), portU: 0, portV: 1 });
    edges.push({ u: V(5), v: V(4), portU: 0, portV: 1 });

    // remaining trunk extensions v_5-v_6 and u_5-u_6 (degree-1 endcaps)
    // Use the only free port slot at each end (0 after the others are placed).
    // v_5 has ports 1 (to v_4) and 0 (to u_5) used already? Let's check:
    //   v_5: edge to v_4 via port 0 (above), edge to u_5 via port 1 (above) -> ports 0,1 used.
    // So v_5-v_6 takes port 2 at v_5, port 0 at v_6.
    edges.push({ u: V(5), v: V(6), portU: 2, portV: 0 });
    // u_5: edges to u_4 via port 1, to v_5 via port 0 -> port 2 free.
    edges.push({ u: U(5), v: U(6), portU: 2, portV: 0 });

    const positions = {};
    for (let i = 0; i <= 6; i++) {
        positions[V(i)] = { x: i * 90, y: -50 };
        positions[U(i)] = { x: i * 90, y: 50 };
    }

    return fromPortedEdges(14, edges, "preset", positions, V(0));
}

// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Triangle gadget of Fig. 4: 10 base nodes along a straight horizontal line
// and 9 peak nodes placed above the midpoints. Explicit ports fix the
// movement rules, and the preset layout locks node positions.
// ------------------------------------------------------------------
function triangleGadget() {
    const baseCount = 10;
    const peakCount = baseCount - 1;
    const numNodes = baseCount + peakCount;
    const edges = [];
    const positions = {};

    // Place base nodes in a horizontal backbone.
    for (let i = 0; i < baseCount; i++) {
        positions[i] = { x: i * 100, y: 0 };
    }

    // Place peaks between consecutive base nodes.
    for (let i = 0; i < peakCount; i++) {
        const peakId = baseCount + i;
        positions[peakId] = { x: i * 100 + 50, y: -80 };
    }

    // Horizontal backbone edges. Base0 has port0 to Base1.
    edges.push({ u: 0, v: 1, portU: 0, portV: 0 });
    for (let i = 1; i < baseCount - 1; i++) {
        edges.push({ u: i, v: i + 1, portU: 1, portV: 0 });
    }

    // Connect each peak to its two supporting base nodes.
    for (let i = 0; i < peakCount; i++) {
        const peakId = baseCount + i;
        const leftBase = i;
        const rightBase = i + 1;
        const leftPort = leftBase === 0 ? 1 : 2;
        const rightPort = rightBase === baseCount - 1 ? 1 : 2;
        edges.push({ u: peakId, v: leftBase, portU: 0, portV: leftPort });
        edges.push({ u: peakId, v: rightBase, portU: 1, portV: rightPort });
    }

    // Swap the preset positions of the specified adjacent node pairs so their
    // numbering is exchanged in the triangle gadget layout.
    const swapPairs = [
        [2, 3],
        [5, 6],
        [8, 9],
        [11, 12],
        [14, 15],
        [17, 18],
    ];
    for (const [a, b] of swapPairs) {
        const tmp = positions[a];
        positions[a] = positions[b];
        positions[b] = tmp;
    }

    return fromPortedEdges(numNodes, edges, "preset", positions, 0);
}
