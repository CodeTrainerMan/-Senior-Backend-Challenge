# 第四部分：系统设计与权衡 - 你的回答

## 1. 架构升级方案

目标是 500 万条/2 小时（约 700 QPS），在 2 周内以最小改动完成横向扩展与吞吐提升。

### 架构图 (ASCII 或描述)

```
[S3 Upload (10GB CSV)]
        |
        v
 [S3 Event] -> [Ingest Lambda/Fargate Job]
        |               |
        |         (split CSV -> chunk files)
        v               v
    [SQS FIFO] <---- [Chunk Manifest]
        |
        v
 [Worker Service (Fargate/ECS autoscaling)]
        |
        v
     [MongoDB / DynamoDB]
        |
        v
     [Report Builder + S3 Output]
```

### 核心改动点

1. **分片处理**：上传后的 CSV 先被切分为固定大小 chunk（如 10k 行），每个 chunk 生成 SQS 消息。
2. **水平扩展**：Worker 运行在 ECS/Fargate，按队列堆积量自动扩容，目标并发满足 700 QPS。
3. **写入优化**：批量写入（bulk write）+ 索引优化，避免单条写瓶颈。
4. **报表异步生成**：结果写入后由单独任务汇总生成报告并写回 S3。

## 2. 对 CTO 建议的回应 (Rust 重写?)

不建议在 2 周内重写成 Rust。主要原因是 **交付风险高**、团队现有栈是 Node.js，重写带来的测试和稳定性风险无法在期限内消化。
替代方案：
- 用 **ECS/Fargate + SQS** 进行水平扩展；
- **批处理优化**（批量拉取、批量写入、并发控制）；
- 热点指标做 **性能 profiling**，仅对瓶颈点做局部优化或引入 Worker 分层。

## 3. 2周冲刺中的"妥协" (Trade-offs)

- 暂不做完整 E2E 覆盖，优先保障核心 pipeline 的单元/集成测试。
- 监控指标与告警以关键指标为主（吞吐、失败率、延迟），不追求全量指标体系。
- 不做复杂的多租户隔离或成本优化，优先满足 SLA。

## 4. 大规模错误的调试策略

- **采样 + 汇总**：错误日志进行采样，按错误类型聚合统计，只告警 Top N。
- **失败记录归档**：失败记录写入 S3（带 traceId/recordId），可按需检索。
- **告警分级**：失败率超过阈值才触发告警，避免单条异常引发洪泛。
- **重试与隔离**：失败 chunk 放入 DLQ，允许手动或定时重放，避免阻塞主队列。
