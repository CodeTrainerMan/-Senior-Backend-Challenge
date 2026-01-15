import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../shared/database/database.service';
import { MessageQueueService } from '../shared/message-queue/message-queue.service';
import { CreateAnalysisDto } from './models/create-analysis.dto';
import type { AnalysisJob, Demographics, AnalysisRequestedEvent } from '@senior-challenge/shared-types';

/**
 * Analysis Service - handles analysis job creation and retrieval.
 *
 * ⚠️ 警告：这段代码存在严重的架构问题！
 * 1. 此服务在创建任务时会进行"初步计算"并写入数据库
 * 2. 但同时 WorkerService 也会计算并写入同一条记录
 * 3. 这导致了竞态条件和数据不一致
 *
 * 这是故意设计的问题代码，用于面试考察。
 */
@Injectable()
export class AnalysisService {
    private readonly logger = new Logger(AnalysisService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly messageQueueService: MessageQueueService,
    ) { }

    /**
     * Creates a new analysis job.
     *
     * ⚠️ BUG: 这个方法做了太多事情！
     * 1. 生成 ID
     * 2. 进行初步计算 (calculateQuickDemographics)
     * 3. 保存到数据库
     * 4. 发送消息
     *
     * 问题：如果 Worker 处理得比这个方法的 setTimeout 更快，
     * 那么 Worker 的正确结果会被这里的"初步计算"覆盖！
     */
    async createAnalysis(dto: CreateAnalysisDto): Promise<AnalysisJob> {
        const jobId = uuidv4();
        const traceId = uuidv4();
        const now = new Date().toISOString();

        // ⚠️ 之前这里会做初步计算并写入，但会与 Worker 冲突
        // const quickDemographics = this.calculateQuickDemographics(dto.userId);

        const job: AnalysisJob = {
            jobId,
            userId: dto.userId,
            dataUrl: dto.dataUrl,
            status: 'PENDING',
            // demographics: quickDemographics, // ⚠️ 不再写入初步结果
            createdAt: now,
            updatedAt: now,
            version: 0,
        };

        // 保存到数据库
        await this.databaseService.saveJob(job);
        this.logger.log(`✅ Job created: ${jobId}`);

        // 发送消息给 Worker
        const event: AnalysisRequestedEvent = {
            eventType: 'AnalysisRequested',
            jobId,
            userId: dto.userId,
            dataUrl: dto.dataUrl,
            timestamp: now,
            traceId,
        };

        await this.messageQueueService.publishEvent(event);

        // ⚠️ 之前的延迟更新会覆盖 Worker 的结果，已禁用
        // setTimeout(() => {
        //     this.delayedUpdate(jobId, quickDemographics);
        // }, 2000);

        return job;
    }

    /**
     * Gets an analysis job by ID.
     */
    async getAnalysisById(jobId: string): Promise<AnalysisJob | null> {
        return this.databaseService.findJobById(jobId);
    }

    /**
     * ⚠️ BUG: 这个方法不应该存在于 API 服务中！
     * 它假装做一些"快速计算"，但实际上只是随机猜测。
     */
    private calculateQuickDemographics(userId: string): Demographics {
        // 这是假的计算逻辑，实际只是随机生成
        const ageRanges = ['18-24', '25-34', '35-44', '45-54'];
        const genders = ['male', 'female', 'other'];
        const locations = ['US', 'UK', 'CA', 'AU'];

        return {
            ageRange: ageRanges[Math.floor(Math.random() * ageRanges.length)],
            gender: genders[Math.floor(Math.random() * genders.length)],
            location: locations[Math.floor(Math.random() * locations.length)],
            confidence: 0.3, // 低置信度
        };
    }

    /**
     * ⚠️ 极其危险的方法！
     * 这个方法会在 2 秒后无条件覆盖数据库中的 demographics。
     * 如果 Worker 已经写入了正确的数据，这里会把它覆盖掉！
     */
    private async delayedUpdate(jobId: string, demographics: Demographics): Promise<void> {
        try {
            // ⚠️ BUG: 无条件覆盖，不检查当前状态
            await this.databaseService.updateJob(jobId, {
                demographics,
                updatedAt: new Date().toISOString(),
            });
            console.log('Updated demographics for job ' + jobId); // ⚠️ BUG: 糟糕的日志
        } catch (error) {
            console.log('Error happened'); // ⚠️ BUG: 没有任何有用信息的日志
        }
    }
}
