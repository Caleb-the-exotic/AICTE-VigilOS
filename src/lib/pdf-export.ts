// ============================================================
// src/lib/pdf-export.ts — Official AICTE Cases PDF Generator
// ============================================================
// Provides both backend ReportLab export (authoritative) and
// instant client-side jsPDF + autoTable export (resilient fallback).
// ============================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE_URL, HAS_BACKEND } from "@/lib/api";
import { toast } from "sonner";

export interface AICTECaseExportItem {
  case_id: string;
  aicte_pid: string;
  institution_name: string;
  region: string;
  bureau: string;
  complainant_type?: string;
  category: string;
  title: string;
  description?: string;
  assigned_officer?: string;
  status: string;
  sla_days?: number;
  sla_deadline?: string;
  created_at?: string;
  ageing_days?: number;
  sla_breached?: boolean;
}

export interface ExportCasesOptions {
  cases: AICTECaseExportItem[];
  bureauFilter?: string;
  statusFilter?: string;
  regionFilter?: string;
  searchQ?: string;
  userName?: string;
  userRole?: string;
  userBureau?: string;
  userRegion?: string;
}

/**
 * Exports the specified cases to an official AICTE PDF report.
 * Tries the backend ReportLab endpoint first for server-authoritative vector output.
 * Seamlessly falls back to client-side jsPDF in demo mode or network failure.
 */
