#!/usr/bin/env python3
"""Emit workspace packages in the required publication order."""
from __future__ import annotations

import json
from pathlib import Path

ORDERED_PATHS = [
    "shareds/common",
    "shareds/cache",
    "shareds/async",
    "shareds/reactive",
    "packages/validator",
    "packages/expression",
    "packages/pattern-matching",
    "packages/specification",
]

def main() -> None:
    for rel in ORDERED_PATHS:
        pkg_json = Path(rel) / "package.json"
        if not pkg_json.is_file():
            continue
        data = json.loads(pkg_json.read_text())
        name = data.get("name", rel)
        print(f"{name}|{rel}")

if __name__ == "__main__":
    main()
