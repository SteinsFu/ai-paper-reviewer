"""Pure ranking / catalog tests — no Bedrock."""

from __future__ import annotations

import venues


def test_catalog_has_ml_flagships_and_no_workshops():
    catalog = venues.load_catalog()
    ids = {v["id"] for v in catalog}
    assert {"icml", "iclr", "aaai", "neurips", "kdd", "naacl", "ase", "cvpr", "sosp", "ccs"} <= ids
    assert "ml4h" not in ids  # workshop dropped
    assert all(v["kind"] in ("conference", "journal") for v in catalog)
    assert len(catalog) >= 80


def test_new_tags_slice_icore_a_star():
    cv_ids = {v["id"] for v in venues.suggest_venues("cv", None, 80, limit=None)}
    sys_ids = {v["id"] for v in venues.suggest_venues("systems", None, 80, limit=None)}
    sec_ids = {v["id"] for v in venues.suggest_venues("security", None, 80, limit=None)}
    assert {"cvpr", "iccv", "eccv"} <= cv_ids
    assert {"sosp", "osdi", "sigcomm"} <= sys_ids
    assert {"ccs", "oakland", "usenixsec"} <= sec_ids


def test_match_prefers_mid_tier_for_mid_score():
    # overall 72 sits near EMSE's bar (~70), not TSE's (~87)
    ranked = venues.suggest_venues("se", None, 72, limit=None)
    ids = [v["id"] for v in ranked]
    assert ids[0] == "emse"
    assert ids.index("emse") < ids.index("tse")
    assert all(v["deadline"] is None for v in ranked)
    assert ranked[0]["fit"] == venues.PRIMARY_FIT
    assert len(venues.suggest_venues("se", None, 72)) <= 8


def test_match_prefers_selective_venue_for_high_score():
    ranked = venues.suggest_venues("ml", None, 91)
    assert ranked[0]["id"] == "natmi"


def test_secondary_fit_is_lower():
    ranked = venues.suggest_venues("hci", "nlp", 78, limit=None)
    by_id = {v["id"]: v for v in ranked}
    assert by_id["chi"]["fit"] == venues.PRIMARY_FIT
    assert by_id["acl"]["fit"] == venues.SECONDARY_FIT
    assert by_id["chi"]["tag"] == "hci"
    assert by_id["acl"]["tag"] == "nlp"


def test_other_returns_empty():
    assert venues.suggest_venues("other", "hci", 80) == []


def test_unknown_primary_clamps_to_other():
    assert venues.suggest_venues("vision", None, 80) == []


def test_theory_a_star_not_served():
    ids = {v["id"] for v in venues.load_catalog()}
    assert "focs" not in ids
    assert "stoc" not in ids


def test_cap_is_eight():
    ranked = venues.suggest_venues("hci", "nlp", 80)
    assert len(ranked) <= 8
    assert "tags" not in ranked[0]
    assert ranked[0]["tag"] in venues.FIELD_TAGS
