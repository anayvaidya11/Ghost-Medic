import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView,
} from 'react-native';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { SUPPLY_GROUPS } from '../data/supplies';
import { C } from '../theme';

const QUICK_KITS = [
  { id: 'ifak_preset',  label: 'IFAK',     ids: ['tourniquet','hemostatic_gauze','gauze','pressure_bandage','npa','tape','gloves','scissors'] },
  { id: 'cls_preset',   label: 'CLS Bag',  ids: ['tourniquet','hemostatic_gauze','gauze','pressure_bandage','npa','chest_seal','needle_decompression','iv_kit','saline_fluids','tape','gloves','scissors','space_blanket'] },
  { id: 'bare_preset',  label: 'Nothing',  ids: [] },
];

export default function SuppliesScreen({ navigation }) {
  const { supplies, setSupplies, toggleSupply } = useApp();

  const loadKit = (ids) => setSupplies([...new Set([...supplies, ...ids])]);
  const count = supplies.length;

  return (
    <SafeAreaView style={s.container}>
      <Header
        title="SUPPLIES"
        subtitle="STEP 4 OF 4 — WHAT DO YOU HAVE?"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <Text style={s.sectionLabel}>QUICK SELECT — LOAD A KIT</Text>
        <View style={s.kitRow}>
          {QUICK_KITS.map((k) => (
            <TouchableOpacity
              key={k.id}
              style={s.kitBtn}
              onPress={() => loadKit(k.ids)}
              activeOpacity={0.75}
            >
              <Text style={s.kitLabel}>{k.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.kitBtn} onPress={() => setSupplies([])} activeOpacity={0.75}>
            <Text style={[s.kitLabel, { color: C.red }]}>Clear</Text>
          </TouchableOpacity>
        </View>

        {SUPPLY_GROUPS.map((group) => (
          <View key={group.label} style={s.group}>
            <Text style={s.groupLabel}>{group.label}</Text>
            {group.items.map((item) => {
              const active = supplies.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.row, active && s.rowActive]}
                  onPress={() => toggleSupply(item.id)}
                  activeOpacity={0.75}
                >
                  <View style={[s.checkbox, active && s.checkboxActive]}>
                    {active && <Text style={s.check}>✓</Text>}
                  </View>
                  <Text style={[s.itemLabel, active && s.itemLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={s.bottomWrap}>
          {count > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{count} item{count !== 1 ? 's' : ''} available</Text>
            </View>
          )}

          <TouchableOpacity
            style={s.next}
            onPress={() => navigation.navigate('Vitals')}
            activeOpacity={0.8}
          >
            <Text style={s.nextText}>NEXT: VITALS →</Text>
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
  sectionLabel: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 4,
    marginBottom: 10,
  },
  kitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  kitBtn: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  kitLabel: {
    color: C.yellow,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  group: {
    marginBottom: 20,
  },
  groupLabel: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 4,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    marginBottom: 6,
  },
  rowActive: {
    backgroundColor: C.greenBg,
    borderColor: C.green,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: C.dim,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: C.green,
    borderColor: C.green,
  },
  check: {
    color: C.bg,
    fontSize: 13,
    fontWeight: '700',
  },
  itemLabel: {
    fontSize: 13,
    color: C.muted,
    flex: 1,
  },
  itemLabelActive: {
    color: C.white,
    fontWeight: '500',
  },
  bottomWrap: {
    marginTop: 8,
    gap: 12,
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: C.greenBg,
    borderWidth: 1,
    borderColor: C.green,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  badgeText: {
    color: C.green,
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
  nextText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.bg,
    letterSpacing: 3,
  },
});
