import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionRegistryService } from './permission-registry.service';

/**
 * O Nest aguarda este hook antes de aceitar requisições. Registramos somente
 * nomes novos; criar a permissão não significa conceder acesso a uma role.
 */
@Injectable()
export class PermissionsSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionsSyncService.name);

  constructor(
    private readonly registry: PermissionRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Sincronizando permissões...');
    try {
      // Uma rota com nome desconhecido ou um catálogo duplicado precisa falhar
      // antes da escrita. A descoberta inclui ações ainda não usadas em rotas.
      this.registry.discover();
    } catch (error: unknown) {
      this.logger.error(
        'Catálogo de permissões inválido. A aplicação não será iniciada.',
      );
      throw error;
    }
    const names = this.registry.getPermissionNames();
    this.logger.log(`${names.length} permissões encontradas.`);

    let inserted = 0;
    try {
      if (names.length > 0) {
        // UNIQUE(name) + skipDuplicates deixa duas instâncias iniciarem juntas:
        // se outra já inseriu um nome, o PostgreSQL simplesmente ignora esse nome.
        const result = await this.prisma.permission.createMany({
          data: names.map((name) => ({ name })),
          skipDuplicates: true,
        });
        inserted = result.count;
      }
    } catch {
      // Erros de conexão podem conter credenciais. Não repassamos o erro bruto,
      // mas a exceção continua impedindo que a aplicação aceite requisições.
      const message =
        'Falha ao sincronizar permissões no banco. Verifique a conexão e as migrations; a aplicação não será iniciada.';
      this.logger.error(message);
      throw new Error(message);
    }

    this.logger.log(`${inserted} novas permissões cadastradas.`);
    this.logger.log('Sincronização concluída.');
  }
}
