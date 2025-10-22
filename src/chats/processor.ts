import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import AuthService from 'src/auth/service';
import { ChatContext } from 'src/entities/Chat';
import { MessageType } from 'src/entities/Message';
import PendingInvitation from 'src/entities/PendingInvitation';
import { ChatState } from 'src/entities/State';
import AIService from 'src/services/AI';
import { S3Service } from 'src/services/S3';
import { IsNull, Repository } from 'typeorm';
import ChatsService from './service';
import File, { FileType } from 'src/entities/File';

export enum ContractJobName {
  CREATE_OFFEREE_CHAT = 'create_offeree_chat',
  PROCESS_PENDING_INVITATIONS = 'process_pending_invitations',
}

export type ICreateOffereeChat = {
  offerorChatId: string;
  offereeEmail: string;
  contractText: string;
  offerorId: string;
};

export type IProcessPendingInvitations = {
  email: string;
};

@Processor('contract')
export default class ContractProcessor extends WorkerHost {
  constructor(
    private chatsService: ChatsService,
    private authService: AuthService,
    private aiService: AIService,
    private s3Service: S3Service,
    @InjectRepository(PendingInvitation)
    private pendingInvitationRepository: Repository<PendingInvitation>,
    @InjectRepository(File)
    private fileRepository: Repository<File>,
  ) {
    super();
  }

  async process(
    job: Job<
      ICreateOffereeChat | IProcessPendingInvitations,
      any,
      ContractJobName
    >,
  ) {
    if (job.name === ContractJobName.PROCESS_PENDING_INVITATIONS) {
      return this.processPendingInvitations(
        job.data as IProcessPendingInvitations,
      );
    }

    if (job.name === ContractJobName.CREATE_OFFEREE_CHAT) {
      return this.createOffereeChat(job.data as ICreateOffereeChat);
    }
  }

  private async processPendingInvitations(data: IProcessPendingInvitations) {
    const { email } = data;

    try {
      const pendingInvitations = await this.pendingInvitationRepository.find({
        where: {
          offereeEmail: email,
          acceptedAt: IsNull(),
        },
        relations: {
          offerorChat: true,
          offeror: true,
        },
      });

      if (pendingInvitations.length > 0) {
        for (const invitation of pendingInvitations) {
          await this.createOffereeChat({
            offerorChatId: invitation.offerorChat.id,
            offereeEmail: invitation.offereeEmail,
            contractText: invitation.contractText,
            offerorId: invitation.offeror.id,
          });

          await this.pendingInvitationRepository.update(
            { id: invitation.id },
            { acceptedAt: new Date() },
          );
        }

        console.log(
          `Processed ${pendingInvitations.length} pending invitation(s) for ${email}`,
        );
      }
    } catch (error) {
      console.error('Error processing pending invitations:', error);
      throw error;
    }
  }

  private async createOffereeChat(data: ICreateOffereeChat) {
    const { offereeEmail, contractText, offerorChatId, offerorId } = data;

    try {
      const offeree = await this.authService.getUserByEmail(offereeEmail);
      if (!offeree) return;
      const response = await this.aiService.chat(ChatContext.OFFEREE, [
        {
          role: 'user',
          content: `[CONTRACT]\n${contractText}`,
        },
      ]);
      const parsed = response?.output_parsed;

      const offereeChat = await this.chatsService.createChat(
        'Contract Review',
        offeree.id,
        ChatContext.OFFEREE,
      );

      // Link the existing contract file from the offeror's chat
      let contractFile: File|null = null;
      try {
        // Find the contract file from the offeror's chat
        const offerorFiles = await this.fileRepository.find({
          where: {
            chat: {
              id: offerorChatId,
            },
            type: FileType.DOCUMENT,
          },
          relations: {
            chat: true,
          },
          order: {
            createdAt: 'DESC', // Get the most recent contract file
          },
          take: 1,
        });

        const offerorFile = offerorFiles[0];

        if (offerorFile) {
          // Create a new file record pointing to the same URL for the offeree
          contractFile = await this.chatsService.createDocument({
            url: offerorFile.url,
            userId: offeree.id,
            chatId: offereeChat.id,
          });
          
          console.log(`✅ Linked offeror's contract file to offeree chat ${offereeChat.id}: ${offerorFile.url}`);
        } else {
          console.log(`⚠️ No contract file found in offeror chat ${offerorChatId}, skipping file link`);
        }
      } catch (fileError) {
        console.error('❌ Error linking contract file:', fileError);
        // Continue even if file linking fails
      }

      if (parsed) {
        const aiMessage = await this.chatsService.addMessage(
          {
            text: "Here's a contract for you to review. Please take your time to read through it carefully.",
            type: MessageType.TEXT,
            prompts: parsed.texts,
          },
          offereeChat.id,
        );

        // Link the contract file to the AI message if both exist
        if (contractFile && aiMessage) {
          try {
            await this.chatsService.linkFileToMessage(contractFile.id, aiMessage.id);
            console.log(`✅ Contract file linked to message ${aiMessage.id}`);
          } catch (linkError) {
            console.error('❌ Error linking file to message:', linkError);
            // Continue even if linking fails - file is still in chat
          }
        }

        await this.chatsService.addChatState(offereeChat.id, ChatState.TEXT);

        // Send contract summary to offeror
        const summaryText = parsed.summary 
          ? `📧 **Contract Invitation Sent to ${offereeEmail}**\n\n**Contract Summary:**\n${parsed.summary}\n\n*Waiting for their response...*`
          : `Contract review invitation sent to ${offereeEmail}. Waiting for their response.`;

        await this.chatsService.addMessage(
          {
            text: summaryText,
            type: MessageType.TEXT,
            isStatus: true,
          },
          offerorChatId,
          offerorId,
        );
      } else {
        // Fallback if AI response parsing fails
        await this.chatsService.addMessage(
          {
            text: `Contract review invitation sent to ${offereeEmail}. Waiting for their response.`,
            type: MessageType.TEXT,
            isStatus: true,
          },
          offerorChatId,
          offerorId,
        );
      }

      console.log(`Created offeree chat ${offereeChat.id} for ${offereeEmail}`);
    } catch (error) {
      console.error('Error creating offeree chat:', error);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  active(job: Job) {
    console.log(
      'ContractProcessor: ',
      `ID: ${job.id}`,
      `Name: ${job.name}`,
      ' - is active',
    );
  }

  @OnWorkerEvent('error')
  onError(reason: Error) {
    console.log('ContractProcessor: ', reason.message);
  }
}
