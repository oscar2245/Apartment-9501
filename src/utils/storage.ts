/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Apartment, BuildingSettings, Expense } from "../types";
import { SAMPLE_APARTMENTS, DEFAULT_SETTINGS, DATA_VERSION } from "../constants";

const STORAGE_KEY = "building_manager_data";
const SETTINGS_KEY = "building_manager_settings";
const EXPENSES_KEY = "building_manager_expenses";
const EMERGENCY_FUND_KEY = "building_manager_emergency_fund";
const VERSION_KEY = "building_manager_version";

export const storage = {
  getData: (): Apartment[] => {
    const version = localStorage.getItem(VERSION_KEY);
    const data = localStorage.getItem(STORAGE_KEY);
    
    if (version !== DATA_VERSION || !data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_APARTMENTS));
      localStorage.setItem(VERSION_KEY, DATA_VERSION);
      return SAMPLE_APARTMENTS;
    }
    return JSON.parse(data);
  },
  
  saveData: (data: Apartment[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  getExpenses: (): Expense[] => {
    const data = localStorage.getItem(EXPENSES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveExpenses: (data: Expense[]) => {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(data));
  },
  
  getEmergencyFund: (): { balance: number, transactions: any[] } => {
    const data = localStorage.getItem(EMERGENCY_FUND_KEY);
    return data ? JSON.parse(data) : { balance: 0, transactions: [] };
  },

  saveEmergencyFund: (data: { balance: number, transactions: any[] }) => {
    localStorage.setItem(EMERGENCY_FUND_KEY, JSON.stringify(data));
  },
  
  getSettings: (): BuildingSettings => {
    const settings = localStorage.getItem(SETTINGS_KEY);
    if (!settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(settings);
  },
  
  saveSettings: (settings: BuildingSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
  
  clearAll: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(EXPENSES_KEY);
    localStorage.removeItem(EMERGENCY_FUND_KEY);
    localStorage.removeItem(VERSION_KEY);
  }
};
