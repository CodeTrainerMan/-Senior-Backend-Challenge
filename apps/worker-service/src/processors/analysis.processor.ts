import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { AnalysisRequestedEvent, AnalysisJob, Demographics, ThirdPartyApiResponse } from '@senior-challenge/shared-types';
import type { MessageProcessor } from './processor.interface';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/analysis_db';
const FAILED_RECORDS_DIR = path.resolve(process.cwd(), '..', '..', 'failed-records');

const thirdPartyDataSchema = z.object({
    age: z.number().int().nonnegative(),
    gender: z.string().min(1),
    country: z.string().min(1),
    city: z.string().min(1).optional().nullable(),
    tags: z.array(z.string()).default([]),
    score: z.number().min(0).max(1),
});

/**
 * Analysis Processor - processes analysis jobs from the queue.
 *
 * ⚠️ 警告：这段代码存在多个问题！
 * 1. 也在写入 demographics，与 LegacyApp 冲突
 * 2. 没有处理第三方 API 数据格式错误
 * 3. 日志非常糟糕，无法追踪问题
 */
export class AnalysisProcessor implements MessageProcessor {
    private connection: mongoose.Connection | null = null;

    constructor() {
        this.initializeDatabase();
    }

    private async initializeDatabase(): Promise<void> {
        try {
            await mongoose.connect(MONGODB_URI);
            this.connection = mongoose.connection;
            logger.info({ event: 'MongoConnected', message: 'Connected to MongoDB' });
        } catch (error) {
            logger.error({ event: 'MongoConnectFailed', error });
        }
    }

    /**
     * Processes an analysis request.
     *
     * ⚠️ BUG: 这个方法也在写入 demographics，
     * 但 LegacyApp 的 delayedUpdate 可能会覆盖这里的结果！
     */
    async process(event: AnalysisRequestedEvent): Promise<void> {
        const { jobId, dataUrl, traceId } = event;

        logger.info({ event: 'JobProcessing', jobId, traceId });

        try {
            const job = await this.getJob(jobId);
            if (!job) {
                logger.warn({ event: 'JobNotFound', jobId, traceId });
                return;
            }

            const currentVersion = job.version ?? 0;

            // 更新状态为 PROCESSING（乐观锁 + 状态守卫）
            const processingUpdated = await this.updateJobStatus(jobId, 'PROCESSING', {
                expectedStatus: 'PENDING',
                expectedVersion: currentVersion,
            });
            if (!processingUpdated) {
                logger.warn({ event: 'JobProcessingSkipped', jobId, traceId, reason: 'version_or_status_mismatch' });
                return;
            }

            // 模拟调用第三方 API
            const apiResponse = await this.callThirdPartyApi(dataUrl);

            // ⚠️ BUG: 没有验证 API 响应格式！
            // 如果 apiResponse.data 格式不对，这里会崩溃
            const demographics = this.transformApiResponse(apiResponse, { jobId, traceId });
            if (!demographics) {
                await this.updateJobStatus(jobId, 'FAILED', {
                    expectedStatus: 'PROCESSING',
                    expectedVersion: currentVersion + 1,
                });
                return;
            }

            // ⚠️ BUG: 无条件写入，可能被 LegacyApp 的 delayedUpdate 覆盖
            const resultsUpdated = await this.updateJobWithResults(jobId, demographics, {
                expectedStatus: 'PROCESSING',
                expectedVersion: currentVersion + 1,
            });
            if (!resultsUpdated) {
                logger.warn({ event: 'JobResultSkipped', jobId, traceId, reason: 'version_or_status_mismatch' });
                return;
            }

            logger.info({ event: 'JobCompleted', jobId, traceId });
        } catch (error) {
            logger.error({ event: 'JobProcessingFailed', jobId, traceId, error });
            const job = await this.getJob(jobId);
            if (job) {
                await this.updateJobStatus(jobId, 'FAILED', {
                    expectedStatus: job.status,
                    expectedVersion: job.version ?? 0,
                });
            }
        }
    }

    /**
     * Simulates calling a third-party API.
     * Returns "dirty" data with various format issues.
     */
    private async callThirdPartyApi(dataUrl: string): Promise<ThirdPartyApiResponse> {
        // 模拟 API 延迟
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

        // 模拟各种脏数据场景
        const scenarios: ThirdPartyApiResponse[] = [
            // 正常数据
            {
                success: true,
                data: {
                    age: 28,
                    gender: 'female',
                    country: 'US',
                    city: 'New York',
                    tags: ['fashion', 'travel'],
                    score: 0.85,
                },
            },
            // ⚠️ 脏数据：age 是字符串
            {
                success: true,
                data: {
                    age: '25+',
                    gender: 'male',
                    country: 'UK',
                    city: null,
                    tags: 'lifestyle,food', // ⚠️ 应该是数组，但返回了字符串
                    score: '0.72', // ⚠️ 应该是数字，但返回了字符串
                },
            },
            // ⚠️ 脏数据：缺少关键字段
            {
                success: true,
                data: {
                    age: null,
                    gender: undefined,
                    country: 'CA',
                    city: 'Toronto',
                    tags: null,
                    score: null,
                },
            },
        ];

        // 随机返回一种场景
        return scenarios[Math.floor(Math.random() * scenarios.length)];
    }

