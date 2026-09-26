/**
 * The widget registry — a map from question type to component, per
 * docs/components/MOBILE.md: "adding a question type is one file plus one
 * registry entry, never a change to the [form] screen." Each widget owns
 * rendering + serialising its own value; FormSectionScreen only owns
 * relevance, required/constraint validation and section navigation.
 *
 * Deliberately not every type in docs/architecture/FORM_SCHEMA.md is built
 * yet (matrix, ranking, repeat, signature, barcode, audio/video and a few
 * others fall through to UnsupportedWidget) — the registry shape is what
 * matters for a first build; each remaining type is exactly one more file.
 */
import { useState, type ReactElement } from "react";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Pressable, Text, View } from "react-native";
import type { AnswerValue, ChoiceList, Question } from "@surveyqs/shared";

import { Btn, Input } from "@/components/primitives";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemeColors } from "@/theme/tokens";
import { newUuid } from "@/lib/uuid";
import type { PendingAttachment } from "@surveyqs/shared";

export interface WidgetProps {
  question: Question;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  choiceLists: ChoiceList[];
  /** Image/signature widgets append here — FormSectionScreen threads it
   * back into the draft's attachment list for the outbox to upload. */
  onAttachment: (att: PendingAttachment) => void;
}

// Smaller than the primitive's own default (which is sized for a
// standalone form like Login) -- a survey question's input sits inside an
// already-padded question card, so it doesn't need the extra room.
const COMPACT_INPUT_STYLE = { paddingVertical: 9, fontSize: 14 };

function TextWidget({ question, value, onChange, multiline }: WidgetProps & { multiline?: boolean }) {
  return (
    <Input
      value={typeof value === "string" ? value : ""}
      onChangeText={(v) => onChange(v)}
      multiline={multiline}
      numberOfLines={multiline ? 4 : undefined}
      keyboardType={question.type === "email" ? "email-address" : question.type === "phone" ? "phone-pad" : "default"}
      autoCapitalize={question.type === "email" ? "none" : "sentences"}
      style={COMPACT_INPUT_STYLE}
    />
  );
}

function NumberWidget({ value, onChange }: WidgetProps) {
  return (
    <Input
      value={value == null ? "" : String(value)}
      onChangeText={(v) => onChange(v === "" ? null : Number(v.replace(/[^0-9.-]/g, "")))}
      keyboardType="numeric"
      style={COMPACT_INPUT_STYLE}
    />
  );
}

/** Compact selectable chips, not full action buttons — matched to the
 * same chip idiom the gender/choice pickers use (bordered pill, tinted
 * fill when selected) rather than reusing <Btn>, whose tall vertical
 * padding is sized for a full-width action and reads oddly for a short
 * two-word answer. */
