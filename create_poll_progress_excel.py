import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Load master booths data
with open('c:/Users/sumit/Desktop/PS-ELECTION POLL PROGRESS/booths_master.json', encoding='utf-8') as f:
    booths = json.load(f)

wb = openpyxl.Workbook()
# Remove default sheet
wb.remove(wb.active)

# Styles
font_title = Font(name='Arial', size=13, bold=True)
font_subtitle = Font(name='Arial', size=11, bold=True)
font_header = Font(name='Arial', size=9, bold=True)
font_col_num = Font(name='Arial', size=9, bold=True)
font_data = Font(name='Arial', size=9)
font_data_bold = Font(name='Arial', size=9, bold=True)
font_st_format = Font(name='Arial', size=11, bold=True)

thin_border = Border(
    left=Side(style='thin', color='000000'),
    right=Side(style='thin', color='000000'),
    top=Side(style='thin', color='000000'),
    bottom=Side(style='thin', color='000000')
)
thick_bottom_border = Border(
    left=Side(style='thin', color='000000'),
    right=Side(style='thin', color='000000'),
    top=Side(style='thin', color='000000'),
    bottom=Side(style='medium', color='000000')
)

fill_yellow = PatternFill(start_color='FFFF00', end_color='FFFF00', fill_type='solid')
fill_gray_header = PatternFill(start_color='F2F4F7', end_color='F2F4F7', fill_type='solid')
fill_total_row = PatternFill(start_color='E8F0FE', end_color='E8F0FE', fill_type='solid')
fill_accent_green = PatternFill(start_color='E6F4EA', end_color='E6F4EA', fill_type='solid')

align_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
align_left = Alignment(horizontal='left', vertical='center', wrap_text=True)
align_right = Alignment(horizontal='right', vertical='center', wrap_text=True)

# -------------------------------------------------------------
# 1. SHEET: 22-OCT_ZP_MEMBER_FORMAT11
# -------------------------------------------------------------
ws_zp = wb.create_sheet(title='22-OCT_ZP_MEMBER_F11')
ws_zp.views.sheetView[0].showGridLines = True

# Row 1: ST. FORMAT-11
ws_zp.cell(row=1, column=16, value='ST. FORMAT-11').font = font_st_format
ws_zp.cell(row=1, column=16).alignment = align_right

# Row 2: Title
ws_zp.merge_cells('A2:P2')
cell_t1 = ws_zp.cell(row=2, column=1, value='PANCHAYAT GENERAL ELECTION, 2026')
cell_t1.font = font_title
cell_t1.alignment = align_center

# Row 3: Subtitle
ws_zp.merge_cells('A3:P3')
cell_t2 = ws_zp.cell(row=3, column=1, value='POLLING PERCENTAGE FOR ZP MEMBER')
cell_t2.font = font_subtitle
cell_t2.alignment = align_center

# Row 4 & 5: Table Header
# Cols:
# 1: S.N. (merge A4:A5)
# 2: DISTRICT/ZP (merge B4:B5)
# 3: Total Constituencies (merge C4:C5)
# 4: Total Voters (merge D4:D5)
# 5: 7.15 A.M. Start Peaceful polling (merge E4:E5)
# 6-7: 10 A.M. (F4:G4) -> F5: Votes Polled, G5: Percentage
# 8-9: 01.00 P.M. (H4:I4) -> H5: Votes Polled, I5: Percentage
# 10-11: 3.00 P.M. (J4:K4) -> J5: Votes Polled, K5: Percentage
# 12-13: 6.00 P.M. (L4:M4) -> L5: Votes Polled, M5: Percentage
# 14-15: Final (N4:O4) -> N5: Votes Polled, O5: Percentage
# 16: Important Information if any (merge P4:P5)

ws_zp.merge_cells('A4:A5')
ws_zp.cell(row=4, column=1, value='S.N.')

ws_zp.merge_cells('B4:B5')
ws_zp.cell(row=4, column=2, value='DISTRICT/ZP')

ws_zp.merge_cells('C4:C5')
ws_zp.cell(row=4, column=3, value='Total Constituencies')

ws_zp.merge_cells('D4:D5')
ws_zp.cell(row=4, column=4, value='Total Voters')

ws_zp.merge_cells('E4:E5')
ws_zp.cell(row=4, column=5, value='7.15 A.M.\nStart Peaceful polling')

ws_zp.merge_cells('F4:G4')
ws_zp.cell(row=4, column=6, value='10 A.M.')
ws_zp.cell(row=5, column=6, value='Votes Polled')
ws_zp.cell(row=5, column=7, value='Percentage')

ws_zp.merge_cells('H4:I4')
ws_zp.cell(row=4, column=8, value='01.00 P.M.')
ws_zp.cell(row=5, column=8, value='Votes Polled')
ws_zp.cell(row=5, column=9, value='Percentage')

ws_zp.merge_cells('J4:K4')
ws_zp.cell(row=4, column=10, value='3.00 P.M.')
ws_zp.cell(row=5, column=10, value='Votes Polled')
ws_zp.cell(row=5, column=11, value='Percentage')

ws_zp.merge_cells('L4:M4')
ws_zp.cell(row=4, column=12, value='6.00 P.M.')
ws_zp.cell(row=5, column=12, value='Votes Polled')
ws_zp.cell(row=5, column=13, value='Percentage')

ws_zp.merge_cells('N4:O4')
ws_zp.cell(row=4, column=14, value='Final')
ws_zp.cell(row=5, column=14, value='Votes Polled')
ws_zp.cell(row=5, column=15, value='Percentage')

ws_zp.merge_cells('P4:P5')
ws_zp.cell(row=4, column=16, value='Important Information if any')

# Apply styles for Header Rows 4 and 5
for r in [4, 5]:
    ws_zp.row_dimensions[r].height = 26
    for c in range(1, 17):
        cell = ws_zp.cell(row=r, column=c)
        cell.font = font_header
        cell.alignment = align_center
        cell.border = thin_border
        if c in [8, 9]:
            cell.fill = fill_yellow

# Row 6: Column numbers (1 to 16)
ws_zp.row_dimensions[6].height = 18
for c in range(1, 17):
    cell = ws_zp.cell(row=6, column=c, value=c)
    cell.font = font_col_num
    cell.alignment = align_center
    cell.border = thin_border

# ZP Wards Data Rows (Z-7, Z-8, Z-9, Z-10 and District Consolidated)
zp_wards = [
    ('Z-7', 'जिला परिषद वार्ड सं. 07 (चाणौद-बाली सीमा)', 44, 42215),
    ('Z-8', 'जिला परिषद वार्ड सं. 08 (सुमेरपुर ग्रामीण)', 37, 35283),
    ('Z-9', 'जिला परिषद वार्ड सं. 09 (सांडेराव क्षेत्र)', 32, 30027),
    ('Z-10', 'जिला परिषद वार्ड सं. 10 (भारूंदा-पालड़ी)', 39, 37380),
]

