#!/usr/bin/env python3
"""Builds Creator_Export_Toolkit.xlsx - a macro-free export paperwork toolkit
for Indian creators (export invoice, EDF, bank letters, payment tracker).

Run:  python3 build_toolkit.py [output.xlsx]
All sample data in the workbook is fictional.
"""
import sys
from datetime import date

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter as CL
from openpyxl.utils.indexed_list import IndexedList
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.hyperlink import Hyperlink
from openpyxl.worksheet.pagebreak import Break

OUT = sys.argv[1] if len(sys.argv) > 1 else "Creator_Export_Toolkit.xlsx"

# ----------------------------------------------------------------- palette
VIOLET, VIOLET_DK, VIOLET_SOFT = "5B4FE8", "3F35B5", "ECEAFD"
INK, MID, LIGHT, LINE = "1C1814", "6B6560", "A8A39C", "D9D4CC"
CREAM, WHITE = "F7F4EF", "FFFFFF"
INPUT, CALC = "FFF6CC", "F1EFEA"
GREEN, GREEN_BG = "1E6B4F", "DDF1E8"
RED, RED_BG = "A8261E", "FBE3E1"
AMBER, AMBER_BG = "7A5200", "FDEFC8"
SERIES_1, SERIES_2 = "2A78D6", "EB6834"

SAMPLE_NAME = "Sample Creator Studio"
SAMPLE_PAN = "ABCDE1234F"
SAMPLE_AD = "0000000"


def F(size=10, bold=False, color=INK, italic=False, underline=None):
    return Font(name="Arial", size=size, bold=bold, color=color, italic=italic, underline=underline)


def fill(hex_):
    return PatternFill("solid", start_color=hex_, end_color=hex_)


def A(h="left", v="center", wrap=True, indent=0):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap, indent=indent)


THIN = Side(style="thin", color=LINE)
DARK = Side(style="thin", color="000000")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
BOX_DK = Border(left=DARK, right=DARK, top=DARK, bottom=DARK)
UNDER = Border(bottom=THIN)

wb = Workbook()
wb._fonts = IndexedList()
wb._fonts.add(Font(name="Arial", size=10, family=2))
wb.properties.creator = "Creator Export Toolkit"
wb.properties.lastModifiedBy = "Creator Export Toolkit"
wb.properties.title = "Creator Export Toolkit"

SHEETS = ["Home", "My Profile", "Clients", "Invoice Register", "Documents", "Export Invoice",
          "EDF Form", "EDF Cover Letter", "Bank Letter", "Dashboard", "Guide", "Lists", "Calc"]
WS = {}
for i, n in enumerate(SHEETS):
    WS[n] = wb.active if i == 0 else wb.create_sheet(n)
    WS[n].title = n
    WS[n].sheet_view.showGridLines = False

INPUT_CELLS = {n: [] for n in SHEETS}


def put(ws, ref, value=None, font=None, bg=None, align=None, border=None, fmt=None, inp=False):
    c = ws[ref]
    if value is not None:
        c.value = value
    c.font = font or F()
    c.alignment = align or A()
    if inp:
        c.fill = fill(INPUT)
        c.border = BOX
        c.protection = Protection(locked=False)
        INPUT_CELLS[ws.title].append(ref)
    if bg:
        c.fill = fill(bg)
    if border:
        c.border = border
    if fmt:
        c.number_format = fmt
    return c


def merge(ws, rng, value=None, font=None, bg=None, align=None, border=None, fmt=None):
    first = rng.split(":")[0]
    if ":" not in rng:
        return put(ws, rng, value, font, bg, align, border, fmt)
    for row in ws[rng]:
        for c in row:
            if bg:
                c.fill = fill(bg)
            if border:
                c.border = border
    ws.merge_cells(rng)
    return put(ws, first, value, font, bg, align, border, fmt)


def widths(ws, spec):
    for col, w in spec.items():
        ws.column_dimensions[col].width = w


def title(ws, text, sub, last_col):
    ws.row_dimensions[1].height = 8
    ws.row_dimensions[2].height = 30
    ws.row_dimensions[3].height = 20
    merge(ws, f"B2:{last_col}2", text, F(18, True, WHITE), VIOLET, A(indent=1))
    merge(ws, f"B3:{last_col}3", sub, F(10, False, WHITE), VIOLET_DK, A(indent=1))


def section(ws, row, text, first="B", last="E"):
    ws.row_dimensions[row].height = 22
    merge(ws, f"{first}{row}:{last}{row}", text, F(11, True, VIOLET_DK), VIOLET_SOFT, A(indent=1))


def link(ws, ref, text, target, font=None, align=None):
    c = put(ws, ref, text, font or F(10, True, VIOLET, underline="single"), align=align)
    c.hyperlink = Hyperlink(ref=ref, location=target.lstrip("#"))
    return c


def dv_list(ws, sqref, formula, strict=True, title_="Pick from the list", msg=None):
    dv = DataValidation(type="list", formula1=formula, allow_blank=True)
    dv.showErrorMessage = strict
    dv.errorTitle = title_
    dv.error = msg or "Please choose one of the options in the dropdown."
    ws.add_data_validation(dv)
    for part in sqref.split():
        dv.add(part)


def dv_date(ws, sqref):
    dv = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True)
    dv.showErrorMessage = True
    dv.errorTitle = "Enter a date"
    dv.error = "Type a date like 05-Oct-2026."
    ws.add_data_validation(dv)
    for part in sqref.split():
        dv.add(part)


def dv_num(ws, sqref, positive=False):
    dv = DataValidation(type="decimal", operator="greaterThan" if positive else "greaterThanOrEqual",
                        formula1="0", allow_blank=True)
    dv.showErrorMessage = True
    dv.errorTitle = "Enter a number"
    dv.error = "Type a number only, without currency symbols or commas."
    ws.add_data_validation(dv)
    for part in sqref.split():
        dv.add(part)


def status_cf(ws, rng, first):
    """Green / amber / red colouring for status text cells."""
    rules = [
        (f'OR(LEFT({first},2)="OK",LEFT({first},5)="READY",{first}="Paid",{first}="Filed",LEFT({first},8)="Complete",{first}="Not needed",{first}="Not required",{first}="Below threshold",{first}="Already registered",{first}="Nothing pending")', GREEN, GREEN_BG),
        (f'OR(LEFT({first},3)="Fix",LEFT({first},7)="Missing",LEFT({first},7)="OVERDUE",LEFT({first},4)="LATE",LEFT({first},4)="Late",LEFT({first},3)="NOT",LEFT({first},7)="Crossed",LEFT({first},12)="PAN mismatch",LEFT({first},9)="Duplicate",LEFT({first},3)="Add",LEFT({first},4)="Pick",LEFT({first},6)="Client",LEFT({first},13)="Check numbers")', RED, RED_BG),
        (f'AND({first}<>"",NOT(ISNUMBER({first})))', AMBER, AMBER_BG),
    ]
    for formula, fg, bg in rules:
        ws.conditional_formatting.add(rng, FormulaRule(formula=[formula], font=Font(bold=True, color=fg), fill=fill(bg), stopIfTrue=True))


def protect(ws):
    p = ws.protection
    p.sheet = True
    p.formatCells = False
    p.formatColumns = False
    p.formatRows = False
    p.sort = False
    p.autoFilter = False


def page(ws, area, landscape=False, fit=True, scale=None):
    ws.print_area = area
    ws.page_setup.paperSize = 9  # A4
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.print_options.horizontalCentered = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.page_margins.top = ws.page_margins.bottom = 0.4
    ws.page_margins.header = ws.page_margins.footer = 0.2
    if fit:
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 1
    elif scale:
        ws.page_setup.scale = scale


# ------------------------------------------------------------ reference map
PROF, CLI, REG, DOC, CAL, LST, DASH = ("'My Profile'!", "Clients!", "'Invoice Register'!",
                                       "Documents!", "Calc!", "Lists!", "Dashboard!")
R1, RN = 6, 205      # invoice register rows
C1, CN = 6, 35       # client rows
EDF_ROWS = 10        # invoices that fit on one EDF

REG_COLS = ["num", "inv", "date", "client", "amt", "rate", "check", "cur", "inr", "edf_due", "edf_status",
            "deadline", "pay_status", "days_left", "edf_filed", "recd_on", "recd_amt", "inr_cred", "bank_ref",
            "balance", "rate_got", "fx_diff", "o_cur", "o_desc", "o_sac", "o_net", "contract", "notes",
            "h_client", "h_desc", "h_sac", "h_net", "h_month", "h_key", "h_fy", "h_sort", "h_openinr", "h_unfiled"]
RC = {k: CL(i + 1) for i, k in enumerate(REG_COLS)}


def rr(k):
    """Absolute register column range from another sheet."""
    return f"{REG}${RC[k]}${R1}:${RC[k]}${RN}"


def cr(col):
    return f"{CLI}${col}${C1}:${col}${CN}"


P = {"name": 6, "addr": 7, "pan": 8, "gst_status": 9, "gstin": 10, "lut": 11, "iec": 12, "sign": 13,
     "desig": 14, "mobile": 15, "email": 16, "bank": 19, "branch": 20, "adcode": 21, "acct": 22, "swift": 23,
     "category": 26, "mode": 27, "note": 28, "edf_days": 31, "months": 32, "months_inr": 33, "gst_limit": 34, "edf_from": 35,
     "missing": 38, "samples": 39}


def pf(k):
    return f"{PROF}$C${P[k]}"


TODAY = f"{CAL}$B$2"
MON3 = f"{LST}$P$4:$P$15"
MONFULL = f"{LST}$Q$4:$Q$15"


def dtxt(x):
    """Locale-proof dd-Mmm-yyyy text for a date expression."""
    return f'TEXT(DAY({x}),"00")&"-"&INDEX({MON3},MONTH({x}))&"-"&YEAR({x})'


# =================================================================== LISTS
ws = WS["Lists"]
merge(ws, "A1:Q1", "Lists", F(16, True, WHITE), VIOLET, A(indent=1))
merge(ws, "A2:Q2", "Dropdown options used across the toolkit. You can add your own in the empty yellow rows.", F(10, False, WHITE), VIOLET_DK, A(indent=1))
ws.row_dimensions[1].height = 28
ws.row_dimensions[2].height = 20
heads = {"A": "Currency code", "B": "Currency name", "C": "Small unit", "E": "Service description",
         "F": "Suggested SAC", "H": "SAC code", "I": "SAC description (reference)", "K": "Category of exporter",
         "L": "Mode of realisation", "M": "GST status", "N": "EDF covers", "O": "Financial year",
         "P": "Month (short)", "Q": "Month (full)"}
for col, h in heads.items():
    put(ws, f"{col}3", h, F(9, True, WHITE), VIOLET, A(wrap=True))
ws.row_dimensions[3].height = 28
currencies = [("USD", "US Dollars", "Cents"), ("EUR", "Euros", "Cents"), ("GBP", "Pounds Sterling", "Pence"),
              ("AUD", "Australian Dollars", "Cents"), ("CAD", "Canadian Dollars", "Cents"),
              ("SGD", "Singapore Dollars", "Cents"), ("AED", "UAE Dirhams", "Fils"),
              ("INR", "Indian Rupees", "Paise")]
services = [("YouTube AdSense / digital content monetisation services", "998361"),
            ("Meta / Facebook content monetisation services", "998361"),
            ("Instagram content monetisation services", "998361"),
            ("Influencer marketing / brand promotion services", "998397"),
            ("Sponsored video / content production services", "999612"),
            ("Video editing / post-production services", "999613"),
            ("Online coaching / training services", "999293")]
sacs = [("998361", "Advertising services"),
        ("998362", "Purchase or sale of advertising space or time, on commission"),
        ("998365", "Sale of internet advertising space (except on commission)"),
        ("998397", "Sponsorship services and brand promotion services"),
        ("999612", "Motion picture, videotape, television and radio programme production services"),
        ("999613", "Audiovisual post-production services"),
        ("999631", "Services of performing artists (actors, musicians, singers, TV personalities, models etc.)"),
        ("998439", "Other on-line contents n.e.c."),
        ("999293", "Commercial training and coaching services")]
for r in range(4, 24):
    i = r - 4
    cur = currencies[i] if i < len(currencies) else (None, None, None)
    for col, v in zip("ABC", cur):
        put(ws, f"{col}{r}", v, inp=True)
    sv = services[i] if i < len(services) else (None, None)
    put(ws, f"E{r}", sv[0], inp=True)
    put(ws, f"F{r}", sv[1], inp=True, fmt="@")
    if i < len(sacs):
        put(ws, f"H{r}", sacs[i][0], border=BOX, fmt="@")
        put(ws, f"I{r}", sacs[i][1], border=BOX)
for i, v in enumerate(["Custom (DTA units)", "SEZ", "100% EOU", "Warehouse export", "Others"]):
    put(ws, f"K{4+i}", v, border=BOX)
for i, v in enumerate(["Others - bank transfer", "Others - advance payment", "L/C", "BG"]):
    put(ws, f"L{4+i}", v, border=BOX)
