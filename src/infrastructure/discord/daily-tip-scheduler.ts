import { EmbedBuilder, type Client } from "discord.js";
import type { DailyTipPublicationRepository } from "../../application/study/daily-tip-publication-repository.js";
import type { DailyTip } from "../questions/daily-tip-schema.js";
import type { Logger } from "../logging/logger.js";

const dailyTipScheduleUtc = [
  { slot: 1, hour: 12 },
  { slot: 2, hour: 16 },
  { slot: 3, hour: 20 },
] as const;
const dailyTipCheckIntervalMilliseconds = 60_000;
const domainNames = {
  "cloud-concepts": {
    en: "Cloud Concepts",
    "pt-BR": "Conceitos de nuvem",
  },
  "security-compliance": {
    en: "Security and Compliance",
    "pt-BR": "Segurança e conformidade",
  },
  "cloud-technology-services": {
    en: "Cloud Technology and Services",
    "pt-BR": "Tecnologia e serviços em nuvem",
  },
  "billing-pricing-support": {
    en: "Billing, Pricing, and Support",
    "pt-BR": "Faturamento, preços e suporte",
  },
} as const;

export function startDailyTipScheduler(
  client: Client,
  channelId: string,
  tips: DailyTip[],
  publications: DailyTipPublicationRepository,
  logger: Logger,
): () => void {
  let isPublishing = false;

  const checkSchedule = async (): Promise<void> => {
    if (isPublishing) {
      return;
    }

    isPublishing = true;

    try {
      const now = new Date();
      const slot = getDueDailyTipSlot(now);

      if (slot === null) {
        return;
      }

      const tip = selectDailyTip(tips, now, slot);
      const dateUtc = now.toISOString().slice(0, 10);
      const claimed = await publications.claimPublication(
        dateUtc,
        slot,
        tip.id,
      );

      if (!claimed) {
        return;
      }

      const channel = await client.channels.fetch(channelId);

      if (!channel?.isSendable()) {
        throw new Error(
          "DISCORD_TIPS_CHANNEL_ID must refer to a text channel the bot can send messages to.",
        );
      }

      const message = await channel.send({
        embeds: [renderDailyTip(tip)],
        allowedMentions: { parse: [] },
      });
      await publications.markPublicationSent(dateUtc, slot, message.id);
      logger.info("daily_tip.published", {
        dateUtc,
        slot: String(slot),
        tipId: tip.id,
      });
    } finally {
      isPublishing = false;
    }
  };

  const runCheck = (): void => {
    void checkSchedule().catch((error: unknown) => {
      logger.error("daily_tip.publish_failed", error, { channelId });
    });
  };

  runCheck();
  const interval = setInterval(runCheck, dailyTipCheckIntervalMilliseconds);

  return () => clearInterval(interval);
}

export function getDueDailyTipSlot(
  now: Date,
): (typeof dailyTipScheduleUtc)[number]["slot"] | null {
  const scheduledSlot = dailyTipScheduleUtc.find(
    (entry) => entry.hour === now.getUTCHours(),
  );
  return scheduledSlot?.slot ?? null;
}

function selectDailyTip(
  tips: DailyTip[],
  now: Date,
  slot: (typeof dailyTipScheduleUtc)[number]["slot"],
): DailyTip {
  const dayNumber = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
      86_400_000,
  );
  const slotIndex = slot - 1;
  const tipIndex =
    (dayNumber * dailyTipScheduleUtc.length + slotIndex) % tips.length;
  const tip = tips[tipIndex];

  if (!tip) {
    throw new Error("The daily tip bank does not contain a scheduled tip.");
  }

  return tip;
}

function renderDailyTip(tip: DailyTip): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`${tip.title.en} / ${tip.title["pt-BR"]}`)
    .addFields(
      { name: "English", value: tip.content.en },
      { name: "Português (Brasil)", value: tip.content["pt-BR"] },
      {
        name: "Source / Fonte",
        value: `[${tip.source.label}](${tip.source.url})`,
      },
    )
    .setFooter({
      text: `CLF-C02 · ${domainNames[tip.domainId].en} / ${domainNames[tip.domainId]["pt-BR"]}`,
    });
}
