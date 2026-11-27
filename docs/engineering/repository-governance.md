# Repository governance and release controls

This document defines the repository-level controls required for a production engineering workflow. A checked-in policy file does not enforce a GitHub setting; the controls below must be configured and verified in repository settings.

## Verified baseline at 2026-11-27

- Default branch: `main`.
- The GitHub API reported `protected: false` for `main` at the time of inspection.
- The repository has automated backend, mobile, dependency, static-analysis, secret-scan, Android-build, and deployed-smoke workflows.
- The default branch must not be treated as protected until GitHub reports required protection/ruleset enforcement.

## Required main-branch ruleset

Configure a repository ruleset targeting `main` with:

1. Require a pull request before merging; prohibit direct pushes and force pushes.
2. Require at least one approving review from someone other than the author.
3. Require CODEOWNER review for changes covered by `.github/CODEOWNERS`.
4. Dismiss stale approvals when new commits are pushed.
5. Require approval of the most recent reviewable push by someone other than its author.
6. Require all required status checks from the current CI workflows: backend tests, dependency/security scans, quality gates, mobile checks, Android packaging and mobile emulator E2E.
7. Require branches to be up to date before merging, or use a merge queue with equivalent guarantees.
8. Require conversation resolution and block force pushes/deletion.
9. Apply rules to administrators; use a documented emergency bypass only for incident response.
10. Enable automatic deletion of merged head branches.

Do not select status-check names until the exact check names have been observed on a representative pull request. A workflow being present in the repository is not evidence that its check is required by branch protection.

## Pull request policy

Every non-trivial change should:
- reference an issue or explain why none is needed;
- state risk, API/schema compatibility, privacy/security impact and rollback strategy;
- include exact test commands and links to successful workflow runs;
- attach device evidence for UI-affecting changes;
- update operational documentation and telemetry where behavior changes;
- receive independent review before merge.

Use `.github/pull_request_template.md` as the evidence checklist. CODEOWNERS routes review requests but does not itself enforce approval.

## Dependency maintenance

Dependabot is configured for Python, mobile npm packages and GitHub Actions. Dependency PRs must be reviewed for changelog/security impact and run through the full CI suite. Never apply broad force-upgrades solely to silence an audit; assess compatibility and remediate the vulnerable dependency path.

## Release gates

A green CI run proves only the checks executed by that workflow for that commit. Production release additionally requires:
- persistent release signing and a verified upgrade install;
- isolated live authentication, authorization/RLS and persistence tests;
- privacy policy, account deletion and support contact;
- provisioned alert delivery and an incident/rollback drill;
- staging load and resilience evidence;
- physical-device and accessibility validation;
- reviewed source integrity for published learning content.

## Evidence and change control

Record commit SHA, workflow run URL, artifact checksum, test environment, test date and known limitations for each release candidate. Never claim a control is enabled based solely on this document.
