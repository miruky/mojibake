// バイト列の総当たりデコードと、化けた文字列からの逆引き

import { decodeAs, encodeAs, ENCODINGS } from './encodings';

// 「読める文章らしさ」の採点。復号失敗(U+FFFD)と制御文字を強く減点し、
// かな・漢字を最も高く、ハングルやキリルなど他言語の文字も加点する。
// 日本語の重みを最大に保ちつつ、中国語・韓国語・キリルの復号も正しく評価できるようにする。
export function textScore(text: string): number {
  if (text.length === 0) return 0;
  let score = 0;
  let count = 0;
  for (const char of text) {
    count += 1;
    const code = char.codePointAt(0)!;
    if (char === '�') score -= 4;
    else if (code < 0x20 && char !== '\n' && char !== '\t' && char !== '\r') score -= 3;
    else if (code >= 0x3040 && code <= 0x30ff)
      score += 3; // ひらがな・カタカナ
    else if (code >= 0x4e00 && code <= 0x9fff)
      score += 2.5; // 漢字(CJK統合漢字)
    else if (code >= 0xac00 && code <= 0xd7a3)
      score += 2.5; // ハングル音節
    else if (code >= 0x0400 && code <= 0x04ff)
      score += 2; // キリル文字
    else if (code >= 0x3000 && code <= 0x303f)
      score += 2; // 和文記号
    else if (code >= 0xff01 && code <= 0xff60)
      score += 1.5; // 全角英数記号
    else if (code >= 0xff61 && code <= 0xff9f)
      score += 1; // 半角カナ
    else if ((code >= 0x20 && code <= 0x7e) || char === '\n' || char === '\t')
      score += 1; // 基本ラテン
    else if (code >= 0xa1 && code <= 0xff)
      score += 0.3; // ラテン1補助(西欧の余地)
    else score -= 1.5; // 文章に現れにくい領域
  }
  return score / count;
}

export interface DecodeCandidate {
  encodingId: string;
  encodingName: string;
  region: string;
  text: string;
  score: number;
  replacementCount: number;
}

// バイト列を全候補エンコーディングで復号し、らしさ順に並べる
export function decodeCandidates(bytes: Uint8Array): DecodeCandidate[] {
  const results: DecodeCandidate[] = [];
  for (const { id, name, region } of ENCODINGS) {
    const text = decodeAs(bytes, id);
    if (text === null) continue;
    results.push({
      encodingId: id,
      encodingName: name,
      region,
      text,
      score: textScore(text),
      replacementCount: [...text].filter((c) => c === '�').length,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

export interface GarbleCandidate {
  // 元の文字列はoriginalNameで書かれていたのに、misreadNameとして読まれた
  originalId: string;
  originalName: string;
  misreadId: string;
  misreadName: string;
  recovered: string;
  score: number;
}

// 化けた文字列から「誤読の組み合わせ」を総当たりし、復元候補をらしさ順に返す。
// 化けた表示をmisreadのバイト列に戻し、originalとして読み直す。
// UTF-16は任意のバイト列が偶然漢字の羅列になり偽陽性を生むため、復元元からは除く
export function explainGarbled(garbled: string): GarbleCandidate[] {
  const results: GarbleCandidate[] = [];
  for (const misread of ENCODINGS.filter((e) => e.reversible)) {
    const bytes = encodeAs(garbled, misread.id);
    if (!bytes) continue;
    for (const original of ENCODINGS) {
      if (!original.garbleSource || original.id === misread.id) continue;
      const recovered = decodeAs(bytes, original.id);
      if (recovered === null || recovered.includes('�')) continue;
      const score = textScore(recovered);
      if (score <= 0.5) continue; // 復元になっていない候補は出さない
      results.push({
        originalId: original.id,
        originalName: original.name,
        misreadId: misread.id,
        misreadName: misread.name,
        recovered,
        score,
      });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}
