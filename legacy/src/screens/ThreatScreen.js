import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { C } from '../theme';

export default function ThreatScreen({ navigation }) {
  const { setUnderFire, setDimScreen, mode } = useApp();

  const handleUnderFire = (val) => {
    setUnderFire(val);
    if (val) setDimScreen(true);
    navigation.navigate('Mechanism');
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.top}>
        <Text style={s.stepLabel}>STEP 1 OF 4</Text>
        <Text style={s.stepBar}>{mode === 'buddy' ? 'BUDDY-AID' : mode === 'silent' ? 'SILENT' : 'SELF-AID'}</Text>
      </View>

      <View style={s.body}>
        <Text style={s.question}>ARE YOU CURRENTLY{'\n'}UNDER FIRE?</Text>
        <Text style={s.subtext}>
          Your answer determines the treatment protocol.{'\n'}
          Under fire: cover first, tourniquet only.{'\n'}
          Not under fire: full MARCH assessment.
        </Text>
      </View>

      <View style={s.buttons}>
        <TouchableOpacity
          style={[s.btn, s.btnYes]}
          onPress={() => handleUnderFire(true)}
          activeOpacity={0.75}
        >
          <Text style={s.btnYesLabel}>YES — UNDER FIRE</Text>
          <Text style={s.btnSub}>Silent mode + Care Under Fire protocol</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, s.btnNo]}
          onPress={() => handleUnderFire(false)}
          activeOpacity={0.75}
        >
          <Text style={s.btnNoLabel}>NO — AREA SECURE</Text>
          <Text style={s.btnSub}>Full MARCH assessment</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.hint}>You can change this at any time during treatment</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
  },
  top: {
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepLabel: {
    color: C.muted,
    fontSize: 10,
    letterSpacing: 3,
  },
  stepBar: {
    color: C.dim,
    fontSize: 10,
    letterSpacing: 3,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  question: {
    fontSize: 32,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 24,
  },
  subtext: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttons: {
    gap: 14,
    paddingBottom: 20,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  btnYes: {
    backgroundColor: C.redBg,
    borderColor: C.red,
  },
  btnYesLabel: {
    fontSize: 20,
    fontWeight: '900',
    color: C.red,
    letterSpacing: 3,
    marginBottom: 6,
  },
  btnNo: {
    backgroundColor: C.greenBg,
    borderColor: C.green,
  },
  btnNoLabel: {
    fontSize: 20,
    fontWeight: '900',
    color: C.green,
    letterSpacing: 3,
    marginBottom: 6,
  },
  btnSub: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: 1,
  },
  hint: {
    textAlign: 'center',
    color: C.dim,
    fontSize: 10,
    letterSpacing: 1,
    paddingBottom: 16,
  },
});
