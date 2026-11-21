import { describe, expect, it } from "vitest";
import { selectUniqueExamQuestions } from "../../../src/domain/study/exam-simulation.js";

describe("selectUniqueExamQuestions", () => {
  it("chooses at most one variant from each question family", () => {
    const candidates = [
      { id: "q1-a", familyId: "q1" },
      { id: "q1-b", familyId: "q1" },
      { id: "q2-a", familyId: "q2" },
    ];

    expect(selectUniqueExamQuestions(candidates, 2)).toEqual([
      { id: "q1-a", familyId: "q1" },
      { id: "q2-a", familyId: "q2" },
    ]);
  });

  it("returns fewer questions when the pool has too few distinct families", () => {
    expect(
      selectUniqueExamQuestions(
        [
          { id: "q1-a", familyId: "q1" },
          { id: "q1-b", familyId: "q1" },
        ],
        2,
      ),
    ).toHaveLength(1);
  });
});
