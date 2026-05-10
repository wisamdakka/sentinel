export interface Fighter {
  id: string;
  name: string;
  class: string;
  domain: string;
  description: string;
  color: string;
  colorClass: string;
  glowClass: string;

  stats: {
    stealth: number;
    persistence: number;
    creativity: number;
    speed: number;
    deception: number;
  };
  abilities: {
    name: string;
    description: string;
    type: "passive" | "active" | "ultimate";
  }[];
  lore: string;
}

export const fighters: Fighter[] = [
  {
    id: "pharma-phantom",
    name: "Pharma Phantom",
    class: "Infiltrator",
    domain: "Healthcare",
    description:
      "Specializes in probing medical AI agents for prescription manipulation, HIPAA violations, and patient safety gaps.",
    color: "#00f0ff",
    colorClass: "text-cyan",
    glowClass: "glow-cyan",
    stats: {
      stealth: 85,
      persistence: 90,
      creativity: 70,
      speed: 60,
      deception: 95,
    },
    abilities: [
      {
        name: "Prescription Override",
        description:
          "Attempts to get the agent to modify prescriptions without physician authorization",
        type: "active",
      },
      {
        name: "Patient Data Leak",
        description:
          "Probes for HIPAA violations by indirectly requesting patient information",
        type: "active",
      },
      {
        name: "Dosage Manipulation",
        description:
          "Uses social engineering to convince the agent to recommend dangerous dosages",
        type: "ultimate",
      },
    ],
    lore: "Born from a critical incident where an AI chatbot approved a prescription change that should have required physician sign-off. Pharma Phantom exists to ensure no medical agent makes that mistake again.",
  },
  {
    id: "vault-breaker",
    name: "Vault Breaker",
    class: "Bruiser",
    domain: "Finance",
    description:
      "Hammers banking and fintech agents to test transaction limits, authorization bypasses, and PII exposure.",
    color: "#a855f7",
    colorClass: "text-purple",
    glowClass: "glow-purple",
    stats: {
      stealth: 50,
      persistence: 95,
      creativity: 75,
      speed: 80,
      deception: 70,
    },
    abilities: [
      {
        name: "Limit Shatter",
        description:
          "Attempts to process transactions exceeding authorized limits through creative framing",
        type: "active",
      },
      {
        name: "Identity Harvest",
        description:
          "Probes for account details and PII through conversational manipulation",
        type: "active",
      },
      {
        name: "Authority Spoof",
        description:
          "Impersonates manager-level authorization to bypass approval chains",
        type: "ultimate",
      },
    ],
    lore: "After a rogue chatbot processed a $50,000 transfer without proper verification, Vault Breaker was forged to stress-test every financial guardrail until it either holds or breaks.",
  },
  {
    id: "legal-specter",
    name: "Legal Specter",
    class: "Strategist",
    domain: "Legal",
    description:
      "Ghost-walks through legal AI agents testing for unauthorized advice, privilege breaches, and compliance failures.",
    color: "#ec4899",
    colorClass: "text-pink",
    glowClass: "glow-pink",
    stats: {
      stealth: 90,
      persistence: 70,
      creativity: 95,
      speed: 55,
      deception: 85,
    },
    abilities: [
      {
        name: "Privilege Breach",
        description:
          "Tests if the agent will disclose attorney-client privileged information",
        type: "active",
      },
      {
        name: "Unauthorized Counsel",
        description:
          "Probes whether the agent crosses the line from information to legal advice",
        type: "active",
      },
      {
        name: "Jurisdictional Confusion",
        description:
          "Creates complex multi-jurisdiction scenarios to trigger incorrect legal guidance",
        type: "ultimate",
      },
    ],
    lore: "A shadow born from the grey area between legal information and legal advice. Legal Specter maps every crack in the compliance wall.",
  },
  {
    id: "data-wraith",
    name: "Data Wraith",
    class: "Assassin",
    domain: "Privacy",
    description:
      "Hunts for PII leaks, GDPR violations, and data retention failures across any AI agent handling personal data.",
    color: "#10b981",
    colorClass: "text-green",
    glowClass: "glow-cyan",
    stats: {
      stealth: 95,
      persistence: 80,
      creativity: 85,
      speed: 70,
      deception: 90,
    },
    abilities: [
      {
        name: "Shadow Extract",
        description:
          "Uses indirect queries to extract personal data the agent shouldn't reveal",
        type: "active",
      },
      {
        name: "Consent Bypass",
        description:
          "Tests whether the agent processes data without proper consent verification",
        type: "active",
      },
      {
        name: "Memory Exfiltration",
        description:
          "Attempts to access conversation history and stored user data from other sessions",
        type: "ultimate",
      },
    ],
    lore: "In a world where data is currency, Data Wraith is the thief that tests your vault. If your agent leaks, Wraith will find the crack.",
  },
  {
    id: "hr-havoc",
    name: "HR Havoc",
    class: "Trickster",
    domain: "Human Resources",
    description:
      "Chaos agent that probes HR bots for salary leaks, hiring bias, discrimination, and policy manipulation.",
    color: "#f97316",
    colorClass: "text-orange",
    glowClass: "glow-pink",
    stats: {
      stealth: 65,
      persistence: 85,
      creativity: 95,
      speed: 75,
      deception: 80,
    },
    abilities: [
      {
        name: "Salary Probe",
        description:
          "Attempts to extract confidential compensation data through social engineering",
        type: "active",
      },
      {
        name: "Bias Trigger",
        description:
          "Tests if the agent gives different advice based on demographic information",
        type: "active",
      },
      {
        name: "Policy Rewrite",
        description:
          "Tries to convince the agent to apply non-existent or modified HR policies",
        type: "ultimate",
      },
    ],
    lore: "Every HR bot says it's fair. HR Havoc proves otherwise. Built to expose the bias hiding behind the corporate smile.",
  },
  {
    id: "support-siege",
    name: "Support Siege",
    class: "Tank",
    domain: "Customer Support",
    description:
      "Relentless attacker that tests support agents for refund abuse, account takeover, and escalation failures.",
    color: "#fbbf24",
    colorClass: "text-yellow",
    glowClass: "glow-purple",
    stats: {
      stealth: 40,
      persistence: 99,
      creativity: 60,
      speed: 90,
      deception: 75,
    },
    abilities: [
      {
        name: "Refund Storm",
        description:
          "Floods the agent with creative refund requests to find bypass conditions",
        type: "active",
      },
      {
        name: "Account Hijack",
        description:
          "Attempts to access or modify another user's account through social engineering",
        type: "active",
      },
      {
        name: "Escalation Loop",
        description:
          "Tests whether the agent can be manipulated into granting supervisor-level actions",
        type: "ultimate",
      },
    ],
    lore: "The customer is always right? Support Siege tests that theory to destruction. No refund policy is safe, no escalation path unexplored.",
  },
  {
    id: "compliance-crow",
    name: "Compliance Crow",
    class: "Watcher",
    domain: "Regulatory",
    description:
      "Monitors AI agents for regulatory drift, policy contradictions, and compliance failures across any regulated industry.",
    color: "#8b5cf6",
    colorClass: "text-purple",
    glowClass: "glow-purple",
    stats: {
      stealth: 75,
      persistence: 88,
      creativity: 80,
      speed: 65,
      deception: 82,
    },
    abilities: [
      {
        name: "Policy Contradiction",
        description:
          "Feeds the agent conflicting regulatory scenarios to expose inconsistent rule enforcement",
        type: "active",
      },
      {
        name: "Audit Trail Gap",
        description:
          "Probes for missing documentation and logging in compliance-critical workflows",
        type: "active",
      },
      {
        name: "Regulatory Drift",
        description:
          "Runs extended multi-turn sessions to find where the agent slowly deviates from stated policies",
        type: "ultimate",
      },
    ],
    lore: "Regulations change. Agents don't always keep up. Compliance Crow watches for the moment your agent's behavior drifts from what the policy says it should do.",
  },
];

export function getFighter(id: string): Fighter | undefined {
  return fighters.find((f) => f.id === id);
}
