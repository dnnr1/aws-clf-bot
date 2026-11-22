import type {
  LeaderboardEntrySnapshot,
  StudyStatisticsSnapshot,
} from "../../domain/study/study-statistics.js";

export interface StatisticsRepository {
  getStudyStatistics(discordUserId: string): Promise<StudyStatisticsSnapshot>;
  getLeaderboardEntries(): Promise<LeaderboardEntrySnapshot[]>;
}
