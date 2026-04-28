/**
 * ポモドーロタイマー ロジック
 *
 * 使い方:
 *   const timer = new Timer({ onTick, onComplete, onNotify, onAllSetsComplete });
 *   timer.start();   // タイマー開始
 *   timer.pause();   // 一時停止
 *   timer.resume();  // 再開
 *   timer.reset();   // リセット（作業モード・初期秒数・セット数 0 に戻る）
 *
 * セットの数え方:
 *   作業 1 回 + 休憩 1 回 = 1 セット
 *   TOTAL_SETS（デフォルト 4）セット完了で onAllSetsComplete が呼ばれる。
 */

// ---- デフォルト時間設定 ----
const DEFAULT_WORK_SECONDS = 1 * 60;      // 作業時間: 1 分 00 秒
const DEFAULT_BREAK_SECONDS = 0 * 60 + 20; // 休憩時間: 0 分 20 秒
const TOTAL_SETS = 4;                      // 全セット数（作業+休憩を何サイクル繰り返すか）

// ---- タイマーのモード定数 ----
const MODE = {
  WORK: "work",   // 作業中
  BREAK: "break", // 休憩中
};

// ---- タイマーの状態定数 ----
const STATE = {
  IDLE: "idle",       // 停止中（開始前またはリセット後）
  RUNNING: "running", // カウントダウン中
  PAUSED: "paused",   // 一時停止中
  FINISHED: "finished", // タイマー終了直後（内部遷移用）
};

class Timer {
  /**
   * タイマーを生成する。
   *
   * @param {object}   [options]
   * @param {number}   [options.workSeconds]         - 作業時間（秒）。省略時は 60 秒。
   * @param {number}   [options.breakSeconds]        - 休憩時間（秒）。省略時は 20 秒。
   * @param {number}   [options.totalSets]           - 全セット数。省略時は 4。
   * @param {function} [options.onTick]              - 毎秒呼ばれるコールバック (remainingSeconds, mode) => void
   * @param {function} [options.onComplete]          - 1 モード終了時のコールバック (mode) => void
   * @param {function} [options.onNotify]            - 通知コールバック (message) => void（省略時は alert / console.log）
   * @param {function} [options.onAllSetsComplete]   - 全セット完了時のコールバック (message) => void
   * @param {object}   [options._clock]              - テスト用クロック差し込み口 { setInterval, clearInterval }
   */
  constructor(options = {}) {
    // ---- 時間設定 ----
    this.workSeconds = options.workSeconds ?? DEFAULT_WORK_SECONDS;
    this.breakSeconds = options.breakSeconds ?? DEFAULT_BREAK_SECONDS;
    this.totalSets = options.totalSets ?? TOTAL_SETS;

    // ---- コールバック ----
    this.onTick = options.onTick ?? null;
    this.onComplete = options.onComplete ?? null;
    this.onNotify = options.onNotify ?? null;
    this.onAllSetsComplete = options.onAllSetsComplete ?? null;

    // ---- テスト用クロック差し込み（本番は window の setInterval を使用） ----
    this._clock = options._clock ?? {
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (id) => clearInterval(id),
    };

    // ---- 内部状態の初期化 ----
    this.mode = MODE.WORK;      // 最初は作業モード
    this.state = STATE.IDLE;    // 停止状態からスタート
    this.remaining = this.workSeconds; // 残り秒数
    this.completedSets = 0;     // 完了したセット数
    this._intervalId = null;    // setInterval の戻り値を保持（clearInterval に使う）
  }

  // ================================================================== getters

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

  // ================================================================== 公開メソッド

  /**
   * 残り時間を { minutes, seconds } 形式で返す。
   * 残り秒が負になった場合は 0 として扱う。
   */
  getTime() {
    const total = Math.max(0, this.remaining);
    return {
      minutes: Math.floor(total / 60),
      seconds: total % 60,
    };
  }

