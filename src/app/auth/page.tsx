"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import { PitcherFigure } from "@/components/PitcherFigure";
import { login, signup, verifyEmail, resendCode, NotVerifiedError } from "@/lib/api";

type VerifyState = { email: string; devCode?: string; dest: string };

export default function AuthPage() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [verify, setVerify] = useState<VerifyState | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#login") {
      setMode("login");
    }
  }, []);

  return (
    <div className="grid lg:grid-cols-[560px_1fr] min-h-screen">
      {/* Brand panel */}
      <aside
        className="relative flex flex-col justify-between"
        style={{
          padding: "36px 40px",
          borderRight: "1px solid var(--color-line)",
          background: "var(--color-bg-1)",
        }}
      >
        <div className="grid-fine" style={{ opacity: 0.5 }} />
        <div className="relative flex justify-between items-center">
          <Logo size={20} />
          <Chip variant="acc" dot>OPEN BETA</Chip>
        </div>

        <div className="relative justify-center items-center flex-1 hidden lg:flex">
          <div style={{ width: "min(460px, 92%)" }}>
            <PitcherFigure pose="release" showAnnotations={false} showGrid={false} />
          </div>
        </div>

        <div
          className="relative flex justify-between mono"
          style={{ fontSize: 10.5, color: "var(--color-fg-3)", letterSpacing: "0.14em" }}
        >
          <span>SUBJECT 0142 · RH</span>
          <span>KINETICSCORE 78</span>
          <span>2026.05.19</span>
        </div>
      </aside>

      {/* Form panel */}
      <section
        className="relative flex flex-col justify-center"
        style={{ padding: "48px clamp(24px, 6vw, 80px)" }}
      >
        <span className="crosshair" style={{ top: 24, right: 24 }} />
        {verify ? (
          <VerifyPanel
            state={verify}
            onVerified={() => router.push(verify.dest)}
            onBack={() => setVerify(null)}
          />
        ) : mode === "signup" ? (
          <SignupForm onSwitch={() => setMode("login")} onNeedVerify={setVerify} />
        ) : (
          <LoginForm onSwitch={() => setMode("signup")} onSubmit={() => router.push("/dashboard")} onNeedVerify={setVerify} />
        )}
      </section>
    </div>
  );
}

