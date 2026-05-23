/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PatientsService } from './patients.service';
import { PatientEntity, PatientSchema, PatientsRepository } from './patients.repository';
import { PatientsController } from './patients.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: PatientEntity.name, schema: PatientSchema, collection: 'patients' }], 'auto')],
  providers: [
    {
      provide: 'PATIENT_MODULE_OPTIONS',
      inject: [ConfigService],
      useFactory: () => {
        return { keyName: 'csfle-auto-key' };
      },
    },
    PatientsRepository,
    PatientsService,
  ],
  controllers: [PatientsController],
})
export class PatientsModule {}
