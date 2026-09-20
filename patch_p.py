with open('lib/ai/eval/real-corpus-benchmark.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = 'archResults.push(await runArchitecture("posterapp-pipeline", db, queries, embedQuery, "posterapp"))'
replacement = 'archResults.push(await runArchitecture("posterapp-pipeline", db, queries, embedQuery, "posterapp", hasAliProxy))'
assert target in text, "target not found"
text = text.replace(target, replacement)

with open('lib/ai/eval/real-corpus-benchmark.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print("Added hasAliProxy parameter to posterapp-pipeline!")
