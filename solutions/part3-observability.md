# 第三部分：可观测性与容错

## 脏数据分析

`chaos-data-samples.json` 中存在类型混乱、缺字段、非法值与格式错误（如 `age` 字符串、`tags` 字符串、`email` 非法、`engagementScore` 非数值或越界）。

### 发现的问题类型

| 记录 ID | 问题字段 | 期望类型 | 实际值 | 问题描述 |
|---------|----------|----------|--------|----------|
| record-002 | age | number | "25+" | 字符串而非数字 |
| ... | ... | ... | ... | ... |

## 我的解决方案

### 1. Runtime Validation 实现

使用 `zod` 定义运行时校验 Schema，对每条记录 `safeParse`，不合法则记录原因并跳过。

```typescript
const chaosRecordSchema = z.object({
  id: z.string().min(1),
  age: z.number().int().nonnegative(),
  gender: z.string().min(1),
  country: z.string().min(1),
  city: z.string().min(1),
  tags: z.array(z.string()),
  engagementScore: z.number().min(0).max(1),
  email: z.string().email(),
});
```

### 2. 错误处理策略

无效记录不会导致整个批处理失败：记录每条失败原因，汇总保存到 `failed-records/`，并继续处理其它记录。

### 3. 日志改进

Worker 与脚本使用结构化 JSON 日志，包含 `event`、`jobId`、`traceId`、`field`、`rawValue` 等。

```typescript
// Before
console.log('Error happened');

// After
logger.warn({
  event: 'ValidationFailed',
  jobId,
  traceId,
  field: 'age',
  rawValue: '25+',
});
```

### 4. Trace ID 透传

在 LegacyApp 创建任务时生成 `traceId` 并放入 `AnalysisRequestedEvent`，Worker 日志从事件中透传。

## 验收结果

```bash
✅ Processed: 4 records
⚠️ Skipped (validation failed): 8 records
📁 Failed records saved to: failed-records/batch-xxxx.json
```