for i, v in enumerate(["Registered", "Not registered"]):
    put(ws, f"M{4+i}", v, border=BOX)
for i, v in enumerate(["All invoices of the same month", "Only this invoice"]):
    put(ws, f"N{4+i}", v, border=BOX)
for i in range(12):
    y = 2024 + i
    put(ws, f"O{4+i}", f"{y}-{str(y+1)[2:]}", border=BOX)
for i, (s, f_) in enumerate([("Jan", "January"), ("Feb", "February"), ("Mar", "March"), ("Apr", "April"),
                             ("May", "May"), ("Jun", "June"), ("Jul", "July"), ("Aug", "August"),
                             ("Sep", "September"), ("Oct", "October"), ("Nov", "November"), ("Dec", "December")]):
    put(ws, f"P{4+i}", s, border=BOX)
    put(ws, f"Q{4+i}", f_, border=BOX)
merge(ws, "B25:Q26", "SAC codes are suggestions only (the AdSense default follows common practice). The right code depends on "
      "your contract - confirm with your CA before you use it. Source for descriptions: GST Scheme of Classification of Services (Heading 9983 / 9996 / 9992).",
      F(9, False, MID, italic=True), align=A(v="top"))
widths(ws, {"A": 12, "B": 22, "C": 12, "D": 2, "E": 52, "F": 14, "G": 2, "H": 10, "I": 62, "J": 2, "K": 22,
            "L": 26, "M": 16, "N": 30, "O": 14, "P": 12, "Q": 14})
CUR_LIST = f"{LST}$A$4:$A$23"
SVC_LIST = f"{LST}$E$4:$E$23"

# =============================================================== MY PROFILE
ws = WS["My Profile"]
title(ws, "My Profile", "Fill this once. These details flow into every invoice, EDF and bank letter.", "E")
widths(ws, {"A": 2, "B": 38, "C": 50, "D": 24, "E": 66})
put(ws, "B4", "Type in the yellow cells only. The Check column tells you what is still missing.", F(9, False, MID, italic=True))
ws.merge_cells("B4:E4")


def prow(key, label, value, hint, fmt=None, height=None):
    r = P[key]
    put(ws, f"B{r}", label, F(10, True), border=UNDER)
    put(ws, f"C{r}", value, inp=True, fmt=fmt)
    put(ws, f"E{r}", hint, F(9, False, MID, italic=True))
    put(ws, f"D{r}", None, F(9, True), align=A("center"))
    ws.row_dimensions[r].height = height or 22


section(ws, 5, "1 · About you (the exporter)")
prow("name", "Your legal or business name", SAMPLE_NAME, "Exactly as on your PAN / GST certificate / bank account.")
prow("addr", "Full address", "12 Example Lane, Sample Nagar,\nMumbai, Maharashtra - 400001, India",
     "Include PIN code and country. Press Alt+Enter for a new line.", height=46)
prow("pan", "PAN", SAMPLE_PAN, "10 characters, e.g. ABCDE1234F.", "@")
prow("gst_status", "GST status", "Registered", "Pick 'Not registered' if you have no GSTIN.")
prow("gstin", "GSTIN", "27ABCDE1234F1Z5", "15 characters. Leave blank if not registered.", "@")
prow("lut", "LUT ARN (optional)", "AD2704260000000", "If GST-registered: the ARN of this year's Letter of Undertaking (Form RFD-11).", "@")
prow("iec", "Import Export Code (IEC)", "Not applicable", "Type your IEC, or 'Not applicable' if you do not hold one.", "@")
prow("sign", "Authorised signatory", "Riya Sample", "The person who signs the documents.")
prow("desig", "Designation (optional)", "Proprietor", "e.g. Proprietor, Partner, Director.")
prow("mobile", "Mobile", "+91 90000 00000", "Printed on the bank letters.", "@")
prow("email", "Email", "you@example.com", "Printed on the bank letters.")
section(ws, 18, "2 · Your bank (the Authorised Dealer that receives your foreign payments)")
prow("bank", "Bank name", "Sample Bank Ltd", "The bank where the foreign payment is credited.")
prow("branch", "AD branch / address", "Forex Desk, Example Branch, Mumbai, India", "The branch that handles forex for your account.", height=32)
prow("adcode", "AD code", SAMPLE_AD, "Given by your bank (usually 7 digits). Not sure? Print the 'Bank Letter' sheet and ask them.", "@")
prow("acct", "Account number", "000000000000", "Printed on the invoice and the bank letters.", "@")
prow("swift", "SWIFT / BIC (optional)", "SAMPINBBXXX", "Helps foreign brands pay you. Leave blank if unknown.", "@")
section(ws, 25, "3 · Defaults printed on your forms")
prow("category", "Category of exporter", "Custom (DTA units)", "Most independent creators are 'Custom (DTA units)'.")
prow("mode", "Mode of realisation", "Others - bank transfer", "How the money normally reaches you.")
prow("note", "Invoice footer note (optional)", "Payment due within 30 days of invoice date.", "Payment terms or a thank-you line. Leave blank for none.", height=32)
section(ws, 30, "4 · Rule settings (change only if the rules change)")
prow("edf_days", "EDF filing window (days after month-end)", 30,
     "EDF for services is due within 30 days after the end of the month of invoice. Source: RBI FEMA (Export and Import of Goods and Services) Regulations, 2026, in force 1-Oct-2026.", "0", 44)
prow("months", "Payment deadline, foreign-currency invoices (months)", 9,
     "Export proceeds for services must reach India within 9 months of the invoice date. Source: same Regulations, Reg. 5 as amended Sept 2026.", "0", 44)
prow("months_inr", "Payment deadline, INR invoices (months)", 12,
     "12 months where the export is invoiced or settled in Indian rupees. Source: same Regulations.", "0", 32)
prow("gst_limit", "GST registration threshold (INR per year)", 2000000,
     "Rs 20 lakh aggregate turnover for service providers in most states (lower in a few special-category states). Source: CGST Act, s.22. Used by the Dashboard alert.", "#,##0", 44)
prow("edf_from", "EDF needed for invoices dated on or after", date(2026, 10, 1),
     "The EDF requirement for services began on 1-Oct-2026. Earlier invoices show 'Not required'. Source: same Regulations.", "dd-mmm-yyyy", 32)
section(ws, 37, "Profile status")
put(ws, f"B{P['missing']}", "Details still to complete", F(10, True), border=UNDER)
put(ws, f"B{P['samples']}", "Sample details still in place", F(10, True), border=UNDER)

c = lambda k: f"C{P[k]}"
simple = lambda k, sample=None: (f'=IF({c(k)}="","Missing",' + (f'IF({c(k)}="{sample}","Sample - replace","OK"))' if sample else '"OK")'))
ws[f"D{P['name']}"] = simple("name", SAMPLE_NAME)
ws[f"D{P['addr']}"] = simple("addr", "12 Example Lane, Sample Nagar,\"&CHAR(10)&\"Mumbai, Maharashtra - 400001, India")
pan = c("pan")
ws[f"D{P['pan']}"] = (f'=IF({pan}="","Missing",IF({pan}="{SAMPLE_PAN}","Sample - replace",IF(LEN({pan})<>10,"Check format",'
                      f'IF(AND(SUMPRODUCT((CODE(MID(UPPER({pan}),{{1,2,3,4,5,10}},1))>=65)*(CODE(MID(UPPER({pan}),{{1,2,3,4,5,10}},1))<=90))=6,'
                      f'SUMPRODUCT((CODE(MID({pan},{{6,7,8,9}},1))>=48)*(CODE(MID({pan},{{6,7,8,9}},1))<=57))=4),"OK","Check format"))))')
ws[f"D{P['gst_status']}"] = simple("gst_status")
ws[f"D{P['gstin']}"] = (f'=IF({c("gst_status")}<>"Registered","Not needed",IF({c("gstin")}="","Missing",IF(LEN({c("gstin")})<>15,"Check format",'
                        f'IF(MID(UPPER({c("gstin")}),3,10)<>UPPER({pan}),"PAN mismatch","OK"))))')
ws[f"D{P['lut']}"] = f'=IF({c("gst_status")}<>"Registered","Not needed",IF({c("lut")}="","Recommended","OK"))'
ws[f"D{P['iec']}"] = simple("iec")
ws[f"D{P['sign']}"] = simple("sign", "Riya Sample")
ws[f"D{P['desig']}"] = f'=IF({c("desig")}="","Optional","OK")'
ws[f"D{P['mobile']}"] = f'=IF({c("mobile")}="","Recommended",IF({c("mobile")}="+91 90000 00000","Sample - replace","OK"))'
ws[f"D{P['email']}"] = f'=IF({c("email")}="","Recommended",IF({c("email")}="you@example.com","Sample - replace",IF(ISNUMBER(FIND("@",{c("email")})),"OK","Check format")))'
ws[f"D{P['bank']}"] = simple("bank", "Sample Bank Ltd")
ws[f"D{P['branch']}"] = simple("branch", "Forex Desk, Example Branch, Mumbai, India")
ws[f"D{P['adcode']}"] = f'=IF({c("adcode")}="","Missing",IF({c("adcode")}&""="{SAMPLE_AD}","Sample - replace","OK"))'
ws[f"D{P['acct']}"] = f'=IF({c("acct")}="","Recommended",IF({c("acct")}&""="000000000000","Sample - replace","OK"))'
ws[f"D{P['swift']}"] = f'=IF({c("swift")}="","Optional",IF({c("swift")}="SAMPINBBXXX","Sample - replace","OK"))'
ws[f"D{P['category']}"] = simple("category")
ws[f"D{P['mode']}"] = simple("mode")
ws[f"D{P['note']}"] = f'=IF({c("note")}="","Optional","OK")'
for k in ("edf_days", "months", "months_inr", "gst_limit", "edf_from"):
    ws[f"D{P[k]}"] = f'=IF(AND(ISNUMBER({c(k)}),{c(k)}>0),"OK","Missing")'
chk = f"$D${P['name']}:$D${P['edf_from']}"
put(ws, f"C{P['missing']}", f'=COUNTIF({chk},"Missing*")+COUNTIF({chk},"Check*")+COUNTIF({chk},"PAN mismatch")',
    F(11, True), CALC, A("left"), BOX, "0")
put(ws, f"C{P['samples']}", f'=COUNTIF({chk},"Sample*")', F(11, True), CALC, A("left"), BOX, "0")
put(ws, f"D{P['missing']}", f'=IF(C{P["missing"]}=0,"OK","Fix")', F(9, True), align=A("center"))
put(ws, f"D{P['samples']}", f'=IF(C{P["samples"]}=0,"OK","Sample - replace")', F(9, True), align=A("center"))
put(ws, f"E{P['missing']}", "Rows marked Missing / Check format above.", F(9, False, MID, italic=True))
put(ws, f"E{P['samples']}", "The toolkit ships with fictional sample details so you can see how documents look.", F(9, False, MID, italic=True))
status_cf(ws, f"D6:D{P['samples']}", "D6")
dv_list(ws, c("gst_status"), f"={LST}$M$4:$M$5")
dv_list(ws, c("category"), f"={LST}$K$4:$K$8")
dv_list(ws, c("mode"), f"={LST}$L$4:$L$7")
dv_num(ws, f"C{P['edf_days']}:C{P['gst_limit']}", positive=True)
dv_date(ws, f"C{P['edf_from']}")
ws.freeze_panes = "A5"

# ================================================================== CLIENTS
ws = WS["Clients"]
title(ws, "Clients", "Every platform or brand that pays you from abroad. Add each one once, then pick it in the register.", "J")
put(ws, "B4", "Use the legal entity printed on your payment receipt or contract. The short name is what appears in the dropdown.",
    F(9, False, MID, italic=True))
ws.merge_cells("B4:J4")
heads = [("B", "Short name *", 24), ("C", "Legal entity name *", 30), ("D", "Address *", 40), ("E", "Country *", 16),
         ("F", "Currency *", 11), ("G", "Usual service *", 44), ("H", "SAC code", 11), ("I", "Notes", 34), ("J", "Check", 28)]
ws.row_dimensions[5].height = 30
for col, h, w in heads:
    put(ws, f"{col}5", h, F(9, True, WHITE), VIOLET, A("center"), BOX)
    ws.column_dimensions[col].width = w
ws.column_dimensions["A"].width = 2
ws.column_dimensions["K"].hidden = True
samples = [("Google (AdSense / YouTube)", "Google LLC", "1600 Amphitheatre Parkway\nMountain View, CA 94043", "United States", "USD",
            services[0][0], None, "EXAMPLE - check the payer name on your own payment receipt; some creators are paid by a regional entity."),
           ("Example Brand Inc.", "Example Brand Inc.", "500 Sample Street, Suite 100\nAustin, TX 78701", "United States", "USD",
            services[3][0], None, "EXAMPLE - fictional brand. Overwrite or clear this row.")]
