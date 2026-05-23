import { Binary, ClientEncryptionEncryptOptions } from 'mongodb';

export type AlgoritmType = ClientEncryptionEncryptOptions['algorithm'];

export type EncryptFunction = (value: string, algorithm?: AlgoritmType) => Binary | string | Promise<Binary | string>;

export type Persistent<T> = T & {
  id: string;
  created: Date;
  updated: Date;
};

export type EncryptedField<T> = Binary | T;
