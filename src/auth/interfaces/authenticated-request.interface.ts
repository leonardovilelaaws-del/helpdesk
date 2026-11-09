import type { Request } from 'express';
import type { AuthenticatedUser } from './authenticated-user.interface';

// O Express não conhece nosso usuário. Esta interface ensina ao TypeScript que
// o guard pode acrescentar request.user, sem mudar o funcionamento da requisição.
export interface AuthenticatedRequest extends Request {
  // Antes do guard, ou em uma rota pública, pode não existir usuário autenticado.
  user?: AuthenticatedUser;
}