  /**
   * 残り時間を "MM:SS" 形式の文字列で返す。
   * 例: 65 秒 → "01:05"
   */
  getTimeString() {
    const { minutes, seconds } = this.getTime();
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  /**
   * タイマーを開始する。
   * - IDLE 状態 → RUNNING に遷移してカウントダウン開始
   * - RUNNING 状態では何もしない（二重開始防止）
   * - PAUSED 状態では何もしない（再開は resume() を使う）
   */
  start() {
    // すでに動いている場合は無視
    if (this.state === STATE.RUNNING) return;
    // 一時停止中は start() ではなく resume() を使う
    if (this.state === STATE.PAUSED) return;

    this.state = STATE.RUNNING;
    this._startInterval(); // 1 秒ごとの処理を登録
  }

  /**
   * タイマーを一時停止する。
   * RUNNING 状態のときのみ有効。それ以外では何もしない。
   */
  pause() {
    if (this.state !== STATE.RUNNING) return;
    this.state = STATE.PAUSED;
    this._clearInterval(); // 1 秒ごとの処理を解除
  }

  /**
   * 一時停止中のタイマーを再開する。
   * PAUSED 状態のときのみ有効。それ以外では何もしない。
   */
  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.RUNNING;
    this._startInterval(); // 1 秒ごとの処理を再登録
  }

  /**
   * タイマーをリセットする。
   * 作業モード・初期秒数・完了セット数 0 の IDLE 状態に戻る。
   */
  reset() {
    this._clearInterval(); // 実行中の場合はインターバルを止める
    this._reset();
  }

  // ================================================================== プライベートメソッド

  /** 内部状態を初期値に戻す（reset() および次サイクル開始時に使用） */
  _reset() {
    this.mode = MODE.WORK;
    this.state = STATE.IDLE;
    this.remaining = this.workSeconds;
    this.completedSets = 0; // セット数もリセット
  }

  /** 1 秒ごとのカウントダウン処理を setInterval で登録する */
  _startInterval() {
    this._intervalId = this._clock.setInterval(() => {
      // 1 秒減らす
      this.remaining -= 1;

      // UI 更新用コールバックを呼ぶ
      if (this.onTick) {
        this.onTick(this.remaining, this.mode);
      }

      // 残り 0 秒以下になったらタイマー終了処理へ
      if (this.remaining <= 0) {
        this._handleComplete();
      }
    }, 1000);
  }

  /** 登録済みの setInterval をクリアする */
  _clearInterval() {
    if (this._intervalId !== null) {
      this._clock.clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * タイマー終了時の処理。
   * 1. インターバルを停止
   * 2. 通知メッセージを発行
   * 3. onComplete コールバックを呼ぶ
   * 4. 次のモード（作業 ↔ 休憩）に切り替え
   * 5. 休憩終了 = 1 セット完了 → セット数を加算し、全完了ならアラート
   */
  _handleComplete() {
    this._clearInterval();
    this.state = STATE.FINISHED;

    // 終了したモードを記録（この後 this.mode が変わるため）
    const finishedMode = this.mode;

    // モードに応じた通知メッセージを生成して発行
    const message =
      finishedMode === MODE.WORK
        ? "作業時間が終了しました！休憩しましょう。"
        : "休憩時間が終了しました！作業を再開しましょう。";
    this._notify(message);

    // 外部コールバックに終了モードを伝える
    if (this.onComplete) {
      this.onComplete(finishedMode);
    }

    // 次のモードへ切り替え（作業→休憩、休憩→作業）
    this.mode = finishedMode === MODE.WORK ? MODE.BREAK : MODE.WORK;
    this.remaining =
      this.mode === MODE.WORK ? this.workSeconds : this.breakSeconds;
    this.state = STATE.IDLE; // 次のモードは手動 start() まで待機

    // 休憩が終わったら 1 セット完了
    if (finishedMode === MODE.BREAK) {
      this.completedSets += 1;

      // 全セット完了チェック
      if (this.completedSets >= this.totalSets) {
        const allDoneMessage = `お疲れ様でした！${this.totalSets}セット完了しました。しっかり休んでください。`;
        if (this.onAllSetsComplete) {
          this.onAllSetsComplete(allDoneMessage);
        } else {
          this._notify(allDoneMessage);
        }
        // 次のサイクルのためにセット数をリセット
        this.completedSets = 0;
      }
    }
  }

  /**
   * 通知を発行する。
   * onNotify が設定されていればそれを呼び、
   * なければブラウザの alert、Node.js 環境では console.log にフォールバックする。
   */
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
  module.exports = {
    Timer,
    MODE,
    STATE,
    DEFAULT_WORK_SECONDS,
    DEFAULT_BREAK_SECONDS,
    TOTAL_SETS,
  };
}
