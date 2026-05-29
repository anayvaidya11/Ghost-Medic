/**
 * ACTION SCREEN
 * Step-by-step MARCH protocol execution + AI/LLM guidance.
 * AIResponse component + wound photo context passed to LLM.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { C, MARCH_BADGE } from '@/theme/index';
import { useSessionStore } from '@/store/sessionStore';
import { useBiosensorVitals } from '@/services/biosensorService';
import VitalsBar from '@/components/VitalsBar';
import { RiskBadge, MarchBadge } from '@/components/RiskBadge';
import { AIResponse } from '@/components/AIResponse';
import { SessionHeader } from '@/components/SessionHeader';
import { streamTCCCGuidance } from '@services/llmService';

export default function ActionScreen() {
  const insets = useSafeAreaInsets();
  const sensorVitals = useBiosensorVitals();

  const protocol = useSessionStore((s) => s.protocol);
  const mode = useSessionStore((s) => s.mode);
  const aiResponse = useSessionStore((s) => s.aiResponse);
  const isThinking = useSessionStore((s) => s.isThinking);
  const streamingResponse = useSessionStore((s) => s.streamingResponse);
  const setThinking = useSessionStore((s) => s.setThinking);
  const appendStreamToken = useSessionStore((s) => s.appendStreamToken);
  const setAiResponse = useSessionStore((s) => s.setAiResponse);
  const woundPhotoUri = useSessionStore((s) => s.woundPhotoUri);
  const woundPhotoBase64 = useSessionStore((s) => s.woundPhotoBase64);
  const audioTranscript = useSessionStore((s) => s.audioTranscript);
  const selectedSymptoms = useSessionStore((s) => s.selectedSymptoms);
  const underFire = useSessionStore((s) => s.underFire);
  const mechanism = useSessionStore((s) => s.mechanism);

  const [protocolIdx, setProtocolIdx] = useState(0);
  const [substepIdx, setSubstepIdx] = useState(0);
  const [stepsDone, setStepsDone] = useState(new Set<string>());
  const [medicInput, setMedicInput] = useState('');
  const [showLLM, setShowLLM] = useState(false);

  const isSilent = mode === 'silent';

  const step = protocol[protocolIdx];
  if (!step || protocol.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <SessionHeader />
        <View style={s.empty}>
          <Text style={s.emptyText}>
            No protocol generated.{'\n'}Go back and select your situation.
          </Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>◀ BACK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalSubs = step.steps?.length ?? 0;
  const safeIdx = Math.min(substepIdx, Math.max(0, totalSubs - 1));
  const substep = step.steps?.[safeIdx];
  const isLastSub = safeIdx === totalSubs - 1;
  const isLastProto = protocolIdx === protocol.length - 1;

  const marchBadge = MARCH_BADGE[step.phaseCode] ?? MARCH_BADGE['EVA'];
  const isDone = stepsDone.has(`${protocolIdx}-${safeIdx}`);

  const markDone = () => {
    setStepsDone((prev) => new Set([...prev, `${protocolIdx}-${safeIdx}`]));
  };

  const vibrateAction = () => {
    if (isSilent) {
      // SILENT: 2 short = action needed
      Vibration.vibrate([0, 80, 60, 80]);
    }
  };

  const vibrateCritical = () => {
    if (isSilent) {
      // SILENT: 1 long = critical
      Vibration.vibrate(400);
    }
  };

  const advance = () => {
    markDone();
    vibrateAction();
    if (!isLastSub) {
      setSubstepIdx(safeIdx + 1);
    } else if (!isLastProto) {
      setSubstepIdx(0);
      setProtocolIdx((p) => p + 1);
    } else {
      router.push('/mist');
    }
  };

  const back = () => {
    if (safeIdx > 0) {
      setSubstepIdx(safeIdx - 1);
    } else if (protocolIdx > 0) {
      setSubstepIdx(0);
      setProtocolIdx((p) => p - 1);
    }
  };

  const transmitToLLM = () => {
    const text = medicInput.trim();
    const v = sensorVitals;

    const reportLines = [
      `MECHANISM: ${mechanism ?? 'unknown'}`,
      `UNDER FIRE: ${underFire ? 'YES' : 'NO'}`,
      `SYMPTOMS: ${selectedSymptoms.join(', ') || 'none specified'}`,
      `VITALS: HR ${v.hr} | BP ${v.bpSys}/${v.bpDia} | RR ${v.rr} | SpO2 ${v.spo2}%`,
      `CURRENT ACTION: ${step.action}`,
    ];

    if (text) reportLines.push(`MEDIC OBSERVATION: ${text}`);
    if (audioTranscript) reportLines.push(`AUDIO TRANSCRIPT: ${audioTranscript}`);

    // Pass wound photo as base64 label if available
    if (woundPhotoBase64) {
      reportLines.push(`WOUND IMAGE: [base64 thumbnail attached]`);
      // The base64 is noted but not embedded in plain text to keep prompt manageable.
      // A vision model call would go through visionService.ts separately.
    }

    const report = reportLines.join('\n');

    setThinking(true);
    setShowLLM(true);

    if (!isSilent) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }

    streamTCCCGuidance(report, {
      onToken: (token) => appendStreamToken(token),
      onComplete: (full) => {
        setAiResponse(full);
        setThinking(false);
      },
      onError: (err) => {
        setAiResponse(err);
        setThinking(false);
      },
    });
  };

  const containerStyle = [s.container, isSilent && s.silentOverlay];

  return (
    <SafeAreaView style={containerStyle}>
      <SessionHeader />
      <VitalsBar vitals={sensorVitals} />

      {/* PROGRESS BAR */}
      <View style={s.progressTrack}>
        <View
          style={[
            s.progressFill,
            {
              width: `${((safeIdx + 1) / totalSubs) * 100}%`,
              backgroundColor: marchBadge.color,
            },
          ]}
        />
      </View>

      {/* STEP COUNTER + BADGES */}
      <View style={s.topMeta}>
        <View style={s.badgeRow}>
          <MarchBadge code={step.phaseCode} />
          <RiskBadge level={step.riskLevel} />
        </View>
        <Text style={s.stepCounter}>
          ACTION {protocolIdx + 1}/{protocol.length} · STEP {safeIdx + 1}/{totalSubs}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} bounces={false}>
        {/* ACTION TITLE */}
        <Text style={s.actionTitle}>{step.action}</Text>

        {/* RESOURCE LINE */}
        {step.resource && (
          <Text style={[s.resourceLine, { color: marchBadge.color }]}>
            USE: {step.resource}
            {step.supplyAlt ? (
              <Text style={s.resourceAlt}>  ·  no kit? {step.supplyAlt.split('.')[0]?.toLowerCase()}</Text>
            ) : null}
          </Text>
        )}

        {/* CURRENT SUBSTEP — the key instruction */}
        {substep && (
          <View style={[s.stepCard, substep.critical && s.stepCardCritical, isDone && s.stepCardDone]}>
            <View style={s.stepCardRow}>
              <Text style={[s.stepNum, { color: marchBadge.color }]}>
                {safeIdx + 1}/{totalSubs}
              </Text>
              {substep.critical && <Text style={s.critTag}>CRITICAL</Text>}
              <TouchableOpacity
                onPress={markDone}
                style={[s.doneBtn, isDone && s.doneBtnActive]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[s.doneBtnText, isDone && s.doneBtnTextActive]}>
                  {isDone ? '✓ DONE' : '○ MARK DONE'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.stepText, isDone && s.stepTextDone]}>{substep.text}</Text>
          </View>
        )}

        {/* Wound photo if available */}
        {woundPhotoUri && (
          <View style={s.photoWrap}>
            <Text style={s.photoLabel}>WOUND PHOTO</Text>
            <Image source={{ uri: woundPhotoUri }} style={s.photo} resizeMode="cover" />
          </View>
        )}

        {/* LLM INPUT + RESPONSE */}
        <View style={s.llmSection}>
          <Text style={s.llmLabel}>ASK GHOST MEDIC</Text>
          <TextInput
            style={s.llmInput}
            value={medicInput}
            onChangeText={setMedicInput}
            placeholder="Describe what you observe…"
            placeholderTextColor={C.dim}
            multiline
          />
          <TouchableOpacity style={s.llmBtn} onPress={transmitToLLM}>
            <Text style={s.llmBtnText}>TRANSMIT</Text>
          </TouchableOpacity>
        </View>

        {showLLM && (
          <AIResponse
            response={aiResponse}
            isThinking={isThinking}
            streamingResponse={streamingResponse}
          />
        )}

        {/* DOT PROGRESS */}
        <View style={s.dotRow}>
          {Array.from({ length: Math.min(totalSubs, 8) }).map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === safeIdx && { backgroundColor: marchBadge.color, width: 8, height: 8 },
                stepsDone.has(`${protocolIdx}-${i}`) && { backgroundColor: C.green },
              ]}
            />
          ))}
        </View>
      </ScrollView>

      {/* BOTTOM NAV — primary action at bottom */}
      <View style={[s.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[s.navBtn, s.navBack]}
          onPress={back}
          disabled={protocolIdx === 0 && substepIdx === 0}
        >
          <Text style={s.navBackText}>◀</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.navBtn, s.navNext, { backgroundColor: marchBadge.color }]}
          onPress={advance}
        >
          <Text style={s.navNextText}>
            {isLastSub && isLastProto
              ? 'COMPLETE ✓'
              : isLastSub
              ? 'NEXT ACTION ▶'
              : 'NEXT STEP ▶'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  silentOverlay: { backgroundColor: '#030503' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: {
    color: C.muted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
  },
  backBtnText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  progressTrack: { height: 3, backgroundColor: C.surface },
  progressFill: { height: 3 },
  topMeta: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepCounter: {
    color: C.dim,
    fontSize: 10,
    letterSpacing: 2,
  },
  scroll: { padding: 16, paddingBottom: 24 },
  actionTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: C.white,
    marginBottom: 10,
    lineHeight: 36,
  },
  resourceLine: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 20,
    lineHeight: 20,
  },
  resourceAlt: {
    fontWeight: '400',
    color: C.muted,
    fontSize: 12,
  },
  stepCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
  },
  stepCardCritical: {
    borderColor: C.red,
    backgroundColor: '#150808',
  },
  stepCardDone: {
    borderColor: C.green,
    backgroundColor: C.greenBg,
    opacity: 0.75,
  },
  stepCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  stepNum: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    width: 36,
  },
  critTag: {
    flex: 1,
    fontSize: 9,
    color: C.red,
    fontWeight: '700',
    letterSpacing: 2,
  },
  doneBtn: {
    borderWidth: 1,
    borderColor: C.dim,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 32,
    justifyContent: 'center',
  },
  doneBtnActive: {
    borderColor: C.green,
    backgroundColor: C.greenBg,
  },
  doneBtnText: {
    fontSize: 10,
    color: C.dim,
    fontWeight: '600',
    letterSpacing: 1,
  },
  doneBtnTextActive: { color: C.green },
  stepText: {
    fontSize: 22,
    color: C.white,
    lineHeight: 30,
    fontWeight: '500',
  },
  stepTextDone: {
    color: C.muted,
    textDecorationLine: 'line-through',
  },
  photoWrap: {
    marginBottom: 16,
    gap: 6,
  },
  photoLabel: {
    color: C.dim,
    fontSize: 9,
    letterSpacing: 3,
  },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: 6,
  },
  llmSection: {
    gap: 8,
    marginBottom: 16,
  },
  llmLabel: {
    color: C.muted,
    fontSize: 10,
    letterSpacing: 4,
  },
  llmInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    color: C.white,
    fontSize: 15,
    padding: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  llmBtn: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  llmBtnText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    marginBottom: 16,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 4,
    backgroundColor: C.dim,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    gap: 12,
  },
  navBtn: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  navBack: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 20,
  },
  navBackText: {
    color: C.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  navNext: {
    flex: 1,
  },
  navNextText: {
    color: C.bg,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
