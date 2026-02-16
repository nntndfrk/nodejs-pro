import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  public email!: string;

  @Column({ type: 'varchar', length: 255 })
  public name!: string;

  @Column({ type: 'varchar', length: 255 })
  public passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  public role!: UserRole;

  @Column({ type: 'uuid', nullable: true })
  public avatarFileId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;
}
