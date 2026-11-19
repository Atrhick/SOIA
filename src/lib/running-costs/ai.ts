/**
 * "AI use" calculator on the Running costs page. Pure: token estimates per writing job x list price per model.
 * Every number here is an ESTIMATE; the assumptions are shown on the page next to the result.
 */

export type AiModel = {
  id: string
  label: string
  /** US dollars per 1 million tokens sent to the model. */
  inputPerMillion: number
  /** US dollars per 1 million tokens the model writes (thinking counts as written). */
  outputPerMillion: number
  provider: 'Anthropic' | 'OpenAI'
  sourceUrl: string
}

/** List prices, standard (not batch, not cached). Checked 2026-11-19. */
export const AI_MODELS: AiModel[] = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fast, cheapest)', inputPerMillion: 0.1, outputPerMillion: 0.5, provider: 'Anthropic', sourceUrl: 'https://www.anthropic.com/pricing' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (good everyday writer)', inputPerMillion: 2, outputPerMillion: 10, provider: 'Anthropic', sourceUrl: 'https://www.anthropic.com/pricing' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best writing, costs most)', inputPerMillion: 4, outputPerMillion: 20, provider: 'Anthropic', sourceUrl: 'https://www.anthropic.com/pricing' },
  { id: 'gpt-5.4-nano', label: 'OpenAI GPT-5.4 nano (cheapest OpenAI)', inputPerMillion: 0.2, outputPerMillion: 1.25, provider: 'OpenAI', sourceUrl: 'https://developers.openai.com/api/docs/pricing' },
  { id: 'gpt-5.4-mini', label: 'OpenAI GPT-5.4 mini', inputPerMillion: 0.75, outputPerMillion: 4.5, provider: 'OpenAI', sourceUrl: 'https://developers.openai.com/api/docs/pricing' },
]

export const DEFAULT_AI_MODEL = 'claude-sonnet-5-5'

export type AiTaskKey = 'pages' | 'welcome' | 'messages'

export type AiTask = {
  key: AiTaskKey
  label: string
  /** Tokens sent: instructions + the program's answers + examples. */
  inputTokens: number
  /** Tokens written, including the model's thinking. */
  outputTokens: number
  assumption: string
}

/** About 750 English words = 1,000 tokens. */
export const AI_TASKS: AiTask[] = [
  {
    key: 'pages',
    label: 'Program page drafts',
    inputTokens: 6000,
    outputTokens: 5000,
    assumption: 'Sends about 6,000 tokens (instructions, the program answers, an example page). Writes a full page of about 2,000 words plus its thinking: about 5,000 tokens.',
  },
  {
    key: 'welcome',
    label: 'Welcome paragraphs',
    inputTokens: 1500,
    outputTokens: 800,
    assumption: 'Sends about 1,500 tokens (instructions and program details). Writes one short paragraph plus its thinking: about 800 tokens.',
  },
  {
    key: 'messages',
    label: 'Outreach messages',
    inputTokens: 2000,
    outputTokens: 750,
    assumption: 'Sends about 2,000 tokens (instructions, the program script, who it is for). Writes a short text or email plus its thinking: about 750 tokens.',
  },
]

/** Some drafts get asked for again: each job is counted as 1.5 tries. */
export const RETRY_FACTOR = 1.5

/** Monthly volumes used for the low / expected / high rows on the page. */
export const AI_VOLUMES: Record<'low' | 'expected' | 'high', Record<AiTaskKey, number>> = {
  low: { pages: 2, welcome: 5, messages: 50 },
  expected: { pages: 8, welcome: 20, messages: 300 },
  high: { pages: 25, welcome: 60, messages: 1500 },
}

export type AiCounts = Record<AiTaskKey, number>

export type AiEstimate = {
  model: AiModel
  lines: { key: AiTaskKey; label: string; count: number; costEach: number; cost: number }[]
  total: number
}

/** Cost of one try of a task on a model, in dollars. */
export function costPerTry(task: Pick<AiTask, 'inputTokens' | 'outputTokens'>, model: Pick<AiModel, 'inputPerMillion' | 'outputPerMillion'>): number {
  return (task.inputTokens * model.inputPerMillion + task.outputTokens * model.outputPerMillion) / 1_000_000
}

function cleanCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Estimated monthly cost for the counts typed in. Unknown model id falls back to the default model. */
export function estimateAiMonthly(counts: Partial<AiCounts>, modelId: string): AiEstimate {
  const model = AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS.find((m) => m.id === DEFAULT_AI_MODEL)!
  const lines = AI_TASKS.map((task) => {
    const count = cleanCount(counts[task.key] ?? 0)
    const costEach = costPerTry(task, model) * RETRY_FACTOR
    return { key: task.key, label: task.label, count, costEach, cost: costEach * count }
  })
  return { model, lines, total: lines.reduce((s, l) => s + l.cost, 0) }
}

/** Low / expected / high monthly AI cost for a model, from AI_VOLUMES (used for the seeded AI rows). */
export function aiRange(modelId: string): { low: number; expected: number; high: number } {
  const r = (n: number) => Math.round(n * 100) / 100
  return {
    low: r(estimateAiMonthly(AI_VOLUMES.low, modelId).total),
    expected: r(estimateAiMonthly(AI_VOLUMES.expected, modelId).total),
    high: r(estimateAiMonthly(AI_VOLUMES.high, modelId).total),
  }
}
