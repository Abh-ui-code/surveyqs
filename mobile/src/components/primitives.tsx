/**
 * Shared component primitives — every screen builds from these instead of
 * hand-rolling styled Views. Pattern borrowed from a sibling field app's
 * mobile primitives.tsx (production-proven: theme-aware, no heavy UI-kit
 * dependency), rebuilt against this app's own token set and
 * question/status vocabulary rather than copied.
 */
import {
  createContext,
  forwardRef,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

type Variant = "primary" | "success" | "secondary" | "danger" | "ghost";

interface BtnProps extends PressableProps {
  title: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Sizing/colors matched directly to the reference app's buttons: blue for
 * every normal primary action (Sign in, Start, Next), green reserved for
 * a final Submit-type confirm, ~50px tall, 12px radius, 16px bold label.
 */
export function Btn({ title, variant = "primary", loading, disabled, fullWidth = true, style, onPressIn, onPressOut, ...props }: BtnProps) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  // Every variant gets a visible fill — "ghost" used to mean literally
  // transparent, which on a dark background reads as no button at all
  // (just floating text). A neutral tinted fill keeps it the same
  // shape/size as every other variant, just lower-emphasis.
  const bg: Record<Variant, string> = {
    primary: colors.accent,
    success: colors.success,
    secondary: colors.surface,
    danger: colors.rustSoft,
    ghost: colors.surfaceRaised,
  };
  const border: Record<Variant, string | undefined> = {
    primary: undefined,
    success: undefined,
    secondary: colors.border,
    danger: colors.rust,
    ghost: colors.border,
  };
  const textColor: Record<Variant, string> = {
    primary: colors.accentInk,
    success: colors.successInk,
    secondary: colors.text,
    danger: colors.rust,
    ghost: colors.text,
  };
  return (
    <Pressable
      disabled={loading || disabled}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      // A plain style object/array, not the `(state) => style` callback
      // form — under NativeWind's cssInterop wrapping, the function form
      // never gets invoked, so the button silently renders with none of
      // this styling. Pressed feedback comes from plain state instead.
      style={[
        {
          backgroundColor: bg[variant],
          borderWidth: border[variant] ? 1 : 0,
          borderColor: border[variant],
          borderRadius: 12,
          paddingVertical: 15,
          alignItems: "center",
          justifyContent: "center",
          width: fullWidth ? "100%" : undefined,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style as object,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} />
      ) : (
        <Text style={{ color: textColor[variant], fontWeight: "700", fontSize: 16 }}>{title}</Text>
      )}
    </Pressable>
  );
}

// ─── FormScroll — inputs scroll themselves above the keyboard on focus ──────
const FormScrollContext = createContext<{ scrollRef: RefObject<ScrollView | null> | null }>({ scrollRef: null });

export function FormScroll({
  children,
  bottomBar,
  contentContainerStyle,
  ...rest
}: Omit<ScrollViewProps, "ref"> & { children: ReactNode; bottomBar?: ReactNode }) {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <FormScrollContext.Provider value={{ scrollRef }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ padding: 16, paddingBottom: 120 }, contentContainerStyle]}
          {...rest}
        >
          {children}
        </ScrollView>
        {bottomBar && <View style={{ paddingBottom: insets.bottom, paddingHorizontal: 16 }}>{bottomBar}</View>}
      </KeyboardAvoidingView>
    </FormScrollContext.Provider>
  );
}

export const Input = forwardRef<TextInput, TextInputProps & { error?: boolean }>(function Input(
  { style: extra, onFocus, error, ...props },
  ref,
) {
  const { colors } = useTheme();
  const innerRef = useRef<TextInput | null>(null);
  const { scrollRef } = useContext(FormScrollContext);

  function setRefs(node: TextInput | null) {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as RefObject<TextInput | null>).current = node;
  }

  function handleFocus(e: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) {
    onFocus?.(e);
    const sv = scrollRef?.current;
    const target = innerRef.current;
    if (!sv || !target) return;
    const delay = Platform.OS === "ios" ? 50 : 300;
    setTimeout(() => {
      // `.measure()` in page coordinates on both refs, rather than
      // `target.measureLayout(findNodeHandle(sv), ...)` — under the New
      // Architecture, `measureLayout` throws "must be called with a ref
      // to a native component" when the scroll view's handle isn't
      // exactly the kind of native node it expects. Two plain `.measure()`
      // calls avoid that entirely and work the same on old and new arch.
      // ScrollView's own ref type omits NativeMethods, though it forwards
      // to one at runtime — a narrow, well-understood cast rather than a
      // measureLayout call that breaks under the New Architecture.
      const measurable = sv as unknown as { measure: (cb: (x: number, y: number, w: number, h: number, pageX: number, pageY: number) => void) => void };
      target.measure((_x, _y, _w, _h, _pageX, pageY) => {
        measurable.measure((_svX, _svY, _svW, _svH, _svPageX, svPageY) => {
          const relativeY = pageY - svPageY;
          sv.scrollTo({ y: Math.max(0, relativeY - 80), animated: true });
        });
      });
    }, delay);
  }

  return (
    <TextInput
      ref={setRefs}
      onFocus={handleFocus}
      placeholderTextColor={colors.textFaint}
      cursorColor={colors.accent}
      selectionColor={colors.accent}
      style={[
        {
          borderWidth: error ? 1.5 : 1,
          borderColor: error ? colors.rust : colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          backgroundColor: colors.surfaceRaised,
          color: colors.text,
          fontSize: 16,
        },
        extra,
      ]}
      {...props}
    />
  );
});

