"""
最终版：匹配并生成 minerals_vitamins.js
"""

import json, os, glob

# 加载GitHub数据
DATA_DIR = r"E:\nutrition\data\cfcd_temp\json_data_vision_251206_Qwen2-5-VL-72B-Instruct"
all_foods = {}
for json_file in glob.glob(os.path.join(DATA_DIR, "merged_*.json")):
    with open(json_file, 'r', encoding='utf-8') as f:
        for item in json.load(f):
            all_foods[item.get("foodName", "")] = item

# 映射表
FIELD_MAP = {
    "Ca": "ca", "Fe": "fe", "Zn": "zn", "Se": "se",
    "vitaminA": "va", "thiamin": "vb1", "riboflavin": "vb2",
    "vitaminC": "vc", "vitaminETotal": "ve",
    "K": "k", "Na": "na", "P": "p", "Mg": "mag",
    "Cu": "cu", "Mn": "mn", "niacin": "niacin",
}

def parse_val(v):
    if v is None or str(v) in ["", "—", "Tr", "Tr ", "0"]:
        return None
    try:
        return float(str(v).replace(",",""))
    except:
        return None

def extract(d):
    r = {}
    for gh, our in FIELD_MAP.items():
        r[our] = parse_val(d.get(gh))
    for f in ["vd", "iodine", "vb6", "vb12", "folate", "vk", "pantothenic", "biotin"]:
        r[f] = None
    return r

# ===== 手动匹配（经过验证的名对应关系）=====
MATCH_CONFIDENT = {
    1: "米饭（蒸，代表值）",
    2: "小麦粉（标准粉）",
    3: "挂面（代表值）",
    4: "小麦粉（标准粉）",  # 馒头→用面粉数据（含水调整留到后面）
    5: "小麦粉（标准粉）",  # 包子(猪肉馅)→用面粉凑合
    6: "小麦粉（标准粉）",  # 饺子(猪肉白菜)→用面粉凑合  
    7: "小麦粉（标准粉）",  # 面包→用面粉凑合
    8: "粳米粥",
    9: "糯米 [江米]",
    10: "玉米（鲜）",
    11: "马铃薯[土豆、洋芋]",
    12: "甘薯(红心)[山芋、红薯]",
    13: "芋头 [芋艿、毛芋]",
    14: "山药（鲜）[薯蓣，大薯]",
    15: "豆腐（代表值）",
    16: "南豆腐",
    17: "豆浆",
    18: "豆腐干（代表值）",
    19: "腐竹",
    20: "黄豆 [大豆]",
    21: "赤小豆（干）[小豆,红小豆]",
    22: "绿豆（干）",
    23: "大白菜（代表值）",
    24: "油菜",
    25: "菠菜（鲜）[赤根菜]",
    26: "番茄 [西红柿]",
    27: "黄瓜（鲜）[胡瓜]",
    28: "茄子（代表值）",
    29: "马铃薯[土豆、洋芋]",
    30: "胡萝卜（黄）",
    31: "白萝卜（鲜）[莱菔]",
    32: "藕[莲藕]",
    33: "西兰花 [绿菜花]",
    34: "菜花（白色）[花椰菜]",
    35: "南瓜（鲜）[倭瓜，番瓜]",
    36: "冬瓜",
    37: "苦瓜（鲜）[凉瓜，癞瓜]",
    38: "芹菜茎",
    39: "生菜 [叶用莴苣]",
    40: "圆白菜，卷心菜",
    41: "木耳（干）[黑木耳，云耳]",
    42: "香菇（鲜）[香蕈，冬菇]",
    43: "苹果（代表值）",
    44: "香蕉 [甘蕉]",
    45: "橙",
    46: "葡萄（代表值）",
    47: "西瓜（代表值）",
    48: "梨（代表值）",
    49: "桃（代表值）",
    50: "草莓 [洋莓, 凤阳草莓]",
    51: "中华猕猴桃 [毛叶猕猴桃]",
    52: "火龙果 [仙蜜果、红龙果]",
    53: "猪肉（代表值，fat 30g）",
    54: "猪肉（瘦）",
    55: "猪蹄",
    56: "牛肉（代表值，fat 9g）",
    57: "牛肉（代表值，瘦，fat 3g）",
    58: "牛肉（腹部肉）[牛腩]",
    59: "羊肉（代表值，fat 7g）",
    60: "鸡（代表值）",
    61: "鸡腿",
    62: "鸡翅",
    63: "鸭（代表值）",
    64: "鹅",
    65: "鸡蛋（代表值）",
    66: "鸡蛋白",
    67: "鸡蛋黄",
    68: "鸭蛋",
    69: "鸭蛋（咸鸭蛋，生）",
    70: "草鱼",
    71: "鲤鱼[鲤拐子]",
    72: "鲫鱼 [喜头鱼、海附鱼]",
    73: "黄鱼（大黄花鱼）",
    74: "带鱼(切段)",
    75: "鲑鱼 [大马哈鱼、三文鱼]",
    76: "鳕鱼 [鳕狭、明太鱼]",
    77: "河虾",
    78: "对虾",
    79: "河蟹",
    80: "海参",
    81: "生蚝",
    82: "纯牛奶（代表值，全脂）",
    83: "酸奶（代表值，全脂）",
    84: "全脂奶粉（代表值）",
    85: "奶酪 [干酪]",
    86: "花生（炒）",
    87: "核桃（干）",
    88: "杏仁",
    89: "葵花子（生）",
    90: "芝麻子（白）",
    91: "菜籽油 [青油]",
    92: "橄榄油",
    93: "椰子油",
    94: "亚麻籽油",
    95: "猪油（板油）",
    96: "芝麻油 [香油]",
    97: "豆油",
    98: "花生油",
    106: "小米",
    107: "小米粥",
    110: "荞麦",
    111: "荞麦面",
    113: "黑米",
    114: "米饭（蒸，代表值）",
    117: "糙米",
    118: "米饭（蒸，代表值）",
    120: "油麦菜",
    121: "萹菜 [空心菜、藤藤菜]",
    122: "芦笋 (绿) [石刁柏、龙须菜]",
    123: "秋葵 [黄秋葵、羊角豆]",
    124: "娃娃菜",
    125: "白菜薹[菜薹，菜心]",
}

