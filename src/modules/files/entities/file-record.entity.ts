import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { EntityType } from '../enums/entity-type.enum';
import { FileStatus } from '../enums/file-status.enum';
import { FileVisibility } from '../enums/file-visibility.enum';

@Entity('file_records')
export class FileRecord {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'uuid' })
  public ownerId!: string;

  @Column({ type: 'uuid', nullable: true })
  public entityId!: string | null;

  @Column({ type: 'enum', enum: EntityType, nullable: true })
  public entityType!: EntityType | null;

  @Column({ type: 'varchar', length: 512 })
  public key!: string;

  @Column({ type: 'varchar', length: 100 })
  public contentType!: string;

  @Column({ type: 'bigint', nullable: true })
  public size!: number | null;

  @Column({ type: 'enum', enum: FileStatus, default: FileStatus.PENDING })
  public status!: FileStatus;

  @Column({ type: 'enum', enum: FileVisibility, default: FileVisibility.PRIVATE })
  public visibility!: FileVisibility;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  public owner!: User;
}
