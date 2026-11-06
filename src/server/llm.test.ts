import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { llmModel } from "./llm";

const KEYS = ["LLM_PROVIDER", "GROQ_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("llmModel", () => {
  it("uses groq when only GROQ_API_KEY is set and LLM_PROVIDER is unset", () => {
    process.env.GROQ_API_KEY = "test";
    expect(llmModel()).not.toBeNull();
  });

  it("uses google when only GOOGLE_GENERATIVE_AI_API_KEY is set", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test";
    expect(llmModel()).not.toBeNull();
  });

  it("returns null when no key is set", () => {
    expect(llmModel()).toBeNull();
  });
});