current_row = 7
for idx, (ward_code, ward_desc, b_count, v_count) in enumerate(zp_wards, start=1):
    ws_zp.row_dimensions[current_row].height = 24
    ws_zp.cell(row=current_row, column=1, value=idx).alignment = align_center
    ws_zp.cell(row=current_row, column=2, value=f'PALI - {ward_code} ({ward_desc})').alignment = align_left
    ws_zp.cell(row=current_row, column=3, value=1).alignment = align_center # 1 ZP constituency
    ws_zp.cell(row=current_row, column=4, value=v_count).alignment = align_right
    ws_zp.cell(row=current_row, column=5, value="शांतिपूर्ण प्रारंभ").alignment = align_center
    
    # Formulas linked to 22-OCT_BOOTH_ENTRY
    # In Booth Entry, col I is ZP Ward, col J is Voters, col K is 10AM, col M is 1PM, col O is 3PM, col Q is 6PM, col S is Final
    ws_zp.cell(row=current_row, column=6, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$I$5:$I$156, \"{ward_code}\", '22-OCT_BOOTH_ENTRY'!$K$5:$K$156)").alignment = align_right
    ws_zp.cell(row=current_row, column=7, value=f"=IF(D{current_row}>0, ROUND((F{current_row}/D{current_row})*100, 2), 0)").alignment = align_right
    
    ws_zp.cell(row=current_row, column=8, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$I$5:$I$156, \"{ward_code}\", '22-OCT_BOOTH_ENTRY'!$M$5:$M$156)").alignment = align_right
    ws_zp.cell(row=current_row, column=9, value=f"=IF(D{current_row}>0, ROUND((H{current_row}/D{current_row})*100, 2), 0)").alignment = align_right
    
    ws_zp.cell(row=current_row, column=10, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$I$5:$I$156, \"{ward_code}\", '22-OCT_BOOTH_ENTRY'!$O$5:$O$156)").alignment = align_right
    ws_zp.cell(row=current_row, column=11, value=f"=IF(D{current_row}>0, ROUND((J{current_row}/D{current_row})*100, 2), 0)").alignment = align_right
    
    ws_zp.cell(row=current_row, column=12, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$I$5:$I$156, \"{ward_code}\", '22-OCT_BOOTH_ENTRY'!$Q$5:$Q$156)").alignment = align_right
    ws_zp.cell(row=current_row, column=13, value=f"=IF(D{current_row}>0, ROUND((L{current_row}/D{current_row})*100, 2), 0)").alignment = align_right
    
    ws_zp.cell(row=current_row, column=14, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$I$5:$I$156, \"{ward_code}\", '22-OCT_BOOTH_ENTRY'!$S$5:$S$156)").alignment = align_right
    ws_zp.cell(row=current_row, column=15, value=f"=IF(D{current_row}>0, ROUND((N{current_row}/D{current_row})*100, 2), 0)").alignment = align_right
    ws_zp.cell(row=current_row, column=16, value="शांतिपूर्ण").alignment = align_center

    for c in range(1, 17):
        cell = ws_zp.cell(row=current_row, column=c)
        cell.font = font_data
        cell.border = thin_border
        if c in [7, 9, 11, 13, 15]:
            cell.number_format = '0.00"%"'
        elif c in [4, 6, 8, 10, 12, 14]:
            cell.number_format = '#,##0'

    current_row += 1

# District Consolidated Total Row
ws_zp.row_dimensions[current_row].height = 26
ws_zp.cell(row=current_row, column=1, value='कुल योग').alignment = align_center
ws_zp.cell(row=current_row, column=2, value='PALI (SUMERPUR ZP CONSTITUENCIES TOTAL)').alignment = align_left
ws_zp.cell(row=current_row, column=3, value=f"=SUM(C7:C{current_row-1})").alignment = align_center
ws_zp.cell(row=current_row, column=4, value=f"=SUM(D7:D{current_row-1})").alignment = align_right
ws_zp.cell(row=current_row, column=5, value="100% प्रारंभ").alignment = align_center

ws_zp.cell(row=current_row, column=6, value=f"=SUM(F7:F{current_row-1})").alignment = align_right
ws_zp.cell(row=current_row, column=7, value=f"=IF(D{current_row}>0, ROUND((F{current_row}/D{current_row})*100, 2), 0)").alignment = align_right

ws_zp.cell(row=current_row, column=8, value=f"=SUM(H7:H{current_row-1})").alignment = align_right
ws_zp.cell(row=current_row, column=9, value=f"=IF(D{current_row}>0, ROUND((H{current_row}/D{current_row})*100, 2), 0)").alignment = align_right

ws_zp.cell(row=current_row, column=10, value=f"=SUM(J7:J{current_row-1})").alignment = align_right
ws_zp.cell(row=current_row, column=11, value=f"=IF(D{current_row}>0, ROUND((J{current_row}/D{current_row})*100, 2), 0)").alignment = align_right

ws_zp.cell(row=current_row, column=12, value=f"=SUM(L7:L{current_row-1})").alignment = align_right
ws_zp.cell(row=current_row, column=13, value=f"=IF(D{current_row}>0, ROUND((L{current_row}/D{current_row})*100, 2), 0)").alignment = align_right

ws_zp.cell(row=current_row, column=14, value=f"=SUM(N7:N{current_row-1})").alignment = align_right
ws_zp.cell(row=current_row, column=15, value=f"=IF(D{current_row}>0, ROUND((N{current_row}/D{current_row})*100, 2), 0)").alignment = align_right
ws_zp.cell(row=current_row, column=16, value="समस्त शांतिपूर्ण").alignment = align_center

for c in range(1, 17):
    cell = ws_zp.cell(row=current_row, column=c)
    cell.font = font_data_bold
    cell.border = thick_bottom_border
    cell.fill = fill_total_row
    if c in [7, 9, 11, 13, 15]:
        cell.number_format = '0.00"%"'
    elif c in [3, 4, 6, 8, 10, 12, 14]:
        cell.number_format = '#,##0'

# Auto column widths for ZP sheet
col_widths_zp = {1: 6, 2: 36, 3: 15, 4: 14, 5: 16, 6: 12, 7: 12, 8: 12, 9: 12, 10: 12, 11: 12, 12: 12, 13: 12, 14: 12, 15: 12, 16: 22}
for c, w in col_widths_zp.items():
    ws_zp.column_dimensions[get_column_letter(c)].width = w


# -------------------------------------------------------------
# 2. SHEET: 22-OCT_PS_MEMBER_FORMAT11
# -------------------------------------------------------------
ws_ps = wb.create_sheet(title='22-OCT_PS_MEMBER_F11')
ws_ps.views.sheetView[0].showGridLines = True

# Row 1: ST. FORMAT-11
ws_ps.cell(row=1, column=17, value='ST. FORMAT-11').font = font_st_format
ws_ps.cell(row=1, column=17).alignment = align_right

# Row 2: Title
ws_ps.merge_cells('A2:Q2')
cell_p1 = ws_ps.cell(row=2, column=1, value='PANCHAYAT GENERAL ELECTION(PS MEMBERS), 2026')
cell_p1.font = font_title
cell_p1.alignment = align_center

# Row 3: Subtitle
ws_ps.merge_cells('A3:Q3')
cell_p2 = ws_ps.cell(row=3, column=1, value='POLLING PERCENTAGE (PANCHAYAT SAMITI WISE )')
cell_p2.font = font_subtitle
cell_p2.alignment = align_center

