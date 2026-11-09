import type { Prisma } from '../generated/prisma/client';

/**
 * Imagine um refresh e um logout acontecendo juntos: o refresh poderia criar
 * um token novo depois de o logout encerrar os antigos. FOR UPDATE faz as operações
 * da mesma conta aguardarem sua vez; o bloqueio termina junto com a transação.
 */
export async function lockAuthUser(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE
  `;
}
