import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ pro: false, displayName: null, share_card_public: false });
  }

  return NextResponse.json({
    userId: user.id,
    pro: Boolean(user.pro),
    displayName: user.display_name || "Lumen user",
    share_card_public: Boolean(user.share_card_public),
  });
}
