import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { getDb } from "./index";
import { Pool } from "pg";

let checkpointer: PostgresSaver;

export const getCheckpointer = () => {
  if (!checkpointer) {
    const pool = getDb(); // This returns a pg.Pool
    checkpointer = new PostgresSaver(pool);
    
    // We need to ensure the schema exists for the checkpointer
    // Ideally this should be awaited, but getCheckpointer is synchronous in usage usually.
    // However, PostgresSaver.setup(pool) handles initialization.
    // Let's call setup() which is async, but we'll return the saver immediately.
    // The ensureSchema call is safer to do at app startup or inside proper async flow.
    // checkpointer.setup() is called explicitly in index.ts
  }
  return checkpointer;
};