function YesNoWidget({ value, onChange }: WidgetProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {[
        { v: true, label: "Yes" },
        { v: false, label: "No" },
      ].map((opt) => {
        const selected = value === opt.v;
        return (
          <Pressable
            key={String(opt.v)}
            onPress={() => onChange(opt.v)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              minWidth: 84,
              alignItems: "center",
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: selected ? colors.accent : colors.border,
              backgroundColor: selected ? colors.accentSoft : colors.surface,
              paddingVertical: 11,
              paddingHorizontal: 20,
            }}
          >
            <Text style={{ color: selected ? colors.accentStrong : colors.text, fontWeight: "700", fontSize: 14 }}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Radio dot for select_one — outer ring always visible, inner dot drawn
 * only when selected so the unselected state doesn't read as a filled disc. */
function RadioIndicator({ selected, colors }: { selected: boolean; colors: ThemeColors }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: selected ? colors.accent : colors.textFaint,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />}
    </View>
  );
}

/** Checkbox for select_multiple — filled square + tick, matched to the
 * ✓ glyph already used for "captured"/"synced" states elsewhere in this
 * file rather than pulling in an icon font just for this. */
function CheckboxIndicator({ selected, colors }: { selected: boolean; colors: ThemeColors }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: selected ? colors.accent : colors.textFaint,
        backgroundColor: selected ? colors.accent : colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {selected && <Text style={{ color: colors.accentInk, fontSize: 12, fontWeight: "900", lineHeight: 13 }}>✓</Text>}
    </View>
  );
}

/** select_one / select_multiple render as a vertical list of full-width
 * rows with a real radio button or checkbox — the client asked for this
 * to look like a standard paper/professional survey instead of the
 * wrapped pill-chip picker, which read as tap-targets rather than
 * single- vs. multi-answer questions. */
function ChoiceGroup({ value, onChange, choiceLists, question, multi }: WidgetProps & { multi?: boolean }) {
  const { colors } = useTheme();
  const listName = question.config?.choice_list as string | undefined;
  const list = choiceLists.find((l) => l.name === listName);
  const selected: string[] = multi ? (Array.isArray(value) ? (value as string[]) : []) : value != null ? [String(value)] : [];

  function toggle(choiceValue: string) {
    if (!multi) {
      onChange(choiceValue);
      return;
    }
    const next = selected.includes(choiceValue) ? selected.filter((v) => v !== choiceValue) : [...selected, choiceValue];
    onChange(next);
  }

  if (!list) {
    return <Text style={{ color: colors.rust, fontSize: 12 }}>Choice list "{listName}" is missing from this package.</Text>;
  }

  const choices = list.choices.filter((c) => c.active !== false).sort((a, b) => a.order - b.order);

  return (
    // No per-option box or divider -- just a plain, tightly-stacked list
    // of rows, per the client's ask to cut the wasted vertical space a
    // full box (and even a hairline) per choice was costing.
    <View accessibilityRole={multi ? undefined : "radiogroup"}>
      {choices.map((c) => {
        const isSelected = selected.includes(c.value);
        return (
          <Pressable
            key={c.value}
            onPress={() => toggle(c.value)}
            accessibilityRole={multi ? "checkbox" : "radio"}
            accessibilityState={multi ? { checked: isSelected } : { selected: isSelected }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              paddingVertical: 9,
            }}
          >
            {multi ? <CheckboxIndicator selected={isSelected} colors={colors} /> : <RadioIndicator selected={isSelected} colors={colors} />}
            <Text style={{ flex: 1, color: isSelected ? colors.accent : colors.text, fontWeight: isSelected ? "600" : "400", fontSize: 13.5 }}>
              {c.label.en ?? Object.values(c.label)[0]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DateWidget({ value, onChange }: WidgetProps) {
  // A plain masked text field rather than a native date picker dependency —
  // keeps the build lean for v1. Stored as YYYY-MM-DD per FORM_SCHEMA.md.
  return <Input value={typeof value === "string" ? value : ""} onChangeText={onChange} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />;
}

function GeopointWidget({ value, onChange, question }: WidgetProps) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const point = value as { lat: number; lng: number; accuracy_m: number } | null;
  const threshold = (question.config?.required_accuracy_m as number | undefined) ?? 50;

  async function capture() {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onChange({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? 999,
        captured_at: new Date(pos.timestamp).toISOString(),
      });
    } finally {
      setBusy(false);
    }
  }

  const good = point ? point.accuracy_m <= threshold : false;
  return (
    <View style={{ gap: 8 }}>
      {point && (
        <Text style={{ color: good ? colors.moss : colors.amber, fontSize: 12.5 }}>
          {good ? "✓" : "±"} accuracy {Math.round(point.accuracy_m)}m
        </Text>
      )}
      <Btn title={point ? "Recapture location" : "Capture location"} variant="secondary" loading={busy} onPress={capture} />
    </View>
  );
}

function ImageWidget({ value, onChange, question, onAttachment }: WidgetProps) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const attached = Array.isArray(value) && value.length > 0;

  async function capture() {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") return;
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      // A real UUID, not a timestamp string — this doubles as the
      // client_ref_id sent to /sync/attachments/, a UUIDField server-side.
      const ref = newUuid();
      const filename = asset.fileName ?? `${question.code}.jpg`;
      onAttachment({
        ref,
        question_code: question.code,
        kind: "image",
        filename,
        size_bytes: asset.fileSize ?? 0,
        checksum: "",
        captured_at: new Date().toISOString(),
        local_uri: asset.uri,
      });
      onChange([{ attachment_ref: ref, filename }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {attached && (
        <View style={{ width: 40, height: 40, borderRadius: 9, backgroundColor: colors.mossSoft, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.moss }}>✓</Text>
        </View>
      )}
      <Btn title={attached ? "Retake photo" : "Take photo"} variant="secondary" fullWidth={!attached} loading={busy} onPress={capture} />
    </View>
  );
}

function NoteWidget() {
  return null; // renders label/hint only, from FormSectionScreen's question header — stores nothing.
}

function UnsupportedWidget({ question }: WidgetProps) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.textFaint, fontSize: 12, fontStyle: "italic" }}>
      "{question.type}" isn't supported in this build yet — recorded as free text below.
    </Text>
  );
}

type WidgetComponent = (props: WidgetProps) => ReactElement | null;

export const WIDGETS: Record<string, WidgetComponent> = {
  text: (p) => <TextWidget {...p} />,
  long_text: (p) => <TextWidget {...p} multiline />,
  email: (p) => <TextWidget {...p} />,
  phone: (p) => <TextWidget {...p} />,
  url: (p) => <TextWidget {...p} />,
  integer: (p) => <NumberWidget {...p} />,
  decimal: (p) => <NumberWidget {...p} />,
  percentage: (p) => <NumberWidget {...p} />,
  range: (p) => <NumberWidget {...p} />,
  yes_no: (p) => <YesNoWidget {...p} />,
  select_one: (p) => <ChoiceGroup {...p} />,
  select_multiple: (p) => <ChoiceGroup {...p} multi />,
  date: (p) => <DateWidget {...p} />,
  geopoint: (p) => <GeopointWidget {...p} />,
  image: (p) => <ImageWidget {...p} />,
  note: () => <NoteWidget />,
};

export function widgetFor(type: string): WidgetComponent {
  return WIDGETS[type] ?? ((p: WidgetProps) => (
    <View style={{ gap: 8 }}>
      <UnsupportedWidget {...p} />
      <TextWidget {...p} />
    </View>
  ));
}
