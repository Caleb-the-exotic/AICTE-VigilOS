import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Shield, Users, ShieldAlert, ChevronDown, Check,
  Search, ShieldCheck, ArrowLeft, Filter, Building2,
  Edit3, MapPin, Globe, Image as ImageIcon, X, Save, Plus,
  Trash2, UserPlus, KeyRound, Landmark, ClipboardCheck, User, RefreshCw
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useAuth, formatRole, type Role } from "@/lib/auth";
import { api, HAS_BACKEND } from "@/lib/api";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  type InstitutionProfile,
  getStoredInstitutions,
  saveInstitution,
  createInstitution,
  deleteInstitution,
  fetchInstitutionsAsync,
} from "@/lib/institutions";

export const Route = createFileRoute("/admin")({ component: AdminPanel });

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  role_label?: string;
  bureau_code?: string;
  bureau: string;
  region_code?: string;
  region: string;
  status: string;
  permissions?: string[];
}

const ROLE_OPTIONS: { role: Role; label: string; icon: any; desc: string; badgeClass: string }[] = [
  { role: "super_admin", label: "Super Admin", icon: KeyRound, desc: "Central Vigilance & Platform Authority", badgeClass: "bg-red-500/15 text-red-400 border-red-500/30" },
  { role: "bureau_head", label: "Bureau Head", icon: Landmark, desc: "RB / PGRC / Regional Bureau Chief", badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { role: "approval_officer", label: "Approval Officer", icon: ClipboardCheck, desc: "Grievance Case Handler & Investigator", badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { role: "nodal_officer", label: "Regional Nodal Officer", icon: Globe, desc: "State & Regional Institutional Liaison", badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { role: "citizen", label: "Citizen / Complainant", icon: User, desc: "Public Complainant & Grievance Submitter", badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
];

function AdminPanel() {
  const { user, setRole } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [bureaus, setBureaus] = useState<Array<{ id: string; code: string; name: string }>>([
    { id: "bur_hq", code: "HQ", name: "Central Vigilance HQ" },
    { id: "bur_rb", code: "RB", name: "Regulation Bureau" },
    { id: "bur_pgrc", code: "PGRC", name: "Public Grievance Redressal Cell" },
    { id: "bur_ro", code: "RO", name: "Regional Office Cell" },
    { id: "bur_liaison", code: "LIAISON", name: "State Liaison" },
  ]);

  const [regions, setRegions] = useState<Array<{ id: string; code: string; name: string }>>([
    { id: "reg_hq", code: "HQ", name: "HQ (New Delhi)" },
    { id: "reg_north", code: "NORTHERN", name: "Northern Region" },
    { id: "reg_south", code: "SOUTHERN", name: "Southern Region" },
    { id: "reg_west", code: "WESTERN", name: "Western Region" },
    { id: "reg_east", code: "EASTERN", name: "Eastern Region" },
    { id: "reg_central", code: "CENTRAL", name: "Central Region" },
  ]);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Authoritative Database Sync from PostgreSQL Backend
  const refreshUsers = useCallback(async () => {
    if (HAS_BACKEND && user?.role === "super_admin") {
      try {
        setLoadingUsers(true);
        const [backendUsers, meta] = await Promise.all([
          api.adminGetUsers(),
          api.adminGetMetadata().catch(() => null),
        ]);
        if (Array.isArray(backendUsers)) {
          setUsers(
            backendUsers.map((bu) => ({
              id: bu.id || bu.email,
              name: bu.name || bu.email.split("@")[0],
              email: bu.email,
              role: bu.role as Role,
              role_label: bu.role_label,
              bureau_code: bu.bureau_code || "HQ",
              bureau: bu.bureau || "Central Vigilance HQ",
              region_code: bu.region_code || "HQ",
              region: bu.region || "HQ (New Delhi)",
              status: bu.status || "active",
              permissions: bu.permissions || [],
            }))
          );
        }
        if (meta?.bureaus) setBureaus(meta.bureaus);
        if (meta?.regions) setRegions(meta.regions);
      } catch (err: any) {
        console.error("Failed to load users from backend:", err);
        toast.error("Failed to load personnel records from database.");
      } finally {
        setLoadingUsers(false);
      }
    }
  }, [user]);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // Handle role change backed by SQLite
  const handleRoleChange = async (targetUser: UserItem, newRole: Role) => {
    try {
      if (HAS_BACKEND) {
        await api.adminUpdateAssignment(targetUser.id, {
          role: newRole,
          bureau: targetUser.bureau_code || "HQ",
          region: targetUser.region_code || "HQ",
        });
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      );
      if (user?.id === targetUser.id || user?.email.toLowerCase() === targetUser.email.toLowerCase()) {
        setRole(newRole);
      }
      toast.success(`Role for ${targetUser.name} updated to ${formatRole(newRole)}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update role in database");
    }
  };

  // Handle Bureau change backed by SQLite
  const handleBureauChange = async (targetUser: UserItem, newBureauCode: string) => {
    try {
      const selectedBureau = bureaus.find((b) => b.code === newBureauCode);
      if (HAS_BACKEND) {
        await api.adminUpdateAssignment(targetUser.id, {
          role: targetUser.role,
          bureau: newBureauCode,
          region: targetUser.region_code || "HQ",
        });
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? { ...u, bureau_code: newBureauCode, bureau: selectedBureau?.name || newBureauCode }
            : u
        )
      );
      toast.success(`Bureau assignment for ${targetUser.name} updated to ${selectedBureau?.name || newBureauCode}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update bureau in database");
    }
  };

  // Handle Region change backed by SQLite
  const handleRegionChange = async (targetUser: UserItem, newRegionCode: string) => {
    try {
      const selectedRegion = regions.find((r) => r.code === newRegionCode);
      if (HAS_BACKEND) {
        await api.adminUpdateAssignment(targetUser.id, {
          role: targetUser.role,
          bureau: targetUser.bureau_code || "HQ",
          region: newRegionCode,
        });
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? { ...u, region_code: newRegionCode, region: selectedRegion?.name || newRegionCode }
            : u
        )
      );
      toast.success(`Regional assignment for ${targetUser.name} updated to ${selectedRegion?.name || newRegionCode}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update region in database");
    }
  };

  // Handle active/inactive status toggle
  const handleToggleStatus = async (targetUser: UserItem) => {
    const nextStatus = targetUser.status === "active" ? "inactive" : "active";
    try {
      if (HAS_BACKEND) {
        await api.adminToggleStatus(targetUser.id, nextStatus);
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, status: nextStatus } : u))
      );
      toast.success(`Account for ${targetUser.name} is now ${nextStatus.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle account status");
    }
  };

  // ── Edit User Modal State ───────────────────────────────────────────
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const handleOpenEditUser = (u: UserItem) => {
    setEditingUser(u);
    setEditUserName(u.name || "");
    setEditUserEmail(u.email || "");
    setEditUserPassword("");
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserName.trim()) {
      toast.error("Official Full Name is required.");
      return;
    }
    if (!editUserEmail.trim()) {
      toast.error("Official Email Address is required.");
      return;
    }
    setIsUpdatingUser(true);
    try {
      if (HAS_BACKEND) {
        await api.adminUpdateUserProfile(editingUser.id, {
          name: editUserName.trim(),
          email: editUserEmail.trim().toLowerCase(),
          password: editUserPassword.trim() || undefined,
        });
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, name: editUserName.trim(), email: editUserEmail.trim().toLowerCase() }
            : u
        )
      );
      toast.success(`Personnel information updated for ${editUserName.trim()}`);
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update personnel records");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // ── Tab & Institution State ─────────────────────────────────────────
  const [adminTab, setAdminTab] = useState<"users" | "institutions">("users");
  const [institutions, setInstitutions] = useState<InstitutionProfile[]>(getStoredInstitutions);
  const [instSearch, setInstSearch] = useState("");
  const [instRegionFilter, setInstRegionFilter] = useState("all");
  const [editingInst, setEditingInst] = useState<InstitutionProfile | null>(null);
  const [editingApprovalMode, setEditingApprovalMode] = useState<string>("auto");
  const [imagesText, setImagesText] = useState("");

  // Create Institution state
  const [isCreatingInst, setIsCreatingInst] = useState(false);
  const [newApprovalMode, setNewApprovalMode] = useState<string>("AICTE Approved (EOA 2026-27)");
  const [newInst, setNewInst] = useState<InstitutionProfile>({
    aicte_pid: `1-${Math.floor(100000000 + Math.random() * 900000000)}`,
    institution_name: "",
    region: "Central",
    state: "",
    city: "",
    address: "",
    inst_type: "Private / Self-Financed",
    approval_status: "AICTE Approved (EOA 2026-27)",
    principal_name: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    established_year: 2020,
    total_faculty: 60,
    total_students: 1200,
    images: [
      "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80",
    ],
  });
  const [newImagesText, setNewImagesText] = useState(
    "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80\nhttps://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80"
  );

  // Sync institutions from backend and across tabs/windows
  const refreshInstitutions = useCallback(async () => {
    try {
      const live = await fetchInstitutionsAsync();
      setInstitutions(live);
    } catch {
      setInstitutions(getStoredInstitutions());
    }
  }, []);

  useEffect(() => {
    refreshInstitutions();
    const sync = () => setInstitutions(getStoredInstitutions());
    window.addEventListener("aicte_institution_updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("aicte_institution_updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [refreshInstitutions]);

  useEffect(() => {
    if (adminTab === "institutions") {
      refreshInstitutions();
    }
  }, [adminTab, refreshInstitutions]);

  const startEditing = (inst: InstitutionProfile) => {
    setEditingInst({ ...inst });
    setImagesText((inst.images || []).join("\n"));
    if (inst.approval_status === "AICTE Approved (EOA 2026-27)" || inst.approval_status === "Not Approved") {
      setEditingApprovalMode(inst.approval_status);
    } else {
      setEditingApprovalMode("Other");
    }
  };

  const openCreateModal = () => {
    const generatedPid = `1-${Math.floor(100000000 + Math.random() * 900000000)}`;
    setNewApprovalMode("AICTE Approved (EOA 2026-27)");
    setNewInst({
      aicte_pid: generatedPid,
      institution_name: "",
      region: "Central",
      state: "",
      city: "",
      address: "",
      inst_type: "Private / Self-Financed",
      approval_status: "AICTE Approved (EOA 2026-27)",
      principal_name: "",
      contact_email: "",
      contact_phone: "",
      website: "",
      established_year: 2020,
      total_faculty: 60,
      total_students: 1200,
      images: [
        "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80",
      ],
    });
    setNewImagesText(
      "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80\nhttps://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80"
    );
    setIsCreatingInst(true);
  };

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInst.institution_name.trim()) {
      toast.error("Please enter the institution name");
      return;
    }
    if (!newInst.aicte_pid.trim()) {
      toast.error("Please enter or generate a valid AICTE Permanent ID (PID)");
      return;
    }

    const cleanedImages = newImagesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const created: InstitutionProfile = {
      ...newInst,
      images: cleanedImages.length > 0 ? cleanedImages : [
        "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80"
      ],
    };

    try {
      const saved = await createInstitution(created);
      setInstitutions(getStoredInstitutions());
      toast.success(`New institution "${saved.institution_name}" (PID: ${saved.aicte_pid}) saved and persisted to database!`);
      setIsCreatingInst(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to persist new institution to database.");
    }
  };

  const handleSaveInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;
    const cleanedImages = imagesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const updated: InstitutionProfile = {
      ...editingInst,
      images: cleanedImages.length > 0 ? cleanedImages : editingInst.images,
    };
    try {
      const saved = await saveInstitution(updated);
      setInstitutions(getStoredInstitutions());
      toast.success(`Profile for "${saved.institution_name}" persisted to authoritative database!`);
      setEditingInst(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to persist changes to database. Please check your connection.");
    }
  };

  // Confirmation Modal State
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Delete Institution
  const handleDeleteInstitution = (inst: InstitutionProfile) => {
    setConfirmDeleteModal({
      isOpen: true,
      title: "Delete Institution Profile?",
      description: `Are you sure you want to permanently delete "${inst.institution_name}" (PID: ${inst.aicte_pid})? This will remove the institutional record from the authoritative database.`,
      confirmLabel: "Delete Institution",
      onConfirm: async () => {
        try {
          await deleteInstitution(inst.aicte_pid);
          setInstitutions(getStoredInstitutions());
          if (editingInst?.aicte_pid === inst.aicte_pid) {
            setEditingInst(null);
          }
          toast.success(`Institution "${inst.institution_name}" (PID: ${inst.aicte_pid}) deleted from database.`);
          setConfirmDeleteModal(null);
        } catch (err: any) {
          toast.error(err?.message || "Failed to delete institution from database.");
        }
      },
    });
  };

  // Create User State & Handlers
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "password@123",
    role: "approval_officer" as Role,
    bureau: "RB",
    region: "SOUTHERN",
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailKey = newUser.email.trim().toLowerCase();
    if (!newUser.name.trim()) {
      toast.error("Please enter officer name");
      return;
    }
    if (!emailKey || !emailKey.includes("@")) {
      toast.error("Please enter a valid official email address");
      return;
    }

    try {
      if (HAS_BACKEND) {
        const res = await api.adminCreateUser({
          name: newUser.name.trim(),
          email: emailKey,
          role: newUser.role,
          bureau: newUser.bureau,
          region: newUser.region,
          password: newUser.password || "password@123",
        });
        if (res?.user) {
          setUsers((prev) => [
            {
              id: res.user.id,
              name: res.user.name,
              email: res.user.email,
              role: res.user.role as Role,
              role_label: res.user.role_label,
              bureau_code: res.user.bureau_code || newUser.bureau,
              bureau: res.user.bureau || newUser.bureau,
              region_code: res.user.region_code || newUser.region,
              region: res.user.region || newUser.region,
              status: res.user.status || "active",
              permissions: res.user.permissions || [],
            },
            ...prev,
          ]);
        }
      }
      toast.success(`Account for "${newUser.name.trim()}" (${emailKey}) successfully created in database!`);
      setIsCreatingUser(false);
      setNewUser({
        name: "",
        email: "",
        password: "password@123",
        role: "approval_officer",
        bureau: "RB",
        region: "SOUTHERN",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user in database");
    }
  };

  const handleDeleteUser = (targetUser: UserItem) => {
    const targetEmail = targetUser.email.toLowerCase();
    if (user?.email && user.email.toLowerCase() === targetEmail) {
      toast.error("You cannot delete your own active administrator session account");
      return;
    }
    if (targetEmail === "2204caleb2007@gmail.com") {
      toast.error("Cannot delete master Super Admin account (2204caleb2007@gmail.com)");
      return;
    }

    setConfirmDeleteModal({
      isOpen: true,
      title: "Delete Personnel Account?",
      description: `Are you sure you want to permanently delete the account for "${targetUser.name}" (${targetUser.email}) from the database? They will immediately lose access to the platform.`,
      confirmLabel: "Delete Account",
      onConfirm: async () => {
        try {
          if (HAS_BACKEND) {
            await api.adminDeleteUser(targetUser.id);
          }
          setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
          toast.success(`Account for "${targetUser.name}" (${targetUser.email}) deleted from database.`);
          await refreshUsers();
        } catch (err: any) {
          toast.error(err?.message || "Failed to delete account");
        } finally {
          setConfirmDeleteModal(null);
        }
      },
    });
  };

  // Access Control: Only super_admin can view this page
  if (!user || user.role !== "super_admin") {
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
    const q = (search || "").toLowerCase();
    const matchesSearch =
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.bureau || "").toLowerCase().includes(q) ||
      (u.region || "").toLowerCase().includes(q) ||
      (formatRole(u.role) || "").toLowerCase().includes(q);

    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredInstitutions = institutions.filter((inst) => {
    const q = instSearch.toLowerCase();
    const matchesSearch =
      inst.institution_name.toLowerCase().includes(q) ||
      inst.aicte_pid.toLowerCase().includes(q) ||
      inst.city.toLowerCase().includes(q) ||
      inst.state.toLowerCase().includes(q) ||
      inst.principal_name.toLowerCase().includes(q) ||
      inst.region.toLowerCase().includes(q);

    const matchesRegion = instRegionFilter === "all" || inst.region.toLowerCase() === instRegionFilter.toLowerCase();
    return matchesSearch && matchesRegion;
  });

  const counts = {
    total: users.length,
    super_admin: users.filter((u) => u.role === "super_admin").length,
    bureau_head: users.filter((u) => u.role === "bureau_head").length,
    approval_officer: users.filter((u) => u.role === "approval_officer").length,
    nodal_officer: users.filter((u) => u.role === "nodal_officer").length,
    citizen: users.filter((u) => u.role === "citizen").length,
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
              <h1 className="text-xl font-bold">Admin Management Portal</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                AICTE Personnel Directory & Institution 360° Profile Administration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-secondary/50 border border-border/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Super Admin Authorized
            </span>
          </div>
        </div>

        {/* Tab Switcher: Users vs Institution Profiles */}
        <div className="flex items-center gap-2 border-b border-border/30 pb-3">
          <button
            type="button"
            id="admin-tab-users"
            onClick={() => setAdminTab("users")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              adminTab === "users"
                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                : "bg-secondary/40 border-border/30 text-muted-foreground hover:text-white hover:bg-secondary/70"
            )}
          >
            <Users className="w-4 h-4" />
            <span>Authorized Personnel & Roles</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
              adminTab === "users" ? "bg-black/30 text-white" : "bg-secondary text-muted-foreground"
            )}>
              {users.length}
            </span>
          </button>

          <button
            type="button"
            id="admin-tab-institutions"
            onClick={() => setAdminTab("institutions")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              adminTab === "institutions"
                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                : "bg-secondary/40 border-border/30 text-muted-foreground hover:text-white hover:bg-secondary/70"
            )}
          >
            <Building2 className="w-4 h-4" />
            <span>Institution Profiles</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
              adminTab === "institutions" ? "bg-black/30 text-white" : "bg-secondary text-muted-foreground"
            )}>
              {institutions.length}
            </span>
          </button>
        </div>

        {/* ── VIEW: USERS MANAGEMENT ─────────────────────────────────── */}
        {adminTab === "users" && (
          <div className="space-y-5">
            {/* Metric summary chips */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Super Admins", count: counts.super_admin, icon: KeyRound, color: "border-red-500/30 bg-red-500/10 text-red-400" },
                { label: "Bureau Heads", count: counts.bureau_head, icon: Landmark, color: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
                { label: "Approval Officers", count: counts.approval_officer, icon: ClipboardCheck, color: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
                { label: "Nodal Officers", count: counts.nodal_officer, icon: Globe, color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
                { label: "Citizens / Complainants", count: counts.citizen, icon: User, color: "border-purple-500/30 bg-purple-500/10 text-purple-300" },
              ].map((c) => (
                <div key={c.label} className={cn("p-3 rounded-xl border flex flex-col justify-between transition-all", c.color)}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{c.label}</span>
                    <c.icon className="w-4 h-4 opacity-80" />
                  </div>
                  <div className="text-2xl font-bold mt-1">{c.count}</div>
                </div>
              ))}
            </div>

            {/* Users Panel Card */}
            <div id="authorized-personnel-container" className="glass-card overflow-hidden -mx-[1px] w-[calc(100%+6px)]">
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
                      <option value="super_admin">Super Admin</option>
                      <option value="bureau_head">Bureau Head</option>
                      <option value="approval_officer">Approval Officer</option>
                      <option value="nodal_officer">Regional Nodal Officer</option>
                      <option value="citizen">Citizen</option>
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

                  {/* Create Account Button */}
                  <button
                    type="button"
                    id="create-account-btn"
                    onClick={() => setIsCreatingUser(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer transition-all active:scale-[0.98] shadow-sm shadow-primary/20 shrink-0"
                    title="Register new personnel account"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create Account</span>
                  </button>
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
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground text-sm">
                          <div className="flex flex-col items-center justify-center gap-2.5">
                            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                            <span className="font-semibold text-xs text-foreground/90">Synchronizing personnel directory with database...</span>
                            <span className="text-[11px] text-muted-foreground">Verifying access controls, official jurisdictions, and active accounts</span>
                          </div>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                          No personnel matching &ldquo;{search}&rdquo;
                        </td>
                      </tr>
                    ) : (
                      filtered.map((u) => {
                        const roleMeta = ROLE_OPTIONS.find((r) => r.role === u.role) || ROLE_OPTIONS[2];
                        const isSelf = Boolean(user?.email && u.email && user.email.toLowerCase() === u.email.toLowerCase());
                        const isMasterAdmin = Boolean(u.email && u.email.toLowerCase() === "2204caleb2007@gmail.com");

                        return (
                          <tr key={u.id || u.email} className="hover:bg-secondary/20 transition-colors">
                            {/* Name */}
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center text-xs font-bold text-primary shrink-0">
                                  {(u.name || "U").slice(0, 1).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-white/95 text-xs font-bold">{u.name}</div>
                                  {isSelf && (
                                    <span className="text-[10px] text-primary font-semibold">(You)</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                              {u.email}
                            </td>

                            {/* Role Selector Dropdown */}
                            <td className="px-4 py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs outline-none select-none",
                                      roleMeta.badgeClass,
                                      "hover:brightness-110 active:scale-[0.98] focus-visible:ring-1 focus-visible:ring-primary"
                                    )}
                                    title="Click to change role for this user"
                                  >
                                    <roleMeta.icon className="w-3.5 h-3.5" />
                                    <span>{roleMeta.label}</span>
                                    <ChevronDown className="w-3.5 h-3.5 ml-1 transition-transform opacity-70" />
                                  </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                  align="start"
                                  side="bottom"
                                  sideOffset={6}
                                  avoidCollisions={true}
                                  collisionPadding={16}
                                  className="w-64 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl p-1.5 z-[9999] space-y-1"
                                >
                                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/20 mb-1">
                                    Change Role for {(u.name || "User").split(" ")[0]}
                                  </div>
                                  {ROLE_OPTIONS.map((opt) => {
                                    const isCurrent = u.role === opt.role;
                                    return (
                                      <DropdownMenuItem
                                        key={opt.role}
                                        onClick={() => handleRoleChange(u, opt.role)}
                                        className={cn(
                                          "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-left outline-none",
                                          isCurrent
                                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                            : "text-foreground/90 hover:bg-secondary/70 hover:text-foreground focus:bg-secondary/70 focus:text-foreground"
                                        )}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <opt.icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                                          <div className="truncate">
                                            <div className="truncate font-semibold">{opt.label}</div>
                                          </div>
                                        </div>
                                        {isCurrent && <Check className="w-3.5 h-3.5 text-primary-foreground shrink-0 ml-1.5" />}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>

                            {/* Bureau Selector Dropdown */}
                            <td className="px-4 py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 bg-secondary/40 hover:bg-secondary/70 hover:border-border/60 text-foreground/90 text-xs font-semibold transition-all cursor-pointer shadow-xs outline-none select-none active:scale-[0.98] focus-visible:ring-1 focus-visible:ring-primary"
                                    title="Click to change Bureau / Department"
                                  >
                                    <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-mono font-bold">{u.bureau_code || "HQ"}</span>
                                    <span className="text-[11px] text-muted-foreground max-w-[100px] truncate hidden xl:inline">
                                      · {(bureaus.find((b) => b.code === u.bureau_code)?.name || u.bureau || "HQ").split(" ")[0]}
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-muted-foreground/70 shrink-0" />
                                  </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                  align="start"
                                  side="bottom"
                                  sideOffset={6}
                                  avoidCollisions={true}
                                  collisionPadding={16}
                                  className="w-72 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl p-1.5 z-[9999] space-y-1"
                                >
                                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/20 mb-1 flex items-center justify-between">
                                    <span>Select Bureau / Cell</span>
                                    <span className="font-normal opacity-60 truncate max-w-[100px]">{(u.name || "User").split(" ")[0]}</span>
                                  </div>
                                  {(bureaus.length > 0 ? bureaus : [
                                    { id: "bur_hq", code: "HQ", name: "Central Vigilance HQ" },
                                    { id: "bur_rb", code: "RB", name: "Regulation Bureau" },
                                    { id: "bur_pgrc", code: "PGRC", name: "Public Grievance Redressal Cell" },
                                    { id: "bur_ro", code: "RO", name: "Regional Office Cell" },
                                    { id: "bur_liaison", code: "LIAISON", name: "State Liaison" },
                                  ]).map((b) => {
                                    const isCurrent = (u.bureau_code || "HQ").toUpperCase() === b.code.toUpperCase();
                                    return (
                                      <DropdownMenuItem
                                        key={b.code}
                                        onClick={() => handleBureauChange(u, b.code)}
                                        className={cn(
                                          "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-left outline-none",
                                          isCurrent
                                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                            : "text-foreground/90 hover:bg-secondary/70 hover:text-foreground focus:bg-secondary/70 focus:text-foreground"
                                        )}
                                      >
                                        <div className="flex items-center gap-2.5 truncate">
                                          <span
                                            className={cn(
                                              "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border shrink-0",
                                              isCurrent
                                                ? "bg-white/20 text-white border-white/30"
                                                : "bg-secondary/60 text-muted-foreground border-border/30"
                                            )}
                                          >
                                            {b.code}
                                          </span>
                                          <div className="truncate font-semibold">{b.name}</div>
                                        </div>
                                        {isCurrent && <Check className="w-3.5 h-3.5 text-primary-foreground shrink-0 ml-1.5" />}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>

                            {/* Region Selector Dropdown */}
                            <td className="px-4 py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 bg-secondary/40 hover:bg-secondary/70 hover:border-border/60 text-foreground/90 text-xs font-semibold transition-all cursor-pointer shadow-xs outline-none select-none active:scale-[0.98] focus-visible:ring-1 focus-visible:ring-primary"
                                    title="Click to change Regional Jurisdiction"
                                  >
                                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-semibold truncate max-w-[120px]">
                                      {regions.find((r) => r.code === u.region_code)?.name?.replace(" Region", "") || u.region || u.region_code || "HQ"}
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-muted-foreground/70 shrink-0" />
                                  </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                  align="start"
                                  side="bottom"
                                  sideOffset={6}
                                  avoidCollisions={true}
                                  collisionPadding={16}
                                  className="w-64 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl p-1.5 z-[9999] space-y-1"
                                >
                                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/20 mb-1 flex items-center justify-between">
                                    <span>Regional Jurisdiction</span>
                                    <span className="font-normal opacity-60 truncate max-w-[100px]">{(u.name || "User").split(" ")[0]}</span>
                                  </div>
                                  {(regions.length > 0 ? regions : [
                                    { id: "reg_hq", code: "HQ", name: "HQ (New Delhi)" },
                                    { id: "reg_north", code: "NORTHERN", name: "Northern Region" },
                                    { id: "reg_south", code: "SOUTHERN", name: "Southern Region" },
                                    { id: "reg_west", code: "WESTERN", name: "Western Region" },
                                    { id: "reg_east", code: "EASTERN", name: "Eastern Region" },
                                    { id: "reg_central", code: "CENTRAL", name: "Central Region" },
                                  ]).map((r) => {
                                    const isCurrent = (u.region_code || "HQ").toUpperCase() === r.code.toUpperCase();
                                    return (
                                      <DropdownMenuItem
                                        key={r.code}
                                        onClick={() => handleRegionChange(u, r.code)}
                                        className={cn(
                                          "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-left outline-none",
                                          isCurrent
                                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                            : "text-foreground/90 hover:bg-secondary/70 hover:text-foreground focus:bg-secondary/70 focus:text-foreground"
                                        )}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <MapPin className={cn("w-3.5 h-3.5 shrink-0", isCurrent ? "text-primary-foreground" : "text-muted-foreground")} />
                                          <div className="truncate font-semibold">{r.name}</div>
                                        </div>
                                        {isCurrent && <Check className="w-3.5 h-3.5 text-primary-foreground shrink-0 ml-1.5" />}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>

                            {/* Status Toggle Badge */}
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(u)}
                                disabled={isSelf || isMasterAdmin}
                                className={cn(
                                  "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer inline-flex items-center gap-1.5",
                                  u.status === "active"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20",
                                  (isSelf || isMasterAdmin) && "cursor-not-allowed opacity-60"
                                )}
                                title={
                                  isSelf
                                    ? "Cannot deactivate your own active session"
                                    : isMasterAdmin
                                      ? "Cannot deactivate Master Super Admin"
                                      : `Click to ${u.status === "active" ? "deactivate" : "activate"} account`
                                }
                              >
                                <span
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    u.status === "active" ? "bg-emerald-400" : "bg-rose-400"
                                  )}
                                />
                                <span className="capitalize">{u.status || "active"}</span>
                              </button>
                            </td>

                            {/* Actions: Edit & Delete Account */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/25 text-primary cursor-pointer active:scale-90 transition-all inline-flex items-center justify-center"
                                  title={`Edit information for ${u.name}`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={isSelf || isMasterAdmin}
                                  className={cn(
                                    "p-1.5 rounded-lg border transition-all inline-flex items-center justify-center",
                                    isSelf || isMasterAdmin
                                      ? "opacity-25 cursor-not-allowed border-border/20 text-muted-foreground"
                                      : "border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive cursor-pointer active:scale-90"
                                  )}
                                  title={
                                    isSelf
                                      ? "Cannot delete active session account"
                                      : isMasterAdmin
                                        ? "Master Super Admin account protected"
                                        : `Delete account for ${u.name}`
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
        )}

        {/* ── VIEW: INSTITUTION PROFILES DIRECTORY ────────────────────── */}
        {adminTab === "institutions" && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">AICTE Approved Institutions Directory</h2>
                <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-mono">
                  {filteredInstitutions.length}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Region filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={instRegionFilter}
                    onChange={(e) => setInstRegionFilter(e.target.value)}
                    className="h-8 px-2.5 rounded-lg bg-background border border-border/40 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="all">All Regions</option>
                    <option value="Northern">Northern</option>
                    <option value="Southern">Southern</option>
                    <option value="Western">Western</option>
                    <option value="Eastern">Eastern</option>
                    <option value="Central">Central</option>
                    <option value="North-West">North-West</option>
                    <option value="South-West">South-West</option>
                  </select>
                </div>

                {/* Search bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={instSearch}
                    onChange={(e) => setInstSearch(e.target.value)}
                    placeholder="Search name, PID, city, principal…"
                    className="h-8 pl-8 pr-3 rounded-lg bg-background border border-border/40 text-xs w-64 input-glow focus:outline-none placeholder-muted-foreground/60"
                  />
                </div>

                {/* Create Institution Button */}
                <button
                  type="button"
                  id="create-institution-btn"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer transition-all active:scale-[0.98] shadow-sm shadow-primary/20 shrink-0"
                  title="Create a new institution profile"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Institution</span>
                </button>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredInstitutions.length === 0 ? (
                <div className="col-span-2 py-12 text-center text-muted-foreground text-sm">
                  No institutions found matching your search.
                </div>
              ) : (
                filteredInstitutions.map((inst) => (
                  <div key={inst.aicte_pid} className="glass-card overflow-hidden border border-border/40 hover:border-primary/40 transition-all flex flex-col justify-between group">
                    {/* Photo Header */}
                    <div className="relative h-44 w-full overflow-hidden bg-secondary">
                      <img
                        src={inst.images[0] || "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&q=80"}
                        alt={inst.institution_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

                      {/* Top overlay badges */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] bg-black/75 backdrop-blur-md border border-white/20 text-white px-2 py-0.5 rounded-md font-semibold">
                          PID: {inst.aicte_pid}
                        </span>
                        <span className="text-[10px] font-semibold bg-red-600/90 text-white px-2 py-0.5 rounded-md backdrop-blur-md">
                          {inst.region} Region
                        </span>
                      </div>

                      {/* Bottom overlay info */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5">
                        <div className="text-[10px] text-primary-foreground font-semibold bg-primary/80 inline-block px-1.5 py-0.5 rounded text-xs mb-1">
                          {inst.inst_type}
                        </div>
                        <h3 className="font-bold text-white text-base leading-tight drop-shadow-md">
                          {inst.institution_name}
                        </h3>
                      </div>
                    </div>

                    {/* Body Content */}
                    <div className="p-4 space-y-3 flex-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{inst.city}, {inst.state}</span>
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary/80 border border-border/30 text-white font-medium shrink-0">
                          {inst.approval_status}
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground/80 line-clamp-1">
                        {inst.address}
                      </div>

                      {/* Campus Gallery Thumbnails */}
                      {inst.images && inst.images.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1">
                          {inst.images.slice(0, 3).map((img, i) => (
                            <div key={i} className="w-14 h-9 rounded-md overflow-hidden border border-border/40 shrink-0 bg-secondary">
                              <img src={img} alt="Campus" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {inst.images.length > 3 && (
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              +{inst.images.length - 3} photos
                            </span>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/20">
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">Principal</div>
                          <div className="text-white font-medium truncate">{inst.principal_name}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">Contact Email</div>
                          <div className="text-white font-medium truncate">{inst.contact_email}</div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Action */}
                    <div className="px-4 py-3 bg-secondary/20 border-t border-border/30 flex items-center justify-between gap-2">
                      <a
                        href={inst.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5" /> Visit Website
                      </a>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteInstitution(inst)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]"
                          title="Delete institution profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditing(inst)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer transition-all active:scale-[0.98] shadow-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Institution Profile Modal ────────────────────────────── */}
      {editingInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingInst(null)} />
          <div className="relative w-full max-w-2xl bg-card border border-border/50 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-md font-bold">
                    PID: {editingInst.aicte_pid}
                  </span>
                  <span className="text-xs text-muted-foreground">Admin Profile Editor</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">Edit Institution Profile</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingInst(null)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInstitution} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Institution Name */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-white/90">Institution Name</label>
                  <input
                    type="text"
                    required
                    value={editingInst.institution_name}
                    onChange={(e) => setEditingInst({ ...editingInst, institution_name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Region */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">AICTE Region</label>
                  <select
                    value={editingInst.region}
                    onChange={(e) => setEditingInst({ ...editingInst, region: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Northern">Northern</option>
                    <option value="Southern">Southern</option>
                    <option value="Western">Western</option>
                    <option value="Eastern">Eastern</option>
                    <option value="Central">Central</option>
                    <option value="North-West">North-West</option>
                    <option value="South-West">South-West</option>
                  </select>
                </div>

                {/* Institution Type */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Institution Type</label>
                  <input
                    type="text"
                    value={editingInst.inst_type}
                    onChange={(e) => setEditingInst({ ...editingInst, inst_type: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* City */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">City</label>
                  <input
                    type="text"
                    value={editingInst.city}
                    onChange={(e) => setEditingInst({ ...editingInst, city: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* State */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">State</label>
                  <input
                    type="text"
                    value={editingInst.state}
                    onChange={(e) => setEditingInst({ ...editingInst, state: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Full Address */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-white/90">Full Address</label>
                  <input
                    type="text"
                    value={editingInst.address}
                    onChange={(e) => setEditingInst({ ...editingInst, address: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Approval Status */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-white/90">Approval Status</label>
                  <div className="space-y-2">
                    <select
                      value={
                        editingApprovalMode === "Other"
                          ? "Other"
                          : editingInst.approval_status === "AICTE Approved (EOA 2026-27)"
                            ? "AICTE Approved (EOA 2026-27)"
                            : editingInst.approval_status === "Not Approved"
                              ? "Not Approved"
                              : "Other"
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingApprovalMode(val);
                        if (val === "Other") {
                          if (
                            editingInst.approval_status === "AICTE Approved (EOA 2026-27)" ||
                            editingInst.approval_status === "Not Approved"
                          ) {
                            setEditingInst({ ...editingInst, approval_status: "" });
                          }
                        } else {
                          setEditingInst({ ...editingInst, approval_status: val });
                        }
                      }}
                      className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="AICTE Approved (EOA 2026-27)">AICTE Approved (EOA 2026-27)</option>
                      <option value="Not Approved">Not Approved</option>
                      <option value="Other">Other</option>
                    </select>

                    {/* When 'Other' is chosen, allow typing custom statement */}
                    {(editingApprovalMode === "Other" ||
                      (editingInst.approval_status !== "AICTE Approved (EOA 2026-27)" &&
                        editingInst.approval_status !== "Not Approved")) && (
                        <div className="space-y-1 animate-in fade-in duration-150">
                          <input
                            type="text"
                            required
                            value={editingInst.approval_status}
                            onChange={(e) => setEditingInst({ ...editingInst, approval_status: e.target.value })}
                            placeholder="Type custom approval status statement..."
                            className="w-full h-9 px-3 rounded-lg bg-background border border-primary/50 text-foreground focus:outline-none focus:border-primary text-xs"
                            autoFocus
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Specify official status statement (e.g. Conditional Extension, Notice Issued, Under Review)
                          </p>
                        </div>
                      )}
                  </div>
                </div>

                {/* Principal / Director */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Principal / Director Name</label>
                  <input
                    type="text"
                    value={editingInst.principal_name}
                    onChange={(e) => setEditingInst({ ...editingInst, principal_name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Contact Email */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Official Contact Email</label>
                  <input
                    type="email"
                    value={editingInst.contact_email}
                    onChange={(e) => setEditingInst({ ...editingInst, contact_email: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Contact Phone */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Contact Phone</label>
                  <input
                    type="text"
                    value={editingInst.contact_phone}
                    onChange={(e) => setEditingInst({ ...editingInst, contact_phone: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Website */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-white/90">Official Website URL</label>
                  <input
                    type="url"
                    value={editingInst.website}
                    onChange={(e) => setEditingInst({ ...editingInst, website: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Campus Image URLs */}
                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-white/90 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-primary" /> Campus Photos (Google / Web image URLs, one per line)
                    </label>
                    <span className="text-[10px] text-muted-foreground">Live preview below</span>
                  </div>
                  <textarea
                    rows={3}
                    value={imagesText}
                    onChange={(e) => setImagesText(e.target.value)}
                    placeholder="https://images.unsplash.com/... or google image URL"
                    className="w-full p-2.5 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                  />
                  {/* Photo Preview Strip */}
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {imagesText.split("\n").filter((s) => s.trim().startsWith("http")).map((url, i) => (
                      <div key={i} className="w-16 h-12 rounded-lg border border-border/40 overflow-hidden shrink-0 bg-secondary relative">
                        <img src={url.trim()} alt="preview" className="w-full h-full object-cover" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border/30 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDeleteInstitution(editingInst)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Institution
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingInst(null)}
                    className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-primary/20"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create New Institution Profile Modal ──────────────────────── */}
      {isCreatingInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCreatingInst(false)} />
          <div className="relative w-full max-w-2xl bg-card border border-border/50 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-md font-bold">
                    NEW RECORD
                  </span>
                  <span className="text-xs text-muted-foreground">AICTE 360° Profile Registration</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">Create New Institution Profile</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingInst(false)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInstitution} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* AICTE PID */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-white/90">AICTE Permanent ID (PID) *</label>
                    <button
                      type="button"
                      onClick={() => setNewInst({ ...newInst, aicte_pid: `1-${Math.floor(100000000 + Math.random() * 900000000)}` })}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      Generate New
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={newInst.aicte_pid}
                    onChange={(e) => setNewInst({ ...newInst, aicte_pid: e.target.value })}
                    placeholder="1-XXXXXXXXX"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Institution Name */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Institution Name *</label>
                  <input
                    type="text"
                    required
                    value={newInst.institution_name}
                    onChange={(e) => setNewInst({ ...newInst, institution_name: e.target.value })}
                    placeholder="e.g. Indian Institute of Information Technology"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Region */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">AICTE Region *</label>
                  <select
                    value={newInst.region}
                    onChange={(e) => setNewInst({ ...newInst, region: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Northern">Northern</option>
                    <option value="Southern">Southern</option>
                    <option value="Western">Western</option>
                    <option value="Eastern">Eastern</option>
                    <option value="Central">Central</option>
                    <option value="North-West">North-West</option>
                    <option value="South-West">South-West</option>
                  </select>
                </div>

                {/* Institution Type */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Institution Type</label>
                  <input
                    type="text"
                    value={newInst.inst_type}
                    onChange={(e) => setNewInst({ ...newInst, inst_type: e.target.value })}
                    placeholder="e.g. Autonomous / Private / Government"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* City */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">City</label>
                  <input
                    type="text"
                    value={newInst.city}
                    onChange={(e) => setNewInst({ ...newInst, city: e.target.value })}
                    placeholder="e.g. Pune"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* State */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">State</label>
                  <input
                    type="text"
                    value={newInst.state}
                    onChange={(e) => setNewInst({ ...newInst, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Full Address */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-white/90">Full Address</label>
                  <input
                    type="text"
                    value={newInst.address}
                    onChange={(e) => setNewInst({ ...newInst, address: e.target.value })}
                    placeholder="Campus road, district, pincode"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Approval Status */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-white/90">Approval Status</label>
                  <div className="space-y-2">
                    <select
                      value={
                        newApprovalMode === "Other"
                          ? "Other"
                          : newInst.approval_status === "AICTE Approved (EOA 2026-27)"
                            ? "AICTE Approved (EOA 2026-27)"
                            : newInst.approval_status === "Not Approved"
                              ? "Not Approved"
                              : "Other"
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewApprovalMode(val);
                        if (val === "Other") {
                          if (
                            newInst.approval_status === "AICTE Approved (EOA 2026-27)" ||
                            newInst.approval_status === "Not Approved"
                          ) {
                            setNewInst({ ...newInst, approval_status: "" });
                          }
                        } else {
                          setNewInst({ ...newInst, approval_status: val });
                        }
                      }}
                      className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="AICTE Approved (EOA 2026-27)">AICTE Approved (EOA 2026-27)</option>
                      <option value="Not Approved">Not Approved</option>
                      <option value="Other">Other</option>
                    </select>

                    {/* When 'Other' is chosen, allow typing custom statement */}
                    {(newApprovalMode === "Other" ||
                      (newInst.approval_status !== "AICTE Approved (EOA 2026-27)" &&
                        newInst.approval_status !== "Not Approved")) && (
                        <div className="space-y-1 animate-in fade-in duration-150">
                          <input
                            type="text"
                            required
                            value={newInst.approval_status}
                            onChange={(e) => setNewInst({ ...newInst, approval_status: e.target.value })}
                            placeholder="Type custom approval status statement..."
                            className="w-full h-9 px-3 rounded-lg bg-background border border-primary/50 text-foreground focus:outline-none focus:border-primary text-xs"
                            autoFocus
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Specify official status statement (e.g. Conditional Extension, Notice Issued, Under Review)
                          </p>
                        </div>
                      )}
                  </div>
                </div>

                {/* Principal / Director */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Principal / Director Name</label>
                  <input
                    type="text"
                    value={newInst.principal_name}
                    onChange={(e) => setNewInst({ ...newInst, principal_name: e.target.value })}
                    placeholder="Dr. / Prof. Name"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Contact Email */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Official Contact Email</label>
                  <input
                    type="email"
                    value={newInst.contact_email}
                    onChange={(e) => setNewInst({ ...newInst, contact_email: e.target.value })}
                    placeholder="director@institute.ac.in"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Contact Phone */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Contact Phone</label>
                  <input
                    type="text"
                    value={newInst.contact_phone}
                    onChange={(e) => setNewInst({ ...newInst, contact_phone: e.target.value })}
                    placeholder="+91 XX XXXXXXXX"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Website */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-white/90">Official Website URL</label>
                  <input
                    type="url"
                    value={newInst.website}
                    onChange={(e) => setNewInst({ ...newInst, website: e.target.value })}
                    placeholder="https://www.example.edu.in"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Campus Image URLs */}
                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-white/90 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-primary" /> Campus Photos (Google / Web image URLs, one per line)
                    </label>
                    <span className="text-[10px] text-muted-foreground">Live preview below</span>
                  </div>
                  <textarea
                    rows={3}
                    value={newImagesText}
                    onChange={(e) => setNewImagesText(e.target.value)}
                    placeholder="https://images.unsplash.com/... or google image URL"
                    className="w-full p-2.5 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                  />
                  {/* Photo Preview Strip */}
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {newImagesText.split("\n").filter((s) => s.trim().startsWith("http")).map((url, i) => (
                      <div key={i} className="w-16 h-12 rounded-lg border border-border/40 overflow-hidden shrink-0 bg-secondary relative">
                        <img src={url.trim()} alt="preview" className="w-full h-full object-cover" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border/30 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreatingInst(false)}
                  className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-primary/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create New Account Modal ─────────────────────────────────── */}
      {isCreatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCreatingUser(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-md font-bold">
                    NEW USER
                  </span>
                  <span className="text-xs text-muted-foreground">AICTE Personnel Registration</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">Create Personnel Account</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingUser(false)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="space-y-3">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Official Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="e.g. Dr. Rajesh Kumar"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="officer@aicte.gov.in"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Initial Password *</label>
                  <input
                    type="text"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="password@123"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-muted-foreground">Default password for new accounts is password@123</p>
                </div>

                {/* Role Designation */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Role Designation *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="approval_officer">Approval Officer</option>
                    <option value="bureau_head">Bureau Head</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="nodal_officer">Regional Nodal Officer</option>
                    <option value="citizen">Citizen / Complainant</option>
                  </select>
                </div>

                {/* Bureau / Cell */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Bureau / Department Cell *</label>
                  <select
                    value={newUser.bureau}
                    onChange={(e) => setNewUser({ ...newUser, bureau: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {bureaus.length > 0 ? (
                      bureaus.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.code} — {b.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="HQ">HQ — Headquarters / Vigilance</option>
                        <option value="RB">RB — Approval Bureau / Regulations</option>
                        <option value="PGRC">PGRC — Public Grievance Redressal Cell</option>
                        <option value="RO">RO — Regional Coordination Office</option>
                        <option value="LIAISON">LIAISON — Legal & Institutional Liaison</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Region */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Jurisdiction Region *</label>
                  <select
                    value={newUser.region}
                    onChange={(e) => setNewUser({ ...newUser, region: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {regions.length > 0 ? (
                      regions.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name} ({r.code})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="HQ">HQ (New Delhi)</option>
                        <option value="NORTHERN">Northern</option>
                        <option value="SOUTHERN">Southern</option>
                        <option value="WESTERN">Western</option>
                        <option value="EASTERN">Eastern</option>
                        <option value="CENTRAL">Central</option>
                        <option value="NORTH_WEST">North-West</option>
                        <option value="SOUTH_WEST">South-West</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border/30 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreatingUser(false)}
                  className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-primary/20"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ─────────────────────────────────────────── */}
      {confirmDeleteModal && confirmDeleteModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setConfirmDeleteModal(null)} />
          <div className="relative w-full max-w-md bg-card border border-destructive/40 rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 border border-destructive/30 grid place-items-center text-destructive shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">{confirmDeleteModal.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {confirmDeleteModal.description}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border/30 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal(null)}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-action-btn"
                onClick={confirmDeleteModal.onConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-destructive/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmDeleteModal.confirmLabel || "Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ────────────────────────────────────────── */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditingUser(null)} />
          <div className="relative w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 z-10">
            <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-md font-bold">
                    EDIT USER
                  </span>
                  <span className="text-xs text-muted-foreground">AICTE Personnel Directory</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">Edit Personnel Information</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4 text-xs">
              <div className="space-y-3">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Official Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Kumar"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    placeholder="e.g: officer@aicte.gov.in"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Current / New Password */}
                <div className="space-y-1">
                  <label className="font-semibold text-white/90">current password*</label>
                  <input
                    type="text"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    placeholder="Leave blank to preserve current password, or enter new password"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/40 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-muted-foreground">Enter a new password to reset this officer's portal credentials, or leave blank to keep existing password.</p>
                </div>
              </div>

              <div className="pt-3 border-t border-border/30 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-primary/20 disabled:opacity-50"
                >
                  {isUpdatingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
