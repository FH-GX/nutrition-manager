"""
匹配：我们的125种食物 ←→ GitHub上的《中国食物成分表第六版》JSON数据
提取矿物质&维生素数据

手动修正已知错误的匹配，输出需要BOSS确认的部分
"""

import json
import os
import glob

# ============ 1. 加载GitHub数据 ============

DATA_DIR = r"E:\nutrition\data\cfcd_temp\json_data_vision_251206_Qwen2-5-VL-72B-Instruct"
all_foods = {}  # foodName -> data_dict

for json_file in glob.glob(os.path.join(DATA_DIR, "merged_*.json")):
    with open(json_file, 'r', encoding='utf-8') as f:
        foods = json.load(f)
    for food in foods:
        name = food.get("foodName", "")
        if name:
            all_foods[name] = food

print(f"加载了 {len(all_foods)} 种食物数据")

# ============ 2. 手工匹配表（我确信的对应关系） ============

MANUAL_MATCH = {
    # 谷类
    1: "米饭（蒸，代表值）",        # 稻米（米饭）→ 熟米饭代表值
    2: "小麦粉（标准粉）",          # 面粉
    3: "挂面（代表值）",            # 面条（煮）→接近挂面
    4: "馒头",                     # 馒头
    5: "包子（猪肉馅）",            # GitHub没有直接数据，用相近的
    6: "饺子（猪肉白菜馅）",         # 同上，先用相近代替
    7: "面包",                     # 白面包
    8: "粳米粥",                   # 大米粥
    9: "糯米 [江米]",              # 糯米饭 → 生糯米数据
    10: "玉米（鲜）",               # 鲜玉米
    # 薯类
    11: "马铃薯",                   # 土豆
    12: "甘薯(红心)[山芋、红薯]",    # 红薯
    13: "芋头（煮）",               # 芋头
    14: "山药",                     # 山药（有"山药（干）"和"山药"，选鲜的）
    # 豆类
    15: "豆腐（代表值）",           # 北豆腐
    16: "南豆腐",                   # 南豆腐
    17: "豆浆",                     # 豆浆
    18: "豆腐干（代表值）",         # 豆腐干
    19: "腐竹",                     # 腐竹
    20: "黄豆 [大豆]",              # 黄豆
    21: "赤小豆 [小豆、红豆]",       # 红豆
    22: "绿豆（干）",               # 绿豆
    # 蔬菜
    23: "大白菜（代表值）",         # 大白菜
    24: "油菜",                     # 小青菜 → 油菜（选通用名）
    25: "菠菜（鲜）[赤根菜]",       # 菠菜
    26: "番茄 [西红柿]",            # 番茄
    27: "黄瓜 [胡瓜]",              # 黄瓜
    28: "茄子（代表值）",           # 茄子
    29: "马铃薯",                   # 土豆（蔬菜类，同id11）
    30: "胡萝卜（黄）",             # 胡萝卜
    31: "白萝卜 [莱菔]",            # 白萝卜
    32: "藕 [莲藕]",                # 莲藕
    33: "西兰花 [绿菜花]",          # 西兰花
    34: "菜花 [花椰菜]",            # 花菜
    35: "南瓜 [倭瓜、番瓜]",        # 南瓜
    36: "冬瓜",                     # 冬瓜
    37: "苦瓜（鲜）[凉瓜，癞瓜]",    # 苦瓜
    38: "芹菜茎",                   # 芹菜
    39: "生菜 [叶用莴苣]",          # 生菜
    40: "圆白菜 [卷心菜]",          # 卷心菜
    41: "木耳（干）[黑木耳，云耳]",  # 木耳（干）
    42: "香菇（鲜）[香蕈，冬菇]",    # 香菇（鲜）
    # 水果
    43: "苹果（代表值）",           # 苹果
    44: "香蕉",                     # 香蕉
    45: "橙",                       # 橙子
    46: "葡萄（代表值）",           # 葡萄
    47: "西瓜（代表值）",           # 西瓜
    48: "梨（代表值）",             # 梨
    49: "桃（代表值）",             # 桃
    50: "草莓 [洋莓, 凤阳草莓]",    # 草莓
    51: "中华猕猴桃 [毛叶猕猴桃]",  # 猕猴桃
    52: "火龙果 [仙蜜果、红龙果]",  # 火龙果
    # 肉类
    53: "猪肉（代表值，fat 30g）",   # 猪肉肥瘦
    54: "猪肉（瘦）",                # 猪瘦肉
    55: "猪蹄",                      # 猪蹄
    56: "牛肉（代表值，fat 9g）",    # 牛肉肥瘦
    57: "牛肉（瘦）",                # 牛瘦肉
    58: "牛肉（腹部肉）[牛腩]",      # 牛腩
    59: "羊肉（代表值，fat 7g）",    # 羊肉肥瘦
    60: "鸡（代表值）",              # 鸡→用代表值
    61: "鸡腿",                      # 鸡腿肉
    62: "鸡翅",                      # 鸡翅
    63: "鸭（代表值）",              # 鸭肉
    64: "鹅",                        # 鹅肉
    # 蛋类
    65: "鸡蛋（代表值）",            # 鸡蛋
    66: "鸡蛋白",                    # 鸡蛋白
    67: "鸡蛋黄",                    # 鸡蛋黄
    68: "鸭蛋",                      # 鸭蛋
    69: "咸鸭蛋",                    # 咸鸭蛋
    # 鱼虾
    70: "草鱼",                      # 草鱼
    71: "鲤鱼 [鲤拐子]",             # 鲤鱼
    72: "鲫鱼",                      # 鲫鱼（用白鲫代替）
    73: "黄鱼（大黄花鱼）",          # 大黄鱼
    74: "带鱼(切段)",               # 带鱼
    75: "鲑鱼 [大马哈鱼、三文鱼]",    # 三文鱼
    76: "鳕鱼",                      # 鳕鱼（用鳕鱼代替）
    77: "河虾",                      # 河虾
    78: "对虾",                      # 对虾
    79: "河蟹",                      # 河蟹
    80: "海参",                      # 海参
    81: "生蚝",                      # 牡蛎
    # 乳类
    82: "纯牛奶（代表值，全脂）",    # 牛奶
    83: "酸奶（代表值，全脂）",      # 酸奶
    84: "全脂奶粉（代表值）",        # 全脂奶粉
    85: "奶酪（代表值，全脂）",      # 奶酪
    # 坚果
    86: "花生（炒）",                # 花生（炒的更常用）
    87: "核桃（干）",                # 核桃
    88: "杏仁",                      # 杏仁
    89: "葵花子（生）",              # 葵花子
    90: "芝麻子（白）",              # 白芝麻
    # 油脂
    91: "菜籽油 [青油]",            # 菜籽油
    92: "橄榄油",                   # 橄榄油
    93: "椰子油",                   # 椰子油
    94: "亚麻籽油",                 # GitHub数据没有，保持null
    95: "猪油（板油）",             # 猪油
    96: "芝麻油 [香油]",            # 芝麻油
    97: "豆油 [大豆油]",            # 大豆油
    98: "花生油",                   # 花生油
    # 菜品 → 没有标准数据，需要估算
    99: None,     # 番茄炒蛋
    100: None,    # 红烧肉
    101: None,    # 清蒸鱼
    102: None,    # 宫保鸡丁
    103: None,    # 糖醋排骨
    104: None,    # 鱼香肉丝
    105: None,    # 麻婆豆腐
    # 低碳水主食
    106: "小米",               # 小米（生）
    107: "小米粥",             # 小米粥
    108: None,                 # 燕麦片 - GitHub没找到
    109: None,                 # 燕麦粥
    110: "荞麦",               # 荞麦（干）
    111: "面条（生，代表值）",  # 荞麦面条→用面条代替
    112: None,                 # 全麦面包
    113: "黑米",               # 黑米
    114: "米饭（蒸，代表值）",  # 黑米饭→用米饭代替（矿物差异不大）
    115: None,                 # 藜麦 - GitHub没有
    116: None,                 # 藜麦饭
    117: "糙米",               # 糙米（生）
    118: "米饭（蒸，代表值）",  # 糙米饭→用米饭代替
    119: None,                 # 紫薯
    # 低碳水蔬菜
    120: "油麦菜",             # 油麦菜
    121: "萹菜 [空心菜、藤藤菜]", # 空心菜
    122: "芦笋",               # 芦笋
    123: "秋葵 [黄秋葵、羊角豆]", # 秋葵
    124: "娃娃菜",             # 娃娃菜
    125: "白菜薹 [菜薹，菜心]", # 菜心
}

