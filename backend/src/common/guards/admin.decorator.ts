import { SetMetadata } from '@nestjs/common';

export const ALLOWED_ROLES_KEY = 'allowedRoles';

/** Restricts a route (or a whole controller) to users whose role is admin. */
export const Admin = () => SetMetadata(ALLOWED_ROLES_KEY, ['admin']);

/** Admins and operations staff. On a method it overrides a class-level @Admin(). */
export const Staff = () => SetMetadata(ALLOWED_ROLES_KEY, ['admin', 'operations']);
