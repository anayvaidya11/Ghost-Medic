/**
 * TRIAGE SCREEN
 * Replaces 5 separate intake screens.
 * Goal: 2-3 taps → immediate treatment protocol.
 *
 * Layout:
 *   [Vitals bar — always visible, auto from bracelet]
 *   [Threat toggle: SECURE / UNDER FIRE]
 *   [6 large concern tiles — multi-select]
 *   [📷 Wound photo]  [🎤 Voice describe]
 *   [▶ TREAT NOW]
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { useApp } from '../context/AppContext';
import { generateProtocol } from '../logic/tccc';
import { useBraceletVitals } from '../hooks/useBraceletVitals';
import VitalsBar from '../components/VitalsBar';

// ── CONCERN TILES ───────────────────────────────────────────────────
// Tapping one or more drives the MARCH protocol output.
const CONCERNS = [
  {
    id: 'extremity_bleed',
    icon: '🩸',
    label: 'LIMB\nBLEEDING',
    sub: 'Arm or leg wound',
    color: '#EF4444',
    bg: '#200000',
    symptoms: ['extremity_bleed'],
  },
  {
    id: 'neck_groin_bleed',
    icon: '⚡',
    label: 'NECK / GROIN\nBLEEDING',
    sub: 'No tourniquet site',
    color: '#EF4444',
    bg: '#200000',
    symptoms: ['junctional_bleed', 'neck_bleed'],
  },
  {
    id: 'not_breathing',
    icon: '😶',
    label: 'NOT BREATHING\n/ UNCONSCIOUS',
    sub: 'Airway or pulse issue',
    color: '#F59E0B',
    bg: '#1C0E00',
    symptoms: ['unconscious', 'airway_obstruction'],
  },
  {
    id: 'chest_wound',
    icon: '🫁',
    label: 'CHEST\nWOUND',
    sub: 'Penetrating / sucking',
    color: '#60A5FA',
    bg: '#08172E',
    symptoms: ['chest_wound', 'sucking_chest_wound', 'difficulty_breathing'],
  },
  {
    id: 'head_injury',
    icon: '🧠',
    label: 'HEAD\nINJURY',
    sub: 'TBI / concussion',
    color: '#F59E0B',
    bg: '#1C0E00',
    symptoms: ['head_injury'],
  },
  {
    id: 'blast',
    icon: '💥',
    label: 'BLAST /\nEXPLOSION',
    sub: 'Multi-system trauma',
    color: '#F59E0B',
    bg: '#1C0E00',
    // Blast auto-adds multi-system injuries
    symptoms: ['extremity_bleed', 'chest_wound', 'head_injury', 'difficulty_breathing'],
  },
];

export default function TriageScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { setProtocol, setUnderFire, setSymptoms, mode } = useApp();
  const vitals = useBraceletVitals();

  const [selected, setSelected]         = useState([]);
  const [underFire, setLocalFire]       = useState(false);
  const [woundPhoto, setWoundPhoto]     = useState(null);
  const [hasRecording, setHasRecording] = useState(false);

  // expo-audio hook — replaces expo-av Recording object
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const isRecording   = audioRecorder.isRecording;

  // ── Tile toggle ──────────────────────────────────────────────────
  const toggle = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Threat toggle ────────────────────────────────────────────────
  const setThreat = (val) => {
    setLocalFire(val);
    Haptics.impactAsync(
      val ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light
    );
  };

  // ── Camera ───────────────────────────────────────────────────────
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera needed', 'Enable camera access in Settings to photograph wounds.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: false,
    });
    if (!result.canceled) setWoundPhoto(result.assets[0].uri);
  };

  // ── Voice ────────────────────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      await audioRecorder.stop();
      setHasRecording(true);   // voice alone unlocks TREAT NOW
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert('Mic needed', 'Enable microphone access in Settings for voice input.');
          return;
        }
        await audioRecorder.record();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        Alert.alert('Audio error', e.message);
      }
    }
  };

  // ── Generate protocol and go ─────────────────────────────────────
  const handleTreat = () => {
    // Flatten all symptom ids from selected concern tiles
    const symptoms = [...new Set(
      selected.flatMap(id => CONCERNS.find(c => c.id === id)?.symptoms ?? [])
    )];

    // Auto-inject shock symptoms if bracelet readings are abnormal
    if (vitals.heartRate > 110)    symptoms.push('rapid_weak_pulse');
    if (vitals.systolicBP < 90)    symptoms.push('pale_skin', 'cool_clammy');
    if (vitals.oxygenSat < 94)     symptoms.push('difficulty_breathing');
    if (vitals.skinTemp < 35)      symptoms.push('shivering');

    setUnderFire(underFire);
    setSymptoms(symptoms);

    const fullProto = generateProtocol({
      underFire,
      mechanism: selected.includes('blast') ? 'blast' : 'gsw',
      symptoms,
      vitals: {
        heartRate:  vitals.heartRate,
        systolicBP: vitals.systolicBP,
        oxygenSat:  vitals.oxygenSat,
        skinTemp:   vitals.skinTemp,
      },
      supplies: [
        'tourniquet', 'hemostatic_gauze', 'gauze', 'pressure_bandage',
        'chest_seal', 'needle_decompression', 'npa', 'iv_kit',
        'saline_fluids', 'space_blanket', 'tape', 'scissors',
      ],
    });

    // Keep only the top 3 highest-priority actions — reduces overwhelm.
    // Always include the MIST/evac card as a final step.
    const critical = fullProto.filter(s => s.id !== 'mist').slice(0, 3);
    const mist     = fullProto.find(s => s.id === 'mist');

    // Trim each step to its 3 most critical sub-steps only.
    const trim = step => ({
      ...step,
      steps: step.steps.filter(s => s.critical).slice(0, 3).length >= 1
        ? step.steps.filter(s => s.critical).slice(0, 3)
        : step.steps.slice(0, 3),
    });

    const proto = [...critical.map(trim), ...(mist ? [trim(mist)] : [])];
    setProtocol(proto);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    navigation.navigate('Action', { stepIndex: 0 });
  };

  // Any single input is enough — tile, photo, voice, or under-fire flag
  const canTreat = selected.length > 0 || underFire || !!woundPhoto || hasRecording;
  const modeColor = mode === 'silent' ? C.red : mode === 'buddy' ? C.blue : C.green;

  return (
    <SafeAreaView style={s.container}>

      {/* ── VITALS BAND ─────────────────────────────────────────── */}
      <VitalsBar vitals={vitals} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >

        {/* ── THREAT TOGGLE ──────────────────────────────────────── */}
        <View style={s.threatWrap}>
          <TouchableOpacity
            style={[s.threatBtn, !underFire && s.threatSecureActive]}
            onPress={() => setThreat(false)}
            activeOpacity={0.8}
          >
            <Text style={[s.threatBtnText, !underFire && { color: C.green }]}>
              ● SECURE
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.threatBtn, underFire && s.threatFireActive]}
            onPress={() => setThreat(true)}
            activeOpacity={0.8}
          >
            <Text style={[s.threatBtnText, underFire && { color: C.red }]}>
              ⚠ UNDER FIRE
            </Text>
          </TouchableOpacity>
        </View>

        {underFire && (
          <View style={s.fireNote}>
            <Text style={s.fireNoteText}>
              UNDER FIRE: Tourniquet on limb bleeds only. Move to cover.{'\n'}Full treatment begins once threat is suppressed.
            </Text>
          </View>
        )}

        {/* ── CONCERN TILES ──────────────────────────────────────── */}
        <Text style={s.q}>WHAT'S HAPPENING?</Text>
        <View style={s.grid}>
          {CONCERNS.map((c) => {
            const active = selected.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  s.tile,
                  { borderColor: active ? c.color : C.border },
                  active && { backgroundColor: c.bg },
                ]}
                onPress={() => toggle(c.id)}
                activeOpacity={0.75}
              >
                {active && (
                  <View style={[s.tileCheckMark, { backgroundColor: c.color }]}>
                    <Text style={s.tileCheckText}>✓</Text>
                  </View>
                )}
                <Text style={s.tileIcon}>{c.icon}</Text>
                <Text style={[s.tileLabel, { color: active ? c.color : C.muted }]}>
                  {c.label}
                </Text>
                <Text style={s.tileSub}>{c.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── CAMERA + VOICE ─────────────────────────────────────── */}
        <View style={s.mediaRow}>
          <TouchableOpacity
            style={[s.mediaBtn, woundPhoto && s.mediaBtnDone]}
            onPress={takePhoto}
            activeOpacity={0.8}
          >
            <Text style={s.mediaIcon}>📷</Text>
            <Text style={[s.mediaLabel, woundPhoto && { color: C.green }]}>
              {woundPhoto ? 'PHOTO\nSAVED ✓' : 'WOUND\nPHOTO'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.mediaBtn, isRecording && s.mediaBtnRec]}
            onPress={toggleRecording}
            activeOpacity={0.8}
          >
            <Text style={s.mediaIcon}>{isRecording ? '⏹' : '🎤'}</Text>
            <Text style={[s.mediaLabel, isRecording && { color: C.red }]}>
              {isRecording ? 'RECORDING\nTAP TO STOP' : 'VOICE\nDESCRIBE'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Wound photo preview */}
        {woundPhoto && (
          <View style={s.photoWrap}>
            <Image source={{ uri: woundPhoto }} style={s.photo} resizeMode="cover" />
            <TouchableOpacity style={s.retake} onPress={() => setWoundPhoto(null)}>
              <Text style={s.retakeText}>✕ RETAKE</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* ── TREAT NOW ──────────────────────────────────────────────── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[s.treatBtn, !canTreat && s.treatBtnDim]}
          onPress={canTreat ? handleTreat : undefined}
          activeOpacity={0.85}
        >
          <Text style={[s.treatBtnText, !canTreat && s.treatBtnTextDim]}>
            {canTreat ? '▶  TREAT NOW' : 'TAP A CONCERN, PHOTO, OR VOICE TO BEGIN'}
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
  scroll: {
    padding: 16,
    paddingBottom: 12,
  },

  // Threat
  threatWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  threatBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  threatSecureActive: {
    backgroundColor: C.greenBg,
    borderColor: C.green,
  },
  threatFireActive: {
    backgroundColor: C.redBg,
    borderColor: C.red,
  },
  threatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 2,
  },
  fireNote: {
    backgroundColor: '#200000',
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  fireNoteText: {
    color: C.red,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  // Tiles
  q: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: 4,
    marginBottom: 12,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  tile: {
    width: '47.5%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    position: 'relative',
  },
  tileCheckMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCheckText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  tileIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  tileSub: {
    fontSize: 10,
    color: C.dim,
    textAlign: 'center',
  },

  // Media
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  mediaBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  mediaBtnDone: {
    borderColor: C.green,
    backgroundColor: C.greenBg,
  },
  mediaBtnRec: {
    borderColor: C.red,
    backgroundColor: C.redBg,
  },
  mediaIcon: {
    fontSize: 24,
  },
  mediaLabel: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 15,
  },
  photoWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 8,
  },
  retake: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  retakeText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '600',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  treatBtn: {
    backgroundColor: C.red,
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
  },
  treatBtnDim: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  treatBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 3,
  },
  treatBtnTextDim: {
    color: C.dim,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
