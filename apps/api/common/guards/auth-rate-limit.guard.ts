import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private static readonly attempts = new Map<string, number[]>();

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const email =
      typeof request.body?.email === 'string'
        ? request.body.email.toLowerCase().trim()
        : 'anonymous';
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const route = request.route?.path ?? request.url;
    const key = `${route}:${ip}:${email}`;
    const now = Date.now();
    const recentAttempts = (AuthRateLimitGuard.attempts.get(key) ?? []).filter(
      (timestamp) => now - timestamp < WINDOW_MS,
    );

    if (recentAttempts.length >= MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many auth attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recentAttempts.push(now);
    AuthRateLimitGuard.attempts.set(key, recentAttempts);

    return true;
  }
}
