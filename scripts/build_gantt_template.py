"""Builds templates/Gantt_Chart_Template.xlsx (formula driven Gantt chart template)."""
import datetime as dt
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as CL
from openpyxl.formatting.rule import Rule, FormulaRule, DataBarRule
from openpyxl.styles.differential import DifferentialStyle
from openpyxl.styles.numbers import NumberFormat
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

OUT = sys.argv[1] if len(sys.argv) > 1 else "templates/Gantt_Chart_Template.xlsx"
FIRST, LAST = 11, 310            # task rows (300 tasks ready; copy last row down for more)
NCOL, TL0 = 120, 15              # timeline columns, first timeline column (N)
TLN = TL0 + NCOL - 1
INFO = "'Project Info'!"
PS, TGT, SD = INFO + "$C$9", INFO + "$C$10", INFO + "$C$11"
HOL = "Holidays!$A$6:$A$205"

# ---- palette -------------------------------------------------------------
NAVY, BLUE, TEAL, PURPLE, GREY = "1F3864", "2F5597", "1B7F79", "6A3D9A", "595959"
C_DONE, C_PROG, C_NOT, C_HOLD, C_OVER, C_AFF, C_GHOST = (
    "2E9E5B", "2F80ED", "A9C1E8", "F2C94C", "E53935", "F2994A", "D9D9D9")
C_WEEKEND, C_HOLIDAY, C_STATUS = "E4E4E4", "F8C8DC", "FFE699"
INPUT = "FFFBE6"
FN = "Arial"


def font(sz=10, b=False, c="000000", i=False):
    return Font(name=FN, size=sz, bold=b, color=c, italic=i)


def fill(c):
    return PatternFill("solid", start_color=c, end_color=c)


thin = Side(style="thin", color="D0D0D0")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
CEN = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)


def put(ws, ref, v=None, f=None, fl=None, al=None, nf=None, bd=None):
    c = ws[ref]
    if v is not None:
        c.value = v
    c.font = f or font()
    if fl:
        c.fill = fill(fl)
    if al:
        c.alignment = al
    if nf:
        c.number_format = nf
    if bd:
        c.border = bd
    return c


def dxf(bg=None, fc=None, bold=False, nf=None, nfid=None):
    kw = {}
    if bg:
        kw["fill"] = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
    if fc or bold:
        kw["font"] = Font(color=fc, bold=bold)
    if nf:
        kw["numFmt"] = NumberFormat(numFmtId=nfid, formatCode=nf)
    return DifferentialStyle(**kw)


def frule(ws, rng, formula, **kw):
    stop = kw.pop("stop", False)
    ws.conditional_formatting.add(rng, Rule(type="expression", formula=[formula],
                                            dxf=dxf(**kw), stopIfTrue=stop))


wb = Workbook()
wi = wb.active
wi.title = "Project Info"
wt = wb.create_sheet("Tasks")
wg = wb.create_sheet("Gantt")
wh = wb.create_sheet("Holidays")
for w, col in ((wi, NAVY), (wt, BLUE), (wg, TEAL), (wh, PURPLE)):
    w.sheet_properties.tabColor = col
    w.sheet_view.showGridLines = False

# =========================================================================
# HOLIDAYS
# =========================================================================
wh.column_dimensions["A"].width = 18
wh.column_dimensions["B"].width = 38
wh.column_dimensions["C"].width = 16
wh.merge_cells("A1:C1")
put(wh, "A1", "HOLIDAY LIST", font(16, True, "FFFFFF"), PURPLE, CEN)
wh.row_dimensions[1].height = 30
wh.merge_cells("A2:C3")
put(wh, "A2", "Enter one non-working date per row (yellow cells). Saturdays and Sundays are always treated "
    "as weekends automatically. Holidays shift task dates and are shaded pink on the Gantt chart. "
    "Delete or overwrite the sample rows.", font(9, i=True, c=GREY), None, LEFT)
for col, t in zip("ABC", ("Holiday Date", "Holiday Name", "Day")):
    put(wh, f"{col}5", t, font(10, True, "FFFFFF"), NAVY, CEN, bd=BOX)
samples = [(dt.date(2026, 10, 20), "Sample holiday 1 (edit me)"),
           (dt.date(2026, 11, 10), "Sample holiday 2 (edit me)"),
           (dt.date(2026, 12, 25), "Christmas Day")]
for r in range(6, 206):
    put(wh, f"A{r}", None, font(), INPUT, CEN, "dd-mmm-yyyy", BOX)
    put(wh, f"B{r}", None, font(), INPUT, LEFT, bd=BOX)
    put(wh, f"C{r}", f'=IF(A{r}="","",TEXT(A{r},"dddd"))', font(c=GREY), None, CEN, bd=BOX)
for i, (d, n) in enumerate(samples):
    wh[f"A{6+i}"].value, wh[f"B{6+i}"].value = d, n
dv = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True,
                    errorTitle="Invalid date", error="Please enter a valid date.")
wh.add_data_validation(dv)
dv.add("A6:A205")
wh.freeze_panes = "A6"

# =========================================================================
# PROJECT INFO
# =========================================================================
for col, w in zip("ABCDEF", (2, 32, 30, 3, 38, 30)):
    wi.column_dimensions[col].width = w
wi.merge_cells("B1:F1")
put(wi, "B1", "PROJECT GANTT CHART TEMPLATE", font(20, True, "FFFFFF"), NAVY, CEN)
wi.row_dimensions[1].height = 38
wi.merge_cells("B2:F2")
put(wi, "B2", "Project Info  ›  Tasks  ›  Gantt  ›  Holidays  –  everything is linked; fill the yellow cells only",
    font(10, i=True, c=GREY), None, CEN)


def section(ws, rng, text, color):
    a = rng.split(":")[0]
    ws.merge_cells(rng)
    put(ws, a, text, font(11, True, "FFFFFF"), color, LEFT)


