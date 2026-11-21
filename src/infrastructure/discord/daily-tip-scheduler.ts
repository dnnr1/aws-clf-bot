import { ChannelType, EmbedBuilder, type Client } from "discord.js";
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

export interface DailyTipDestination {
  guildId: string;
  channelId: string;
}

export function startDailyTipScheduler(
  client: Client,
  resolveDestinations: () => Promise<DailyTipDestination[]>,
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
      const dateUtc = now.toISOString().slice(0, 10);
      const destinations = await resolveDestinations();

      for (const destination of destinations) {
        try {
          await publishImmediateDailyTip(
            client,
            destination,
            tips,
            publications,
            logger,
            now,
          );

          if (slot === null) {
            continue;
          }

          const tip = selectDailyTip(tips, now, slot);
          const claimed = await publications.claimPublication(
            dateUtc,
            destination.guildId,
            slot,
            destination.channelId,
            tip.id,
          );

          if (claimed) {
            await publishTip(
              client,
              destination,
              dateUtc,
              slot,
              tip,
              publications,
              logger,
              "scheduled",
            );
          }
        } catch (error) {
          logger.error("daily_tip.publish_failed", error, {
            channelId: destination.channelId,
            guildId: destination.guildId,
          });
        }
      }
    } finally {
      isPublishing = false;
    }
  };

  const runCheck = (): void => {
    void checkSchedule().catch((error: unknown) =>
      logger.error("daily_tip.schedule_check_failed", error),
    );
  };

  runCheck();
  const interval = setInterval(runCheck, dailyTipCheckIntervalMilliseconds);

  return () => clearInterval(interval);
}

export async function publishImmediateDailyTip(
  client: Client,
  destination: DailyTipDestination,
  tips: DailyTip[],
  publications: DailyTipPublicationRepository,
  logger: Logger,
  now = new Date(),
): Promise<boolean> {
  const dateUtc = now.toISOString().slice(0, 10);
  if (
    await publications.hasPublicationForChannel(
      dateUtc,
      destination.guildId,
      destination.channelId,
    )
  ) {
    return false;
  }

  const initialTip = selectDailyTip(tips, now, 1);
  const initialClaimed = await publications.claimInitialPublication(
    dateUtc,
    destination.guildId,
    destination.channelId,
    initialTip.id,
  );

  if (initialClaimed) {
    await publishTip(
      client,
      destination,
      dateUtc,
      1,
      initialTip,
      publications,
      logger,
      "initial",
    );
    return true;
  }

  if (
    await publications.hasPublicationForChannel(
      dateUtc,
      destination.guildId,
      destination.channelId,
    )
  ) {
    return false;
  }

  for (const { slot } of dailyTipScheduleUtc) {
    const tip = selectDailyTip(tips, now, slot);
    const claimed = await publications.claimPublication(
      dateUtc,
      destination.guildId,
      slot,
      destination.channelId,
      tip.id,
    );

    if (!claimed) {
      continue;
    }

    await publishTip(
      client,
      destination,
      dateUtc,
      slot,
      tip,
      publications,
      logger,
      "initial",
    );
    return true;
  }

  return false;
}

async function publishTip(
  client: Client,
  destination: DailyTipDestination,
  dateUtc: string,
  slot: number,
  tip: DailyTip,
  publications: DailyTipPublicationRepository,
  logger: Logger,
  publicationType: "initial" | "scheduled",
): Promise<void> {
  const channel = await client.channels.fetch(destination.channelId);

  if (
    !channel ||
    channel.type !== ChannelType.GuildText ||
    channel.guildId !== destination.guildId
  ) {
    throw new Error(
      "The tips channel must be a text channel in its configured server.",
    );
  }

  const message = await channel.send({
    embeds: [renderDailyTip(tip)],
    allowedMentions: { parse: [] },
  });
  await publications.markPublicationSent(
    dateUtc,
    destination.guildId,
    slot,
    message.id,
  );
  logger.info(
    publicationType === "initial"
      ? "daily_tip.initial_published"
      : "daily_tip.published",
    {
      dateUtc,
      guildId: destination.guildId,
      slot: String(slot),
      tipId: tip.id,
    },
  );
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
    .setTitle(tip.title["pt-BR"])
    .addFields(
      { name: "Dica", value: tip.content["pt-BR"] },
      {
        name: "Fonte",
        value: `[${tip.source.label}](${tip.source.url})`,
      },
    )
    .setFooter({
      text: `CLF-C02 · ${domainNames[tip.domainId]["pt-BR"]}`,
    });
}
