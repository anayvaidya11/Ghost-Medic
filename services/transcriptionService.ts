// services/transcriptionService.ts
//
// TRANSCRIPTION SERVICE — speech-to-text stub.
//
// For now this returns a fixed placeholder string regardless of the audio it
// receives, so the voice flow stays fully offline and never blocks the UI.
//
// ─────────────────────────────────────────────────────────────────────────────
// WIRE IN REAL TRANSCRIPTION HERE:
//   Replace the body below with a call to a Whisper-compatible endpoint, e.g.
//   whisper.cpp running locally (offline) or a remote Whisper API:
//
//     const form = new FormData();
//     form.append('file', { uri: audioUri, type: 'audio/m4a', name: 'speech.m4a' } as any);
//     const res = await fetch('http://localhost:9000/inference', { method: 'POST', body: form });
//     const json = await res.json();
//     return json.text;
//
//   See services/llmConfig.ts (WHISPER_CONFIG) for the endpoint placeholder.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transcribe a recorded audio clip to text.
 *
 * @param audioUri Local file URI of the recording (from expo-audio). May be
 *                 null/empty if recording was unavailable — the stub ignores it.
 * @returns The transcribed text. Currently a hardcoded placeholder.
 */
export async function transcribeAudio(audioUri?: string | null): Promise<string> {
  // STUB — replace with a real Whisper transcription call (see header above).
  void audioUri;
  return 'Voice input received — transcription requires Whisper endpoint';
}
