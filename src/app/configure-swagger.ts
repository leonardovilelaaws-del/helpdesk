import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Monta a página /docs para consultar e experimentar as rotas.
 * A documentação descreve a autenticação; quem realmente protege as rotas são os guards.
 */
export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Users and Tasks API')
    .setDescription(
      'GET /tasks usa cursor para scroll infinito e navegação sequencial. ' +
        'GET /tasks/page usa páginas numeradas para tabelas e dashboards. ' +
        'As duas operações compartilham filtros e ordenação e possuem contratos independentes.',
    )
    .setVersion('1.0')
    // Informa ao Swagger qual cookie representa o login. Isto não cria um token:
    // o navegador só recebe o cookie quando POST /auth/login dá certo.
    .addCookieAuth('access_token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}
