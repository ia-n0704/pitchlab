import { Suspense } from "react";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { DashboardView } from "@/components/DashboardView";

export default function DashboardPage() {
  return (
    <>
      <NavBar mode="app" />
      <Suspense fallback={<div className="p-12 mono" style={{ color: "var(--color-fg-3)" }}>LOADING…</div>}>
        <DashboardView />
      </Suspense>
      <Footer />
    </>
  );
}
