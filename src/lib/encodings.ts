// 候補エンコーディングの定義と、TextDecoderを逆引きして作るエンコーダ

export interface EncodingDef {
  id: string; // TextDecoderのラベル
  name: string;
  // 化けた文字列の逆引き(再エンコード)対象にするか。
  // ISO-2022-JPは状態を持つため逆引きには使わない
  reversible: boolean;
}

export const ENCODINGS: EncodingDef[] = [
  { id: 'utf-8', name: 'UTF-8', reversible: true },
  { id: 'shift_jis', name: 'Shift_JIS(CP932)', reversible: true },
  { id: 'euc-jp', name: 'EUC-JP', reversible: true },
  { id: 'iso-2022-jp', name: 'ISO-2022-JP(JIS)', reversible: false },
  { id: 'windows-1252', name: 'Windows-1252(欧文)', reversible: true },
  { id: 'utf-16le', name: 'UTF-16LE', reversible: false },
  { id: 'utf-16be', name: 'UTF-16BE', reversible: false },
];

export function decodeAs(bytes: Uint8Array, id: string): string | null {
  try {
    return new TextDecoder(id, { fatal: false }).decode(bytes as BufferSource);
  } catch {
    return null; // 環境が対応しないラベル
  }
}

// 文字からバイト列への逆引き表。デコーダに全バイト列を食わせて構築する。
// Shift_JIS・EUC-JPのような表引きエンコーディングだけが対象
const reverseTables = new Map<string, Map<string, number[]>>();

function buildReverseTable(id: string): Map<string, number[]> {
  const table = new Map<string, number[]>();
  const note = (bytes: number[]) => {
    const text = decodeAs(new Uint8Array(bytes), id);
    if (text !== null && text.length === 1 && text !== '�') {
      if (!table.has(text)) table.set(text, bytes);
    }
  };
  // 1バイト全域と、日本語2バイト圏の全組み合わせを試す
  for (let b = 0; b < 0x100; b += 1) note([b]);
  if (id === 'shift_jis') {
    for (let lead = 0x81; lead <= 0xfc; lead += 1) {
      if (lead > 0x9f && lead < 0xe0) continue;
      for (let trail = 0x40; trail <= 0xfc; trail += 1) {
        if (trail === 0x7f) continue;
        note([lead, trail]);
      }
    }
  } else if (id === 'euc-jp') {
    for (let lead = 0xa1; lead <= 0xfe; lead += 1) {
      for (let trail = 0xa1; trail <= 0xfe; trail += 1) note([lead, trail]);
    }
    for (let trail = 0xa1; trail <= 0xdf; trail += 1) note([0x8e, trail]); // 半角カナ
  }
  return table;
}

// テキストを指定エンコーディングのバイト列に起こす。表にない文字が1つでもあればnull
export function encodeAs(text: string, id: string): Uint8Array | null {
  if (id === 'utf-8') return new TextEncoder().encode(text);
  let table = reverseTables.get(id);
  if (!table) {
    table = buildReverseTable(id);
    reverseTables.set(id, table);
  }
  const out: number[] = [];
  for (const char of text) {
    const bytes = table.get(char);
    if (!bytes) return null;
    out.push(...bytes);
  }
  return new Uint8Array(out);
}
