import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RequireRole } from '../decorators/require-role.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../decorators/require-permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  function context(
    requirements: (ClassDecorator | MethodDecorator)[],
    roles?: string[],
    permissions: string[] = [],
    classRequirement?: ClassDecorator,
  ) {
    class TestController {
      handle(this: void) {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'handle',
    )!;
    for (const requirement of requirements) {
      (requirement as MethodDecorator)(
        TestController.prototype,
        'handle',
        descriptor,
      );
    }
    classRequirement?.(TestController);
    const user: AuthenticatedUser | undefined = roles && {
      id: 'user-id',
      name: 'User',
      email: 'user@example.test',
      roles,
      permissions,
      sessionId: 'session-id',
    };
    return new ExecutionContextHost(
      [{ user }],
      TestController,
      TestController.prototype.handle,
    );
  }

  it.each([['ADMIN'], ['MEMBER'], []])(
    'rejects users without the required role: %j',
    (...roles) => {
      expect(() =>
        guard.canActivate(context([RequireRole('AGENT')], roles)),
      ).toThrow(ForbiddenException);
    },
  );

  it.each([['AGENT'], ['ADMIN', 'AGENT']])(
    'accepts users with the required role: %j',
    (...roles) => {
      expect(guard.canActivate(context([RequireRole('AGENT')], roles))).toBe(
        true,
      );
    },
  );

  it('checks the effective permissions of administrators too', () => {
    const requirements = [RequirePermissions('tickets:create')];
    expect(() => guard.canActivate(context(requirements, ['ADMIN']))).toThrow(
      ForbiddenException,
    );
    expect(
      guard.canActivate(context(requirements, ['ADMIN'], ['tickets:create'])),
    ).toBe(true);
  });

  it('accepts the role or the permission rule at the same level', () => {
    const requirements = [
      RequireRole('AGENT'),
      RequirePermissions('tickets:create'),
    ];
    expect(guard.canActivate(context(requirements, ['AGENT']))).toBe(true);
    expect(
      guard.canActivate(context(requirements, ['MEMBER'], ['tickets:create'])),
    ).toBe(true);
    expect(() => guard.canActivate(context(requirements, ['ADMIN']))).toThrow(
      ForbiddenException,
    );
  });

  it.each([
    [RequirePermissions('tickets:read', 'tickets:create'), false],
    [RequireAnyPermission('tickets:read', 'tickets:create'), true],
  ])('preserves all/any permission semantics', (requirement, allowed) => {
    const request = context([requirement], ['MEMBER'], ['tickets:read']);
    if (allowed) expect(guard.canActivate(request)).toBe(true);
    else expect(() => guard.canActivate(request)).toThrow(ForbiddenException);
  });

  it('does not let a handler role bypass the controller permission rule', () => {
    const requirements = [RequireRole('AGENT')];
    const classRequirement = RequirePermissions('tickets:read');
    expect(() =>
      guard.canActivate(context(requirements, ['AGENT'], [], classRequirement)),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        context(requirements, ['AGENT'], ['tickets:read'], classRequirement),
      ),
    ).toBe(true);
  });

  it('returns 401 when a protected route has no user', () => {
    expect(() => guard.canActivate(context([RequireRole('AGENT')]))).toThrow(
      UnauthorizedException,
    );
  });

  it('leaves routes without requirements to the other guards', () => {
    expect(guard.canActivate(context([]))).toBe(true);
  });
});
