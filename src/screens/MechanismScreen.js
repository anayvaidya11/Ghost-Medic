import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput,
} from 'react-native';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { C } from '../theme';

const MECHANISMS = [
  { id: 'gsw',        label: 'GUNSHOT WOUND',     icon: '⦿', sub: 'Single or multiple rounds' },
  { id: 'blast',      label: 'BLAST / IED',        icon: '💥', sub: 'Explosion, fragmentation' },
  { id: 'blunt',      label: 'BLUNT TRAUMA',       icon: '⬡', sub: 'Impact, vehicle, fall' },
  { id: 'stab',       label: 'STAB / LACERATION',  icon: '△', sub: 'Edged weapon, shrapnel' },
  { id: 'burn',       label: 'BURN',               icon: '◈', sub: 'Thermal, chemical, electrical' },
  { id: 'crush',      label: 'CRUSH / ENTRAPMENT', icon: '⊠', sub: 'Vehicle rollover, rubble' },
  { id: 'fall',       label: 'FALL / JUMP',        icon: '↓', sub: 'High or low energy fall' },
  { id: 'other',      label: 'OTHER',              icon: '?', sub: 'Unknown or not listed' },
];

export default function MechanismScreen({ navigation }) {
  const { mechanism, setMechanism } = useApp();
  const [note, setNote] = useState('');

  const select = (id) => setMechanism(id === mechanism ? null : id);

  return (
    <SafeAreaView style={s.container}>
      <Header
        title="MECHANISM"
        subtitle="STEP 2 OF 4 — WHAT HAPPENED?"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.grid}>
          {MECHANISMS.map((m) => {
            const active = mechanism === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[s.tile, active && s.tileActive]}
                onPress={() => select(m.id)}
                activeOpacity={0.75}
              >
                <Text style={[s.tileIcon, active && s.tileIconActive]}>{m.icon}</Text>
                <Text style={[s.tileName, active && s.tileNameActive]}>{m.label}</Text>
                <Text style={s.tileSub}>{m.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.noteWrap}>
          <Text style={s.noteLabel}>ADDITIONAL DETAILS (optional)</Text>
          <TextInput
            style={s.noteInput}
            placeholder="e.g. left thigh, 2 rounds, 30 min ago…"
            placeholderTextColor={C.dim}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>

        <TouchableOpacity
          style={[s.next, !mechanism && s.nextDisabled]}
          onPress={() => mechanism && navigation.navigate('Symptoms')}
          activeOpacity={0.8}
        >
          <Text style={[s.nextText, !mechanism && s.nextTextDisabled]}>
            NEXT: SYMPTOMS →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.skip}
          onPress={() => { setMechanism('unknown'); navigation.navigate('Symptoms'); }}
        >
          <Text style={s.skipText}>SKIP — UNKNOWN MECHANISM</Text>
        </TouchableOpacity>

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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  tile: {
    width: '47.5%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
  },
  tileActive: {
    backgroundColor: C.yellowBg,
    borderColor: C.yellow,
  },
  tileIcon: {
    fontSize: 22,
    color: C.muted,
    marginBottom: 6,
  },
  tileIconActive: {
    color: C.yellow,
  },
  tileName: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  tileNameActive: {
    color: C.yellow,
  },
  tileSub: {
    fontSize: 10,
    color: C.dim,
    textAlign: 'center',
  },
  noteWrap: {
    marginBottom: 24,
  },
  noteLabel: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 3,
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    color: C.white,
    fontSize: 14,
    padding: 12,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  next: {
    backgroundColor: C.green,
    borderRadius: 6,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  nextDisabled: {
    backgroundColor: C.surface,
  },
  nextText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.bg,
    letterSpacing: 3,
  },
  nextTextDisabled: {
    color: C.dim,
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
