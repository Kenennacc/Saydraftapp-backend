import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import markdownDocx, { Packer } from 'markdown-docx';
import { Chat, Message } from 'src/entities';
import { ChatContext } from 'src/entities/Chat';
import File, { FileType } from 'src/entities/File';
import { MessageType } from 'src/entities/Message';
import Prompt from 'src/entities/Prompts';
import State, { ChatState } from 'src/entities/State';
import { filteredObject } from 'src/misc';
import { QueryFilters, QueryService } from 'src/services';
import { IsNull, Not, Repository } from 'typeorm';

type CreateFile = {
  url: string;
  type: FileType;
  userId: string;
  chatId: string;
};

@Injectable()
export default class ChatsService extends QueryService {
  constructor(
    @InjectRepository(Chat) private chatRepository: Repository<Chat>,
    @InjectRepository(Message) private messageRepository: Repository<Message>,
    @InjectRepository(File) private filesRepository: Repository<File>,
    @InjectRepository(State) private chatStateRepository: Repository<State>,
    @InjectRepository(Prompt) private promptsRepository: Repository<Prompt>,
  ) {
    super();
  }

  createChat(title: string, userId: string | null, context?: ChatContext) {
    const instance = this.chatRepository.create({
      title,
      context,
      user: userId
        ? {
            id: userId,
          }
        : undefined,
    });
    return this.chatRepository.save(instance);
  }

  getChat(id: string, filters?: QueryFilters<Chat>) {
    return this.findBy(this.chatRepository, 'id', id, filters);
  }

  async getChats(userId: string, filters?: QueryFilters<Chat>) {
    const chats = await this.chatRepository.find({
      select: filters?.select,
      where: {
        ...filters?.where,
        user: {
          id: userId,
        },
      },
      order: {
        createdAt: 'desc',
      },
      relations: {
        ...filters?.relations,
        user: true,
      },
    });

    return chats;
  }

  async chatExists(id: string, filters?: QueryFilters<Chat>) {
    // Use count() instead of exists() for better reliability with nested relations
    const count = await this.chatRepository.count({
      where: {
        id,
        ...filters?.where,
      } as any,
    });
    return count > 0;
  }

  countChats(userId: string) {
    return this.chatRepository.count({
      where: {
        user: {
          id: userId,
        },
      },
      relations: { user: true },
    });
  }

  deleteChat(id: string) {
    return this.chatRepository.softDelete({ id });
  }

  updateChat(id: string, payload: Partial<Chat>) {
    return this.chatRepository.update({ id }, { ...filteredObject(payload) });
  }

  updateMessage(id: string, payload: Partial<Message>) {
    return this.messageRepository.update({ id }, { ...filteredObject(payload) });
  }

  async addMessage(
    dto: {
      text: string;
      type: MessageType;
      isStatus?: boolean;
      prompts?: string[];
      contractText?: string;
    },
    chatId: string,
    userId?: string,
  ) {
    const instance = this.messageRepository.create({
      text: dto.text,
      type: dto.type,
      isStatus: dto.isStatus,
      contractText: dto.contractText,
      chat: {
        id: chatId,
      },
      user: userId
        ? {
            id: userId,
          }
        : undefined,
    });
    const message = await this.messageRepository.save(instance);
    if (dto.prompts) await this.addPrompts(message.id, dto.prompts);
    return message;
  }

  async addMessagesBatch(
    messages: Array<{
      text: string;
      type: MessageType;
      isStatus?: boolean;
      prompts?: string[];
      contractText?: string;
      chatId: string;
      userId?: string;
    }>,
  ) {
    // Create all message instances
    const instances = messages.map((dto) =>
      this.messageRepository.create({
        text: dto.text,
        type: dto.type,
        isStatus: dto.isStatus,
        contractText: dto.contractText,
        chat: {
          id: dto.chatId,
        },
        user: dto.userId
          ? {
              id: dto.userId,
            }
          : undefined,
      }),
    );

    // Save all messages in batch (maintains order)
    const savedMessages = await this.messageRepository.save(instances);

    // Add prompts for messages that have them
    for (let i = 0; i < savedMessages.length; i++) {
      const message = savedMessages[i];
      const dto = messages[i];
      if (dto.prompts && dto.prompts.length > 0) {
        await this.addPrompts(message.id, dto.prompts);
      }
    }

    return savedMessages;
  }

  getMessages(filters?: QueryFilters<Message>) {
    return this.messageRepository.find({
      select: filters?.select,
      where: filters?.where,
      order: filters?.order || {
        createdAt: 'asc',
        prompts: {
          createdAt: 'asc',
        },
      },
      relations: {
        ...filters?.relations,
        chat: true,
      },
    });
  }

  messageExists(messageId: string, chatId: string) {
    return this.messageRepository.exists({
      where: {
        id: messageId,
        chat: {
          id: chatId,
        },
      },
    });
  }

  private createFile({ url, type, userId, chatId }: CreateFile) {
    const instance = this.filesRepository.create({
      url,
      type,
      chat: {
        id: chatId,
      },
      user: {
        id: userId,
      },
    });
    return this.filesRepository.save(instance);
  }

  createDocument({ url, userId, chatId }: Omit<CreateFile, 'type'>) {
    return this.createFile({
      url,
      type: FileType.DOCUMENT,
      userId,
      chatId,
    });
  }

  createAudio({ url, userId, chatId }: Omit<CreateFile, 'type'>) {
    return this.createFile({
      url,
      type: FileType.AUDIO,
      userId,
      chatId,
    });
  }

  getFile(id: string, filters?: QueryFilters<File>) {
    return this.findBy<File>(this.filesRepository, 'id', id, filters);
  }

  fileExists(id: string) {
    return this.existsBy<File>(this.filesRepository, 'id', id);
  }

  linkFileToMessage(id: string, messageId: string) {
    return this.filesRepository.update({ id }, { message: { id: messageId } });
  }

  addChatState(id: string, state: ChatState) {
    const instance = this.chatStateRepository.create({
      value: state,
      chat: {
        id,
      },
    });
    return this.chatStateRepository.save(instance);
  }

  async getChatState(id: string) {
    const states = await this.chatStateRepository.find({
      order: {
        createdAt: 'DESC',
      },
      where: {
        chat: {
          id,
        },
      },
      take: 1,
    });
    return states[0]?.value;
  }

  addPrompts(messageId: string, prompts: string[]) {
    if (prompts.length === 0) return;
    const instances = prompts.map((prompt) =>
      this.promptsRepository.create({
        value: prompt,
        message: {
          id: messageId,
        },
      }),
    );
    return this.promptsRepository.save(instances);
  }

  hasPrompts(messageId: string) {
    return this.promptsRepository.exists({
      where: {
        message: {
          id: messageId,
        },
      },
    });
  }

  answerPrompt(id: string) {
    return this.promptsRepository.update({ id }, { selectedAt: new Date() });
  }

  hasAnsweredPrompts(messageId: string) {
    return this.promptsRepository.exists({
      where: {
        selectedAt: Not(IsNull()),
        message: {
          id: messageId,
        },
      },
      relations: {
        message: true,
      },
    });
  }

  getPrompt(messageId: string, prompt: string) {
    return this.promptsRepository.findOne({
      where: {
        value: prompt,
        selectedAt: IsNull(),
        message: {
          id: messageId,
        },
      },
    });
  }

  async createContract(contract: string) {
    const docx = await markdownDocx(contract);
    const buffer = await Packer.toBuffer(docx);
    return {
      buffer,
      mimetype:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
}
