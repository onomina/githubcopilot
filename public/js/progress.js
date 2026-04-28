/**
 * progress.js
 * ポモドーロ進捗管理ロジック
 *
 * - 「作業」→「休憩」までを1セットとし、セット完了ごとに完了回数を1回追加
 * - 集中時間は「作業時間」のみを加算
 */

class ProgressTracker {
  constructor() {
    this.completedSets = 0;
    this.totalFocusMinutes = 0;
    this._workCompleted = false;
  }

  /**
   * 作業セッション完了時に呼び出す
   * @param {number} durationMinutes - 作業時間（分）
   */
  completeWorkSession(durationMinutes) {
    if (typeof durationMinutes !== 'number' || durationMinutes < 0) {
      throw new Error('durationMinutes must be a non-negative number');
    }
    this.totalFocusMinutes += durationMinutes;
    this._workCompleted = true;
  }

  /**
   * 休憩セッション完了時に呼び出す
   * 直前に作業セッションが完了している場合、セット完了回数を1増やす
   */
  completeBreakSession() {
    if (this._workCompleted) {
      this.completedSets += 1;
      this._workCompleted = false;
    }
  }

  /**
   * 現在の進捗データを返す
   * @returns {{ completedSets: number, totalFocusMinutes: number }}
   */
  getProgress() {
    return {
      completedSets: this.completedSets,
      totalFocusMinutes: this.totalFocusMinutes,
    };
  }

  /**
   * 進捗データをリセットする
   */
  reset() {
    this.completedSets = 0;
    this.totalFocusMinutes = 0;
    this._workCompleted = false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProgressTracker };
}
