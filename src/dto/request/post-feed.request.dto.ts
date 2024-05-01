import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PostFeedRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  constructor(content: string) {
    this.content = content;
  }
}
