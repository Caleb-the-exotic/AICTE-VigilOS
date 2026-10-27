import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  X,
  Building2,
  ShieldCheck,
  UserCheck,
  Mail,
  MapPin,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  Users,
  RefreshCw,
  Info,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import { api, type DirectoryContact, type DirectoryGroup, type DirectoryResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface SelectedRecipientItem {
  email: string;
  name: string;
  role_label?: string;
  institution?: string;
  is_registered?: boolean;
}

interface RecipientDirectoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecipients: SelectedRecipientItem[];
  onToggleRecipient: (recipient: SelectedRecipientItem) => void;
  currentUserEmail?: string;
  isComposeOpen?: boolean;
  onOpenCompose?: () => void;
}

type CategoryTab = "all" | "my_institution" | "other_institutions" | "bureaus" | "regions";

const CATEGORY_TABS: Array<{ id: CategoryTab; label: string }> = [
  { id: "all", label: "All Directory" },
  { id: "my_institution", label: "My Bureau/Unit" },
  { id: "other_institutions", label: "Colleges & Insts" },
  { id: "bureaus", label: "AICTE Bureaus" },
  { id: "regions", label: "Regional Offices" },
];

export default function RecipientDirectoryPanel({
  isOpen,
  onClose,
  selectedRecipients,
  onToggleRecipient,
  currentUserEmail,
  isComposeOpen = false,
  onOpenCompose,
}: RecipientDirectoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryTab>("all");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("flat");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directoryData, setDirectoryData] = useState<DirectoryResponse | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected emails set for O(1) lookup
  const selectedEmailSet = useMemo(() => {
    return new Set(selectedRecipients.map((r) => r.email.toLowerCase()));
  }, [selectedRecipients]);

  // Load directory from backend
  const loadDirectory = async (query = searchQuery, category = activeCategory) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCommsDirectory(query, category);
      setDirectoryData(data);
      // Auto-expand all groups on first load or when search is active
      if (data?.grouped_by_institution) {
        const initialExpanded: Record<string, boolean> = {};
        data.grouped_by_institution.forEach((grp, idx) => {
          // Expand first 5 groups or all if search query is present
          initialExpanded[grp.institution] = Boolean(query) || idx < 5;
        });
        setExpandedGroups((prev) => ({ ...initialExpanded, ...prev }));
      }
    } catch (err: any) {
      console.error("Failed to load recipient directory:", err);
      setError(err?.message || "Failed to load directory. Please verify backend connectivity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setViewMode("flat");
      loadDirectory(searchQuery, activeCategory);
      // Auto-focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [isOpen, activeCategory]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadDirectory(searchQuery, activeCategory);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleGroupExpand = (instName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [instName]: !prev[instName],
    }));
  };

  const allContactsFlat = useMemo(() => {
    if (!directoryData) return [];
    return [...directoryData.registered_users, ...directoryData.institutional_contacts];
  }, [directoryData]);

  if (!isOpen) return null;

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Internal VigilOS Recipient Directory"
      className={cn(
        "pointer-events-auto w-[95vw] sm:w-[460px] md:w-[480px] max-w-full h-[560px] max-h-[calc(100vh-140px)] sm:max-h-[85vh] bg-card border border-border/40 rounded-2xl sm:rounded-t-2xl sm:rounded-b-none shadow-2xl flex flex-col overflow-hidden animate-scale-in"
      )}
    >
      {/* Header */}
      <div className="bg-secondary/40 px-4 py-3 flex items-center justify-between border-b border-border/30 select-none shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-base font-bold text-foreground">User Directory</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => loadDirectory(searchQuery, activeCategory)}
            disabled={loading}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            title="Refresh directory"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-primary")} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary/60 transition-colors cursor-pointer"
            title="Close directory"
            aria-label="Close directory"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-border/30 bg-background/50 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, college, bureau, region..."
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-secondary/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subheader: counts, category dropdown & view switcher */}
          <div className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground pt-0.5">
            <span className="shrink-0 text-[11px] sm:text-xs">
              {loading ? (
                "Loading records..."
              ) : (
                <>
                  Showing <strong className="text-foreground">{directoryData?.total_count ?? 0}</strong> contacts
                  {selectedRecipients.length > 0 && (
                    <span className="ml-1 text-primary font-bold">
                      ({selectedRecipients.length})
                    </span>
                  )}
                </>
              )}
            </span>

            {/* Category Dropdown between contact count and view toggle */}
            <select
              id="directory-category-dropdown"
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as CategoryTab)}
              className="bg-secondary/70 hover:bg-secondary text-foreground text-[11px] font-semibold px-2 py-1 rounded-lg border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors shrink-0 max-w-[130px] sm:max-w-[160px] truncate"
              aria-label="Filter directory by category"
            >
              {CATEGORY_TABS.map((tab) => (
                <option key={tab.id} value={tab.id} className="bg-card text-foreground font-medium">
                  {tab.label}
                </option>
              ))}
            </select>

            {/* Grouped / Flat List toggle */}
            <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border/40 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("grouped")}
                className={cn(
                  "px-2 py-0.5 text-[11px] rounded font-semibold transition-colors cursor-pointer",
                  viewMode === "grouped" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Grouped
              </button>
              <button
                type="button"
                onClick={() => setViewMode("flat")}
                className={cn(
                  "px-2 py-0.5 text-[11px] rounded font-semibold transition-colors cursor-pointer",
                  viewMode === "flat" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Flat List
              </button>
            </div>
          </div>
        </div>

        {/* Directory Content List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
          {loading && !directoryData ? (
            <div className="p-8 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-primary animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">
                Fetching registered users & institutional contacts...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 text-center space-y-3 bg-destructive/10 border border-destructive/20 rounded-2xl">
              <p className="text-xs text-destructive font-medium">{error}</p>
              <button
                type="button"
                onClick={() => loadDirectory(searchQuery, activeCategory)}
                className="px-3 py-1.5 text-xs font-bold bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
            </div>
          ) : allContactsFlat.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto text-muted-foreground">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No contacts found</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No users match your search criteria. Try a different term or filter category.
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="px-3 py-1.5 text-xs font-bold text-primary hover:underline"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : viewMode === "grouped" && directoryData?.grouped_by_institution ? (
            /* GROUPED VIEW BY INSTITUTION */
            <div className="space-y-3">
              {directoryData.grouped_by_institution.map((group) => {
                const isExpanded = expandedGroups[group.institution] ?? true;
                const groupSelectedCount = group.contacts.filter((c) =>
                  selectedEmailSet.has(c.email.toLowerCase())
                ).length;

                return (
                  <div
                    key={group.institution}
                    className="border border-border/40 rounded-xl overflow-hidden bg-card/60 shadow-xs transition-all"
                  >
                    {/* Group Header Accordion */}
                    <button
                      type="button"
                      onClick={() => toggleGroupExpand(group.institution)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between bg-secondary/30 hover:bg-secondary/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <Building2 className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                          {group.institution}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {groupSelectedCount > 0 && (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full">
                            {groupSelectedCount}
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border/30">
                          {group.contacts.length}
                        </span>
                      </div>
                    </button>

                    {/* Contacts inside group */}
                    {isExpanded && (
                      <div className="divide-y divide-border/20 p-1 bg-background/30">
                        {group.contacts.map((contact) => (
                          <ContactRow
                            key={contact.id}
                            contact={contact}
                            isSelected={selectedEmailSet.has(contact.email.toLowerCase())}
                            onToggle={() =>
                              onToggleRecipient({
                                email: contact.email,
                                name: contact.name,
                                role_label: contact.role_label,
                                institution: contact.institution,
                                is_registered: contact.is_registered,
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* FLAT LIST VIEW */
            <div className="divide-y divide-border/20 border border-border/40 rounded-xl overflow-hidden bg-card/60">
              {allContactsFlat.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  isSelected={selectedEmailSet.has(contact.email.toLowerCase())}
                  onToggle={() =>
                    onToggleRecipient({
                      email: contact.email,
                      name: contact.name,
                      role_label: contact.role_label,
                      institution: contact.institution,
                      is_registered: contact.is_registered,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer: Selected Status & Confirm Button */}
        <div className="p-3 border-t border-border/30 bg-secondary/20 flex items-center justify-between shrink-0">
          <div className="text-xs">
            <span className="text-muted-foreground font-medium">Selected: </span>
            <strong className="text-foreground font-extrabold">
              {selectedRecipients.length} recipient{selectedRecipients.length === 1 ? "" : "s"}
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!isComposeOpen && onOpenCompose) {
                  onOpenCompose();
                }
                onClose();
              }}
              className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-extrabold rounded-xl text-xs sm:text-sm shadow-md shadow-primary/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>{isComposeOpen ? "Done" : "Compose Message"}</span>
            </button>
          </div>
        </div>
      </aside>
  );
}

// ── Contact Item Sub-component ──────────────────────────────────
function ContactRow({
  contact,
  isSelected,
  onToggle,
}: {
  contact: DirectoryContact;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "p-2.5 sm:p-3 rounded-lg flex items-start gap-3 cursor-pointer transition-colors text-left group",
        isSelected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-secondary/40 border border-transparent"
      )}
    >
      {/* Checkbox indicator */}
      <div className="pt-0.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
        {isSelected ? (
          <div className="w-5 h-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-md border border-border/70 group-hover:border-primary/70 transition-colors" />
        )}
      </div>

      {/* Main contact details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-xs sm:text-sm text-foreground truncate">
            {contact.name}
          </span>

          {/* Registration / Account Status Badge */}
          {contact.is_registered ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              VigilOS Account
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-400 border border-sky-500/25 shrink-0">
              <Building2 className="w-3 h-3 text-sky-400" />
              Institution Registry
            </span>
          )}

          {contact.is_current_user && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
              You
            </span>
          )}
        </div>

        {/* Email */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate font-mono">
          <Mail className="w-3 h-3 shrink-0 opacity-70" />
          <span className="truncate">{contact.email}</span>
        </div>

        {/* Role & Department */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap pt-0.5">
          <span className="font-semibold text-foreground/80 bg-secondary/80 px-1.5 py-0.5 rounded text-[10px]">
            {contact.role_label}
          </span>
          {contact.department && (
            <span className="truncate">· {contact.department}</span>
          )}
        </div>

        {/* Region / State */}
        {contact.region && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 pt-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0 opacity-70" />
            <span className="truncate">{contact.region}</span>
          </div>
        )}
      </div>

      {/* Quick Add / Remove icon */}
      <div className="shrink-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[11px] font-bold text-primary">
          {isSelected ? "Remove" : "+ Add"}
        </span>
      </div>
    </div>
  );
}