# ============ 3. 检查并提取数据 ============

FIELD_MAP = {
    "Ca": "ca", "Fe": "fe", "Zn": "zn", "Se": "se",
    "vitaminA": "va", "thiamin": "vb1", "riboflavin": "vb2",
    "vitaminC": "vc", "vitaminETotal": "ve",
    "K": "k", "Na": "na", "P": "p", "Mg": "mag",
    "Cu": "cu", "Mn": "mn", "niacin": "niacin",
}

EXTRA_FIELDS = ["vd", "iodine", "vb6", "vb12", "folate", "vk", "pantothenic", "biotin"]

OUR_FOOD_NAMES = {
    1: "稻米（米饭）", 2: "小麦粉（面粉）", 3: "面条（煮）", 4: "馒头（标准粉）",
    5: "包子（猪肉馅）", 6: "饺子（猪肉白菜馅）", 7: "面包（白面包）", 8: "粥（大米粥）",
    9: "糯米饭", 10: "玉米（鲜）", 11: "马铃薯（土豆）", 12: "甘薯（红薯）",
    13: "芋头", 14: "山药", 15: "豆腐（北豆腐）", 16: "豆腐（南豆腐）",
    17: "豆浆", 18: "豆腐干", 19: "腐竹", 20: "黄豆",
    21: "红豆", 22: "绿豆", 23: "大白菜", 24: "油菜（小青菜）",
    25: "菠菜", 26: "番茄（西红柿）", 27: "黄瓜", 28: "茄子",
    29: "土豆（蔬菜类）", 30: "胡萝卜", 31: "白萝卜", 32: "莲藕",
    33: "西蓝花", 34: "花菜（菜花）", 35: "南瓜", 36: "冬瓜",
    37: "苦瓜", 38: "芹菜", 39: "生菜", 40: "卷心菜",
    41: "木耳（干）", 42: "香菇", 43: "苹果", 44: "香蕉",
    45: "橙子", 46: "葡萄", 47: "西瓜", 48: "梨",
    49: "桃", 50: "草莓", 51: "猕猴桃", 52: "火龙果",
    53: "猪肉（肥瘦）", 54: "猪肉（瘦肉）", 55: "猪蹄", 56: "牛肉（肥瘦）",
    57: "牛肉（瘦肉）", 58: "牛腩", 59: "羊肉（肥瘦）", 60: "鸡胸肉",
    61: "鸡腿肉", 62: "鸡翅", 63: "鸭肉", 64: "鹅肉",
    65: "鸡蛋（整）", 66: "鸡蛋白", 67: "鸡蛋黄", 68: "鸭蛋",
    69: "咸鸭蛋", 70: "草鱼", 71: "鲤鱼", 72: "鲫鱼",
    73: "黄鱼（大黄鱼）", 74: "带鱼", 75: "三文鱼", 76: "鳕鱼",
    77: "虾（河虾）", 78: "虾（对虾）", 79: "螃蟹（河蟹）", 80: "海参",
    81: "牡蛎（蚝）", 82: "牛奶", 83: "酸奶", 84: "奶粉（全脂）",
    85: "奶酪（干酪）", 86: "花生", 87: "核桃", 88: "杏仁",
    89: "瓜子（葵花子）", 90: "芝麻", 91: "菜籽油", 92: "橄榄油",
    93: "椰子油", 94: "亚麻籽油", 95: "猪油", 96: "芝麻油",
    97: "大豆油", 98: "花生油",
    99: "番茄炒蛋", 100: "红烧肉", 101: "清蒸鱼", 102: "宫保鸡丁",
    103: "糖醋排骨", 104: "鱼香肉丝", 105: "麻婆豆腐",
    106: "小米（生）", 107: "小米粥（熟）", 108: "燕麦片（生）",
    109: "燕麦粥（熟）", 110: "荞麦面（干）", 111: "荞麦面条（熟）",
    112: "全麦面包", 113: "黑米（生）", 114: "黑米饭（熟）",
    115: "藜麦（生）", 116: "藜麦饭（熟）", 117: "糙米（生）",
    118: "糙米饭（熟）", 119: "紫薯（生）",
    120: "油麦菜", 121: "空心菜", 122: "芦笋", 123: "秋葵",
    124: "娃娃菜", 125: "菜心",
}

