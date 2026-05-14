/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PaymentMethod {
  CASH = "نقدي",
  TRANSFER = "تحويل",
  ONLINE = "أونلاين",
  UNPAID = "غير مدفوع"
}

export interface Payment {
  id: string;
  month: string; // YYYY-MM
  amountDue: number;
  amountPaid: number;
  paymentDate: string | null;
  paymentMethod: PaymentMethod;
  reason?: string;
  receiptNumber?: string;
  notes?: string;
}

export interface Apartment {
  id: string;
  floor: number;
  unitNumber: string;
  residentName: string;
  phone: string;
  email?: string;
  whatsapp?: string;
  job?: string;
  nationalId?: string;
  monthlyFee: number;
  moveInDate: string;
  notes?: string;
  isOccupied: boolean;
  payments: Payment[];
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  reason: string;
  category?: string;
  notes?: string;
}

export interface BuildingSettings {
  buildingName: string;
  address: string;
  managerName: string;
  managerPhone: string;
  defaultMonthlyFee: number;
  unionAccountNumber: string;
  lateFeeEnabled: boolean;
  lateFeeType: "value" | "percentage";
  lateFeeAmount: number;
}
