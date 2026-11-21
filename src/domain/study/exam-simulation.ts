export const examQuestionCount = 65;
export const examDurationMinutes = 90;

export const examQuestionDistribution = [
  { domainId: "cloud-concepts", questionCount: 16 },
  { domainId: "security-compliance", questionCount: 19 },
  { domainId: "cloud-technology-services", questionCount: 22 },
  { domainId: "billing-pricing-support", questionCount: 8 },
] as const;

export interface ExamQuestionCandidate {
  id: string;
  familyId: string;
}

export function selectUniqueExamQuestions<T extends ExamQuestionCandidate>(
  candidates: T[],
  questionCount: number,
): T[] {
  if (questionCount <= 0) {
    return [];
  }

  const selected: T[] = [];
  const families = new Set<string>();

  for (const candidate of candidates) {
    if (families.has(candidate.familyId)) {
      continue;
    }

    families.add(candidate.familyId);
    selected.push(candidate);

    if (selected.length === questionCount) {
      break;
    }
  }

  return selected;
}
