// services/llmService.ts
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from './llmConfig';

const WILDERNESS_SYSTEM_PROMPT = `You are GHOST MEDIC — an offline AI clinical decision support tool for wilderness search-and-rescue responders, wilderness EMTs, and backcountry users. You follow Wilderness Medical Society guidelines and the Patient Assessment System (PAS). Always prioritize: scene safety, primary assessment ABCDE, secondary assessment SAMPLE, then treatment, then evacuation decision. Be concise. The responder is in the field, often cold, tired, and far from help. Drug recommendations should reflect what's realistically in a wilderness kit (epinephrine auto-injector, diphenhydramine, ibuprofen, acetaminophen, aspirin, glucose). Always end with: EVACUATION: [IMMEDIATE / URGENT / DELAYED / NONE] and one sentence on what to tell dispatch.

FORMAT your response exactly like this:
ASSESSMENT: [1-2 sentence summary]
PRIORITY THREATS: [bullet list]
IMMEDIATE ACTIONS:
1. [step]
2. [step]
MONITOR FOR: [deterioration signs]
EVACUATION: [IMMEDIATE / URGENT / DELAYED / NONE] — [one sentence on what to tell dispatch]`;

export interface LLMCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: string) => void;
}

export async function streamWildernessGuidance(
  patientReport: string,
  callbacks: LLMCallbacks
): Promise<void> {
  const prompt = `PATIENT REPORT:\n${patientReport}\n\nProvide wilderness (PAS / WMS) guidance:`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

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

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const json = await response.json();
    const text = json.response ?? '';

    if (!text) throw new Error('Empty response from model');

    // Simulate token streaming for UX
    const words = text.split(' ');
    for (const word of words) {
      callbacks.onToken(word + ' ');
      await new Promise<void>((r) => setTimeout(r, 18));
    }

    callbacks.onComplete(text);
  } catch (error) {
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
  }
}
