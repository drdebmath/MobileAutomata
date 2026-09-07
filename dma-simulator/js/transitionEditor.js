// Renders an editable view of the DMA's transition function Φ.

import { allKeys, parseKey, key } from "./strategies.js";

const ACTIONS = ["abstain", "drop", "pick"];

export function renderTransitionEditor(container, phi, degrees, onChange) {
    container.innerHTML = "";
    if (degrees.length === 0) {
        container.textContent = "(build a graph first)";
        return;
    }

    // Start row.
    const startWrap = document.createElement("div");
    startWrap.className = "trans-row";
    const startLabel = document.createElement("span");
    startLabel.className = "trans-input";
    startLabel.textContent = "(⊥, ξ)";
    const startAction = makeActionSelect(phi.start.action);
    const startPort = makePortInput(phi.start.port);
    startAction.addEventListener("change", () => {
        phi.start.action = startAction.value;
        onChange();
    });
    startPort.addEventListener("change", () => {
        phi.start.port = Number(startPort.value);
        onChange();
    });
    startWrap.append(startLabel, document.createTextNode("→"), startPort, startAction);
    container.appendChild(startWrap);

    const sortedKeys = allKeys(degrees).sort((a, b) => {
        const A = parseKey(a), B = parseKey(b);
        if (A.d !== B.d) return A.d - B.d;
        if (A.p !== B.p) return A.p - B.p;
        return A.b.localeCompare(B.b);
    });

    let lastDegree = null;
    for (const k of sortedKeys) {
        const { d, p, b } = parseKey(k);
        if (d !== lastDegree) {
            lastDegree = d;
            const sep = document.createElement("div");
            sep.className = "trans-degree-sep";
            sep.textContent = `degree ${d}`;
            container.appendChild(sep);
        }
        const op = phi.trans[k] ?? { action: "abstain", port: (p + 1) % d };
        phi.trans[k] = op;

        const row = document.createElement("div");
        row.className = "trans-row";
        const input = document.createElement("span");
        input.className = "trans-input";
        input.textContent = `(${p}, ${d}, ${b})`;
        const portSel = makePortInput(op.port, d);
        const actSel = makeActionSelect(op.action);
        portSel.addEventListener("change", () => {
            op.port = Number(portSel.value);
            onChange();
        });
        actSel.addEventListener("change", () => {
            op.action = actSel.value;
            onChange();
        });
        row.append(input, document.createTextNode("→"), portSel, actSel);
        container.appendChild(row);
    }
}

function makeActionSelect(current) {
    const sel = document.createElement("select");
    for (const a of ACTIONS) {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        if (a === current) opt.selected = true;
        sel.appendChild(opt);
    }
    return sel;
}

function makePortInput(current, maxExclusive) {
    const input = document.createElement("input");
    input.type = "number";
    input.value = current;
    input.min = 0;
    if (maxExclusive !== undefined) input.max = maxExclusive - 1;
    input.className = "trans-port";
    return input;
}

export function collectDegrees(adj) {
    const set = new Set();
    for (const row of adj) set.add(row.length);
    return [...set].sort((a, b) => a - b);
}