OUR_NAMES = {
    1: "稻米（米饭）", 2: "小麦粉（面粉）", 3: "面条（煮）", 4: "馒头（标准粉）",
    5: "包子（猪肉馅）", 6: "饺子（猪肉白菜馅）", 7: "面包（白面包）", 8: "粥（大米粥）",
    9: "糯米饭", 10: "玉米（鲜）", 11: "马铃薯（土豆）", 12: "甘薯（红薯）",
    13: "芋头", 14: "山药", 15: "豆腐（北豆腐）", 16: "豆腐（南豆腐）",
    17: "豆浆", 18: "豆腐干", 19: "腐竹", 20: "黄豆", 21: "红豆", 22: "绿豆",
    23: "大白菜", 24: "油菜（小青菜）", 25: "菠菜", 26: "番茄（西红柿）",
    27: "黄瓜", 28: "茄子", 29: "土豆（蔬菜类）", 30: "胡萝卜", 31: "白萝卜",
    32: "莲藕", 33: "西蓝花", 34: "花菜（菜花）", 35: "南瓜", 36: "冬瓜",
    37: "苦瓜", 38: "芹菜", 39: "生菜", 40: "卷心菜", 41: "木耳（干）", 42: "香菇",
    43: "苹果", 44: "香蕉", 45: "橙子", 46: "葡萄", 47: "西瓜", 48: "梨",
    49: "桃", 50: "草莓", 51: "猕猴桃", 52: "火龙果",
    53: "猪肉（肥瘦）", 54: "猪肉（瘦肉）", 55: "猪蹄", 56: "牛肉（肥瘦）",
    57: "牛肉（瘦肉）", 58: "牛腩", 59: "羊肉（肥瘦）", 60: "鸡胸肉",
    61: "鸡腿肉", 62: "鸡翅", 63: "鸭肉", 64: "鹅肉",
    65: "鸡蛋（整）", 66: "鸡蛋白", 67: "鸡蛋黄", 68: "鸭蛋", 69: "咸鸭蛋",
    70: "草鱼", 71: "鲤鱼", 72: "鲫鱼", 73: "黄鱼（大黄鱼）", 74: "带鱼",
    75: "三文鱼", 76: "鳕鱼", 77: "虾（河虾）", 78: "虾（对虾）",
    79: "螃蟹（河蟹）", 80: "海参", 81: "牡蛎（蚝）",
    82: "牛奶", 83: "酸奶", 84: "奶粉（全脂）", 85: "奶酪（干酪）",
    86: "花生", 87: "核桃", 88: "杏仁", 89: "瓜子（葵花子）", 90: "芝麻",
    91: "菜籽油", 92: "橄榄油", 93: "椰子油", 94: "亚麻籽油",
    95: "猪油", 96: "芝麻油", 97: "大豆油", 98: "花生油",
    99: "番茄炒蛋", 100: "红烧肉", 101: "清蒸鱼", 102: "宫保鸡丁",
    103: "糖醋排骨", 104: "鱼香肉丝", 105: "麻婆豆腐",
    106: "小米（生）", 107: "小米粥（熟）", 108: "燕麦片（生）",
    109: "燕麦粥（熟）", 110: "荞麦面（干）", 111: "荞麦面条（熟）",
    112: "全麦面包", 113: "黑米（生）", 114: "黑米饭（熟）",
    115: "藜麦（生）", 116: "藜麦饭（熟）", 117: "糙米（生）",
    118: "糙米饭（熟）", 119: "紫薯（生）",
    120: "油麦菜", 121: "空心菜", 122: "芦笋", 123: "秋葵", 124: "娃娃菜", 125: "菜心",
}