section(wi, "B4:C4", "  PROJECT DETAILS", BLUE)
section(wi, "E4:F4", "  SCHEDULE HEALTH (auto-calculated)", TEAL)
details = [
    (5, "Project Name", "Website Redesign & Launch", None),
    (6, "Client Name", "Acme Corporation", None),
    (7, "Project Manager", "Your Name", None),
    (8, "Project Code / Reference", "PRJ-2026-001", None),
    (9, "Project Start Date", dt.date(2026, 10, 5), "dd-mmm-yyyy"),
    (10, "Target Completion Date", dt.date(2026, 12, 18), "dd-mmm-yyyy"),
    (11, "Status (Report) Date", dt.date(2026, 11, 6), "dd-mmm-yyyy"),
]
for r, lab, val, nf in details:
    put(wi, f"B{r}", lab, font(10, True), "EAF0FA", LEFT, bd=BOX)
    put(wi, f"C{r}", val, font(10, c="0000FF"), INPUT, CEN, nf, BOX)
wi["C11"].comment = Comment("Date up to which progress is reported. Enter =TODAY() to track live. "
                            "Un-started tasks cannot start before this date and in-progress tasks "
                            "are measured against it.", "Template")
put(wi, "B12", "Gantt View (set on Gantt sheet)", font(10, True), "EAF0FA", LEFT, bd=BOX)
put(wi, "C12", "=Gantt!B2", font(10), None, CEN, bd=BOX)

NF_DAYS = '+0" d";-0" d";0" d"'
health = [
    (5, "Planned Finish (baseline)", f'=IF(COUNT(Tasks!$N${FIRST}:$N${LAST})=0,"",MAX(Tasks!$N${FIRST}:$N${LAST}))', "dd-mmm-yyyy"),
    (6, "Forecast Finish (incl. delays)", f'=IF(COUNT(Tasks!$P${FIRST}:$P${LAST})=0,"",MAX(Tasks!$P${FIRST}:$P${LAST}))', "dd-mmm-yyyy"),
    (7, "Target Completion Date", '=IF(C10="","",C10)', "dd-mmm-yyyy"),
    (8, "Delay vs TARGET (working days)", f'=IF(OR(F6="",F7=""),"",IF(F6>=F7,NETWORKDAYS(F7,F6,{HOL})-1,-(NETWORKDAYS(F6,F7,{HOL})-1)))', NF_DAYS),
    (9, "Delay vs PLAN (working days)", f'=IF(OR(F5="",F6=""),"",IF(F6>=F5,NETWORKDAYS(F5,F6,{HOL})-1,-(NETWORKDAYS(F6,F5,{HOL})-1)))', NF_DAYS),
    (10, "Overall % Complete (duration weighted)", f'=IF(SUM(Tasks!$F${FIRST}:$F${LAST})=0,"",SUMPRODUCT(Tasks!$F${FIRST}:$F${LAST},Tasks!$AB${FIRST}:$AB${LAST})/SUM(Tasks!$F${FIRST}:$F${LAST}))', "0%"),
]
for r, lab, fm, nf in health:
    put(wi, f"E{r}", lab, font(10, True), "E3F4F2", LEFT, bd=BOX)
    put(wi, f"F{r}", fm, font(10, True), None, CEN, nf, BOX)
put(wi, "E11", "Calendar days late vs Target", font(10, True), "E3F4F2", LEFT, bd=BOX)
put(wi, "F11", '=IF(OR(F6="",F7=""),"",F6-F7)', font(10, True), None, CEN, NF_DAYS, BOX)
for rng in ("F8", "F9", "F11"):
    wi.conditional_formatting.add(rng, Rule(type="cellIs", operator="greaterThan", formula=["0"], dxf=dxf("FFC7CE", "9C0006", True)))
    wi.conditional_formatting.add(rng, Rule(type="cellIs", operator="lessThanOrEqual", formula=["0"], dxf=dxf("C6EFCE", "006100", True)))

wi.merge_cells("B14:F14")
banner = ('=IF(F8="","Add tasks on the Tasks sheet to see project health",'
          'IF(F8>0,"⚠ PROJECT DELAYED: forecast finish "&TEXT(F6,"dd-mmm-yyyy")&" is "&F8&" working day(s) after target "&TEXT(F7,"dd-mmm-yyyy"),'
          'IF(F9>0,"⚡ AT RISK: within target, but forecast finish is "&F9&" working day(s) later than plan",'
          '"✔ ON TRACK: forecast finish "&TEXT(F6,"dd-mmm-yyyy")&" meets target "&TEXT(F7,"dd-mmm-yyyy"))))')
put(wi, "B14", banner, font(13, True, "FFFFFF"), "7F7F7F", CEN)
wi.row_dimensions[14].height = 34


def banner_cf(ws, rng, ref):
    frule(ws, rng, f'ISNUMBER(SEARCH("DELAYED",{ref}))', bg="C00000", fc="FFFFFF", bold=True, stop=True)
    frule(ws, rng, f'ISNUMBER(SEARCH("AT RISK",{ref}))', bg="ED7D31", fc="FFFFFF", bold=True, stop=True)
    frule(ws, rng, f'ISNUMBER(SEARCH("ON TRACK",{ref}))', bg="2E9E5B", fc="FFFFFF", bold=True, stop=True)


banner_cf(wi, "B14:F14", "$B$14")

