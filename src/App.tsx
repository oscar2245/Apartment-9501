/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  BarChart3, 
  LayoutDashboard, 
  Building2, 
  FileText, 
  AlertCircle, 
  Settings as SettingsIcon,
  Menu,
  X,
  CreditCard,
  Plus,
  Phone,
  Printer,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  MessageCircle,
  Sun,
  Moon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Check,
  TrendingDown,
  TrendingUp,
  Filter,
  MessageSquare,
  Wallet,
  Activity,
  User,
  Briefcase,
  IdCard,
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth, 
  parseISO, 
  differenceInCalendarMonths, 
  differenceInWeeks,
  subMonths,
  isBefore,
  isAfter,
  startOfDay
} from "date-fns";
import { enUS, ar } from "date-fns/locale";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { Apartment, Payment, PaymentMethod, BuildingSettings, Expense } from "./types";
import { storage } from "./utils/storage";
import { 
  exportToExcel, 
  exportToPDF, 
  exportBuildingToExcel, 
  exportApartmentToExcel, 
  importFromExcel 
} from "./utils/exports";
import { translations, Language } from "./translations";

// Helper for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to calculate late fees
const calculateLateFees = (apt: Apartment, settings: BuildingSettings, asOf: Date = new Date()) => {
  if (!settings.lateFeeEnabled || settings.lateFeeAmount <= 0) return 0;
  
  let totalLateFee = 0;
  const moveInDate = parseISO(apt.moveInDate);
  const startOfMoveInMonth = startOfMonth(moveInDate);
  
  // Iterate through each month from moveIn date to asOf
  let checkMonth = startOfMoveInMonth;
  const asOfStartOfMonth = startOfMonth(asOf);
  
  while (checkMonth < asOfStartOfMonth) {
    const monthStr = format(checkMonth, "yyyy-MM");
    // Only count payments made up to the asOf date
    const paidUpToDate = apt.payments
      .filter(p => p.month === monthStr && (!p.paymentDate || parseISO(p.paymentDate) <= asOf))
      .reduce((sum, p) => sum + p.amountPaid, 0);
    
    const remainingBalance = apt.monthlyFee - paidUpToDate;
    
    // If not fully paid, calculate weeks overdue from the end of that month up to asOf
    if (remainingBalance > 0) {
      const monthEnd = endOfMonth(checkMonth);
      const weeksOverdue = Math.max(0, differenceInWeeks(asOf, monthEnd));
      
      if (weeksOverdue > 0) {
        const penaltyPerWeek = settings.lateFeeType === 'value' 
          ? (settings.lateFeeAmount * (remainingBalance / apt.monthlyFee)) 
          : (remainingBalance * settings.lateFeeAmount / 100);
          
        totalLateFee += weeksOverdue * penaltyPerWeek;
      }
    }
    
    // Increment month
    checkMonth = new Date(checkMonth.getFullYear(), checkMonth.getMonth() + 1, 1);
  }
  
  return totalLateFee;
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [activeScreen, setActiveScreen] = useState<string>("dashboard");
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>(storage.getExpenses());
  const [emergencyFund, setEmergencyFund] = useState(storage.getEmergencyFund());
  const [settings, setSettings] = useState<BuildingSettings>(storage.getSettings());
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [quickPayConfirm, setQuickPayConfirm] = useState<{ aptId: string, month: string, amount: number, unitNumber: string, residentName: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark" || 
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem("lang") as Language) || "ar";
  });

  const t = translations[lang];

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    setApartments(storage.getData());
  }, []);

  useEffect(() => {
    if (apartments.length > 0) {
      storage.saveData(apartments);
    }
  }, [apartments]);

  useEffect(() => {
    storage.saveExpenses(expenses);
  }, [expenses]);

  useEffect(() => {
    storage.saveEmergencyFund(emergencyFund);
  }, [emergencyFund]);

  const handleSaveSettings = (newSettings: BuildingSettings) => {
    setSettings(newSettings);
    storage.saveSettings(newSettings);
    alert("تم حفظ جميع الإعدادات وغرامات التأخير بنجاح");
  };

  const currentApartment = useMemo(() => 
    apartments.find(a => a.id === selectedAptId), 
    [apartments, selectedAptId]
  );

  const stats = useMemo(() => {
    const totalDue = apartments.reduce((acc, apt) => acc + apt.monthlyFee, 0);
    const thisMonthPayments = apartments.flatMap(apt => 
      apt.payments.filter(p => p.month === currentMonth)
    );
    const collected = thisMonthPayments.reduce((acc, p) => acc + p.amountPaid, 0);
    const paidApts = apartments.filter(apt => 
      apt.payments.some(p => p.month === currentMonth && p.amountPaid >= apt.monthlyFee)
    ).length;
    
    // Total debts
    let totalPending = 0;
    apartments.forEach(apt => {
      const allPaid = apt.payments.reduce((acc, p) => acc + p.amountPaid, 0);
      const moveInDate = parseISO(apt.moveInDate);
      const monthsSinceMove = Math.max(1, differenceInCalendarMonths(new Date(), moveInDate) + 1);
      const expectedTotal = apt.monthlyFee * monthsSinceMove;
      const baseDebt = Math.max(0, expectedTotal - allPaid);
      const lateFee = calculateLateFees(apt, settings);
      totalPending += baseDebt + lateFee;
    });

    // Debt trend for last 6 months
    const debtTrend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const targetDate = endOfMonth(subMonths(now, i));
      const monthLabel = format(targetDate, "MMM", { locale: ar });
      
      let monthlyTotalDebt = 0;
      apartments.forEach(apt => {
        const moveInDate = parseISO(apt.moveInDate);
        // Ensure month is within or after moveIn
        if (targetDate >= startOfMonth(moveInDate)) {
          const monthsCount = Math.max(1, differenceInCalendarMonths(targetDate, moveInDate) + 1);
          const expected = apt.monthlyFee * monthsCount;
          const paidUpToDate = apt.payments
            .filter(p => {
              const paymentMonth = parseISO(p.month + "-01");
              const paymentDate = p.paymentDate ? parseISO(p.paymentDate) : paymentMonth;
              return paymentMonth <= targetDate && paymentDate <= targetDate;
            })
            .reduce((sum, p) => sum + p.amountPaid, 0);
          
          const baseDebt = Math.max(0, expected - paidUpToDate);
          const lateFee = calculateLateFees(apt, settings, targetDate);
          monthlyTotalDebt += baseDebt + lateFee;
        }
      });
      
      debtTrend.push({
        name: monthLabel,
        value: monthlyTotalDebt,
        formattedValue: monthlyTotalDebt.toLocaleString() + " ج.م"
      });
    }

    return { totalDue, collected, paidApts, totalPending, debtTrend };
  }, [apartments, currentMonth, settings]);

  const balanceStats = useMemo(() => {
    const balanceTrend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStr = format(monthDate, "yyyy-MM");
      const monthLabel = format(monthDate, "MMM", { locale: ar });
      
      const monthIncomes = apartments.reduce((acc, apt) => {
        return acc + apt.payments
          .filter(p => p.month === monthStr)
          .reduce((sum, p) => sum + p.amountPaid, 0);
      }, 0);

      const monthExpenses = expenses
        .filter(e => e.date.startsWith(monthStr))
        .reduce((sum, e) => sum + e.amount, 0);

      balanceTrend.push({
        name: monthLabel,
        income: monthIncomes,
        expense: monthExpenses,
        net: monthIncomes - monthExpenses,
        formattedNet: (monthIncomes - monthExpenses).toLocaleString() + " ج.م"
      });
    }
    
    const totalIncomes = apartments.reduce((acc, apt) => {
      return acc + apt.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    }, 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    
    return { balanceTrend, totalIncomes, totalExpenses, netBalance: totalIncomes - totalExpenses - emergencyFund.balance };
  }, [apartments, expenses, emergencyFund]);

  // --- ACTIONS ---

  const registerPayment = (aptId: string, payment: Payment) => {
    setApartments(prev => prev.map(apt => {
      if (apt.id === aptId) {
        const existingIdx = apt.payments.findIndex(p => p.month === payment.month);
        const newPayments = [...apt.payments];
        if (existingIdx >= 0) {
          newPayments[existingIdx] = payment;
        } else {
          newPayments.push(payment);
        }
        return { ...apt, payments: newPayments };
      }
      return apt;
    }));
    
    setIsPaymentModalOpen(false);
    setQuickPayConfirm(null);
    
    // Toast notification
    const apt = apartments.find(a => a.id === aptId);
    setToast({
      message: lang === 'ar' 
        ? `تم تسجيل دفع مبلغ ${payment.amountPaid} ج.م للشقة ${apt?.unitNumber} بنجاح.`
        : `Payment of ${payment.amountPaid} EGP for Apt ${apt?.unitNumber} registered successfully.`,
      type: 'success'
    });
    
    setTimeout(() => setToast(null), 3000);
  };

  const initiateQuickPay = (aptId: string, unitNumber: string, residentName: string, amount: number) => {
    setQuickPayConfirm({
      aptId,
      unitNumber,
      residentName,
      month: currentMonth,
      amount
    });
  };

  const executeQuickPay = (confirmData: typeof quickPayConfirm) => {
    if (!confirmData) return;
    
    registerPayment(confirmData.aptId, {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      month: confirmData.month,
      amountDue: confirmData.amount,
      amountPaid: confirmData.amount,
      paymentMethod: PaymentMethod.CASH,
      paymentDate: new Date().toISOString().split('T')[0],
      reason: lang === 'ar' ? "اشتراك شهري (دفع سريع)" : "Monthly subscription (Quick Pay)"
    });
  };

  // --- NAVIGATION ---

  const NavItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => (
    <button
      onClick={() => setActiveScreen(id)}
      className={cn(
        "flex items-center gap-4 w-full p-3.5 rounded-xl transition-all text-right group relative",
        activeScreen === id 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
          : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
      )}
    >
      <Icon size={22} className={cn("min-w-[22px]", activeScreen === id ? "text-white" : "group-hover:scale-110 transition-transform")} />
      
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="font-bold text-sm whitespace-nowrap overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {!isSidebarOpen && (
        <div className="absolute right-full mr-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-gray-800">
          {label}
        </div>
      )}
    </button>
  );

  const updateApartment = (updatedApt: Apartment) => {
    setApartments(prev => prev.map(apt => apt.id === updatedApt.id ? updatedApt : apt));
  };

  const updateAllFees = (newFee: number) => {
    setApartments(prev => prev.map(apt => ({ ...apt, monthlyFee: newFee })));
  };

  const resetAllDebts = () => {
    const startOfCurrentMonth = new Date().toISOString().slice(0, 7) + "-01";
    setApartments(prev => prev.map(apt => ({ 
      ...apt, 
      payments: [],
      moveInDate: startOfCurrentMonth
    })));
    setExpenses([]);
    setEmergencyFund({ balance: 0, transactions: [] });
  };

  const resetApartmentDebt = (id: string) => {
    const startOfCurrentMonth = new Date().toISOString().slice(0, 7) + "-01";
    setApartments(prev => prev.map(apt => apt.id === id ? { 
      ...apt, 
      payments: [],
      moveInDate: startOfCurrentMonth
    } : apt));
  };

  const handleImportExcel = async (data: any[]) => {
    try {
      // Expected columns: رقم الشقة, الشهر, المدفوع
      const newApartments = [...apartments];
      let importedCount = 0;

      data.forEach(row => {
        const unitNo = String(row["رقم الشقة"] || row["الشقة"] || "");
        const apt = newApartments.find(a => a.unitNumber === unitNo);
        if (apt) {
          const month = String(row["الشهر"] || currentMonth);
          const paid = Number(row["المدفوع"] || 0);
          
          if (month && !isNaN(paid)) {
            const existingPaymentIdx = apt.payments.findIndex(p => p.month === month);
            const payment = {
              id: Math.random().toString(36).substr(2, 9),
              month,
              amountDue: apt.monthlyFee,
              amountPaid: paid,
              paymentMethod: PaymentMethod.CASH,
              paymentDate: new Date().toISOString().split('T')[0]
            };

            if (existingPaymentIdx >= 0) {
              apt.payments[existingPaymentIdx] = payment;
            } else {
              apt.payments.push(payment);
            }
            importedCount++;
          }
        }
      });

      setApartments(newApartments);
      alert(`تم استيراد ${importedCount} دفعة بنجاح`);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء استيراد الملف. يرجى التأكد من تنسيق الملف (رقم الشقة، الشهر، المدفوع)");
    }
  };

  return (
    <div className={cn(
      "flex min-h-screen transition-colors duration-300", 
      isDarkMode ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-900"
    )} dir="rtl">
      {/* Mobile Menu Button */}
      {isMobile && !isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-2 font-bold"
        >
          <Menu size={24} />
          <span>القائمة</span>
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[25]"
        />
      )}

      {/* Sidebar - Desktop Collapsible / Mobile Toggle */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? "85%" : 260) : (isMobile ? 0 : 88),
          x: (isMobile && !isSidebarOpen) ? 300 : 0
        }}
        className={cn(
          "bg-[#1a2744] text-white flex flex-col z-30 transition-colors overflow-hidden h-screen sticky top-0",
          isMobile ? "fixed right-0 shadow-3xl" : "shadow-2xl border-l border-white/5"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/5 h-20 shrink-0">
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2 overflow-hidden"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-white" />
                </div>
                <h1 className="text-lg font-black tracking-tight whitespace-nowrap">
                  {settings.buildingName || "إدارة العقار"}
                </h1>
              </motion.div>
            )}
            {!isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mx-auto"
              >
                <Building2 size={24} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/50 hover:text-white"
              title={isMobile ? "إغلاق" : "تصغير القائمة"}
            >
              {isMobile ? <X size={20} /> : <ChevronRight size={20} />}
            </button>
          )}
        </div>

        {!isSidebarOpen && (
          <div className="py-4 flex justify-center border-b border-white/5">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-blue-400 transition-all shadow-inner"
              title="توسيع القائمة"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
        )}

        {isSidebarOpen ? (
          <div className="px-4 py-4 border-b border-white/5 relative">
            <div className="relative group">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-blue-400 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="ابحث عن شقة أو اسم..." 
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold text-white placeholder:text-white/20 outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/10 transition-all"
              />
              {sidebarSearch && (
                <button 
                  onClick={() => setSidebarSearch("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sidebar Search Results Dropdown */}
            <AnimatePresence>
              {sidebarSearch && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-4 right-4 top-full mt-2 bg-[#1a2744] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto custom-scrollbar"
                >
                  {apartments
                    .filter(apt => 
                      apt.number.includes(sidebarSearch) || 
                      apt.ownerName.includes(sidebarSearch) ||
                      apt.floor.toString().includes(sidebarSearch)
                    )
                    .slice(0, 5)
                    .map(apt => (
                      <button
                        key={apt.id}
                        onClick={() => {
                          setSelectedAptId(apt.id);
                          setActiveScreen("apartments");
                          setSidebarSearch("");
                          if (isMobile) setIsSidebarOpen(false);
                        }}
                        className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-right border-b border-white/5 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 font-black text-xs">
                          {apt.number}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-white truncate">{apt.ownerName}</span>
                          <span className="text-[10px] text-white/40">الطابق {apt.floor}</span>
                        </div>
                      </button>
                    ))
                  }
                  {apartments.filter(apt => 
                    apt.number.includes(sidebarSearch) || 
                    apt.ownerName.includes(sidebarSearch)
                  ).length === 0 && (
                    <div className="p-4 text-center text-xs text-white/30 font-bold">لا توجد نتائج</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-4 flex justify-center border-b border-white/5">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/30 hover:text-white transition-all shadow-inner"
              title="بحث سريع"
            >
              <Search size={20} />
            </button>
          </div>
        )}

        <div className="flex-1 px-3 space-y-2 mt-6 overflow-y-auto custom-scrollbar">
          <NavItem id="dashboard" icon={LayoutDashboard} label={t.dashboard} />
          <NavItem id="apartments" icon={Building2} label={t.apartments} />
          <NavItem id="income" icon={Wallet} label={lang === 'ar' ? 'الإيرادات' : 'Income'} />
          <NavItem id="emergency-fund" icon={AlertCircle} label={lang === 'ar' ? 'صندوق الطوارئ' : 'Emergency Fund'} />
          <NavItem id="payments" icon={CreditCard} label={t.expenses} />
          <NavItem id="monthly-report" icon={FileText} label={lang === 'ar' ? 'الكشف الشهري' : 'Monthly Report'} />
          <NavItem id="debts-report" icon={AlertTriangle} label={lang === 'ar' ? 'تقرير المديونيات' : 'Debts Report'} />
          <NavItem id="settings" icon={SettingsIcon} label={t.settings} />
        </div>

        <div className="p-4 bg-[#141d33] border-t border-white/5 space-y-2">
          <button 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className={cn(
              "flex items-center gap-4 w-full p-3 rounded-xl hover:bg-white/5 transition-all group",
              !isSidebarOpen ? "justify-center" : ""
            )}
            title={lang === 'ar' ? "English" : "العربية"}
          >
            <div className="w-5 h-5 flex items-center justify-center font-black text-xs bg-white/10 rounded group-hover:bg-blue-500 transition-colors">
              {lang === 'ar' ? "EN" : "AR"}
            </div>
            {isSidebarOpen && <span className="text-sm font-bold text-gray-400 group-hover:text-white">{lang === 'ar' ? "English" : "العربية"}</span>}
          </button>

          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={cn(
              "flex items-center gap-4 w-full p-3 rounded-xl hover:bg-white/5 transition-all group",
              !isSidebarOpen ? "justify-center" : ""
            )}
            title={isDarkMode ? "الوضع النهاري" : "الوضع الليلي"}
          >
            {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-blue-400" />}
            {isSidebarOpen && <span className="text-sm font-bold text-gray-400 group-hover:text-white">{isDarkMode ? "الوضع النهاري" : "الوضع الليلي"}</span>}
          </button>

          <div className={cn(
            "flex items-center gap-3 pt-2 border-t border-white/5",
            !isSidebarOpen ? "justify-center" : ""
          )}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg shrink-0 border border-white/10">
              {settings.managerName[0]}
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black text-white truncate">{settings.managerName}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{lang === 'ar' ? "مدير العقار" : "Property Manager"}</span>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen p-8 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeScreen === "dashboard" && (
              <DashboardView 
                stats={stats} 
                balanceStats={balanceStats}
                emergencyFund={emergencyFund}
                apartments={apartments} 
                currentMonth={currentMonth}
                onAptClick={(id: string) => { setSelectedAptId(id); setActiveScreen("apartment-detail"); }}
                onQuickPay={initiateQuickPay}
                lang={lang}
                t={t}
              />
            )}
            {activeScreen === "apartments" && (
              <ApartmentsGridView 
                apartments={apartments} 
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                currentMonth={currentMonth}
                onAptClick={(id) => { setSelectedAptId(id); setActiveScreen("apartment-detail"); }}
                onUpdateApt={updateApartment}
                onQuickPay={initiateQuickPay}
                lang={lang}
                t={t}
              />
            )}
            {activeScreen === "income" && (
              <IncomeView 
                apartments={apartments}
                expenses={expenses}
                emergencyFund={emergencyFund}
                lang={lang}
                t={t}
              />
            )}
            {activeScreen === "emergency-fund" && (
              <EmergencyFundView 
                emergencyFund={emergencyFund}
                onUpdateFund={(newFund: any) => setEmergencyFund(newFund)}
                totalIncomes={balanceStats.totalIncomes}
                totalExpenses={balanceStats.totalExpenses}
                netBalance={balanceStats.netBalance}
                lang={lang}
                t={t}
              />
            )}
            {activeScreen === "payments" && (
              <ExpensesView 
                expenses={expenses} 
                apartments={apartments}
                onAdd={(exp: Expense) => setExpenses(prev => [exp, ...prev])}
                onDelete={(id: string) => setExpenses(prev => prev.filter(e => e.id !== id))}
                lang={lang}
                t={t}
              />
            )}
            {activeScreen === "add-apartment" && (
              <AddApartmentView 
                onSave={(newApt) => {
                  setApartments(prev => [...prev, newApt]);
                  setActiveScreen("apartments");
                }}
                onCancel={() => setActiveScreen("apartments")}
                lang={lang}
                t={t}
              />
            )}
            {activeScreen === "apartment-detail" && currentApartment && (
              <ApartmentDetailView 
                apartment={currentApartment}
                settings={settings}
                onBack={() => setActiveScreen("apartments")}
                onRegisterPayment={() => setIsPaymentModalOpen(true)}
                onDelete={(id: string) => {
                  setApartments(prev => prev.filter(a => a.id !== id));
                  setActiveScreen("apartments");
                }}
                onUpdate={updateApartment}
                onResetDebt={() => resetApartmentDebt(currentApartment.id)}
                lang={lang}
                t={t}
              />
            )}
            {activeScreen === "monthly-report" && (
              <MonthlyReportView 
                apartments={apartments} 
                emergencyFund={emergencyFund}
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                settings={settings}
                lang={lang}
                t={t}
              />
            )}
            {activeScreen === "debts-report" && (
              <DebtsReportView 
                apartments={apartments} 
                settings={settings}
                onResetAllDebts={resetAllDebts}
                lang={lang}
                t={t}
              />
            )}
            {activeScreen === "settings" && (
              <SettingsView 
                settings={settings} 
                onSave={handleSaveSettings} 
                onResetDebts={resetAllDebts}
                onBulkUpdateFees={updateAllFees}
                onImportExcel={handleImportExcel}
                onExportAll={() => exportBuildingToExcel(apartments, settings)}
                onClear={() => {
                  if(confirm("هل أنت متأكد من مسح جميع البيانات؟")) {
                    storage.clearAll();
                    window.location.reload();
                  }
                }}
                lang={lang}
                t={t}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Payment Modal */}
      {isPaymentModalOpen && currentApartment && (
        <PaymentModal 
          apartment={currentApartment}
          onClose={() => setIsPaymentModalOpen(false)}
          onSave={(p) => registerPayment(currentApartment.id, p)}
          lang={lang}
          t={t}
        />
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border transition-colors",
              toast.type === 'success' 
                ? "bg-green-600 border-green-500 text-white" 
                : "bg-red-600 border-red-500 text-white"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:bg-white/20 p-1 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Pay Confirmation Modal */}
      <AnimatePresence>
        {quickPayConfirm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm"
              onClick={() => setQuickPayConfirm(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl z-10 overflow-hidden text-right p-8 space-y-6 border border-gray-100 dark:border-gray-800"
            >
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CreditCard size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">
                  {lang === 'ar' ? 'تأكيد الدفع السريع' : 'Confirm Quick Pay'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {lang === 'ar' 
                    ? `هل أنت متأكد من تسجيل دفع مبلغ ${quickPayConfirm.amount} ج.م لشهر ${format(parseISO(quickPayConfirm.month + "-01"), "MMMM yyyy", { locale: ar })}؟`
                    : `Are you sure you want to register a payment of ${quickPayConfirm.amount} EGP for ${format(parseISO(quickPayConfirm.month + "-01"), "MMMM yyyy", { locale: enUS })}?`}
                  <br />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    {lang === 'ar' ? `الشقة ${quickPayConfirm.unitNumber} - ${quickPayConfirm.residentName}` : `Apt ${quickPayConfirm.unitNumber} - ${quickPayConfirm.residentName}`}
                  </span>
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => executeQuickPay(quickPayConfirm)}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
                >
                  {lang === 'ar' ? 'نعم، تسجيل الدفع' : 'Yes, Register Payment'}
                </button>
                <button 
                  onClick={() => setQuickPayConfirm(null)}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-3 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function DashboardView({ stats, balanceStats, emergencyFund, apartments, currentMonth, onAptClick, onQuickPay, lang, t }: any) {
  const overdueApts = apartments.filter((apt: Apartment) => {
    const p = apt.payments.find(p => p.month === currentMonth);
    return !p || p.amountPaid < apt.monthlyFee;
  });

  return (
    <div className="space-y-8" dir={t.dir}>
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 transition-colors">{t.dashboard}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">{lang === 'ar' ? 'مشاهدة سريعة لحالة العقار لشهر' : 'Quick view of property status for'} {format(parseISO(currentMonth + "-01"), "MMMM yyyy", { locale: lang === 'ar' ? ar : enUS })}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-3 transition-colors">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{lang === 'ar' ? 'النظام يعمل بصورة جيدة' : 'System running smoothly'}</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard 
          label={t.totalRevenue} 
          value={`${balanceStats.totalIncomes.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} 
          subLabel={lang === 'ar' ? 'إجمالي ما تم تحصيله' : 'Total collected'}
          icon={TrendingUp}
          color="bg-green-50 dark:bg-green-900/10 text-green-600"
        />
        <StatCard 
          label={t.totalExpenses} 
          value={`${balanceStats.totalExpenses.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} 
          subLabel={lang === 'ar' ? 'إجمالي ما تم صرفه' : 'Total spent'}
          icon={TrendingDown}
          color="bg-red-50 dark:bg-red-900/10 text-red-600"
        />
        <StatCard 
          label={t.netBalance} 
          value={`${balanceStats.netBalance.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} 
          subLabel={lang === 'ar' ? 'الرصيد الحالي المتاح' : 'Current available balance'}
          icon={CreditCard}
          color="bg-blue-50 dark:bg-blue-900/10 text-blue-600"
        />
        <StatCard 
          label={lang === 'ar' ? 'المتأخرات' : 'Arrears'} 
          value={`${stats.totalPending.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} 
          subLabel={lang === 'ar' ? 'مديونيات لم تُحصل بعد' : 'Uncollected debts'}
          icon={AlertCircle}
          color="bg-orange-50 dark:bg-orange-900/10 text-orange-600"
        />
        <StatCard 
          label={lang === 'ar' ? 'صندوق الطوارئ' : 'Emergency Fund'} 
          value={`${emergencyFund.balance.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} 
          subLabel={lang === 'ar' ? 'رصيد الحالات الطارئة' : 'Emergency situation balance'}
          icon={AlertCircle}
          color="bg-amber-50 dark:bg-amber-900/10 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Area */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 transition-colors font-mono">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 transition-colors">{lang === 'ar' ? 'الميزانية الشهرية (إيرادات vs مصروفات)' : 'Monthly Budget (Revenue vs Expenses)'}</h3>
            <div className="flex items-center gap-4 text-[10px] font-black">
               <div className="flex items-center gap-1.5 text-green-500">
                 <div className="w-2 h-2 rounded-full bg-green-500" /> {lang === 'ar' ? 'إيرادات' : 'Incomes'}
               </div>
               <div className="flex items-center gap-1.5 text-red-500">
                 <div className="w-2 h-2 rounded-full bg-red-500" /> {lang === 'ar' ? 'مصروفات' : 'Expenses'}
               </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balanceStats.balanceTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className={cn("bg-gray-900 text-white p-4 rounded-xl shadow-xl border border-gray-800 min-w-[150px]", lang === 'ar' ? "text-right" : "text-left")}>
                          <p className="text-[10px] font-black opacity-50 mb-2 border-b border-gray-800 pb-1">{data.name}</p>
                          <div className="flex justify-between items-center gap-4 mb-1">
                            <span className="text-xs text-green-400 font-bold">{data.income.toLocaleString()}</span>
                            <span className="text-[10px] opacity-70">{lang === 'ar' ? 'الإيرادات' : 'Incomes'}</span>
                          </div>
                          <div className="flex justify-between items-center gap-4 mb-2 border-b border-gray-800 pb-2">
                            <span className="text-xs text-red-400 font-bold">{data.expense.toLocaleString()}</span>
                            <span className="text-[10px] opacity-70">{lang === 'ar' ? 'المصروفات' : 'Expenses'}</span>
                          </div>
                          <div className="flex justify-between items-center gap-4">
                            <span className={cn("text-sm font-black", data.net >= 0 ? "text-blue-400" : "text-red-400")}>{data.net.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                            <span className="text-[10px] opacity-70">{lang === 'ar' ? 'الصافي' : 'Net'}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 text-center italic font-bold">
            * {lang === 'ar' ? 'هذا الرسم يوضح الإيرادات والمصروفات خلال الـ 6 أشهر الماضية' : 'This chart shows income and expenses over the last 6 months'}
          </p>
        </div>

        {/* List of Overdue */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 flex flex-col transition-colors">
          <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">{lang === 'ar' ? 'متأخرات الشهر الحالي' : 'Current Month Arrears'}</h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {overdueApts.map((apt: Apartment) => (
              <div 
                key={apt.id} 
                onClick={() => onAptClick(apt.id)}
                className={cn("w-full p-3 rounded-xl border border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-200 transition-all group cursor-pointer", lang === 'ar' ? "text-right" : "text-left")}
              >
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700 dark:text-gray-200">{lang === 'ar' ? 'شقة' : 'Apt'} {apt.unitNumber}</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{apt.residentName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-colors uppercase tracking-tighter">
                      {lang === 'ar' ? 'مطلوب' : 'Due'} {apt.monthlyFee} {lang === 'ar' ? 'ج.م' : 'EGP'}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickPay(apt.id, apt.unitNumber, apt.residentName, apt.monthlyFee);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95"
                    >
                      <CreditCard size={10} /> {lang === 'ar' ? "دفع سريع" : "Quick Pay"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {overdueApts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-center">
                <Building2 size={40} className="mb-2 opacity-20" />
                <p>{lang === 'ar' ? 'لا توجد متأخرات للشهر الحالي' : 'No arrears for the current month'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subLabel, icon: Icon, color }: any) {
  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-start justify-between transition-colors">
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{label}</p>
        <p className="text-2xl font-black text-gray-800 dark:text-gray-100 mt-1">{value}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subLabel}</p>
      </div>
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon size={24} />
      </div>
    </div>
  );
}

function ApartmentsGridView({ apartments, searchTerm, setSearchTerm, currentMonth, onAptClick, onUpdateApt, onQuickPay, lang, t }: any) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Apartment>>({});

  const counts = useMemo(() => {
    return apartments.reduce((acc: any, apt: Apartment) => {
      const payment = apt.payments.find((p: any) => p.month === currentMonth);
      const isPaid = payment && payment.amountPaid >= apt.monthlyFee;
      const isPartial = payment && payment.amountPaid > 0 && payment.amountPaid < apt.monthlyFee;
      
      if (isPaid) acc.paid++;
      else if (isPartial) acc.partial++;
      else acc.unpaid++;
      acc.all = apartments.length;
      return acc;
    }, { all: 0, paid: 0, partial: 0, unpaid: 0 });
  }, [apartments, currentMonth]);

  const filtered = apartments.filter((apt: Apartment) => {
    const matchesSearch = apt.residentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         apt.unitNumber.includes(searchTerm);
    
    const payment = apt.payments.find(p => p.month === currentMonth);
    const isPaid = payment && payment.amountPaid >= apt.monthlyFee;
    const isPartial = payment && payment.amountPaid > 0 && payment.amountPaid < apt.monthlyFee;
    const isUnpaid = !payment || payment.amountPaid === 0;

    let matchesStatus = true;
    if (statusFilter === "paid") matchesStatus = !!isPaid;
    if (statusFilter === "partial") matchesStatus = !!isPartial;
    if (statusFilter === "unpaid") matchesStatus = !!isUnpaid;

    return matchesSearch && matchesStatus;
  });

  const startEditing = (e: React.MouseEvent, apt: Apartment) => {
    e.stopPropagation();
    setEditingAptId(apt.id);
    setEditForm({ 
      residentName: apt.residentName, 
      phone: apt.phone, 
      monthlyFee: apt.monthlyFee,
      job: apt.job || "",
      whatsapp: apt.whatsapp || "",
      nationalId: apt.nationalId || ""
    });
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAptId(null);
  };

  const saveEditing = (e: React.MouseEvent, apt: Apartment) => {
    e.stopPropagation();
    onUpdateApt({ ...apt, ...editForm });
    setEditingAptId(null);
  };

  const FilterButton = ({ id, label, color, count, icon: Icon }: { id: string, label: string, color: string, count: number, icon?: any }) => (
    <button
      onClick={() => setStatusFilter(id)}
      className={cn(
        "flex items-center gap-2 px-5 py-2.5 rounded-2xl border text-sm font-black transition-all relative overflow-hidden group",
        statusFilter === id 
          ? `${color} border-transparent shadow-lg scale-105 z-10` 
          : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
      )}
    >
      {Icon && <Icon size={16} strokeWidth={2.5} />}
      <span>{label}</span>
      <span className={cn(
        "px-2 py-0.5 rounded-lg text-[10px] min-w-[20px] text-center",
        statusFilter === id ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
      )}>
        {count}
      </span>
      {statusFilter === id && (
        <motion.div 
          layoutId="activeFilter"
          className="absolute inset-0 bg-white/10 pointer-events-none"
        />
      )}
    </button>
  );

  return (
    <div className="space-y-6" dir={t.dir}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100">{t.apartments}</h2>
          <div className="relative w-full md:w-96">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500", lang === 'ar' ? 'right-4' : 'left-4')} size={20} />
            <input 
              type="text" 
              placeholder={t.searchApartment}
              className={cn(
                "w-full py-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm transition-all text-gray-800 dark:text-gray-100",
                lang === 'ar' ? "pr-12 pl-4" : "pl-12 pr-4"
              )}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide">
          <div className="flex items-center gap-2">
            <FilterButton id="all" label={lang === 'ar' ? 'الكل' : 'All'} color="bg-gray-900 dark:bg-gray-800 text-white" count={counts.all} icon={Building2} />
            <div className="w-px h-8 bg-gray-200 dark:bg-gray-800 mx-1 hidden md:block"></div>
            <FilterButton id="paid" label={t.paid} color="bg-green-600 text-white" count={counts.paid} icon={CheckCircle2} />
            <FilterButton id="partial" label={t.partial} color="bg-yellow-500 text-white" count={counts.partial} icon={Clock} />
            <FilterButton id="unpaid" label={t.unpaid} color="bg-red-600 text-white" count={counts.unpaid} icon={AlertTriangle} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((apt: Apartment) => {
          const payment = apt.payments.find(p => p.month === currentMonth);
          const isPaid = payment && payment.amountPaid >= apt.monthlyFee;
          const isPartial = payment && payment.amountPaid > 0 && payment.amountPaid < apt.monthlyFee;
          const isEditing = editingAptId === apt.id;
          
          return (
            <motion.div
              layout
              whileHover={!isEditing ? { y: -5 } : {}}
              whileTap={!isEditing ? { scale: 0.98 } : {}}
              key={apt.id}
              onClick={() => !isEditing && onAptClick(apt.id)}
              className={cn(
                "bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 text-right group relative overflow-hidden transition-all",
                !isEditing && "cursor-pointer hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/50",
                isEditing && "ring-2 ring-blue-500 shadow-xl"
              )}
            >
              {/* Right Side Indicator Bar */}
              <div className={cn(
                "absolute top-0 right-0 w-2 h-full transition-colors",
                isPaid ? "bg-green-500" : isPartial ? "bg-amber-500" : "bg-rose-600"
              )}></div>
              
              <div className="flex justify-between items-start mb-6">
                <div className="bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-xl text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">
                  {t.floor} {apt.floor}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-black text-gray-900 dark:text-gray-100 drop-shadow-sm transition-colors">#{apt.unitNumber}</div>
                  <div className="mt-1">
                    {isPaid ? (
                      <div className="w-4 h-4 bg-green-500 rounded-full shadow-lg shadow-green-500/20 ring-2 ring-white dark:ring-gray-900" title="مسدد بالكامل" />
                    ) : isPartial ? (
                      <div className="w-4 h-4 rounded-full shadow-lg shadow-amber-500/20 ring-2 ring-white dark:ring-gray-900 overflow-hidden flex rotate-90" title="مسدد جزئياً">
                        <div className="w-1/2 h-full bg-amber-500" />
                        <div className="w-1/2 h-full bg-gray-200 dark:bg-gray-700" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 bg-rose-600 rounded-full shadow-lg shadow-rose-600/20 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-white font-black text-[10px]" title="غير مسدد">
                        !
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                {isEditing ? (
                  <div className="space-y-3" onClick={e => e.stopPropagation()}>
                    <input 
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-800 dark:text-gray-100"
                      value={editForm.residentName}
                      onChange={e => setEditForm({...editForm, residentName: e.target.value})}
                      placeholder="اسم الساكن"
                    />
                    <div className="grid grid-cols-2 gap-2">
                       <input 
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-800 dark:text-gray-100"
                        value={editForm.phone}
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                        placeholder="رقم الهاتف"
                        dir="ltr"
                      />
                      <input 
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-800 dark:text-gray-100"
                        value={editForm.whatsapp}
                        onChange={e => setEditForm({...editForm, whatsapp: e.target.value})}
                        placeholder="واتساب"
                        dir="ltr"
                      />
                    </div>
                    <input 
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-800 dark:text-gray-100"
                      value={editForm.job}
                      onChange={e => setEditForm({...editForm, job: e.target.value})}
                      placeholder="الوظيفة"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <h4 className="font-black text-xl text-gray-800 dark:text-gray-100 truncate transition-colors">{apt.residentName}</h4>
                    <p className="text-gray-400 dark:text-gray-500 text-sm flex items-center justify-end gap-2 font-bold transition-colors">
                      <span dir="ltr">{apt.phone}</span> <Phone size={14} className="text-gray-300 dark:text-gray-600" />
                    </p>
                    {apt.job && <p className="text-xs text-gray-500 font-medium">{apt.job}</p>}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-4 border-t border-gray-50 dark:border-gray-800 pt-4 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest leading-none">{t.monthlySubscription}</span>
                  {isEditing ? (
                    <input 
                      type="number"
                      className="w-24 px-3 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-lg font-black text-blue-600 dark:text-blue-400 text-left"
                      value={editForm.monthlyFee}
                      onChange={e => setEditForm({...editForm, monthlyFee: Number(e.target.value)})}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="font-black text-blue-600 dark:text-blue-400 text-lg leading-none transition-colors">{apt.monthlyFee} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                  )}
                </div>
                
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {isEditing ? (
                    <>
                      <button 
                        onClick={(e) => saveEditing(e, apt)}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-xs font-black shadow-lg shadow-blue-900/20"
                      >
                        حفظ
                      </button>
                      <button 
                        onClick={cancelEditing}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-black transition-colors"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <>
                      <div className={cn(
                        "flex-1 py-2 rounded-xl text-center text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm flex items-center justify-center gap-2",
                        isPaid ? "bg-green-600 text-white" : isPartial ? "bg-amber-500 text-white" : "bg-rose-600 text-white"
                      )}>
                        {isPaid ? <Check size={12} strokeWidth={4} /> : isPartial ? <Clock size={12} strokeWidth={3} /> : <AlertTriangle size={12} strokeWidth={3} />}
                        {isPaid ? (lang === 'ar' ? "تم التحصيل" : "Collected") : isPartial ? (lang === 'ar' ? "تحصيل جزئي" : "Partial") : t.unpaid}
                      </div>

                      {!isPaid && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickPay(apt.id, apt.unitNumber, apt.residentName, apt.monthlyFee);
                          }}
                          className="px-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95"
                          title={lang === 'ar' ? "دفع سريع" : "Quick Pay"}
                        >
                          <CreditCard size={12} /> {lang === 'ar' ? "دفع سريع" : "Quick Pay"}
                        </button>
                      )}

                      <button 
                        onClick={(e) => startEditing(e, apt)}
                        className="px-3 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-colors"
                      >
                        <SettingsIcon size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 shadow-inner transition-colors">
           <Building2 size={64} className="mb-4 opacity-10" />
           <p className="text-xl font-bold transition-colors">لا توجد نتائج تطابق بحثك</p>
           <button 
            onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}
            className="mt-4 text-blue-600 dark:text-blue-400 font-black text-sm hover:underline transition-colors"
           >
             إعادة تعيين المرشحات
           </button>
        </div>
      )}
    </div>
  );
}

function ApartmentDetailView({ apartment, settings, onBack, onRegisterPayment, onDelete, onUpdate, onResetDebt, lang, t }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState(apartment);
  
  // Filtering state
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("month_desc");

  const filteredPayments = useMemo(() => {
    let result = [...apartment.payments];

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter(p => {
        if (filterStatus === "paid") return p.amountPaid >= p.amountDue;
        if (filterStatus === "partial") return p.amountPaid > 0 && p.amountPaid < p.amountDue;
        if (filterStatus === "unpaid") return p.amountPaid === 0;
        return true;
      });
    }

    // Method filter
    if (filterMethod !== "all") {
      result = result.filter(p => p.paymentMethod === filterMethod);
    }

    // Date range filter
    if (startDate) {
      result = result.filter(p => p.month >= startDate);
    }
    if (endDate) {
      result = result.filter(p => p.month <= endDate);
    }

    return result.sort((a, b) => {
      if (sortBy === "month_desc") return b.month.localeCompare(a.month);
      if (sortBy === "month_asc") return a.month.localeCompare(b.month);
      if (sortBy === "amount_desc") return b.amountPaid - a.amountPaid;
      if (sortBy === "amount_asc") return a.amountPaid - b.amountPaid;
      return 0;
    });
  }, [apartment.payments, filterStatus, filterMethod, startDate, endDate, sortBy]);

  const totalPaid = apartment.payments.reduce((acc: number, p: any) => acc + p.amountPaid, 0);

  const handleSave = () => {
    onUpdate(editForm);
    setIsEditing(false);
  };

  return (
    <div className="space-y-8 pb-12 transition-colors">
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm"
              onClick={() => setShowResetConfirm(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl z-10 overflow-hidden text-right p-8 space-y-6 transition-colors border border-gray-100 dark:border-gray-800"
            >
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <RotateCcw size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">{lang === 'ar' ? 'تأكيد تصفير المديونية' : 'Confirm Debt Reset'}</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {lang === 'ar' ? 'هل أنت متأكد من تصفير مديونية الشقة' : 'Are you sure you want to reset debt for apartment'} <span className="font-bold text-gray-800 dark:text-gray-200">#{apartment.unitNumber}</span>؟
                  <br />
                  <span className="text-sm font-medium text-red-500 dark:text-red-400">{lang === 'ar' ? 'سيتم مسح سجل جميع المدفوعات السابقة نهائياً.' : 'This will permanently delete all previous payment history.'}</span>
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => {
                    onResetDebt();
                    setShowResetConfirm(false);
                  }}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-2xl font-black hover:bg-orange-600 transition-all shadow-lg shadow-orange-900/20"
                >
                  {lang === 'ar' ? 'نعم، تصفير الآن' : 'Yes, Reset Now'}
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-3 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl z-10 overflow-hidden text-right p-8 space-y-6 transition-colors border border-gray-100 dark:border-gray-800"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">
                  {lang === 'ar' ? 'تأكيد حذف الشقة' : 'Confirm Apartment Deletion'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {lang === 'ar' 
                    ? `هل أنت متأكد من حذف الشقة رقم ${apartment.unitNumber} الخاصة بـ ${apartment.residentName} نهائياً؟` 
                    : `Are you sure you want to permanently delete apartment #${apartment.unitNumber} belonging to ${apartment.residentName}?`}
                  <br />
                  <span className="text-sm font-medium text-red-500 dark:text-red-400">
                    {lang === 'ar' ? 'سيتم مسح جميع سجلات هذه الشقة ولا يمكن التراجع عن هذا الإجراء.' : 'All records for this apartment will be erased and this action cannot be undone.'}
                  </span>
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => {
                    onDelete(apartment.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
                >
                  {lang === 'ar' ? 'نعم، حذف الآن' : 'Yes, Delete Now'}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-3 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors self-start md:self-auto">
          {lang === 'ar' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
          <span className="font-bold">{t.back}</span>
        </button>
        <div className="flex flex-wrap gap-2 md:gap-3 justify-center">
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 md:px-6 py-2 bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/20 rounded-xl font-bold shadow-sm hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-all text-xs md:text-sm"
          >
            <RotateCcw size={18} /> {t.resetDebt}
          </button>
          <button 
            onClick={() => exportApartmentToExcel(apartment)}
            className="flex items-center gap-2 px-6 py-2 bg-green-50 text-green-600 border border-green-100 rounded-xl font-bold shadow-sm hover:bg-green-100 transition-all"
          >
            <Download size={20} /> Excel
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-all font-mono"
          >
            <FileText size={20} /> PDF (Print)
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-6 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold shadow-sm hover:bg-red-100 transition-all"
          >
            <Trash2 size={20} /> {lang === 'ar' ? 'حذف الشقة' : 'Delete Apt'}
          </button>
          <button 
            onClick={onRegisterPayment}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all"
          >
            <Plus size={20} /> {t.registerPayment}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Info Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors relative">
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-6 left-6 p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-2xl transition-all shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 z-10"
              title="تعديل البيانات"
            >
              <SettingsIcon size={20} />
            </button>
          )}

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full -ml-12 -mb-12 blur-xl" />
            
            <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center mx-auto mb-6 font-black text-4xl shadow-xl border border-white/30 relative z-10">
              {apartment.unitNumber}
            </div>
            {isEditing ? (
              <div className="space-y-4 text-right">
                <InputGroup label={lang === 'ar' ? "اسم الساكن" : "Resident Name"} value={editForm.residentName} onChange={(v: string) => setEditForm({...editForm, residentName: v})} className="bg-white/10 border-white/20 text-white placeholder-white/50" />
              </div>
            ) : (
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-1">{apartment.residentName}</h3>
                <div className="flex items-center justify-center gap-2 text-blue-100/80 font-bold text-sm">
                  <Building2 size={14} />
                  <span>{lang === 'ar' ? 'الطابق' : 'Floor'} {apartment.floor}</span>
                  <span className="w-1 h-1 bg-blue-100/40 rounded-full" />
                  <span>{lang === 'ar' ? 'ساكن' : 'Resident'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 space-y-10">
            {isEditing ? (
               <div className="space-y-5">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputGroup label={lang === 'ar' ? "رقم الهاتف" : "Phone Number"} value={editForm.phone} onChange={(v: string) => setEditForm({...editForm, phone: v})} />
                    <InputGroup label={lang === 'ar' ? "رقم واتساب" : "WhatsApp Number"} value={editForm.whatsapp || ""} onChange={(v: string) => setEditForm({...editForm, whatsapp: v})} />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputGroup label={lang === 'ar' ? "الوظيفة" : "Job/Occupation"} value={editForm.job || ""} onChange={(v: string) => setEditForm({...editForm, job: v})} />
                    <InputGroup label={lang === 'ar' ? "الرقم القومي" : "National ID"} value={editForm.nationalId || ""} onChange={(v: string) => setEditForm({...editForm, nationalId: v})} />
                 </div>
                 <InputGroup label={lang === 'ar' ? "الاشتراك الشهري" : "Monthly Fee"} value={editForm.monthlyFee} type="number" onChange={(v: string) => setEditForm({...editForm, monthlyFee: Number(v)})} />
                 <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider pr-1">
                      {lang === 'ar' ? 'الملاحظات' : 'Notes'}
                    </label>
                    <textarea 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
                      value={editForm.notes || ""}
                      onChange={e => setEditForm({...editForm, notes: e.target.value})}
                    />
                 </div>
                 <div className="flex gap-3 pt-4">
                    <button onClick={handleSave} className="flex-2 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all">
                      {lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
                    </button>
                    <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-4 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      {t.cancel}
                    </button>
                 </div>
               </div>
            ) : (
              <>
                {/* Contact Section */}
                <section>
                  <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Phone size={12} className="text-blue-500" />
                    {lang === 'ar' ? 'معلومات الاتصال' : 'Contact Details'}
                  </h4>
                  <div className="space-y-1">
                    <DetailRow icon={<Phone size={16} />} label={lang === 'ar' ? "الهاتف" : "Phone"} value={apartment.phone} />
                    {apartment.whatsapp && <DetailRow icon={<MessageSquare size={16} />} label={lang === 'ar' ? "واتساب" : "WhatsApp"} value={apartment.whatsapp} />}
                  </div>
                </section>

                {/* Financial Overview */}
                <section>
                  <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Wallet size={12} className="text-green-500" />
                    {lang === 'ar' ? 'الملف المالي' : 'Financial Profile'}
                  </h4>
                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800/50 space-y-1">
                    <DetailRow icon={<CreditCard size={16} />} label={lang === 'ar' ? "الاشتراك الشهري" : "Monthly Subscription"} value={`${apartment.monthlyFee} ج.م`} color="text-blue-600 dark:text-blue-400" border={false} />
                    <DetailRow icon={<CheckCircle2 size={16} />} label={lang === 'ar' ? "إجمالي المسدد" : "Total Paid"} value={`${totalPaid} ج.م`} color="text-green-600 dark:text-green-400" border={false} />
                    {settings.lateFeeEnabled && (
                      <>
                        <DetailRow icon={<AlertCircle size={16} />} label={lang === 'ar' ? "غرامات متراكمة" : "Accumulated Late Fees"} value={`${calculateLateFees(apartment, settings)} ج.م`} color="text-orange-600 dark:text-orange-400" border={false} />
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                          <DetailRow 
                            icon={<Activity size={16} />}
                            label={lang === 'ar' ? "صافي المديونية" : "Net Debt"} 
                            value={`${Math.max(0, (apartment.monthlyFee * (Math.max(1, differenceInCalendarMonths(new Date(), parseISO(apartment.moveInDate)) + 1))) - totalPaid) + calculateLateFees(apartment, settings)} ج.م`} 
                            color="text-red-600 dark:text-red-500 font-black text-lg" 
                            border={false}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* Profile Section */}
                <section>
                  <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <User size={12} className="text-indigo-500" />
                    {lang === 'ar' ? 'بيانات الساكن' : 'Resident Profile'}
                  </h4>
                  <div className="space-y-1">
                    {apartment.job && <DetailRow icon={<Briefcase size={16} />} label={t.job || (lang === 'ar' ? "الوظيفة" : "Job")} value={apartment.job} />}
                    {apartment.nationalId && <DetailRow icon={<IdCard size={16} />} label={lang === 'ar' ? "الرقم القومي" : "National ID"} value={apartment.nationalId} />}
                    <DetailRow icon={<Calendar size={16} />} label={lang === 'ar' ? "تاريخ السكن" : "Move-in Date"} value={apartment.moveInDate} />
                  </div>
                </section>

                {/* Notes Section */}
                <section className="pt-4">
                  <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <FileText size={12} className="text-gray-400" />
                    {lang === 'ar' ? 'ملاحظات إضافية' : 'Additional Notes'}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/50 min-h-[80px]">
                    {apartment.notes || (lang === 'ar' ? "لا توجد ملاحظات مسجلة لهذه الوحدة" : "No notes recorded for this unit")}
                  </p>
                </section>
              </>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
          <div className="p-6 border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <BarChart3 size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t.paymentHistory}</h3>
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 px-3 py-1 rounded-full transition-colors">{lang === 'ar' ? 'إجمالي' : 'Total'} {filteredPayments.length} {lang === 'ar' ? 'شهر' : 'months'}</span>
          </div>

          <div className="p-6 border-b border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 transition-colors">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider pr-1 transition-colors">{t.status}</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200 transition-all cursor-pointer"
              >
                <option value="all">{lang === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="paid">{t.paid}</option>
                <option value="partial">{t.partial}</option>
                <option value="unpaid">{t.unpaid}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider pr-1 transition-colors">{t.paymentMethod}</label>
              <select 
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200 transition-all cursor-pointer"
              >
                <option value="all">{lang === 'ar' ? 'جميع الطرق' : 'All Methods'}</option>
                {Object.values(PaymentMethod).map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider pr-1 transition-colors">{lang === 'ar' ? 'من شهر' : 'From Month'}</label>
              <input 
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider pr-1 transition-colors">{lang === 'ar' ? 'إلى شهر' : 'To Month'}</label>
              <input 
                type="month"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider pr-1 transition-colors">{t.sortBy}</label>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200 transition-all cursor-pointer"
              >
                <option value="month_desc">{lang === 'ar' ? 'الشهر (الأحدث)' : 'Month (Newest)'}</option>
                <option value="month_asc">{lang === 'ar' ? 'الشهر (الأقدم)' : 'Month (Oldest)'}</option>
                <option value="amount_desc">{lang === 'ar' ? 'المبلغ (الأعلى)' : 'Amount (Highest)'}</option>
                <option value="amount_asc">{lang === 'ar' ? 'المبلغ (الأقل)' : 'Amount (Lowest)'}</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 transition-colors">
                  <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">{t.date}</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">{t.amountDue}</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">{lang === 'ar' ? 'المبلغ المدفوع' : 'Amount Paid'}</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">{lang === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">{t.reason}</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">{t.paymentMethod}</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">{t.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 transition-colors">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 transition-colors">{format(parseISO(p.month + "-01"), "MMMM yyyy", { locale: ar })}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium transition-colors">{p.amountDue} ج.م</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-black transition-colors">{p.amountPaid} ج.م</td>
                    <td className={cn(
                      "px-6 py-4 font-black transition-colors",
                      (p.amountDue - p.amountPaid) > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-600"
                    )}>
                      {Math.max(0, p.amountDue - p.amountPaid)} ج.م
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs font-bold transition-colors">{p.reason || "اشتراك شهري"}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-medium transition-colors">{p.paymentMethod}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[10px] px-2 py-1 rounded-full font-bold transition-colors",
                        p.amountPaid >= p.amountDue 
                          ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" 
                          : p.amountPaid > 0 
                            ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400" 
                            : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                      )}>
                        {p.amountPaid >= p.amountDue ? "كامل" : p.amountPaid > 0 ? "جزئي" : "متأخر"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 dark:text-gray-600 bg-gray-50/20 dark:bg-gray-800/20 transition-colors">لا توجد مدفوعات مسجلة بعد</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, color = "text-gray-700", border = true }: any) {
  return (
    <div className={cn(
      "flex justify-between items-center py-3 group transition-all",
      border && "border-b border-gray-50 dark:border-gray-800 border-dashed last:border-0"
    )}>
      <div className="flex items-center gap-3">
        {icon && <span className="text-gray-400 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">{icon}</span>}
        <span className="text-gray-400 dark:text-gray-500 text-xs font-bold transition-colors">{label}</span>
      </div>
      <span className={cn(
        "font-black text-sm text-right transition-colors", 
        color.includes("text-gray-700") ? "text-gray-800 dark:text-gray-200" : color
      )}>
        {value}
      </span>
    </div>
  );
}

function MonthlyReportView({ apartments, emergencyFund, currentMonth, setCurrentMonth, settings, lang, t }: any) {
  const data = apartments.map((apt: Apartment) => {
    const p = apt.payments.find(p => p.month === currentMonth);
    const due = apt.monthlyFee;
    const paid = p ? p.amountPaid : 0;
    const remains = Math.max(0, due - paid);
    return { apt, due, paid, remains, method: p ? p.paymentMethod : "-", date: p?.paymentDate ? p.paymentDate : "-" };
  });

  const totals = data.reduce((acc: any, val: any) => ({
    due: acc.due + val.due,
    paid: acc.paid + val.paid,
    remains: acc.remains + val.remains
  }), { due: 0, paid: 0, remains: 0 });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 transition-colors">الكشف الشهري</h2>
          <div className="flex items-center gap-4 mt-4">
            <input 
              type="month" 
              className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 dark:text-gray-100 transition-colors"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
            />
            <div className="text-sm text-gray-400 dark:text-gray-500 font-bold transition-colors">عرض بيانات شهر {format(parseISO(currentMonth + "-01"), "MMMM yyyy", { locale: ar })}</div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => exportToExcel(apartments, currentMonth, settings)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
          >
            <Download size={20} /> Excel
          </button>
          <button 
            onClick={() => exportToPDF(apartments, currentMonth, settings)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-900/20 hover:bg-red-700 transition-all"
          >
            <FileText size={20} /> PDF
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-8 border-b border-gray-50 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/30 transition-colors">
          <div className="flex justify-between items-start">
            <div className="text-right">
               <h1 className="text-2xl font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter transition-colors">{settings.buildingName}</h1>
               <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 transition-colors">{settings.address}</p>
               <p className="text-gray-400 dark:text-gray-500 text-xs transition-colors">اتحاد ملاك العقار</p>
            </div>
            <div className="text-left bg-blue-600/5 dark:bg-blue-400/5 p-4 rounded-2xl border border-blue-600/10 dark:border-blue-400/10 transition-colors">
               <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black block uppercase mb-1">تاريخ الكشف</span>
               <span className="text-xl font-black text-blue-900 dark:text-blue-100 transition-colors">{format(new Date(), "dd / MM / yyyy")}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            <ReportStat label="إجمالي المطلوب" value={totals.due} color="text-gray-800 dark:text-gray-100" />
            <ReportStat label="إجمالي المحصل" value={totals.paid} color="text-green-600 dark:text-green-400" />
            <ReportStat label="إجمالي المتأخرات" value={totals.remains} color="text-red-500 dark:text-red-400" />
            <ReportStat label={lang === 'ar' ? 'صندوق الطوارئ' : 'Emergency Fund'} value={emergencyFund.balance} color="text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors">
                  <th className="px-6 py-4">رقم الشقة</th>
                  <th className="px-6 py-4">اسم الساكن</th>
                  <th className="px-6 py-4">المستحق</th>
                  <th className="px-6 py-4">المدفوع</th>
                  <th className="px-6 py-4">المتبقي</th>
                  <th className="px-6 py-4">الطريقة</th>
                  <th className="px-6 py-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 transition-colors">
                {data.map((row: any) => (
                  <tr key={row.apt.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-black dark:text-gray-100 transition-colors">#{row.apt.unitNumber}</td>
                    <td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200 transition-colors">{row.apt.residentName}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 transition-colors">{row.due} ج.م</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-bold transition-colors">{row.paid} ج.م</td>
                    <td className="px-6 py-4 text-red-500 dark:text-red-400 font-bold transition-colors">{row.remains} ج.م</td>
                    <td className="px-6 py-4 text-gray-400 dark:text-gray-500 text-sm font-medium transition-colors">{row.method}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[10px] px-2 py-1 rounded-full font-bold transition-colors",
                        row.remains === 0 
                          ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" 
                          : row.paid > 0 
                            ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400" 
                            : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                      )}>
                        {row.remains === 0 ? "تم السداد" : row.paid > 0 ? "سداد جزئي" : "مطلوب السداد"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
        
        <div className="p-8 border-t border-gray-50 dark:border-gray-800 bg-gray-50/20 dark:bg-gray-800/20 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-right transition-colors">
           <div className="text-gray-400 dark:text-gray-500 text-sm max-w-md italic transition-colors">
             * يتم مراجعة جميع الحسابات دورياً واعتمادها من قبل اتحاد ملاك {settings.buildingName}. أي اختلاف يرجى مراجعة الإدارة.
           </div>
           <div>
             <span className="text-xs text-gray-400 dark:text-gray-500 block mb-2 font-bold uppercase transition-colors">توقيع مدير العقار</span>
             <div className="w-48 h-12 border-b-2 border-gray-300 dark:border-gray-600 mx-auto md:mr-0 transition-colors"></div>
             <p className="mt-2 font-bold text-gray-700 dark:text-gray-200 transition-colors">{settings.managerName}</p>
           </div>
        </div>
      </div>
    </div>
  );
}

function ReportStat({ label, value, color }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center md:items-start">
      <span className="text-[10px] text-gray-400 font-black uppercase mb-1">{label}</span>
      <span className={cn("text-2xl font-black", color)}>{value} ج.م</span>
    </div>
  );
}

function DebtsReportView({ apartments, settings, onResetAllDebts, lang, t }: any) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Simple debt calculation logic for the report
  const debitedApts = apartments.map((apt: any) => {
    const totalPaid = apt.payments.reduce((acc: number, p: any) => acc + p.amountPaid, 0);
    const moveInDate = parseISO(apt.moveInDate);
    const monthsCount = Math.max(1, differenceInCalendarMonths(new Date(), moveInDate) + 1);
    const expected = apt.monthlyFee * monthsCount;
    const baseDebt = Math.max(0, expected - totalPaid);
    const lateFee = calculateLateFees(apt, settings);
    const totalDebt = baseDebt + lateFee;
    
    const lastPayment = apt.payments.length > 0 
      ? format(parseISO([...apt.payments].sort((a: any, b: any) => b.month.localeCompare(a.month))[0].month + "-01"), "MMMM yyyy", { locale: ar })
      : "لا يوجد";

    return { 
      apt, 
      baseDebt,
      lateFee,
      totalDebt, 
      unpaidMonths: Math.ceil(baseDebt / (apt.monthlyFee || 1)), 
      lastPayment 
    };
  }).filter((d: any) => d.totalDebt > 0);

  const totalBuildingDebt = debitedApts.reduce((acc: number, d: any) => acc + d.totalDebt, 0);

  const sendWhatsApp = (apt: any, debt: number) => {
    let phone = apt.phone.replace(/\D/g, '');
    if (phone.startsWith('0') && phone.length === 11) {
      phone = '2' + phone;
    }
    const msg = `السلام عليكم أ/ ${apt.residentName}، نود تذكيركم بوجود مديونية متأخرة لشقة رقم ${apt.unitNumber} بمبلغ ${debt} ج.م. يرجى التكرم بالسداد لتسيير أعمال الصيانة والخدمات بالعقار. شاكرين تعاونكم. إدارة ${settings.buildingName}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-8 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 transition-colors">تقرير المديونيات</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">كشف بجميع الشقق التي عليها مستحقات مالية متأخرة</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="px-6 py-4 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
          >
            <RotateCcw size={18} /> تصفير جميع المديونيات
          </button>

          <AnimatePresence>
            {showResetConfirm && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" dir="rtl">
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm"
                  onClick={() => setShowResetConfirm(false)}
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl z-10 overflow-hidden text-right p-8 space-y-6 transition-colors border border-gray-100 dark:border-gray-800"
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Trash2 size={32} />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">تصفير الحسابات بالكامل</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      هل أنت متاكد من مسح جميع السجلات المالية الحالية؟ 
                      <br />
                      <span className="text-sm font-medium text-red-500 dark:text-red-400">هذا الإجراء سيمسح جميع المدفوعات المسجلة، المصروفات، ورصيد صندوق الطوارئ لبدء باقة حسابات جديدة.</span>
                    </p>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => {
                        onResetAllDebts();
                        setShowResetConfirm(false);
                      }}
                      className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
                    >
                      نعم، تصفير الكل
                    </button>
                    <button 
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-3 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20 flex items-center gap-6 transition-colors">
            <div>
              <span className="text-[10px] text-red-600 dark:text-red-400 font-black uppercase block mb-1">إجمالي مديونية العقار</span>
              <span className="text-2xl font-black text-red-700 dark:text-red-500 transition-colors">{totalBuildingDebt} ج.م</span>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 transition-colors">
              <AlertCircle size={28} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs font-black uppercase border-b border-gray-100 dark:border-gray-800 transition-colors">
                <th className="px-6 py-4">الشقة</th>
                <th className="px-6 py-4">الساكن</th>
                <th className="px-6 py-4">إجمالي المديونية</th>
                <th className="px-6 py-4">عدد الأشهر</th>
                <th className="px-6 py-4">آخر دفعة</th>
                <th className="px-6 py-4">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 transition-colors">
              {debitedApts.map((d: any) => (
                <tr key={d.apt.id} className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                  <td className="px-6 py-4 font-black text-gray-800 dark:text-gray-100 transition-colors">#{d.apt.unitNumber}</td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-700 dark:text-gray-200 transition-colors">{d.apt.residentName}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium transition-colors">{d.apt.phone}</p>
                  </td>
                  <td className="px-6 py-4 transition-colors">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 dark:text-red-400 font-black">{d.totalDebt.toLocaleString()} ج.م</span>
                        {d.lateFee > 0 && (
                          <span className="text-[9px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-lg font-black border border-orange-100 dark:border-orange-900/20" title="غرامة تأخير">
                            +{d.lateFee.toLocaleString()} غرامة
                          </span>
                        )}
                        {totalBuildingDebt > 0 && (
                          <span className="text-[10px] bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-lg font-black border border-red-100 dark:border-red-900/20">
                            {((d.totalDebt / totalBuildingDebt) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      {totalBuildingDebt > 0 && (
                        <div className="w-full max-w-[120px] bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(d.totalDebt / totalBuildingDebt) * 100}%` }}
                            transition={{ duration: 1, ease: "circOut" }}
                            className="h-full bg-red-500 rounded-full"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-bold transition-colors">{d.unpaidMonths}</td>
                  <td className="px-6 py-4 text-gray-400 dark:text-gray-500 text-sm transition-colors">{d.lastPayment}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => sendWhatsApp(d.apt, d.totalDebt)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl text-xs font-black hover:bg-[#128C7E] transition-all shadow-lg shadow-green-500/20 active:scale-95"
                    >
                      <MessageCircle size={16} fill="currentColor" fillOpacity={0.2} /> 
                      تذكير واتساب
                    </button>
                  </td>
                </tr>
              ))}
              {debitedApts.length === 0 && (
                <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-600 bg-gray-50/20 dark:bg-gray-800/10 transition-colors">لا توجد مديونيات حالية للعقار. كل شيء ممتاز!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ settings, onSave, onResetDebts, onBulkUpdateFees, onImportExcel, onExportAll, onClear, lang, t }: any) {
  const [form, setForm] = useState(settings);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFeeUpdateConfirm, setShowFeeUpdateConfirm] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await importFromExcel(file);
        onImportExcel(data);
      } catch (err) {
        alert("خطأ في قراءة ملف Excel");
      }
    }
  };

  return (
    <div className="space-y-8 max-w-4xl transition-colors">
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" dir="rtl">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm"
              onClick={() => setShowResetConfirm(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl z-10 overflow-hidden text-right p-8 space-y-6 transition-colors border border-gray-100 dark:border-gray-800"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">تصفير الحسابات بالكامل</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  هل أنت متاكد من مسح جميع السجلات المالية الحالية؟ 
                  <br />
                  <span className="text-sm font-medium text-red-500 dark:text-red-400">هذا الإجراء سيمسح جميع المدفوعات المسجلة، المصروفات، ورصيد صندوق الطوارئ لبدء دورة مالية جديدة.</span>
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => {
                    onResetDebts();
                    setShowResetConfirm(false);
                  }}
                  className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
                >
                  نعم، تصفير الكل
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-3 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showFeeUpdateConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" dir="rtl">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm"
              onClick={() => setShowFeeUpdateConfirm(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl z-10 overflow-hidden text-right p-8 space-y-6 transition-colors border border-gray-100 dark:border-gray-800"
            >
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <RotateCcw size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">تحديث قيمة الاشتراك للكل</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  هل أنت متأكد من تغيير قيمة الاشتراك لجميع الشقق المسجلة إلى <span className="font-bold text-amber-600 underline">{form.defaultMonthlyFee} ج.م</span>؟
                  <br />
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">سيتم تحديث قيمة الاشتراك الشهري لجميع الشقق الحالية فوراً.</span>
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => {
                    onBulkUpdateFees(Number(form.defaultMonthlyFee));
                    setShowFeeUpdateConfirm(false);
                  }}
                  className="flex-1 bg-amber-500 text-white py-3 rounded-2xl font-black hover:bg-amber-600 transition-all shadow-lg shadow-amber-900/20"
                >
                  نعم، تحديث الكل
                </button>
                <button 
                  onClick={() => setShowFeeUpdateConfirm(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-3 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div>
        <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 transition-colors">الإعدادات</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">تخصيص بيانات العقار والإدارة وتصدير البيانات الاحتياطية</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6 transition-colors font-mono">
          <h3 className="text-lg font-bold border-b border-gray-50 dark:border-gray-800 pb-4 mb-4 text-gray-800 dark:text-gray-100 transition-colors">بيانات العقار</h3>
          <InputGroup label="اسم العمارة" value={form.buildingName} onChange={(v: string) => setForm({...form, buildingName: v})} />
          <InputGroup label="عنوان العقار" value={form.address} onChange={(v: string) => setForm({...form, address: v})} />
          <InputGroup label="الاشتراك الافتراضي" value={form.defaultMonthlyFee} type="number" onChange={(v: string) => setForm({...form, defaultMonthlyFee: Number(v)})} />
        </div>

        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6 transition-colors font-mono">
          <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 pb-4 mb-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 transition-colors">إعدادات غرامة التأخير</h3>
            <button 
              onClick={() => setForm({...form, lateFeeEnabled: !form.lateFeeEnabled})}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                form.lateFeeEnabled ? "bg-red-500" : "bg-gray-300 dark:bg-gray-700"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                form.lateFeeEnabled ? "left-1" : "left-7"
              )} />
            </button>
          </div>
          
          {form.lateFeeEnabled && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-4 overflow-hidden"
            >
              <div className="flex gap-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button 
                  onClick={() => setForm({...form, lateFeeType: 'percentage'})}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-bold transition-all", 
                    form.lateFeeType === 'percentage' 
                      ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400" 
                      : "text-gray-400 dark:text-gray-500 hover:text-gray-600"
                  )}
                >نسبة مئوية (%)</button>
                <button 
                  onClick={() => setForm({...form, lateFeeType: 'value'})}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-bold transition-all", 
                    form.lateFeeType === 'value' 
                      ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400" 
                      : "text-gray-400 dark:text-gray-500 hover:text-gray-600"
                  )}
                >قيمة ثابتة (ج.م)</button>
              </div>
              <InputGroup 
                label={form.lateFeeType === 'percentage' ? "النسبة المئوية (أسلوب تراكمي أسبوعي)" : "الغرامة الثابتة (لكل أسبوع تأخير)"} 
                value={form.lateFeeAmount} 
                type="number" 
                onChange={(v: string) => setForm({...form, lateFeeAmount: Number(v)})} 
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed italic">
                * يتم احتساب الغرامة لكل أسبوع تأخير يمر على تاريخ استحقاق كل شهر (نهاية الشهر).
              </p>
            </motion.div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6 transition-colors font-mono">
          <h3 className="text-lg font-bold border-b border-gray-50 dark:border-gray-800 pb-4 mb-4 text-gray-800 dark:text-gray-100 transition-colors">بيانات الإدارة</h3>
          <InputGroup label="اسم المدير" value={form.managerName} onChange={(v: string) => setForm({...form, managerName: v})} />
          <InputGroup label="تليفون المدير" value={form.managerPhone} onChange={(v: string) => setForm({...form, managerPhone: v})} />
          <InputGroup label="رقم حساب الاتحاد" value={form.unionAccountNumber} onChange={(v: string) => setForm({...form, unionAccountNumber: v})} />
        </div>
      </div>

      {/* Advanced Actions */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-8 transition-colors">
        <h3 className="text-lg font-bold border-b border-gray-50 dark:border-gray-800 pb-4 mb-4 text-gray-800 dark:text-gray-100 transition-colors">عمليات متقدمة</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">استيراد بيانات خارجية</h4>
            <p className="text-sm text-blue-600 dark:text-blue-400 mb-4 font-medium">استيراد سجلات المدفوعات من ملف Excel قديم (رقم الشقة، الشهر، المدفوع)</p>
            <label className="inline-block px-6 py-2 bg-blue-600 text-white rounded-xl font-bold cursor-pointer hover:bg-blue-700 transition-all text-sm">
              <Download size={16} className="inline ml-2" /> اختيار ملف Excel
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
            <h4 className="font-bold text-amber-800 dark:text-amber-300 mb-2">تحديث قيمة الاشتراك للكل</h4>
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-4 font-medium">تطبيق قيمة "الاشتراك الافتراضي" ({form.defaultMonthlyFee} ج.م) على جميع الشقق الحالية في خطوة واحدة</p>
            <button 
              onClick={() => setShowFeeUpdateConfirm(true)}
              className="px-6 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all text-sm"
            >
              <RotateCcw size={16} className="inline ml-2" /> تطبيق على جميع الشقق
            </button>
          </div>

          <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
            <h4 className="font-bold text-red-800 dark:text-red-300 mb-2">تصفير الحسابات بالكامل</h4>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4 font-medium">مسح جميع سجلات المدفوعات، المصروفات، وصندوق الطوارئ لبدء محاسبة جديدة</p>
            <button 
              onClick={() => setShowResetConfirm(true)}
              className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all text-sm"
            >
              <Trash2 size={16} className="inline ml-2" /> تصفير الكل الآن
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900 dark:bg-gray-800 text-white p-6 rounded-2xl gap-6 transition-colors font-mono">
         <div className="flex gap-3">
           <button 
            onClick={() => onSave(form)}
            className="px-8 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/40"
           >
             حفظ التغييرات
           </button>
           <button 
            onClick={onExportAll}
            className="px-8 py-3 bg-gray-800 dark:bg-gray-700 rounded-xl font-bold hover:bg-gray-700 transition-all"
           >
             تصدير قاعدة البيانات (Excel)
           </button>
         </div>
         <button 
          onClick={onClear}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors font-bold"
         >
           <Trash2 size={20} /> مسح جميع البيانات
         </button>
      </div>
    </div>
  );
}

function AddApartmentView({ onSave, onCancel, lang, t }: any) {
  const [form, setForm] = useState({
    unitNumber: "",
    residentName: "",
    phone: "",
    whatsapp: "",
    floor: 0,
    monthlyFee: 200,
    job: "",
    nationalId: "",
    moveInDate: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unitNumber || !form.residentName) {
      alert("يرجى إدخال رقم الشقة واسم الساكن");
      return;
    }
    onSave({
      ...form,
      id: "apt_" + Math.random().toString(36).substr(2, 9),
      isOccupied: true,
      payments: []
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 transition-colors">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 transition-colors">إضافة شقة جديدة</h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 font-bold transition-colors">
          إلغاء
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 space-y-6 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-6">
             <h3 className="text-lg font-bold border-b border-gray-50 dark:border-gray-800 pb-2 mb-4 text-gray-800 dark:text-gray-100 transition-colors">البيانات الأساسية</h3>
             <InputGroup label="رقم الشقة" value={form.unitNumber} onChange={(v: string) => setForm({...form, unitNumber: v})} />
             <InputGroup label="اسم الساكن / المالك" value={form.residentName} onChange={(v: string) => setForm({...form, residentName: v})} />
             <div className="grid grid-cols-2 gap-4">
               <InputGroup label="الدور" value={form.floor} type="number" onChange={(v: string) => setForm({...form, floor: Number(v)})} />
               <InputGroup label="الاشتراك الشهري" value={form.monthlyFee} type="number" onChange={(v: string) => setForm({...form, monthlyFee: Number(v)})} />
             </div>
             <InputGroup label="تاريخ السكن / الاستلام" value={form.moveInDate} type="date" onChange={(v: string) => setForm({...form, moveInDate: v})} />
           </div>

           <div className="space-y-6">
             <h3 className="text-lg font-bold border-b border-gray-50 dark:border-gray-800 pb-2 mb-4 text-gray-800 dark:text-gray-100 transition-colors">بيانات التواصل والبيانات الشخصية</h3>
             <InputGroup label="رقم الهاتف" value={form.phone} onChange={(v: string) => setForm({...form, phone: v})} />
             <InputGroup label="رقم واتساب" value={form.whatsapp} onChange={(v: string) => setForm({...form, whatsapp: v})} />
             <InputGroup label="الوظيفة / التخصص" value={form.job} onChange={(v: string) => setForm({...form, job: v})} />
             <InputGroup label="الرقم القومي" value={form.nationalId} onChange={(v: string) => setForm({...form, nationalId: v})} />
           </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black text-gray-400 dark:text-gray-500 tracking-wider pr-1 transition-colors">ملاحظات إضافية</label>
          <textarea 
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 dark:text-gray-100 transition-all h-32"
            value={form.notes}
            onChange={(e) => setForm({...form, notes: e.target.value})}
          />
        </div>

        <div className="pt-6 border-t border-gray-50 dark:border-gray-800 flex justify-end transition-colors">
           <button 
            type="submit"
            className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/40"
           >
             إضافة الشقة للقائمة
           </button>
        </div>
      </form>
    </div>
  );
}

function ExpensesView({ expenses, apartments, onAdd, onDelete, lang, t }: any) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [financeTab, setFinanceTab] = useState<'expenses' | 'revenue'>('expenses');
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    reason: "",
    category: "صيانة",
    notes: ""
  });

  const categories = ["صيانة", "كهرباء", "مياه", "حراسة", "نظافة", "أخرى"];

  const allRevenue = useMemo(() => {
    const revs: any[] = [];
    apartments.forEach((apt: Apartment) => {
      apt.payments.forEach(p => {
        revs.push({
          ...p,
          aptId: apt.id,
          unitNumber: apt.unitNumber,
          residentName: apt.residentName
        });
      });
    });
    return revs.sort((a, b) => new Date(b.paymentDate || b.month).getTime() - new Date(a.paymentDate || a.month).getTime());
  }, [apartments]);

  const totalExpenses = expenses.reduce((acc: number, e: any) => acc + e.amount, 0);
  const totalRevenue = allRevenue.reduce((acc: number, p: any) => acc + p.amountPaid, 0);

  const categoryData = useMemo(() => {
    const data: any[] = [];
    categories.forEach(cat => {
      const amount = expenses
        .filter((e: any) => e.category === cat)
        .reduce((sum: number, e: any) => sum + e.amount, 0);
      if (amount > 0) {
        data.push({ name: cat, value: amount });
      }
    });
    return data;
  }, [expenses, categories]);

  const trendData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStr = format(monthDate, "yyyy-MM");
      const monthLabel = format(monthDate, "MMM", { locale: ar });
      
      const entry: any = { name: monthLabel };
      categories.forEach(cat => {
        entry[cat] = expenses
          .filter((e: any) => {
            const expenseCat = e.category || "أخرى";
            return e.date.startsWith(monthStr) && expenseCat === cat;
          })
          .reduce((sum: number, e: any) => sum + e.amount, 0);
      });
      data.push(entry);
    }
    return data;
  }, [expenses, categories]);

  const timelineData = useMemo(() => {
    if (expenses.length === 0) return [];
    
    // Sort by date to show timeline evolution correctly
    const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
    let runningTotal = 0;
    
    // We want to show the evolution point by point
    const points = sorted.map((e) => {
      runningTotal += e.amount;
      return {
        date: e.date,
        amount: e.amount,
        total: runningTotal,
        displayDate: format(parseISO(e.date), "dd MMM", { locale: ar }),
        reason: e.reason
      };
    });

    // Add a starting point of 0 to make the chart look nice from the beginning
    const firstDate = sorted[0].date;
    const initialPoint = {
      date: firstDate,
      amount: 0,
      total: 0,
      displayDate: "",
      reason: "البداية"
    };

    return [initialPoint, ...points].slice(-31); // Show last 30 expenses + baseline
  }, [expenses]);

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason || form.amount <= 0) {
      alert("يرجى إدخال سبب المصروف والمبلغ");
      return;
    }
    onAdd({
      ...form,
      id: "exp_" + Math.random().toString(36).substr(2, 9)
    });
    setForm({
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      reason: "",
      category: "صيانة",
      notes: ""
    });
    setShowAddForm(false);
  };

  return (
    <div className="space-y-8 pb-12 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 transition-colors">{lang === 'ar' ? 'الحسابات والمالية' : 'Accounts & Finance'}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">{lang === 'ar' ? 'سجل المصروفات والإيرادات' : 'Expenses and revenues log'}</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/20 flex items-center gap-6 flex-1 md:flex-none transition-colors">
             <div>
               <span className="text-[10px] text-green-600 dark:text-green-400 font-black uppercase block mb-1">إجمالي الإيرادات</span>
               <span className="text-2xl font-black text-green-700 dark:text-green-500 transition-colors">{totalRevenue.toLocaleString()} ج.م</span>
             </div>
             <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 transition-colors">
               <TrendingUp size={28} />
             </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20 flex items-center gap-6 flex-1 md:flex-none transition-colors">
             <div>
               <span className="text-[10px] text-red-600 dark:text-red-400 font-black uppercase block mb-1">إجمالي المصروفات</span>
               <span className="text-2xl font-black text-red-700 dark:text-red-500 transition-colors">{totalExpenses.toLocaleString()} ج.م</span>
             </div>
             <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 transition-colors">
               <TrendingDown size={28} />
             </div>
          </div>
          <button 
            onClick={() => { setShowAddForm(true); setFinanceTab('expenses'); }}
            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-lg transition-all flex items-center gap-2 font-bold"
          >
            <Plus size={24} />
            <span>إضافة مصروف</span>
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
        <button 
          onClick={() => setFinanceTab('expenses')}
          className={cn("px-6 py-2 rounded-xl text-sm font-black transition-all", financeTab === 'expenses' ? "bg-red-600 text-white shadow-lg shadow-red-900/20" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800")}
        >
          {lang === 'ar' ? 'المصروفات' : 'Expenses'} ({expenses.length})
        </button>
        <button 
          onClick={() => setFinanceTab('revenue')}
          className={cn("px-6 py-2 rounded-xl text-sm font-black transition-all", financeTab === 'revenue' ? "bg-green-600 text-white shadow-lg shadow-green-900/20" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800")}
        >
          {lang === 'ar' ? 'الإيرادات' : 'Revenue'} ({allRevenue.length})
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl space-y-6 transition-colors">
              <h3 className="text-lg font-bold border-b border-gray-50 dark:border-gray-800 pb-4 mb-4 text-gray-800 dark:text-gray-100 transition-colors">تسجيل مصروف جديد</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <InputGroup label="التاريخ" type="date" value={form.date} onChange={(v: string) => setForm({...form, date: v})} />
                <InputGroup label="المبلغ (ج.م)" type="number" value={form.amount} onChange={(v: string) => setForm({...form, amount: Number(v)})} />
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-gray-400 dark:text-gray-500 tracking-wider pr-1 transition-colors">الفئة</label>
                  <select 
                    value={form.category}
                    onChange={(e) => setForm({...form, category: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 dark:text-gray-100 transition-all cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <InputGroup label="سبب الصرف" value={form.reason} onChange={(v: string) => setForm({...form, reason: v})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-gray-400 dark:text-gray-500 tracking-wider pr-1">ملاحظات إضافية</label>
                <textarea 
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 dark:text-gray-100 transition-all h-24"
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  placeholder="أي تفاصيل أخرى عن المصروف..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 text-gray-500 font-bold hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >إلغاء</button>
                <button 
                  type="submit"
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all"
                >حفظ المصروف</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {financeTab === 'expenses' ? (
        <>
          {expenses.length > 0 && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                <h3 className="text-sm font-black text-gray-400 mb-6 uppercase">تطور إجمالي المصروفات (تراكمي)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="displayDate" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                      />
                      <YAxis hide />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-gray-900 text-white p-4 rounded-xl shadow-xl border border-gray-800 text-right">
                                <p className="text-[10px] font-black opacity-50 mb-1">{data.date}</p>
                                <p className="text-sm font-black text-white mb-1">{data.reason}</p>
                                <p className="text-sm font-black text-red-400">{data.total.toLocaleString()} ج.م</p>
                                <p className="text-[10px] opacity-70">إجمالي المصروفات التراكمي</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#ef4444" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorTotal)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                  <h3 className="text-sm font-black text-gray-400 mb-6 uppercase">توزيع المصروفات حسب الفئة</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                  <h3 className="text-sm font-black text-gray-400 mb-6 uppercase">تطور المصروفات الشهري (حسب الفئة)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                        <Legend />
                        {categories.map((cat, index) => (
                          <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[index % COLORS.length]} radius={index === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">
                <table className="w-full text-right">
                  <thead className="bg-gray-50 dark:bg-gray-800 transition-colors">
                    <tr>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t.date}</th>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t.reason}</th>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t.category}</th>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t.amount}</th>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {expenses.map((exp: Expense) => (
                      <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                        <td className="p-4">
                          <div className="font-bold text-gray-700 dark:text-gray-200">{exp.date}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-gray-800 dark:text-gray-100">{exp.reason}</div>
                          {exp.notes && <div className="text-[10px] text-gray-400 mt-0.5">{exp.notes}</div>}
                        </td>
                        <td className="p-4">
                          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full text-[10px] font-black uppercase tracking-tighter">
                            {exp.category || "أخرى"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-black text-red-600 dark:text-red-400">{exp.amount.toLocaleString()} ج.م</div>
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => {
                              if (confirm("هل أنت متأكد من حذف هذا المصروف؟")) {
                                onDelete(exp.id);
                              }
                            }}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {expenses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800 transition-colors">
              <TrendingDown size={48} className="text-gray-200 dark:text-gray-700 mb-4" />
              <p className="text-gray-400 font-bold">لا توجد مصروفات مسجلة حتى الآن</p>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">
            <h3 className="p-6 text-sm font-black text-gray-400 uppercase border-b border-gray-50 dark:border-gray-800">سجل الإيرادات (المبالغ المحصلة من الشقق)</h3>
            <table className="w-full text-right font-sans">
              <thead className="bg-gray-50 dark:bg-gray-800 transition-colors">
                <tr>
                  <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">التاريخ</th>
                  <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">الشقة</th>
                  <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">عن شهر</th>
                  <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t.paymentMethod}</th>
                  <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {allRevenue.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-gray-700 dark:text-gray-200">{p.paymentDate || "غير محدد"}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-black text-gray-800 dark:text-gray-100">شقة {p.unitNumber}</div>
                      <div className="text-[10px] text-gray-400">{p.residentName}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black underline underline-offset-4 decoration-2 decoration-blue-200">
                        {p.month}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-gray-500 font-bold">{p.paymentMethod}</span>
                    </td>
                    <td className="p-4">
                      <div className="font-black text-green-600 dark:text-green-400">{p.amountPaid.toLocaleString()} ج.م</div>
                    </td>
                  </tr>
                ))}
                {allRevenue.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-gray-400 font-bold">لا توجد إيرادات مسجلة حتى الآن</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeView({ apartments, expenses, emergencyFund, lang, t }: any) {
  const currentYear = new Date().getFullYear();
  
  const monthlyIncomeData = useMemo(() => {
    const data = [];
    for (let m = 0; m < 12; m++) {
      const monthStr = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
      const monthLabel = format(new Date(currentYear, m), "MMM", { locale: lang === 'ar' ? ar : enUS });
      
      const income = apartments.reduce((acc: number, apt: Apartment) => {
        return acc + apt.payments
          .filter(p => p.month === monthStr)
          .reduce((sum, p) => sum + p.amountPaid, 0);
      }, 0);

      data.push({ name: monthLabel, income });
    }
    return data;
  }, [apartments, currentYear, lang]);

  const annualIncomeData = useMemo(() => {
    const data = [];
    const now = new Date().getFullYear();
    for (let i = 4; i >= 0; i--) {
        const year = now - i;
        const yearStr = year.toString();
        
        const income = apartments.reduce((acc: number, apt: Apartment) => {
            return acc + apt.payments
                .filter(p => p.month.startsWith(yearStr))
                .reduce((sum, p) => sum + p.amountPaid, 0);
        }, 0);
        
        data.push({ name: yearStr, income });
    }
    return data;
  }, [apartments]);

  const fundTrendData = useMemo(() => {
      const transactions = [...emergencyFund.transactions].sort((a, b) => a.date.localeCompare(b.date));
      const data = [];
      
      const monthMap: Record<string, number> = {};
      let runningBalance = 0;
      transactions.forEach(tx => {
          const m = tx.date.slice(0, 7);
          runningBalance += (tx.type === 'in' ? tx.amount : -tx.amount);
          monthMap[m] = runningBalance;
      });

      for (let i = 5; i >= 0; i--) {
          const d = subMonths(new Date(), i);
          const m = format(d, "yyyy-MM");
          const label = format(d, "MMM", { locale: lang === 'ar' ? ar : enUS });
          
          let lastBalance = 0;
          const sortedMonths = Object.keys(monthMap).sort();
          for(const monthKey of sortedMonths) {
              if (monthKey <= m) {
                  lastBalance = monthMap[monthKey];
              }
          }

          data.push({ name: label, balance: lastBalance });
      }
      return data;
  }, [emergencyFund, lang]);

  return (
    <div className="space-y-8" dir={t.dir}>
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 transition-colors">{lang === 'ar' ? 'تقرير الإيرادات' : 'Income Report'}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">{lang === 'ar' ? 'تحليل بياني لإيرادات العقار وتدفقاته' : 'Graphical analysis of property income and flows'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
          <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <TrendingUp className="text-green-500" />
            {lang === 'ar' ? 'الإيرادات الشهرية' : 'Monthly Income'} ({currentYear})
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyIncomeData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#22c55e', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="income" stroke="#22c55e" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
          <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <BarChart3 className="text-blue-500" />
            {lang === 'ar' ? 'الإيرادات السنوية' : 'Annual Income'}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={annualIncomeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="income" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
        <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-gray-800 dark:text-gray-100">
          <AlertCircle className="text-amber-500" />
          {lang === 'ar' ? 'نمو صندوق الطوارئ' : 'Emergency Fund Growth'}
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fundTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="balance" stroke="#f59e0b" strokeWidth={4} dot={{ r: 6, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function EmergencyFundView({ emergencyFund, onUpdateFund, totalIncomes, totalExpenses, netBalance, lang, t }: any) {
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [activeAction, setActiveAction] = useState<"transfer" | "deposit" | "withdraw">("transfer");

  const handleAction = () => {
    if (amount <= 0) return;

    let newBalance = emergencyFund.balance;
    let type: "in" | "out" = "in";
    let finalReason = reason;

    if (activeAction === "transfer") {
      if (amount > netBalance) {
        alert(lang === 'ar' ? "المبلغ المطلوب تحويله أكبر من الرصيد المتاح" : "Transfer amount exceeds available balance");
        return;
      }
      newBalance += amount;
      type = "in";
      finalReason = reason || (lang === 'ar' ? "تحويل من إيرادات المبنى" : "Transfer from building income");
    } else if (activeAction === "deposit") {
      newBalance += amount;
      type = "in";
      finalReason = reason || (lang === 'ar' ? "إيداع مباشر" : "Direct deposit");
    } else if (activeAction === "withdraw") {
      if (amount > emergencyFund.balance) {
        alert(lang === 'ar' ? "المبلغ المطلوب سحبه أكبر من رصيد الصندوق" : "Withdrawal amount exceeds fund balance");
        return;
      }
      newBalance -= amount;
      type = "out";
      finalReason = reason || (lang === 'ar' ? "سحب من الصندوق" : "Withdrawal from fund");
    }

    const newTransaction = {
      id: "tx_" + Date.now(),
      date: new Date().toISOString(),
      amount: amount,
      type,
      reason: finalReason
    };

    onUpdateFund({
      ...emergencyFund,
      balance: newBalance,
      transactions: [newTransaction, ...emergencyFund.transactions]
    });

    setAmount(0);
    setReason("");
    alert(lang === 'ar' ? "تمت العملية بنجاح" : "Operation successful");
  };

  return (
    <div className="space-y-8" dir={t.dir}>
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 transition-colors">{lang === 'ar' ? 'صندوق الطوارئ' : 'Emergency Fund'}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">{lang === 'ar' ? 'إدارة المبالغ المخصصة للحالات الطارئة وصيانة العقار الكبرى' : 'Manage funds allocated for emergencies and major property maintenance'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 rounded-3xl text-white shadow-xl shadow-orange-900/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10 text-right">
              <span className="text-xs font-black uppercase tracking-widest opacity-80">{lang === 'ar' ? 'الرصيد الحالي للصندوق' : 'Current Fund Balance'}</span>
              <div className="text-4xl font-black mt-2 mb-1">{emergencyFund.balance.toLocaleString()} ج.م</div>
              <p className="text-[10px] font-bold opacity-60 tracking-wider">EMERGENCY FUND ACCOUNT</p>
            </div>
            <AlertCircle className="absolute bottom-6 left-6 opacity-20" size={48} />
          </div>

          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4 text-right transition-colors">
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4">
              <button 
                onClick={() => setActiveAction("transfer")}
                className={cn(
                  "flex-1 py-2 text-xs font-black rounded-lg transition-all",
                  activeAction === "transfer" ? "bg-white dark:bg-gray-700 shadow-sm text-amber-600" : "text-gray-400"
                )}
              >
                {lang === 'ar' ? 'تحويل' : 'Transfer'}
              </button>
              <button 
                onClick={() => setActiveAction("deposit")}
                className={cn(
                  "flex-1 py-2 text-xs font-black rounded-lg transition-all",
                  activeAction === "deposit" ? "bg-white dark:bg-gray-700 shadow-sm text-green-600" : "text-gray-400"
                )}
              >
                {lang === 'ar' ? 'إيداع' : 'Deposit'}
              </button>
              <button 
                onClick={() => setActiveAction("withdraw")}
                className={cn(
                  "flex-1 py-2 text-xs font-black rounded-lg transition-all",
                  activeAction === "withdraw" ? "bg-white dark:bg-gray-700 shadow-sm text-red-600" : "text-gray-400"
                )}
              >
                {lang === 'ar' ? 'سحب' : 'Withdraw'}
              </button>
            </div>

            <h3 className="text-lg font-black border-b border-gray-50 dark:border-gray-800 pb-4 mb-4 text-gray-800 dark:text-gray-100">
              {activeAction === "transfer" && (lang === 'ar' ? 'تحويل من إيرادات المبنى' : 'Transfer from Building Income')}
              {activeAction === "deposit" && (lang === 'ar' ? 'إيداع نقدي مباشر' : 'Direct Cash Deposit')}
              {activeAction === "withdraw" && (lang === 'ar' ? 'سحب من الصندوق' : 'Withdraw from Fund')}
            </h3>

            <div className="space-y-4">
               <div className="space-y-1 text-right">
                 <label className="text-[10px] uppercase font-black text-gray-400 dark:text-gray-500 tracking-wider pr-1">{lang === 'ar' ? 'المبلغ' : 'Amount'}</label>
                 <input 
                    type="number" 
                    value={amount || ""} 
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-gray-800 dark:text-gray-100 transition-all font-mono"
                 />
                 {activeAction === "transfer" && (
                   <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold transition-colors">* {lang === 'ar' ? 'الرصيد المتاح حالياً:' : 'Available balance:'} {netBalance.toLocaleString()} ج.م</p>
                 )}
                 {activeAction === "withdraw" && (
                   <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold transition-colors">* {lang === 'ar' ? 'رصيد الصندوق:' : 'Fund balance:'} {emergencyFund.balance.toLocaleString()} ج.م</p>
                 )}
               </div>
               <InputGroup 
                  label={lang === 'ar' ? "السبب / الملاحظات" : "Reason / Notes"} 
                  value={reason} 
                  onChange={setReason} 
                  placeholder={
                    activeAction === "withdraw" 
                    ? (lang === 'ar' ? "مثال: إصلاح ماسورة مياه عمومية" : "e.g. Repair of main water pipe")
                    : (lang === 'ar' ? "أدخل سبب العملية هنا" : "Enter reason here")
                  }
               />
               <button 
                onClick={handleAction}
                disabled={amount <= 0}
                className={cn(
                  "w-full py-4 text-white rounded-2xl font-black shadow-lg transition-all disabled:opacity-50 disabled:grayscale",
                  activeAction === "withdraw" ? "bg-red-500 shadow-red-900/20 hover:bg-red-600" : 
                  activeAction === "deposit" ? "bg-green-600 shadow-green-900/20 hover:bg-green-700" :
                  "bg-amber-500 shadow-amber-900/20 hover:bg-amber-600"
                )}
               >
                 {activeAction === "transfer" && (lang === 'ar' ? 'تأكيد التحويل الآن' : 'Confirm Transfer Now')}
                 {activeAction === "deposit" && (lang === 'ar' ? 'تأكيد الإيداع' : 'Confirm Deposit')}
                 {activeAction === "withdraw" && (lang === 'ar' ? 'تأكيد السحب' : 'Confirm Withdrawal')}
               </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col transition-colors">
          <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center transition-colors">
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">{lang === 'ar' ? 'سجل معاملات الصندوق' : 'Fund Transaction History'}</h3>
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/10 text-amber-600 rounded-lg border border-amber-100 dark:border-amber-900/20">
              <Clock size={16} />
              <span className="text-xs font-black">{emergencyFund.transactions.length} {lang === 'ar' ? 'عملية' : 'Transactions'}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[600px] font-mono">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/30 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">
                  <th className="px-8 py-4">{lang === 'ar' ? 'التاريخ' : 'DATE'}</th>
                  <th className="px-8 py-4">{lang === 'ar' ? 'السبب' : 'REASON'}</th>
                  <th className="px-8 py-4">{lang === 'ar' ? 'النوع' : 'TYPE'}</th>
                  <th className="px-8 py-4">{lang === 'ar' ? 'المبلغ' : 'AMOUNT'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {emergencyFund.transactions.map((tx: any) => (
                  <tr key={tx.id} className="group hover:bg-gray-50/30 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="px-8 py-5 text-[11px] font-bold text-gray-400 dark:text-gray-500">{format(parseISO(tx.date), "dd / MM / yyyy - HH:mm")}</td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-700 dark:text-gray-200">{tx.reason}</td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-1 rounded-md uppercase",
                        tx.type === 'in' ? "bg-green-50 dark:bg-green-900/20 text-green-600" : "bg-red-50 dark:bg-red-900/20 text-red-600"
                      )}>
                        {tx.type === 'in' ? (lang === 'ar' ? 'إيداع' : 'IN') : (lang === 'ar' ? 'سحب' : 'OUT')}
                      </span>
                    </td>
                    <td className={cn(
                      "px-8 py-5 text-lg font-black",
                      tx.type === 'in' ? "text-green-600" : "text-red-500"
                    )}>
                      {tx.type === 'in' ? '+' : '-'}{tx.amount.toLocaleString()} <span className="text-[10px] font-bold opacity-60">ج.م</span>
                    </td>
                  </tr>
                ))}
                {emergencyFund.transactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-gray-400 dark:text-gray-600 bg-gray-50/10 dark:bg-gray-800/10 transition-colors">
                      < RotateCcw size={48} className="mx-auto mb-4 opacity-5" />
                      <p className="font-bold text-lg">{lang === 'ar' ? 'لا توجد معاملات مسجلة حتى الآن' : 'No transactions recorded yet'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, type = "text", className = "", placeholder = "" }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase font-black text-gray-400 dark:text-gray-500 tracking-wider pr-1 transition-colors">{label}</label>
      <input 
        type={type} 
        value={value} 
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 dark:text-gray-100 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600",
          className
        )}
      />
    </div>
  );
}

function PaymentModal({ apartment, onClose, onSave, lang, t }: any) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [amountPaid, setAmountPaid] = useState(apartment.monthlyFee);
  const [method, setMethod] = useState(PaymentMethod.CASH);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState("اشتراك شهري");
  const [customReason, setCustomReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm transition-colors"
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-3xl shadow-2xl z-10 overflow-hidden text-right transition-colors"
      >
        <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black">تسجيل دفعة جديدة</h3>
            <p className="text-blue-100 mt-1">شقة #{apartment.unitNumber} - {apartment.residentName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-blue-500 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 space-y-6">
           <div className="grid grid-cols-2 gap-6">
             <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 transition-colors">عن شهر</label>
                <input 
                  type="month" 
                  value={month} 
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 dark:text-gray-100 transition-all"
                />
             </div>
             <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 transition-colors">تاريخ الدفع</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 dark:text-gray-100 transition-all"
                />
             </div>
           </div>

           <div className="grid grid-cols-2 gap-6">
             <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 transition-colors">المبلغ المدفوع (ج.م)</label>
                <input 
                  type="number" 
                  value={amountPaid} 
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-blue-600 dark:text-blue-400 transition-all"
                />
             </div>
             <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 transition-colors">طريقة الدفع</label>
                <select 
                  value={method} 
                  onChange={(e: any) => setMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 dark:text-gray-100 transition-all"
                >
                  <option value={PaymentMethod.CASH}>نقدي</option>
                  <option value={PaymentMethod.TRANSFER}>تحويل</option>
                  <option value={PaymentMethod.ONLINE}>أونلاين</option>
                </select>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 transition-colors">سبب الدفع</label>
                <select 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 dark:text-gray-100 transition-all"
                >
                  <option value="اشتراك شهري">اشتراك شهري</option>
                  <option value="صيانة">صيانة</option>
                  <option value="كهرباء">كهرباء</option>
                  <option value="خزانات">خزانات</option>
                  <option value="أخرى">أخرى</option>
                </select>
             </div>
             <AnimatePresence>
               {reason === "أخرى" && (
                 <motion.div 
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 20 }}
                   className="space-y-1"
                 >
                    <label className="text-xs font-bold text-amber-600 dark:text-amber-400 transition-colors">تحديد السبب الآخر</label>
                    <input 
                      type="text" 
                      value={customReason} 
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="اكتب هنا..."
                      className="w-full px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-gray-800 dark:text-gray-100 transition-all"
                    />
                 </motion.div>
               )}
             </AnimatePresence>
           </div>

           <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex gap-4 transition-colors">
             <button 
              onClick={() => onSave({
                id: Math.random().toString(36).substr(2, 9),
                month,
                amountDue: apartment.monthlyFee,
                amountPaid,
                paymentDate: date,
                paymentMethod: method,
                reason: reason === "أخرى" ? customReason : reason
              })}
              className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
             >
               حفظ وتأكيد
             </button>
             <button 
              onClick={onClose}
              className="px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
             >
               إلغاء
             </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
