// calculate-child Edge Function
// 儿童营养计算：能量 (EER/体重法) + 蛋白质 (RNI) + 碳水流调范围
// ============================================

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// ---- 参考数据 ----

const CHILD_PROTEIN_RNI: { start: number; end: number; rni: number }[] = [
  { start: 1, end: 2, rni: 25 },
  { start: 3, end: 5, rni: 30 },
  { start: 6, end: 6, rni: 35 },
  { start: 7, end: 8, rni: 40 },
  { start: 9, end: 9, rni: 45 },
  { start: 10, end: 10, rni: 50 },
  { start: 11, end: 13, rni: 60 },
  { start: 14, end: 17, rni: 75 },
];

const CHILD_EER: { age: number; male: number; female: number }[] = [
  { age: 6, male: 1400, female: 1250 },
  { age: 7, male: 1500, female: 1350 },
  { age: 8, male: 1650, female: 1450 },
  { age: 9, male: 1750, female: 1550 },
  { age: 10, male: 1900, female: 1700 },
  { age: 11, male: 2100, female: 1800 },
  { age: 12, male: 2200, female: 1900 },
  { age: 13, male: 2350, female: 2000 },
  { age: 14, male: 2550, female: 2100 },
  { age: 15, male: 2750, female: 2150 },
  { age: 16, male: 2850, female: 2200 },
  { age: 17, male: 2900, female: 2200 },
];

const CHILD_CARB = { minPct: 50, maxPct: 65, defaultPct: 57 };

function getProteinRNI(age: number): number {
  for (const item of CHILD_PROTEIN_RNI) {
    if (age >= item.start && age <= item.end) return item.rni;
  }
  return 75;
}

function getEER(age: number, gender: string): number | null {
  if (age >= 2 && age <= 5) return null;
  const closest = CHILD_EER.reduce((prev, curr) =>
    Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev
  );
  return gender === "male" ? closest.male : closest.female;
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
    const { age, gender, weight, advancedMode = false, carbPct } = body;

    if (age === undefined || !gender) {
      return new Response(JSON.stringify({ error: "需要 age/gender" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (age < 2 || age > 17) {
      return new Response(JSON.stringify({ error: "仅支持2-17岁" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 能量
    let energy: number;
    let energyMethod: string;

    if (age >= 2 && age <= 5) {
      if (!weight) {
        return new Response(JSON.stringify({ error: "2-5岁需要体重" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      energy = Math.round(weight * 75);
      energyMethod = `体重×75: ${weight}×75=${energy}`;
    } else {
      const eer = getEER(age, gender);
      energy = eer!;
      energyMethod = `EER表: ${age}岁${gender}=${energy}`;
    }

    // 蛋白质
    const protein = getProteinRNI(age);

    // 碳水
    const carbPCt = advancedMode
      ? Math.max(CHILD_CARB.minPct, Math.min(CHILD_CARB.maxPct, carbPct ?? CHILD_CARB.defaultPct))
      : CHILD_CARB.defaultPct;

    const proteinKcal = protein * 4;
    const carbKcal = Math.round(energy * carbPCt / 100);
    let fatKcal = energy - proteinKcal - carbKcal;
    if (fatKcal < energy * 0.1) {
      fatKcal = Math.round(energy * 0.1);
    }
    const finalCarbKcal = energy - proteinKcal - fatKcal;

    const result = {
      success: true,
      age, gender,
      energy, energyMethod,
      protein,
      macros: {
        protein: { grams: protein, kcal: proteinKcal, percent: Math.round(proteinKcal / energy * 100) },
        fat: { grams: Math.round(fatKcal / 9), kcal: fatKcal, percent: Math.round(fatKcal / energy * 100) },
        carb: { grams: Math.round(finalCarbKcal / 4), kcal: finalCarbKcal, percent: Math.round(finalCarbKcal / energy * 100) },
      },
      advancedMode,
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
