import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from 'src/common/roles/roles.decorator';
import { AuthorizationStatusType } from 'src/entity/common/Enums';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const role = this.reflector.get(Roles, context.getHandler());

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user.isAdmin) {
      throw new UnauthorizedException('인증되지 않은 사용자 입니다.');
    }

    return true;
  }
}
