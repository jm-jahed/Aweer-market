import mongoose, { Schema, Document, Model } from 'mongoose';
import { OrderStatus, DeliveryType, WholesaleUnit } from '@aweermarket/types';
import { isDatabaseConnected } from '../plugins/db.js';

export interface IOrderItem {
  productId: string;
  name: string;
  unit: WholesaleUnit;
  unitWeightKg: number;
  quantity: number;
  unitPriceAed: number;
  lineTotalAed: number;
}

export interface IOrderDocument extends Document {
  orderNumber: string;
  buyerId: string;
  shopId: string;
  shopName: string;
  stallNumber?: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  pickupTime?: string;
  status: OrderStatus;
  totalAmountAed: number;
  items: IOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSubSchema = new Schema<IOrderItem>(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    unit: { type: String, enum: Object.values(WholesaleUnit), required: true },
    unitWeightKg: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceAed: { type: Number, required: true, min: 0 },
    lineTotalAed: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrderDocument>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    buyerId: { type: String, required: true, index: true },
    shopId: { type: String, required: true, index: true },
    shopName: { type: String, required: true },
    stallNumber: { type: String },
    deliveryType: { type: String, enum: Object.values(DeliveryType), required: true },
    deliveryAddress: { type: String, trim: true },
    pickupTime: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true
    },
    totalAmountAed: { type: Number, required: true, min: 0 },
    items: [OrderItemSubSchema]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        if (ret._id && !ret.id) {
          ret.id = ret._id.toString();
        }
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        if (ret._id && !ret.id) {
          ret.id = ret._id.toString();
        }
        return ret;
      }
    }
  }
);

export const OrderModel: Model<IOrderDocument> =
  mongoose.models.Order || mongoose.model<IOrderDocument>('Order', OrderSchema);

// ============================================================================
// Dual-Mode In-Memory Repository for Test Environments
// ============================================================================

export interface OrderRecord {
  id: string;
  orderNumber: string;
  buyerId: string;
  shopId: string;
  shopName: string;
  stallNumber?: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  pickupTime?: string;
  status: OrderStatus;
  totalAmountAed: number;
  items: IOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const inMemoryOrders = new Map<string, OrderRecord>();
let orderIdCounter = 1;

export class DatabaseUnavailableError extends Error {
  readonly statusCode: number = 503;
  readonly code: string = 'DATABASE_UNAVAILABLE';

