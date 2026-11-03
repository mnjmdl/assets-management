import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const method = req.method;
    const url = req.url;

    const actionMap: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    return next.handle().pipe(
      tap(async (response) => {
        if (user && actionMap[method]) {
          await this.prisma.auditTrail.create({
            data: {
              userId: user.id,
              action: actionMap[method],
              module: url.split('/')[3] ?? 'UNKNOWN',
              recordId: response?.id,
              newValues: response ? JSON.stringify(response) : undefined,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });
        }
      }),
    );
  }
}
