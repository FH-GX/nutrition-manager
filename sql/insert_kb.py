import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://thgcjxnvsantzrdyqcug.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZ2NqeG52c2FudHpyZHlxY3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODUwMjEsImV4cCI6MjA5MzQ2MTAyMX0.zR3Dcics3I982dqZGbXv-zmbtXbJCb8VuAJSKjoyP_8"

def main():
    # 1. 登录获取token
    login_data = json.dumps({
        'email': 'fhgexin@gmail.com',
        'password': 'FHgx15990576191'
    }).encode()

    login_req = urllib.request.Request(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        data=login_data,
        headers={
            'apikey': ANON_KEY,
            'Content-Type': 'application/json'
        }
    )

    with urllib.request.urlopen(login_req) as resp:
        login_result = json.loads(resp.read())
        token = login_result['access_token']

    print("登录成功!")

    # 2. 插入营养素基础概念
    content = """食物分为7大类营养素——\n\n最主要三大类（供能营养素）：\n① 碳水化合物：主要能量来源，1g提供4kcal\n② 蛋白质：构成身体组织，1g提供4kcal\n③ 脂类：高效储能，1g提供9kcal\n\n次要4大类（不提供能量但不可或缺）：\n④ 维生素：调节代谢，维持生理功能\n⑤ 矿物质：构成骨骼、维持电解质平衡\n⑥ 膳食纤维：促进肠道健康，调节血糖\n⑦ 水：构成体液，参与所有生化反应"""

    insert_data = json.dumps({
        'display_order': 0,
        'title': '食物的7大类营养素',
        'category': '名词解释',
        'content': content,
        'is_displayed': True
    }).encode()

    insert_req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/knowledge_base',
        data=insert_data,
        headers={
            'apikey': ANON_KEY,
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(insert_req) as resp:
            result = json.loads(resp.read())
            print(f"插入成功: {result[0].get('title', 'OK')}")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"插入失败: {e.code} - {error_body}")

if __name__ == '__main__':
    main()
