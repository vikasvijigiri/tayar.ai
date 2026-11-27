import importlib.util
from datetime import date
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / ".github/scripts/check_npm_audit_exceptions.py"
SPEC = importlib.util.spec_from_file_location("npm_audit_policy", SCRIPT)
POLICY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(POLICY)

EXCEPTIONS = {
    "exceptions": [
        {
            "advisory": "GHSA-3g3m-2fjr-6pw4",
            "package": "glob",
            "severity": "moderate",
            "affected_range": ">=9.0.0 <=14.0.1",
            "locked_nodes": ["node_modules/glob"],
            "locked_versions": ["13.0.6"],
            "review_by": "2026-12-11",
            "reason": "The supported framework pins the affected major and the fix requires a major upgrade.",
            "mitigation": "Keep the lockfile and remove the exception after the tested framework upgrade.",
        }
    ]
}


def lockfile():
    return {"packages": {"node_modules/glob": {"version": "13.0.6"}}}


def report(severity="moderate", advisory="GHSA-3g3m-2fjr-6pw4"):
    return {
        "vulnerabilities": {
            "framework": {"severity": severity, "via": ["glob"], "range": "*"},
            "glob": {
                "severity": severity,
                "via": [{
                    "name": "glob",
                    "severity": severity,
                    "range": ">=9.0.0 <=14.0.1",
                    "url": f"https://github.com/advisories/{advisory}",
                }],
                "range": ">=9.0.0 <=14.0.1",
                "nodes": ["node_modules/glob"],
            },
        },
        "metadata": {"vulnerabilities": {"high": 0, "critical": 0, "moderate": 1}},
    }


def test_exact_unexpired_exception_is_accepted():
    errors, findings = POLICY.evaluate(report(), EXCEPTIONS, lockfile(), today=date(2026, 11, 27))
    assert errors == []
    assert list(findings) == ["GHSA-3G3M-2FJR-6PW4"]


def test_unapproved_advisory_fails_closed():
    errors, _ = POLICY.evaluate(
        report(advisory="GHSA-0000-0000-0000"), EXCEPTIONS, lockfile(), today=date(2026, 11, 27)
    )
    assert any("unapproved" in error for error in errors)


def test_high_severity_cannot_be_excepted():
    errors, _ = POLICY.evaluate(report(severity="high"), EXCEPTIONS, lockfile(), today=date(2026, 11, 27))
    assert any("high" in error for error in errors)


def test_expired_exception_fails_closed():
    errors, _ = POLICY.evaluate(report(), EXCEPTIONS, lockfile(), today=date(2026, 12, 11))
    assert any("expired or due for review" in error for error in errors)


def test_stale_exception_must_be_removed():
    errors, _ = POLICY.evaluate(
        {"vulnerabilities": {}, "metadata": {"vulnerabilities": {}}}, EXCEPTIONS, lockfile()
    )
    assert any("stale exception" in error for error in errors)


def test_exception_range_must_match_current_audit():
    wrong = {**EXCEPTIONS, "exceptions": [{**EXCEPTIONS["exceptions"][0], "affected_range": "<=8"}]}
    errors, _ = POLICY.evaluate(report(), wrong, lockfile(), today=date(2026, 11, 27))
    assert any("affected_range mismatch" in error for error in errors)


def test_lockfile_version_drift_fails_closed():
    drifted = {"packages": {"node_modules/glob": {"version": "13.0.5"}}}
    errors, _ = POLICY.evaluate(report(), EXCEPTIONS, drifted, today=date(2026, 11, 27))
    assert any("locked_versions mismatch" in error for error in errors)


def test_new_vulnerable_lockfile_node_fails_closed():
    expanded_report = report()
    expanded_report["vulnerabilities"]["glob"]["nodes"].append("node_modules/other/node_modules/glob")
    expanded_lockfile = {
        "packages": {
            "node_modules/glob": {"version": "13.0.6"},
            "node_modules/other/node_modules/glob": {"version": "13.0.6"},
        }
    }
    errors, _ = POLICY.evaluate(expanded_report, EXCEPTIONS, expanded_lockfile, today=date(2026, 11, 27))
    assert any("locked_nodes mismatch" in error for error in errors)


def test_missing_lockfile_node_fails_closed():
    errors, _ = POLICY.evaluate(report(), EXCEPTIONS, {"packages": {}}, today=date(2026, 11, 27))
    assert any("package-lock node is missing" in error for error in errors)
