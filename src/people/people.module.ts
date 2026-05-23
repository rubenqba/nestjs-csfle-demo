import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PeopleEntity, PeopleRepository, PeopleSchema } from './people.repository';
import { PeopleService } from './people.service';
import { PeopleController } from './people.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: PeopleEntity.name, schema: PeopleSchema, collection: 'people' }], 'default')],
  providers: [
    {
      provide: 'PEOPLE_MODULE_OPTIONS',
      inject: [ConfigService],
      useFactory: () => ({
        keyName: 'csfle-demo-key',
      }),
    },
    PeopleService,
    PeopleRepository,
  ],
  controllers: [PeopleController],
})
export class PeopleModule {}
