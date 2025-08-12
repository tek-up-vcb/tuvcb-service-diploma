import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiplomasController } from './diplomas.controller';
import { DiplomasService } from './diplomas.service';
import { Diploma } from './entities/diploma.entity';
import { DiplomaRequest } from './entities/diploma-request.entity';
import { DiplomaRequestSignature } from './entities/diploma-request-signature.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Diploma,
      DiplomaRequest,
      DiplomaRequestSignature,
    ]),
  ],
  controllers: [DiplomasController],
  providers: [DiplomasService],
  exports: [DiplomasService],
})
export class DiplomasModule {}
