/**
 * TRIAGE SCREEN
 * Mechanism input + injury region selector + photo + audio
 * Single large "TREAT NOW" button at bottom.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { C } from '@/theme/index';
import { useSessionStore } from '@/store/sessionStore';
import { generateProtocol } from '@/logic/tccc';
import { useBiosensorVitals } from '@/services/biosensorService';
import VitalsBar from '@/components/VitalsBar';
import { SessionHeader } from '@/components/SessionHeader';
import { transcribeAudio } from '@/services/transcriptionService';

// expo-audio for recording
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';

// ── CONCERN TILES ───────────────────────────────────────────────────
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
    symptoms: ['extremity_bleed', 'chest_wound', 'head_injury', 'difficulty_breathing'],
  },
] as const;

type ConcernId = (typeof CONCERNS)[number]['id'];

export default function TriageScreen() {
  const insets = useSafeAreaInsets();
  const mode = useSessionStore((s) => s.mode);
  const setProtocol = useSessionStore((s) => s.setProtocol);
  const setUnderFire = useSessionStore((s) => s.setUnderFire);
  const setSelectedSymptoms = useSessionStore((s) => s.setSelectedSymptoms);
  const setMechanism = useSessionStore((s) => s.setMechanism);
  const setWoundPhoto = useSessionStore((s) => s.setWoundPhoto);
  const setAudioTranscript = useSessionStore((s) => s.setAudioTranscript);

  const sensorVitals = useBiosensorVitals();

  const [selected, setSelected] = useState<ConcernId[]>([]);
  const [underFire, setLocalFire] = useState(false);
  const [woundPhotoUri, setWoundPhotoUri] = useState<string | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // Silent mode overlay
  const isSilent = mode === 'silent';

  // expo-audio recorder hook
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const isRecording = audioRecorder.isRecording;

  const toggle = (id: ConcernId) => {
    if (!isSilent) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const setThreat = (val: boolean) => {
    setLocalFire(val);
    if (!isSilent) {
      Haptics.impactAsync(
        val ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => undefined);
    } else {
      // SILENT: 1 long = critical
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    }
  };

  // ── Camera ────────────────────────────────────────────────────────
  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        if (!isSilent) {
          Alert.alert('Camera needed', 'Enable camera access in Settings to photograph wounds.');
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setWoundPhotoUri(asset.uri);
        setWoundPhoto(asset.uri, asset.base64 ?? null);
      }
    } catch {
      // Fail silently — never crash
    }
  };

  // ── Voice ─────────────────────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      try {
        const uri = audioRecorder.uri;
        await audioRecorder.stop();
        setHasRecording(true);
        if (!isSilent) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
        // Attempt transcription (graceful fallback)
        if (uri) {
          setTranscribing(true);
          transcribeAudio(uri)
            .then((transcript) => {
              if (transcript) {
                setAudioTranscript(transcript);
              }
              // null = transcription unavailable offline — no UI crash
            })
            .catch(() => undefined)
            .finally(() => setTranscribing(false));
        }
      } catch {
        // fail silently
      }
    } else {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          if (!isSilent) {
            Alert.alert('Mic needed', 'Enable microphone access in Settings for voice input.');
          }
          return;
        }
        await audioRecorder.record();
        if (!isSilent) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        }
      } catch {
        // fail silently
      }
    }
  };

  // ── Build protocol and navigate ───────────────────────────────────
  const handleTreat = () => {
    const symptoms: string[] = [
      ...new Set(
        selected.flatMap((id) => [...(CONCERNS.find((c) => c.id === id)?.symptoms ?? [])])
      ),
    ];

    // Auto-inject shock symptoms from biosensor
    if (sensorVitals.hr > 110) symptoms.push('rapid_weak_pulse');
    if (sensorVitals.bpSys < 90) symptoms.push('pale_skin', 'cool_clammy');
    if (sensorVitals.spo2 < 94) symptoms.push('difficulty_breathing');
    if (sensorVitals.skinTemp < 35) symptoms.push('shivering');

    setUnderFire(underFire);
    setSelectedSymptoms(symptoms);
    setMechanism(selected.includes('blast') ? 'blast' : 'gsw');

    const fullProto = generateProtocol({
      underFire,
      mechanism: selected.includes('blast') ? 'blast' : 'gsw',
      symptoms,
      vitals: {
        heartRate: sensorVitals.hr,
        systolicBP: sensorVitals.bpSys,
        oxygenSat: sensorVitals.spo2,
        skinTemp: sensorVitals.skinTemp,
      },
      supplies: [
        'tourniquet',
        'hemostatic_gauze',
        'gauze',
        'pressure_bandage',
        'chest_seal',
        'needle_decompression',
        'npa',
        'iv_kit',
        'saline_fluids',
        'space_blanket',
        'tape',
        'scissors',
      ],
    });

    // Keep top 3 critical + MIST, trim each to critical sub-steps
    const critical = fullProto.filter((s) => s.id !== 'mist').slice(0, 3);
    const mist = fullProto.find((s) => s.id === 'mist');

    const trim = (step: typeof fullProto[0]) => ({
      ...step,
      steps:
        step.steps.filter((ss) => ss.critical).slice(0, 3).length >= 1
          ? step.steps.filter((ss) => ss.critical).slice(0, 3)
          : step.steps.slice(0, 3),
    });

    const proto = [...critical.map(trim), ...(mist ? [trim(mist)] : [])];
    setProtocol(proto);

    if (!isSilent) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    } else {
      // SILENT: 2 short = action needed
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }

    router.push('/action');
  };

  const canTreat = selected.length > 0 || underFire || !!woundPhotoUri || hasRecording;

  const containerStyle = [s.container, isSilent && s.silentOverlay];

  return (
    <SafeAreaView style={containerStyle}>
      <SessionHeader />

      {/* VITALS BAND */}
      <VitalsBar vitals={sensorVitals} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* THREAT TOGGLE */}
        <View style={s.threatWrap}>
          <TouchableOpacity
            style={[s.threatBtn, !underFire && s.threatSecureActive]}
            onPress={() => setThreat(false)}
            activeOpacity={0.8}
          >
            <Text style={[s.threatBtnText, !underFire && { color: C.green }]}>● SECURE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.threatBtn, underFire && s.threatFireActive]}
            onPress={() => setThreat(true)}
            activeOpacity={0.8}
          >
            <Text style={[s.threatBtnText, underFire && { color: C.red }]}>⚠ UNDER FIRE</Text>
          </TouchableOpacity>
        </View>

        {underFire && (
          <View style={s.fireNote}>
            <Text style={s.fireNoteText}>
              UNDER FIRE: Tourniquet on limb bleeds only. Move to cover.{'\n'}
              Full treatment begins once threat is suppressed.
            </Text>
          </View>
        )}

        {/* CONCERN TILES */}
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
                  <View style={[s.tileCheck, { backgroundColor: c.color }]}>
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

        {/* CAMERA + VOICE */}
        <View style={s.mediaRow}>
          <TouchableOpacity
            style={[s.mediaBtn, woundPhotoUri && s.mediaBtnDone]}
            onPress={takePhoto}
            activeOpacity={0.8}
          >
            <Text style={s.mediaIcon}>📷</Text>
            <Text style={[s.mediaLabel, woundPhotoUri && { color: C.green }]}>
              {woundPhotoUri ? 'PHOTO\nSAVED ✓' : 'WOUND\nPHOTO'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.mediaBtn, isRecording && s.mediaBtnRec]}
            onPress={toggleRecording}
            activeOpacity={0.8}
          >
            <Text style={s.mediaIcon}>{isRecording ? '⏹' : '🎤'}</Text>
            <Text style={[s.mediaLabel, isRecording && { color: C.red }]}>
              {isRecording
                ? 'RECORDING\nTAP TO STOP'
                : transcribing
                ? 'PROCESSING...'
                : hasRecording
                ? 'RECORDED ✓'
                : 'VOICE\nDESCRIBE'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transcription unavailable note */}
        {hasRecording && !transcribing && (
          <Text style={s.transcriptNote}>
            Audio recorded — transcription unavailable offline
          </Text>
        )}

        {/* Wound photo preview */}
        {woundPhotoUri && (
          <View style={s.photoWrap}>
            <Image source={{ uri: woundPhotoUri }} style={s.photo} resizeMode="cover" />
            <TouchableOpacity
              style={s.retake}
              onPress={() => {
                setWoundPhotoUri(null);
                setWoundPhoto(null, null);
              }}
            >
              <Text style={s.retakeText}>✕ RETAKE</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* TREAT NOW — primary action, full width, bottom */}
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
  silentOverlay: {
    backgroundColor: '#030503',
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
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
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
    fontSize: 13,
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
  tileCheck: {
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
    marginBottom: 8,
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
    minHeight: 80,
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
  transcriptNote: {
    color: C.dim,
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
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
    minHeight: 56,
    justifyContent: 'center',
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
