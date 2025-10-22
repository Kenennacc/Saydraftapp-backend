import { InjectQueue } from '@nestjs/bullmq';
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
import { ConfigService } from '@nestjs/config';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import AuthService from 'src/auth/service';
import { User } from 'src/decorators';
import RequiresVerification from 'src/decorators/RequiresVerification';
import { FileType } from 'src/entities/File';
import File from 'src/entities/File';
import Message, { MessageType } from 'src/entities/Message';
import PendingInvitation from 'src/entities/PendingInvitation';
import { ChatState } from 'src/entities/State';
import { Auth, Chat, Subscription } from 'src/guards';
import { IMailJobData, JobName } from 'src/mail/processor';
import MailService from 'src/mail/service';
import baseTemplate from 'src/mail/template';
import { contractInvitationTemplate } from 'src/misc/mailTemplate';
import AIService from 'src/services/AI';
import { S3Service } from 'src/services/S3';
import { SubscriptionService } from 'src/services/Subscription';
import type { User as UserType } from 'src/types';
import { IsNull, Repository } from 'typeorm';
import { IsolationLevel, Transactional } from 'typeorm-transactional';
import { CreateMessageDTO, InviteUserDTO, UpdateChatDTO } from './dto';
import { ContractJobName, ICreateOffereeChat } from './processor';
import ChatsService from './service';

