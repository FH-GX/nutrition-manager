#!/usr/bin/env python3
"""
把食物交换份表和脂肪来源数据 写入 foods.js 中
"""

# 读取现有的 foods.js
import re

with open(r'E:\nutrition\data\foods.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ==============================
# 1. 食物交换份数据
# ==============================
# 按类别定义 exch_age（90kcal=1份能换算成多少克食物）
exchange_data = {
    # 谷薯类
    '大米|小米|糯米|薏苡仁': 25,
    '面粉|米粉|玉米面': 25,
    '燕麦|莜麦': 25,
    '荞麦|苦荞': 25,
    '挂面|龙须面|通心粉': 25,
    '绿豆|红豆|芸豆|干豌豆': 25,
    '干粉条|干莲子': 25,
    '烧饼|烙饼|馒头|窝窝头': 35,
    '咸面包|生面条': 35,
    '马铃薯|土豆': 100,
    '玉米（鲜）': 200,
    
    # 蔬菜（大部分叶菜500g/份）
    '大白菜|卷心菜|菠菜|油菜|芹菜|番茄|黄瓜|冬瓜|茄子|丝瓜|苦瓜|生菜': 500,
    '西葫芦': 500,
    '白萝卜|青椒|茭白': 400,
    '南瓜|菜花|花菜': 350,
    '扁豆|洋葱|蒜薹': 250,
    '胡萝卜': 200,
    '山药|藕|莲藕': 150,
    '芋头': 100,
    '毛豆|鲜豌豆': 70,
    
    # 水果
    '香蕉': 150,
    '苹果|梨|桃|橙子|橘子|柚子|猕猴桃|李子|杏|葡萄': 200,
    '草莓': 300,
    '西瓜': 500,
    
    # 肉蛋
    '猪肉（瘦肉）|牛肉（瘦肉）|羊肉（肥瘦）': 50,
    '猪肉（肥瘦）': 25,
    '鸡胸肉|鸡腿肉|鸭肉|鹅肉': 50,
    '鸡蛋（整）': 60,
    '鸭蛋': 60,
    
    # 水产
    '带鱼|草鱼|鲤鱼|鲫鱼|黄鱼|鳝鱼': 80,
    '虾（河虾）|虾（对虾）|鲜贝': 80,
    '蟹肉|海参|水浸鱿鱼': 100,
    
    # 大豆
    '腐竹': 20,
    '黄豆': 25,
    '豆腐干|豆腐丝': 50,
    '豆腐（北豆腐）': 100,
    '豆腐（南豆腐）': 150,
    '豆浆': 400,
    
    # 坚果油脂
    '花生油|菜籽油|玉米油|豆油|芝麻油|橄榄油|亚麻籽油|大豆油': 10,
    '花生|核桃|杏仁': 15,
    '瓜子（葵花子）': 25,
}


# ==============================
# 2. 脂肪来源标签
# ==============================
fat_source_tags = {
    # 鼓励吃的动物油
    '三文鱼': 'encourage_fish',
    '带鱼': 'encourage_fish',
    '草鱼': 'encourage_fish',
    '鲤鱼': 'encourage_fish',
    '鲫鱼': 'encourage_fish',
    '黄鱼（大黄鱼）': 'encourage_fish',
    '鳕鱼': 'encourage_fish',
    '猪肉（肥瘦）': 'encourage_meat',
    '牛肉（肥瘦）': 'encourage_meat',
    '牛腩': 'encourage_meat',
    '羊肉（肥瘦）': 'encourage_meat',
    '鸡腿肉': 'encourage_meat',
    '鸡翅': 'encourage_meat',
    '鸭肉': 'encourage_meat',
    '鹅肉': 'encourage_meat',
    '猪油': 'encourage_animal_fat',
    '猪蹄': 'encourage_meat',
    '鸡蛋（整）': 'encourage_egg',
    '鸡蛋黄': 'encourage_egg',
    
    # 鼓励吃的植物油
    '橄榄油': 'encourage_oil_mono',      # 单不饱和
    '亚麻籽油': 'encourage_oil_omega3',   # 高ω-3
    '椰子油': 'encourage_oil_mct',        # 中链脂肪酸
    '核桃': 'encourage_nut',
    '杏仁': 'encourage_nut',
    '花生': 'encourage_nut',
    '瓜子（葵花子）': 'encourage_nut',
    '芝麻': 'encourage_nut',
    
    # 慎重摄入（富含亚油酸）
    '菜籽油': 'caution_linoleic',
    '大豆油': 'caution_linoleic',
    '花生油': 'caution_linoleic',
    '芝麻油': 'caution_linoleic',
    
    # 鼓励吃的乳制品
    '牛奶': 'encourage_dairy',
    '酸奶': 'encourage_dairy',
    '奶酪（干酪）': 'encourage_dairy',
    '奶粉（全脂）': 'encourage_dairy',
    
    # 豆腐豆制品
    '豆腐（北豆腐）': 'encourage_soy',
    '豆腐（南豆腐）': 'encourage_soy',
    '豆腐干': 'encourage_soy',
    '腐竹': 'encourage_soy',
    '豆浆': 'encourage_soy',
    '黄豆': 'encourage_soy',
}

# ==============================
# 3. 给 foods.js 添加 exchange_g 和 fat_source 字段
# ==============================

count_exchange = 0
count_fat = 0

# 逐行处理
lines = content.split('\n')
output = []
current_food = None
per100g_ended = False

for i, line in enumerate(lines):
    output.append(line)
    
    # 记录当前食品名
    nm = re.search(r'name:\s*"([^"]+)"', line)
    if nm:
        current_food = nm.group(1)
    
    # 在 per100g 行后面插入数据
    if 'per100g:' in line and line.strip().endswith('}'):
        indent = '    '
        added = []
        
        # exchange_g（食物交换份）
        if current_food:
            for pattern, grams in exchange_data.items():
                if re.search(pattern, current_food):
                    added.append(f'{indent}exchange_g: {grams},')
                    count_exchange += 1
                    break
        
        # fat_source（脂肪来源标签）
        if current_food and current_food in fat_source_tags:
            added.append(f'{indent}fat_source: "{fat_source_tags[current_food]}",')
            count_fat += 1
        
        for a in added:
            output.append(a)

result = '\n'.join(output)

with open(r'E:\nutrition\data\foods.js', 'w', encoding='utf-8') as f:
    f.write(result)

print(f'✅ 完成！')
print(f'   exchange_g（食物交换份）：{count_exchange} 条')
print(f'   fat_source（脂肪来源标签）：{count_fat} 条')