# Row 4 & 5: Header
# 1: S.N. (A4:A5)
# 2: DISTRICT (B4:B5)
# 3: NAME OF PANCHAYAT SAMITI (C4:C5)
# 4: TOTAL CONSTITUENCIES (D4:D5)
# 5: TOTAL VOTERS (E4:E5)
# 6: 7.15 A.M. Start Peaceful polling (F4:F5)
# 7-8: 10.00 A.M. (G4:H4) -> G5: Votes Polled, H5: Percentage
# 9-10: 01.00 P.M. (I4:J4) -> I5: Votes Polled, J5: Percentage (Yellow)
# 11-12: 3.00 P.M. (K4:L4) -> K5: Votes Polled, L5: Percentage
# 13-14: 6.00 P.M. (M4:N4) -> M5: Votes Polled, N5: Percentage
# 15-16: Final (O4:P4) -> O5: Votes Polled, P5: Percentage
# 17: Important Information if any (Q4:Q5)

ws_ps.merge_cells('A4:A5')
ws_ps.cell(row=4, column=1, value='S.N.')

ws_ps.merge_cells('B4:B5')
ws_ps.cell(row=4, column=2, value='DISTRICT')

ws_ps.merge_cells('C4:C5')
ws_ps.cell(row=4, column=3, value='NAME OF\nPANCHAYAT\nSAMITI')

ws_ps.merge_cells('D4:D5')
ws_ps.cell(row=4, column=4, value='TOTAL\nCONSTITUEN\nCIES')

ws_ps.merge_cells('E4:E5')
ws_ps.cell(row=4, column=5, value='TOTAL\nVOTERS')

ws_ps.merge_cells('F4:F5')
ws_ps.cell(row=4, column=6, value='7.15 A.M.\nStart\nPeaceful\npolling')

ws_ps.merge_cells('G4:H4')
ws_ps.cell(row=4, column=7, value='10.00 A.M.')
ws_ps.cell(row=5, column=7, value='Votes\nPolled')
ws_ps.cell(row=5, column=8, value='Percentage')

ws_ps.merge_cells('I4:J4')
ws_ps.cell(row=4, column=9, value='01.00 P.M.')
ws_ps.cell(row=5, column=9, value='Votes\nPolled')
ws_ps.cell(row=5, column=10, value='Percentage')

ws_ps.merge_cells('K4:L4')
ws_ps.cell(row=4, column=11, value='3.00 P.M.')
ws_ps.cell(row=5, column=11, value='Votes\nPolled')
ws_ps.cell(row=5, column=12, value='Percentage')

ws_ps.merge_cells('M4:N4')
ws_ps.cell(row=4, column=13, value='6.00 P.M.')
ws_ps.cell(row=5, column=13, value='Votes\nPolled')
ws_ps.cell(row=5, column=14, value='Percentage')

ws_ps.merge_cells('O4:P4')
ws_ps.cell(row=4, column=15, value='Final')
ws_ps.cell(row=5, column=15, value='Votes\nPolled')
ws_ps.cell(row=5, column=16, value='Percentage')

ws_ps.merge_cells('Q4:Q5')
ws_ps.cell(row=4, column=17, value='Important\nInformation if\nany')

for r in [4, 5]:
    ws_ps.row_dimensions[r].height = 28
    for c in range(1, 18):
        cell = ws_ps.cell(row=r, column=c)
        cell.font = font_header
        cell.alignment = align_center
        cell.border = thin_border
        if c in [9, 10]:
            cell.fill = fill_yellow

# Row 6: Column Numbers (1 to 17)
ws_ps.row_dimensions[6].height = 18
for c in range(1, 18):
    cell = ws_ps.cell(row=6, column=c, value=c)
    cell.font = font_col_num
    cell.alignment = align_center
    cell.border = thin_border

# Main Consolidated Row for SUMERPUR Panchayat Samiti
ws_ps.row_dimensions[7].height = 26
ws_ps.cell(row=7, column=1, value=1).alignment = align_center
ws_ps.cell(row=7, column=2, value='PALI').alignment = align_center
ws_ps.cell(row=7, column=3, value='SUMERPUR').alignment = align_center
ws_ps.cell(row=7, column=4, value=21).alignment = align_center # 21 PS Wards
ws_ps.cell(row=7, column=5, value=144905).alignment = align_right
ws_ps.cell(row=7, column=6, value='हाँ (समस्त 152 बूथ)').alignment = align_center

# Formulas linked to 22-OCT_BOOTH_ENTRY
ws_ps.cell(row=7, column=7, value="=SUM('22-OCT_BOOTH_ENTRY'!$K$5:$K$156)").alignment = align_right
ws_ps.cell(row=7, column=8, value="=IF(E7>0, ROUND((G7/E7)*100, 2), 0)").alignment = align_right

ws_ps.cell(row=7, column=9, value="=SUM('22-OCT_BOOTH_ENTRY'!$M$5:$M$156)").alignment = align_right
ws_ps.cell(row=7, column=10, value="=IF(E7>0, ROUND((I7/E7)*100, 2), 0)").alignment = align_right

ws_ps.cell(row=7, column=11, value="=SUM('22-OCT_BOOTH_ENTRY'!$O$5:$O$156)").alignment = align_right
ws_ps.cell(row=7, column=12, value="=IF(E7>0, ROUND((K7/E7)*100, 2), 0)").alignment = align_right

ws_ps.cell(row=7, column=13, value="=SUM('22-OCT_BOOTH_ENTRY'!$Q$5:$Q$156)").alignment = align_right
ws_ps.cell(row=7, column=14, value="=IF(E7>0, ROUND((M7/E7)*100, 2), 0)").alignment = align_right

ws_ps.cell(row=7, column=15, value="=SUM('22-OCT_BOOTH_ENTRY'!$S$5:$S$156)").alignment = align_right
ws_ps.cell(row=7, column=16, value="=IF(E7>0, ROUND((O7/E7)*100, 2), 0)").alignment = align_right
ws_ps.cell(row=7, column=17, value='शांतिपूर्ण मतदान गतिमान').alignment = align_center

for c in range(1, 18):
    cell = ws_ps.cell(row=7, column=c)
    cell.font = font_data_bold
    cell.border = thick_bottom_border
    cell.fill = fill_accent_green
    if c in [8, 10, 12, 14, 16]:
        cell.number_format = '0.00"%"'
    elif c in [4, 5, 7, 9, 11, 13, 15]:
        cell.number_format = '#,##0'

# Ward-Wise Breakdown Rows (W-1 to W-21)
# Group voters per PS Ward from master
from collections import defaultdict
ps_ward_voters = defaultdict(int)
for b in booths:
    ps_ward_voters[b['ps_ward']] += b['voters']

sorted_wards = sorted(list(ps_ward_voters.keys()), key=lambda x: int(x.replace('W-', '')) if x.startswith('W-') else 999)

# Subheader for Ward-wise Details
ws_ps.merge_cells('A9:Q9')
subh = ws_ps.cell(row=9, column=1, value='पंचायत समिति सुमेरपुर - वार्ड वार विवरण (WARD WISE BREAKUP)')
subh.font = font_subtitle
subh.alignment = align_center
subh.fill = fill_gray_header
ws_ps.row_dimensions[9].height = 22

