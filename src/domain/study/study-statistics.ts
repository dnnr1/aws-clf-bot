const millisecondsPerDay = 86_400_000;

export interface StudyStatisticsSnapshot {
  totalAnswers: number;
  correctAnswers: number;
  totalSessions: number;
  completedExams: number;
  bestExamCorrectCount: number | null;
  bestExamAccuracyPercentage: number | null;
  activityDatesUtc: string[];
}

export interface StudyStatistics {
  totalAnswers: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracyPercentage: number;
  totalSessions: number;
  completedExams: number;
  bestExamCorrectCount: number | null;
  bestExamAccuracyPercentage: number | null;
  currentStreakDays: number;
  longestStreakDays: number;
}

export interface LeaderboardEntrySnapshot {
  discordUserId: string;
  totalAnswers: number;
  correctAnswers: number;
}

export interface LeaderboardEntry extends LeaderboardEntrySnapshot {
  accuracyPercentage: number;
}

export const leaderboardMinimumAnswers = 10;
export const leaderboardEntryLimit = 10;

export function calculateLeaderboard(
  snapshots: LeaderboardEntrySnapshot[],
): LeaderboardEntry[] {
  return snapshots
    .filter((entry) => entry.totalAnswers >= leaderboardMinimumAnswers)
    .map((entry) => ({
      ...entry,
      accuracyPercentage:
        entry.totalAnswers === 0
          ? 0
          : (entry.correctAnswers / entry.totalAnswers) * 100,
    }))
    .sort(
      (left, right) =>
        right.accuracyPercentage - left.accuracyPercentage ||
        right.totalAnswers - left.totalAnswers ||
        right.correctAnswers - left.correctAnswers ||
        left.discordUserId.localeCompare(right.discordUserId),
    )
    .slice(0, leaderboardEntryLimit);
}

export function calculateStudyStatistics(
  snapshot: StudyStatisticsSnapshot,
  todayUtc: string,
): StudyStatistics {
  const activityDates = new Set(snapshot.activityDatesUtc);
  const sortedActivityDates = [...activityDates].sort();
  let longestStreakDays = 0;
  let currentSequenceDays = 0;
  let previousDate: number | undefined;

  for (const activityDate of sortedActivityDates) {
    const currentDate = Date.parse(`${activityDate}T00:00:00.000Z`);

    if (
      previousDate !== undefined &&
      currentDate === previousDate + millisecondsPerDay
    ) {
      currentSequenceDays += 1;
    } else {
      currentSequenceDays = 1;
    }

    longestStreakDays = Math.max(longestStreakDays, currentSequenceDays);
    previousDate = currentDate;
  }

  const todayTimestamp = Date.parse(`${todayUtc}T00:00:00.000Z`);
  const latestEligibleDate = activityDates.has(todayUtc)
    ? todayTimestamp
    : todayTimestamp - millisecondsPerDay;
  let currentStreakDays = 0;

  for (
    let activeDate = latestEligibleDate;
    activityDates.has(new Date(activeDate).toISOString().slice(0, 10));
    activeDate -= millisecondsPerDay
  ) {
    currentStreakDays += 1;
  }

  return {
    totalAnswers: snapshot.totalAnswers,
    correctAnswers: snapshot.correctAnswers,
    incorrectAnswers: snapshot.totalAnswers - snapshot.correctAnswers,
    accuracyPercentage:
      snapshot.totalAnswers === 0
        ? 0
        : (snapshot.correctAnswers / snapshot.totalAnswers) * 100,
    totalSessions: snapshot.totalSessions,
    completedExams: snapshot.completedExams,
    bestExamCorrectCount: snapshot.bestExamCorrectCount,
    bestExamAccuracyPercentage: snapshot.bestExamAccuracyPercentage,
    currentStreakDays,
    longestStreakDays,
  };
}
