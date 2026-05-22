import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { Person } from './app.repository';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  createPerson(@Body() { name, age, ssn, phone, email }: Omit<Person, 'id' | 'created' | 'updated'>) {
    return this.appService.createPerson({ name, age, ssn, phone, email });
  }

  @Get()
  getPerson(@Query('ssn') ssn: string) {
    return this.appService.getPersonBySsn(ssn);
  }
}
