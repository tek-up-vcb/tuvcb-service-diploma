import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DiplomaRequest } from './diploma-request.entity';

@Entity('diploma_request_signatures')
export class DiplomaRequestSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  diplomaRequestId: string;

  @ManyToOne(() => DiplomaRequest, request => request.signatures)
  @JoinColumn({ name: 'diplomaRequestId' })
  diplomaRequest: DiplomaRequest;

  @Column('uuid')
  userId: string; // ID de l'utilisateur qui signe

  @Column({ default: false })
  isSigned: boolean;

  @CreateDateColumn()
  signedAt: Date;

  @Column('text', { nullable: true })
  signatureComment: string | null;
}
