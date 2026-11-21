const millisecondsPerDay = 86_400_000;

export interface StudyStatisticsSnapshot {
  totalAnswers: number;
  correctAnswers: number;
  totalSessions: number;
  activityDatesUtc: string[];
}

export interface StudyStatistics {
  totalAnswers: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracyPercentage: number;
  totalSessions: number;
  currentStreakDays: number;
  longestStreakDays: number;
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
    currentStreakDays,
    longestStreakDays,
  };
}
