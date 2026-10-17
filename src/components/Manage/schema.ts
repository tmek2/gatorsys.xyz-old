import type { ChannelKind } from "./types";

/**
 * Declarative schema for the guild configuration editor. Every `path` is a real
 * dot-path in the bot's Mongo `Config` document, mirrored from the bot's
 * /config components. Do not add paths the bot does not read.
 */

export type FieldType =
  | "toggle"
  | "channel"
  | "channels"
  | "role"
  | "roles"
  | "emoji"
  | "color"
  | "text"
  | "secret"
  | "textarea"
  | "number"
  | "select"
  | "stringlist"
  | "buttons"
  | "punishmenttypes"
  | "rolequotas"
  | "departments"
  // A picker over this server's own forms. The stored value is the form's id,
  // which is a generated string nobody can read -- so it is never a text box.
  | "application"
  // A roles field whose *order* is the value. See RankLadderField.
  | "ladder";

export interface FieldDef {
  path: string;
  label: string;
  description?: string;
  type: FieldType;
  /** For toggles whose bot-side default is true. */
  defaultValue?: any;
  options?: { label: string; value: string; description?: string }[];
  channelTypes?: ChannelKind[];
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Store numbers as strings (some bot fields expect string digits). */
  asString?: boolean;
  /** Render a number field as a duration preset dropdown in this unit.
   *  The stored value stays a plain number in the same unit. */
  durationUnit?: "seconds" | "minutes" | "hours" | "days";
  /**
   * Tokens this field resolves, shown as a click-to-insert picker under a
   * textarea (instead of listing them in the description, where they drift).
   */
  variables?: string[];
  /**
   * Show this field only while another field holds one of these values. For
   * sibling fields where only some apply, which a truthiness test cannot
   * express: "Promotions system" picks OG / Single Hierarchy / Multi Hierarchy,
   * and only the matching ladder editor shows (writing to the other would
   * configure a system the guild is not running).
   */
  visibleWhen?: { path: string; equals: string[] };
  /**
   * Only meaningful while the switch at this path is on, for a field that
   * depends on a switch in the same group ("Rejoin enforcement window" under
   * "Reapply recent punishments on rejoin"). It rolls away while the switch is
   * off, and the health check ignores it then. The switch's own `defaultValue`
   * counts.
   */
  requires?: string;
}

export interface FieldGroup {
  title: string;
  description?: string;
  fields: FieldDef[];
  /**
   * A config path whose truthiness the whole group depends on (ER:LC's "Enable
   * advanced tools" gates seven groups). The group is drawn indented under the
   * switch and stepped back while it is off.
   */
  gatedBy?: string;
  /**
   * This group's first field is a master switch for the rest of it. Declared
   * rather than inferred: plenty of groups start with an unrelated toggle. Set
   * it only where the first field really governs the ones after it.
   */
  lead?: true;
  /**
   * A section heading drawn above this group, for a run of `lead` groups that
   * would otherwise have no heading (Game Logs' Join, Leave, Kill, Command).
   * Set on the first group of the run only.
   */
  heading?: { title: string; description?: string };
}

export interface MessageDesignDef {
  /** Customisation collection type. */
  type: string;
  title: string;
  hint: string;
  variables: string[];
  defaults: Record<string, any>;
  /** Preview-only substitution overrides (e.g. a positive promotion reason). */
  previewOverrides?: Record<string, string>;
}

export interface ConfigMessageDef {
  /** Config dot-path holding a {content, embed} message object. */
  path: string;
  title: string;
  hint: string;
  variables: string[];
  defaults: Record<string, any>;
  hideContent?: boolean;
  /** Preview-only substitution overrides (e.g. an LOA-appropriate reason). */
  previewOverrides?: Record<string, string>;
}

export interface ModuleSchema {
  /** Section id used in the URL. */
  id: string;
  label: string;
  /** Key inside Config.Modules that gates this module (undefined = core). */
  moduleKey?: string;
  description: string;
  groups: FieldGroup[];
  /** Optional customisable bot message edited inside this module. */
  message?: MessageDesignDef;
  /** Message objects stored directly in the Config document. */
  configMessages?: ConfigMessageDef[];
}

const webhookGroup = (root: string, moduleLabel: string): FieldGroup => ({
  title: "Webhook",
  description: `Send ${moduleLabel} messages through a webhook with a custom identity.`,
  /**
   * The bot reads the identity fields only while the webhook is on, so this
   * gates them for every module.
   */
  lead: true,
  fields: [
    {
      path: `${root}.Webhook.Enabled`,
      label: "Send as webhook",
      type: "toggle",
    },
    {
      path: `${root}.Webhook.Username`,
      label: "Webhook username",
      type: "text",
      placeholder: "Custom display name",
      maxLength: 80,
    },
    {
      path: `${root}.Webhook.Avatar`,
      label: "Webhook avatar URL",
      type: "text",
      placeholder: "https://…",
    },
  ],
});

export const CORE_SECTIONS: ModuleSchema[] = [
  {
    id: "logging",
    label: "Logging",
    description:
      "Where the bot writes down what it did.",
    groups: [
      {
        title: "Channels",
        fields: [
          {
            path: "Logging.channel_id",
            label: "Log channel",
            description: "One channel for everything the bot logs.",
            type: "channel",
          },
          {
            path: "Logging.critical_channel_id",
            label: "Critical alerts channel",
            description: "Urgent alerts go here.",
            type: "channel",
          },
          {
            path: "VerificationLogs.Channel",
            label: "Verification logs channel",
            type: "channel",
          },
        ],
      },
    ],
  },
];

