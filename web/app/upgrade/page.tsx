import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function UpgradePage() {
  const checkoutUrl = process.env.POLAR_CHECKOUT_URL || process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL;

  return (
    <main className="lm-app-shell max-w-md mx-auto px-6 py-16 text-center">
      <BrandLogo variant="full" height={56} className="mx-auto mb-8" />
      <h1 className="lm-page-title mb-6">Unlock Pro</h1>
      <ul className="text-[13px] text-[var(--lm-secondary)] space-y-2 mb-8">
        <li>Full session history</li>
        <li>Weekly card</li>
        <li>Shareable link</li>
      </ul>
      <p className="text-[15px] text-[var(--lm-bright)] mb-8">£49 one-time</p>
      {checkoutUrl ? (
        <a href={checkoutUrl} className="lm-btn lm-btn-primary inline-block">
          Continue to checkout
        </a>
      ) : (
        <p className="text-[12px] text-[var(--lm-muted)]">
          Checkout is not configured yet. Set POLAR_CHECKOUT_URL in your environment.
        </p>
      )}
      <p className="mt-10">
        <Link href="/dashboard" className="lm-link text-[12px]">
          ← Back to dashboard
        </Link>
      </p>
    </main>
  );
}
