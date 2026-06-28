import type { Shape } from "./shapes";

export function buildParentWeeklyEmailHtml(input: {
  childName: string;
  shape: Shape;
  insightLine: string;
  depthMoments: number;
  questionsAsked: number;
  consciousDelegates: number;
  loopBreaks: number;
  intentionalPct: number;
  conversationStarter: string;
  learnedMoment?: string | null;
}): string {
  const learnedBlock = input.learnedMoment
    ? `
      <div style="background: #faf5ff; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e9d5ff;">
        <p style="font-size: 12px; font-weight: 600; color: #7c3aed; margin: 0 0 8px;">One thing they learned</p>
        <p style="font-size: 14px; color: #374151; margin: 0; font-style: italic;">&ldquo;${input.learnedMoment}&rdquo;</p>
      </div>
    `
    : "";
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; color: #111;">
      <p style="font-size: 12px; color: #666; text-transform: uppercase;">Lumen Family</p>
      <h1 style="font-size: 20px;">${input.childName}'s week — ${input.shape}</h1>
      <p style="font-size: 14px; color: #444; font-style: italic;">${input.insightLine}</p>
      ${learnedBlock}
      <table style="width: 100%; margin: 16px 0; font-size: 14px;">
        <tr><td>Depth moments</td><td align="right"><strong>${input.depthMoments}</strong></td></tr>
        <tr><td>Questions asked</td><td align="right"><strong>${input.questionsAsked}</strong></td></tr>
        <tr><td>Conscious delegates</td><td align="right"><strong>${input.consciousDelegates}</strong></td></tr>
        <tr><td>Loop breaks taken</td><td align="right"><strong>${input.loopBreaks}</strong></td></tr>
        <tr><td>Intentional use</td><td align="right"><strong>${input.intentionalPct}%</strong></td></tr>
      </table>
      <p style="font-size: 12px; color: #888;">No message content. No session logs. No comparison to other children.</p>
      <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; margin-top: 20px;">
        <p style="font-size: 12px; font-weight: 600; color: #0369a1; margin: 0 0 8px;">Conversation starter</p>
        <p style="font-size: 14px; color: #0c4a6e; margin: 0; font-style: italic;">${input.conversationStarter}</p>
      </div>
    </div>
  `;
}
