import json
with open('scripts/triangle_output.json', 'r', encoding='utf-16') as f:
    data = json.load(f)
with open('scripts/triangle_output_utf8.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
print('Converted to scripts/triangle_output_utf8.json')
