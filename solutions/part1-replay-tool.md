# 第一部分：Replay 工具实现记录

## 我的方案

- 在 Worker 侧增加 `capturePayload` 中间件，当 `CAPTURE_MODE=true` 时将每条消息写入 `debug-payloads/`。
- 在 `QueuePoller` 处理消息前调用中间件，确保捕获到完整原始 Payload。
- 实现 `scripts/replay-event.ts`，支持 `--file` 读取 JSON 并直接调用 `AnalysisProcessor.process()`。
<!-- 请在这里描述你的实现方案 -->

## 关键代码

- `apps/worker-service/src/middleware/capture.middleware.ts`
- `apps/worker-service/src/queue-poller.ts`
- `scripts/replay-event.ts`
<!-- 请在这里粘贴你的核心代码 -->

## 遇到的问题和解决方法

- **模块解析失败**：`@senior-challenge/shared-types` 在 `start:legacy` 下找不到。通过在各 app 的 `tsconfig.json` 增加 `paths` 映射解决。
- **TS6059 rootDir 报错**：引用 shared-types 时不在 `rootDir` 下。改为仅引入 `.d.ts`，并在 `paths` 指向 `packages/shared-types/src/index.d.ts`，避免将外部源码纳入编译。
- **运行时找不到 dist/main**：之前调整 `rootDir` 导致输出结构变化，恢复为 `rootDir: ./src` 后恢复正常。
- **消息不被消费**：Legacy 写入 `apps/legacy-app/local-queue`，Worker 监听 `apps/worker-service/local-queue`，导致状态一直 `PENDING`。已统一为仓库根目录 `local-queue/`，并增加启动日志确认当前目录。
- **调试脚本路径错误**：执行 `replay` 时使用了占位文件名导致找不到文件，改为使用真实 payload 文件名即可。
<!-- 请记录你遇到的问题和如何解决的 -->

## 验收结果

```bash
CAPTURE_MODE=true pnpm run start:worker

pnpm run replay -- --file=apps/worker-service/debug-payloads/9d1a4810-a470-482f-9b6c-a7a228ffa1d6-1768497700983.json
> senior-backend-challenge@1.0.0 replay /Users/ll/Documents/GitHub/-Senior-Backend-Challenge
> tsx scripts/replay-event.ts "--" "--file=apps/worker-service/debug-payloads/9d1a4810-a470-482f-9b6c-a7a228ffa1d6-1768497700983.json"
♻️ Replaying payload from: /Users/ll/Documents/GitHub/-Senior-Backend-Challenge/apps/worker-service/debug-payloads/9d1a4810-a470-482f-9b6c-a7a228ffa1d6-1768497700983.json
Processing job: 9d1a4810-a470-482f-9b6c-a7a228ffa1d6
Connected to MongoDB
Job completed: 9d1a4810-a470-482f-9b6c-a7a228ffa1d6
✅ Replay completed.
```
