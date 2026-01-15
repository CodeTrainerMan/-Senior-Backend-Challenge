/// <reference path="./node-shims.d.ts" />
/**
 * Replay Event Script
 *
 * 🎯 任务：实现这个脚本，使其能够从 debug-payloads/ 目录读取 JSON 文件，
 * 并直接调用 Worker 的处理逻辑（绕过消息队列）。
 *
 * 用法：pnpm run replay -- --file=debug-payloads/job-xxx.json
 *
 * TODO: 候选人需要实现以下功能：
 * 1. 解析命令行参数获取文件路径
 * 2. 读取 JSON 文件内容
 * 3. 初始化 AnalysisProcessor
 * 4. 调用 processor.process(event)
 * 5. 输出处理结果
 */
import * as fs from 'fs';
import * as path from 'path';
import type { AnalysisRequestedEvent } from '../packages/shared-types/src/types';
import { AnalysisProcessor } from '../apps/worker-service/src/processors/analysis.processor';

function getFileArg(args: string[]): string | null {
    const inlineArg = args.find((arg) => arg.startsWith('--file='));
    if (inlineArg) {
        return inlineArg.slice('--file='.length);
    }

    const flagIndex = args.indexOf('--file');
    if (flagIndex >= 0) {
        return args[flagIndex + 1] ?? null;
    }

    const shortIndex = args.indexOf('-f');
    if (shortIndex >= 0) {
        return args[shortIndex + 1] ?? null;
    }

    return null;
}

function readEventFromFile(filepath: string): AnalysisRequestedEvent {
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as AnalysisRequestedEvent;
}

async function main(): Promise<void> {
    const fileArg = getFileArg(process.argv.slice(2));
    if (!fileArg) {
        console.error('❌ Missing --file argument.');
        console.error('Usage: pnpm run replay -- --file=debug-payloads/job-xxx.json');
        process.exit(1);
        return;
    }

    const filepath = path.isAbsolute(fileArg)
        ? fileArg
        : path.join(process.cwd(), fileArg);

    if (!fs.existsSync(filepath)) {
        console.error(`❌ File not found: ${filepath}`);
        process.exit(1);
        return;
    }

    let event: AnalysisRequestedEvent;
    try {
        event = readEventFromFile(filepath);
    } catch (error) {
        console.error('❌ Failed to read or parse JSON file:', error);
        process.exit(1);
        return;
    }

    console.log(`♻️ Replaying payload from: ${filepath}`);

    const processor = new AnalysisProcessor();
    await processor.process(event);

    console.log('✅ Replay completed.');
}

main().catch((error) => {
    console.error('❌ Replay failed:', error);
    process.exit(1);
});
