// ── Softball field SVG constants ──────────────────────────────────────────────
// viewBox 280×260  home plate at (140, 250)
export const FIELD_W = 280, FIELD_H = 260
export const FIELD_HOME = [140, 250]
export const FIELD_FIRST  = [210, 180]
export const FIELD_SECOND = [140, 151]
export const FIELD_THIRD  = [70,  180]
export const FIELD_LF = [9,   119]   // left foul line end  (r≈185 at 45° from home)
export const FIELD_RF = [271, 119]   // right foul line end

export const HIT_COLORS = {
  '1B': '#22c55e', '2B': '#16a34a', '3B': '#15803d', 'HR': '#14532d',
  'F': '#ef4444', 'G': '#dc2626', 'SAC': '#f97316',
  'E': '#f59e0b', 'FC': '#f59e0b',
}
