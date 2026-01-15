# 第二部分：架构治理分析

## 问题根因分析

根因是**双写**与**异步覆盖**：LegacyApp 在创建任务时写入 `demographics`，并且有延迟写入；WorkerService 也写入同一字段。两条写路径没有版本或状态守卫，导致**后到的写覆盖先到的写**，出现结果“闪烁”。

### 1. 发现的问题点

- `LegacyApp` 在 `createAnalysis` 中做了 `calculateQuickDemographics` 并写入数据库。
- `LegacyApp` 使用 `setTimeout` 延迟更新同一字段，没有检查当前状态或版本。
- `WorkerService` 无条件写入结果，且不校验当前状态/版本。

### 2. 竞态条件详解

Worker 写入完成后，Legacy 的延迟写覆盖正确结果。

```
时间线：
T0: Legacy 创建任务，写入 PENDING + quick demographics
T1: Worker 处理完成，写入 COMPLETED + 正确 demographics
T2: Legacy 延迟写入触发，覆盖 demographics（结果“闪烁”）
...
```

## 我的重构方案

### 1. 设计原则

- 单一写入者：只有 WorkerService 计算并写入 `demographics`
- 明确状态流转：`PENDING -> PROCESSING -> COMPLETED/FAILED`
- 乐观锁避免脏写：基于 `version` + `status` 进行条件更新

### 2. 具体修改

- `apps/legacy-app/src/analysis/analysis.service.ts`
- `apps/worker-service/src/processors/analysis.processor.ts`

#### LegacyApp 修改

- 禁用 `calculateQuickDemographics` 与 `delayedUpdate`
- 创建任务时只写入 `PENDING` 和 `version: 0`
- 只负责发送消息，不再写入结果

#### WorkerService 修改

- 读取当前 `version/status` 后再更新
- `PROCESSING` 更新要求 `status=PENDING` 且 `version` 匹配
- 写入结果要求 `status=PROCESSING` 且 `version` 匹配

### 3. 状态机设计

`PENDING -> PROCESSING -> COMPLETED`  
异常时：`PROCESSING -> FAILED`

## 验收结果

- 创建任务后刷新多次，`demographics` 不再被后续写覆盖
