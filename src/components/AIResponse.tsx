import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { C } from '@/theme/index';

const SECTION_DEFS = [
  { key: 'ASSESSMENT', color: C.yellow },
  { key: 'PRIORITY THREATS', color: C.red },
  { key: 'IMMEDIATE ACTIONS', color: C.green },
  { key: 'MONITOR FOR', color: C.muted },
  { key: 'REASSESS', color: C.green },
] as const;

type SectionDef = { key: string; color: string };
type Section = SectionDef & { lines: string[]; bold: boolean };

function parseSections(text: string): Section[] {
  const out: Section[] = [];
  let current: Section | null = null;
  for (const raw of text.split('\n')) {
    const def = SECTION_DEFS.find((d) => raw.trim().toUpperCase().startsWith(d.key));
    if (def) {
      if (current) out.push(current);
      current = { ...def, bold: def.key === 'REASSESS', lines: [raw] };
    } else if (current) {
      current.lines.push(raw);
    } else {
      current = { key: '', color: C.muted, bold: false, lines: [raw] };
    }
  }
  if (current) out.push(current);
  return out;
}

type Props = {
  response: string;
  isThinking: boolean;
  streamingResponse: string;
};

export function AIResponse({ response, isThinking, streamingResponse }: Props) {
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isThinking && !streamingResponse) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(blink, { toValue: 0.2, duration: 500, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [isThinking, streamingResponse, blink]);

  if (isThinking && !streamingResponse) {
    return (
      <View style={st.card}>
        <Animated.Text style={[st.processing, { opacity: blink }]}>
          GHOST MEDIC PROCESSING...
        </Animated.Text>
      </View>
    );
  }

  if (response) {
    const sections = parseSections(response);
    return (
      <View style={st.card}>
        <Text style={st.header}>// GHOST MEDIC</Text>
        {sections.map((sec, i) => (
          <View key={i} style={st.section}>
            {sec.lines.map((line, j) => (
              <Text
                key={j}
                style={[st.line, { color: sec.color }, (sec.bold || j === 0) && st.bold]}
              >
                {line}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (streamingResponse) {
    return (
      <View style={st.card}>
        <Text style={st.header}>// GHOST MEDIC</Text>
        <Text style={st.stream}>{streamingResponse}</Text>
      </View>
    );
  }

  return null;
}

const st = StyleSheet.create({
  card: {
    margin: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  header: {
    color: C.green,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  processing: {
    color: C.green,
    fontSize: 15,
    letterSpacing: 3,
    fontWeight: 'bold',
  },
  stream: { color: C.muted, fontSize: 15, lineHeight: 22 },
  section: { marginBottom: 8 },
  line: { fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: 'bold' },
});
