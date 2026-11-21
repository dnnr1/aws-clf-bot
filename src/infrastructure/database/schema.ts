import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userLocale = pgEnum("user_locale", ["en", "pt-BR"]);
export const questionDifficulty = pgEnum("question_difficulty", [
  "easy",
  "medium",
  "hard",
]);
export const studyMode = pgEnum("study_mode", [
  "daily_challenge",
  "practice",
  "exam_simulation",
  "domain_practice",
]);
export const studySessionStatus = pgEnum("study_session_status", [
  "in_progress",
  "completed",
  "expired",
  "abandoned",
]);

export const certifications = pgTable("certifications", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull(),
});

export const examDomains = pgTable(
  "exam_domains",
  {
    id: varchar("id", { length: 48 }).primaryKey(),
    certificationId: varchar("certification_id", { length: 32 })
      .notNull()
      .references(() => certifications.id, { onDelete: "restrict" }),
    ordinal: smallint("ordinal").notNull(),
    nameEn: text("name_en").notNull(),
    namePtBr: text("name_pt_br").notNull(),
  },
  (table) => [
    unique("exam_domains_certification_ordinal_unique").on(
      table.certificationId,
      table.ordinal,
    ),
    unique("exam_domains_id_certification_unique").on(
      table.id,
      table.certificationId,
    ),
    check("exam_domains_ordinal_positive", sql`${table.ordinal} > 0`),
  ],
);

export const examObjectives = pgTable(
  "exam_objectives",
  {
    id: varchar("id", { length: 48 }).primaryKey(),
    certificationId: varchar("certification_id", { length: 32 })
      .notNull()
      .references(() => certifications.id, { onDelete: "restrict" }),
    domainId: varchar("domain_id", { length: 48 }).notNull(),
    objectiveCode: varchar("objective_code", { length: 24 }).notNull(),
    descriptionEn: text("description_en").notNull(),
    descriptionPtBr: text("description_pt_br").notNull(),
  },
  (table) => [
    unique("exam_objectives_certification_code_unique").on(
      table.certificationId,
      table.objectiveCode,
    ),
    foreignKey({
      columns: [table.domainId, table.certificationId],
      foreignColumns: [examDomains.id, examDomains.certificationId],
      name: "exam_objectives_domain_certification_fk",
    }).onDelete("restrict"),
  ],
);

export const users = pgTable("users", {
  discordUserId: varchar("discord_user_id", { length: 20 }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: varchar("user_id", { length: 20 })
    .primaryKey()
    .references(() => users.discordUserId, { onDelete: "cascade" }),
  locale: userLocale("locale").notNull().default("en"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    certificationId: varchar("certification_id", { length: 32 }).notNull(),
    domainId: varchar("domain_id", { length: 48 }).notNull(),
    difficulty: questionDifficulty("difficulty").notNull(),
    promptEn: text("prompt_en").notNull(),
    promptPtBr: text("prompt_pt_br").notNull(),
    explanationEn: text("explanation_en").notNull(),
    explanationPtBr: text("explanation_pt_br").notNull(),
    correctOptionKey: varchar("correct_option_key", { length: 1 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.domainId, table.certificationId],
      foreignColumns: [examDomains.id, examDomains.certificationId],
      name: "questions_domain_certification_fk",
    }).onDelete("restrict"),
    index("questions_certification_domain_active_idx").on(
      table.certificationId,
      table.domainId,
      table.isActive,
    ),
    check(
      "questions_correct_option_key_valid",
      sql`${table.correctOptionKey} in ('A', 'B', 'C', 'D')`,
    ),
  ],
);

export const questionOptions = pgTable(
  "question_options",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    optionKey: varchar("option_key", { length: 1 }).notNull(),
    textEn: text("text_en").notNull(),
    textPtBr: text("text_pt_br").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.questionId, table.optionKey] }),
    check(
      "question_options_option_key_valid",
      sql`${table.optionKey} in ('A', 'B', 'C', 'D')`,
    ),
  ],
);

export const awsServices = pgTable("aws_services", {
  id: varchar("id", { length: 80 }).primaryKey(),
  name: text("name").notNull(),
});

export const questionServices = pgTable(
  "question_services",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    serviceId: varchar("service_id", { length: 80 })
      .notNull()
      .references(() => awsServices.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.serviceId] })],
);

export const questionObjectives = pgTable(
  "question_objectives",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    objectiveId: varchar("objective_id", { length: 48 })
      .notNull()
      .references(() => examObjectives.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.objectiveId] })],
);

