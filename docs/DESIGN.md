# Rootfund design system (final)

Tagline: **Small contributions. Collective impact.**

## Colours (the only brand colours)
| Name | Hex | Use |
|---|---|---|
| Deep Burgundy | #37162B | dark background, text on light |
| Emerald Green | #006853 | major brand sections |
| Vibrant Orange | #F56504 | high-impact accents |
| Golden Yellow | #F2D000 | primary buttons, key highlights |
| Lavender | #A291E1 | secondary accents |
| Soft Blush | #F4EEEE | light background, text on dark |

Approved derived tones (readable text versions on Blush): Orange-ink #B84A00, Lavender-ink #6B5BB0, Emerald-ink #004D3E. The single error colour #B3261E is used only for failure states.

## Safe text pairings (WCAG contrast)
OK for any text: Blush on Burgundy 13.96, Yellow on Burgundy 10.52, Lavender on Burgundy 5.85, Orange on Burgundy 5.14, Blush on Emerald 5.90, Burgundy on Blush 13.96, Burgundy on Yellow 10.52, Burgundy on Lavender 5.85, Burgundy on Orange 5.14.
Large text and UI only: Yellow on Emerald 4.44.
Never as text: Orange, Lavender or Yellow on Blush; Blush on Orange; Emerald on Burgundy.

## Type
Poiret One (single weight, thin): hero and large section titles only, never small text, buttons, tables or money. Montserrat (variable): everything else, including the whole admin area. Money uses tabular numerals. Both fonts are self-hosted from npm (`@fontsource/poiret-one`, `@fontsource-variable/montserrat`).

## Logo (files in `client/src/assets/logo`, never edit them)
- On Burgundy: `rootfund-symbol-primary.svg`
- On Blush: `rootfund-symbol-burgundy.svg`
- On Emerald: `rootfund-symbol-ivory.svg` (do NOT use the full-colour or `on-emerald` file: the emerald base node disappears)
- Favicon and app icon: `rootfund-favicon.svg`, `rootfund-app-icon.svg`
- The artwork has no wordmark. The word "Rootfund" is live text beside the symbol.

## Rules
No other colours, no gradients, no glass, no decorative shadows, no icon library. Status is always text + shape + colour. Money always shows cents. "Supporters" means unique people; "gifts" means person-and-project donations. Estimated matches are always labelled estimated.
