# DCF Modeling Reference

Status: Current
Source: Mira-authored implementation reference

## Goal

Build a transparent DCF from a forecast model or an explicitly scoped standalone forecast, keeping valuation logic linked and auditable inside Excel.

## Core flow

Revenue / operating forecast
-> EBIT
-> NOPAT
-> D&A / Capex / Change in NWC
-> UFCF
-> WACC
-> explicit-period discounting
-> terminal value
-> enterprise value
-> net debt / other adjustments
-> equity value
-> implied value per share

## Rules

- Derived values remain formulas, not Python-computed pasted outputs.
- WACC assumptions and capital structure inputs are visible.
- Terminal value method and assumptions are explicit.
- EV-to-Equity bridge is visible and traceable.
- Sensitivity tables should vary the meaningful valuation drivers (typically WACC and terminal growth / exit multiple).
- External market/company data includes source names and URLs.

## Completion

The DCF is complete only when forecast links, UFCF bridge, discounting, terminal value, EV-to-Equity bridge and requested sensitivities are present and internally consistent.