row_idx = 10
for w_idx, ward in enumerate(sorted_wards, start=1):
    ws_ps.row_dimensions[row_idx].height = 22
    ws_ps.cell(row=row_idx, column=1, value=w_idx).alignment = align_center
    ws_ps.cell(row=row_idx, column=2, value='PALI').alignment = align_center
    ws_ps.cell(row=row_idx, column=3, value=f'SUMERPUR ({ward})').alignment = align_left
    ws_ps.cell(row=row_idx, column=4, value=1).alignment = align_center
    ws_ps.cell(row=row_idx, column=5, value=ps_ward_voters[ward]).alignment = align_right
    ws_ps.cell(row=row_idx, column=6, value='हाँ').alignment = align_center
    
    # Formulas linked to 22-OCT_BOOTH_ENTRY by PS Ward (col H)
    ws_ps.cell(row=row_idx, column=7, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$H$5:$H$156, \"{ward}\", '22-OCT_BOOTH_ENTRY'!$K$5:$K$156)").alignment = align_right
    ws_ps.cell(row=row_idx, column=8, value=f"=IF(E{row_idx}>0, ROUND((G{row_idx}/E{row_idx})*100, 2), 0)").alignment = align_right
    
    ws_ps.cell(row=row_idx, column=9, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$H$5:$H$156, \"{ward}\", '22-OCT_BOOTH_ENTRY'!$M$5:$M$156)").alignment = align_right
    ws_ps.cell(row=row_idx, column=10, value=f"=IF(E{row_idx}>0, ROUND((I{row_idx}/E{row_idx})*100, 2), 0)").alignment = align_right
    
    ws_ps.cell(row=row_idx, column=11, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$H$5:$H$156, \"{ward}\", '22-OCT_BOOTH_ENTRY'!$O$5:$O$156)").alignment = align_right
    ws_ps.cell(row=row_idx, column=12, value=f"=IF(E{row_idx}>0, ROUND((K{row_idx}/E{row_idx})*100, 2), 0)").alignment = align_right
    
    ws_ps.cell(row=row_idx, column=13, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$H$5:$H$156, \"{ward}\", '22-OCT_BOOTH_ENTRY'!$Q$5:$Q$156)").alignment = align_right
    ws_ps.cell(row=row_idx, column=14, value=f"=IF(E{row_idx}>0, ROUND((M{row_idx}/E{row_idx})*100, 2), 0)").alignment = align_right
    
    ws_ps.cell(row=row_idx, column=15, value=f"=SUMIF('22-OCT_BOOTH_ENTRY'!$H$5:$H$156, \"{ward}\", '22-OCT_BOOTH_ENTRY'!$S$5:$S$156)").alignment = align_right
    ws_ps.cell(row=row_idx, column=16, value=f"=IF(E{row_idx}>0, ROUND((O{row_idx}/E{row_idx})*100, 2), 0)").alignment = align_right
    ws_ps.cell(row=row_idx, column=17, value='शांतिपूर्ण').alignment = align_center

    for c in range(1, 18):
        cell = ws_ps.cell(row=row_idx, column=c)
        cell.font = font_data
        cell.border = thin_border
        if c in [8, 10, 12, 14, 16]:
            cell.number_format = '0.00"%"'
        elif c in [4, 5, 7, 9, 11, 13, 15]:
            cell.number_format = '#,##0'

    row_idx += 1

# Col widths for PS
col_widths_ps = {1: 6, 2: 12, 3: 20, 4: 15, 5: 14, 6: 14, 7: 12, 8: 12, 9: 12, 10: 12, 11: 12, 12: 12, 13: 12, 14: 12, 15: 12, 16: 12, 17: 22}
for c, w in col_widths_ps.items():
    ws_ps.column_dimensions[get_column_letter(c)].width = w


# -------------------------------------------------------------
# 3. SHEET: 22-OCT_BOOTH_ENTRY (Detailed Booths Entry for PS & ZP)
# -------------------------------------------------------------
ws_b22 = wb.create_sheet(title='22-OCT_BOOTH_ENTRY')
ws_b22.views.sheetView[0].showGridLines = True

ws_b22.merge_cells('A1:T1')
cell_be1 = ws_b22.cell(row=1, column=1, value='पंचायती राज चुनाव - 22-10-2026 : मतदान प्रगति बूथ-वार डेटा प्रविष्टि (PS & ZP MEMBER)')
cell_be1.font = font_title
cell_be1.alignment = align_center

# Header row 3 & 4
b_headers = [
    'क्र.सं.', 'ज़ोन', 'ज़ोनल मजिस्ट्रेट', 'मोबाइल', 'बूथ नं.', 'ग्राम पंचायत', 
    'मतदान केंद्र भवन / स्थल', 'पं.स. वार्ड', 'जि.प. वार्ड', 'कुल मतदाता',
    '7:15 AM शांतिपूर्ण प्रारंभ', '10 AM मत', '10 AM %', '1 PM मत', '1 PM %', 
    '3 PM मत', '3 PM %', '6 PM मत', '6 PM %', 'Final मत', 'Final %', 'टिप्पणी'
]

ws_b22.row_dimensions[3].height = 28
for c_idx, h_name in enumerate(b_headers, start=1):
    cell = ws_b22.cell(row=3, column=c_idx, value=h_name)
    cell.font = font_header
    cell.alignment = align_center
    cell.border = thin_border
    cell.fill = fill_gray_header
    if '1 PM' in h_name:
        cell.fill = fill_yellow

# Col numbers
ws_b22.row_dimensions[4].height = 18
for c_idx in range(1, len(b_headers)+1):
    cell = ws_b22.cell(row=4, column=c_idx, value=c_idx)
    cell.font = font_col_num
    cell.alignment = align_center
    cell.border = thin_border

# Populate Booths
b_row = 5
for b in booths:
    ws_b22.row_dimensions[b_row].height = 20
    ws_b22.cell(row=b_row, column=1, value=b['sn']).alignment = align_center
    ws_b22.cell(row=b_row, column=2, value=b['zone']).alignment = align_center
    ws_b22.cell(row=b_row, column=3, value=b['zonal_magistrate']).alignment = align_left
    ws_b22.cell(row=b_row, column=4, value=b['magistrate_mobile']).alignment = align_center
    ws_b22.cell(row=b_row, column=5, value=int(b['booth_no']) if b['booth_no'].isdigit() else b['booth_no']).alignment = align_center
    ws_b22.cell(row=b_row, column=6, value=b['gp_name']).alignment = align_left
    ws_b22.cell(row=b_row, column=7, value=b['location']).alignment = align_left
    ws_b22.cell(row=b_row, column=8, value=b['ps_ward']).alignment = align_center
    ws_b22.cell(row=b_row, column=9, value=b['zp_ward']).alignment = align_center
    ws_b22.cell(row=b_row, column=10, value=b['voters']).alignment = align_right
    
    ws_b22.cell(row=b_row, column=11, value='हाँ').alignment = align_center # Poll started
    
    # 10 AM (col 12 votes, col 13 %)
    # percentage formula: =IF(L{b_row}="","",IFERROR(ROUND((L{b_row}/J{b_row})*100,2),0))
    ws_b22.cell(row=b_row, column=13, value=f'=IF(L{b_row}="","",ROUND((L{b_row}/J{b_row})*100,2))').alignment = align_right
    
    # 1 PM (col 14 votes, col 15 %)
    ws_b22.cell(row=b_row, column=15, value=f'=IF(N{b_row}="","",ROUND((N{b_row}/J{b_row})*100,2))').alignment = align_right
    
    # 3 PM (col 16 votes, col 17 %)
    ws_b22.cell(row=b_row, column=17, value=f'=IF(P{b_row}="","",ROUND((P{b_row}/J{b_row})*100,2))').alignment = align_right
    
    # 6 PM (col 18 votes, col 19 %)
    ws_b22.cell(row=b_row, column=19, value=f'=IF(R{b_row}="","",ROUND((R{b_row}/J{b_row})*100,2))').alignment = align_right
    
    # Final (col 20 votes, col 21 %)
    ws_b22.cell(row=b_row, column=21, value=f'=IF(T{b_row}="","",ROUND((T{b_row}/J{b_row})*100,2))').alignment = align_right
    
    ws_b22.cell(row=b_row, column=22, value='').alignment = align_left

    for c in range(1, len(b_headers)+1):
        cell = ws_b22.cell(row=b_row, column=c)
        cell.font = font_data
        cell.border = thin_border
        if c in [13, 15, 17, 19, 21]:
            cell.number_format = '0.00"%"'
        elif c in [10, 12, 14, 16, 18, 20]:
            cell.number_format = '#,##0'

    b_row += 1

