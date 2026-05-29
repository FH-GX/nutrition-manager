"""合并矿物质维生素数据到代码文件"""
import json

with open(r'E:\nutrition\data\matched_nutrition_final.json', 'r', encoding='utf-8') as f:
    mv_data = json.load(f)

# ===== 1. 生成 minerals_vitamins.js =====
FIELD_ORDER = ['ca','fe','zn','se','va','vb1','vb2','vc','vd','ve',
               'k','na','p','mag','cu','mn','iodine','vb6','vb12','niacin',
               'folate','vk','pantothenic','biotin']

lines = []
lines.append('/**')
lines.append(' * 食物矿物质与维生素补充数据')
lines.append(' *')
lines.append(' * 数据来源：')
lines.append(' * 1. GitHub Sanotsu/china-food-composition-data (《中国食物成分表第六版》)')
lines.append(' * 2. USDA FoodData Central SR Legacy')
lines.append(' * 3. BOSS从nlc.chinanutri.cn手动查阅')
lines.append(' * 4. 详情见 data_sources.txt')
lines.append(' *')
lines.append(' * 数据格式：每100g可食部的矿物质和维生素含量')
lines.append(' * null = 未检测/无数据，0 = 确认不含') 
lines.append(' *')
lines.append(' * 核心10字段（用于达标率计算）：')
lines.append(' *   ca(钙mg), fe(铁mg), zn(锌mg), se(硒μg),')
lines.append(' *   va(维生素A μg RAE), vb1(维生素B1 mg), vb2(维生素B2 mg),')
lines.append(' *   vc(维生素C mg), vd(维生素D μg), ve(维生素E mg α-TE)')
lines.append(' * ')
lines.append(' * 进阶段14字段（食物库可见，不参与达标计算）：')
lines.append(' *   k(钾mg), na(钠mg), p(磷mg), mag(镁mg),')
lines.append(' *   cu(铜mg), mn(锰mg), iodine(碘μg),')
lines.append(' *   vb6(维生素B6 mg), vb12(维生素B12 μg),')
lines.append(' *   niacin(烟酸 mg NE), folate(叶酸 μg DFE),')
lines.append(' *   vk(维生素K μg), pantothenic(泛酸 mg), biotin(生物素 μg)')
lines.append(' */')
lines.append('')
lines.append('const MINERALS_VITAMINS = {')
lines.append('')

# 食品分类名称映射
CATEGORIES = {
    (1,10): '谷类及制品', (11,14): '薯类', (15,22): '豆类及制品',
    (23,42): '蔬菜类', (43,52): '水果类', (53,64): '肉类',
    (65,69): '蛋类', (70,81): '鱼虾类', (82,85): '乳类',
    (86,90): '坚果种子', (91,98): '油脂类', (99,105): '菜品',
    (106,119): '补充主食', (120,125): '补充蔬菜', (126,126): '补充其他'
}

def get_cat(fid):
    for (s,e),n in CATEGORIES.items():
        if s <= fid <= e:
            return n
    return '其他'

prev_cat = ''
for fid in sorted([int(k) for k in mv_data['data'].keys()]):
    d = mv_data['data'][str(fid)]
    name = mv_data['names'].get(str(fid), '')
    matched = mv_data['matched_names'].get(str(fid), '')
    cat = get_cat(fid)
    
    if cat != prev_cat:
        lines.append(f'  // ==================== {cat} ====================')
    prev_cat = cat
    
    # 构建对象内容
    vals = []
    for k in FIELD_ORDER:
        v = d.get(k)
        if v is None:
            vals.append(f'{k}: null')
        elif isinstance(v, float) and v == int(v):
            vals.append(f'{k}: {int(v)}')
        else:
            vals.append(f'{k}: {v}')
    
    comment = name if not matched else f'{name}  → {matched}'
    lines.append(f'  {fid}: {{ // {comment}')
    lines.append(f'    {", ".join(vals[:10])},')
    lines.append(f'    {", ".join(vals[10:])}')
    lines.append('  },')

