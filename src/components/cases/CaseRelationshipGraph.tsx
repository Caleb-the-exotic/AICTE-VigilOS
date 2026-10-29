import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { GitGraph, Network, ShieldAlert, AlertTriangle, Eye, CheckCircle2, ChevronRight, Filter } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface GraphCase {
  case_id: string;
  aicte_pid: string;
  institution_name: string;
  bureau: string;
  category: string;
  title: string;
  description: string;
  status: string;
  linked_case_ids?: string[] | string;
}

export interface CaseRelationshipGraphProps {
  cases: GraphCase[];
  onSelectCase?: (c: GraphCase) => void;
  onSelectInstitution?: (pid: string) => void;
}

export function CaseRelationshipGraph({ cases, onSelectCase, onSelectInstitution }: CaseRelationshipGraphProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const [filterType, setFilterType] = useState<"ALL" | "CONFIRMED" | "SUSPECTED">("ALL");

  // Tokenize and clean text for client-side semantic similarity
  const stopWords = useMemo(() => new Set([
    "the", "is", "at", "which", "on", "a", "an", "and", "or", "in", "to", "for", "of",
    "with", "as", "by", "this", "that", "it", "from", "be", "are", "was", "were", "has",
    "have", "had", "been", "will", "would", "shall", "should", "can", "could", "may",
    "must", "we", "our", "their", "they", "students", "faculty", "regarding", "against"
  ]), []);

  const getTokens = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  };

  // Build relationships based on:
  // 1. Institution ID match (Definite institutional link)
  // 2. Semantic string token similarity between complaint titles & descriptions
  // 3. Confirmed linked_case_ids vs. Suspected overlap matches
  const { nodes, links, stats } = useMemo(() => {
    const nodeList: any[] = [];
    const linkList: any[] = [];
    const nodeIds = new Set<string>();

    const instMap = new Map<string, { pid: string; name: string; cases: GraphCase[] }>();
    const bureauSet = new Set<string>();

    cases.forEach((c) => {
      bureauSet.add(c.bureau);
      if (!instMap.has(c.aicte_pid)) {
        instMap.set(c.aicte_pid, { pid: c.aicte_pid, name: c.institution_name, cases: [] });
      }
      instMap.get(c.aicte_pid)!.cases.push(c);
    });

    // 1. Add Bureau Hub Nodes
    bureauSet.forEach((bureau) => {
      const bId = `bureau_${bureau}`;
      nodeList.push({
        id: bId,
        name: `${bureau} Bureau`,
        category: "Bureau",
        symbolSize: 42,
        itemStyle: {
          color: bureau === "RB" ? "#ef4444" : bureau === "PGRC" ? "#f43f5e" : "#0284c7",
          borderColor: isDark ? "#ffffff" : "#0f172a",
          borderWidth: 2,
        },
        label: { show: true, position: "top", fontSize: 11, fontWeight: "bold", color: isDark ? "#ffffff" : "#0f172a" },
        tooltip: { formatter: `<strong>Bureau Authority: ${bureau}</strong>` },
      });
      nodeIds.add(bId);
    });

    // 2. Add Institution Nodes
    instMap.forEach((inst, pid) => {
      const iId = `inst_${pid}`;
      nodeList.push({
        id: iId,
        name: inst.name,
        category: "Institution",
        pid: inst.pid,
        symbolSize: Math.min(26 + inst.cases.length * 6, 48),
        itemStyle: {
          color: isDark ? "#3b82f6" : "#2563eb",
          borderColor: "#93c5fd",
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "bottom",
          fontSize: 10,
          color: isDark ? "#cbd5e1" : "#1e293b",
          formatter: (p: any) => p.name.length > 18 ? p.name.slice(0, 18) + "..." : p.name,
        },
      });
      nodeIds.add(iId);
    });

    // 3. Add Case Nodes and Link to Institution & Bureau
    cases.forEach((c) => {
      const cId = `case_${c.case_id}`;
      const isBreached = c.status === "breached";
      nodeList.push({
        id: cId,
        name: c.case_id,
        category: "Case",
        caseData: c,
        symbolSize: 22,
        itemStyle: {
          color: isBreached ? "#dc2626" : c.status === "disposed" ? "#10b981" : "#f59e0b",
          borderColor: isDark ? "#18181b" : "#ffffff",
          borderWidth: 1.5,
        },
        label: {
          show: true,
          position: "right",
          fontSize: 9,
          color: isDark ? "#94a3b8" : "#475569",
        },
      });
      nodeIds.add(cId);

      // Edge from Institution -> Case (Structural containment)
      const iId = `inst_${c.aicte_pid}`;
      if (nodeIds.has(iId)) {
        linkList.push({
          source: iId,
          target: cId,
          relationType: "INSTITUTION_CASE",
          lineStyle: { width: 1.5, color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" },
        });
      }

      // Edge from Bureau -> Case (Jurisdiction)
      const bId = `bureau_${c.bureau}`;
      if (nodeIds.has(bId)) {
        linkList.push({
          source: bId,
          target: cId,
          relationType: "BUREAU_JURISDICTION",
          lineStyle: { width: 1.5, type: "dashed", color: c.bureau === "RB" ? "rgba(239,68,68,0.4)" : "rgba(244,63,94,0.4)" },
        });
      }
    });

    // 4. Calculate Cross-Case Relationships:
    // A. Confirmed Explicit Consolidation / Linking
    // B. Suspected Cross-Bureau Overlaps based on PID + Semantic description similarity
    let confirmedCount = 0;
    let suspectedCount = 0;

    for (let i = 0; i < cases.length; i++) {
      for (let j = i + 1; j < cases.length; j++) {
        const c1 = cases[i];
        const c2 = cases[j];

        // Check explicit linking
        const linkedC1 = Array.isArray(c1.linked_case_ids) ? c1.linked_case_ids : [];
        const linkedC2 = Array.isArray(c2.linked_case_ids) ? c2.linked_case_ids : [];
        const isConfirmedLinked = linkedC1.includes(c2.case_id) || linkedC2.includes(c1.case_id);

        if (isConfirmedLinked) {
          confirmedCount++;
          if (filterType === "ALL" || filterType === "CONFIRMED") {
            linkList.push({
              source: `case_${c1.case_id}`,
              target: `case_${c2.case_id}`,
              relationType: "CONFIRMED_LINK",
              value: "100% Linked",
              evidence: "Official cross-bureau consolidation verified by AICTE authority.",
              lineStyle: {
                width: 3.5,
                color: "#10b981",
                curveness: 0.2,
              },
            });
          }
          continue;
        }

        // Calculate Evidence Scores:
        // Institution ID match = strong initial signal (0.45)
        // Category match = +0.25
        // Semantic Token Jaccard overlap = +0.30
        const isSamePid = c1.aicte_pid === c2.aicte_pid;
        const isDiffBureau = c1.bureau !== c2.bureau;
        const isSameCategory = c1.category.toLowerCase() === c2.category.toLowerCase();

        const t1 = new Set(getTokens(`${c1.title} ${c1.description}`));
        const t2 = new Set(getTokens(`${c2.title} ${c2.description}`));
        const commonTokens = [...t1].filter((x) => t2.has(x));

        const jaccard = t1.size > 0 && t2.size > 0 ? commonTokens.length / (t1.size + t2.size - commonTokens.length) : 0;

        let score = 0;
        const evidenceSignals: string[] = [];

        if (isSamePid) {
          score += 0.45;
          evidenceSignals.push(`Identical Institution PID (${c1.aicte_pid})`);
        }
        if (isSameCategory) {
          score += 0.25;
          evidenceSignals.push(`Category Concurrence: "${c1.category}"`);
        }
        if (jaccard > 0.15) {
          const simBonus = Math.min(0.30, jaccard * 1.2);
          score += simBonus;
          evidenceSignals.push(`Semantic Keyword Similarity: ${commonTokens.slice(0, 4).join(", ")}`);
        }

        // Suspected Relationship threshold
        if (score >= 0.45 && isDiffBureau) {
          suspectedCount++;
          if (filterType === "ALL" || filterType === "SUSPECTED") {
            const pct = Math.round(score * 100);
            linkList.push({
              source: `case_${c1.case_id}`,
              target: `case_${c2.case_id}`,
              relationType: "SUSPECTED_OVERLAP",
              value: `${pct}% Overlap Signal`,
              evidence: evidenceSignals.join(" • "),
              lineStyle: {
                width: 2.2,
                type: "dotted",
                color: score >= 0.7 ? "#ef4444" : "#f59e0b",
                curveness: 0.25,
              },
            });
          }
        }
      }
    }

    return {
      nodes: nodeList,
      links: linkList,
      stats: { confirmedCount, suspectedCount, totalInstitutions: instMap.size, totalCases: cases.length },
    };
  }, [cases, filterType, isDark]);

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: isDark ? "#18181b" : "#ffffff",
      borderColor: isDark ? "#3f3f46" : "#cbd5e1",
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: isDark ? "#f4f4f5" : "#0f172a", fontSize: 12 },
      formatter: (params: any) => {
        if (params.dataType === "edge") {
          const d = params.data;
          if (d.relationType === "CONFIRMED_LINK") {
            return `<div style="font-weight:bold;color:#10b981;margin-bottom:4px;">✓ Confirmed Case Relationship</div>
                    <div><b>Status:</b> Consolidated Joint Track</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${d.evidence || ""}</div>`;
          }
          if (d.relationType === "SUSPECTED_OVERLAP") {
            return `<div style="font-weight:bold;color:#ef4444;margin-bottom:4px;">⚠ Suspected Overlap Conflict</div>
                    <div><b>Confidence:</b> ${d.value}</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:2px;"><b>Evidence Signals:</b><br/>${d.evidence}</div>`;
          }
          return `<b>Connected Jurisdiction</b>`;
        }
        if (params.data.category === "Bureau") {
          return `<strong>${params.data.name}</strong><br/><span style="color:#94a3b8;font-size:11px;">Central AICTE Jurisdiction Node</span>`;
        }
        if (params.data.category === "Institution") {
          return `<strong>${params.data.name}</strong><br/><span style="color:#94a3b8;font-size:11px;">PID: ${params.data.pid}</span>`;
        }
        if (params.data.category === "Case") {
          const c = params.data.caseData;
          return `<div style="font-weight:bold;margin-bottom:2px;">Case: ${c.case_id}</div>
                  <div><b>Institution:</b> ${c.institution_name}</div>
                  <div><b>Bureau:</b> ${c.bureau} | <b>Category:</b> ${c.category}</div>
                  <div><b>Title:</b> ${c.title}</div>
                  <div><b>Status:</b> ${c.status.toUpperCase()}</div>`;
        }
        return params.name;
      },
    },
    series: [
      {
        type: "graph",
        layout: "force",
        data: nodes,
        links: links,
        roam: true,
        label: {
          position: "right",
        },
        force: {
          repulsion: 240,
          gravity: 0.1,
          edgeLength: [50, 160],
          friction: 0.6,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: { width: 4 },
        },
      },
    ],
  }), [nodes, links, isDark]);

  const onChartClick = (params: any) => {
    if (params.dataType === "node") {
      if (params.data.category === "Case" && params.data.caseData && onSelectCase) {
        onSelectCase(params.data.caseData);
      }
      if (params.data.category === "Institution" && params.data.pid && onSelectInstitution) {
        onSelectInstitution(params.data.pid);
      }
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header and Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <GitGraph className="w-5 h-5 text-primary" />
            Case Relationship & Overlap Conflict Graph
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visual topology mapping confirmed and suspected cross-bureau dependencies between cases, institutions, and AICTE cells.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1.5 bg-secondary/40 p-1 rounded-xl border border-border/40">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              filterType === "ALL" ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Connections
          </button>
          <button
            type="button"
            onClick={() => setFilterType("CONFIRMED")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1",
              filterType === "CONFIRMED" ? "bg-emerald-600 text-white shadow-xs" : "text-muted-foreground hover:text-emerald-400"
            )}
          >
            <CheckCircle2 className="w-3 h-3" />
            Confirmed ({stats.confirmedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("SUSPECTED")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1",
              filterType === "SUSPECTED" ? "bg-red-600 text-white shadow-xs" : "text-muted-foreground hover:text-red-400"
            )}
          >
            <AlertTriangle className="w-3 h-3" />
            Suspected ({stats.suspectedCount})
          </button>
        </div>
      </div>

      {/* Legend Indicator Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground bg-secondary/20 p-2.5 rounded-xl border border-border/20">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Bureaus (RB, PGRC, RO)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Institutions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Active Cases
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Resolved Cases
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="text-emerald-400 font-bold">─── Confirmed Consolidated</span>
          <span className="text-red-400 font-bold">······ Suspected Conflict</span>
        </div>
      </div>

      {/* Interactive ECharts Force Graph */}
      <div className="w-full h-[520px] rounded-xl border border-border/30 bg-background/50 overflow-hidden relative">
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          onEvents={{ click: onChartClick }}
          opts={{ renderer: "canvas" }}
        />
        <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/70 pointer-events-none">
          Drag nodes or scroll to zoom • Click a case/institution node to view full profile
        </div>
      </div>
    </div>
  );
}

