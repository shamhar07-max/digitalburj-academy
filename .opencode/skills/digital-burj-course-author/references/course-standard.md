# Course standard (condensed authoring contract)

## Course object (required fields)
`id` (DB-00… or CAT-IDs), `title`, `category` (21 fixed categories),
`difficulty` (Starter|Builder|Professional|Advanced|Master),
`durationWeeks`, `prerequisites[]` (course IDs, must exist, no cycles),
`outcomes[]` (observable capabilities, unique across catalog),
`skills[]` (must exist in SKILL_MATRIX), `careers[]`, `modules[]`,
`finalProject`, `assessment`, `evidence[]`, `next[]`, `version`.

## Module object
`id`, `objective` (one sentence, observable), `lessons[]`, `scenario`
(real business situation), `project checkpoint` where applicable.

## Lesson object (substantive lessons only; drills may be check-only)
`id`, `title`, `coldOpen` (situation, ≤60 words), `why` (1–2 sentences),
`concept[]` (short paragraphs), `example` (concrete, with numbers/names),
`practice` (professional norm), `mistakes[]` (≥2), `failure` (what breaks +
symptom), `exercise` (do-this task), `check` {question, options[4], answer,
why}, `evidence` (deliverable), `recall` (link to earlier lesson id, optional).

## Banned
Filler paragraphs, repeated explanations across courses, video-only lessons,
artificial difficulty, unmeasurable outcomes ("understand X" without artifact),
assessment that doesn't match outcomes, technology presented as current when
deprecated (must warn explicitly).

## Versioning
Bump minor on edits, major on outcome/assessment change. Student records pin
the version completed. Never edit a version students completed; supersede it.
