import candidatesData from './candidates.json';

// Use a separate constant for the array to avoid any ambiguity
const candidates = Array.isArray(candidatesData) ? candidatesData : (candidatesData.leaders || []);

export const partyColors = {
  TDP: "#fce903",
  YSRCP: "#00249c",
  JSP: "#e63946",
  BJP: "#f97316",
  INC: "#0ea5e9"
};

export const getDistrictData = (name) => {
  if (!name) return {};
  const cleanName = name.trim().toLowerCase();
  
  // High-precision matching logic
  const candidateFound = candidates.find(l => {
    const lCon = (l.constituency || "").toUpperCase();
    const target = name.toUpperCase();
    
    return lCon === target || 
           lCon.replace(/\(SC\)|\(ST\)/g, '').trim() === target ||
           target.replace(/\(SC\)|\(ST\)/g, '').trim() === lCon ||
           target.includes(lCon) || 
           lCon.includes(target);
  });

  if (candidateFound) {
    const party = candidateFound.party === "Janasena Party" ? "JSP" : candidateFound.party;
    return {
      id: candidateFound.id,
      name: candidateFound.constituency,
      population: "Constituency Wide",
      currentMla: candidateFound.name,
      party: party,
      pastMla: "Former representative records pending",
      partyChanges: 0,
      votersCount: "Verified Assembly Ledger",
      majorityVotes: 8500, // Placeholder
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateFound.name)}&background=${partyColors[party]?.replace('#', '') || 'cccccc'}&color=fff&size=128`
    };
  }

  // Fallback for unknown
  const parties = ["TDP", "YSRCP", "JSP"];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const deterministicParty = parties[hash % parties.length];

  return {
    name,
    population: "Approx 15 Lakhs",
    currentMla: "Sitting Representative",
    party: deterministicParty,
    pastMla: "Former Representative",
    partyChanges: hash % 5,
    votersCount: "Data Fetching...",
    majorityVotes: (hash * 10) % 50000 + 2000,
    image: `https://ui-avatars.com/api/?name=${encodeURIComponent("Sitting Rep")}&background=${partyColors[deterministicParty]?.replace('#', '') || 'cccccc'}&color=fff&size=128`
  };
};

export const mockDistricts = {}; // Deprecated in favor of real data

export const mockCandidates = [
  {
    id: 1,
    name: "N. Chandrababu Naidu",
    role: "Chief Minister",
    ministry: "General Administration",
    party: "TDP",
    dob: "20-Apr-1950",
    age: 74,
    birthplace: "Naravaripalle, Chittoor",
    experience: "45+ Years",
    education: "MA Economics (SV University)",
    locations: [
      { year: "1989-present", place: "Kuppam Constituency" },
      { year: "1978-1983", place: "Chandragiri Constituency" }
    ],
    criminalRecord: "Pending cases: 2 (Political agitation related)",
    image: "https://ui-avatars.com/api/?name=CN&background=fce903&color=000&size=150"
  },
  {
    id: 2,
    name: "Pawan Kalyan",
    role: "Deputy Chief Minister",
    ministry: "Panchayat Raj & Rural Development",
    party: "JSP",
    dob: "02-Sep-1971",
    age: 52,
    birthplace: "Bapatla",
    experience: "15 Years",
    education: "Undergraduate",
    locations: [
      { year: "2024-present", place: "Pithapuram Constituency" },
      { year: "2019", place: "Gajuwaka & Bhimavaram Constituencies" }
    ],
    criminalRecord: "None",
    image: "https://ui-avatars.com/api/?name=PK&background=e63946&color=fff&size=150"
  },
  {
    id: 3,
    name: "Nara Lokesh",
    role: "Minister",
    ministry: "IT, Electronics & Communications, HRD",
    party: "TDP",
    dob: "23-Jan-1983",
    age: 41,
    birthplace: "Hyderabad",
    experience: "10 Years",
    education: "MBA (Stanford University)",
    locations: [
      { year: "2024-present", place: "Mangalagiri Constituency" },
      { year: "2017-2023", place: "MLC (Local Bodies)" }
    ],
    criminalRecord: "Pending cases: 1 (Defamation)",
    image: "https://ui-avatars.com/api/?name=NL&background=fce903&color=000&size=150"
  },
  {
    id: 4,
    name: "Y.S. Jagan Mohan Reddy",
    role: "MLA & Party President",
    ministry: "Opposition Leader",
    party: "YSRCP",
    dob: "21-Dec-1972",
    age: 51,
    birthplace: "Jammalamadugu, Kadapa",
    experience: "15 Years",
    education: "B.Com",
    locations: [
      { year: "2014-present", place: "Pulivendula Constituency" },
      { year: "2009-2014", place: "Kadapa MP" }
    ],
    criminalRecord: "CBI / ED Disproportionate Assets Cases pending",
    image: "https://ui-avatars.com/api/?name=JR&background=00249c&color=fff&size=150"
  }
];

export const mockNews = [
  "Government announces comprehensive review of the Polavaram irrigation project.",
  "New skill development centers to be established in 13 districts as part of the IT initiative.",
  "Opposition leaders stage walkout during the latest assembly session over budget allocations.",
  "Heavy investments expected in the Amravati capital region from global consortiums.",
  "Local bodies elections discussed in the high-level committee meeting chaired by the CM."
];
