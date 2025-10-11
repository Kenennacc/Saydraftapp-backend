import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateChatDTO {
  @ApiProperty({
    description: 'New title for the chat',
    example: 'Employment Contract Discussion',
    minLength: 1,
    maxLength: 255,
  })
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title is required' })
  @MinLength(1, { message: 'Title must be at least 1 character long' })
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  title: string;
}

export class SelectPrompt {
  @ApiProperty({
    description: 'The selected prompt option value',
    example: 'Yes',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Value must be a string' })
  @IsNotEmpty({ message: 'Value is required' })
  @MinLength(1, { message: 'Value must be at least 1 character long' })
  @MaxLength(100, { message: 'Value must not exceed 100 characters' })
  value: string;
}

export class InviteUserDTO {
  @ApiProperty({
    description: 'Email address of the user to invite for contract review',
    example: 'contractor@example.com',
    maxLength: 254,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MaxLength(254, { message: 'Email must not exceed 254 characters' })
  email: string;
}

export class CreateMessageDTO {
  @ApiPropertyOptional({
    description: 'Text message content (required if messageId is not provided)',
    example: 'I agree to the terms',
    minLength: 1,
    maxLength: 1000,
  })
  @ValidateIf((o) => o.text !== undefined)
  @IsString({ message: 'Text must be a string' })
  @IsNotEmpty({ message: 'Text cannot be empty' })
  @MinLength(1, { message: 'Text must be at least 1 character long' })
  @MaxLength(1000, { message: 'Text must not exceed 1000 characters' })
  text?: string;

  @ApiPropertyOptional({
    description: 'Message ID for prompt selection (required if text is not provided)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @ValidateIf((o) => o.messageId !== undefined)
  @IsUUID(4, { message: 'MessageId must be a valid UUID' })
  @IsNotEmpty({ message: 'MessageId cannot be empty' })
  messageId?: string;
}
