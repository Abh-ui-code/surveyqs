/** The MVP question-type catalogue -- see docs/product/QUESTION_TYPES.md.
 * One entry here, one registry entry in the mobile/web renderers later;
 * nothing about the builder needs to change to add a type. */
export const QUESTION_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "integer", label: "Number" },
  { value: "decimal", label: "Decimal" },
  { value: "select_one", label: "Single choice" },
  { value: "select_multiple", label: "Multiple choice" },
  { value: "yes_no", label: "Yes / No" },
  { value: "rating", label: "Rating" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & time" },
  { value: "geopoint", label: "Location" },
  { value: "image", label: "Photo" },
  { value: "note", label: "Note (display only)" },
];

export function typeLabel(value: string): string {
  return QUESTION_TYPES.find((t) => t.value === value)?.label ?? value;
}
