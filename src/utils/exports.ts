/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Apartment, BuildingSettings, PaymentMethod } from "../types";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const exportToExcel = (apartments: Apartment[], currentMonth: string, settings: BuildingSettings) => {
  const monthLabel = format(parseISO(currentMonth + "-01"), "MMMM yyyy", { locale: ar });
  
  const data = apartments.map((apt) => {
    const p = apt.payments.find(p => p.month === currentMonth);
    const paid = p ? p.amountPaid : 0;
    const due = apt.monthlyFee;
    return {
      "رقم الشقة": apt.unitNumber,
      "الدور": apt.floor,
      "اسم الساكن": apt.residentName,
      "التليفون": apt.phone,
      "المطلوب": due,
      "المدفوع": paid,
      "المتبقي": Math.max(0, due - paid),
      "الحالة": paid >= due ? "مسدد" : paid > 0 ? "جزئي" : "غير مسدد",
      "تاريخ الدفع": p?.paymentDate || "-",
      "ملاحظات": p?.notes || ""
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "التقرير الشهري");
  
  XLSX.writeFile(wb, `${settings.buildingName}_تقرير_${monthLabel}.xlsx`);
};

export const exportBuildingToExcel = (apartments: Apartment[], settings: BuildingSettings) => {
  const wb = XLSX.utils.book_new();
  
  // Summary Sheet
  const summaryData = apartments.map(apt => {
    const totalPaid = apt.payments.reduce((acc, p) => acc + p.amountPaid, 0);
    return {
      "الشقة": apt.unitNumber,
      "الدور": apt.floor,
      "الساكن": apt.residentName,
      "التليفون": apt.phone,
      "الوظيفة": apt.job || "-",
      "إجمالي المدفوعات": totalPaid,
      "ملاحظات": apt.notes || ""
    };
  });
  
  const wsSum = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSum, "ملخص العمارة");

  // Payments History Sheet
  const allPayments: any[] = [];
  apartments.forEach(apt => {
    apt.payments.forEach(p => {
      allPayments.push({
        "الشقة": apt.unitNumber,
        "الساكن": apt.residentName,
        "الشهر": p.month,
        "المستحق": p.amountDue,
        "المدفوع": p.amountPaid,
        "التاريخ": p.paymentDate || "-",
        "الطريقة": p.paymentMethod
      });
    });
  });
  
  const wsPay = XLSX.utils.json_to_sheet(allPayments);
  XLSX.utils.book_append_sheet(wb, wsPay, "سجل المدفوعات");

  XLSX.writeFile(wb, `${settings.buildingName}_قاعدة_بيانات_كاملة.xlsx`);
};

export const exportApartmentToExcel = (apartment: Apartment) => {
  const data = apartment.payments.map(p => ({
    "الشهر": p.month,
    "المستحق": p.amountDue,
    "المدفوع": p.amountPaid,
    "المتبقي": Math.max(0, p.amountDue - p.amountPaid),
    "تاريخ الدفع": p.paymentDate || "-",
    "الطريقة": p.paymentMethod,
    "ملاحظات": p.notes || ""
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المدفوعات");
  XLSX.writeFile(wb, `تقرير_شقة_${apartment.unitNumber}_${apartment.residentName}.xlsx`);
};

export const importFromExcel = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      resolve(jsonData);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const exportDataToJSON = (data: any, fileName: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const importFromJSON = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
};

export const exportToPDF = (apartments: Apartment[], currentMonth: string, settings: BuildingSettings) => {
  // jsPDF with Arabic is better handled by browser printing (RTL)
  // unless we bundle a heavy font. We keep window.print() for the report.
  window.print();
};
