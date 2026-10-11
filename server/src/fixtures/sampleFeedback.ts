export interface SampleFeedbackItem {
  review: string;
  category: 'Product Feedback' | 'Customer Service' | 'Fraud and Scam' | 'Operational Issues';
}

/**
 * Curated 20-record sample dataset taken from BuildBattle_2026_Customer_Feedback_Dataset.csv
 * 5 records per category for rapid local testing without loading all 7,000 rows.
 */
export const SAMPLE_FEEDBACK_FIXTURE: SampleFeedbackItem[] = [
  // Product Feedback (5)
  {
    review: "The product's innovative features have greatly improved my daily tasks.",
    category: 'Product Feedback',
  },
  {
    review: 'The product exceeded my expectations in terms of quality and performance.',
    category: 'Product Feedback',
  },
  {
    review: 'The product arrived with some defects, but the seller was responsive and provided a replacement.',
    category: 'Product Feedback',
  },
  {
    review: 'The product is intuitive and easy to use, making it suitable for both beginners and experts.',
    category: 'Product Feedback',
  },
  {
    review: 'The software features are robust and have streamlined our team workflows effectively.',
    category: 'Product Feedback',
  },

  // Customer Service (5)
  {
    review: "Customer service was unresponsive to my inquiry. I'm disappointed with the experience.",
    category: 'Customer Service',
  },
  {
    review: 'Customer service was incredibly helpful and resolved my issue within minutes.',
    category: 'Customer Service',
  },
  {
    review: 'Customer service was knowledgeable and provided excellent assistance throughout the purchasing process.',
    category: 'Customer Service',
  },
  {
    review: 'The support agent took over 48 hours to answer an urgent priority escalation ticket.',
    category: 'Customer Service',
  },
  {
    review: 'Technical support went above and beyond to debug our API integration issue.',
    category: 'Customer Service',
  },

  // Fraud and Scam (5)
  {
    review: 'I was a victim of fraud, the seller requested additional payment after purchase.',
    category: 'Fraud and Scam',
  },
  {
    review: 'I was scammed by a fraudulent seller, they took my money and never sent the product.',
    category: 'Fraud and Scam',
  },
  {
    review: 'The merchant charged my credit card twice and stopped answering refund requests.',
    category: 'Fraud and Scam',
  },
  {
    review: 'Suspicious billing activity occurred on my account right after subscription checkout.',
    category: 'Fraud and Scam',
  },
  {
    review: 'A fake invoice was sent claiming payment failed when the funds had already cleared.',
    category: 'Fraud and Scam',
  },

  // Operational Issues (5)
  {
    review: 'The delivery was delayed due to unforeseen circumstances, but I was informed promptly.',
    category: 'Operational Issues',
  },
  {
    review: 'I faced several issues while placing my order on the website, but the support team was helpful and resolved them.',
    category: 'Operational Issues',
  },
  {
    review: 'The website was experiencing downtime during peak checkout hours, causing transaction errors.',
    category: 'Operational Issues',
  },
  {
    review: 'Package shipment was routed to the wrong regional sorting facility, resulting in a 4-day delay.',
    category: 'Operational Issues',
  },
  {
    review: 'The webhook notification dispatch failed silently during the scheduled server maintenance window.',
    category: 'Operational Issues',
  },
];
