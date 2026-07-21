import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Vibration,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RiskBadge, MarchBadge } from '../components/RiskBadge';
import VitalsBar from '../components/VitalsBar';
import { useApp } from '../context/AppContext';
import { useBraceletVitals } from '../hooks/useBraceletVitals';
import { C, RISK, MARCH_BADGE } from '../theme';

export default function ActionScreen({ navigation, route }) {
  const { protocol, mode, dimScreen } = useApp();
  const vitals = useBraceletVitals();
  const insets = useSafeAreaInsets();

  const [protocolIdx, setProtocolIdx] = useState(route.params?.stepIndex ?? 0);
  const [substepIdx,  setSubstepIdx]  = useState(0);
  const [stepsDone,   setStepsDone]   = useState(new Set());

  const step = protocol[protocolIdx];
  if (!step) return null;

  // Clamp substepIdx defensively — guards against any stale-index render
  const totalSubs   = step.steps?.length ?? 0;
  const safeIdx     = Math.min(substepIdx, Math.max(0, totalSubs - 1));
  const substep     = step.steps?.[safeIdx];
  const isLastSub   = safeIdx === totalSubs - 1;
  const isLastProto = protocolIdx === protocol.length - 1;

  const markDone = () => {
    setStepsDone(prev => new Set([...prev, `${protocolIdx}-${safeIdx}`]));
  };

  const advance = () => {
    markDone();
    if (!isLastSub) {
      setSubstepIdx(safeIdx + 1);
      if (mode === 'silent') Vibration.vibrate(50);
    } else if (!isLastProto) {
      // Reset substepIdx and advance protocolIdx in the same batch —
      // both apply before the next render, so substep is never undefined.
      setSubstepIdx(0);
      setProtocolIdx(p => p + 1);
      if (mode === 'silent') Vibration.vibrate([0, 100, 50, 100]);
    } else {
      navigation.navigate('Triage');
    }
  };

  const back = () => {
    if (safeIdx > 0) {
      setSubstepIdx(safeIdx - 1);
    } else if (protocolIdx > 0) {
      setSubstepIdx(0);
      setProtocolIdx(p => p - 1);
    }
  };

  const marchBadge = MARCH_BADGE[step.phaseCode] || MARCH_BADGE['EVA'];
  const isDone     = stepsDone.has(`${protocolIdx}-${safeIdx}`);

  const opacity = dimScreen ? 0.55 : 1;

  return (
    <SafeAreaView style={[s.container, { opacity }]}>

      {/* TOP BAR */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Triage')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.topBarBack}>◀ BACK</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarStep}>
            ACTION {protocolIdx + 1}/{protocol.length} · SUB-STEP {safeIdx + 1}/{totalSubs}
          </Text>
        </View>
        <View style={s.topBarBadges}>
          <MarchBadge code={step.phaseCode} />
        </View>
      </View>

      {/* VITALS BAND — always visible during treatment */}
      <VitalsBar vitals={vitals} />

      {/* PROGRESS BAR */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${((substepIdx + 1) / totalSubs) * 100}%`, backgroundColor: marchBadge.color }]} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} bounces={false}>

        {/* RISK + CATEGORY */}
        <View style={s.metaRow}>
          <RiskBadge level={step.riskLevel} />
          <Text style={s.categoryLabel}>{step.category}</Text>
        </View>

        {/* ACTION TITLE — what to do */}
        <Text style={s.actionTitle}>{step.action}</Text>

        {/* USE: resource — single combined line */}
        {step.resource && (
          <Text style={[s.resourceLine, { color: marchBadge.color }]}>
            USE: {step.resource}
            {step.supplyAlt ? <Text style={s.resourceAlt}>  ·  no kit? {step.supplyAlt.split('.')[0].toLowerCase()}</Text> : null}
          </Text>
        )}

        {/* CURRENT STEP — the actual instruction, large and unambiguous */}
        {substep && (
          <View style={[s.stepCard, substep.critical && s.stepCardCritical, isDone && s.stepCardDone]}>
            <View style={s.stepCardRow}>
              <Text style={[s.stepNum, { color: marchBadge.color }]}>{safeIdx + 1}/{totalSubs}</Text>
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

      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={[s.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[s.navBtn, s.navBack]}
          onPress={back}
          disabled={protocolIdx === 0 && substepIdx === 0}
        >
          <Text style={s.navBackText}>◀ BACK</Text>
        </TouchableOpacity>

        <View style={s.navCenter}>
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

        <TouchableOpacity style={[s.navBtn, s.navNext, { backgroundColor: marchBadge.color }]} onPress={advance}>
          <Text style={s.navNextText}>
            {isLastSub && isLastProto ? 'COMPLETE ✓' : isLastSub ? 'NEXT ACTION ▶' : 'NEXT STEP ▶'}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  topBarBack: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 2,
    width: 50,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarStep: {
    color: C.dim,
    fontSize: 10,
    letterSpacing: 2,
  },
  topBarBadges: {
    width: 50,
    alignItems: 'flex-end',
  },
  progressTrack: {
    height: 3,
    backgroundColor: C.surface,
  },
  progressFill: {
    height: 3,
  },
  scroll: {
    padding: 16,
    paddingBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 2,
    flex: 1,
  },
  actionTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 0,
    marginBottom: 10,
    lineHeight: 38,
  },
  // Single combined resource line: "USE: X  ·  no kit? improvise"
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
  // The big step card — the ONLY instruction the user sees
  stepCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
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
  doneBtnTextActive: {
    color: C.green,
  },
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
  // ── DEAD STYLES kept for reference, not used ─────────────────────
  miniStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
  },
  miniStepActive: {
    borderColor: C.white,
    backgroundColor: C.surfaceHigh,
  },
  miniStepDone: {
    opacity: 0.5,
  },
  miniStepNum: {
    width: 18,
    fontSize: 12,
    fontWeight: '700',
    color: C.dim,
    textAlign: 'center',
  },
  miniStepText: {
    flex: 1,
    fontSize: 12,
    color: C.muted,
    lineHeight: 17,
  },
  miniStepTextDone: {
    textDecorationLine: 'line-through',
    color: C.dim,
  },
  miniStepTextActive: {
    color: C.white,
    fontWeight: '500',
  },
  miniCheck: {
    color: C.green,
    fontSize: 13,
    fontWeight: '700',
  },
  miniCrit: {
    color: C.red,
    fontSize: 13,
    fontWeight: '900',
    width: 14,
    textAlign: 'center',
  },
  diagnosisWrap: {
    borderTopWidth: 1,
    borderColor: C.border,
    paddingTop: 14,
  },
  diagnosisLabel: {
    fontSize: 9,
    color: C.dim,
    letterSpacing: 3,
    marginBottom: 4,
  },
  diagnosisText: {
    fontSize: 12,
    color: C.dim,
    fontStyle: 'italic',
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
  },
  navBack: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  navBackText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  navNext: {
    flex: 1,
  },
  navNextText: {
    color: C.bg,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  navCenter: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 4,
    backgroundColor: C.dim,
  },
});
