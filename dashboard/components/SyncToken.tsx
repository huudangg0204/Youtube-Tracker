"use client";

import { useEffect } from 'react';

export default function SyncToken({ token }: { token?: string | null }) {
  useEffect(() => {
    if (token) {
      document.cookie = `yt_tracker_jwt=${token}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      document.cookie = `yt_tracker_jwt=; path=/; max-age=0; SameSite=Lax`;
    }
  }, [token]);

  return null;
}
