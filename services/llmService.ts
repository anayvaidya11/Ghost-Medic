// services/llmService.ts
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from './llmConfig';

const WILDERNESS_SYSTEM_PROMPT = `You are GHOST MEDIC — an offline AI survival assistant for solo backcountry users, wilderness travelers, and remote environment operators. The user may be injured, panicking, alone, and far from help. Your job is to give them clear, numbered, actionable steps they can follow right now. Follow wilderness medicine principles (PAS, ABCDE, WMS guidelines). Always assess scene safety first. Be direct. Use simple words. No medical jargon. Each step must be one sentence. Maximum 6 steps. Always end with an EVACUATION line: one sentence on whether they need to call for help now, wait, or can self-rescue. If the situation is immediately life-threatening, say so in the first line in plain language.

SENSOR CONTEXT: messages may include a block delimited by [SENSOR CONTEXT ... BEGIN] and [SENSOR CONTEXT — END] containing live readings from a wrist-worn sensor unit. How to use it:
- Altitude is pressure-derived and RELATIVE to a fixed sea-level reference, not GPS or true elevation. Its trend (elevation gain/loss) matters for altitude-illness reasoning; do not trust the absolute number.
- Temperature is AMBIENT air at the device, never body temperature. Use it only for environmental risk (hypothermia, frostbite, heat illness) — never to assess fever or core temperature.
- "Fall detected: YES" is a mechanism-of-injury signal from an accelerometer heuristic, not a diagnosis. It should prompt assessment for head, neck, and spine injury and hidden trauma.
- Raw optical counts are NOT vital signs. NEVER infer, estimate, or state a heart rate, pulse, or oxygen saturation from them — no such measurement exists on this device. If asked for heart rate or SpO2, say plainly that the device cannot measure them.
- Sensor context is supplementary. If it conflicts with what the user reports, the user's report wins — ask a clarifying question instead of trusting the sensors.
- If the block says no sensor data is available, base all guidance on the user's report alone.`;

export interface LLMCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: string) => void;
}

export interface LLMOptions {
  /** Optional caller-supplied abort signal — abort to cancel the in-flight call. */
  signal?: AbortSignal;
}

export async function streamTCCCGuidance(
  patientReport: string,
  callbacks: LLMCallbacks,
  options: LLMOptions = {}
): Promise<void> {
  const prompt = `SITUATION REPORT:\n${patientReport}\n\nGive clear, numbered survival first-aid steps now:`;

  // Combine an internal timeout with any caller-supplied abort signal.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onExternalAbort);
  }

  const aborted = () => controller.signal.aborted || !!options.signal?.aborted;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        system: WILDERNESS_SYSTEM_PROMPT,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const json = await response.json();
    const text = json.response ?? '';

    if (!text) throw new Error('Empty response from model');

    // Simulate token streaming for UX — bail out immediately if cancelled.
    const words = text.split(' ');
    for (const word of words) {
      if (aborted()) return;
      callbacks.onToken(word + ' ');
      await new Promise<void>((r) => setTimeout(r, 18));
    }

    if (aborted()) return;
    callbacks.onComplete(text);
  } catch (error) {
    // Caller-initiated cancel — stay silent, the UI already moved on.
    if (options.signal?.aborted) return;

    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (
      msg.includes('fetch') ||
      msg.includes('Network') ||
      msg.includes('connect') ||
      msg.includes('refused') ||
      msg.includes('abort')
    ) {
      callbacks.onError(
        '[ LINK DEAD ]\nCannot reach inference server.\nEnsure Ollama is running:\n  ollama serve'
      );
    } else {
      callbacks.onError(`[ ERROR ] ${msg}`);
    }
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

// Backwards-compatible alias for older call sites.
export const streamWildernessGuidance = streamTCCCGuidance;
