// Single source of truth for registration choices. Mirrors hrms-target-industries.md.
// Stored on Organization as keys only, so renaming a label never touches data.

export type Sector = "PRIVATE" | "GOVERNMENT" | "NONPROFIT";

export type Segment = { key: string; name: string };
export type Category = { key: string; name: string; icon: string; sector: Sector; segments: Segment[] };

export const CATEGORIES: Category[] = [
  {
    key: "government", name: "Government & Public Sector", icon: "🏛️", sector: "GOVERNMENT",
    segments: [
      { key: "lgu", name: "LGU (municipality, city, province)" },
      { key: "barangay", name: "Barangay" },
      { key: "national-agency", name: "National agency, SUC or GOCC" },
      { key: "public-school", name: "Public school or DepEd unit" },
    ],
  },
  {
    key: "bpo-it", name: "BPO, IT & Services", icon: "💻", sector: "PRIVATE",
    segments: [
      { key: "bpo", name: "BPO / call center" },
      { key: "it-software", name: "IT or software company" },
      { key: "staffing", name: "Staffing or manpower agency" },
      { key: "freelance-platform", name: "Freelancer or contractor platform" },
    ],
  },
  {
    key: "retail-hospitality", name: "Retail, Hospitality & Food", icon: "🛍️", sector: "PRIVATE",
    segments: [
      { key: "retail", name: "Retail chain, mall or supermarket" },
      { key: "restaurant", name: "Restaurant or fast food" },
      { key: "hotel", name: "Hotel or resort" },
      { key: "franchise", name: "Convenience or franchise network" },
    ],
  },
  {
    key: "manufacturing", name: "Manufacturing & Industrial", icon: "🏭", sector: "PRIVATE",
    segments: [
      { key: "factory", name: "Factory or plant" },
      { key: "construction", name: "Construction firm" },
      { key: "agriculture", name: "Agriculture or plantation" },
      { key: "mining-energy", name: "Mining, energy or utilities" },
    ],
  },
  {
    key: "healthcare", name: "Healthcare", icon: "🏥", sector: "PRIVATE",
    segments: [
      { key: "hospital", name: "Hospital" },
      { key: "clinic", name: "Clinic or diagnostic center" },
      { key: "pharmacy", name: "Pharmacy or pharmacy chain" },
    ],
  },
  {
    key: "education", name: "Education", icon: "🎓", sector: "PRIVATE",
    segments: [
      { key: "private-school", name: "Private school or university" },
      { key: "training-center", name: "Training or review center" },
    ],
  },
  {
    key: "finance-professional", name: "Finance & Professional Services", icon: "💼", sector: "PRIVATE",
    segments: [
      { key: "bank-coop", name: "Bank, lending, microfinance or cooperative" },
      { key: "insurance", name: "Insurance or broker" },
      { key: "professional-firm", name: "Accounting, law, consulting or engineering firm" },
      { key: "real-estate", name: "Real estate or brokerage" },
    ],
  },
  {
    key: "logistics-security", name: "Logistics, Transport & Security", icon: "🚚", sector: "PRIVATE",
    segments: [
      { key: "logistics", name: "Logistics or delivery" },
      { key: "transport", name: "Transport (bus, shipping, airline)" },
      { key: "security-agency", name: "Security agency" },
      { key: "facility-services", name: "Janitorial or facility services" },
    ],
  },
  {
    key: "nonprofit", name: "Non-profit & Social Sector", icon: "🤝", sector: "NONPROFIT",
    segments: [
      { key: "ngo", name: "NGO or foundation" },
      { key: "community-org", name: "Religious or community organization" },
    ],
  },
  {
    key: "small-business", name: "Small Business & Startups", icon: "🚀", sector: "PRIVATE",
    segments: [
      { key: "sme", name: "SME" },
      { key: "startup", name: "Startup" },
    ],
  },
];

export const SIZES = [
  { key: "micro", name: "Under 20 employees" },
  { key: "small", name: "20 to 200 employees" },
  { key: "mid", name: "200 to 1,000 employees" },
  { key: "enterprise", name: "Over 1,000 employees" },
] as const;

// True only for a real category + segment pair and a known size.
export function isValidChoice(categoryKey: string, industryKey: string, sizeKey: string): boolean {
  const cat = CATEGORIES.find((c) => c.key === categoryKey);
  return !!cat && cat.segments.some((s) => s.key === industryKey) && SIZES.some((s) => s.key === sizeKey);
}

export const sectorOf = (categoryKey: string): Sector | undefined =>
  CATEGORIES.find((c) => c.key === categoryKey)?.sector;
