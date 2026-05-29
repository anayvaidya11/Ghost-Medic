// services/llmService.ts
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from './llmConfig';

const TCCC_SYSTEM_PROMPT = `You are GHOST MEDIC — an AI clinical decision support system for US Army combat medics operating under TCCC (Tactical Combat Casualty Care) protocols in austere, comms-denied environments.

RULES:
- Follow the MARCH protocol order: Massive hemorrhage → Airway → Respiration → Circulation → Hypothermia/Head injury
- Be concise. The medic is under stress. Use numbered steps.
- Flag life threats in ALL CAPS.
- Drug dosages use standard TCCC formulary (ketamine 1-2mg/kg IM, TXA 1g IV/IO, morphine 5mg IV/IM).
- If critical info is missing, ask ONE clarifying question before proceeding.
- Always end with: "REASSESS in 5 min."

FORMAT your response exactly like this:
ASSESSMENT: [1-2 sentence summary]
PRIORITY THREATS: [bullet list]
IMMEDIATE ACTIONS:
1. [step]
2. [step]
MONITOR FOR: [deterioration signs]
REASSESS in 5 min.`;

export interface LLMCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: string) => void;
}

export async function streamTCCCGuidance(
  casualtyReport: string,
  callbacks: LLMCallbacks
): Promise<void> {
  const prompt = `CASUALTY REPORT:\n${casualtyReport}\n\nProvide TCCC guidance:`;

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
        system: TCCC_SYSTEM_PROMPT,
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
