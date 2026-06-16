// generateTriangularGadgetGraph.js
// Produces a graph with a top spine of triangular gadgets, a curved turn,
// and a bottom spine mirrored and reversed. Every link receives a numeric
// label in a repeating 0,1,2 cycle. Coordinates (x,y) are computed here
// so the layout can be rendered without a layout engine.

export function generateTriangularGadgetGraph(opts = {}) {
    const G = {
        nodes: [],
        links: [],
    };

    // --- tunable spacing constants ---
    const SPINE_X_STEP = opts.SPINE_X_STEP ?? 80;        // horizontal spacing between triangles
    const TRIANGLE_WIDTH = opts.TRIANGLE_WIDTH ?? 60;    // horizontal span of a single triangle (a -> c)
    const TRIANGLE_HEIGHT = opts.TRIANGLE_HEIGHT ?? 100; // vertical offset for the peak b
    const ANTENNA_DEPTH = opts.ANTENNA_DEPTH ?? 3;       // number of w nodes per antenna
    const ANTENNA_X_STEP = opts.ANTENNA_X_STEP ?? 40;    // x step for antenna nodes
    const ANTENNA_Y_STEP = opts.ANTENNA_Y_STEP ?? 30;    // y step (diagonal) for antenna nodes
    const LEAF_OFFSET = opts.LEAF_OFFSET ?? 20;          // horizontal offset for leaf nodes
    const TURN_SEGMENTS = opts.TURN_SEGMENTS ?? 6;       // hidden nodes used to curve from top to bottom
    const TURN_DROP = opts.TURN_DROP ?? 200;             // how much y increases during the turn
    const TURN_RIGHT_OFFSET = opts.TURN_RIGHT_OFFSET ?? 40;

    const TOP_Y = opts.TOP_Y ?? 200;
    const BOTTOM_Y = opts.BOTTOM_Y ?? 400;
    const START_X = opts.START_X ?? 10;
    const TOP_GADGETS = 6; // top row triangles a1..a6
    const BOTTOM_GADGETS = 3; // bottom row triangles a7..a9

    let labelCounter = 0;
    function nextLabel() { return labelCounter++ % 3; }

    // helper to add node and link
    function addNode(id, x, y, label = null, meta = {}) {
        const n = { id: String(id), x, y };
        if (label !== null) n.label = String(label);
        Object.assign(n, meta);
        G.nodes.push(n);
        return n;
    }

    function addLink(source, target) {
        const l = { source: String(source), target: String(target), label: nextLabel() };
        G.links.push(l);
        return l;
    }

    // Root start node v
    const vId = 'v';
    addNode(vId, START_X, TOP_Y, 'v');

    // Top row gadgets: produce a_i, b_i, c_i for i=1..TOP_GADGETS
    const topA = [];
    const topB = [];
    const topC = [];

    // We'll place a_1 at START_X + one SPINE_X_STEP to leave space for v
    const firstA_X = START_X + SPINE_X_STEP;
    for (let i = 0; i < TOP_GADGETS; i++) {
        const aX = firstA_X + i * (TRIANGLE_WIDTH + SPINE_X_STEP);
        const cX = aX + TRIANGLE_WIDTH;
        const aId = `a_t${i+1}`;
        const cId = `c_t${i+1}`;
        const bId = `b_t${i+1}`;
        addNode(aId, aX, TOP_Y, aId);
        addNode(cId, cX, TOP_Y, cId);
        addNode(bId, (aX + cX) / 2, TOP_Y - TRIANGLE_HEIGHT, bId);
        topA.push(aId); topB.push(bId); topC.push(cId);
    }

    // Connect root v to a_1
    addLink(vId, topA[0]);

    // Top gadget edges and spine links
    for (let i = 0; i < TOP_GADGETS; i++) {
        addLink(topA[i], topC[i]); // base edge along spine
        addLink(topA[i], topB[i]); // left leg
        addLink(topB[i], topC[i]); // right leg
        if (i < TOP_GADGETS - 1) addLink(topC[i], topA[i+1]); // spine connection
    }

    // Antennae from each b_i (top row) with leaf nodes
    for (let i = 0; i < TOP_GADGETS; i++) {
        let prev = topB[i];
        let baseX = (G.nodes.find(n => n.id === prev).x);
        let baseY = (G.nodes.find(n => n.id === prev).y);
        for (let d = 1; d <= ANTENNA_DEPTH; d++) {
            const wId = `w_t${i+1}_${d}`;
            const wX = baseX + d * ANTENNA_X_STEP;
            const wY = baseY - d * ANTENNA_Y_STEP;
            addNode(wId, wX, wY, wId);
            addLink(prev, wId);
            // leaf node attached horizontally to the right
            const leafId = `leaf_t${i+1}_${d}`;
            addNode(leafId, wX + LEAF_OFFSET, wY, leafId);
            addLink(wId, leafId);
            prev = wId;
        }
    }

    // Create a direct connection from the last top gadget to the first bottom gadget,
    // removing the intermediate turn nodes.
    const lastTopC = topC[topC.length - 1];
    const lastTopX = G.nodes.find(n => n.id === lastTopC).x;

    // Bottom row gadgets: place a7..a9 right-to-left
    const bottomA = [];
    const bottomB = [];
    const bottomC = [];

    // bottomStartX slightly to the right of the last top C node
    const bottomStartX = lastTopX + TURN_RIGHT_OFFSET;
    for (let i = 0; i < BOTTOM_GADGETS; i++) {
        const aIndex = TOP_GADGETS + i + 1;
        const aX = bottomStartX - i * (TRIANGLE_WIDTH + SPINE_X_STEP) - TRIANGLE_WIDTH;
        const cX = aX + TRIANGLE_WIDTH;
        const aId = `a${aIndex}`;
        const cId = `c${aIndex}`;
        const bId = `b${aIndex}`;
        addNode(aId, aX, BOTTOM_Y, aId);
        addNode(cId, cX, BOTTOM_Y, cId);
        addNode(bId, (aX + cX) / 2, BOTTOM_Y + TRIANGLE_HEIGHT, bId);
        bottomA.push(aId); bottomB.push(bId); bottomC.push(cId);
    }

    // connect the last top C directly to first bottom A (a7)
    addLink(lastTopC, bottomA[0]);

    // bottom gadget edges and spine links (right-to-left)
    for (let i = 0; i < BOTTOM_GADGETS; i++) {
        addLink(bottomA[i], bottomC[i]);
        addLink(bottomA[i], bottomB[i]);
        addLink(bottomB[i], bottomC[i]);
        if (i < BOTTOM_GADGETS - 1) addLink(bottomC[i], bottomA[i+1]);
    }

    // Antennae from bottom b nodes (down-right)
    for (let i = 0; i < BOTTOM_GADGETS; i++) {
        let prev = bottomB[i];
        let baseX = (G.nodes.find(n => n.id === prev).x);
        let baseY = (G.nodes.find(n => n.id === prev).y);
        for (let d = 1; d <= ANTENNA_DEPTH; d++) {
            const wId = `w_b${i+1}_${d}`;
            const wX = baseX + d * ANTENNA_X_STEP;
            const wY = baseY + d * ANTENNA_Y_STEP;
            addNode(wId, wX, wY, wId);
            addLink(prev, wId);
            const leafId = `leaf_b${i+1}_${d}`;
            addNode(leafId, wX + LEAF_OFFSET, wY, leafId);
            addLink(wId, leafId);
            prev = wId;
        }
    }

    // Final terminal node u on the far left (end of bottom spine)
    const lastBottomC = bottomC[bottomC.length - 1];
    const uId = 'u';
    addNode(uId, G.nodes.find(n => n.id === lastBottomC).x - SPINE_X_STEP, BOTTOM_Y, 'u');
    addLink(lastBottomC, uId);

    return G;
}

export default generateTriangularGadgetGraph;