for r in range(C1, CN + 1):
    s = samples[r - C1] if r - C1 < len(samples) else [None] * 8
    for col, v in zip("BCDEFGHI", s):
        put(ws, f"{col}{r}", v, F(9), inp=True, fmt="@" if col == "H" else None, align=A(v="top"))
    ws.row_dimensions[r].height = 40
    put(ws, f"J{r}", f'=IF(B{r}="",IF(COUNTA(C{r}:H{r})>0,"Add a short name",""),IF(COUNTIF($B${C1}:$B${CN},B{r})>1,"Duplicate name",'
                     f'IF(OR(C{r}="",D{r}="",E{r}=""),"Add legal name, address, country",IF(F{r}="","Add currency",IF(G{r}="","Add service","OK")))))',
        F(9, True), align=A("center"), border=BOX)
    ws[f"K{r}"] = f'=IF(B{r}="","",SUMIFS({rr("inr")},{rr("client")},B{r},{rr("h_fy")},{DASH}$C$5)+ROW()/1000000000)'
dv_list(ws, f"F{C1}:F{CN}", f"={CUR_LIST}")
dv_list(ws, f"G{C1}:G{CN}", f"={SVC_LIST}", strict=False)
status_cf(ws, f"J{C1}:J{CN}", f"J{C1}")
put(ws, f"B{CN+2}", "SAC code blank = the suggested code for that service from the Lists sheet. Confirm codes with your CA.",
    F(9, False, MID, italic=True))
ws.merge_cells(f"B{CN+2}:J{CN+2}")
ws.freeze_panes = "C6"

# ========================================================= INVOICE REGISTER
ws = WS["Invoice Register"]
last = RC["notes"]
title(ws, "Invoice Register", "One row per invoice. Type the yellow cells; grey cells calculate themselves.", last)
groups = [("num", "check", "Type these five things", VIOLET), ("cur", "days_left", "Automatic", MID),
          ("edf_filed", "bank_ref", "Fill in later: EDF filed and payment received", VIOLET),
          ("balance", "fx_diff", "Automatic", MID), ("o_cur", "notes", "Optional (leave blank to use the client's defaults)", VIOLET)]
ws.row_dimensions[4].height = 20
for a, b, text, colr in groups:
    merge(ws, f"{RC[a]}4:{RC[b]}4", text, F(9, True, WHITE), colr, A("center"), BOX)
heads = {"num": ("#", 4), "inv": ("Invoice no. *", 20), "date": ("Invoice date *", 13), "client": ("Client *", 26),
         "amt": ("Invoice amount *", 14), "rate": ("Exchange rate *\n(INR per 1 unit)", 14), "check": ("Check", 18),
         "cur": ("Currency", 9), "inr": ("Value in INR", 14), "edf_due": ("File EDF by", 13), "edf_status": ("EDF status", 14),
         "deadline": ("Payment must\narrive by", 13), "pay_status": ("Payment status", 13), "days_left": ("Days left", 8),
         "edf_filed": ("EDF filed on", 13), "recd_on": ("Payment\nreceived on", 13), "recd_amt": ("Amount received\n(invoice currency)", 15),
         "inr_cred": ("INR credited\nto bank", 14), "bank_ref": ("Bank reference /\nFIRA no.", 20),
         "balance": ("Balance\npending", 12), "rate_got": ("Rate you\nactually got", 11), "fx_diff": ("FX gain / (loss)\nINR", 13),
         "o_cur": ("Currency", 10), "o_desc": ("Service description", 40), "o_sac": ("SAC code", 10),
         "o_net": ("Net realisable\nvalue", 13), "contract": ("Contract / PO no.\nand date", 20), "notes": ("Notes", 30)}
ws.row_dimensions[5].height = 40
INP = {"inv", "date", "client", "amt", "rate", "edf_filed", "recd_on", "recd_amt", "inr_cred", "bank_ref",
       "o_cur", "o_desc", "o_sac", "o_net", "contract", "notes"}
for k, (h, w) in heads.items():
    put(ws, f"{RC[k]}5", h, F(9, True, INK), INPUT if k in INP else CALC, A("center"), BOX)
    ws.column_dimensions[RC[k]].width = w
for k in REG_COLS:
    if k.startswith("h_"):
        ws.column_dimensions[RC[k]].hidden = True
        ws[f"{RC[k]}5"] = k
FMT = {"date": "dd-mmm-yyyy", "amt": "#,##0.00", "rate": "0.0000", "inr": "#,##0.00", "edf_due": "dd-mmm-yyyy",
       "deadline": "dd-mmm-yyyy", "days_left": "0", "edf_filed": "dd-mmm-yyyy", "recd_on": "dd-mmm-yyyy",
       "recd_amt": "#,##0.00", "inr_cred": "#,##0.00", "balance": "#,##0.00", "rate_got": "0.0000",
       "fx_diff": "#,##0.00;(#,##0.00);-", "o_net": "#,##0.00", "inv": "@", "o_sac": "@", "bank_ref": "@"}
sample_rows = [
    {"inv": "SAMPLE-001", "date": date(2026, 10, 5), "client": samples[0][0], "amt": 652.30, "rate": 95.80,
     "edf_filed": date(2026, 11, 10), "recd_on": date(2026, 10, 22), "recd_amt": 652.30, "inr_cred": 62390.00,
     "bank_ref": "SAMPLE-FIRA-0001", "notes": "SAMPLE ROW - clear the yellow cells to remove"},
    {"inv": "SAMPLE-002", "date": date(2026, 10, 18), "client": samples[1][0], "amt": 1200.00, "rate": 95.90,
     "contract": "PO-EXAMPLE-77 dt 01-Oct-2026", "notes": "SAMPLE ROW - clear the yellow cells to remove"},
    {"inv": "SAMPLE-003", "date": date(2026, 11, 4), "client": samples[0][0], "amt": 710.45, "rate": 96.05,
     "notes": "SAMPLE ROW - clear the yellow cells to remove"},
]
for r in range(R1, RN + 1):
    x = {k: f"{RC[k]}{r}" for k in REG_COLS}
    s = sample_rows[r - R1] if r - R1 < len(sample_rows) else {}
    for k in INP:
        put(ws, x[k], s.get(k), F(9), inp=True, fmt=FMT.get(k), align=A("left" if k in ("inv", "client", "bank_ref", "o_desc", "contract", "notes", "o_cur", "o_sac") else "right", wrap=False))
    fx = {
        "num": f'=IF({x["inv"]}="","",ROW()-{R1-1})',
        "check": (f'=IF({x["inv"]}="",IF(COUNTA({x["date"]}:{x["rate"]})>0,"Add invoice no.",""),IF(COUNTIF(${RC["inv"]}${R1}:${RC["inv"]}${RN},{x["inv"]})>1,"Duplicate number",'
                  f'IF(NOT(ISNUMBER({x["date"]})),"Add the date",IF({x["client"]}="","Pick a client",IF({x["h_client"]}="","Client not in list",'
                  f'IF(NOT(ISNUMBER({x["amt"]})),"Add the amount",IF(NOT(ISNUMBER({x["rate"]})),"Add exchange rate",IF(OR({x["amt"]}<0,{x["rate"]}<=0),"Check numbers","OK"))))))))'),
        "cur": f'=IF({x["inv"]}="","",IF({x["o_cur"]}<>"",{x["o_cur"]},IF({x["h_client"]}="","",INDEX({cr("F")},{x["h_client"]})&"")))',
        "inr": f'=IF(AND({x["inv"]}<>"",ISNUMBER({x["amt"]}),ISNUMBER({x["rate"]})),ROUND({x["amt"]}*{x["rate"]},2),"")',
        "edf_due": f'=IF({x["h_month"]}="","",IF({x["date"]}<{pf("edf_from")},"",EOMONTH({x["date"]},0)+{pf("edf_days")}))',
        "edf_status": f'=IF({x["h_month"]}="","",IF({x["edf_due"]}="","Not required",IF(ISNUMBER({x["edf_filed"]}),"Filed",IF({TODAY}>{x["edf_due"]},"Late - file now",IF({x["edf_due"]}-{TODAY}<=10,"File soon","To file")))))',
        "deadline": f'=IF({x["h_month"]}="","",EDATE({x["date"]},IF({x["cur"]}="INR",{pf("months_inr")},{pf("months")})))',
        "pay_status": (f'=IF(OR({x["deadline"]}="",{x["h_net"]}=""),"",IF(AND(ISNUMBER({x["recd_amt"]}),{x["recd_amt"]}>={x["h_net"]}-0.005),"Paid",'
                       f'IF({TODAY}>{x["deadline"]},"OVERDUE",IF(AND(ISNUMBER({x["recd_amt"]}),{x["recd_amt"]}>0),"Part paid",IF({x["deadline"]}-{TODAY}<=30,"Due soon","Awaiting")))))'),
        "days_left": f'=IF(OR({x["pay_status"]}="",{x["pay_status"]}="Paid"),"",{x["deadline"]}-{TODAY})',
        "balance": f'=IF({x["h_net"]}="","",ROUND({x["h_net"]}-N({x["recd_amt"]}),2))',
        "rate_got": f'=IF(AND(ISNUMBER({x["recd_amt"]}),ISNUMBER({x["inr_cred"]})),IF({x["recd_amt"]}>0,ROUND({x["inr_cred"]}/{x["recd_amt"]},4),""),"")',
        "fx_diff": f'=IF(AND(ISNUMBER({x["recd_amt"]}),ISNUMBER({x["inr_cred"]}),ISNUMBER({x["rate"]})),ROUND({x["inr_cred"]}-{x["recd_amt"]}*{x["rate"]},2),"")',
        "h_client": f'=IF({x["client"]}="","",IFERROR(MATCH({x["client"]},{cr("B")},0),""))',
        "h_desc": f'=IF({x["inv"]}="","",IF({x["o_desc"]}<>"",{x["o_desc"]},IF({x["h_client"]}="","",INDEX({cr("G")},{x["h_client"]})&"")))',
        "h_sac": (f'=IF({x["inv"]}="","",IF({x["o_sac"]}<>"",{x["o_sac"]}&"",IF({x["h_client"]}="","",IF(INDEX({cr("H")},{x["h_client"]})&""<>"",INDEX({cr("H")},{x["h_client"]})&"",'
                  f'IFERROR(INDEX({LST}$F$4:$F$23,MATCH({x["h_desc"]},{SVC_LIST},0))&"","")))))'),
        "h_net": f'=IF({x["inv"]}="","",IF(ISNUMBER({x["o_net"]}),{x["o_net"]},IF(ISNUMBER({x["amt"]}),{x["amt"]},"")))',
        "h_month": f'=IF(OR({x["inv"]}="",NOT(ISNUMBER({x["date"]}))),"",YEAR({x["date"]})*100+MONTH({x["date"]}))',
        "h_key": f'=IF({x["h_month"]}="","",{x["h_month"]}&"|"&COUNTIF(${RC["h_month"]}${R1}:{x["h_month"]},{x["h_month"]}))',
        "h_fy": f'=IF({x["h_month"]}="","",IF(MONTH({x["date"]})>=4,YEAR({x["date"]})&"-"&RIGHT(YEAR({x["date"]})+1,2),(YEAR({x["date"]})-1)&"-"&RIGHT(YEAR({x["date"]}),2)))',
        "h_sort": f'=IF(OR({x["pay_status"]}="",{x["pay_status"]}="Paid"),"",{x["deadline"]}+ROW()/100000)',
        "h_openinr": f'=IF(AND(ISNUMBER({x["balance"]}),ISNUMBER({x["rate"]})),IF({x["balance"]}>0,ROUND({x["balance"]}*{x["rate"]},2),0),0)',
        "h_unfiled": f'=IF(OR({x["edf_status"]}="",{x["edf_status"]}="Filed",{x["edf_status"]}="Not required"),"",{x["edf_due"]})',
    }
    for k, f_ in fx.items():
        if k.startswith("h_"):
            ws[x[k]] = f_
        else:
            put(ws, x[k], f_, F(9, k in ("check", "edf_status", "pay_status")), CALC, A("center" if k in ("num", "check", "cur", "edf_status", "pay_status", "days_left") else "right", wrap=False), BOX, FMT.get(k))
a, z = f"{R1}", f"{RN}"
dv_date(ws, f'{RC["date"]}{a}:{RC["date"]}{z} {RC["edf_filed"]}{a}:{RC["recd_on"]}{z}')
dv_list(ws, f'{RC["client"]}{a}:{RC["client"]}{z}', f"={cr('B')}", msg="Pick a client from the list. Add new ones on the Clients sheet first.")
dv_num(ws, f'{RC["amt"]}{a}:{RC["amt"]}{z} {RC["recd_amt"]}{a}:{RC["inr_cred"]}{z} {RC["o_net"]}{a}:{RC["o_net"]}{z}')
dv_num(ws, f'{RC["rate"]}{a}:{RC["rate"]}{z}', positive=True)
dv_list(ws, f'{RC["o_cur"]}{a}:{RC["o_cur"]}{z}', f"={CUR_LIST}")
dv_list(ws, f'{RC["o_desc"]}{a}:{RC["o_desc"]}{z}', f"={SVC_LIST}", strict=False)
for k in ("check", "edf_status", "pay_status"):
    status_cf(ws, f"{RC[k]}{a}:{RC[k]}{z}", f"{RC[k]}{a}")
