import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UnprocessableEntityException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import markdownDocx, { Packer } from 'markdown-docx';
import { ResponseInput } from 'openai/resources/responses/responses.js';
import { User } from 'src/decorators';
import RequiresVerification from 'src/decorators/RequiresVerification';
import { FileType } from 'src/entities/File';
import { MessageType } from 'src/entities/Message';
import { ChatState } from 'src/entities/State';
import { Auth, Chat } from 'src/guards';
import AIService from 'src/services/AI';
import { S3Service } from 'src/services/S3';
import type { User as UserType } from 'src/types';
import { IsNull } from 'typeorm';
import { IsolationLevel, Transactional } from 'typeorm-transactional';
import { SelectPrompt, UpdateChatDTO } from './dto';
import ChatsService from './service';

@Controller('chats')
@UseGuards(Auth)
@RequiresVerification(true)
export default class ChatsController {
  constructor(
    private chatsService: ChatsService,
    private aiService: AIService,
    private s3Service: S3Service,
  ) {}

  @Get()
  getChats(@User() user: UserType) {
    return this.chatsService.getChats(user.id);
  }

  @Get(':id')
  @UseGuards(Chat)
  async getChat(@Param('id') id: string) {
    const chat = await this.chatsService.getChat(id);
    const state = await this.chatsService.getChatState(chat!.id);
    return {
      ...chat,
      state,
    };
  }

  @Delete(':id')
  @UseGuards(Chat)
  async deleteChat(@Param('id') id: string) {
    await this.chatsService.deleteChat(id);
  }

  @Patch(':id')
  @UseGuards(Chat)
  async updateChat(@Param('id') id: string, @Body() dto: UpdateChatDTO) {
    await this.chatsService.updateChat(id, { title: dto?.title });
  }

  @Post()
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async createChat(@User() user: UserType) {
    const title = '(Untitled)';
    const chat = await this.chatsService.createChat(title, user.id);
    await this.chatsService.addChatState(chat.id, ChatState.MIC);
    return { id: chat.id };
  }

