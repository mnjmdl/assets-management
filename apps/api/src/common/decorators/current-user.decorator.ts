import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@repo/database';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
