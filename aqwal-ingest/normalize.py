# normalize.py — Arabic normalization shared by indexing AND query side.
# Must be applied identically on both sides or search recall collapses.
import re
_TASHKIL = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")  # harakat, dagger alif, small marks
_TATWEEL = re.compile(r"\u0640")
def normalize(text: str) -> str:
    if not text: return ""
    t = _TASHKIL.sub("", text)          # drop diacritics
    t = _TATWEEL.sub("", t)             # drop kashida
    t = (t.replace("أ","ا").replace("إ","ا").replace("آ","ا").replace("ٱ","ا")
           .replace("ى","ي").replace("ئ","ي").replace("ؤ","و")
           .replace("ة","ه").replace("ﻻ","لا"))
    t = re.sub(r"\s+", " ", t).strip()
    return t
