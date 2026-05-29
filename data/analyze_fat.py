#!/usr/bin/env python3
"""分析foods.js中脂肪来源并生成标签"""
import json, re

with open(r'E:\nutrition\data\foods.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有食物对象
pattern = r'\{\s*id:\s*(\d+)[^}]*?name:\s*"([^"]+)"[^}]*?category:\s*"([^"]+)"[^}]*?per100g:\s*\{([^}]+)\}[^}]*?\}'
matches = re.findall(pattern, content, re.DOTALL)

print("=" * 70)
print("高脂食物（每100g脂肪 > 15g）— 按脂肪来源分类")
print("=" * 70)

high_fat = []
for m in matches:
    id_, name, category, per100g_str = m
    # 提取脂肪含量
    fat_m = re.search(r'fat:\s*([\d.]+)', per100g_str)
    if not fat_m:
        continue
    fat = float(fat_m.group(1))
    if fat >= 15:  # 高脂阈值
        # 提取omega3/omega6
        o3_m = re.search(r'omega3:\s*([\d.]+)', per100g_str)
        o6_m = re.search(r'omega6:\s*([\d.]+)', per100g_str)
        o3 = float(o3_m.group(1)) if o3_m else 0
        o6 = float(o6_m.group(1)) if o6_m else 0
        
        # 分类
        if category == '油脂类':
            if '猪油' in name:
                tag = '🐷 动物油脂'
            elif '亚麻籽' in name:
                tag = '🌿 植物油(高omega3)'
            else:
                tag = '🌿 植物油'
        elif category == '坚果':
            tag = '🥜 坚果种子'
        elif category == '肉类':
            if fat > 20:
                tag = '🥩 高脂肉'
            else:
                tag = '🥩 中脂肉'
        elif category == '蛋类':
            if fat > 15:
                tag = '🥚 蛋黄(高脂)'
            else:
                tag = '🥚 蛋类'
        elif category == '乳类':
            tag = '🥛 乳制品'
        elif category == '豆类':
            tag = '🫘 豆制品(高脂)'
        elif category == '菜品':
            tag = '🍲 菜品(高脂)'
        else:
            tag = f'📦 {category}'
        
        high_fat.append((tag, name, fat, o3, o6, category))

# 按标签分组打印
from collections import defaultdict
groups = defaultdict(list)
for item in high_fat:
    groups[item[0]].append(item)

for tag in sorted(groups.keys()):
    print(f"\n{tag}:")
    for item in groups[tag]:
        _, name, fat, o3, o6, cat = item
        print(f"  {name:20s}  脂肪 {fat:6.1f}g/100g", end="")
        if o3 > 0 or o6 > 0:
            print(f"  ω3={int(o3)}mg  ω6={int(o6)}mg", end="")
        print()

print("\n\n" + "=" * 70)
print(f"共 {len(high_fat)} 种高脂食物（脂肪 ≥ 15g/100g）")
print("=" * 70)

# 也列出中脂食物（8~15g）
print("\n\n中脂食物（脂肪 8~15g/100g）：")
medium_fat = []
for m in matches:
    id_, name, category, per100g_str = m
    fat_m = re.search(r'fat:\s*([\d.]+)', per100g_str)
    if not fat_m: continue
    fat = float(fat_m.group(1))
    if 8 <= fat < 15:
        medium_fat.append((name, fat, category))

for name, fat, cat in sorted(medium_fat, key=lambda x: -x[1]):
    print(f"  {name:20s}  脂肪 {fat:.1f}g/100g  [{cat}]")
print(f"共 {len(medium_fat)} 种中脂食物")
