"use client";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { PREVIEW_SESSION as previewSession } from "@/preview/identity";

interface SessionProvidersProps {
  children: ReactNode;
}
export function SessionProviders({ children }: SessionProvidersProps) {
  return <SessionProvider session={previewSession} refetchInterval={0} refetchOnWindowFocus={false} refetchWhenOffline={false}>{children}</SessionProvider>;
}
