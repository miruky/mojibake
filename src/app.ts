import { decodeCandidates, explainGarbled } from './lib/analyze';
import { detectBom, parseBytes, toHexDump } from './lib/bytes';
import { decodeState, encodeState } from './lib/share';
import { copy, logoMark, monitor, moon, sun } from './ui/icons';
import { countUp, playEntrance, revealCards } from './ui/motion';

type Mode = 'garbled' | 'bytes';
type ThemeMode = 'light' | 'dark' | 'auto';

// モードごとの実例。サンプルボタンで順に切り替えて化け方の幅を見せる。
const SAMPLES: Record<Mode, string[]> = {
  garbled: ['縺薙ｓ縺ｫ縺｡縺ｯ縲∽ｸ也阜', 'ã“ã‚“ã«ã¡ã¯', '譁・喧縺代◆譁・ｭ怜・'],
  bytes: ['82 b1 82 f1 82 c9 82 bf 82 cd 81 41 90 a2 8a 45', '%E3%81%82%E3%81%84%E3%81%86'],
};

const STATE_KEY = 'mojibake-state';
const THEME_KEY = 'mojibake-theme';

const HINTS: Record<Mode, string> = {
  garbled:
    '画面に出た化けた文字列をそのまま貼る。「何で書かれたバイト列を、何として誤読したか」を総当たりして復元候補を出す。',
  bytes:
    '16進ダンプ・%エンコード・Base64のいずれかを貼る。全エンコーディングで復号し、読める文章らしさ順に並べる。',
};

export class App {
  private readonly el: Record<string, HTMLElement> = {};
  private mode: Mode = 'garbled';
  private sampleIndex = 0;
  private toastTimer = 0;

  constructor(private readonly root: HTMLElement) {
    this.render();
    this.cacheEls();
    this.restore();
    this.wire();
    this.updateThemeButtons();
    this.update();
    playEntrance(this.root);
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="shell">
        <header class="masthead">
          <div class="masthead__id" data-enter>
            <span class="masthead__mark">${logoMark}</span>
            <div>
              <p class="kicker">encoding forensics</p>
              <h1 class="masthead__title">mojibake</h1>
            </div>
          </div>
          <div class="seg" role="group" aria-label="配色テーマ" data-enter>
            <button type="button" data-theme-opt="light" aria-label="明るい配色" title="明るい配色">${sun}</button>
            <button type="button" data-theme-opt="auto" aria-label="OSの設定に従う" title="OSの設定に従う">${monitor}</button>
            <button type="button" data-theme-opt="dark" aria-label="暗い配色" title="暗い配色">${moon}</button>
          </div>
        </header>

        <p class="lede" data-enter>化けた文字列やバイト列を貼ると、「何を何として誤読したか」を総当たりで突き止め、元の文章を復元する。解析はすべてブラウザ内で完結する。</p>

        <section class="console" aria-label="入力" data-enter>
          <div class="console__head">
            <div class="seg seg--mode" role="group" aria-label="入力の種類">
              <button type="button" data-mode="garbled">化けた文字</button>
              <button type="button" data-mode="bytes">バイト列</button>
            </div>
            <div class="console__tools">
              <button type="button" class="txt-btn" data-act="sample">サンプル</button>
              <button type="button" class="txt-btn" data-act="share">共有リンク</button>
              <button type="button" class="txt-btn" data-act="clear">消去</button>
            </div>
          </div>
          <p class="hint" data-id="hint"></p>
          <textarea data-id="input" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
          <p class="byte-note" data-id="byte-note" hidden></p>
        </section>

        <section class="report" aria-label="解析結果">
          <div class="report__head">
            <h2 class="report__title"><span class="kicker">結果</span>復元候補</h2>
            <span class="count" data-id="count"></span>
          </div>
          <div class="findings" data-id="results"></div>
        </section>

        <footer class="footer">
          <p>復号は <code>TextDecoder</code> 標準を使い、Shift_JIS・EUC-JPの逆引き表は起動時に組み立てる。対応: UTF-8 / Shift_JIS / EUC-JP / ISO-2022-JP / Windows-1252 / GBK / Big5 / EUC-KR / Windows-1251 / UTF-16。貼ったデータは送信しない。</p>
          <p class="shortcuts">
            <kbd>g</kbd> 化けた文字&ensp;<kbd>b</kbd> バイト列&ensp;<kbd>e</kbd> 例&ensp;<kbd>l</kbd> 共有リンク
          </p>
        </footer>
      </div>
      <p class="sr-only" data-id="live" aria-live="polite"></p>
      <div class="toast" data-id="toast" role="status"></div>
    `;
  }

  private cacheEls(): void {
    this.root.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      this.el[node.dataset.id ?? ''] = node;
    });
  }

  private input(): HTMLTextAreaElement {
    return this.el['input'] as HTMLTextAreaElement;
  }

  // ---- 状態の保存と復元 ----

  private restore(): void {
    // 共有リンクのハッシュを最優先。無ければ前回の保存を読む。
    const shared = location.hash ? decodeState(location.hash) : null;
    if (shared) {
      this.mode = shared.mode;
      this.input().value = shared.input;
    } else {
      try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { mode?: Mode; input?: string };
          if (parsed.mode === 'garbled' || parsed.mode === 'bytes') this.mode = parsed.mode;
          if (typeof parsed.input === 'string') this.input().value = parsed.input;
        }
      } catch {
        /* 保存が読めなくても既定で動く */
      }
    }
    this.syncModeUi();
  }

  private persist(): void {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({ mode: this.mode, input: this.input().value }),
      );
    } catch {
      /* 保存できなくても解析は動く */
    }
  }

  // ---- イベント結線 ----

  private wire(): void {
    this.input().addEventListener('input', () => this.onInput());

    this.root.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => this.switchMode(btn.dataset.mode as Mode));
    });
    this.root.querySelectorAll<HTMLElement>('[data-theme-opt]').forEach((btn) => {
      btn.addEventListener('click', () => this.setTheme(btn.dataset.themeOpt as ThemeMode));
    });
    this.root.querySelectorAll<HTMLElement>('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleAction(btn.dataset.act ?? ''));
    });

    document.addEventListener('keydown', (e) => this.onKeydown(e));
  }

  private onKeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const editing =
      target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT' || target?.tagName === 'SELECT';
    if (editing || e.altKey || e.ctrlKey || e.metaKey) return;
    const actions: Record<string, () => void> = {
      g: () => this.switchMode('garbled'),
      b: () => this.switchMode('bytes'),
      e: () => this.handleAction('sample'),
      l: () => this.handleAction('share'),
    };
    const run = actions[e.key.toLowerCase()];
    if (run) {
      e.preventDefault();
      run();
    }
  }

  private handleAction(act: string): void {
    if (act === 'sample') {
      const list = SAMPLES[this.mode];
      this.input().value = list[this.sampleIndex % list.length]!;
      this.sampleIndex += 1;
      this.onInput();
    } else if (act === 'share') {
      this.shareLink();
    } else if (act === 'clear') {
      this.input().value = '';
      this.input().focus();
      this.onInput();
    }
  }

  private shareLink(): void {
    if (this.input().value.trim() === '') {
      this.toast('入力するとリンクを作れる');
      return;
    }
    const url = `${location.origin}${location.pathname}#${encodeState({ mode: this.mode, input: this.input().value })}`;
    history.replaceState(null, '', url);
    void this.copyText(url, '共有リンクをコピーした');
  }

