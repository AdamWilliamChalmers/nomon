import ShapeBadge from "./ShapeBadge";
import type { Shape } from "@/lib/shapes";
import { SHAPE_DESCRIPTIONS } from "@/lib/shapes";

export interface CommunityEntry {
  displayName: string;
  shape: Shape;
  sharedAt: string;
}

interface CommunityFeedProps {
  entries: CommunityEntry[];
  sharedCount: number;
}

export default function CommunityFeed({ entries, sharedCount }: CommunityFeedProps) {
  return (
    <div>
      <p className="text-[12px] text-[var(--lm-secondary)] mb-4">
        {sharedCount} cards shared this week
      </p>
      <div className="space-y-3">
        {entries.map((e, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 lm-surface"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--lm-raised)] flex items-center justify-center text-[12px] font-medium text-[var(--lm-primary)]">
              {initials(e.displayName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate text-[var(--lm-bright)]">
                {e.displayName}
              </p>
              <p className="text-[11px] text-[var(--lm-secondary)] truncate">
                {SHAPE_DESCRIPTIONS[e.shape]}
              </p>
            </div>
            <ShapeBadge shape={e.shape} />
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-[13px] text-[var(--lm-muted)]">No shared cards yet this week.</p>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
