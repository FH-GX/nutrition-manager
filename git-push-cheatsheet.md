# 🚀 Git 推送速查

## 一句话流程

```bash
git status         # ① 看看改了什么
git add -A         # ② 把所有改动放进待提交区
git commit -m "xxx" # ③ 提交，写清楚改了啥
git push origin main  # ④ 推送到 GitHub
```

## 每一步在干嘛（装修房子的比喻）

| 命令 | 做什么 | 类比 |
|---|---|---|
| `git status` | 检查当前改了哪些文件 | 转一圈看看哪里动过了 |
| `git add -A` | 把所有改动放到"暂存区" | 把改好的东西搬进纸箱 |
| `git commit -m "消息"` | 打包暂存区，记一次版本 | 封箱，用马克笔写标签 |
| `git push origin main` | 把本地版本发到 GitHub | 叫快递送到 GitHub 仓库 |

## 实操步骤

### 打开终端
- **Git Bash** → `D:\python\Git\git-bash.exe`
- 或直接在 `E:\nutrition` 文件夹地址栏输入 `cmd` 回车

### 进入项目目录
```bash
cd /e/nutrition
```

### 然后敲上面4条命令

## commit 消息怎么写

简短写清楚这次改了啥，常用前缀：

| 前缀 | 场景 | 例子 |
|---|---|---|
| `feat:` | 加新功能 | `feat: 新增滑动条微调功能` |
| `fix:` | 修 bug | `fix: 修复登录后等级图标不显示` |
| `refactor:` | 重构代码 | `refactor: 删除夏萌引用替换为GX` |
| `style:` | 改样式 | `style: 日历格子填充色调整` |

## 注意事项

- `git status` 是安全的，随便看，不会改东西
- 第一次推送可能需要输入 GitHub 账号密码（或者 token）
- 推送完等 1-3 分钟，GitHub Pages 会自动构建更新

---

> 最后更新：2026-05-30
