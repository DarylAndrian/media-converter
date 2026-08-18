export const EDITOR_TOOLS = [
  { id: "pixelate", label: "Pixelate" },
  { id: "shape", label: "Shape" },
  { id: "text", label: "Text" },
  { id: "brush", label: "Brush" },
] as const;

export type EditorToolId = (typeof EDITOR_TOOLS)[number]["id"];

export const EDITOR_COLORS = [
  { id: "white", hex: "#ffffff", border: true },
  { id: "black", hex: "#0f172a", border: false },
  { id: "red", hex: "#ef4444", border: false },
  { id: "yellow", hex: "#eab308", border: false },
  { id: "green", hex: "#22c55e", border: false },
  { id: "blue", hex: "#3b82f6", border: false },
  { id: "indigo", hex: "#6366f1", border: false },
] as const;

export type EditorColorId = (typeof EDITOR_COLORS)[number]["id"];

export function editorColorHex(id: EditorColorId): string {
  return EDITOR_COLORS.find((color) => color.id === id)?.hex ?? "#6366f1";
}

export const PIXELATE_MODES = [
  { id: "mosaic", label: "Mosaic" },
  { id: "blur", label: "Blur" },
] as const;

export type PixelateModeId = (typeof PIXELATE_MODES)[number]["id"];

export const SHAPE_KINDS = [
  { id: "rect", label: "Rect" },
  { id: "ellipse", label: "Ellipse" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
] as const;

export type ShapeKindId = (typeof SHAPE_KINDS)[number]["id"];

export const SHAPE_FILLS = [
  { id: "highlight", label: "Highlight" },
  { id: "outline", label: "Outline" },
] as const;

export type ShapeFillId = (typeof SHAPE_FILLS)[number]["id"];

export const TEXT_STYLES = [
  { id: "regular", label: "Regular" },
  { id: "highlight", label: "Highlight" },
  { id: "block", label: "Block" },
] as const;

export type TextStyleId = (typeof TEXT_STYLES)[number]["id"];

export const BRUSH_KINDS = [
  { id: "pen", label: "Pen" },
  { id: "highlighter", label: "Highlighter" },
] as const;

export type BrushKindId = (typeof BRUSH_KINDS)[number]["id"];
