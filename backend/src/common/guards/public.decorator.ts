import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as reachable without a login token. Everything else needs one. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
