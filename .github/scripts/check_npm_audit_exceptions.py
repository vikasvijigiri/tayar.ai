#!/usr/bin/env python3
"""Fail closed on npm audit findings except exact, time-bounded reviewed advisories."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

ADVISORY_ID = re.compile(r"GHSA-[0-9a-z-]+", re.IGNORECASE)
BLOCKING_SEVERITIES = {"high", "critical"}


def collect_advisories(vulnerabilities: dict[str, Any]) -> dict[str, dict[str, str]]:
    findings: dict[str, dict[str, str]] = {}

    def visit(package: str, stack: set[str]) -> None:
        if package in stack:
            return
        entry = vulnerabilities.get(package)
        if not isinstance(entry, dict):
            return
        next_stack = stack | {package}
        for via in entry.get("via", []):
            if isinstance(via, str):
                visit(via, next_stack)
                continue
            if not isinstance(via, dict):
                continue
            url = via.get("url")
            match = ADVISORY_ID.search(url or "")
            if not match:
                raise ValueError(f"Unrecognized npm advisory reference for {package}: {url!r}")
            advisory = match.group(0).upper()
            finding = {
                "advisory": advisory,
                "package": str(via.get("name") or package),
                "severity": str(via.get("severity") or entry.get("severity") or "").lower(),
                "affected_range": str(via.get("range") or entry.get("range") or ""),
                "url": str(url),
            }
            previous = findings.get(advisory)
            if previous and previous != finding:
                raise ValueError(f"Conflicting npm audit metadata for {advisory}")
            findings[advisory] = finding

    for package in vulnerabilities:
        visit(package, set())
    return findings


def evaluate(
    report: dict[str, Any],
    exception_document: dict[str, Any],
    today: date | None = None,
) -> tuple[list[str], dict[str, dict[str, str]]]:
    today = today or date.today()
    errors: list[str] = []
    vulnerabilities = report.get("vulnerabilities")
    if not isinstance(vulnerabilities, dict):
        return ["npm audit report has no vulnerabilities object"], {}

    metadata_counts = report.get("metadata", {}).get("vulnerabilities", {})
    for severity in BLOCKING_SEVERITIES:
        count = metadata_counts.get(severity, 0)
        if count:
            errors.append(f"npm audit reports {count} {severity} package finding(s)")

    try:
        findings = collect_advisories(vulnerabilities)
    except ValueError as exc:
        return errors + [str(exc)], {}

    exception_rows = exception_document.get("exceptions")
    if not isinstance(exception_rows, list):
        return errors + ["exception document must contain an exceptions array"], findings

    exceptions: dict[str, dict[str, Any]] = {}
    for row in exception_rows:
        if not isinstance(row, dict) or not row.get("advisory"):
            errors.append("each exception must be an object with an advisory ID")
            continue
        advisory = str(row["advisory"]).upper()
        if advisory in exceptions:
            errors.append(f"duplicate exception for {advisory}")
        exceptions[advisory] = row

    for advisory, finding in findings.items():
        if finding["severity"] in BLOCKING_SEVERITIES:
            errors.append(f"{advisory} is {finding['severity']} and cannot be excepted")
            continue
        exception = exceptions.get(advisory)
        if exception is None:
            errors.append(f"unapproved {finding['severity']} advisory: {advisory} ({finding['package']})")
            continue
        for field, actual in (
            ("package", finding["package"]),
            ("severity", finding["severity"]),
            ("affected_range", finding["affected_range"]),
        ):
            if str(exception.get(field, "")).lower() != actual.lower():
                errors.append(
                    f"{advisory} exception {field} mismatch: "
                    f"approved={exception.get(field)!r}, observed={actual!r}"
                )
        try:
            review_by = date.fromisoformat(str(exception.get("review_by", "")))
        except ValueError:
            errors.append(f"{advisory} has no valid ISO review_by date")
        else:
            if today >= review_by:
                errors.append(f"{advisory} exception expired or due for review on {review_by.isoformat()}")
        if len(str(exception.get("reason", "")).strip()) < 30:
            errors.append(f"{advisory} exception has no evidence-based reason")
        if len(str(exception.get("mitigation", "")).strip()) < 30:
            errors.append(f"{advisory} exception has no mitigation statement")

    for advisory in exceptions.keys() - findings.keys():
        errors.append(f"stale exception must be removed: {advisory}")

    return errors, findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--exceptions", required=True, type=Path)
    args = parser.parse_args()
    try:
        report = json.loads(args.report.read_text(encoding="utf-8"))
        exception_document = json.loads(args.exceptions.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"npm audit policy input error: {exc}", file=sys.stderr)
        return 2

    errors, findings = evaluate(report, exception_document)
    if errors:
        print("npm audit policy FAILED:")
        for error in errors:
            print(f"- {error}")
        return 1

    counts = report.get("metadata", {}).get("vulnerabilities", {})
    print(
        "npm audit policy passed: "
        f"{len(findings)} advisory exception(s) are exact and unexpired; "
        f"{counts.get('high', 0)} high and {counts.get('critical', 0)} critical findings."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
