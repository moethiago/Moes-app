# ingest_openiti.py — Tier-2 classical Ḥanbalī layer from OpenITI (Shamela-origin, cleaned).
# HARD RULES enforced here:
#   (1) Shia exclusion — any text from a Shia library/author is rejected outright.
#   (2) Sunnī Ḥanbalī whitelist — only target madhhab authors are pulled.
#   (3) Public-domain only — author death-year must be classical (< CUTOFF_AH).
# Output: shamela_classical.jsonl
import re, json, hashlib, sys, requests
from normalize import normalize

CUTOFF_AH = 1336  # died before ~1917 CE => safely public domain

# Sunnī Ḥanbalī authors to include (URI fragment -> display). Expand as needed.
HANBALI = {
    "IbnHanbal":"أحمد بن حنبل","Khiraqi":"الخرقي","IbnQudama":"ابن قدامة المقدسي",
    "IbnTaymiyya":"ابن تيمية","IbnQayyim":"ابن قيم الجوزية","Mardawi":"المرداوي",
    "IbnMuflih":"ابن مفلح","BahutiHanbali":"البهوتي","IbnRajab":"ابن رجب الحنبلي",
    "Khallal":"الخلال",
}
# Explicit Shia denylist (authors + library markers) — defense in depth.
SHIA_MARKERS = ["shia","shiaonline","kulayni","tusi","saduq","mufid","majlisi",
                "murtada","tabarsi","hilli","kashani","bahrani","hurramili","tabataba"]

META_RE = re.compile(r"^#META#\s*([\d.]+)\.?([A-Za-z]+)\s*::?\s*(.*)$")
PAGE_RE = re.compile(r"PageV(\d+)P(\d+)")

def parse_meta(text):
    m = {}
    for line in text.splitlines():
        if not line.startswith("#META#"): 
            if line.strip() and not line.startswith("#"): break
            continue
        # tolerant split on '::'
        if "::" in line:
            left, val = line.split("::", 1)
            key = left.replace("#META#","").strip()
            m[key] = val.strip()
    return m

def is_shia(meta):
    blob = " ".join([meta.get(k,"") for k in meta]).lower()
    blob += " " + meta.get("000.BookURI","").lower() + " " + meta.get("030.LibURI","").lower()
    return any(s in blob for s in SHIA_MARKERS)

def hanbali_author(meta):
    uri = meta.get("000.BookURI","") + meta.get("000.SortField","")
    name = meta.get("010.AuthorNAME","")
    for frag, disp in HANBALI.items():
        if frag.lower() in uri.lower(): return disp
    return None

def clean_body(text):
    # body starts after the metadata header block
    body = re.split(r"#META#Header#End#", text, 1)
    body = body[1] if len(body) > 1 else re.split(r"#####", text, 1)[-1]
    return body

def chunk(body, target=1100):
    cur_vol, cur_page, heading = "", "", ""
    buf, chunks = [], []
    def flush():
        if buf:
            t = " ".join(buf).strip()
            if len(t) > 60: chunks.append((heading, cur_vol, cur_page, t))
    for raw in body.splitlines():
        pm = PAGE_RE.search(raw)
        if pm: cur_vol, cur_page = pm.group(1), pm.group(2)
        line = PAGE_RE.sub("", raw)
        line = re.sub(r"~~","", line)
        line = re.sub(r"^\s*#+\s*\|+\s*","", line)     # structural milestones
        line = re.sub(r"\bms\d+\b","", line)            # milestone ids
        if re.match(r"^\s*#+\s*PageV", raw): continue
        if line.strip().startswith("###"): continue
        if line.strip().startswith("# "):                # heading -> new chunk
            flush(); buf=[]; heading=line.strip("# ").strip(); continue
        line = re.sub(r"^\s*#+\s*","", line).strip()
        if not line: 
            if sum(len(x) for x in buf) > target: flush(); buf=[]
            continue
        buf.append(line)
        if sum(len(x) for x in buf) > target: flush(); buf=[]
    flush()
    return chunks

def process(text, source_hint=""):
    meta = parse_meta(text)
    if is_shia(meta): return None, "REJECTED: Shia source"
    disp = hanbali_author(meta)
    if not disp: return None, "skip: not in Ḥanbalī whitelist"
    died = meta.get("011.AuthorDIED","")
    try: died_n = int(re.sub(r"\D","",died)[:4])
    except: died_n = None
    if died_n is None or died_n >= CUTOFF_AH: return None, f"skip: not public-domain (died {died})"
    title = meta.get("020.BookTITLE","").strip()
    buri  = meta.get("000.BookURI","").strip("#")
    lib   = meta.get("030.LibURI","") or source_hint
    recs = []
    for heading, vol, page, t in chunk(clean_body(text)):
        rid = "shamela_"+hashlib.md5((buri+vol+page+t[:40]).encode()).hexdigest()[:16]
        recs.append({
            "id": rid, "type":"classical", "madhhab":"Hanbali",
            "text": t, "text_norm": normalize(t),
            "author": disp, "author_died_AH": died_n,
            "book_title": title, "book_uri": buri, "heading": heading,
            "vol": vol, "page": page,
            "source": "OpenITI (Shamela origin)", "source_lib": lib,
        })
    return recs, f"OK: {len(recs)} chunks from {title} — {disp} (d.{died_n})"

if __name__ == "__main__":
    # validate mode: python ingest_openiti.py --validate <file>
    if len(sys.argv) >= 3 and sys.argv[1]=="--validate":
        text = open(sys.argv[2],encoding="utf-8").read()
        recs, msg = process(text)
        print("RESULT:", msg)
        if recs: print(json.dumps(recs[0], ensure_ascii=False, indent=2))

# ---- Production resolver: runs inside GitHub Actions with a token (no throttle) ----
def pull_with_token(token, out_path):
    import requests, json, os
    H={"User-Agent":"aqwal-ingest","Authorization":f"Bearer {token}","Accept":"application/vnd.github+json"}
    BUCKETS=["0250AH","0325AH","0350AH","0625AH","0750AH","0775AH","0800AH","0900AH","1075AH"]
    wrote=0
    with open(out_path,"w",encoding="utf-8") as out:
        for repo in BUCKETS:
            # one recursive tree call per bucket (5000/hr with token)
            t=requests.get(f"https://api.github.com/repos/OpenITI/{repo}/git/trees/pre-clean?recursive=1",headers=H,timeout=90)
            if t.status_code!=200:
                print(f"{repo}: tree {t.status_code}"); continue
            paths=[n["path"] for n in t.json().get("tree",[]) if n["type"]=="blob"]
            cand=[p for p in paths if "-ara1" in p and "Shia" not in p
                  and any(k.lower() in p.lower() for k in HANBALI)]
            for p in cand:
                raw=f"https://raw.githubusercontent.com/OpenITI/{repo}/pre-clean/{p}"
                r=requests.get(raw,headers={"User-Agent":"aqwal-ingest"},timeout=120)
                if r.status_code!=200: continue
                recs,msg=process(r.text)
                print(f"  {repo}: {msg}")
                if recs:
                    for rec in recs: out.write(json.dumps(rec,ensure_ascii=False)+"\n"); wrote+=1
    print("WROTE",wrote,"classical chunks ->",out_path)
    return wrote

if __name__ == "__main__" and len(sys.argv)>=2 and sys.argv[1]=="--pull":
    import os
    tok=os.environ.get("GITHUB_TOKEN")
    if not tok: sys.exit("GITHUB_TOKEN required for --pull")
    pull_with_token(tok, sys.argv[2] if len(sys.argv)>2 else "shamela_classical.jsonl")
