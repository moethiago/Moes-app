# upsert_upstash.py — load both JSONL files into one Upstash Vector HYBRID index.
# Upstash hosts the embedding model, so we upsert RAW normalized Arabic as `data`
# and it embeds server-side (dense + sparse). Set these env vars (GitHub Action secrets):
#   UPSTASH_VECTOR_REST_URL, UPSTASH_VECTOR_REST_TOKEN
import os, json, requests, sys
URL=os.environ["UPSTASH_VECTOR_REST_URL"].rstrip("/")
TOK=os.environ["UPSTASH_VECTOR_REST_TOKEN"]
H={"Authorization":f"Bearer {TOK}","Content-Type":"application/json"}

def upsert(path, batch=100):
    rows=[json.loads(l) for l in open(path,encoding="utf-8")]
    n=0
    for i in range(0,len(rows),batch):
        chunk=rows[i:i+batch]
        body=[{"id":r["id"],
               "data":r.get("text") or r.get("hadith") or r.get("text_norm") or r.get("hadith_norm"),
               "metadata":r} for r in chunk]
        r=requests.post(f"{URL}/upsert-data",headers=H,data=json.dumps(body),timeout=60)
        r.raise_for_status(); n+=len(chunk); print(f"  upserted {n}/{len(rows)} from {path}")
    return n

if __name__=="__main__":
    files=sys.argv[1:] or ["dorar_hadith.jsonl","shamela_classical.jsonl"]
    total=sum(upsert(f) for f in files if os.path.exists(f) and os.path.getsize(f)>0)
    print("TOTAL upserted:",total)
