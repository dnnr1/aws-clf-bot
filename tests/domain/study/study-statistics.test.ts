import { describe, expect, it } from "vitest";
import { calculateStudyStatistics } from "../../../src/domain/study/study-statistics.js";

describe("calculateStudyStatistics", () => {
  it("calculates totals, accuracy, and streaks from UTC activity dates", () => {
    expect(
      calculateStudyStatistics(
        {
          totalAnswers: 5,
          correctAnswers: 3,
          totalSessions: 2,
          activityDatesUtc: [
            "2026-11-18",
            "2026-11-19",
            "2026-11-21",
            "2026-11-21",
          ],
        },
        "2026-11-21",
      ),
    ).toEqual({
      totalAnswers: 5,
      correctAnswers: 3,
      incorrectAnswers: 2,
      accuracyPercentage: 60,
      totalSessions: 2,
      currentStreakDays: 1,
      longestStreakDays: 2,
    });
  });

  it("keeps yesterday's streak active when there is no activity today", () => {
    const statistics = calculateStudyStatistics(
      {
        totalAnswers: 1,
        correctAnswers: 0,
        totalSessions: 1,
        activityDatesUtc: ["2026-11-20"],
      },
      "2026-11-21",
    );

    expect(statistics.currentStreakDays).toBe(1);
    expect(statistics.accuracyPercentage).toBe(0);
  });

  it("returns zero accuracy and streaks when there is no answer history", () => {
    expect(
      calculateStudyStatistics(
        {
          totalAnswers: 0,
          correctAnswers: 0,
          totalSessions: 0,
          activityDatesUtc: [],
        },
        "2026-11-21",
      ),
    ).toEqual({
      totalAnswers: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      accuracyPercentage: 0,
      totalSessions: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
    });
  });
});