  private onInput(): void {
    this.persist();
    this.update();
  }

  private switchMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.input().value = '';
    this.syncModeUi();
    this.persist();
    this.update();
  }

  private syncModeUi(): void {
    this.root.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === this.mode));
    });
    this.el['hint']!.textContent = HINTS[this.mode];
    this.input().setAttribute('placeholder', SAMPLES[this.mode][0]!);
  }

  // ---- テーマ ----

  private currentTheme(): ThemeMode {
    const set = document.documentElement.dataset.theme;
    return set === 'light' || set === 'dark' ? set : 'auto';
  }

  private setTheme(mode: ThemeMode): void {
    if (mode === 'auto') {
      delete document.documentElement.dataset.theme;
      try {
        localStorage.removeItem(THEME_KEY);
      } catch {
        /* 保存できなくても切り替わる */
      }
    } else {
      document.documentElement.dataset.theme = mode;
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch {
        /* 同上 */
      }
    }
    this.updateThemeButtons();
  }

  private updateThemeButtons(): void {
    const active = this.currentTheme();
    this.root.querySelectorAll<HTMLElement>('[data-theme-opt]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.themeOpt === active));
    });
  }

  // ---- 解析と描画 ----

  private update(): void {
    const text = this.input().value;
    const results = this.el['results']!;
    const count = this.el['count']!;
    this.el['byte-note']!.hidden = true;
    count.textContent = '';

    if (text.trim() === '') {
      this.showNote('入力すると、原因と復元候補がここに並ぶ。');
      this.el['live']!.textContent = '';
      results.dataset.empty = 'true';
      return;
    }
    delete results.dataset.empty;
    if (this.mode === 'garbled') this.renderGarbled(text);
    else this.renderBytes(text);
  }

  private renderGarbled(text: string): void {
    const candidates = explainGarbled(text).slice(0, 6);
    if (candidates.length === 0) {
      this.showNote('復元候補が見つからない。化け方が二重(2回誤読)か、対応外の符号かもしれない。');
      this.el['live']!.textContent = '復元候補なし';
      return;
    }
    this.el['count']!.textContent = `${candidates.length}件`;
    this.el['live']!.textContent =
      `復元候補 ${candidates.length}件。最有力は ${candidates[0]!.recovered}`;
    const cards = candidates.map((c, i) => {
      const cause = document.createElement('p');
      cause.className = 'finding__cause';
      cause.append(
        strong(c.originalName),
        ' のバイト列を ',
        strong(c.misreadName),
        ' として読んだ',
      );
      const card = this.makeCard(i === 0, cause, c.recovered, c.score, false);
      if (i === 0) {
        const fix = document.createElement('p');
        fix.className = 'finding__fix';
        fix.append(
          '直し方: 読み込み側を ',
          strong(c.originalName),
          ' 指定にすると正しく表示される',
        );
        card.appendChild(fix);
      }
      return card;
    });
    this.paint(cards);
  }

  private renderBytes(text: string): void {
    const parsed = parseBytes(text);
    if (!parsed) {
      this.showNote('バイト列として読めない。16進(e3 81 82)・%エンコード・Base64を受け付ける。');
      this.el['live']!.textContent = 'バイト列として解釈できない';
      return;
    }
    const bom = detectBom(parsed.bytes);
    const note = this.el['byte-note']!;
    note.hidden = false;
    const head = toHexDump(parsed.bytes.slice(0, 24)) + (parsed.bytes.length > 24 ? ' …' : '');
    note.textContent =
      `${parsed.bytes.length} バイト・${FORMAT_LABEL[parsed.format]}として解釈` +
      (bom ? ` ・先頭にBOM(${bom})` : '') +
      `\n${head}`;

    const candidates = decodeCandidates(parsed.bytes).slice(0, 8);
    this.el['count']!.textContent = `${candidates.length}件`;
    this.el['live']!.textContent =
      `復号候補 ${candidates.length}件。最有力は ${candidates[0]?.encodingName ?? ''}`;
    const cards = candidates.map((c, i) => {
      const cause = document.createElement('p');
      cause.className = 'finding__cause';
      cause.append(strong(c.encodingName), ' として復号');
      const region = document.createElement('span');
      region.className = 'finding__region';
      region.textContent = c.region;
      cause.appendChild(region);
      const preview = c.text.length > 200 ? `${c.text.slice(0, 200)}…` : c.text;
      const best = i === 0 && c.score > 0;
      const card = this.makeCard(best, cause, preview, c.score, true);
      if (c.replacementCount > 0) {
        const fail = card.querySelector('.finding__foot')!;
        const span = document.createElement('span');
        span.className = 'finding__fail';
        span.textContent = `復号失敗 ${c.replacementCount}文字`;
        fail.appendChild(span);
      }
      return card;
    });
    this.paint(cards);
  }

  // 候補1件のカード。原因・復元文・らしさ・コピーで構成する。
  private makeCard(
    best: boolean,
    cause: HTMLElement,
    recovered: string,
    score: number,
    mono: boolean,
  ): HTMLElement {
    const card = document.createElement('article');
    card.className = best ? 'finding finding--best' : 'finding';

    const text = document.createElement('p');
    text.className = mono ? 'finding__recovered finding__recovered--mono' : 'finding__recovered';
    fillRecovered(text, recovered);

    const foot = document.createElement('div');
    foot.className = 'finding__foot';
    const scoreEl = document.createElement('span');
    scoreEl.className = 'finding__score';
    scoreEl.append('らしさ ');
    const num = document.createElement('b');
    countUp(num, score);
    scoreEl.appendChild(num);
    foot.appendChild(scoreEl);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'icon-btn';
    copyBtn.innerHTML = copy;
    copyBtn.append('コピー');
    copyBtn.addEventListener('click', () => void this.copyText(recovered, 'コピーした'));
    foot.appendChild(copyBtn);

    card.append(cause, text, foot);
    return card;
  }

  private paint(cards: HTMLElement[]): void {
    const results = this.el['results']!;
    results.replaceChildren(...cards);
    revealCards(cards);
  }

  private showNote(message: string): void {
    const note = document.createElement('p');
    note.className = 'findings__note';
    note.textContent = message;
    this.el['results']!.replaceChildren(note);
  }

  private async copyText(text: string, done: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const tmp = document.createElement('textarea');
        tmp.value = text;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        tmp.remove();
      }
      this.toast(done);
    } catch {
      this.toast('コピーできなかった');
    }
  }

  private toast(message: string): void {
    const el = this.el['toast']!;
    el.textContent = message;
    el.classList.add('is-shown');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('is-shown'), 1600);
  }
}

const FORMAT_LABEL: Record<'hex' | 'percent' | 'base64', string> = {
  hex: '16進',
  percent: '%エンコード',
  base64: 'Base64',
};

function strong(text: string): HTMLElement {
  const b = document.createElement('b');
  b.textContent = text;
  return b;
}

// 復元文を流し込む。復号失敗の置換文字(U+FFFD)は印をつけて、どこが化けたか分かるようにする。
function fillRecovered(target: HTMLElement, text: string): void {
  if (text === '') {
    target.textContent = '(空)';
    return;
  }
  const parts = text.split('�');
  parts.forEach((part, i) => {
    if (i > 0) {
      const mark = document.createElement('span');
      mark.className = 'repl';
      mark.textContent = '�';
      mark.title = '復号できなかったバイト';
      target.appendChild(mark);
    }
    if (part) target.append(document.createTextNode(part));
  });
}