export async function exportCasesAsPdf(options: ExportCasesOptions): Promise<void> {
  const {
    cases,
    bureauFilter = "ALL",
    statusFilter = "ALL",
    regionFilter = "ALL",
    searchQ = "",
    userName = "Officer",
    userRole = "super_admin",
    userBureau = "National Portal",
    userRegion = "HQ (New Delhi)",
  } = options;

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `AICTE_Cases_Report_${dateStamp}.pdf`;

  // 1. Attempt authoritative backend ReportLab export if backend is active
  if (HAS_BACKEND) {
    try {
      const token = localStorage.getItem("aicte_token") || "";
      const res = await fetch(`${API_BASE_URL}/api/aicte/cases/export/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cases,
          bureau: bureauFilter,
          status: statusFilter,
          region: regionFilter,
          search: searchQ,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 500) {
          triggerBrowserDownload(blob, filename);
          toast.success(`Exported ${cases.length} cases to official AICTE PDF report`);
          return;
        }
      }
    } catch (err) {
      console.warn("Backend PDF export unavailable, generating client-side report:", err);
    }
  }

  // 2. Client-side jsPDF generator (guaranteed to work offline / demo mode)
  try {
    generateClientSidePdf(options, filename);
    toast.success(`Exported ${cases.length} cases to PDF`);
  } catch (err: any) {
    console.error("Client PDF generation error:", err);
    toast.error("Failed to generate PDF: " + (err?.message || "Unknown error"));
  }
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Builds a pixel-perfect, government-styled AICTE Cases Registry PDF in browser memory.
 */
function generateClientSidePdf(options: ExportCasesOptions, filename: string) {
  const {
    cases,
    bureauFilter = "ALL",
    statusFilter = "ALL",
    regionFilter = "ALL",
    searchQ = "",
    userName = "Officer",
    userRole = "super_admin",
    userBureau = "National Portal",
    userRegion = "HQ (New Delhi)",
  } = options;

  // A4 Landscape: 297mm x 210mm
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;

  // ── Top Header Brand Strip ──
  doc.setFillColor(120, 24, 26); // AICTE Deep Maroon #78181A
  doc.rect(0, 0, pageWidth, 4, "F");

  // ── Header Letterhead ──
  let y = 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(120, 24, 26);
  doc.text("ALL INDIA COUNCIL FOR TECHNICAL EDUCATION", margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59); // Slate-800
  y += 5;
  doc.text("VigilOS · Integrated Regulatory & Grievance Oversight System", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  y += 4;
  doc.text("Statutory Body Under Ministry of Education, Government of India · PS26264 Integrated Monitor", margin, y);

  // ── Header Right Metadata ──
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const roleFormatted = userRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Report Date: ${dateStr}, ${timeStr}`, pageWidth - margin, 14, { align: "right" });
  doc.setTextColor(100, 116, 139);
  doc.text(`Exported By: ${userName} (${roleFormatted})`, pageWidth - margin, 18.5, { align: "right" });
  doc.text(`Scope: ${userBureau} / ${userRegion}`, pageWidth - margin, 23, { align: "right" });

  // ── Divider Line ──
  y += 3;
  doc.setDrawColor(120, 24, 26);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);

  // ── Filter Chips Summary ──
  y += 4.5;
  const filterDesc = `Active Filters: Bureau: ${bureauFilter}  |  Region: ${regionFilter}  |  Status: ${statusFilter.toUpperCase()}${
    searchQ ? `  |  Keyword: "${searchQ}"` : ""
  }`;
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(filterDesc, margin, y);

  // ── KPI Summary Cards Bar ──
  y += 3;
  const total = cases.length;
  const received = cases.filter((c) => c.status === "received").length;
  const underProcess = cases.filter((c) => c.status === "under_process").length;
  const escalated = cases.filter((c) => c.status === "escalated").length;
  const disposed = cases.filter((c) => c.status === "disposed").length;
  const breached = cases.filter((c) => c.sla_breached).length;

  const kpis = [
    { label: "TOTAL CASES", value: total, color: [15, 23, 42] },
    { label: "RECEIVED", value: received, color: [37, 99, 235] },
    { label: "UNDER PROCESS", value: underProcess, color: [217, 119, 6] },
    { label: "ESCALATED", value: escalated, color: [220, 38, 38] },
    { label: "DISPOSED", value: disposed, color: [22, 163, 74] },
    { label: "SLA BREACHED", value: breached, color: [153, 27, 27] },
  ];

  const totalCardWidth = pageWidth - margin * 2;
  const cardWidth = totalCardWidth / kpis.length;
  const cardHeight = 11;

  kpis.forEach((kpi, idx) => {
    const cx = margin + idx * cardWidth;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(cx, y, cardWidth, cardHeight, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(String(kpi.value), cx + cardWidth / 2, y + 4.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cx + cardWidth / 2, y + 8.5, { align: "center" });
  });

  // ── Table Content ──
  const tableStartY = y + cardHeight + 4;

  const tableBody = cases.map((c) => {
    const caseId = `${c.case_id}\nFiled: ${c.created_at ? c.created_at.slice(0, 10) : "—"}`;
    const inst = `${c.institution_name || "—"}\nPID: ${c.aicte_pid || "—"}`;
    const bureau = `${c.bureau || "—"}\n${c.region || "—"}`;
    const category = `${c.category || "General"}\n${(c.title || "").slice(0, 85)}${
      (c.title || "").length > 85 ? "..." : ""
    }`;
    const officer = c.assigned_officer || "Unassigned";

    let slaStatus = `${(c.status || "received").toUpperCase().replace(/_/g, " ")}\nAge: ${c.ageing_days ?? 0}d | SLA: ${
      c.sla_days ?? 30
    }d`;
    if (c.sla_breached) {
      slaStatus += "\n⚠ SLA BREACHED";
    }

    return [caseId, inst, bureau, category, officer, slaStatus];
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin, bottom: 14 },
    head: [[
      "Case ID & Filed",
      "Institution Name & AICTE PID",
      "Bureau / Region",
      "Category & Grievance Subject",
      "Assigned Officer",
      "Status & SLA Monitoring",
    ]],
    body: tableBody.length > 0 ? tableBody : [["No cases match the selected filters.", "", "", "", "", ""]],
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [120, 24, 26], // AICTE Maroon
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 2.8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 58 },
      2: { cellWidth: 32 },
      3: { cellWidth: 70 },
      4: { cellWidth: 38 },
      5: { cellWidth: 37, fontStyle: "bold" },
    },
    didDrawPage: (data) => {
      // ── Footer ──
      const footerY = pageHeight - 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(
        "AICTE VigilOS · Official Case Registry Report · Confidential — For Regulatory & Oversight Use Only",
        margin,
        footerY
      );
      doc.text(
        `Page ${data.pageNumber} · Government of India`,
        pageWidth - margin,
        footerY,
        { align: "right" }
      );
    },
  });

  doc.save(filename);
}