ws.freeze_panes = f"{RC['amt']}{R1}"
ws.auto_filter.ref = f"A5:{last}{RN}"
page(ws, f"A2:{last}{RN}", landscape=True, fit=False)
ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
ws.print_title_rows = "4:5"

# ===================================================================== CALC
ws = WS["Calc"]
put(ws, "A1", "Calculation helpers - do not edit. Everything here is driven by the other sheets.", F(10, True))
put(ws, "A2", "Today")
put(ws, "B2", "=TODAY()", fmt="dd-mmm-yyyy")
ONES = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
        "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
put(ws, "A5", "Ones")
put(ws, "B5", "Tens")
for i, v in enumerate(ONES):
    ws[f"A{6+i}"] = v
for i, v in enumerate(TENS):
    ws[f"B{6+i}"] = v


def words3(m):
    o, t = "$A$6:$A$25", "$B$6:$B$15"
    return (f'=IF({m}="","",IF({m}=0,"",IF({m}>=100,INDEX({o},INT({m}/100)+1)&" Hundred"&IF(MOD({m},100)=0,""," "),"")&'
            f'IF(MOD({m},100)=0,"",IF(MOD({m},100)<20,INDEX({o},MOD({m},100)+1),INDEX({t},INT(MOD({m},100)/10)+1)&'
            f'IF(MOD({m},10)=0,""," "&INDEX({o},MOD({m},10)+1))))))')


SEL = "$B$28"
labels = {28: "Selected invoice row", 29: "Selected month key", 30: "Single-invoice EDF?", 31: "Invoices on EDF",
          32: "EDF total INR", 33: "Invoices in month", 34: "Same recipient on all rows", 35: "Same service on all rows",
          36: "Earliest payment deadline", 37: "Signing date used", 38: "Realisation date used", 39: "Mode used",
          40: "EDF period label", 41: "Longest name+address", 42: "Same country on all rows", 43: "EDF rows with gaps"}
for r, t in labels.items():
    put(ws, f"A{r}", t)
T1, TN = 46, 46 + EDF_ROWS - 1
ws["B28"] = f'=IF({DOC}$C$6="","",IFERROR(MATCH({DOC}$C$6,{rr("inv")},0),""))'
ws["B29"] = f'=IF({SEL}="","",INDEX({rr("h_month")},{SEL}))'
ws["B30"] = f'={DOC}$C$7={LST}$N$5'
ws["B31"] = f"=COUNT(B{T1}:B{TN})"
ws["B32"] = f"=SUM(N{T1}:N{TN})"
ws["B33"] = f'=IF(B29="",0,COUNTIF({rr("h_month")},B29))'
ws["B34"] = f"=COUNTIF(E{T1}:E{TN},E{T1})=B31"
ws["B35"] = f"=COUNTIF(L{T1}:L{TN},L{T1})=B31"
ws["B36"] = f'=IF(COUNT(O{T1}:O{TN})=0,"",MIN(O{T1}:O{TN}))'
ws["B37"] = f'=IF(ISNUMBER({DOC}$C$9),{DOC}$C$9,B2)'
ws["B38"] = f'=IF(ISNUMBER({DOC}$C$10),{DOC}$C$10,B36)'
ws["B39"] = f'=IF({DOC}$C$11<>"",{DOC}$C$11,{pf("mode")})'
ws["B40"] = (f'=IF({SEL}="","",IF(B30,"Invoice "&{DOC}$C$6,INDEX({MONFULL},MOD(B29,100))&" "&INT(B29/100)))')
ws["B41"] = f'=SUMPRODUCT(MAX(LEN(E{T1}:E{TN})+LEN(F{T1}:F{TN})))'
ws["B42"] = f"=COUNTIF(G{T1}:G{TN},G{T1})=B31"
ws["B43"] = f'=SUMPRODUCT((B{T1}:B{TN}<>"")*(((E{T1}:E{TN}="")+(F{T1}:F{TN}="")+(G{T1}:G{TN}="")+(N{T1}:N{TN}="")+(L{T1}:L{TN}=""))>0))'
for r in (36, 37, 38):
    ws[f"B{r}"].number_format = "dd-mmm-yyyy"


def lookups(idx):
    """Formulas that pull one register row (by index cell) into named fields."""
    g = lambda k, txt=False: f'=IF({idx}="","",INDEX({rr(k)},{idx}){"&\"\"" if txt else ""})'
    cl = lambda col: f'=IF({idx}="","",IFERROR(INDEX({cr(col)},INDEX({rr("h_client")},{idx}))&"",""))'
    return {"inv": g("inv", True), "date": g("date"), "legal": cl("C"), "addr": cl("D"), "country": cl("E"),
            "cur": g("cur", True), "amt": g("amt"), "net": g("h_net"), "contract": g("contract", True),
            "desc": g("h_desc", True), "sac": g("h_sac", True), "inr": g("inr"), "deadline": g("deadline"),
            "rate": g("rate"), "edf_due": g("edf_due")}


TCOLS = {"inv": "C", "date": "D", "legal": "E", "addr": "F", "country": "G", "cur": "H", "amt": "I", "net": "J",
         "contract": "K", "desc": "L", "sac": "M", "inr": "N", "deadline": "O"}
put(ws, f"A{T1-1}", "k")
put(ws, f"B{T1-1}", "row")
for k, col in TCOLS.items():
    put(ws, f"{col}{T1-1}", k)
for i in range(EDF_ROWS):
    r = T1 + i
    ws[f"A{r}"] = i + 1
    ws[f"B{r}"] = (f'=IF({SEL}="","",IF($B$30,{f"{SEL}" if i == 0 else chr(34)*2},IFERROR(MATCH($B$29&"|"&A{r},{rr("h_key")},0),"")))')
    for k, f_ in lookups(f"$B{r}").items():
        if k in TCOLS:
            ws[f"{TCOLS[k]}{r}"] = f_
            if k in ("date", "deadline"):
                ws[f"{TCOLS[k]}{r}"].number_format = "dd-mmm-yyyy"
# selected invoice record
S = {"inv": 58, "date": 59, "legal": 60, "addr": 61, "country": 62, "cur": 63, "amt": 64, "net": 65, "contract": 66,
     "desc": 67, "sac": 68, "inr": 69, "deadline": 70, "rate": 71, "edf_due": 72}
put(ws, "A57", "Selected invoice", F(10, True))
for k, f_ in lookups(SEL).items():
    put(ws, f"A{S[k]}", k)
    ws[f"B{S[k]}"] = f_
    if k in ("date", "deadline", "edf_due"):
        ws[f"B{S[k]}"].number_format = "dd-mmm-yyyy"
sel = lambda k: f"{CAL}$B${S[k]}"
# amount in words: selected invoice, international system
put(ws, "D4", "Invoice amount in words", F(10, True))
ws["E5"] = f'=IF(ISNUMBER(B{S["amt"]}),IF(AND(B{S["amt"]}>=0,B{S["amt"]}<1000000000000),ROUND(B{S["amt"]},2),""),"")'
for r, (lab, f_) in enumerate([("Billion", 'INT(E5/1000000000)'), ("Million", 'MOD(INT(E5/1000000),1000)'),
                               ("Thousand", 'MOD(INT(E5/1000),1000)'), ("Units", 'MOD(INT(E5),1000)'),
                               ("Small", 'ROUND((E5-INT(E5))*100,0)')], start=6):
    put(ws, f"D{r}", lab)
    ws[f"E{r}"] = f'=IF($E$5="","",{f_})'
    ws[f"F{r}"] = words3(f"E{r}")
ws["E11"] = f'=IF(B{S["cur"]}="","",IFERROR(INDEX({LST}$B$4:$B$23,MATCH(B{S["cur"]},{CUR_LIST},0)),B{S["cur"]}))'
ws["E12"] = f'=IF(B{S["cur"]}="","",IFERROR(INDEX({LST}$C$4:$C$23,MATCH(B{S["cur"]},{CUR_LIST},0)),"Cents"))'
ws["E13"] = '=IF(E5="","",TRIM(IF(E6>0,F6&" Billion ","")&IF(E7>0,F7&" Million ","")&IF(E8>0,F8&" Thousand ","")&IF(E9>0,F9,IF(E5<1,"Zero",""))))'
ws["E14"] = '=IF(E5="","",E11&" "&E13&IF(E10>0," and "&F10&" "&E12,"")&" Only.")'
# amount in words: EDF total INR, Indian system
put(ws, "H4", "EDF total (INR) in words", F(10, True))
ws["I5"] = '=IF(AND(B31>0,B32<10000000000),ROUND(B32,2),"")'
for r, (lab, f_) in enumerate([("Crore", 'INT(I5/10000000)'), ("Lakh", 'MOD(INT(I5/100000),100)'),
                               ("Thousand", 'MOD(INT(I5/1000),100)'), ("Units", 'MOD(INT(I5),1000)'),
                               ("Paise", 'ROUND((I5-INT(I5))*100,0)')], start=6):
    put(ws, f"H{r}", lab)
    ws[f"I{r}"] = f'=IF($I$5="","",{f_})'
    ws[f"J{r}"] = words3(f"I{r}")
ws["I13"] = ('=IF(I5="","","Indian Rupees "&TRIM(IF(I6>0,J6&" Crore ","")&IF(I7>0,J7&" Lakh ","")&IF(I8>0,J8&" Thousand ","")'
             '&IF(I9>0,J9,IF(I5<1,"Zero","")))&IF(I10>0," and "&J10&" Paise","")&" Only.")')
widths(ws, {"A": 28, "B": 22, "C": 16, "D": 14, "E": 26, "F": 30, "G": 16, "H": 12, "I": 16, "J": 30, "L": 40})
INV_WORDS, INR_WORDS = f"{CAL}$E$14", f"{CAL}$I$13"
cv = lambda r: f"{CAL}$B${r}"

# ================================================================ DOCUMENTS
ws = WS["Documents"]
title(ws, "Create your documents", "Pick an invoice, check the status, then save the Export Invoice and EDF as PDF.", "D")
widths(ws, {"A": 2, "B": 48, "C": 56, "D": 74})


def drow(r, label, value=None, hint=None, inp=False, fmt=None, bold=False):
    put(ws, f"B{r}", label, F(10, True), border=UNDER)
    if inp:
        put(ws, f"C{r}", value, inp=True, fmt=fmt)
    else:
        put(ws, f"C{r}", value, F(10, bold), CALC, A("left"), BOX, fmt)
    put(ws, f"D{r}", hint, F(9, False, MID, italic=True))
    ws.row_dimensions[r].height = 22


section(ws, 5, "Step 1 · Choose", last="D")
drow(6, "Invoice to print", "SAMPLE-001", "Pick from your Invoice Register.", True, "@")
drow(7, "EDF covers", "All invoices of the same month", "One EDF can cover all your service invoices of a month - or just this one.", True)
drow(8, "EDF form number (optional)", None, "Only if your bank has given one.", True, "@")
drow(9, "Signing date (blank = today)", None, "Date you sign the EDF and letters.", True, "dd-mmm-yyyy")
drow(10, "Realisation date to declare (blank = automatic)", None, "Automatic = the earliest payment deadline of the invoices on this EDF.", True, "dd-mmm-yyyy")
drow(11, "Mode of realisation (blank = My Profile default)", None, "Change only if this payment arrives differently.", True)
dv_list(ws, "C6", f"={rr('inv')}", msg="Pick an invoice number that exists in the Invoice Register.")
dv_list(ws, "C7", f"={LST}$N$4:$N$5")
dv_date(ws, "C9:C10")
dv_list(ws, "C11", f"={LST}$L$4:$L$7")
section(ws, 13, "Step 2 · Check", last="D")
drow(14, "Overall status", '=IF(COUNTIF(C15:C21,"Fix")>0,"NOT READY - fix the red items below",IF(COUNTIF(C15:C21,"Sample*")>0,'
     '"SAMPLE PREVIEW - replace sample details before filing",IF(COUNTIF(C15:C21,"Check")>0,"READY - read the amber notes first","READY TO PRINT")))', None, bold=True)
ws.row_dimensions[14].height = 28
ws["C14"].font = F(11, True)
checks = [
    (15, "My Profile is complete", f'=IF({pf("missing")}=0,"OK","Fix")',
     f'=IF(C15="OK","",{pf("missing")}&" detail(s) to complete on the My Profile sheet.")'),
    (16, "Sample details replaced", f'=IF(OR({pf("samples")}>0,LEFT(C6&"",6)="SAMPLE"),"Sample","OK")',
     '=IF(C16="OK","","Fictional sample details are still in use (My Profile or a SAMPLE invoice).")'),
    (17, "Invoice found and valid", f'=IF({cv(28)}="","Fix",IF(INDEX({rr("check")},{cv(28)})="OK","OK","Fix"))',
     f'=IF(C17="OK","",IF({cv(28)}="","Pick an invoice number above.","Register says: "&INDEX({rr("check")},{cv(28)})))'),
    (18, "Every invoice on the EDF is complete", f'=IF({cv(28)}="","Fix",IF({cv(43)}=0,"OK","Fix"))',
     f'=IF(C18="OK","",{cv(43)}&" invoice(s) missing client name, address, country, service or INR value.")'),
    (19, "GST wording on the invoice", f'=IF(AND({pf("gst_status")}="Registered",{pf("lut")}=""),"Check","OK")',
     '=IF(C19="OK","","GST-registered but no LUT ARN. Ask your CA how this export should be invoiced.")'),
    (20, "Invoices fit on one EDF", f'=IF(AND(NOT({cv(30)}),{cv(33)}>{EDF_ROWS}),"Fix","OK")',
     f'=IF(C20="OK","","This month has "&{cv(33)}&" invoices; one EDF holds {EDF_ROWS}. Use \'Only this invoice\' for the extra ones.")'),
    (21, "Addresses fit in the EDF table", f'=IF({cv(41)}>170,"Check","OK")',
     '=IF(C21="OK","","A long recipient name/address may be cut off in the EDF table. Shorten it on the Clients sheet.")'),
]
for r, lab, f_, hint in checks:
    drow(r, lab, f_, hint, bold=True)
    ws[f"C{r}"].alignment = A("center")
    ws[f"D{r}"].font = F(9, False, RED)
