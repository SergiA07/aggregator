import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';

interface ValidationFieldError {
  field: string;
  messages: string[];
}

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  errors?: ValidationFieldError[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(HttpExceptionFilter.name) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let validationErrors: ValidationFieldError[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string | string[]) || message;
        error = (res.error as string) || exception.name;
        // Preserve validation errors from ZodValidationPipe
        if (Array.isArray(res.errors)) {
          validationErrors = res.errors as ValidationFieldError[];
        }
      }
    } else if (exception instanceof Error) {
      // Log unexpected errors but don't expose details to client
      this.logger.error(
        {
          method: request.method,
          url: request.url,
          error: exception.message,
          stack: exception.stack,
        },
        'Unhandled exception',
      );
      message = 'An unexpected error occurred';
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(validationErrors && { errors: validationErrors }),
    };

    response.status(status).send(errorResponse);
  }
}