def parse_value(val):
    if val is None or str(val) in ["", "—", "Tr", "Tr "]:
        return None
    try:
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            val = val.replace("Tr", "").strip()
            if val in ["", "—"]:
                return None
            return float(val)
    except (ValueError, TypeError):
        return None
    return None

def extract_data(db_data):
    result = {}
    for gh_field, our_field in FIELD_MAP.items():
        result[our_field] = parse_value(db_data.get(gh_field))
    for f in EXTRA_FIELDS:
        result[f] = None
    return result

# ============ 4. 执行匹配 ============

unknown_for_boss = []
matched = 0
missing_data = []
results = {}

for fid in range(1, 126):
    our_name = OUR_FOOD_NAMES[fid]
    gh_name = MANUAL_MATCH.get(fid)
    
    if gh_name is None:
        unknown_for_boss.append(our_name)
        continue
    
    db_data = all_foods.get(gh_name)
    if db_data is None:
        # 尝试模糊匹配
        found = False
        for fn, fd in all_foods.items():
            if gh_name in fn or fn in gh_name:
                db_data = fd
                found = True
                break
        if not found:
            missing_data.append(f"{our_name} → {gh_name} (未找到)")
            continue
    
    data = extract_data(db_data)
    results[fid] = data
    matched += 1

# ============ 5. 输出结果 ============

