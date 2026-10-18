---
agent-notes: { ctx: "AI-tell catalog for de-flavoring summon's own docs", deps: [docs/team-directives.md, docs/process/doc-ownership.md, docs/process/gotchas.md], state: active, last: "diego@2026-06-29" }
---

# AI Tells Catalog — Summon Documentation

A catalog of prose patterns that ship as "AI co-author residue" in Summon's own documentation — methodology specs, process docs, ADRs, agent persona definitions, slash-command docs, the README, and CLAUDE.md itself.

Summon's docs are written almost entirely by Claude Code agents. That is the point of the project, and it is also the problem this file exists to manage: when a virtual team drafts its own documentation, every doc drifts toward the same machine-built shape unless something pushes back. This catalog is that push-back. It is the universal floor every Summon doc has to clear before it reads as authored rather than generated.

It pairs with two things already in the repo:

- **`docs/team-directives.md`** carries the *house voice* — the positive "always X / prefer Y" conventions specific to this project. This catalog is the negative space around those: the patterns to *remove*.
- **`docs/process/doc-ownership.md`** says who owns which doc. Diego owns documentation quality; a de-AI pass is Diego's review lens, and this file is the checklist he reviews against.

The voice-card concept from the portable version of this catalog maps onto Summon as: **team-directives.md + the per-doc owner's judgement = the voice card.** This file answers "what does an AI co-author always sound like, that Summon's docs should not."

## How to use this catalog

1. **During a de-AI pass.** Read a doc against Sections 1–5 and strip what you find. Surface tells (1–4) come out mechanically; discourse tells (5) need a rewrite of the argument, not a find-and-replace.
2. **Treat Universal tells (Sections 1–5) as hard bans by default.** Downgrade case-by-case only with a written reason in the commit or the doc.
3. **Treat House-dependent watches (Section 6) as flags requiring a ruling against `team-directives.md`.** Some patterns (tables, bolding, contractions) are correct in Summon's voice and wrong elsewhere; the directives file decides.
4. **Treat Discipline rules (Section 7) as portable workflow** — they apply while drafting and reviewing any doc regardless of which doc.
5. **Calibrate over time.** If a flagged pattern turns out to be authentic to Summon's house voice (cite the evidence — consistent intentional use predating the convergence, or an explicit directive), record the exception in `team-directives.md`, not here. This file stays universal.

## Why these are tells

Modern large language models, trained on overlapping corpora and reinforced toward "helpful, fluent, well-structured prose," converge on a recognizable shape. A reader who has seen a few thousand model-assisted docs starts to spot the shape unconsciously: a certain rhythm, certain transition vocabulary, certain structural moves. The tells below are the most reliable convergence points. Avoiding them does not guarantee the prose reads as authored; using them virtually guarantees it reads as machine-built.

The principle behind every entry is the same: *symmetric, signposted, smoothed prose is the model's natural attractor.* Break the symmetry, drop the signposts, leave the rough edges in.

There are two layers to the attractor. The **surface layer** is punctuation, sentence shape, construction, and vocabulary (Sections 1–4) — the layer a find-and-replace can fix. The **discourse layer** is the structure of the argument itself: what gets explained, what gets resolved, what gets restated across docs, how much idiosyncrasy survives (Section 5). The discourse layer is the one that gives a doc away even after every em-dash is gone. Both layers have to clear.

A note on Summon's docs specifically: because the whole team writes in the same model family, Summon's archive is *more* convergent than a human-written one, not less. Consistency of a pattern across Summon's docs is therefore weak evidence that the pattern is authentic — see 7.3. CLAUDE.md, the personas catalog, and the process docs were all drafted under the same attractor, so they are the *first* place to look for tells, not a trusted baseline to imitate.

---

## 1. Punctuation and rhythm tells

### 1.1 Em-dash floods

The single most reliable tell. Target zero per doc; one per long doc is permitted only when no cleaner punctuation choice exists. Parentheses, semicolons, periods, commas with conjunctions, and split sentences carry every aside the prose needs.

Bad: *The board item — and this matters — is not optional.* Better: *The board item is not optional, and that matters.* / *The board item is not optional (and that matters).*

