import { z } from "zod";

const localizedOptionTextSchema = z.object({
  en: z.string().trim().min(1).max(200),
  "pt-BR": z.string().trim().min(1).max(200),
});

const localizedPromptSchema = z.object({
  en: z.string().trim().min(1).max(900),
  "pt-BR": z.string().trim().min(1).max(900),
});

const localizedExplanationSchema = z.object({
  en: z.string().trim().min(1).max(1_000),
  "pt-BR": z.string().trim().min(1).max(1_000),
});

const optionSchema = z.object({
  key: z.enum(["A", "B", "C", "D"]),
  text: localizedOptionTextSchema,
});

const sourceSchema = z.object({
  label: z.string().trim().min(1),
  url: z.string().url(),
});

const questionSchema = z
  .object({
    id: z.string().uuid(),
    certificationId: z.string().trim().min(1),
    domainId: z.string().trim().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]),
    prompt: localizedPromptSchema,
    options: z.array(optionSchema).length(4),
    correctOptionKey: z.enum(["A", "B", "C", "D"]),
    explanation: localizedExplanationSchema,
    objectives: z.array(z.string().trim().min(1)).min(1),
    services: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          name: z.string().trim().min(1),
        }),
      )
      .min(1),
    sources: z.array(sourceSchema).min(1),
  })
  .superRefine((question, context) => {
    const optionKeys = question.options.map((option) => option.key);

    if (new Set(optionKeys).size !== 4) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Each answer option must have a unique identifier.",
      });
    }

    if (!optionKeys.includes(question.correctOptionKey)) {
      context.addIssue({
        code: "custom",
        path: ["correctOptionKey"],
        message:
          "The correct option identifier must match one of the four options.",
      });
    }

    if (new Set(question.objectives).size !== question.objectives.length) {
      context.addIssue({
        code: "custom",
        path: ["objectives"],
        message: "Exam objectives must be unique.",
      });
    }

    const serviceIds = question.services.map((service) => service.id);

    if (new Set(serviceIds).size !== serviceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["services"],
        message: "AWS services must be unique.",
      });
    }
  });

const questionBankSchema = z
  .array(questionSchema)
  .min(1)
  .superRefine((questions, context) => {
    const questionIds = questions.map((question) => question.id);

    if (new Set(questionIds).size !== questionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Question identifiers must be unique within the bank.",
      });
    }
  });

export type QuestionBank = z.infer<typeof questionBankSchema>;
export type QuestionBankEntry = QuestionBank[number];

export function parseQuestionBank(input: unknown): QuestionBank {
  return questionBankSchema.parse(input);
}
