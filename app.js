/**
 * app.js – ポモドーロタイマー UI コントローラー
 *
 * timer.js の Timer クラスを使って DOM 要素を操作する。
 * SVG 円形リングの進捗表示・ボタンのラベル切り替え・ステータス表示を担当する。
 */
(function () {
  // ---- SVG リングの計算値 ----
  // 円の半径 r=80 の円周: 2π×80 ≈ 502.65
  // CSS の stroke-dasharray / stroke-dashoffset で使用する基準値
  const CIRCUMFERENCE = 2 * Math.PI * 80;

  // ---- DOM 要素の取得 ----
  const displayEl = document.getElementById("timer-display"); // 残り時間テキスト (MM:SS)
  const statusEl = document.getElementById("status-label");   // 作業中 / 休憩中ラベル
  const startBtn = document.getElementById("btn-start");      // 開始 / 一時停止 / 再開ボタン
  const resetBtn = document.getElementById("btn-reset");      // リセットボタン
  const ringProgress = document.getElementById("ring-progress"); // SVG 進捗リング
  const workSecondsInput = document.getElementById("work-seconds");   // 作業時間（秒）入力
  const breakSecondsInput = document.getElementById("break-seconds"); // 休憩時間（秒）入力

  // ---- リングの初期設定 ----
  // stroke-dasharray を円周の長さに設定して「1本の線でリング全体」を表現する
  // stroke-dashoffset=0 で全体を表示（フルリング）
  ringProgress.style.strokeDasharray = CIRCUMFERENCE;
  ringProgress.style.strokeDashoffset = 0;

  // ---- Timer インスタンスを生成 ----
  const timer = new Timer({
    workSeconds: parseInt(workSecondsInput.value, 10) || DEFAULT_WORK_SECONDS,
    breakSeconds: parseInt(breakSecondsInput.value, 10) || DEFAULT_BREAK_SECONDS,
    onTick: updateUI,                         // 毎秒 UI を更新
    onComplete: handleComplete,               // 1 モード完了時に呼ばれる（次モード情報は timer から読む）
    onAllSetsComplete: (msg) => {             // 全 4 セット完了時のアラート
      alert(msg);
    },
  });

  /**
   * 入力フィールドの値が変更されたとき、タイマーが停止中であれば
   * timer の設定値と表示を即時反映する。
   */
  function applyInputValues() {
    if (timer.currentState !== STATE.IDLE) return; // 動作中は変更しない
    const newWork = parseInt(workSecondsInput.value, 10);
    const newBreak = parseInt(breakSecondsInput.value, 10);
    if (newWork > 0) timer.workSeconds = newWork;
    if (newBreak > 0) timer.breakSeconds = newBreak;
    // 残り時間を新しい作業時間に更新して表示に反映
    timer.remaining = timer.workSeconds;
    displayEl.textContent = timer.getTimeString();
  }

  workSecondsInput.addEventListener("change", applyInputValues);
  breakSecondsInput.addEventListener("change", applyInputValues);

  /**
   * 毎秒呼ばれる UI 更新関数。
   * - タイマー表示を最新の残り時間に更新する
   * - 残り時間の割合に応じて SVG リングの進捗を更新する
   */
  function updateUI() {
    // 残り時間を MM:SS 形式でタイマー表示に反映
    displayEl.textContent = timer.getTimeString();

    // 現在のモードの全体秒数を取得して進捗割合を計算
    const totalSeconds =
      timer.currentMode === MODE.WORK ? timer.workSeconds : timer.breakSeconds;

    // totalSeconds が 0 の場合は除算を回避してフルリングを表示
    if (totalSeconds <= 0) {
      ringProgress.style.strokeDashoffset = 0;
      return;
    }

    // ratio: 1.0 = 満タン、0.0 = 空
    const ratio = timer.remainingSeconds / totalSeconds;

    // 時計回りに減るアニメーション:
    //   stroke-dashoffset に負の値を設定すると、
    //   12 時の位置からリングが時計回りに消えていく（空になっていく）
    ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (ratio - 1);
  }

  /**
   * 1 モード（作業 or 休憩）が終了したときに呼ばれる関数。
   * timer.js が次のモードへ切り替え済みなので、timer の現在値を読んで UI を更新する。
   * 次のモードは自動スタートされるため、ボタンは「一時停止」に変わる。
   * 全セット完了時は timer が IDLE に戻るため、ボタンは「開始」になる。
   *
   * @param {string} mode - 終了したモード ("work" | "break")
   */
  function handleComplete(mode) {
    // timer はすでに次のモードに切り替わっているので currentMode を参照
    statusEl.textContent = timer.currentMode === MODE.WORK ? "作業中" : "休憩中";
    // タイマーが自動スタートしていれば「一時停止」、停止（全完了）なら「開始」
    startBtn.textContent =
      timer.currentState === STATE.RUNNING ? "一時停止" : "開始";
    // リングをフル（offset=0）に戻す
    ringProgress.style.strokeDashoffset = 0;
    // 次のモードの初期時間を表示
    displayEl.textContent = timer.getTimeString();
  }

  // ---- 開始 / 一時停止 / 再開ボタン ----
  startBtn.addEventListener("click", () => {
    if (timer.currentState === STATE.RUNNING) {
      // 動作中 → 一時停止
      timer.pause();
      startBtn.textContent = "再開";
    } else if (timer.currentState === STATE.PAUSED) {
      // 一時停止中 → 再開
      timer.resume();
      startBtn.textContent = "一時停止";
    } else {
      // 停止中 → 入力値を反映してから開始
      applyInputValues();
      timer.start();
      startBtn.textContent = "一時停止";
      // 現在のモードをステータスラベルに反映
      statusEl.textContent = timer.currentMode === MODE.WORK ? "作業中" : "休憩中";
    }
  });

  // ---- リセットボタン ----
  resetBtn.addEventListener("click", () => {
    // タイマーを作業モード・初期秒数に戻す
    timer.reset();
    // 入力値をタイマーに反映（リセット後に設定値が変わっていれば更新）
    applyInputValues();
    // UI を初期状態に戻す
    startBtn.textContent = "開始";
    statusEl.textContent = "作業中";
    displayEl.textContent = timer.getTimeString();
    ringProgress.style.strokeDashoffset = 0; // フルリングに戻す
  });

  // ---- 初期表示 ----
  // ページ読み込み時に作業時間の初期値 (01:00) を表示する
  displayEl.textContent = timer.getTimeString();
})();
