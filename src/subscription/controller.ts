import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { User } from 'src/decorators';
import { Auth } from 'src/guards';
import { StripeService } from 'src/services/Stripe';
import { SubscriptionService } from 'src/services/Subscription';
import type { User as UserType } from 'src/types';
import { CreateCheckoutSessionDTO, CreateSubscriptionDTO } from './dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User as UserEntity } from 'src/entities';

@ApiTags('subscription')
@Controller('subscription')
export default class SubscriptionController {
  constructor(
    private stripeService: StripeService,
    private subscriptionService: SubscriptionService,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  @Get('status')
  @UseGuards(Auth)
  @ApiOperation({ summary: 'Get user subscription status' })
  @ApiResponse({ status: 200, description: 'Subscription status retrieved' })
  async getSubscriptionStatus(@User() user: UserType) {
    let subscription = await this.subscriptionService.getActiveSubscription(user.id);
    
    // If user has no subscription, create a free one
    if (!subscription) {
      console.log('No subscription found for user, creating free subscription...');
      subscription = await this.subscriptionService.createFreeSubscription(user.id);
      console.log('Created free subscription:', subscription?.id);
    }
    
    const canCreateChat = await this.subscriptionService.canCreateChat(user.id, user.isAdmin);
    
    console.log('=== SUBSCRIPTION STATUS DEBUG ===');
    console.log('User ID:', user.id);
    console.log('User isAdmin:', user.isAdmin);
    console.log('User stripeCustomerId:', user.stripeCustomerId);
    console.log('Subscription found:', !!subscription);
    
    if (subscription) {
      console.log('Subscription details:', {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      });
    } else {
      console.log('Failed to create or find subscription');
    }
    
    console.log('Can create chat:', canCreateChat);
    console.log('=== END DEBUG ===');
    
    return {
      subscription,
      canCreateChat,
    };
  }

  @Get('test-urls')
  @UseGuards(Auth)
  @ApiOperation({ summary: 'Test URL validation' })
  @ApiResponse({ status: 200, description: 'URL validation test' })
  async testUrls() {
    const testUrls = [
      'http://localhost:3000/chat?success=true',
      'https://localhost:3000/chat?success=true',
      'http://example.com/chat?success=true',
      'https://example.com/chat?success=true'
    ];
    
    return {
      message: 'URL validation test',
      testUrls,
      validation: testUrls.map(url => ({
        url,
        isValid: url.startsWith('http://') || url.startsWith('https://')
      }))
    };
  }

  @Get('success')
  @UseGuards(Auth)
  @ApiOperation({ summary: 'Handle successful payment redirect' })
  @ApiResponse({ status: 200, description: 'Payment success handled' })
  async handlePaymentSuccess(@User() user: UserType) {
    // Get the user's latest subscription
    const subscription = await this.subscriptionService.getActiveSubscription(user.id);
    
    return {
      message: 'Payment successful!',
      subscription: {
        status: subscription?.status,
        plan: subscription?.plan,
        canCreateChat: await this.subscriptionService.canCreateChat(user.id, user.isAdmin)
      }
    };
  }

  @Post('create-checkout-session')
  @UseGuards(Auth)
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  @ApiBody({ type: CreateCheckoutSessionDTO })
  @ApiResponse({ status: 200, description: 'Checkout session created' })
  async createCheckoutSession(
    @User() user: UserType,
    @Body() dto: CreateCheckoutSessionDTO,
    @Res({ passthrough: true }) response: Response,
  ) {
    console.log('Creating checkout session for user:', user.email);
    console.log('URLs:', {
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      priceId: dto.priceId
    });

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripeService.createCustomer(
        user.email,
        `${user.firstname} ${user.lastname}`,
      );
      customerId = customer.id;
      
      // Fetch the user from database and update the Stripe customer ID
      const dbUser = await this.userRepository.findOne({
        where: { id: user.id }
      });
      
      if (!dbUser) {
        throw new Error('User not found in database');
      }
      
      dbUser.stripeCustomerId = customerId;
      await this.userRepository.save(dbUser);
      
      console.log('Created Stripe customer for user:', {
        userId: user.id,
        customerId: customerId
      });
      
      // Verify the save
      const verifyUser = await this.userRepository.findOne({
        where: { id: user.id }
      });
      console.log('Verified user stripeCustomerId:', verifyUser?.stripeCustomerId);
    }

    const session = await this.stripeService.createCheckoutSession(
      customerId,
      dto.priceId,
      dto.successUrl,
      dto.cancelUrl,
    );

    return { url: session.url };
  }

