"use client";

import { useEffect, useRef, useState } from "react";
import { createSwapy } from "swapy";

/** React owns the question cards; Swapy measures and animates their new order. */
export function useSpringReorder<T>({
  items,
  getId,
  onReorder,
}: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (next: T[]) => void;
}) {
  const [container, containerRef] = useState<HTMLDivElement | null>(null);
  const itemsRef = useRef(items);
  const getIdRef = useRef(getId);
  const onReorderRef = useRef(onReorder);
  itemsRef.current = items;
  getIdRef.current = getId;
  onReorderRef.current = onReorder;

  // A reordered list uses the existing instance. Added/removed questions need
  // new listeners, as does returning to the Questions tab's new DOM element.
  const membership = JSON.stringify(items.map(getId).sort());

  useEffect(() => {
    if (!container || itemsRef.current.length < 2) return;

    const swapy = createSwapy(container, {
      animation: "spring",
      swapMode: "drop",
      dragAxis: "y",
      autoScrollOnDrag: true,
      manualSwap: true,
    });
    swapy.onSwap((event) => {
      const byId = new Map(
        itemsRef.current.map((item) => [getIdRef.current(item), item]),
      );
      const next = event.newSlotItemMap.asArray
        .map(({ item }) => byId.get(item))
        .filter((item): item is T => Boolean(item));
      if (next.length === itemsRef.current.length) {
        onReorderRef.current(next);
      }
    });

    return () => {
      swapy.destroy();
    };
  }, [container, membership]);

  return {
    containerRef,
    slotId: (index: number) => `reorder-slot-${index}`,
    itemId: (item: T) => getId(item),
  };
}