export const questionSources = pgTable(
  "question_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
  },
  (table) => [index("question_sources_question_idx").on(table.questionId)],
);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 20 })
      .notNull()
      .references(() => users.discordUserId, { onDelete: "restrict" }),
    certificationId: varchar("certification_id", { length: 32 })
      .notNull()
      .references(() => certifications.id, { onDelete: "restrict" }),
    mode: studyMode("mode").notNull(),
    status: studySessionStatus("status").notNull().default("in_progress"),
    domainId: varchar("domain_id", { length: 48 }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    unique("study_sessions_id_user_unique").on(table.id, table.userId),
    foreignKey({
      columns: [table.domainId, table.certificationId],
      foreignColumns: [examDomains.id, examDomains.certificationId],
      name: "study_sessions_domain_certification_fk",
    }).onDelete("restrict"),
    index("study_sessions_user_started_idx").on(table.userId, table.startedAt),
    check(
      "study_sessions_domain_mode_consistent",
      sql`(${table.mode} = 'domain_practice' and ${table.domainId} is not null) or (${table.mode} <> 'domain_practice' and ${table.domainId} is null)`,
    ),
    check(
      "study_sessions_expiration_after_start",
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.startedAt}`,
    ),
  ],
);

export const sessionQuestions = pgTable(
  "session_questions",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => studySessions.id, { onDelete: "restrict" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.questionId] }),
    unique("session_questions_position_unique").on(
      table.sessionId,
      table.position,
    ),
    index("session_questions_question_idx").on(table.questionId),
    check("session_questions_position_positive", sql`${table.position} > 0`),
  ],
);

export const userAnswers = pgTable(
  "user_answers",
  {
    sessionId: uuid("session_id").notNull(),
    questionId: uuid("question_id").notNull(),
    selectedOptionKey: varchar("selected_option_key", { length: 1 }).notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.questionId] }),
    foreignKey({
      columns: [table.sessionId, table.questionId],
      foreignColumns: [sessionQuestions.sessionId, sessionQuestions.questionId],
      name: "user_answers_session_question_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.questionId, table.selectedOptionKey],
      foreignColumns: [questionOptions.questionId, questionOptions.optionKey],
      name: "user_answers_question_option_fk",
    }).onDelete("restrict"),
    index("user_answers_question_answered_idx").on(
      table.questionId,
      table.answeredAt,
    ),
  ],
);

export const dailyChallenges = pgTable(
  "daily_challenges",
  {
    userId: varchar("user_id", { length: 20 }).notNull(),
    challengeDate: date("challenge_date", { mode: "string" }).notNull(),
    sessionId: uuid("session_id").notNull(),
    questionId: uuid("question_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.challengeDate] }),
    unique("daily_challenges_session_unique").on(table.sessionId),
    foreignKey({
      columns: [table.sessionId, table.userId],
      foreignColumns: [studySessions.id, studySessions.userId],
      name: "daily_challenges_owned_session_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.sessionId, table.questionId],
      foreignColumns: [sessionQuestions.sessionId, sessionQuestions.questionId],
      name: "daily_challenges_session_question_fk",
    }).onDelete("restrict"),
  ],
);

export const examResults = pgTable(
  "exam_results",
  {
    sessionId: uuid("session_id")
      .primaryKey()
      .references(() => studySessions.id, { onDelete: "restrict" }),
    correctCount: smallint("correct_count").notNull(),
    questionCount: smallint("question_count").notNull(),
    accuracy: numeric("accuracy", { precision: 5, scale: 2 }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      "exam_results_counts_valid",
      sql`${table.correctCount} >= 0 and ${table.questionCount} > 0 and ${table.correctCount} <= ${table.questionCount}`,
    ),
    check(
      "exam_results_accuracy_valid",
      sql`${table.accuracy} between 0 and 100`,
    ),
  ],
);

export const examDomainResults = pgTable(
  "exam_domain_results",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => examResults.sessionId, { onDelete: "restrict" }),
    domainId: varchar("domain_id", { length: 48 })
      .notNull()
      .references(() => examDomains.id, { onDelete: "restrict" }),
    correctCount: smallint("correct_count").notNull(),
    questionCount: smallint("question_count").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.domainId] }),
    check(
      "exam_domain_results_counts_valid",
      sql`${table.correctCount} >= 0 and ${table.questionCount} > 0 and ${table.correctCount} <= ${table.questionCount}`,
    ),
  ],
);
