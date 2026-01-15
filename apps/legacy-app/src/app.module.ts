import { Module } from '@nestjs/common';
import { AnalysisModule } from './analysis/analysis.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './shared/database/database.module';
import { MessageQueueModule } from './shared/message-queue/message-queue.module';

@Module({
    imports: [
        DatabaseModule,
        MessageQueueModule,
        HealthModule,
        AnalysisModule,
    ],
})
export class AppModule { }
