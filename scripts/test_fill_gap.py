"""Run: python scripts/test_fill_gap.py"""
from scrape import fill_gap

skenes = {2024: (740_000, 0.0)}
assert fill_gap(skenes, True, 2025) == (760_000, 1.0, True)        # skipped pre-arb year
assert fill_gap(skenes, True, 2024) == (740_000, 0.0, False)       # listed year untouched
assert fill_gap({}, True, 2026) == (780_000, None, True)           # drafted rookie, no history
assert fill_gap({}, False, 2026) == (None, None, False)            # Murakami: not drafted, no history
yamamoto = {2024: (9_166_667, 0.0), 2026: (16_166_667, 2.0)}
assert fill_gap(yamamoto, False, 2025) == (None, 1.0, False)       # big international deal
vet = {2019: (8_000_000, 4.1)}
assert fill_gap(vet, True, 2021)[0] is None                        # past arbitration: no estimate
print("ok")
