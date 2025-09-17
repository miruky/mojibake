// 控えめなモーション。すべて gsap.matchMedia で prefers-reduced-motion を尊重し、
// 動きを止めても最終状態は変わらないよう、要素は既定で可視・数値は先に確定させる。
import { gsap } from 'gsap';

const NO_MOTION = '(prefers-reduced-motion: no-preference)';
const mm = gsap.matchMedia();

// 読み込み時にヘッダと入力面を順に立ち上げる
export function playEntrance(scope: HTMLElement): void {
  mm.add(NO_MOTION, () => {
    const targets = scope.querySelectorAll('[data-enter]');
    if (targets.length === 0) return;
    gsap.from(targets, {
      y: 12,
      autoAlpha: 0,
      duration: 0.6,
      ease: 'power3.out',
      stagger: 0.06,
    });
  });
}

// 候補カードを下からわずかに送らせて立ち上げる
export function revealCards(cards: Element[]): void {
  if (cards.length === 0) return;
  mm.add(NO_MOTION, () => {
    gsap.from(cards, {
      autoAlpha: 0,
      y: 8,
      duration: 0.4,
      ease: 'power2.out',
      stagger: { each: 0.05, amount: Math.min(0.4, cards.length * 0.05) },
      overwrite: 'auto',
    });
  });
}

// らしさの数値を0から数え上げる。動きを止める設定では即座に最終値を表示する
export function countUp(el: HTMLElement, to: number, digits = 2): void {
  el.textContent = to.toFixed(digits);
  mm.add(NO_MOTION, () => {
    const proxy = { v: 0 };
    gsap.to(proxy, {
      v: to,
      duration: 0.5,
      ease: 'power1.out',
      onUpdate: () => {
        el.textContent = proxy.v.toFixed(digits);
      },
      onComplete: () => {
        el.textContent = to.toFixed(digits);
      },
    });
  });
}
