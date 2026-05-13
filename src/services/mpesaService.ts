export interface MpesaPaymentRequest {
  phone: string;
  amount: number;
  invoiceNumber: string;
  accountReference?: string;
  description?: string;
}

export interface MpesaPaymentResponse {
  success: boolean;
  message: string;
  data?: any;
}

export const MpesaService = {
  async initiatePayment(payload: MpesaPaymentRequest): Promise<MpesaPaymentResponse> {
    try {
      const res = await fetch('/api/mpesa/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data;
    } catch (error) {
      return { success: false, message: 'Failed to initiate payment', data: error };
    }
  },
}; 