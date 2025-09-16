import { describe, expect, it } from 'vitest';
import { decodeCandidates, explainGarbled, japaneseScore } from './analyze';
import { decodeAs, encodeAs } from './encodings';

describe('encodeAs(逆引きエンコーダ)', () => {
  it('Shift_JISへの往復で値が保たれる', () => {
    const bytes = encodeAs('こんにちは世界', 'shift_jis')!;
    expect(decodeAs(bytes, 'shift_jis')).toBe('こんにちは世界');
  });

  it('EUC-JPの半角カナも扱える', () => {
    const bytes = encodeAs('テストｱｲｳ', 'euc-jp')!;
    expect(decodeAs(bytes, 'euc-jp')).toBe('テストｱｲｳ');
  });

  it('表にない文字はnull', () => {
    expect(encodeAs('絵文字なし🙂', 'shift_jis')).toBeNull();
  });
});

describe('japaneseScore', () => {
  it('自然な日本語は復号失敗の混ざった文字列より高い', () => {
    expect(japaneseScore('こんにちは、世界。')).toBeGreaterThan(japaneseScore('縺薙ｓ�■縺ｯ'));
  });

  it('置換文字だらけの文字列は負になる', () => {
    expect(japaneseScore('����')).toBeLessThan(0);
  });
});

describe('decodeCandidates', () => {
  it('UTF-8のバイト列はUTF-8を最上位にする', () => {
    const bytes = new TextEncoder().encode('こんにちは、世界。改行も\nある。');
    const [top] = decodeCandidates(bytes);
    expect(top?.encodingId).toBe('utf-8');
    expect(top?.text).toContain('こんにちは');
  });

  it('Shift_JISのバイト列はShift_JISを最上位にする', () => {
    const bytes = encodeAs('お疲れさまです。本日の議事録を送ります。', 'shift_jis')!;
    const [top] = decodeCandidates(bytes);
    expect(top?.encodingId).toBe('shift_jis');
  });
});

describe('explainGarbled', () => {
  it('UTF-8をShift_JISと誤読した化け方を逆引きする', () => {
    const original = 'こんにちは';
    // UTF-8のバイト列をShift_JISとして読んでしまった表示を作る
    const garbled = decodeAs(new TextEncoder().encode(original), 'shift_jis')!;
    expect(garbled).not.toBe(original);
    const candidates = explainGarbled(garbled);
    const hit = candidates.find((c) => c.originalId === 'utf-8' && c.misreadId === 'shift_jis');
    expect(hit?.recovered).toBe(original);
    expect(candidates[0]?.recovered).toBe(original);
  });

  it('EUC-JPをWindows-1252と誤読した化け方を逆引きする', () => {
    const original = '日本語のテキスト';
    const garbled = decodeAs(encodeAs(original, 'euc-jp')!, 'windows-1252')!;
    const candidates = explainGarbled(garbled);
    const hit = candidates.find((c) => c.originalId === 'euc-jp' && c.misreadId === 'windows-1252');
    expect(hit?.recovered).toBe(original);
  });

  it('化けていない日本語には強い候補を出さない', () => {
    const candidates = explainGarbled('こんにちは');
    // 逆引き表に全文字が載る誤読元が存在しないため候補は出ないはず
    expect(candidates.filter((c) => c.score > 2)).toHaveLength(0);
  });
});
