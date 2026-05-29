/**
 * 从中国疾控中心营养所官网批量爬取食物矿物质&维生素数据
 * 使用 agent-browser 作为浏览器自动化工具
 */
const { execSync } = require('child_process');
const fs = require('fs');

// agent-browser 命令前缀
const AB = 'NODE_OPTIONS="" agent-browser';

function ab(cmd) {
  try {
    const output = execSync(`${AB} ${cmd}`, { encoding: 'utf8', timeout: 15000 });
    return output;
  } catch (e) {
    return e.stdout || e.message;
  }
}

// 需要验证的食物列表 - 每个食物包含搜索词和在搜索结果中要点击的文本
const TARGET_FOODS = [
  // 谷类
  { id: 1, name: '稻米（米饭）', search: '大米', match: '大米' },
  { id: 2, name: '小麦粉（面粉）', search: '小麦粉', match: '小麦粉' },
  { id: 3, name: '面条（煮）', search: '面条', match: '面条' },
  { id: 4, name: '馒头（标准粉）', search: '馒头', match: '馒头' },
  // ... 后续食物等第一轮验证通过后再加
];

const SCRAPED = {};

function parseMineralVitamins(snapshotText, foodId, foodName) {
  const data = {};
  
  // 匹配模式：cell "营养素名" 后面跟 cell "数值"
  const patterns = {
    ca: /钙\(Ca\).*?\n.*?cell "([\d.]+)mg"/,
    fe: /铁\(Fe\).*?\n.*?cell "([\d.]+)mg"/,
    zn: /锌\(Zn\).*?\n.*?cell "([\d.]+)mg"/,
    se: /硒\(Se\).*?\n.*?cell "([\d.]+)μg"/,
    va: /维生素A\(Vitamin\).*?\n.*?cell "([\d.]+)μg"/,
    vb1: /硫胺素\(Thiamin\).*?\n.*?cell "([\d.]+)mg"/,
    vb2: /核黄素\(Riboflavin\).*?\n.*?cell "([\d.]+)mg"/,
    vc: /维生素C\(Vitamin C\).*?\n.*?cell "([\d.]+)mg"/,
    ve: /α-TE.*?\n.*?cell "([\d.]+)mg"/,
    k: /钾\(K\).*?\n.*?cell "([\d.]+)mg"/,
    na: /钠\(Na\).*?\n.*?cell "([\d.]+)mg"/,
    p: /磷\(P\).*?\n.*?cell "([\d.]+)mg"/,
    mag: /镁\(Mg\).*?\n.*?cell "([\d.]+)mg"/,
    cu: /铜\(Cu\).*?\n.*?cell "([\d.]+)mg"/,
    mn: /锰\(Mn\).*?\n.*?cell "([\d.]+)mg"/,
    va_raw: /维生素A\(Vitamin\).*?\n.*?cell "([\d.]+)μg/,
    niacin: /烟酸\(Niacin\).*?\n.*?cell "([\d.]+)mg/,
  };

  for (const [key, regex] of Object.entries(patterns)) {
    const match = snapshotText.match(regex);
    if (match) {
      data[key] = parseFloat(match[1]);
    }
  }

  return data;
}

async function scrapeFood(food) {
  console.log(`\n===== 正在爬取: ${food.name} (ID: ${food.id}) =====`);
  
  // 1. 回到首页
  console.log('  回到首页...');
  ab('open "https://nlc.chinanutri.cn/fq/"');
  ab('wait --load networkidle');
  
  // 2. 获取最新refs
  const mainSnapshot = ab('snapshot -i');
  
  // 3. 搜索食物 - 用type和click
  console.log(`  搜索: "${food.search}"`);
  ab(`type "e22" "${food.search}"`);
  ab('click "e23"');
  ab('wait --load networkidle');
  
  // 4. 获取搜索结果
  const searchSnapshot = ab('snapshot');
  
  // 5. 在搜索结果中找到匹配的食物名并点击
  // 搜索结果的元素ref会变，需要从snapshot文本中找链接文本
  // 我们先用regular approach - 直接找结果列表中包含match文本的链接
  
  // 提取搜索结果中的所有link文本
  const linkMatches = searchSnapshot.match(/link "([^"]+)" \[ref=(e\d+)\]/g) || [];
  let targetRef = null;
  
  for (const linkText of linkMatches) {
    const textMatch = linkText.match(/link "([^"]+)"/);
    const refMatch = linkText.match(/ref=(e\d+)/);
    if (textMatch && refMatch) {
      const text = textMatch[1];
      const ref = refMatch[1];
      if (text.includes(food.match)) {
        targetRef = ref;
        break;
      }
    }
  }
  
  if (!targetRef) {
    console.log(`  ❌ 未找到匹配 "${food.match}" 的链接`);
    return null;
  }
  
  // 6. 点击匹配的食物
  console.log(`  点击: ref=${targetRef}`);
  ab(`click "${targetRef}"`);
  ab('wait --load networkidle');
  
  // 7. 获取详情页数据
  const detailSnapshot = ab('snapshot');
  
  // 8. 解析数据
  const data = parseMineralVitamins(detailSnapshot, food.id, food.name);
  console.log('  提取到的数据:', JSON.stringify(data, null, 2));
  
  return data;
}

async function main() {
  // 先测试一个食物
  const result = await scrapeFood(TARGET_FOODS[0]);
  
  // 保存结果
  fs.writeFileSync('scraped_data.json', JSON.stringify({ [TARGET_FOODS[0].id]: result }, null, 2));
  
  // 关闭浏览器
  ab('close');
  
  console.log('\n✅ 完成!');
}

main().catch(e => {
  console.error('❌ 错误:', e);
  ab('close');
});
