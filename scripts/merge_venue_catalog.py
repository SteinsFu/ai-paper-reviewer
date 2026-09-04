#!/usr/bin/env python3
"""Merge the offline ICORE A* dump into data/venues.json.

Run by hand when ICORE updates. Never imported by server.py / GET /venues.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DUMP_PATH = ROOT / "data" / "icore2026_a_star.json"
CATALOG_PATH = ROOT / "data" / "venues.json"

# FoR → catalog tag. 4613 (theory) is dumped but not served: no tag yet.
FOR_TO_TAG = {
    "4602": "ml",
    "4603": "cv",
    "4604": "security",
    "4605": "ml",
    "4606": "systems",
    "4607": "cv",
    "4608": "hci",
    "4611": "ml",
    "4612": "se",
    "CSE": "systems",
}
ACRONYM_TAG = {
    "ACL": "nlp",
    "EMNLP": "nlp",
    "ASPLOS": "systems",
    "SIGMETRICS": "systems",
}
ID_OVERRIDE = {
    "SP": "oakland",
    "USENIX-SECURITY": "usenixsec",
    "SIGGRAPHA": "siggraphasia",
    "EUROCRYPT": "eurocrypt",
}
FIELD_LABELS = {
    "hci": "Human-Computer Interaction",
    "nlp": "Natural Language Processing",
    "ml": "Machine Learning",
    "ml4h": "Machine Learning for Health",
    "se": "Software Engineering",
    "haptics": "Haptics",
    "cv": "Computer Vision",
    "systems": "Systems",
    "security": "Security",
}
URLS = {
    "cvpr": "https://cvpr.thecvf.com/",
    "iccv": "https://iccv.thecvf.com/",
    "eccv": "https://eccv.ecva.net/",
    "acmmm": "https://dl.acm.org/conference/mm",
    "ccs": "https://www.sigsac.org/ccs/",
    "oakland": "https://www.ieee-security.org/TC/SP-Index.html",
    "usenixsec": "https://www.usenix.org/conferences/byname/118",
    "ndss": "https://www.ndss-symposium.org/",
    "crypto": "https://iacr.org/meetings/crypto/",
    "eurocrypt": "https://iacr.org/meetings/eurocrypt/",
    "sosp": "https://dl.acm.org/conference/sosp",
    "osdi": "https://www.usenix.org/conferences/osdi",
    "sigcomm": "https://www.sigcomm.org/",
    "mobicom": "https://dl.acm.org/conference/mobicom",
    "infocom": "https://www.ieee-infocom.org/",
    "isca": "https://dl.acm.org/conference/isca",
    "asplos": "https://dl.acm.org/conference/asplos",
    "hpca": "https://hpca-conf.org/",
    "micro": "https://dl.acm.org/conference/micro",
    "nsdi": "https://www.usenix.org/conferences/nsdi",
    "siggraph": "https://www.siggraph.org/",
    "siggraphasia": "https://asia.siggraph.org/",
    "vr": "https://ieeevr.org/",
    "ismar": "https://www.ieeeismar.org/",
    "www": "https://dl.acm.org/conference/www",
    "vldb": "https://www.vldb.org/",
    "sigmod": "https://sigmod.org/",
    "pods": "https://dl.acm.org/conference/pods",
    "icde": "https://ieee-icde.org/",
    "sigir": "https://sigir.org/",
    "colt": "https://learningtheory.org/",
    "cav": "https://i-cav.org/",
    "pldi": "https://pldi.org/",
    "popl": "https://popl.org/",
    "podc": "https://www.podc.org/",
    "dac": "https://www.dac.com/",
    "hri": "https://humanrobotinteraction.org/",
    "percom": "https://www.percom.org/",
    "icaps": "https://www.icaps-conference.org/",
    "kr": "https://kr.org/",
    "icra": "https://www.ieee-ras.org/conferences-workshops/fully-sponsored/icra",
    "icdm": "https://www.ieee-icdm.org/",
    "ec": "https://dl.acm.org/conference/sigecom",
    "sigmetrics": "https://www.sigmetrics.org/",
}

ASTAR_ACCEPT = 22
ASTAR_H5 = 0


def _alnum(s: str) -> str:
    return "".join(ch for ch in s.lower() if ch.isalnum())


def _slug(acronym: str) -> str:
    key = acronym.upper().replace(" ", "")
    if key in ID_OVERRIDE:
        return ID_OVERRIDE[key]
    return acronym.lower().replace(" ", "-").replace("_", "-")


def _tag(acronym: str, for_code: str) -> str | None:
    if acronym.upper() in ACRONYM_TAG:
        return ACRONYM_TAG[acronym.upper()]
    return FOR_TO_TAG.get(for_code)


def merge(catalog: list[dict], dump: dict) -> tuple[list[dict], int, int]:
    known = {_alnum(v.get("id", "")) for v in catalog}
    known.update(_alnum(v.get("name", "")) for v in catalog)
    added = 0
    skipped_theory = 0
    for row in dump["venues"]:
        acronym = row["acronym"]
        slug = _slug(acronym)
        if _alnum(slug) in known or _alnum(acronym) in known:
            continue
        tag = _tag(acronym, row["for"])
        if tag is None:
            skipped_theory += 1
            continue
        catalog.append({
            "id": slug,
            "name": acronym.replace("USENIX-Security", "USENIX Security").replace("SiggraphA", "SIGGRAPH Asia"),
            "fullName": row["title"],
            "kind": "conference",
            "field": FIELD_LABELS[tag],
            "tags": [tag],
            "prestige": 5,
            "tierLabel": "Flagship venue",
            "esteem": f"ICORE 2026 A* — {row['title']}.",
            "acceptanceRate": ASTAR_ACCEPT,
            "h5": ASTAR_H5,
            "url": URLS.get(slug, f"https://dblp.org/search?q={acronym}"),
        })
        known.add(_alnum(slug))
        known.add(_alnum(acronym))
        added += 1
    catalog.sort(key=lambda v: (v["tags"][0], v["name"]))
    return catalog, added, skipped_theory


def main() -> int:
    dump = json.loads(DUMP_PATH.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    catalog, added, skipped = merge(catalog, dump)
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {CATALOG_PATH.relative_to(ROOT)}: {len(catalog)} venues (+{added} ICORE A*, skipped {skipped} theory)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