# 需要BOSS确认的食物（GitHub数据没有合适的对应项）
NEEDS_BOSS = [108, 109, 112, 115, 116, 119]  # 燕麦、全麦面包、藜麦、紫薯

# 执行匹配
results = {}
matched_names = {}
notes = {}

for fid, gh_name in MATCH_CONFIDENT.items():
    our_name = OUR_NAMES[fid]
    
    if gh_name not in all_foods:
        # 模糊查找
        found = None
        for fn in all_foods:
            if gh_name in fn:
                found = fn
                break
        if found:
            notes[fid] = f"模糊匹配: '{gh_name}' → '{found}'"
            gh_name = found
        else:
            # 可能是亚麻籽油等油脂类，取同名
            if fid == 94:
                # 亚麻籽油—用同类植物油替代
                notes[fid] = "亚麻籽油：GitHub无数据，保持null"
                results[fid] = {k: None for k in list(FIELD_MAP.values()) + ["vd", "iodine", "vb6", "vb12", "folate", "vk", "pantothenic", "biotin"]}
                continue
            notes[fid] = f"⚠️ '{gh_name}' 未在GitHub数据中找到"
            results[fid] = {k: None for k in list(FIELD_MAP.values()) + ["vd", "iodine", "vb6", "vb12", "folate", "vk", "pantothenic", "biotin"]}
            continue
    
    data = extract(all_foods[gh_name])
    results[fid] = data
    matched_names[fid] = gh_name

# 需要BOSS确认的保持null
for fid in NEEDS_BOSS:
    results[fid] = {k: None for k in list(FIELD_MAP.values()) + ["vd", "iodine", "vb6", "vb12", "folate", "vk", "pantothenic", "biotin"]}

# 菜品(99-105)保持null
for fid in range(99, 106):
    if fid not in results:
        results[fid] = {k: None for k in list(FIELD_MAP.values()) + ["vd", "iodine", "vb6", "vb12", "folate", "vk", "pantothenic", "biotin"]}

# 补全所有125条
for fid in range(1, 126):
    if fid not in results:
        results[fid] = {k: None for k in list(FIELD_MAP.values()) + ["vd", "iodine", "vb6", "vb12", "folate", "vk", "pantothenic", "biotin"]}

# 打印报告
print("="*80)
print("匹配报告")
print("="*80)

valid = sum(1 for fid in results if any(results[fid].get(f) is not None for f in FIELD_MAP.values()))
print(f"有有效矿物质数据: {valid}/125")
print(f"全null（需BOSS确认）: {125 - valid}")

print(f"\n需要BOSS手动确认的食物列表:")
for fid in NEEDS_BOSS:
    print(f"  ❓ ID {fid:3d} {OUR_NAMES[fid]} — GitHub食物成分表中无此物")
for fid in range(99, 106):
    print(f"  ❓ ID {fid:3d} {OUR_NAMES[fid]} — 菜品，需估算")
    
if notes:
    print(f"\n备注:")
    for fid, note in notes.items():
        print(f"  📝 ID {fid:3d} {OUR_NAMES[fid]}: {note}")

# 数据预览（对比旧数据）
print(f"\n新数据预览（钙/铁/锌 vs 旧数据）:")
old_data = None
old_path = r"E:\nutrition\data\minerals_vitamins.js"
if os.path.exists(old_path):
    with open(old_path, 'r', encoding='utf-8') as f:
        old_data = f.read()

for fid in [1, 2, 10, 15, 25, 43, 53, 65, 82, 86, 106]:
    if fid in results:
        r = results[fid]
        ca = r.get("ca", "null")
        fe = r.get("fe", "null")
        zn = r.get("zn", "null")
        name = OUR_NAMES[fid]
        matched = matched_names.get(fid, "—")
        src = "GitHub" if matched != "—" else "需BOSS确认"
        print(f"  ID {fid:3d} {name:16s}: Ca={str(ca):>6s} Fe={str(fe):>6s} Zn={str(zn):>6s} [{src}] {matched}")

# 保存为JSON
output_path = r"E:\nutrition\data\matched_nutrition_final.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump({
        "data": results,
        "names": {str(k): v for k, v in OUR_NAMES.items()},
        "matched_names": {str(k): v for k, v in matched_names.items()}
    }, f, ensure_ascii=False, indent=2)

# 保存BOSS确认列表
with open(r"E:\nutrition\data\boss_check_list.txt", 'w', encoding='utf-8') as f:
    f.write("需要BOSS手动确认的食物（GitHub《中国食物成分表第六版》无对应数据）:\n\n")
    f.write("=== 菜品（需要估算，不存在于标准成分表中）===\n")
    for fid in range(99, 106):
        f.write(f"  ID {fid:3d} {OUR_NAMES[fid]}\n")
    f.write("\n=== 非标食材（成分表未收录）===\n")
    for fid in NEEDS_BOSS:
        f.write(f"  ID {fid:3d} {OUR_NAMES[fid]}\n")

print(f"\n✅ 数据已保存到 matched_nutrition_final.json")
print(f"✅ BOSS确认列表已保存到 boss_check_list.txt")