### 1.2 The "X — Y — Z" em-dash triplet

A specific high-density form: three or more em-dashes in close range, often producing a clause–parenthetical–clause–parenthetical sandwich. Always a tell. Common in ADR consequence sections and persona descriptions.

### 1.3 Sentence-triplet anaphora

Three (or four) sentences (or clauses) in a row sharing an opening phrase or syntactic shape.

Bad: *We had latency. We had cost. We had quality.* / *Tara writes the test. Sato makes it pass. Vik reviews it.*

Confident-sounding model rhythm. Replace with varied sentence lengths, conjoined clauses, or interrupted patterns. The smaller-scale within-sentence version is the same tell: *They probe, they clarify, they pressure-test.*

### 1.4 Symmetric two-sentence parallel-contrast

Two short sentences where the second negates or contrasts the first. This is endemic in Summon's docs.

Caught in-repo (`team-directives.md`): *"Gotchas say 'don't touch the stove.' Directives say 'we cook with gas, not electric.'"* Caught in-repo (CLAUDE.md, paraphrased pattern): *"The vocabulary is new. The work is old."*

The contrastive thought is usually fine; the symmetric prose shape is the tell. Break it: one longer interleaved sentence, asymmetric clause lengths, or a single sentence with a conjunction. (The mnemonic phrasings in `team-directives.md` are a borderline case — they aid recall, which is a real function. Rule them against the directives file, but do not let the shape spread to docs where it is pure decoration.)

### 1.5 Forced Rule of Three

Lists of three when the argument supports two or four. The model reaches for triplets because triplets feel rhetorical. Count what the argument actually contains. Summon's docs lean on three-item bullet sets constantly; audit each one for whether the third item is real or padding.

---

## 2. Construction tells

### 2.1 "Not X, it's Y" / "Not just X, but Y"

Permanently retired. All variants, including the two-sentence form (*X is not Y. It is Z.*) and the callout form (*Summon isn't about coding faster — it's about giving solo developers a real team*). This is the single most reliable model-collaboration tell observed across corpora, and it shows up in Summon's marketing-adjacent prose (README, persona taglines) most of all.

### 2.2 Closing reverberation paragraphs

*Ultimately, this is about empowering solo developers.* / *We are no longer just running commands, we are running a team.* End on the last substantive point. Do not summarize what was just said, and do not poeticize the conclusion. This is especially tempting at the end of ADRs and methodology docs — resist it. A process doc that ends on its last rule is stronger than one that ends on a mission restatement.

### 2.3 Meta-narrative throat-clearing

*I want to talk about.* / *Let me set the stage.* / *Before we get into the gate, I want to.* / *In this section we will cover.* If the doc is about to do something, do it. Meta-narrative is the move the model reaches for when it is unsure how to start a section or transition between them.

### 2.4 "Ta-da" suspense phrases

*But here's the thing:* / *The result?* / *Here's the key insight:* Cheap structural tension. Cut. A spec states; it does not build suspense.

### 2.5 Cliché openers

*In today's fast-paced development landscape.* / *As AI-assisted engineering continues to evolve.* / *At its core, Summon is.* / *It is important to note that.* All instant tells. Open with the actual claim.

### 2.6 Speech-act prefaces (announce-the-move)

A clause that names what the next sentence is doing instead of just doing it. The test: delete the clause. If the following sentence still lands, the clause was narration.

- **Sincerity tag.** *To be honest,* / *Genuinely,* / *Real talk:*. Labeling a statement sincere implies the rest was not.
- **Structure tag.** *To recap,* / *One last thing:* / *The takeaway here:*. The model narrating the doc's own structure. The section position already says what role it plays. (Inverted cousin of 3.2: prose growing its own inline header.)
- **Speech-act tag.** *A note on X:* / *One caveat:*. Often fine as a heading; as an inline preface it is usually deletable.

Rule: if the doc is about to do something, do it.

---

## 3. Structural tells

### 3.1 Descriptive colon-subtitle headings

