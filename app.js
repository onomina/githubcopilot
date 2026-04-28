/**
 * app.js – ポモドーロタイマー UI コントローラー
 * timer.js の Timer クラスを使って DOM を操作する。
 */
(function () {
  const CIRCUMFERENCE = 2 * Math.PI * 80; // r=80 の円周

  const displayEl = document.getElementById("timer-display");
  const statusEl = document.getElementById("status-label");
  const startBtn = document.getElementById("btn-start");
  const resetBtn = document.getElementById("btn-reset");
  const ringProgress = document.getElementById("ring-progress");

  // リングの初期設定（右上から始まるよう -90 度回転は CSS で対応）
  ringProgress.style.strokeDasharray = CIRCUMFERENCE;
  ringProgress.style.strokeDashoffset = 0;

  const timer = new Timer({
    onTick: updateUI,
    onComplete: handleComplete,
    onNotify: (msg) => alert(msg),
  });

  function updateUI() {
    displayEl.textContent = timer.getTimeString();

    const totalSeconds =
      timer.currentMode === "work" ? timer.workSeconds : timer.breakSeconds;
    const ratio = timer.remainingSeconds / totalSeconds;
    ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - ratio);
  }

  function handleComplete(mode) {
    statusEl.textContent = mode === "work" ? "休憩中" : "作業中";
    startBtn.textContent = "開始";
    ringProgress.style.strokeDashoffset = 0;
    displayEl.textContent = timer.getTimeString();
  }

  startBtn.addEventListener("click", () => {
    if (timer.currentState === "running") {
      timer.pause();
      startBtn.textContent = "再開";
    } else if (timer.currentState === "paused") {
      timer.resume();
      startBtn.textContent = "一時停止";
    } else {
      timer.start();
      startBtn.textContent = "一時停止";
      statusEl.textContent = timer.currentMode === "work" ? "作業中" : "休憩中";
    }
  });

  resetBtn.addEventListener("click", () => {
    timer.reset();
    startBtn.textContent = "開始";
    statusEl.textContent = "作業中";
    displayEl.textContent = timer.getTimeString();
    ringProgress.style.strokeDashoffset = 0;
  });

  // 初期表示
  displayEl.textContent = timer.getTimeString();
})();
