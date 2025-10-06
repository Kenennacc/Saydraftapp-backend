import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class RegisterDTO {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

  @Transform(({ value }) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({ message: 'Email address is required.' })
  @IsEmail({}, { message: 'Email address is not valid.' })
  @Length(5, 254, {
    message: 'Email must be between $constraint1 and $constraint2 characters.',
  })
  email: string;

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
  @Transform(({ value }) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({ message: 'Email address is required.' })
  @IsEmail({}, { message: 'Email address is not valid.' })
  @Length(5, 254, {
    message: 'Email must be between $constraint1 and $constraint2 characters.',
  })
  email: string;

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
  @Transform(({ value }) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
  invalidateSession: boolean;
}

export class VerifyDTO {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
