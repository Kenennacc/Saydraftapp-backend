import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities';
import { QueryService } from 'src/services';
import { Repository } from 'typeorm';
import { CreateUserDTO, UpdateUserDTO } from './dto';

@Injectable()
export default class AdminService extends QueryService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {
    super();
  }

  async getUsers(options: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const { page, limit, search } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.firstname',
        'user.lastname',
        'user.verifiedAt',
        'user.bannedAt',
        'user.createdAt',
        'user.updatedAt',
      ])
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.where(
        '(user.email ILIKE :search OR user.firstname ILIKE :search OR user.lastname ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUser(id: string) {
    return this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'firstname',
        'lastname',
        'verifiedAt',
        'bannedAt',
        'isAdmin',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async createUser(dto: CreateUserDTO) {
    const hashedPassword = await this.hashPassword(dto.password);
    
    const user = this.userRepository.create({
      email: dto.email,
      firstname: dto.firstname,
      lastname: dto.lastname,
      password: hashedPassword,
      verifiedAt: new Date(),
    });

    return this.userRepository.save(user);
  }

  async updateUser(id: string, dto: UpdateUserDTO) {
    const updateData: Partial<User> = {
      email: dto.email,
      firstname: dto.firstname,
      lastname: dto.lastname,
    };

    if (dto.password) {
      updateData.password = await this.hashPassword(dto.password);
    }

    await this.userRepository.update({ id }, updateData);
    return this.getUser(id);
  }

  async deleteUser(id: string) {
    const result = await this.userRepository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async verifyUser(id: string) {
    await this.userRepository.update(
      { id },
      { verifiedAt: new Date() },
    );
    return this.getUser(id);
  }

  async banUser(id: string) {
    await this.userRepository.update(
      { id },
      { bannedAt: new Date() },
    );
    return this.getUser(id);
  }

  async unbanUser(id: string) {
    await this.userRepository.update(
      { id },
      { bannedAt: undefined },
    );
    return this.getUser(id);
  }

  async promoteUser(id: string) {
    await this.userRepository.update(
      { id },
      { isAdmin: true },
    );
    return this.getUser(id);
  }

  async demoteUser(id: string) {
    await this.userRepository.update(
      { id },
      { isAdmin: false },
    );
    return this.getUser(id);
  }

  private async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 10);
  }
}
