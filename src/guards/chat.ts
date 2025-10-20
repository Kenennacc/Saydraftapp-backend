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
import { User as UserType } from 'src/types';

@Injectable()
export default class Chat implements CanActivate {
  constructor(private chatService: ChatsService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user: UserType }>();
    const chatId = request.params?.id;

    console.log('=== CHAT GUARD DEBUG ===');
    console.log('Chat ID:', chatId);
    console.log('User ID:', request.user?.id);

    
    if (!isUUID(chatId)) {
      console.log('Invalid UUID format:', chatId);
      throw new UnprocessableEntityException('Invalid chat id format');
    }

    const user = request.user;

    // First check if chat exists at all (for debugging)
    const chatExistsAtAll = await this.chatService.chatExists(chatId);
    console.log('Chat exists in database:', chatExistsAtAll);

    if (!chatExistsAtAll) {
      console.log('Chat does not exist in database at all');
      throw new NotFoundException('Chat not found');
    }

    // Now check if it belongs to this user
    const chatBelongsToUser = await this.chatService.chatExists(chatId, {
      where: {
        user: {
          id: user.id,
        },
      },
    });

    console.log('Chat belongs to user (DB query):', chatBelongsToUser);
    
    if (!chatBelongsToUser) {
      console.log('Chat exists but does not belong to this user');
      // Let's get the actual chat to see what user it belongs to
      const actualChat = await this.chatService.getChat(chatId, { relations: { user: true } });
      console.log('Actual chat user ID:', actualChat?.user?.id);
      console.log('Requested by user ID:', user.id);
      throw new NotFoundException('Chat not found');
    }
    
    console.log('Chat guard passed');
    console.log('=== END CHAT GUARD DEBUG ===');
    return true;
  }
}
