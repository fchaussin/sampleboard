// SPDX-License-Identifier: GPL-3.0-or-later
// Teinte de palette → style inline (`--tint`), consommée en CSS via var(--tint, <défaut>).
// Utilitaire unique (Pad, onglets de pages…) — la palette elle-même vit dans app.css (--c-*).
import type { Color } from '../domain/enums';

export function tintStyle(color: Color | null | undefined): string {
  return color ? `--tint: var(--c-${color})` : '';
}
