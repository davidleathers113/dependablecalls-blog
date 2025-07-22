import { stripeServerClient } from './client';
import type { StripeCustomerData } from './types';
import type Stripe from 'stripe';

export const createStripeCustomer = async (
  email: string,
  metadata: {
    userId: string;
    userType: 'buyer' | 'supplier';
    companyName?: string;
  },
  additionalData?: {
    name?: string;
    phone?: string;
    address?: Stripe.AddressParam;
  }
): Promise<Stripe.Customer> => {
  try {
    const customer = await stripeServerClient.customers.create({
      email,
      name: additionalData?.name,
      phone: additionalData?.phone,
      address: additionalData?.address,
      metadata: {
        ...metadata,
        platform: 'dependablecalls',
      },
    });
    
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw new Error(`Failed to create customer: ${error.message}`);
  }
};

export const updateStripeCustomer = async (
  customerId: string,
  updates: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> => {
  try {
    const customer = await stripeServerClient.customers.update(
      customerId,
      updates
    );
    
    return customer;
  } catch (error) {
    console.error('Error updating Stripe customer:', error);
    throw new Error(`Failed to update customer: ${error.message}`);
  }
};

export const getStripeCustomer = async (
  customerId: string
): Promise<Stripe.Customer | null> => {
  try {
    const customer = await stripeServerClient.customers.retrieve(customerId);
    
    if (customer.deleted) {
      return null;
    }
    
    return customer as Stripe.Customer;
  } catch (error) {
    if (error.code === 'resource_missing') {
      return null;
    }
    console.error('Error retrieving Stripe customer:', error);
    throw new Error(`Failed to retrieve customer: ${error.message}`);
  }
};

export const deleteStripeCustomer = async (
  customerId: string
): Promise<boolean> => {
  try {
    const result = await stripeServerClient.customers.del(customerId);
    return result.deleted;
  } catch (error) {
    console.error('Error deleting Stripe customer:', error);
    throw new Error(`Failed to delete customer: ${error.message}`);
  }
};

export const listCustomerPaymentMethods = async (
  customerId: string,
  type?: 'card' | 'us_bank_account'
): Promise<Stripe.PaymentMethod[]> => {
  try {
    const paymentMethods = await stripeServerClient.paymentMethods.list({
      customer: customerId,
      type,
    });
    
    return paymentMethods.data;
  } catch (error) {
    console.error('Error listing payment methods:', error);
    throw new Error(`Failed to list payment methods: ${error.message}`);
  }
};

export const attachPaymentMethod = async (
  paymentMethodId: string,
  customerId: string
): Promise<Stripe.PaymentMethod> => {
  try {
    const paymentMethod = await stripeServerClient.paymentMethods.attach(
      paymentMethodId,
      { customer: customerId }
    );
    
    return paymentMethod;
  } catch (error) {
    console.error('Error attaching payment method:', error);
    throw new Error(`Failed to attach payment method: ${error.message}`);
  }
};

export const detachPaymentMethod = async (
  paymentMethodId: string
): Promise<Stripe.PaymentMethod> => {
  try {
    const paymentMethod = await stripeServerClient.paymentMethods.detach(
      paymentMethodId
    );
    
    return paymentMethod;
  } catch (error) {
    console.error('Error detaching payment method:', error);
    throw new Error(`Failed to detach payment method: ${error.message}`);
  }
};

export const setDefaultPaymentMethod = async (
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> => {
  try {
    const customer = await stripeServerClient.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    return customer;
  } catch (error) {
    console.error('Error setting default payment method:', error);
    throw new Error(`Failed to set default payment method: ${error.message}`);
  }
};

export const createSetupIntent = async (
  customerId: string,
  metadata?: Record<string, string>
): Promise<Stripe.SetupIntent> => {
  try {
    const setupIntent = await stripeServerClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card', 'us_bank_account'],
      usage: 'off_session',
      metadata: {
        ...metadata,
        platform: 'dependablecalls',
      },
    });
    
    return setupIntent;
  } catch (error) {
    console.error('Error creating setup intent:', error);
    throw new Error(`Failed to create setup intent: ${error.message}`);
  }
};