status_cf(ws, "C14:C21", "C14")
section(ws, 23, "What will be printed", last="D")
drow(24, "Recipient", f'={sel("legal")}&IF({sel("country")}="","",", "&{sel("country")})')
drow(25, "Invoice date", f'=IF({sel("date")}="","",{sel("date")})', fmt="dd-mmm-yyyy")
drow(26, "Invoice amount", f'=IF({sel("amt")}="","",{sel("cur")}&" "&TEXT({sel("amt")},"#,##0.00"))')
drow(27, "Value in INR", f'=IF({sel("inr")}="","",{sel("inr")})', fmt="#,##0.00")
drow(28, "EDF covers", f'={cv(40)}')
drow(29, "Invoices on this EDF", f'={cv(31)}', fmt="0")
drow(30, "EDF total (INR)", f'={cv(32)}', fmt="#,##0.00")
drow(31, "File this EDF with your bank by", f'=IF({sel("inv")}="","",IF({sel("edf_due")}="","Not required for this invoice date",{sel("edf_due")}))',
     "Within 30 days after the end of the invoice month (setting on My Profile).", fmt="dd-mmm-yyyy")
drow(32, "Realisation date declared on the EDF", f'=IF({cv(38)}="","",{cv(38)})', fmt="dd-mmm-yyyy")
drow(33, "Suggested PDF file name", f'=IF(C6="","",SUBSTITUTE(C6&""," ","_")&"_Invoice_EDF")', "Copy this when you save the PDF.")
section(ws, 35, "Step 3 · Open a document and save it as PDF", last="D")
links = [(36, "Export Invoice", "The invoice you send to the platform / brand and keep for GST."),
         (37, "EDF Form", "Export Declaration Form (2 pages). Sign and give to your bank."),
         (38, "EDF Cover Letter", "Optional covering letter listing the invoices enclosed with the EDF."),
         (39, "Bank Letter", "One-time letter asking your bank to confirm its AD code.")]
for r, name, hint in links:
    link(ws, f"B{r}", f"Open  {name}  >", f"#'{name}'!A1")
    put(ws, f"C{r}", hint, F(9, False, MID))
    ws.merge_cells(f"C{r}:D{r}")
    ws.row_dimensions[r].height = 20
howto = ["Excel: open the document tab, then File > Print > choose 'Microsoft Print to PDF' or 'Save as PDF'. Page size and scaling are already set to A4.",
         "Google Sheets: File > Download > PDF, choose 'Current sheet', paper A4, scale 'Fit to width'.",
         "Phone: open the tab and use Share > Print > Save as PDF.",
         "Always read the PDF once before you sign it. You are responsible for what you file."]
for i, t in enumerate(howto):
    merge(ws, f"B{41+i}:D{41+i}", "•  " + t, F(9, False, INK), align=A(indent=1))
    ws.row_dimensions[41 + i].height = 18
ws.freeze_panes = "A5"

# =========================================================== EXPORT INVOICE
ws = WS["Export Invoice"]
widths(ws, {"A": 9, "B": 27, "C": 14, "D": 12, "E": 12, "F": 12, "G": 18})
for r, h in {1: 6, 2: 30, 3: 16, 4: 16, 5: 16, 6: 16, 7: 10, 12: 10, 13: 18, 14: 16, 15: 16, 16: 16, 17: 16, 18: 16, 19: 12,
             20: 22, 21: 70, 22: 24, 23: 8, 24: 30, 25: 18, 26: 8, 27: 34, 28: 30, 29: 14, 30: 16, 31: 52, 32: 16, 33: 16}.items():
    ws.row_dimensions[r].height = h
merge(ws, "A1:G1", None, bg=VIOLET)
merge(ws, "A2:D2", f'={pf("name")}&""', F(16, True, INK), align=A(v="center"))
merge(ws, "E2:G2", "EXPORT INVOICE", F(16, True, VIOLET_DK), align=A("right"))
merge(ws, "A3:D6", f'={pf("addr")}&""', F(9.5, False, MID), align=A(v="top"))
for r, lab, f_ in [(3, "Invoice no.", f'={sel("inv")}'), (4, "Invoice date", f'=IF({sel("date")}="","",{dtxt(sel("date"))})'),
                   (5, "Currency", f'={sel("cur")}'), (6, "Place of supply", '="Outside India (export)"')]:
    put(ws, f"E{r}", lab, F(9, False, MID), align=A("right"))
    merge(ws, f"F{r}:G{r}", f_, F(10, True), align=A("right"))
for r, lab, f_ in [(8, "GSTIN", f'=IF({pf("gst_status")}="Registered",{pf("gstin")}&"","Not registered")'), (9, "PAN", f'={pf("pan")}&""'),
                   (10, "IEC", f'={pf("iec")}&""'), (11, "LUT ARN", f'=IF({pf("gst_status")}="Registered",IF({pf("lut")}="","-",{pf("lut")}&""),"Not applicable")')]:
    put(ws, f"A{r}", lab, F(9, False, MID))
    merge(ws, f"B{r}:D{r}", f_, F(9.5, True))
    ws.row_dimensions[r].height = 15
merge(ws, "A13:D13", "BILLED TO (SERVICE RECIPIENT)", F(9, True, VIOLET_DK), border=UNDER)
merge(ws, "A14:D18", f'={sel("legal")}&IF({sel("addr")}="","",CHAR(10)&{sel("addr")})&IF({sel("country")}="","",CHAR(10)&{sel("country")})',
      F(10), align=A(v="top"))
merge(ws, "E13:G13", "PAY TO (BANK DETAILS)", F(9, True, VIOLET_DK), border=UNDER)
merge(ws, "E14:G18", f'="Account name: "&{pf("name")}&CHAR(10)&"Bank: "&{pf("bank")}&IF({pf("acct")}="","",CHAR(10)&"Account no.: "&{pf("acct")})'
      f'&IF({pf("swift")}="","",CHAR(10)&"SWIFT / BIC: "&{pf("swift")})&CHAR(10)&"Branch: "&{pf("branch")}', F(9), align=A(v="top"))
hdr = dict(font=F(9, True, WHITE), bg=VIOLET, border=BOX_DK)
put(ws, "A20", "#", align=A("center"), **hdr)
merge(ws, "B20:D20", "Description of services", align=A("left", indent=1), **hdr)
put(ws, "E20", "SAC", align=A("center"), **hdr)
put(ws, "F20", "Currency", align=A("center"), **hdr)
put(ws, "G20", "Amount", align=A("right", indent=1), **hdr)
put(ws, "A21", f'=IF({sel("inv")}="","",1)', F(10), align=A("center", "top"), border=BOX_DK)
merge(ws, "B21:D21", f'={sel("desc")}&IF({sel("contract")}="","",CHAR(10)&"Ref: "&{sel("contract")})', F(10), align=A("left", "top", indent=1), border=BOX_DK)
put(ws, "E21", f'={sel("sac")}', F(10), align=A("center", "top"), border=BOX_DK)
put(ws, "F21", f'={sel("cur")}', F(10), align=A("center", "top"), border=BOX_DK)
put(ws, "G21", f'=IF({sel("amt")}="","",{sel("amt")})', F(10), align=A("right", "top", indent=1), border=BOX_DK, fmt="#,##0.00")
merge(ws, "A22:F22", f'="Total invoice value ("&{sel("cur")}&")"', F(10.5, True), VIOLET_SOFT, A("left", indent=1), BOX_DK)
put(ws, "G22", f'=IF({sel("amt")}="","",{sel("amt")})', F(10.5, True), VIOLET_SOFT, A("right", indent=1), BOX_DK, "#,##0.00")
merge(ws, "A24:G24", f'=IF({INV_WORDS}="","","Amount in words: "&{INV_WORDS})', F(10, True))
merge(ws, "A25:G25", f'=IF(OR({sel("inr")}="",{sel("cur")}="INR"),"","INR equivalent: INR "&TEXT({sel("inr")},"#,##0.00")&"  (at 1 "&{sel("cur")}&" = INR "&TEXT({sel("rate")},"0.00##")&")")',
      F(9, False, MID))
merge(ws, "A27:G27", f'=IF({pf("gst_status")}="Registered","SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX."'
      f'&IF({pf("lut")}="","",CHAR(10)&"LUT ARN: "&{pf("lut")}),"Export of services. Supplier is not registered under GST.")',
      F(9, True), CREAM, A(indent=1), BOX)
merge(ws, "A28:G28", f'={pf("note")}&""', F(9, False, MID), align=A(v="top"))
merge(ws, "E30:G30", f'="For "&{pf("name")}', F(10, True), align=A("right"))
merge(ws, "E31:G31", None)
merge(ws, "E32:G32", f'={pf("sign")}&""', F(10, True), align=A("right"), border=Border(top=DARK))
merge(ws, "E33:G33", f'="Authorised signatory"&IF({pf("desig")}="","",", "&{pf("desig")})', F(9, False, MID), align=A("right"))
page(ws, "A1:G33")

# ================================================================= EDF FORM
ws = WS["EDF Form"]
widths(ws, {"A": 4, "B": 18, "C": 8, "D": 11, "E": 9.5, "F": 7.5, "G": 9, "H": 9, "I": 10, "J": 14, "K": 7, "L": 8})
E_F, E_B = F(9), F(9, True)
SM = F(8)


def ebox(rng, value, font=E_F, align=None, h=None):
    merge(ws, rng, value, font, align=align or A(v="center"), border=BOX_DK)
    if h:
        ws.row_dimensions[int("".join(ch for ch in rng.split(":")[0] if ch.isdigit()))].height = h


NA = "Not applicable"
consignee = (f'IF({cv(31)}=0,"",IF({cv(34)},{CAL}$E${T1}&CHAR(10)&{CAL}$F${T1},"Multiple service recipients - as listed in Section 2B"))')
gst_line = f'IF({pf("gst_status")}="Registered",{pf("gstin")}&"","Not registered")'
merge(ws, "A1:L1", "Export Declaration Form", F(13, True), align=A("center"))
ws.row_dimensions[1].height = 26
ws.row_dimensions[2].height = 6
ebox("A3:L3", "1. General Information:", E_B, h=18)
ebox("A4:F4", "Type of export: Services", E_B)
ebox("G4:L4", f'="Form No.: "&{DOC}$C$8', h=22)
ebox("A5:F5", f"Shipping Bill No. & Date: {NA}")
ebox("G5:L5", "Mode of Transport / Delivery: Internet", h=28)
ebox("A6:F6", f'="Category of Exporter: "&{pf("category")}')
ebox("G6:L6", f'="AD code: "&{pf("adcode")}', h=28)
ebox("A7:F7", f'="IE Code: "&{pf("iec")}&CHAR(10)&"GSTIN: "&{gst_line}&CHAR(10)&"PAN: "&{pf("pan")}')
ebox("G7:L7", f'="AD Name & Address:"&CHAR(10)&{pf("bank")}&CHAR(10)&{pf("branch")}', h=48)
ebox("A8:F8", f'="Exporter Name & Address:"&CHAR(10)&{pf("name")}&CHAR(10)&{pf("addr")}')
ebox("G8:L8", f'="Mode of Realisation: "&{cv(39)}', h=68)
ebox("A9:F9", f'="Consignee Name & Address:"&CHAR(10)&{consignee}')
ebox("G9:L9", f"Port of Loading / Source Port in case of SEZ: {NA}", h=68)
ebox("A10:F10", f"Third Party Name & Address (for third-party export payments): {NA}\nRelationship between Exporter & Third Party: {NA}")
ebox("G10:I10", f'="Country of Final Destination: "&IF({cv(31)}=0,"",IF({cv(42)},{CAL}$G${T1},"As listed in Section 2B"))')
ebox("J10:L10", f"Port of Discharge: {NA}", h=46)
ebox("A11:F11", f'="Name of the AD and AD code, in case of LC / BG: "&IF(OR({cv(39)}="L/C",{cv(39)}="BG"),{pf("bank")}&" / "&{pf("adcode")},"{NA}")')
ws.row_dimensions[11].height = 30
ebox("A12:F12", f'="Description of Goods / Services: "&IF({cv(31)}=0,"",IF({cv(35)},{CAL}$L${T1},"Services as listed in Section 2B"))')
ws.row_dimensions[12].height = 34
ebox("G11:L12", f"Date of Let Export Order (LEO): {NA}")
ebox("A13:L13", f'="Total FOB / Services value in words (INR): "&{INR_WORDS}', h=32)
ebox("A14:L14", "2A. Details of Export Value^ of Goods (This part shall be repeated for each invoice drawn under a shipping bill)", E_B, h=26)
ws.row_dimensions[15].height = 5
ebox("A16:C16", "Particulars", E_B)
ebox("D16:G16", "Currency", E_B)
ebox("H16:L16", "Amount", E_B, h=18)
for i, t in enumerate(["FOB / Services Value", "Freight / Transmission", "Insurance", "Commission", "Discount", "Other Deduction", "Packing Charges"]):
    r = 17 + i
    ebox(f"A{r}:C{r}", t)
    ebox(f"D{r}:G{r}", None)
    ebox(f"H{r}:L{r}", None, h=18)