section(wi, "B16:C16", "  TASK STATISTICS", PURPLE)
section(wi, "E16:F16", "  HOW TO USE", "7F6000")
T = lambda c: f"Tasks!${c}${FIRST}:${c}${LAST}"
stats = [
    ("Total Tasks", f'=COUNTIF({T("B")},"?*")'),
    ("Completed", f'=COUNTIF({T("AA")},"Completed")'),
    ("In Progress", f'=COUNTIF({T("AA")},"In Progress")'),
    ("Not Started / On Hold", f'=COUNTIF({T("AA")},"Not Started")+COUNTIF({T("AA")},"On Hold")'),
    ("Tasks Overshooting Duration", f'=COUNTIF({T("R")},">0")'),
    ("Tasks Affected by Others' Delay", f'=COUNTIF({T("U")},"Delayed*")'),
    ("Largest Overshoot (task)", f'=IF(MAX({T("R")})<=0,"None",INDEX({T("B")},MATCH(MAX({T("R")}),{T("R")},0))&" (+"&MAX({T("R")})&" d)")'),
    ("Total Planned Task-Days", f'=SUM({T("F")})'),
]
for i, (lab, fm) in enumerate(stats):
    r = 17 + i
    put(wi, f"B{r}", lab, font(10, True), "F0E8F7", LEFT, bd=BOX)
    put(wi, f"C{r}", fm, font(10, True), None, CEN, bd=BOX)
howto = [
    "1. Fill the yellow Project Details (start, target, report date).",
    "2. Holidays sheet: list non-working dates. Sat/Sun are automatic.",
    "3. Tasks sheet: type Task Name + Duration (working days) + up to 2 predecessor IDs. Dates are calculated.",
    "4. Update progress: Status, Actual Start/End, % Complete. Use Revised Duration if you expect an overshoot.",
    "5. Gantt sheet: pick Day / Week / Month in cell B2; scroll the timeline with C2.",
    "6. 300 task rows are pre-built; copy the last row down to add more.",
    "7. Predecessor = Finish-to-Start (starts next working day after it ends). Avoid circular links.",
    "Yellow cells = input · white cells = formulas (do not overwrite).",
]
for i, t in enumerate(howto):
    r = 17 + i
    wi.merge_cells(f"E{r}:F{r}")
    put(wi, f"E{r}", t, font(9), "FFF8E1", LEFT, bd=BOX)
    wi.row_dimensions[r].height = 27

section(wi, "B26:F26", "  COLOUR LEGEND", NAVY)
legend = [
    (C_DONE, "FFFFFF", "Completed", "Task finished (bar portion within plan)"),
    (C_PROG, "FFFFFF", "In Progress", "Task started, not finished"),
    (C_NOT, "1F3864", "Not Started", "Scheduled, not yet begun"),
    (C_HOLD, "000000", "On Hold", "Task paused"),
    (C_OVER, "FFFFFF", "Overshoot", "Time used beyond the planned DURATION (task ran / is expected to run over)"),
    (C_AFF, "FFFFFF", "Delayed / Affected", "Start pushed out by a late predecessor or by the status date (see 'Impact' column)"),
    (C_GHOST, "595959", "Planned (not used)", "Planned time no longer used (finished early / started late)"),
    (C_WEEKEND, "595959", "Weekend", "Saturday / Sunday (Day view)"),
    (C_HOLIDAY, "9C0057", "Holiday", "Dates from the Holidays sheet (pink header in Week/Month view = holiday inside period)"),
    (C_STATUS, "7F6000", "Status Date", "Column of the report date set on Project Info"),
    ("FFFFFF", "000000", "▶  Start", "First day of a task with no predecessor"),
    ("FFFFFF", "000000", "↳  Dependent start", "First day of a task that waits for a predecessor"),
    ("FFFFFF", "000000", "◀  End", "Last day of a task"),
    ("FFFFFF", "000000", "➜  End feeds others", "Last day of a task that other tasks depend on"),
    ("FFFFFF", "000000", "◆  Start = End", "Task starts and ends in the same period"),
]
for i, (bg, fc, lab, desc) in enumerate(legend):
    r = 27 + i
    put(wi, f"B{r}", lab, font(10, True, fc), bg, CEN, bd=BOX)
    wi.merge_cells(f"C{r}:F{r}")
    put(wi, f"C{r}", desc, font(9), None, LEFT, bd=BOX)
wi.freeze_panes = "A4"

dvd = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True,
                     errorTitle="Invalid date", error="Please enter a valid date (e.g. 05-Oct-2026).")
wi.add_data_validation(dvd)
dvd.add("C9:C11")

# =========================================================================
# TASKS
# =========================================================================
widths = dict(A=5, B=34, C=15, D=9, E=9, F=10, G=13, H=13, I=12, J=12, K=10, L=10, M=12, N=12,
              O=12, P=12, Q=9, R=10, S=27, T=9, U=28, V=10)
for k, v in widths.items():
    wt.column_dimensions[k].width = v
for c in range(23, 30):
    wt.column_dimensions[CL(c)].width = 9
wt.column_dimensions.group("W", "AC", hidden=True)

wt.merge_cells("A1:V1")
put(wt, "A1", '="TASK LIST  –  "&\'Project Info\'!C5&"   |   Client: "&\'Project Info\'!C6', font(16, True, "FFFFFF"), BLUE, LEFT)
wt.row_dimensions[1].height = 32
wt.merge_cells("A2:V2")
put(wt, "A2", "Type in the YELLOW cells only. Columns M–V calculate by themselves. Predecessor = ID of the task that must "
    "finish first (up to 2). Duration is in WORKING days (weekends & holidays skipped).",
    font(9, i=True, c=GREY), None, LEFT)
wt.merge_cells("A4:V4")
put(wt, "A4", f"={INFO}B14", font(12, True, "FFFFFF"), "7F7F7F", CEN)
wt.row_dimensions[4].height = 28
banner_cf(wt, "A4:V4", "$A$4")
wt.merge_cells("A5:V5")
put(wt, "A5", f'="Planned finish: "&IF({INFO}F5="","-",TEXT({INFO}F5,"dd-mmm-yy"))&"     |     Forecast finish: "&IF({INFO}F6="","-",TEXT({INFO}F6,"dd-mmm-yy"))'
    f'&"     |     Target: "&IF({INFO}F7="","-",TEXT({INFO}F7,"dd-mmm-yy"))&"     |     Overall progress: "&IF({INFO}F10="","-",TEXT({INFO}F10,"0%"))'
    f'&"     |     Status date: "&IF({SD}="","-",TEXT({SD},"dd-mmm-yy"))', font(10, True, NAVY), "EAF0FA", CEN)
