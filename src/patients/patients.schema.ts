import { Persistent } from '#/common/global.schema';
import { Require_id } from 'mongoose';

export type PatientModuleOptions = {
  keyName: string;
};

export type Patient = {
  name: string;
  age: number;
  ssn: string;
  diagnosis: string;
};

export type PersistentPatient = Persistent<Patient>;
export type PersistentPatientWithId = Require_id<PersistentPatient>;
