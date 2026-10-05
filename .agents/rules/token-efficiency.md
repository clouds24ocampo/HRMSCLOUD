# ⚡ Token Efficiency Protocol: Minimal Token, Maximum Result

This protocol activates token optimization across all agent turns, tools, and subagents:

## 1. Zero Conversational Fluff
- Respond with high signal-to-noise ratio.
- Strip conversational padding, pleasantries, and redundant preambles.
- Keep technical definitions, code symbols, exact paths, and compiler/test diagnostics 100% precise.

## 2. Lean Context Ingestion
- **Targeted Slices**: Never view entire multi-thousand-line files when inspecting a function. Use `grep_search` to pinpoint line numbers, then `view_file` with precise `StartLine` and `EndLine` ranges.
- **Progressive Discovery**: Load only what is needed for the immediate step. Do not dump entire directories or logs into context.

## 3. Surgical Implementation & Patching
- **Lean Build**: Build the smallest correct solution that meets acceptance criteria before optimizing.
- **Surgical Patching**: Modify only the exact lines required via `replace_file_content` or `multi_replace_file_content`. Avoid whole-file replacements.
- **No Speculative Code**: Never add hypothetical abstractions, unused utilities, or unsolicited rewrites.

## 4. Investigate First, Verify & Stop
- **Investigate First**: Collect evidence and understand code flow before touching any file.
- **Verify & Stop**: Once typecheck, tests, and acceptance criteria pass, immediately stop tool calls and summarize concisely. Do not wander into unrequested refactorings.
