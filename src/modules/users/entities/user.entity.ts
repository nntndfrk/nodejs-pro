import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  public email!: string;

  @Column({ type: 'varchar', length: 255 })
  public name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;
}
