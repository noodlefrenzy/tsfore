<!-- agent-notes: { ctx: "reviewer lens: test quality and coverage", deps: [team/roles/reviewer/SKILL.md, team/roles/tester/SKILL.md], state: draft, last: "claude@2026-09-09" } -->

## Lens: Test Quality

Guiding question: if this code breaks in production, will a test fail first?

- Are the new and changed paths covered? Name the ones that are not.
- Are the unhappy paths tested: null, empty, boundary values, invalid input, failures from the network or filesystem, concurrent access?
- Do the tests verify behaviour or implementation detail? "The user is created" beats "createUser was called with these arguments."
- Would a realistic wrong implementation still pass? A test that asserts an element exists without asserting its content; an expected direction copied from the implementation instead of derived from the requirement; a test that hits a helper instead of the path production uses.
- Is anything time-dependent read from the real clock instead of pinned?
- Are the names descriptive enough to serve as documentation of the behaviour?
- Any flake risk: timing, ordering, external calls, shared state?
- Is the pyramid still standing? Too many end-to-end tests and too few unit tests is a finding.

This lens shares the tester's veto: a critical path with no test can block the merge. Name the path, the failure that would go undetected, and the test that lifts it.

Check the arithmetic. If the change claims to add forty tests, count them.
