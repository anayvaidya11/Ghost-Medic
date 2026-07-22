/**
 * GHOST MEDIC — single-file state machine UI.
 *
 * Three states, no navigation:
 *   READY    → primary input (hold-to-speak / photo / type) + audio toggle
 *   THINKING → pulsing dot while the LLM is queried (cancellable)
 *   RESPONSE → numbered survival steps + evacuation line, optional read-aloud
 *
 * All other screens (triage/vitals/action/evacuation/handoff) are gone; the
 * store, services, protocols and scenarios stay intact behind the scenes.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';

import { streamTCCCGuidance } from '@services/llmService';
import { transcribeAudio } from '@services/transcriptionService';
import { useWristVitals } from '@services/useWristVitals';
import type { WristVitals } from '@services/wristVitalsParser';
import { buildSensorContext } from '@services/sensorContext';
import { createFallTrigger, FALL_TRIGGER_COOLDOWN_MS } from '@services/fallTrigger';

// ── PALETTE (per spec) ───────────────────────────────────────────────────────
const BG = '#0a0f0a';
const WHITE = '#FFFFFF';
const GREEN = '#7cff6b';
const RED = '#ff4d4d';
const AMBER = '#ffb547';
const DIM = '#6b7560';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

type AppState = 'ready' | 'review' | 'thinking' | 'response';

// ── RESPONSE PARSING ─────────────────────────────────────────────────────────
type ParsedStep = { num: string; text: string };
type Parsed = { intro: string[]; steps: ParsedStep[]; evacuation: string | null };

function parseResponse(text: string): Parsed {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const intro: string[] = [];
  const steps: ParsedStep[] = [];
  let evacuation: string | null = null;

  for (const line of lines) {
    const ev = /^EVACUATION\s*[:\-—]?\s*(.*)$/i.exec(line);
    if (ev) {
      evacuation = ev[1].trim() || line;
      continue;
    }
    const step = /^(\d+)[.)]\s*(.*)$/.exec(line);
    if (step) {
      steps.push({ num: step[1], text: step[2].trim() });
      continue;
    }
    intro.push(line);
  }
  return { intro, steps, evacuation };
}

export default function GhostMedic() {
  const [appState, setAppState] = useState<AppState>('ready');
  const [audioOn, setAudioOn] = useState(true);

  // Live wrist-unit telemetry from the bridge (ws://localhost:8080/stream).
  // HONEST: only what the firmware actually emits — raw optical/accel counts +
  // derived altitude/temp/fall. No HR/SpO2 anywhere (Decision 2). When the bridge
  // isn't running this stays DISCONNECTED and the UI shows "—", never a fake 0.
  const vitals = useWristVitals();
  // Ref mirror so submit() reads the snapshot at submit time without re-creating
  // every callback at the 10 Hz vitals update rate.
  const vitalsRef = useRef(vitals);
  vitalsRef.current = vitals;

  // The exact sensor-context block sent with the last LLM request (Phase 2).
  // Kept in state so the UI can show the user precisely what the model was given.
  const [sentSensorBlock, setSentSensorBlock] = useState<string | null>(null);
  const [sensorBlockExpanded, setSensorBlockExpanded] = useState(false);

  // Fall auto-query (Phase 2 demo moment): a false→true fall_detected edge
  // auto-submits a post-fall guidance query. Toggleable; debounced in the pure
  // fallTrigger module (rising edge + wall-clock cooldown + busy suppression).
  const [fallAutoOn, setFallAutoOn] = useState(true);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const fallTriggerRef = useRef(createFallTrigger({ cooldownMs: FALL_TRIGGER_COOLDOWN_MS }));

  // READY-state input
  const [typing, setTyping] = useState(false);
  const [typedText, setTypedText] = useState('');

  // Submitted payload
  const [submittedText, setSubmittedText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);

  // REVIEW-state payload (image captured, awaiting text context)
  const [reviewUri, setReviewUri] = useState<string | null>(null);
  const [reviewBase64, setReviewBase64] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');

  // LLM output
  const [streaming, setStreaming] = useState('');
  const [response, setResponse] = useState('');
  const [spokenIndex, setSpokenIndex] = useState(-1);

  const abortRef = useRef<AbortController | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Pulsing dot (THINKING) ────────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    if (appState !== 'thinking') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.2,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [appState, pulse]);

  // ── Text-to-speech ────────────────────────────────────────────────────────
  const stopSpeech = useCallback(() => {
    try {
      Speech.stop();
    } catch {
      // fail silently
    }
    setSpokenIndex(-1);
  }, []);

  const speakSequence = useCallback((parts: string[]) => {
    stopSpeech();
    let i = 0;
    const next = () => {
      if (i >= parts.length) {
        setSpokenIndex(-1);
        return;
      }
      const idx = i;
      setSpokenIndex(idx);
      try {
        Speech.speak(parts[idx], {
          onDone: () => {
            i += 1;
            // short pause between utterances
            setTimeout(next, 250);
          },
          onError: () => {
            i += 1;
            next();
          },
        });
      } catch {
        i += 1;
        next();
      }
    };
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spoken utterances, in order: intro lines, steps, then evacuation.
  const buildUtterances = useCallback((text: string): string[] => {
    const p = parseResponse(text);
    const parts: string[] = [];
    p.intro.forEach((l) => parts.push(l));
    p.steps.forEach((s) => parts.push(`Step ${s.num}. ${s.text}`));
    if (p.evacuation) parts.push(`Evacuation. ${p.evacuation}`);
    return parts;
  }, []);

  // ── Core submit → THINKING → RESPONSE ─────────────────────────────────────
  const submit = useCallback(
    (inputText: string, image: string | null, reportOverride?: string, auto?: boolean) => {
      const cleanText = inputText.trim();
      if (!cleanText && !image && !reportOverride) return;

      stopSpeech();
      setAutoTriggered(!!auto);
      setSubmittedText(cleanText || 'Wound photograph submitted');
      setImageUri(image);
      setImageExpanded(false);
      setStreaming('');
      setResponse('');
      setSpokenIndex(-1);
      setAppState('thinking');

      const report =
        reportOverride ??
        [
          cleanText ? `Reported: ${cleanText}` : null,
          image ? 'The user submitted a photograph of the wound/injury.' : null,
        ]
          .filter(Boolean)
          .join('\n');

      // Phase 2: attach the sensor snapshot taken NOW (never stale — the ref
      // tracks the live stream; a dead bridge yields an honest "no sensor data"
      // block, never fabricated readings). Stored so the UI can show it.
      const sensorBlock = buildSensorContext(vitalsRef.current);
      setSentSensorBlock(sensorBlock);
      setSensorBlockExpanded(false);
      const reportWithSensors = `${report}\n\n${sensorBlock}`;

      const controller = new AbortController();
      abortRef.current = controller;

      let acc = '';
      let movedToResponse = false;

      streamTCCCGuidance(
        reportWithSensors,
        {
          onToken: (token) => {
            if (controller.signal.aborted) return;
            acc += token;
            if (!movedToResponse) {
              movedToResponse = true;
              setAppState('response');
            }
            setStreaming(acc);
          },
          onComplete: (full) => {
            if (controller.signal.aborted) return;
            setResponse(full);
            setStreaming(full);
            setAppState('response');
            if (audioOn) speakSequence(buildUtterances(full));
          },
          onError: (err) => {
            if (controller.signal.aborted) return;
            setResponse(err);
            setStreaming(err);
            setAppState('response');
          },
        },
        { signal: controller.signal }
      );
    },
    [audioOn, buildUtterances, speakSequence, stopSpeech]
  );

  // ── Fall auto-query (sensor-triggered, Phase 2) ───────────────────────────
  // Every vitals update feeds the debounced trigger. Suppressed (edge consumed,
  // no fire) while: toggled off, a request is in flight (thinking), or the user
  // is composing a photo review. Allowed from 'ready' and 'response' so a new
  // fall can interrupt an old answer with fresh post-fall guidance.
  useEffect(() => {
    const suppressed = !fallAutoOn || appState === 'thinking' || appState === 'review';
    const fired = fallTriggerRef.current.update(
      vitals.source === 'live' && vitals.fallDetected,
      Date.now(),
      suppressed
    );
    if (fired) {
      submit(
        '⚠ SENSOR-TRIGGERED: fall detected by wrist unit',
        null,
        'AUTOMATIC SENSOR-TRIGGERED QUERY (not typed by the user): the wrist ' +
          "unit's accelerometer heuristic just detected a fall. The user has not " +
          'said anything yet. Give immediate post-fall self-assessment guidance ' +
          '(head/neck/spine precautions, checking for injury before moving).',
        true
      );
    }
  }, [vitals, fallAutoOn, appState, submit]);

  // ── Voice: hold-to-speak ──────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      // fail silently — release handler still submits the stub transcript
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch {
      // ignore — transcription is a stub regardless
    }
    const text = await transcribeAudio(uri);
    submit(text, null);
  }, [recorder, submit]);

  // ── Camera → REVIEW ───────────────────────────────────────────────────────
  const takePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera permission required to photograph wound.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setReviewUri(asset.uri);
      setReviewBase64(asset.base64 ?? null);
      setReviewText('');
      setAppState('review');
    } catch {
      // fail silently
    }
  }, []);

  // Build the casualty report from the captured image + typed context.
  const submitReview = useCallback(() => {
    const textContext = reviewText.trim();
    const base64 = reviewBase64 ?? '';
    const report = [
      'IMAGE ATTACHED.',
      `USER DESCRIPTION: ${textContext}`,
      `WOUND IMAGE: [${base64.slice(0, 1000)}]`,
    ].join('\n');
    const uri = reviewUri;
    setReviewBase64(null);
    setReviewText('');
    setReviewUri(null);
    submit(textContext, uri, report);
  }, [reviewText, reviewBase64, reviewUri, submit]);

  const retakeReview = useCallback(() => {
    setReviewUri(null);
    setReviewBase64(null);
    setReviewText('');
    takePhoto();
  }, [takePhoto]);

  const cancelReview = useCallback(() => {
    Keyboard.dismiss();
    setReviewUri(null);
    setReviewBase64(null);
    setReviewText('');
    setAppState('ready');
  }, []);

  // ── Type ──────────────────────────────────────────────────────────────────
  const submitTyped = useCallback(() => {
    if (!typedText.trim()) return;
    const t = typedText;
    setTypedText('');
    setTyping(false);
    submit(t, null);
  }, [typedText, submit]);

  // ── Cancel / reset ────────────────────────────────────────────────────────
  const cancelThinking = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeech();
    setAppState('ready');
  }, [stopSpeech]);

  const newSituation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeech();
    setSubmittedText('');
    setImageUri(null);
    setImageExpanded(false);
    setReviewUri(null);
    setReviewBase64(null);
    setReviewText('');
    setStreaming('');
    setResponse('');
    setTypedText('');
    setTyping(false);
    setSentSensorBlock(null);
    setSensorBlockExpanded(false);
    setAutoTriggered(false);
    setAppState('ready');
  }, [stopSpeech]);

  const toggleAudio = useCallback(() => {
    setAudioOn((prev) => {
      if (prev) stopSpeech();
      return !prev;
    });
  }, [stopSpeech]);

  const repeat = useCallback(() => {
    const text = response || streaming;
    if (text) speakSequence(buildUtterances(text));
  }, [response, streaming, speakSequence, buildUtterances]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={s.flex} onPress={Keyboard.dismiss}>
          {appState === 'ready' && (
            <ReadyView
              vitals={vitals}
              typing={typing}
              typedText={typedText}
              audioOn={audioOn}
              fallAutoOn={fallAutoOn}
              onToggleFallAuto={() => setFallAutoOn((v) => !v)}
              onHoldStart={startRecording}
              onHoldEnd={stopRecording}
              onPhoto={takePhoto}
              onToggleTyping={() => setTyping((v) => !v)}
              onChangeText={setTypedText}
              onSubmitTyped={submitTyped}
              onToggleAudio={toggleAudio}
            />
          )}
          {appState === 'review' && (
            <ReviewView
              imageUri={reviewUri}
              text={reviewText}
              onChangeText={setReviewText}
              onSubmit={submitReview}
              onRetake={retakeReview}
              onCancel={cancelReview}
            />
          )}
          {appState === 'thinking' && (
            <ThinkingView
              pulse={pulse}
              submittedText={submittedText}
              imageUri={imageUri}
              onCancel={cancelThinking}
            />
          )}
          {appState === 'response' && (
            <ResponseView
              text={streaming}
              imageUri={imageUri}
              imageExpanded={imageExpanded}
              onToggleImage={() => setImageExpanded((v) => !v)}
              sensorBlock={sentSensorBlock}
              sensorExpanded={sensorBlockExpanded}
              onToggleSensor={() => setSensorBlockExpanded((v) => !v)}
              autoTriggered={autoTriggered}
              spokenIndex={spokenIndex}
              audioOn={audioOn}
              onRepeat={repeat}
              onNew={newSituation}
            />
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── LIVE SENSOR MONITOR ──────────────────────────────────────────────────────
/*
 * VITALS INTEGRATION PLAN (Phase 1 payoff — app wired to the bridge)
 * -----------------------------------------------------------------
 * SOURCE:  useWristVitals() -> ws://localhost:8080/stream (the bridge). One
 *          NDJSON telemetry line per message, parsed by wristVitalsParser.
 * HONESTY (Decision 2): show ONLY what the firmware actually emits
 *   (see DATA_FORMAT.md), and visibly separate DERIVED from RAW:
 *     DERIVED  (physical quantities the firmware computes):
 *        • Altitude  (m,  BMP280)   • Temperature (°C, BMP280)
 *        • Fall detected (bool, LIS3DH heuristic — status indicator)
 *     RAW SIGNAL  (uncomputed sensor counts, dimmed + under a "RAW" header):
 *        • Optical red / ir (MAX30102 FIFO counts) — NOT heart rate / SpO2
 *        • Accel magnitude  (g, LIS3DH)
 *   There is NO heart-rate / SpO2 / BPM number anywhere.
 * CONNECTION INDICATOR (the honesty discipline made visible in the UI):
 *     ● LIVE (green) = connected + data · ◌ CONNECTING (amber) ·
 *     ○ DISCONNECTED (grey) = bridge not running.
 * NULLS: the parser gates every value on its per-sensor `ok` flag; a missing /
 *   not-ok reading renders as "—", never a fabricated 0.
 * PLACEMENT: the READY (standby) screen — the natural monitoring surface. The
 *   hook lives at the top-level component, so the same snapshot is available to
 *   feed the LLM in Phase 2 (sensor-aware advice) without re-plumbing.
 */
