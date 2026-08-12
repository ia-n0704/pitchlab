import { Suspense } from "react";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { DashboardView } from "@/components/DashboardView";
import { AuthGuard } from "@/components/AuthGuard";

export default function DashboardPage() {
  return (
    <>
      <NavBar mode="app" />
      <AuthGuard>
        <Suspense fallback={<div className="p-12 mono" style={{ color: "var(--color-fg-3)" }}>LOADING…</div>}>
          <DashboardView />
        </Suspense>
      </AuthGuard>
      <Footer />
    </>
  );
}
