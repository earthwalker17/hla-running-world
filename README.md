# HLA Running World Demo

面向海澜之家品牌路演的移动优先 H5 demo。核心闭环为：选择路线 -> 输入今日跑量 -> 真实地图路线推进 -> 节点解锁 / 国内 AI 陪跑反馈 -> 生成个人赛季分享卡。

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
```

修改 `.env` 后需要重启 `pnpm dev`，Vite 只会在启动时读取本地环境变量。

`AI_PROVIDER` 支持 `zhipu`、`deepseek`、`qwen`、`local`。不配置 AI Key 时会自动使用本地规则型陪跑文案；不配置高德 Key 时路线页会显示原本地路线兜底。分享卡会优先使用 `AMAP_STATIC_KEY` 调用 `/api/static-map` 生成真实静态地图快照，并在 Canvas 上叠加真实路线、已完成进度、当前位置和节点名；如果未配置 Web 服务 Key 或静态地图请求失败，则回退为基于真实经纬度绘制的地图风格路线。

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
- 路线页优先使用高德地图 JS API 2.0 和路网规划，纵向展示三条路线地图、实线路线、节点 Marker 和当前完成进度；无 Key 时回退到本地自绘路线。
- 分享卡优先使用高德 Web 服务静态地图作为底图，再叠加真实路线、进度和节点名；无 Web 服务 Key 时保留本地地图风格兜底。
- 跑后页集成地图、跑量输入、AI 陪跑、节点故事和赛季徽章；每次提交跑量后在地图上高亮新增里程并触发推进动画。
- 赛季数据、路线节点、徽章、社区跑者样本、跑团榜单和个人赛季页均为本地演示数据。
- AI 陪跑通过本地 `/api/coach` 代理调用国内模型，默认智谱 GLM-4.7-Flash，支持 DeepSeek 与阿里云百炼兼容模式；前端超时 20 秒，服务端禁用思考模式并在失败时回退本地规则。
- 跑量记录保存在浏览器 localStorage，可点击首页右上角按钮重置演示状态，也可一键切换到路演最佳演示状态。

## 验证结果

- 单元测试：`node .\node_modules\vitest\vitest.mjs run` 通过，11 项测试。
- 类型检查：`.\node_modules\.bin\vue-tsc.cmd --noEmit --pretty false` 通过。
- 生产构建：`node .\node_modules\vite\bin\vite.js build` 通过。
- 浏览器检查：首页、路线页、跑后页、分享页和个人页均已在本地开发服务中检查。
