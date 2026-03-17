public class PaymentProcessor {
    public void processPayment(Id invoiceId) {
        BillingService.createInvoice(100);
        Logger.log('Payment processed');
    }
}
