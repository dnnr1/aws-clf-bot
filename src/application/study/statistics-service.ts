import {
  calculateLeaderboard,
  calculateStudyStatistics,
} from "../../domain/study/study-statistics.js";
import type {
  LeaderboardEntry,
  StudyStatistics,
} from "../../domain/study/study-statistics.js";
import type { StatisticsRepository } from "./statistics-repository.js";

export class StatisticsService {
  constructor(private readonly repository: StatisticsRepository) {}

  async getStudyStatistics(discordUserId: string): Promise<StudyStatistics> {
    const snapshot = await this.repository.getStudyStatistics(discordUserId);
    const todayUtc = new Date().toISOString().slice(0, 10);

    return calculateStudyStatistics(snapshot, todayUtc);
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const entries = await this.repository.getLeaderboardEntries();
    return calculateLeaderboard(entries);
  }
}
