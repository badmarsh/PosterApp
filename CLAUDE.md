## Session start / quota handoff
- FIRST action in every new session, before anything else: invoke the `mem0-session-handoff` skill in RESTORE mode (reload the last checkpoint from mem0).
- When the user mentions quota / usage limit / account switch, or after a major milestone: invoke it in SAVE mode (store context and findings in mem0).