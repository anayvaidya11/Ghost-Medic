import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView,
} from 'react-native';
import Header from '../components/Header';
import { RiskBadge, MarchBadge } from '../components/RiskBadge';
import { useApp } from '../context/AppContext';
import { C, MARCH_BADGE } from '../theme';

export default function AssessmentScreen({ navigation }) {
  const { protocol, symptoms, vitals, underFire } = useApp();

  if (!protocol || protocol.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <Header title="ASSESSMENT" onBack={() => navigation.goBack()} />
        <View style={s.empty}>
          <Text style={s.emptyText}>No protocol generated.{'\n'}Go back and enter symptoms.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const critical = protocol.filter(p => p.riskLevel === 'CRITICAL' || p.riskLevel === 'EXTREME');

  return (
    <SafeAreaView style={s.container}>
      <Header
        title="ASSESSMENT"
        subtitle={`${protocol.length} ACTIONS · MARCH PROTOCOL`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={s.scroll}>

        {critical.length > 0 && (
          <View style={s.alertBanner}>
            <Text style={s.alertText}>
              ⚠ {critical.length} CRITICAL ACTION{critical.length !== 1 ? 'S' : ''} — START IMMEDIATELY
            </Text>
          </View>
        )}

        <View style={s.summaryRow}>
          <SumCard label="UNDER FIRE" value={underFire ? 'YES' : 'NO'} color={underFire ? C.red : C.green} />
          <SumCard label="SYMPTOMS" value={symptoms.length.toString()} color={C.yellow} />
          <SumCard label="HR" value={vitals.heartRate ? `${vitals.heartRate}` : '—'} color={vitals.heartRate > 100 ? C.red : C.muted} />
          <SumCard label="SpO2" value={vitals.oxygenSat ? `${vitals.oxygenSat}%` : '—'} color={vitals.oxygenSat < 94 ? C.red : C.muted} />
        </View>

        <Text style={s.sectionLabel}>PRIORITY ACTIONS — TAP TO BEGIN</Text>

        {protocol.map((step, idx) => (
          <TouchableOpacity
            key={step.id}
            style={[s.card, idx === 0 && s.cardFirst]}
            onPress={() => navigation.navigate('Action', { stepIndex: idx })}
            activeOpacity={0.75}
          >
            <View style={s.cardLeft}>
              <View style={s.cardBadges}>
                <MarchBadge code={step.phaseCode} />
                <RiskBadge level={step.riskLevel} />
              </View>
              <Text style={s.cardAction}>{step.action}</Text>
              <Text style={s.cardCategory}>{step.category}</Text>
              {step.resource && (
                <Text style={s.cardResource}>▸ {step.resource}</Text>
              )}
            </View>
            <View style={s.cardRight}>
              <Text style={s.cardArrow}>›</Text>
              <Text style={s.cardSteps}>{step.steps.length} steps</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={s.startBtn}
          onPress={() => navigation.navigate('Action', { stepIndex: 0 })}
          activeOpacity={0.8}
        >
          <Text style={s.startBtnText}>▶  START TREATMENT — STEP 1</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function SumCard({ label, value, color }) {
  return (
    <View style={sc.card}>
      <Text style={[sc.value, { color }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: C.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
  },
  alertBanner: {
    backgroundColor: '#2D0000',
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  alertText: {
    color: C.red,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 4,
    marginBottom: 12,
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardFirst: {
    borderColor: C.red,
    backgroundColor: '#1A0E0E',
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  cardBadges: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  cardAction: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
  },
  cardCategory: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 2,
  },
  cardResource: {
    fontSize: 11,
    color: C.yellow,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  cardArrow: {
    color: C.muted,
    fontSize: 24,
  },
  cardSteps: {
    color: C.dim,
    fontSize: 9,
    letterSpacing: 1,
  },
  startBtn: {
    backgroundColor: C.red,
    borderRadius: 6,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 3,
  },
});

const sc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    fontSize: 8,
    color: C.muted,
    letterSpacing: 2,
    marginTop: 2,
  },
});
