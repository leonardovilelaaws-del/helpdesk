import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO é o contrato da entrada. O ValidationPipe aplica estas regras antes do controller:
 * e-mail inválido ou senha vazia recebe 400, sem tentar autenticar no banco.
 */
export class LoginDto {
  // " ANA@Exemplo.com " vira "ana@exemplo.com", evitando tratar a mesma conta como outra.
  @ApiProperty({ example: 'admin@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  // Senha não recebe trim: um espaço pode fazer parte dela e mudar o resultado da conferência.
  @ApiProperty({ format: 'password', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
