// 画面で使うSVGアイコン。すべてviewBox付き・currentColor追従で、寸法はCSSで与える。
// 装飾はaria-hidden、意味を持つものは呼び出し側でaria-labelを補う。

// 文字セルが割れて化けるモチーフ。枠は currentColor、割れ目はアクセント。
export const logoMark = `
<svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
  <rect x="6" y="6" width="28" height="28" rx="5" stroke="currentColor" stroke-width="2.4"/>
  <path d="M20 6.5l-4 13 7 1-4 13" stroke="var(--accent)" stroke-width="2.4"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="13" cy="13" r="1.5" fill="currentColor"/>
  <circle cx="27" cy="27" r="1.5" fill="currentColor"/>
</svg>`;

export const sun = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" aria-hidden="true">
  <circle cx="12" cy="12" r="4.2"/>
  <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>
</svg>`;

export const moon = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/>
</svg>`;

export const monitor = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="4.5" width="18" height="12" rx="1.6"/>
  <path d="M9 20h6M12 16.5V20"/>
</svg>`;

export const copy = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="9" y="9" width="11" height="11" rx="2"/>
  <path d="M5 15V5a2 2 0 0 1 2-2h8"/>
</svg>`;