ebox("A24:C24", "Full export value / Net Realisable export value", E_B)
ebox("D24:G24", None)
ebox("H24:L24", NA, h=28)
ws.row_dimensions[25].height = 6
# ---- page 2
ebox("A26:L26", "2B. Details of Export Value^ of Services", E_B, h=18)
ebox("A27:L27", "Details of services provided to multiple recipients", h=16)
HB = F(8, True)
hc = A("center")
ebox("A28:A29", "S. No.", HB, hc)
ebox("B28:B29", "Service recipient Name & Address", HB, hc)
ebox("C28:C29", "Country", HB, hc)
ebox("D28:G28", "Details of Invoice", HB, hc)
for col, t in zip("DEFG", ["Invoice No.", "Date", "Currency", "Amount"]):
    ebox(f"{col}29", t, HB, hc)
ebox("H28:H29", "Net Realisable value", HB, hc)
ebox("I28:I29", "Contract No., if any, and Date", HB, hc)
ebox("J28:J29", "Description of services", HB, hc)
ebox("K28:K29", "SAC Code", HB, hc)
ebox("L28:L29", "Remarks", HB, hc)
ws.row_dimensions[28].height = 16
ws.row_dimensions[29].height = 26
E1 = 30
for i in range(EDF_ROWS):
    r, t = E1 + i, T1 + i
    cc = lambda col: f"{CAL}${col}${t}"
    has = f'{cc("B")}=""'
    row = {"A": (f'=IF({has},"",{i+1})', hc), "B": (f'=IF({has},"",{cc("E")}&CHAR(10)&SUBSTITUTE({cc("F")},CHAR(10),", "))', A(v="center")),
           "C": (f'={cc("G")}', hc), "D": (f'={cc("C")}', hc), "E": (f'=IF({cc("D")}="","",{dtxt(cc("D"))})', hc),
           "F": (f'={cc("H")}', hc), "G": (f'=IF({cc("I")}="","",TEXT({cc("I")},"#,##0.00"))', A("right")),
           "H": (f'=IF({cc("J")}="","",TEXT({cc("J")},"#,##0.00"))', A("right")),
           "I": (f'=IF({has},"",IF({cc("K")}="","{NA}",{cc("K")}))', hc), "J": (f'={cc("L")}', A(v="center")),
           "K": (f'={cc("M")}', hc), "L": (f'=IF({has},"","{NA}")', hc)}
    for col, (f_, al) in row.items():
        put(ws, f"{col}{r}", f_, SM, align=al, border=BOX_DK)
    ws.row_dimensions[r].height = 44
r = E1 + EDF_ROWS            # 40
ws.row_dimensions[r].height = 6
ebox(f"A{r+1}:L{r+1}", "3. Applicable for Export under FPO / Couriers", E_B, h=18)
ebox(f"A{r+2}:F{r+2}", f"Name of the Foreign Post Office / Courier: {NA}\n\nNumber & date of Parcel receipts: {NA}")
ebox(f"G{r+2}:L{r+2}", "Stamp & Signature of Authorised Dealer", h=54)
ws.row_dimensions[r + 3].height = 6
ebox(f"A{r+4}:L{r+4}", "4. Declaration by the Exporters (All types of exports)", E_B, h=18)
decl = ('="I / We hereby declare that I / we am / are the seller / consignor of the goods / provider of services in respect of which this declaration is made '
        'and that the particulars given above are true and that the value to be received from the buyer / third party represents the export value^ contracted '
        'and declared above. I / We undertake that I / we have delivered / will deliver to the authorised dealer named above the foreign exchange / Indian Rupees '
        f'representing the full value of the goods / services exported as above on or before "&IF({cv(38)}="","........................",{dtxt(cv(38))})'
        '&" (i.e. within the period of realisation stipulated by RBI from time to time) in the manner specified in the Regulations made under the Foreign Exchange '
        'Management Act, 1999."&CHAR(10)&"I / We also undertake to submit the documents pertaining to exports declared in this form, to the Authorised Dealer named above, '
        'as may be required under the Act."')
ebox(f"A{r+5}:L{r+5}", decl, h=104)
ebox(f"A{r+6}:F{r+6}", f'="Date: "&{dtxt(cv(37))}')
ebox(f"G{r+6}:L{r+6}", f'={pf("sign")}&CHAR(10)&"(Signature of Exporter)"', align=A(v="bottom"), h=50)
ws.row_dimensions[r + 7].height = 6
ebox(f"A{r+8}:L{r+8}", "5. Space for use of Specified Authority (Custom / SEZ / AD / STPI):", E_B, h=18)
ebox(f"A{r+9}:L{r+9}", "Certified, on the basis of above declaration at 4, that the goods / services described above and the export value^ declared by the "
     "exporter in this form is as per the corresponding invoice / gist of invoices submitted and declared by the exporter.", h=48)
ebox(f"A{r+10}:C{r+10}", "Date:")
ebox(f"D{r+10}:L{r+10}", "(Signature of Designated / Authorised officials of Custom / SEZ / Authorised Dealer / STPI)", align=A(v="bottom"), h=38)
ws.row_dimensions[r + 11].height = 6
notes = ["1. @ Strike out whichever is not applicable.",
         "2. ^ If the full export value is not ascertainable at the time of export, the value which the exporter, having regard to the prevailing market "
         "conditions expects to receive on the sale of the goods in overseas market.",
         "3. Export value may be indicated as nil in case the goods are sent without any consideration."]
for i, t in enumerate(notes):
    merge(ws, f"A{r+12+i}:L{r+12+i}", t, F(7.5), align=A(v="top"))
    ws.row_dimensions[r + 12 + i].height = 22 if i == 1 else 13
EDF_LAST = r + 14
page(ws, f"A1:L{EDF_LAST}", fit=False, scale=80)
ws.page_margins.left = ws.page_margins.right = 0.3
ws.page_margins.top = ws.page_margins.bottom = 0.3
ws.row_breaks.append(Break(id=25))

# ========================================================= EDF COVER LETTER
ws = WS["EDF Cover Letter"]
widths(ws, {"A": 5, "B": 20, "C": 13, "D": 34, "E": 10, "F": 15, "G": 17})
LT = F(10.5)


def para(r, text, h=16, font=LT, last="G", align=None):
    merge(ws, f"A{r}:{last}{r}", text, font, align=align or A(v="top"))
    ws.row_dimensions[r].height = h


def letter_head(ws_):
    global ws
    ws = ws_
    para(1, f'={pf("name")}&""', 22, F(14, True))
    para(2, f'=SUBSTITUTE({pf("addr")},CHAR(10)," ")', 16, F(9, False, MID))
    para(3, f'="PAN: "&{pf("pan")}&IF({pf("mobile")}="","","   |   Mobile: "&{pf("mobile")})&IF({pf("email")}="","","   |   Email: "&{pf("email")})', 16, F(9, False, MID))
    for row in ws["A4:G4"]:
        for c_ in row:
            c_.border = Border(top=Side(style="medium", color=VIOLET))
    ws.row_dimensions[4].height = 10
    para(5, f'="Date: "&{dtxt(cv(37))}', 18)
    para(7, "To,")
    para(8, "The Branch Manager / Forex Department")
    para(9, f'={pf("bank")}&""', 16, F(10.5, True))
    para(10, f'={pf("branch")}&""', 30)


letter_head(ws)
para(12, f'="Subject: Submission of Export Declaration Form (EDF) for export of services - "&{cv(40)}', 30, F(10.5, True))
para(14, "Dear Sir / Madam,")
para(16, f'="I / We, "&{pf("name")}&IF({pf("acct")}="","",", holding account no. "&{pf("acct")}&" with your bank")&", submit herewith the duly signed Export Declaration '
     f'Form (EDF) for the export of services invoiced as listed below, together with copies of the invoices."', 46)
hd = dict(font=F(9, True, WHITE), bg=VIOLET, border=BOX_DK, align=A("center"))
for col, t in zip("ABCDEFG", ["#", "Invoice no.", "Invoice date", "Service recipient", "Currency", "Amount", "Value in INR"]):
    put(ws, f"{col}18", t, **hd)
ws.row_dimensions[18].height = 20
for i in range(EDF_ROWS):
    r, t = 19 + i, T1 + i
    cc = lambda col: f"{CAL}${col}${t}"
    vals = {"A": (f'=IF({cc("B")}="","",{i+1})', A("center"), None), "B": (f'={cc("C")}', A(), None),
            "C": (f'=IF({cc("D")}="","",{dtxt(cc("D"))})', A("center"), None), "D": (f'={cc("E")}', A(), None),
            "E": (f'={cc("H")}', A("center"), None), "F": (f'=IF({cc("I")}="","",{cc("I")})', A("right"), "#,##0.00"),
            "G": (f'=IF({cc("N")}="","",{cc("N")})', A("right"), "#,##0.00")}
    for col, (f_, al, fm) in vals.items():
        put(ws, f"{col}{r}", f_, F(9), align=al, border=BOX_DK, fmt=fm)
    ws.row_dimensions[r].height = 18
r = 19 + EDF_ROWS
merge(ws, f"A{r}:F{r}", "Total value in INR", F(9.5, True), VIOLET_SOFT, A("right", indent=1), BOX_DK)
put(ws, f"G{r}", f'={cv(32)}', F(9.5, True), VIOLET_SOFT, A("right"), BOX_DK, "#,##0.00")
ws.row_dimensions[r].height = 20
para(r + 2, f'="The export proceeds have been received / will be received in the above account. AD code quoted in the EDF: "&{pf("adcode")}&"."', 32)
para(r + 4, "Kindly take the EDF on record, return an acknowledged copy, and let me / us know if any further document is required.", 32)
para(r + 6, "Thank you.")
para(r + 8, "Yours faithfully,")
ws.row_dimensions[r + 9].height = 46
para(r + 10, f'={pf("sign")}&IF({pf("desig")}="","",", "&{pf("desig")})', 16, F(10.5, True))
para(r + 11, f'="For "&{pf("name")}')
para(r + 13, f'="Enclosures: 1. EDF (signed)   2. Invoice copies ("&{cv(31)}&")"', 16, F(9, False, MID))
page(ws, f"A1:G{r+13}")

# ============================================================== BANK LETTER
ws = WS["Bank Letter"]
widths(ws, {"A": 5, "B": 20, "C": 13, "D": 34, "E": 10, "F": 15, "G": 17})
letter_head(ws)
para(12, "Subject: Request for confirmation of RBI Authorised Dealer (AD) Code for Export Declaration Form (EDF)", 30, F(10.5, True))
para(14, "Dear Sir / Madam,")
para(16, f'="I / We, "&{pf("name")}&", maintain a bank account with your branch and receive / intend to receive foreign inward remittances towards export of services in this account."', 34)
para(18, f'="Account holder / exporter name: "&{pf("name")}&CHAR(10)&"Account number: "&IF({pf("acct")}="","______________________",{pf("acct")})&CHAR(10)&"PAN: "&{pf("pan")}', 46, F(10.5, True))
para(20, "For the purpose of completing the Export Declaration Form (EDF) and related foreign exchange / FEMA documentation, I / we request you to kindly "
     "provide and confirm the RBI Authorised Dealer (AD) Code applicable to the above account.", 46)
para(22, "If our account-holding branch is not itself an authorised forex / AD branch, kindly provide the AD Code and details of the linked / centralised / "
     "designated forex branch that handles export-related foreign exchange transactions for this account.", 46)
para(24, "Kindly confirm the following:")
for i, t in enumerate(["1. RBI Authorised Dealer (AD) Code: ____________________________________________",
                       "2. Name / address of designated AD / forex branch: ______________________________",
                       "3. SWIFT / BIC code (if applicable): ____________________________________________",
                       "4. Confirmation that the above AD Code may be quoted in the EDF for export proceeds received / to be received in the above account."]):
    para(26 + i * 2, t, 30 if i == 3 else 18)
