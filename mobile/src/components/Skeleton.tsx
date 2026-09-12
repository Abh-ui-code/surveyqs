/**
 * Loading placeholders. Every list/detail screen shows these instead of a
 * bare spinner while its first query is pending — a spinner says only
 * "wait", a shaped placeholder says roughly what's coming and how much of
 * it, and nothing jumps when the real content lands on top of the same
 * shape.
 *
 * One shared opacity pulse (native-driver, single Animated.Value) rather
 * than a per-row shimmer sweep — cheap enough for a low-end Android phone
 * that might also be holding a camera preview open. Respects the OS
 * reduce-motion setting.
 */
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

const SLOW_AFTER_MS = 5000;

function usePulse() {
  // A value read during render belongs in state, not a ref (react-hooks/refs) —
  // lazy-initialized so the Animated.Value itself is only ever constructed once.
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let cancelled = false;
    let anim: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      anim.start();
    });
    return () => {
      cancelled = true;
      anim?.stop();
    };
  }, [pulse]);
  // Memoized rather than called inline: the animated node is derived once
  // from the stable ref, not re-read as a side effect of rendering.
  return useMemo(() => pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), [pulse]);
}

function useSlowNotice() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);
  return slow;
}

export function SkeletonBar({ width, height = 11, radius = 5, style }: { width: number | `${number}%`; height?: number; radius?: number; style?: object }) {
  const { colors } = useTheme();
  const opacity = usePulse();
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.border, opacity }, style]}
    />
  );
}

/** A bento-tile-shaped placeholder — mirrors the Surveys home screen's
 * real tile so the swap from loading to loaded has zero layout shift. */
export function TileSkeleton({ wide }: { wide?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: wide ? undefined : 1, width: wide ? "100%" : undefined, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 10 }}>
      <SkeletonBar width="55%" height={11} />
      <SkeletonBar width="35%" height={26} radius={7} />
      <SkeletonBar width="100%" height={6} radius={99} />
      <SkeletonBar width="45%" height={10} />
    </View>
  );
}

export function SurveyListSkeleton() {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your surveys"
      accessibilityState={{ busy: true }}
      style={{ gap: 9 }}
    >
      <TileSkeleton wide />
      <View style={{ flexDirection: "row", gap: 9 }}>
        <TileSkeleton />
        <TileSkeleton />
      </View>
    </View>
  );
}

export function ListRowSkeleton() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 }}>
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBar width="60%" height={13} />
        <SkeletonBar width="38%" height={10} />
      </View>
      <SkeletonBar width={58} height={18} radius={99} />
    </View>
  );
}

export function ResponseListSkeleton({ rows = 5 }: { rows?: number }) {
  const { colors } = useTheme();
  const slow = useSlowNotice();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
    >
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
            <ListRowSkeleton />
          </View>
        ))}
      </View>
      {slow ? (
        <Animated.Text style={{ textAlign: "center", fontSize: 11.5, color: colors.textFaint, marginTop: 10 }}>
          Still loading — the connection looks slow.
        </Animated.Text>
      ) : null}
    </View>
  );
}