wt.row_dimensions[5].height = 22

groups = [("A", "G", "①  TASK ENTRY", BLUE), ("H", "L", "②  STATUS UPDATE", "2E7D32"),
          ("M", "V", "③  SCHEDULE & ANALYSIS (automatic)", PURPLE), ("W", "AC", "helper", GREY)]
for a, b, t, col in groups:
    wt.merge_cells(f"{a}9:{b}9")
    put(wt, f"{a}9", t, font(11, True, "FFFFFF"), col, CEN)
heads = ["ID", "Task Name", "Owner", "Predecessor 1 (ID)", "Predecessor 2 (ID)", "Duration (work days)",
         "Start No Earlier Than (optional)", "Status", "Actual Start", "Actual End", "% Complete",
         "Revised Duration (if overshoot)", "Planned Start", "Planned End", "Forecast / Actual Start",
         "Forecast / Actual End", "Forecast / Actual Duration", "Duration Variance (days)",
         "Duration Status", "End Slip vs Plan (days)", "Impact (affected by)", "No. of Dependent Tasks",
         "class", "has pred", "pred1 slip", "pred2 slip", "eff status", "eff %", "end if no overshoot"]
hcol = [BLUE] * 7 + ["2E7D32"] * 5 + [PURPLE] * 10 + [GREY] * 7
for i, (h, c) in enumerate(zip(heads, hcol), start=1):
    put(wt, f"{CL(i)}10", h, font(9, True, "FFFFFF"), c, CEN, bd=BOX)
wt.row_dimensions[10].height = 44


def pr(col, p):  # forecast/planned end of predecessor in column p (D or E)
    return (f'N(IF(${col}{{r}}="",0,IFERROR(INDEX(${p}${FIRST}:${p}${LAST},'
            f'MATCH(${col}{{r}},$A${FIRST}:$A${LAST},0)),0)))')


for r in range(FIRST, LAST + 1):
    g = lambda s: s.replace("{r}", str(r))
    F = {
        "A": f'=IF($B{r}="","",ROW()-{FIRST-1})',
        "M": g(f'=IF(OR($B{{r}}="",{PS}=""),"",WORKDAY(MAX({PS}-1,N($G{{r}})-1,{pr("D","N")},{pr("E","N")}),1,{HOL}))'),
        "N": f'=IF(OR($M{r}="",NOT(ISNUMBER($F{r}))),"",WORKDAY($M{r},MAX(1,$F{r})-1,{HOL}))',
        "O": g(f'=IF($M{{r}}="","",IF(ISNUMBER($I{{r}}),$I{{r}},WORKDAY(MAX($M{{r}}-1,{pr("D","P")},{pr("E","P")},'
                f'IF($AA{{r}}="Completed",0,N({SD})-1)),1,{HOL})))'),
        "Q": f'=IF(OR($O{r}="",NOT(ISNUMBER($F{r}))),"",IF(ISNUMBER($J{r}),MAX(1,NETWORKDAYS($O{r},$J{r},{HOL})),'
             f'MAX(1,IF(ISNUMBER($L{r}),$L{r},$F{r}),IF(ISNUMBER($I{r}),NETWORKDAYS($I{r},N({SD}),{HOL}),0))))',
        "P": f'=IF(OR($O{r}="",$Q{r}=""),"",IF(ISNUMBER($J{r}),$J{r},WORKDAY($O{r},$Q{r}-1,{HOL})))',
        "R": f'=IF($Q{r}="","",$Q{r}-MAX(1,$F{r}))',
        "S": (f'=IF($B{r}="","",IF($Q{r}="","Enter Duration",IF($AA{r}="Completed",IF(NOT(ISNUMBER($J{r})),"Completed - enter Actual End",'
              f'IF($R{r}>0,"Completed - Overshoot",IF($R{r}<0,"Completed - Early","Completed - On Time"))),'
              f'IF($AA{r}="On Hold","On Hold",IF($AA{r}="In Progress",IF($R{r}>0,"In Progress - Overshooting","In Progress - On Track"),'
              f'IF($O{r}>$M{r},"Delayed Start","Not Started"))))))'),
        "T": f'=IF(OR(NOT(ISNUMBER($N{r})),NOT(ISNUMBER($P{r}))),"",IF($P{r}>=$N{r},NETWORKDAYS($N{r},$P{r},{HOL})-1,-(NETWORKDAYS($P{r},$N{r},{HOL})-1)))',
        "U": f'=IF($B{r}="","",IF(AND(MAX($Y{r},$Z{r})>0,N($O{r})>N($M{r})),"Delayed by Task #"&IF($Y{r}>=$Z{r},$D{r},$E{r})&" (+"&MAX($Y{r},$Z{r})&"d)",""))',
        "V": f'=IF($B{r}="","",COUNTIF($D${FIRST}:$E${LAST},$A{r}))',
        "W": f'=IF($B{r}="","",IF($AA{r}="Completed",1,IF($AA{r}="On Hold",4,IF($AA{r}="In Progress",2,IF(N($O{r})>N($M{r}),7,3)))))',
        "X": (f'=IF($B{r}="","",IF(OR(AND($D{r}<>"",ISNUMBER(MATCH($D{r},$A${FIRST}:$A${LAST},0))),'
              f'AND($E{r}<>"",ISNUMBER(MATCH($E{r},$A${FIRST}:$A${LAST},0)))),1,0))'),
        "Y": f'=IF($D{r}="",0,N(IFERROR(INDEX($T${FIRST}:$T${LAST},MATCH($D{r},$A${FIRST}:$A${LAST},0)),0)))',
        "Z": f'=IF($E{r}="",0,N(IFERROR(INDEX($T${FIRST}:$T${LAST},MATCH($E{r},$A${FIRST}:$A${LAST},0)),0)))',
        "AA": f'=IF($B{r}="","",IF(ISNUMBER($J{r}),"Completed",IF($H{r}="Completed","Completed",IF($H{r}<>"",$H{r},IF(ISNUMBER($I{r}),"In Progress","Not Started")))))',
        "AB": f'=IF($B{r}="","",IF($AA{r}="Completed",1,MIN(1,N($K{r}))))',
        "AC": f'=IF(OR($O{r}="",NOT(ISNUMBER($F{r}))),"",WORKDAY($O{r},MAX(1,$F{r})-1,{HOL}))',
    }
    for col, fm in F.items():
        c = wt[f"{col}{r}"]
        c.value = fm
        c.font = font(9, c=GREY if col in ("A", "W", "X", "Y", "Z", "AA", "AB", "AC") else "000000")
        c.border = BOX
        c.alignment = CEN if col not in ("S", "U") else LEFT
    for col in "BCDEFGHIJKL":
        c = wt[f"{col}{r}"]
        c.fill, c.border, c.font = fill(INPUT), BOX, font(10, c="0000FF")
        c.alignment = LEFT if col in "BC" else CEN
    for col in "GIJ":
        wt[f"{col}{r}"].number_format = "dd-mmm-yy"
    wt[f"K{r}"].number_format = "0%"
    for col in "MNOP":
        wt[f"{col}{r}"].number_format = "dd-mmm-yy"
    wt[f"R{r}"].number_format = '+0;-0;0'
    wt[f"T{r}"].number_format = '+0;-0;0'
    wt[f"AB{r}"].number_format = "0%"
    wt[f"AC{r}"].number_format = "dd-mmm-yy"
    wt.row_dimensions[r].height = 18

