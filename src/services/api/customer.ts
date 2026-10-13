// Signed-in customer data: addresses, orders, feedback.
import { http } from './http';
import type { CustomerAddress, CustomerOrder } from '../store';

export const fetchAddresses = () => http.get<CustomerAddress[]>('/addresses');

// Creates a new address, or updates it when `isExisting` is true.
export const saveAddress = (address: CustomerAddress, isExisting: boolean) =>
  isExisting
    ? http.patch<CustomerAddress>(`/addresses/${address.id}`, address)
    : http.post<CustomerAddress>('/addresses', address);

export const fetchOrders = () => http.get<CustomerOrder[]>('/orders');

// The server prices the cart, applies the delivery fee and deducts stock.
export const placeOrder = (input: {
  addressId: string;
  slotId: string;
  paymentMethod: 'COD' | 'ONLINE_RAZORPAY';
  deliveryNotes?: string;
  couponCode?: string;
  items: { productId: string; quantity: number }[];
}) => http.post<CustomerOrder>('/orders', input);

export const submitFeedback = (orderId: string, rating: number, comment: string) =>
  http.post<void>(`/orders/${orderId}/feedback`, { rating, comment });

// Preview only: tells the cart what a code would take off. Placing the order checks it again.
export const validateCoupon = (code: string, subtotal: number, silent = false) =>
  http.post<{ code: string; description: string; discount: number }>('/coupons/validate', { code, subtotal }, { silent });
