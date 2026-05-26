import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { useApp } from '../context/AppContext';

export default function Header({ title, subtitle, onBack, right }) {
  const insets = useSafeAreaInsets();
  const { mode } = useApp();

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={s.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={s.back} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.backText}>◀</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.backPlaceholder} />
        )}
        <View style={s.center}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
        </View>
        <View style={s.rightSlot}>
          {right}
          <View style={[s.modeDot, { backgroundColor: modeDotColor(mode) }]} />
        </View>
      </View>
      <View style={s.divider} />
    </View>
  );
}

function modeDotColor(mode) {
  if (mode === 'silent') return C.red;
  if (mode === 'buddy')  return C.blue;
  return C.green;
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: C.bg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  back: {
    width: 32,
  },
  backText: {
    color: C.muted,
    fontSize: 16,
  },
  backPlaceholder: {
    width: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  sub: {
    color: C.muted,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 2,
  },
  rightSlot: {
    width: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  modeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
