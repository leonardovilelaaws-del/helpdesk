/**
 * O .env também é entrada de dados e pode estar errado.
 * Esta função interrompe a inicialização se faltar algo necessário para autenticar com segurança.
 */
export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const databaseUrl = environment.DATABASE_URL;

  if (
    typeof databaseUrl !== 'string' ||
    databaseUrl.trim() === '' ||
    !URL.canParse(databaseUrl)
  ) {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL connection string',
    );
  }

  const url = new URL(databaseUrl);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length <= 1
  ) {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL connection string',
    );
  }

  // Quem conhece este segredo pode assinar um JWT aceito pela API.
  // Por isso ele deve ser aleatório; senhas curtas e valores de exemplo são recusados.
  const secret = environment.JWT_SECRET;
  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret) < 32 ||
    /change.?me|replace.?with|example|your.?secret/i.test(secret)
  ) {
    throw new Error(
      'JWT_SECRET must contain at least 32 bytes of random secret material',
    );
  }

  // issuer identifica quem emitiu o JWT; audience, qual aplicação deve aceitá-lo.
  // Mesmo que duas aplicações compartilhem uma chave, elas não devem aceitar tokens uma da outra.
  for (const key of ['JWT_ISSUER', 'JWT_AUDIENCE']) {
    if (typeof environment[key] !== 'string' || !environment[key].trim()) {
      throw new Error(`${key} must be a non-empty string`);
    }
  }

  // Uma origem confiável deve ser exata, como https://app.exemplo.com.
  // Aceitar um curinga abriria confiança para sites que não foram escolhidos por nós.
  const origins = environment.CORS_ORIGINS;
  if (typeof origins !== 'string' || !origins.trim()) {
    throw new Error(
      'CORS_ORIGINS must list explicitly allowed HTTP(S) origins',
    );
  }
  for (const origin of origins.split(',').map((value) => value.trim())) {
    if (!URL.canParse(origin)) {
      throw new Error('CORS_ORIGINS contains an invalid origin');
    }
    const parsed = new URL(origin);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password ||
      (environment.NODE_ENV === 'production' && parsed.protocol !== 'https:')
    ) {
      throw new Error(
        'CORS_ORIGINS requires exact origins without paths or wildcards; production requires HTTPS',
      );
    }
  }

  // SameSite limita o envio automático de cookies entre sites. "none" permite esse envio
  // e pode ser necessário se frontend e API estiverem em sites diferentes.
  const sameSite = environment.AUTH_COOKIE_SAME_SITE ?? 'lax';
  if (
    typeof sameSite !== 'string' ||
    !['lax', 'strict', 'none'].includes(sameSite)
  ) {
    throw new Error('AUTH_COOKIE_SAME_SITE must be lax, strict or none');
  }
  // SameSite=None só funciona com Secure, que restringe o cookie a HTTPS.
  // Como este projeto ativa Secure em produção, recusamos essa combinação fora dela.
  if (sameSite === 'none' && environment.NODE_ENV !== 'production') {
    throw new Error(
      'SameSite=None requires Secure cookies (NODE_ENV=production)',
    );
  }

  return environment;
}
