// Cytoscape rendering of the rooted graph with port-labelled edges,
// a pebble overlay, and an agent class on the current node.

const STYLE = [
    {
        selector: "node",
        style: {
            "background-color": "#ecf0f1",
            "border-color": "#95a5a6",
            "border-width": 2,
            "label": "data(id)",
            "color": "#2c3e50",
            "font-weight": "bold",
            "font-size": 12,
            "text-valign": "center",
            "text-halign": "center",
            "width": 30,
            "height": 30,
        },
    },
    {
        selector: "node.pebble",
        style: {
            "border-color": "#f39c12",
            "border-width": 5,
        },
    },
    {
        selector: "node.agent",
        style: {
            "background-color": "#e74c3c",
            "color": "white",
        },
    },
    {
        selector: "node.root",
        style: {
            "background-color": "#27ae60",
            "color": "white",
        },
    },
    {
        selector: "node.root.agent",
        style: {
            "background-color": "#e74c3c",
        },
    },
    {
        selector: "edge",
        style: {
            "line-color": "#bdc3c7",
            "width": 2,
            "curve-style": "bezier",
            "source-label": "data(portU)",
            "target-label": "data(portV)",
            "source-text-offset": 18,
            "target-text-offset": 18,
            "font-size": 10,
            "color": "#e67e22",
            "text-background-color": "white",
            "text-background-opacity": 0.85,
            "text-background-padding": 1,
        },
    },
];

export function createVisualization(container, graph) {
    const { nodes, edges, rootId, layoutHint, positions } = graph;

    const elements = [
        ...nodes.map(n => ({
            data: { id: String(n.id) },
            position: positions && positions[n.id] ? { ...positions[n.id] } : undefined,
        })),
        ...edges.map((e, i) => ({
            data: {
                id: `e${i}`,
                source: String(e.u),
                target: String(e.v),
                portU: e.portU,
                portV: e.portV,
            },
        })),
    ];

    const layout = pickLayout(layoutHint, positions);

    const cy = cytoscape({
        container,
        elements,
        style: STYLE,
        layout,
        wheelSensitivity: 0.2,
    });

    cy.getElementById(String(rootId)).addClass("root");

    let agentId = null;

    function setAgentNode(id) {
        if (agentId !== null) cy.getElementById(String(agentId)).removeClass("agent");
        agentId = id;
        cy.getElementById(String(id)).addClass("agent");
    }

    function setPebble(nodeId, hasPebble) {
        const el = cy.getElementById(String(nodeId));
        if (hasPebble) el.addClass("pebble"); else el.removeClass("pebble");
    }

    function syncPebbles(nodesArr) {
        for (const n of nodesArr) setPebble(n.id, n.hasPebble);
    }

    function destroy() { cy.destroy(); }

    return { setAgentNode, setPebble, syncPebbles, destroy };
}

function pickLayout(hint, positions) {
    if (positions && Object.keys(positions).length > 0) {
        return { name: "preset" };
    }
    switch (hint) {
        case "circle": return { name: "circle" };
        case "tree": return { name: "breadthfirst", spacingFactor: 1.2 };
        case "preset": return { name: "preset" };
        default: return { name: "cose", animate: false, idealEdgeLength: 90 };
    }
}
