// バイト列入力の解釈。16進ダンプ・パーセントエンコード・Base64を受け付ける

export function parseHex(text: string): Uint8Array | null {
  const cleaned = text.replace(/0x/gi, '').replace(/[\s,;:、]+/g, '');
  if (cleaned === '' || !/^[0-9a-f]+$/i.test(cleaned) || cleaned.length % 2 !== 0) return null;
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function parsePercent(text: string): Uint8Array | null {
  const trimmed = text.trim();
  if (!/%[0-9a-f]{2}/i.test(trimmed)) return null;
  const out: number[] = [];
  for (let i = 0; i < trimmed.length; ) {
    if (trimmed[i] === '%' && /^[0-9a-f]{2}$/i.test(trimmed.slice(i + 1, i + 3))) {
      out.push(Number.parseInt(trimmed.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      const code = trimmed.codePointAt(i)!;
      if (code > 0x7f) return null; // 非ASCIIが混ざるならパーセント形式ではない
      out.push(code);
      i += 1;
    }
  }
  return new Uint8Array(out);
}

export function parseBase64(text: string): Uint8Array | null {
  const cleaned = text.replace(/\s+/g, '');
  if (cleaned === '' || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    return null;
  }
  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export interface ParsedBytes {
  bytes: Uint8Array;
  format: 'hex' | 'percent' | 'base64';
}

// 16進を最優先で試す。判別できなければnull
export function parseBytes(text: string): ParsedBytes | null {
  const hex = parseHex(text);
  if (hex) return { bytes: hex, format: 'hex' };
  const percent = parsePercent(text);
  if (percent) return { bytes: percent, format: 'percent' };
  const base64 = parseBase64(text);
  if (base64) return { bytes: base64, format: 'base64' };
  return null;
}

export function toHexDump(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

// 先頭のBOMからエンコーディングを推定する。なければnull
export function detectBom(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'UTF-8(BOMつき)';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'UTF-16LE';
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'UTF-16BE';
  return null;
}
