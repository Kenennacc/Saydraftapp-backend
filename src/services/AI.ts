import { DeepgramClient } from '@deepgram/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import OpenAi from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { ResponseInput } from 'openai/resources/responses/responses.js';
import { join } from 'path';
import { ChatContext } from 'src/entities/Chat';
import { ChatState } from 'src/entities/State';
import { z } from 'zod';

const chatResponseSchema = z.object({
  title: z.string({
    description: 'The title of the contract',
  }),
  response: z.string(),
  requires: z.enum([ChatState.MIC, ChatState.TEXT]),
  texts: z.array(z.string()),
  status: z.string({
    description: "The summary of the user's response",
  }),
  shouldInvite: z.boolean(),
  contract: z.string().nullable(),
});

@Injectable()
export default class AIService {
  private openaiClient: OpenAi;
  private deepgramClient: DeepgramClient;

  constructor(configService: ConfigService) {
    this.openaiClient = new OpenAi({
      apiKey: configService.get('OPEN_AI_API_KEY') as string,
    });
    console.log(configService.get('DEEPGRAM_API_KEY') as string);
    this.deepgramClient = new DeepgramClient({
      key: configService.get('DEEPGRAM_API_KEY') as string,
    });
  }

  async speechToText(audioUrl: string) {
    const response = await this.deepgramClient.listen.prerecorded.transcribeUrl(
      {
        url: audioUrl,
      },
      { model: 'nova-3', smart_format: true, detect_language: true },
    );
    if (response.error) return { text: undefined, error: response.error };
    return {
      text: response.result.results.channels[0].alternatives[0].transcript,
      error: undefined,
    };
  }

  async chat(context: ChatContext, messages: ResponseInput) {
    try {
      const prompt = await readFile(
        join(
          __dirname,
          '..',
          '..',
          'prompts',
          context === ChatContext.OFFEROR ? 'offeror.md' : 'offeree.md',
        ),
      );

      const response = await this.openaiClient.responses.parse({
        model: 'o3',
        store: true,
        text: {
          format: zodTextFormat(chatResponseSchema, 'chat_response'),
        },
        input: [
          {
            role: 'system',
            content: prompt.toString('utf-8'),
          },
          ...messages,
        ],
      });
      return response;
    } catch (err) {
      console.log(err);
    }
  }
}
