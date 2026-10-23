import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Shield, Users, ShieldAlert, ChevronDown, Check, 
  Search, ShieldCheck, ArrowLeft, Filter
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useAuth, formatRole, type Role } from "@/lib/auth";
import { api, HAS_BACKEND } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({ component: AdminPanel });

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  bureau: string;
  region: string;
}

const DEFAULT_OFFICERS: UserItem[] = [
  { id: "admin-1", name: "System Administrator", email: "admin@aicte-india.org", role: "admin", bureau: "IT & Vigilance Cell", region: "HQ (New Delhi)" },
  { id: "bhead-1", name: "Dr. Ramesh Gupta", email: "ramesh.gupta@aicte-india.org", role: "hod", bureau: "RB (Regulation Bureau)", region: "HQ (New Delhi)" },
  { id: "off-1", name: "Ms. Priya Verma", email: "priya.verma@aicte-india.org", role: "faculty", bureau: "PGRC", region: "Northern" },
  { id: "off-2", name: "Mr. Suresh Iyer", email: "suresh.iyer@aicte-india.org", role: "faculty", bureau: "RB", region: "Western" },
  { id: "off-3", name: "Dr. Anita Sharma", email: "anita.sharma@aicte-india.org", role: "faculty", bureau: "PGRC", region: "Western" },
  { id: "nodal-1", name: "Deepak Nair", email: "deepak.nair@aicte-india.org", role: "ambassador", bureau: "State Liaison", region: "Eastern" },
  { id: "cit-1", name: "Kavita Singh", email: "kavita.singh@aicte-india.org", role: "student", bureau: "Citizen / Complainant Cell", region: "Southern" },
];