# example data
ex = [
    ("Project Kickoff & Charter", "Project Manager", None, None, 2, None, "Completed", dt.date(2026, 10, 5), dt.date(2026, 10, 6), 1, None),
    ("Requirements Gathering", "Business Analyst", 1, None, 5, None, "Completed", dt.date(2026, 10, 7), dt.date(2026, 10, 15), 1, None),
    ("Technical Architecture", "Architect", 2, None, 4, None, "Completed", dt.date(2026, 10, 16), dt.date(2026, 10, 21), 1, None),
    ("UX Wireframes", "UX Designer", 2, None, 10, None, "In Progress", dt.date(2026, 10, 16), None, 0.7, 17),
    ("Visual Design", "UI Designer", 4, None, 8, None, "Not Started", None, None, None, None),
    ("Database Setup", "DBA", 3, None, 5, None, "Completed", dt.date(2026, 10, 22), dt.date(2026, 10, 30), 1, None),
    ("Backend API Development", "Dev Team A", 6, None, 12, None, "In Progress", dt.date(2026, 11, 2), None, 0.3, None),
    ("Frontend Development", "Dev Team B", 5, 6, 10, None, "Not Started", None, None, None, None),
    ("Content Creation", "Content Lead", 2, None, 10, dt.date(2026, 10, 26), "In Progress", dt.date(2026, 10, 26), None, 0.8, None),
    ("Integration & QA Testing", "QA Team", 7, 8, 8, None, "Not Started", None, None, None, None),
    ("User Acceptance Testing", "Client", 10, None, 5, None, "Not Started", None, None, None, None),
    ("Training & Documentation", "Trainer", 9, None, 5, None, "On Hold", None, None, None, None),
    ("Deployment / Go-Live", "DevOps", 11, 12, 2, None, "Not Started", None, None, None, None),
    ("Project Closure & Handover", "Project Manager", 13, None, 2, None, "Not Started", None, None, None, None),
]
for i, row in enumerate(ex):
    r = FIRST + i
    for col, v in zip("BCDEFGHIJKL", row):
        if v is not None:
            wt[f"{col}{r}"].value = v

# validations
def addv(ws, dv, rng):
    ws.add_data_validation(dv)
    dv.add(rng)


rng = lambda c: f"{c}{FIRST}:{c}{LAST}"
addv(wt, DataValidation(type="list", formula1='"Not Started,In Progress,Completed,On Hold"', allow_blank=True,
                        promptTitle="Status", prompt="Pick the current task status.", showInputMessage=True), rng("H"))
addv(wt, DataValidation(type="whole", operator="between", formula1="1", formula2="9999", allow_blank=True,
                        promptTitle="Predecessor", prompt="Enter the ID (first column) of the task that must finish first. Leave blank if none.",
                        showInputMessage=True, errorTitle="Invalid", error="Enter a task ID number."), rng("D"))
addv(wt, DataValidation(type="whole", operator="between", formula1="1", formula2="9999", allow_blank=True,
                        promptTitle="Predecessor 2", prompt="Optional second predecessor ID.",
                        showInputMessage=True, errorTitle="Invalid", error="Enter a task ID number."), rng("E"))
addv(wt, DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="1", allow_blank=True,
                        promptTitle="Duration", prompt="Planned duration in WORKING days (min 1).",
                        showInputMessage=True, errorTitle="Invalid", error="Enter a number of days >= 1."), rng("F"))
addv(wt, DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="1", allow_blank=True,
                        promptTitle="Revised duration", prompt="If you now expect the task to take longer (or shorter) than planned, enter the new total working days.",
                        showInputMessage=True), rng("L"))
addv(wt, DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True,
                        errorTitle="Invalid date", error="Enter a valid date."), f"G{FIRST}:G{LAST}")
