import openpyxl
import json
import urllib.request
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

excel_path = r'C:\Users\sumit\Downloads\Panchayat_Poll_Progress_System_2026.xlsx'
wb = openpyxl.load_workbook(excel_path, data_only=True)
sheet = wb['22-OCT_BOOTH_ENTRY']

updates = []
summary = {
    'total_v10': 0,
    'filled_count': 0,
    'empty_count': 0,
    'empty_booths': []
}

for r in range(5, 157):
    booth_no = sheet.cell(r, 5).value
    if booth_no is not None:
        b_str = str(booth_no).strip()
        if b_str.endswith('.0'):
            b_str = b_str[:-2]

        v10 = sheet.cell(r, 12).value
        v10_val = ''
        if v10 is not None and str(v10).strip() != '':
            try:
                v10_val = int(float(v10))
                summary['total_v10'] += v10_val
                summary['filled_count'] += 1
            except Exception:
                v10_val = str(v10).strip()
        else:
            summary['empty_count'] += 1
            summary['empty_booths'].append(b_str)

        updates.append({
            'id': b_str,
            'started': True,
            'mock_done': True,
            'v10': v10_val,
            'remark': 'शांतिपूर्ण'
        })

print(f"Prepared updates for {len(updates)} booths.")
print(f"Filled: {summary['filled_count']}, Empty: {summary['empty_count']}, Total 10 AM votes: {summary['total_v10']}")
print(f"Empty booth numbers: {summary['empty_booths']}")

# 1. Update election_data_store.json directly
store_path = 'election_data_store.json'
with open(store_path, 'r', encoding='utf-8') as f:
    store = json.load(f)

dateKey = '22-10-2026'
if 'dates' in store and dateKey in store['dates']:
    for u in updates:
        bid = u['id']
        if bid in store['dates'][dateKey]:
            store['dates'][dateKey][bid]['v10'] = u['v10']
            store['dates'][dateKey][bid]['started'] = True
            store['dates'][dateKey][bid]['mock_done'] = True
            store['dates'][dateKey][bid]['remark'] = 'शांतिपूर्ण'

with open(store_path, 'w', encoding='utf-8') as f:
    json.dump(store, f, ensure_ascii=False, indent=2)

print("Updated election_data_store.json directly.")

# 2. Also send via POST to server if running
req_data = json.dumps({'date': dateKey, 'updates': updates}).encode('utf-8')
req = urllib.request.Request('http://localhost:3000/api/booths/bulk', data=req_data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print("Server bulk update response:", res)
except Exception as e:
    print("Server bulk update request error:", e)

# 3. Save clean import JSON
with open('votes_10am_import.json', 'w', encoding='utf-8') as f:
    json.dump({'date': dateKey, 'summary': summary, 'updates': updates}, f, ensure_ascii=False, indent=2)

print("Saved votes_10am_import.json successfully.")