*The Done Gate: A Checklist for Closing Work.* Allowed only when the second half names a coined framework. Otherwise rewrite as a claim, a question, or a single phrase. *"X: How Y Works"* is the model's default heading shape and it is all over Summon's section titles.

### 3.2 Section openers that lean on the header for meaning

A body paragraph should make its own role visible in the prose, not borrow it from the heading. Test: read the paragraph cold, without its header. If a stranger could mistake an objection you are addressing for a claim you are making, the opener is broken. This matters most in ADRs, where the "Alternatives Considered" prose must read as alternatives even with the heading stripped.

### 3.3 Bolded-prefix-colon listicles

***Architecture as Intent:*** *...* / ***Deterministic Feedback:*** *...* A known model formatting default, and the single most common structural tell in Summon's docs — the persona catalog, the gotchas file, and the process index all lean on it. It is not always wrong (a genuine term-then-definition list earns it), but it is the model's reflex when it does not know how to develop a thought into prose. Convert decorative instances to numbered sections or plain prose; keep it only for true glossaries.

### 3.4 Standalone italic takeaway lines between paragraphs

An italicized one-sentence "insight" dropped between body paragraphs as visual emphasis. Filler in a spec. Let strong sentences earn their weight through position in the prose, not formatting.

### 3.5 The "everything is a list" drift

Body prose decomposed into bullets where a paragraph would carry the argument better. Lists and tables are appropriate for genuinely parallel items — and Summon's docs legitimately use tables for rosters, phase models, and ownership (that is correct, keep it). The tell is the *narrative* turned into bullets: a multi-step rationale, a chain of cause and effect, or an argument with real connective tissue chopped into a list because the model did not develop it. Ask of each list: are these items actually parallel, or is this a paragraph in disguise?

---

## 4. Vocabulary tells

### 4.1 Flowery-competence words

*Delve, intricate, pivotal, underscore, showcasing, meticulous, robustly, seamless, holistic, comprehensive (as filler), realm.* The model's "this sounds sophisticated" reach. Replace with concrete verbs and specific nouns.

### 4.2 Corporate transition verbs

*Leverage, empower, foster, unlock, navigate (as metaphor), enhance, elevate, streamline, harness (as verb when not literal).* Heavy rotation in LLM process-prose. Replace with the concrete verb: *use, let, give, improve, encourage, simplify.* ("Summon" the product name is fine; "harness" as a buzzy verb is not.)

### 4.3 Diplomatic hedging clusters

*May, might, often, sometimes, usually, potentially, perhaps* arriving in formation in the same paragraph. A spec should commit. *"This may sometimes potentially cause issues"* is three hedges doing the work of zero claims. State the rule or state the exception; do not blur both.

### 4.4 "Robust, scalable, seamless, dynamic, powerful"

Use only when the precise technical meaning is intended. Otherwise filler adjectives signaling "I am trying to sound capable." Summon's README and persona blurbs are the high-risk surface here.

### 4.5 "Load-bearing"

Borrowed engineering jargon that became the model's explanation default circa 2024. Replace with *central, essential, the part that holds it up* — or delete and let the prose carry it.

---

## 5. Discourse and substance tells (the layer beneath the prose)

Sections 1–4 catalog *surface* tells. They survive a find-and-replace. A doc can lose every em-dash and still read as machine-built, because the model's fingerprint also lives one layer down, in *how the argument is constructed*. Detection research on narrative text (Russell et al., *StoryScope*, arXiv:2604.03136, 2026) finds the discourse layer alone carries the overwhelming majority of the AI-detection signal — scrubbing only the surface leaves clean-looking prose that still reads as generated.

**Scope caveat.** *StoryScope* studies fiction. The entries below translate its findings to technical/process docs; treat them as well-grounded direction, not measured results for spec prose. Where a percentage appears it is the fiction number, cited for magnitude, not a threshold for Summon's docs.

### 5.1 Over-determined meaning (the stated takeaway)