para(34, "The information is required for regulatory documentation relating to export proceeds. Kindly provide the above details by email / stamped letter, as applicable.", 32)
para(36, "Thank you.")
para(38, "Yours faithfully,")
ws.row_dimensions[39].height = 46
para(40, f'={pf("sign")}&IF({pf("desig")}="","",", "&{pf("desig")})', 16, F(10.5, True))
para(41, f'="For "&{pf("name")}')
page(ws, "A1:G41")

# ================================================================ DASHBOARD
ws = WS["Dashboard"]
title(ws, "Dashboard", "Your export income, payments and deadlines at a glance. Updates automatically from the register.", "N")
widths(ws, {"A": 2, "B": 20, "C": 14, "D": 21, "E": 19, "F": 15, "G": 22, "H": 3, "I": 13, "J": 13, "K": 13, "L": 13, "M": 13, "N": 13})
put(ws, "B5", "Financial year", F(10, True))
put(ws, "C5", '=IF(MONTH(TODAY())>=4,YEAR(TODAY())&"-"&RIGHT(YEAR(TODAY())+1,2),(YEAR(TODAY())-1)&"-"&RIGHT(YEAR(TODAY()),2))', F(11, True), inp=True, align=A("center"))
put(ws, "D5", "Pick another year from the dropdown to look back (April to March).", F(9, False, MID, italic=True))
ws.merge_cells("D5:G5")
dv_list(ws, "C5", f"={LST}$O$4:$O$15")
FY = "$C$5"
tiles = [("B", "C", "Invoiced this year (INR)", f'=SUMIFS({rr("inr")},{rr("h_fy")},{FY})', "#,##0"),
         ("D", "D", "Received in bank (INR)", f'=SUMIFS({rr("inr_cred")},{rr("h_fy")},{FY})', "#,##0"),
         ("E", "E", "Still to come (INR)", f'=SUMIFS({rr("h_openinr")},{rr("h_fy")},{FY})', "#,##0"),
         ("F", "F", "Invoices raised", f'=COUNTIF({rr("h_fy")},{FY})', "0"),
         ("G", "G", "Payments overdue", f'=COUNTIF({rr("pay_status")},"OVERDUE")', "0")]
for a, b, lab, f_, fm in tiles:
    merge(ws, f"{a}7:{b}7", lab, F(9, False, MID), CREAM, A("left", indent=1), Border(top=THIN, left=THIN, right=THIN))
    merge(ws, f"{a}8:{b}8", f_, F(16, True, INK), CREAM, A("left", indent=1), Border(bottom=THIN, left=THIN, right=THIN), fm)
ws.row_dimensions[7].height = 18
ws.row_dimensions[8].height = 30
put(ws, "B9", "'Still to come' values unpaid balances at the invoice-date exchange rate. 'Payments overdue' counts all years.", F(8, False, LIGHT, italic=True))
ws.merge_cells("B9:G9")
section(ws, 10, "Month by month", last="G")
th = dict(font=F(9, True, WHITE), bg=VIOLET, border=BOX, align=A("center"))
for col, t in zip("BCDEFG", ["Month", "Invoices", "Invoiced (INR)", "Received (INR)", "File EDF by", "EDF status"]):
    put(ws, f"{col}11", t, **th)
ws.column_dimensions["Z"].hidden = True
ws.column_dimensions["AA"].hidden = True
for i in range(12):
    r = 12 + i
    ws[f"Z{r}"] = f'=DATE(VALUE(LEFT({FY},4)),{4+i},1)'
    ws[f"AA{r}"] = f"=YEAR(Z{r})*100+MONTH(Z{r})"
    td = dict(font=F(9), border=BOX)
    put(ws, f"B{r}", f'=INDEX({MON3},MONTH(Z{r}))&" "&YEAR(Z{r})', align=A("left", indent=1), **td)
    put(ws, f"C{r}", f'=COUNTIF({rr("h_month")},AA{r})', align=A("center"), fmt="0;-0;-", **td)
    put(ws, f"D{r}", f'=SUMIFS({rr("inr")},{rr("h_month")},AA{r})', align=A("right"), fmt="#,##0;(#,##0);-", **td)
    put(ws, f"E{r}", f'=SUMIFS({rr("inr_cred")},{rr("recd_on")},">="&Z{r},{rr("recd_on")},"<="&EOMONTH(Z{r},0))', align=A("right"), fmt="#,##0;(#,##0);-", **td)
    put(ws, f"F{r}", f'=IF(OR(C{r}=0,EOMONTH(Z{r},0)<{pf("edf_from")}),"",EOMONTH(Z{r},0)+{pf("edf_days")})', align=A("center"), fmt="dd-mmm-yyyy", **td)
    put(ws, f"G{r}", f'=IF(C{r}=0,"",IF(F{r}="","Not required",IF(COUNTIFS({rr("h_month")},AA{r},{rr("edf_filed")},">0")>=C{r},"Filed",IF({TODAY}>F{r},"LATE - file now",'
                     f'"To file ("&(C{r}-COUNTIFS({rr("h_month")},AA{r},{rr("edf_filed")},">0"))&" pending)"))))', font=F(9, True), align=A("center"), border=BOX)
put(ws, "B24", "Total", F(9, True), VIOLET_SOFT, A("left", indent=1), BOX)
put(ws, "C24", "=SUM(C12:C23)", F(9, True), VIOLET_SOFT, A("center"), BOX, "0")
put(ws, "D24", "=SUM(D12:D23)", F(9, True), VIOLET_SOFT, A("right"), BOX, "#,##0")
put(ws, "E24", "=SUM(E12:E23)", F(9, True), VIOLET_SOFT, A("right"), BOX, "#,##0")
put(ws, "F24", None, bg=VIOLET_SOFT, border=BOX)
put(ws, "G24", None, bg=VIOLET_SOFT, border=BOX)
status_cf(ws, "G12:G23", "G12")
put(ws, "B25", "Invoiced = by invoice month. Received = INR credited, by the month the money arrived.", F(8, False, LIGHT, italic=True))
ws.merge_cells("B25:G25")
section(ws, 27, "Top clients this year", last="G")
for col, t in zip("BCDEFG", ["Rank", "Client", "", "Invoiced (INR)", "Share", ""]):
    put(ws, f"{col}28", t, **th)
ws.merge_cells("C28:D28")
ws.column_dimensions["AB"].hidden = True
for i in range(8):
    r = 29 + i
    ws[f"AB{r}"] = f'=IFERROR(LARGE({cr("K")},{i+1}),"")'
    ok = f'AND(ISNUMBER(AB{r}),AB{r}>=0.01)'
    put(ws, f"B{r}", f'=IF({ok},{i+1},"")', F(9), align=A("center"), border=BOX)
    merge(ws, f"C{r}:D{r}", f'=IF({ok},INDEX({cr("B")},MATCH(AB{r},{cr("K")},0)),"")', F(9), align=A("left", indent=1), border=BOX)
    put(ws, f"E{r}", f'=IF({ok},ROUND(AB{r},2),"")', F(9), align=A("right"), border=BOX, fmt="#,##0")
    put(ws, f"F{r}", f'=IF({ok},IF($D$24>0,E{r}/$D$24,""),"")', F(9), align=A("center"), border=BOX, fmt="0%")
section(ws, 38, "Payments to chase (nearest deadline first)", last="G")
for col, t in zip("BCDEFG", ["Invoice no.", "Currency", "Client", "Balance pending", "Deadline", "Status"]):
    put(ws, f"{col}39", t, **th)
ws.column_dimensions["AC"].hidden = True
ws.column_dimensions["AD"].hidden = True
for i in range(8):
    r = 40 + i
    ws[f"AC{r}"] = f'=IFERROR(SMALL({rr("h_sort")},{i+1}),"")'
    ws[f"AD{r}"] = f'=IF(AC{r}="","",MATCH(AC{r},{rr("h_sort")},0))'
    g = lambda k, txt=False: f'=IF($AD{r}="","",INDEX({rr(k)},$AD{r}){"&\"\"" if txt else ""})'
    put(ws, f"B{r}", g("inv", True), F(9), align=A("left", indent=1), border=BOX)
    put(ws, f"C{r}", g("cur", True), F(9), align=A("center"), border=BOX)
    put(ws, f"D{r}", g("client", True), F(9), align=A("left", indent=1), border=BOX)
    put(ws, f"E{r}", g("balance"), F(9), align=A("right"), border=BOX, fmt="#,##0.00")
    put(ws, f"F{r}", g("deadline"), F(9), align=A("center"), border=BOX, fmt="dd-mmm-yyyy")
    put(ws, f"G{r}", g("pay_status", True), F(9, True), align=A("center"), border=BOX)
status_cf(ws, "G40:G47", "G40")
section(ws, 49, "GST registration watch", last="G")
gst = [(50, "Export income this year (INR)", "=D24", False, "From the register."),
       (51, "Other income from India this year (INR)", 0, True, "Type your Indian brand deals and other taxable receipts, if any."),
       (52, "Aggregate turnover (INR)", "=E50+E51", False, None),
       (53, "Registration threshold (INR)", f'={pf("gst_limit")}', False, "Set on My Profile > Rule settings."),
       (54, "Used so far", '=IF(E53>0,E52/E53,"")', False, None)]
for r, lab, v, inp, hint in gst:
    merge(ws, f"B{r}:D{r}", lab, F(10, True), border=UNDER)
    if inp:
        put(ws, f"E{r}", v, inp=True, fmt="#,##0", align=A("right"))
    else:
        put(ws, f"E{r}", v, F(10, True), CALC, A("right"), BOX, "0%" if r == 54 else "#,##0")
    merge(ws, f"F{r}:G{r}", hint, F(8, False, MID, italic=True))
dv_num(ws, "E51")
merge(ws, "B55:D55", "What this means", F(10, True), border=UNDER)
merge(ws, "E55:G55", f'=IF({pf("gst_status")}="Registered","Already registered",IF(E54="","",IF(E54>=1,"Crossed - GST registration is likely needed. Talk to your CA now.",'
      'IF(E54>=0.8,"Getting close - plan GST registration with your CA.","Below threshold"))))', F(9, True), align=A("center"), border=BOX)
ws.row_dimensions[55].height = 30
status_cf(ws, "E55:G55", "E55")
put(ws, "B56", "Export of services counts toward aggregate turnover even though it is zero-rated. This is an alert, not tax advice.", F(8, False, LIGHT, italic=True))
ws.merge_cells("B56:G56")

ch = BarChart()
ch.type, ch.grouping = "col", "clustered"
ch.add_data(Reference(ws, min_col=4, max_col=5, min_row=11, max_row=23), titles_from_data=True)
ch.set_categories(Reference(ws, min_col=2, min_row=12, max_row=23))
ch.title = "Invoiced vs received by month (INR)"
ch.title.overlay = False
ch.legend.position = "b"
ch.legend.overlay = False
ch.roundedCorners = False
ch.x_axis.delete = False
ch.y_axis.delete = False
ch.y_axis.numFmt = "#,##0"
ch.y_axis.majorGridlines.spPr = None
ch.gapWidth = 70
for s, colr in zip(ch.series, (SERIES_1, SERIES_2)):
    s.graphicalProperties.solidFill = colr
    s.graphicalProperties.line.solidFill = colr
ch.height, ch.width = 8.2, 14.6
ws.add_chart(ch, "I10")
ch2 = BarChart()
ch2.type = "bar"
ch2.add_data(Reference(ws, min_col=5, min_row=28, max_row=36), titles_from_data=True)
ch2.set_categories(Reference(ws, min_col=3, min_row=29, max_row=36))
ch2.title = "Top clients this year - invoiced (INR)"
ch2.title.overlay = False
ch2.legend = None
ch2.roundedCorners = False
ch2.x_axis.delete = False
ch2.y_axis.delete = False
ch2.x_axis.scaling.orientation = "maxMin"
ch2.y_axis.numFmt = "#,##0"
ch2.gapWidth = 60
ch2.series[0].graphicalProperties.solidFill = SERIES_1
ch2.series[0].graphicalProperties.line.solidFill = SERIES_1
ch2.y_axis.scaling.min = 0
ch2.y_axis.crosses = "max"
ch2.height, ch2.width = 6.2, 14.6
ws.add_chart(ch2, "I27")
ws.freeze_panes = "A5"
page(ws, "A2:N56", landscape=True)

# ===================================================================== HOME
ws = WS["Home"]
widths(ws, {"A": 2, "B": 6, "C": 28, "D": 62, "E": 46, "F": 2})
ws.row_dimensions[1].height = 8
ws.row_dimensions[2].height = 40
merge(ws, "B2:E2", "Creator Export Toolkit", F(22, True, WHITE), VIOLET, A(indent=1))
merge(ws, "B3:E3", "Export invoice · EDF · bank letters · payment tracker - for Indian creators paid from abroad", F(10.5, False, WHITE), VIOLET_DK, A(indent=1))
ws.row_dimensions[3].height = 22
merge(ws, "B4:E4", "A KK Create participant resource   ·   Version 2.0   ·   No macros - works in Excel, Google Sheets and LibreOffice", F(9, False, MID), CREAM, A(indent=1))
ws.row_dimensions[4].height = 20
merge(ws, "B6:E6", f'=IF(OR({pf("samples")}>0,COUNTIF({rr("inv")},"SAMPLE*")>0),"This copy still contains fictional SAMPLE details. Replace My Profile, then clear the SAMPLE clients and invoices before filing anything.","")',
      F(10, True, AMBER), align=A(indent=1))
