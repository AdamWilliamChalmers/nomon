import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export const metadata = {
  title: "Privacy — Nomon",
  description: "How Nomon handles your data — local scoring, optional research sharing, and your controls.",
};

export default function PrivacyPage() {
  return (
    <main className="lm-app-shell max-w-2xl mx-auto px-6 py-12">
      <BrandLogo variant="icon" height={16} className="mb-3" />
      <h1 className="lm-page-title mb-2">Privacy policy</h1>
      <p className="text-[12px] text-[var(--lm-muted)] mb-10">Last updated: 5 July 2026</p>

      <div className="space-y-8 text-[13px] text-[var(--lm-secondary)] leading-relaxed">
        <section>
          <h2 className="text-[14px] font-medium text-[var(--lm-primary)] mb-2">Summary</h2>
          <p>
            Nomon is a browser extension that scores how you engage with AI chat tools.{" "}
            <strong className="text-[var(--lm-primary)]">All signal detection runs locally</strong>{" "}
            in your browser. We do not read, store, or analyse the content of your conversations on
            our servers.
          </p>
          <p className="mt-3">
            Optional research features — anonymised session counts and a post-session calibration
            survey — are <strong className="text-[var(--lm-primary)]">on by default</strong>. You
            can turn either off any time under <em>Privacy &amp; data</em> in the extension pill.
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-[var(--lm-primary)] mb-2">
            What stays on your device
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Your goals, mode, and preferences</li>
            <li>Session scores and signal history (used for the badge and weekly digest)</li>
            <li>All message scoring — based on structure (length, pace, patterns), not stored text</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-[var(--lm-primary)] mb-2">
            What may be sent to nomon-app.com
          </h2>
          <p className="mb-3">Only if the relevant toggle is on (both default to on):</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-[var(--lm-primary)]">Share anonymised session summary</strong>{" "}
              — on tab close (and periodically while you work): date, platform, mode, message
              count, all Mirror signal counts (including Hands-on / scaffold / attempt-first),
              composer dynamics (paste &amp; dwell ratios — counts only), task-type histogram,
              per-tool tallies, and nudge response counts. No full chats. If you tap ✓ or ✕ on a
              signal, up to 200 characters of that prompt may be included as a labelled feedback
              snippet (stance, dwell, and confidence when available).
            </li>
            <li>
              <strong className="text-[var(--lm-primary)]">LLM second opinion</strong> — borderline
              prompts only (not every message), sent for classification; cached per message hash.
            </li>
            <li>
              <strong className="text-[var(--lm-primary)]">Calibration study</strong> — opens an
              optional 5-question survey when you leave a tab; self-reported engagement paired with
              session scores.
            </li>
          </ul>
          <p className="mt-3">
            Each install uses a random anonymous ID (UUID). We do not ask for your name or email to
            use the extension.
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-[var(--lm-primary)] mb-2">How we use server data</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Improve signal accuracy (crowd calibration from aggregated feedback)</li>
            <li>Research on AI-assisted cognition (aggregate analysis only)</li>
            <li>Pro account features if you sign up separately on nomon-app.com</li>
          </ul>
          <p className="mt-3">
            We do <strong className="text-[var(--lm-primary)]">not</strong> sell individual-level
            data. We do not share full conversations with third parties.
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-[var(--lm-primary)] mb-2">Where data is stored</h2>
          <p>
            Server data is stored in Supabase (EU/US hosting per Supabase project configuration).
            Extension data stays in your browser&apos;s local storage and Chrome sync storage (for
            preferences only).
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-[var(--lm-primary)] mb-2">Your controls</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Turn off sharing and the calibration survey in the extension pill → Privacy &amp; data</li>
            <li>Turn off the LLM second opinion to stay fully on-device</li>
            <li>Use Ghost mode for no in-session signals</li>
            <li>Uninstall the extension to stop all local and future server collection</li>
          </ul>
          <p className="mt-3">
            To request deletion of server-side data associated with your anonymous ID, email{" "}
            <a href="mailto:hello@nomon-app.com" className="lm-link">
              hello@nomon-app.com
            </a>
            . We aim to complete requests within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-[var(--lm-primary)] mb-2">Children</h2>
          <p>
            Nomon is for ages 13 and above. We do not knowingly collect data from children under 13.
            Users aged 13–17 require parent consent for account features on nomon-app.com.
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-medium text-[var(--lm-primary)] mb-2">Contact</h2>
          <p>
            Dr Adam Chalmers ·{" "}
            <a href="mailto:hello@nomon-app.com" className="lm-link">
              hello@nomon-app.com
            </a>
          </p>
        </section>
      </div>

      <p className="mt-12 text-center">
        <Link href="/" className="lm-link text-[12px]">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