  @Post('create-portal-session')
  @UseGuards(Auth)
  @ApiOperation({ summary: 'Create Stripe customer portal session' })
  @ApiResponse({ status: 200, description: 'Portal session created' })
  async createPortalSession(
    @User() user: UserType,
    @Body() dto: { returnUrl: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    console.log('Creating portal session for user:', user.id);
    
    // Fetch the user from database to get the latest stripeCustomerId
    const dbUser = await this.userRepository.findOne({
      where: { id: user.id }
    });

    if (!dbUser) {
      throw new Error('User not found in database');
    }

    console.log('User stripeCustomerId:', dbUser.stripeCustomerId);

    if (!dbUser.stripeCustomerId) {
      throw new Error('No Stripe customer found. Please complete a purchase first.');
    }

    const session = await this.stripeService.createPortalSession(
      dbUser.stripeCustomerId,
      dto.returnUrl,
    );

    console.log('Portal session created:', session.url);

    return { url: session.url };
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Handle Stripe webhooks' })
  async handleWebhook(@Req() request: RawBodyRequest<Request>, @Res() response: Response) {
    console.log('=== WEBHOOK REQUEST RECEIVED ===');
    console.log('Headers:', JSON.stringify(request.headers, null, 2));
    console.log('Method:', request.method);
    console.log('URL:', request.url);
    
    const sig = request.headers['stripe-signature'] as string;
    const body = request.rawBody;

    if (!sig) {
      console.error('❌ No Stripe signature header found');
      console.error('This might not be a real Stripe webhook request');
      response.status(400).json({ error: 'No Stripe signature' });
      return;
    }

    if (!body) {
      console.error('❌ No raw body received for webhook');
      response.status(400).json({ error: 'No body received' });
      return;
    }

    console.log('✅ Signature found, body received. Verifying...');

    try {
      const event = await this.stripeService.constructWebhookEvent(body.toString(), sig);
      
      console.log('✅ Webhook signature verified successfully!');
      console.log('📨 Received webhook event:', event.type);
      console.log('Event ID:', event.id);

      switch (event.type) {
        case 'customer.subscription.created':
          console.log('Processing subscription created:', event.data.object.id);
          try {
            await this.subscriptionService.createSubscriptionFromStripe(event.data.object);
          } catch (error) {
            console.error('Error processing subscription created:', error);
          }
          break;
        case 'customer.subscription.updated':
          console.log('Processing subscription updated:', event.data.object.id);
          try {
            await this.subscriptionService.updateSubscriptionFromStripe(event.data.object);
          } catch (error) {
            console.error('Error processing subscription updated:', error);
          }
          break;
        case 'customer.subscription.deleted':
          console.log('Processing subscription deleted:', event.data.object.id);
          try {
            await this.subscriptionService.updateSubscriptionFromStripe(event.data.object);
          } catch (error) {
            console.error('Error processing subscription deleted:', error);
          }
          break;
        case 'invoice.payment_succeeded':
          console.log('Processing payment succeeded:', event.data.object.id);
          try {
            await this.subscriptionService.handlePaymentSucceeded(event.data.object);
          } catch (error) {
            console.error('Error processing payment succeeded:', error);
          }
          break;
        case 'invoice.payment_failed':
          console.log('Processing payment failed:', event.data.object.id);
          try { 
            await this.subscriptionService.handlePaymentFailed(event.data.object);
          } catch (error) {
            console.error('Error processing payment failed:', error);
          }
          break;
        case 'checkout.session.completed':
          console.log('Processing checkout session completed:', event.data.object.id);
          try {
            await this.subscriptionService.handleCheckoutSessionCompleted(event.data.object);
          } catch (error) {
            console.error('Error processing checkout session completed:', error);
          }
          break;
        default:
          console.log('⚠️  Unhandled webhook event type:', event.type);
          console.log('Add a handler for this event if needed');
      }

      console.log('✅ Webhook processed successfully');
      console.log('=== END WEBHOOK REQUEST ===\n');
      response.json({ received: true });
    } catch (err) {
      console.error('❌ Webhook signature verification failed!');
      console.error('Error details:', err);
      console.error('This usually means:');
      console.error('1. STRIPE_WEBHOOK_SECRET is wrong or not set');
      console.error('2. The request is not from Stripe');
      console.error('3. The webhook secret is for a different Stripe mode (test vs live)');
      console.error('=== END WEBHOOK REQUEST (FAILED) ===\n');
      response.status(400).send('Webhook signature verification failed');
    }
  }

  // Test endpoint to verify webhook route is accessible
  @Get('webhook/test')
  @ApiOperation({ summary: 'Test if webhook endpoint is accessible' })
  async testWebhook() {
    return {
      message: 'Webhook endpoint is accessible!',
      url: '/api/v1/subscription/webhook',
      method: 'POST',
      note: 'Stripe will send POST requests to this endpoint',
    };
  }
}
