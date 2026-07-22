# Three-Statement Model Reference

Status: Current
Source: Mira-authored implementation reference

## Goal

Build an auditable, formula-linked Income Statement / Balance Sheet / Cash Flow model that preserves historical truth, exposes assumptions, and reconciles every forecast period.

## Required structure

- Raw/historical source data stays separate from forecast logic.
- Historical mappings reconcile to reported totals before forecast opening balances are used.
- Forecast revenue, margins, working capital, debt, taxes, capex, depreciation and retained earnings remain formula-linked.
- Cash Flow ending cash reconciles to Balance Sheet cash for every modeled period.
- Retained earnings roll-forward reconciles.
- A visible Balance Check must equal zero (or an explicitly documented immaterial tolerance).

## Hardcoding rule

Hardcode only true historical/raw values, user-provided inputs and explicit assumptions. Derived, projected, allocated and rolled-forward values remain Excel formulas.

## Completion

The model is not complete until historical mapping checks, balance checks, cash reconciliation and retained-earnings reconciliation pass without unresolved blocking differences.
