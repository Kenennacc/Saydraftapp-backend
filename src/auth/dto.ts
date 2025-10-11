import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class RegisterDTO {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 2,
    maxLength: 50,
  })

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'First name is required.' })
  @IsString({ message: 'First name must be text.' })
  @Length(2, 50, {
    message:
      'First name must be between $constraint1 and $constraint2 characters.',
  })
  @Matches(/^[\p{L}'\-\s]+$/u, {
    message: 'First name contains invalid characters.',
  })
  firstname: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 2,
    maxLength: 50,
  })

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Last name is required.' })
  @IsString({ message: 'Last name must be text.' })
  @Length(2, 50, {
    message:
      'Last name must be between $constraint1 and $constraint2 characters.',
  })
  @Matches(/^[\p{L}'\-\s]+$/u, {
    message: 'Last name contains invalid characters.',
  })
  lastname: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    minLength: 5,
    maxLength: 254,
  })
  @Transform(({ value }) =>

    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({ message: 'Email address is required.' })
  @IsEmail({}, { message: 'Email address is not valid.' })
  @Length(5, 254, {
    message: 'Email must be between $constraint1 and $constraint2 characters.',
  })
  email: string;

  @ApiProperty({
    description: 'User password (min 8 chars, must include uppercase, lowercase, number, and special char)',
    example: 'SecureP@ss123',
    minLength: 8,
    maxLength: 128,
  })
  @IsNotEmpty({ message: 'Password is required.' })
  @IsString({ message: 'Password must be text.' })
  @Length(8, 128, {
    message:
      'Password must be between $constraint1 and $constraint2 characters.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/, {
    message:
      'Password must include uppercase and lowercase letters, a number, and a special character.',
  })
  @Matches(/^\S+$/, { message: 'Password must not contain spaces.' })
  password: string;
}

export class LoginDTO {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @Transform(({ value }) =>

    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({ message: 'Email address is required.' })
  @IsEmail({}, { message: 'Email address is not valid.' })
  @Length(5, 254, {
    message: 'Email must be between $constraint1 and $constraint2 characters.',
  })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecureP@ss123',
  })
  @IsNotEmpty({ message: 'Password is required.' })
  @IsString({ message: 'Password must be text.' })
  @Length(8, 128, {
    message:
      'Password must be between $constraint1 and $constraint2 characters.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/, {
    message:
      'Password must include uppercase and lowercase letters, a number, and a special character.',
  })
  @Matches(/^\S+$/, { message: 'Password must not contain spaces.' })
  password: string;
}

export class ForgotPasswordDTO {
  @ApiProperty({
    description: 'Email address to send password reset link',
    example: 'john.doe@example.com',
  })
  @Transform(({ value }) =>

    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({ message: 'Email address is required.' })
  @IsEmail({}, { message: 'Email address is not valid.' })
  @Length(5, 254, {
    message: 'Email must be between $constraint1 and $constraint2 characters.',
  })
  email: string;
}

export class ResetPasswordDTO {
  @ApiProperty({
    description: 'Password reset token received via email',
    example: 'a1b2c3d4e5f6...',
    minLength: 128,
    maxLength: 128,
  })

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Token is required.' })
  @IsString({ message: 'Token must be a string.' })
  @Length(128, 128, {
    message: 'Token is invalid',
  })
  @Matches(/^[0-9a-fA-F]{128}$/, {
    message: 'Token is invalid.',
  })
  token: string;

  @ApiProperty({
    description: 'New password',
    example: 'NewSecureP@ss123',
  })
  @IsNotEmpty({ message: 'Password is required.' })
  @IsString({ message: 'Password must be text.' })
  @Length(8, 128, {
    message:
      'Password must be between $constraint1 and $constraint2 characters.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/, {
    message:
      'Password must include uppercase and lowercase letters, a number, and a special character.',
  })
  @Matches(/^\S+$/, { message: 'Password must not contain spaces.' })
  password: string;

  @ApiProperty({
    description: 'Whether to invalidate all existing sessions',
    example: true,
    required: false,
  })
  invalidateSession: boolean;
}

export class VerifyDTO {
  @ApiProperty({
    description: 'Email verification token received via email',
    example: 'a1b2c3d4e5f6...',
    minLength: 128,
    maxLength: 128,
  })

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Token is required.' })
  @IsString({ message: 'Token must be a string.' })
  @Length(128, 128, {
    message: 'Token is invalid',
  })
  @Matches(/^[0-9a-fA-F]{128}$/, {
    message: 'Token is invalid.',
  })
  token: string;
}
