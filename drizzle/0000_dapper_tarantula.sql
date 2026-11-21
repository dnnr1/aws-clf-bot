CREATE TYPE "public"."question_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."study_mode" AS ENUM('daily_challenge', 'practice', 'exam_simulation', 'domain_practice');--> statement-breakpoint
CREATE TYPE "public"."study_session_status" AS ENUM('in_progress', 'completed', 'expired', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."user_locale" AS ENUM('en', 'pt-BR');--> statement-breakpoint
CREATE TABLE "aws_services" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_challenges" (
	"user_id" varchar(20) NOT NULL,
	"challenge_date" date NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "daily_challenges_user_id_challenge_date_pk" PRIMARY KEY("user_id","challenge_date"),
	CONSTRAINT "daily_challenges_session_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "exam_domain_results" (
	"session_id" uuid NOT NULL,
	"domain_id" varchar(48) NOT NULL,
	"correct_count" smallint NOT NULL,
	"question_count" smallint NOT NULL,
	CONSTRAINT "exam_domain_results_session_id_domain_id_pk" PRIMARY KEY("session_id","domain_id"),
	CONSTRAINT "exam_domain_results_counts_valid" CHECK ("exam_domain_results"."correct_count" >= 0 and "exam_domain_results"."question_count" > 0 and "exam_domain_results"."correct_count" <= "exam_domain_results"."question_count")
);
--> statement-breakpoint
CREATE TABLE "exam_domains" (
	"id" varchar(48) PRIMARY KEY NOT NULL,
	"certification_id" varchar(32) NOT NULL,
	"ordinal" smallint NOT NULL,
	"name_en" text NOT NULL,
	"name_pt_br" text NOT NULL,
	CONSTRAINT "exam_domains_certification_ordinal_unique" UNIQUE("certification_id","ordinal"),
	CONSTRAINT "exam_domains_id_certification_unique" UNIQUE("id","certification_id"),
	CONSTRAINT "exam_domains_ordinal_positive" CHECK ("exam_domains"."ordinal" > 0)
);
--> statement-breakpoint
CREATE TABLE "exam_objectives" (
	"id" varchar(48) PRIMARY KEY NOT NULL,
	"certification_id" varchar(32) NOT NULL,
	"domain_id" varchar(48) NOT NULL,
	"objective_code" varchar(24) NOT NULL,
	"description_en" text NOT NULL,
	"description_pt_br" text NOT NULL,
	CONSTRAINT "exam_objectives_certification_code_unique" UNIQUE("certification_id","objective_code")
);
--> statement-breakpoint
CREATE TABLE "exam_results" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"correct_count" smallint NOT NULL,
	"question_count" smallint NOT NULL,
	"accuracy" numeric(5, 2) NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "exam_results_counts_valid" CHECK ("exam_results"."correct_count" >= 0 and "exam_results"."question_count" > 0 and "exam_results"."correct_count" <= "exam_results"."question_count"),
	CONSTRAINT "exam_results_accuracy_valid" CHECK ("exam_results"."accuracy" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "question_objectives" (
	"question_id" uuid NOT NULL,
	"objective_id" varchar(48) NOT NULL,
	CONSTRAINT "question_objectives_question_id_objective_id_pk" PRIMARY KEY("question_id","objective_id")
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"question_id" uuid NOT NULL,
	"option_key" varchar(1) NOT NULL,
	"text_en" text NOT NULL,
	"text_pt_br" text NOT NULL,
	CONSTRAINT "question_options_question_id_option_key_pk" PRIMARY KEY("question_id","option_key"),
	CONSTRAINT "question_options_option_key_valid" CHECK ("question_options"."option_key" in ('A', 'B', 'C', 'D'))
);
--> statement-breakpoint
CREATE TABLE "question_services" (
	"question_id" uuid NOT NULL,
	"service_id" varchar(80) NOT NULL,
	CONSTRAINT "question_services_question_id_service_id_pk" PRIMARY KEY("question_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "question_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certification_id" varchar(32) NOT NULL,
	"domain_id" varchar(48) NOT NULL,
	"difficulty" "question_difficulty" NOT NULL,
	"prompt_en" text NOT NULL,
	"prompt_pt_br" text NOT NULL,
	"explanation_en" text NOT NULL,
	"explanation_pt_br" text NOT NULL,
	"correct_option_key" varchar(1) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_correct_option_key_valid" CHECK ("questions"."correct_option_key" in ('A', 'B', 'C', 'D'))
);
--> statement-breakpoint
CREATE TABLE "session_questions" (
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "session_questions_session_id_question_id_pk" PRIMARY KEY("session_id","question_id"),
	CONSTRAINT "session_questions_position_unique" UNIQUE("session_id","position"),
	CONSTRAINT "session_questions_position_positive" CHECK ("session_questions"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(20) NOT NULL,
	"certification_id" varchar(32) NOT NULL,
	"mode" "study_mode" NOT NULL,
	"status" "study_session_status" DEFAULT 'in_progress' NOT NULL,
	"domain_id" varchar(48),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "study_sessions_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "study_sessions_domain_mode_consistent" CHECK (("study_sessions"."mode" = 'domain_practice' and "study_sessions"."domain_id" is not null) or ("study_sessions"."mode" <> 'domain_practice' and "study_sessions"."domain_id" is null)),
	CONSTRAINT "study_sessions_expiration_after_start" CHECK ("study_sessions"."expires_at" is null or "study_sessions"."expires_at" > "study_sessions"."started_at")
);
--> statement-breakpoint
CREATE TABLE "user_answers" (
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_key" varchar(1) NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_answers_session_id_question_id_pk" PRIMARY KEY("session_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" varchar(20) PRIMARY KEY NOT NULL,
	"locale" "user_locale" DEFAULT 'en' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"discord_user_id" varchar(20) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_challenges" ADD CONSTRAINT "daily_challenges_owned_session_fk" FOREIGN KEY ("session_id","user_id") REFERENCES "public"."study_sessions"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_challenges" ADD CONSTRAINT "daily_challenges_session_question_fk" FOREIGN KEY ("session_id","question_id") REFERENCES "public"."session_questions"("session_id","question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_domain_results" ADD CONSTRAINT "exam_domain_results_session_id_exam_results_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."exam_results"("session_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_domain_results" ADD CONSTRAINT "exam_domain_results_domain_id_exam_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."exam_domains"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_domains" ADD CONSTRAINT "exam_domains_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_objectives" ADD CONSTRAINT "exam_objectives_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_objectives" ADD CONSTRAINT "exam_objectives_domain_certification_fk" FOREIGN KEY ("domain_id","certification_id") REFERENCES "public"."exam_domains"("id","certification_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_objectives" ADD CONSTRAINT "question_objectives_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_objectives" ADD CONSTRAINT "question_objectives_objective_id_exam_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."exam_objectives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_services" ADD CONSTRAINT "question_services_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_services" ADD CONSTRAINT "question_services_service_id_aws_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."aws_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_domain_certification_fk" FOREIGN KEY ("domain_id","certification_id") REFERENCES "public"."exam_domains"("id","certification_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_discord_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("discord_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_domain_certification_fk" FOREIGN KEY ("domain_id","certification_id") REFERENCES "public"."exam_domains"("id","certification_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_session_question_fk" FOREIGN KEY ("session_id","question_id") REFERENCES "public"."session_questions"("session_id","question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_question_option_fk" FOREIGN KEY ("question_id","selected_option_key") REFERENCES "public"."question_options"("question_id","option_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_discord_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("discord_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_sources_question_idx" ON "question_sources" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "questions_certification_domain_active_idx" ON "questions" USING btree ("certification_id","domain_id","is_active");--> statement-breakpoint
CREATE INDEX "session_questions_question_idx" ON "session_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "study_sessions_user_started_idx" ON "study_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "user_answers_question_answered_idx" ON "user_answers" USING btree ("question_id","answered_at");
--> statement-breakpoint
INSERT INTO "certifications" ("id", "name")
VALUES ('aws-clf-c02', 'AWS Certified Cloud Practitioner (CLF-C02)');
--> statement-breakpoint
INSERT INTO "exam_domains" ("id", "certification_id", "ordinal", "name_en", "name_pt_br")
VALUES
  ('cloud-concepts', 'aws-clf-c02', 1, 'Cloud Concepts', 'Conceitos de nuvem'),
  ('security-compliance', 'aws-clf-c02', 2, 'Security and Compliance', 'Segurança e conformidade'),
  ('cloud-technology-services', 'aws-clf-c02', 3, 'Cloud Technology and Services', 'Tecnologia e serviços em nuvem'),
  ('billing-pricing-support', 'aws-clf-c02', 4, 'Billing, Pricing, and Support', 'Faturamento, preços e suporte');
--> statement-breakpoint
INSERT INTO "exam_objectives" (
  "id",
  "certification_id",
  "domain_id",
  "objective_code",
  "description_en",
  "description_pt_br"
)
VALUES (
  'clf-c02-2-1',
  'aws-clf-c02',
  'security-compliance',
  '2.1',
  'Understand the AWS shared responsibility model.',
  'Compreender o modelo de responsabilidade compartilhada da AWS.'
);
