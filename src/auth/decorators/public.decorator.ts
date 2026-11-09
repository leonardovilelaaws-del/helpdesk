import { SetMetadata } from '@nestjs/common';

// Decorator e guard usam a mesma chave para escrever e ler a configuração da rota.
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Deixa um recado que JwtAuthGuard lê: esta rota pode ser chamada sem login prévio.
 * Exemplo: /auth/login precisa disso, senão seria preciso estar logado para fazer login.
 * Com false, volta a exigir login. CSRF e regras de autorização não são desligados.
 */
export const Public = (isPublic = true) => SetMetadata(IS_PUBLIC_KEY, isPublic);
