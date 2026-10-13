#!/usr/bin/env python3
"""Plan a Monk→Atlas illustration and check review assets without mutating source data."""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def fail(message):
    raise SystemExit(message)


def png_size(path):
    with path.open("rb") as stream:
        header = stream.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        fail(f"Invalid PNG: {path}")
    return struct.unpack(">II", header[16:24])


def webp_size(path):
    with path.open("rb") as stream:
        header = stream.read(30)
    if header[:4] != b"RIFF" or header[8:12] != b"WEBP":
        fail(f"Invalid WebP: {path}")
    kind = header[12:16]
    if kind == b"VP8X":
        return (1 + int.from_bytes(header[24:27], "little"), 1 + int.from_bytes(header[27:30], "little"))
    if kind == b"VP8L":
        bits = int.from_bytes(header[21:25], "little")
        return ((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1)
    if kind == b"VP8 ":
        return (int.from_bytes(header[26:28], "little") & 0x3fff, int.from_bytes(header[28:30], "little") & 0x3fff)
    fail(f"Unsupported WebP header: {path}")


def plan(args):
    monk, atlas = Path(args.monk), Path(args.atlas)
    raw = read(monk / "data/free-exercise-db/exercises.json")
    slim = read(monk / "public/data/exercises.json")
    instructions = read(monk / "public/data/instructions.json")
    exact = [e for e in raw if e["id"] == args.exercise]
    if not exact:
        exact = [e for e in raw if e["name"].casefold() == args.exercise.casefold()]
    if len(exact) != 1:
        candidates = [e["id"] for e in raw if args.exercise.casefold() in e["name"].casefold()][:15]
        fail(f"Expected one exact exercise; found {len(exact)}. Candidates: {candidates}")
    e = exact[0]
    s = next((x for x in slim if x["id"] == e["id"]), None)
    if not s or s["primaryMuscles"] != e["primaryMuscles"] or s["secondaryMuscles"] != e["secondaryMuscles"]:
        fail("Generated Monk data differs from raw source")
    records = [read(p) for p in (atlas / "data/exercises").glob("*.json")]
    candidates = []
    for a in records:
        legacy = e["id"] in a.get("legacyIds", [])
        name_match = a["name"]["en"].casefold() in e["name"].casefold() or e["name"].casefold() in a["name"]["en"].casefold()
        if legacy or name_match:
            candidates.append({"id": a["id"], "name": a["name"]["en"], "legacyIdPresent": legacy,
                               "equipment": a["equipment"], "primaryMuscles": a["primaryMuscles"],
                               "secondaryMuscles": a["secondaryMuscles"], "media": a.get("media", [])})
    base = ("Original educational anatomical exercise illustration, Warrior Monk visual system. "
            "Same neutral athletic adult, body proportions, grayscale sculpted anatomy, charcoal equipment, "
            "consistent camera and scale in both frames, transparent background, no text or logos. "
            "Primary muscles in anatomically bounded saturated #E53935; secondary in lighter muted red; "
            "inactive muscles neutral gray. Realistic joints, hands, feet, equipment and safe biomechanics. ")
    common = f"Exercise: {e['name']}. Equipment: {e['equipment']}. Primary: {', '.join(e['primaryMuscles'])}. Secondary: {', '.join(e['secondaryMuscles'])}. "
    manifest = {
        "monk": {k: e[k] for k in ("id", "name", "equipment", "primaryMuscles", "secondaryMuscles", "images")},
        "sources": ["data/free-exercise-db/exercises.json", "public/data/exercises.json", "public/data/instructions.json"],
        "instructions": instructions.get(e["id"], []), "atlasCandidates": candidates,
        "matchStatus": "needs-human-review", "matchNotes": [], "atlasId": None,
        "prompts": {"start": base + common + "Show the first explanatory movement position with exact joint angles and implement position from the exercise instructions; keep the body and target muscles visible.",
                    "finish": base + common + "Show the second critical movement position; keep the same subject, equipment and camera as START."},
        "assets": {"start": None, "finish": None},
        "visualReview": "pending", "rightsReview": "pending", "issues": []
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        fail(f"Manifest already exists: {out}")
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Planned {e['id']}; {len(candidates)} Atlas candidate(s); match requires review; {out}")


def validate(args):
    atlas = Path(args.atlas)
    m = read(Path(args.manifest))
    errors = []
    if not m["monk"]["id"] or not m["monk"]["primaryMuscles"]:
        errors.append("Missing Monk ID or primary muscles")
    if m.get("atlasId") and m["atlasId"] not in {x["id"] for x in m["atlasCandidates"]}:
        errors.append("Atlas ID is not a discovered candidate")
    seen = set()
    for role in ("start", "finish"):
        entry = m["assets"].get(role)
        if not entry:
            errors.append(f"Missing {role} asset")
            continue
        for fmt in ("png", "webp"):
            rel = entry.get(fmt)
            if not rel or rel in seen or Path(rel).is_absolute() or ".." in Path(rel).parts:
                errors.append(f"Missing, duplicate or unsafe {role} {fmt} path")
                continue
            seen.add(rel)
            p = atlas / rel
            if not p.is_file() or p.suffix.lower() != f".{fmt}":
                errors.append(f"Missing or wrong format: {rel}")
                continue
            try:
                width, height = (png_size if fmt == "png" else webp_size)(p)
                if width < 768 or height < 768 or (fmt == "webp" and width != height):
                    errors.append(f"Unexpected dimensions {width}x{height}: {rel}")
            except (ValueError, IndexError) as exc:
                errors.append(f"Invalid image {rel}: {exc}")
            digest = hashlib.sha256(p.read_bytes()).hexdigest()
            if entry.get(f"{fmt}Sha256") and entry[f"{fmt}Sha256"] != digest:
                errors.append(f"Hash mismatch: {rel}")
            if fmt == "webp" and p.stat().st_size > 500_000:
                errors.append(f"WebP exceeds 500 KB mobile target: {rel}")
    drafts = m.get("mediaDraft", [])
    for role in ("start", "finish"):
        matching = [item for item in drafts if item.get("role") == role]
        if len(matching) != 1:
            errors.append(f"Expected one {role} Atlas media draft")
            continue
        item = matching[0]
        if not re.fullmatch(r"media/exercises/[a-z0-9/-]+\.webp", str(item.get("path", ""))):
            errors.append(f"Invalid Atlas media path for {role}")
        if not item.get("alt", {}).get("en") or not item.get("creator"):
            errors.append(f"Missing English alt or creator for {role}")
        if m.get("visualReview") == "approved" and m.get("rightsReview") == "approved":
            for key in ("sourceUrl", "license", "redistributionEvidenceUrl"):
                if not item.get(key):
                    errors.append(f"Missing {key} for approved {role} media")
    if m.get("visualReview") != "approved":
        print("Visual/anatomy review pending; assets cannot be registered as approved media.")
    if m.get("rightsReview") != "approved":
        print("Rights review pending; assets cannot be registered as approved media.")
    if errors:
        fail("Asset validation failed:\n- " + "\n- ".join(errors))
    print("Asset files, formats, dimensions, paths and hashes valid. Anatomy and rights remain separate review gates.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("plan")
    p.add_argument("--monk", required=True)
    p.add_argument("--atlas", required=True)
    p.add_argument("--exercise", required=True)
    p.add_argument("--out", required=True)
    v = sub.add_parser("validate")
    v.add_argument("--atlas", required=True)
    v.add_argument("--manifest", required=True)
    args = parser.parse_args()
    (plan if args.command == "plan" else validate)(args)
