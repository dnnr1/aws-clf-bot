import { z } from "zod";

const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(1_200),
  "pt-BR": z.string().trim().min(1).max(1_200),
});

const tipSchema = z.object({
  id: z.string().trim().min(1).max(48),
  domainId: z.enum([
    "cloud-concepts",
    "security-compliance",
    "cloud-technology-services",
    "billing-pricing-support",
  ]),
  title: z.object({
    en: z.string().trim().min(1).max(100),
    "pt-BR": z.string().trim().min(1).max(100),
  }),
  content: localizedTextSchema,
  source: z.object({
    label: z.string().trim().min(1).max(160),
    url: z.string().url(),
  }),
});

const dailyTipBankSchema = z
  .array(tipSchema)
  .min(3)
  .superRefine((tips, context) => {
    const tipIds = tips.map((tip) => tip.id);

    if (new Set(tipIds).size !== tipIds.length) {
      context.addIssue({
        code: "custom",
        message: "Tip identifiers must be unique within the bank.",
      });
    }
  });

export type DailyTip = z.infer<typeof tipSchema>;

export function parseDailyTipBank(input: unknown): DailyTip[] {
  return dailyTipBankSchema.parse(input);
}
