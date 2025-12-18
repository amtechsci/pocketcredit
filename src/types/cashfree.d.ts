declare module '@cashfreepayments/cashfree-js' {
  export interface CashfreeConfig {
    mode: 'sandbox' | 'production';
  }

  export interface CheckoutOptions {
    paymentSessionId: string;
  }

  export interface CashfreeInstance {
    checkout(options: CheckoutOptions): void;
  }

  export function load(config: CashfreeConfig): Promise<CashfreeInstance | null>;
}