The strongest discourse tell. AI narrators spell out the theme far more than humans do (77% vs. 52% in the study) — they state the meaning rather than trusting the reader to infer it. In Summon's docs this is the sentence that restates the rule you just gave as a "lesson," or the closing line that explains why the section mattered. **It compounds across docs:** the same rule restated in CLAUDE.md, the methodology doc, *and* the gotchas file is over-determination at the repo scale. If the rule was stated clearly once, the restatement is the tell — cut it and link to the one canonical home (see 7.4).

### 5.2 Tidy single-track structure

AI text favors tidy, single-track structure with few loose ends. The doc analog: a process that runs in one clean line from setup to conclusion with every edge case tied off and no genuine open question. Real methodology has residue — exceptions that do not fully resolve, trade-offs that stay live. A doc with no acknowledged tension often had none because the model smoothed it away. ADRs are the canonical place to leave residue visible.

### 5.3 Clean resolution / absence of residual doubt

AI resolutions discharge all tension; the writer ends more certain than they began. Mapped to an ADR: the rejected alternative is raised and then demolished so completely that nothing of it survives, leaving no reason a future reader might reopen the decision. **This directly qualifies the ADR discipline (7.5):** documenting the alternative is necessary but not sufficient. If you neutralize it so totally that no real trade-off remains, you have produced the tidy shape the model produces. Leave the strongest part of the rejected option standing, and name what the chosen option actually costs.

### 5.4 Vague allusion instead of specific named reference

AI sticks to vague allusions — *"best practice says,"* *"studies show,"* *"as is well known,"* *"many teams find."* The human (and the good-spec) move is to name the specific thing: the ADR number, the exact gotcha, the named persona, the dated decision, the concrete command. In Summon, *"per our architecture decisions"* is a tell; *"per ADR-0002 (TDD workflow)"* is authored. Reach for the proper noun and the cross-reference.

### 5.5 Convergence to the shared center

AI sources cluster in a narrow region of style space while human authors spread out. For Summon this is the convergent-contamination heuristic (7.3) made concrete: every agent drafting under the same model pulls each doc toward the same center. The corollary is that *idiosyncrasy is the signal* — the project-specific term, the example drawn from Summon's own history, the rule phrased the way this team actually phrases it. Whatever is most particular to Summon is what most resists the pull.

### 5.6 The house bias of the co-author

Each model has its own discourse fingerprint, not just a shared "AI" one. **Claude — the model that writes nearly all of Summon's docs — is defined by *restraint*:** the most uniform, even register; a "reverent/continuist" stance that honors and extends conventions rather than challenging them; quiet, smoothing endings. For docs that means the house bias to push against is *blandness and false consensus*: state the decision with the conviction it earned, name the real disagreement when one existed (Wei's whole job is to surface it — let the doc record it), and do not let every doc settle into the same even, agreeable tone.

---

## 6. House-dependent watches (rule against `team-directives.md`)

These are tells in some contexts and authentic to Summon's voice in others. The directives file decides; when it is silent, flag for a ruling.

- **Tables.** Summon uses tables heavily and correctly — rosters, phase models, ownership, field specs. That is house voice, keep it. Watch only for the table that should have been a paragraph: a two-column table whose rows are not actually parallel.
- **Heavy mid-paragraph bolding.** Helps scannability in dense process docs; reads as noise when every other phrase is bold. Cap at roughly one bolded run per paragraph; let the prose carry emphasis where it can.
- **First-person plural "we."** Reads as the team in most Summon docs, which is fine. Watch for "we" used to hedge a rule that should be imperative — *"we should run the gate"* is weaker than *"run the gate."*
- **Imperative vs. descriptive voice.** Process docs and command docs want the imperative (*"Move the issue to In Review"*). Methodology and ADRs want the descriptive. A mismatch — passive description where a command belongs, or barked imperatives in an explanatory doc — is the tell.
- **Contractions.** Summon's docs mix them freely and that reads fine. Absence of contractions in otherwise plain prose is a mild stiffness tell; the directives file sets the default.
- **The colon-subheading pattern** (an h2 with a colon). Allowed but flagged; a heading without the colon is usually stronger (see 3.1).
- **Emoji / decorative symbols.** Default zero in specs and process docs. The README and marketing surfaces may earn a few; "earned, not sprinkled."

