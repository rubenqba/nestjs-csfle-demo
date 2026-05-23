import { Injectable } from '@nestjs/common';
import { Patient, PersistentPatient } from './patients.schema';
import { PatientsRepository } from './patients.repository';

@Injectable()
export class PatientsService {
  constructor(private readonly repository: PatientsRepository) {}

  async create(data: Patient): Promise<PersistentPatient> {
    return this.repository.upsertPatient(data);
  }

  async findPatient(ssn: string): Promise<PersistentPatient | null> {
    return this.repository.findOneBy({ ssn });
  }
}