const ROLE_OPTIONS: { role: Role; label: string; emoji: string; desc: string; badgeClass: string }[] = [
  { role: "admin", label: "Super Admin", emoji: "🔑", desc: "Central Vigilance & Platform Authority", badgeClass: "bg-red-500/15 text-red-400 border-red-500/30" },
  { role: "hod", label: "Bureau Head", emoji: "🏛️", desc: "RB / PGRC / Regional Bureau Chief", badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { role: "faculty", label: "Approval Officer", emoji: "📋", desc: "Grievance Case Handler & Investigator", badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { role: "ambassador", label: "Regional Nodal Officer", emoji: "🌐", desc: "State & Regional Institutional Liaison", badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { role: "student", label: "Citizen / Complainant", emoji: "👤", desc: "Public Complainant & Grievance Submitter", badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
];

function AdminPanel() {
  const { user, setRole } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeDropdownUser, setActiveDropdownUser] = useState<string | null>(null);

  const loadInitialUsers = (): UserItem[] => {
    const overrides: Record<string, Role> = {};
    try {
      const rawOverrides = localStorage.getItem("aicte_admin_user_roles");
      if (rawOverrides) Object.assign(overrides, JSON.parse(rawOverrides));
    } catch {/**/}

    const map = new Map<string, UserItem>();

    // 1. Defaults
    DEFAULT_OFFICERS.forEach((o) => {
      const key = o.email.toLowerCase();
      map.set(key, { ...o, role: overrides[key] || o.role });
    });

    // 2. Local storage accounts
    try {
      const raw = localStorage.getItem("aicte_registered_users");
      if (raw) {
        const accounts = JSON.parse(raw);
        for (const [key, val] of Object.entries(accounts)) {
          const acc = val as any;
          if (key.includes("@") && acc.email) {
            const emailKey = acc.email.toLowerCase();
            const existing = map.get(emailKey);
            if (existing) {
              existing.role = overrides[emailKey] || acc.role || existing.role;
            } else {
              map.set(emailKey, {
                id: acc.email,
                name: acc.name || acc.email.split("@")[0],
                email: acc.email,
                role: overrides[emailKey] || acc.role || "faculty",
                bureau: "Registered Personnel",
                region: "National Portal",
              });
            }
          }
        }
      }
    } catch {/**/}

    // 3. Current user
    if (user?.email) {
      const key = user.email.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.role = user.role;
      } else {
        map.set(key, {
          id: user.id || user.email,
          name: user.name || "Current User",
          email: user.email,
          role: user.role,
          bureau: "Active Session",
          region: "HQ (New Delhi)",
        });
      }
    }

    return Array.from(map.values());
  };

  const [users, setUsers] = useState<UserItem[]>(loadInitialUsers);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-role-dropdown]")) {
        setActiveDropdownUser(null);
      }
    };
    if (activeDropdownUser) {
      window.addEventListener("click", handleClickOutside);
    }
    return () => window.removeEventListener("click", handleClickOutside);
  }, [activeDropdownUser]);

  // Load from backend if online
  useEffect(() => {
    if (HAS_BACKEND && user?.role === "admin") {
      api.adminGetUsers().then((backendUsers) => {
        if (Array.isArray(backendUsers) && backendUsers.length > 0) {
          setUsers((prev) => {
            const updated = [...prev];
            backendUsers.forEach((bu) => {
              const idx = updated.findIndex((u) => u.email.toLowerCase() === bu.email.toLowerCase());
              if (idx >= 0) {
                updated[idx].role = bu.role as Role;
                if (bu.name) updated[idx].name = bu.name;
              } else {
                updated.push({
                  id: bu.username || bu.email,
                  name: bu.name || bu.username,
                  email: bu.email,
                  role: bu.role as Role,
                  bureau: "Central Server",
                  region: "HQ (New Delhi)",
                });
              }
            });
            return updated;
          });
        }
      }).catch(() => {});
    }
  }, [user]);

  // Handle role change by Admin
  const handleRoleChange = async (targetEmail: string, newRole: Role) => {
    const targetLower = targetEmail.toLowerCase();

    // 1. Update local state
    setUsers((prev) =>
      prev.map((u) => (u.email.toLowerCase() === targetLower ? { ...u, role: newRole } : u))
    );
    setActiveDropdownUser(null);

    // 2. Persist in admin role overrides
    try {
      const existing = JSON.parse(localStorage.getItem("aicte_admin_user_roles") || "{}");
      existing[targetLower] = newRole;
      localStorage.setItem("aicte_admin_user_roles", JSON.stringify(existing));
    } catch {/**/}

    // 3. Persist in registered accounts
    try {
      const raw = localStorage.getItem("aicte_registered_users");
      if (raw) {
        const accounts = JSON.parse(raw);
        if (accounts[targetLower]) accounts[targetLower].role = newRole;
        const uname = targetLower.split("@")[0];
        if (accounts[uname]) accounts[uname].role = newRole;
        localStorage.setItem("aicte_registered_users", JSON.stringify(accounts));
      }
    } catch {/**/}

    // 4. Update current session if the admin modified themselves
    if (user?.email && user.email.toLowerCase() === targetLower) {
      setRole(newRole);
    }

    // 5. Backend sync
    if (HAS_BACKEND) {
      try {
        await api.adminUpdateUserRole(targetEmail, newRole);
      } catch (err) {
        console.warn("Backend role update failed:", err);
      }
    }

    toast.success(`Role for ${targetEmail} updated to ${formatRole(newRole)}`);
  };

  // Access Control: Only admin can view this page
  if (!user || user.role !== "admin") {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/15 border border-destructive/30 mx-auto grid place-items-center text-destructive shadow-lg shadow-destructive/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Access Restricted</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Only Central Vigilance Super Admins are authorized to view and modify user role designations.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate({ to: "/" })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-sm cursor-pointer shadow-md transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Dashboard
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.bureau.toLowerCase().includes(search.toLowerCase()) ||
      u.region.toLowerCase().includes(search.toLowerCase()) ||
      formatRole(u.role).toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const counts = {
    total: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    hod: users.filter((u) => u.role === "hod").length,
    faculty: users.filter((u) => u.role === "faculty").length,
    ambassador: users.filter((u) => u.role === "ambassador").length,
    student: users.filter((u) => u.role === "student").length,
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-5 px-2 sm:px-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center shadow-[0_0_15px_rgba(220,38,38,0.2)]">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Role Management</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                AICTE Personnel Directory & Central Vigilance Role-Based Access Control
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-secondary/50 border border-border/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Super Admin Authorized
            </span>
          </div>
        </div>

        {/* Metric summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Super Admins", count: counts.admin, emoji: "🔑", color: "border-red-500/30 bg-red-500/10 text-red-400" },
            { label: "Bureau Heads", count: counts.hod, emoji: "🏛️", color: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
            { label: "Approval Officers", count: counts.faculty, emoji: "📋", color: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
            { label: "Nodal Officers", count: counts.ambassador, emoji: "🌐", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
            { label: "Citizens / Complainants", count: counts.student, emoji: "👤", color: "border-purple-500/30 bg-purple-500/10 text-purple-300" },
          ].map((c) => (
            <div key={c.label} className={cn("p-3 rounded-xl border flex flex-col justify-between transition-all", c.color)}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>{c.label}</span>
                <span>{c.emoji}</span>
              </div>
              <div className="text-2xl font-bold mt-1">{c.count}</div>
            </div>
          ))}
        </div>

        {/* Users Panel Card */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Authorized Personnel & Role Assignment</h2>
              <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-mono">
                {filtered.length}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Role filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg bg-background border border-border/40 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Super Admin</option>
                  <option value="hod">Bureau Head</option>
                  <option value="faculty">Approval Officer</option>
                  <option value="ambassador">Regional Nodal Officer</option>
                  <option value="student">Citizen</option>
                </select>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, bureau…"
                  className="h-8 pl-8 pr-3 rounded-lg bg-background border border-border/40 text-xs w-56 input-glow focus:outline-none placeholder-muted-foreground/60"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
                <tr>
                  <th className="text-left px-4 py-3">Officer Name</th>
                  <th className="text-left px-4 py-3">Official Email</th>
                  <th className="text-left px-4 py-3">Assigned Role & Designation</th>
                  <th className="text-left px-4 py-3">Bureau / Cell</th>
                  <th className="text-left px-4 py-3">Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No personnel matching &ldquo;{search}&rdquo;
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const isDropdownOpen = activeDropdownUser === u.email;
                    const roleMeta = ROLE_OPTIONS.find((r) => r.role === u.role) || ROLE_OPTIONS[2];

                    return (
                      <tr key={u.email} className="hover:bg-secondary/20 transition-colors">
                        {/* Name */}
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center text-xs font-bold text-primary shrink-0">
                              {u.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-white/95 text-xs font-bold">{u.name}</div>
                              {user?.email.toLowerCase() === u.email.toLowerCase() && (
                                <span className="text-[10px] text-primary font-semibold">(You)</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                          {u.email}
                        </td>

                        {/* Role Selector Dropdown (Managed by Admin) */}
                        <td className="px-4 py-3 relative" data-role-dropdown>
                          <button
                            type="button"
                            onClick={() => setActiveDropdownUser(isDropdownOpen ? null : u.email)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs",
                              roleMeta.badgeClass,
                              "hover:brightness-110 active:scale-[0.98]"
                            )}
                            title="Click to change role for this user"
                          >
                            <span>{roleMeta.emoji}</span>
                            <span>{roleMeta.label}</span>
                            <ChevronDown className={cn("w-3.5 h-3.5 ml-1 transition-transform opacity-70", isDropdownOpen && "rotate-180")} />
                          </button>

                          {/* Role Selection Dropdown Menu */}
                          {isDropdownOpen && (
                            <div className="absolute left-4 top-[calc(100%+4px)] w-64 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl p-1.5 z-50 animate-scale-in space-y-1">
                              <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/20 mb-1">
                                Change Role for {u.name.split(" ")[0]}
                              </div>
                              {ROLE_OPTIONS.map((opt) => {
                                const isCurrent = u.role === opt.role;
                                return (
                                  <button
                                    key={opt.role}
                                    type="button"
                                    onClick={() => handleRoleChange(u.email, opt.role)}
                                    className={cn(
                                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-left",
                                      isCurrent
                                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                        : "text-foreground/90 hover:bg-secondary/70 hover:text-foreground"
                                    )}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="text-sm shrink-0">{opt.emoji}</span>
                                      <div className="truncate">
                                        <div className="truncate font-semibold">{opt.label}</div>
                                      </div>
                                    </div>
                                    {isCurrent && <Check className="w-3.5 h-3.5 text-primary-foreground shrink-0 ml-1.5" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Bureau */}
                        <td className="px-4 py-3 text-white/80 text-xs">
                          {u.bureau}
                        </td>

                        {/* Region */}
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {u.region}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
