# ingest_dorar.py — Tier-3 hadith layer from the Dorar.net Hadith Encyclopedia API.
# Dorar officially exposes this JSON API for third-party sites to display results.
# Output: dorar_hadith.jsonl  (one structured, graded, sourced hadith per line)
import requests, re, json, time, hashlib, sys
from bs4 import BeautifulSoup
from normalize import normalize

API = "https://dorar.net/dorar_api.json"
HDRS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Referer": "https://dorar.net/", "X-Requested-With": "XMLHttpRequest",
}
LABELS = {"الراوي":"rawi","المحدث":"muhaddith","المصدر":"source",
          "الصفحة أو الرقم":"ref","خلاصة حكم المحدث":"grade","التخريج":"takhrij"}

def classify(grade: str) -> str:
    g = grade or ""
    if any(w in g for w in ["موضوع","باطل","لا أصل له","مكذوب"]): return "mawdu"
    if any(w in g for w in ["ضعيف","لا يصح","منكر","شاذ","واه"]):  return "daif"
    if "صحيح" in g or "ثابت" in g or "متفق" in g or "مجمع على صحته" in g: return "sahih"
    if "حسن" in g: return "hasan"
    return "other"

def parse(html, query):
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for h in soup.select("div.hadith"):
        text = re.sub(r"^\s*\d+\s*-\s*", "", h.get_text(" ", strip=True))
        info = h.find_next_sibling("div", class_="hadith-info")
        rec = {"hadith": text}
        if info:
            raw = info.get_text("\n", strip=True)
            parts = re.split(r"(" + "|".join(map(re.escape, [l+":" for l in LABELS])) + r")", raw)
            cur = None
            for p in parts:
                p = p.strip(); key = p.rstrip(":")
                if key in LABELS: cur = LABELS[key]
                elif cur and p: rec[cur] = p; cur = None
        grade = rec.get("grade","")
        rid = hashlib.md5((rec["hadith"]+rec.get("muhaddith","")+rec.get("source","")+rec.get("ref","")).encode()).hexdigest()[:16]
        out.append({
            "id": "dorar_"+rid, "type": "hadith",
            "hadith": rec["hadith"], "hadith_norm": normalize(rec["hadith"]),
            "rawi": rec.get("rawi",""), "muhaddith": rec.get("muhaddith",""),
            "source_book": rec.get("source",""), "ref": rec.get("ref",""),
            "grade": grade, "grade_class": classify(grade),
            "source": "Dorar — Hadith Encyclopedia",
            "source_url": "https://dorar.net/hadith/search?q="+requests.utils.quote(query),
        })
    return out

def run(queries, out_path, polite=1.2):
    seen, n = set(), 0
    with open(out_path, "w", encoding="utf-8") as f:
        for q in queries:
            try:
                r = requests.get(API, params={"skey": q}, headers=HDRS, timeout=30)
                recs = parse(r.json()["ahadith"]["result"], q)
            except Exception as e:
                print("  ! skip", q, e); continue
            for rec in recs:
                if rec["id"] in seen: continue
                seen.add(rec["id"]); f.write(json.dumps(rec, ensure_ascii=False)+"\n"); n += 1
            print(f"  {q}: +{len(recs)} (total {n})")
            time.sleep(polite)
    return n

# Seed topics — Sunni fiqh/ʿaqīda matn phrases. Expand freely; Dorar is Sunnī scholarship.
SEEDS = [
    "إنما الأعمال بالنيات", "بني الإسلام على خمس", "الطهور شطر الإيمان",
    "من حسن إسلام المرء", "لا ضرر ولا ضرار", "البيعان بالخيار",
    "من غشنا فليس منا", "إنما الربا في النسيئة", "صلاة الجماعة",
]
if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "dorar_hadith.jsonl"
    total = run(SEEDS, out)
    print("WROTE", total, "hadith ->", out)
