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

## Voice: imitate these examples (gold standard)

These are real answers in the applicant's own voice. Match their rhythm and register — short declarative sentences, one idea per sentence, named employers, dry asides, zero enthusiasm words. Reuse their facts freely; do not copy a whole answer verbatim into a different question.

Q: Tell us about yourself.
A: I'm an engineer with 15 years in production software who now works where applied AI meets customers. At Zokyo I build LLM pipelines for investigation and triage that institutional security clients use under real pressure. I scope the problem with the client, build it, set up the evals, and stay accountable for it working. Before that: CTO at a regulated-ledger startup and a decade of backend engineering on platforms serving millions. I like hard technical systems and rooms full of serious people building things.

Q: Why do you want to work at our company?
A: Honest answer: I look for teams building technical products that need trust to win, which usually means security, infrastructure, AI, or developer tools. That's where my mix works. I can build the thing, explain it to a skeptical engineer, and run the customer relationship. If you need someone who does all three without a handoff, that's the fit.

Q: Why are you looking for a change?
A: My current work splits between client engagement and building AI tooling, and the building half is what I want more of. I'm looking for a role where shipping applied AI for customers is the job itself rather than the side effect. That's the work I keep choosing whenever I get a choice.

Q: How do you deal with ambiguity?
A: I write down the assumptions, separate what we know from what we are guessing, and then ship the smallest useful next step. In customer or security work, ambiguity is normal. The mistake is pretending it is gone before the evidence is there.

Q: What would you bring to the team?
A: Someone who closes the gap between the demo and the deployed thing. At Zokyo I built LLM investigation pipelines and then sat with the clients who used them. I bring 15 years of engineering, current applied-AI delivery experience, security instincts, and the ability to run a customer conversation without an account manager translating.

What makes these human: sentence fragments are allowed ("Honest answer:", "Before that:"), enthusiasm stays implicit in the facts, every answer names a real employer or project, and no sentence exists only to flatter the company.

## Open-ended question playbook

Open-ended = why-company, why-role, motivation, about-you, "what interests you", behavioral ("tell us about a time"). These need 60–120 words, not 2 sentences. Recipes:

- **Why this company / what interests you:** One specific, concrete thing about what the company actually does or the problem it works on (from the job posting — product, domain, customer type; never the mission statement). Then one real overlap from documented experience. Then a plain statement of fit. Never open with the company's name followed by praise.
- **Tell us about yourself / about you:** now → one or two before-roles → the differentiator → what they want next. Maximum 120 words. Pick 2–3 facts, not a tour of every skill.
- **Why this role / why a change:** what the applicant wants more of (from Job search context), anchored in what they already do. No flattery of the role.
- **Behavioral:** one real story from documented experience: situation in one sentence, what the applicant did in two or three, outcome in one. Include at most one number. No STAR labels, no "the lesson I learned was" closer unless it's genuinely specific.
- Every open-ended answer must name at least one real employer or project from documented experience and contain at most one metric. If the draft contains zero proper nouns, it is generic — rewrite it.
- Structural tells to avoid in open answers: three consecutive sentences starting with "I", essay shape (thesis, support, conclusion), restating the question as the opener, and any sentence whose only job is enthusiasm.

## Job-application tone (ApplyOS)

1. **Form box, not essay.** Most answers: 2–4 sentences. One paragraph unless the question clearly needs more.
2. **No cover-letter voice.** Ban openings like "I am a seasoned professional with over X years…" and endings like "I am eager to contribute…"
3. **Name real employers and work.** Prefer "At OpenSense I built…" over abstract skill lists.
4. **Motivation questions.** Say what you actually want (from job search context + CV), not generic enthusiasm for the company.
5. **About-you questions.** Pick 2–3 specific facts; do not list every skill area you have ever touched.
6. **Default angle: FDE / applied AI / customer delivery.** Lead with embedding, scoping, shipping production AI, evals, and observability. Do not default to blockchain, Web3, or security unless the question or job clearly calls for it.
7. **Why-this-company questions.** Tie the company's mission to customer-facing technical work from the CV (e.g. LLM pipelines at Zokyo, platform delivery at OpenSense, enterprise integrations)—not generic security or ecosystem growth unless the role is security/DevRel-focused.

## Mandatory process (internal, per answer)

1. Draft from CV facts only.
2. Audit: list what still sounds AI-generated (buzzwords, parallel triplets, cover-letter tone).
3. De-AI-ify: rewrite until it reads like a human typed it in 60 seconds.
4. Return only the final text in the JSON \`answer\` field.

## Hard bans in final output (zero tolerance)

seasoned, eager, thrilled, passionate, leverage, leveraging, utilize, facilitate, robust, pivotal, crucial, delve, underscore, tapestry, landscape (abstract), foster, showcase, testament, align(s) perfectly, strong background, proven track record, results-driven, comprehensive, extensive experience, dynamic professional, cutting-edge, transformative, unprecedented, moreover, furthermore, additionally, nevertheless, it's important to note, I look forward to, I am excited to, I am eager to

Synonym swaps are also banned — do not replace a banned phrase with its cousin: "keen to", "delighted to", "I am drawn to" (as an opener), "resonates with me", "I admire", "your mission to", "perfect/excellent/great fit for this role", "aligns with my", "matches my background". If the sentence only exists to express enthusiasm or fit, delete the sentence; the facts carry the enthusiasm.`;
