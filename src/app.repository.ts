import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Model, Require_id } from 'mongoose';
import { Binary } from 'mongodb';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

export type Person = {
  id: string;
  name: string;
  age: number;
  ssn: string;
  phone: string;
  email: string;
  created: Date;
  updated: Date;
};

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type EncryptedField<T> = Binary | T;

type EncryptedPerson = Omit<Person, 'ssn' | 'phone' | 'email'> & {
  ssn: EncryptedField<string>;
  phone: EncryptedField<string>;
  email: EncryptedField<string>;
};

@Schema({
  collection: 'people',
  timestamps: { createdAt: 'created', updatedAt: 'updated' },
  virtuals: true,
})
export class PeopleEntity {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  age!: number;

  @Prop({ required: true, type: mongoose.Schema.Types.Mixed })
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

  constructor(
    @Inject('APP_MODULE_OPTIONS') private readonly options: { keyName: string },
    @InjectModel(PeopleEntity.name) private model: Model<EncryptedPerson>,
  ) {}

  async onModuleInit() {
    const encryption = this.model.clientEncryption();
    if (encryption) {
      const dataKey =
        (await encryption.getKeyByAltName(this.options.keyName).then((k) => k?._id)) ??
        (await encryption.createDataKey('local', { keyAltNames: [this.options.keyName] }));
      this.logger.log(`DataKeyId [base64]: ${dataKey.toHexString().slice(0, 16)}...`);
    }
  }

  private toPerson(doc: Require_id<EncryptedPerson>): EncryptedPerson {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id.toString() };
  }

  async upsert(data: Omit<Person, 'id' | 'created' | 'updated'>): Promise<EncryptedPerson> {
    const cipher = this.model.clientEncryption();

    const encryptedSsn = cipher
      ? await cipher.encrypt(data.ssn, {
          keyAltName: this.options.keyName,
          algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
        })
      : data.ssn;
    const encryptedPhone = cipher
      ? await cipher.encrypt(data.phone, {
          keyAltName: this.options.keyName,
          algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random',
        })
      : data.phone;
    const encryptedEmail = cipher
      ? await cipher.encrypt(data.email, {
          keyAltName: this.options.keyName,
          algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random',
        })
      : data.email;

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
    const encryption = this.model.clientEncryption();
    const ssn = encryption
      ? await encryption.encrypt(plainSsn, {
          keyAltName: this.options.keyName,
          algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
        })
      : plainSsn;
    const person = await this.model.findOne({ ssn: ssn }).lean().exec();
    return person ? this.toPerson(person) : null;
  }
}
