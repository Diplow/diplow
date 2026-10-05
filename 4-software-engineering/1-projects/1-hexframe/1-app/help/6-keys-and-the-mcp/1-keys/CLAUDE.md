---
title: Keys
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/6-keys-and-the-mcp/1-keys
owner: diplo
preview: >-
  A Key lets an agent act for your account at the MCP server, and nowhere else.
  You issue one on the Keys page, see its secret once, and revoke it there when
  the agent no longer needs it. A Key never manages Keys.
---
A Key is a secret that proves your account to hexframe's MCP server. Issue one per agent or per machine, on the **Keys** page, and give it a name you will recognise.

- The secret shows **once**, when you issue the Key, with the command that connects Claude Code to hexframe. Copy it then.
- A Key opens the MCP server only. It never signs in to the app, and it cannot issue, list or revoke Keys: only you can, signed in.
- Revoke a Key on the same page as soon as its agent no longer needs it. An agent using it is refused from its next call.