---

## 7. Discipline rules (portable workflow, not prose patterns)

These apply while drafting and reviewing any Summon doc.

### 7.1 Provenance check

Before attributing a term, framework, or pattern to Summon or calling it new, **verify provenance.** If the idea is established practice (TDD, ADRs, blackboard debugging, the "five whys," conventional commits), say so and cite the originators; position Summon's contribution as a *specific application or extension*, not a coinage. The cost of a 15-second check is trivial against the credibility damage of claiming someone else's vocabulary. This applies to draft prose and to editorial suggestions alike.

### 7.2 Cross-AI residue check

When pulling a suggestion from a *different* model into a Summon doc, strip the terminal aphorisms and rhythm-matched closing sentences before pasting. The substance usually survives the transfer; the prose shape carries the source model's cadence. Rewrite in Summon's house voice rather than pasting verbatim.

### 7.3 The convergent-contamination heuristic

When using an existing Summon doc as a model for a new one, separate authentic signals from co-author artifacts:

- **Authentic signals to preserve:** project-specific terms and personas, real decisions and dates, the actual roster and phase model, recurring conventions the team genuinely uses.
- **Likely co-author artifacts to ignore:** the tells in Sections 1–5 — both surface (1–4) and discourse (5).

Summon's whole archive was drafted under one model family, so it is *more* convergent than a human's, not less. **Consistency of a pattern across Summon's docs is not evidence the pattern is authentic** — it is more likely shared contamination. Treat the existing docs as useful for *what* to say (which rules, which personas, which examples) and untrusted for *how* it is said.

### 7.4 One canonical home (anti-restatement)

Every rule, definition, or decision lives in exactly one canonical doc; everywhere else links to it. Restating the same rule across CLAUDE.md, a methodology doc, and a gotcha is the repo-scale form of over-determination (5.1), and it rots — the copies drift. Before adding an explanation, search for whether it already exists; if it does, link with the specific path or ADR number (5.4) instead of restating. `doc-ownership.md` names the canonical home for each topic.

### 7.5 The honest-alternative discipline (ADRs)

Every ADR earns a section that states the strongest rejected alternative and why it lost — and states what the chosen option *costs*. This is the structural piece most often missing or faked in AI-drafted ADRs, and the one that most reliably reads as authored. Answer the alternative honestly, not tidily (see 5.3): if rejecting it cost the decision nothing, you either picked a straw alternative or smoothed away the part that had a point. After the alternatives section, a reader should understand the live trade-off, not just be reassured the team chose correctly.

---

## 8. What this catalog does *not* do

- **It does not specify Summon's voice.** Pair it with `team-directives.md` for the positive conventions and with each doc's owner for judgement.
- **It does not auto-rewrite.** A de-AI pass reports and edits deliberately; it is a review lens, not a sed script. The surface tells can be batch-fixed, but every discourse-layer change is a rewrite decision.
- **It does not substitute for an editorial read by the doc owner.** Mechanical tell-detection cannot catch factual drift, stale references, or whether the doc is actually correct and complete.

## 9. Running a de-AI pass on a Summon doc

A practical order of operations when cleaning a doc:

1. **Surface sweep (1–4).** Em-dashes, parallel-contrast pairs, bolded-prefix-colon listicles, flowery and corporate vocabulary, hedge clusters. Mostly mechanical.
2. **Structure read (3, 5).** Read the doc cold and ask: is any list a paragraph in disguise (3.5)? Does any section lean on its header (3.2)? Does it over-explain its own meaning (5.1)? Does it restate something that lives elsewhere (7.4)?
3. **Discourse read (5).** Does it resolve too cleanly — ADR with no surviving trade-off (5.3), methodology with no live exception (5.2)? Does it allude vaguely where it should name an ADR, persona, or date (5.4)?
4. **House check (6).** Rule the flagged-but-maybe-authentic patterns against `team-directives.md`.
5. **Provenance and canonicity (7.1, 7.4).** Verify any "new" claim; collapse any restatement into a link.

This file is Summon's universal documentation floor. `team-directives.md` is the ceiling and the texture.
