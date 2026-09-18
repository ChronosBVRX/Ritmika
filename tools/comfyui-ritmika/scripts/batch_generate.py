#!/usr/bin/env python3
"""Batch driver for the Rítmika animation pipeline.

Examples:
    python batch_generate.py --category axolo --animation idle
    python batch_generate.py --asset public/assets/avatar_0_taco_rockero.webp \
        --preset avatar --animation idle
    python batch_generate.py --plan manifests/animation-plan.json --limit 3
    python batch_generate.py --plan manifests/animation-plan.json --retry-errors

Supports resume (skips finished work), deterministic seeds, per-job error
capture and a lightweight batch report. Heavy outputs stay in
RITMIKA_GENERATED_DIR.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_manifest  # noqa: E402
import common  # noqa: E402
import run_workflow  # noqa: E402

LOG = common.setup_logging("ritmika.batch")


def deterministic_seed(entry_id: str) -> int:
    return int(common.sha256_text(entry_id)[:8], 16) % (2**31 - 1)


def jobs_from_plan(plan: dict[str, Any], args: argparse.Namespace) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    for entry in plan.get("entries", []):
        if args.category and entry.get("category") != args.category:
            continue
        if args.animation and entry.get("animationType") != args.animation:
            continue
        if args.priority and entry.get("priority") != args.priority:
            continue
        status = entry.get("status", "pending")
        if status == "done" and not args.force:
            continue
        if status == "error" and not args.retry_errors and not args.force:
            continue
        jobs.append({
            "id": entry["id"],
            "asset": entry["source"],
            "animation": entry["animationType"],
            "preset": entry["preset"],
            "planEntry": entry,
        })
    return jobs


def jobs_from_asset(args: argparse.Namespace) -> list[dict[str, Any]]:
    asset_id = f"{build_manifest.slugify(Path(args.asset).stem)}-{args.animation}"
    return [{
        "id": asset_id,
        "asset": args.asset,
        "animation": args.animation,
        "preset": args.preset,
        "planEntry": None,
    }]


def update_plan_status(plan_path: Path, plan: dict[str, Any], job_id: str, status: str) -> None:
    changed = False
    for entry in plan.get("entries", []):
        if entry.get("id") == job_id:
            entry["status"] = status
            entry["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
            changed = True
    if changed:
        common.write_json(plan_path, plan)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--category")
    parser.add_argument("--animation", choices=sorted(build_manifest.WORKFLOW_FOR_ANIMATION))
    parser.add_argument("--priority", choices=["high", "medium", "low"])
    parser.add_argument("--asset")
    parser.add_argument("--preset")
    parser.add_argument("--plan", default=str(common.MANIFESTS_DIR / "animation-plan.json"))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--seed", type=int, help="Base seed; per job = base + index")
    parser.add_argument("--force", action="store_true", help="Regenerate even if done")
    parser.add_argument("--retry-errors", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--drop-frames", action="store_true")
    args = parser.parse_args()

    if args.asset:
        if not args.animation or not args.preset:
            parser.error("--asset requires --animation and --preset")
        jobs = jobs_from_asset(args)
        plan_path = None
        plan = None
    else:
        plan_path = Path(args.plan)
        if not plan_path.is_absolute():
            plan_path = (common.TOOL_DIR / plan_path).resolve() if not plan_path.exists() else plan_path
        plan = common.read_json(plan_path, None)
        if plan is None:
            print(f"Plan not found: {plan_path}. Run build_manifest.py first.", file=sys.stderr)
            return 2
        jobs = jobs_from_plan(plan, args)

    if args.limit:
        jobs = jobs[:args.limit]
    if not jobs:
        print("No jobs selected.")
        return 0

    LOG.info("batch: %d job(s)", len(jobs))
    results: list[dict[str, Any]] = []
    for index, job in enumerate(jobs):
        seed = None
        if args.seed is not None:
            seed = args.seed + index
        else:
            seed = deterministic_seed(job["id"])
        LOG.info("[%d/%d] %s (seed=%s)", index + 1, len(jobs), job["id"], seed)
        try:
            result = run_workflow.generate_one(
                job["asset"], job["animation"], job["preset"],
                overrides={}, seed=seed, force=args.force, dry_run=args.dry_run,
                keep_frames=not args.drop_frames,
            )
            status = result.get("status", "ok")
            if status == "ok":
                status = "done"
        except Exception as exc:  # noqa: BLE001 - keep the batch alive
            LOG.error("job failed: %s: %s", job["id"], exc)
            result = {"id": job["id"], "status": "error", "error": str(exc)}
            status = "error"
        results.append({"id": job["id"], "status": status, "error": result.get("error"),
                        "processSeconds": (result.get("metadata") or {}).get("processSeconds")})
        if plan is not None and plan_path is not None:
            update_plan_status(plan_path, plan, job["id"], status)

    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "count": len(results),
        "ok": sum(1 for r in results if r["status"] in ("done", "skipped")),
        "error": sum(1 for r in results if r["status"] == "error"),
        "results": results,
    }
    report_path = common.REPORTS_DIR / f"batch-{int(time.time())}.json"
    common.write_json(report_path, report)
    print(f"Batch report: {report_path}")
    print(f"  ok={report['ok']} error={report['error']} total={report['count']}")
    return 1 if report["error"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
