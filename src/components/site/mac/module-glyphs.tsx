/* One Tabler icon per module (the set used across the site), so tiles are told
   apart by shape, not only colour. `stroke` is a prop because a glyph in a 76px
   tile and in a 32px row needs different weights to look the same. */

import type { Icon, IconProps } from "@tabler/icons-react";
import {
  IconBell,
  IconBroadcast,
  IconBulb,
  IconCalendarOff,
  IconCar,
  IconChartBar,
  IconChevronsUp,
  IconClockHour4,
  IconDoorEnter,
  IconFileAlert,
  IconGavel,
  IconGift,
  IconHeartHandshake,
  IconHelpCircle,
  IconLayoutGrid,
  IconLink,
  IconMail,
  IconMessageBolt,
  IconMessages,
  IconPackage,
  IconSitemap,
  IconSparkles,
  IconTargetArrow,
  IconTerminal2,
  IconTicket,
  IconUserOff,
  IconUsers,
} from "@tabler/icons-react";

/* Sessions: a broadcast panel. Punishments: filed against a player.
   Infractions: the case on record. Promotions: moving up. Shifts: counted
   hours. Leave: days away. Departments: a server inside a server. Tickets: the
   queue. Assistant: it writes for you. ER:LC: the game it all connects to. */
const BY_KEY: Record<string, Icon> = {
  sessions: IconBroadcast,
  punishments: IconGavel,
  infractions: IconFileAlert,
  promotions: IconChevronsUp,
  shifts: IconClockHour4,
  loa: IconCalendarOff,
  leave: IconCalendarOff,
  department: IconSitemap,
  departments: IconSitemap,
  tickets: IconTicket,
  gatorai: IconSparkles,
  prc: IconCar,
  erlc: IconCar,

  /* Glyphs for the sixteen modules in the drawer. */
  suspensions: IconUserOff,
  quota: IconTargetArrow,
  staff: IconUsers,
  activity: IconChartBar,
  modmail: IconMail,
  suggestions: IconBulb,
  qotd: IconHelpCircle,
  welcome: IconDoorEnter,
  auto_responder: IconMessageBolt,
  connectionroles: IconLink,
  giveaways: IconGift,
  reminder: IconBell,
  partnerships: IconHeartHandshake,
  packages: IconPackage,
  forums: IconMessages,
  customcommands: IconTerminal2,
};

/** The glyph for a module key, or four panes when it has none. */
export function ModuleGlyph({
  moduleKey,
  size = 24,
  weight = 1.85,
  ...rest
}: Omit<IconProps, "stroke"> & { moduleKey: string; weight?: number }) {
  const Picked = BY_KEY[moduleKey] ?? IconLayoutGrid;
  return <Picked size={size} stroke={weight} {...rest} />;
}
