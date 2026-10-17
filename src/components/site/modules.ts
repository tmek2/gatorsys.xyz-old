/* What Gator does: the module list, taken from MODULE_TOGGLES in the dashboard
   schema (the list the dashboard itself runs on). Each group has one accent;
   the folders on the wall pick their own hues. */

export interface Feature {
  key: string;
  name: string;
  /** One line, from the dashboard's own description of the toggle. */
  purpose: string;
}

export interface ModuleGroup {
  slug: string;
  name: string;
  accent: string;
  features: Feature[];
}

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    slug: "moderation",
    name: "Moderation",
    accent: "#d98b93",
    features: [
      {
        key: "infractions",
        name: "Infractions",
        purpose: "Case actions, logs, approvals, and custom messages.",
      },
      {
        key: "promotions",
        name: "Promotions",
        purpose: "Rank changes, hierarchy routing, logs, and messages.",
      },
      {
        key: "suspensions",
        name: "Suspensions",
        purpose: "Suspension messages, channels, and staff records.",
      },
      {
        key: "loa",
        name: "Leave",
        purpose:
          "Absence and reduced-activity requests, approvals, roles, and channels.",
      },
      {
        key: "quota",
        name: "Message Quota",
        purpose: "Staff activity quotas and message tracking.",
      },
      {
        key: "punishments",
        name: "Player Punishments",
        purpose:
          "ER:LC warnings, kicks, bans, temporary bans, BOLOs, and case history.",
      },
    ],
  },
  {
    slug: "staff",
    name: "Staff",
    accent: "#b3a8dd",
    features: [
      {
        key: "staff",
        name: "Staff",
        purpose:
          "Staff list, panel, feedback, operations, wellness, activity, and shifts.",
      },
      {
        key: "activity",
        name: "Activity",
        purpose:
          "Staff reports combining shifts, messages, quota progress, and active leave.",
      },
      {
        key: "shifts",
        name: "Shifts",
        purpose: "Clock-in, break, status, history, and duty-time leaderboards.",
      },
    ],
  },
  {
    slug: "community",
    name: "Community",
    accent: "#9ec48f",
    features: [
      {
        key: "tickets",
        name: "Tickets",
        purpose: "Panels, questions, transcripts, claims, and AI.",
      },
      {
        key: "modmail",
        name: "Modmail",
        purpose: "DM support inbox, snippets, logs, and blacklist.",
      },
      {
        key: "sessions",
        name: "Sessions",
        purpose: "Session messages, panel, buttons, and permissions.",
      },
      {
        key: "suggestions",
        name: "Suggestions",
        purpose: "Suggestion channels, voting, threads, and statuses.",
      },
      {
        key: "qotd",
        name: "Daily Questions",
        purpose: "QOTD channel, pings, webhook, and post defaults.",
      },
      {
        key: "welcome",
        name: "Welcome",
        purpose: "Welcome messages, roles, embeds, and channels.",
      },
      {
        key: "auto_responder",
        name: "Auto Response",
        purpose: "Keyword replies and automatic response rules.",
      },
      {
        key: "connectionroles",
        name: "Connection Roles",
        purpose: "Link roles so one role automatically grants another.",
      },
      {
        key: "giveaways",
        name: "Giveaways",
        purpose: "Giveaway permissions and default embeds.",
      },
      {
        key: "reminder",
        name: "Reminder",
        purpose: "Scheduled reminder messages and delivery channels.",
      },
      {
        key: "partnerships",
        name: "Partnerships",
        purpose: "Partnership channels and permitted roles.",
      },
      {
        key: "packages",
        name: "Packages",
        purpose: "Package creation, publish channels, and claim permissions.",
      },
      {
        key: "forums",
        name: "Forums",
        purpose: "Forum forms, buttons, and routed submissions.",
      },
    ],
  },
  {
    slug: "integrations",
    name: "Integrations",
    accent: "#7fc9bd",
    features: [
      {
        key: "prc",
        name: "ERLC",
        purpose: "ER:LC alerts, staffing, queues, vehicles, and server health.",
      },
      {
        key: "department",
        name: "Department",
        purpose: "Real department profiles, rosters, shouts, resources.",
      },
      {
        key: "gatorai",
        name: "GatorAI",
        purpose: "The assistant: ticket answers, replies, and the /ask command.",
      },
    ],
  },
  {
    slug: "content",
    name: "Content",
    accent: "#dcb271",
    features: [
      {
        key: "customcommands",
        name: "Commands & Templates",
        purpose:
          "Slash and text commands, reusable message templates, packs, and containers.",
      },
    ],
  },
];

