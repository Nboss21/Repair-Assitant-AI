import "dotenv/config";
import express from "express";
import cors from "cors";
import chatRoutes from "./routes/chatRoutes";
import authRoutes from "./routes/authRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import { initDb } from "./db";
import { getCheckpointer } from "./db/checkpointer";


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api", chatRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/", (req, res) => {
  res.send("Repair Assistant API is running");
});

const startServer = async () => {
  try {
    if (!process.env.TAVILY_API_KEY) {
      console.warn("⚠️  WARNING: TAVILY_API_KEY is not set. Web search tool will not function correctly.");
    }
    await initDb();
    console.log("Checkpointer setup...");
    await getCheckpointer().setup();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();