"use client";

import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";

export const REPLY_COUNT_KEY = ["replies", "count"] as const;

/** Unread and not-done replies, for the sidebar, the dashboard and the Replies page. */
export function useReplyCount() {
  return useQuery({
    queryKey: REPLY_COUNT_KEY,
    queryFn: () => unwrap(api.GET("/api/replies/count")),
    refetchInterval: 60_000,
  });
}