lines.append('')
lines.append('};')
lines.append('')
lines.append('// 字段元信息：名称、单位、是否核心字段')
lines.append('const MV_FIELDS = {')
lines.append('  ca:          { name: \'钙\',       unit: \'mg\',  core: true },')
lines.append('  fe:          { name: \'铁\',       unit: \'mg\',  core: true },')
lines.append('  zn:          { name: \'锌\',       unit: \'mg\',  core: true },')
lines.append('  se:          { name: \'硒\',       unit: \'μg\',  core: true },')
lines.append('  va:          { name: \'维生素A\',  unit: \'μg RAE\', core: true },')
lines.append('  vb1:         { name: \'维生素B1\', unit: \'mg\',  core: true },')
lines.append('  vb2:         { name: \'维生素B2\', unit: \'mg\',  core: true },')
lines.append('  vc:          { name: \'维生素C\',  unit: \'mg\',  core: true },')
lines.append('  vd:          { name: \'维生素D\',  unit: \'μg\',  core: true },')
lines.append('  ve:          { name: \'维生素E\',  unit: \'mg α-TE\', core: true },')
lines.append('  k:           { name: \'钾\',       unit: \'mg\',  core: false },')
lines.append('  na:          { name: \'钠\',       unit: \'mg\',  core: false },')
lines.append('  p:           { name: \'磷\',       unit: \'mg\',  core: false },')
lines.append('  mag:         { name: \'镁\',       unit: \'mg\',  core: false },')
lines.append('  cu:          { name: \'铜\',       unit: \'mg\',  core: false },')
lines.append('  mn:          { name: \'锰\',       unit: \'mg\',  core: false },')
lines.append('  iodine:      { name: \'碘\',       unit: \'μg\',  core: false },')
lines.append('  vb6:         { name: \'维生素B6\', unit: \'mg\',  core: false },')
lines.append('  vb12:        { name: \'维生素B12\', unit: \'μg\', core: false },')
lines.append('  niacin:      { name: \'烟酸\',     unit: \'mg NE\', core: false },')
lines.append('  folate:      { name: \'叶酸\',     unit: \'μg DFE\', core: false },')
lines.append('  vk:          { name: \'维生素K\',  unit: \'μg\',  core: false },')
lines.append('  pantothenic: { name: \'泛酸\',     unit: \'mg\',  core: false },')
lines.append('  biotin:      { name: \'生物素\',   unit: \'μg\',  core: false },')
lines.append('};')

# 写文件
mv_path = r'E:\nutrition\data\minerals_vitamins.js'
with open(mv_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

# 统计
count = len([k for k in mv_data['data'].keys()])
print(f'✅ minerals_vitamins.js 已生成 ({count}种食物)')
print(f'   路径: {mv_path}')

# ===== 2. 添加ID 126到foods.js =====
foods_path = r'E:\nutrition\data\foods.js'
with open(foods_path, 'r', encoding='utf-8') as f:
    foods_content = f.read()

# 检查是否已有ID 126
if 'id: 126' in foods_content:
    print('⚠️ ID 126 已存在于 foods.js，跳过')
else:
    # 在最后一个对象后面添加
    insert_point = foods_content.rfind('  }')
    # 找到前一个 }
    end_brace = foods_content.rfind('  }')
    if end_brace > 0:
        # 检查是不是最后一个对象
        add_entry = '''
  },
  // ==================== 补充：其他 ====================
  {
    id: 126,
    name: "燕麦片（果仁、甜）",
    category: "谷类",
    aliases: ["甜燕麦片", "坚果燕麦片"],
    per100g: { calories: 418, protein: 8.9, fat: 11.1, carbs: 73.5, fiber: 6.9, cholesterol: 0, omega3: 80, omega6: 2200 },
    exchange_g: 25,
    gi: 55,
  }'''
        # 插入在最后一个 `}` 之前
        foods_content = foods_content.replace('  }', add_entry, 1)
        
        with open(foods_path, 'w', encoding='utf-8') as f:
            f.write(foods_content)
        
        print(f'✅ ID 126 燕麦片（果仁、甜）已添加到 foods.js')

# 统计最终数量
import re
ids = re.findall(r'id:\s*(\d+)', foods_content)
unique_ids = len(set(ids))
print(f'   foods.js 共有 {unique_ids} 种食物')
