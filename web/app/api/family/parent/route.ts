import { NextRequest, NextResponse } from "next/server";
import {
  activateShare,
  getActiveSharesForParent,
  getShareById,
} from "@/lib/familyMemory";
import { getFamilyConversationStarter } from "@/lib/familyQuestions";
import type { Shape } from "@/lib/shapes";

export async function GET(req: NextRequest) {
  const parentEmail = req.nextUrl.searchParams.get("parentEmail");
  const shareId = req.nextUrl.searchParams.get("shareId");
  const token = req.nextUrl.searchParams.get("token");
  const childUserId = req.nextUrl.searchParams.get("childUserId");
  const week = req.nextUrl.searchParams.get("week");

  if (shareId && token) {
    let share = getShareById(shareId);
    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }
    if (share.status === "pending") {
      const activated = activateShare(shareId, token);
      if (!activated) {
        return NextResponse.json({ error: "Invalid invitation" }, { status: 403 });
      }
      share = activated;
    } else if (share.inviteToken !== token && share.status !== "active") {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    const cardRes = await fetch(
      `${req.nextUrl.origin}/api/card?userId=${share.childUserId}&week=${week || ""}`,
      { cache: "no-store" }
    );
    const card = await cardRes.json();
    const shape = (card.shape as Shape) || "Balanced";

    return NextResponse.json({
      ok: true,
      view: "parent",
      childDisplayName: share.childDisplayName,
      shareStatus: share.status,
      card,
      conversationStarter: getFamilyConversationStarter(shape),
      restrictions: {
        sessionLogs: false,
        messageContent: false,
        rawScores: false,
        peerComparison: false,
        realTimeAlerts: false,
      },
    });
  }

  if (!parentEmail) {
    return NextResponse.json({ error: "parentEmail or shareId+token required" }, { status: 400 });
  }

  const shares = getActiveSharesForParent(parentEmail);
  return NextResponse.json({
    ok: true,
    children: shares.map((s) => ({
      shareId: s.id,
      childUserId: s.childUserId,
      childDisplayName: s.childDisplayName,
    })),
  });
}
