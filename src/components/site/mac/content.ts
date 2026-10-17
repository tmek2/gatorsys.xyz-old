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
  "Gator",
  "",
  "Gator isn't new. It's a bot built on already made and",
  "perfected foundations: ERM and Birb. A huge shoutout to the",
  "developers at ERM and Birb for being the absolute best of",
  "the ERLC community and keeping their bots open-source. Gator",
  "would not have been possible without those amazing people.",
  "",
  "Development",
  "",
  "As of 9/14/2026, I'm rebuilding Gator, restyling every corner",
  "of the website, improving performance, and thinking of new",
  "components to make the user experience better and better.",
  "",
  "Don't judge it by the current look. The landing page is",
  "already impressive, but commands and server management are",
  "still catching up. I'm getting to those too. It takes a",
  "surprising amount of time to come up with original UI ideas.",
  "The images below will show how gatorsys.xyz has looked over",
  "the few months since it was created.",
  "",
  "[Images coming soon]",
  "",
  "Send your suggestions to @.tmek on Discord. I'll be happy to",
  "receive them.",
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
  name: "Explore Gator.txt",
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
