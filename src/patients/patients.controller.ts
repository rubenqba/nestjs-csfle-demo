/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Body, Controller, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { PatientsService } from './patients.service';
import type { Patient } from './patients.schema';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post()
  async createPatient(@Body() data: Patient) {
    return this.patients.create(data);
  }

  @Get()
  async getPatient(@Query('ssn') ssn: string) {
    const patient = await this.patients.findPatient(ssn);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }
}
