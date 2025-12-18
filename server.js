// server.js
import express from "express";
import fetch from "node-fetch"; // or global fetch in Node 18+
import cors from "cors";

const app = express();
app.use(cors()); // allow your front end origin(s) in production, or app.use(cors({ origin: 'http://127.0.0.1:5500' }))
app.use(express.json());

app.post("/api/threads", async (req, res) => {
  try {
    const resp = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

app.listen(3000, () => console.log("Proxy listening on http://localhost:3000"));