import { IconServerOff, IconPlus } from "@tabler/icons-react";
import {
  RippleButton,
  RippleButtonRipples,
} from "@/components/site/ripple-button";

interface NoServersFoundProps {
  title?: string;
  description?: string;
  /** When provided, shows an "Add Gator" button linking to the bot invite. */
  inviteUrl?: string;
}

export function NoServersFound({
  title = "No Servers Found",
  description = "It looks like Gator isn't in any of your servers yet. Add it to get started.",
  inviteUrl,
}: NoServersFoundProps) {
  return (
    <div className="servers-empty">
      <span className="servers-empty-icon">
        <IconServerOff className="h-6 w-6" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {inviteUrl ? (
        <RippleButton
          as="a"
          href={inviteUrl}
          target="_blank"
          rel="noreferrer"
        >
          <IconPlus size={16} />
          Add Gator to a server
          <RippleButtonRipples />
        </RippleButton>
      ) : null}
    </div>
  );
}
