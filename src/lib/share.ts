// 入力とモードをURLのハッシュに載せて共有できるようにする。
// 化けた文字列は環境を越えて貼り直すと壊れることがあるため、URLへの符号化で安全に渡す。

export type ShareMode = 'garbled' | 'bytes';

export interface ShareState {
  mode: ShareMode;
  input: string;
}

const PREFIX = 'm1:';

// マルチバイト文字を含む文字列をURL安全なbase64へ。btoaはLatin-1しか扱えないため
// 先にUTF-8のバイト列へ落としてから符号化する。
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeState(state: ShareState): string {
  const compact = { m: state.mode === 'bytes' ? 'b' : 'g', i: state.input };
  return PREFIX + toBase64Url(JSON.stringify(compact));
}

export function decodeState(raw: string): ShareState | null {
  const trimmed = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!trimmed.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length))) as Record<
      string,
      unknown
    >;
    if (typeof parsed.i !== 'string') return null;
    return { mode: parsed.m === 'b' ? 'bytes' : 'garbled', input: parsed.i };
  } catch {
    return null;
  }
}