function VitalsMonitor({ vitals }: { vitals: WristVitals }) {
  const live = vitals.source === 'live';
  const connecting = vitals.source === 'connecting';
  const dotColor = live ? GREEN : connecting ? AMBER : DIM;
  const dotChar = live ? '●' : connecting ? '◌' : '○';
  const statusText = live ? 'LIVE' : connecting ? 'CONNECTING' : 'DISCONNECTED';

  const fmt = (v: number | null, digits: number, unit = '') =>
    v === null ? '—' : `${v.toFixed(digits)}${unit}`;
  const fmtInt = (v: number | null) => (v === null ? '—' : String(v));

  return (
    <View style={s.monitor}>
      <View style={s.monitorTopRow}>
        <Text style={[s.monitorStatus, { color: dotColor }]}>
          {dotChar} {statusText}
        </Text>
        <Text style={s.monitorTitle}>SENSOR MONITOR</Text>
      </View>

      <Text style={s.monitorGroupLabel}>DERIVED</Text>
      <View style={s.monitorRow}>
        <Metric label="ALT" value={fmt(vitals.altM, 1, ' m')} />
        <Metric label="TEMP" value={fmt(vitals.tempC, 1, ' °C')} />
        <Metric
          label="FALL"
          value={live ? (vitals.fallDetected ? 'DETECTED' : 'no') : '—'}
          alert={live && vitals.fallDetected}
        />
      </View>

      <Text style={s.monitorGroupLabel}>RAW SIGNAL (not vitals)</Text>
      <View style={s.monitorRow}>
        <Metric label="OPT red" value={fmtInt(vitals.red)} raw />
        <Metric label="OPT ir" value={fmtInt(vitals.ir)} raw />
        <Metric label="ACCEL" value={fmt(vitals.accelMagG, 2, ' g')} raw />
      </View>
    </View>
  );
}

