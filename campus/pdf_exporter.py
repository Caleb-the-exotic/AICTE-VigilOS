# ============================================================
# campus/pdf_exporter.py — Chat to PDF Generation
# ============================================================
# Converts a CampusFlow SQLite chat session into a formatted
# PDF document using ReportLab.
# ============================================================

import io
import html
import datetime
from typing import Optional, List
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from campus import db

def generate_chat_pdf(session_id: str, username: str, user_role: str) -> bytes:
    """
    Generate a PDF of the specified chat session.
    Returns the PDF file as bytes, or an empty bytes string on failure.
    """
    session = db.get_session(session_id)
    if not session:
        return b""
        
    messages = db.get_messages(session_id)
    if not messages:
        return b""

    title = session.get("title", "CampusFlow Conversation")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
        title=f"Chat Export: {title}"
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    header_style = ParagraphStyle(
        'HeaderStyle', parent=styles['Heading1'],
        fontSize=18, textColor=colors.darkblue, spaceAfter=6
    )
    meta_style = ParagraphStyle(
        'MetaStyle', parent=styles['Normal'],
        fontSize=10, textColor=colors.gray, spaceAfter=4
    )
    user_label = ParagraphStyle(
        'UserLabel', parent=styles['Normal'],
        fontSize=11, fontName='Helvetica-Bold', textColor=colors.darkgreen, spaceBefore=10
    )
    ai_label = ParagraphStyle(
        'AILabel', parent=styles['Normal'],
        fontSize=11, fontName='Helvetica-Bold', textColor=colors.darkblue, spaceBefore=10
    )
    msg_style = ParagraphStyle(
        'MessageContent', parent=styles['Normal'],
        fontSize=11, spaceAfter=8, leading=14
    )

    story = []
    
    # ── Header ──
    story.append(Paragraph(f"CampusFlow Chat Export", header_style))
    story.append(Paragraph(f"<b>Session ID:</b> {session_id}", meta_style))
    story.append(Paragraph(f"<b>Session Name:</b> {title}", meta_style))
    story.append(Paragraph(f"<b>Requested By:</b> {username} ({user_role.replace('_', ' ').title()})", meta_style))
    story.append(Paragraph(f"<b>Exported Date:</b> {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", meta_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey, spaceBefore=8, spaceAfter=16))

    # ── Messages ──
    for msg in messages:
        role = msg.get("role", "unknown")
        # Replace newlines with bold HTML tags and handle markdown safely
        content = str(msg.get("content", "")).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        content = content.replace('\n', '<br/>')
        
        ts = str(msg.get("created_at", ""))[:19].replace("T", " ")
        
        if role == "user":
            story.append(Paragraph(f"User [{ts}]:", user_label))
        elif role == "assistant":
            story.append(Paragraph(f"CampusBot [{ts}]:", ai_label))
        else:
            story.append(Paragraph(f"{role.title()} [{ts}]:", user_label))
            
        story.append(Paragraph(content, msg_style))
        story.append(Spacer(1, 4))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.whitesmoke, spaceBefore=2, spaceAfter=2))

    # Build PDF
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