    /**
     * Transforms API response to Demographics.
     *
     * ⚠️ BUG: 没有类型校验！如果字段格式不对，会崩溃或产生错误数据
     */
    private transformApiResponse(
        response: ThirdPartyApiResponse,
        context: { jobId: string; traceId?: string },
    ): Demographics | null {
        const data = response.data;
        const parsed = thirdPartyDataSchema.safeParse(data ?? {});

        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                logger.warn({
                    event: 'ValidationFailed',
                    jobId: context.jobId,
                    traceId: context.traceId,
                    field: issue.path.join('.') || 'data',
                    rawValue: data?.[issue.path[0] as keyof typeof data],
                    reason: issue.message,
                });
            }

            this.saveFailedRecord(context.jobId, context.traceId, {
                reason: 'ValidationFailed',
                issues: parsed.error.issues,
                payload: response,
            });
            return null;
        }

        return {
            ageRange: this.calculateAgeRange(parsed.data.age),
            gender: parsed.data.gender,
            location: parsed.data.country,
            interests: parsed.data.tags,
            confidence: parsed.data.score,
        };
    }

    /**
     * Calculates age range from a numeric age.
     * ⚠️ BUG: 如果传入的不是数字（比如 "25+"），会返回 undefined
     */
    private calculateAgeRange(age: number): string {
        if (age < 18) return 'under-18';
        if (age < 25) return '18-24';
        if (age < 35) return '25-34';
        if (age < 45) return '35-44';
        if (age < 55) return '45-54';
        return '55+';
    }

    private async getJob(jobId: string): Promise<AnalysisJob | null> {
        const collection = this.connection?.collection('analysis_jobs');
        if (!collection) return null;

        const doc = await collection.findOne({ jobId });
        return doc as unknown as AnalysisJob | null;
    }

    private async updateJobStatus(
        jobId: string,
        status: string,
        options?: { expectedStatus?: string; expectedVersion?: number },
    ): Promise<boolean> {
        const collection = this.connection?.collection('analysis_jobs');
        if (!collection) return false;

        const filter: Record<string, unknown> = { jobId };
        if (options?.expectedStatus) {
            filter.status = options.expectedStatus;
        }
        if (options?.expectedVersion !== undefined) {
            filter.version = options.expectedVersion;
        }

        const result = await collection.updateOne(
            filter,
            {
                $set: { status, updatedAt: new Date().toISOString() },
                $inc: { version: 1 },
            },
        );
        return result.modifiedCount === 1;
    }

    private async updateJobWithResults(
        jobId: string,
        demographics: Demographics,
        options?: { expectedStatus?: string; expectedVersion?: number },
    ): Promise<boolean> {
        const collection = this.connection?.collection('analysis_jobs');
        if (!collection) return false;

        const filter: Record<string, unknown> = { jobId };
        if (options?.expectedStatus) {
            filter.status = options.expectedStatus;
        }
        if (options?.expectedVersion !== undefined) {
            filter.version = options.expectedVersion;
        }

        const result = await collection.updateOne(
            filter,
            {
                $set: {
                    status: 'COMPLETED',
                    demographics,
                    updatedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                },
                $inc: { version: 1 },
            },
        );
        return result.modifiedCount === 1;
    }

    private saveFailedRecord(
        jobId: string,
        traceId: string | undefined,
        payload: Record<string, unknown>,
    ): void {
        try {
            if (!fs.existsSync(FAILED_RECORDS_DIR)) {
                fs.mkdirSync(FAILED_RECORDS_DIR, { recursive: true });
            }

            const filename = `job-${jobId}-${Date.now()}.json`;
            const filepath = path.join(FAILED_RECORDS_DIR, filename);
            fs.writeFileSync(
                filepath,
                JSON.stringify(
                    {
                        jobId,
                        traceId,
                        failedAt: new Date().toISOString(),
                        ...payload,
                    },
                    null,
                    2,
                ),
            );

            logger.warn({ event: 'FailedRecordSaved', jobId, traceId, filename });
        } catch (error) {
            logger.error({ event: 'FailedRecordSaveError', jobId, traceId, error });
        }
    }
}