export const MODULE_COUNT = MODULE_GROUPS.reduce(
  (n, g) => n + g.features.length,
  0,
);

/** Every module, flat, each still knowing which group it came from. */
export interface FlatModule extends Feature {
  slug: string;
  group: string;
  accent: string;
}

export const MODULES: FlatModule[] = MODULE_GROUPS.flatMap((g) =>
  g.features.map((f) => ({
    ...f,
    slug: g.slug,
    group: g.name,
    accent: g.accent,
  })),
);

export const MODULE_BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

/* ── the folders ── */

/* The ten modules on the wall: what Gator does that a typical server bot does
   not. The other sixteen are listed in the drawer under it. Each folder has its
   own hue. */
export interface Folder {
  key: string;
  /** The folder's label, short enough to sit under it on one line. */
  label: string;
  /** The face of the folder, and the accent inside its sheet. */
  hue: string;
  /** One sentence for the top of the sheet. */
  pitch: string;
  /** What the job looks like when nothing is doing it for you. */
  without: string;
  /** And what it looks like when this is. */
  with: string;
  /* The module explained in plain words, once, under the before/after picture
     (the labels above caption the picture's halves for anyone who cannot see
     it). */
  /** The module, explained to somebody who has never run a server. */
  explain: string;
  /** Three things you get. */
  points: string[];
}