  constructor(message = 'Database service is unavailable') {
    super(message);
    this.name = 'DatabaseUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isInMemoryOrderStoreAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NODE_ENV === 'test' || process.env.ALLOW_IN_MEMORY_DB === 'true';
}

export function resetInMemoryOrders(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('In-memory order store is only permitted in test environment');
  }
  inMemoryOrders.clear();
  orderIdCounter = 1;
}

export function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AWR-${dateStr}-${randomPart}`;
}

export interface CreateOrderRecordData {
  buyerId: string;
  shopId: string;
  shopName: string;
  stallNumber?: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  pickupTime?: string;
  items: Array<{
    productId: string;
    name: string;
    unit: WholesaleUnit;
    unitWeightKg: number;
    quantity: number;
    unitPriceAed: number;
  }>;
}

export async function createOrderRecord(data: CreateOrderRecordData): Promise<IOrderDocument | OrderRecord> {
  const orderNumber = generateOrderNumber();

  // Calculate authoritative line totals and total order amount on the server
  let totalAmountAed = 0;
  const processedItems: IOrderItem[] = data.items.map((item) => {
    const lineTotalAed = Math.round(item.quantity * item.unitPriceAed * 100) / 100;
    totalAmountAed += lineTotalAed;
    return {
      productId: item.productId,
      name: item.name,
      unit: item.unit,
      unitWeightKg: item.unitWeightKg,
      quantity: item.quantity,
      unitPriceAed: item.unitPriceAed,
      lineTotalAed
    };
  });
  totalAmountAed = Math.round(totalAmountAed * 100) / 100;

  if (isDatabaseConnected()) {
    return await OrderModel.create({
      orderNumber,
      buyerId: data.buyerId,
      shopId: data.shopId,
      shopName: data.shopName,
      stallNumber: data.stallNumber,
      deliveryType: data.deliveryType,
      deliveryAddress: data.deliveryAddress?.trim(),
      pickupTime: data.pickupTime?.trim(),
      status: OrderStatus.PENDING,
      totalAmountAed,
      items: processedItems
    });
  }

  if (!isInMemoryOrderStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Order creation rejected in fail-closed mode.');
  }

  const id = `order_${orderIdCounter++}_${Date.now()}`;
  const now = new Date();
  const record: OrderRecord = {
    id,
    orderNumber,
    buyerId: data.buyerId,
    shopId: data.shopId,
    shopName: data.shopName,
    stallNumber: data.stallNumber,
    deliveryType: data.deliveryType,
    deliveryAddress: data.deliveryAddress?.trim(),
    pickupTime: data.pickupTime?.trim(),
    status: OrderStatus.PENDING,
    totalAmountAed,
    items: processedItems,
    createdAt: now,
    updatedAt: now
  };

  inMemoryOrders.set(id, record);
  return record;
}

export async function findOrderById(id: string): Promise<IOrderDocument | OrderRecord | null> {
  if (isDatabaseConnected()) {
    return await OrderModel.findById(id).exec();
  }

  if (!isInMemoryOrderStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return inMemoryOrders.get(id) || null;
}

export async function findOrdersByBuyerId(buyerId: string): Promise<Array<IOrderDocument | OrderRecord>> {
  if (isDatabaseConnected()) {
    return await OrderModel.find({ buyerId }).sort({ createdAt: -1 }).exec();
  }

  if (!isInMemoryOrderStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return Array.from(inMemoryOrders.values())
    .filter((o) => o.buyerId === buyerId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function countOrders(filter?: { shopIds?: string[] }): Promise<number> {
  if (isDatabaseConnected()) {
    const q: Record<string, unknown> = {};
    if (filter?.shopIds?.length) q.shopId = { $in: filter.shopIds };
    return await OrderModel.countDocuments(q);
  }

  if (!isInMemoryOrderStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  if (filter?.shopIds?.length) {
    return Array.from(inMemoryOrders.values()).filter((o) => filter.shopIds!.includes(o.shopId)).length;
  }

  return inMemoryOrders.size;
}

export async function findOrdersByShopId(shopId: string): Promise<Array<IOrderDocument | OrderRecord>> {
  if (isDatabaseConnected()) {
    return await OrderModel.find({ shopId }).sort({ createdAt: -1 }).exec();
  }

  if (!isInMemoryOrderStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return Array.from(inMemoryOrders.values())
    .filter((o) => o.shopId === shopId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<IOrderDocument | OrderRecord | null> {
  if (isDatabaseConnected()) {
    return await OrderModel.findByIdAndUpdate(orderId, { $set: { status } }, { new: true }).exec();
  }

  if (!isInMemoryOrderStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const order = inMemoryOrders.get(orderId);
  if (!order) return null;
  order.status = status;
  order.updatedAt = new Date();
  return order;
}

export interface OrderFinancialMetrics {
  totalGmvAed: number;
  totalCommissionAed: number;
  commissionRatePercent: number;
  deliveredGmvAed: number;
  deliveredCommissionAed: number;
  ordersByStatus: Record<string, number>;
}

export async function listAllOrdersAdmin(filter?: {
  status?: OrderStatus;
  shopId?: string;
  shopIds?: string[];
}): Promise<Array<IOrderDocument | OrderRecord>> {
  if (isDatabaseConnected()) {
    const q: Record<string, unknown> = {};
    if (filter?.status) q.status = filter.status;
    if (filter?.shopId) {
      q.shopId = filter.shopId;
    } else if (filter?.shopIds?.length) {
      q.shopId = { $in: filter.shopIds };
    }
    return await OrderModel.find(q).sort({ createdAt: -1 }).exec();
  }

  if (!isInMemoryOrderStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  let list = Array.from(inMemoryOrders.values());
  if (filter?.status) {
    list = list.filter((o) => o.status === filter.status);
  }
  if (filter?.shopId) {
    list = list.filter((o) => o.shopId === filter.shopId);
  } else if (filter?.shopIds?.length) {
    list = list.filter((o) => filter.shopIds!.includes(o.shopId));
  }
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getOrderFinancialMetrics(filter?: { shopIds?: string[] }): Promise<OrderFinancialMetrics> {
  const orders = await listAllOrdersAdmin(filter?.shopIds?.length ? { shopIds: filter.shopIds } : undefined);

  let totalGmvAed = 0;
  let deliveredGmvAed = 0;
  const ordersByStatus: Record<string, number> = {
    pending: 0,
    confirmed: 0,
    preparing: 0,
    ready_for_pickup: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0
  };

  for (const order of orders) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    if (order.status !== OrderStatus.CANCELLED) {
      totalGmvAed += order.totalAmountAed;
    }
    if (order.status === OrderStatus.DELIVERED) {
      deliveredGmvAed += order.totalAmountAed;
    }
  }

  const commissionRatePercent = 5;
  const totalCommissionAed = Math.round(totalGmvAed * 0.05 * 100) / 100;
  const deliveredCommissionAed = Math.round(deliveredGmvAed * 0.05 * 100) / 100;

  return {
    totalGmvAed: Math.round(totalGmvAed * 100) / 100,
    totalCommissionAed,
    commissionRatePercent,
    deliveredGmvAed: Math.round(deliveredGmvAed * 100) / 100,
    deliveredCommissionAed,
    ordersByStatus
  };
}

