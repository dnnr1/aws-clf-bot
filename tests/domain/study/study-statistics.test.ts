import { describe, expect, it } from "vitest";
import {
  calculateLeaderboard,
  calculateStudyStatistics,
} from "../../../src/domain/study/study-statistics.js";

describe("calculateLeaderboard", () => {
  it("filters ineligible users and applies ranking tie-breakers", () => {
    expect(
      calculateLeaderboard([
        { discordUserId: "2", totalAnswers: 9, correctAnswers: 9 },
        { discordUserId: "3", totalAnswers: 20, correctAnswers: 15 },
        { discordUserId: "1", totalAnswers: 30, correctAnswers: 24 },
        { discordUserId: "4", totalAnswers: 10, correctAnswers: 8 },
      ]),
    ).toEqual([
      {
        discordUserId: "1",
        totalAnswers: 30,
        correctAnswers: 24,
        accuracyPercentage: 80,
      },
      {
        discordUserId: "4",
        totalAnswers: 10,
        correctAnswers: 8,
        accuracyPercentage: 80,
      },
      {
        discordUserId: "3",
        totalAnswers: 20,
        correctAnswers: 15,
        accuracyPercentage: 75,
      },
    ]);
  });
});

describe("calculateStudyStatistics", () => {
  it("calculates totals, accuracy, and streaks from UTC activity dates", () => {
    expect(
      calculateStudyStatistics(
        {
          totalAnswers: 5,
          correctAnswers: 3,
          totalSessions: 2,
          completedExams: 1,
          bestExamCorrectCount: 48,
          bestExamAccuracyPercentage: 73.85,
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
      completedExams: 1,
      bestExamCorrectCount: 48,
      bestExamAccuracyPercentage: 73.85,
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
        completedExams: 0,
        bestExamCorrectCount: null,
        bestExamAccuracyPercentage: null,
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
          completedExams: 0,
          bestExamCorrectCount: null,
          bestExamAccuracyPercentage: null,
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
      completedExams: 0,
      bestExamCorrectCount: null,
      bestExamAccuracyPercentage: null,
      currentStreakDays: 0,
      longestStreakDays: 0,
    });
  });
});
