const NomonBadge = (() => {
  const SCHEMA = "nomon.attestation/0.2";
  const MIN_CHARS = 400;
  const MIN_WORDS = 80;
  const LEVELS = ["ai-assisted", "ai-drafted", "ai-generated"];

  const LEVEL_META = {
    "ai-assisted": {
      label: "AI-assisted",
      chip: "I directed and edited",
      euLabel: "AI + MODIFIED",
      humanReviewed: true,
    },
    "ai-drafted": {
      label: "AI-drafted",
      chip: "AI wrote most of it; I reviewed",
      euLabel: "AI + GENERATED (reviewed)",
      humanReviewed: true,
    },
    "ai-generated": {
      label: "AI-generated",
      chip: "Minimal human revision",
      euLabel: "AI + GENERATED",
      humanReviewed: false,
    },
  };

  const SCOPE_DISCLAIMER =
    "Attestation is for this output only. Based on what Nomon saw on this device — you confirm before sharing.";

  function canonicalHost(host) {
    return globalThis.LumenNudges?.canonicalPlatformHost?.(host) || host || "";
  }

  function wordCount(text) {
    return (text || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function formatDate(iso) {
    try {
      return iso.slice(0, 10);
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function formatWordCount(n) {
    if (n >= 1000) return `~${Math.round(n / 100) / 10}k words`;
    return `~${n} words`;
  }

  async function hashContent(text) {
    const normalized = normalizeText(text);
    if (!normalized) return "sha256:empty";
    try {
      const buf = new TextEncoder().encode(normalized);
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `sha256:${hex}`;
    } catch (_) {
      let h = 0;
      for (let i = 0; i < normalized.length; i += 1) {
        h = (h * 31 + normalized.charCodeAt(i)) | 0;
      }
      return `fallback:${(h >>> 0).toString(16)}`;
    }
  }

  function platformLabel(host) {
    return globalThis.LumenNudges?.prettyPlatform?.(host) || host || "AI";
  }

  function formatPlatformsLabel(platforms) {
    const labels = (platforms || [])
      .map((p) => (typeof p === "string" ? platformLabel(p) : p?.label))
      .filter(Boolean);
    if (!labels.length) return "AI";
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
    return `${labels.slice(0, -1).join(", ")} + ${labels[labels.length - 1]}`;
  }

  function buildTodayPlatforms(session, currentHost) {
    const current = canonicalHost(currentHost || window.location.hostname);
    const byHost = new Map();

    Object.entries(session?.platformStats || {}).forEach(([host, ps]) => {
      const key = canonicalHost(host);
      if (!key) return;
      const count = ps?.messageCount || 0;
      if (count <= 0) return;
      const prev = byHost.get(key);
      byHost.set(key, {
        host: key,
        label: platformLabel(key),
        messageCount: (prev?.messageCount || 0) + count,
        isCurrent: key === current,
      });
    });

    if (!byHost.has(current)) {
      byHost.set(current, {
        host: current,
        label: platformLabel(current),
        messageCount: 0,
        isCurrent: true,
      });
    } else {
      const entry = byHost.get(current);
      entry.isCurrent = true;
    }

    return Array.from(byHost.values()).sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return b.messageCount - a.messageCount;
    });
  }

  function defaultSelectedPlatforms(todayPlatforms, currentHost) {
    const current = canonicalHost(currentHost || window.location.hostname);
    return [current];
  }

  function formatOptionalToolsHint(otherPlatforms) {
    const labels = (otherPlatforms || []).map((p) => p.label).filter(Boolean);
    if (!labels.length) return "";
    if (labels.length === 1) {
      return `Nomon also saw you on ${labels[0]} today. Add it only if it was part of how you made this.`;
    }
    if (labels.length === 2) {
      return `Nomon also saw you on ${labels[0]} and ${labels[1]} today. Add only the tools that were part of how you made this.`;
    }
    const rest = labels.slice(0, -1).join(", ");
    return `Nomon also saw you on ${rest}, and ${labels[labels.length - 1]} today. Add only the tools that were part of how you made this.`;
  }

  function resolveSelectedPlatforms(todayPlatforms, selectedHosts, currentHost) {
    const current = canonicalHost(currentHost || window.location.hostname);
    const allowed = new Map((todayPlatforms || []).map((p) => [p.host, p]));
    const hosts = Array.isArray(selectedHosts) ? selectedHosts.map(canonicalHost) : [];
    const picked = hosts.filter((h) => allowed.has(h));
    if (!picked.includes(current)) picked.unshift(current);
    const unique = [...new Set(picked)];
    return unique.map((host) => allowed.get(host)).filter(Boolean);
  }

  function threadBeforeAssistant(messages, assistantIndex) {
    const slice = messages.slice(0, assistantIndex + 1);
    const assistantPos = slice.findIndex(
      (m, i) => i === assistantIndex || m.id === messages[assistantIndex]?.id
    );
    const end = assistantPos >= 0 ? assistantPos : assistantIndex;
    return messages.slice(0, end);
  }

  function userMessagesBefore(messages, assistantIndex) {
    const before = threadBeforeAssistant(messages, assistantIndex);
    return before.filter((m) => m.role === "user");
  }

  function isPassive(text) {
    return Boolean(globalThis.LumenEngine?.isPassiveContinuation?.(text));
  }

  function isBadgeable(msg, attestedIds = new Set()) {
    if (!msg || msg.role !== "assistant") return false;
    if (attestedIds.has(msg.id)) return false;
    const text = msg.text || "";
    return text.length >= MIN_CHARS || wordCount(text) >= MIN_WORDS;
  }

  function inferEngagementSummary(userMsgs, session) {
    if (!userMsgs.length) return "no prompts observed in thread";
    const passive = userMsgs.filter((m) => isPassive(m.text)).length;
    const depth = userMsgs.some((m) => session?.messageSignals?.[m.id]?.primary === "depth");
    if (depth) return "asked substantive questions before this reply";
    if (passive >= Math.max(1, userMsgs.length - 1)) return "mostly accepted, little editing";
    if (userMsgs.filter((m) => (m.text || "").length < 40).length >= userMsgs.length / 2) {
      return "short follow-ups after the initial prompt";
    }
    return "back-and-forth with your own prompts";
  }

  function inferLevel(msg, messages, session) {
    const idx = messages.findIndex((m) => m.id === msg.id);
    const userMsgs = userMessagesBefore(messages, idx >= 0 ? idx : messages.length - 1);
    const text = msg.text || "";

    const avgPrompt =
      userMsgs.length > 0
        ? userMsgs.reduce((sum, m) => sum + (m.text || "").length, 0) / userMsgs.length
        : 0;
    const hasDepth = userMsgs.some((m) => session?.messageSignals?.[m.id]?.primary === "depth");
    const passiveCount = userMsgs.filter((m) => isPassive(m.text)).length;
    const handoffCount = userMsgs.filter(
      (m) => session?.messageSignals?.[m.id]?.primary === "handoff"
    ).length;

    if (userMsgs.length >= 2 && (avgPrompt > 120 || hasDepth) && passiveCount < userMsgs.length) {
      return "ai-assisted";
    }

    const longOutput = text.length >= MIN_CHARS || wordCount(text) >= MIN_WORDS;
    const singleDelegation =
      userMsgs.length === 1 &&
      (userMsgs[0].text || "").length > 300 &&
      (handoffCount > 0 || (userMsgs[0].text || "").length > 500);

    if (singleDelegation && passiveCount === 0) return "ai-generated";

    if (
      longOutput &&
      userMsgs.length <= 2 &&
      (passiveCount > 0 || userMsgs.every((m) => (m.text || "").length < 80))
    ) {
      return "ai-drafted";
    }

    if (longOutput) return "ai-drafted";
    return "ai-assisted";
  }

  function buildContext(msg, messages, session) {
    const idx = messages.findIndex((m) => m.id === msg.id);
    const userMsgs = userMessagesBefore(messages, idx >= 0 ? idx : messages.length - 1);
    const host = canonicalHost(window.location.hostname);
    const wc = wordCount(msg.text || "");
    const todayPlatforms = buildTodayPlatforms(session, host);
    const defaultSelected = defaultSelectedPlatforms(todayPlatforms, host);
    const otherPlatformsToday = todayPlatforms.filter((p) => !p.isCurrent && p.messageCount > 0);

    return {
      platform: host,
      platformLabel: platformLabel(host),
      wordCount: wc,
      wordCountLabel: formatWordCount(wc),
      threadUserMessages: userMsgs.length,
      engagementSummary: inferEngagementSummary(userMsgs, session),
      defaultLevel: inferLevel(msg, messages, session),
      todayPlatforms,
      otherPlatformsToday,
      defaultSelectedPlatforms: defaultSelected,
      crossAiAvailable: otherPlatformsToday.length > 0,
    };
  }

  function scopeFootnote(process) {
    if (process?.crossAi) return "multi-tool workflow";
    return "";
  }

  function exportPlaintext(attestation) {
    const { level, process, createdAt } = attestation;
    const meta = LEVEL_META[level] || LEVEL_META["ai-drafted"];
    const review = meta.humanReviewed ? "Human reviewed." : "Minimal human revision.";
    const footnote = scopeFootnote(process);
    const footnotePart = footnote ? ` · ${footnote}` : "";
    return `${meta.label} with ${process.platformLabel}. ${review}\nDisclosed via Nomon${footnotePart} · ${formatDate(createdAt)}${process.processNote ? `\n${process.processNote}` : ""}`;
  }

  function exportHtml(attestation) {
    const { level, process, createdAt } = attestation;
    const meta = LEVEL_META[level] || LEVEL_META["ai-drafted"];
    const review = meta.humanReviewed ? "Human reviewed" : "Minimal human revision";
    const note = process.processNote
      ? `<tr><td style="padding-top:6px;font-size:11px;color:#555555;font-family:Arial,sans-serif;">${escapeHtml(process.processNote)}</td></tr>`
      : "";
    const date = formatDate(createdAt);
    const crossAi = process.crossAi
      ? `<div style="margin-top:4px;font-size:11px;color:#777777;">${process.platforms.length} AI tools in your workflow</div>`
      : "";
    return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:12px;border:1px solid #d0d0d0;border-radius:6px;background-color:#ffffff;max-width:520px;">
  <tr>
    <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:#333333;">
      <strong style="color:#111111;font-size:12px;">${escapeHtml(meta.label)}</strong>
      <span style="color:#666666;"> · ${escapeHtml(process.platformLabel)} · ${review}</span>
      ${crossAi}
      <div style="margin-top:6px;font-size:11px;color:#777777;">Disclosed via Nomon · ${date}</div>
    </td>
  </tr>${note}
</table>`;
  }

  function wrapHtmlForClipboard(html) {
    return `<!DOCTYPE html><html><body><!--StartFragment-->${html}<!--EndFragment--></body></html>`;
  }

  function exportClipboard(attestation) {
    return {
      html: exportHtml(attestation),
      plain: exportPlaintext(attestation),
      htmlDocument: wrapHtmlForClipboard(exportHtml(attestation)),
    };
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function exportJson(attestation) {
    return JSON.stringify(attestation, null, 2);
  }

  async function buildAttestation({ msg, level, processNote, messages, session, selectedPlatforms }) {
    const chosen = LEVELS.includes(level) ? level : inferLevel(msg, messages, session);
    const meta = LEVEL_META[chosen];
    const ctx = buildContext(msg, messages, session);
    const platforms = resolveSelectedPlatforms(
      ctx.todayPlatforms,
      selectedPlatforms || ctx.defaultSelectedPlatforms,
      ctx.platform
    );
    const createdAt = new Date().toISOString();
    const contentHash = await hashContent(msg.text || "");
    const crossAi = platforms.length > 1;

    const attestation = {
      schema: SCHEMA,
      id: `att_${crypto.randomUUID?.() || Date.now()}`,
      createdAt,
      level: chosen,
      levelLabel: meta.label,
      artifact: {
        contentHash,
        wordCount: ctx.wordCount,
        charCount: (msg.text || "").length,
        messageId: msg.id,
        role: "assistant",
      },
      process: {
        platform: ctx.platform,
        platformLabel: formatPlatformsLabel(platforms),
        platforms: platforms.map((p) => ({
          host: p.host,
          label: p.label,
          messageCount: p.messageCount,
          isCurrent: p.isCurrent,
        })),
        crossAi,
        modelKnown: null,
        threadUserMessages: ctx.threadUserMessages,
        processNote: (processNote || "").trim(),
        engagementSummary: ctx.engagementSummary,
      },
      scope: {
        type: "nomon_observed",
        disclaimer: SCOPE_DISCLAIMER,
      },
      standards: {
        euAiActLevel: meta.euLabel,
        declareAiCompatible: true,
        appCompatible: false,
      },
    };

    attestation.exports = {
      plaintext: exportPlaintext(attestation),
      html: exportHtml(attestation),
    };

    return attestation;
  }

  return {
    SCHEMA,
    MIN_CHARS,
    MIN_WORDS,
    LEVELS,
    LEVEL_META,
    SCOPE_DISCLAIMER,
    isBadgeable,
    inferLevel,
    buildContext,
    buildTodayPlatforms,
    defaultSelectedPlatforms,
    resolveSelectedPlatforms,
    formatPlatformsLabel,
    formatOptionalToolsHint,
    buildAttestation,
    exportPlaintext,
    exportHtml,
    exportClipboard,
    wrapHtmlForClipboard,
    exportJson,
    hashContent,
    wordCount,
    formatWordCount,
    platformLabel,
  };
})();

globalThis.NomonBadge = NomonBadge;
