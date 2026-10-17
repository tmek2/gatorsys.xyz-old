"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { DiscordLogo } from "@/components/brand-icons";
import { RippleButton, RippleButtonRipples } from "@/components/site/ripple-button";
import { StatusScreen } from "@/components/status-screen";

type DiscordAuthRedirectProps = {
  action: () => Promise<void>;
};

/**
 * Submits itself once and shows its state: the automatic submit is the fast
 * path, but the form works without it, and `useFormStatus` reflects the real
 * submission.
 */
function SignInButton({ auto }: { auto: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <RippleButton type="submit" disabled={pending} size="lg" className="gs-status-btn">
        {pending ? <span className="gs-status-spin" aria-hidden="true" /> : <DiscordLogo size={17} />}
        {pending ? "Taking you to Discord" : "Continue with Discord"}
        <RippleButtonRipples />
      </RippleButton>
      {auto && !pending ? (
        <p className="gs-status-note">Not moving on its own? Press the button above.</p>
      ) : null}
    </>
  );
}

export function DiscordAuthRedirect({ action }: DiscordAuthRedirectProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    // Guarded against a second run (React mounts effects twice in development,
    // and two submissions would race two OAuth states).
    if (submitted.current) return;
    submitted.current = true;
    setAutoTried(true);
    formRef.current?.requestSubmit();
  }, []);

  return (
    <StatusScreen title="Continue with Discord">
      <p>Gator uses your Discord account to know who you are.</p>
      <form ref={formRef} action={action} className="gs-status-form">
        <SignInButton auto={autoTried} />
      </form>
    </StatusScreen>
  );
}
