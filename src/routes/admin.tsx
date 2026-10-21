import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, Users, UserPlus, CheckCircle2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminPanel });

interface UserItem {
  name: string;
  email: string;
  role: "admin" | "officer" | "bureau_head" | "investigator" | "reviewer";
  bureau: string;
  region: string;
}

const initialUsers: UserItem[] = [
  { name: "Dr. Ramesh Gupta", email: "ramesh.gupta@aicte-india.org", role: "bureau_head", bureau: "RB (Regulation Bureau)", region: "HQ (New Delhi)" },
  { name: "Ms. Priya Verma", email: "priya.verma@aicte-india.org", role: "officer", bureau: "PGRC", region: "Northern" },
  { name: "Mr. Suresh Iyer", email: "suresh.iyer@aicte-india.org", role: "investigator", bureau: "RB", region: "Western" },
  { name: "Dr. Anita Sharma", email: "anita.sharma@aicte-india.org", role: "officer", bureau: "PGRC", region: "Western" },
  { name: "Mr. Deepak Nair", email: "deepak.nair@aicte-india.org", role: "reviewer", bureau: "RB", region: "Eastern" },
  { name: "Kavita Singh", email: "kavita.singh@aicte-india.org", role: "investigator", bureau: "PGRC", region: "Southern" },
  { name: "System Administrator", email: "admin@aicte-india.org", role: "admin", bureau: "IT & Vigilance Cell", region: "HQ (New Delhi)" },
];

function AdminPanel() {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState("");

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.bureau.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center shadow-[0_0_15px_rgba(220,38,38,0.2)]">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Management</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                AICTE Officer Directory & Role-Based Access Control
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-secondary/50 border border-border/30 px-3 py-1.5 rounded-lg">
              {filtered.length} Officers Registered
            </span>
          </div>
        </div>

        {/* Users Panel Card */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border/30 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Authorized Personnel & Officers</h2>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search officers, email, or bureau…"
              className="h-8 px-3 rounded-lg bg-background border border-border/40 text-xs w-64 input-glow focus:outline-none placeholder-muted-foreground/60"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
                <tr>
                  <th className="text-left px-4 py-3">Officer Name</th>
                  <th className="text-left px-4 py-3">Official Email</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Bureau / Cell</th>
                  <th className="text-left px-4 py-3">Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filtered.map((u) => (
                  <tr key={u.email} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 grid place-items-center text-xs font-bold text-primary">
                        {u.name.slice(0, 1)}
                      </div>
                      <span className="text-white/90">{u.name}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border",
                        u.role === "admin"
                          ? "bg-primary/20 text-primary border-primary/40 shadow-sm"
                          : u.role === "bureau_head"
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-secondary text-muted-foreground border-border/40"
                      )}>
                        {u.role === "admin" && <Shield className="w-2.5 h-2.5" />}
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/80 text-xs">{u.bureau}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{u.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
