export function Footer() {
  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-4 mono"
      style={{
        padding: "32px clamp(20px, 4vw, 56px)",
        borderTop: "1px solid var(--color-line)",
        fontSize: 11,
        color: "var(--color-fg-3)",
        letterSpacing: "0.14em",
      }}
    >
      <div>© 2026 PITCHLAB · OPEN BETA</div>
      <div className="flex flex-wrap gap-8">
        <a href="#">이용약관</a>
        <a href="#">개인정보처리방침</a>
        <a href="#">의료 면책 고지</a>
        <a href="#">문의</a>
      </div>
    </footer>
  );
}

export function MedicalNotice({ extra }: { extra?: string }) {
  return (
    <div
      className="mono"
      style={{
        padding: "18px clamp(20px, 4vw, 56px)",
        borderTop: "1px solid var(--color-line)",
        background: "var(--color-bg-1)",
        fontSize: 11,
        color: "var(--color-fg-3)",
        letterSpacing: "0.1em",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span>본 분석은 참고용 정보이며 의료 진단이 아닙니다. 통증 지속 시 전문 의료기관을 찾으세요.</span>
      {extra && <span>{extra}</span>}
    </div>
  );
}
