# 第三部分：可观测性与容错

## 脏数据分析

<!-- 分析 chaos-data-samples.json 中的数据问题 -->

### 发现的问题类型

| 记录 ID | 问题字段 | 期望类型 | 实际值 | 问题描述 |
|---------|----------|----------|--------|----------|
| record-002 | age | number | "25+" | 字符串而非数字 |
| ... | ... | ... | ... | ... |

## 我的解决方案

### 1. Runtime Validation 实现

<!-- 描述你的校验方案，推荐使用 Zod -->

```typescript
// 请粘贴你的 Schema 定义
```

### 2. 错误处理策略

<!-- 描述无效数据如何处理 -->

### 3. 日志改进

<!-- 展示你改进后的日志格式 -->

```typescript
// Before
console.log('Error happened');

// After
// 请展示你的结构化日志方案
```

### 4. Trace ID 透传

<!-- 如果实现了 Trace ID，请描述方案 -->

## 验收结果

```bash
# 请粘贴 pnpm run process:chaos 的输出
```
