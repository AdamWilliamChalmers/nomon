import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import CommunityFeed from "@/components/CommunityFeed";
import type { CommunityEntry } from "@/components/CommunityFeed";
import { getSupabase } from "@/lib/supabase";
import type { Shape } from "@/lib/shapes";

function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

async function loadCommunityEntries(): Promise<CommunityEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const week = weekStart();
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name")
    .eq("pro", true)
    .eq("share_card_public", true);

  if (!users?.length) return [];

  const entries: CommunityEntry[] = [];
  for (const user of users) {
    const { data: summary } = await supabase
      .from("weekly_summaries")
      .select("shape, created_at")
      .eq("user_id", user.id)
      .eq("week_start", week)
      .maybeSingle();

    entries.push({
      displayName: user.display_name || "Lumen user",
      shape: (summary?.shape as Shape) || "Balanced",
      sharedAt: summary?.created_at || new Date().toISOString(),
    });
  }

  return entries;
}

export default async function CommunityPage() {
  const entries = await loadCommunityEntries();

  return (
    <main className="lm-app-shell max-w-lg mx-auto px-6 py-12">
      <BrandLogo variant="icon" height={16} className="mb-3" />
      <h1 className="lm-page-title mb-2">Community</h1>
      <p className="text-[13px] text-[var(--lm-secondary)] mb-8">
        Shapes shared this week — no scores, no rankings.
      </p>
      <CommunityFeed entries={entries} sharedCount={entries.length} />
      <p className="text-center mt-8">
        <Link href="/" className="lm-link text-[12px]">
          ← Back to Lumen
        </Link>
      </p>
    </main>
  );
}
