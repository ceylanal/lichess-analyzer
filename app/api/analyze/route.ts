import Groq from "groq-sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API Key eksik" }, { status: 500 });

    const groq = new Groq({ apiKey: apiKey });
    // 'type' parametresini ekledik: 'intro' veya 'analysis' olabilir
    const { pgn, userColor, result, opening, persona, type } = await req.json();

    let systemPrompt = "";
    
    // KİŞİLİK AYARLARI
    const personas = {
        angry: "Sen huysuz, alaycı bir GM'sin. Hataları yüzüne vurursun.",
        kind: "Sen nazik, motive edici bir öğretmensin. Emojiler kullanırsın.",
        robot: "Sen duygusuz bir analiz motorusun. Kısa ve netsin."
    };
    
    const selectedPersona = personas[persona as keyof typeof personas] || personas.robot;

    // --- SENARYO 1: GİRİŞ MESAJI (AUTO-INITIATE) ---
    if (type === "intro") {
        systemPrompt = `${selectedPersona} Türkçe konuş.
        GÖREV: Kullanıcı bir maç seçti. Ona maçıyla ilgili kısa, tek cümlelik çarpıcı bir giriş cümlesi kur.
        - Açılış: ${opening}
        - Sonuç: ${result}
        - Renk: ${userColor}
        
        Örnek (Huysuz): "Yine mi ${opening}? Bakalım bu sefer nasıl batırdın..."
        Örnek (Nazik): "Harika bir ${opening} denemesi! Hadi nereleri geliştirebiliriz bakalım."
        `;
        
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "system", content: systemPrompt }],
            model: "llama-3.3-70b-versatile",
            max_tokens: 100, // Giriş mesajı kısa olsun
        });
        return NextResponse.json({ analysis: chatCompletion.choices[0]?.message?.content });
    }

    // --- SENARYO 2: NORMAL ANALİZ ---
    systemPrompt = `${selectedPersona} Türkçe konuş. Kurallar: Kısa ol. Format: 🕵️‍♂️ Açılış | 📉 Kırılma | 💡 Tavsiye`;
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Oyuncu: ${userColor}, Sonuç: ${result}, Açılış: ${opening}, PGN: ${pgn ? pgn.slice(0, 1000) : 'Yok'}` }
      ],
      model: "llama-3.3-70b-versatile",
    });

    const analysis = chatCompletion.choices[0]?.message?.content || "Analiz boş geldi.";
    return NextResponse.json({ analysis });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Hata." }, { status: 500 });
  }
}