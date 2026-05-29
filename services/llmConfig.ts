/**
 * LLM PROVIDER CONFIGURATION
 *
 * To swap providers:
 * 1. Change PROVIDER to the desired provider name
 * 2. Uncomment the matching config block
 * 3. Update fetch logic in services/llmService.ts accordingly
 */

// ── ACTIVE PROVIDER ──────────────────────────────────────────────────────────
export const PROVIDER = 'ollama';  // Change to: 'anthropic' | 'openai' | 'openai_compatible'

// ── OLLAMA (active — runs fully offline) ────────────────────────────────────
export const OLLAMA_BASE_URL = 'http://192.168.1.157:11434';  // Change to your Ollama server IP
export const OLLAMA_MODEL = 'llama3.2:3b';                    // Change to your pulled model name

// ── ANTHROPIC (commented out — requires network + API key) ──────────────────
// export const ANTHROPIC_CONFIG = {
//   baseUrl: 'https://api.anthropic.com/v1',        // Change: Anthropic API base URL
//   apiKey: process.env.ANTHROPIC_API_KEY ?? '',    // Change: set your ANTHROPIC_API_KEY env var
//   model: 'claude-3-5-haiku-20241022',             // Change: any claude-3-* or claude-sonnet-* model
//   maxTokens: 1024,                                // Change: raise for longer protocol outputs
// };

// ── OPENAI / OPENAI-COMPATIBLE (commented out — requires network or local server) ──
// export const OPENAI_CONFIG = {
//   baseUrl: 'https://api.openai.com/v1',           // Change: use 'http://localhost:1234/v1' for LM Studio
//   apiKey: process.env.OPENAI_API_KEY ?? '',        // Change: set your OPENAI_API_KEY env var
//   model: 'gpt-4o-mini',                           // Change: any openai model or local model name
//   maxTokens: 1024,                                 // Change: raise for longer outputs
// };

// ── WHISPER (transcription — commented out) ──────────────────────────────────
// export const WHISPER_CONFIG = {
//   endpoint: 'http://localhost:9000/inference',     // Change: your whisper.cpp server URL
//   model: 'base.en',                               // Change: whisper model size (tiny/base/small/medium)
//   language: 'en',                                 // Change: target language code
// };

// ── VISION MODEL (wound image analysis — commented out) ─────────────────────
// export const VISION_CONFIG = {
//   baseUrl: 'http://192.168.1.157:11434',          // Change: same as OLLAMA_BASE_URL or separate server
//   model: 'llava:13b',                             // Change: any vision-capable model in Ollama
//   maxTokens: 256,                                 // Change: vision descriptions can be short
// };
