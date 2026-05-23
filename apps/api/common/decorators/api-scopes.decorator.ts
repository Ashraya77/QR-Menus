import { SetMetadata } from '@nestjs/common';

export const API_SCOPES_KEY = 'apiScopes';

export const ApiScopes = (...scopes: string[]) =>
  SetMetadata(API_SCOPES_KEY, scopes);
