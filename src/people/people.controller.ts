import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PeopleService } from './people.service';
import { Person } from './people.repository';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Post()
  createPerson(@Body() { name, age, ssn, phone, email }: Omit<Person, 'id' | 'created' | 'updated'>) {
    return this.peopleService.createPerson({ name, age, ssn, phone, email });
  }

  @Get()
  getPerson(@Query('ssn') ssn: string) {
    return this.peopleService.getPersonBySsn(ssn);
  }
}
