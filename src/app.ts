import { decodeCandidates, explainGarbled } from './lib/analyze';
import { detectBom, parseBytes, toHexDump } from './lib/bytes';

const SAMPLE_GARBLED = '縺薙ｓ縺ｫ縺｡縺ｯ縲∽ｸ也阜';
const SAMPLE_BYTES = '82 b1 82 f1 82 c9 82 bf 82 cd 81 41 90 a2 8a 45';

const LOGO_SVG = `
<svg viewBox="0 0 64 64" width="44" height="44" role="img" aria-label="mojibakeのロゴ">
  <title>mojibake</title>
  <rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke="currentColor" stroke-width="4"/>
  <text x="18" y="38" font-size="20" font-family="monospace" fill="#e8b04b">8F</text>
  <path d="M40 24l8 16M48 24l-8 16" stroke="#ff8a76" stroke-width="4" stroke-linecap="round"/>
</svg>`;

type Mode = 'garbled' | 'bytes';

export class App {
  private readonly el: Record<string, HTMLElement> = {};
  private mode: Mode = 'garbled';

  constructor(private readonly root: HTMLElement) {
    this.render();
    this.wire();
  }

  private render(): void {
    this.root.innerHTML = `
      <header class="site-header">
        <span class="logo" aria-hidden="true">${LOGO_SVG}</span>
        <div>
          <h1>mojibake</h1>
          <p class="tagline">文字化けの原因を逆引きするエンコーディング解析器</p>
        </div>
      </header>
      <main>
        <section class="pane">
          <div class="pane-head">
            <div class="tabs">
              <button type="button" class="tab-btn active" data-id="tab-garbled">化けた文字から</button>
              <button type="button" class="tab-btn" data-id="tab-bytes">バイト列から</button>
            </div>
            <button type="button" class="ghost-btn" data-id="sample">サンプルを読み込む</button>
          </div>
          <p class="hint" data-id="mode-hint">画面に表示された化けた文字列を貼ると、「何で書かれたものを何として誤読したか」の組み合わせを総当たりして復元候補を出す</p>
          <textarea data-id="input" rows="5" spellcheck="false" placeholder="${SAMPLE_GARBLED}"></textarea>
          <p class="byte-note" data-id="byte-note" hidden></p>
        </section>
        <section class="pane">
          <h2>解析結果</h2>
          <div class="results" data-id="results">(入力すると候補が表示される)</div>
        </section>
      </main>
      <footer class="site-footer">
        <p>対応: UTF-8、Shift_JIS(CP932)、EUC-JP、ISO-2022-JP、Windows-1252、UTF-16LE/BE。Shift_JISとEUC-JPの逆引き表はブラウザのTextDecoderから実行時に構築する。解析はすべてブラウザ内で行う。</p>
      </footer>
    `;
    this.root.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      this.el[node.dataset.id ?? ''] = node;
    });
  }

  private wire(): void {
    const input = this.el['input'] as HTMLTextAreaElement;
    input.addEventListener('input', () => this.update());
    this.el['tab-garbled']!.addEventListener('click', () => this.switchMode('garbled'));
    this.el['tab-bytes']!.addEventListener('click', () => this.switchMode('bytes'));
    this.el['sample']!.addEventListener('click', () => {
      input.value = this.mode === 'garbled' ? SAMPLE_GARBLED : SAMPLE_BYTES;
      this.update();
    });
  }

  private switchMode(mode: Mode): void {
    this.mode = mode;
    this.el['tab-garbled']!.classList.toggle('active', mode === 'garbled');
    this.el['tab-bytes']!.classList.toggle('active', mode === 'bytes');
    const input = this.el['input'] as HTMLTextAreaElement;
    input.placeholder = mode === 'garbled' ? SAMPLE_GARBLED : SAMPLE_BYTES;
    this.el['mode-hint']!.textContent =
      mode === 'garbled'
        ? '画面に表示された化けた文字列を貼ると、「何で書かれたものを何として誤読したか」の組み合わせを総当たりして復元候補を出す'
        : 'バイト列(16進ダンプ・%エンコード・Base64)を貼ると、全エンコーディングで復号して日本語らしさ順に並べる';
    input.value = '';
    this.update();
  }

  private update(): void {
    const text = (this.el['input'] as HTMLTextAreaElement).value;
    const results = this.el['results']!;
    const byteNote = this.el['byte-note']!;
    byteNote.hidden = true;
    if (text.trim() === '') {
      results.textContent = '(入力すると候補が表示される)';
      return;
    }
    if (this.mode === 'garbled') this.renderGarbled(text, results);
    else this.renderBytes(text, results, byteNote);
  }

  private renderGarbled(text: string, results: HTMLElement): void {
    const candidates = explainGarbled(text).slice(0, 6);
    if (candidates.length === 0) {
      results.textContent =
        '復元候補が見つからない。化け方が二重(2回誤読)か、対応外のエンコーディングの可能性がある';
      return;
    }
    results.innerHTML = '';
    candidates.forEach((candidate, index) => {
      const card = document.createElement('div');
      card.className = index === 0 ? 'result-card best' : 'result-card';
      card.innerHTML = `
        <p class="result-cause">${candidate.originalName} で書かれたバイト列を ${candidate.misreadName} として読んだ</p>
        <p class="result-text">${escapeHtml(candidate.recovered)}</p>
        <p class="result-meta">らしさ ${candidate.score.toFixed(2)}${index === 0 ? ' / 最有力' : ''}</p>`;
      results.appendChild(card);
    });
  }

  private renderBytes(text: string, results: HTMLElement, byteNote: HTMLElement): void {
    const parsed = parseBytes(text);
    if (!parsed) {
      results.textContent =
        'バイト列として読めない。16進(e3 81 82)・%エンコード・Base64を受け付ける';
      return;
    }
    const bom = detectBom(parsed.bytes);
    byteNote.hidden = false;
    byteNote.textContent =
      `${parsed.bytes.length}バイト(${parsed.format}として解釈)` +
      (bom ? ` / 先頭にBOM: ${bom}` : '') +
      ` / ${toHexDump(parsed.bytes.slice(0, 24))}${parsed.bytes.length > 24 ? ' ...' : ''}`;

    const candidates = decodeCandidates(parsed.bytes);
    results.innerHTML = '';
    candidates.forEach((candidate, index) => {
      const card = document.createElement('div');
      card.className = index === 0 && candidate.score > 0 ? 'result-card best' : 'result-card';
      const preview =
        candidate.text.length > 160 ? `${candidate.text.slice(0, 160)}...` : candidate.text;
      card.innerHTML = `
        <p class="result-cause">${candidate.encodingName} として復号</p>
        <p class="result-text">${escapeHtml(preview)}</p>
        <p class="result-meta">らしさ ${candidate.score.toFixed(2)} / 復号失敗 ${candidate.replacementCount}文字</p>`;
      results.appendChild(card);
    });
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
