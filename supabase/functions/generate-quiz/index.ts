// Generate quiz questions via Lovable AI Gateway (Gemini)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DIFFICULTY_GUIDE: Record<string, string> = {
  easy: "fundamental definitions, basic facts, introductory concepts that a beginner would know",
  medium: "applied knowledge, cause-effect relationships, comparisons, intermediate understanding",
  hard: "advanced nuances, expert-level analysis, obscure facts, deep technical or historical detail",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, difficulty, num_questions } = await req.json();

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return json({ error: "Topic cannot be empty" }, 400);
    }
    if (topic.trim().length > 500) {
      return json({ error: "Topic must be 500 characters or fewer" }, 400);
    }
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return json({ error: "Invalid difficulty" }, 400);
    }
    const n = Number(num_questions) || 10;
    if (n < 1 || n > 200) {
      return json({ error: "Questions must be 1-200" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI gateway not configured" }, 500);
    }

    const systemPrompt = `You are a strict, expert quiz generator. You ONLY generate questions about the exact topic the user requests. Every question must be directly and unambiguously about that topic — zero off-topic, zero generic, zero tangential. All 4 options must be plausible, only ONE correct, no "All of the above" / "None of the above". Explanations must be 1-2 sentences and educational.`;

    const userPrompt = `Generate exactly ${n} multiple choice questions about: "${topic.trim()}".

DIFFICULTY: ${String(difficulty).toUpperCase()} — focus on ${DIFFICULTY_GUIDE[difficulty]}.

Vary types: definitions, scenarios, comparisons, fill-in-the-blank style. Make sure correct_answer EXACTLY matches one of the options.`;

    const tool = {
      type: "function",
      function: {
        name: "return_quiz",
        description: "Return the generated quiz questions.",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              minItems: n,
              maxItems: n,
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 4,
                    maxItems: 4,
                  },
                  correct_answer: { type: "string" },
                  explanation: { type: "string" },
                },
                required: ["question", "options", "correct_answer", "explanation"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "return_quiz" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return json({ error: "Rate limit reached. Please try again in a moment." }, 429);
      }
      if (aiRes.status === 402) {
        return json({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }, 402);
      }
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return json({ error: "AI generation failed" }, 500);
    }

    const data = await aiRes.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return json({ error: "No quiz returned by AI" }, 500);
    }

    let parsed: { questions: any[] };
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      return json({ error: "AI returned malformed quiz" }, 500);
    }

    const validated = (parsed.questions || []).filter(
      (q) =>
        q?.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.correct_answer &&
        q.options.includes(q.correct_answer) &&
        q.explanation,
    );

    if (validated.length < 1) {
      return json({ error: "No valid questions generated. Try a different topic." }, 500);
    }

    return json({ questions: validated, topic: topic.trim(), difficulty });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
