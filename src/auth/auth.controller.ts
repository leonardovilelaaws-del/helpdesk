import {
  Body,
  Controller,
  Cookies,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthCookiesService } from './auth-cookies.service';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

/**
 * O controller cuida do HTTP: recebe dados, chama o service e prepara a resposta.
 * O service decide se o login é válido; este controller põe os tokens nos cookies.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookiesService,
  ) {}

  /**
   * @Public deixa entrar sem login prévio; ThrottlerGuard limita as tentativas.
   * A senha vai ao service. Na volta, tokens vão para cookies e só o usuário vai para o JSON.
   */
  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatedUser> {
    const tokens = await this.authService.login(dto);
    this.cookies.set(response, tokens);
    return tokens.user;
  }

  /**
   * É pública porque o access pode já ter vencido. Isso não libera a renovação:
   * o service ainda exige um refresh válido antes de entregar os novos cookies.
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async refresh(
    @Cookies(REFRESH_COOKIE) refreshToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatedUser> {
    const tokens = await this.authService.refresh(refreshToken);
    this.cookies.set(response, tokens);
    return tokens.user;
  }

  /**
   * Primeiro encerra o acesso no banco, depois pede ao navegador para apagar os cookies.
   * É pública para permitir sair mesmo com o access vencido; o CSRF continua ativo.
   */
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Cookies(REFRESH_COOKIE) refreshToken: string | undefined,
    @Cookies(ACCESS_COOKIE) accessToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(refreshToken, accessToken);
    this.cookies.clear(response);
  }

  /**
   * O guard já conferiu o login antes de chegar aqui. @CurrentUser apenas entrega
   * esse usuário ao parâmetro: não valida outro token nem consulta o banco de novo.
   */
  @Get('me')
  @ApiCookieAuth()
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  /** Mostra os logins ativos para o usuário escolher qual deseja encerrar. */
  @Get('sessions')
  @ApiCookieAuth()
  @Header('Cache-Control', 'no-store')
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.sessions(user);
  }

  /**
   * O ID vem da URL e o usuário vem do guard. O service usa os dois para impedir
   * que alguém encerre um login de outra conta apenas descobrindo o ID da sessão.
   */
  @Delete('sessions/:id')
  @ApiCookieAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.authService.revokeSession(user, id);
  }

  /**
   * Encerra os logins da conta em todos os dispositivos. Só este navegador recebe
   * cookies apagados; os demais serão recusados quando tentarem acessar a API.
   */
  @Post('logout-all')
  @ApiCookieAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.id);
    this.cookies.clear(response);
  }
}
