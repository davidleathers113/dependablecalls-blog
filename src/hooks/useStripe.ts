import { useState, useEffect } from 'react';
import { getStripeClient } from '../integrations/stripe';

export const useStripe = () => {
  const [stripe, setStripe] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initStripe = async () => {
      try {
        const stripeClient = await getStripeClient();
        setStripe(stripeClient);
      } catch (err) {
        setError(err.message || 'Failed to initialize Stripe');
      } finally {
        setIsLoading(false);
      }
    };

    initStripe();
  }, []);

  return { stripe, isLoading, error };
};

export const useStripeElements = () => {
  const { stripe } = useStripe();
  const [elements, setElements] = useState<unknown>(null);

  useEffect(() => {
    if (stripe) {
      setElements(stripe.elements());
    }
  }, [stripe]);

  return { stripe, elements };
};