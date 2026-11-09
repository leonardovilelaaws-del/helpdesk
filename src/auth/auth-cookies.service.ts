import { Injectable } from '@nestjs/common';
import type { CookieSerializeOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import type { Response } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants';
import type { AuthTokens } from './auth.service';

/**
 * Set-Cookie é uma instrução para o navegador guardar um valor e enviá-lo depois.
 * Aqui configuramos como access e refresh serão guardados e quando deverão sumir.
 */
@Injectable()
export class AuthCookiesService {
  constructor(
    private readonly configService: ConfigService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  /**
   * Escreve Set-Cookie na resposta, em vez de devolver os tokens no JSON.
   * O navegador guarda os valores e os envia automaticamente nas próximas chamadas permitidas.
   */
  set(response: Response, tokens: AuthTokens): void {
    // Na API nativa do NestJS, maxAge é medido em segundos.
    this.adapterHost.httpAdapter.setCookie(
      response,
      ACCESS_COOKIE,
      tokens.accessToken,
      {
        ...this.options('/'),
        maxAge: tokens.accessExpiresIn,
        expires: new Date(Date.now() + tokens.accessExpiresIn * 1000),
      },
    );
    // Path=/auth faz o refresh acompanhar /auth/refresh e /auth/logout, mas não /tasks.
    // Assim, o token que dura mais tempo circula apenas onde é necessário.
    this.adapterHost.httpAdapter.setCookie(
      response,
      REFRESH_COOKIE,
      tokens.refreshToken,
      {
        ...this.options('/auth'),
        maxAge: Math.max(
          0,
          Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000),
        ),
        expires: tokens.expiresAt,
      },
    );
  }

  /**
   * Para apagar um cookie, enviamos outro expirado com o mesmo nome e caminho.
   * Limpar refresh em / em vez de /auth deixaria o cookie original no navegador.
   */
  clear(response: Response): void {
    this.adapterHost.httpAdapter.clearCookie(
      response,
      ACCESS_COOKIE,
      this.options('/'),
    );
    this.adapterHost.httpAdapter.clearCookie(
      response,
      REFRESH_COOKIE,
      this.options('/auth'),
    );
  }

  /**
   * HttpOnly impede JavaScript de ler o token; Secure exige HTTPS em produção.
   * SameSite limita o envio entre sites, mas ainda precisamos da checagem de origem do CSRF.
   */
  private options(path: string): CookieSerializeOptions {
    return {
      path,
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: this.configService.get<'lax' | 'strict' | 'none'>(
        'AUTH_COOKIE_SAME_SITE',
        'lax',
      ),
    };
  }
}
