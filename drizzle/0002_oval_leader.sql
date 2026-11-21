CREATE TABLE "guild_channel_settings" (
	"guild_id" varchar(20) PRIMARY KEY NOT NULL,
	"practice_channel_id" varchar(20),
	"tips_channel_id" varchar(20),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_tip_publications" DROP CONSTRAINT "daily_tip_publications_date_tip_unique";--> statement-breakpoint
ALTER TABLE "daily_tip_publications" ADD COLUMN "guild_id" varchar(20) NOT NULL DEFAULT 'legacy';--> statement-breakpoint
ALTER TABLE "daily_tip_publications" ALTER COLUMN "guild_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "daily_tip_publications" DROP CONSTRAINT "daily_tip_publications_tip_date_slot_pk";--> statement-breakpoint
ALTER TABLE "daily_tip_publications" ADD CONSTRAINT "daily_tip_publications_tip_date_guild_id_slot_pk" PRIMARY KEY("tip_date","guild_id","slot");--> statement-breakpoint
ALTER TABLE "daily_tip_publications" ADD CONSTRAINT "daily_tip_publications_date_tip_unique" UNIQUE("tip_date","guild_id","tip_id");