addv(wt, DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True,
                        errorTitle="Invalid date", error="Enter a valid date."), f"I{FIRST}:J{LAST}")
addv(wt, DataValidation(type="decimal", operator="between", formula1="0", formula2="1", allow_blank=True,
                        promptTitle="% Complete", prompt="Enter 0% to 100%.", showInputMessage=True,
                        errorTitle="Invalid", error="Enter a value between 0% and 100%."), rng("K"))

# conditional formats on Tasks
body = f"A{FIRST}:V{LAST}"
frule(wt, f"A{FIRST}:B{LAST}", f"AND(ISNUMBER($R{FIRST}),$R{FIRST}>0)", bg="FFC7CE", fc="9C0006", bold=True)
frule(wt, f"A{FIRST}:B{LAST}", f'$U{FIRST}<>""', bg="FCE4D6", fc="C55A11", bold=True)
for txt, bg, fc in (("Completed - On Time", "C6EFCE", "006100"), ("Completed - Early", "B7E1E8", "0B5563"),
                    ("Completed - Overshoot", "FFC7CE", "9C0006"), ("In Progress - On Track", "DDEBF7", "1F4E79"),
                    ("In Progress - Overshooting", "FF9999", "7F0000"), ("Delayed Start", "FFD8B0", "974706"),
                    ("On Hold", "FFF2CC", "7F6000"), ("Not Started", "EDEDED", "595959"),
                    ("Enter", "FFEB9C", "9C5700")):
    frule(wt, f"S{FIRST}:S{LAST}", f'LEFT($S{FIRST},{len(txt)})="{txt}"', bg=bg, fc=fc, bold=True, stop=True)
frule(wt, f"R{FIRST}:R{LAST}", f'AND(ISNUMBER($R{FIRST}),$R{FIRST}>0)', bg="FFC7CE", fc="9C0006", bold=True)
frule(wt, f"R{FIRST}:R{LAST}", f'AND(ISNUMBER($R{FIRST}),$R{FIRST}<0)', bg="C6EFCE", fc="006100", bold=True)
frule(wt, f"T{FIRST}:T{LAST}", f'AND(ISNUMBER($T{FIRST}),$T{FIRST}>0)', bg="FFC7CE", fc="9C0006", bold=True)
frule(wt, f"T{FIRST}:T{LAST}", f'AND(ISNUMBER($T{FIRST}),$T{FIRST}<0)', bg="C6EFCE", fc="006100", bold=True)
frule(wt, f"U{FIRST}:U{LAST}", f'$U{FIRST}<>""', bg="FFD8B0", fc="974706", bold=True)
for txt, bg, fc in (("Completed", "C6EFCE", "006100"), ("In Progress", "DDEBF7", "1F4E79"), ("On Hold", "FFF2CC", "7F6000")):
    frule(wt, f"H{FIRST}:H{LAST}", f'$H{FIRST}="{txt}"', bg=bg, fc=fc, bold=True)
wt.freeze_panes = f"C{FIRST}"
wt.auto_filter.ref = f"A10:V{LAST}"

# =========================================================================
# GANTT
# =========================================================================
for col, w in dict(A=5, B=30, C=9, D=10, E=10, F=10, G=10, H=12, I=7, J=8, K=3, L=3, M=3, N=3).items():
    wg.column_dimensions[col].width = w
wg.column_dimensions.group("K", "N", hidden=True)
for c in range(TL0, TLN + 1):
    wg.column_dimensions[CL(c)].width = 4.4
for r in (5, 6, 7):
    wg.row_dimensions[r].hidden = True
wg.row_dimensions[1].height = 30
wg.row_dimensions[8].height = 26
wg.row_dimensions[10].height = 30

wg.merge_cells("A1:J1")
put(wg, "A1", '="GANTT  |  "&\'Project Info\'!C5&"  |  "&\'Project Info\'!C6', font(14, True, "FFFFFF"), NAVY, LEFT)
bn = TL0 + 50
wg.merge_cells(start_row=1, start_column=TL0, end_row=1, end_column=bn)
put(wg, f"{CL(TL0)}1", f"={INFO}B14", font(12, True, "FFFFFF"), "7F7F7F", CEN)
banner_cf(wg, f"{CL(TL0)}1:{CL(bn)}1", f"${CL(TL0)}$1")

put(wg, "B2", "Week", font(11, True, "0000FF"), "FFE699", CEN, '"VIEW ▸  "@', BOX)
wg.merge_cells("C2:D2")
put(wg, "C2", 0, font(10, True, "0000FF"), "FFE699", CEN, '"Scroll "+0;"Scroll "-0;"Scroll 0"', BOX)
wg.merge_cells("E2:J2")
put(wg, "E2", "◀ pick Day / Week / Month   ·   Scroll = shift timeline by n periods (+ later / − earlier)",
    font(8, i=True, c=GREY), None, LEFT)
wg.row_dimensions[2].height = 24
addv(wg, DataValidation(type="list", formula1='"Day,Week,Month"', allow_blank=False, showDropDown=False,
                        promptTitle="Gantt view", prompt="Choose Day, Week or Month.", showInputMessage=True,
                        errorTitle="Invalid", error="Choose Day, Week or Month."), "B2")
addv(wg, DataValidation(type="whole", operator="between", formula1="-500", formula2="500", allow_blank=False,
                        promptTitle="Scroll", prompt="Whole number of periods to shift the timeline (negative = earlier).",
                        showInputMessage=True), "C2")

wg.merge_cells("A3:J3")
put(wg, "A3", "LEGEND  ▸  bar colour = task status · RED part of a bar = time over the planned duration", font(8, True, GREY), None, LEFT)
wg.merge_cells("A4:J4")
put(wg, "A4", "Orange task name = delayed by predecessor · Red task name = duration overshoot · Pink header = holiday", font(8, True, GREY), None, LEFT)
leg_a = [("Completed", C_DONE, "FFFFFF"), ("In Progress", C_PROG, "FFFFFF"), ("Not Started", C_NOT, NAVY),
         ("On Hold", C_HOLD, "000000"), ("Overshoot (over duration)", C_OVER, "FFFFFF"),
         ("Delayed / Affected", C_AFF, "FFFFFF"), ("Planned, unused", C_GHOST, GREY)]
