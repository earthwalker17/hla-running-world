# HLA Running World Demo

面向海澜之家品牌路演与内部临时预览的移动优先 H5 demo。核心闭环为：选择路线 -> 输入今日跑量 -> 地图路线推进 -> 节点解锁 / AI 陪跑反馈 -> 节点故事、权益与分享卡。

## 本地运行

```bash
pnpm install --registry=https://registry.npmmirror.com
pnpm dev
```

复制 `.env.example` 为 `.env` 后可开启真实地图和国内 AI：

```bash
# 动态地图与路网规划：高德 Web端(JS API) Key
AMAP_KEY=你的高德WebJSKey
AMAP_SECURITY_CODE=你的高德安全密钥

# 分享卡真实地图快照：高德 Web服务 Key，和 Web JS Key 分开申请
AMAP_STATIC_KEY=你的高德Web服务Key
# 可选别名：二选一即可
# AMAP_WEB_SERVICE_KEY=你的高德Web服务Key

AI_PROVIDER=zhipu
ZHIPU_API_KEY=你的智谱Key

# 生产静态构建默认不请求 /api；只有部署环境同时提供 API 时才打开
VITE_ENABLE_REMOTE_ROADSHOW_API=true
```

修改 `.env` 后需要重启 `pnpm dev`，Vite 只会在启动时读取本地环境变量。

`AI_PROVIDER` 支持 `zhipu`、`deepseek`、`qwen`、`local`。不配置 AI Key 时会自动使用本地规则型陪跑文案；跑后 AI 聊天窗会调用 `/api/running-coach-chat`，失败时回退本地短回复。不配置高德 Key 时路线页会显示原本地路线兜底。分享卡会优先使用 `AMAP_STATIC_KEY` 调用 `/api/static-map` 生成真实静态地图快照，并在 Canvas 上叠加真实路线、已完成进度、当前位置和节点名；如果未配置 Web 服务 Key 或静态地图请求失败，则回退为基于真实经纬度绘制的地图风格路线。

生产静态构建默认进入内部预览模式：不请求 `/api/coach`、`/api/running-coach-chat`、`/api/demo-config` 或 `/api/static-map`，直接使用本地 AI 与本地地图兜底，适合上传腾讯 CloudBase 静态网站托管。只有当生产部署同时提供这些 API 路由时，才设置 `VITE_ENABLE_REMOTE_ROADSHOW_API=true`。

生产构建和预览：

```bash
pnpm test
pnpm build
pnpm preview
```

如需本地预览：

```text
http://127.0.0.1:5173/
```

## Demo 范围

- 使用 Vue 3、Vite、TypeScript、Vue Router 和 lucide-vue-next。
- 首次打开会在浏览器本地生成匿名访客身份，例如“江阴跑友 8F3C”；路线、跑量、分享卡状态按访客写入 `localStorage` 分桶。
- 路线页优先使用高德地图 JS API 2.0 和路网规划，纵向展示三条路线地图、实线路线、节点 Marker 和当前完成进度；无 Key 时回退到本地自绘路线。
- 分享卡优先使用高德 Web 服务静态地图作为底图，再叠加真实路线、进度和节点名；无 Web 服务 Key 时保留本地地图风格兜底。
- 跑后页集成地图、跑量输入、AI 陪跑、节点故事和赛季徽章；每次提交跑量后在地图上高亮新增里程并触发推进动画。
- 节点故事支持右侧栏图文详情：已解锁节点可查看完整介绍，下一站可查看预告，后续未解锁节点暂不可点。
- 历史提交记录支持全量查看和单条撤销，便于路演演示时纠正误填跑量。
- 赛季权益入口升级为按钮侧栏，展示模拟奖品、装备券、抽奖资格和线下活动名额。
- AI 陪跑模块新增聊天气泡入口，可围绕训练、赛季、节点和品牌权益进行简短问答。
- 赛季数据、路线节点、徽章、社区跑者样本、跑团榜单和个人赛季页均为本地演示数据。
- AI 陪跑通过本地 `/api/coach` 与 `/api/running-coach-chat` 代理调用国内模型，默认智谱 GLM-4.7-Flash，支持 DeepSeek 与阿里云百炼兼容模式；前端设置超时，服务端禁用思考模式并在失败时回退本地规则。
- 跑量记录保存在当前浏览器的 `localStorage`。不同手机/浏览器互不共享、不串数据；同一浏览器会保留同一访客状态；清除浏览器数据会回到新访客。

## CloudBase 临时部署

本阶段建议使用腾讯 CloudBase 静态网站托管默认域名，只作为海澜之家内部转发和手机预览链接。

当前临时预览链接：[HLA Running World 临时内部预览](https://hla-rw-d5g13shx385f96a96-1441063687.tcloudbaseapp.com)

```bash
pnpm test
pnpm build
```

构建后上传 `dist/`，或将 `dist/` 压缩为静态包后上传。

人工操作步骤：

1. 登录腾讯云 CloudBase 控制台。
2. 创建或选择一个环境，优先上海地域。
3. 进入静态网站托管，上传 `dist/` 或上述 zip 包。
4. 配置 SPA 回退到 `index.html`，避免刷新 `/route`、`/run`、`/profile` 时 404。
5. 拿到默认访问域名后，在手机和微信转发场景里做一次打开验证。

默认域名主要适合开发/测试和内部临时体验，可能存在访问频率限制、提示页或稳定性风险。若后续扩大传播，应换已备案自定义域名。

## 验证结果

- 单元测试：`pnpm test` 通过，4 个测试文件、11 项测试。
- 类型检查：`.\node_modules\.bin\vue-tsc.cmd --noEmit --pretty false` 通过。
- 生产构建：`pnpm build` 通过。
- 生产预览 HTTP 检查：`/`、`/route`、`/run`、`/share`、`/profile` 均返回应用入口。
- 临时部署：腾讯 CloudBase 默认域名已可访问。
- 手机交互检查：2026-06-07 已用手机访问验证通过。
