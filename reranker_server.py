import http.server
import json
import os
import sys
import torch
import warnings
warnings.filterwarnings("ignore")

from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_PATH = os.path.expanduser("~/.cache/huggingface/hub/models--Qwen--Qwen3-Reranker-0.6B/snapshots/e61197ed45024b0ed8a2d74b80b4d909f1255473")
PORT = 8085

print(f"[RerankerServer] Loading Qwen3-Reranker-0.6B from {MODEL_PATH} on CUDA...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, padding_side="left")
model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, torch_dtype=torch.float16).cuda().eval()

token_false_id = tokenizer.convert_tokens_to_ids("no")
token_true_id = tokenizer.convert_tokens_to_ids("yes")
max_length = 2048

prefix = '<|im_start|>system\nJudge whether the Document meets the requirements based on the Query and the Instruct provided. Note that the answer can only be "yes" or "no".<|im_end|>\n<|im_start|>user\n'
suffix = '<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n'
prefix_tokens = tokenizer.encode(prefix, add_special_tokens=False)
suffix_tokens = tokenizer.encode(suffix, add_special_tokens=False)

def format_instruction(instruction, query, doc):
    if instruction is None:
        instruction = "Given a web search query, retrieve relevant passages that answer the query"
    return f"<Instruct>: {instruction}\n<Query>: {query}\n<Document>: {doc}"

def score_batch(query, docs, instruction=None):
    if not docs:
        return []
    pairs = [format_instruction(instruction, query, d) for d in docs]
    inputs = tokenizer(
        pairs, padding=False, truncation="longest_first",
        return_attention_mask=False, max_length=max_length - len(prefix_tokens) - len(suffix_tokens)
    )
    for i, ele in enumerate(inputs["input_ids"]):
        inputs["input_ids"][i] = prefix_tokens + ele + suffix_tokens
    padded = tokenizer.pad(inputs, padding=True, return_tensors="pt")
    for key in padded:
        padded[key] = padded[key].to(model.device)

    with torch.no_grad():
        batch_scores = model(**padded).logits[:, -1, :]
        true_vector = batch_scores[:, token_true_id]
        false_vector = batch_scores[:, token_false_id]
        batch_scores = torch.stack([false_vector, true_vector], dim=1)
        batch_scores = torch.nn.functional.log_softmax(batch_scores, dim=1)
        scores = batch_scores[:, 1].exp().tolist()
    return scores

class RerankerHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "device": "cuda:0",
                "gpu": torch.cuda.get_device_name(0),
                "model": "Qwen/Qwen3-Reranker-0.6B"
            }).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/rerank":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode("utf-8"))
                query = data.get("query", "")
                docs = data.get("documents", [])
                instruct = data.get("instruction", None)
                scores = score_batch(query, docs, instruct)
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"scores": scores}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

server = http.server.HTTPServer(("127.0.0.1", PORT), RerankerHandler)
print(f"[RerankerServer] Ready and listening on http://127.0.0.1:{PORT}")
sys.stdout.flush()
server.serve_forever()
