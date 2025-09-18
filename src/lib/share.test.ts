import { describe, expect, it } from 'vitest';
import { decodeState, encodeState } from './share';

describe('share', () => {
  it('化けた文字列を符号化して元に戻せる', () => {
    const state = { mode: 'garbled' as const, input: '縺薙ｓ縺ｫ縺｡縺ｯ縲∽ｸ也阜' };
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('バイト列モードも往復できる', () => {
    const state = { mode: 'bytes' as const, input: '82 b1 82 f1' };
    const url = encodeState(state);
    expect(url.startsWith('m1:')).toBe(true);
    expect(decodeState(`#${url}`)).toEqual(state);
  });

  it('接頭辞のないハッシュはnull', () => {
    expect(decodeState('#nothing')).toBeNull();
    expect(decodeState('')).toBeNull();
  });

  it('壊れた符号はnull', () => {
    expect(decodeState('m1:%%%not-base64%%%')).toBeNull();
  });
});
