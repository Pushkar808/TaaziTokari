import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

const KNOWN_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found.' },
  P2002: { status: HttpStatus.CONFLICT, message: 'That record already exists.' },
  P2003: { status: HttpStatus.BAD_REQUEST, message: 'A related record does not exist.' },
};

/** Turns the common Prisma errors into clean 4xx responses instead of a generic 500. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const known = KNOWN_ERRORS[error.code];
    if (!known) return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
    return response.status(known.status).json({ statusCode: known.status, message: known.message });
  }
}
