import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
  message?: string;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data?.data !== undefined ? data.data : data,
        meta: data?.meta,
        message: data?.message,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
