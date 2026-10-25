// ============================================================
// src/routes/privacy.tsx — Official AICTE VigilOS Privacy Policy
// ============================================================
// Publicly accessible, compliant with Google Cloud OAuth User Data Policy.
// ============================================================

import { createFileRoute, Link } from "@tanstack/react-router";
import PublicLegalLayout, { type TocSection } from "@/components/layout/PublicLegalLayout";
import { 
  ShieldCheck, Lock, Database, AlertCircle, CheckCircle2, 
  ExternalLink, UserCheck, Eye, RefreshCw, FileText, Globe
} from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
});

const SECTIONS: TocSection[] = [
  { id: "intro", title: "Introduction & Scope" },
  { id: "data-collected", title: "Information We Collect" },
  { id: "auth-flows", title: "Authentication (Google OAuth & Credentials)" },
  { id: "google-data", title: "Google User Data & Limited Use Policy" },
  { id: "purposes", title: "Purposes of Data Processing" },
  { id: "architecture-security", title: "Storage, Architecture & Security" },
  { id: "access-disclosure", title: "Access Control & Information Disclosure" },
  { id: "retention-deletion", title: "Data Retention & Deletion Practices" },
  { id: "user-rights", title: "Your Rights & Access Requests" },
  { id: "cookies-sessions", title: "Cookies, Sessions & Local Storage" },
  { id: "children", title: "Minors & Children's Privacy" },
  { id: "third-parties", title: "Third-Party Services & Integrations" },
  { id: "policy-changes", title: "Changes to this Policy" },
  { id: "contact", title: "Contact Information & Confirmation Notice" },
];

