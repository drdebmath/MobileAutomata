from scripts.emit_triangle import generate_triangular_graph
import json
G = generate_triangular_graph()
with open('scripts/triangle_output_utf8.json','w', encoding='utf-8') as f:
    json.dump(G, f, indent=2)
print('WROTE scripts/triangle_output_utf8.json')
