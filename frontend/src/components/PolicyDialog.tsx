import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'privacy' | 'terms' | 'refund';
}

export function PolicyDialog({ open, onOpenChange, type }: PolicyDialogProps) {
  const content = {
    privacy: {
      title: 'Privacy Policy',
      sections: [
        {
          heading: 'Introduction',
          content: `At Gaushala, we are committed to protecting your privacy and ensuring the security of your personal information. 
          This Privacy Policy outlines how we collect, use, disclose, and safeguard your data when you visit our website 
          or use our services.`
        },
        {
          heading: 'Information We Collect',
          content: `We may collect the following types of information:`,
          list: [
            'Personal identification information (name, email address, phone number, etc.)',
            'Billing and shipping addresses',
            'Payment information (processed securely through our payment partners)',
            'Order history and preferences',
            'Communication preferences and newsletter subscriptions',
            'Device and browser information',
            'Usage data and analytics'
          ]
        },
        {
          heading: 'How We Use Your Information',
          content: `We use the collected information for the following purposes:`,
          list: [
            'Processing and fulfilling your orders',
            'Communicating with you about your orders and our services',
            'Sending newsletters and promotional materials (with your consent)',
            'Improving our website and services',
            'Conducting research and analysis',
            'Ensuring security and preventing fraud',
            'Complying with legal obligations'
          ]
        },
        {
          heading: 'Data Security',
          content: `We implement appropriate technical and organizational security measures to protect your personal information 
          against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over 
          the internet or electronic storage is 100% secure.`
        },
        {
          heading: 'Your Rights',
          content: `You have the right to:`,
          list: [
            'Access your personal information',
            'Correct inaccurate or incomplete data',
            'Request deletion of your personal information',
            'Opt-out of marketing communications',
            'Object to processing of your data',
            'Request data portability'
          ]
        }
      ]
    },
    terms: {
      title: 'Terms of Service',
      sections: [
        {
          heading: 'Agreement to Terms',
          content: `By accessing and using the Gaushala website and services, you agree to be bound by these Terms of Service 
          and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited 
          from using or accessing this site.`
        },
        {
          heading: 'Use License',
          content: `Permission is granted to temporarily access the materials on Gaushala's website for personal, 
          non-commercial transitory viewing only. Under this license you may not:`,
          list: [
            'Modify or copy the materials',
            'Use the materials for any commercial purpose or public display',
            'Attempt to decompile or reverse engineer any software on the website',
            'Remove any copyright or proprietary notations from the materials',
            'Transfer the materials to another person or mirror the materials on any other server'
          ]
        },
        {
          heading: 'Orders and Payment',
          content: `By placing an order, you agree to the following:`,
          list: [
            'You are legally capable of entering into binding contracts',
            'All information you provide is accurate and complete',
            'You will pay all charges at the prices in effect when incurred',
            'We reserve the right to refuse or cancel any order',
            'Payment must be received before order processing'
          ]
        },
        {
          heading: 'User Accounts',
          content: `When you create an account with us, you must:`,
          list: [
            'Provide accurate and complete information',
            'Maintain the security of your password',
            'Notify us immediately of any unauthorized use of your account',
            'Accept responsibility for all activities that occur under your account'
          ]
        },
        {
          heading: 'Limitation of Liability',
          content: `To the fullest extent permitted by law, Gaushala shall not be liable for any indirect, incidental, 
          special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred 
          directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.`
        }
      ]
    },
    refund: {
      title: 'Refund Policy',
      sections: [
        {
          heading: 'Our Commitment',
          content: `At Gaushala, we are committed to providing you with high-quality, organic products. We understand that 
          sometimes issues may arise, and we want to ensure your satisfaction with every purchase.`
        },
        {
          heading: 'Eligibility for Refunds',
          content: `You may be eligible for a refund or exchange if:`,
          list: [
            'The product received is damaged or defective',
            'You received the wrong product',
            'The product is significantly different from its description',
            'The product has quality issues upon arrival',
            'The product is past its expiration date (for perishable items)'
          ]
        },
        {
          heading: 'Timeframe for Returns',
          content: `Return requests must be initiated within 7 days of receiving your order. After this 
          period, we may not be able to offer a refund or exchange. For perishable items like milk and dairy 
          products, please contact us within 24 hours of delivery.`
        },
        {
          heading: 'Non-Refundable Items',
          content: `The following items are non-refundable unless they arrive damaged or defective:`,
          list: [
            'Perishable items that have been consumed or opened',
            'Products used or altered after delivery',
            'Items not in their original packaging',
            'Gift cards and donation receipts',
            'Personalized or custom-made products'
          ]
        },
        {
          heading: 'Refund Processing',
          content: `Once we receive and inspect your returned item, we will notify you of the approval or rejection of 
          your refund. If approved:`,
          list: [
            'Refunds will be processed within 5-7 business days',
            'Refund will be issued to the original payment method',
            'You will receive an email confirmation once the refund is processed',
            'Bank processing times may vary (typically 5-10 business days)',
            'Only the product price will be refunded; shipping charges are non-refundable unless the return is due to our error'
          ]
        },
        {
          heading: 'Contact for Returns',
          content: `To initiate a return, please contact our customer service team at info@gaushala.org or +91 98765 43210 
          with your order number and details.`
        }
      ]
    }
  };

  const policy = content[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{policy.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[calc(85vh-120px)] pr-4">
          <div className="space-y-6">
            {policy.sections.map((section, index) => (
              <section key={index}>
                <h3 className="text-lg font-semibold mb-2">{section.heading}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                  {section.content}
                </p>
                {section.list && (
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    {section.list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Last Updated:</strong> January 2025
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                For questions, contact us at info@gaushala.org or +91 98765 43210
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
