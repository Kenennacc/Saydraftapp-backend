import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription, User } from 'src/entities';
import { QueryService } from 'src/services';
import { IsNull, Not, Repository } from 'typeorm';
import { CreateUserDTO, UpdateUserDTO } from './dto';

@Injectable()
export default class AdminService extends QueryService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
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
      .leftJoinAndSelect('user.subscriptions', 'subscription')
      .select([
        'user.id',
        'user.email',
        'user.firstname',
        'user.lastname',
        'user.verifiedAt',
        'user.bannedAt',
        'user.lastLoginAt',
        'user.isAdmin',
        'user.createdAt',
        'user.updatedAt',
        'subscription.id',
        'subscription.plan',
        'subscription.status',
        'subscription.createdAt',
      ])
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('subscription.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.where(
        '(user.email ILIKE :search OR user.firstname ILIKE :search OR user.lastname ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    // Transform users to include only the latest subscription, isVerified status, role, and lastLogin
    const transformedUsers = users.map((user) => ({
      ...user,
      isVerified: !!user.verifiedAt,
      role: user.isAdmin ? 'admin' : 'user',
      lastLogin: user.lastLoginAt, // Map lastLoginAt to lastLogin for frontend
      subscription: user.subscriptions?.[0] || null,
      subscriptions: undefined, // Remove the subscriptions array
    }));

    return {
      users: transformedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUser(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'firstname',
        'lastname',
        'verifiedAt',
        'bannedAt',
        'lastLoginAt',
        'isAdmin',
        'createdAt',
        'updatedAt',
      ],
      relations: ['subscriptions'],
    });

    if (!user) return null;

    // Get the latest subscription
    const latestSubscription = user.subscriptions?.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )?.[0];

    return {
      ...user,
      isVerified: !!user.verifiedAt,
      role: user.isAdmin ? 'admin' : 'user',
      lastLogin: user.lastLoginAt, // Map lastLoginAt to lastLogin for frontend
      subscription: latestSubscription || null,
      subscriptions: undefined,
    };
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

  async getStats() {
    const totalUsers = await this.userRepository.count();
    
    const verifiedUsers = await this.userRepository.count({
      where: {
        verifiedAt: Not(IsNull()),
      },
    });
    
    const pendingVerification = await this.userRepository.count({
      where: {
        verifiedAt: IsNull(),
      },
    });
    
    const bannedUsers = await this.userRepository.count({
      where: {
        bannedAt: Not(IsNull()),
      },
    });

    return {
      totalUsers,
      verifiedUsers,
      pendingVerification,
      bannedUsers,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 10);
  }
}
