import type { ReactNode } from "react";
import {
  IconActivity,
  IconBan,
  IconBell,
  IconBolt,
  IconBroadcast,
  IconBuildingBroadcastTower,
  IconCalendarQuestion,
  IconClipboardList,
  IconClockHour4,
  IconConfetti,
  IconFileDescription,
  IconGavel,
  IconGift,
  IconHeartHandshake,
  IconHistory,
  IconHome,
  IconLink,
  IconMail,
  IconMessage2Bolt,
  IconMessageChatbot,
  IconMessageCircleQuestion,
  IconPackage,
  IconPalette,
  IconShieldLock,
  IconStars,
  IconTargetArrow,
  IconTerminal2,
  IconTicket,
  IconTrendingUp,
  IconUserOff,
  IconWaveSine,
  IconWorld,
} from "@tabler/icons-react";

export type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  moduleKey?: string;
  /**
   * The tab is never dimmed, whatever its module flag says: for pages without a
   * ModuleGate that work in full regardless. They keep `moduleKey` because the
   * Overview grid and the bot use it.
   */
  alwaysEnabled?: boolean;
};
export type NavGroup = { title: string | null; items: NavItem[] };

/** The dashboard's tabs, grouped as the rail and the phone dock show them. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { id: "overview", label: "Overview", icon: <IconHome size={16} /> },
      { id: "customization", label: "Customization", icon: <IconPalette size={16} /> },
      { id: "permissions", label: "Permissions", icon: <IconShieldLock size={16} /> },
      { id: "logging", label: "Logging", icon: <IconFileDescription size={16} /> },
      { id: "audit", label: "Audit Log", icon: <IconHistory size={16} /> },
    ],
  },
  {
    // Groups of four to six items.
    title: "Staff",
    items: [
      { id: "promotions", label: "Promotions", icon: <IconTrendingUp size={16} />, moduleKey: "promotions" },
      { id: "staff-feedback", label: "Staff Feedback", icon: <IconStars size={16} />, moduleKey: "Staff" },
      { id: "shifts", label: "Shifts", icon: <IconClockHour4 size={16} />, moduleKey: "Shifts" },
    ],
  },
  {
    // Records kept about a member, the time they are away, and whether they are
    // keeping up. Activity sits here beside Message Quota, since both answer
    // whether a member is meeting what was asked and read the same shift
    // records.
    title: "Moderation",
    items: [
      { id: "infractions", label: "Infractions", icon: <IconGavel size={16} />, moduleKey: "infractions" },
      { id: "punishments", label: "Player Punishments", icon: <IconBan size={16} />, moduleKey: "Punishments" },
      { id: "suspensions", label: "Suspensions", icon: <IconUserOff size={16} />, moduleKey: "suspensions" },
      { id: "loa", label: "Leave", icon: <IconWaveSine size={16} />, moduleKey: "LOA" },
      { id: "quota", label: "Message Quota", icon: <IconTargetArrow size={16} />, moduleKey: "Quota" },
      { id: "activity", label: "Activity", icon: <IconActivity size={16} />, moduleKey: "Activity" },
    ],
  },
  {
    // Every way a member asks for something and gets an answer.
    title: "Requests",
    items: [
      { id: "tickets", label: "Tickets", icon: <IconTicket size={16} />, moduleKey: "Tickets" },
      { id: "modmail", label: "Modmail", icon: <IconMail size={16} />, moduleKey: "Modmail" },
      { id: "suggestions", label: "Suggestions", icon: <IconMessageCircleQuestion size={16} />, moduleKey: "suggestions" },
      { id: "auto-response", label: "Auto Response", icon: <IconMessage2Bolt size={16} />, moduleKey: "Auto Responder" },
      { id: "ai", label: "Assistant", icon: <IconMessageChatbot size={16} />, moduleKey: "GatorAI" },
    ],
  },
  {
    // Things the server says on its own.
    title: "Community",
    items: [
      { id: "welcome", label: "Welcome", icon: <IconConfetti size={16} />, moduleKey: "Welcome" },
      { id: "daily-questions", label: "Daily Questions", icon: <IconCalendarQuestion size={16} />, moduleKey: "QOTD" },
      { id: "giveaways", label: "Giveaways", icon: <IconGift size={16} />, moduleKey: "Giveaways" },
      { id: "reminders", label: "Reminder", icon: <IconBell size={16} />, moduleKey: "Reminder" },
      { id: "connection-roles", label: "Connection Roles", icon: <IconLink size={16} />, moduleKey: "connectionroles" },
      { id: "partnerships", label: "Partnerships", icon: <IconHeartHandshake size={16} />, moduleKey: "Partnerships" },
      { id: "sessions", label: "Sessions", icon: <IconBroadcast size={16} />, moduleKey: "Sessions" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { id: "prc", label: "ERLC", icon: <IconBuildingBroadcastTower size={16} />, moduleKey: "PRC" },
      { id: "roblox", label: "Roblox", icon: <IconWorld size={16} /> },
    ],
  },
  {
    title: "Content",
    items: [
      { id: "custom-commands", label: "Commands & Templates", icon: <IconTerminal2 size={16} />, moduleKey: "customcommands" },
      { id: "resources", label: "Resources", icon: <IconClipboardList size={16} /> },
      { id: "workflows", label: "Workflows", icon: <IconBolt size={16} /> },
      { id: "packages", label: "Packages", icon: <IconPackage size={16} />, moduleKey: "Packages" },
    ],
  },
];
