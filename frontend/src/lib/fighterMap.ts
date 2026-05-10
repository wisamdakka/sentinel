import { fighters, getFighter, type Fighter } from "./fighters";

// Wisam's backend verticals → our fighters.
// The four verticals added in the feat/raids-endpoint PR (legal, hr,
// privacy, compliance) are clean matches; the rest are loose assignments
// so every session still renders a card.
const BUSINESS_TO_FIGHTER: Record<string, string> = {
  healthcare: "pharma-phantom",
  fintech: "vault-breaker",
  legal: "legal-specter",
  hr: "hr-havoc",
  privacy: "data-wraith",
  compliance: "compliance-crow",
  ecommerce: "support-siege",
  saas: "data-wraith",
  social: "hr-havoc",
  research: "legal-specter",
  education: "compliance-crow",
  logistics: "vault-breaker",
};

export const BUSINESS_TYPES: {
  id: string;
  label: string;
  description: string;
}[] = [
  { id: "healthcare", label: "healthcare", description: "phi, hipaa, prescriptions" },
  { id: "fintech", label: "fintech", description: "transactions, kyc, balances" },
  { id: "legal", label: "legal", description: "privilege, conflicts, discovery" },
  { id: "hr", label: "human resources", description: "salary, bias, terminations" },
  { id: "privacy", label: "privacy", description: "pii, gdpr, consent" },
  { id: "compliance", label: "compliance", description: "audits, sox, sanctions" },
  { id: "ecommerce", label: "ecommerce", description: "refunds, pricing, fraud" },
  { id: "saas", label: "saas", description: "tenancy, admin, rate limits" },
  { id: "social", label: "social", description: "dms, moderation, verification" },
  { id: "research", label: "research", description: "datasets, methodology, irb" },
  { id: "education", label: "education", description: "grades, ferpa, transcripts" },
  { id: "logistics", label: "logistics", description: "routes, vendors, inventory" },
];

export function fighterForBusiness(
  businessType: string | null | undefined
): Fighter {
  if (businessType) {
    const id = BUSINESS_TO_FIGHTER[businessType.toLowerCase()];
    const f = id ? getFighter(id) : undefined;
    if (f) return f;
  }
  return fighters[0];
}
