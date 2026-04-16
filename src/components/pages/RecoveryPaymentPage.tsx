import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { load } from '@cashfreepayments/cashfree-js';
import { Loader2, IndianRupee, Link2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Header } from '../Header';
import { Footer } from '../Footer';
import { toast } from 'sonner';

type RecoveryPublicData = {
  status: string;
  amount: number;
  payment_type: string;
  payment_type_label: string;
  loan_application_id: number;
  application_number?: string;
  short_loan_id: string;
  loan_status?: string;
  borrower_first_name?: string | null;
};

export function RecoveryPaymentPage() {
  const { publicSlug } = useParams<{ publicSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecoveryPublicData | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!publicSlug) {
        setError('Invalid link');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/recovery-payment/${encodeURIComponent(publicSlug)}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Could not load payment link');
        }
        if (!cancelled) setData(json.data);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [publicSlug]);

  const handlePay = async () => {
    if (!publicSlug || !data || data.status !== 'pending') return;
    setPaying(true);
    try {
      const res = await fetch(`/api/recovery-payment/${encodeURIComponent(publicSlug)}/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data?.paymentSessionId) {
        throw new Error(json.message || 'Could not start payment');
      }
      const checkoutUrl = json.data.checkoutUrl as string | undefined;
      const isProduction =
        checkoutUrl?.includes('payments.cashfree.com') && !checkoutUrl?.includes('payments-test');

      try {
        const cashfree = await load({
          mode: isProduction ? 'production' : 'sandbox'
        });
        if (cashfree) {
          cashfree.checkout({
            paymentSessionId: json.data.paymentSessionId
          });
        } else if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          throw new Error('Payment gateway unavailable');
        }
      } catch (sdkErr: any) {
        console.error(sdkErr);
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          toast.error('Failed to open payment page');
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Payment failed to start');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full bg-gray-50 py-10 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Link2 className="w-6 h-6" />
            <span className="text-sm font-medium">Recovery payment</span>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <Loader2 className="w-10 h-10 animate-spin mb-3 text-blue-600" />
              <p>Loading...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Pay your amount</h1>
              {data.borrower_first_name && (
                <p className="text-sm text-gray-600 mb-4">Hi {data.borrower_first_name},</p>
              )}

              <dl className="space-y-3 mb-6">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600 text-sm">Loan</dt>
                  <dd className="text-sm font-medium text-gray-900 text-right">{data.short_loan_id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600 text-sm">Transaction type</dt>
                  <dd className="text-sm font-medium text-gray-900 text-right">{data.payment_type_label}</dd>
                </div>
                <div className="flex justify-between gap-4 items-center border-t border-gray-100 pt-3">
                  <dt className="text-gray-700 font-medium flex items-center gap-1">
                    <IndianRupee className="w-4 h-4" />
                    Total amount
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    ₹{data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600 text-sm">Status</dt>
                  <dd className="text-sm capitalize text-gray-900">{data.status}</dd>
                </div>
              </dl>

              {data.status === 'pending' && data.loan_status !== 'cleared' && (
                <Button
                  className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold"
                  onClick={handlePay}
                  disabled={paying}
                >
                  {paying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                      Opening payment...
                    </>
                  ) : (
                    'Pay now'
                  )}
                </Button>
              )}

              {data.status === 'paid' && (
                <p className="text-center text-green-700 font-medium py-4">This link has already been paid.</p>
              )}

              {(data.status === 'expired' || data.status === 'cancelled') && (
                <p className="text-center text-gray-600 py-4">This link is no longer active.</p>
              )}

              {data.loan_status === 'cleared' && data.status === 'pending' && (
                <p className="text-center text-amber-700 text-sm py-4">This loan is already cleared. If you still need help, contact support.</p>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
