# Explicit Operation Chains

**Status:** Accepted

Configured Operations use Original-Field Inputs by default. An Operation Chain exists only when a user explicitly chooses an earlier Generated Field as an Input Reference; matching field names never create a dependency implicitly. This preserves a simple default while supporting deliberate multi-step enrichment.

## Considered Options

- **Original fields only:** simple but prevents legitimate multi-step enrichment.
- **Implicit chaining:** convenient in narrow cases but ambiguous, fragile after renames, and hard to explain.
- **Explicit chaining:** adds a deliberate selection step while keeping dependencies visible and validatable.
