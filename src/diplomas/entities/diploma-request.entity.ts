import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Diploma } from './diploma.entity';
import { DiplomaRequestSignature } from './diploma-request-signature.entity';

export enum DiplomaRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('diploma_requests')
export class DiplomaRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  diplomaId: string;

  @ManyToOne(() => Diploma)
  @JoinColumn({ name: 'diplomaId' })
  diploma: Diploma;

  @Column('uuid')
  createdBy: string; // ID de l'utilisateur créateur

  @Column('simple-array')
  studentIds: string[]; // IDs des étudiants concernés

  @Column('text', { nullable: true })
  comment: string;

  @Column('simple-array')
  requiredSignatures: string[]; // IDs des utilisateurs qui doivent signer

  @Column({
    type: 'enum',
    enum: DiplomaRequestStatus,
    default: DiplomaRequestStatus.PENDING,
  })
  status: DiplomaRequestStatus;

  @Column({ default: 0 })
  validSignatures: number;

  @OneToMany(() => DiplomaRequestSignature, signature => signature.diplomaRequest)
  signatures: DiplomaRequestSignature[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
