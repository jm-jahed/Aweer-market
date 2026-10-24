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
    timestamps: true
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

  if (process.env.NODE_ENV !== 'test') {
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

  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return inMemoryOrders.get(id) || null;
}

export async function findOrdersByBuyerId(buyerId: string): Promise<Array<IOrderDocument | OrderRecord>> {
  if (isDatabaseConnected()) {
    return await OrderModel.find({ buyerId }).sort({ createdAt: -1 }).exec();
  }

  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return Array.from(inMemoryOrders.values())
    .filter((o) => o.buyerId === buyerId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function countOrders(): Promise<number> {
  if (isDatabaseConnected()) {
    return await OrderModel.countDocuments();
  }

  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return inMemoryOrders.size;
}
