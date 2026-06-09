// calculate-adult Edge Function
// 成人营养计算：BMR/TDEE/BMI/标准体重/三大营养素
// 使用 Deno.serve 模式，自行处理鉴权
// ============================================

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// ---- 参考数据常量 ----

const ENERGY_COEFFS = [
  { min: 0, max: 1.2, coeff: 25 },
  { min: 1.201, max: 1.375, coeff: 30 },
  { min: 1.376, max: 1.55, coeff: 35 },
  { min: 1.551, max: 999, coeff: 40 },
];

const AGE_FACTORS = [
  { min: 0, max: 49, factor: 1.0 },
  { min: 50, max: 59, factor: 0.9 },
  { min: 60, max: 69, factor: 0.8 },
  { min: 70, max: 79, factor: 0.7 },
  { min: 80, max: 89, factor: 0.6 },
  { min: 90, max: 199, factor: 0.4 },
];

const ABSORPTION_RATES = { protein: 0.7, carb: 0.95, fat: 0.95 };

function calculateBMI(heightCm: number, weightKg: number): number {
  return weightKg / ((heightCm / 100) ** 2);
}

function calculateStdWeight(heightCm: number): number {
  return heightCm - 105;
}

function calculateAdjustedWeight(real: number, std: number): number {
  return (real + std) / 2;
}

function getEnergyCoefficient(activity: number): number {
  for (const item of ENERGY_COEFFS) {
    if (activity >= item.min && activity <= item.max) return item.coeff;
  }
  return 40;
}

function getAgeFactor(age: number): number {
  for (const item of AGE_FACTORS) {
    if (age >= item.min && age <= item.max) return item.factor;
  }
  return 0.4;
}

Deno.serve(async (req) => {
  // CORS 预检
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
    // 简易鉴权：检查 Authorization 或 apiKey header
    const auth = req.headers.get("Authorization") || req.headers.get("apiKey");
    if (!auth) {
      return new Response(JSON.stringify({ error: "未授权，缺少认证信息" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const body = await req.json();
    const { height, weight, age, activity, tier } = body;

    if (!height || !weight || !age || !activity || !tier) {
      return new Response(JSON.stringify({ error: "参数不完整" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 计算
    const bmi = Math.round(calculateBMI(height, weight) * 10) / 10;
    const stdWeight = calculateStdWeight(height);

    // 目标体重
    let targetWeight: number;
    let weightType: string;
    if (bmi >= 28) {
      targetWeight = calculateAdjustedWeight(weight, stdWeight);
      weightType = "调节体重";
    } else {
      targetWeight = stdWeight;
      weightType = "标准体重";
    }

    const ageFactor = getAgeFactor(age);
    const energyCoeff = getEnergyCoefficient(activity);
    const tdee = Math.round(targetWeight * energyCoeff * ageFactor);

    // 三大营养素
    const proteinKcal = Math.round(tdee * tier.proteinPct / 100);
    const fatKcal = Math.round(tdee * tier.fatPct / 100);
    const carbKcal = Math.round(tdee * tier.carbPct / 100);

    // 偏差调整碳水
    const sumKcal = proteinKcal + fatKcal + carbKcal;
    const carbKcalAdjusted = carbKcal + (tdee - sumKcal);

    const result = {
      success: true,
      bmi,
      stdWeight: Math.round(stdWeight * 10) / 10,
      targetWeight: Math.round(targetWeight * 10) / 10,
      weightType,
      ageFactor,
      energyCoeff,
      tdee,
      macros: {
        protein: { percent: tier.proteinPct, kcal: proteinKcal, grams: Math.round(proteinKcal / 4) },
        fat: { percent: tier.fatPct, kcal: fatKcal, grams: Math.round(fatKcal / 9) },
        carb: { percent: tier.carbPct, kcal: carbKcalAdjusted, grams: Math.round(carbKcalAdjusted / 4) },
      },
      calcDetail: `${targetWeight.toFixed(1)} kg × ${energyCoeff} × ${ageFactor} = ${tdee} kcal`,
    };

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "计算失败：" + String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
