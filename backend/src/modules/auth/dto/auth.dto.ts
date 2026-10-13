import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @MinLength(1) fullName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(10) phoneNumber: string;
  @IsString() @MinLength(6) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) password: string;
}

export class GoogleLoginDto {
  @IsString() @MinLength(1) idToken: string;
}
