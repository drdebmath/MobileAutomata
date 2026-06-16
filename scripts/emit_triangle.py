import json

def generate_triangular_graph(opts=None):
    opts = opts or {}
    SPINE_X_STEP = opts.get('SPINE_X_STEP', 80)
    TRIANGLE_WIDTH = opts.get('TRIANGLE_WIDTH', 60)
    TRIANGLE_HEIGHT = opts.get('TRIANGLE_HEIGHT', 100)
    ANTENNA_DEPTH = opts.get('ANTENNA_DEPTH', 3)
    ANTENNA_X_STEP = opts.get('ANTENNA_X_STEP', 40)
    ANTENNA_Y_STEP = opts.get('ANTENNA_Y_STEP', 30)
    LEAF_OFFSET = opts.get('LEAF_OFFSET', 20)
    TURN_SEGMENTS = opts.get('TURN_SEGMENTS', 6)
    TURN_DROP = opts.get('TURN_DROP', 200)
    TURN_RIGHT_OFFSET = opts.get('TURN_RIGHT_OFFSET', 40)

    TOP_Y = opts.get('TOP_Y', 200)
    BOTTOM_Y = opts.get('BOTTOM_Y', 400)
    START_X = opts.get('START_X', 10)
    GADGETS = opts.get('GADGETS', 9)

    nodes = []
    links = []
    label_counter = 0
    def next_label():
        nonlocal label_counter
        v = label_counter % 3
        label_counter += 1
        return v

    def add_node(id, x, y, label=None, meta=None):
        n = {'id': str(id), 'x': x, 'y': y}
        if label is not None:
            n['label'] = str(label)
        if meta:
            n.update(meta)
        nodes.append(n)

    def add_link(s, t):
        links.append({'source': str(s), 'target': str(t), 'label': next_label()})

    # root v
    add_node('v', START_X, TOP_Y, 'v')

    topA = []
    topB = []
    topC = []
    firstA_X = START_X + SPINE_X_STEP
    for i in range(GADGETS):
        aX = firstA_X + i * (TRIANGLE_WIDTH + SPINE_X_STEP)
        cX = aX + TRIANGLE_WIDTH
        aId = f'a_t{i+1}'
        cId = f'c_t{i+1}'
        bId = f'b_t{i+1}'
        add_node(aId, aX, TOP_Y, aId)
        add_node(cId, cX, TOP_Y, cId)
        add_node(bId, (aX + cX) / 2, TOP_Y - TRIANGLE_HEIGHT, bId)
        topA.append(aId); topB.append(bId); topC.append(cId)

    add_link('v', topA[0])
    for i in range(GADGETS):
        add_link(topA[i], topC[i])
        add_link(topA[i], topB[i])
        add_link(topB[i], topC[i])
        if i < GADGETS - 1:
            add_link(topC[i], topA[i+1])

    # antennae
    def find_node(nid):
        for n in nodes:
            if n['id'] == nid:
                return n
        return None

    for i in range(GADGETS):
        prev = topB[i]
        base = find_node(prev)
        baseX = base['x']; baseY = base['y']
        for d in range(1, ANTENNA_DEPTH+1):
            wId = f'w_t{i+1}_{d}'
            wX = baseX + d * ANTENNA_X_STEP
            wY = baseY - d * ANTENNA_Y_STEP
            add_node(wId, wX, wY, wId)
            add_link(prev, wId)
            leafId = f'leaf_t{i+1}_{d}'
            add_node(leafId, wX + LEAF_OFFSET, wY, leafId)
            add_link(wId, leafId)
            prev = wId

    lastTopC = topC[-1]
    lastTopX = find_node(lastTopC)['x']
    turnNodes = []
    for s in range(TURN_SEGMENTS):
        tX = lastTopX + TURN_RIGHT_OFFSET + s * (TURN_RIGHT_OFFSET / TURN_SEGMENTS)
        tY = TOP_Y + round((s+1) * (TURN_DROP / TURN_SEGMENTS))
        tId = f'turn_{s+1}'
        add_node(tId, tX, tY, None)
        turnNodes.append(tId)

    add_link(lastTopC, turnNodes[0])
    for i in range(len(turnNodes)-1):
        add_link(turnNodes[i], turnNodes[i+1])

    bottomA = []; bottomB = []; bottomC = []
    bottomStartX = find_node(turnNodes[-1])['x'] + TURN_RIGHT_OFFSET
    for i in range(GADGETS):
        aX = bottomStartX - i * (TRIANGLE_WIDTH + SPINE_X_STEP) - TRIANGLE_WIDTH
        cX = aX + TRIANGLE_WIDTH
        aId = f'a_b{i+1}'; cId = f'c_b{i+1}'; bId = f'b_b{i+1}'
        add_node(aId, aX, BOTTOM_Y, aId)
        add_node(cId, cX, BOTTOM_Y, cId)
        add_node(bId, (aX + cX) / 2, BOTTOM_Y + TRIANGLE_HEIGHT, bId)
        bottomA.append(aId); bottomB.append(bId); bottomC.append(cId)

    add_link(turnNodes[-1], bottomA[0])
    for i in range(GADGETS):
        add_link(bottomA[i], bottomC[i])
        add_link(bottomA[i], bottomB[i])
        add_link(bottomB[i], bottomC[i])
        if i < GADGETS - 1:
            add_link(bottomC[i], bottomA[i+1])

    for i in range(GADGETS):
        prev = bottomB[i]
        base = find_node(prev)
        baseX = base['x']; baseY = base['y']
        for d in range(1, ANTENNA_DEPTH+1):
            wId = f'w_b{i+1}_{d}'
            wX = baseX + d * ANTENNA_X_STEP
            wY = baseY + d * ANTENNA_Y_STEP
            add_node(wId, wX, wY, wId)
            add_link(prev, wId)
            leafId = f'leaf_b{i+1}_{d}'
            add_node(leafId, wX + LEAF_OFFSET, wY, leafId)
            add_link(wId, leafId)
            prev = wId

    lastBottomC = bottomC[-1]
    uX = find_node(lastBottomC)['x'] - SPINE_X_STEP
    add_node('u', uX, BOTTOM_Y, 'u')
    add_link(lastBottomC, 'u')

    return {'nodes': nodes, 'links': links}

if __name__ == '__main__':
    G = generate_triangular_graph()
    print(json.dumps(G, indent=2))
