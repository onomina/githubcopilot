"use strict";

const {
  Timer,
  MODE,
  STATE,
  DEFAULT_WORK_SECONDS,
  DEFAULT_BREAK_SECONDS,
  TOTAL_SETS,
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
    /** n 回ティックを進める（各ステップ開始時点のコールバックをスナップショットして実行） */
    tick(n = 1) {
      for (let i = 0; i < n; i++) {
        // スナップショットを取ることで、1 ティック中に登録された新しいコールバックを
        // 同じティックで呼ばないようにする（タイマー切り替え時の二重カウントを防ぐ））
        const current = [...callbacks.values()];
        for (const fn of current) {
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

  test("デフォルト全セット数は 4", () => {
    expect(TOTAL_SETS).toBe(4);
  });
});

// ------------------------------------------------------------------ 初期状態

describe("初期状態", () => {
  test("デフォルト作業時間で生成される", () => {
    const timer = new Timer();
    expect(timer.remainingSeconds).toBe(DEFAULT_WORK_SECONDS);
    expect(timer.currentMode).toBe(MODE.WORK);
    expect(timer.currentState).toBe(STATE.IDLE);
    expect(timer.completedSets).toBe(0);
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

  test("PAUSED 状態で start() しても何も変わらない", () => {
    const clock = createFakeClock();
    const timer = new Timer({ _clock: clock });
    timer.start();
    clock.tick(5);
    timer.pause();
    timer.start(); // PAUSED 中は無視される
    expect(timer.currentState).toBe(STATE.PAUSED);
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

  test("リセットで completedSets も 0 に戻る", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      totalSets: 10,
      _clock: clock,
    });
    // 1 セット完了（作業→自動で休憩→完了 → completedSets = 1）
    timer.start();
    clock.tick(2); // 作業完了（0秒表示後）→ 自動で休憩開始
    clock.tick(2); // 休憩完了（0秒表示後）→ completedSets = 1, 自動で作業開始
    expect(timer.completedSets).toBe(1);
    timer.reset();
    expect(timer.completedSets).toBe(0);
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
    });
    timer.start();
    clock.tick(4); // 3秒カウント + 0秒を1ティック表示してから完了
    expect(completedModes).toEqual([MODE.WORK]);
  });

  test("作業終了後は自動で休憩モードの RUNNING に遷移する", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 2,
      breakSeconds: 5,
      _clock: clock,
    });
    timer.start();
    clock.tick(3); // 2秒カウント + 0秒を1ティック表示してから完了
    expect(timer.currentMode).toBe(MODE.BREAK);
    expect(timer.currentState).toBe(STATE.RUNNING); // 自動スタート
    expect(timer.remainingSeconds).toBe(5);
  });

  test("休憩終了後は自動で作業モードの RUNNING に遷移する", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      totalSets: 10, // 4 セット完了アラートが出ないよう大きめに設定
      _clock: clock,
    });
    // 作業終了 → 自動で休憩スタート
    timer.start();
    clock.tick(2); // 1秒カウント + 0秒を1ティック表示してから完了
    expect(timer.currentMode).toBe(MODE.BREAK);
    expect(timer.currentState).toBe(STATE.RUNNING);

    // 休憩終了 → 自動で作業スタート
    clock.tick(2); // 1秒カウント + 0秒を1ティック表示してから完了
    expect(timer.currentMode).toBe(MODE.WORK);
    expect(timer.currentState).toBe(STATE.RUNNING);
  });

  test("作業・休憩の切り替えでは onNotify は呼ばれない（自動遷移）", () => {
    const clock = createFakeClock();
    const messages = [];
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      totalSets: 10,
      _clock: clock,
      onNotify: (msg) => messages.push(msg),
    });
    timer.start();
    clock.tick(2); // 作業終了 → 自動で休憩（アラートなし）
    clock.tick(2); // 休憩終了 → 自動で作業（アラートなし）
    expect(messages).toHaveLength(0);
  });

  test("onAllSetsComplete 未設定時は onNotify で全完了通知される", () => {
    const clock = createFakeClock();
    const messages = [];
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      totalSets: 1,
      _clock: clock,
      onNotify: (msg) => messages.push(msg),
      // onAllSetsComplete 未設定 → _notify にフォールバック
    });
    timer.start();
    clock.tick(2); // 作業終了 → 自動で休憩
    clock.tick(2); // 休憩終了 → 1 セット完了 → onNotify 呼ばれる
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("セット完了");
  });

  test("タイマー完了後は次のモードが自動スタートする", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 5,
      _clock: clock,
    });
    timer.start();
    clock.tick(2); // 1秒カウント + 0秒を1ティック表示してから完了
    // 作業終了後は自動で休憩が RUNNING
    expect(timer.currentState).toBe(STATE.RUNNING);
    expect(timer.currentMode).toBe(MODE.BREAK);
    // break が正常にカウントされている
    clock.tick(2);
    expect(timer.remainingSeconds).toBe(3); // 5 - 2 = 3
  });
});

