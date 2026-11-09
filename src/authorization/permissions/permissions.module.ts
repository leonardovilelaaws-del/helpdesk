import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';
import { PermissionRegistryService } from './permission-registry.service';
import { PermissionsSyncService } from './permissions-sync.service';

// A descoberta conhece os catálogos; o sincronizador grava os nomes no bootstrap.
// Ambos também funcionam em um contexto standalone, sem servidor HTTP escutando.
@Module({
  imports: [DiscoveryModule, PrismaModule],
  providers: [PermissionRegistryService, PermissionsSyncService],
  exports: [PermissionRegistryService],
})
export class PermissionsModule {}
