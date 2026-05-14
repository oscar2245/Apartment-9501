/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Apartment, PaymentMethod } from "./types";

export const DATA_VERSION = "2026-05-13-v2";

export const DEFAULT_SETTINGS = {
  buildingName: "عمارة الياسمين",
  address: "شارع التسعين، التجمع الخامس، القاهرة",
  managerName: "الإدارة",
  managerPhone: "01002345678",
  defaultMonthlyFee: 250,
  unionAccountNumber: "1234-5678-9012-3456",
  lateFeeEnabled: false,
  lateFeeType: "percentage" as const,
  lateFeeAmount: 5 // 5% by default if enabled
};

const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);

export const SAMPLE_APARTMENTS: Apartment[] = [
  { id: "apt_1", floor: -1, unitNumber: "1", residentName: "الحاج/ خالد فراج", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_2", floor: -1, unitNumber: "2", residentName: "الاستاذ/ احمد عبد الهادي", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_3", floor: 0, unitNumber: "3", residentName: "الاستاذ/ عمرو خالد فراج", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_4", floor: 0, unitNumber: "4", residentName: "د / شيماء عطيه", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_5", floor: 1, unitNumber: "5", residentName: "كابتن/ شادى التهامى", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_6", floor: 1, unitNumber: "6", residentName: "كابتن/ شادى التهامى", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_7", floor: 2, unitNumber: "7", residentName: "المهندس/ عاطف بهجت", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_8", floor: 2, unitNumber: "8", residentName: "الاستاذ/ عمرو عيسى", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_9", floor: 3, unitNumber: "9", residentName: "المهندس/ رامي جمال", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_10", floor: 3, unitNumber: "10", residentName: "المهندس/ محمود محمد", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_11", floor: 4, unitNumber: "11", residentName: "الاستاذ/ مجدى محمد", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] },
  { id: "apt_12", floor: 4, unitNumber: "12", residentName: "الحاج/ خالد فراج", phone: "-", monthlyFee: 200, moveInDate: "2024-01-01", isOccupied: true, payments: [] }
];
