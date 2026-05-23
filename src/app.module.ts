import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { PatientsModule } from './patients/patients.module';
import { AutoEncryptionOptions } from 'mongodb';
import { PeopleModule } from './people/people.module';
import path from 'path';

const KEY_VAULT_NS = 'encryption.__keyVault';
type CryptSharedLibPath = NonNullable<NonNullable<AutoEncryptionOptions['extraOptions']>['cryptSharedLibPath']>;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      connectionName: 'default',
      useFactory: (cfg: ConfigService): MongooseModuleOptions => {
        const masterKey = cfg.getOrThrow<string>('LOCAL_MASTER_KEY');
        const localMasterKey = Buffer.from(masterKey, 'base64');
        if (localMasterKey.length !== 96) {
          throw new Error('La clave maestra local debe ser una cadena base64 que decodifique a 96 bytes');
        }
        return {
          uri: cfg.get<string>('MONGODB_URI'),
          dbName: 'csfle-demo',
          autoEncryption: {
            keyVaultNamespace: KEY_VAULT_NS,
            kmsProviders: {
              local: { key: localMasterKey },
            },
            bypassAutoEncryption: true, // para evitar cifrar campos durante el insert/update (usamos cifrado explícito en su lugar)
          },
        };
      },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      connectionName: 'auto',
      useFactory: (cfg: ConfigService): MongooseModuleOptions => {
        const masterKey = cfg.getOrThrow<string>('LOCAL_MASTER_KEY');
        const localMasterKey = Buffer.from(masterKey, 'base64');
        if (localMasterKey.length !== 96) {
          throw new Error('La clave maestra local debe ser una cadena base64 que decodifique a 96 bytes');
        }
        // load the shared library path from config and ensure it's an absolute path
        const cryptSharedLibPath = path.resolve(cfg.getOrThrow<string>('SHARED_LIB_PATH')) as CryptSharedLibPath;
        return {
          uri: cfg.get<string>('MONGODB_URI'),
          dbName: 'csfle-auto',
          autoEncryption: {
            keyVaultNamespace: KEY_VAULT_NS,
            kmsProviders: {
              local: { key: localMasterKey },
            },
            extraOptions: {
              cryptSharedLibPath,
              cryptSharedLibRequired: true,
            },
          },
        };
      },
    }),
    PatientsModule,
    PeopleModule,
  ],
})
export class AppModule {}
