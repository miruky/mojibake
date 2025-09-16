import { describe, expect, it } from 'vitest';
import { detectBom, parseBytes, parseHex, parsePercent, toHexDump } from './bytes';

describe('parseHex', () => {
  it('空白・カンマ・0x接頭辞を許す', () => {
    expect(parseHex('e3 81, 0x82')).toEqual(new Uint8Array([0xe3, 0x81, 0x82]));
    expect(parseHex('E38182')).toEqual(new Uint8Array([0xe3, 0x81, 0x82]));
  });

  it('奇数桁や16進以外はnull', () => {
    expect(parseHex('e38')).toBeNull();
    expect(parseHex('xyz')).toBeNull();
  });
});

describe('parsePercent', () => {
  it('URLエンコードを読む', () => {
    expect(parsePercent('%E3%81%82a')).toEqual(new Uint8Array([0xe3, 0x81, 0x82, 0x61]));
  });

  it('パーセントが1つもなければnull', () => {
    expect(parsePercent('abc')).toBeNull();
  });
});

describe('parseBytes', () => {
  it('16進・パーセント・Base64を判別する', () => {
    expect(parseBytes('e3 81 82')?.format).toBe('hex');
    expect(parseBytes('%E3%81%82')?.format).toBe('percent');
    expect(parseBytes('44GC')?.format).toBe('base64');
    expect(parseBytes('44GC')?.bytes).toEqual(new Uint8Array([0xe3, 0x81, 0x82]));
  });

  it('どれでもなければnull', () => {
    expect(parseBytes('こんにちは')).toBeNull();
  });
});

describe('toHexDump / detectBom', () => {
  it('小文字2桁区切りで出力する', () => {
    expect(toHexDump(new Uint8Array([0xe3, 0x81, 0x82]))).toBe('e3 81 82');
  });

  it('BOMを見分ける', () => {
    expect(detectBom(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toContain('UTF-8');
    expect(detectBom(new Uint8Array([0xff, 0xfe]))).toBe('UTF-16LE');
    expect(detectBom(new Uint8Array([0x61, 0x62]))).toBeNull();
  });
});