function Metric(props: { label: string; value: string; raw?: boolean; alert?: boolean }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricLabel}>{props.label}</Text>
      <Text
        style={[
          s.metricValue,
          props.raw && s.metricValueRaw,
          props.alert && s.metricValueAlert,
        ]}
      >
        {props.value}
      </Text>
    </View>
  );
}

// ── STATE 1: READY ─────────────────────────────────────────────────────────
function ReadyView(props: {
  vitals: WristVitals;
  typing: boolean;
  typedText: string;
  audioOn: boolean;
  fallAutoOn: boolean;
  onToggleFallAuto: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onPhoto: () => void;
  onToggleTyping: () => void;
  onChangeText: (t: string) => void;
  onSubmitTyped: () => void;
  onToggleAudio: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.readyRoot}>
      <View style={s.readyHeader}>
        <Text style={s.brand}>GHOST MEDIC</Text>
        <Text style={s.tagline}>offline survival assistant</Text>
      </View>

      <VitalsMonitor vitals={props.vitals} />

      <View style={s.readyCenter}>
        <TouchableOpacity
          style={s.circle}
          activeOpacity={0.7}
          onPressIn={props.onHoldStart}
          onPressOut={props.onHoldEnd}
        >
          <Text style={s.circleLabel}>HOLD{'\n'}TO SPEAK</Text>
        </TouchableOpacity>

        <View style={s.secondaryRow}>
          <TouchableOpacity style={s.secondaryBtn} onPress={props.onPhoto} activeOpacity={0.7}>
            <Text style={s.secondaryIcon}>◎</Text>
            <Text style={s.secondaryLabel}>PHOTOGRAPH{'\n'}WOUND</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={props.onToggleTyping}
            activeOpacity={0.7}
          >
            <Text style={s.secondaryIcon}>⌨</Text>
            <Text style={s.secondaryLabel}>TYPE{'\n'}INSTEAD</Text>
          </TouchableOpacity>
        </View>

        {props.typing && (
          <View style={s.typeBox}>
            <TextInput
              style={s.input}
              placeholder="Describe what happened…"
              placeholderTextColor={DIM}
              value={props.typedText}
              onChangeText={props.onChangeText}
              multiline
              autoFocus
              returnKeyType="send"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={props.onSubmitTyped}
            />
            {focused && (
              <TouchableOpacity
                style={s.doneBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  props.onSubmitTyped();
                }}
                activeOpacity={0.7}
              >
                <Text style={s.doneLabel}>DONE</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.sendBtn} onPress={props.onSubmitTyped} activeOpacity={0.7}>
              <Text style={s.sendLabel}>SEND</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.audioToggle, s.toggleHalf, { borderColor: props.audioOn ? GREEN : DIM }]}
          onPress={props.onToggleAudio}
          activeOpacity={0.8}
        >
          <Text style={[s.audioLabel, { color: props.audioOn ? GREEN : DIM }]}>
            {props.audioOn ? 'AUDIO ON' : 'AUDIO OFF'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.audioToggle, s.toggleHalf, { borderColor: props.fallAutoOn ? AMBER : DIM }]}
          onPress={props.onToggleFallAuto}
          activeOpacity={0.8}
        >
          <Text style={[s.audioLabel, { fontSize: 13, color: props.fallAutoOn ? AMBER : DIM }]}>
            {props.fallAutoOn ? 'FALL AUTO-QUERY ON' : 'FALL AUTO-QUERY OFF'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── STATE 1b: REVIEW (image captured, add textual context) ───────────────────
function ReviewView(props: {
  imageUri: string | null;
  text: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  onRetake: () => void;
  onCancel: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.reviewRoot}>
      {props.imageUri && (
        <Image source={{ uri: props.imageUri }} style={s.reviewImage} />
      )}
      <View style={s.reviewBody}>
        <Text style={s.reviewLabel}>DESCRIBE WHAT YOU'RE SEEING</Text>
        <TextInput
          style={s.reviewInput}
          placeholder="e.g. deep cut on left forearm, bleeding heavily"
          placeholderTextColor={DIM}
          value={props.text}
          onChangeText={props.onChangeText}
          multiline
          returnKeyType="done"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {focused && (
          <TouchableOpacity
            style={s.doneBtn}
            onPress={Keyboard.dismiss}
            activeOpacity={0.7}
          >
            <Text style={s.doneLabel}>DONE</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={s.reviewButtons}>
        <TouchableOpacity style={s.reviewSubmit} onPress={props.onSubmit} activeOpacity={0.8}>
          <Text style={s.reviewSubmitLabel}>SUBMIT</Text>
        </TouchableOpacity>
        <View style={s.reviewSecondaryRow}>
          <TouchableOpacity style={s.reviewRetake} onPress={props.onRetake} activeOpacity={0.8}>
            <Text style={s.reviewRetakeLabel}>RETAKE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.reviewCancel} onPress={props.onCancel} activeOpacity={0.8}>
            <Text style={s.reviewCancelLabel}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── STATE 2: THINKING ────────────────────────────────────────────────────────
function ThinkingView(props: {
  pulse: Animated.Value;
  submittedText: string;
  imageUri: string | null;
  onCancel: () => void;
}) {
  return (
    <View style={s.thinkingRoot}>
      {props.imageUri && (
        <Image source={{ uri: props.imageUri }} style={s.thinkingThumb} />
      )}
      <View style={s.thinkingCenter}>
        <Animated.View style={[s.pulseDot, { transform: [{ scale: props.pulse }] }]} />
        <Text style={s.thinkingTitle}>GHOST MEDIC IS THINKING</Text>
        <Text style={s.thinkingSub} numberOfLines={2}>
          {truncate(props.submittedText, 80)}
        </Text>
        <ActivityIndicator color={DIM} style={{ marginTop: 16 }} />
      </View>
      <TouchableOpacity style={s.cancelBtn} onPress={props.onCancel} activeOpacity={0.8}>
        <Text style={s.cancelLabel}>CANCEL</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── STATE 3: RESPONSE ────────────────────────────────────────────────────────
function ResponseView(props: {
  text: string;
  imageUri: string | null;
  imageExpanded: boolean;
  onToggleImage: () => void;
  sensorBlock: string | null;
  sensorExpanded: boolean;
  onToggleSensor: () => void;
  autoTriggered: boolean;
  spokenIndex: number;
  audioOn: boolean;
  onRepeat: () => void;
  onNew: () => void;
}) {
  const parsed = parseResponse(props.text);
  // spokenIndex maps over [intro..., steps..., evacuation]; compute offsets.
  const stepOffset = parsed.intro.length;
  const evacIndex = stepOffset + parsed.steps.length;

  return (
    <View style={s.respRoot}>
      <View style={s.topBar}>
        <Text style={s.topBrand}>GHOST MEDIC</Text>
        <TouchableOpacity onPress={props.onNew} activeOpacity={0.7} style={s.topBtn}>
          <Text style={s.topBtnLabel}>NEW SITUATION</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.respScroll}
        contentContainerStyle={s.respContent}
        showsVerticalScrollIndicator={false}
      >
        {props.imageUri && (
          <TouchableOpacity style={s.imageTag} onPress={props.onToggleImage} activeOpacity={0.8}>
            <Text style={s.imageTagLabel}>
              {props.imageExpanded ? '▾ IMAGE SUBMITTED' : '▸ IMAGE SUBMITTED'}
            </Text>
            {props.imageExpanded && (
              <Image source={{ uri: props.imageUri }} style={s.imageExpanded} />
            )}
          </TouchableOpacity>
        )}

        {/* Honest labeling: this response was sensor-triggered, not user-typed. */}
        {props.autoTriggered && (
          <View style={s.autoChip}>
            <Text style={s.autoChipLabel}>
              ⚠ SENSOR-TRIGGERED — fall detected by wrist unit (not typed by user)
            </Text>
          </View>
        )}

        {/* Honesty affordance: the EXACT sensor block sent with this request.
            Tap to expand — viewers can verify what the model was actually given. */}
        {props.sensorBlock && (
          <TouchableOpacity style={s.imageTag} onPress={props.onToggleSensor} activeOpacity={0.8}>
            <Text
              style={[
                s.imageTagLabel,
                { color: props.sensorBlock.includes('No sensor data') ? DIM : GREEN },
              ]}
            >
              {(props.sensorExpanded ? '▾ ' : '▸ ') +
                (props.sensorBlock.includes('No sensor data')
                  ? 'NO SENSOR DATA WAS AVAILABLE'
                  : 'SENSOR CONTEXT ATTACHED (LIVE)')}
            </Text>
            {props.sensorExpanded && (
              <Text style={s.sensorBlockText}>{props.sensorBlock}</Text>
            )}
          </TouchableOpacity>
        )}

        {parsed.intro.map((line, i) => (
          <Text
            key={`intro-${i}`}
            style={[s.introLine, props.spokenIndex === i && s.spokenText]}
          >
            {line}
          </Text>
        ))}

        {parsed.steps.map((step, i) => {
          const spoken = props.spokenIndex === stepOffset + i;
          return (
            <View key={`step-${i}`} style={s.stepRow}>
              <Text style={[s.stepNum, spoken && s.spokenNum]}>{step.num}</Text>
              <Text style={[s.stepText, spoken && s.spokenText]}>{step.text}</Text>
            </View>
          );
        })}

        {parsed.evacuation && (
          <View>
            <Text style={s.evacLabel}>EVACUATION</Text>
            <View style={[s.evacBox, props.spokenIndex === evacIndex && s.evacBoxActive]}>
              <Text style={s.evacText}>{parsed.evacuation}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={s.respButtons}>
        {props.audioOn && (
          <TouchableOpacity style={s.repeatBtn} onPress={props.onRepeat} activeOpacity={0.8}>
            <Text style={s.repeatLabel}>REPEAT</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.newBtn} onPress={props.onNew} activeOpacity={0.8}>
          <Text style={s.newLabel}>NEW SITUATION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },

  // KEYBOARD DONE
  doneBtn: {
    minHeight: 48,
    backgroundColor: '#0d160d',
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: { fontFamily: MONO, color: AMBER, fontSize: 15, letterSpacing: 3, fontWeight: '700' },

  // REVIEW
  reviewRoot: { flex: 1 },
  reviewImage: { width: '100%', height: '50%', backgroundColor: '#0d160d' },
  reviewBody: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  reviewLabel: {
    fontFamily: MONO,
    color: AMBER,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '700',
  },
  reviewInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#27331f',
    borderRadius: 8,
    color: WHITE,
    fontSize: 16,
    padding: 14,
    textAlignVertical: 'top',
  },
  reviewButtons: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  reviewSubmit: {
    minHeight: 56,
    backgroundColor: '#0d160d',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewSubmitLabel: {
    fontFamily: MONO,
    color: GREEN,
    fontSize: 16,
    letterSpacing: 3,
    fontWeight: '700',
  },
  reviewSecondaryRow: { flexDirection: 'row', gap: 12 },
  reviewRetake: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#27331f',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewRetakeLabel: { fontFamily: MONO, color: WHITE, fontSize: 15, letterSpacing: 2, fontWeight: '700' },
  reviewCancel: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCancelLabel: { fontFamily: MONO, color: RED, fontSize: 15, letterSpacing: 2, fontWeight: '700' },

  // LIVE SENSOR MONITOR
  monitor: {
    borderWidth: 1,
    borderColor: '#27331f',
    borderRadius: 8,
    backgroundColor: '#0d160d',
    padding: 12,
    marginTop: 14,
    gap: 6,
  },
  monitorTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  monitorStatus: { fontFamily: MONO, fontSize: 13, letterSpacing: 2, fontWeight: '700' },
  monitorTitle: { fontFamily: MONO, color: DIM, fontSize: 11, letterSpacing: 2 },
  monitorGroupLabel: { fontFamily: MONO, color: DIM, fontSize: 10, letterSpacing: 2, marginTop: 2 },
  monitorRow: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1 },
  metricLabel: { fontFamily: MONO, color: DIM, fontSize: 10, letterSpacing: 1 },
  metricValue: { fontFamily: MONO, color: WHITE, fontSize: 15, fontWeight: '700', marginTop: 2 },
  metricValueRaw: { color: DIM, fontWeight: '600' },
  metricValueAlert: { color: RED },

  // READY
  readyRoot: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  readyHeader: { alignItems: 'center', paddingTop: 12 },
  brand: {
    fontFamily: MONO,
    color: GREEN,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: MONO,
    color: DIM,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 6,
  },
  readyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: GREEN,
    backgroundColor: '#0d160d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleLabel: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
    lineHeight: 26,
  },
  secondaryRow: { flexDirection: 'row', gap: 12, marginTop: 36, width: '100%' },
  secondaryBtn: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#27331f',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  secondaryIcon: { color: GREEN, fontSize: 22 },
  secondaryLabel: {
    fontFamily: MONO,
    color: WHITE,
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 16,
  },
  typeBox: { width: '100%', marginTop: 20, gap: 10 },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#27331f',
    borderRadius: 8,
    color: WHITE,
    fontSize: 16,
    padding: 14,
    textAlignVertical: 'top',
  },
  sendBtn: {
    minHeight: 56,
    backgroundColor: '#0d160d',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendLabel: { fontFamily: MONO, color: GREEN, fontSize: 16, letterSpacing: 3, fontWeight: '700' },
  audioToggle: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioLabel: { fontFamily: MONO, fontSize: 16, letterSpacing: 3, fontWeight: '700' },

  // THINKING
  thinkingRoot: { flex: 1, padding: 20 },
  thinkingThumb: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27331f',
  },
  thinkingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pulseDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    marginBottom: 28,
  },
  thinkingTitle: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
    fontFamily: MONO,
  },
  thinkingSub: {
    color: DIM,
    fontSize: 16,
    marginTop: 14,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  cancelBtn: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: { fontFamily: MONO, color: RED, fontSize: 16, letterSpacing: 4, fontWeight: '700' },

  // RESPONSE
  respRoot: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a241a',
  },
  topBrand: { fontFamily: MONO, color: GREEN, fontSize: 14, letterSpacing: 2 },
  topBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  topBtnLabel: { fontFamily: MONO, color: WHITE, fontSize: 13, letterSpacing: 1 },
  respScroll: { flex: 1 },
  respContent: { padding: 20, paddingBottom: 32 },
  imageTag: {
    borderWidth: 1,
    borderColor: '#27331f',
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  imageTagLabel: { fontFamily: MONO, color: DIM, fontSize: 13, letterSpacing: 1 },
  imageExpanded: { width: '100%', height: 200, borderRadius: 6, marginTop: 12 },
  sensorBlockText: {
    fontFamily: MONO,
    color: DIM,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
  autoChip: {
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
    backgroundColor: '#1c1400',
  },
  autoChipLabel: { fontFamily: MONO, color: AMBER, fontSize: 12, letterSpacing: 1 },
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleHalf: { flex: 1 },
  introLine: {
    color: WHITE,
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 18,
    fontWeight: '600',
  },
  stepRow: { flexDirection: 'row', marginBottom: 24, gap: 16 },
  stepNum: {
    fontFamily: MONO,
    color: GREEN,
    fontSize: 32,
    fontWeight: '800',
    minWidth: 36,
    lineHeight: 34,
  },
  stepText: { flex: 1, color: WHITE, fontSize: 18, lineHeight: 26 },
  spokenNum: { color: GREEN },
  spokenText: { color: GREEN },
  evacLabel: {
    fontFamily: MONO,
    color: AMBER,
    fontSize: 14,
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 8,
  },
  evacBox: {
    borderWidth: 2,
    borderColor: AMBER,
    borderRadius: 8,
    padding: 16,
  },
  evacBoxActive: { backgroundColor: '#1c1400' },
  evacText: { color: WHITE, fontSize: 18, lineHeight: 26 },
  respButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a241a',
  },
  repeatBtn: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatLabel: { fontFamily: MONO, color: GREEN, fontSize: 16, letterSpacing: 2, fontWeight: '700' },
  newBtn: {
    flex: 2,
    minHeight: 56,
    backgroundColor: '#0d160d',
    borderWidth: 1,
    borderColor: '#27331f',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newLabel: { fontFamily: MONO, color: WHITE, fontSize: 16, letterSpacing: 2, fontWeight: '700' },
});
