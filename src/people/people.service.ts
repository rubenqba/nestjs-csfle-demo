import { Injectable } from '@nestjs/common';
import { PeopleRepository, type Person } from './people.repository';

@Injectable()
export class PeopleService {
  constructor(private readonly peopleRepository: PeopleRepository) {}

  async createPerson(data: Omit<Person, 'id' | 'created' | 'updated'>) {
    return this.peopleRepository.upsert(data);
  }

  async getPersonBySsn(ssn: string) {
    return this.peopleRepository.findBySsn(ssn);
  }
}
