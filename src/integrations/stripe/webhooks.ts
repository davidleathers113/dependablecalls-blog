import crypto from 'crypto';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripeServerClient, stripeConfig } from './client';
import type { WebhookHandlerMap } from './types';

export const verifyWebhookSignature = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  try {
    return stripeServerClient.webhooks.constructEvent(
      payload,
      signature,
      stripeConfig.webhookSecret
    );
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }
};

const webhookHandlers: WebhookHandlerMap = {
  'payment_intent.succeeded': async (event) => {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    console.log('Payment succeeded:', paymentIntent.id);
    
    // Update invoice status in database
    // Send confirmation email
    // Update buyer's balance
  },
  
  'payment_intent.payment_failed': async (event) => {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    console.error('Payment failed:', paymentIntent.id);
    
    // Mark invoice as failed
    // Send failure notification
    // Potentially pause campaigns if recurring failure
  },
  
  'charge.dispute.created': async (event) => {
    const dispute = event.data.object as Stripe.Dispute;
    console.warn('Dispute created:', dispute.id);
    
    // Create dispute record
    // Notify admin team
    // Gather evidence automatically
  },
  
  'account.updated': async (event) => {
    const account = event.data.object as Stripe.Account;
    console.log('Connected account updated:', account.id);
    
    // Update supplier's account status
    // Check if charges/payouts are enabled
    // Notify supplier of any required actions
  },
  
  'account.application.authorized': async (event) => {
    const account = event.data.object as Stripe.Account;
    console.log('Account authorized:', account.id);
    
    // Mark supplier as active
    // Enable campaign creation
    // Send welcome email
  },
  
  'account.application.deauthorized': async (event) => {
    const account = event.data.object as Stripe.Account;
    console.log('Account deauthorized:', account.id);
    
    // Pause all supplier campaigns
    // Notify admin team
    // Schedule final payout
  },
  
  'payout.created': async (event) => {
    const payout = event.data.object as Stripe.Payout;
    console.log('Payout created:', payout.id);
    
    // Create payout record
    // Update supplier balance
    // Send notification
  },
  
  'payout.paid': async (event) => {
    const payout = event.data.object as Stripe.Payout;
    console.log('Payout completed:', payout.id);
    
    // Mark payout as completed
    // Send confirmation
    // Update ledger
  },
  
  'payout.failed': async (event) => {
    const payout = event.data.object as Stripe.Payout;
    console.error('Payout failed:', payout.id);
    
    // Mark payout as failed
    // Notify supplier and admin
    // Schedule retry or manual intervention
  },
  
  'transfer.created': async (event) => {
    const transfer = event.data.object as Stripe.Transfer;
    console.log('Transfer created:', transfer.id);
    
    // Record transfer
    // Update internal ledger
  },
  
  'transfer.reversed': async (event) => {
    const transfer = event.data.object as Stripe.Transfer;
    console.warn('Transfer reversed:', transfer.id);
    
    // Update ledger
    // Investigate reason
    // Notify affected parties
  },
};

export const handleStripeWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    res.status(400).send('Missing stripe-signature header');
    return;
  }
  
  let event: Stripe.Event;
  
  try {
    event = verifyWebhookSignature(req.body, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
  
  const handler = webhookHandlers[event.type];
  
  if (handler) {
    try {
      await handler(event);
      res.json({ received: true });
    } catch (err) {
      console.error(`Error handling webhook ${event.type}:`, err);
      res.status(500).send(`Webhook handler error: ${err.message}`);
    }
  } else {
    console.log(`Unhandled webhook event type: ${event.type}`);
    res.json({ received: true });
  }
};

export const timingSafeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(bufferA, bufferB);
};