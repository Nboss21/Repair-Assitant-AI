import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Send, Loader2, Wrench, BarChart3, LogOut, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function Chat() {
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
  }, []);

  const [threadId, setThreadId] = useState<string | null>(localStorage.getItem("activeThreadId") || null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  // Fetch history when threadId changes
  useEffect(() => {
    const fetchHistory = async () => {
      setMessages([]); // Clear previous messages immediately
      setIsLoading(true); // Show loading state if desired (optional)
      
      if (!threadId) {
        setIsLoading(false);
        return;
      }
      
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const response = await fetch(`http://localhost:3000/api/chat/history/${threadId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          // Always set messages, even if empty, to ensure we don't show old state
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error("Failed to fetch chat history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (threadId) {
      localStorage.setItem("activeThreadId", threadId);
      fetchHistory();
    } else {
      localStorage.removeItem("activeThreadId");
    }
  }, [threadId]);


  const [conversations, setConversations] = useState<any[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const deleteConversation = async (e: React.MouseEvent, threadIdToDelete: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this repair history?")) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5000/api/conversations/${threadIdToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.thread_id !== threadIdToDelete));
        if (threadId === threadIdToDelete) {
          handleNewConversation();
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation", error);
    }
  };

  const fetchConversations = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch("http://localhost:5000/api/conversations", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to fetch conversations", error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [threadId]); // Refresh list when threadId changes (e.g. new chat created)

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("activeThreadId");
    navigate("/login");
  };

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStatus("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setStatus("Thinking...");

    // Create new AbortController
    cancelRequest();
    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          threadId: threadId,
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";
      
      // Add initial empty assistant message if not streaming updates to existing
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split("\n");
        // Keep the last line in the buffer as it might be incomplete
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === "token") {
                assistantMessage += parsed.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = assistantMessage;
                  return newMessages;
                });
              } else if (parsed.type === "tool_start") {
                const toolDisplayName = parsed.tool === "search_device" ? "Searching iFixit for device" :
                                       parsed.tool === "list_guides" ? "Finding repair guides" :
                                       parsed.tool === "get_guide_details" ? "Loading repair instructions" :
                                       parsed.tool === "web_search" ? "Searching web for guides, images & videos..." :
                                       `Using ${parsed.tool}`;
                setStatus(toolDisplayName);
              } else if (parsed.type === "tool_end") {
                setStatus("Thinking...");
              } else if (parsed.type === "done") {
                // Save thread ID if this is a new conversation
                if (parsed.threadId && !threadId) {
                  setThreadId(parsed.threadId);
                  localStorage.setItem("activeThreadId", parsed.threadId);
                }
                abortControllerRef.current = null;
              } else if (parsed.type === "error") {
                console.error("Stream error:", parsed.content);
                setStatus("Error occurred");
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
         console.log('Request aborted');
      } else {
         console.error("Error sending message:", error);
         setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
         ]);
      }
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  const handleNewConversation = () => {
    cancelRequest();
    setMessages([]);
    setThreadId(null);
    localStorage.removeItem("activeThreadId");
    setInput("");
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  const loadConversation = (id: string) => {
    cancelRequest();
    setThreadId(id);
    localStorage.setItem("activeThreadId", id);
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-sans transition-colors duration-300">
      {/* Sidebar */}
      <div className={cn(
          "bg-card border-r border-border transition-all duration-300 ease-in-out z-30 h-full",
          "fixed inset-y-0 left-0 md:static",
          showSidebar 
            ? "w-64 translate-x-0 shadow-xl md:shadow-none opacity-100" 
            : "w-64 -translate-x-full md:w-0 md:translate-x-0 md:opacity-0 overflow-hidden"
      )}>
        <div className="w-64 h-full flex flex-col p-4">
           {/* New Chat Button */}
           <button
             onClick={handleNewConversation}
             className="flex items-center gap-2 bg-card border border-border p-3 rounded-xl hover:bg-muted/50 transition-colors shadow-sm mb-6 w-full text-left text-card-foreground"
           >
              <div className="bg-black text-white p-1 rounded-md">
                 <Wrench className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">New Repair</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-square-pen ml-auto opacity-50"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>
           </button>

           <div className="text-xs font-semibold text-muted-foreground mb-3 px-2">RECENT REPAIRS</div>
           
           <div className="flex-1 overflow-y-auto space-y-1">
              {conversations.map((conv) => (
                 <div
                   key={conv.thread_id}
                   className="group relative flex items-center w-full"
                 >
                   <button
                     onClick={() => loadConversation(conv.thread_id)}
                     className={cn(
                        "w-full text-left p-3 pr-9 rounded-lg text-sm transition-colors truncate",
                        threadId === conv.thread_id 
                          ? "bg-primary/20 text-primary font-medium border border-primary/20" 
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                     )}
                   >
                      {conv.title || "Untitled Repair"}
                   </button>
                   <button
                      onClick={(e) => deleteConversation(e, conv.thread_id)}
                      className="absolute right-2 p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete chat"
                   >
                      <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
              ))}
           </div>
           
           <div className="mt-auto pt-4 border-t border-gray-200 dark:border-wakanda-800 space-y-2">

               <button onClick={handleLogout} className="flex items-center gap-2 text-muted-foreground hover:text-destructive p-2 rounded-lg transition-colors w-full text-sm">
                 <LogOut className="w-4 h-4" />
                 Sign Out
               </button>
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-left"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
                </button>
                <div className="flex items-center md:hidden">
                    <span className="font-semibold text-foreground">Repair Assistant</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
            <Link to="/analytics" className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors" title="Analytics">
                <BarChart3 className="w-5 h-5" />
            </Link>
            
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-border ml-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-semibold text-xs shadow-md ring-2 ring-background">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium hidden md:block opacity-90 max-w-[150px] truncate">
                  {user.email.split('@')[0]}
                </span>
              </div>
            )}
            </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto w-full relative">
            <div className="flex flex-col min-h-full max-w-3xl mx-auto px-4 py-8">
                {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center flex-1 text-gray-500 dark:text-slate-500 mt-20">
                    <div className="bg-card border border-border p-4 rounded-full mb-6 relative group transition-colors">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Wrench className="w-12 h-12 opacity-50 text-muted-foreground group-hover:text-primary relative z-10" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Repair Assistant</h2>
                    <p className="text-muted-foreground">Describe your device issue to get started.</p>
                </div>
                )}
                
                <div className="space-y-6 pb-20">
                    {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={cn(
                        "flex w-full gap-4",
                        msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                    >
                        {msg.role === "assistant" && (
                            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0 mt-1">
                                <Wrench className="w-4 h-4 text-white" />
                            </div>
                        )}
                        
                        <div
                        className={cn(
                            "relative px-5 py-3.5 shadow-sm max-w-[85%] transition-colors",
                            msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-3xl rounded-tr-sm shadow-md shadow-primary/10"
                            : "bg-card text-card-foreground rounded-3xl rounded-tl-sm shadow-sm border border-border"
                        )}
                        >
                        <div className={cn(
                            "prose prose-sm max-w-none prose-invert prose-headings:font-semibold prose-a:text-primary prose-strong:text-foreground",
                            isLoading && index === messages.length - 1 && msg.role === "assistant" && "streaming-cursor"
                        )}>
                            <ReactMarkdown 
                            components={{
                                img: ({node, ...props}) => (
                                <img {...props} className="rounded-xl max-w-full h-auto my-3 border border-border shadow-sm" />
                                ),
                                a: ({node, ...props}) => (
                                <a {...props} className="text-blue-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer" />
                                ),
                                ul: ({node, ...props}) => <ul {...props} className="list-disc pl-4 space-y-1 my-2" />,
                                ol: ({node, ...props}) => <ol {...props} className="list-decimal pl-4 space-y-1 my-2" />
                            }}
                            >
                            {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                            </ReactMarkdown>
                        </div>
                        </div>
                    </div>
                    ))}

                    {/* Status Indicator */}
                    {status && (
                     <div className="flex items-center gap-3 ml-0 text-primary text-sm animate-pulse">
                         <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{status}</span>
                    </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>
        </div>

        {/* Input Area */}
        <div className="w-full bg-background/80 backdrop-blur-xl border-t border-border p-4 pb-6 transition-colors">
            <div className="max-w-3xl mx-auto">
                <form onSubmit={handleSubmit} className="relative flex items-center shadow-lg rounded-2xl bg-card border border-border focus-within:border-primary/50 transition-colors">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Message Repair Assistant..."
                    className="flex-1 px-5 py-4 rounded-2xl focus:outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className={cn(
                        "absolute right-2 p-2.5 rounded-xl transition-all duration-200",
                            !input.trim() || isLoading 
                            ? "bg-transparent text-muted-foreground cursor-not-allowed" 
                            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/30"
                    )}
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
                </form>
                <p className="text-center text-xs text-muted-foreground mt-3 font-medium transition-colors">
                    AI may make mistakes. Check important info.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}


