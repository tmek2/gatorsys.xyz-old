"use client";
import React, { useState, useEffect } from "react";
import {
  DiscordMessages,
  DiscordMessage,
  DiscordEmbed,
  DiscordEmbedFields,
  DiscordEmbedField,
  DiscordEmbedDescription,
  DiscordEmbedFooter,
  DiscordMention,
  DiscordAttachments,
  DiscordImageAttachment

} from "@skyra/discord-components-react";
import { IconHash as Hash } from "@tabler/icons-react";

interface Embed {
  title?: string;
  description?: string;
  color?: number;
  image?: { url: string };
  thumbnail?: { url: string };
  footer?: { text: string; icon_url?: string };
  fields?: { name: string; value: string }[];
  author?: { name: string; url?: string; icon_url?: string };
}

interface Message {
  author_id: string;
  content: string;
  author_name: string;
  message_id: string;
  author_avatar: string;
  attachments: string[];
  embeds: Embed[];
  timestamp: number;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function EmbedCard({ embed }: { embed: Embed }) {
  const embedColor = embed.color
    ? `#${embed.color.toString(16).padStart(6, "0")}`
    : "#525252";

  return (
    <DiscordEmbed
      color={embedColor}
      author-image={embed.author?.icon_url}
      author-name={embed.author?.name}
      author-url={embed.author?.url}
      embed-title={embed.title}
      image={embed.image?.url}
      thumbnail={embed.thumbnail?.url}
    >
      {embed.description && (
        <DiscordEmbedDescription slot="description">
          {embed.description}
        </DiscordEmbedDescription>
      )}

      {embed.fields && embed.fields.length > 0 && (
        <DiscordEmbedFields slot="fields">
          {embed.fields.map((field, index) => (
            <DiscordEmbedField key={index} fieldTitle={field.name}>
              {field.value}
            </DiscordEmbedField>
          ))}
        </DiscordEmbedFields>
      )}

      {embed.footer && (
        <DiscordEmbedFooter
          slot="footer"
          footer-image={embed.footer.icon_url}
          timestamp={new Date()}
        >
          {embed.footer.text}
        </DiscordEmbedFooter>
      )}
    </DiscordEmbed>
  );
}

function MessageGroup({ messages }: { messages: Message[] }) {
  const firstMessage = messages[0];

  return (
    <DiscordMessage
      author={firstMessage.author_name}
      avatar={firstMessage.author_avatar}
      timestamp={formatTimestamp(firstMessage.timestamp)}
    >
      {messages.map((message, index) => (
        <div key={message.message_id} className={index > 0 ? "mt-1" : ""}>
          <p>{parseContent(message.content)}</p>
          
          {message.embeds.map((embed, embedIndex) => (
            <EmbedCard key={embedIndex} embed={embed} />
          ))}

          {message.attachments.length > 0 && (
            <div className="mt-2">
              {message.attachments.map((attachment, attachmentIndex) => {
                const isImage = attachment.match(/\.(jpg|jpeg|png|gif)$/i);
                const isVideo = attachment.match(/\.(mp4|webm|ogg)$/i);
                return (
                  <div key={attachmentIndex} className="mb-2">
                    {isImage ? (
                      /* discord-components v4 has one component per media kind
                         inside a `DiscordAttachments` container that owns the
                         attachments slot. */
                      <DiscordAttachments slot="attachments">
                        <DiscordImageAttachment
                          url={attachment}
                          alt={`Attachment ${attachmentIndex}`}
                        />
                      </DiscordAttachments>
                    ) : isVideo ? (
                      <video controls className="max-w-full h-auto">
                        <source src={attachment} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <a
                        href={attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1d9bf0] hover:underline"
                      >
                        Download attachment {attachmentIndex + 1}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </DiscordMessage>
  );
}

function parseContent(content: string): React.ReactNode[] {
  const mentionRegex = /<@!?(\d+)>|<#(\d+)>|<@&(\d+)>/g;
  const markdownRegex = /(\*\*|__|`|_|\*)(.*?)\1/g;
  const emojiRegex = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;
  const timestampRegex = /<t:(\d+):([R])?>/g;

  let parsedNodes: React.ReactNode[] = [];
  let currentIndex = 0;
  content.replace(mentionRegex, (match, user, channel, role, offset) => {
    if (currentIndex < offset) {
      parsedNodes.push(content.slice(currentIndex, offset));
    }
    if (user) {
      parsedNodes.push(<DiscordMention key={offset}>user</DiscordMention>);
    } else if (channel) {
      parsedNodes.push(<DiscordMention key={offset}>channel</DiscordMention>);
    } else if (role) {
      parsedNodes.push(<DiscordMention key={offset}>role</DiscordMention>);
    }
    currentIndex = offset + match.length;
    return "";
  });

  content.replace(
    emojiRegex,
    (match, isAnimated, emojiName, emojiId, offset) => {
      if (currentIndex < offset) {
        parsedNodes.push(content.slice(currentIndex, offset));
      }
      const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${
        isAnimated ? "gif" : "png"
      }?v=1`;
      parsedNodes.push(
        <img
          key={offset}
          src={emojiUrl}
          alt={emojiName}
          className="inline-block w-5 h-5 align-bottom"
        />
      );
      currentIndex = offset + match.length;
      return "";
    }
  );

  content.replace(timestampRegex, (match, timestamp, format, offset) => {
    if (currentIndex < offset) {
      parsedNodes.push(content.slice(currentIndex, offset));
    }
    const relativeTime = new Date(parseInt(timestamp) * 1000).toLocaleString(
      "en-US",
      { hour12: false }
    );
    parsedNodes.push(
      <span key={offset} className="text-[#a6a6a6]" title={relativeTime}>
        {format === "R" ? `at ${relativeTime}` : relativeTime}
      </span>
    );
    currentIndex = offset + match.length;
    return "";
  });

  if (currentIndex < content.length) {
    parsedNodes.push(content.slice(currentIndex));
  }

  parsedNodes = parsedNodes.flatMap((text) => {
    if (typeof text !== "string") return text;

    const parts = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = markdownRegex.exec(text)) !== null) {
      parts.push(text.substring(lastIndex, match.index));
      const symbol = match[1];
      const content = match[2];

      if (symbol === "**" || symbol === "__") {
        parts.push(<strong key={lastIndex}>{content}</strong>);
      } else if (symbol === "*") {
        parts.push(<em key={lastIndex}>{content}</em>);
      } else if (symbol === "`") {
        parts.push(
          <code key={lastIndex} className="bg-gray-700 px-1 rounded">
            {content}
          </code>
        );
      }
      lastIndex = markdownRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  });

  return parsedNodes;
}

export default function DiscordTranscript({
  transcript,
}: {
  transcript: Message[];
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); 
  }, []);

  if (!isClient) {
    return null;
  }

  const groupedMessages = transcript.reduce((acc, message) => {
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup[0].author_id === message.author_id) {
      lastGroup.push(message);
    } else {
      acc.push([message]);
    }
    return acc;
  }, [] as Message[][]);

  return (
    /* The transcript as a card in Discord's dark colours under the site header,
       with a divider per day as Discord draws them. */
    <div className="gs-transcript">
      <div className="gs-transcript-bar">
        <Hash size={18} aria-hidden="true" />
        <span className="gs-transcript-name">ticket</span>
        <span className="gs-transcript-count">
          {transcript.length} message{transcript.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="gs-transcript-body">
        <DiscordMessages>
          {groupedMessages.map((group, index) => (
            <React.Fragment key={group[0].message_id}>
              {index === 0 ||
              formatDate(group[0].timestamp) !==
                formatDate(groupedMessages[index - 1][0].timestamp) ? (
                <div className="gs-day" role="separator">
                  <span>{formatDate(group[0].timestamp)}</span>
                </div>
              ) : null}
              <MessageGroup messages={group} />
            </React.Fragment>
          ))}
        </DiscordMessages>
      </div>
    </div>
  );
}
