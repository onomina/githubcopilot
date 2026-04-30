/**
 * ポモドーロ進捗管理ロジック
 *
 * 使い方:
 *   const progress = new ProgressManager();
 *   progress.completeSession("work", 60);  // 作業セッション完了（60秒）
 *   progress.completeSession("break", 20); // 休憩セッション完了（20秒）→ 1セット完了
 *   progress.completedSets;  // => 1
 *   progress.totalFocusSeconds; // => 60
 *   progress.reset();
 *
 * セットの数え方:
 *   「作業」→「休憩」までを1セットとし、休憩完了ごとに completedSets を +1 する。
 *   集中時間は「作業時間」のみを加算する。
 */

"use strict";

// ---- セッションのモード定数 ----
const PROGRESS_MODE = {
  WORK: "work",   // 作業
  BREAK: "break", // 休憩
};

class ProgressManager {
  /**
   * 進捗マネージャーを生成する。
   *
   * @param {object} [options]
   * @param {function} [options.onSetComplete]   - 1セット完了時のコールバック (completedSets) => void
   * @param {function} [options.onProgressUpdate] - 進捗更新時のコールバック ({ completedSets, totalFocusSeconds }) => void
   */
  constructor(options = {}) {
    this.onSetComplete = options.onSetComplete ?? null;
    this.onProgressUpdate = options.onProgressUpdate ?? null;

    const init = options.initialState ?? {};
    const sanitize = (v) => typeof v === "number" && v >= 0 ? Math.floor(v) : 0;
    this._completedSets = sanitize(init.completedSets);       // 完了セット数
    this._totalFocusSeconds = sanitize(init.totalFocusSeconds); // 累計集中時間（作業時間のみ）
    this._pendingWork = init.pendingWork === true;  // 作業セッションが完了済みで休憩待ちかどうか
  }

  // ================================================================== getters

  /** 完了したセット数を返す */
  get completedSets() {
    return this._completedSets;
  }

  /** 累計集中時間（秒）を返す */
  get totalFocusSeconds() {
    return this._totalFocusSeconds;
  }

  /**
   * 現在の進捗状態をシリアライズ可能なオブジェクトで返す。
   * localStorage 等への保存に使用する。
   *
   * @returns {{ completedSets: number, totalFocusSeconds: number, pendingWork: boolean }}
   */
  getState() {
    return {
      completedSets: this._completedSets,
      totalFocusSeconds: this._totalFocusSeconds,
      pendingWork: this._pendingWork,
    };
  }

  /** 累計集中時間を { hours, minutes, seconds } 形式で返す */
  getFocusTime() {
    const total = Math.max(0, this._totalFocusSeconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return { hours, minutes, seconds };
  }

  /**
   * セッション完了時に進捗を更新する。
   *
   * @param {string} mode     - セッションのモード ("work" | "break")
   * @param {number} seconds  - セッションの経過秒数
   */
  completeSession(mode, seconds) {
    if (typeof seconds !== "number" || seconds < 0) {
      throw new Error("seconds は 0 以上の数値である必要があります");
    }

    if (mode === PROGRESS_MODE.WORK) {
      // 作業完了: 集中時間に加算し、休憩待ち状態にする
      this._totalFocusSeconds += seconds;
      this._pendingWork = true;
    } else if (mode === PROGRESS_MODE.BREAK) {
      // 休憩完了: 作業が先に完了していれば1セットとしてカウント
      if (this._pendingWork) {
        this._completedSets += 1;
        this._pendingWork = false;

        if (this.onSetComplete) {
          this.onSetComplete(this._completedSets);
        }
      }
    }

    // 進捗更新コールバック
    if (this.onProgressUpdate) {
      this.onProgressUpdate({
        completedSets: this._completedSets,
        totalFocusSeconds: this._totalFocusSeconds,
      });
    }
  }

  /**
   * 進捗データをリセットする。
   * 完了セット数・累計集中時間・状態をすべて初期値に戻す。
   */
  reset() {
    this._completedSets = 0;
    this._totalFocusSeconds = 0;
    this._pendingWork = false;
  }
}

// ブラウザ / Node.js 両対応のエクスポート
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ProgressManager,
    PROGRESS_MODE,
  };
}
