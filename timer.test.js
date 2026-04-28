"use strict";

const {
  Timer,
  MODE,
  STATE,
  DEFAULT_WORK_SECONDS,
  DEFAULT_BREAK_SECONDS,
} = require("./timer");

/**
 * 偽物のクロック: setInterval / clearInterval を同期的に制御できる。
 * tick(n) を呼ぶと n 回ぶん 1 秒が経過したように振る舞う。
 */
function createFakeClock() {
  let id = 0;
  const callbacks = new Map();

  return {
    setInterval(fn, _ms) {
      const currentId = ++id;
      callbacks.set(currentId, fn);
      return currentId;
    },
    clearInterval(tickId) {
      callbacks.delete(tickId);
    },
    /** n 回ティックを進める */
    tick(n = 1) {
      for (let i = 0; i < n; i++) {
        for (const fn of callbacks.values()) {
          fn();
        }
      }
    },
  };
}

// ------------------------------------------------------------------ 定数テスト

describe("定数", () => {
  test("デフォルト作業時間は 60 秒", () => {
    expect(DEFAULT_WORK_SECONDS).toBe(60);
  });

  test("デフォルト休憩時間は 20 秒", () => {
    expect(DEFAULT_BREAK_SECONDS).toBe(20);
  });
});

// ------------------------------------------------------------------ 初期状態

describe("初期状態", () => {
  test("デフォルト作業時間で生成される", () => {
    const timer = new Timer();
    expect(timer.remainingSeconds).toBe(DEFAULT_WORK_SECONDS);
    expect(timer.currentMode).toBe(MODE.WORK);
    expect(timer.currentState).toBe(STATE.IDLE);
  });

  test("カスタム作業・休憩時間で生成できる", () => {
    const timer = new Timer({ workSeconds: 90, breakSeconds: 30 });
    expect(timer.remainingSeconds).toBe(90);
  });

  test("getTime() が分・秒を返す", () => {
    const timer = new Timer({ workSeconds: 125 });
    expect(timer.getTime()).toEqual({ minutes: 2, seconds: 5 });
  });

  test("getTimeString() が MM:SS 形式を返す", () => {
    const timer = new Timer({ workSeconds: 65 });
    expect(timer.getTimeString()).toBe("01:05");
  });
});

// ------------------------------------------------------------------ 開始

describe("start()", () => {
  test("IDLE → RUNNING に遷移する", () => {
    const clock = createFakeClock();
    const timer = new Timer({ _clock: clock });
    timer.start();
    expect(timer.currentState).toBe(STATE.RUNNING);
  });

  test("既に RUNNING の場合は何も変わらない", () => {
    const clock = createFakeClock();
    const timer = new Timer({ _clock: clock });
    timer.start();
    timer.start(); // 2 回目は無視
    expect(timer.currentState).toBe(STATE.RUNNING);
  });

  test("毎秒 onTick が呼ばれる", () => {
    const clock = createFakeClock();
    const ticks = [];
    const timer = new Timer({
      _clock: clock,
      onTick: (remaining, mode) => ticks.push({ remaining, mode }),
    });
    timer.start();
    clock.tick(3);
    expect(ticks).toHaveLength(3);
    expect(ticks[0]).toEqual({ remaining: DEFAULT_WORK_SECONDS - 1, mode: MODE.WORK });
    expect(ticks[2]).toEqual({ remaining: DEFAULT_WORK_SECONDS - 3, mode: MODE.WORK });
  });
});

// ------------------------------------------------------------------ 一時停止 / 再開

describe("pause() / resume()", () => {
  test("pause() で PAUSED に遷移しカウントが止まる", () => {
    const clock = createFakeClock();
    const timer = new Timer({ _clock: clock });
    timer.start();
    clock.tick(5);
    const afterFive = timer.remainingSeconds;
    timer.pause();
    clock.tick(10); // pause 中は進まない
    expect(timer.currentState).toBe(STATE.PAUSED);
    expect(timer.remainingSeconds).toBe(afterFive);
  });

  test("resume() で再びカウントが進む", () => {
    const clock = createFakeClock();
    const timer = new Timer({ _clock: clock });
    timer.start();
    clock.tick(5);
    timer.pause();
    clock.tick(10); // 無視
    timer.resume();
    clock.tick(3);
    expect(timer.currentState).toBe(STATE.RUNNING);
    expect(timer.remainingSeconds).toBe(DEFAULT_WORK_SECONDS - 5 - 3);
  });

  test("RUNNING でない状態で pause() しても何も変わらない", () => {
    const clock = createFakeClock();
    const timer = new Timer({ _clock: clock });
    timer.pause(); // IDLE のまま
    expect(timer.currentState).toBe(STATE.IDLE);
  });

  test("PAUSED でない状態で resume() しても何も変わらない", () => {
    const clock = createFakeClock();
    const timer = new Timer({ _clock: clock });
    timer.resume(); // IDLE のまま
    expect(timer.currentState).toBe(STATE.IDLE);
  });
});

