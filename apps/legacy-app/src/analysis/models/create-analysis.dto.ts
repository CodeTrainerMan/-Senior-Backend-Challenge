import { IsString, IsUrl } from 'class-validator';

/**
 * DTO for creating an analysis job.
 */
export class CreateAnalysisDto {
    @IsString()
    userId!: string;

    @IsUrl()
    dataUrl!: string;
}
