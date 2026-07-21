import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { AVPU, generateProtocol } from '../logic/tccc';
import { C } from '../theme';

export default function VitalsScreen({ navigation }) {
  const { setVitals, symptoms, supplies, mechanism, underFire, setProtocol } = useApp();

  const [hr, setHr]         = useState('');
  const [sbp, setSbp]       = useState('');
  const [o2, setO2]         = useState('');
  const [temp, setTemp]     = useState('');
  const [avpu, setAvpu]     = useState(null);

  const vitalField = (label, value, set, unit, placeholder, warn) => (
    <View style={vf.row}>
      <View style={vf.labelWrap}>
        <Text style={vf.label}>{label}</Text>
        <Text style={vf.unit}>{unit}</Text>
        {warn && value && warn(value) && (
          <View style={vf.warnBadge}><Text style={vf.warnText}>!</Text></View>
        )}
      </View>
      <TextInput
        style={[vf.input, value && warn && warn(value) && vf.inputWarn]}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        keyboardType="numeric"
        value={value}
        onChangeText={set}
        maxLength={4}
      />
    </View>
  );

  const buildAndNavigate = () => {
    const vitalsObj = {
      heartRate:   hr   ? parseInt(hr)   : null,
      systolicBP:  sbp  ? parseInt(sbp)  : null,
      oxygenSat:   o2   ? parseInt(o2)   : null,
      skinTemp:    temp ? parseFloat(temp): null,
      avpu: avpu,
    };
    setVitals(vitalsObj);
    const proto = generateProtocol({ underFire, mechanism, symptoms, vitals: vitalsObj, supplies });
    setProtocol(proto);
    navigation.navigate('Assessment');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }}>
        <Header
          title="VITALS"
          subtitle="OPTIONAL — SKIP IF NOT AVAILABLE"
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <Text style={s.hint}>Manual entry only. No sensor input in this build.</Text>

          <View style={s.fieldsWrap}>
            {vitalField('HEART RATE', hr, setHr, 'bpm', '72', (v) => parseInt(v) > 100 || parseInt(v) < 50)}
            {vitalField('SYSTOLIC BP', sbp, setSbp, 'mmHg', '120', (v) => parseInt(v) < 90)}
            {vitalField('OXYGEN SAT', o2, setO2, '%', '98', (v) => parseInt(v) < 94)}
            {vitalField('SKIN TEMP', temp, setTemp, '°C', '37', (v) => parseFloat(v) < 35)}
          </View>

          <Text style={s.sectionLabel}>LEVEL OF CONSCIOUSNESS (AVPU)</Text>
          <View style={s.avpuRow}>
            {AVPU.map((a) => (
              <TouchableOpacity
                key={a.code}
                style={[s.avpuBtn, avpu === a.code && s.avpuActive]}
                onPress={() => setAvpu(avpu === a.code ? null : a.code)}
                activeOpacity={0.75}
              >
                <Text style={[s.avpuCode, avpu === a.code && s.avpuCodeActive]}>{a.code}</Text>
                <Text style={s.avpuLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {avpu && (
            <Text style={s.avpuDetail}>
              {AVPU.find(a => a.code === avpu)?.detail}
            </Text>
          )}

          <View style={s.bottomWrap}>
            <TouchableOpacity style={s.next} onPress={buildAndNavigate} activeOpacity={0.8}>
              <Text style={s.nextText}>ASSESS + GENERATE PROTOCOL →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.skip}
              onPress={() => {
                setVitals({});
                const proto = generateProtocol({ underFire, mechanism, symptoms, vitals: {}, supplies });
                setProtocol(proto);
                navigation.navigate('Assessment');
              }}
            >
              <Text style={s.skipText}>SKIP VITALS — ASSESS NOW</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  hint: {
    color: C.dim,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 20,
  },
  fieldsWrap: {
    gap: 10,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 4,
    marginBottom: 12,
  },
  avpuRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  avpuBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  avpuActive: {
    backgroundColor: C.yellowBg,
    borderColor: C.yellow,
  },
  avpuCode: {
    fontSize: 20,
    fontWeight: '900',
    color: C.muted,
  },
  avpuCodeActive: {
    color: C.yellow,
  },
  avpuLabel: {
    fontSize: 8,
    color: C.dim,
    letterSpacing: 1,
    textAlign: 'center',
  },
  avpuDetail: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  bottomWrap: {
    gap: 12,
    marginTop: 8,
  },
  next: {
    backgroundColor: C.green,
    borderRadius: 6,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 13,
    fontWeight: '800',
    color: C.bg,
    letterSpacing: 2,
  },
  skip: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 11,
    color: C.dim,
    letterSpacing: 2,
  },
});

const vf = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  labelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 2,
  },
  unit: {
    fontSize: 10,
    color: C.dim,
  },
  warnBadge: {
    backgroundColor: C.red,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnText: {
    color: C.white,
    fontSize: 10,
    fontWeight: '700',
  },
  input: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    color: C.white,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 80,
  },
  inputWarn: {
    borderColor: C.red,
    color: C.red,
  },
});
