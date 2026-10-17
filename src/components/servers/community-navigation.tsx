"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useTransition,
  type ReactNode,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import "./community-navigation.css";

type Community = { id: string; name: string; icon: string | null };
const Navigation = createContext<{
  community: Community | null;
  choose: (community: Community) => void;
}>({ community: null, choose: () => {} });

/** Carries presentation identity through navigation, never permissions/data. */
export function CommunityNavigation({ children }: { children: ReactNode }) {
  const [community, choose] = useState<Community | null>(null);
  return (
    <Navigation.Provider value={{ community, choose }}>
      {children}
    </Navigation.Provider>
  );
}
export const useCommunityNavigation = () => useContext(Navigation);
export const communityTransition = (id: string) =>
  `gator-community-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

/**
 * The router transition supplies pending feedback (also when a view transition
 * intercepts the Next link). Its snapshot resolves after the destination
 * commits or the card unmounts; motion never delays the navigation.
 */
export function useCommunityLink(community: Community, href: string) {
  const { choose } = useCommunityNavigation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const finish = useRef<(() => void) | null>(null);
  const active = useRef<{ skipTransition: () => void } | null>(null);
  useEffect(() => {
    if (!pending) {
      finish.current?.();
      finish.current = null;
    }
  }, [pending]);
  useEffect(
    () => () => {
      finish.current?.();
    },
    [],
  );
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    choose(community);
    if (
      !("startViewTransition" in document) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    e.preventDefault();
    active.current?.skipTransition();
    finish.current?.();
    const transition = document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          finish.current = resolve;
          startTransition(() => router.push(href));
        }),
    );
    active.current = transition;
    void transition.ready.catch(() => {});
    void transition.finished.catch(() => {});
  }
  return { pending, onClick };
}
