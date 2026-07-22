/**
 * VISION SERVICE — Wound image analysis stub
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SWAP POINT — to enable real multimodal analysis:
 *
 * Option A: Ollama with a vision-capable model (e.g. llava, bakllava)
 *   endpoint: http://<OLLAMA_HOST>:11434/api/generate
 *   body: { model: 'llava:13b', prompt: '...', images: [<base64>], stream: false }
 *   Change VISION_PROVIDER to 'ollama' and set VISION_MODEL below
 *
 * Option B: Anthropic claude-3-* (requires network)
 *   Use @anthropic-ai/sdk — message with image content block
 *   { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: <b64> } }
 *
 * Option C: OpenAI GPT-4-Vision (requires network)
 *   endpoint: https://api.openai.com/v1/chat/completions
 *   model: 'gpt-4-vision-preview'
 *   content: [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }]
 *
 * All options should return a string describing the wound for the LLM context.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── CONFIG (change here when swapping in real endpoint) ─────────────────────
const VISION_PROVIDER = 'stub';       // 'stub' | 'ollama' | 'anthropic' | 'openai'
const VISION_MODEL = 'llava:13b';     // Change to your available vision model
const VISION_PROMPT =
  'You are a wilderness first-aid assistant. Describe this wound image concisely for a first-aid responder: type of wound, approximate size, visible bleeding, signs of contamination, and any immediate concerns. Be brief and clinical.';

/**
 * analyzeWoundImage — sends a base64 image to the vision backend for analysis.
 *
 * Returns null if vision is unavailable (stub / offline).
 * Never throws — all errors caught and returned as null.
 *
 * @param base64Image  Base64-encoded JPEG/PNG string (no data: prefix)
 * @returns Clinical wound description string, or null if unavailable
 */
export async function analyzeWoundImage(base64Image: string): Promise<string | null> {
  if (VISION_PROVIDER === 'stub') {
    return null;
  }

  try {
    if (VISION_PROVIDER === 'ollama') {
      // ── SWAP: Ollama vision call ──────────────────────────────────────
      // const { OLLAMA_BASE_URL } = await import('../../services/llmConfig');
      // const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     model: VISION_MODEL,
      //     prompt: VISION_PROMPT,
      //     images: [base64Image],
      //     stream: false,
      //   }),
      // });
      // const json = await res.json();
      // return json.response ?? null;
      return null;
    }

    return null;
  } catch {
    // Always fail silently
    return null;
  }
}
