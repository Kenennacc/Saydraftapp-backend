import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { addDays, addMinutes } from 'date-fns';
import { Device } from 'src/decorators/UserAgent';
import { Session, Token, TokenContext, TokenType, User } from 'src/entities';
import tokenGenerator from 'src/misc/token';
import { QueryService } from 'src/services';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { RegisterDTO } from './dto';

@Injectable()
export default class AuthService extends QueryService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {
    super();
  }

  userExistsById(id: string) {
    return this.existsBy(this.userRepository, 'id', id);
  }

  userExistsByEmail(email: string) {
    return this.existsBy(this.userRepository, 'email', email);
  }

  getUserByEmail(email: string) {
    return this.findBy<User>(this.userRepository, 'email', email);
  }

  async hash(payload: string) {
    return bcrypt.hash(payload, 10);
  }

  async compareHash(payload: string, hash: string) {
    return bcrypt.compare(payload, hash);
  }

  async createToken(
    userId: string,
    properties: { type: TokenType; context: TokenContext },
    expiresAt: Date = addMinutes(new Date(), 5),
  ) {
    const value = tokenGenerator[properties.type]?.();
    if (!value) throw new Error('Could not generate token: Invalid token type');
    const instance = this.tokenRepository.create({
      value: this.hashToken(value),
      type: properties.type,
      context: properties.context,
      expiresAt,
      user: {
        id: userId,
      },
    });
    await this.tokenRepository.save(instance);
    return value;
  }

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async getToken(
    token: string,
    properties: { type: TokenType; context: TokenContext },
  ) {
    return this.tokenRepository.findOne({
      where: {
        value: this.hashToken(token),
        type: properties.type,
        context: properties.context,
        expiresAt: MoreThan(new Date()),
        usedAt: IsNull(),
      },
      relations: {
        user: true,
      },
    });
  }

  async revokeToken(id: string) {
    return this.tokenRepository.update({ id }, { revokedAt: new Date() });
  }

  async markTokenAsUsed(id: string) {
    return this.tokenRepository.update({ id }, { usedAt: new Date() });
  }

  async getLatestToken(userId: string) {
    return this.tokenRepository.findOne({
      where: {
        expiresAt: MoreThan(new Date()),
        usedAt: IsNull(),
        revokedAt: IsNull(),
        user: {
          id: userId,
        },
      },
      relations: {
        user: true,
      },
    });
  }

  async updateUserPassword(userId: string, password: string) {
    return this.userRepository.update(
      { id: userId },
      { password: await this.hash(password) },
    );
  }


  async register(dto: RegisterDTO) {
    const instance = this.userRepository.create({
      email: dto.email,
      firstname: dto.firstname,
      lastname: dto.lastname,
      password: await this.hash(dto.password),
    });

    const user = await this.userRepository.save(instance);

    return user;
  }

  async verifyUser(userId: string) {
    return this.userRepository.update(
      { id: userId },
      { verifiedAt: new Date() },
    );
  }

  async createSession(userId: string, device: Device, timezone: string) {
    const session = randomBytes(64).toString('hex');
    const expiresAt = addDays(new Date(), 7);
    const instance = this.sessionRepository.create({
      expiresAt,
      value: session,
      user: {
        id: userId,
      },
      deviceName: device.name,
      timezone,
      deviceType: device.type,
      os: device.os,
      userAgentHash: device.hash,
      browser: device.browser,
    });
    await this.sessionRepository.save(instance);
    return { value: session, expiresAt };
  }

  async getSession(session: string) {
    return this.sessionRepository.findOne({
      select: {
        id: true,
        value: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        userAgentHash: true,
        timezone: true,
        revokedAt: true,
        lastUsedAt: true,
        user: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          verifiedAt: true,
        },
      },
      where: [
        {
          value: session,
          revokedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
      ],
      relations: {
        user: true,
      },
    });
  }

  async invalidateSession(userId: string, session?: string) {
    return this.sessionRepository.update(
      {
        ...(session ? { value: session } : undefined),
        user: {
          id: userId,
        },
      },
      { revokedAt: new Date() },
    );
  }

  async updateSessionUsage(userId: string, session: string) {
    return this.sessionRepository.update(
      { user: { id: userId }, value: session },
      { lastUsedAt: new Date() },
    );
  }
}
