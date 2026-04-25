# LangGraph Chat Bot Starter


<img width="1536" height="1024" alt="ChatGPT Image Apr 25, 2026, 09_43_24 AM" src="https://github.com/user-attachments/assets/2325b584-9d9d-44bf-9fbb-07c91864880b" />


A clean, simple starter template for building AI chat applications with LangGraph, streaming, and tool support.

Perfect for beginners to learn and experienced developers to build upon.

## ✨ Features

- 🚀 **Real-time streaming** - Token-by-token response streaming
- 🔧 **Tool calls** - Built-in Tavily web search tool
- 💬 **UI** - Simple chat interface with shadcn AI components
- 📦 **Simple structure** - Clean, modular codebase easy to understand
- ⚡ **Fast setup** - Get running in minutes

## 🏗️ Architecture

```
langgraph-chat-starter/
├── server/              # Backend (Python/FastAPI)
│   ├── main.py          # API routes and streaming
│   ├── agent.py         # LangGraph agent logic
│   ├── config.py        # Configuration settings
│   └── requirements.txt
└── client/              # Frontend (React/TypeScript)
    └── src/
        ├── App.tsx              # Main chat component
        └── hooks/
            └── useChatStream.ts # Streaming logic
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key
- Tavily API key ([Get one here](https://tavily.com/))

### Backend Setup

1. **Navigate to server folder:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create `.env` file:**
   ```bash
   cp env.example .env
   ```

4. **Add your API keys to `.env`:**
   ```env
   OPENAI_API_KEY=your_key_here
   TAVILY_API_KEY=your_key_here
   ```

5. **Run the server:**
   ```bash
   python main.py
   ```

   Server runs on `http://localhost:8000`

### Frontend Setup

1. **Navigate to client folder:**
   ```bash
   cd client
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the dev server:**
   ```bash
   npm run dev
   ```

   Frontend runs on `http://localhost:5173`

## 📖 How It Works

1. **User sends a message** → Frontend sends to `/chat` endpoint
2. **Backend processes** → LangGraph agent decides if tool is needed
3. **Tool execution** → If needed, Tavily search runs
4. **Response streaming** → Tokens stream back in real-time
5. **UI updates** → Frontend displays streaming response and tool calls

## 🔧 Configuration

### Backend (`.env`)

```env
# Required
OPENAI_API_KEY=your_key
TAVILY_API_KEY=your_key

# Optional
MODEL_NAME=gpt-4o-mini
SERVER_PORT=8000
TAVILY_MAX_RESULTS=3
```

### Frontend

Create `client/.env` for custom API URL:
```env
VITE_API_URL=http://localhost:8000
```

## 📝 Project Structure

- **`server/main.py`** - FastAPI app, routes, and streaming handler
- **`server/agent.py`** - LangGraph agent setup and graph definition
- **`server/config.py`** - Simple configuration management
- **`client/src/App.tsx`** - Main chat UI component
- **`client/src/hooks/useChatStream.ts`** - Streaming logic hook

## 🎯 Customization

### Add a New Tool

1. Edit `server/agent.py`:
   ```python
   def my_tool(query: str) -> str:
       """Your tool description"""
       return "result"
   
   tools = [tavily_search, my_tool]
   ```

### Change the Model

Edit `server/.env`:
```env
MODEL_NAME=gpt-4o
MODEL_TEMPERATURE=0.7
```

### Customize UI

Edit `client/src/App.tsx` - all components are in your codebase, modify as needed!

## 🐛 Troubleshooting

**Server won't start:**
- Check API keys are set in `.env`
- Ensure port 8000 is available

**Frontend can't connect:**
- Verify server is running
- Check `VITE_API_URL` in `client/.env`

**Tool calls not working:**
- Verify `TAVILY_API_KEY` is set
- Check browser console for errors

## 📚 Learn More

- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [shadcn AI Components](https://www.shadcn.io/ai)
- [FastAPI Docs](https://fastapi.tiangolo.com/)

## 📄 License

MIT License - feel free to use this as a starter for your projects!

## 🤝 Contributing

This is a starter template - fork it, modify it, make it your own!

---

