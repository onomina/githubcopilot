/**
 * ポモドーロタイマー ロジック
 *
 * 使い方:
 *   const timer = new Timer({ onTick, onComplete, onNotify });
 *   timer.start();
 *   timer.pause();
 *   timer.resume();
 *   timer.reset();
 */

const DEFAULT_WORK_SECONDS = 1 * 60; // 1分00秒
const DEFAULT_BREAK_SECONDS = 0 * 60 + 20; // 0分20秒

const MODE = {
  WORK: "work",
  BREAK: "break",
};

const STATE = {
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  FINISHED: "finished",
};

class Timer {
  /**
   * @param {object} options
   * @param {number} [options.workSeconds]  - 作業時間（秒）。省略時は 60 秒。
   * @param {number} [options.breakSeconds] - 休憩時間（秒）。省略時は 20 秒。
   * @param {function} [options.onTick]     - 毎秒呼ばれるコールバック (remainingSeconds, mode) => void
   * @param {function} [options.onComplete] - タイマー終了時のコールバック (mode) => void
   * @param {function} [options.onNotify]   - 通知コールバック (message) => void（省略時は alert / console.log）
   * @param {object} [options._clock]       - テスト用クロック差し込み口 { setInterval, clearInterval }
   */
  constructor(options = {}) {
    this.workSeconds = options.workSeconds ?? DEFAULT_WORK_SECONDS;
    this.breakSeconds = options.breakSeconds ?? DEFAULT_BREAK_SECONDS;
    this.onTick = options.onTick ?? null;
    this.onComplete = options.onComplete ?? null;
    this.onNotify = options.onNotify ?? null;

    // テスト用クロック差し込み
    this._clock = options._clock ?? {
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (id) => clearInterval(id),
    };

    this.mode = MODE.WORK;
    this.state = STATE.IDLE;
    this.remaining = this.workSeconds;
    this._intervalId = null;
  }

  /** 残り時間（秒）を返す */
  get remainingSeconds() {
    return this.remaining;
  }

  /** 現在のモード ("work" | "break") を返す */
  get currentMode() {
    return this.mode;
  }

  /** 現在の状態 ("idle" | "running" | "paused" | "finished") を返す */
  get currentState() {
    return this.state;
  }

  /** 残り時間を { minutes, seconds } 形式で返す */
  getTime() {
    const total = Math.max(0, this.remaining);
    return {
      minutes: Math.floor(total / 60),
      seconds: total % 60,
    };
  }

  /** 残り時間を "MM:SS" 形式の文字列で返す */
  getTimeString() {
    const { minutes, seconds } = this.getTime();
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  /** タイマーを開始する（IDLE / FINISHED 状態から） */
  start() {
    if (this.state === STATE.RUNNING) return;
    if (this.state === STATE.FINISHED) {
      this._reset();
    }
    this.state = STATE.RUNNING;
    this._startInterval();
  }

  /** タイマーを一時停止する */
  pause() {
    if (this.state !== STATE.RUNNING) return;
    this.state = STATE.PAUSED;
    this._clearInterval();
  }

  /** 一時停止中のタイマーを再開する */
  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.RUNNING;
    this._startInterval();
  }

  /** タイマーをリセットする（現在のモードを保ったまま初期値へ） */
  reset() {
    this._clearInterval();
    this._reset();
  }

  // ------------------------------------------------------------------ private

  _reset() {
    this.mode = MODE.WORK;
    this.state = STATE.IDLE;
    this.remaining = this.workSeconds;
  }

  _startInterval() {
    this._intervalId = this._clock.setInterval(() => {
      this.remaining -= 1;

      if (this.onTick) {
        this.onTick(this.remaining, this.mode);
      }

      if (this.remaining <= 0) {
        this._handleComplete();
      }
    }, 1000);
  }

  _clearInterval() {
    if (this._intervalId !== null) {
      this._clock.clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  _handleComplete() {
    this._clearInterval();
    this.state = STATE.FINISHED;
    const finishedMode = this.mode;

    const message =
      finishedMode === MODE.WORK
        ? "作業時間が終了しました！休憩しましょう。"
        : "休憩時間が終了しました！作業を再開しましょう。";

    this._notify(message);

    if (this.onComplete) {
      this.onComplete(finishedMode);
    }

    // 次のモードへ自動切替
    this.mode = finishedMode === MODE.WORK ? MODE.BREAK : MODE.WORK;
    this.remaining =
      this.mode === MODE.WORK ? this.workSeconds : this.breakSeconds;
    this.state = STATE.IDLE;
  }

  _notify(message) {
    if (this.onNotify) {
      this.onNotify(message);
    } else if (typeof alert === "function") {
      alert(message);
    } else {
      console.log(`[Timer] ${message}`);
    }
  }
}

// ブラウザ / Node.js 両対応のエクスポート
if (typeof module !== "undefined" && module.exports) {
  module.exports = { Timer, MODE, STATE, DEFAULT_WORK_SECONDS, DEFAULT_BREAK_SECONDS };
}
