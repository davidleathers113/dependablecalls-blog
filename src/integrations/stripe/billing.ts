import { stripeServerClient } from './client';
import type Stripe from 'stripe';

export interface CreateInvoiceParams {
  customerId: string;
  description: string;
  metadata: {
    buyerId: string;
    billingPeriod: string;
    callCount: string;
  };
  dueDate?: number;
  collectionMethod?: 'charge_automatically' | 'send_invoice';
}

export interface CreateInvoiceItemParams {
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  metadata: {
    callId?: string;
    campaignId?: string;
    duration?: string;
  };
  invoiceId?: string;
}

export const createInvoice = async (
  params: CreateInvoiceParams
): Promise<Stripe.Invoice> => {
  try {
    const invoice = await stripeServerClient.invoices.create({
      customer: params.customerId,
      description: params.description,
      metadata: {
        ...params.metadata,
        platform: 'dependablecalls',
      },
      due_date: params.dueDate,
      collection_method: params.collectionMethod || 'charge_automatically',
      auto_advance: false, // We'll finalize manually
    });
    
    return invoice;
  } catch (error) {
    console.error('Error creating invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create invoice: ${errorMessage}`);
  }
};

export const createInvoiceItem = async (
  params: CreateInvoiceItemParams
): Promise<Stripe.InvoiceItem> => {
  try {
    const invoiceItem = await stripeServerClient.invoiceItems.create({
      customer: params.customerId,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      metadata: {
        ...params.metadata,
        platform: 'dependablecalls',
      },
      ...(params.invoiceId && { invoice: params.invoiceId }),
    });
    
    return invoiceItem;
  } catch (error) {
    console.error('Error creating invoice item:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create invoice item: ${errorMessage}`);
  }
};

export const finalizeInvoice = async (
  invoiceId: string,
  autoAdvance: boolean = true
): Promise<Stripe.Invoice> => {
  try {
    const invoice = await stripeServerClient.invoices.finalizeInvoice(
      invoiceId,
      { auto_advance: autoAdvance }
    );
    
    return invoice;
  } catch (error) {
    console.error('Error finalizing invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to finalize invoice: ${errorMessage}`);
  }
};

export const sendInvoice = async (
  invoiceId: string
): Promise<Stripe.Invoice> => {
  try {
    const invoice = await stripeServerClient.invoices.sendInvoice(invoiceId);
    return invoice;
  } catch (error) {
    console.error('Error sending invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send invoice: ${errorMessage}`);
  }
};

export const payInvoice = async (
  invoiceId: string,
  paymentMethodId?: string
): Promise<Stripe.Invoice> => {
  try {
    const invoice = await stripeServerClient.invoices.pay(invoiceId, {
      ...(paymentMethodId && { payment_method: paymentMethodId }),
    });
    
    return invoice;
  } catch (error) {
    console.error('Error paying invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to pay invoice: ${errorMessage}`);
  }
};

export const voidInvoice = async (
  invoiceId: string
): Promise<Stripe.Invoice> => {
  try {
    const invoice = await stripeServerClient.invoices.voidInvoice(invoiceId);
    return invoice;
  } catch (error) {
    console.error('Error voiding invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to void invoice: ${errorMessage}`);
  }
};

export const updateInvoice = async (
  invoiceId: string,
  updates: Stripe.InvoiceUpdateParams
): Promise<Stripe.Invoice> => {
  try {
    const invoice = await stripeServerClient.invoices.update(
      invoiceId,
      updates
    );
    
    return invoice;
  } catch (error) {
    console.error('Error updating invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to update invoice: ${errorMessage}`);
  }
};

export const getInvoice = async (
  invoiceId: string
): Promise<Stripe.Invoice | null> => {
  try {
    const invoice = await stripeServerClient.invoices.retrieve(invoiceId);
    return invoice;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing') {
      return null;
    }
    console.error('Error retrieving invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to retrieve invoice: ${errorMessage}`);
  }
};

export const listCustomerInvoices = async (
  customerId: string,
  status?: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void',
  limit: number = 100
): Promise<Stripe.Invoice[]> => {
  try {
    const invoices = await stripeServerClient.invoices.list({
      customer: customerId,
      status,
      limit,
    });
    
    return invoices.data;
  } catch (error) {
    console.error('Error listing invoices:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to list invoices: ${errorMessage}`);
  }
};

export const createCreditNote = async (
  invoiceId: string,
  amount: number,
  reason: 'duplicate' | 'fraudulent' | 'order_change' | 'product_unsatisfactory',
  memo?: string
): Promise<Stripe.CreditNote> => {
  try {
    const creditNote = await stripeServerClient.creditNotes.create({
      invoice: invoiceId,
      amount,
      reason,
      memo,
      metadata: {
        platform: 'dependablecalls',
      },
    });
    
    return creditNote;
  } catch (error) {
    console.error('Error creating credit note:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create credit note: ${errorMessage}`);
  }
};

export const createUsageBasedInvoice = async (
  customerId: string,
  billingPeriod: { start: Date; end: Date },
  usageRecords: Array<{
    amount: number;
    description: string;
    metadata: Record<string, string>;
  }>
): Promise<Stripe.Invoice> => {
  try {
    // Create invoice for the billing period
    const invoice = await createInvoice({
      customerId,
      description: `Usage charges for ${billingPeriod.start.toISOString().split('T')[0]} to ${billingPeriod.end.toISOString().split('T')[0]}`,
      metadata: {
        buyerId: customerId,
        billingPeriod: `${billingPeriod.start.toISOString()}_${billingPeriod.end.toISOString()}`,
        callCount: usageRecords.length.toString(),
      },
    });
    
    // Add line items for each usage record
    for (const record of usageRecords) {
      await createInvoiceItem({
        customerId,
        amount: record.amount,
        currency: 'usd',
        description: record.description,
        metadata: record.metadata,
        invoiceId: invoice.id,
      });
    }
    
    // Finalize and send the invoice
    const finalizedInvoice = await finalizeInvoice(invoice.id);
    
    return finalizedInvoice;
  } catch (error) {
    console.error('Error creating usage-based invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create usage-based invoice: ${errorMessage}`);
  }
};