leg_b = [("Weekend", C_WEEKEND, GREY), ("Holiday", C_HOLIDAY, "9C0057"), ("Status date", C_STATUS, "7F6000"),
         ("▶ Start", "F2F2F2", "000000"), ("↳ Starts after pred.", "F2F2F2", "000000"), ("◀ End", "F2F2F2", "000000"),
         ("➜ End feeds others", "F2F2F2", "000000"), ("◆ Start = End", "F2F2F2", "000000")]
for row, items in ((3, leg_a), (4, leg_b)):
    for i, (t, bg, fc) in enumerate(items):
        c0 = TL0 + i * 8
        wg.merge_cells(start_row=row, start_column=c0, end_row=row, end_column=c0 + 7)
        put(wg, f"{CL(c0)}{row}", t, font(8, True, fc), bg, CEN)
        for cc in range(c0, c0 + 8):
            wg.cell(row, cc).border = BOX

# left headers
wg.merge_cells("A8:J9")
put(wg, "A8", "TASK SCHEDULE   (Plan vs Forecast / Actual)", font(11, True, "FFFFFF"), BLUE, CEN)
for i, h in enumerate(["ID", "Task", "Depends On", "Plan Start", "Plan End", "Fcst / Actual Start",
                       "Fcst / Actual End", "Status", "% Done", "Var (days)"], start=1):
    put(wg, f"{CL(i)}10", h, font(9, True, "FFFFFF"), NAVY, CEN, bd=BOX)
put(wg, "K5", f'=IF($B$2="Day",{PS},IF($B$2="Week",{PS}-WEEKDAY({PS},2)+1,DATE(YEAR({PS}),MONTH({PS}),1)))', font(8))
wg["K5"].number_format = "dd-mmm-yy"

for k in range(NCOL):
    c = TL0 + k
    X, W = CL(c), CL(c - 1)
    wg[f"{X}5"] = f'=IF($B$2="Day",$K$5+{k}+$C$2,IF($B$2="Week",$K$5+7*({k}+$C$2),EDATE($K$5,{k}+$C$2)))'
    wg[f"{X}6"] = f'=IF($B$2="Day",{X}5,IF($B$2="Week",{X}5+6,EOMONTH({X}5,0)))'
    wg[f"{X}7"] = (f'=IF($B$2="Day",IF(COUNTIF({HOL},{X}5)>0,2,IF(WEEKDAY({X}5,2)>5,1,0)),'
                   f'IF(COUNTIFS({HOL},">="&{X}5,{HOL},"<="&{X}6)>0,3,0))+IF(AND({X}5<={SD},{X}6>={SD}),10,0)')
    if k == 0:
        wg[f"{X}8"] = f'=IF($B$2="Month",TEXT({X}5,"yyyy"),TEXT({X}5,"mmm")&CHAR(10)&TEXT({X}5,"yy"))'
    else:
        wg[f"{X}8"] = (f'=IF($B$2="Month",IF(YEAR({X}5)<>YEAR({W}5),TEXT({X}5,"yyyy"),""),'
                       f'IF(MONTH({X}5)<>MONTH({W}5),TEXT({X}5,"mmm")&CHAR(10)&TEXT({X}5,"yy"),""))')
    wg[f"{X}9"] = f'=IF($B$2="Day",TEXT({X}5,"dd"),IF($B$2="Week","W"&TEXT(WEEKNUM({X}5,21),"00"),TEXT({X}5,"mmm")))'
    wg[f"{X}10"] = f'=IF($B$2="Day",LEFT(TEXT({X}5,"ddd"),1),IF($B$2="Week",TEXT({X}5,"dd"),""))'
    for r in (8, 9, 10):
        cell = wg[f"{X}{r}"]
        cell.font = font(7 if r != 9 else 8, True, "FFFFFF")
        cell.fill = fill(NAVY if r != 9 else BLUE)
        cell.alignment = CEN
        cell.border = BOX
    wg[f"{X}5"].number_format = wg[f"{X}6"].number_format = "dd-mmm-yy"

