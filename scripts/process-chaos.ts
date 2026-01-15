/**
 * Process Chaos Data Script
 *
 * 🎯 任务：处理 debug-payloads/chaos-data-samples.json 中的脏数据。
 *
 * 当前期望的输出：
 *   ✅ Processed: X records
 *   ⚠️ Skipped (validation failed): Y records
 *   📁 Failed records saved to: failed-records/batch-xxx.json
 *
 * TODO: 候选人需要实现以下功能：
 * 1. 读取 chaos-data-samples.json
 * 2. 使用 Zod 或 class-validator 校验每条记录
 * 3. 有效记录正常处理
 * 4. 无效记录记录到 failed-records/ 目录，包含失败原因
 * 5. 输出统计信息
 */

console.log('🚧 This script is not implemented yet!');
console.log('📝 Your task: Implement chaos data processing with validation.');
console.log('');
console.log('Requirements:');
console.log('  1. Use Zod or class-validator for runtime validation');
console.log('  2. Valid records should be processed normally');
console.log('  3. Invalid records should be saved to failed-records/');
console.log('  4. Each failed record should include the reason for failure');
console.log('');
console.log('Expected output format:');
console.log('  ✅ Processed: 7 records');
console.log('  ⚠️ Skipped (validation failed): 5 records');
console.log('  📁 Failed records saved to: failed-records/batch-1234567890.json');

process.exit(1);