# Total Row in Booth Entry
ws_b22.row_dimensions[b_row].height = 25
ws_b22.merge_cells(f'A{b_row}:I{b_row}')
ws_b22.cell(row=b_row, column=1, value='कुल योग (ALL 152 BOOTHS TOTAL)').alignment = align_center
ws_b22.cell(row=b_row, column=10, value=f'=SUM(J5:J{b_row-1})').alignment = align_right
ws_b22.cell(row=b_row, column=11, value='152/152 हाँ').alignment = align_center

ws_b22.cell(row=b_row, column=12, value=f'=SUM(L5:L{b_row-1})').alignment = align_right
ws_b22.cell(row=b_row, column=13, value=f'=IF(J{b_row}>0, ROUND((L{b_row}/J{b_row})*100, 2), 0)').alignment = align_right

ws_b22.cell(row=b_row, column=14, value=f'=SUM(N5:N{b_row-1})').alignment = align_right
ws_b22.cell(row=b_row, column=15, value=f'=IF(J{b_row}>0, ROUND((N{b_row}/J{b_row})*100, 2), 0)').alignment = align_right

ws_b22.cell(row=b_row, column=16, value=f'=SUM(P5:P{b_row-1})').alignment = align_right
ws_b22.cell(row=b_row, column=17, value=f'=IF(J{b_row}>0, ROUND((P{b_row}/J{b_row})*100, 2), 0)').alignment = align_right

ws_b22.cell(row=b_row, column=18, value=f'=SUM(R5:R{b_row-1})').alignment = align_right
ws_b22.cell(row=b_row, column=19, value=f'=IF(J{b_row}>0, ROUND((R{b_row}/J{b_row})*100, 2), 0)').alignment = align_right

ws_b22.cell(row=b_row, column=20, value=f'=SUM(T5:T{b_row-1})').alignment = align_right
ws_b22.cell(row=b_row, column=21, value=f'=IF(J{b_row}>0, ROUND((T{b_row}/J{b_row})*100, 2), 0)').alignment = align_right

for c in range(1, len(b_headers)+1):
    cell = ws_b22.cell(row=b_row, column=c)
    cell.font = font_data_bold
    cell.fill = fill_total_row
    cell.border = thick_bottom_border
    if c in [13, 15, 17, 19, 21]:
        cell.number_format = '0.00"%"'
    elif c in [10, 12, 14, 16, 18, 20]:
        cell.number_format = '#,##0'

# Booth sheet widths
ws_b22.column_dimensions['A'].width = 6
ws_b22.column_dimensions['B'].width = 9
ws_b22.column_dimensions['C'].width = 16
ws_b22.column_dimensions['D'].width = 13
ws_b22.column_dimensions['E'].width = 8
ws_b22.column_dimensions['F'].width = 16
ws_b22.column_dimensions['G'].width = 30
ws_b22.column_dimensions['H'].width = 10
ws_b22.column_dimensions['I'].width = 10
ws_b22.column_dimensions['J'].width = 12
ws_b22.column_dimensions['K'].width = 14
ws_b22.column_dimensions['L'].width = 11
ws_b22.column_dimensions['M'].width = 10
ws_b22.column_dimensions['N'].width = 11
ws_b22.column_dimensions['O'].width = 10
ws_b22.column_dimensions['P'].width = 11
ws_b22.column_dimensions['Q'].width = 10
ws_b22.column_dimensions['R'].width = 11
ws_b22.column_dimensions['S'].width = 10
ws_b22.column_dimensions['T'].width = 11
ws_b22.column_dimensions['U'].width = 10
ws_b22.column_dimensions['V'].width = 16


# -------------------------------------------------------------
# 4. SHEET: 24-OCT_SARPANCH_FORMAT11
# -------------------------------------------------------------
ws_sp = wb.create_sheet(title='24-OCT_SARPANCH_F11')
ws_sp.views.sheetView[0].showGridLines = True

# Row 1: ST. FORMAT-11
ws_sp.cell(row=1, column=17, value='ST. FORMAT-11').font = font_st_format
ws_sp.cell(row=1, column=17).alignment = align_right

# Row 2: Title
ws_sp.merge_cells('A2:Q2')
cell_s1 = ws_sp.cell(row=2, column=1, value='PANCHAYAT GENERAL ELECTION, 2026')
cell_s1.font = font_title
cell_s1.alignment = align_center

# Row 3: Subtitle
ws_sp.merge_cells('A3:Q3')
cell_s2 = ws_sp.cell(row=3, column=1, value='POLLING PERCENTAGE FOR SARPANCH (PANCHAYAT SAMITI WISE)')
cell_s2.font = font_subtitle
cell_s2.alignment = align_center

# Row 4 & 5: Header
# 1: S.N. (A4:A5)
# 2: DISTRICT (B4:B5)
# 3: Name of Panchayat samiti (C4:C5)
# 4: TOTAL NO. OF GRAM PANCHAYAT (D4:D5)
# 5: Total Voters (E4:E5)
# 6: 7.15 A.M. Start Peaceful polling (F4:F5)
# 7-8: 10 A.M. (G4:H4) -> G5: Votes Polled, H5: Percentage
# 9-10: 01.00 P.M. (I4:J4) -> I5: Votes Polled, J5: Percentage (Yellow)
# 11-12: 3.00 P.M. (K4:L4) -> K5: Votes Polled, L5: Percentage
# 13-14: 6.00 P.M. (M4:N4) -> M5: Votes Polled, N5: Percentage
# 15-16: Final (O4:P4) -> O5: Votes Polled, P5: Percentage
# 17: Important Information if any (Q4:Q5)

ws_sp.merge_cells('A4:A5')
ws_sp.cell(row=4, column=1, value='S.N.')

ws_sp.merge_cells('B4:B5')
ws_sp.cell(row=4, column=2, value='DISTRICT')

ws_sp.merge_cells('C4:C5')
ws_sp.cell(row=4, column=3, value='Name of\nPanchayat samiti')

ws_sp.merge_cells('D4:D5')
ws_sp.cell(row=4, column=4, value='TOTAL NO.\nOF GRAM\nPANCHAYAT')

ws_sp.merge_cells('E4:E5')
ws_sp.cell(row=4, column=5, value='Total\nVoters')

ws_sp.merge_cells('F4:F5')
ws_sp.cell(row=4, column=6, value='7.15 A.M.\nStart Peaceful\npolling')

ws_sp.merge_cells('G4:H4')
ws_sp.cell(row=4, column=7, value='10 A.M.')
ws_sp.cell(row=5, column=7, value='Votes Polled')
ws_sp.cell(row=5, column=8, value='Percentage')

