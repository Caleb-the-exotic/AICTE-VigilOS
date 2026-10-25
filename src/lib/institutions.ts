export interface InstitutionProfile {
  aicte_pid: string;
  institution_name: string;
  region: string;
  state: string;
  city: string;
  address: string;
  inst_type: string;
  approval_status: string;
  principal_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  established_year: number;
  total_faculty: number;
  total_students: number;
  images: string[];
}

export const DEFAULT_INSTITUTIONS: InstitutionProfile[] = [
  {
    aicte_pid: "1-109723481",
    institution_name: "Shri Ram Institute of Technology",
    region: "Northern",
    state: "Madhya Pradesh",
    city: "Jabalpur",
    address: "Near IT Park, Bargi Hills, Jabalpur, MP 482003",
    inst_type: "Private / Self-Financed",
    approval_status: "Notice Issued — Under Review",
    principal_name: "Dr. R.K. Saxena",
    contact_email: "director@sritgroup.net",
    contact_phone: "+91 761 4001000",
    website: "https://www.sritgroup.net",
    established_year: 2001,
    total_faculty: 142,
    total_students: 2180,
    images: [
      "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    aicte_pid: "1-376234110",
    institution_name: "Thakur College of Engineering & Technology",
    region: "Western",
    state: "Maharashtra",
    city: "Mumbai",
    address: "A-Block, Thakur Educational Campus, Shyamnarayan Thakur Marg, Kandivali (E), Mumbai 400101",
    inst_type: "Autonomous / Linguistic Minority",
    approval_status: "Active Approval (Audit Pending)",
    principal_name: "Dr. B.K. Mishra",
    contact_email: "tcet@thakureducation.org",
    contact_phone: "+91 22 6730 8000",
    website: "https://www.tcetmumbai.in",
    established_year: 2001,
    total_faculty: 185,
    total_students: 3120,
    images: [
      "https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    aicte_pid: "1-204561892",
    institution_name: "KL University (Koneru Lakshmaiah)",
    region: "Southern",
    state: "Andhra Pradesh",
    city: "Vaddeswaram",
    address: "Green Fields, Vaddeswaram, Guntur District, AP 522502",
    inst_type: "Deemed to be University",
    approval_status: "Show-Cause Notice (Anti-Ragging)",
    principal_name: "Dr. G.P.S. Varma",
    contact_email: "registrar@kluniversity.in",
    contact_phone: "+91 863 2399999",
    website: "https://www.kluniversity.in",
    established_year: 1980,
    total_faculty: 620,
    total_students: 9400,
    images: [
      "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    aicte_pid: "1-445871203",
    institution_name: "Kalinga Institute of Industrial Technology",
    region: "Eastern",
    state: "Odisha",
    city: "Bhubaneswar",
    address: "Patia, Bhubaneswar, Odisha 751024",
    inst_type: "Deemed to be University",
    approval_status: "Approved (EOA 2026-27)",
    principal_name: "Prof. Sasmita Samanta",
    contact_email: "info@kiit.ac.in",
    contact_phone: "+91 674 2725113",
    website: "https://kiit.ac.in",
    established_year: 1992,
    total_faculty: 1200,
    total_students: 28000,
    images: [
      "https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?auto=format&fit=crop&w=1000&q=80",
    ],
  },
  {
    aicte_pid: "1-512398067",
    institution_name: "SRM Institute of Science and Technology",
    region: "Southern",
    state: "Tamil Nadu",
    city: "Kattankulathur",
    address: "SRM Nagar, Kattankulathur, Chengalpattu District, TN 603203",
    inst_type: "Deemed to be University",
    approval_status: "Inquiry Ongoing (Faculty Affairs)",
    principal_name: "Dr. C. Muthamizhchelvan",
    contact_email: "registrar@srmist.edu.in",
    contact_phone: "+91 44 27417000",
    website: "https://www.srmist.edu.in",
    established_year: 1985,
    total_faculty: 1650,
    total_students: 42000,
    images: [
      "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1000&q=80",
    ],
  },
  {
    aicte_pid: "1-631047285",
    institution_name: "GLA University",
    region: "Northern",
    state: "Uttar Pradesh",
    city: "Mathura",
    address: "17km Stone, NH-2, Mathura-Delhi Road, Chaumuhan, Mathura, UP 281406",
    inst_type: "Private State University",
    approval_status: "Transferred to Regional Directorate",
    principal_name: "Prof. Phalguni Gupta",
    contact_email: "glauniversity@gla.ac.in",
    contact_phone: "+91 5662 250900",
    website: "https://www.gla.ac.in",
    established_year: 1998,
    total_faculty: 480,
    total_students: 12500,
    images: [
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1000&q=80",
    ],
  },
  {
    aicte_pid: "1-788234501",
    institution_name: "Amity University Rajasthan",
    region: "Northern",
    state: "Rajasthan",
    city: "Jaipur",
    address: "SP-1, Kant Kalwar, RIICO Industrial Area, NH-11C, Jaipur, Rajasthan 303002",
    inst_type: "Private University",
    approval_status: "Active (Academic Committee Review)",
    principal_name: "Prof. Amit Jain",
    contact_email: "admissions@jpr.amity.edu",
    contact_phone: "+91 1426 405555",
    website: "https://www.amity.edu/jaipur",
    established_year: 2008,
    total_faculty: 290,
    total_students: 4800,
    images: [
      "https://images.unsplash.com/photo-1568792923760-d70635a89fa9?auto=format&fit=crop&w=1000&q=80",
    ],
  },
  {
    aicte_pid: "1-923456789",
    institution_name: "Chandigarh University",
    region: "Northern",
    state: "Punjab",
    city: "Mohali",
    address: "NH-95, Chandigarh-Ludhiana Highway, Mohali, Punjab 140413",
    inst_type: "Private University",
    approval_status: "Faculty Cadre Notice",
    principal_name: "Dr. Manpreet Singh Manna",
    contact_email: "info@cumail.in",
    contact_phone: "+91 160 3051003",
    website: "https://www.cuchd.in",
    established_year: 2012,
    total_faculty: 890,
    total_students: 24000,
    images: [
      "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?auto=format&fit=crop&w=1000&q=80",
    ],
  },
];

const STORAGE_KEY = "aicte_institutions_profiles";

export function getStoredInstitutions(): InstitutionProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_INSTITUTIONS));
      return DEFAULT_INSTITUTIONS;
    }
    const parsed: InstitutionProfile[] = JSON.parse(raw);
    // Merge any missing default institutions
    let changed = false;
    for (const d of DEFAULT_INSTITUTIONS) {
      if (!parsed.some(p => p.aicte_pid === d.aicte_pid)) {
        parsed.push(d);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (err) {
    console.error("Error reading stored institutions:", err);
    return DEFAULT_INSTITUTIONS;
  }
}

export function saveInstitution(updated: InstitutionProfile): void {
  try {
    const list = getStoredInstitutions();
    const idx = list.findIndex(i => i.aicte_pid === updated.aicte_pid);
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    // Dispatch custom event for real-time reactivity across components
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aicte_institution_updated", { detail: updated }));
    }
  } catch (err) {
    console.error("Error saving institution:", err);
  }
}

export function deleteInstitution(pid: string): void {
  try {
    const list = getStoredInstitutions().filter(i => i.aicte_pid !== pid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aicte_institution_updated", { detail: { deletedPid: pid } }));
    }
  } catch (err) {
    console.error("Error deleting institution:", err);
  }
}

export function getInstitutionByPid(pid: string): InstitutionProfile {
  const list = getStoredInstitutions();
  const match = list.find(i => i.aicte_pid === pid);
  if (match) return match;
  return {
    aicte_pid: pid,
    institution_name: pid,
    region: "Central",
    state: "National",
    city: "HQ",
    address: "AICTE Accredited Campus",
    inst_type: "Technical Institute",
    approval_status: "Active",
    principal_name: "Principal Officer",
    contact_email: "contact@institute.edu.in",
    contact_phone: "+91 11 29581000",
    website: "https://www.aicte-india.org",
    established_year: 2010,
    total_faculty: 50,
    total_students: 800,
    images: [
      "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80",
    ],
  };
}
