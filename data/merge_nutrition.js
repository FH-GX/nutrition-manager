/**
 * 合并矿物质&维生素数据到 foods.js
 * 将 matched_nutrition_final.json 中的24个字段
 * 拆分为 minerals / vitamins 两个子对象注入每个食物的 per100g 末尾
 *
 * 运行方式：
 *   node data/merge_nutrition.js
 * 会原地更新 data/foods.js
 */

const fs = require('fs');
const path = require('path');

// ---- 字段分组定义 ----
const MINERAL_KEYS = ['ca', 'fe', 'zn', 'se', 'k', 'na', 'p', 'mag', 'cu', 'mn', 'iodine'];
const VITAMIN_KEYS = ['va', 'vb1', 'vb2', 'vc', 'vd', 've', 'vb6', 'vb12', 'folate', 'vk', 'niacin', 'pantothenic', 'biotin'];

// ---- 读取 JSON 数据 ----
const jsonPath = path.join(__dirname, 'matched_nutrition_final.json');
const rawJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const nutritionMap = rawJson.data; // { "1": {...}, "2": {...}, ... }

// ---- 读取 foods.js 源文本 ----
const foodsPath = path.join(__dirname, 'foods.js');
let src = fs.readFileSync(foodsPath, 'utf8');

// ---- 备份 ----
const backupPath = foodsPath + '.bak';
fs.writeFileSync(backupPath, src, 'utf8');
console.log('✅ 已备份到', backupPath);

// ---- 遍历每个食物 ID，替换 per100g 块 ----
let patchCount = 0;
let skipCount = 0;

src = src.replace(
  /(\s+)(id:\s*(\d+),[\s\S]*?per100g:\s*\{([^}]*)\})/g,
  (match, indent, body, idStr, per100gContent) => {
    const id = parseInt(idStr);
    const nutr = nutritionMap[String(id)];

    if (!nutr) {
      console.warn(`⚠️  ID ${id} 在 JSON 中无对应数据，跳过`);
      skipCount++;
      return match;
    }

    // 构建 minerals 对象字符串
    const mLines = MINERAL_KEYS.map(k => {
      const v = nutr[k];
      return `        ${k}: ${v === null || v === undefined ? 'null' : v}`;
    }).join(',\n');

    // 构建 vitamins 对象字符串
    const vLines = VITAMIN_KEYS.map(k => {
      const v = nutr[k];
      return `        ${k}: ${v === null || v === undefined ? 'null' : v}`;
    }).join(',\n');

    // 检查是否已有 minerals/vitamins（避免重复注入）
    if (per100gContent.includes('minerals') || per100gContent.includes('vitamins')) {
      console.log(`ℹ️  ID ${id} 已有 minerals/vitamins，跳过`);
      skipCount++;
      return match;
    }

    // 在 per100g 的 } 前插入两个子对象
    const newPer100g = `per100g: {${per100gContent.trimEnd()},\n      minerals: {\n${mLines}\n      },\n      vitamins: {\n${vLines}\n      }\n    }`;

    const newBody = body.replace(
      /per100g:\s*\{([^}]*)\}/,
      newPer100g
    );

    patchCount++;
    return indent + newBody;
  }
);

// ---- 写回 foods.js ----
fs.writeFileSync(foodsPath, src, 'utf8');
console.log(`\n🎉 合并完成！patched: ${patchCount}, skipped: ${skipCount}`);
console.log('📄 已写入 data/foods.js');
