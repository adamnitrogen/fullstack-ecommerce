export default function Refund() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Refund Policy</h1>
        
        <div className="prose prose-lg max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Our Commitment</h2>
            <p className="text-muted-foreground leading-relaxed">
              At Gaushala, we are committed to providing you with high-quality, organic products. We understand that 
              sometimes issues may arise, and we want to ensure your satisfaction with every purchase. This Refund 
              Policy outlines the terms and conditions for returns, refunds, and exchanges.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Eligibility for Refunds</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              You may be eligible for a refund or exchange if:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>The product received is damaged or defective</li>
              <li>You received the wrong product</li>
              <li>The product is significantly different from its description</li>
              <li>The product has quality issues upon arrival</li>
              <li>The product is past its expiration date (for perishable items)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Timeframe for Returns</h2>
            <p className="text-muted-foreground leading-relaxed">
              Return requests must be initiated within <strong>7 days</strong> of receiving your order. After this 
              period, we may not be able to offer a refund or exchange. For perishable items like milk and dairy 
              products, please contact us within <strong>24 hours</strong> of delivery.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Non-Refundable Items</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              The following items are non-refundable unless they arrive damaged or defective:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Perishable items that have been consumed or opened</li>
              <li>Products used or altered after delivery</li>
              <li>Items not in their original packaging</li>
              <li>Gift cards and donation receipts</li>
              <li>Personalized or custom-made products</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Return Process</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              To initiate a return, please follow these steps:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
              <li>Contact our customer service team at info@gaushala.org or +91 98765 43210</li>
              <li>Provide your order number, product details, and reason for return</li>
              <li>Include photos of damaged or defective items if applicable</li>
              <li>Wait for return authorization and instructions from our team</li>
              <li>Pack the item securely in its original packaging (if available)</li>
              <li>Ship the item to the address provided by our team</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Return Shipping Costs</h2>
            <p className="text-muted-foreground leading-relaxed">
              Return shipping costs will be handled as follows:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
              <li><strong>Our error:</strong> If the return is due to our error (wrong item, damaged item, etc.), 
              we will cover the return shipping costs</li>
              <li><strong>Change of mind:</strong> If you simply changed your mind, you will be responsible for 
              return shipping costs</li>
              <li><strong>Defective items:</strong> We will provide a prepaid return label for defective products</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Refund Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Once we receive and inspect your returned item, we will notify you of the approval or rejection of 
              your refund. If approved:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
              <li>Refunds will be processed within <strong>5-7 business days</strong></li>
              <li>Refund will be issued to the original payment method</li>
              <li>You will receive an email confirmation once the refund is processed</li>
              <li>Bank processing times may vary (typically 5-10 business days)</li>
              <li>Only the product price will be refunded; shipping charges are non-refundable unless the return 
              is due to our error</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Exchanges</h2>
            <p className="text-muted-foreground leading-relaxed">
              We accept exchanges for the same product if there are quality issues. If you need to exchange an item 
              for a different product, please process it as a return and place a new order. For exchanges:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
              <li>Contact us within the return timeframe</li>
              <li>Exchanges are subject to product availability</li>
              <li>If the replacement item is of higher value, you will need to pay the difference</li>
              <li>If lower value, we will refund the difference</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Damaged or Defective Items</h2>
            <p className="text-muted-foreground leading-relaxed">
              Please inspect your order upon receipt. If any item is damaged, defective, or incorrect, please contact 
              us immediately with photos of the issue. We will arrange for a replacement or full refund at no additional 
              cost to you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Donations</h2>
            <p className="text-muted-foreground leading-relaxed">
              Donations made to Gaushala are non-refundable. All donations are final and will be used for cow welfare 
              and related activities. Donation receipts will be provided for tax purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Cancellations</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may cancel your order before it is shipped. Once an order is dispatched, it cannot be cancelled, 
              but you may return it according to our return policy. To cancel an order:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
              <li>Contact us immediately at info@gaushala.org</li>
              <li>Provide your order number</li>
              <li>If the order hasn't shipped, we will process a full refund</li>
              <li>Refunds for cancelled orders will be processed within 3-5 business days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Questions and Support</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about our Refund Policy or need assistance with a return, please don't 
              hesitate to contact us:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="font-medium">Gaushala Customer Support</p>
              <p className="text-muted-foreground">Email: info@gaushala.org</p>
              <p className="text-muted-foreground">Phone: +91 98765 43210</p>
              <p className="text-muted-foreground">Support Hours: Monday - Saturday, 9:00 AM - 6:00 PM IST</p>
              <p className="text-muted-foreground">Address: Village Road, District State, India - 123456</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Policy Updates</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to update or modify this Refund Policy at any time. Any changes will be posted 
              on this page with an updated "Last Modified" date. Continued use of our services after changes 
              constitute acceptance of the revised policy.
            </p>
          </section>

          <div className="mt-8 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              <strong>Last Updated:</strong> January 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
