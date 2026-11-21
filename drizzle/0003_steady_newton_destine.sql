ALTER TABLE "daily_challenges" DROP CONSTRAINT "daily_challenges_session_question_fk";
--> statement-breakpoint
ALTER TABLE "user_answers" DROP CONSTRAINT "user_answers_session_question_fk";
--> statement-breakpoint
ALTER TABLE "session_questions" DROP CONSTRAINT "session_questions_session_id_question_id_pk";
--> statement-breakpoint
ALTER TABLE "user_answers" DROP CONSTRAINT "user_answers_session_id_question_id_pk";
--> statement-breakpoint
ALTER TABLE "session_questions" ADD COLUMN "id" uuid;
--> statement-breakpoint
UPDATE "session_questions" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
--> statement-breakpoint
ALTER TABLE "session_questions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "session_questions" ALTER COLUMN "id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_id_pk" PRIMARY KEY("id");
--> statement-breakpoint
ALTER TABLE "user_answers" ADD COLUMN "session_question_id" uuid;
--> statement-breakpoint
UPDATE "user_answers" AS answers
SET "session_question_id" = presentations."id"
FROM "session_questions" AS presentations
WHERE answers."session_id" = presentations."session_id"
  AND answers."question_id" = presentations."question_id";
--> statement-breakpoint
ALTER TABLE "user_answers" ALTER COLUMN "session_question_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_challenges" ADD COLUMN "session_question_id" uuid;
--> statement-breakpoint
UPDATE "daily_challenges" AS challenges
SET "session_question_id" = presentations."id"
FROM "session_questions" AS presentations
WHERE challenges."session_id" = presentations."session_id"
  AND challenges."question_id" = presentations."question_id";
--> statement-breakpoint
ALTER TABLE "daily_challenges" ALTER COLUMN "session_question_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_session_id_session_question_id_pk" PRIMARY KEY("session_id","session_question_id");
--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_id_session_question_unique" UNIQUE("id","session_id","question_id");
--> statement-breakpoint
ALTER TABLE "daily_challenges" ADD CONSTRAINT "daily_challenges_session_question_fk" FOREIGN KEY ("session_question_id","session_id","question_id") REFERENCES "public"."session_questions"("id","session_id","question_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_session_question_fk" FOREIGN KEY ("session_question_id","session_id","question_id") REFERENCES "public"."session_questions"("id","session_id","question_id") ON DELETE restrict ON UPDATE no action;
