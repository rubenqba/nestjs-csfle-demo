import { Injectable } from '@nestjs/common';
import { PeopleRepository, type Person } from './app.repository';

@Injectable()
export class AppService {
  constructor(private readonly peopleRepository: PeopleRepository) {}

  async createPerson(data: Omit<Person, 'id' | 'created' | 'updated'>) {
    return this.peopleRepository.upsert(data);
  }

  async getPersonBySsn(ssn: string) {
    return this.peopleRepository.findBySsn(ssn);
  }
}
