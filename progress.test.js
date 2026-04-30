"use strict";

const { ProgressManager, PROGRESS_MODE } = require("./progress");

// ------------------------------------------------------------------ 定数テスト

describe("定数", () => {
  test("PROGRESS_MODE.WORK は 'work'", () => {
    expect(PROGRESS_MODE.WORK).toBe("work");
  });

  test("PROGRESS_MODE.BREAK は 'break'", () => {
    expect(PROGRESS_MODE.BREAK).toBe("break");
  });
});

// ------------------------------------------------------------------ 初期状態

describe("初期状態", () => {
  test("completedSets は 0", () => {
    const progress = new ProgressManager();
    expect(progress.completedSets).toBe(0);
  });

  test("totalFocusSeconds は 0", () => {
    const progress = new ProgressManager();
    expect(progress.totalFocusSeconds).toBe(0);
  });

  test("getFocusTime() が { hours: 0, minutes: 0, seconds: 0 } を返す", () => {
    const progress = new ProgressManager();
    expect(progress.getFocusTime()).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });
});

// ------------------------------------------------------------------ completeSession（作業）

describe("completeSession() - 作業セッション", () => {
  test("作業完了で totalFocusSeconds が加算される", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    expect(progress.totalFocusSeconds).toBe(60);
  });

  test("複数回の作業完了で totalFocusSeconds が累積される", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    // 1セット目の休憩完了
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    // 2セット目の作業
    progress.completeSession(PROGRESS_MODE.WORK, 90);
    expect(progress.totalFocusSeconds).toBe(150); // 60 + 90
  });

  test("作業完了だけでは completedSets は増えない", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    expect(progress.completedSets).toBe(0);
  });

  test("休憩の秒数は totalFocusSeconds に加算されない", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    expect(progress.totalFocusSeconds).toBe(60); // 休憩20秒は含まない
  });
});

// ------------------------------------------------------------------ completeSession（休憩）

describe("completeSession() - 休憩セッション", () => {
  test("作業→休憩で1セット完了となる", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    expect(progress.completedSets).toBe(1);
  });

  test("作業なしで休憩完了しても completedSets は増えない", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    expect(progress.completedSets).toBe(0);
  });

  test("連続して休憩完了しても completedSets は1しか増えない（作業が間になければ）", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    progress.completeSession(PROGRESS_MODE.BREAK, 20); // 2回目の休憩（作業なし）
    expect(progress.completedSets).toBe(1);
  });
});

// ------------------------------------------------------------------ セット完了コールバック

describe("onSetComplete コールバック", () => {
  test("1セット完了時に onSetComplete が呼ばれる", () => {
    const calls = [];
    const progress = new ProgressManager({
      onSetComplete: (sets) => calls.push(sets),
    });
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(1);
  });

  test("複数セット完了時に都度 onSetComplete が呼ばれる", () => {
    const calls = [];
    const progress = new ProgressManager({
      onSetComplete: (sets) => calls.push(sets),
    });
    // 1セット目
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    // 2セット目
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    expect(calls).toEqual([1, 2]);
  });

  test("作業完了だけでは onSetComplete は呼ばれない", () => {
    const calls = [];
    const progress = new ProgressManager({
      onSetComplete: (sets) => calls.push(sets),
    });
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    expect(calls).toHaveLength(0);
  });
});

// ------------------------------------------------------------------ 進捗更新コールバック

describe("onProgressUpdate コールバック", () => {
  test("作業完了時に onProgressUpdate が呼ばれる", () => {
    const updates = [];
    const progress = new ProgressManager({
      onProgressUpdate: (data) => updates.push({ ...data }),
    });
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ completedSets: 0, totalFocusSeconds: 60 });
  });

  test("休憩完了時に onProgressUpdate が呼ばれる", () => {
    const updates = [];
    const progress = new ProgressManager({
      onProgressUpdate: (data) => updates.push({ ...data }),
    });
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    expect(updates).toHaveLength(2);
    expect(updates[1]).toEqual({ completedSets: 1, totalFocusSeconds: 60 });
  });
});

// ------------------------------------------------------------------ getFocusTime

describe("getFocusTime()", () => {
  test("秒のみの場合", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 45);
    expect(progress.getFocusTime()).toEqual({ hours: 0, minutes: 0, seconds: 45 });
  });

  test("分・秒がある場合", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 90); // 1分30秒
    expect(progress.getFocusTime()).toEqual({ hours: 0, minutes: 1, seconds: 30 });
  });

  test("時間・分・秒がある場合", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 3661); // 1時間1分1秒
    expect(progress.getFocusTime()).toEqual({ hours: 1, minutes: 1, seconds: 1 });
  });

  test("0秒の場合", () => {
    const progress = new ProgressManager();
    expect(progress.getFocusTime()).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });
});

// ------------------------------------------------------------------ リセット

describe("reset()", () => {
  test("completedSets が 0 に戻る", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    progress.reset();
    expect(progress.completedSets).toBe(0);
  });

  test("totalFocusSeconds が 0 に戻る", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.reset();
    expect(progress.totalFocusSeconds).toBe(0);
  });

  test("リセット後は作業→休憩で再び1セットとしてカウントされる", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    progress.reset();
    progress.completeSession(PROGRESS_MODE.WORK, 60);
    progress.completeSession(PROGRESS_MODE.BREAK, 20);
    expect(progress.completedSets).toBe(1);
  });

  test("リセット後は休憩だけでは completedSets が増えない（pendingWork が正しくリセットされる）", () => {
    const progress = new ProgressManager();
    progress.completeSession(PROGRESS_MODE.WORK, 60); // 作業完了→pendingWork=true
    progress.reset();                                  // リセット→pendingWork=false
    progress.completeSession(PROGRESS_MODE.BREAK, 20); // 休憩だけ→カウントされない
    expect(progress.completedSets).toBe(0);
  });
});

// ------------------------------------------------------------------ バリデーション

describe("completeSession() バリデーション", () => {
  test("負の秒数を渡すとエラーになる", () => {
    const progress = new ProgressManager();
    expect(() => progress.completeSession(PROGRESS_MODE.WORK, -1)).toThrow();
  });

  test("秒数として数値以外を渡すとエラーになる", () => {
    const progress = new ProgressManager();
    expect(() => progress.completeSession(PROGRESS_MODE.WORK, "60")).toThrow();
  });

  test("0秒は有効（セッション時間0）", () => {
    const progress = new ProgressManager();
    expect(() => progress.completeSession(PROGRESS_MODE.WORK, 0)).not.toThrow();
    expect(progress.totalFocusSeconds).toBe(0);
  });
});

// ------------------------------------------------------------------ 複数セット

describe("複数セットの連続完了", () => {
  test("4セット完了後に completedSets が 4 になる", () => {
    const progress = new ProgressManager();
    for (let i = 0; i < 4; i++) {
      progress.completeSession(PROGRESS_MODE.WORK, 60);
      progress.completeSession(PROGRESS_MODE.BREAK, 20);
    }
    expect(progress.completedSets).toBe(4);
  });

  test("4セット完了後の totalFocusSeconds は作業時間の合計", () => {
    const progress = new ProgressManager();
    for (let i = 0; i < 4; i++) {
      progress.completeSession(PROGRESS_MODE.WORK, 60);
      progress.completeSession(PROGRESS_MODE.BREAK, 20);
    }
    expect(progress.totalFocusSeconds).toBe(240); // 60 * 4 = 240秒
  });
});
