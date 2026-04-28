/**
 * Timer logic: start, pause, reset, countdown, and notification on end.
 * Uses a Date-based approach to avoid setInterval drift.
 */

const DEFAULT_MINUTES = 25;
const MAX_MINUTES = 999;

let totalSeconds = DEFAULT_MINUTES * 60;
let remainingSeconds = totalSeconds;
let intervalId = null;
let startTimestamp = null; // Date.now() when the current run started
let secondsAtStart = 0;   // remainingSeconds at the moment the timer (re)started
let state = 'stopped'; // 'stopped' | 'running' | 'paused'

const display = document.getElementById('time-display');
const statusEl = document.getElementById('status');
const startPauseBtn = document.getElementById('btn-start-pause');
const resetBtn = document.getElementById('btn-reset');
const minutesInput = document.getElementById('minutes-input');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateDisplay() {
  display.textContent = formatTime(remainingSeconds);
}

function updateStatus() {
  const labels = {
    stopped: '停止中',
    running: '実行中',
    paused:  '一時停止中',
  };
  statusEl.textContent = labels[state];
  statusEl.className = `status status--${state}`;
}

function updateButtons() {
  startPauseBtn.textContent = state === 'running' ? '一時停止' : 'スタート';
  resetBtn.disabled = state === 'stopped' && remainingSeconds === totalSeconds;
}

function showNotification(message) {
  notificationMessage.textContent = message;
  notification.classList.remove('notification--hidden');
}

function hideNotification() {
  notification.classList.add('notification--hidden');
}

function tick() {
  const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
  const computed = secondsAtStart - elapsed;

  if (computed <= 0) {
    clearInterval(intervalId);
    intervalId = null;
    state = 'stopped';
    remainingSeconds = 0;
    updateDisplay();
    updateStatus();
    updateButtons();
    showNotification('タイマーが終了しました！');
    return;
  }

  remainingSeconds = computed;
  updateDisplay();
}

function start() {
  if (state === 'running') return;
  hideNotification();
  secondsAtStart = remainingSeconds;
  startTimestamp = Date.now();
  state = 'running';
  intervalId = setInterval(tick, 250); // poll at 250ms for smooth display
  updateStatus();
  updateButtons();
}

function pause() {
  if (state !== 'running') return;
  clearInterval(intervalId);
  intervalId = null;
  // Capture precise remaining time before pausing
  const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
  remainingSeconds = Math.max(0, secondsAtStart - elapsed);
  state = 'paused';
  updateDisplay();
  updateStatus();
  updateButtons();
}

function reset() {
  clearInterval(intervalId);
  intervalId = null;
  remainingSeconds = totalSeconds;
  state = 'stopped';
  hideNotification();
  updateDisplay();
  updateStatus();
  updateButtons();
}

startPauseBtn.addEventListener('click', () => {
  if (state === 'running') {
    pause();
  } else {
    start();
  }
});

resetBtn.addEventListener('click', reset);

notificationClose.addEventListener('click', hideNotification);

minutesInput.addEventListener('change', () => {
  const val = parseInt(minutesInput.value, 10);
  if (!isNaN(val) && val > 0 && val <= MAX_MINUTES) {
    totalSeconds = val * 60;
    reset();
  } else {
    // Restore input to current valid value
    minutesInput.value = Math.round(totalSeconds / 60);
  }
});

// Initialize
updateDisplay();
updateStatus();
updateButtons();

