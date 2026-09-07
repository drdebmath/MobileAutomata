const FIELDS = ["input", "node", "entry", "status", "action", "exit", "carried", "placed"];

export function createDashboard() {
    const els = Object.fromEntries(FIELDS.map(f => [f, document.getElementById(`disp-${f}`)]));

    function set(values) {
        for (const [k, v] of Object.entries(values)) {
            if (els[k]) els[k].innerText = String(v);
        }
    }

    function clear() {
        FIELDS.forEach(f => { if (els[f]) els[f].innerText = "-"; });
    }

    return { set, clear };
}
