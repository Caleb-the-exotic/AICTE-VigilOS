// ============================================================
// src/routes/terms.tsx — Official AICTE VigilOS Terms of Service
// ============================================================
// Publicly accessible, compliant with Google Cloud OAuth verification.
// ============================================================

import { createFileRoute, Link } from "@tanstack/react-router";
import PublicLegalLayout, { type TocSection } from "@/components/layout/PublicLegalLayout";
import { 
  Scale, ShieldAlert, CheckCircle2, AlertTriangle, FileText, 
  ExternalLink, UserCheck, Shield, Lock, Clock, Info, HelpCircle
} from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsOfServicePage,
});

const SECTIONS: TocSection[] = [
  { id: "acceptance", title: "1. Acceptance of Terms & Institutional Review" },
  { id: "purpose", title: "2. Description & Platform Purpose" },
  { id: "eligibility", title: "3. Eligibility & Authorized User Tiers" },
  { id: "auth-rules", title: "4. Authentication (Google Sign-In & Email/Password)" },
  { id: "account-security", title: "5. Account Security & Credential Integrity" },
  { id: "roles-rbac", title: "6. Canonical Roles & Access Control Governance" },
  { id: "complaint-rules", title: "7. Standards for Complaint Filing & Evidence" },
  { id: "prohibited-activities", title: "8. Prohibited Conduct & Security Violations" },
  { id: "handler-obligations", title: "9. Responsibilities of Authorized Case Officers" },
  { id: "complaint-lifecycle", title: "10. Case Review, SLAs & Workflow Outcomes" },
  { id: "confidentiality", title: "11. Confidentiality & Appropriate Record Use" },
  { id: "availability", title: "12. Service Availability & Technical Limitations" },
  { id: "suspension-termination", title: "13. Suspension, Deactivation & Due Process" },
  { id: "retention-closure", title: "14. Data Retention & Account Deletion" },
  { id: "third-parties", title: "15. Third-Party Services & External Links" },
  { id: "ip-permitted-use", title: "16. Intellectual Property & Permitted Use" },
  { id: "disclaimers-liability", title: "17. Disclaimers & Limitation of Liability" },
  { id: "modifications", title: "18. Amendments & Updates to these Terms" },
  { id: "governing-law", title: "19. Governing Law & Dispute Resolution" },
  { id: "contact", title: "20. Contact Information & Support" },
];

