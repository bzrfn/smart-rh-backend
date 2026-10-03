import { TECHNICAL_KNOWLEDGE_DENYLIST } from './max.knowledge.js';

export function containsTechnicalLeak(value: string) {
  return TECHNICAL_KNOWLEDGE_DENYLIST.some((pattern) => pattern.test(value));
}

export function filterSafeKnowledgeLines(lines: string[]) {
  return lines.filter((line) => !containsTechnicalLeak(line));
}
