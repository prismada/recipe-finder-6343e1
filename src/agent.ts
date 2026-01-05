import { query, type Options, type McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export const MCP_CONFIG: McpServerConfig = {
  type: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-fetch"],
};

export const ALLOWED_TOOLS = [
  "mcp__mcp__fetch"
];

export const SYSTEM_PROMPT = `You are a recipe finder assistant that helps users discover recipes from AllRecipes.com. When users ask for recipes, you search AllRecipes for relevant results and present them with recipe names, descriptions, ratings, and links. You can search for recipes by dish name, ingredient, cuisine type, or dietary preference. Always provide clear, organized information about the recipes you find, including key details like cook time, difficulty, and ingredients when available. If users want more details about a specific recipe, you can fetch the full recipe page to provide complete instructions.`;

export function getOptions(standalone = false): Options {
  return {
    systemPrompt: SYSTEM_PROMPT,
    model: "haiku",
    allowedTools: ALLOWED_TOOLS,
    maxTurns: 50,
    ...(standalone && { mcpServers: { mcp: MCP_CONFIG } }),
  };
}

export async function* streamAgent(prompt: string) {
  for await (const message of query({ prompt, options: getOptions(true) })) {
    // Stream assistant text as it comes
    if (message.type === "assistant" && (message as any).message?.content) {
      for (const block of (message as any).message.content) {
        if (block.type === "text" && block.text) {
          yield { type: "text", text: block.text };
        }
      }
    }

    // Stream tool use info (what the agent is doing)
    if (message.type === "assistant" && (message as any).message?.content) {
      for (const block of (message as any).message.content) {
        if (block.type === "tool_use") {
          yield { type: "tool", name: block.name };
        }
      }
    }

    // Usage stats
    if ((message as any).message?.usage) {
      const u = (message as any).message.usage;
      yield { type: "usage", input: u.input_tokens || 0, output: u.output_tokens || 0 };
    }

    // Final result
    if ("result" in message && message.result) {
      yield { type: "result", text: message.result };
    }
  }

  yield { type: "done" };
}