function TermsOfServicePage() {
  return (
    <PublicLegalLayout
      title="Terms of Service"
      subtitle="Operational rules, user obligations, role-based access parameters, and complaint submission governance for the AICTE VigilOS Platform."
      badge="Operational & Governance Standards"
      lastUpdated="October 25, 2026"
      sections={SECTIONS}
    >
      {/* ── 1. Acceptance of Terms ── */}
      <section id="acceptance" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Scale className="w-5 h-5" />
          <h2>1. Acceptance of Terms & Pre-Deployment Institutional Review</h2>
        </div>
        <p>
          Welcome to <strong>AICTE VigilOS</strong> (&ldquo;VigilOS&rdquo;, &ldquo;the Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), hosted at{" "}
          <a href="https://aicte-vigil-os.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">
            https://aicte-vigil-os.vercel.app/
          </a>.
        </p>
        <p>
          By accessing, browsing, registering an account on, or submitting data through AICTE VigilOS, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;) and our reciprocal{" "}
          <Link to="/privacy" className="text-primary underline hover:text-primary/80 font-medium">
            Privacy Policy
          </Link>. If you do not agree to these Terms, you must immediately cease accessing and using the platform.
        </p>
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
          <p className="font-semibold text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Institutional Governance Notice:</span>
          </p>
          <p className="text-muted-foreground leading-relaxed">
            These Terms have been drafted to reflect the technical implementation of the VigilOS software system (developed for Problem Statement PS26264). They are provided for administrative transparency, user compliance, and Google OAuth application verification. Prior to official statutory adoption across Council operations, these terms are subject to final institutional validation by designated AICTE legal and administrative authorities.
          </p>
        </div>
      </section>

      {/* ── 2. Description & Platform Purpose ── */}
      <section id="purpose" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <FileText className="w-5 h-5" />
          <h2>2. Description & Platform Purpose</h2>
        </div>
        <p>
          AICTE VigilOS is a regulatory oversight, institutional complaint tracking, and cross-bureau intelligence system engineered to coordinate grievance redressal across the All India Council for Technical Education (AICTE) ecosystem.
        </p>
        <p>
          The primary objectives of the platform include:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground text-xs sm:text-sm">
          <li><strong>Institutional Overlap Prevention:</strong> Identifying duplicate or concurrent complaints lodged simultaneously across different bureaus or regional bodies to avoid conflicting administrative actions.</li>
          <li><strong>Cross-Bureau Intelligence & Coordination:</strong> Providing synchronized case awareness between the Regulation Bureau (RB), Public Grievance Redressal Cell (PGRC), Approval Bureau (AB), and decentralized Regional Offices (ROs).</li>
          <li><strong>Citizen Grievance Redressal:</strong> Providing authenticated citizens, students, faculty, and stakeholders a transparent mechanism to lodge, track, and monitor institutional grievances concerning AICTE-approved institutions.</li>
          <li><strong>Systemic Anomaly Detection:</strong> Providing senior regulatory executives aggregated telemetry, escalation metrics, and institutional risk scoring.</li>
        </ul>
      </section>

      {/* ── 3. Eligibility & User Categories ── */}
      <section id="eligibility" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <UserCheck className="w-5 h-5" />
          <h2>3. Eligibility & Authorized User Tiers</h2>
        </div>
        <p>
          Access to VigilOS is categorized into two principal user tiers:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Public & Citizen Complainants
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Open to students, faculty, staff, parents, and members of the public seeking redressal regarding technical education institutions. Complainants must be at least 18 years of age (or represent an adult guardian/ward) and possess a valid, verifiable email address or Google account.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Authorized Regulatory Personnel
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Restricted to officially designated officers, bureau heads, regional nodal coordinators, and platform administrators. Administrative privileges are provisioned strictly by authorized supervisors via the database-driven Role Management service.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. Authentication (Google Sign-In & Credentials) ── */}
      <section id="auth-rules" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Shield className="w-5 h-5" />
          <h2>4. Authentication (Google Sign-In & Email/Password)</h2>
        </div>
        <p>
          VigilOS supports two identity verification pathways:
        </p>
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/30 space-y-2">
            <h3 className="font-semibold text-sm text-foreground">A. Google Identity Services (OAuth 2.0 / OpenID Connect)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Users may sign in utilizing Google OAuth (Client ID: <span className="font-mono text-primary text-[11px]">178410841874-gd0mdctpo2g4s4n6govmen71v5nqp96a.apps.googleusercontent.com</span>). By utilizing Google Sign-In, you authorize VigilOS to receive and verify your primary Google email address, display name, unique Google subject identifier (<code className="font-mono text-xs">sub</code>), and profile avatar picture. You are responsible for maintaining the security of your underlying Google account.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/30 space-y-2">
            <h3 className="font-semibold text-sm text-foreground">B. Native Email & Password Authentication</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Users registering with direct credentials must provide an authentic email address and create a robust password. Passwords are cryptographically salted and hashed using PBKDF2-HMAC-SHA256 with 600,000 iterations before storage in the SQLite authentication directory.
            </p>
          </div>
        </div>
      </section>

      {/* ── 5. Account Security ── */}
      <section id="account-security" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Lock className="w-5 h-5" />
          <h2>5. Account Security & Credential Integrity</h2>
        </div>
        <p>
          You are solely responsible for all actions conducted under your account credentials. You agree to:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
          <li>Maintain the confidentiality of your login passwords, multi-factor tokens, and session tokens.</li>
          <li>Never share or transfer your account credentials to colleagues, subordinates, or third parties.</li>
          <li>Promptly log out of VigilOS sessions upon concluding work on shared, public, or institutional workstations.</li>
          <li>Immediately notify the platform administration upon suspecting any unauthorized access, compromised session token, or security breach.</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          AICTE VigilOS will never solicit your account password via email, phone, or unsolicited messaging.
        </p>
      </section>

      {/* ── 6. Canonical Roles & RBAC Governance ── */}
      <section id="roles-rbac" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <ShieldAlert className="w-5 h-5" />
          <h2>6. Canonical Roles & Role-Based Access Control (RBAC) Governance</h2>
        </div>
        <p>
          VigilOS enforces strict, database-driven Role-Based Access Control (RBAC) validated against the backend SQLite database (<code className="font-mono text-xs">campusflow.db</code>). System capabilities are segregated into five canonical roles:
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-foreground font-semibold border-b border-border/40">
              <tr>
                <th className="p-3">Canonical Role</th>
                <th className="p-3">Operational Scope</th>
                <th className="p-3">Permitted Capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 text-muted-foreground">
              <tr>
                <td className="p-3 font-mono font-medium text-purple-400">super_admin</td>
                <td className="p-3">National / Executive HQ</td>
                <td className="p-3">System configuration, bureau/regional role reassignments, administrative audit oversight, full case lifecycle control.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium text-blue-400">bureau_head</td>
                <td className="p-3">Bureau-Level (RB, PGRC, AB)</td>
                <td className="p-3">Bureau queue management, case assignment to officers, cross-bureau conflict review, SLA monitoring.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium text-emerald-400">approval_officer</td>
                <td className="p-3">Case Investigation Tier</td>
                <td className="p-3">Evidence inspection, institutional response verification, hearing scheduling, resolution drafting.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium text-amber-400">nodal_officer</td>
                <td className="p-3">Regional Office (RO) Tier</td>
                <td className="p-3">Regional field verification, localized institution inquiries, physical inspection reporting.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium text-zinc-400">citizen</td>
                <td className="p-3">Public Complainant</td>
                <td className="p-3">Grievance lodging, attachment uploading, case tracking, response submission to institutional inquiries.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Attempting to access, modify, or invoke API endpoints outside your assigned canonical role constitutes an intentional violation of these Terms and triggers immediate administrative logging.
        </p>
      </section>

      {/* ── 7. Standards for Complaint Filing ── */}
      <section id="complaint-rules" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <CheckCircle2 className="w-5 h-5" />
          <h2>7. Standards for Complaint Submission & Evidence</h2>
        </div>
        <p>
          Citizens and institutional stakeholders lodging complaints through VigilOS must adhere to strict veracity standards:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground text-xs sm:text-sm">
          <li><strong>Factual Authenticity:</strong> All statements, dates, institutional names, and narrative descriptions must be accurate and truthful to the best of the complainant&rsquo;s knowledge.</li>
          <li><strong>Legitimate Supporting Evidence:</strong> Uploaded documentation, affidavits, fee receipts, or correspondence must be authentic. Submitting forged, digitally doctored, or fraudulent records is strictly prohibited.</li>
          <li><strong>Non-Frivolous Intent:</strong> Complaints must not be lodged for vexatious purposes, commercial retribution, personal harassment, or bad-faith disruption of educational institutions.</li>
          <li><strong>Jurisdictional Relevance:</strong> Grievances must concern technical education institutions, programs, faculty norms, infrastructure, or student welfare falling within the regulatory purview of AICTE.</li>
        </ul>
      </section>

      {/* ── 8. Prohibited Activities ── */}
      <section id="prohibited-activities" className="space-y-4">
        <div className="flex items-center gap-2 text-rose-500 font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <AlertTriangle className="w-5 h-5" />
          <h2>8. Prohibited Conduct & System Integrity Violations</h2>
        </div>
        <p>
          Users are strictly prohibited from engaging in any of the following activities on VigilOS:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1">
            <h4 className="font-semibold text-rose-400">Identity & Impersonation</h4>
            <p className="text-muted-foreground">Impersonating any AICTE official, bureau head, institutional representative, or other individual, or falsifying institutional affiliations.</p>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1">
            <h4 className="font-semibold text-rose-400">Security Circumvention</h4>
            <p className="text-muted-foreground">Probing, scanning, or vulnerability-testing the platform; bypassing JWT authentication or privilege boundaries; automated scraping or rate-limit denial.</p>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1">
            <h4 className="font-semibold text-rose-400">Malicious Payloads</h4>
            <p className="text-muted-foreground">Uploading malicious code, corrupted PDFs, spyware, Trojans, or unauthorized tracking beacons disguised as case attachments.</p>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1">
            <h4 className="font-semibold text-rose-400">Unauthorized Disclosure</h4>
            <p className="text-muted-foreground">Exfiltrating, publishing, or disseminating non-public grievance records, whistleblower identities, or internal regulatory proceedings.</p>
          </div>
        </div>
      </section>

      {/* ── 9. Responsibilities of Case Handlers ── */}
      <section id="handler-obligations" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Shield className="w-5 h-5" />
          <h2>9. Responsibilities of Authorized Case Officers</h2>
        </div>
        <p>
          Regulatory personnel assigned administrative or investigative roles (<code className="font-mono text-xs">bureau_head</code>, <code className="font-mono text-xs">approval_officer</code>, <code className="font-mono text-xs">nodal_officer</code>) undertake specific professional commitments:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
          <li><strong>Objective Evaluation:</strong> Reviewing all complaints impartially, strictly evaluating submissions against established AICTE Approval Process Handbooks and regulatory guidelines.</li>
          <li><strong>Timely Case Processing:</strong> Exercising due diligence to adhere to bureau Service Level Agreements (SLAs) without unwarranted procedural delay.</li>
          <li><strong>Conflict of Interest Disclosure:</strong> Promptly recusing themselves from cases involving institutions where personal, professional, or commercial conflicts exist.</li>
          <li><strong>Audit Trail Integrity:</strong> Accurately recording notes, hearing summaries, and disposition rationales in the immutable system audit record.</li>
        </ul>
      </section>

      {/* ── 10. Complaint Lifecycle & SLA ── */}
      <section id="complaint-lifecycle" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Clock className="w-5 h-5" />
          <h2>10. Case Review, SLAs & Workflow Outcomes</h2>
        </div>
        <p>
          VigilOS provides a systematic workflow engine for case assignment, escalation, and resolution. Users acknowledge the following operational parameters:
        </p>
        <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 space-y-3 text-xs leading-relaxed">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">Procedural Progression:</strong> Case progression from submission to intake, bureau triage, nodal inquiry, institutional response, and final resolution depends on evidence completeness and institutional response cycles.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">Non-Guarantee of Specific Determinations:</strong> Submitting a grievance through VigilOS does not guarantee a particular legal or regulatory sanction against an institution. All determinations are reached independently pursuant to official AICTE norms.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">SLA Telemetry:</strong> System resolution timers, escalation badges, and SLA indicators displayed in the interface serve internal administrative management and do not establish legally enforceable private deadlines unless prescribed by statutory mandate.
            </p>
          </div>
        </div>
      </section>

      {/* ── 11. Confidentiality ── */}
      <section id="confidentiality" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Lock className="w-5 h-5" />
          <h2>11. Confidentiality & Appropriate Record Use</h2>
        </div>
        <p>
          All grievance records, whistleblower identity disclosures, institutional financial audits, and officer deliberation notes accessible within VigilOS are strictly confidential.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Authorized personnel may not export, duplicate, screenshot, or distribute case records beyond official regulatory duties. Unauthorized disclosure of complainant identities or ongoing regulatory inquiries may violate Council conduct regulations, statutory confidentiality obligations, and applicable data protection legislation.
        </p>
      </section>

      {/* ── 12. Service Availability & Limitations ── */}
      <section id="availability" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Info className="w-5 h-5" />
          <h2>12. Service Availability & Technical Limitations</h2>
        </div>
        <p>
          VigilOS is provided on an &ldquo;as available&rdquo; and &ldquo;as is&rdquo; basis. You recognize and accept that:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
          <li>The platform may experience periodic maintenance windows, system updates, emergency patches, or network service interruptions.</li>
          <li>In serverless or transient deployment configurations, underlying SQLite database files must be backed by persistent storage volumes or replicated backends to prevent state resets across build deployments.</li>
          <li>We reserve the right to modify, suspend, or discontinue any feature, endpoint, or analytical module of VigilOS at our discretion.</li>
        </ul>
      </section>

      {/* ── 13. Suspension, Deactivation & Termination ── */}
      <section id="suspension-termination" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <AlertTriangle className="w-5 h-5" />
          <h2>13. Account Suspension, Deactivation & Due Process</h2>
        </div>
        <p>
          Platform administrators reserve the right to suspend, deactivate, or terminate user accounts under the following conditions:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
          <li>Repeated submission of fraudulent, fabricated, or abusive complaints.</li>
          <li>Unauthorized attempts to escalate role privileges, bypass RBAC controls, or access unassigned cases.</li>
          <li>Revocation of official duty status, transfer from designated bureau/regional office, or termination of employment for administrative personnel.</li>
          <li>Receipt of valid court orders, law enforcement directives, or official AICTE disciplinary decrees.</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Except in urgent security emergencies, users whose accounts are subject to administrative restriction will be provided notification through their registered email address.
        </p>
      </section>

      {/* ── 14. Data Retention & Account Closure ── */}
      <section id="retention-closure" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Clock className="w-5 h-5" />
          <h2>14. Data Retention & Account Closure</h2>
        </div>
        <p>
          Account closure and data deletion requests are processed in alignment with our{" "}
          <Link to="/privacy" className="text-primary underline hover:text-primary/80 font-medium">
            Privacy Policy
          </Link>.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          While users may request deactivation of authentication accounts, official complaint records, evidence logs, institutional responses, and administrative audit trails remain subject to statutory record-retention requirements and cannot be unilaterally erased where active regulatory investigations or archival mandates apply.
        </p>
      </section>

      {/* ── 15. Third-Party Services & Links ── */}
      <section id="third-parties" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <ExternalLink className="w-5 h-5" />
          <h2>15. Third-Party Services & External Links</h2>
        </div>
        <p>
          VigilOS incorporates external authentication services and may contain links to external institutional or government portals (e.g., Google Identity Services, AICTE Portal, Ministry of Education, or institutional domains).
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          We do not control, endorse, or assume responsibility for the content, privacy practices, terms, or operational availability of external third-party sites or cloud service infrastructures. Your interactions with third-party providers are governed by their respective terms and privacy policies.
        </p>
      </section>

      {/* ── 16. Intellectual Property ── */}
      <section id="ip-permitted-use" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <FileText className="w-5 h-5" />
          <h2>16. Intellectual Property & Permitted Use</h2>
        </div>
        <p>
          The software architecture, source code, visual design, user interface components, and analytical algorithms of VigilOS are protected under applicable intellectual property laws.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
          <li><strong>Permitted Use:</strong> Users are granted a limited, revocable, non-exclusive license to access and interact with the platform solely for lawful complaint redressal, institutional monitoring, and official regulatory duties.</li>
          <li><strong>Institutional Trademarks:</strong> Official council emblems, logos, and organizational marks remain the exclusive property of the All India Council for Technical Education. Nothing in these Terms grants any license to use official insignias without written authorization.</li>
        </ul>
      </section>

      {/* ── 17. Disclaimers & Limitation of Liability ── */}
      <section id="disclaimers-liability" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <AlertTriangle className="w-5 h-5" />
          <h2>17. Disclaimers & Limitation of Liability</h2>
        </div>
        <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 space-y-2 text-xs text-muted-foreground leading-relaxed uppercase tracking-wider font-mono">
          <p>
            TO THE FULLEST EXTENT PERMISSIBLE UNDER APPLICABLE LAW, AICTE VIGILOS, ITS DEVELOPERS, CONTRIBUTING ENGINEERS, HOSTING INFRASTRUCTURE PROVIDERS, AND AFFILIATED BODIES DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p>
            UNDER NO CIRCUMSTANCES SHALL VIGILOS OR ITS OPERATORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF DATA, INTERRUPTED CASE FILINGS, SYSTEM DOWNTIME, OR REPUTATIONAL HARM ARISING OUT OF YOUR USE OF OR INABILITY TO USE THE PLATFORM.
          </p>
        </div>
      </section>

      {/* ── 18. Amendments & Modifications ── */}
      <section id="modifications" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Clock className="w-5 h-5" />
          <h2>18. Amendments & Updates to these Terms</h2>
        </div>
        <p>
          We reserve the right to revise or update these Terms periodically to reflect legislative amendments, institutional policy revisions, security enhancements, or technical updates.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Material modifications will be reflected by updating the &ldquo;Last Updated&rdquo; date at the apex of this document. Continued engagement with VigilOS following any revision constitutes your acceptance of the updated Terms.
        </p>
      </section>

      {/* ── 19. Governing Law & Dispute Resolution ── */}
      <section id="governing-law" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Scale className="w-5 h-5" />
          <h2>19. Governing Law, Jurisdiction & Dispute Resolution</h2>
        </div>
        <div className="p-4 rounded-xl bg-secondary/40 border border-border/40 text-xs space-y-2 leading-relaxed">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <span>Jurisdictional Confirmation Item:</span>
          </p>
          <p className="text-muted-foreground">
            In accordance with public governance standards, governing law and dispute resolution mechanisms for statutory grievance administration are determined by the regulatory seats of the All India Council for Technical Education (HQ: New Delhi, India).
          </p>
          <p className="text-muted-foreground">
            Any disputes arising in connection with the technical operation of this platform are subject to prior institutional review andconciliation before designated regulatory ombudsmen prior to the commencement of formal legal proceedings.
          </p>
        </div>
      </section>

      {/* ── 20. Contact Information ── */}
      <section id="contact" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <HelpCircle className="w-5 h-5" />
          <h2>20. Contact Information & Support</h2>
        </div>
        <p>
          For questions, technical support, policy clarifications, or operational feedback regarding these Terms of Service:
        </p>
        <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 text-xs space-y-2">
          <p className="font-semibold text-foreground">AICTE VigilOS Administrative & Technical Desk</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Platform URL: <a href="https://aicte-vigil-os.vercel.app/" className="text-primary hover:underline font-mono">https://aicte-vigil-os.vercel.app/</a></p>
            <p>Terms of Service: <a href="https://aicte-vigil-os.vercel.app/terms" className="text-primary hover:underline font-mono">https://aicte-vigil-os.vercel.app/terms</a></p>
            <p>Privacy Policy: <Link to="/privacy" className="text-primary hover:underline font-mono">https://aicte-vigil-os.vercel.app/privacy</Link></p>
            <p>Contact & Support: <a href="mailto:2204caleb2007@gmail.com" className="text-primary hover:underline font-mono">2204caleb2007@gmail.com</a></p>
          </div>
          <div className="mt-3 pt-3 border-t border-border/30 text-[11px] text-muted-foreground/80">
            <strong className="text-foreground">Official Institution Reference:</strong> All India Council for Technical Education (AICTE), Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070. Official council grievances may also be tracked via official AICTE portals.
          </div>
        </div>
      </section>
    </PublicLegalLayout>
  );
}
