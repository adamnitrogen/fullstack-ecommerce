export type Role = "customer" | "admin" | "manager";

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  role: Role;
  addresses: Address[];
  createdBy?: string; // Admin ID who created this admin user
  emailVerified?: boolean;
  phoneVerified?: boolean;
  isActive?: boolean; // Active/Inactive status for admins
  isDeleted?: boolean; // Whether account is permanently deleted
  createdAt?: string;
  updatedAt?: string;
  mustChangePassword?: boolean;
  image?: string;
}

export interface CreateUserDto extends Partial<User> {
  password?: string;
}

export interface ApiErrorResponse {
  error: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  pincode: string;
  locality: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  landmark?: string;
  alternatePhone?: string;
  addressType: "home" | "work" | "other" | "shipping" | "billing" | "both";
  isDefault?: boolean;
  type?: "shipping" | "billing";
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  mrp?: number;
  discount?: number;
  images: string[];
  category: string;
  tags?: string[];
  createdAt: string;
  rating?: number;
  ratingCount?: number;
  reviewCount?: number;
  inventory?: number;
  isNew?: boolean;
  benefits?: string[];
  isReturnable?: boolean;
  returnDays?: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  location: { lat?: number; lng?: number; address?: string };
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  capacity?: number;
  image?: string;
  registrations?: number;
  registrationAmount?: number;
  category?: string; // Dynamic category from admin (internal use only)
  kathaVachak?: string;
  contactAddress?: string;
  isRegistrationEnabled?: boolean;
  keyHighlights?: string[];
  specialPrivileges?: string[];
  cancellationStatus?: "CANCELLATION_PENDING" | "CANCELLED";
  cancelledAt?: string;
  cancellationReason?: string;
  cancellationCorrelationId?: string;
}

export interface Blog {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  author: string;
  date: string;
  image?: string;
  tags?: string[];
  published?: boolean;
}

export interface CartItem {
  productId: string;
  quantity: number;
  product: Product;
}

export type OrderStatus =
  // Normal Flow
  | "pending"
  | "processing"
  | "confirmed"
  | "shipped"
  | "outfordelivery"
  | "delivered"
  // Cancellation Flow
  | "cancellationrequested"
  | "cancellationpending"
  | "cancellationapproved"
  | "cancellationrejected"
  | "refundinitiated"
  | "refundinprogress"
  | "refundcompleted"
  | "cancelled"
  // Return Flow
  | "returnrequested"
  | "return_requested"
  | "returnpending"
  | "return_approved"
  | "returnapproved"
  | "returnrejected"
  | "return_rejected"
  | "pickupscheduled"
  | "pickupattempted"
  | "pickupcompleted"
  | "intransittowarehouse"
  | "qcinprogress"
  | "qcpassed"
  | "qcfailed"
  | "returncompleted"
  | "returnclosed";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_per_unit: number;
  title: string;
  image?: string;
  product?: Product;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  user_id: string;
  status: 'requested' | 'approved' | 'rejected' | 'picked_up' | 'received' | 'refunded';
  reason: string;
  refund_amount: number;
  created_at: string;
  updated_at: string;
  return_items?: Array<{
    id: string;
    product_id: string;
    quantity: number;
    product?: Product;
    order_items?: {
      title: string;
      price_per_unit: number;
    };
  }>;
}

export interface Order {
  id: string;
  userId: string;
  user_id?: string;
  order_number?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  items: CartItem[] | OrderItem[];
  total: number;
  total_amount?: number;
  status: OrderStatus;
  shippingAddress: Address;
  shipping_address?: Address;
  billingAddress?: Address;
  billing_address?: Address;
  paymentStatus: "pending" | "paid" | "failed";
  payment_status?: string;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  invoice_url?: string;
  // Cancel/Return request details
  cancelReason?: string;
  cancelComments?: string;
  cancelRequestedAt?: string;
  returnReason?: string;
  returnIssue?: string;
  returnImages?: string[];
  returnRequestedAt?: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  title?: string;
  description?: string;
}

export interface GalleryFolder {
  id: string;
  title: string;
  description?: string;
  images: string[]; // Array of image URLs
  createdAt: string;
}

export interface GalleryVideo {
  id: string;
  youtubeId: string;
  title?: string;
  description?: string;
}

export interface Review {
  id: string;
  productId: string;
  productName?: string; // Added for admin view
  productImage?: string; // Added for admin view
  userId?: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  verified?: boolean;
}