export function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 14,
          shadowColor: "#000",
          shadowOpacity: 0.03,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        },
        style,
      ]}
      {...props}
    />
  );
}

/** Press-scale feedback — a card or tile visibly compresses under a
 * finger instead of only changing color, the same tactile cue a sibling
 * field app's home screen uses on every tappable tile. */
export function usePressScale(min = 0.96) {
  const [scale] = useState(() => new Animated.Value(1));
  return {
    scale,
    onPressIn: () => Animated.spring(scale, { toValue: min, useNativeDriver: true }).start(),
    onPressOut: () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start(),
  };
}

/** A colored-tint square housing one big emoji glyph — the category icon
 * used on the Surveys tab's assignment tiles. */
export function IconTile({ emoji, tint, size = 44 }: { emoji: string; tint: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

/** A flat, centered stat box — big colored number, plain label below.
 * Matched to the reference app's "5 Assigned / 2 In Progress / 8
 * Completed" dashboard boxes: white, thin border, no left accent bar. */
export function StatCard({
  value,
  label,
  numberColor,
  onPress,
}: {
  value: string | number;
  label: string;
  numberColor: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const press = usePressScale(0.95);
  const tappable = Boolean(onPress);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={tappable ? press.onPressIn : undefined}
      onPressOut={tappable ? press.onPressOut : undefined}
      accessibilityRole={tappable ? "button" : "text"}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          transform: [{ scale: press.scale }],
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "800", color: numberColor }}>{value}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "500", color: colors.textMuted, marginTop: 2 }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 6 }}>
      {children}
      {required && <Text style={{ color: colors.rust }}> *</Text>}
    </Text>
  );
}

export function FieldError({ message }: { message?: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View style={{ flexDirection: "row", gap: 5, marginTop: 6 }}>
      <Text style={{ color: colors.rust, fontSize: 12 }}>⚠</Text>
      <Text style={{ color: colors.rust, fontSize: 12, flex: 1, lineHeight: 17 }}>{message}</Text>
    </View>
  );
}

export type ChipStatus = "ok" | "warn" | "bad" | "neutral";

export function StatusChip({ status, label }: { status: ChipStatus; label: string }) {
  const { colors } = useTheme();
  const map: Record<ChipStatus, { bg: string; text: string }> = {
    ok: { bg: colors.mossSoft, text: colors.moss },
    warn: { bg: colors.amberSoft, text: colors.amber },
    bad: { bg: colors.rustSoft, text: colors.rust },
    neutral: { bg: colors.surfaceRaised, text: colors.textMuted },
  };
  const c = map[status];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, tone = "accent" }: { value: number; tone?: "accent" | "amber" }) {
  const { colors } = useTheme();
  const fill = tone === "amber" ? colors.amber : colors.accent;
  return (
    <View style={{ height: 6, borderRadius: 999, backgroundColor: colors.surfaceRaised, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", backgroundColor: fill, borderRadius: 999 }} />
    </View>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        backgroundColor: value ? colors.accent : colors.surfaceRaised,
        borderWidth: value ? 0 : 1,
        borderColor: colors.border,
        justifyContent: "center",
        padding: 2,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          backgroundColor: value ? colors.accentInk : colors.textFaint,
          alignSelf: value ? "flex-end" : "flex-start",
        }}
      />
    </Pressable>
  );
}

export function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 64, alignItems: "center", paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 34, marginBottom: 10 }}>{emoji}</Text>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 4, textAlign: "center", lineHeight: 18 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint, marginBottom: 8, marginTop: 4 }}>
      {children}
    </Text>
  );
}
