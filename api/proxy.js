// api/proxy.js

export default async function handler(req, res) {
  // === CORS HEADERS ===
  res.setHeader("Access-Control-Allow-Origin", "*"); // to be replaced with MAKEAWARE website instead of *
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const apiKey = process.env.GOOEY_API_KEY;
  const { input_prompt, messages = [] } = req.body;

  // Log the request body for debugging in Vercel
  console.log("Request body received:", JSON.stringify(req.body, null, 2));

  // Check if body contains only allowed properties
  const allowedProperties = ['input_prompt', 'messages'];
  const bodyKeys = Object.keys(req.body);
  const hasInvalidProperties = bodyKeys.some(key => !allowedProperties.includes(key));
  
  if (hasInvalidProperties) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  if (!messages || messages.length > 10 || JSON.stringify(req.body).length > 5000) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    // Your existing Gooey API call and polling logic here
    const initial = await fetch(
      "https://api.gooey.ai/v3/video-bots/async/?example_id=ao5w55v0fwj6",
      {
        method: "POST",
        headers: {
          "Authorization": "bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input_prompt, messages }),
      }
    );

    if (!initial.ok) {
      const err = await initial.text();
      return res.status(initial.status).json({ error: err });
    }

    const statusUrl = initial.headers.get("Location");

    let result;
    while (true) {
      const r = await fetch(statusUrl, {
        headers: { "Authorization": "bearer " + apiKey },
      });
      result = await r.json();
      if (result.status === "completed" || result.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

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