for r in range(FIRST, LAST + 1):
    tk = lambda c: f"Tasks!${c}{r}"
    L_ = {
        "A": f'=IF({tk("B")}="","",{tk("A")})',
        "B": f'=IF({tk("B")}="","",{tk("B")})',
        "C": f'=IF($B{r}="","",IF(AND({tk("D")}="",{tk("E")}=""),"-",{tk("D")}&IF(AND({tk("D")}<>"",{tk("E")}<>""),", ","")&{tk("E")}))',
        "D": f'=IF(OR($B{r}="",{tk("M")}=""),"",{tk("M")})',
        "E": f'=IF(OR($B{r}="",{tk("N")}=""),"",{tk("N")})',
        "F": f'=IF(OR($B{r}="",{tk("O")}=""),"",{tk("O")})',
        "G": f'=IF(OR($B{r}="",{tk("P")}=""),"",{tk("P")})',
        "H": f'=IF($B{r}="","",{tk("AA")})',
        "I": f'=IF($B{r}="","",{tk("AB")})',
        "J": f'=IF(OR($B{r}="",{tk("R")}=""),"",{tk("R")})',
        "K": f'=IF($B{r}="","",{tk("W")})',
        "L": f'=IF($B{r}="","",{tk("X")})',
        "M": f'=IF($B{r}="","",{tk("V")})',
        "N": f'=IF(OR($B{r}="",{tk("AC")}=""),"",{tk("AC")})',
    }
    for col, fm in L_.items():
        cell = wg[f"{col}{r}"]
        cell.value = fm
        cell.font = font(9, True if col == "B" else False)
        cell.border = BOX
        cell.alignment = LEFT if col == "B" else CEN
        if col in "DEFG":
            cell.number_format = "dd-mmm-yy"
    wg[f"I{r}"].number_format = "0%"
    wg[f"J{r}"].number_format = "+0;-0;0"
    wg.row_dimensions[r].height = 18
    for k in range(NCOL):
        X = CL(TL0 + k)
        fm = (f'=IF(OR($A{r}="",NOT(ISNUMBER($G{r}))),"",IF(AND($F{r}<={X}$6,$G{r}>={X}$5),'
              f'IF({X}$5>$N{r},5,$K{r})*10+IF(AND($F{r}>={X}$5,$F{r}<={X}$6),'
              f'IF(AND($G{r}>={X}$5,$G{r}<={X}$6),5,IF($L{r}=1,2,1)),'
              f'IF(AND($G{r}>={X}$5,$G{r}<={X}$6),IF($M{r}>0,4,3),0)),'
              f'IF(AND($D{r}<={X}$6,$E{r}>={X}$5),60,0)))')
        cell = wg[f"{X}{r}"]
        cell.value = fm
        cell.font = font(8, True, "FFFFFF")
        cell.alignment = CEN
        cell.number_format = ";;;"
        cell.border = Border(left=Side(style="hair", color="D0D0D0"), right=Side(style="hair", color="D0D0D0"),
                             top=Side(style="hair", color="D0D0D0"), bottom=Side(style="hair", color="D0D0D0"))

# conditional formats – timeline body
tl = f"{CL(TL0)}{FIRST}:{CL(TLN)}{LAST}"
cls_col = {1: (C_DONE, "FFFFFF"), 2: (C_PROG, "FFFFFF"), 3: (C_NOT, NAVY), 4: (C_HOLD, "000000"),
           5: (C_OVER, "FFFFFF"), 7: (C_AFF, "FFFFFF")}
marks = {1: "▶", 2: "↳", 3: "◀", 4: "➜", 5: "◆"}
nfid = 200
for k_, (bg, fc) in cls_col.items():
    for m in range(6):
        code = k_ * 10 + m
        if m == 0:
            d = dxf(bg, fc, nf=";;;", nfid=nfid)
        else:
            d = dxf(bg, fc if k_ not in (3,) else "000000", True, nf=f'"{marks[m]}"', nfid=nfid)
        nfid += 1
        wg.conditional_formatting.add(tl, Rule(type="cellIs", operator="equal", formula=[str(code)], dxf=d, stopIfTrue=True))
wg.conditional_formatting.add(tl, Rule(type="cellIs", operator="equal", formula=["60"],
                                       dxf=dxf(C_GHOST, C_GHOST, nf=";;;", nfid=nfid), stopIfTrue=True))
tl1 = f"{CL(TL0)}$7"
frule(wg, tl, f"{CL(TL0)}${7}>=10", bg=C_STATUS, stop=True)
frule(wg, tl, f"MOD({CL(TL0)}$7,10)=2", bg=C_HOLIDAY, stop=True)
frule(wg, tl, f"MOD({CL(TL0)}$7,10)=1", bg=C_WEEKEND, stop=True)
hdr = f"{CL(TL0)}8:{CL(TLN)}10"
frule(wg, hdr, f"{CL(TL0)}$7>=10", bg="F57C00", fc="FFFFFF", bold=True, stop=True)
frule(wg, hdr, f"OR(MOD({CL(TL0)}$7,10)=2,MOD({CL(TL0)}$7,10)=3)", bg="C2185B", fc="FFFFFF", bold=True, stop=True)
frule(wg, hdr, f"MOD({CL(TL0)}$7,10)=1", bg="7F7F7F", fc="FFFFFF", stop=True)

# left side formatting
frule(wg, f"A{FIRST}:B{LAST}", f"$J{FIRST}>0", bg="FFC7CE", fc="9C0006", bold=True, stop=True) if False else None
wg.conditional_formatting.add(f"A{FIRST}:B{LAST}", Rule(type="expression", formula=[f'AND(ISNUMBER($J{FIRST}),$J{FIRST}>0)'],
                                                       dxf=dxf("FFC7CE", "9C0006", True), stopIfTrue=True))
wg.conditional_formatting.add(f"A{FIRST}:B{LAST}", Rule(type="expression", formula=[f'$K{FIRST}=7'],
                                                       dxf=dxf("FCE4D6", "C55A11", True), stopIfTrue=True))
for txt, bg, fc in (("Completed", "C6EFCE", "006100"), ("In Progress", "DDEBF7", "1F4E79"),
                    ("On Hold", "FFF2CC", "7F6000"), ("Not Started", "EDEDED", "595959")):
    frule(wg, f"H{FIRST}:H{LAST}", f'$H{FIRST}="{txt}"', bg=bg, fc=fc, bold=True)
frule(wg, f"J{FIRST}:J{LAST}", f"AND(ISNUMBER($J{FIRST}),$J{FIRST}>0)", bg="FFC7CE", fc="9C0006", bold=True)
frule(wg, f"J{FIRST}:J{LAST}", f"AND(ISNUMBER($J{FIRST}),$J{FIRST}<0)", bg="C6EFCE", fc="006100", bold=True)
wg.conditional_formatting.add(f"I{FIRST}:I{LAST}", DataBarRule(start_type="num", start_value=0, end_type="num",
                                                              end_value=1, color="63BE7B", showValue=True))
wg.freeze_panes = f"C{FIRST}"

for ws in (wt, wg, wi):
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr = __import__("openpyxl").worksheet.properties.PageSetupProperties(fitToPage=True)
wb.calculation.fullCalcOnLoad = True
wb.save(OUT)
print("saved", OUT)
