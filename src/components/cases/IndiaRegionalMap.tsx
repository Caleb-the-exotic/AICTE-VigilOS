import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Building2, FileText, MapPin, ShieldAlert } from "lucide-react";
import { INDIA_MAP_VIEWBOX, INDIA_STATES } from "./indiaMapData";

interface RegionCaseSummary {
  region: string;
  casesCount: number;
  collegesCount: number;
  colleges: string[];
}

interface IndiaRegionalMapProps {
  regionData: Record<string, RegionCaseSummary>;
  totalCases: number;
  onSelectRegion?: (region: string) => void;
}

export function IndiaRegionalMap({ regionData, totalCases, onSelectRegion }: IndiaRegionalMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>("Northern");

  // Geographic pin anchor coordinates in the 0 0 612 696 viewBox for the 6 sections
  const regionPins: Record<string, { label: string; x: number; y: number; desc: string }> = {
    Northern: {
      label: "Northern Region",
      x: 185,
      y: 200,
      desc: "Punjab, Haryana, Himachal Pradesh, J&K, Ladakh, Rajasthan, Delhi, Chandigarh",
    },
    Central: {
      label: "Central Region",
      x: 275,
      y: 285,
      desc: "Madhya Pradesh, Chhattisgarh, Uttar Pradesh, Uttarakhand",
    },
    Western: {
      label: "Western Region",
      x: 160,
      y: 380,
      desc: "Maharashtra, Gujarat, Goa, Dadra & Nagar Haveli, Daman & Diu",
    },
    Southern: {
      label: "Southern Region",
      x: 235,
      y: 520,
      desc: "Tamil Nadu, Karnataka, Andhra Pradesh, Telangana, Kerala, Puducherry, Andaman & Nicobar",
    },
    Eastern: {
      label: "Eastern Region",
      x: 375,
      y: 320,
      desc: "Bihar, Jharkhand, Odisha, West Bengal",
    },
    "North Eastern": {
      label: "North Eastern Region",
      x: 510,
      y: 250,
      desc: "Assam, Arunachal Pradesh, Meghalaya, Manipur, Mizoram, Nagaland, Tripura, Sikkim",
    },
  };

  const currentSummary = hoveredRegion
    ? regionData[hoveredRegion] || {
        region: hoveredRegion,
        casesCount: 0,
        collegesCount: 0,
        colleges: [],
      }
    : null;

  return (
    <div className="glass-card p-5 mt-4 overflow-hidden border border-border/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-border/20 pb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-white">
            <MapPin className="w-4 h-4 text-primary" /> Regional Geographic Complaint Distribution (6 Zones)
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Geographic density of institutional grievances registered across 6 Jurisdictional Regions
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-muted-foreground">Total Complaints:</span>
          <span className="text-primary font-bold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
            {totalCases}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Geographic Authentic India SVG Map - Unified Red Crimson AICTE Theme */}
        <div className="lg:col-span-7 flex justify-center items-center relative py-2">
          <svg
            viewBox={INDIA_MAP_VIEWBOX}
            className="w-full max-w-[460px] sm:max-w-[520px] lg:max-w-[560px] h-auto drop-shadow-2xl select-none"
            style={{ filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.65))" }}
          >
            <defs>
              {/* Crimson / Red Highlight Gradient matching the platform theme */}
              <linearGradient id="gradRedHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.88" />
                <stop offset="100%" stopColor="#991b1b" stopOpacity="0.95" />
              </linearGradient>

              {/* Glowing filter for highlighted region */}
              <filter id="regionGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Render realistic geographic state boundaries grouped into 6 sections in Red Theme */}
            {INDIA_STATES.map((state) => {
              const isSelected = hoveredRegion === state.region;
              const hasComplaints = (regionData[state.region]?.casesCount || 0) > 0;

              return (
                <path
                  key={state.id}
                  id={state.id}
                  d={state.path}
                  className={cn(
                    "transition-all duration-300 cursor-pointer stroke-[0.75]",
                    isSelected
                      ? "fill-[url(#gradRedHighlight)] stroke-red-200/90 brightness-110"
                      : hasComplaints
                      ? "fill-[#242429] stroke-[#3a3a42] hover:fill-[#32323a]"
                      : "fill-[#1c1c20] stroke-[#2d2d34] hover:fill-[#282830]"
                  )}
                  style={isSelected ? { filter: "url(#regionGlow)" } : undefined}
                  onClick={() => onSelectRegion && onSelectRegion(state.region)}
                  onMouseEnter={() => setHoveredRegion(state.region)}
                >
                  <title>{`${state.name} (${state.region} Region)`}</title>
                </path>
              );
            })}

            {/* Region Interactive Hub Pins & Labels for 6 Sections in Red Theme */}
            {Object.entries(regionPins).map(([regKey, cfg]) => {
              const summary = regionData[regKey] || { casesCount: 0, collegesCount: 0 };
              const isHovered = hoveredRegion === regKey;

              return (
                <g
                  key={regKey}
                  className="cursor-pointer transition-transform duration-200"
                  style={{ transformOrigin: `${cfg.x}px ${cfg.y}px` }}
                  onClick={() => onSelectRegion && onSelectRegion(regKey)}
                  onMouseEnter={() => setHoveredRegion(regKey)}
                >
                  {/* Clean anchor dot without wave circles */}
                  <circle
                    cx={cfg.x}
                    cy={cfg.y}
                    r={isHovered ? 5.5 : 4}
                    className={cn(
                      "transition-all duration-200",
                      isHovered ? "fill-red-300 stroke-white stroke-[1.5]" : "fill-red-500 stroke-neutral-900 stroke-1"
                    )}
                  />
                  {/* Pill backdrop for readable badge */}
                  <rect
                    x={cfg.x - 52}
                    y={cfg.y - 28}
                    width={104}
                    height={18}
                    rx={9}
                    className={cn(
                      "transition-all duration-300",
                      isHovered ? "fill-neutral-900/95 stroke-red-500 stroke-1" : "fill-neutral-900/80 stroke-neutral-700/60 stroke-[0.75]"
                    )}
                  />
                  {/* Region Name */}
                  <text
                    x={cfg.x}
                    y={cfg.y - 15}
                    textAnchor="middle"
                    className="fill-white text-[9px] font-bold tracking-wider pointer-events-none select-none uppercase font-mono"
                  >
                    {regKey}
                  </text>

                  {/* Summary pill below pin */}
                  <rect
                    x={cfg.x - 54}
                    y={cfg.y + 10}
                    width={108}
                    height={16}
                    rx={8}
                    className="fill-neutral-950/90 stroke-neutral-800/80 stroke-[0.75]"
                  />
                  <text
                    x={cfg.x}
                    y={cfg.y + 21}
                    textAnchor="middle"
                    className={cn(
                      "text-[9px] font-mono font-bold pointer-events-none select-none",
                      isHovered ? "fill-red-300" : "fill-neutral-300"
                    )}
                  >
                    {summary.collegesCount} Col. ({summary.casesCount} Cases)
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right Details Panel for the Highlighted Region */}
        <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-4">
          {currentSummary && (
            <div className="rounded-xl border border-border/50 bg-neutral-900/70 p-4 space-y-4 shadow-inner">
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Jurisdiction Profile
                  </span>
                  <h4 className="text-base font-bold text-white mt-1.5 flex items-center gap-1.5">
                    {regionPins[currentSummary.region]?.label || `${currentSummary.region} Region`}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {regionPins[currentSummary.region]?.desc}
                  </p>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Building2 className="w-3.5 h-3.5 text-primary" /> Institutions
                  </div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {currentSummary.collegesCount}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Affected Colleges</p>
                </div>

                <div className="p-3 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <FileText className="w-3.5 h-3.5 text-rose-400" /> Active Cases
                  </div>
                  <div className="text-xl font-bold font-mono text-rose-300 mt-1">
                    {currentSummary.casesCount}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Registered Complaints</p>
                </div>
              </div>

              {/* Complained Colleges List */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                  <span>Colleges with Registered Grievances</span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    {currentSummary.colleges.length} Total
                  </span>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {currentSummary.colleges.length > 0 ? (
                    currentSummary.colleges.map((college, idx) => (
                      <div
                        key={idx}
                        className="text-xs p-2 rounded-md bg-neutral-950/60 border border-neutral-800/80 text-neutral-300 flex items-start gap-2 hover:border-neutral-700 transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="leading-tight">{college}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground p-3 text-center rounded-md bg-neutral-950/30 border border-neutral-800/40">
                      No active institutional complaints recorded in this region.
                    </div>
                  )}
                </div>
              </div>

              {/* AICTE Regional Advisory Footer */}
              <div className="pt-2 border-t border-border/20 flex items-center gap-2 text-[11px] text-neutral-400">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Synchronized with active database grievances across 6 jurisdictional regions.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
