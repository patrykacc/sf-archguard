public class BillingService {
    public static Invoice__c createInvoice(Decimal amount) {
        Logger logger = new Logger();
        return new Invoice__c(Amount__c = amount);
    }
}
