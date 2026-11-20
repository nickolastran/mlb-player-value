"""Run: python scripts/test_fill_gap.py"""
from scrape import deal, fill_gap

skenes = {2024: (740_000, 0.0)}
assert fill_gap(skenes, True, 2025) == (760_000, 1.0, True)        # skipped pre-arb year
assert fill_gap(skenes, True, 2024) == (740_000, 0.0, False)       # listed year untouched
assert fill_gap({}, True, 2026) == (780_000, None, True)           # drafted rookie, no history
assert fill_gap({}, False, 2026) == (None, None, False)            # Murakami: not drafted, no history
yamamoto = {2024: (9_166_667, 0.0), 2026: (16_166_667, 2.0)}
assert fill_gap(yamamoto, False, 2025) == (None, 1.0, False)       # big international deal
vet = {2019: (8_000_000, 4.1)}
assert fill_gap(vet, True, 2021)[0] is None                        # past arbitration: no estimate

# Contract terms from the "Contract Status" line
assert deal("Signed thru 2031, 13 yrs/$330M (19-31)") == (13, 330e6, 2019, 2031)
assert deal("Signed thru 2026, 1 yr/$910k (26) & 27 team option") == (1, 910e3, 2026, 2026)
assert deal("Signed thru 2033, 1 yr/$785k (26), 7 yrs/$105M (27-33)") == (7, 105e6, 2027, 2033)  # the extension
assert deal("Signed thru 2029, 7 yrs/$119.3M (23-29) & 30-34 player option")[1] == 119.3e6
assert deal("Pre-Arb Eligible") is None
print("ok")