ws.conditional_formatting.add("B6:E6", FormulaRule(formula=['$B$6<>""'], fill=fill(AMBER_BG)))
ws.row_dimensions[6].height = 24
section(ws, 8, "Follow these steps")
for col, t in zip("BCDE", ["Step", "Go to", "What you do there", "Right now"]):
    put(ws, f"{col}9", t, F(9, True, MID), border=UNDER)
steps = [("1", "My Profile", "Fill once: your name, PAN, GST and bank details.",
          f'=IF({pf("missing")}>0,"Fix: "&{pf("missing")}&" detail(s) to complete",IF({pf("samples")}>0,"Sample details - replace with yours","Complete"))'),
         ("2", "Clients", "Add each platform or brand that pays you from abroad.",
          f'=COUNTIF({cr("J")},"OK")&" client(s) ready"&IF(SUMPRODUCT(({cr("J")}<>"")*({cr("J")}<>"OK"))>0,"; "&SUMPRODUCT(({cr("J")}<>"")*({cr("J")}<>"OK"))&" to complete","")'),
         ("3", "Invoice Register", "One row per invoice: number, date, client, amount, exchange rate.",
          f'=COUNTIF({rr("check")},"OK")&" invoice(s) logged"&IF(SUMPRODUCT(({rr("check")}<>"")*({rr("check")}<>"OK"))>0,"; "&SUMPRODUCT(({rr("check")}<>"")*({rr("check")}<>"OK"))&" to fix","")'),
         ("4", "Documents", "Pick an invoice and save the Export Invoice and EDF as PDF.", f"={DOC}$C$14"),
         ("5", "Dashboard", "See income, payments still to come, EDF and payment deadlines.",
          f'="FY "&{DASH}$C$5&": INR "&TEXT({DASH}$B$8,"#,##0")&" invoiced"'),
         ("6", "Guide", "Monthly checklist, the rules in plain words, and FAQs.", "Read once before your first EDF")]
for i, (n, sheet, what, f_) in enumerate(steps):
    r = 10 + i
    ws.row_dimensions[r].height = 30
    put(ws, f"B{r}", n, F(13, True, WHITE), VIOLET, A("center"))
    link(ws, f"C{r}", sheet + "  >", f"#'{sheet}'!A1", F(11, True, VIOLET, underline="single"), A(indent=1))
    put(ws, f"D{r}", what, F(10))
    put(ws, f"E{r}", f_, F(9.5, True), align=A(indent=1))
    for col in "CDE":
        ws[f"{col}{r}"].border = UNDER
for formula, fg, bg in [('OR(LEFT(E10,3)="Fix",LEFT(E10,3)="NOT")', RED, RED_BG),
                        ('OR(ISNUMBER(SEARCH("sample",E10)),ISNUMBER(SEARCH(" to ",E10)),ISNUMBER(SEARCH("amber",E10)))', AMBER, AMBER_BG),
                        ('E10<>""', GREEN, GREEN_BG)]:
    ws.conditional_formatting.add("E10:E13", FormulaRule(formula=[formula], font=Font(bold=True, color=fg), fill=fill(bg), stopIfTrue=True))
section(ws, 17, "Coming up")
up = [("EDFs still to file", f'=COUNTIF({rr("edf_status")},"To file")+COUNTIF({rr("edf_status")},"File soon")+COUNTIF({rr("edf_status")},"Late*")', "0",
       "Invoices whose EDF has not been filed with the bank yet."),
      ("Next EDF due by", f'=IF(COUNT({rr("h_unfiled")})=0,"Nothing pending",MIN({rr("h_unfiled")}))', "dd-mmm-yyyy",
       "The earliest filing date among unfiled invoices."),
      ("Payments still to come", f'=COUNTIF({rr("pay_status")},"Awaiting")+COUNTIF({rr("pay_status")},"Due soon")+COUNTIF({rr("pay_status")},"Part paid")+COUNTIF({rr("pay_status")},"OVERDUE")', "0",
       "Invoices not yet fully received."),
      ("Payments overdue", f'=COUNTIF({rr("pay_status")},"OVERDUE")', "0", "Past the RBI realisation deadline - speak to your bank.")]
for i, (lab, f_, fm, hint) in enumerate(up):
    r = 18 + i
    ws.row_dimensions[r].height = 22
    merge(ws, f"B{r}:C{r}", lab, F(10, True), border=UNDER, align=A(indent=1))
    put(ws, f"D{r}", hint, F(9, False, MID, italic=True), border=UNDER)
    put(ws, f"E{r}", f_, F(11, True), CALC, A("left", indent=1), BOX, fm)
section(ws, 23, "How to read the colours")
merge(ws, "B24:C24", "Yellow cell", F(10, True), INPUT, A("center"), BOX)
merge(ws, "D24:E24", "Type here. These are the only cells you need to touch.", F(10), align=A(indent=1))
merge(ws, "B25:C25", "Grey cell", F(10, True), CALC, A("center"), BOX)
merge(ws, "D25:E25", "Calculated automatically. Sheets are protected (no password) so formulas cannot be overwritten by accident.", F(10), align=A(indent=1))
merge(ws, "B26:C26", "OK / Paid / Filed", F(10, True, GREEN), GREEN_BG, A("center"), BOX)
merge(ws, "D26:E26", "Nothing to do.", F(10), align=A(indent=1))
merge(ws, "B27:C27", "Due soon / Check", F(10, True, AMBER), AMBER_BG, A("center"), BOX)
merge(ws, "D27:E27", "Worth a look.", F(10), align=A(indent=1))
merge(ws, "B28:C28", "Fix / Late / OVERDUE", F(10, True, RED), RED_BG, A("center"), BOX)
merge(ws, "D28:E28", "Needs action before you file or print.", F(10), align=A(indent=1))
for r in range(24, 29):
    ws.row_dimensions[r].height = 20
merge(ws, "B30:E31", "This toolkit is a working aid, not legal, tax or banking advice. Rules and bank practice change - confirm with your bank and "
      "your CA before you file. See the Guide sheet for sources.", F(9, False, MID, italic=True), align=A(v="top", indent=1))

# ==================================================================== GUIDE
ws = WS["Guide"]
title(ws, "Guide", "How to use the toolkit, a monthly checklist, the rules in plain words, and answers to common questions.", "C")
widths(ws, {"A": 2, "B": 30, "C": 110})
gr = [5]


def gsec(t):
    section(ws, gr[0], t, last="C")
    gr[0] += 1


def grow(a, b, h=None):
    r = gr[0]
    put(ws, f"B{r}", a, F(10, True), align=A(v="top"), border=UNDER)
    put(ws, f"C{r}", b, F(10), align=A(v="top"), border=UNDER)
    ws.row_dimensions[r].height = h or (16 * max(1, -(-len(b) // 115)) + 6)
    gr[0] += 1


gsec("How the toolkit works")
grow("1. My Profile", "Fill it once. Your name, PAN, GST and bank details flow into every document.")
grow("2. Clients", "Add each platform or brand that pays you from abroad. Use the legal name and address printed on your payment receipt or contract.")
grow("3. Invoice Register", "One row per invoice. Type five things - invoice number, date, client, amount and exchange rate. Everything else is calculated, including the INR value and both deadlines.")
grow("4. Documents", "Pick the invoice, wait for the green READY status, then open Export Invoice and EDF Form and save each as PDF.")
grow("5. When money arrives", "Go back to the register and fill in the date, the amount received and the INR credited. The dashboard and deadlines update themselves.")
gr[0] += 1
gsec("Monthly checklist")
grow("During the month", "Raise an export invoice for every foreign payout or brand deal and log it in the register the same day.")
grow("After month-end", "Open Documents, choose any invoice of that month with 'All invoices of the same month', and print the EDF. Sign it and give it to your bank with the invoice copies (the EDF Cover Letter lists them for you).")
grow("Same day", "Type the date in 'EDF filed on' for those invoices so the dashboard stops reminding you.")
grow("When payment lands", "Record it in the register and save the bank's inward remittance advice (FIRA / FIRC) with the invoice.")
grow("Every quarter", "Send the register to your CA for GST and income-tax work. Check the GST registration watch on the Dashboard.")
gr[0] += 1
gsec("The rules built into this toolkit (as understood in November 2026)")
grow("EDF for services", "From 1 October 2026, exporters of services declare their exports to their Authorised Dealer bank on an Export Declaration Form. It is due within 30 days after the end of the month in which the invoice is raised, and one EDF may cover all the service invoices of that month. "
     "Source: RBI, Foreign Exchange Management (Export and Import of Goods and Services) Regulations, 2026.")
grow("Getting paid on time", "The full export value must reach India within 9 months of the invoice date (12 months if the export is invoiced or settled in Indian rupees). Your bank can extend this on request. "
     "Source: Regulation 5 of the same Regulations, as amended in September 2026.")
grow("GST", "Export of services is zero-rated. If you are GST-registered you normally export under a Letter of Undertaking (LUT) and the invoice must say so - the toolkit prints that line for you. "
     "Export income counts toward the registration threshold (Rs 20 lakh for services in most states), which the Dashboard tracks.")
grow("Exchange rate", "Use one consistent source for every invoice - for example the RBI / FBIL reference rate for the invoice date - or the rate your CA or bank advises. The actual rate you received is tracked separately in the register.")
grow("If rules change", "The filing window, payment deadlines and GST threshold are settings on My Profile > Rule settings. Change them there and every date in the toolkit follows.")
gr[0] += 1
gsec("Words you will meet")
grow("EDF", "Export Declaration Form - your declaration to the bank of what you exported and what you will be paid.")
grow("AD / AD code", "Authorised Dealer - a bank permitted by RBI to handle foreign exchange. The AD code identifies its forex branch. Your bank must give it to you; the Bank Letter sheet asks for it.")
grow("IEC", "Import Export Code issued by DGFT. Many service exporters do not hold one; type 'Not applicable' if you do not.")
grow("SAC", "Services Accounting Code - the GST classification of your service. The Lists sheet has common ones; confirm yours with your CA.")
grow("LUT", "Letter of Undertaking (Form GST RFD-11) that lets a GST-registered exporter export without paying IGST. Renewed every financial year.")
grow("FIRA / FIRC", "Foreign Inward Remittance Advice / Certificate - the bank's proof that foreign money was credited to you.")
grow("Net realisable value", "What you actually expect to receive for the invoice. Normally the invoice amount; fill the optional column only if it differs.")
grow("Realisation", "Receiving the export payment in India through a bank.")
gr[0] += 1
gsec("Common questions")
grow("Which company do I invoice?", "The legal entity named on your payment receipt or contract - not the app name. Platforms often pay through a regional company.")
grow("How do I remove an invoice?", "Select the yellow cells in that row and press Delete. Do not delete whole rows. The same works for the SAMPLE rows.")
grow("My bank does not know the AD code", "Print the Bank Letter sheet, sign it and hand it to the branch. Ask for the forex or trade desk.")
grow("More than 10 invoices in a month?", "One EDF page holds 10. Choose 'Only this invoice' on the Documents sheet and print separate EDFs for the extra ones.")
grow("A cell will not let me type", "Only yellow cells are open. To change anything else, use Review > Unprotect Sheet - there is no password.")
grow("Can I use Google Sheets?", "Yes. Upload the file to Google Drive and open it with Google Sheets. There are no macros. Save each document with File > Download > PDF.")
grow("Is my data shared?", "No. Everything stays inside this file on your device. Keep a backup copy.")
gr[0] += 1
gsec("Important")
grow("Not advice", "This toolkit is a working aid, not legal, tax or banking advice. The rules above reflect published summaries of the regulations as of November 2026 and bank practice differs. "
     "Confirm with your bank and CA before filing, and read every document before you sign it.")
ws.freeze_panes = "A5"

# ============================================================== finishing
WS["Home"].sheet_properties.tabColor = VIOLET
for n in ("My Profile", "Clients", "Invoice Register"):
    WS[n].sheet_properties.tabColor = "E0B400"
for n in ("Documents", "Export Invoice", "EDF Form", "EDF Cover Letter", "Bank Letter"):
    WS[n].sheet_properties.tabColor = GREEN
WS["Dashboard"].sheet_properties.tabColor = SERIES_1
for n in ("Guide", "Lists"):
    WS[n].sheet_properties.tabColor = LIGHT
for n, land in (("Home", False), ("My Profile", True), ("Clients", True), ("Documents", True), ("Guide", False), ("Lists", True)):
    w_ = WS[n]
    page(w_, f"A1:{CL(w_.max_column)}{w_.max_row}", landscape=land, fit=False)
    w_.sheet_properties.pageSetUpPr.fitToPage = True
    w_.page_setup.fitToWidth, w_.page_setup.fitToHeight = 1, 0
WS["Calc"].sheet_state = "hidden"
for n in SHEETS:
    protect(WS[n])
wb.active = 0
wb.save(OUT)
print("saved", OUT)
