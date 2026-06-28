import { buildParentWeeklyEmailHtml } from "@/lib/familyEmail";
import { getAllActiveShares } from "@/lib/familyMemory";
import { getLearnedMoment } from "@/lib/lumiMemory";
import { getFamilyConversationStarter } from "@/lib/familyQuestions";
import type { Shape } from "@/lib/shapes";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

/** Monday cron: weekly card + conversation starter to parents with active family shares */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new Resend(resendKey) : null;
  const origin = req.nextUrl.origin;
  let sent = 0;
  const previews: Array<{ to: string; subject: string }> = [];

  for (const share of getAllActiveShares()) {
    const cardRes = await fetch(`${origin}/api/card?userId=${share.childUserId}`, {
      cache: "no-store",
    });
    const card = await cardRes.json();
    const shape = (card.shape as Shape) || "Balanced";
    const learned = getLearnedMoment(share.childUserId)?.text || null;
    const html = buildParentWeeklyEmailHtml({
      childName: share.childDisplayName,
      shape,
      insightLine: String(card.insightLine || ""),
      depthMoments: Number(card.depth_moments) || 0,
      questionsAsked: Number(card.questions_asked) || 0,
      consciousDelegates: Number(card.conscious_delegates) || 0,
      loopBreaks: Number(card.loop_breaks_taken) || 0,
      intentionalPct: Number(card.intentional_pct) || 50,
      conversationStarter: getFamilyConversationStarter(shape),
      learnedMoment: learned,
    });

    const subject = `${share.childDisplayName}'s Lumen week — ${shape}`;

    if (resend) {
      await resend.emails.send({
        from: "Lumen Family <hello@lumen.so>",
        to: share.parentEmail,
        subject,
        html,
      });
      sent += 1;
    } else {
      previews.push({ to: share.parentEmail, subject });
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    previews: resend ? undefined : previews,
    mode: resend ? "email" : "preview",
  });
}