function SignupForm({ onSwitch, onNeedVerify }: { onSwitch: () => void; onNeedVerify: (v: VerifyState) => void }) {
  const [hand, setHand] = useState<"RH" | "LH">("RH");
  const [consentAge, setConsentAge] = useState(true);
  const [consentProc, setConsentProc] = useState(true);
  const [consentAnaly, setConsentAnaly] = useState(true);
  const [consentShare, setConsentShare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const yyyy = fd.get("dob_y") as string;
    const mm = fd.get("dob_m") as string;
    const dd = fd.get("dob_d") as string;
    const dob = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;

    setLoading(true);
    try {
      const res = await signup({
        email, password,
        date_of_birth: dob,
        handedness: hand,
        consent_age: consentAge,
        consent_processing: consentProc,
        consent_analytics: consentAnaly,
        consent_share: consentShare,
      });
      // Don't log in yet — go verify the emailed code first.
      onNeedVerify({ email: res.email, devCode: res.devCode, dest: "/upload" });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "가입 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 460 }}>
      <div
        className="flex justify-between items-center mono mb-9 flex-wrap gap-2"
        style={{ fontSize: 11, color: "var(--color-fg-3)", letterSpacing: "0.16em" }}
      >
        <span>STEP 02 / 03 · 가입</span>
        <span>
          이미 계정이 있나요?{" "}
          <Link href="#" style={{ color: "var(--color-acc)" }} onClick={(e) => { e.preventDefault(); onSwitch(); }}>
            로그인
          </Link>
        </span>
      </div>

      <h1 style={{ fontSize: "clamp(34px, 4.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 12 }}>
        분석실에<br />오신 것을 환영합니다.
      </h1>
      <p style={{ color: "var(--color-fg-2)", fontSize: 14, margin: "0 0 36px" }}>
        데이터·법무 정책상 <span style={{ color: "var(--color-acc)" }}>만 18세 이상</span>만 가입할 수 있습니다.
        미달 시 가입 자체가 거부됩니다.
      </p>

      {err && (
        <div
          className="mono mb-5"
          style={{
            fontSize: 11.5, color: "var(--color-danger)", letterSpacing: "0.08em",
            padding: "10px 14px", border: "1px solid var(--color-danger)",
            background: "var(--color-bg-1)", borderRadius: "var(--radius-pl-sm)",
          }}
        >
          {err}
        </div>
      )}

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div>
          <Label>투구 손</Label>
          <div className="grid grid-cols-2 gap-2">
            <HandOption value="RH" label="우완 RH" checked={hand === "RH"} onChange={() => setHand("RH")} />
            <HandOption value="LH" label="좌완 LH" checked={hand === "LH"} onChange={() => setHand("LH")} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="email">이메일</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div>
            <Label htmlFor="pw">비밀번호</Label>
            <Input id="pw" name="password" type="password" placeholder="8자 이상" minLength={8} required />
          </div>
        </div>

        <div>
          <Label>생년월일 — 18세 이상 확인</Label>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
            <Input name="dob_y" placeholder="YYYY" maxLength={4} inputMode="numeric" required />
            <Input name="dob_m" placeholder="MM" maxLength={2} inputMode="numeric" required />
            <Input name="dob_d" placeholder="DD" maxLength={2} inputMode="numeric" required />
            <div
              className="mono"
              style={{
                padding: "0 14px", height: 44,
                display: "flex", alignItems: "center", gap: 8,
                background: "var(--color-acc-soft)",
                border: "1px solid var(--color-acc)",
                borderRadius: "var(--radius-pl-sm)",
                fontSize: 11, color: "var(--color-acc)", letterSpacing: "0.1em",
                whiteSpace: "nowrap",
              }}
            >
              <span>✓</span><span>18세 이상</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 8, border: "1px solid var(--color-line-2)", borderRadius: "var(--radius-pl-sm)", overflow: "hidden" }}>
          <ConsentRow type="필수" text="만 18세 이상임을 확인합니다." required checked={consentAge} onChange={setConsentAge} />
          <ConsentRow type="필수" text="분석을 위한 영상 처리 및 30일 자동 삭제에 동의합니다." required checked={consentProc} onChange={setConsentProc} />
          <ConsentRow type="선택" text="익명화된 지표 수치를 모델 개선에 활용하는 것에 동의합니다." checked={consentAnaly} onChange={setConsentAnaly} />
          <ConsentRow type="선택" text="분석 결과를 외부 공유(임베드 링크 발급)할 수 있도록 합니다." checked={consentShare} onChange={setConsentShare} />
        </div>

        <Button variant="primary" size="lg" full type="submit" style={{ marginTop: 8 }} disabled={loading}>
          {loading ? "인증 코드 발송 중…" : "이메일 인증 코드 받기 →"}
        </Button>

        <p
          style={{
            fontSize: 12, color: "var(--color-fg-3)",
            lineHeight: 1.55, textAlign: "center", margin: 0,
          }}
        >
          본 서비스는 의료 진단·치료 도구가 아닙니다. 통증·부상 의심 시 전문 의료기관의 진료를 받으세요.
        </p>
      </form>
    </div>
  );
}

function LoginForm({ onSwitch, onSubmit, onNeedVerify }: { onSwitch: () => void; onSubmit: () => void; onNeedVerify: (v: VerifyState) => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    setLoading(true);
    try {
      await login(email, password);
      onSubmit();
    } catch (ex) {
      if (ex instanceof NotVerifiedError) {
        // Account exists but isn't verified — re-issue a code and route to verification.
        try {
          const res = await resendCode(ex.email);
          onNeedVerify({ email: ex.email, devCode: res.devCode, dest: "/dashboard" });
          return;
        } catch {
          setErr("이메일 인증이 필요합니다. 인증 코드 재발송에 실패했습니다.");
        }
      } else {
        setErr(ex instanceof Error ? ex.message : "로그인 실패");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 380 }}>
      <div
        className="flex justify-between items-center mono mb-9 flex-wrap gap-2"
        style={{ fontSize: 11, color: "var(--color-fg-3)", letterSpacing: "0.16em" }}
      >
        <span>로그인</span>
        <span style={{ color: "var(--color-fg-2)" }}>
          처음이신가요?{" "}
          <Link href="#" style={{ color: "var(--color-acc)" }} onClick={(e) => { e.preventDefault(); onSwitch(); }}>
            가입
          </Link>
        </span>
      </div>

      <h1 style={{ fontSize: "clamp(36px, 5vw, 46px)", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 14 }}>
        다시 만나서<br />반갑습니다.
      </h1>
      <p style={{ color: "var(--color-fg-2)", fontSize: 14, margin: "0 0 36px" }}>
        지난 분석 결과와 새로운 영상이 기다리고 있습니다.
      </p>

      {err && (
        <div
          className="mono mb-5"
          style={{
            fontSize: 11.5, color: "var(--color-danger)", letterSpacing: "0.08em",
            padding: "10px 14px", border: "1px solid var(--color-danger)",
            background: "var(--color-bg-1)", borderRadius: "var(--radius-pl-sm)",
          }}
        >
          {err}
        </div>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <div>
          <Label htmlFor="email-l">이메일</Label>
          <Input id="email-l" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div>
          <Label htmlFor="pw-l">
            <span className="flex justify-between">
              <span>비밀번호</span>
              <a href="#" style={{ color: "var(--color-fg-2)", textTransform: "none", letterSpacing: "normal", fontSize: 11 }}>
                잊으셨나요?
              </a>
            </span>
          </Label>
          <Input id="pw-l" name="password" type="password" placeholder="••••••••" required />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer mt-1">
          <span
            className="rounded-[2px] inline-flex items-center justify-center text-[10px] font-bold"
            style={{
              width: 16, height: 16,
              border: "1.5px solid var(--color-acc)",
              background: "var(--color-acc)",
              color: "var(--color-acc-fg)",
            }}
          >
            ✓
          </span>
          <span style={{ fontSize: 13, color: "var(--color-fg-1)" }}>로그인 상태 유지</span>
        </label>

        <Button variant="primary" size="lg" full type="submit" style={{ marginTop: 8 }} disabled={loading}>
          {loading ? "로그인 중…" : "로그인 →"}
        </Button>

        <div className="flex items-center gap-3.5 my-3">
          <div className="flex-1 h-px" style={{ background: "var(--color-line)" }} />
          <span className="mono" style={{ fontSize: 10, color: "var(--color-fg-3)", letterSpacing: "0.18em" }}>또는</span>
          <div className="flex-1 h-px" style={{ background: "var(--color-line)" }} />
        </div>

        {[
          { icon: "G", label: "Google로 계속" },
          { icon: "", label: "Apple로 계속" },
          { icon: "K", label: "Kakao로 계속" },
        ].map((o, i) => (
          <Button
            key={i}
            type="button"
            variant="ghost"
            full
            style={{ justifyContent: "flex-start", height: 44, fontWeight: 500, fontFamily: "var(--font-body)", letterSpacing: "normal" }}
          >
            <span
              className="rounded-full inline-flex items-center justify-center mono"
              style={{
                width: 22, height: 22,
                background: "var(--color-bg-2)",
                border: "1px solid var(--color-line-2)",
                fontSize: 11,
                color: "var(--color-fg-1)",
              }}
            >
              {o.icon}
            </span>
            <span>{o.label}</span>
          </Button>
        ))}

        <p
          style={{
            fontSize: 11.5, color: "var(--color-fg-3)",
            lineHeight: 1.55, textAlign: "center", marginTop: 12,
          }}
        >
          로그인하면 <a href="#" style={{ color: "var(--color-fg-2)" }}>이용약관</a> 및{" "}
          <a href="#" style={{ color: "var(--color-fg-2)" }}>개인정보처리방침</a>에 동의하는 것으로 간주됩니다.
        </p>
      </form>
    </div>
  );
}

function VerifyPanel({
  state,
  onVerified,
  onBack,
}: {
  state: VerifyState;
  onVerified: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>(state.devCode);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await verifyEmail(state.email, code);
      onVerified();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "인증 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setErr(null);
    setResent(false);
    try {
      const res = await resendCode(state.email);
      setDevCode(res.devCode);
      setResent(true);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "재발송 실패");
    }
  };

  return (
    <div style={{ maxWidth: 420 }}>
      <div
        className="flex justify-between items-center mono mb-9 flex-wrap gap-2"
        style={{ fontSize: 11, color: "var(--color-fg-3)", letterSpacing: "0.16em" }}
      >
        <span>STEP 03 / 03 · 이메일 인증</span>
        <Link href="#" style={{ color: "var(--color-acc)" }} onClick={(e) => { e.preventDefault(); onBack(); }}>
          ← 돌아가기
        </Link>
      </div>

      <h1 style={{ fontSize: "clamp(32px, 4.5vw, 42px)", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 12 }}>
        이메일을<br />확인해 주세요.
      </h1>
      <p style={{ color: "var(--color-fg-2)", fontSize: 14, margin: "0 0 28px" }}>
        <span style={{ color: "var(--color-acc)" }}>{state.email}</span> 으로 보낸 6자리 인증 코드를 입력하세요.
      </p>

      {devCode && (
        <div
          className="mono mb-5"
          style={{
            fontSize: 12, color: "var(--color-acc)", letterSpacing: "0.06em",
            padding: "12px 14px", border: "1px dashed var(--color-acc)",
            background: "var(--color-acc-soft)", borderRadius: "var(--radius-pl-sm)",
            lineHeight: 1.5,
          }}
        >
          데모 환경(메일 서버 미연결): 인증 코드는 <b style={{ fontSize: 15 }}>{devCode}</b>
          {resent && <span style={{ color: "var(--color-fg-2)" }}> · 재발송됨</span>}
        </div>
      )}

      {err && (
        <div
          className="mono mb-5"
          style={{
            fontSize: 11.5, color: "var(--color-danger)", letterSpacing: "0.08em",
            padding: "10px 14px", border: "1px solid var(--color-danger)",
            background: "var(--color-bg-1)", borderRadius: "var(--radius-pl-sm)",
          }}
        >
          {err}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="vcode">인증 코드</Label>
          <Input
            id="vcode"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6자리 숫자"
            inputMode="numeric"
            maxLength={6}
            required
            style={{ letterSpacing: "0.4em", fontFamily: "var(--font-mono)", fontSize: 18 }}
          />
        </div>

        <Button variant="primary" size="lg" full type="submit" disabled={loading || code.length !== 6}>
          {loading ? "인증 중…" : "인증하고 계속 →"}
        </Button>

        <button
          type="button"
          onClick={handleResend}
          className="mono cursor-pointer"
          style={{ fontSize: 11.5, color: "var(--color-fg-2)", background: "none", border: "none", letterSpacing: "0.08em" }}
        >
          코드를 받지 못하셨나요? <span style={{ color: "var(--color-acc)" }}>재발송</span>
        </button>
      </form>
    </div>
  );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block mono uppercase mb-2"
      style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--color-fg-2)" }}
    >
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        background: "var(--color-bg-1)",
        border: "1px solid var(--color-line-2)",
        borderRadius: "var(--radius-pl-sm)",
        height: 44, padding: "0 14px",
        fontFamily: "var(--font-body)", fontSize: 14,
        color: "var(--color-fg-0)", width: "100%", outline: "none",
        transition: "border-color .15s, background .15s",
        ...(props.style ?? {}),
      }}
    />
  );
}

