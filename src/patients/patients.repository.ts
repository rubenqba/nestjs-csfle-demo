/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Model, QueryFilter } from 'mongoose';
import type { Patient, PatientModuleOptions, PersistentPatient, PersistentPatientWithId } from './patients.schema';
import { AlgoritmType, EncryptedField, EncryptFunction } from '#/common/global.schema';

@Schema({ virtuals: true, timestamps: { createdAt: 'created', updatedAt: 'updated' }, encryptionType: 'csfle' })
export class PatientEntity {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  age!: number;

  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.Mixed })
  ssn!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.Mixed })
  diagnosis!: string;
}
export const PatientSchema = SchemaFactory.createForClass(PatientEntity);

type EncryptedPatient = Omit<PersistentPatient, 'ssn' | 'diagnosis'> & {
  ssn: EncryptedField<string>;
  diagnosis: EncryptedField<string>;
};

@Injectable()
export class PatientsRepository implements OnModuleInit {
  private readonly logger = new Logger(PatientsRepository.name);
  private encrypt: EncryptFunction = (v) => v;

  constructor(
    @Inject('PATIENT_MODULE_OPTIONS') private readonly options: PatientModuleOptions,
    @InjectModel(PatientEntity.name, 'auto') private readonly model: Model<EncryptedPatient>,
  ) {}

  async onModuleInit() {
    const encryption = this.model.clientEncryption();
    if (encryption) {
      const dataKey =
        (await encryption.getKeyByAltName(this.options.keyName).then((k) => k?._id)) ??
        (await encryption.createDataKey('local', { keyAltNames: [this.options.keyName] }));
      this.logger.log(`DataKeyId [base64]: ${dataKey.toHexString().slice(0, 16)}...`);
      this.encrypt = (value: string, algorithm?: AlgoritmType) =>
        encryption.encrypt(value, { keyId: dataKey, algorithm: algorithm ?? 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic' });
    }
  }

  private toPersistent(patient: PersistentPatientWithId): PersistentPatient {
    const { _id, ...rest } = patient;
    return {
      ...rest,
      id: rest.id ?? _id.toString(),
    };
  }

  async upsertPatient(data: Patient): Promise<PersistentPatient> {
    const encryptedSsn = await this.encrypt(data.ssn);
    const encryptedDiagnosis = await this.encrypt(data.diagnosis, 'AEAD_AES_256_CBC_HMAC_SHA_512-Random');
    const patient = await this.model
      .findOneAndUpdate(
        { ssn: encryptedSsn },
        { ...data, ssn: encryptedSsn, diagnosis: encryptedDiagnosis },
        {
          returnDocument: 'after',
          runValidators: true,
          upsert: true,
        },
      )
      .lean<PersistentPatientWithId>()
      .exec();
    return this.toPersistent(patient);
  }

  async findOneBy(query: QueryFilter<EncryptedPatient>): Promise<PersistentPatient | null> {
    if (query.ssn) {
      query.ssn = await this.encrypt(query.ssn as string);
    }
    const patient = await this.model.findOne(query).lean<PersistentPatientWithId>().exec();
    return patient ? this.toPersistent(patient) : null;
  }
}
