"use client";

import { useEffect, useMemo, useRef } from "react";
import { createSwapy, type Swapy } from "swapy";

/** Spring reorder for stable-id lists. Slots stay fixed while Swapy animates
 * items between them; after the drop React receives the authoritative order. */
export function useSpringReorder<T>({
  items,
  getId,
  onReorder,
}: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (next: T[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swapyRef = useRef<Swapy | null>(null);
  const itemsRef = useRef(items);
  const getIdRef = useRef(getId);
  const onReorderRef = useRef(onReorder);
  itemsRef.current = items;
  getIdRef.current = getId;
  onReorderRef.current = onReorder;

  const signature = useMemo(
    () => items.map((item) => getId(item)).join("|"),
    [getId, items],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || itemsRef.current.length < 2) return;

    const swapy = createSwapy(container, {
      animation: "spring",
      swapMode: "drop",
      dragAxis: "y",
      autoScrollOnDrag: true,
    });
    swapyRef.current = swapy;
    swapy.onSwapEnd((event) => {
      if (!event.hasChanged) return;
      const byId = new Map(
        itemsRef.current.map((item) => [getIdRef.current(item), item]),
      );
      const next = event.slotItemMap.asArray
        .map(({ item }) => byId.get(item))
        .filter((item): item is T => Boolean(item));
      if (next.length === itemsRef.current.length) {
        onReorderRef.current(next);
      }
    });

    return () => {
      swapy.destroy();
      swapyRef.current = null;
    };
  }, [items.length]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => swapyRef.current?.update());
    return () => cancelAnimationFrame(frame);
  }, [signature]);

  return {
    containerRef,
    slotId: (index: number) => `reorder-slot-${index}`,
    itemId: (item: T) => getId(item),
  };
}
