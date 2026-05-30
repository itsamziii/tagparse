---
"tagparse": patch
---

Fix `{each}` over array variables, and harden the Discord `codeblock` fence escape.

- `{each:{items}|...}` now iterates real array values. Arrays reach the tag JSON-encoded by the renderer and are parsed back into items, so an array like `["a","b","c"]` renders as three items instead of the literal JSON string. Comma-separated string lists behave as before.
- `codeblock` now neutralizes any run of three or more backticks. Previously six or more backticks could re-form a valid code fence, letting attacker-controlled text break out of the block.
