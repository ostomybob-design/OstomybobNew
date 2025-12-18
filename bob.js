// bob.js — OstomyBob AI
const ASSISTANT_ID = "asst_kHnWoZoRhnwDOl90RKlmmk4R";
let threadId = null;
let thinkingMessageId = null;

const API_BASE = 'http://localhost:3000/api/openai'; // Change to your production URL later

async function createOpenAIThread() {
    const res = await fetch(`${API_BASE}/threads`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }
        // No body needed for thread creation
    });
    const data = await res.json();
    threadId = data.id;
}
createOpenAIThread();

async function sendBobMessage() {
    const input = document.getElementById("bob-user-input");
    if (!input) return;
    const userMessage = input.value.trim();
    if (!userMessage) return;
    addBobMessage(userMessage, "user");
    input.value = "";
    thinkingMessageId = addBobMessage("Bob is thinking...", "thinking");
    if (!threadId) await createOpenAIThread();
    await fetch(`${API_BASE}/threads/${threadId}/messages`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ role: "user", content: userMessage }) 
    });
    const runRes = await fetch(`${API_BASE}/threads/${threadId}/runs`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ assistant_id: ASSISTANT_ID }) 
    });
    const runData = await runRes.json();
    const interval = setInterval(async () => {
        const statusRes = await fetch(`${API_BASE}/threads/${threadId}/runs/${runData.id}`, { 
            headers: { "Content-Type": "application/json" } 
        });
        const status = await statusRes.json();
        if (["completed", "failed", "cancelled"].includes(status.status)) {
            clearInterval(interval);
            if (thinkingMessageId) document.getElementById(thinkingMessageId)?.remove();
            if (status.status === "completed") {
                const msgsRes = await fetch(`${API_BASE}/threads/${threadId}/messages`, { 
                    headers: { "Content-Type": "application/json" } 
                });
                const msgs = await msgsRes.json();
                addBobMessage(msgs.data[0].content[0].text.value, "bob");
            } else {
                addBobMessage("Sorry, I had trouble responding. Try again!", "bob");
            }
        }
    }, 1000);
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