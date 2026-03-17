public class PaymentGateway {
    public void processExternalPayment(Id invoiceId) {
        BillingService.createInvoice(50);
        Logger.log('External payment processed');
    }
}
