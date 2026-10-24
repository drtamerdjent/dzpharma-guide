#!/bin/bash
# Helper: call the platform MCP Bash tool (persistent shell session).
# Usage: mcp-bash.sh '<command>' [timeout_ms]
CMD="$1"
TIMEOUT="${2:-120000}"
PAYLOAD=$(python3 - "$CMD" "$TIMEOUT" <<'PYEOF'
import json, sys
cmd = sys.argv[1]
timeout = int(sys.argv[2])
print(json.dumps({
  "jsonrpc": "2.0",
  "id": 100,
  "method": "tools/call",
  "params": {
    "name": "Bash",
    "arguments": {"command": cmd, "timeout": timeout}
  }
}))
PYEOF
)
curl -s --max-time $((TIMEOUT / 1000 + 15)) -X POST "http://localhost:12600/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "$PAYLOAD" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
for line in raw.splitlines():
    if line.startswith('data: '):
        try:
            data = json.loads(line[6:])
        except Exception:
            continue
        result = data.get('result', {})
        content = result.get('content', [])
        for item in content:
            if item.get('type') == 'text':
                print(item['text'])
        if result.get('isError'):
            print('[MCP-ERROR]', file=sys.stderr)
"
