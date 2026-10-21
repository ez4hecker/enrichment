export type ExpectedOutputType = "Text" | "Number" | "Boolean";

export type CustomOperationDefinition = {
  id: string;
  ownerId: string;
  name: string;
  promptTemplate: string;
  expectedOutputType: ExpectedOutputType;
  /**
   * Set for a Generation Custom Operation, which writes from the row's inputs alone with this
   * Generation Model and no web search. Absent means Research: the answer is searched on the web.
   */
  generationModel?: string;
  version: number;
};
