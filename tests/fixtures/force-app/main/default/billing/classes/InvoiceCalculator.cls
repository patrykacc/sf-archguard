public class InvoiceCalculator extends BaseCalculator {
    public Decimal calculate(Invoice__c inv) {
        return inv.Amount__c * 1.1;
    }
}
