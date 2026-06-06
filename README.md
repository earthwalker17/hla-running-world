# HLA Running World Demo

面向海澜之家品牌路演的移动优先 H5 demo。核心闭环为：选择路线 -> 输入今日跑量 -> 真实地图路线推进 -> 节点解锁 / 国内 AI 陪跑反馈 -> 节点故事、权益与分享卡。

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

`AI_PROVIDER` 支持 `zhipu`、`deepseek`、`qwen`、`local`。不配置 AI Key 时会自动使用本地规则型陪跑文案；跑后 AI 聊天窗会调用 `/api/running-coach-chat`，失败时回退本地短回复。不配置高德 Key 时路线页会显示原本地路线兜底。分享卡会优先使用 `AMAP_STATIC_KEY` 调用 `/api/static-map` 生成真实静态地图快照，并在 Canvas 上叠加真实路线、已完成进度、当前位置和节点名；如果未配置 Web 服务 Key 或静态地图请求失败，则回退为基于真实经纬度绘制的地图风格路线。

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
- 节点故事支持右侧栏图文详情：已解锁节点可查看完整介绍，下一站可查看预告，后续未解锁节点暂不可点。
- 历史提交记录支持全量查看和单条撤销，便于路演演示时纠正误填跑量。
- 赛季权益入口升级为按钮侧栏，展示模拟奖品、装备券、抽奖资格和线下活动名额。
- AI 陪跑模块新增聊天气泡入口，可围绕训练、赛季、节点和品牌权益进行简短问答。
- 赛季数据、路线节点、徽章、社区跑者样本、跑团榜单和个人赛季页均为本地演示数据。
- AI 陪跑通过本地 `/api/coach` 与 `/api/running-coach-chat` 代理调用国内模型，默认智谱 GLM-4.7-Flash，支持 DeepSeek 与阿里云百炼兼容模式；前端设置超时，服务端禁用思考模式并在失败时回退本地规则。
- 跑量记录保存在浏览器 localStorage，可点击首页右上角按钮重置演示状态，也可一键切换到路演最佳演示状态。

## 验证结果

- 单元测试：`node .\node_modules\vitest\vitest.mjs run` 通过，11 项测试。
- 类型检查：`.\node_modules\.bin\vue-tsc.cmd --noEmit --pretty false` 通过。
- 生产构建：`node .\node_modules\vite\bin\vite.js build` 通过。
- 浏览器检查：跑后页节点故事侧栏、下一站预告、未解锁禁用、历史记录撤销、权益侧栏和 AI 陪跑聊天窗已在本地开发服务中检查。