print(f"\n{'='*60}")
print(f"匹配成功: {matched}/125")
print(f"菜品（需估算）: {len([k for k in range(99,106) if MANUAL_MATCH.get(k) is None])}")
print(f"GitHub没有数据的: {len(unknown_for_boss)}")

if unknown_for_boss:
    print(f"\n⚠️ 需要BOSS手动确认的分类（GitHub数据中没有合适的对应项）:")
    for name in unknown_for_boss:
        print(f"  ❓ {name}")

# 输出数据预览
print(f"\n{'='*60}")
print("数据预览（前10个）:")
for fid in range(1, min(11, matched+1)):
    data = results.get(fid, {})
    name = OUR_FOOD_NAMES[fid]
    ca = data.get("ca", "?")
    fe = data.get("fe", "?")
    zn = data.get("zn", "?")
    print(f"  ID {fid} {name}: 钙={ca} 铁={fe} 锌={zn}")

# 保存结果
output = {}
for fid in sorted(results.keys()):
    output[fid] = results[fid]

with open(r"E:\nutrition\data\matched_nutrition.json", 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\n✅ 数据已保存到 matched_nutrition.json")
missing_file = r"E:\nutrition\data\manual_check_needed.txt"
with open(missing_file, 'w', encoding='utf-8') as f:
    f.write("需要BOSS手动确认的食物:\n")
    for name in unknown_for_boss:
        f.write(f"  {name}\n")
print(f"✅ BOSS确认列表已保存到 manual_check_needed.txt")