// ------------------------------------------------------------------ リセット

describe("reset()", () => {
  test("RUNNING 中にリセットすると IDLE・作業モード・初期秒数に戻る", () => {
    const clock = createFakeClock();
    const timer = new Timer({ workSeconds: 60, _clock: clock });
    timer.start();
    clock.tick(20);
    timer.reset();
    expect(timer.currentState).toBe(STATE.IDLE);
    expect(timer.currentMode).toBe(MODE.WORK);
    expect(timer.remainingSeconds).toBe(60);
  });

  test("リセット後はカウントが進まない", () => {
    const clock = createFakeClock();
    const timer = new Timer({ _clock: clock });
    timer.start();
    timer.reset();
    clock.tick(5);
    expect(timer.remainingSeconds).toBe(DEFAULT_WORK_SECONDS);
  });
});

// ------------------------------------------------------------------ 終了・モード切替

describe("タイマー終了", () => {
  test("残り 0 秒で onComplete が呼ばれる", () => {
    const clock = createFakeClock();
    const completedModes = [];
    const timer = new Timer({
      workSeconds: 3,
      _clock: clock,
      onComplete: (mode) => completedModes.push(mode),
      onNotify: () => {},
    });
    timer.start();
    clock.tick(3);
    expect(completedModes).toEqual([MODE.WORK]);
  });

  test("作業終了後は休憩モードの IDLE に遷移する", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 2,
      breakSeconds: 5,
      _clock: clock,
      onNotify: () => {},
    });
    timer.start();
    clock.tick(2);
    expect(timer.currentMode).toBe(MODE.BREAK);
    expect(timer.currentState).toBe(STATE.IDLE);
    expect(timer.remainingSeconds).toBe(5);
  });

  test("休憩終了後は作業モードの IDLE に遷移する", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      _clock: clock,
      onNotify: () => {},
    });
    // 作業終了
    timer.start();
    clock.tick(1);
    expect(timer.currentMode).toBe(MODE.BREAK);

    // 休憩終了
    timer.start();
    clock.tick(1);
    expect(timer.currentMode).toBe(MODE.WORK);
    expect(timer.currentState).toBe(STATE.IDLE);
  });

  test("onNotify が呼ばれる", () => {
    const clock = createFakeClock();
    const messages = [];
    const timer = new Timer({
      workSeconds: 1,
      _clock: clock,
      onNotify: (msg) => messages.push(msg),
    });
    timer.start();
    clock.tick(1);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("作業時間が終了");
  });

  test("FINISHED 状態から start() するとリセットして再開する", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 1,
      _clock: clock,
      onNotify: () => {},
    });
    timer.start();
    clock.tick(1);
    // 終了後は IDLE（自動切替済み）
    expect(timer.currentState).toBe(STATE.IDLE);
    // 再 start
    timer.start();
    expect(timer.currentState).toBe(STATE.RUNNING);
  });
});

// ------------------------------------------------------------------ getTimeString エッジケース

describe("getTimeString() エッジケース", () => {
  test("00:00 を返す（0秒）", () => {
    const clock = createFakeClock();
    const timer = new Timer({ workSeconds: 1, _clock: clock, onNotify: () => {} });
    timer.start();
    clock.tick(1);
    // 終了後は break 残り時間へ切替済み
    // 0秒タイマーで確認
    const zeroTimer = new Timer({ workSeconds: 0 });
    expect(zeroTimer.getTimeString()).toBe("00:00");
  });

  test("60秒 → 01:00", () => {
    const timer = new Timer({ workSeconds: 60 });
    expect(timer.getTimeString()).toBe("01:00");
  });
});
