// Full-screen spinner shown while any non-silent API request is running. It waits a moment
// before appearing (fast calls never flicker) and lingers briefly after the last request ends
// (so back-to-back requests, like a save followed by a reload, do not blink it off and on).

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { busy } from '../../services/api/http';

const SHOW_AFTER_MS = 200;
const HIDE_AFTER_MS = 100;

export function GlobalLoader() {
  const pending = useSyncExternalStore(busy.subscribe, busy.get);
  const [visible, setVisible] = useState(false);
  const isBusy = pending > 0;

  useEffect(() => {
    const timer = setTimeout(() => setVisible(isBusy), isBusy ? SHOW_AFTER_MS : HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isBusy]);

  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-white/50 backdrop-blur-[1px]"
      role="status"
      aria-label="Loading"
    >
      <div className="w-10 h-10 border-4 border-[#d7e6d9] border-t-[#2f7d3c] rounded-full animate-spin" />
    </div>
  );
}
