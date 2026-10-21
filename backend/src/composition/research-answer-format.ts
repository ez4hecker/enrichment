import type { ExpectedOutputType } from "../operation-library/custom-operation-definition.js";

/** The answer shape every research source is asked for, so a cell looks the same whichever step answered. */
export function researchAnswerInstruction(expectedOutputType: ExpectedOutputType): string {
  switch (expectedOutputType) {
    case "Text":
      return 'Answer with only the requested facts in as few words as possible (at most 15 words), for example "Series B, $25M, March 2024". No sentences, explanations, citations, links, or formatting. If the answer cannot be found, reply exactly [Not Found].';
    case "Number":
      return "Return only one finite number, with no commentary or formatting. If the answer cannot be found, reply exactly [Not Found].";
    case "Boolean":
      return "Return only true or false, with no commentary or formatting. If the answer cannot be found, reply exactly [Not Found].";
  }
}
