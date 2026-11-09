import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * O administrador envia { isActive: false } para bloquear a conta.
 * Só mudamos esse campo: o DTO não permite aproveitar a chamada para alterar senha ou roles.
 */
export class SetUserStatusDto {
  // Exige true ou false de verdade; o texto "false" não é convertido em um booleano.
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive: boolean;
}
