import { useState, useCallback, useEffect } from "react";
import type { DashboardData } from "../lib/types";

const STORAGE_KEY = "event-intelligence-picks";

export function useSchedule() {
  const [pickedEvents, setPickedEvents] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...pickedEvents]));
  }, [pickedEvents]);

  const pick = useCallback((eventId: string, conflictIds: string[] = []) => {
    setPickedEvents((prev) => {
      const next = new Set(prev);
      // remove conflicting events
      for (const c of conflictIds) {
        next.delete(c);
      }
      next.add(eventId);
      return next;
    });
  }, []);

  const unpick = useCallback((eventId: string) => {
    setPickedEvents((prev) => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
  }, []);

  const isPicked = useCallback(
    (eventId: string) => pickedEvents.has(eventId),
    [pickedEvents]
  );

  const clearAll = useCallback(() => {
    setPickedEvents(new Set());
  }, []);

  const exportMarkdown = useCallback(
    (data: DashboardData) => {
      const lines: string[] = ["# My Toronto Tech Week Schedule", ""];
      for (const day of data.days) {
        const picked = day.events.filter((e) => pickedEvents.has(e.id));
        if (picked.length === 0) continue;
        lines.push(`## ${day.label}`, "");
        for (const e of picked) {
          lines.push(`- **${e.time.start_local} — ${e.time.end_local}**`);
          lines.push(`  ${e.title}`);
          lines.push(`  Score: ${e.serendipity.score} | Guests: ${e.guest_list?.total_count ?? "?"}`);
          if (e.serendipity.warm_connections.length > 0) {
            lines.push(`  Connections: ${e.serendipity.warm_connections.length}`);
          }
          lines.push("");
        }
      }
      return lines.join("\n");
    },
    [pickedEvents]
  );

  return { pickedEvents, pick, unpick, isPicked, clearAll, exportMarkdown };
}