export const MODULE_SECTIONS: ModuleSchema[] = [
  {
    id: "infractions",
    label: "Infractions",
    moduleKey: "infractions",
    description:
      "Warn or strike staff, with a log and approvals.",
    groups: [
      {
        title: "Channels",
        fields: [
          {
            path: "Infraction.channel",
            label: "Infraction channel",
            description: "Where issued infractions are announced.",
            type: "channel",
          },
          {
            path: "Infraction.LogChannel",
            label: "Infraction audit log",
            description: "Voids, edits, and approvals are logged here.",
            type: "channel",
          },
        ],
      },
      {
        title: "Discussion threads",
        description:
          "Open a thread under each infraction so staff can talk about it.",
        lead: true,
        fields: [
          {
            path: "Infraction.create_thread",
            label: "Create a thread for each infraction",
            description:
              "The bot needs permission to make threads there. If it can't, the infraction is still posted.",
            type: "toggle",
          },
          {
            path: "Infraction.thread_name",
            label: "Thread name",
            description:
              "Supports {case}, {staff.name}, and {action}. Discord thread names are limited to 100 characters.",
            type: "text",
            placeholder: "Case {case} · {staff.name}",
            maxLength: 100,
          },
        ],
      },
      {
        /* The appeal goes on the notice with the case already filled in, so a
           member does not have to find where to appeal or quote a case id from
           an old DM. */
        title: "Appeals",
        description:
          "Puts an appeal button on the DM a member gets, linking to a form with their case already filled in.",
        lead: true,
        fields: [
          {
            path: "Infraction.appeal_enabled",
            label: "Let members appeal from the DM",
            type: "toggle",
          },
          {
            path: "Infraction.appeal_form_id",
            label: "Appeal form",
            description:
              "The form knows which case is being appealed, so reviewers don't have to ask.",
            type: "application",
          },
          {
            path: "Infraction.appeal_button_label",
            label: "Button label",
            type: "text",
            placeholder: "Appeal this",
          },
        ],
      },
      {
        title: "Approval system",
        description:
          "Route infractions through an approval step before they apply.",
        fields: [
          {
            path: "Infraction.Approval.channel",
            label: "Approval channel",
            type: "channel",
          },
          {
            path: "Infraction.Approval.Ping",
            label: "Approval ping role",
            type: "role",
          },
        ],
      },
      {
        title: "Preset reasons",
        description:
          "Quick-select reasons offered when staff issue an infraction.",
        fields: [
          {
            path: "Infraction.reasons",
            label: "Reasons",
            type: "stringlist",
            placeholder: "e.g. Unprofessional conduct",
          },
        ],
      },
      {
        title: "Infraction types",
        description:
          "The kinds of infraction staff can pick. Each one can have its own actions, like role changes.",
        fields: [
          {
            path: "Infraction.types",
            label: "Types",
            type: "stringlist",
            placeholder: "e.g. Warning",
          },
        ],
      },
      {
        title: "Preferences",
        fields: [
          {
            path: "Module Options.infractedbybutton",
            label: "Issuer button",
            description:
              "Shows an “Issued by …” button under the infraction embed.",
            type: "toggle",
          },
          {
            path: "Module Options.onvoid",
            label: "Notify on void",
            description:
              "DM the staff member when their infraction is voided.",
            type: "toggle",
          },
          {
            path: "Module Options.showissuer",
            label: "Show issuer",
            description:
              "Display who issued the infraction on the embed.",
            type: "toggle",
            defaultValue: true,
          },
          {
            path: "Module Options.Direct Message",
            label: "Direct messages",
            description: "DM the infracted member a copy of the infraction.",
            type: "toggle",
            defaultValue: true,
          },
        ],
      },
      webhookGroup("Infraction", "infraction"),
    ],
    message: {
      type: "Infractions",
      title: "Infraction message",
      hint: "The message members see when a staff member is infracted.",
      // The rank pair is filled only when the infraction type demotes.
      variables: ["{staff.mention}", "{staff.name}", "{staff.avatar}", "{action}", "{reason}", "{notes}", "{case}", "{expiration}", "{newrank}", "{newrank.name}", "{oldrank}", "{oldrank.name}", "{guild.name}"],
      defaults: {
        embed: {
          title: "Staff Consequences & Discipline",
          description: "- **Staff Member:** {staff.mention}\n- **Action:** {action}\n- **Reason:** {reason}",
          color: "2b2d31",
          thumbnail: "{staff.avatar}",
        },
      },
    }
  },
  {
    id: "promotions",
    label: "Promotions",
    moduleKey: "promotions",
    description:
      "Promote and demote staff, and post who moved where.",
    groups: [
      {
        title: "Channels",
        fields: [
          {
            path: "Promo.channel",
            label: "Promotion channel",
            type: "channel",
          },
          {
            path: "Promo.LogChannel",
            label: "Promotion audit log",
            type: "channel",
          },
        ],
      },
      {
        title: "System",
        fields: [
          {
            path: "Promo.System.type",
            label: "Promotions system",
            description: "How ranks are set up in this server.",
            type: "select",
            options: [
              { label: "OG System", value: "og" },
              { label: "Single Hierarchy", value: "single" },
              { label: "Multi Hierarchy", value: "multi" },
            ],
          },
          {
            // Ordered, and the order is the ladder: promotion and demotion both
            // walk this list's order (not Discord's role positions).
            path: "Promo.System.single.Hierarchy",
            label: "Rank ladder",
            description:
              "Your ranks, lowest first. A promotion moves someone one rank up, and a demotion moves them one down.",
            type: "ladder",
            visibleWhen: { path: "Promo.System.type", equals: ["single"] },
          },
          {
            path: "Promo.System.multi.Departments",
            label: "Departments",
            description:
              "Each department has its own ranks, lowest first.",
            type: "departments",
            visibleWhen: { path: "Promo.System.type", equals: ["multi"] },
          },
          {
            path: "Promo.Cooldown",
            label: "Promotion cooldown",
            description: "How long before someone can be promoted again. 0 means no wait.",
            type: "number",
            asString: true,
            durationUnit: "days",
            min: 0,
          },
        ],
      },
      {
        title: "Approval system",
        fields: [
          {
            path: "Promo.Approval.channel",
            label: "Approval channel",
            type: "channel",
          },
          {
            path: "Promo.Approval.Ping",
            label: "Approval ping role",
            type: "role",
          },
        ],
      },
      {
        title: "Preferences",
        fields: [
          {
            path: "Module Options.autorole",
            label: "Auto role",
            description:
              "Automatically apply the new rank role on promotion.",
            type: "toggle",
            defaultValue: true,
          },
          {
            path: "Module Options.promotionissuer",
            label: "Issuer button display",
            type: "toggle",
          },
          {
            path: "Module Options.pshowissuer",
            label: "Show issuer",
            type: "toggle",
            defaultValue: true,
          },
        ],
      },
      webhookGroup("Promo", "promotion"),
    ],
    message: {
      type: "Promotions",
      title: "Promotion message",
      hint: "Sent when a staff member is promoted.",
      previewOverrides: {
        "{reason}": "Outstanding activity and consistently great calls",
        "{notes}": "Keep it up!",
      },
      // Includes the previous rank, so an announcement can describe the move.
      variables: ["{staff.mention}", "{staff.name}", "{staff.avatar}", "{newrank}", "{newrank.name}", "{oldrank}", "{oldrank.name}", "{previousrank}", "{previousrank.name}", "{reason}", "{notes}", "{manager.display_name}", "{guild.name}"],
      defaults: {
        embed: {
          title: "Staff Promotion",
          description: "- **Staff Member:** {staff.mention}\n- **Role:** {newrank}\n- **Reason:** {reason}",
          color: "2b2d31",
          thumbnail: "{staff.avatar}",
        },
      },
    }
  },
  {
    id: "quota",
    label: "Message Quota",
    moduleKey: "Quota",
    description: "Set how many messages staff have to send, and track it.",
    groups: [
      {
        title: "Quota",
        fields: [
          {
            path: "Message Quota.quota",
            label: "Default quota",
            description: "Messages each staff member has to send each period.",
            type: "number",
            min: 0,
          },
          {
            path: "Message Quota.Ignored Channels",
            label: "Ignored channels",
            description: "Messages here don't count toward quota.",
            type: "channels",
          },
        ],
      },
    ],
  },
  {
    id: "loa",
    label: "Leave",
    moduleKey: "LOA",
    // The config key stays "LOA": renaming it would disable the module for
    // every server that configured it. Leave covers both absence and reduced
    // activity, as one record with a type.
    description: "Staff ask for time off or reduced activity. You approve or deny it.",
    groups: [
      {
        title: "Channels & roles",
        fields: [
          {
            path: "LOA.channel",
            label: "LOA review channel",
            description: "Requests are posted here for approval.",
            type: "channel",
          },
          {
            path: "LOA.LogChannel",
            label: "LOA audit log",
            type: "channel",
          },
          {
            path: "LOA.role",
            label: "LOA member role",
            description: "Given to members while on leave.",
            type: "role",
          },
        ],
      },
    ],
    configMessages: [
      {
        path: "LOA.request_message",
        title: "LOA request message",
        hint: "The review message posted when someone requests a leave of absence.",
        previewOverrides: {
          "{reason}": "Family trip out of state",
          "{start_time}": "June 12",
          "{end_time}": "June 26",
        },
        variables: ["{staff.mention}", "{staff.name}", "{reason}", "{start_time}", "{end_time}", "{guild.name}"],
        defaults: {
          embed: {
            title: "Leave of Absence Request",
            description: "- **Staff Member:** {staff.mention}\n- **Reason:** {reason}\n- **Starts:** {start_time}\n- **Ends:** {end_time}",
            color: "2b2d31",
          },
        },
      },
    ],
  },
  {
    id: "tickets",
    label: "Tickets",
    moduleKey: "Tickets",
    description:
      "Support tickets: panels, claiming, and transcripts.",
    groups: [],
  },
  {
    id: "modmail",
    label: "Modmail",
    moduleKey: "Modmail",
    description: "Members DM the bot, you answer from a channel.",
    groups: [
      {
        title: "Routing",
        fields: [
          {
            path: "Modmail.category",
            label: "Modmail category",
            description: "New modmail channels are created here.",
            type: "channel",
            channelTypes: ["category"],
          },
          {
            path: "Modmail.transcripts",
            label: "Transcripts channel",
            type: "channel",
          },
          {
            path: "Modmail.ping",
            label: "Ping role",
            description: "Pinged when a new modmail arrives.",
            type: "role",
          },
        ],
      },
      {
        title: "Preferences",
        fields: [
          {
            path: "Module Options.automessage",
            label: "Auto message",
            description:
              "Automatically reply when a member opens a modmail.",
            type: "toggle",
          },
          {
            path: "Module Options.MessageFormatting",
            label: "Message formatting",
            type: "select",
            options: [
              { label: "Embeds", value: "Embeds" },
              { label: "Messages", value: "Messages" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "daily-questions",
    label: "Daily Questions",
    moduleKey: "QOTD",
    description: "Post a question every day.",
    groups: [webhookGroup("QOTD", "daily question")],
  },
  {
    id: "suggestions",
    label: "Suggestions",
    moduleKey: "suggestions",
    description: "Members post ideas and vote on them.",
    groups: [
      {
        title: "Channel",
        fields: [
          {
            path: "Suggestions.channel",
            label: "Suggestions channel",
            type: "channel",
          },
        ],
      },
      {
        title: "Preferences",
        fields: [
          {
            path: "Module Options.Suggestion Thread",
            label: "Suggestion thread",
            description:
              "Automatically create a discussion thread on each suggestion.",
            type: "toggle",
          },
        ],
      },
    ],
    message: {
      type: "Suggestion",
      title: "Suggestion message",
      hint: "Posted when a member submits a suggestion.",
      variables: ["{author.name}", "{author.mention}", "{author.avatar}", "{suggestion}", "{guild.name}"],
      defaults: {
        embed: {
          title: "New Suggestion",
          description: "{suggestion}",
          color: "2b2d31",
          author: { name: "{author.name}", icon_url: "{author.avatar}" },
        },
      },
    }
  },
  {
    id: "suspensions",
    label: "Suspensions",
    moduleKey: "suspensions",
    description: "Suspend a staff member and keep the record.",
    groups: [
      {
        title: "Channel",
        fields: [
          {
            path: "Suspension.channel",
            label: "Suspension channel",
            type: "channel",
          },
        ],
      },
    ],
    message: {
      type: "Suspension",
      title: "Suspension message",
      hint: "Sent when a staff member is suspended.",
      variables: ["{staff.mention}", "{staff.name}", "{staff.avatar}", "{reason}", "{end_time}", "{guild.name}"],
      defaults: {
        embed: {
          title: "Staff Suspension",
          description: "- **Staff Member:** {staff.mention}\n- **Reason:** {reason}\n- **Ends:** {end_time}",
          color: "2b2d31",
          thumbnail: "{staff.avatar}",
        },
      },
    }
  },
  {
    id: "staff-feedback",
    label: "Staff Feedback",
    moduleKey: "Staff",
    description: "Let members rate your staff.",
    groups: [
      {
        title: "Feedback",
        fields: [
          {
            path: "Feedback.channel",
            label: "Feedback channel",
            type: "channel",
          },
          {
            path: "Module Options.multiplefeedback",
            label: "Multiple feedback",
            description:
              "Allow members to leave feedback for the same staff member more than once.",
            type: "toggle",
          },
        ],
      },
    ],
    message: {
      type: "Feedback",
      title: "Feedback message",
      hint: "Posted when a member rates a staff member.",
      variables: ["{staff.mention}", "{staff.name}", "{author.name}", "{author.avatar}", "{rating}", "{feedback}", "{guild.name}"],
      defaults: {
        embed: {
          title: "Staff Feedback",
          description: "- **Staff Member:** {staff.mention}\n- **Rating:** {rating}\n- **Feedback:** {feedback}",
          color: "2b2d31",
        },
      },
    }
  },
  {
    id: "welcome",
    label: "Welcome",
    moduleKey: "Welcome",
    description: "Greet new members and hand them a role.",
    groups: [
      {
        title: "Delivery",
        fields: [
          {
            path: "Welcome.channel_id",
            label: "Welcome channel",
            type: "channel",
          },
          {
            path: "Welcome.roles",
            label: "Join roles",
            description: "Given to members when they join.",
            type: "roles",
          },
        ],
      },
    ],
    configMessages: [
      {
        path: "Welcome.message",
        title: "Welcome message",
        hint: "What new members see when they join.",
        variables: [
          "{member.mention}",
          "{member.name}",
          "{member.display}",
          "{member.avatar}",
          "{member.created.relative}",
          "{server.name}",
          "{server.members}",
          "{server.icon}",
          "{channel.mention}",
          "{channel.name}",
          "{time.relative}",
          "{newline}",
        ],
        defaults: {
          content: "Welcome {member.mention} to **{server.name}**!",
          embed: {},
          components: [],
          render_mode: "legacy",
          v2_layout: [],
          v2_color: "none",
        },
      },
    ],
  },
  {
    id: "reminders",
    label: "Reminder",
    moduleKey: "Reminder",
    description: "Send a message on a schedule.",
    configMessages: [
      {
        path: "Reminder.embed",
        title: "Reminder message design",
        hint: "The embed posted on every scheduled reminder.",
        variables: ["{guild.name}"],
        hideContent: true,
        defaults: { embed: { title: "Reminder", description: "Don't forget!", color: "2b2d31" } },
      },
    ],
    groups: [
      {
        /* Named for what it does, with a description, like every other
           lead-toggle group. */
        title: "Scheduled reminders",
        description:
          "Post a recurring message on a schedule. The embed above is what gets sent.",
        // The switch genuinely governs the channel and the schedule: with it
        // off, neither does anything.
        lead: true,
        fields: [
          {
            path: "Reminder.enabled",
            label: "Enabled",
            type: "toggle",
          },
          {
            path: "Reminder.channel",
            label: "Reminder channel",
            type: "channel",
          },
          {
            path: "Reminder.schedule",
            label: "Schedule",
            description:
              "When it sends. Write it plainly, like “every Monday at 09:00”, or as a cron expression.",
            type: "text",
            placeholder: "0 12 * * 1",
          },
        ],
      },
    ],
  },
  {
    id: "partnerships",
    label: "Partnerships",
    moduleKey: "Partnerships",
    description: "Post partner ads, and pick who is allowed to.",
    groups: [
      {
        title: "Channels & roles",
        fields: [
          {
            path: "Partnerships.paid_channel",
            label: "Paid ads channel",
            type: "channel",
          },
          {
            path: "Partnerships.free_channel",
            label: "Non-paid ads channel",
            type: "channel",
          },
          {
            path: "Partnerships.allowed_roles",
            label: "Allowed roles",
            description:
              "Roles that can post partner ads. Leave empty for Manage Server only.",
            type: "roles",
          },
        ],
      },
    ],
  },
  {
    id: "giveaways",
    label: "Giveaways",
    moduleKey: "Giveaways",
    description: "Run giveaways and draw the winners.",
    groups: [
      {
        title: "Permissions",
        fields: [
          {
            path: "Giveaways.create_role",
            label: "Creation role",
            description: "Members with this role can start giveaways.",
            type: "role",
          },
        ],
      },
      {
        title: "Buttons",
        description: "The join and participant-count buttons on giveaways.",
        fields: [
          { path: "Giveaways.buttons.join_label", label: "Join button label", type: "text", maxLength: 80, placeholder: "Enter" },
          { path: "Giveaways.buttons.join_emoji", label: "Join button emoji", type: "emoji", maxLength: 100 },
          { path: "Giveaways.buttons.participants_enabled", label: "Show participant count", type: "toggle" },
          { path: "Giveaways.buttons.participants_emoji", label: "Participants emoji", type: "emoji", maxLength: 100, requires: "Giveaways.buttons.participants_enabled" },
        ],
      },
    ],
    configMessages: [
      {
        path: "Giveaways.message",
        title: "Giveaway message",
        hint: "The message posted when a giveaway starts. Join and participant buttons are added automatically.",
        previewOverrides: {
          "{prize}": "1000 Robux",
          "{host}": "@Alternative",
          "{ends}": "in 24 hours",
          "{winners}": "2",
          "{entries}": "48",
          "{description}": "Good luck everyone!",
        },
        variables: [
          "{prize}",
          "{description}",
          "{winners}",
          "{host}",
          "{ends}",
          "{thumbnail}",
          "{entries}",
          "{required.group}",
          "{required.roles}",
          "{server.link}",
        ],
        defaults: {
          embed: {
            title: "🎉 Giveaway: {prize}",
            description: "{description}\n\nHosted by {host}\nEnds {ends}\nWinners: {winners}",
            color: "ffb3ab",
          },
        },
      },
    ],
  },
  {
    id: "packages",
    label: "Packages",
    moduleKey: "Packages",
    description: "Build packages members can claim.",
    groups: [
      {
        title: "Settings",
        fields: [
          {
            path: "Packages.create_role",
            label: "Create role",
            type: "role",
          },
          {
            path: "Packages.forum_channel",
            label: "Forum channel",
            type: "channel",
            channelTypes: ["forum"],
          },
          {
            path: "Packages.purchase_log_channel",
            label: "Purchase log channel",
            type: "channel",
          },
        ],
      },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    moduleKey: "Activity",
    description:
      "Who has been around lately: shifts, messages, quota, and leave.",
    groups: [
      {
        title: "Reports",
        description:
          "Who is in the reports, and where they're posted.",
        fields: [
          { path: "Activity.report_channel_id", label: "Report channel", type: "channel" },
          { path: "Activity.staff_role_ids", label: "Staff roles", type: "roles" },
          {
            path: "Activity.default_period_days",
            label: "Default report period",
            type: "number",
            durationUnit: "days",
            min: 1,
            max: 90,
            defaultValue: 7,
          },
        ],
      },
      {
        title: "Quota signals",
        description:
          "The shortest shift that counts, and what else goes in the report.",
        fields: [
          {
            path: "Activity.shift_quota_minutes",
            label: "Shift quota",
            type: "number",
            durationUnit: "minutes",
            min: 0,
          },
          {
            path: "Activity.include_message_quota",
            label: "Include message activity",
            description: "Show the member's tracked message count alongside their shift time.",
            type: "toggle",
            defaultValue: true,
          },
          {
            path: "Activity.exclude_active_leave",
            label: "Excuse active leave",
            description: "Show staff on approved leave apart from staff who missed quota.",
            type: "toggle",
            defaultValue: true,
          },
        ],
      },
    ],
  },
  {
    id: "shifts",
    label: "Shifts",
    moduleKey: "Shifts",
    description:
      "Staff clock in and out. You get the hours.",
    groups: [
      {
        title: "Shift roles",
        description:
          "Roles are applied automatically when a shift starts, pauses, resumes, or ends.",
        fields: [
          { path: "Shifts.on_duty_role_ids", label: "On-duty roles", type: "roles" },
          { path: "Shifts.break_role_ids", label: "Break roles", type: "roles" },
          {
            path: "Shifts.manager_role_ids",
            label: "Shift managers",
            description: "Can review another member's shift and activity.",
            type: "roles",
          },
        ],
      },
      {
        title: "Rules and records",
        fields: [
          { path: "Shifts.log_channel_id", label: "Shift log channel", type: "channel" },
          {
            path: "Shifts.max_active_staff",
            label: "Maximum active staff",
            description: "Use 0 for no limit.",
            type: "number",
            min: 0,
          },
          {
            path: "Shifts.default_quota_minutes",
            label: "Default shift quota",
            description: "Hours expected per period. /duty quota reports who met it.",
            type: "number",
            durationUnit: "minutes",
            min: 0,
          },
          {
            path: "Shifts.quota_role_ids",
            label: "Staff included in quotas",
            description:
              "Staff roles counted in /duty quota. Don't pick the on-duty role, because it's removed when a shift ends.",
            type: "roles",
          },
          {
            path: "Shifts.role_quotas",
            label: "Quotas by role",
            description:
              "Override the default for specific staff roles. If a member has several, their highest Discord role wins.",
            type: "rolequotas",
          },
          {
            path: "Shifts.quota_period_days",
            label: "Quota period",
            description:
              "How long each fixed quota period lasts. At the end, the bot posts the results in the shift log channel before starting a fresh period.",
            type: "number",
            durationUnit: "days",
            min: 1,
            max: 90,
            placeholder: "7",
          },
          {
            path: "Shifts.shift_types",
            label: "Shift types",
            description:
              "Named kinds of shift staff can pick when they clock in. Leave empty to let them type anything.",
            type: "stringlist",
            placeholder: "e.g. Patrol",
          },
        ],
      },
      {
        title: "Automatic ER:LC shifts",
        description:
          "Clock linked staff in when they join the connected ER:LC server and out when they leave.",
        lead: true,
        fields: [
          {
            path: "Shifts.auto_clock.enabled",
            label: "Automatically follow ER:LC presence",
            description: "Only linked members with one of the selected staff roles are affected.",
            type: "toggle",
          },
          {
            path: "Shifts.auto_clock.role_ids",
            label: "Eligible staff roles",
            description: "Required. Community members and other linked users are never clocked in.",
            type: "roles",
          },
          {
            path: "Shifts.auto_clock.start_on_join",
            label: "Start shift on join",
            type: "toggle",
            defaultValue: true,
          },
          {
            path: "Shifts.auto_clock.end_on_leave",
            label: "End shift on leave",
            type: "toggle",
            defaultValue: true,
          },
          {
            path: "Shifts.auto_clock.shift_type",
            label: "Automatic shift type",
            description: "Optional label saved on automatically created shifts.",
            type: "text",
            placeholder: "ER:LC Patrol",
          },
        ],
      },
      {
        /* Shows who is on duty in the sidebar, without running a command. */
        title: "On-duty counter",
        description:
          "Keeps a channel name in sync with how many staff are on. Pick a voice channel nobody can join and everyone can see.",
        lead: true,
        fields: [
          {
            path: "Shifts.counter_enabled",
            label: "Show the on-duty count in a channel name",
            type: "toggle",
          },
          {
            path: "Shifts.counter_channel_id",
            label: "Counter channel",
            description:
              "Updated every six minutes when the number changes. Discord limits how often a channel can be renamed.",
            type: "channel",
          },
          {
            path: "Shifts.counter_template",
            label: "Channel name",
            description:
              "{count} on duty, {break} on break, {total} for both. Example: On duty: {count}",
            type: "text",
            placeholder: "On duty: {count}",
          },
        ],
      },
    ],
  },
  {
    id: "punishments",
    label: "Player Punishments",
    moduleKey: "Punishments",
    description: "Warn, kick, and ban players in your ER:LC server.",
    groups: [
      {
        title: "Records and alerts",
        fields: [
          { path: "Punishments.log_channel_id", label: "Punishment log channel", description: "Everything about each punishment is logged here.", type: "channel" },
          { path: "Punishments.roleplay_language", label: "Use roleplay language", description: "Uses roleplay words in logs and alerts. Nothing else changes.", type: "toggle" },
          { path: "Punishments.dm_linked_members", label: "Notify linked Discord members", description: "DM the linked member when a punishment is issued.", type: "toggle", defaultValue: true },
          { path: "Punishments.auto_log_commands", label: "Automatically record in-game kicks and bans", description: "Kicks and bans done in game are saved as cases too.", type: "toggle", defaultValue: true },
          { path: "Punishments.rejoin_enforcement", label: "Reapply recent punishments on rejoin", description: "Stops a recently kicked player from immediately rejoining.", type: "toggle" },
          { path: "Punishments.rejoin_minutes", label: "Rejoin enforcement window", type: "number", durationUnit: "minutes", min: 1, requires: "Punishments.rejoin_enforcement" },
          { path: "Punishments.rejoin_action", label: "Action when they rejoin", type: "select", options: [{ label: "Kick again", value: "kick" }, { label: "Ban", value: "ban" }], requires: "Punishments.rejoin_enforcement" },
        ],
      },
      {
        title: "Custom punishment types",
        description: "Add server-specific actions alongside Warning, Kick, Temporary Ban, Ban, and BOLO.",
        fields: [
          { path: "Punishments.types", label: "Punishment types", description: "The in-game command it runs. Leave empty to only record it.", type: "punishmenttypes" },
        ],
      },
    ],
  },
  {
    id: "game-logs",
    label: "Game Logs",
    moduleKey: "Game Logs",
    description:
      "Send ER:LC joins, kills, and commands to Discord channels.",
    groups: [
      /* One card per log stream (join, leave, kill, command): each is a switch
         that rolls down its own channel and colour, so everything a stream
         needs is in one place. */
      {
        title: "Shared settings",
        description:
          "Used by every feed below that doesn't have its own channel.",
        fields: [
          { path: "Game Logs.all_channel_id", label: "Fallback channel", description: "Where a feed posts if it has no channel of its own.", type: "channel" },
          { path: "Game Logs.show_player_ids", label: "Show Roblox IDs", description: "Shows the Roblox ID beside the username.", type: "toggle", defaultValue: true },
          { path: "Game Logs.show_thumbnails", label: "Show player headshots", description: "Shows the player's Roblox headshot.", type: "toggle", defaultValue: true },
        ],
      },
      {
        heading: {
          title: "Live streams",
          description:
            "Live from your ER:LC server. Turn on the ones you want posted.",
        },
        title: "Join logs",
        description: "Posted when a player joins the server.",
        lead: true,
        fields: [
          { path: "Game Logs.show_joins", label: "Log joins", type: "toggle", defaultValue: true },
          { path: "Game Logs.join_channel_id", label: "Channel", description: "Leave empty to use the shared channel above.", type: "channel" },
          { path: "Game Logs.join_color", label: "Card colour", type: "color", defaultValue: "#57f287" },
        ],
      },
      {
        title: "Leave logs",
        description: "Posted when a player leaves the server.",
        lead: true,
        fields: [
          { path: "Game Logs.show_leaves", label: "Log leaves", type: "toggle", defaultValue: true },
          { path: "Game Logs.leave_channel_id", label: "Channel", description: "Empty posts leaves in the join channel.", type: "channel" },
          { path: "Game Logs.leave_color", label: "Card colour", type: "color", defaultValue: "#ed4245" },
        ],
      },
      {
        title: "Kill logs",
        description: "Posted when one player eliminates another.",
        lead: true,
        fields: [
          { path: "Game Logs.show_kills", label: "Log kills", type: "toggle", defaultValue: true },
          { path: "Game Logs.kill_channel_id", label: "Channel", description: "Leave empty to use the shared channel above.", type: "channel" },
          { path: "Game Logs.kill_color", label: "Card colour", type: "color", defaultValue: "#fee75c" },
        ],
      },
      {
        title: "Command logs",
        description: "Posted when a staff member runs an in-game command.",
        lead: true,
        fields: [
          { path: "Game Logs.show_commands", label: "Log commands", type: "toggle", defaultValue: true },
          { path: "Game Logs.command_channel_id", label: "Channel", description: "Leave empty to use the shared channel above.", type: "channel" },
          { path: "Game Logs.command_color", label: "Card colour", type: "color", defaultValue: "#5865f2" },
          { path: "Game Logs.hide_private_messages", label: "Hide private-message contents", description: "Keeps :pm targets and messages out of public logs.", type: "toggle", defaultValue: true },
        ],
      },
      {
        title: "Written by staff",
        description:
          "Posted by staff with /game. The game can't send these, so they only exist if someone logs them.",
        fields: [
          { path: "Game Logs.message_channel_id", label: "Announcement logs", description: "Where /game message posts.", type: "channel" },
          { path: "Game Logs.sts_channel_id", label: "STS logs", description: "Where /game sts posts.", type: "channel" },
          { path: "Game Logs.priority_channel_id", label: "Priority logs", description: "Where /game priority posts.", type: "channel" },
        ],
      },
      {
        title: "Staff requests",
        lead: true,
        description:
          "/staff request calls for backup from in game. The limits below stop it pinging too often, for an empty server, or when plenty of staff are already on.",
        fields: [
          { path: "Game Logs.staff_requests.enabled", label: "Allow staff requests", type: "toggle", defaultValue: false },
          { path: "Game Logs.staff_requests.channel_id", label: "Staff request channel", description: "Leave empty to use the shared game log channel.", type: "channel" },
          { path: "Game Logs.staff_requests.ping_role_id", label: "Role to ping", description: "Leave empty to post it without pinging anyone.", type: "role" },
          { path: "Game Logs.staff_requests.cooldown_seconds", label: "Cooldown (seconds)", description: "Per person. 0 disables the cooldown.", type: "number", defaultValue: 300 },
          { path: "Game Logs.staff_requests.min_staff", label: "Minimum staff on shift", description: "Minimum players already on. 0 disables it.", type: "number", defaultValue: 1 },
          { path: "Game Logs.staff_requests.max_staff", label: "Maximum staff on shift", description: "Maximum players already on. 0 disables it.", type: "number", defaultValue: 0 },
        ],
      },
    ],
  },
  {
    id: "prc",
    label: "ERLC",
    moduleKey: "PRC",
    description:
      "Your ER:LC server, run from Discord.",
    groups: [
      {
        title: "Connection",
        description:
          "Link your ER:LC server. Keys are kept on the bot and never shown here again.",
        fields: [
          {
            path: "Integrations.PRC.key",
            label: "PRC server key",
            description: "The API key from your ER:LC server settings.",
            type: "secret",
          },
          {
            path: "Integrations.PRC.join_key",
            label: "Join key",
            description: "Optional key used for quick-join links.",
            type: "secret",
          },
          {
            path: "Integrations.PRC.server_name",
            label: "Server name",
            description: "Display name for this ER:LC server.",
            type: "text",
          },
        ],
      },
      {
        title: "Alerts",
        fields: [
          {
            path: "Integrations.PRC.alert_channel_id",
            label: "Alert channel",
            type: "channel",
          },
        ],
      },
      {
        title: "Automations",
        fields: [
          { path: "Integrations.PRC.features.pulse_digest", label: "Pulse digest", description: "A regular summary of how the server is doing.", type: "toggle", defaultValue: true },
          { path: "Integrations.PRC.features.queue_surge", label: "Queue surge alerts", description: "Warns when the queue crosses your threshold.", type: "toggle", defaultValue: true },
          { path: "Integrations.PRC.features.staff_watch", label: "Staff coverage watch", description: "Warns when player count is high and staff coverage is low.", type: "toggle", defaultValue: true },
          { path: "Integrations.PRC.features.modcall_watch", label: "Mod call watch", description: "Highlights new in-game mod calls.", type: "toggle", defaultValue: true },
          { path: "Integrations.PRC.features.vehicle_watch", label: "Vehicle spike watch", description: "Optional alert for heavy spawned vehicle load.", type: "toggle" },
          { path: "Integrations.PRC.features.offline_watch", label: "Offline / API health", description: "Warns when the server goes offline.", type: "toggle", defaultValue: true },
        ],
      },
      {
        title: "Thresholds",
        fields: [
          { path: "Integrations.PRC.thresholds.queue", label: "Queue surge threshold", type: "number", min: 1 },
          { path: "Integrations.PRC.thresholds.min_players_for_staff", label: "Min players for staff watch", type: "number", min: 1 },
          { path: "Integrations.PRC.thresholds.min_staff", label: "Minimum staff", type: "number", min: 0 },
          { path: "Integrations.PRC.thresholds.vehicle_spike", label: "Vehicle spike threshold", type: "number", min: 1 },
          { path: "Integrations.PRC.thresholds.cooldown_minutes", label: "Alert cooldown (minutes)", type: "number", durationUnit: "minutes", min: 1 },
        ],
      },
      {
        title: "Advanced tools",
        description:
          "Things that run in the background while your server is live. Nothing below works until this is on.",
        fields: [
          { path: "Integrations.PRC.advanced.enabled", label: "Enable advanced tools", type: "toggle" },
        ],
      },
      {
        title: "Player welcome",
        gatedBy: "Integrations.PRC.advanced.enabled",
        lead: true,
        description: "Privately greet players as they enter the server.",
        fields: [
          { path: "Integrations.PRC.advanced.welcome.enabled", label: "Welcome new players", type: "toggle" },
          {
            path: "Integrations.PRC.advanced.welcome.message",
            label: "Welcome message",
            type: "textarea",
            placeholder: "Welcome to the server. Please review the rules before roleplaying.",
            maxLength: 800,
          },
        ],
      },
      {
        title: "Discord membership checks",
        gatedBy: "Integrations.PRC.advanced.enabled",
        lead: true,
        description:
          "Match joining players to linked Roblox accounts and alert staff when no Discord member is found.",
        fields: [
          { path: "Integrations.PRC.advanced.discord_checks.enabled", label: "Check linked accounts", type: "toggle" },
          { path: "Integrations.PRC.advanced.discord_checks.alert_channel_id", label: "Missing-link alerts", type: "channel" },
          {
            path: "Integrations.PRC.advanced.discord_checks.message",
            label: "Player instructions",
            type: "textarea",
            placeholder: "Please link your Roblox account and join our Discord server.",
            maxLength: 700,
          },
        ],
      },
      {
        title: "Live statistics",
        gatedBy: "Integrations.PRC.advanced.enabled",
        lead: true,
        description: "Keep a voice-channel name updated with current server figures.",
        fields: [
          { path: "Integrations.PRC.advanced.statistics.enabled", label: "Update a statistics channel", type: "toggle" },
          { path: "Integrations.PRC.advanced.statistics.channel_id", label: "Statistics channel", type: "channel", channelTypes: ["voice"] },
          {
            path: "Integrations.PRC.advanced.statistics.format",
            label: "Channel name format",
            type: "text",
            placeholder: "Players: {players}/{max_players}",
            maxLength: 100,
            variables: ["{players}", "{max_players}", "{queue}", "{staff}", "{admins}", "{mods}", "{vehicles}"],
          },
        ],
      },
      {
        /* Vehicles and liveries in one rule. ER:LC reports a spawned vehicle as
           a model and a livery (`Texture`). Each list narrows the rule and an
           empty one means "any": vehicles alone, liveries alone (on any
           vehicle), or both. Both empty matches nothing (a rule matching every
           car would DM every player). */
        title: "Vehicle & livery restrictions",
        gatedBy: "Integrations.PRC.advanced.enabled",
        lead: true,
        description:
          "Players need one of these Discord roles to use these vehicles or liveries.",
        fields: [
          { path: "Integrations.PRC.advanced.vehicle_restrictions.enabled", label: "Enforce vehicle roles", type: "toggle" },
          { path: "Integrations.PRC.advanced.vehicle_restrictions.role_ids", label: "Allowed roles", type: "roles" },
          { path: "Integrations.PRC.advanced.vehicle_restrictions.alert_channel_id", label: "Violation alerts", type: "channel" },
          { path: "Integrations.PRC.advanced.vehicle_restrictions.vehicles", label: "Restricted vehicles", description: "Empty restricts the livery on any vehicle.", type: "stringlist", placeholder: "e.g. Falcon Interceptor" },
          { path: "Integrations.PRC.advanced.vehicle_restrictions.liveries", label: "Restricted liveries", description: "The livery as ER:LC names it. Empty restricts every livery.", type: "stringlist", placeholder: "e.g. Unmarked" },
          { path: "Integrations.PRC.advanced.vehicle_restrictions.message", label: "Player warning", type: "textarea", placeholder: "You are not authorized to use that vehicle.", maxLength: 700 },
        ],
      },
      {
        title: "Team restrictions",
        gatedBy: "Integrations.PRC.advanced.enabled",
        lead: true,
        description:
          "Players need one of these Discord roles to join this team.",
        fields: [
          { path: "Integrations.PRC.advanced.team_restrictions.enabled", label: "Enforce team roles", type: "toggle" },
          { path: "Integrations.PRC.advanced.team_restrictions.team", label: "Protected team", type: "text", placeholder: "Police" },
          { path: "Integrations.PRC.advanced.team_restrictions.role_ids", label: "Allowed roles", type: "roles" },
          { path: "Integrations.PRC.advanced.team_restrictions.alert_channel_id", label: "Violation alerts", type: "channel" },
          { path: "Integrations.PRC.advanced.team_restrictions.message", label: "Player warning", type: "textarea", placeholder: "You do not have the Discord role required for this team.", maxLength: 700 },
        ],
      },
      {
        title: "Weather and time",
        // The first switch governs the rest: a location and two sync
        // switches are meaningless while syncing is off.
        lead: true,
        // Not gated: weather and time does not need the advanced-tools
        // connection.
        description:
          "Use a real location to keep ER:LC weather and time in step with local conditions.",
        fields: [
          { path: "Integrations.PRC.advanced.weather.enabled", label: "Sync local conditions", type: "toggle" },
          { path: "Integrations.PRC.advanced.weather.location", label: "Location", type: "text", placeholder: "Miami, Florida" },
          { path: "Integrations.PRC.advanced.weather.sync_weather", label: "Sync weather", type: "toggle", defaultValue: true },
          { path: "Integrations.PRC.advanced.weather.sync_time", label: "Sync time of day", type: "toggle", defaultValue: true },
        ],
      },
      {
        title: "Username moderation",
        gatedBy: "Integrations.PRC.advanced.enabled",
        lead: true,
        description: "Deals with players who use names like All or Others to mess with commands.",
        fields: [
          { path: "Integrations.PRC.advanced.username_moderation.enabled", label: "Moderate command-style usernames", type: "toggle" },
          { path: "Integrations.PRC.advanced.username_moderation.action", label: "Automatic action", type: "select", options: [{ label: "Kick", value: "kick" }, { label: "Ban", value: "ban" }] },
        ],
      },
    ],
  },
];

/**
 * What verifying does to a member beyond linking the account. Rendered inside
 * the Roblox section. Everything is off until set.
 */
export const VERIFICATION_FIELDS: FieldDef[] = [
  {
    path: "Verification.verified_role_ids",
    label: "Roles to grant",
    description:
      "Given when a member verifies. The usual setup is one role that unlocks the server.",
    type: "roles",
  },
  {
    path: "Verification.unverified_role_ids",
    label: "Roles to remove",
    description:
      "Taken away once they verify. For example, a holding role everyone starts with.",
    type: "roles",
  },
  {
    path: "Verification.set_nickname",
    label: "Rename to their Roblox name",
    description:
      "Best effort: Discord will not let the bot rename anyone above it, including the server owner.",
    type: "toggle",
    defaultValue: false,
  },
  {
    path: "Verification.nickname_format",
    label: "Nickname format",
    description:
      "Use {roblox} and {display}. Cut to Discord's 32 character limit.",
    type: "text",
    defaultValue: "{roblox}",
  },
];

export const MODULE_TOGGLES: {
  key: string;
  label: string;
  description: string;
  sectionId?: string;
  category: string;
}[] = [
  { key: "infractions", label: "Infractions", description: "Warn or strike staff, with a log and approvals.", sectionId: "infractions", category: "Moderation" },
  { key: "promotions", label: "Promotions", description: "Promote and demote staff, and post who moved where.", sectionId: "promotions", category: "Moderation" },
  { key: "suspensions", label: "Suspensions", description: "Suspend a staff member and keep the record.", sectionId: "suspensions", category: "Moderation" },
  { key: "LOA", label: "Leave", description: "Staff ask for time off or reduced activity. You approve or deny it.", sectionId: "loa", category: "Moderation" },
  { key: "Quota", label: "Message Quota", description: "Set how many messages staff have to send, and track it.", sectionId: "quota", category: "Moderation" },
  { key: "Punishments", label: "Player Punishments", description: "Warn, kick, and ban players in your ER:LC server.", sectionId: "punishments", category: "Moderation" },
  { key: "Staff", label: "Staff", description: "Your staff list, their records, and feedback about them.", sectionId: "staff-feedback", category: "Staff" },
  { key: "Activity", label: "Activity", description: "See who has been around lately and who has not.", sectionId: "activity", category: "Staff" },
  { key: "Shifts", label: "Shifts", description: "Staff clock in and out. You get the hours.", sectionId: "shifts", category: "Staff" },
  { key: "Tickets", label: "Tickets", description: "Support tickets: panels, claiming, and transcripts.", sectionId: "tickets", category: "Community" },
  { key: "Modmail", label: "Modmail", description: "Members DM the bot, you answer from a channel.", sectionId: "modmail", category: "Community" },
  { key: "suggestions", label: "Suggestions", description: "Members post ideas and vote on them.", sectionId: "suggestions", category: "Community" },
  { key: "QOTD", label: "Daily Questions", description: "Post a question every day.", sectionId: "daily-questions", category: "Community" },
  { key: "Welcome", label: "Welcome", description: "Greet new members and hand them a role.", sectionId: "welcome", category: "Community" },
  { key: "Auto Responder", label: "Auto Response", description: "Reply on its own when someone says a keyword.", sectionId: "auto-response", category: "Community" },
  { key: "connectionroles", label: "Connection Roles", description: "Give one role automatically to anyone with another.", sectionId: "connection-roles", category: "Community" },
  { key: "Giveaways", label: "Giveaways", description: "Run giveaways and draw the winners.", sectionId: "giveaways", category: "Community" },
  { key: "Reminder", label: "Reminder", description: "Send a message on a schedule.", sectionId: "reminders", category: "Community" },
  { key: "Partnerships", label: "Partnerships", description: "Post partner ads, and pick who is allowed to.", sectionId: "partnerships", category: "Community" },
  { key: "Packages", label: "Packages", description: "Build packages members can claim.", sectionId: "packages", category: "Community" },
  { key: "Forums", label: "Forums", description: "Forms people fill in, sent to the right channel.", category: "Community" },
  { key: "PRC", label: "ERLC", description: "Link your ER:LC server: alerts, the queue, and who is on.", sectionId: "prc", category: "Integrations" },
  { key: "Sessions", label: "Sessions", description: "Announce a session and let people join from the post.", category: "Community" },
  { key: "GatorAI", label: "GatorAI", description: "Answers questions in tickets and from /ask.", sectionId: "ai", category: "Integrations" },
  { key: "customcommands", label: "Commands & Templates", description: "Your own commands and saved messages.", sectionId: "custom-commands", category: "Content" },
];

/** Staff module aliases toggled together with "Staff" (mirrors the bot). */
export const STAFF_MODULE_ALIASES = [
  "Staff List",
  "Feedback",
  "Staff Database",
  "Command Staff Dashboard",
  "Activity Check",
  "Shift Planner",
];

export function findSection(id: string): ModuleSchema | undefined {
  return (
    CORE_SECTIONS.find((section) => section.id === id) ||
    MODULE_SECTIONS.find((section) => section.id === id)
  );
}

let fieldIndex: Map<string, FieldDef> | null = null;

/**
 * The schema's field at a config path, if any. The save prompt needs two facts
 * the config does not carry: what a field shows when nothing is saved (a switch
 * that defaults on), and whether a list's order matters (a ladder's does, a
 * role list's does not).
 */
export function fieldAt(path: string): FieldDef | undefined {
  if (!fieldIndex) {
    fieldIndex = new Map();
    for (const section of [...CORE_SECTIONS, ...MODULE_SECTIONS]) {
      for (const group of section.groups) {
        for (const field of group.fields) {
          if (!fieldIndex.has(field.path)) fieldIndex.set(field.path, field);
        }
      }
    }
  }
  return fieldIndex.get(path);
}