function PrivacyPolicyPage() {
  return (
    <PublicLegalLayout
      title="Privacy Policy"
      subtitle="Transparency on personal data handling, Google OAuth integration, role-based case management, and system architecture for the AICTE VigilOS Platform."
      badge="Google OAuth & Regulatory Compliance"
      lastUpdated="October 25, 2026"
      sections={SECTIONS}
    >
      {/* ── 1. Introduction & Scope ── */}
      <section id="intro" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <ShieldCheck className="w-5 h-5" />
          <h2>1. Introduction & Scope</h2>
        </div>
        <p>
          This Privacy Policy governs the collection, processing, storage, and protection of information by <strong>AICTE VigilOS</strong> (&ldquo;VigilOS&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the Platform&rdquo;), accessible at{" "}
          <a href="https://aicte-vigil-os.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">
            https://aicte-vigil-os.vercel.app/
          </a>.
        </p>
        <p>
          VigilOS is an AICTE-aligned institutional complaint monitoring, overlap prevention, and cross-bureau intelligence platform engineered for Problem Statement PS26264. The platform facilitates structured oversight across the All India Council for Technical Education (AICTE) regulatory apparatus, including the Regulation Bureau (RB), Public Grievance Redressal Cell (PGRC), and decentralized Regional Offices (ROs).
        </p>
        <div className="p-4 rounded-xl bg-secondary/40 border border-border/40 text-xs space-y-1.5">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-primary shrink-0" />
            <span>Scope of this Document:</span>
          </p>
          <p className="text-muted-foreground leading-relaxed">
            This policy applies exclusively to interactions on the VigilOS web application and its connected API services. It details how we handle user identity data, Google OAuth authentication tokens, grievance submissions, and administrative audit trails.
          </p>
        </div>
      </section>

      {/* ── 2. Information We Collect ── */}
      <section id="data-collected" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Database className="w-5 h-5" />
          <h2>2. Information We Collect</h2>
        </div>
        <p>
          We collect only information necessary to authenticate authorized personnel, verify citizen complainants, route institutional grievances, and maintain audit integrity. We do not engage in commercial tracking or data monetization.
        </p>
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-foreground">A. Account & Identity Information</h3>
          <ul className="list-disc list-inside space-y-1.5 text-muted-foreground pl-2">
            <li><strong className="text-foreground">Full Name:</strong> Provided during account creation or imported from your verified Google account profile.</li>
            <li><strong className="text-foreground">Official Email Address:</strong> Used as the primary unique identifier for login, notifications, and jurisdiction scoping.</li>
            <li><strong className="text-foreground">Password Hash:</strong> For users authenticating with email and password, we store salted PBKDF2-SHA256 password hashes. Passwords are never stored or transmitted in plain text.</li>
            <li><strong className="text-foreground">Google Account Identifiers:</strong> The unique Google subject identifier (&ldquo;sub&rdquo;) and profile picture URL received when logging in via Google Identity Services.</li>
            <li><strong className="text-foreground">Account Status:</strong> Administrative state flags (&ldquo;active&rdquo; or &ldquo;inactive&rdquo;).</li>
          </ul>

          <h3 className="font-bold text-sm text-foreground pt-2">B. Organizational Assignment & Role Governance</h3>
          <ul className="list-disc list-inside space-y-1.5 text-muted-foreground pl-2">
            <li><strong className="text-foreground">Canonical Role:</strong> One of five system roles: Super Admin, Bureau Head, Approval Officer, Regional Nodal Officer, or Citizen.</li>
            <li><strong className="text-foreground">Bureau Assignment:</strong> Headquarters (HQ), Regulation Bureau (RB), Public Grievance Redressal Cell (PGRC), Regional Office Cell (RO), or State Liaison.</li>
            <li><strong className="text-foreground">Regional Jurisdiction:</strong> Geographic designation (HQ, Northern, Southern, Western, Eastern, or Central Region).</li>
          </ul>

          <h3 className="font-bold text-sm text-foreground pt-2">C. Complaint & Regulatory Records</h3>
          <ul className="list-disc list-inside space-y-1.5 text-muted-foreground pl-2">
            <li><strong className="text-foreground">Grievance Information:</strong> AICTE Permanent Institute ID (PID), institution name, category (e.g., Faculty Deficiency, Capitation Fee, Ragging), complaint summary, description, and assigned officer.</li>
            <li><strong className="text-foreground">Institutional Profiles:</strong> Public educational institution metadata, approved intake, campus contact information, and verified location details.</li>
            <li><strong className="text-foreground">Audit Logs & Telemetry:</strong> Immutable timestamped logs of administrative actions (case updates, role changes, show-cause notices) stored in the database to prevent evidence tampering.</li>
          </ul>
        </div>
      </section>

      {/* ── 3. Authentication (Google OAuth & Credentials) ── */}
      <section id="auth-flows" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Lock className="w-5 h-5" />
          <h2>3. Authentication Mechanisms</h2>
        </div>
        <p>
          VigilOS provides a unified identity architecture supporting two primary login pathways:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-primary" /> Google Single Sign-On (SSO)
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Users can authenticate using Google Workspace or personal Google accounts via Google Identity Services. Google validates credentials securely on its servers and returns a cryptographically signed OpenID Connect ID token to VigilOS.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-primary" /> Official Email & Password
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Institutional personnel can register directly with their official institutional email address. Passwords are salted and hashed using PBKDF2 with HMAC-SHA256 (100,000 iterations) before storage in the backend database.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Both authentication mechanisms resolve to a single canonical database record in the SQLite <code>users</code> and <code>auth_accounts</code> tables. Authenticated sessions are managed via standard JSON Web Tokens (JWT) signed with HS256, carrying an expiration period of 7 days.
        </p>
      </section>

      {/* ── 4. Google User Data & Limited Use Policy ── */}
      <section id="google-data" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <CheckCircle2 className="w-5 h-5" />
          <h2>4. Google User Data & Limited Use Disclosure</h2>
        </div>
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/25 space-y-2 text-xs">
          <p className="font-bold text-foreground text-sm">
            Compliance with Google API Services User Data Policy:
          </p>
          <p className="text-muted-foreground leading-relaxed">
            VigilOS&rsquo;s use and transfer to any other app of information received from Google APIs adheres to the{" "}
            <a 
              href="https://developers.google.com/terms/api-services-user-data-policy" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary underline hover:text-primary/90"
            >
              Google API Services User Data Policy
            </a>, including the Limited Use requirements.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-sm text-foreground">Specific Google Data Accessed:</h3>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2 text-xs">
            <li><strong>Email address:</strong> To uniquely identify and authorize your account.</li>
            <li><strong>Name:</strong> To display your official name on case actions, reports, and administrative decisions.</li>
            <li><strong>Profile picture URL:</strong> To display your user avatar within the application navbar.</li>
            <li><strong>Google Subject Identifier (&ldquo;sub&rdquo;):</strong> A unique numeric ID to verify account authenticity.</li>
          </ul>

          <h3 className="font-bold text-sm text-foreground pt-2">How Google User Data is Handled:</h3>
          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              • <strong>No Advertising or Commercial Use:</strong> We do not sell, rent, or trade Google user data to advertisers, data brokers, or marketing networks.
            </p>
            <p>
              • <strong>No Unauthorized Human Access:</strong> No human supervisor or engineer reads user Google data unless required for security investigations, bug remediation requested by the user, or compliance with applicable law.
            </p>
            <p>
              • <strong>No Generalized Model Training:</strong> Google user data is not used to train generalized artificial intelligence or machine learning models.
            </p>
            <p>
              • <strong>Revoking Google Access:</strong> You can disconnect VigilOS from your Google account at any time by visiting your Google Security Settings at{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary underline font-mono">
                https://myaccount.google.com/permissions
              </a>.
            </p>
          </div>
        </div>
      </section>

      {/* ── 5. Purposes of Data Processing ── */}
      <section id="purposes" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Eye className="w-5 h-5" />
          <h2>5. Purposes of Data Processing</h2>
        </div>
        <p>
          Personal and regulatory information processed through VigilOS is used strictly for the following purposes:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
            <strong className="text-foreground">Authentication & Access Control:</strong>
            <p className="text-muted-foreground">Verifying identity and assigning appropriate role-based jurisdiction scopes across AICTE bureaus.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
            <strong className="text-foreground">Grievance Case Tracking:</strong>
            <p className="text-muted-foreground">Managing complaint lifecycles from submission to investigation, escalation, and disposal.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
            <strong className="text-foreground">Cross-Bureau Overlap Prevention:</strong>
            <p className="text-muted-foreground">Detecting concurrent complaints filed across both Regulation Bureau and Grievance Cell to eliminate duplicate proceedings.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
            <strong className="text-foreground">Official Communications & Notices:</strong>
            <p className="text-muted-foreground">Issuing official institutional summonses, show-cause notices, and hearing schedules with verified audit trails.</p>
          </div>
        </div>
      </section>

      {/* ── 6. Storage, Architecture & Security ── */}
      <section id="architecture-security" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Lock className="w-5 h-5" />
          <h2>6. Storage, Architecture & Security</h2>
        </div>
        <p>
          VigilOS operates under a decoupled, modern cloud deployment architecture:
        </p>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            • <strong className="text-foreground">Frontend Interface (Vercel CDN):</strong> The web user interface is built with React and Vite and deployed globally on Vercel&rsquo;s Edge Network (<code>aicte-vigil-os.vercel.app</code>) under TLS 1.3 HTTPS encryption.
          </p>
          <p>
            • <strong className="text-foreground">Backend & Database Architecture:</strong> API services run on FastAPI connecting to a normalized SQLite relational database (<code>campusflow.db</code>) with transactional integrity, foreign key enforcement (<code>PRAGMA foreign_keys = ON</code>), and Write-Ahead Logging (WAL).
          </p>
          <p>
            • <strong className="text-foreground">Hosting Environment Disclosure:</strong> Users and reviewing authorities should note that in cloud serverless deployments, persistent state is preserved across database backups and connected database layers rather than transient frontend serverless containers.
          </p>
          <p>
            • <strong className="text-foreground">Cryptographic Safeguards:</strong> Password hashes use PBKDF2-SHA256. API authentication uses cryptographically signed JWT tokens with strict signature validation on all protected endpoints.
          </p>
        </div>
      </section>

      {/* ── 7. Access Control & Information Disclosure ── */}
      <section id="access-disclosure" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <UserCheck className="w-5 h-5" />
          <h2>7. Access Control & Information Disclosure</h2>
        </div>
        <p>
          Access to complaint information, personnel records, and audit logs is strictly partitioned using authoritative Role-Based Access Control:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground pl-2">
          <li><strong>Super Admins:</strong> Unrestricted national access across all bureaus, regional offices, and user account management.</li>
          <li><strong>Bureau Heads:</strong> Scoped strictly to cases belonging to their assigned bureau (e.g., Regulation Bureau or Public Grievance Cell).</li>
          <li><strong>Approval Officers:</strong> Scoped strictly to handling assigned complaints within their departmental cell.</li>
          <li><strong>Regional Nodal Officers:</strong> Scoped strictly to institutional matters within their geographic jurisdiction.</li>
          <li><strong>Citizens:</strong> Permitted to access only their own filed complaints and official status responses.</li>
        </ul>
        <p className="text-xs text-muted-foreground pt-1">
          We do not disclose personal information to external parties except when legally mandated by statutory authorities or regulatory courts under Indian law.
        </p>
      </section>

      {/* ── 8. Data Retention & Deletion Practices ── */}
      <section id="retention-deletion" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <RefreshCw className="w-5 h-5" />
          <h2>8. Data Retention & Deletion Practices</h2>
        </div>
        <p>
          Verified retention practices are implemented as follows:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground pl-2">
          <li><strong>Active Accounts:</strong> Account profiles and credentials persist in SQLite while the account is in an active status.</li>
          <li><strong>Account Deactivation & Deletion:</strong> Authorized Super Administrators can deactivate (status: inactive) or permanently delete personnel accounts via the Admin Portal (<code>/admin</code>). Deactivated accounts are immediately barred from JWT authentication.</li>
          <li><strong>Regulatory Complaint Records:</strong> Official complaint filings, case findings, and disposal orders are subject to statutory institutional archiving rules and may be retained for official audit and legal compliance.</li>
          <li><strong>Formal Retention Schedule:</strong> Final archiving schedules for non-active historical complaints are subject to formal confirmation by the governing institutional council.</li>
        </ul>
      </section>

      {/* ── 9. User Rights & Access Requests ── */}
      <section id="user-rights" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <UserCheck className="w-5 h-5" />
          <h2>9. Your Rights & Access Requests</h2>
        </div>
        <p>
          Subject to applicable legal obligations and institutional requirements, users have the right to:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground pl-2">
          <li>Access the personal information associated with their account profile.</li>
          <li>Request correction of inaccurate personal or institutional data.</li>
          <li>Request account deactivation or deletion of personal login accounts.</li>
          <li>Revoke Google OAuth authorizations at any time through Google Account Security.</li>
        </ul>
        <p className="text-xs text-muted-foreground pt-1">
          To submit a privacy or data access request, please contact the designated privacy email specified in Section 14.
        </p>
      </section>

      {/* ── 10. Cookies, Sessions & Local Storage ── */}
      <section id="cookies-sessions" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <Lock className="w-5 h-5" />
          <h2>10. Cookies, Sessions & Local Storage</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          VigilOS does not use third-party advertising or cross-site tracking cookies. We utilize browser <code>localStorage</code> solely for functional operations:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground pl-2">
          <li><code>aicte_token</code>: Stores your active authentication JWT to keep you logged in.</li>
          <li><code>aicte_user</code>: Stores user interface display preferences (name, role, jurisdiction).</li>
          <li><code>theme</code>: Persists your light/dark display theme selection.</li>
        </ul>
      </section>

      {/* ── 11. Minors & Children's Privacy ── */}
      <section id="children" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <AlertCircle className="w-5 h-5" />
          <h2>11. Minors & Children&rsquo;s Privacy</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          VigilOS is designed for technical education stakeholders, institutional administrators, university faculty, and enrolled students of post-secondary technical institutions. It is not intended for children under the age of 13, and we do not knowingly collect personal information from children under 13.
        </p>
      </section>

      {/* ── 12. Third-Party Services & Integrations ── */}
      <section id="third-parties" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <ExternalLink className="w-5 h-5" />
          <h2>12. Third-Party Integrations</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The following third-party infrastructure components are integrated into the application:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground pl-2">
          <li><strong>Google Identity Services:</strong> Provides OAuth 2.0 authentication. Governed by Google&rsquo;s Privacy Policy.</li>
          <li><strong>Vercel Inc.:</strong> Provides web hosting and CDN infrastructure for the frontend SPA.</li>
          <li><strong>Groq Inc. (API):</strong> Provides fast inference for AI-assisted grievance classification and overlap summarization. No personal credentials are sold or stored by the model provider.</li>
        </ul>
      </section>

      {/* ── 13. Policy Updates ── */}
      <section id="policy-changes" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <RefreshCw className="w-5 h-5" />
          <h2>13. Changes to this Policy</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          We may update this Privacy Policy periodically to reflect technological changes, regulatory requirements, or workflow adjustments. All revisions will be posted directly to this page with an updated &ldquo;Last Revised&rdquo; timestamp. We encourage users to check this page periodically.
        </p>
      </section>

      {/* ── 14. Contact Information & Confirmation Notice ── */}
      <section id="contact" className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg border-b border-border/30 pb-2">
          <FileText className="w-5 h-5" />
          <h2>14. Contact Information & Configuration Notice</h2>
        </div>
        <div className="p-4 rounded-xl bg-secondary/40 border border-border/40 space-y-2 text-xs">
          <p className="font-semibold text-foreground">Designated Privacy & Support Channels:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Contact & Privacy Inquiries: <a href="mailto:2204caleb2007@gmail.com" className="text-primary hover:underline font-mono">2204caleb2007@gmail.com</a></li>
            <li>• Technical & Administrative Desk: <a href="mailto:2204caleb2007@gmail.com" className="text-primary hover:underline font-mono">2204caleb2007@gmail.com</a></li>
            <li>• Online Helpdesk: <Link to="/help" className="text-primary hover:underline">VigilOS RO Directory & Support Desk</Link></li>
          </ul>
        </div>
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Deployment Configuration Requirement Notice:</span>
          </p>
          <p className="leading-relaxed opacity-90">
            AICTE VigilOS is an engineering implementation engineered for the Smart India Hackathon (PS26264). Formal institutional postal address, statutory legal representation, and council authorization are configuration items subject to confirmation by the deploying authority prior to institutional rollout.
          </p>
        </div>
      </section>
    </PublicLegalLayout>
  );
}
