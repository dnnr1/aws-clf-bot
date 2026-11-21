CREATE TABLE "bot_channel_messages" (
	"key" varchar(48) PRIMARY KEY NOT NULL,
	"channel_id" varchar(20) NOT NULL,
	"message_id" varchar(20) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_tip_publications" (
	"tip_date" date NOT NULL,
	"slot" smallint NOT NULL,
	"tip_id" varchar(48) NOT NULL,
	"message_id" varchar(20),
	"sent_at" timestamp with time zone,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_tip_publications_tip_date_slot_pk" PRIMARY KEY("tip_date","slot"),
	CONSTRAINT "daily_tip_publications_date_tip_unique" UNIQUE("tip_date","tip_id"),
	CONSTRAINT "daily_tip_publications_slot_valid" CHECK ("daily_tip_publications"."slot" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "locale" SET DEFAULT 'pt-BR';