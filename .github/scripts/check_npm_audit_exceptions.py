#!/usr/bin/env python3
"""Fail closed on npm audit findings except exact, lockfile-pinned, time-bounded exceptions."""
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


def collect_advisories(vulnerabilities: dict[str, Any]) -> dict[str, dict[str, Any]]:
    findings: dict[str, dict[str, Any]] = {}

    def visit(package: str, stack: set[str]) -> None:
        if package in stack:
            return
        entry = vulnerabilities.get(package)
        if not isinstance(entry, dict):
            return
        nodes = entry.get("nodes", [])
        if not isinstance(nodes, list) or any(not isinstance(node, str) for node in nodes):
            raise ValueError(f"Invalid npm audit node list for {package}")
        via_items = entry.get("via", [])
        if not isinstance(via_items, list):
            raise ValueError(f"Invalid npm audit via list for {package}")
        for via in via_items:
            if isinstance(via, str):
                visit(via, stack | {package})
                continue
            if not isinstance(via, dict):
                raise ValueError(f"Invalid npm advisory entry for {package}: {via!r}")
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
                "nodes": sorted(set(nodes)),
            }
            previous = findings.get(advisory)
            if previous:
                for field in ("package", "severity", "affected_range", "url"):
                    if previous[field] != finding[field]:
                        raise ValueError(f"Conflicting npm audit metadata for {advisory}")
                previous["nodes"] = sorted(set(previous["nodes"]) | set(finding["nodes"]))
            else:
                findings[advisory] = finding

    for package in vulnerabilities:
        visit(package, set())
    return findings


def evaluate(
    report: dict[str, Any],
    exception_document: dict[str, Any],
    lockfile: dict[str, Any],
    today: date | None = None,
) -> tuple[list[str], dict[str, dict[str, Any]]]:
    today = today or date.today()
    errors: list[str] = []
    vulnerabilities = report.get("vulnerabilities")
    if not isinstance(vulnerabilities, dict):
        return ["npm audit report has no vulnerabilities object"], {}
    packages = lockfile.get("packages")
    if not isinstance(packages, dict):
        return ["package-lock.json has no packages object"], {}
    metadata = report.get("metadata", {})
    metadata_counts = metadata.get("vulnerabilities", {}) if isinstance(metadata, dict) else {}
    for severity in BLOCKING_SEVERITIES:
        count = metadata_counts.get(severity, 0) if isinstance(metadata_counts, dict) else 0
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
        expected_nodes = exception.get("locked_nodes")
        if not isinstance(expected_nodes, list) or any(not isinstance(node, str) for node in expected_nodes):
            errors.append(f"{advisory} must pin the exact package-lock node paths")
        elif sorted(set(expected_nodes)) != finding["nodes"]:
            errors.append(
                f"{advisory} locked_nodes mismatch: "
                f"approved={sorted(set(expected_nodes))!r}, observed={finding['nodes']!r}"
            )
        expected_versions = exception.get("locked_versions")
        if not isinstance(expected_versions, list) or any(not isinstance(version, str) for version in expected_versions):
            errors.append(f"{advisory} must pin the exact package-lock versions")
        else:
            actual_versions: list[str] = []
            for node in finding["nodes"]:
                record = packages.get(node)
                if not isinstance(record, dict) or not isinstance(record.get("version"), str):
                    errors.append(f"{advisory} package-lock node is missing or has no version: {node}")
                    continue
                actual_versions.append(record["version"])
            if sorted(set(expected_versions)) != sorted(set(actual_versions)):
                errors.append(
                    f"{advisory} locked_versions mismatch: "
                    f"approved={sorted(set(expected_versions))!r}, observed={sorted(set(actual_versions))!r}"
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
    parser.add_argument("--lockfile", required=True, type=Path)
    args = parser.parse_args()
    try:
        report = json.loads(args.report.read_text(encoding="utf-8"))
        exception_document = json.loads(args.exceptions.read_text(encoding="utf-8"))
        lockfile = json.loads(args.lockfile.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"npm audit policy input error: {exc}", file=sys.stderr)
        return 2
    errors, findings = evaluate(report, exception_document, lockfile)
    if errors:
        print("npm audit policy FAILED:")
        for error in errors:
            print(f"- {error}")
        return 1
    counts = report.get("metadata", {}).get("vulnerabilities", {})
    print(
        "npm audit policy passed: "
        f"{len(findings)} advisory exception(s) match exact package-lock paths and versions; "
        f"{counts.get('high', 0)} high and {counts.get('critical', 0)} critical findings."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
