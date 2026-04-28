const { ProgressTracker } = require('../progress');

describe('ProgressTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
  });

  describe('初期状態', () => {
    test('完了セット数が0であること', () => {
      expect(tracker.completedSets).toBe(0);
    });

    test('集中時間が0であること', () => {
      expect(tracker.totalFocusMinutes).toBe(0);
    });
  });

  describe('completeWorkSession', () => {
    test('作業時間が集中時間に加算されること', () => {
      tracker.completeWorkSession(25);
      expect(tracker.totalFocusMinutes).toBe(25);
    });

    test('複数回の作業セッションが累計されること', () => {
      tracker.completeWorkSession(25);
      tracker.completeWorkSession(25);
      expect(tracker.totalFocusMinutes).toBe(50);
    });

    test('0分の作業セッションが許容されること', () => {
      tracker.completeWorkSession(0);
      expect(tracker.totalFocusMinutes).toBe(0);
    });

    test('負の値を渡すとエラーになること', () => {
      expect(() => tracker.completeWorkSession(-1)).toThrow();
    });

    test('数値以外を渡すとエラーになること', () => {
      expect(() => tracker.completeWorkSession('25')).toThrow();
    });

    test('作業セッション完了後、休憩なしでは完了セット数が増えないこと', () => {
      tracker.completeWorkSession(25);
      expect(tracker.completedSets).toBe(0);
    });
  });

  describe('completeBreakSession', () => {
    test('作業→休憩で1セット完了になること', () => {
      tracker.completeWorkSession(25);
      tracker.completeBreakSession();
      expect(tracker.completedSets).toBe(1);
    });

    test('作業なしで休憩を完了してもセット数が増えないこと', () => {
      tracker.completeBreakSession();
      expect(tracker.completedSets).toBe(0);
    });

    test('2セット完了後に完了セット数が2になること', () => {
      tracker.completeWorkSession(25);
      tracker.completeBreakSession();
      tracker.completeWorkSession(25);
      tracker.completeBreakSession();
      expect(tracker.completedSets).toBe(2);
    });

    test('作業後に休憩を2回呼んでもセット数は1しか増えないこと', () => {
      tracker.completeWorkSession(25);
      tracker.completeBreakSession();
      tracker.completeBreakSession();
      expect(tracker.completedSets).toBe(1);
    });

    test('休憩完了後の集中時間は変わらないこと', () => {
      tracker.completeWorkSession(25);
      tracker.completeBreakSession();
      expect(tracker.totalFocusMinutes).toBe(25);
    });
  });

  describe('getProgress', () => {
    test('進捗データが正しく返ること', () => {
      tracker.completeWorkSession(25);
      tracker.completeBreakSession();
      const progress = tracker.getProgress();
      expect(progress).toEqual({ completedSets: 1, totalFocusMinutes: 25 });
    });

    test('初期状態の進捗データが正しく返ること', () => {
      const progress = tracker.getProgress();
      expect(progress).toEqual({ completedSets: 0, totalFocusMinutes: 0 });
    });
  });

  describe('reset', () => {
    test('リセット後に完了セット数が0に戻ること', () => {
      tracker.completeWorkSession(25);
      tracker.completeBreakSession();
      tracker.reset();
      expect(tracker.completedSets).toBe(0);
    });

    test('リセット後に集中時間が0に戻ること', () => {
      tracker.completeWorkSession(25);
      tracker.completeBreakSession();
      tracker.reset();
      expect(tracker.totalFocusMinutes).toBe(0);
    });

    test('リセット後に作業中フラグがクリアされ、次の作業→休憩で1セットになること', () => {
      tracker.completeWorkSession(25);
      tracker.reset();
      tracker.completeWorkSession(25);
      tracker.completeBreakSession();
      expect(tracker.completedSets).toBe(1);
    });
  });

  describe('複合シナリオ', () => {
    test('3セット完了・集中時間75分になること', () => {
      for (let i = 0; i < 3; i++) {
        tracker.completeWorkSession(25);
        tracker.completeBreakSession();
      }
      expect(tracker.completedSets).toBe(3);
      expect(tracker.totalFocusMinutes).toBe(75);
    });

    test('休憩時間は集中時間に加算されないこと', () => {
      tracker.completeWorkSession(25);
      // 休憩時間は completeBreakSession に渡さない（設計上、加算しない）
      tracker.completeBreakSession();
      expect(tracker.totalFocusMinutes).toBe(25);
    });
  });
});
