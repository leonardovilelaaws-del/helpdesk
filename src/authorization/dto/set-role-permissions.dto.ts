import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * O cliente envia a lista final de permissões da role, não só as que quer acrescentar.
 * Exemplo: enviar ['tasks:read'] retira as outras permissões que ela tinha.
 */
export class SetRolePermissionsDto {
  // O DTO confere o formato da lista; o serviço confere se os nomes existem no banco.
  // [] é válido e significa "esta role fica sem permissões".
  @ApiProperty({ type: [String], example: ['tasks:read', 'tasks:create'] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  permissionNames: string[];
}
