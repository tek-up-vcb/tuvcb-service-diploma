import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('diploma_anchor_signatures')
export class DiplomaAnchorSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  diplomaRequestId: string;

  @Column({ length: 42 })
  signerAddress: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text' })
  signature: string;

  @CreateDateColumn()
  createdAt: Date;
}