function HandOption({ value, label, checked, onChange }: { value: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      className="cursor-pointer flex justify-between items-center"
      style={{
        padding: "12px 16px",
        border: `1px solid ${checked ? "var(--color-acc)" : "var(--color-line-2)"}`,
        background: checked ? "var(--color-acc-soft)" : undefined,
        borderRadius: "var(--radius-pl-sm)",
        color: checked ? "var(--color-fg-0)" : "var(--color-fg-1)",
        fontSize: 14,
      }}
    >
      <input type="radio" name="hand" value={value} checked={checked} onChange={onChange} className="hidden" />
      <span>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: checked ? "var(--color-acc)" : "var(--color-fg-3)" }}>
        {checked ? "●" : "○"}
      </span>
    </label>
  );
}

function ConsentRow({
  type, text, required, checked, onChange,
}: {
  type: "필수" | "선택"; text: string; required?: boolean; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-3.5 cursor-pointer"
      style={{ padding: "14px 16px", borderTop: "1px solid var(--color-line)" }}
    >
      <input
        type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={required}
        className="hidden"
      />
      <span
        className="inline-flex items-center justify-center rounded-[2px] flex-shrink-0"
        style={{
          width: 18, height: 18,
          border: `1.5px solid ${checked ? "var(--color-acc)" : "var(--color-line-strong)"}`,
          background: checked ? "var(--color-acc)" : "transparent",
          color: "var(--color-acc-fg)",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {checked && "✓"}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10, padding: "2px 6px", borderRadius: 2, letterSpacing: "0.1em",
          background: required ? "var(--color-acc-soft)" : "var(--color-bg-2)",
          color: required ? "var(--color-acc)" : "var(--color-fg-2)",
        }}
      >
        {type}
      </span>
      <span style={{ fontSize: 13, color: "var(--color-fg-1)", flex: 1 }}>{text}</span>
    </label>
  );
}
