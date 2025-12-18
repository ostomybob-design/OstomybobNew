// bob.js — OstomyBob AI using Poe.com bot
const BOT_HANDLE = "OstomyBuddyBob"; // Your Poe bot handle
let messages = []; // Client-side history for multi-turn context
let thinkingMessageId = null;

//const POE_API_BASE = 'http://localhost:3000/api/poe'; // Proxy to Poe (change to production URL later)
const POE_API_BASE = 'https://ostomybob-new.vercel.app/api/poe'; // Proxy to Poe (change to production URL later)
async function sendBobMessage() {
  const input = document.getElementById("bob-user-input");
  if (!input) return;
  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Add user message to UI and history
  addBobMessage(userMessage, "user");
  messages.push({ role: "user", content: userMessage });
  input.value = "";

  // Show thinking indicator
  thinkingMessageId = addBobMessage("Bob is thinking...", "thinking");

  try {
    // Send full history to Poe's chat completions endpoint
    const res = await fetch(`${POE_API_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: BOT_HANDLE,
        messages: messages,
        stream: false // Non-streaming for simplicity
      })
    });

    const data = await res.json();

    // Remove thinking indicator
    if (thinkingMessageId) document.getElementById(thinkingMessageId)?.remove();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const bobResponse = data.choices[0].message.content;
      addBobMessage(bobResponse, "bob");
      messages.push({ role: "assistant", content: bobResponse }); // Add to history
    } else {
      addBobMessage("Sorry, I had trouble responding. Try again!", "bob");
    }
  } catch (error) {
    console.error('Poe API error:', error);
    if (thinkingMessageId) document.getElementById(thinkingMessageId)?.remove();
    addBobMessage("Error connecting to Bob. Check console for details.", "bob");
  }
}

function addBobMessage(text, sender) {
  const chat = document.getElementById("bob-chat-messages");
  if (!chat) return;
  const div = document.createElement("div");
  const id = "msg-" + Date.now();
  div.id = id;

  if (sender === "thinking") {
    div.className = "thinking-message";
    div.style = "margin:15px 0;padding:14px 18px;background:rgba(139,87,42,0.3);color:#000;font-style:italic;font-weight:600;border-radius:22px;align-self:flex-start;max-width:85%;box-shadow:0 2px 8px rgba(0,0,0,0.1);";
    div.innerHTML = `${text} <span style="animation: flashDots 1.5s infinite;">...</span>`;
  } else {
    div.style.margin = "12px 0";
    div.style.padding = "14px 18px";
    div.style.borderRadius = "22px";
    div.style.maxWidth = "85%";
    div.style.alignSelf = sender === "user" ? "flex-end" : "flex-start";
    div.style.background = sender === "user" ? "#e6d5b8" : "#d8e2dc";
    div.style.color = "#222";
    div.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
    div.innerHTML = text.replace(/\n/g, "<br>");
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return id;
}

document.getElementById("bob-user-input")?.addEventListener("keypress", e => {
  if (e.key === "Enter") sendBobMessage();
});