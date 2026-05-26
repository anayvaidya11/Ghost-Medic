import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView,
} from 'react-native';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { SYMPTOM_GROUPS } from '../data/symptoms';
import { C } from '../theme';

export default function SymptomsScreen({ navigation }) {
  const { symptoms, toggleSymptom } = useApp();

  const count = symptoms.length;

  return (
    <SafeAreaView style={s.container}>
      <Header
        title="SYMPTOMS"
        subtitle="STEP 3 OF 4 — SELECT ALL THAT APPLY"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {SYMPTOM_GROUPS.map((group) => (
          <View key={group.label} style={s.group}>
            <Text style={s.groupLabel}>{group.label}</Text>
            <View style={s.chips}>
              {group.items.map((item) => {
                const active = symptoms.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => toggleSymptom(item.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.chipIcon]}>{item.icon}</Text>
                    <Text style={[s.chipLabel, active && s.chipLabelActive]}>{item.label}</Text>
                    {active && <Text style={s.chipCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View style={s.bottomWrap}>
          {count > 0 && (
            <View style={s.selectedBadge}>
              <Text style={s.selectedText}>{count} symptom{count !== 1 ? 's' : ''} selected</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.next, count === 0 && s.nextDim]}
            onPress={() => navigation.navigate('Supplies')}
            activeOpacity={0.8}
          >
            <Text style={[s.nextText, count === 0 && s.nextTextDim]}>
              {count === 0 ? 'CONTINUE WITHOUT SYMPTOMS →' : 'NEXT: SUPPLIES →'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
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
    paddingBottom: 40,
  },
  group: {
    marginBottom: 20,
  },
  groupLabel: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 4,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  chips: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: C.redBg,
    borderColor: C.red,
  },
  chipIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  chipLabel: {
    flex: 1,
    fontSize: 14,
    color: C.muted,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: C.white,
    fontWeight: '600',
  },
  chipCheck: {
    fontSize: 14,
    color: C.red,
    fontWeight: '700',
  },
  bottomWrap: {
    marginTop: 8,
    gap: 12,
  },
  selectedBadge: {
    alignSelf: 'center',
    backgroundColor: C.redBg,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  selectedText: {
    color: C.red,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  next: {
    backgroundColor: C.green,
    borderRadius: 6,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextDim: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  nextText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.bg,
    letterSpacing: 3,
  },
  nextTextDim: {
    color: C.muted,
  },
});
