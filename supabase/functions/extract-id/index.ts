import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an OCR specialist for Egyptian national ID cards. Extract ONLY these fields from the provided ID card image:
- الاسم (Name): The full name in Arabic as shown on the card
- العنوان (Address): The full address in Arabic as shown on the card  
- الرقم القومي (National ID Number): The 14-digit national ID number
- تاريخ الميلاد (Birth Date): The birth date as shown on the card

IMPORTANT RULES:
1. Only extract data from Egyptian national ID cards (البطاقة الشخصية المصرية)
2. If the image is NOT an Egyptian ID card, respond with: {"error": "هذه الصورة ليست بطاقة رقم قومي مصرية"}
3. If any field cannot be read clearly, set its value to "غير واضح"
4. Return the data as a JSON object with these exact keys: name, address, nid, birthDate
5. All text values should be in Arabic as they appear on the card
6. The national ID number should be in digits only`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: image },
              },
              {
                type: "text",
                text: "استخرج البيانات من بطاقة الرقم القومي المصرية هذه. أعد البيانات كـ JSON فقط بدون أي نص إضافي.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_id_data",
              description: "Extract data from an Egyptian national ID card",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name in Arabic" },
                  address: { type: "string", description: "Full address in Arabic" },
                  nid: { type: "string", description: "14-digit national ID number" },
                  birthDate: { type: "string", description: "Birth date as shown on card" },
                  error: { type: "string", description: "Error message if not an Egyptian ID card" },
                },
                required: ["name", "address", "nid", "birthDate"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_id_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لحسابك" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const extracted = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(extracted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse content directly
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(jsonMatch[0], {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Could not extract data from response");
  } catch (e) {
    console.error("extract-id error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "حدث خطأ غير متوقع" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
