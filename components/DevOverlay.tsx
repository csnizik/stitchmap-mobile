/**
 * Development harness for the rendering work in #44.
 *
 * Swaps the workspace between the committed sample and generated charts at
 * realistic sizes, and shows a live frame rate. Compiled out of release builds
 * by the `__DEV__` guard in the workspace screen.
 *
 * Generated patterns are held in memory and never written to a repository.
 * Persisting a 1.1 MB chart on every size change would be slow, would fill
 * local storage with throwaway data, and would mean measuring storage rather
 * than rendering. The tradeoff is that progress marked on a generated chart is
 * lost on switch, which is correct for a measurement harness.
 */

import { Pressable, Text, View } from 'react-native';

import { useFrameRate } from './useFrameRate';

export type PatternSizeKey = 'sample' | 'typical' | 'large';

const OPTIONS: readonly { key: PatternSizeKey; label: string }[] = [
  { key: 'sample', label: '8x8' },
  { key: 'typical', label: '100x100' },
  { key: 'large', label: '200x200' },
];

export interface DevOverlayProps {
  readonly selected: PatternSizeKey;
  readonly onSelect: (key: PatternSizeKey) => void;
  /** Runs and placements in the chart currently rendered. */
  readonly stats?: { readonly placements: number; readonly runs: number };
}

export default function DevOverlay({ selected, onSelect, stats }: DevOverlayProps) {
  const { fps, worst } = useFrameRate();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 48,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {OPTIONS.map((option) => (
        <Pressable
          key={option.key}
          onPress={() => {
            onSelect(option.key);
          }}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 6,
            backgroundColor: option.key === selected ? '#1b2a4a' : 'rgba(255,255,255,0.85)',
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: option.key === selected ? '#ffffff' : '#1b2a4a',
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}

      <View
        style={{
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 6,
          backgroundColor: 'rgba(255,255,255,0.85)',
        }}
      >
        {/*
          A high reading on an idle app means nothing, since nothing is
          scheduling frames. The worst figure is the one that matters, and it
          only becomes meaningful during a pan or zoom.
        */}
        <Text style={{ fontSize: 12, color: '#1b2a4a' }}>
          {fps} fps (worst {Number.isFinite(worst) ? worst : '-'})
        </Text>
        {stats !== undefined && (
          <Text style={{ fontSize: 10, color: '#5a6478' }}>
            {stats.placements} stitches, {stats.runs} runs
          </Text>
        )}
      </View>
    </View>
  );
}