ws_sp.merge_cells('I4:J4')
ws_sp.cell(row=4, column=9, value='01.00 P.M.')
ws_sp.cell(row=5, column=9, value='Votes Polled')
ws_sp.cell(row=5, column=10, value='Percentage')

ws_sp.merge_cells('K4:L4')
ws_sp.cell(row=4, column=11, value='3.00 P.M.')
ws_sp.cell(row=5, column=11, value='Votes Polled')
ws_sp.cell(row=5, column=12, value='Percentage')

ws_sp.merge_cells('M4:N4')
ws_sp.cell(row=4, column=13, value='6.00 P.M.')
ws_sp.cell(row=5, column=13, value='Votes Polled')
ws_sp.cell(row=5, column=14, value='Percentage')

ws_sp.merge_cells('O4:P4')
ws_sp.cell(row=4, column=15, value='Final')
ws_sp.cell(row=5, column=15, value='Votes Polled')
ws_sp.cell(row=5, column=16, value='Percentage')

ws_sp.merge_cells('Q4:Q5')
ws_sp.cell(row=4, column=17, value='Important\nInformation if\nany')

for r in [4, 5]:
    ws_sp.row_dimensions[r].height = 28
    for c in range(1, 18):
        cell = ws_sp.cell(row=r, column=c)
        cell.font = font_header
        cell.alignment = align_center
        cell.border = thin_border
        if c in [9, 10]:
            cell.fill = fill_yellow

# Row 6: Column numbers (1 to 17)
ws_sp.row_dimensions[6].height = 18
for c in range(1, 18):
    cell = ws_sp.cell(row=6, column=c, value=c)
    cell.font = font_col_num
    cell.alignment = align_center
    cell.border = thin_border

# Main Panchayat Samiti Row
ws_sp.row_dimensions[7].height = 26
ws_sp.cell(row=7, column=1, value=1).alignment = align_center
ws_sp.cell(row=7, column=2, value='PALI').alignment = align_center
ws_sp.cell(row=7, column=3, value='SUMERPUR').alignment = align_center
ws_sp.cell(row=7, column=4, value=34).alignment = align_center # 34 Gram Panchayats
ws_sp.cell(row=7, column=5, value=144905).alignment = align_right
ws_sp.cell(row=7, column=6, value='हाँ (34/34 GP)').alignment = align_center

# Formulas linked to 24-OCT_SARPANCH_BOOTH
ws_sp.cell(row=7, column=7, value="=SUM('24-OCT_SARPANCH_BOOTH'!$K$5:$K$156)").alignment = align_right
ws_sp.cell(row=7, column=8, value="=IF(E7>0, ROUND((G7/E7)*100, 2), 0)").alignment = align_right

ws_sp.cell(row=7, column=9, value="=SUM('24-OCT_SARPANCH_BOOTH'!$M$5:$M$156)").alignment = align_right
ws_sp.cell(row=7, column=10, value="=IF(E7>0, ROUND((I7/E7)*100, 2), 0)").alignment = align_right

ws_sp.cell(row=7, column=11, value="=SUM('24-OCT_SARPANCH_BOOTH'!$O$5:$O$156)").alignment = align_right
ws_sp.cell(row=7, column=12, value="=IF(E7>0, ROUND((K7/E7)*100, 2), 0)").alignment = align_right

ws_sp.cell(row=7, column=13, value="=SUM('24-OCT_SARPANCH_BOOTH'!$Q$5:$Q$156)").alignment = align_right
ws_sp.cell(row=7, column=14, value="=IF(E7>0, ROUND((M7/E7)*100, 2), 0)").alignment = align_right

ws_sp.cell(row=7, column=15, value="=SUM('24-OCT_SARPANCH_BOOTH'!$S$5:$S$156)").alignment = align_right
ws_sp.cell(row=7, column=16, value="=IF(E7>0, ROUND((O7/E7)*100, 2), 0)").alignment = align_right
ws_sp.cell(row=7, column=17, value='शांतिपूर्ण मतदान जारी').alignment = align_center

for c in range(1, 18):
    cell = ws_sp.cell(row=7, column=c)
    cell.font = font_data_bold
    cell.border = thick_bottom_border
    cell.fill = fill_accent_green
    if c in [8, 10, 12, 14, 16]:
        cell.number_format = '0.00"%"'
    elif c in [4, 5, 7, 9, 11, 13, 15]:
        cell.number_format = '#,##0'

# Gram Panchayat Wise breakdown rows for Sarpanch
ws_sp.merge_cells('A9:Q9')
subh_sp = ws_sp.cell(row=9, column=1, value='समस्त 34 ग्राम पंचायत वार सरपंच मतदान प्रतिशत प्रगति (GP WISE BREAKUP)')
subh_sp.font = font_subtitle
subh_sp.alignment = align_center
subh_sp.fill = fill_gray_header
ws_sp.row_dimensions[9].height = 22

# Group voters by Gram Panchayat
gp_dict = defaultdict(lambda: {'booths': 0, 'voters': 0})
for b in booths:
    gp_dict[b['gp_name']]['booths'] += 1
    gp_dict[b['gp_name']]['voters'] += b['voters']

sorted_gps = sorted(list(gp_dict.keys()))

sp_row_idx = 10
for g_idx, gp in enumerate(sorted_gps, start=1):
    ws_sp.row_dimensions[sp_row_idx].height = 22
    ws_sp.cell(row=sp_row_idx, column=1, value=g_idx).alignment = align_center
    ws_sp.cell(row=sp_row_idx, column=2, value='PALI').alignment = align_center
    ws_sp.cell(row=sp_row_idx, column=3, value=f'{gp} (बूथ: {gp_dict[gp]["booths"]})').alignment = align_left
    ws_sp.cell(row=sp_row_idx, column=4, value=1).alignment = align_center
    ws_sp.cell(row=sp_row_idx, column=5, value=gp_dict[gp]['voters']).alignment = align_right
    ws_sp.cell(row=sp_row_idx, column=6, value='हाँ').alignment = align_center
    
    # Formulas linked to 24-OCT_SARPANCH_BOOTH by Gram Panchayat name (col F)
    ws_sp.cell(row=sp_row_idx, column=7, value=f"=SUMIF('24-OCT_SARPANCH_BOOTH'!$F$5:$F$156, \"{gp}\", '24-OCT_SARPANCH_BOOTH'!$K$5:$K$156)").alignment = align_right
    ws_sp.cell(row=sp_row_idx, column=8, value=f"=IF(E{sp_row_idx}>0, ROUND((G{sp_row_idx}/E{sp_row_idx})*100, 2), 0)").alignment = align_right
    
    ws_sp.cell(row=sp_row_idx, column=9, value=f"=SUMIF('24-OCT_SARPANCH_BOOTH'!$F$5:$F$156, \"{gp}\", '24-OCT_SARPANCH_BOOTH'!$M$5:$M$156)").alignment = align_right
    ws_sp.cell(row=sp_row_idx, column=10, value=f"=IF(E{sp_row_idx}>0, ROUND((I{sp_row_idx}/E{sp_row_idx})*100, 2), 0)").alignment = align_right
    
    ws_sp.cell(row=sp_row_idx, column=11, value=f"=SUMIF('24-OCT_SARPANCH_BOOTH'!$F$5:$F$156, \"{gp}\", '24-OCT_SARPANCH_BOOTH'!$O$5:$O$156)").alignment = align_right
    ws_sp.cell(row=sp_row_idx, column=12, value=f"=IF(E{sp_row_idx}>0, ROUND((K{sp_row_idx}/E{sp_row_idx})*100, 2), 0)").alignment = align_right
    
    ws_sp.cell(row=sp_row_idx, column=13, value=f"=SUMIF('24-OCT_SARPANCH_BOOTH'!$F$5:$F$156, \"{gp}\", '24-OCT_SARPANCH_BOOTH'!$Q$5:$Q$156)").alignment = align_right
    ws_sp.cell(row=sp_row_idx, column=14, value=f"=IF(E{sp_row_idx}>0, ROUND((M{sp_row_idx}/E{sp_row_idx})*100, 2), 0)").alignment = align_right
    
    ws_sp.cell(row=sp_row_idx, column=15, value=f"=SUMIF('24-OCT_SARPANCH_BOOTH'!$F$5:$F$156, \"{gp}\", '24-OCT_SARPANCH_BOOTH'!$S$5:$S$156)").alignment = align_right
    ws_sp.cell(row=sp_row_idx, column=16, value=f"=IF(E{sp_row_idx}>0, ROUND((O{sp_row_idx}/E{sp_row_idx})*100, 2), 0)").alignment = align_right
    ws_sp.cell(row=sp_row_idx, column=17, value='शांतिपूर्ण').alignment = align_center

    for c in range(1, 18):
        cell = ws_sp.cell(row=sp_row_idx, column=c)
        cell.font = font_data
        cell.border = thin_border
        if c in [8, 10, 12, 14, 16]:
            cell.number_format = '0.00"%"'
        elif c in [4, 5, 7, 9, 11, 13, 15]:
            cell.number_format = '#,##0'

    sp_row_idx += 1

