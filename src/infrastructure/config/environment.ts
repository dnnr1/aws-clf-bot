import { z } from "zod";

const environmentSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z
    .string()
    .regex(/^\d{17,20}$/)
    .optional(),
  DISCORD_PRACTICE_CHANNEL_ID: z.string().regex(/^\d{17,20}$/),
  DISCORD_TIPS_CHANNEL_ID: z.string().regex(/^\d{17,20}$/),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
      {
        message: "DATABASE_URL must use the postgres or postgresql protocol",
      },
    ),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(
  source: Record<string, string | undefined>,
): Environment {
  return environmentSchema.parse(source);
}
