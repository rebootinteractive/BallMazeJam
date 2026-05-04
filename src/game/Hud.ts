export interface HudCallbacks {
  onRestart: () => void;
  onMenu: () => void;
}

export class Hud {
  readonly root: HTMLDivElement;
  private timerEl: HTMLDivElement;
  private counterEl: HTMLDivElement;
  private modalEl: HTMLDivElement | null = null;

  constructor(parent: HTMLElement, levelName: string, private cb: HudCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';

    // Top bar
    const top = document.createElement('div');
    top.className = 'hud-top';

    const left = document.createElement('div');
    const back = document.createElement('button');
    back.className = 'btn ghost small';
    back.textContent = '← Levels';
    back.addEventListener('click', () => cb.onMenu());
    left.appendChild(back);

    const center = document.createElement('div');
    this.timerEl = document.createElement('div');
    this.timerEl.className = 'hud-timer';
    this.timerEl.textContent = '0:00';
    center.appendChild(this.timerEl);

    const right = document.createElement('div');
    this.counterEl = document.createElement('div');
    this.counterEl.className = 'hud-counter';
    this.counterEl.innerHTML = `<strong>0</strong> / 0 left`;
    right.appendChild(this.counterEl);

    top.appendChild(left);
    top.appendChild(center);
    top.appendChild(right);

    // Bottom bar
    const bottom = document.createElement('div');
    bottom.className = 'hud-bottom';
    const restart = document.createElement('button');
    restart.className = 'btn ghost small';
    restart.textContent = '↻ Restart';
    restart.addEventListener('click', () => cb.onRestart());
    bottom.appendChild(restart);

    const levelTag = document.createElement('div');
    levelTag.style.color = '#8b91a6';
    levelTag.style.fontSize = '12px';
    levelTag.style.alignSelf = 'center';
    levelTag.textContent = levelName;
    bottom.appendChild(levelTag);

    this.root.appendChild(top);
    this.root.appendChild(bottom);
    parent.appendChild(this.root);
  }

  setTimer(remaining: number) {
    const total = Math.max(0, Math.ceil(remaining));
    const m = Math.floor(total / 60);
    const s = total % 60;
    this.timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    this.timerEl.classList.toggle('warn', total <= 10 && total > 5);
    this.timerEl.classList.toggle('danger', total <= 5);
  }

  setBallCount(remaining: number, total: number) {
    this.counterEl.innerHTML = `<strong>${remaining}</strong> / ${total} left`;
  }

  showWin(remainingSeconds: number) {
    this.showModal({
      kind: 'win',
      title: 'Cleared!',
      sub: `with ${Math.ceil(remainingSeconds)}s to spare`,
    });
  }

  showLose() {
    this.showModal({
      kind: 'lose',
      title: 'Time Up',
      sub: 'Some balls are still on the board.',
    });
  }

  private showModal(opts: { kind: 'win' | 'lose'; title: string; sub: string }) {
    this.dismissModal();
    const modal = document.createElement('div');
    modal.className = 'modal';

    const card = document.createElement('div');
    card.className = `modal-card endgame ${opts.kind}`;

    const h = document.createElement('h1');
    h.textContent = opts.title;
    const p = document.createElement('p');
    p.textContent = opts.sub;
    card.appendChild(h);
    card.appendChild(p);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const menuBtn = document.createElement('button');
    menuBtn.className = 'btn ghost';
    menuBtn.textContent = 'Menu';
    menuBtn.addEventListener('click', () => this.cb.onMenu());
    const restartBtn = document.createElement('button');
    restartBtn.className = 'btn';
    restartBtn.textContent = opts.kind === 'win' ? 'Play Again' : 'Try Again';
    restartBtn.addEventListener('click', () => {
      this.dismissModal();
      this.cb.onRestart();
    });
    actions.appendChild(menuBtn);
    actions.appendChild(restartBtn);
    card.appendChild(actions);

    modal.appendChild(card);
    this.root.appendChild(modal);
    this.modalEl = modal;
  }

  private dismissModal() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }

  dispose() {
    this.dismissModal();
    this.root.remove();
  }
}
