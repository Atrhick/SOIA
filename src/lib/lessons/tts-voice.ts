/**
 * How the lesson audio voice should sound. Kept in its own file on purpose: gpt-4o-mini-tts
 * is due to shut down on 6 January 2027, and this same text works as a system prompt for a
 * Realtime replacement (add: "Read the provided text exactly as written, without adding or
 * changing words."). Override with env OPENAI_TTS_INSTRUCTIONS (set it blank to send none).
 */

/** Default voice (OpenAI's recommended best-quality voice; "cedar" is the alternative). Override with OPENAI_TTS_VOICE. */
export const DEFAULT_TTS_VOICE = 'marin'

export const DEFAULT_TTS_INSTRUCTIONS = `Voice: A thoughtful mentor in their thirties talking with one young person, aged 16 to 24, across a table. Warm, steady and real. Not a teacher, not a coach giving a pep talk, not a radio announcer.

Tone: Calm, respectful and quietly confident. Speak to the listener as an intelligent equal. Sound interested in them, not impressed by your own words. No sales energy, no forced excitement, no sing-song.

Pacing: Unhurried, a little slower than normal conversation. Leave a clear pause at every full stop, and a longer pause between paragraphs. Slow down slightly on the sentence that carries the main idea.

Questions: When asking the listener a question, ask it genuinely, as if you want to hear the answer, then pause before continuing.

Emotion: Gentle and sincere. When the text describes something hard, such as failing, being let down or feeling unsure, soften a little and slow down. Do not sound sad or dramatic. Never add emotion the words don't carry.

Emphasis: Natural stress only. Do not punch individual words or sound like an advert.

Pronunciation: Clear, standard English. Say "NowTRANSFORMED" as two ordinary words, "Now Transformed". Say "VerilyAcademy" as "Verily Academy".`

/** Only the gpt-*-tts models take voice instructions (tts-1 / tts-1-hd don't). */
export const supportsTtsInstructions = (model: string) => /^gpt-.*tts/i.test(model)

/** The `instructions` to send, or undefined. `envValue` = OPENAI_TTS_INSTRUCTIONS: unset = default, blank = none. */
export function ttsInstructions(model: string, envValue: string | undefined): string | undefined {
  if (!supportsTtsInstructions(model)) return undefined
  const v = (envValue ?? DEFAULT_TTS_INSTRUCTIONS).trim()
  return v ? v.slice(0, 4000) : undefined
}
