import json
from collections import defaultdict

with open('c:/Users/sumit/Desktop/PS-ELECTION POLL PROGRESS/booths_master.json', encoding='utf-8') as f:
    booths = json.load(f)

zones = defaultdict(lambda: {'name': '', 'magistrate': '', 'mobile': '', 'booths': [], 'voters': 0})
for b in booths:
    z = b['zone']
    zones[z]['name'] = b['zone_name']
    zones[z]['magistrate'] = b['zonal_magistrate']
    zones[z]['mobile'] = b['magistrate_mobile']
    zones[z]['booths'].append(b['booth_no'])
    zones[z]['voters'] += b['voters']

sorted_keys = sorted(list(zones.keys()), key=lambda x: int(x.replace('Zone-', '')) if 'Zone-' in x else 99)

result = []
for zk in sorted_keys:
    zd = zones[zk]
    result.append({
        'zone_id': zk,
        'name': zd['name'],
        'magistrate': zd['magistrate'],
        'mobile': zd['mobile'],
        'booth_count': len(zd['booths']),
        'booths_range': f"{zd['booths'][0]} से {zd['booths'][-1]}",
        'booths_list': zd['booths'],
        'voters': zd['voters']
    })

with open('c:/Users/sumit/Desktop/PS-ELECTION POLL PROGRESS/zones_master.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Generated zones_master.json with {len(result)} zones.")
for r in result:
    print(f"{r['zone_id']}: {r['name']} | Mag: {r['magistrate']} ({r['mobile']}) | Booths: {r['booth_count']} ({r['booths_range']}) | Voters: {r['voters']}")
