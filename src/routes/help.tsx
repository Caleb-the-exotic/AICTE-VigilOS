import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { 
  MapPin, Phone, Mail, Clock, Send, 
  Building2, CheckCircle2, Shield, Globe, ExternalLink,
  HelpCircle, AlertCircle, FileText
} from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({ 
    meta: [
      { title: "Help & Support — VigilOS" }, 
      { name: "description", content: "Official AICTE Institutional Support, Bureau Assistance, and VigilOS Portal Helpdesk." }
    ] 
  }),
  component: HelpPage,
});

function HelpPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    emailOrPid: "",
    category: "Grievance Inquiry",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.message) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ firstName: "", lastName: "", emailOrPid: "", category: "Grievance Inquiry", message: "" });
    }, 4000);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12 px-4 md:px-6">
        
        {/* Title Section */}
        <div className="text-left space-y-2 mt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-semibold text-primary">
            <Shield className="w-3.5 h-3.5" />
            AICTE Helpdesk & Bureau Redressal Cell
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Institutional Support &amp; Assistance
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl">
            Get assistance with technical institution cases, cross-bureau coordination (RB &amp; PGRC), or VigilOS platform queries.
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-7 bg-card/45 backdrop-blur-xl border border-border/40 p-6 md:p-8 rounded-2xl flex flex-col justify-between">
            {submitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Ticket Submitted Successfully!</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Your inquiry has been assigned a tracking reference and routed to the respective AICTE bureau cell. Our support officers will review and respond shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="firstName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      required
                      placeholder="e.g. Ramesh"
                      className="w-full bg-background border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="lastName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      required
                      placeholder="e.g. Kumar"
                      className="w-full bg-background border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="emailOrPid" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Official Email or AICTE PID
                    </label>
                    <input
                      type="text"
                      id="emailOrPid"
                      required
                      placeholder="e.g. 1-109723481 or officer@sritcbe.ac.in"
                      className="w-full bg-background border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={formData.emailOrPid}
                      onChange={(e) => setFormData({ ...formData, emailOrPid: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="category" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Inquiry Category
                    </label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-background border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    >
                      <option value="Grievance Inquiry">Public Grievance (PGRC) Inquiry</option>
                      <option value="Regulation Inquiry">Regulation Bureau (RB) Compliance</option>
                      <option value="Overlap Case">Cross-Bureau Case Overlap Escalation</option>
                      <option value="Technical Support">Portal Access / Technical Bug</option>
                      <option value="Regional Office">Regional Office (RO) Coordination</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="message" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Inquiry Details / Case Summary
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    placeholder="Provide case ID, institution PID, or describe the specific requirement..."
                    className="w-full bg-background border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.005] active:scale-[0.99] transition-all cursor-pointer text-sm"
                >
                  <Send className="w-4 h-4" />
                  Submit Support Ticket
                </button>
              </form>
            )}
          </div>

          {/* Right Column: AICTE Headquarters & Bureau Contact Channels */}
          <div className="lg:col-span-5 bg-secondary/25 border border-border/30 p-6 md:p-8 rounded-2xl flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <img src="/aicte-logo.png" alt="AICTE Emblem" className="w-11 h-11 object-contain shrink-0" />
                <div>
                  <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                    All India Council for Technical Education
                  </h2>
                  <p className="text-xs text-muted-foreground">Ministry of Education, Government of India</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {/* Headquarters Location */}
                <div className="flex gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-foreground">AICTE Headquarters</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
                    </p>
                  </div>
                </div>

                {/* Central Helpline Phone */}
                <div className="flex gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-foreground">Central Helplines</div>
                    <p className="text-xs text-muted-foreground">
                      011-29581000 / 011-29581050
                    </p>
                    <p className="text-[11px] text-amber-400 font-mono">
                      Toll-Free (Grievance Cell): 1800-11-2246
                    </p>
                  </div>
                </div>

                {/* Bureau Direct Email Channels */}
                <div className="flex gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-foreground">Bureau Contact Desks</div>
                    <div className="space-y-0.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">PGRC Cell: </span>
                        <a href="mailto:pgrc@aicte-india.org" className="text-primary hover:underline">
                          pgrc@aicte-india.org
                        </a>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Regulation Bureau: </span>
                        <a href="mailto:regulation@aicte-india.org" className="text-primary hover:underline">
                          regulation@aicte-india.org
                        </a>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Portal Support: </span>
                        <a href="mailto:support@vigilos.gov.in" className="text-primary hover:underline">
                          support@vigilos.gov.in
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operating Timings */}
                <div className="flex gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-foreground">Office Working Hours</div>
                    <p className="text-xs text-muted-foreground">
                      Monday – Friday: 9:30 AM – 5:30 PM (IST)
                    </p>
                    <p className="text-[11px] text-emerald-400">
                      VigilOS Online System: 24/7 Intake &amp; Case Tracking
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Regional Coverage & Official Portals */}
            <div className="space-y-3 pt-4 border-t border-border/20">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Coordinating across 8 AICTE Regional Offices (Northern, Southern, Western, Eastern, South-Western, Central, North-Western, and Camp Offices).
              </p>
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Official Portals</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href="https://www.aicte-india.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-background border border-border/40 text-foreground/80 hover:text-primary hover:border-primary/50 transition-all"
                  >
                    <Globe className="w-3 h-3 text-primary" /> aicte-india.org <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                  </a>
                  <a
                    href="https://pgportal.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-background border border-border/40 text-foreground/80 hover:text-primary hover:border-primary/50 transition-all"
                  >
                    <Building2 className="w-3 h-3 text-primary" /> CPGRAMS Portal <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                  </a>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </AppLayout>
  );
}
