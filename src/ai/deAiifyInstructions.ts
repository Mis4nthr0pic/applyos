/** De-AI-ify rules applied to every batch-generated application answer. Editable in Settings → AI prompts. */
export const DE_AIIFY_INSTRUCTIONS = `# De-AI-ify (mandatory for every answer)

Remove AI-generated patterns and restore natural human voice. Job form answers should sound like a competent person typing in a text box — not a cover letter, LinkedIn post, or chatbot.

## What to remove

### Overused transitions
- "Moreover," "Furthermore," "Additionally," "Nevertheless"
- Excessive "However"
- Formulaic "While X, Y" openings
- Em dashes and en dashes (use periods, commas, or colons instead)

### AI clichés
- "In today's fast-paced world", "Let's dive in", "unlock your potential", "harness the power of"
- "aligns perfectly with", "strong background in", "proven track record", "results-driven"
- "seasoned professional", "eager to contribute", "excited to", "thrilled to", "passionate about"
- "leverage/leveraging" (use "use"), "utilize" (use "use"), "facilitate" (use "help"), "optimize" (use "improve")

### Hedging and filler
- "It's important to note", "It's worth mentioning"
- Vague quantifiers: "various", "numerous", "myriad", "extensive", "comprehensive", "robust"
- "demonstrated in my roles at" → say what you did at Company X directly

### Robotic patterns
- Rhetorical questions followed by immediate answers
- Forced parallel triplets ("A, B, and C" when one or two points suffice)
- Announcing emphasis ("I am confident that…", "What sets me apart is…")
- Generic closers ("I look forward to…", "I am eager to contribute to [Company]'s mission")

## What to use instead

- Varied sentence length; mix short and medium sentences
- Direct statements: "At Zokyo I did X" beats "I have a strong background in X"
- Concrete facts from the CV only — no inflation
- First person, plain register; contractions OK when natural ("I've", "I'm")
- Stop when the question is answered; no summary paragraph at the end

## Job-application tone (ApplyOS)

1. **Form box, not essay.** Most answers: 2–4 sentences. One paragraph unless the question clearly needs more.
2. **No cover-letter voice.** Ban openings like "I am a seasoned professional with over X years…" and endings like "I am eager to contribute…"
3. **Name real employers and work.** Prefer "At OpenSense I built…" over abstract skill lists.
4. **Motivation questions.** Say what you actually want (from job search context + CV), not generic enthusiasm for the company.
5. **About-you questions.** Pick 2–3 specific facts; do not list every skill area you have ever touched.

## Mandatory process (internal, per answer)

1. Draft from CV facts only.
2. Audit: list what still sounds AI-generated (buzzwords, parallel triplets, cover-letter tone).
3. De-AI-ify: rewrite until it reads like a human typed it in 60 seconds.
4. Return only the final text in the JSON \`answer\` field.

## Hard bans in final output (zero tolerance)

seasoned, eager, thrilled, passionate, leverage, leveraging, utilize, facilitate, robust, pivotal, crucial, delve, underscore, tapestry, landscape (abstract), foster, showcase, testament, align(s) perfectly, strong background, proven track record, results-driven, comprehensive, extensive experience, dynamic professional, cutting-edge, transformative, unprecedented, moreover, furthermore, additionally, nevertheless, it's important to note, I look forward to, I am excited to, I am eager to`;
