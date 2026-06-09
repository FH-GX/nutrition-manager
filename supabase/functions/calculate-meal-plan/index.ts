// calculate-meal-plan Edge Function
// 分餐方案计算：按比例拆分 + 油品/坚果轮换 + 脂肪来源分布
// ============================================

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const MEAL_RATIOS: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  snack: 0.10,
  dinner: 0.30,
};

const OIL_ITEMS = [
  { name: "菜籽油", ratio: 30 },
  { name: "橄榄油", ratio: 40 },
  { name: "猪油", ratio: 30 },
];

const NUT_ITEMS = [
  { name: "核桃", ratio: 50 },
  { name: "杏仁", ratio: 25 },
  { name: "花生", ratio: 15 },
  { name: "瓜子（葵花子）", ratio: 10 },
];

function hashDate(dateStr: string): number {
  let hash = 0;
  const clean = dateStr.replace(/-/g, "");
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickByRatio(items: { name: string; ratio: number }[], seed: number): string {
  const total = items.reduce((s, i) => s + i.ratio, 0);
  let r = seed % total;
  for (const item of items) {
    r -= item.ratio;
    if (r < 0) return item.name;
  }
  return items[0].name;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apiKey",
      },
    });
  }

  try {
    const auth = req.headers.get("Authorization") || req.headers.get("apiKey");
    if (!auth) {
      return new Response(JSON.stringify({ error: "未授权" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const body = await req.json();
    const { macros, date } = body;

    if (!macros || !date) {
      return new Response(JSON.stringify({ error: "需要 macros/date" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const seed = hashDate(date);
    const totalP = macros.protein?.grams || 0;
    const totalF = macros.fat?.grams || 0;
    const totalC = macros.carb?.grams || 0;
    const totalKcal = totalP * 4 + totalF * 9 + totalC * 4;

    // 按餐分配
    const meals: Record<string, any> = {};
    for (const [meal, ratio] of Object.entries(MEAL_RATIOS)) {
      meals[meal] = {
        proteinG: Math.round(totalP * ratio),
        fatG: Math.round(totalF * ratio),
        carbG: Math.round(totalC * ratio),
        kcal: Math.round(totalKcal * ratio),
      };
    }

    // 三餐独立选油
    const oilSelection = {
      breakfast: pickByRatio(OIL_ITEMS, seed + 337),
      lunch: pickByRatio(OIL_ITEMS, seed + 773),
      dinner: pickByRatio(OIL_ITEMS, seed + 1307),
    };

    // 坚果选择
    const nutSelection = pickByRatio(NUT_ITEMS, seed + 53);

    // 脂肪来源估算
    const oilAnimalCount = [oilSelection.breakfast, oilSelection.lunch, oilSelection.dinner]
      .filter(o => o === "猪油").length;

    let animalFat = Math.round(totalF * 0.2 + oilAnimalCount * 3);
    let plantFat = totalF - animalFat;
    if (plantFat < 0) { plantFat = 0; animalFat = totalF; }

    const result = {
      success: true,
      date,
      seed,
      meals,
      oilSelection,
      nutSelection,
      totals: { protein: totalP, fat: totalF, carb: totalC, kcal: totalKcal },
      fatSources: { animal: animalFat, plant: plantFat, total: animalFat + plantFat },
      omegaRatio: 7.5,
    };

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