# Col widths for Sarpanch
for c, w in col_widths_ps.items():
    ws_sp.column_dimensions[get_column_letter(c)].width = w


# -------------------------------------------------------------
# 5. SHEET: 24-OCT_SARPANCH_BOOTH (Detailed Booths Entry for Sarpanch)
# -------------------------------------------------------------
ws_b24 = wb.create_sheet(title='24-OCT_SARPANCH_BOOTH')
ws_b24.views.sheetView[0].showGridLines = True

ws_b24.merge_cells('A1:U1')
cell_sbe1 = ws_b24.cell(row=1, column=1, value='पंचायती राज चुनाव - 24-10-2026 : सरपंच चुनाव मतदान प्रगति बूथ-वार डेटा प्रविष्टि')
cell_sbe1.font = font_title
cell_sbe1.alignment = align_center

# Header row 3 & 4
sp_b_headers = [
    'क्र.सं.', 'ज़ोन', 'ज़ोनल मजिस्ट्रेट', 'मोबाइल', 'बूथ नं.', 'ग्राम पंचायत', 
    'मतदान केंद्र भवन / स्थल', 'कुल मतदाता', '7:15 AM शांतिपूर्ण प्रारंभ', 
    '10 AM मत', '10 AM %', '1 PM मत', '1 PM %', '3 PM मत', '3 PM %', 
    '6 PM मत', '6 PM %', 'Final मत', 'Final %', 'टिप्पणी'
]

ws_b24.row_dimensions[3].height = 28
for c_idx, h_name in enumerate(sp_b_headers, start=1):
    cell = ws_b24.cell(row=3, column=c_idx, value=h_name)
    cell.font = font_header
    cell.alignment = align_center
    cell.border = thin_border
    cell.fill = fill_gray_header
    if '1 PM' in h_name:
        cell.fill = fill_yellow

ws_b24.row_dimensions[4].height = 18
for c_idx in range(1, len(sp_b_headers)+1):
    cell = ws_b24.cell(row=4, column=c_idx, value=c_idx)
    cell.font = font_col_num
    cell.alignment = align_center
    cell.border = thin_border

# Populate Booths
sb_row = 5
for b in booths:
    ws_b24.row_dimensions[sb_row].height = 20
    ws_b24.cell(row=sb_row, column=1, value=b['sn']).alignment = align_center
    ws_b24.cell(row=sb_row, column=2, value=b['zone']).alignment = align_center
    ws_b24.cell(row=sb_row, column=3, value=b['zonal_magistrate']).alignment = align_left
    ws_b24.cell(row=sb_row, column=4, value=b['magistrate_mobile']).alignment = align_center
    ws_b24.cell(row=sb_row, column=5, value=int(b['booth_no']) if b['booth_no'].isdigit() else b['booth_no']).alignment = align_center
    ws_b24.cell(row=sb_row, column=6, value=b['gp_name']).alignment = align_left
    ws_b24.cell(row=sb_row, column=7, value=b['location']).alignment = align_left
    ws_b24.cell(row=sb_row, column=8, value=b['voters']).alignment = align_right
    ws_b24.cell(row=sb_row, column=9, value='हाँ').alignment = align_center
    
    # Col 10: 10AM Votes, Col 11: 10AM %
    ws_b24.cell(row=sb_row, column=11, value=f'=IF(J{sb_row}="","",ROUND((J{sb_row}/H{sb_row})*100,2))').alignment = align_right
    
    # Col 12: 1PM Votes, Col 13: 1PM %
    ws_b24.cell(row=sb_row, column=13, value=f'=IF(L{sb_row}="","",ROUND((L{sb_row}/H{sb_row})*100,2))').alignment = align_right
    
    # Col 14: 3PM Votes, Col 15: 3PM %
    ws_b24.cell(row=sb_row, column=15, value=f'=IF(N{sb_row}="","",ROUND((N{sb_row}/H{sb_row})*100,2))').alignment = align_right
    
    # Col 16: 6PM Votes, Col 17: 6PM %
    ws_b24.cell(row=sb_row, column=17, value=f'=IF(P{sb_row}="","",ROUND((P{sb_row}/H{sb_row})*100,2))').alignment = align_right
    
    # Col 18: Final Votes, Col 19: Final %
    ws_b24.cell(row=sb_row, column=19, value=f'=IF(R{sb_row}="","",ROUND((R{sb_row}/H{sb_row})*100,2))').alignment = align_right
    ws_b24.cell(row=sb_row, column=20, value='').alignment = align_left

    for c in range(1, len(sp_b_headers)+1):
        cell = ws_b24.cell(row=sb_row, column=c)
        cell.font = font_data
        cell.border = thin_border
        if c in [11, 13, 15, 17, 19]:
            cell.number_format = '0.00"%"'
        elif c in [8, 10, 12, 14, 16, 18]:
            cell.number_format = '#,##0'

    sb_row += 1

# Total Row
ws_b24.row_dimensions[sb_row].height = 25
ws_b24.merge_cells(f'A{sb_row}:G{sb_row}')
ws_b24.cell(row=sb_row, column=1, value='कुल योग (ALL 152 BOOTHS TOTAL)').alignment = align_center
ws_b24.cell(row=sb_row, column=8, value=f'=SUM(H5:H{sb_row-1})').alignment = align_right
ws_b24.cell(row=sb_row, column=9, value='152/152 हाँ').alignment = align_center

ws_b24.cell(row=sb_row, column=10, value=f'=SUM(J5:J{sb_row-1})').alignment = align_right
ws_b24.cell(row=sb_row, column=11, value=f'=IF(H{sb_row}>0, ROUND((J{sb_row}/H{sb_row})*100, 2), 0)').alignment = align_right

