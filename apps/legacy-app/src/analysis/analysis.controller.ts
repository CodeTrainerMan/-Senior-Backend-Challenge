import { Controller, Post, Get, Body, Param, NotFoundException, Logger } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { CreateAnalysisDto } from './models/create-analysis.dto';
import type { AnalysisJob } from '@senior-challenge/shared-types';

@Controller('analysis')
export class AnalysisController {
    private readonly logger = new Logger(AnalysisController.name);

    constructor(private readonly analysisService: AnalysisService) { }

    /**
     * Creates a new analysis job.
     */
    @Post()
    async createAnalysis(@Body() dto: CreateAnalysisDto): Promise<AnalysisJob> {
        this.logger.log(`📊 Creating analysis for user: ${dto.userId}`);
        return this.analysisService.createAnalysis(dto);
    }

    /**
     * Gets an analysis job by ID.
     */
    @Get(':jobId')
    async getAnalysis(@Param('jobId') jobId: string): Promise<AnalysisJob> {
        const job = await this.analysisService.getAnalysisById(jobId);

        if (!job) {
            throw new NotFoundException(`Analysis job not found: ${jobId}`);
        }

        return job;
    }
}