@ApiTags('chats')
@Controller('chats')
@UseGuards(Auth)
@RequiresVerification(true)
@ApiCookieAuth('session')
export default class ChatsController {
  constructor(
    private chatsService: ChatsService,
    private aiService: AIService,
    private authService: AuthService,
    private configService: ConfigService,
    private s3Service: S3Service,
    private subscriptionService: SubscriptionService,
    @InjectQueue('mail') private mailQueue: Queue,
    @InjectQueue('contract') private contractQueue: Queue,
    private mailService: MailService,
    @InjectRepository(PendingInvitation)
    private pendingInvitationRepository: Repository<PendingInvitation>,
    @InjectRepository(File)
    private fileRepository: Repository<File>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all chats for authenticated user' })
  @ApiResponse({ status: 200, description: 'List of user chats' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getChats(@User() user: UserType) {
    console.log('=== GET CHATS DEBUG ===');
    console.log('Getting chats for user:', user.id);
    
    const chats = await this.chatsService.getChats(user.id);
    
    console.log('Found chats:', chats.length);
    console.log('Chat IDs:', chats.map(c => c.id));
    console.log('=== END GET CHATS DEBUG ===');
    
    return chats;
  }

  @Get(':id')
  @UseGuards(Chat)
  @ApiOperation({ summary: 'Get specific chat by ID' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  @ApiResponse({ status: 200, description: 'Chat details' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
  @UseGuards(Subscription)
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async createChat(@User() user: UserType) {
    try {
      console.log('=== CREATE CHAT DEBUG ===');
      console.log('User ID:', user.id);
      console.log('User email:', user.email);
      console.log('User isAdmin:', user.isAdmin);
      
      const title = '(Untitled)';
      console.log('Creating chat with title:', title);
      
      const chat = await this.chatsService.createChat(title, user.id);
      
      if (!chat) {
        console.error('Chat creation returned null/undefined');
        throw new Error('Failed to create chat');
      }
      
      console.log('Chat created successfully:', {
        chatId: chat.id,
        title: chat.title,
        userId: user.id
      });
      
      console.log('Adding chat state...');
      await this.chatsService.addChatState(chat.id, ChatState.MIC);
      console.log('Chat state added: MIC');
      
      console.log('Incrementing usage...');
      await this.subscriptionService.incrementChatUsage(user.id);
      console.log('Usage incremented successfully');
      
      console.log('Returning chat ID:', chat.id);
      console.log('=== END CREATE CHAT DEBUG ===');

      return { id: chat.id };
    } catch (error) {
      console.error('=== CREATE CHAT ERROR ===');
      console.error('Error creating chat:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('=== END CREATE CHAT ERROR ===');
      throw error;
    }
  }

  @Post(':id/messages')
  @UseGuards(Chat)
  @ApiOperation({
    summary: 'Send a message (audio or text) to the chat',
    description: 'Send messages to chat with audio or text input',
  })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Audio file OR text message with optional messageId for prompt selection',
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
          description: 'Audio file (for voice input)',
        },
        text: { type: 'string', description: 'Text message' },
        messageId: {
          type: 'string',
          format: 'uuid',
          description: 'Message ID for prompt selection',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({
    status: 403,
    description: 'Invalid input type for current chat state',
  })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: FileType.AUDIO, maxCount: 1 }]),
  )
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async createMessage(
    @User() user: UserType,
    @UploadedFiles(
      new ParseFilePipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        fileIsRequired: false,
      }),
    )
    files: Record<FileType, Express.Multer.File[]>,
    @Body() dto: CreateMessageDTO,
    @Param('id', new ParseUUIDPipe({ optional: false })) id: string,
  ) {
    const chatId = id;
    const userId = user.id;

    const file = files?.[FileType.AUDIO]?.[0];
    const state = await this.chatsService.getChatState(chatId);
    const chat = await this.chatsService.getChat(chatId, {
      relations: { user: true },
    });

    let userMessage: Message;
    let messageType: MessageType;
    let userText: string;

    if (file) {
      if (state !== ChatState.MIC && state !== ChatState.EMAIL) {
        throw new ForbiddenException('This response requires text input');
      }

      const url = await this.s3Service.uploadFile(
        {
          buffer: file.buffer,
          mimetype: file.mimetype,
        },
        `audio-${randomUUID()}-${Date.now()}.${file.mimetype.split('/')[1]}`,
      );

      const audio = await this.chatsService.createAudio({
        url,
        userId: userId,
        chatId: chatId,
      });

      const { text, error } = await this.aiService.speechToText(url);
      if (error) throw new UnprocessableEntityException(error.message);

      userText = text;
      messageType = MessageType.MIC;

      userMessage = await this.chatsService.addMessage(
        {
          text: userText,
          type: messageType,
        },
        chatId,
        userId,
      );

      await this.chatsService.linkFileToMessage(audio.id, userMessage.id);
    } else if (dto.text && dto.messageId) {
      if (state !== ChatState.TEXT) {
        throw new ForbiddenException('This response requires voice input');
      }

      const hasAnsweredPrompts = await this.chatsService.hasAnsweredPrompts(
        dto.messageId,
      );
      if (hasAnsweredPrompts) return;

      const prompt = await this.chatsService.getPrompt(dto.messageId, dto.text);
      if (!prompt) {
        await this.chatsService.addMessage(
          {
            text: 'The option you selected is invalid. Please respond with a valid choice.',
            type: MessageType.TEXT,
          },
          chatId,
        );
        return;
      }

      userText = prompt.value;
      messageType = MessageType.TEXT;

      userMessage = await this.chatsService.addMessage(
        {
          text: userText,
          type: messageType,
        },
        chatId,
        userId,
      );

      await this.chatsService.answerPrompt(prompt.id);
    } else {
      throw new ForbiddenException(
        'Either audio file or text with messageId must be provided',
      );
    }

    const messages = await this.chatsService.getMessages({
      where: {
        isStatus: false,
        chat: {
          id: chatId,
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

    if (parsed?.requires && state && parsed.requires !== state) {
      console.warn(`State transition: ${state} → ${parsed.requires}`);
    }

    if (parsed?.title && chat?.title === '(Untitled)') {
      await this.chatsService.updateChat(chatId, { title: parsed.title });
    }

    console.log(parsed);

    if (parsed) {
      await this.chatsService.addMessage(
        {
          text: parsed?.status,
          type: MessageType.TEXT,
          isStatus: true,
        },
        chatId,
        userId,
      );
      const aiResponse = await this.chatsService.addMessage(
        {
          text: parsed?.response
            .replaceAll(/[[\\(]?MIC[\]\\)]?/g, '🎤')
            .replaceAll(/[[\\(]?TEXT[\]\\)]?/g, 'text'),
          type: MessageType.TEXT,
          prompts: parsed?.texts,
        },
        chatId,
      );

      if (parsed?.contract) {
        const contract = await this.chatsService.createContract(
          parsed.contract,
        );
        const documentUrl = await this.s3Service.uploadFile(
          contract,
          `${chat!.title}-${Date.now()}.docx`,
        );
        const document = await this.chatsService.createDocument({
          url: documentUrl,
          userId: userId,
          chatId: chatId,
        });
        await this.chatsService.linkFileToMessage(document.id, aiResponse.id);
      }

      // Notify offeror if offeree made a decision (accepted/rejected)
      if (chat?.context === 'offeree' && parsed?.agreed !== undefined) {
        try {
          // Find the contract file in the offeree chat
          const offereeFile = await this.fileRepository.findOne({
            where: {
              chat: { id: chatId },
              type: FileType.DOCUMENT,
            },
            order: {
              createdAt: 'DESC',
            },
          });

          if (offereeFile) {
            // Find the offeror chat with the same contract file URL
            const offerorFile = await this.fileRepository.findOne({
              where: {
                url: offereeFile.url,
                type: FileType.DOCUMENT,
              },
              relations: {
                chat: {
                  user: true,
                },
                user: true,
              },
              order: {
                createdAt: 'ASC', // Get the original (offeror's) file
              },
            });

            if (offerorFile && offerorFile.chat.context === 'offeror') {
              const decision = parsed.agreed ? '✅ **accepted**' : '❌ **rejected**';
              const notificationText = `📬 **Contract Decision from ${user.email}**\n\n${user.firstname} ${user.lastname} has ${decision} the contract.\n\n*Chat updated with their response.*`;

              await this.chatsService.addMessage(
                {
                  text: notificationText,
                  type: MessageType.TEXT,
                  isStatus: true,
                },
                offerorFile.chat.id,
                offerorFile.user.id,
              );

              console.log(`✅ Notified offeror (chat ${offerorFile.chat.id}) about offeree decision: ${parsed.agreed ? 'accepted' : 'rejected'}`);
            }
          }
        } catch (notifyError) {
          console.error('❌ Error notifying offeror:', notifyError);
          // Don't fail the request if notification fails
        }
      }

      await this.chatsService.addChatState(
        chatId,
        parsed?.email ? ChatState.NONE : parsed.requires,
      );
    }
  }

  @Get(':id/messages')
  @UseGuards(Chat)
  @ApiOperation({ summary: 'Get all messages for a chat' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
      order: {
        createdAt: 'ASC',
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

  @Post(':id/invite')
  @UseGuards(Chat)
  @ApiOperation({ summary: 'Send contract review invitation to a user' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  @ApiBody({ type: InviteUserDTO })
  @ApiResponse({ status: 200, description: 'Invitation sent successfully' })
  @ApiResponse({
    status: 403,
    description: 'Chat state must be EMAIL or contract not found',
  })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async inviteUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: InviteUserDTO,
    @User() user: UserType,
  ) {
    const chat = await this.chatsService.getChat(id);
    if (!chat) throw new NotFoundException('Chat not found');

    const state = await this.chatsService.getChatState(id);
    if (state !== ChatState.EMAIL) {
      throw new ForbiddenException(
        'Chat is not in EMAIL state. Please generate a contract first.',
      );
    }

    const messages = await this.chatsService.getMessages({
      where: {
        chat: { id },
        user: IsNull(),
        isStatus: false,
      },
      relations: {
        files: true,
      },
    });

    const hasContract = messages.some((message) =>
      message.files.some((file) => file.type === FileType.DOCUMENT),
    );

    if (!hasContract) {
      throw new ForbiddenException(
        'No contract found in this chat. Please generate a contract first.',
      );
    }

    const contractMessage = messages.find((message) =>
      message.files.some((file) => file.type === FileType.DOCUMENT),
    );

    const invitedUser = await this.authService.getUserByEmail(dto.email);

    const invitationUrl = `${this.configService.get('CLIENT_URL')}`;

    if (invitedUser) {
      await this.contractQueue.add(ContractJobName.CREATE_OFFEREE_CHAT, {
        offerorChatId: chat.id,
        offereeEmail: dto.email,
        contractText: contractMessage?.text || '',
        offerorId: user.id,
      } satisfies ICreateOffereeChat);
    } else {
      const pendingInvitation = this.pendingInvitationRepository.create({
        offereeEmail: dto.email,
        offerorChat: { id: chat.id },
        contractText: contractMessage?.text || '',
        offeror: {
          id: user.id,
        },
      });
      await this.pendingInvitationRepository.save(pendingInvitation);
    }
    const template = await this.mailService.buildTemplate(baseTemplate, {
      ...contractInvitationTemplate,
      url: invitationUrl,
    });

    await this.mailQueue.add(JobName.CONTRACT_INVITATION, {
      to: dto.email,
      subject: contractInvitationTemplate.subject,
      body: template,
    } satisfies IMailJobData);

    await this.chatsService.addMessage(
      {
        text: `Invitation sent to ${dto.email}`,
        type: MessageType.TEXT,
        isStatus: true,
      },
      chat.id,
      user.id,
    );

    await this.chatsService.addChatState(chat.id, ChatState.NONE);
    return {
      success: true,
      message: `Invitation sent to ${dto.email}`,
    };
  }
}
