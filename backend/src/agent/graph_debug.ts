import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { model } from "../utils/gemini";
import { searchDeviceTool, listGuidesTool, getGuideDetailsTool } from "../tools/ifixit";
import { webSearchTool } from "../tools/search";
import { checkpointer } from "../db/checkpointer";

console.log("Graph debug: Start");

console.log("Defining tools...");
const tools = [searchDeviceTool, listGuidesTool, getGuideDetailsTool, webSearchTool];
const toolNode = new ToolNode(tools);
console.log("Tools defined.");

console.log("Binding tools...");
const modelWithTools = model.bindTools(tools);
console.log("Tools bound.");

async function callModel(state: typeof MessagesAnnotation.State) {
  const { messages } = state;
  const response = await modelWithTools.invoke(messages);
  return { messages: [response] };
}

function shouldContinue(state: typeof MessagesAnnotation.State) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  return "__end__";
}

console.log("Defining workflow...");
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");
console.log("Workflow defined.");

console.log("Compiling graph...");
export const graph = workflow.compile({ checkpointer });
console.log("Graph compiled.");

console.log("Graph debug: End");
