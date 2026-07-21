/**
 * TRANSCRIPTION SERVICE — Audio-to-text stub
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SWAP POINT — to enable real transcription:
 *
 * Option A: Local Whisper via Ollama (when supported)
 *   endpoint: http://<OLLAMA_HOST>:11434/api/transcribe   (not yet in Ollama 0.x)
 *   body: { model: 'whisper', audio_file: <base64> }
 *
 * Option B: whisper.cpp HTTP server (self-hosted, offline)
 *   endpoint: http://localhost:9000/inference
 *   body: FormData with 'file' field containing the audio blob
 *   Change TRANSCRIPTION_ENDPOINT and TRANSCRIPTION_PROVIDER below
 *
 * Option C: OpenAI Whisper API (requires network)
 *   endpoint: https://api.openai.com/v1/audio/transcriptions
 *   headers: { Authorization: 'Bearer <OPENAI_KEY>' }
 *   body: FormData with model='whisper-1', file=<audio>
 *
 * All options share the same contract: return a string transcript or throw.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── CONFIG (change here when swapping in real endpoint) ─────────────────────
const TRANSCRIPTION_PROVIDER = 'stub'; // 'stub' | 'whisper-local' | 'openai'
const TRANSCRIPTION_ENDPOINT = 'http://localhost:9000/inference'; // whisper.cpp default

/**
 * transcribeAudio — sends an audio file URI to the transcription backend.
 *
 * Returns null if transcription is unavailable (offline mode / stub).
 * Never throws — all errors are caught and returned as null.
 *
 * @param audioUri  Local file URI from expo-av RecordingObject
 * @returns Transcribed text string, or null if unavailable
 */
export async function transcribeAudio(audioUri: string): Promise<string | null> {
  if (TRANSCRIPTION_PROVIDER === 'stub') {
    // Stub: transcription unavailable offline
    return null;
  }

  try {
    // ── SWAP: replace this block with your real transcription call ──────
    if (TRANSCRIPTION_PROVIDER === 'whisper-local') {
      // whisper.cpp server — multipart form POST
      // const formData = new FormData();
      // formData.append('file', { uri: audioUri, type: 'audio/m4a', name: 'audio.m4a' } as any);
      // formData.append('response-format', 'json');
      // const res = await fetch(TRANSCRIPTION_ENDPOINT, { method: 'POST', body: formData });
      // const json = await res.json();
      // return json.text ?? null;
      return null; // placeholder until endpoint is live
    }
    // ── END SWAP ─────────────────────────────────────────────────────────

    return null;
  } catch {
    // Always fail silently — never crash the UI
    return null;
  }
}
