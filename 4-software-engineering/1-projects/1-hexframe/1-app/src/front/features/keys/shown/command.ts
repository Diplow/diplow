// The command a Key is shown beside: pasted into a terminal, it adds hexframe's MCP server to Claude
// Code, the Key in the header that proves its Account at /mcp.

/** `claude mcp add` for the hexframe this page was served from, proven by `secret`. */
export function mcpCommand(origin: string, secret: string) {
  const server = new URL('/mcp', origin).href
  return `claude mcp add --transport http hexframe ${server} --header "Authorization: Bearer ${secret}"`
}
