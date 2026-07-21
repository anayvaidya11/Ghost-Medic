/**
 * PERSISTENT SESSION HEADER
 * Shows: mode badge | elapsed timer | ABORT button
 * Present on every screen during an active session.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { C } from '@/theme/index';
import { useSessionStore } from '@/store/sessionStore';

const MODE_LABEL: Record<string, string> = {
  self: 'SELF',
  teammate: 'TEAMMATE',
  stealth: 'STEALTH',
};

const MODE_COLOR: Record<string, string> = {
  self: C.green,
  teammate: C.blue,
  stealth: C.red,
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function SessionHeader() {
  const mode = useSessionStore((s) => s.mode);
  const sessionStartTime = useSessionStore((s) => s.sessionStartTime);
  const resetSession = useSessionStore((s) => s.resetSession);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sessionStartTime) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStartTime]);

  const modeColor = MODE_COLOR[mode] ?? C.green;

  const handleAbort = () => {
    resetSession();
    router.replace('/');
  };

  return (
    <View style={s.bar}>
      {/* Mode badge */}
      <View style={[s.modeBadge, { borderColor: modeColor }]}>
        <View style={[s.dot, { backgroundColor: modeColor }]} />
        <Text style={[s.modeText, { color: modeColor }]}>{MODE_LABEL[mode] ?? 'SELF'}</Text>
      </View>

      {/* Elapsed timer */}
      {sessionStartTime ? (
        <Text style={s.timer}>{formatElapsed(elapsed)}</Text>
      ) : (
        <Text style={s.timer}>--:--</Text>
      )}

      {/* ABORT button */}
      <TouchableOpacity
        style={s.abortBtn}
        onPress={handleAbort}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={s.abortText}>✕ ABORT</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderColor: C.border,
    minHeight: 44,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  timer: {
    color: C.muted,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  abortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.redBg,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 4,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abortText: {
    color: C.red,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