export interface Comment {
  id: string;
  blogId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string;
  isDeleted?: boolean;
  isFlagged?: boolean;
  flagReason?: string;
  flaggedBy?: string;
  flaggedAt?: string;
}

export interface PostalCodeResult {
  isValid: boolean;
  city: string;
  state: string;
  country: string;
  locality: string;
}

export interface FlaggedComment extends Comment {
  blogTitle: string;
  userAvatar?: string;
  userBlocked?: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  role?: string;
  content: string;
  rating: number;
  image?: string;
  createdAt: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AboutCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  order: number;
}

export interface ImpactStat {
  id: string;
  value: string;
  label: string;
  icon: string;
  order: number;
}

export interface TimelineItem {
  id: string;
  month: string;
  year: string;
  title: string;
  description: string;
  order: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  image: string;
  bio: string;
  order: number;
}

export interface FutureGoal {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface HeroCarouselSlide {
  id: string;
  image: string;
  title?: string;
  subtitle?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AboutUsSectionVisibility {
  missionVision: boolean;
  impactStats: boolean;
  ourStory: boolean;
  team: boolean;
  futureGoals: boolean;
  callToAction: boolean;
}

export interface AboutUsContent {
  cards: AboutCard[];
  impactStats: ImpactStat[];
  timeline: TimelineItem[];
  teamMembers: TeamMember[];
  futureGoals: FutureGoal[];
  footerDescription: string;
  sectionVisibility: AboutUsSectionVisibility;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'product' | 'category' | 'cart';
  discount_percentage: number;
  target_id?: string;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  valid_from: string;
  valid_until: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCouponDto {
  code: string;
  type: 'product' | 'category' | 'cart';
  discount_percentage: number;
  target_id?: string;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  valid_from?: string;
  valid_until: string;
  usage_limit?: number;
  is_active?: boolean;
}

export interface CartResponse {
  cart: {
    id: string;
    user_id: string;
    applied_coupon_code?: string;
    cart_items: Array<{
      id: string;
      product_id: string;
      quantity: number;
      added_at: string;
      products: Product;
    }>;
  };
  totals: CartTotals;
}

export interface CartTotals {
  itemsCount: number;
  totalMrp: number;
  totalPrice: number;
  discount: number;
  couponDiscount: number;
  deliveryCharge: number;
  finalAmount: number;
  coupon?: Coupon | null;
}

export interface DeliverySettings {
  delivery_threshold: number;
  delivery_charge: number;
}

// Checkout & Payment Types
export interface CheckoutAddress {
  id: string;
  user_id: string;
  type: 'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both';
  is_primary: boolean;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  alternatePhone?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressDto {
  type: 'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both';
  is_primary?: boolean;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
}

export interface Payment {
  id: string;
  order_id?: string;
  user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
  method?: string;
  error_code?: string;
  error_description?: string;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSummary {
  cart: {
    id: string;
    user_id: string;
    applied_coupon_code?: string;
    cart_items: Array<{
      id: string;
      product_id: string;
      quantity: number;
      added_at: string;
      products: Product;
    }>;
  };
  totals: CartTotals;
  shipping_address?: CheckoutAddress;
  billing_address?: CheckoutAddress;
}

export interface RazorpayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  payment_id: string;
  key_id: string;
}

export type RefundStatus = 'NOT_APPLICABLE' | 'INITIATED' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'REVERSED';

export interface EventRefund {
  id: string;
  event_id: string;
  registration_id: string;
  payment_id: string;
  amount: number;
  status: RefundStatus;
  gateway_reference?: string;
  initiated_at?: string;
  settled_at?: string;
  failed_at?: string;
  failure_reason?: string;
  correlation_id: string;
}

export interface EventRegistration {
  id: string;
  registration_number: string;
  event_id: string;
  user_id?: string;
  full_name: string;
  email: string;
  phone: string;
  amount: number;
  payment_status: string;
  status: "pending" | "confirmed" | "cancelled" | "refunded";
  created_at: string;
  updated_at: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  events?: Event;
  refunds?: EventRefund[];
}

export interface CancellationJobStatus {
  id: string;
  event_id: string;
  correlation_id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "PARTIAL_FAILURE";
  total_registrations: number;
  processed_count: number;
  failed_count: number;
  batch_size: number;
  last_processed_at?: string;
  completed_at?: string;
}
