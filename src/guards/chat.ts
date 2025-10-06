import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Request } from 'express';
import ChatsService from 'src/chats/service';

@Injectable()
export default class Chat implements CanActivate {
  constructor(private chatService: ChatsService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const chatId = request.params?.id;

    if (!chatId) return true;
    if (!isUUID(chatId))
      throw new UnprocessableEntityException('Invalid chat id format');

    const user = request.user;
    const chatExists = await this.chatService.chatExists(chatId, {
      where: {
        user: {
          id: user.id,
        },
      },
      relations: {
        user: true,
      },
    });

    if (!chatExists) throw new NotFoundException('Chat not found');
    return true;
  }
}