# ============================================================
# AICTE VigilOS — Cases List PDF Generator
# ============================================================
def generate_cases_pdf(
    cases: List[dict],
    user_name: str = "Officer",
    user_role: str = "super_admin",
    user_bureau: str = "National Portal",
    user_region: str = "HQ (New Delhi)",
    filters: Optional[dict] = None,
) -> bytes:
    """
    Generate an official AICTE VigilOS Complaint Registry & Monitoring Report PDF.
    Renders landscape letter format with header letterhead, KPI summary, and structured cases table.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=36,
        title="AICTE VigilOS Cases Report"
    )

    styles = getSampleStyleSheet()

    def esc(text) -> str:
        if text is None:
            return ""
        return html.escape(str(text))

    # Header styles
    title_style = ParagraphStyle(
        'AICTETitle', parent=styles['Normal'],
        fontSize=13, fontName='Helvetica-Bold', textColor=colors.HexColor('#78181A'),
        leading=16, spaceAfter=2
    )
    subtitle_style = ParagraphStyle(
        'AICTESubtitle', parent=styles['Normal'],
        fontSize=9, fontName='Helvetica-Bold', textColor=colors.HexColor('#1E293B'),
        leading=12
    )
    desc_style = ParagraphStyle(
        'AICTEDesc', parent=styles['Normal'],
        fontSize=7.5, fontName='Helvetica', textColor=colors.HexColor('#64748B'),
        leading=10
    )
    meta_label = ParagraphStyle(
        'AICTEMetaLabel', parent=styles['Normal'],
        fontSize=7.5, fontName='Helvetica-Bold', textColor=colors.HexColor('#334155'),
        alignment=2, leading=11
    )
    meta_val = ParagraphStyle(
        'AICTEMetaVal', parent=styles['Normal'],
        fontSize=7.5, fontName='Helvetica', textColor=colors.HexColor('#64748B'),
        alignment=2, leading=11
    )

    # Table styles
    th_style = ParagraphStyle(
        'TableHead', parent=styles['Normal'],
        fontSize=8, fontName='Helvetica-Bold', textColor=colors.white,
        leading=10, alignment=0
    )
    cell_style = ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontSize=7.5, leading=10, textColor=colors.HexColor('#1E293B')
    )
    kpi_num_style = ParagraphStyle(
        'KpiNum', parent=styles['Normal'],
        fontSize=11, fontName='Helvetica-Bold', alignment=1, leading=13
    )
    kpi_lbl_style = ParagraphStyle(
        'KpiLbl', parent=styles['Normal'],
        fontSize=7, fontName='Helvetica-Bold', textColor=colors.HexColor('#475569'),
        alignment=1, leading=9
    )

    story = []

    # ── 1. Official AICTE Letterhead ──
    now_str = datetime.datetime.now().strftime("%d %b %Y, %I:%M %p IST")
    f_bureau = (filters or {}).get("bureau", "ALL")
    f_region = (filters or {}).get("region", "ALL")
    f_status = (filters or {}).get("status", "ALL")
    f_search = (filters or {}).get("search", "")

    role_formatted = user_role.replace("_", " ").title()

    left_header = [
        Paragraph("ALL INDIA COUNCIL FOR TECHNICAL EDUCATION", title_style),
        Paragraph("VigilOS · Integrated Regulatory & Grievance Oversight System", subtitle_style),
        Paragraph("Statutory Body Under Ministry of Education, Government of India · PS26264 Integrated Monitor", desc_style),
    ]

    right_header = [
        Paragraph(f"<b>Report Date:</b> {esc(now_str)}", meta_label),
        Paragraph(f"<b>Exported By:</b> {esc(user_name)} ({esc(role_formatted)})", meta_val),
        Paragraph(f"<b>Jurisdiction:</b> {esc(user_bureau)} / {esc(user_region)}", meta_val),
    ]

    header_table = Table([[left_header, right_header]], colWidths=[460, 260])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(header_table)

    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#78181A'), spaceBefore=6, spaceAfter=8))

    # ── 2. Filter Summary & KPI Metric Cards ──
    filter_parts = [f"Bureau: <b>{esc(f_bureau)}</b>", f"Region: <b>{esc(f_region)}</b>", f"Status: <b>{esc(f_status.upper())}</b>"]
    if f_search:
        filter_parts.append(f"Keyword: <b>\"{esc(f_search)}\"</b>")
    filter_desc = Paragraph(" &nbsp;·&nbsp; ".join(filter_parts), desc_style)

    # Compute KPIs
    total_cnt = len(cases)
    under_process_cnt = sum(1 for c in cases if c.get("status") == "under_process")
    escalated_cnt = sum(1 for c in cases if c.get("status") == "escalated")
    disposed_cnt = sum(1 for c in cases if c.get("status") == "disposed")
    received_cnt = sum(1 for c in cases if c.get("status") == "received")
    breached_cnt = sum(1 for c in cases if c.get("sla_breached"))

    kpi_cards = [
        [
            Paragraph(f"<font color='#0F172A'>{total_cnt}</font>", kpi_num_style),
            Paragraph(f"<font color='#2563EB'>{received_cnt}</font>", kpi_num_style),
            Paragraph(f"<font color='#D97706'>{under_process_cnt}</font>", kpi_num_style),
            Paragraph(f"<font color='#DC2626'>{escalated_cnt}</font>", kpi_num_style),
            Paragraph(f"<font color='#16A34A'>{disposed_cnt}</font>", kpi_num_style),
            Paragraph(f"<font color='#991B1B'>{breached_cnt}</font>", kpi_num_style),
        ],
        [
            Paragraph("TOTAL CASES", kpi_lbl_style),
            Paragraph("RECEIVED", kpi_lbl_style),
            Paragraph("UNDER PROCESS", kpi_lbl_style),
            Paragraph("ESCALATED", kpi_lbl_style),
            Paragraph("DISPOSED", kpi_lbl_style),
            Paragraph("SLA BREACHED", kpi_lbl_style),
        ]
    ]
    kpi_table = Table(kpi_cards, colWidths=[120, 120, 120, 120, 120, 120])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    story.append(filter_desc)
    story.append(Spacer(1, 4))
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    # ── 3. Cases Data Table ──
    table_data = [[
        Paragraph("Case ID & Filed", th_style),
        Paragraph("Institution Name & AICTE PID", th_style),
        Paragraph("Bureau / Region", th_style),
        Paragraph("Category & Grievance Subject", th_style),
        Paragraph("Assigned Officer", th_style),
        Paragraph("Status & SLA Monitoring", th_style),
    ]]

    status_color_map = {
        "escalated": "#DC2626",
        "disposed": "#16A34A",
        "under_process": "#D97706",
        "received": "#2563EB",
        "transferred": "#7C3AED",
    }

    if not cases:
        empty_p = Paragraph("<font color='#64748B'><i>No complaint cases match the selected filters.</i></font>", cell_style)
        table_data.append([empty_p, Paragraph("", cell_style), Paragraph("", cell_style), Paragraph("", cell_style), Paragraph("", cell_style), Paragraph("", cell_style)])
    else:
        for c in cases:
            cid = esc(c.get("case_id", ""))
            created_dt = esc(c.get("created_at", "")[:10])
            inst_name = esc(c.get("institution_name", "—"))
            pid = esc(c.get("aicte_pid", "—"))
            bureau = esc(c.get("bureau", "—"))
            region = esc(c.get("region", "—"))
            category = esc(c.get("category", "General"))
            title = esc(c.get("title", ""))
            if len(title) > 95:
                title = title[:92] + "..."
            officer = esc(c.get("assigned_officer", "Unassigned"))
            status_val = str(c.get("status", "received")).lower()
            status_color = status_color_map.get(status_val, "#475569")
            ageing = c.get("ageing_days", 0)
            sla_days = c.get("sla_days", 30)
            is_breached = bool(c.get("sla_breached"))

            c1 = Paragraph(f"<b>{cid}</b><br/><font size='6.5' color='#64748B'>Filed: {created_dt}</font>", cell_style)
            c2 = Paragraph(f"<b>{inst_name}</b><br/><font size='6.5' color='#475569'>AICTE PID: {pid}</font>", cell_style)
            c3 = Paragraph(f"<b>{bureau}</b><br/><font size='6.5' color='#64748B'>{region}</font>", cell_style)
            c4 = Paragraph(f"<b>{category}</b><br/><font size='6.5' color='#334155'>{title}</font>", cell_style)
            c5 = Paragraph(f"<font size='7'>{officer}</font>", cell_style)

            sla_text = f"<font color='{status_color}'><b>{status_val.replace('_', ' ').upper()}</b></font><br/><font size='6.5' color='#64748B'>Ageing: {ageing}d / SLA: {sla_days}d</font>"
            if is_breached:
                sla_text += "<br/><font size='6.5' color='#DC2626'><b>⚠ SLA BREACHED</b></font>"
            c6 = Paragraph(sla_text, cell_style)

            table_data.append([c1, c2, c3, c4, c5, c6])

    cases_table = Table(table_data, colWidths=[95, 155, 75, 185, 95, 115], repeatRows=1)
    
    table_styles = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#78181A')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]

    for idx in range(1, len(table_data)):
        row_bg = colors.HexColor('#F8FAFC') if idx % 2 == 1 else colors.white
        table_styles.append(('BACKGROUND', (0, idx), (-1, idx), row_bg))

    cases_table.setStyle(TableStyle(table_styles))
    story.append(cases_table)

    # ── 4. Canvas Footer Callback ──
    def add_page_decorations(canvas, d):
        canvas.saveState()
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(colors.HexColor('#64748B'))
        canvas.drawString(36, 18, "AICTE VigilOS · Official Case Registry Report · Confidential — For Regulatory & Oversight Use Only")
        canvas.drawRightString(792 - 36, 18, f"Page {d.page} · Government of India")
        canvas.restoreState()

    doc.build(story, onFirstPage=add_page_decorations, onLaterPages=add_page_decorations)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

