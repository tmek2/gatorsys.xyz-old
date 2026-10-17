/** Shared gator puns + rare easter-egg lines, so the jokes can surface in more
 *  places than just the sidebar (empty states, the console, etc.). */

export const GATOR_JOKES = [
  "Why don't alligators like fast food? It's too hard to catch.",
  "What do you call an alligator in a vest? An in-vest-igator.",
  "See you later, alligator. In a while, crocodile.",
  "What's an alligator's favourite drink? Gator-ade.",
  "How does an alligator answer the phone? Croc and roll, who's this?",
  "An alligator's favourite settings page? The snappy one.",
  "What do alligators call unsaved changes? Bait.",
  "I asked the gator to review my config. It gave it two thumbs… eventually.",
  "Gators don't lose drafts. They keep them in the swamp (localStorage).",
  "What's a gator's favourite shortcut? Ctrl+Snap.",
  "Why did the gator get promoted? Outstanding activity. And teeth.",
  "Pro tip: click the variables to insert them. The gator insists.",
  "Why was the gator such a good moderator? It never lets things escalate.",
  "What do you call a gator that files reports? A litigator.",
  "The gator read your audit log. Riveting stuff, apparently.",
  "Gators never rage-quit. They just do a tactical death roll.",
  "What's a gator's favourite tab? Whichever one has snacks. Then Roster.",
  "Our gator sleeps with one eye open. That's the uptime secret.",
  "Why don't gators use light mode? Swamp glare.",
  "The gator says: schedule your waves, not your panic.",
  "What did the gator say to the slow API? Snap out of it.",
  "Gators love spreadsheets. So many cells to sink their teeth into.",
  "A gator's LOA request: 'gone sunbathing on a log, back Tuesday.'",
  "The gator approves this configuration. Probably. It's hard to read.",
  "Why did the gator join every department? Fear of missing out. And teeth.",
  "Keyboard shortcut Ctrl+K opens search. The gator found that one itself.",
  "What's a gator's favourite database? Anything with good scales.",
  "The gator tried light mode once. Once.",
  "Why do gators make great reviewers? They never sugarcoat the bite.",
  "Gator fact: 100% of uptime is spent lurking.",
  "What do you call a gator with a clipboard? Management material.",
  "The gator filed an LOA: 'sun's out, snout's out.'",
  "Why did the gator love the new roster? Everything finally in order. Snack order.",
  "A watched wave never ends. The gator checked.",
  "What's a gator's code review style? Leave it. Take it. Chomp it.",
  "The gator ran the migration. Nothing was rolled back except the gator.",
  "Why do gators love webhooks? Something always bites.",
  "Gator onboarding step one: identify the nearest sunny log.",
  "The gator set a reminder. It's just 'lunch'. It's always lunch.",
  "What's a gator's favourite HTTP status? 200 OK, snout intact.",
  "Our gator doesn't do standups. It does swamp-ups.",
  "Why did the ticket close itself? The gator gave it The Look.",
  "Gator changelog: added teeth, removed hesitation.",
  "The gator's threat model is simply: it is the threat.",
  "What do you call a gator that hits quota? Employee of the swamp.",
  "The gator prefers dark mode. Better for ambush.",
  "Why don't gators need coffee? Pure spite and sunlight.",
  "The gator says: ship it, then bask.",
  "A gator never forgets a permission. Or a grudge.",
  "What's a gator's favourite key? Enter. Dramatic, effective.",
  "The gator reviewed 42 configs today and napped through 41.",
  "Gator wisdom: if it moves, log it. If it doesn't, log it anyway.",
];

/** Rare easter-egg lines — surfaced roughly 1 in 12 rolls for the curious. */
export const GATOR_SECRETS = [
  "You found a rare one. The gator respects your persistence.",
  "Secret: the gator's real name is Gerald. Don't tell it you know.",
  "Konami who? The gator only knows the death-roll combo.",
  "Legend says if you click 100 times, the gator does a barrel roll. (It doesn't. Or does it?)",
  "This message self-destructs in… actually the gator ate the timer.",
];

export function randomGatorLine(): string {
  return GATOR_JOKES[Math.floor(Math.random() * GATOR_JOKES.length)];
}

export function randomGatorSecret(): string {
  return GATOR_SECRETS[Math.floor(Math.random() * GATOR_SECRETS.length)];
}
