import { getSupabase } from "@/lib/supabase";

export interface LumenUser {
  userId: string;
  pro: boolean;
  displayName: string;
}

export async function getUserFromToken(token: string): Promise<LumenUser | null> {
  const supabase = getSupabase();
  if (!supabase || !token) return null;

  const { data } = await supabase
    .from("users")
    .select("id, pro, display_name")
    .eq("api_token", token)
    .maybeSingle();

  if (!data) return null;

  return {
    userId: data.id,
    pro: Boolean(data.pro),
    displayName: data.display_name || "Nomon user",
  };
}

export async function getUserById(userId: string) {
  const supabase = getSupabase();
  if (!supabase || !userId) return null;

  const { data } = await supabase
    .from("users")
    .select("id, pro, display_name, share_card_public, email")
    .eq("id", userId)
    .maybeSingle();

  return data;
}

export function generateApiToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}
