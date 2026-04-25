
import dotenv from 'dotenv';
dotenv.config();

async function testTavily() {
  const apiKey = process.env.TAVILY_API_KEY;
  console.log("Testing Tavily Key:", apiKey ? "Present" : "Missing");

  if (!apiKey) return;

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: "how to fix ps5 disc drive",
        search_depth: "basic",
        include_answer: true,
        max_results: 1
      }),
    });

    if (!response.ok) {
      console.error("Tavily API Error:", response.status, response.statusText);
      const text = await response.text();
      console.error("Body:", text);
    } else {
      const data = await response.json();
      console.log("Success! Results found:", data.results.length);
      console.log("First result title:", data.results[0]?.title);
    }
  } catch (error) {
    console.error("Request Failed:", error);
  }
}

testTavily();
