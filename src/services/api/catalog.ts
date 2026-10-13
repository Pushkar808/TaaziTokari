// Public catalogue (no login needed): products, categories, zones, slots, announcements.
import { http } from './http';
import type { DeliverySlot, DeliveryZone, NotificationOffer, ProductCategory, ProductItem } from '../store';

export interface Catalog {
  products: ProductItem[];
  categories: ProductCategory[];
  zones: DeliveryZone[];
  slots: DeliverySlot[];
  notifications: NotificationOffer[];
}

export const fetchCatalog = () => http.get<Catalog>('/catalog');
