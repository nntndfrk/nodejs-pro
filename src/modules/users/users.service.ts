import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  public async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  public async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }
}
