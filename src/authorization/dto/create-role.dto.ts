import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * DTO é o contrato de entrada: o cliente envia um nome e, se quiser, uma descrição.
 * O ValidationPipe confere estas regras antes de os dados chegarem ao serviço.
 */
export class CreateRoleDto {
  // " credito " vira "CREDITO": assim a mesma role não ganha nomes diferentes por caixa ou espaços.
  // Depois da transformação, os validadores conferem formato e tamanho.
  @ApiProperty({ example: 'OPERADOR_TAREFAS', maxLength: 64 })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  @MaxLength(64)
  name: string;

  // A descrição serve para explicar o perfil a quem administra os acessos; ela não concede permissões.
  @ApiPropertyOptional({ maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  description?: string;
}
