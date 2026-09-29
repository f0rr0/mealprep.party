"use client";

import { useEffect, useState } from "react";

export function useCopyFeedback(text: string) {
  const [lastCopy, setLastCopy] = useState<{ text: string } | null>(null);

  useEffect(() => {
    if (!lastCopy) {
      return;
    }
    const timer = setTimeout(() => setLastCopy(null), 2000);
    return () => clearTimeout(timer);
  }, [lastCopy]);

  return {
    copied: !!text && lastCopy?.text === text,
    markCopied: () => setLastCopy({ text }),
  };
}
