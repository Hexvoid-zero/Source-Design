import McpCli from "../../components/McpCli";

export const metadata = {
  title: "MCP & CLI — Source Design for any AI",
  description:
    "Connect Source Design to Claude, ChatGPT, Cursor, or Claude Code via MCP, install the getdesign CLI, or drop in the Claude skill. Extract design systems directly from your prompts.",
};

export default function McpPage() {
  return <McpCli />;
}