// ------------------------------------------------------------------ getTimeString エッジケース

describe("getTimeString() エッジケース", () => {
  test("00:00 を返す（0秒）", () => {
    const zeroTimer = new Timer({ workSeconds: 0 });
    expect(zeroTimer.getTimeString()).toBe("00:00");
  });

  test("60秒 → 01:00", () => {
    const timer = new Timer({ workSeconds: 60 });
    expect(timer.getTimeString()).toBe("01:00");
  });
});

// ------------------------------------------------------------------ 4 セット完了

describe("4 セット完了", () => {
  /**
   * 自動遷移前提: timer.start() で最初の作業を開始済みの状態で呼ぶ。
   * 1 セット = 作業 tick + 休憩 tick（自動スタートするので timer.start() 不要）
   */
  function completeOneSet(timer, clock) {
    clock.tick(timer.workSeconds + 1);   // 0秒を1ティック表示してから作業完了
    clock.tick(timer.breakSeconds + 1);  // 0秒を1ティック表示してから休憩完了
  }

  test("休憩が終わるたびに completedSets が増える", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      totalSets: 4,
      _clock: clock,
    });
    timer.start();
    completeOneSet(timer, clock);
    expect(timer.completedSets).toBe(1);
    completeOneSet(timer, clock);
    expect(timer.completedSets).toBe(2);
  });

  test("4 セット完了後に onAllSetsComplete が呼ばれる", () => {
    const clock = createFakeClock();
    const allDoneMessages = [];
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      totalSets: 4,
      _clock: clock,
      onAllSetsComplete: (msg) => allDoneMessages.push(msg),
    });
    timer.start();
    for (let i = 0; i < 4; i++) {
      completeOneSet(timer, clock);
    }
    expect(allDoneMessages).toHaveLength(1);
    expect(allDoneMessages[0]).toContain("4セット完了");
  });

  test("4 セット完了後 completedSets は 0 にリセットされる", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      totalSets: 4,
      _clock: clock,
      onAllSetsComplete: () => {},
    });
    timer.start();
    for (let i = 0; i < 4; i++) {
      completeOneSet(timer, clock);
    }
    // 4 セット後は 0 にリセットされ、次のサイクルが始まれる
    expect(timer.completedSets).toBe(0);
  });

  test("totalSets を変更できる（2 セットで完了）", () => {
    const clock = createFakeClock();
    const allDoneCalls = [];
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      totalSets: 2,
      _clock: clock,
      onAllSetsComplete: () => allDoneCalls.push(true),
    });
    timer.start();
    completeOneSet(timer, clock);
    expect(allDoneCalls).toHaveLength(0); // まだ 1 セット
    completeOneSet(timer, clock);
    expect(allDoneCalls).toHaveLength(1); // 2 セット完了
  });

  test("作業のみ完了しても onAllSetsComplete は呼ばれない", () => {
    const clock = createFakeClock();
    const allDoneCalls = [];
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 10,
      totalSets: 1,
      _clock: clock,
      onAllSetsComplete: () => allDoneCalls.push(true),
    });
    // 作業のみ完了 → 自動で休憩開始（まだ完了アラートなし）
    timer.start();
    clock.tick(2); // 作業完了（0秒表示後）→ 自動で休憩開始
    expect(allDoneCalls).toHaveLength(0);
  });

  test("4 セット完了後はタイマーが IDLE になる", () => {
    const clock = createFakeClock();
    const timer = new Timer({
      workSeconds: 1,
      breakSeconds: 1,
      totalSets: 1,
      _clock: clock,
      onAllSetsComplete: () => {},
    });
    timer.start();
    completeOneSet(timer, clock);
    // 全完了後は IDLE で待機（ユーザーが手動で開始する）
    expect(timer.currentState).toBe(STATE.IDLE);
  });
});