export const FOLDERS: Folder[] = [
  {
    key: "sessions",
    label: "Sessions",
    hue: "#e0603f",
    pitch: "Start a session from a panel, not from a pinned message.",
    without:
      "A ping, a pinned message, and four people asking whether it has started.",
    with: "One panel in one channel, with the buttons on it and the count on it.",
    points: [
      "Session messages and the panel they live on",
      "Buttons that do the joining, so nobody has to be told twice",
      "Permissions, so not everyone can open one",
    ],
    explain:
      "Everyone finds out at the same time, in the same place. You post " +
      "the panel once, it keeps its own count, and people join by " +
      "pressing a button instead of asking whether it has started yet.",
  },
  {
    key: "punishments",
    label: "Punishments",
    hue: "#c8506a",
    pitch:
      "Warnings, kicks and bans against a Roblox player, kept where you can find them again.",
    without:
      "A ban handed out in-game and forgotten. Nobody knows it happened, including the next person to ban them.",
    with:
      "A case history you can search, so the third offence looks like a third offence.",
    points: [
      "Warnings, kicks, bans and temporary bans",
      "BOLOs for the players you want flagged on sight",
      "Case history that survives the staff who wrote it",
    ],
    explain:
      "Every warning, kick and ban lands in one history you can search. " +
      "So when a name comes round again you already know the story. So " +
      "does whoever takes over after you.",
  },
  {
    key: "infractions",
    label: "Infractions",
    hue: "#d9536f",
    pitch: "Staff discipline that goes through somebody before it lands.",
    without: "A warning in a DM. No log, no approval, no way to show it later.",
    with:
      "A case, an approver, and a line in the log that is still readable in six months.",
    points: [
      "Case actions, filed and logged where you say",
      "Approvals, so one person cannot warn on a whim",
      "Custom messages, so it reads like your server and not like a bot",
    ],
    explain:
      "A second pair of eyes before anything sticks. Discipline gets " +
      "written down, looked at by someone senior, and only then applied, " +
      "so a shift never ends in an argument about what actually happened.",
  },
  {
    key: "promotions",
    label: "Promotions",
    hue: "#a970d8",
    pitch: "Move someone up a rank. Let the roles and the log follow.",
    without:
      "Somebody remembering the roles, then the log, then the announcement. Usually two out of three.",
    with: "One command. The hierarchy sorts out the rest.",
    points: [
      "Rank changes routed through the hierarchy you set up",
      "Logs, so the history is somewhere other than in chat",
      "Messages you write once",
    ],
    explain:
      "Move somebody up and everything else keeps up with you. The roles " +
      "change, the log writes itself, and the person actually gets told. " +
      "One action instead of four.",
  },
  {
    key: "shifts",
    label: "Shifts",
    hue: "#5aa85f",
    pitch: "Staff clock in and out. You get the hours without asking for them.",
    without: "Guessing. Or a spreadsheet somebody stopped updating in March.",
    with: "Duty time counted while it happens, and a leaderboard of it.",
    points: [
      "Clock in, take a break, clock out",
      "Status and history per member",
      "Duty-time leaderboards, for whoever cares about being top",
    ],
    explain:
      "Staff clock themselves in and out, and the hours arrive on their " +
      "own. Nothing to chase, nobody to remind, and a straight answer " +
      "when you want to know who has really been showing up.",
  },
  {
    key: "loa",
    label: "Leave",
    hue: "#6f7fe0",
    pitch: "Leave requests that do not scroll away.",
    without:
      "A message in staff chat at two in the morning, and a role nobody takes back off.",
    with: "A request, an approval, a role, and the role coming off on its own.",
    points: [
      "Absence and reduced-activity requests",
      "Approvals, in a channel meant for them",
      "Roles applied and removed without anyone remembering to",
    ],
    explain:
      "Somebody is away for a fortnight and the whole team can see it. " +
      "Requests are approved in a click and stay in view until they are " +
      "over, instead of scrolling out of sight by Tuesday.",
  },
  {
    key: "department",
    label: "Departments",
    hue: "#3fa9a0",
    pitch: "The divisions you already run, as real things the bot knows about.",
    without:
      "A category of channels, a handful of roles, and a Google Doc that says who is in charge of what.",
    with: "A profile per department, with its own roster and its own noticeboard.",
    points: [
      "Department profiles, each with a roster you can look at",
      "Shouts, so a division can reach its own people",
      "Resources kept with the department rather than in a pinned message",
    ],
    explain:
      "The divisions you already run, made real. Each one gets its own " +
      "roster, its own channels and its own people in charge, so the bot " +
      "knows the difference between fire and patrol.",
  },
  {
    key: "tickets",
    label: "Tickets",
    hue: "#4b93d6",
    pitch: "A queue, with the conversation kept after it closes.",
    without: "DMs to whoever is online. No record, no handover, no second opinion.",
    with: "A panel, a claim, and a transcript that is still there next month.",
    points: [
      "Panels and the questions asked before a ticket opens",
      "Claims, so two people do not answer the same person",
      "Transcripts, and optional AI on the first reply",
    ],
    explain:
      "A proper queue instead of a pile of direct messages. It opens " +
      "where the team can see it, closes when it is done, and keeps the " +
      "whole conversation afterwards.",
  },
  {
    key: "gatorai",
    label: "GatorAI",
    hue: "#c07fbd",
    pitch: "Optional. It answers the easy half and hands you the rest.",
    without: "The same six questions, typed out by hand, every single day.",
    with: "A first reply that is already there when the person finishes typing.",
    points: [
      "Answers inside a ticket, in your server's voice",
      "Replies drafted for staff rather than sent over their heads",
      "An /ask command for everyone else",
    ],
    explain:
      "It takes the questions you have answered a hundred times and " +
      "leaves you the ones worth your attention. Entirely optional, and " +
      "it hands over anything it is not sure about.",
  },
  {
    key: "prc",
    label: "ERLC",
    hue: "#3fb3c9",
    pitch: "The game server, in Discord, without alt-tabbing to check.",
    without: "Joining the server to find out how many people are in it.",
    with: "Staffing, queue and health on a channel you already have open.",
    points: [
      "Alerts when the server needs somebody in it",
      "Queue and staffing counts, live",
      "Vehicles and server health, without asking in chat",
    ],
    explain:
      "The game server, on the same screen as everything else. Who is on, " +
      "what is happening and what needs doing, without alt-tabbing to " +
      "find out.",
  },
];

export const FOLDER_KEYS = new Set(FOLDERS.map((f) => f.key));

/** The other sixteen, still named, in a drawer under the wall. */
export const REST = MODULES.filter((m) => !FOLDER_KEYS.has(m.key));
