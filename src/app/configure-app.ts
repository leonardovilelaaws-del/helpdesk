import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

/**
 * Prepara a entrada da API antes dos controllers: confere a origem das escritas,
 * lê os cookies e valida os dados. Os testes usam a mesma função para reproduzir essas regras.
 */
export function configureApp(app: INestApplication): void {
  // Uma origem é endereço + porta, como http://localhost:5173.
  // Esta lista permite que o frontend autorizado converse com a API usando cookies.
  const origins = app
    .get(ConfigService)
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());
  // O navegador envia cookies sozinho; outro site poderia tentar agir usando o login da vítima.
  // O CSRF confere de onde veio a escrita e bloqueia origens não confiáveis.
  // Isso precisa valer inclusive no login e no logout, antes de executar suas rotas.
  app.enableCsrfProtection({ trustedOrigins: origins });
  // O header Cookie chega como texto. Este middleware o transforma em request.cookies,
  // permitindo que o guard encontre o access_token antes de chamar o controller.
  app.use(cookieParser());
  // CORS diz quais páginas podem ler as respostas da API pelo navegador.
  // credentials permite os cookies nessas chamadas; isso não substitui a checagem CSRF acima.
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
  // O DTO define o que pode entrar. Se alguém enviar um campo extra como roles
  // ao criar um usuário, a requisição é recusada em vez de gravar esse privilégio.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
