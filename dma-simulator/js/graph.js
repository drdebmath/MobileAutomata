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
        label: "Path",
        params: [{ key: "n", label: "Nodes", default: 10, min: 2, max: 200 }],
        build: ({ n }) => fromEdgeList(n, range(n - 1).map(i => [i, i + 1]), "tree"),
    },
    cycle: {
        label: "Ring (Cycle)",
        params: [{ key: "n", label: "Nodes", default: 8, min: 3, max: 200 }],
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
            { key: "trunkLen", label: "Visible trunk length", default: 8, min: 2, max: 40 },
            { key: "iStar", label: "Branching node v_i", default: 2, min: 0, max: 40 },
            { key: "branches", label: "Branches at v_i (#)", default: 2, min: 1, max: 6 },
            { key: "branchLen", label: "Branch length", default: 2, min: 1, max: 10 },
        ],
        build: classDTree,
    },
    classCI: {
        label: "Class C_I (two ∞-paths)",
        params: [
            { key: "armLen", label: "Visible arm length", default: 6, min: 1, max: 30 },
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
        params: [
            { key: "k", label: "# triangles", default: 4, min: 3, max: 9 },
            { key: "tailLen", label: "Path w_i length", default: 3, min: 1, max: 8 },
        ],
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
    edges.push({ u: U(0), v: U(1), portU: 0, portV: 0 });
    edges.push({ u: U(1), v: U(2), portU: 2, portV: 2 });
    edges.push({ u: U(2), v: U(3), portU: 1, portV: 1 });

    // rungs u_i-v_i for i=1,2,3,4 with ports p=1,0,2,2
    edges.push({ u: U(1), v: V(1), portU: 1, portV: 1 });
    edges.push({ u: U(2), v: V(2), portU: 0, portV: 0 });
    edges.push({ u: U(3), v: V(3), portU: 2, portV: 2 });
    edges.push({ u: U(4), v: V(4), portU: 2, portV: 2 });

    // path u_3 - u_4 - u_5 - v_5 - v_4 : ports [a,0,1,b]
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
// Triangle gadget of Fig. 4 (parameterised by # triangles k, tail length).
// Each triangle T_i has nodes a_i, b_i, c_i. Triangles chained via a_{i+1}=c_i.
// b_i grows an infinite (finite-truncated) path w_i^1, w_i^2, ... each with
// a leaf attached. Leaves attached to a_1 (root v) and c_k (node u).
// We pick the simple "p,q,r = 0,1,2" labelling for T_1..T_6 and
// "[a_i,q,p,b_i], [b_i,q,p,c_i], [c_i,q,p,a_i]" for the others.
// ------------------------------------------------------------------
function triangleGadget({ k, tailLen }) {
    const node = { count: 0 };
    const id = () => node.count++;
    const A = [], B = [], C = [], W = []; // W[i] is an array of w_i^j ids
    const leaves = {}; // {nodeId: leafId}
    const edges = [];

    const rootLeaf = id();          // v (leaf at a_1)
    const a1 = id(); A.push(a1);
    for (let i = 0; i < k; i++) {
        if (i > 0) A.push(id());   // a_{i+1} appended
        B.push(id());
        C.push(id());
    }
    const tailLeaf = id();          // u (leaf at c_k)

    // Triangle edges. For i=0..min(k,6)-1 we use the "all 6 orderings" scheme
    // but we just deterministically pick one ordering per triangle so the
    // simulator stays tractable. Orderings rotate (p,q,r) through the 6
    // permutations of {0,1,2}.
    const perms = [
        [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
    ];

    for (let i = 0; i < k; i++) {
        const a = A[i], b = B[i], c = C[i];
        if (i < 6) {
            const [p, q, r] = perms[i];
            // [a_i,q,p,b_i], [b_i,r,p,c_i], [c_i,q,r,a_i]
            edges.push({ u: a, v: b, portU: q, portV: p });
            edges.push({ u: b, v: c, portU: r, portV: p });
            edges.push({ u: c, v: a, portU: q, portV: r });
        } else {
            const [p, q] = [0, 1]; // any p≠q
            edges.push({ u: a, v: b, portU: q, portV: p });
            edges.push({ u: b, v: c, portU: q, portV: p });
            edges.push({ u: c, v: a, portU: q, portV: p });
        }
        // chain via a_{i+1} = c_i (we keep them as separate nodes connected by
        // a degree-2 edge for visual clarity; the paper identifies them).
        if (i + 1 < k) {
            edges.push({ u: c, v: A[i + 1], portU: -1, portV: -1 }); // ports computed later
        }
    }

    // assign default ports to chain edges and tail leaves where we left -1.
    // For chain c_i — a_{i+1}: pick the lowest unused port at each end.
    const portsUsed = Array.from({ length: node.count }, () => new Set());
    for (const e of edges) {
        if (e.portU >= 0) portsUsed[e.u].add(e.portU);
        if (e.portV >= 0) portsUsed[e.v].add(e.portV);
    }
    function lowestFree(n) {
        let p = 0;
        while (portsUsed[n].has(p)) p++;
        portsUsed[n].add(p);
        return p;
    }
    for (const e of edges) {
        if (e.portU < 0) e.portU = lowestFree(e.u);
        if (e.portV < 0) e.portV = lowestFree(e.v);
    }

    // root leaf attached to a_1, tail leaf attached to c_k
    edges.push({ u: rootLeaf, v: A[0], portU: 0, portV: lowestFree(A[0]) });
    edges.push({ u: tailLeaf, v: C[k - 1], portU: 0, portV: lowestFree(C[k - 1]) });
    leaves[A[0]] = rootLeaf;
    leaves[C[k - 1]] = tailLeaf;

    // tails w_i^1..w_i^tailLen with leaves on each
    for (let i = 0; i < k; i++) {
        const tail = [];
        let prev = B[i];
        let prevPort = lowestFree(B[i]); // port at b_i toward w_i^1
        for (let j = 0; j < tailLen; j++) {
            const w = id();
            portsUsed.push(new Set());
            tail.push(w);
            edges.push({ u: prev, v: w, portU: prevPort, portV: 0 });
            portsUsed[w].add(0);
            // leaf
            const leaf = id();
            portsUsed.push(new Set());
            edges.push({ u: w, v: leaf, portU: 1, portV: 0 });
            portsUsed[w].add(1);
            prev = w;
            prevPort = 2;
        }
        W.push(tail);
    }

    // positions: layout in horizontal chain
    const positions = {};
    const xs = i => 120 + i * 140;
    positions[rootLeaf] = { x: 0, y: 0 };
    for (let i = 0; i < k; i++) {
        positions[A[i]] = { x: xs(i), y: 0 };
        positions[B[i]] = { x: xs(i) + 50, y: -60 };
        positions[C[i]] = { x: xs(i) + 100, y: 0 };
        W[i].forEach((w, j) => {
            positions[w] = { x: xs(i) + 50, y: -120 - j * 60 };
        });
    }
    positions[tailLeaf] = { x: xs(k - 1) + 180, y: 0 };

    return fromPortedEdges(node.count, edges, "preset", positions, rootLeaf);
}
