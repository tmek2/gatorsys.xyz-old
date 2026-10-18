import React from "react";
import { DiscordMention } from "@skyra/discord-components-react";

const TOKEN = /<@!?\d+>|<#\d+>|<@&\d+>|<a?:[A-Za-z0-9_]+:\d+>|<t:\d+(?::[tTdDfFR])?>|(\*\*|__|`|_|\*)([\s\S]+?)\1/g;

/** Keep all token kinds in one pass so their positions stay in message order. */
export function renderTranscriptContent(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of content.matchAll(TOKEN)) {
    const index = match.index!;
    if (index > cursor) nodes.push(content.slice(cursor, index));
    const token = match[0];
    const key = String(index);
    const emoji = token.match(/^<(a?):([A-Za-z0-9_]+):(\d+)>$/);
    const timestamp = token.match(/^<t:(\d+)(?::([tTdDfFR]))?>$/);

    if (token.startsWith("<@") || token.startsWith("<#")) {
      const kind = token.startsWith("<#") ? "channel" : token.startsWith("<@&") ? "role" : "user";
      nodes.push(<DiscordMention key={key}>{kind}</DiscordMention>);
    } else if (emoji) {
      nodes.push(
        <img
          key={key}
          src={`https://cdn.discordapp.com/emojis/${emoji[3]}.${emoji[1] ? "gif" : "png"}?v=1`}
          alt={emoji[2]}
          className="inline-block w-5 h-5 align-bottom"
        />,
      );
    } else if (timestamp) {
      const date = new Date(Number(timestamp[1]) * 1000);
      if (Number.isNaN(date.getTime())) {
        nodes.push(token);
      } else {
        const label = date.toLocaleString("en-US", { hour12: false });
        nodes.push(
          <span key={key} className="text-[#a6a6a6]" title={label}>
            {timestamp[2] === "R" ? `at ${label}` : label}
          </span>,
        );
      }
    } else {
      const delimiter = match[1];
      const body = match[2];
      if (delimiter === "`") {
        nodes.push(<code key={key} className="bg-gray-700 px-1 rounded">{body}</code>);
      } else if (delimiter === "**" || delimiter === "__") {
        nodes.push(<strong key={key}>{renderTranscriptContent(body)}</strong>);
      } else {
        nodes.push(<em key={key}>{renderTranscriptContent(body)}</em>);
      }
    }
    cursor = index + token.length;
  }

  if (cursor < content.length) nodes.push(content.slice(cursor));
  return nodes;
}
