import sys, json, os, torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
MODEL_ID = os.environ.get("RERANKER_MODEL", "Qwen/Qwen3-Reranker-0.6B")
HF_TOKEN = os.environ.get("HF_TOKEN")
MAX_LEN = int(os.environ.get("RERANKER_MAX_LEN", "512"))

def load_model():
    tok = AutoTokenizer.from_pretrained(MODEL_ID, token=HF_TOKEN)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_ID, token=HF_TOKEN, torch_dtype=torch.float16, device_map="cuda"
    )
    model.eval()
    return tok, model

def score(tok, model, query, passages):
    passages = [str(p) if p is not None else "" for p in passages]
    pairs = [[query, p] for p in passages]
    with torch.no_grad():
        enc = tok(pairs, padding=True, truncation=True, max_length=MAX_LEN, return_tensors="pt").to("cuda")
        logits = model(**enc).logits
        if logits.shape[1] == 1: return logits[:,0].float().cpu().tolist()
        if logits.shape[1] == 2: return logits[:,1].float().cpu().tolist()
        yes_id = tok.convert_tokens_to_ids("yes")
        no_id = tok.convert_tokens_to_ids("no")
        if yes_id and no_id and yes_id != tok.unk_token_id:
            return (logits[: yes_id] - logits[:, no_id]).float().cpu().tolist()
        return logits[:,0].float().cpu().tolist()

if __name__ == "__main__":
    print(json.dumps({"status":"loading","model":MODEL_ID}),flush=True)
    tok, model = load_model()
    print(json.dumps({"status":"ready","model":MODEL_ID,"device":str(next(model.parameters()).device)}),flush=True)
    for line in sys.stdin:
        line=line.strip()
        if not line: continue
        try:
            req=json.loads(line)
            print(json.dumps({"scores":score(tok,model,req['query'],req['passages'])}),flush=True)
        except Exception as e:
            print(json.dumps({'error':str(e)}),flush=True)