ws_b24.cell(row=sb_row, column=12, value=f'=SUM(L5:L{sb_row-1})').alignment = align_right
ws_b24.cell(row=sb_row, column=13, value=f'=IF(H{sb_row}>0, ROUND((L{sb_row}/H{sb_row})*100, 2), 0)').alignment = align_right

ws_b24.cell(row=sb_row, column=14, value=f'=SUM(N5:N{sb_row-1})').alignment = align_right
ws_b24.cell(row=sb_row, column=15, value=f'=IF(H{sb_row}>0, ROUND((N{sb_row}/H{sb_row})*100, 2), 0)').alignment = align_right

ws_b24.cell(row=sb_row, column=16, value=f'=SUM(P5:P{sb_row-1})').alignment = align_right
ws_b24.cell(row=sb_row, column=17, value=f'=IF(H{sb_row}>0, ROUND((P{sb_row}/H{sb_row})*100, 2), 0)').alignment = align_right

ws_b24.cell(row=sb_row, column=18, value=f'=SUM(R5:R{sb_row-1})').alignment = align_right
ws_b24.cell(row=sb_row, column=19, value=f'=IF(H{sb_row}>0, ROUND((R{sb_row}/H{sb_row})*100, 2), 0)').alignment = align_right

for c in range(1, len(sp_b_headers)+1):
    cell = ws_b24.cell(row=sb_row, column=c)
    cell.font = font_data_bold
    cell.fill = fill_total_row
    cell.border = thick_bottom_border
    if c in [11, 13, 15, 17, 19]:
        cell.number_format = '0.00"%"'
    elif c in [8, 10, 12, 14, 16, 18]:
        cell.number_format = '#,##0'

# Widths
ws_b24.column_dimensions['A'].width = 6
ws_b24.column_dimensions['B'].width = 9
ws_b24.column_dimensions['C'].width = 16
ws_b24.column_dimensions['D'].width = 13
ws_b24.column_dimensions['E'].width = 8
ws_b24.column_dimensions['F'].width = 16
ws_b24.column_dimensions['G'].width = 30
ws_b24.column_dimensions['H'].width = 12
ws_b24.column_dimensions['I'].width = 14
ws_b24.column_dimensions['J'].width = 11
ws_b24.column_dimensions['K'].width = 10
ws_b24.column_dimensions['L'].width = 11
ws_b24.column_dimensions['M'].width = 10
ws_b24.column_dimensions['N'].width = 11
ws_b24.column_dimensions['O'].width = 10
ws_b24.column_dimensions['P'].width = 11
ws_b24.column_dimensions['Q'].width = 10
ws_b24.column_dimensions['R'].width = 11
ws_b24.column_dimensions['S'].width = 10
ws_b24.column_dimensions['T'].width = 16


# -------------------------------------------------------------
# 6. SHEET: CONTROL_ROOM_GUIDE
# -------------------------------------------------------------
ws_g = wb.create_sheet(title='CONTROL_ROOM_GUIDE', index=0)
ws_g.views.sheetView[0].showGridLines = True

ws_g.merge_cells('A1:H1')
g_t = ws_g.cell(row=1, column=1, value='कार्यालय निर्वाचक रजिस्ट्रीकरण अधिकारी (एसडीएम) सुमेरपुर')
g_t.font = font_title
g_t.alignment = align_center

ws_g.merge_cells('A2:H2')
g_sub = ws_g.cell(row=2, column=1, value='पंचायती राज आम चुनाव 2026 - चुनाव प्रगति मॉनिटरिंग सिस्टम यूजर गाइड')
g_sub.font = font_subtitle
g_sub.alignment = align_center

guide_content = [
    ("दिनांक 22-10-2026 : पंचायत समिति (PS) एवं जिला परिषद (ZP) सदस्य चुनाव", [
        "1. कंट्रोल रूम ऑपरेटर को केवल '22-OCT_BOOTH_ENTRY' शीट में बूथ वार मतदान संख्या दर्ज करनी है।",
        "2. 7:15 AM पर मतदान शांतिपूर्ण प्रारंभ की सूचना 'हाँ' दर्ज करें।",
        "3. 10:00 AM, 01:00 PM, 03:00 PM, 06:00 PM एवं अंतिम (Final) समय पर प्राप्त कुल पड़े मत दर्ज करें।",
        "4. मतदान प्रतिशत का परिकलन स्वतः हो जाएगा।",
        "5. '22-OCT_ZP_MEMBER_F11' शीट स्वतः अपडेट होगी (जिला परिषद वार्ड 07 से 10 एवं पाली जिले का प्रारूप-11 तैयार)।",
        "6. '22-OCT_PS_MEMBER_F11' शीट स्वतः अपडेट होगी (पंचायत समिति सुमेरपुर एवं समस्त 21 वार्डों का प्रारूप-11 तैयार)।"
    ]),
    ("दिनांक 24-10-2026 : सरपंच चुनाव (SARPANCH ELECTION)", [
        "1. कंट्रोल रूम ऑपरेटर को '24-OCT_SARPANCH_BOOTH' शीट में प्रत्येक बूथ के सरपंच मत दर्ज करने हैं।",
        "2. 7:15 AM, 10:00 AM, 01:00 PM, 03:00 PM, 06:00 PM एवं Final राउंड के मत दर्ज करें।",
        "3. '24-OCT_SARPANCH_F11' शीट में समस्त 34 ग्राम पंचायतों एवं पंचायत समिति स्तर का ST. FORMAT-11 स्वतः तैयार मिलेगा।",
        "4. यह रिपोर्ट सीधे प्रिंट करके या PDF बनाकर उच्चाधिकारियों एवं राज्य चुनाव आयोग को भेजी जा सकती है।"
    ]),
    ("महत्वपूर्ण निर्देश एवं सुविधाएं", [
        "• Excel फाइल के साथ-साथ अत्यंत आधुनिक एवं ऑफलाइन चलने वाला वेब डैशबोर्ड (index.html) भी तैयार किया गया है।",
        "• वेब डैशबोर्ड में 1-क्लिक व्हाट्सएप रिपोर्ट तैयार होती है जिसे सीधे DEO/RO व्हाट्सएप ग्रुप पर शेयर कर सकते हैं।",
        "• सभी फॉर्मेट राज्य निर्वाचन आयोग राजस्थान (SEC Rajasthan) के अधिकृत ST. FORMAT-11 के अनुरूप हैं।"
    ])
]

curr_g_row = 4
for section_title, points in guide_content:
    ws_g.merge_cells(f'A{curr_g_row}:H{curr_g_row}')
    sc = ws_g.cell(row=curr_g_row, column=1, value=section_title)
    sc.font = font_subtitle
    sc.fill = fill_gray_header
    curr_g_row += 1
    for pt in points:
        ws_g.cell(row=curr_g_row, column=1, value="•").alignment = align_center
        ws_g.merge_cells(f'B{curr_g_row}:H{curr_g_row}')
        pt_cell = ws_g.cell(row=curr_g_row, column=2, value=pt)
        pt_cell.font = font_data
        curr_g_row += 1
    curr_g_row += 1

ws_g.column_dimensions['A'].width = 6
ws_g.column_dimensions['B'].width = 80

out_path = 'c:/Users/sumit/Desktop/PS-ELECTION POLL PROGRESS/Panchayat_Poll_Progress_System_2026.xlsx'
wb.save(out_path)
print(f'Successfully generated {out_path}')