  @Post(':id/messages')
  @UseGuards(Chat)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: FileType.AUDIO, maxCount: 1 }]),
  )
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async createMessage(
    @User() user: UserType,
    @UploadedFiles(
      new ParseFilePipe({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        // validators: [
        //   new FileTypeValidator({
        //     fileType: 'audio/webm',
        //     fallbackToMimetype: true,
        //     skipMagicNumbersValidation: true,
        //   }),
        // ],
      }),
    )
    files: Record<FileType, Express.Multer.File[]>,
    @Param('id', new ParseUUIDPipe({ optional: false })) id: string,
  ) {
    const file = files[FileType.AUDIO][0];

    const state = await this.chatsService.getChatState(id);

    if (file && state !== ChatState.MIC)
      throw new ForbiddenException('This response requires text input');

    const url = await this.s3Service.uploadFile(
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
      },
      `audio-${randomUUID()}-${Date.now()}.${file.mimetype.split('/')[1]}`,
    );

    const audio = await this.chatsService.createAudio({
      url,
      userId: user.id,
      chatId: id,
    });

    const { text, error } = await this.aiService.speechToText(url);
    if (error) throw new UnprocessableEntityException(error.message);

    const chat = await this.chatsService.getChat(id, {
      relations: { user: true },
    });

    const message = await this.chatsService.addMessage(
      {
        text,
        type: MessageType.MIC,
      },
      chat!.id,
      user.id,
    );

    await this.chatsService.linkFileToMessage(audio.id, message.id);

    const messages = await this.chatsService.getMessages({
      where: {
        isStatus: false,
        chat: {
          id: chat!.id,
        },
      },
    });
    const response = await this.aiService.chat(
      chat!.context,
      messages.map((message) => ({
        role: message.user?.id ? 'user' : 'assistant',
        content: `[${message.type}] ` + message.text,
      })),
    );
    const parsed = response?.output_parsed;

    if (parsed?.title && chat?.title === '(Untitled)') {
      await this.chatsService.updateChat(chat.id, { title: parsed.title });
    }

    console.log(parsed);

    if (parsed) {
      await this.chatsService.addMessage(
        {
          text: parsed?.status,
          type: MessageType.TEXT,
          isStatus: true,
        },
        chat!.id,
        user.id,
      );
      const aiResponse = await this.chatsService.addMessage(
        {
          text: parsed?.response.replaceAll(/[[\\(]?MIC[\]\\)]?/g, '🎤'),
          type: MessageType.TEXT,
          prompts: parsed?.texts,
        },
        chat!.id,
      );
      await this.chatsService.addChatState(chat!.id, parsed.requires);

      if (parsed?.contract) {
        const docx = await markdownDocx(parsed.contract);
        const buffer = await Packer.toBuffer(docx);
        const documentUrl = await this.s3Service.uploadFile(
          {
            buffer,
            mimetype:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
          `${chat!.title}-${Date.now()}.docx`,
        );
        const document = await this.chatsService.createDocument({
          url: documentUrl,
          userId: user.id,
          chatId: chat!.id,
        });
        await this.chatsService.linkFileToMessage(document.id, aiResponse.id);
      }
    }
  }

  @Get(':id/messages')
  @UseGuards(Chat)
  async getMessages(@Param('id') id: string) {
    const messages = await this.chatsService.getMessages({
      select: {
        id: true,
        text: true,
        type: true,
        createdAt: true,
        files: {
          id: true,
          url: true,
          type: true,
        },
        prompts: {
          id: true,
          value: true,
          selectedAt: true,
        },
        user: {
          id: true,
        },
      },
      where: [
        {
          chat: {
            id,
          },
          isStatus: true,
        },
        {
          chat: {
            id,
          },
          user: IsNull(),
          isStatus: false,
        },
      ],
      relations: {
        user: true,
        prompts: true,
        files: true,
      },
    });
    return messages.map((message) => ({
      id: message.id,
      text: message.text,
      type: message.type,
      createdAt: message.createdAt,
      files: message.files,
      prompts: message.prompts.map((prompt) => ({
        id: prompt.id,
        value: prompt.value,
        selected: !!prompt.selectedAt,
      })),
      assistant: !message.user?.id,
    }));
  }

  @Post(':id/messages/:messageId/prompts')
  @UseGuards(Chat)
  async selectPrompt(
    @Param('id') id: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @Body() dto: SelectPrompt,
    @User() user: UserType,
  ) {
    const messageExists = await this.chatsService.messageExists(messageId, id);
    if (!messageExists) throw new NotFoundException('Message not found');

    const chat = await this.chatsService.getChat(id, {
      relations: { user: true },
    });

    const state = await this.chatsService.getChatState(chat!.id);

    if (state !== ChatState.TEXT)
      throw new ForbiddenException('This response requires voice input');

    const hasAnsweredPrompts =
      await this.chatsService.hasAnsweredPrompts(messageId);

    if (hasAnsweredPrompts) return;

    const prompt = await this.chatsService.getPrompt(messageId, dto.value);

    if (!prompt) {
      await this.chatsService.addMessage(
        {
          text: 'The option you selected is invalid. Please respond with a valid choice.',
          type: MessageType.TEXT,
        },
        id,
      );
      return;
    }

    const messages = await this.chatsService.getMessages({
      where: {
        isStatus: false,
        chat: {
          id: chat!.id,
        },
      },
    });

    const response = await this.aiService.chat(chat!.context, [
      ...(messages.map((message) => ({
        role: message.user?.id ? 'user' : 'assistant',
        content: `[${message.type}] ` + message.text,
      })) as ResponseInput),
      {
        role: 'user',
        content: `[TEXT] ${prompt.value}`,
      },
    ]);

    const parsed = response?.output_parsed;

    console.log(parsed);

    if (parsed) {
      await this.chatsService.addMessage(
        {
          text: prompt.value,
          type: MessageType.TEXT,
        },
        chat!.id,
        user.id,
      );
      await this.chatsService.addMessage(
        {
          text: parsed?.status,
          type: MessageType.TEXT,
          isStatus: true,
        },
        chat!.id,
        user.id,
      );
      const aiResponse = await this.chatsService.addMessage(
        {
          text: parsed?.response.replaceAll(/[[\\(]?TEXT[\]\\)]?/g, 'text'),
          type: MessageType.TEXT,
          prompts: parsed?.texts,
        },
        chat!.id,
      );
      await this.chatsService.addChatState(chat!.id, parsed.requires);

      if (parsed?.contract) {
        const docx = await markdownDocx(parsed.contract);
        const buffer = await Packer.toBuffer(docx);
        const documentUrl = await this.s3Service.uploadFile(
          {
            buffer,
            mimetype:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
          `${chat!.title}-${Date.now()}.docx`,
        );
        const document = await this.chatsService.createDocument({
          url: documentUrl,
          userId: user.id,
          chatId: chat!.id,
        });
        await this.chatsService.linkFileToMessage(document.id, aiResponse.id);
      }
    }

    await this.chatsService.answerPrompt(prompt?.id);
  }
}
