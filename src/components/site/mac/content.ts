/* The text inside the windows. The two legal files list the real documents'
   section headings verbatim and point to the documents; a paraphrased policy
   would be a liability. */

export interface TextFile {
  key: string;
  /** The filename, as it appears under the icon and in the window title. */
  name: string;
  /** Kilobytes, for the window's status line. Real, from the text below. */
  lines: string[];
  /** Where the authoritative version lives, when the file is a summary. */
  source?: { label: string; href: string };
}

const GATOR_TEXT = [
  "Community dashboard",
  "",
  "Manage your Discord community's settings, messages, staff,",
  "applications, departments, and workflows in one place.",
  "",
  "Sign in with your Discord account, choose a linked server,",
  "and open the module you want to configure. Your permissions",
  "are checked by the connected bot for every request.",
  "",
  "Edits stay as drafts until you save them. Use Discard to",
  "return to the last saved version.",
  "",
];

const PRIVACY_TEXT = [
  "PRIVACY POLICY",
  "Sections",
  "",
  "  1.  Information We Collect",
  "  2.  How We Use Information",
  "  3.  Sharing and Service Providers",
  "  4.  Retention and Deletion",
  "  5.  Cookies and Authentication",
  "  6.  Security and International Processing",
  "  7.  Age Requirements",
  "  8.  Your Choices and Rights",
  "  9.  Policy Updates",
];

const TERMS_TEXT = [
  "TERMS OF SERVICE",
  "Sections",
  "",
  "  1.  Acceptance",
  "  2.  Eligibility",
  "  3.  Discord and Server Access",
  "  4.  Acceptable Use",
  "  5.  Your Content and Responsibilities",
  "  6.  Service Availability",
  "  7.  Ownership",
  "  8.  Suspension and Termination",
  "  9.  Disclaimers and Liability",
  " 10.  Changes and Contact",
];

export const GATOR_FILE: TextFile = {
  key: "gator",
  name: "Getting started.txt",
  lines: GATOR_TEXT,
};

export const LEGAL_FILES: TextFile[] = [
  {
    key: "privacy",
    name: "Privacy Policy.txt",
    lines: PRIVACY_TEXT,
    source: { label: "Open the full policy", href: "/privacy" },
  },
  {
    key: "terms",
    name: "Terms of Service.txt",
    lines: TERMS_TEXT,
    source: { label: "Open the full terms", href: "/terms" },
  },
];
