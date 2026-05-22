import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PeopleEntity, PeopleRepository, PeopleSchema } from './app.repository';

const KEY_VAULT_NS = 'encryption.__keyVault';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
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
    MongooseModule.forFeature([{ name: PeopleEntity.name, schema: PeopleSchema, collection: 'people' }]),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: 'APP_MODULE_OPTIONS',
      inject: [ConfigService],
      useFactory: () => {
        return { keyName: 'csfle-demo-key' };
      },
    },
    AppService,
    PeopleRepository,
  ],
})
export class AppModule {}
