/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Model, Require_id } from 'mongoose';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AlgoritmType, EncryptedField, EncryptFunction, Persistent } from '#/common/global.schema';

export type Person = {
  name: string;
  age: number;
  ssn: string;
  phone: string;
  email: string;
};

type PersistentPerson = Persistent<Person>;

type EncryptedPerson = Omit<PersistentPerson, 'ssn' | 'phone' | 'email'> & {
  ssn: EncryptedField<string>;
  phone: EncryptedField<string>;
  email: EncryptedField<string>;
};

@Schema({
  timestamps: { createdAt: 'created', updatedAt: 'updated' },
  virtuals: true,
})
export class PeopleEntity {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  age!: number;

  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.Mixed })
  ssn!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.Mixed })
  phone!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.Mixed })
  email!: string;
}

export const PeopleSchema = SchemaFactory.createForClass(PeopleEntity);

@Injectable()
export class PeopleRepository implements OnModuleInit {
  private readonly logger = new Logger(PeopleRepository.name);
  private encrypt: EncryptFunction = (v) => v;

  constructor(
    @Inject('PEOPLE_MODULE_OPTIONS') private readonly options: { keyName: string },
    @InjectModel(PeopleEntity.name, 'default') private model: Model<EncryptedPerson>,
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

  private toPerson(doc: Require_id<EncryptedPerson>): EncryptedPerson {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id.toString() };
  }

  async upsert(data: Omit<Person, 'id' | 'created' | 'updated'>): Promise<EncryptedPerson> {
    const encryptedSsn = await this.encrypt(data.ssn);
    const encryptedPhone = await this.encrypt(data.phone, 'AEAD_AES_256_CBC_HMAC_SHA_512-Random');
    const encryptedEmail = await this.encrypt(data.email, 'AEAD_AES_256_CBC_HMAC_SHA_512-Random');

    const person = await this.model
      .findOneAndUpdate(
        { ssn: encryptedSsn },
        { $set: { ...data, ssn: encryptedSsn, phone: encryptedPhone, email: encryptedEmail } },
        { returnDocument: 'after', upsert: true },
      )
      .lean()
      .exec();
    return this.toPerson(person);
  }

  async findBySsn(plainSsn: string): Promise<EncryptedPerson | null> {
    const ssn = await this.encrypt(plainSsn);
    const person = await this.model.findOne({ ssn: ssn }).lean().exec();
    return person ? this.toPerson(person) : null;
  }
}
