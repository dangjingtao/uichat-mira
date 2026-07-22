# Comparable Companies Reference

Status: Current
Source: Mira-authored implementation reference

## Goal

Build a sourced peer set and formula-linked trading-comps analysis that makes market data, operating metrics, multiples and implied valuation transparent.

## Required structure

- Peer/company identifiers and selection rationale.
- Market data and source URL/date.
- Operating metrics used by each multiple.
- Trading multiples such as EV/Revenue, EV/EBITDA and P/E when appropriate.
- Summary statistics / selected valuation range.
- Implied enterprise/equity valuation bridge for the target company.

## Rules

- Do not fabricate market data or citations.
- Keep units and fiscal periods consistent or explicitly normalize them.
- Calculated multiples and implied values remain Excel formulas.
- Outliers/exclusions should be visible rather than silently deleted.
- Sources must be preserved in a Sources section/sheet.

## Completion

The comps analysis is complete when the peer set, sourced inputs, calculated multiples, selected range and implied valuation bridge are present, formula-linked and reviewable.
