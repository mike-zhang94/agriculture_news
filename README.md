# 农机行业通

全球农业科技资讯聚合平台，专注农用无人机、农用无人车、农业机器人领域。

自动从 RSS 信源和微博等平台抓取资讯，通过 LLM 翻译并提炼摘要，支持一键生成 AI 日报并推送至飞书。

## 功能

- 多信源管理（RSSHub / 标准 RSS）
- LLM 自动翻译与摘要（OpenAI 兼容接口）
- 点击标题查看完整摘要和原文链接
- AI 日报生成，推送至飞书文档
- 小红书风格内容创作与图片渲染

## 部署（推荐：Docker Compose）

**前提**：服务器已安装 Docker 和 Docker Compose。

```bash
# 1. 克隆仓库
git clone https://github.com/mike-zhang94/agriculture_news.git /opt/agritech
cd /opt/agritech

# 2. 启动所有服务
docker compose up -d

# 3. 访问
http://<服务器IP>:3737
```

三个容器会自动启动：主应用（3737）、RSSHub（3810）、Redis（缓存）。

数据存储在 Docker volumes，重启容器不会丢失。

## 配置

首次启动后，访问 `http://<IP>:3737/config.html` 填写：

| 配置项 | 说明 |
|--------|------|
| 编辑模型 Base URL / Key / Model | 用于新闻翻译和摘要的 LLM |
| 创作模型 | 用于内容创作的 LLM（可与编辑模型共用） |
| 飞书配置 | App ID / Secret / Space ID / 父节点 Token |
| 黑名单关键词 | 逗号分隔，过滤不相关资讯 |

## 本地开发

```bash
npm install

# 需要先启动 RSSHub
docker run -p 1200:1200 diygod/rsshub

node server.js   # http://localhost:3737
```

## 自动部署

推送到 `main` 分支后，GitHub Actions 自动 SSH 进服务器执行 `git pull + docker compose up -d --build`。

需要在 GitHub 仓库 Settings → Secrets 中添加：
- `SERVER_HOST`：服务器公网 IP
- `SERVER_SSH_KEY`：服务器 SSH 私钥（`cat ~/.ssh/id_rsa`）
