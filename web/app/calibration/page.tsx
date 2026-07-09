import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import FeedbackCalibrationPanel from "@/components/FeedbackCalibrationPanel";

export default function CalibrationPage() {
  return (
    <main className="lm-app-shell max-w-5xl mx-auto px-6 py-12">
      <BrandLogo variant="icon" height={16} className="mb-3" />
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-2">
        <h1 className="lm-page-title">Signal calibration</h1>
        <Link href="/dashboard" className="lm-link text-[12px]">
          ← Dashboard
        </Link>
      </div>
      <p className="text-[13px] text-[var(--lm-secondary)] mb-8 max-w-2xl">
        Internal view of false-positive rates and crowd-derived scoring weights. This is the feedback
        flywheel — corrections from the extension become model adjustments for all users.
      </p>
      <FeedbackCalibrationPanel />

      <div className="lm-surface p-4 mt-8">
        <p className="lm-label mb-2">Calibration study (Route 3)</p>
        <p className="text-[12px] text-[var(--lm-secondary)] mb-3">
          On by default in the extension (Privacy &amp; data); users opt out any time.
          Post-session surveys pair self-reported engagement with Nomon scores.
        </p>
        <Link href="/survey" className="lm-link text-[12px]">
          Open survey form →
        </Link>
      </div>
    </main>
  );
}
