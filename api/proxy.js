// api/proxy.js

export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }
  
    const apiKey = process.env.GOOEY_API_KEY;
    const { input_prompt } = req.body;
  
    try {
      // 1. Kick off async request
      const initial = await fetch(
        "https://api.gooey.ai/v3/video-bots/async/?example_id=ao5w55v0fwj6",
        {
          method: "POST",
          headers: {
            "Authorization": "bearer " + apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input_prompt, messages: [] }),
        }
      );
  
      if (!initial.ok) {
        const err = await initial.text();
        return res.status(initial.status).json({ error: err });
      }
  
      const statusUrl = initial.headers.get("Location");
  
      // 2. Poll until done
      let result;
      while (true) {
        const r = await fetch(statusUrl, {
          headers: { "Authorization": "bearer " + apiKey },
        });
        result = await r.json();
        if (result.status === "completed" || result.status === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
  
      // 3. Extract response
      function extractSelectedResponse(dict) {
        const output = dict.output;
        if (output) {
          if (output.response) return output.response;
          if (Array.isArray(output.called_functions)) {
            for (const item of output.called_functions) {
              if (item?.return_value?.response) return item.return_value.response;
            }
          }
        }
        if (dict.return_value?.response) return dict.return_value.response;
        return null;
      }
  
      const selected = extractSelectedResponse(result);
      if (!selected) {
        return res.status(200).json({ content: "No response found" });
      }
  
      res.status(200).json({
        content: selected.content,
        citations: selected.citations || {},
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
  