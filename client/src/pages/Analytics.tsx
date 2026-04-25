import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, MessageSquare, Zap } from "lucide-react";

export function Analytics() {
  const [stats, setStats] = useState<any>(null);

  const fetchStats = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("No auth token found");
      return;
    }

    fetch("http://localhost:3000/api/analytics/usage", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) {
           if (res.status === 401) {
             console.error("Unauthorized - redirecting to login");
             // optional: window.location.href = '/login';
           }
           throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => setStats(data))
      .catch((err) => console.error("Failed to fetch stats", err));
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds for live updates
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const TOKEN_LIMIT = 1000000;
  const usedTokens = parseInt(stats?.total_tokens || "0", 10);
  const remainingTokens = Math.max(0, TOKEN_LIMIT - usedTokens);
  const percentageUsed = Math.min(100, (usedTokens / TOKEN_LIMIT) * 100);


  return (
    <div className="min-h-screen bg-background p-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link to="/chat" className="flex items-center text-muted-foreground hover:text-primary transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Usage Analytics</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card p-6 rounded-xl shadow-sm border border-border transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300">Total Interactions</h3>
              <div className="bg-primary/20 p-2 rounded-lg">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-4xl font-bold text-card-foreground">
              {stats?.total_messages || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Messages exchanged</p>
          </div>


          <div className="bg-card p-6 rounded-xl shadow-sm border border-border transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300">Remaining Budget</h3>
              <div className="bg-green-500/20 p-2 rounded-lg">
                <BarChart3 className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <p className="text-4xl font-bold text-card-foreground">
              {remainingTokens.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Tokens available</p>
          </div>

          <div className="bg-card p-6 rounded-xl shadow-sm border border-border transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300">Estimated Tokens</h3>
              <div className="bg-primary/20 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-4xl font-bold text-card-foreground">
              {stats?.total_tokens || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Tokens consumed (approx)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
