import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Trash2, TrendingUp, TrendingDown, Calculator, Calendar, Save, 
  User, Users, Search, ShoppingBag, CreditCard, Wallet, DollarSign, 
  PieChart, UserCheck, UserPlus, CalendarCheck, BookOpen, CheckSquare, 
  Edit, X, Upload, Download, AlertTriangle, CalendarDays, History, ArrowUpDown, ArrowUp, ArrowDown, Filter
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area
} from 'recharts';

// ---------------- 輔助函數區 ----------------

// [CRM] 計算年齡的輔助函數
const calculateAge = (birthday) => {
  if (!birthday) return '';
  const today = new Date();
  const birthDate = new Date(birthday);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// [CRM] 計算顧客的統計數據 (堂數、總價、次數、平均)
const getCustomerStats = (purchases = []) => {
  const totalSessions = purchases.reduce((sum, p) => sum + p.sessions, 0);
  const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0);
  const purchaseCount = purchases.length;
  const avgPrice = totalSessions > 0 ? Math.round(totalSpent / totalSessions) : 0;
  return { totalSessions, totalSpent, purchaseCount, avgPrice };
};

// [CRM] 簡易 CSV 剖析輔助函數
const parseCSVLineCRM = (text) => {
  let result = [], keep = false, token = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') keep = !keep;
    else if (text[i] === ',' && !keep) { result.push(token); token = ''; }
    else token += text[i];
  }
  result.push(token);
  return result;
};

// [營收總帳] 輔助元件：統計卡片
const StatCard = ({ title, value, subValue, color, bgColor = "bg-white", icon, isProjection = false }) => (
  <div className={`${bgColor} p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between h-32 transition-transform hover:-translate-y-1 duration-300`}>
    <div className="flex justify-between items-start">
      <span className={`text-sm font-semibold ${isProjection ? 'text-slate-600' : 'text-slate-500'}`}>{title}</span>
      {icon && <div className={`p-2 rounded-lg bg-slate-100 ${color}`}>{icon}</div>}
    </div>
    <div>
      <div className={`text-2xl font-bold ${color} tracking-tight`}>
        ${typeof value === 'number' ? value.toLocaleString() : '0'}
      </div>
      {subValue && (
        <div className="text-xs text-slate-400 mt-1 font-medium">
          {subValue}
        </div>
      )}
    </div>
  </div>
);

// [營收總帳] 輔助元件：自訂 Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-slate-100 shadow-xl rounded-xl text-sm">
        <p className="font-bold text-slate-700 mb-2">{label}</p>
        {data.actualIncome !== null ? (
          <>
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
              <span>實際累積入金: ${data.actualIncome.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-amber-600">
              <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
              <span>實際累積消化: ${data.actualConsumption.toLocaleString()}</span>
            </div>
             <div className="border-t border-slate-100 my-2 pt-2 text-xs text-slate-400">
              本日: +${data.dailyIncome} / -${data.dailyConsumption}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
              <span>預測累積入金: ${data.predIncome.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-amber-400">
              <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
              <span>預測累積消化: ${data.predConsumption.toLocaleString()}</span>
            </div>
            <div className="text-xs text-slate-400 mt-2 italic">AI 預測數值</div>
          </>
        )}
      </div>
    );
  }
  return null;
};


// ==========================================
// 系統一：獨立顧客點數管理 (完全本地儲存版)
// ==========================================
function CRMSystem() {
  // 1. 從 LocalStorage 讀取顧客資料 (包含陣列防禦檢查)
  const [customers, setCustomers] = useState(() => {
    try {
      const saved = localStorage.getItem('gym_crm_customers_data');
      if (saved) {
        const parsedData = JSON.parse(saved);
        return Array.isArray(parsedData) ? parsedData : [];
      }
    } catch (error) { console.error("讀取顧客資料失敗:", error); }
    return [];
  });

  // 2. 當 customers 改變時，自動存回 LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('gym_crm_customers_data', JSON.stringify(customers));
    } catch (error) { console.error("儲存顧客資料失敗:", error); }
  }, [customers]);

  const [searchQuery, setSearchQuery] = useState('');
  const [minSessions, setMinSessions] = useState(0);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  const [confirmDialog, setConfirmDialog] = useState({ 
    isOpen: false, 
    message: '', 
    onConfirm: null,
    confirmText: '確定',
    confirmStyle: 'danger' 
  });
  
  const [formData, setFormData] = useState({
    name: '', phone: '', birthday: '', initialSessions: 0, initialPrice: 0, notes: ''
  });
  
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionToAdd, setSessionToAdd] = useState(10);
  const [purchasePrice, setPurchasePrice] = useState('');

  const fileInputRef = useRef(null);

  const filteredCustomers = useMemo(() => {
    let result = customers.filter(c => {
      const stats = getCustomerStats(c.purchases);
      const matchName = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSessions = stats.totalSessions >= (minSessions || 0);
      return matchName && matchSessions;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        const statsA = getCustomerStats(a.purchases);
        const statsB = getCustomerStats(b.purchases);
        let aValue, bValue;

        switch (sortConfig.key) {
          case 'name':
            aValue = a.name; bValue = b.name; break;
          case 'age':
            aValue = a.birthday ? calculateAge(a.birthday) : -1;
            bValue = b.birthday ? calculateAge(b.birthday) : -1;
            break;
          case 'totalSessions':
            aValue = statsA.totalSessions; bValue = statsB.totalSessions; break;
          case 'totalSpent':
            aValue = statsA.totalSpent; bValue = statsB.totalSpent; break;
          case 'purchaseCount':
            aValue = statsA.purchaseCount; bValue = statsB.purchaseCount; break;
          case 'avgPrice':
            aValue = statsA.avgPrice; bValue = statsB.avgPrice; break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [customers, searchQuery, minSessions, sortConfig]);

  const totalCustomersCount = customers.length;
  const totalSessionsCount = customers.reduce((sum, c) => sum + getCustomerStats(c.purchases).totalSessions, 0);
  const totalRevenue = customers.reduce((sum, c) => sum + getCustomerStats(c.purchases).totalSpent, 0);
  
  const filteredCustomersCount = filteredCustomers.length;
  const filteredSessionsCount = filteredCustomers.reduce((sum, c) => sum + getCustomerStats(c.purchases).totalSessions, 0);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleOpenAddCustomer = () => {
    setFormData({ name: '', phone: '', birthday: '', initialSessions: 0, initialPrice: 0, notes: '' });
    setEditingCustomer(null);
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (customer) => {
    setFormData({ ...customer, initialSessions: 0, initialPrice: 0 });
    setEditingCustomer(customer);
    setIsCustomerModalOpen(true);
  };

  const handleOpenAddSession = (customer) => {
    setEditingCustomer(customer);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setSessionToAdd(10);
    setPurchasePrice('');
    setIsSessionModalOpen(true);
  };

  const handleOpenHistory = (customer) => {
    setEditingCustomer(customer);
    setIsHistoryModalOpen(true);
  };

  const handleDeleteCustomer = (id) => {
    setConfirmDialog({
      isOpen: true,
      message: '確定要刪除這位顧客的所有資料與購買紀錄嗎？',
      confirmText: '確定刪除',
      confirmStyle: 'danger',
      onConfirm: () => {
        setCustomers(prev => prev.filter(c => c.id !== id));
        setConfirmDialog({ isOpen: false, message: '', onConfirm: null, confirmText: '確定', confirmStyle: 'danger' });
      }
    });
  };

  const handleDeletePurchase = (customerId, purchaseId) => {
    setConfirmDialog({
      isOpen: true,
      message: '確定要刪除這筆購買紀錄嗎？相關的堂數與金額將會被扣除。',
      confirmText: '確定刪除',
      confirmStyle: 'danger',
      onConfirm: () => {
        setCustomers(prev => prev.map(c => {
          if (c.id === customerId) {
            return { ...c, purchases: c.purchases.filter(p => p.id !== purchaseId) };
          }
          return c;
        }));
        setEditingCustomer(prev => ({ ...prev, purchases: prev.purchases.filter(p => p.id !== purchaseId) }));
        setConfirmDialog({ isOpen: false, message: '', onConfirm: null, confirmText: '確定', confirmStyle: 'danger' });
      }
    });
  };

  const handleSaveCustomer = (e) => {
    e.preventDefault();

    if (editingCustomer) {
      const updatedCustomer = { ...editingCustomer, name: formData.name, phone: formData.phone, birthday: formData.birthday, notes: formData.notes };
      setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? updatedCustomer : c));
    } else {
      const newId = Date.now().toString();
      const newCustomer = {
        id: newId,
        name: formData.name,
        phone: formData.phone,
        birthday: formData.birthday,
        notes: formData.notes,
        purchases: []
      };
      
      if (Number(formData.initialSessions) > 0) {
        newCustomer.purchases.push({
          id: Date.now() + 1,
          date: new Date().toISOString().split('T')[0],
          sessions: Number(formData.initialSessions),
          price: Number(formData.initialPrice) || 0
        });
      }
      setCustomers(prev => [newCustomer, ...prev]);
    }
    setIsCustomerModalOpen(false);
  };

  const handleSaveSessions = (e) => {
    e.preventDefault();
    if (!editingCustomer) return;

    const newPurchase = {
      id: Date.now(),
      date: purchaseDate,
      sessions: Number(sessionToAdd),
      price: Number(purchasePrice) || 0
    };
    
    const updatedCustomer = { 
      ...editingCustomer, 
      purchases: [...editingCustomer.purchases, newPurchase].sort((a, b) => new Date(b.date) - new Date(a.date)) 
    };
    
    setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? updatedCustomer : c));
    setIsSessionModalOpen(false);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      
      if (lines.length <= 1) {
        alert('檔案沒有資料或格式不正確');
        return;
      }

      const newCustomers = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLineCRM(lines[i]).map(c => c.replace(/^"|"$/g, '')); 
        if (cols.length >= 1 && cols[0]) {
          const sessions = Number(cols[3]) || 0;
          const price = Number(cols[4]) || 0;
          const initialPurchases = [];
          
          if (sessions > 0) {
            initialPurchases.push({
              id: Date.now() + i,
              date: new Date().toISOString().split('T')[0],
              sessions: sessions,
              price: price
            });
          }

          newCustomers.push({
            id: (Date.now() + 1000 + i).toString(),
            name: cols[0],
            phone: cols[1] || '',
            birthday: cols[2] || '',
            notes: cols[7] || '', 
            purchases: initialPurchases
          });
        }
      }

      if (newCustomers.length > 0) {
        setConfirmDialog({
          isOpen: true,
          message: `成功讀取 ${newCustomers.length} 筆資料，確定要新增嗎？`,
          confirmText: '確定新增',
          confirmStyle: 'primary',
          onConfirm: () => {
            setCustomers(prev => [...newCustomers, ...prev]);
            setConfirmDialog({ isOpen: false, message: '', onConfirm: null, confirmText: '確定', confirmStyle: 'danger' });
          }
        });
      }
      
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = ['客戶名稱', '聯絡電話', '生日', '累積購課堂數', '總消費金額', '購買次數', '平均單價', '備註'];
    const rows = customers.map(c => {
      const stats = getCustomerStats(c.purchases);
      return [
        `"${c.name || ''}"`,
        `"${c.phone || ''}"`,
        `"${c.birthday || ''}"`,
        stats.totalSessions,
        stats.totalSpent,
        stats.purchaseCount,
        stats.avgPrice,
        `"${(c.notes || '').replace(/"/g, '""')}"`
      ];
    });
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `顧客總表_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortHeader = (title, key, align = 'left') => {
    const isActive = sortConfig.key === key;
    return (
      <th 
        className={`p-4 font-semibold cursor-pointer hover:bg-gray-200 transition-colors text-${align} group select-none whitespace-nowrap`}
        onClick={() => handleSort(key)}
        title={`點擊以${isActive && sortConfig.direction === 'asc' ? '降冪' : '升冪'}排序`}
      >
        <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          {title}
          <span className="text-gray-400 group-hover:text-gray-600 transition-opacity">
            {isActive ? (
              sortConfig.direction === 'asc' 
                ? <ArrowUp className="w-4 h-4 text-indigo-600" /> 
                : <ArrowDown className="w-4 h-4 text-indigo-600" />
            ) : (
              <ArrowUpDown className="w-4 h-4 opacity-0 group-hover:opacity-100" />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-10">
      <header className="bg-indigo-600 text-white shadow-md py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-wider">顧客課程紀錄系統</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImportCSV} 
            />
            
            <button 
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-full font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
              title="請上傳 .csv 檔案"
            >
              <Upload className="w-4 h-4" />
              匯入
            </button>

            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-full font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              匯出
            </button>

            <button 
              onClick={() => {
                setConfirmDialog({
                  isOpen: true,
                  message: '確定要清空所有的顧客資料嗎？此操作一旦執行將無法復原。',
                  confirmText: '確定清空',
                  confirmStyle: 'danger',
                  onConfirm: () => {
                    setCustomers([]);
                    setConfirmDialog({ isOpen: false, message: '', onConfirm: null, confirmText: '確定', confirmStyle: 'danger' });
                  }
                });
              }}
              className="flex items-center gap-2 bg-white text-red-600 px-4 py-2 rounded-full font-semibold hover:bg-red-50 transition-colors shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>

            <button 
              onClick={handleOpenAddCustomer}
              className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-full font-semibold hover:bg-indigo-50 transition-colors shadow-sm sm:ml-2"
            >
              <UserPlus className="w-4 h-4" />
              新增
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-6 flex flex-col gap-6">
        {/* 統計面板 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">總顧客數</p>
              <p className="text-xl font-bold">{totalCustomersCount} <span className="text-sm font-normal text-gray-500">人</span></p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">系統總售出堂數</p>
              <p className="text-xl font-bold">{totalSessionsCount} <span className="text-sm font-normal text-gray-500">堂</span></p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">系統總營業額</p>
              <p className="text-xl font-bold">${totalRevenue.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-indigo-50 p-5 rounded-xl shadow-sm border border-indigo-100 flex items-center gap-4">
            <div className="p-3 bg-indigo-200 text-indigo-700 rounded-full">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-indigo-700 font-medium">篩選人數 / 堂數</p>
              <p className="text-lg font-bold text-indigo-900">
                {filteredCustomersCount} 人 / {filteredSessionsCount} 堂
              </p>
            </div>
          </div>
        </div>

        {/* 控制列 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-1/3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="搜尋顧客名稱..."
              className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
            <Filter className="h-5 w-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              篩選購課超過：
            </label>
            <input
              type="number"
              min="0"
              className="w-20 p-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-center"
              value={minSessions}
              onChange={(e) => setMinSessions(Number(e.target.value))}
            />
            <span className="text-sm text-gray-600">堂</span>
          </div>
        </div>

        {/* 客戶列表表格 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700 border-b border-gray-200">
                  {renderSortHeader('客戶名稱', 'name')}
                  <th className="p-4 font-semibold">聯絡電話</th>
                  {renderSortHeader('生日 (年齡)', 'age')}
                  {renderSortHeader('累積堂數', 'totalSessions', 'center')}
                  {renderSortHeader('總消費', 'totalSpent', 'right')}
                  {renderSortHeader('購買次數', 'purchaseCount', 'center')}
                  {renderSortHeader('平均單價', 'avgPrice', 'right')}
                  <th className="p-4 font-semibold text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(customer => {
                    const stats = getCustomerStats(customer.purchases);
                    return (
                      <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          {customer.notes && <div className="text-xs text-gray-500 mt-1 truncate max-w-[120px]" title={customer.notes}>{customer.notes}</div>}
                        </td>
                        <td className="p-4 text-gray-600 whitespace-nowrap">{customer.phone || '-'}</td>
                        <td className="p-4 text-gray-600 whitespace-nowrap">
                          {customer.birthday ? `${customer.birthday} (${calculateAge(customer.birthday)}歲)` : '-'}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700">
                            {stats.totalSessions} 堂
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium text-gray-700 whitespace-nowrap">
                          ${stats.totalSpent.toLocaleString()}
                        </td>
                        <td className="p-4 text-center text-gray-600 whitespace-nowrap">
                          {stats.purchaseCount} 次
                        </td>
                        <td className="p-4 text-right text-gray-600 whitespace-nowrap">
                          ${stats.avgPrice.toLocaleString()} / 堂
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => handleOpenAddSession(customer)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors text-xs font-medium border border-emerald-200"
                              title="新增購買堂數"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              買課
                            </button>
                            <button 
                              onClick={() => handleOpenHistory(customer)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-xs font-medium border border-blue-200"
                              title="查看購買明細"
                            >
                              <History className="w-3.5 h-3.5" />
                              明細
                            </button>
                            <button 
                              onClick={() => handleOpenEditCustomer(customer)}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="編輯基本資料"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCustomer(customer.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="刪除顧客"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-500">
                      找不到符合條件的顧客資料。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal: 新增/編輯顧客 */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 p-4 text-white">
              <h2 className="text-xl font-bold">{editingCustomer ? '編輯顧客資料' : '新增顧客資料'}</h2>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客戶名稱 <span className="text-red-500">*</span></label>
                  <input required type="text" className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話</label>
                    <input type="tel" className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">生日</label>
                    <input type="date" className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.birthday} onChange={e => setFormData({...formData, birthday: e.target.value})} />
                  </div>
                </div>
                
                {!editingCustomer && (
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">可選填：直接建立第一筆購課紀錄</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">初始堂數</label>
                        <input type="number" min="0" className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" 
                          value={formData.initialSessions} onChange={e => setFormData({...formData, initialSessions: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">初始總金額</label>
                        <input type="number" min="0" className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" 
                          value={formData.initialPrice} onChange={e => setFormData({...formData, initialPrice: e.target.value})} />
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                  <textarea rows="2" className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" 
                    value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                  取消
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                  儲存資料
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: 購買新課程 */}
      {isSessionModalOpen && editingCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-600 p-4 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5"/> 新增購買紀錄</h2>
            </div>
            <form onSubmit={handleSaveSessions} className="p-6">
              <p className="mb-4 text-gray-700">正在為 <strong>{editingCustomer.name}</strong> 登錄新課程。</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">購買日期</label>
                  <input required type="date" className="w-full p-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
                    value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">本次購買堂數</label>
                    <div className="flex items-center gap-1">
                      <input required type="number" min="1" className="w-full p-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500 text-center" 
                        value={sessionToAdd} onChange={e => setSessionToAdd(e.target.value)} />
                      <span className="text-sm text-gray-600">堂</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">本次總消費金</label>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">$</span>
                      <input required type="number" min="0" placeholder="0" className="w-full p-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500 text-center" 
                        value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded border border-gray-200 mt-2">
                  <p className="text-sm text-gray-600 text-center">
                    本次單價約： <span className="font-bold text-gray-800">
                      ${sessionToAdd && purchasePrice ? Math.round(purchasePrice / sessionToAdd).toLocaleString() : 0}
                    </span> / 堂
                  </p>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsSessionModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                  取消
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors">
                  確認結帳
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: 查看購買明細 */}
      {isHistoryModalOpen && editingCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5"/> 
                {editingCustomer.name} 的購買明細
              </h2>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-blue-100 hover:text-white transition-colors text-xl font-bold">
                &times;
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              {editingCustomer.purchases && editingCustomer.purchases.length > 0 ? (
                <div className="space-y-3">
                  {[...editingCustomer.purchases].sort((a, b) => new Date(b.date) - new Date(a.date)).map((purchase, index) => (
                    <div key={purchase.id} className="border border-gray-200 rounded-lg p-3 flex justify-between items-center bg-gray-50 hover:bg-white transition-colors">
                      <div>
                        <p className="font-semibold text-gray-800 flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                            第 {editingCustomer.purchases.length - index} 次購買
                          </span>
                          {purchase.date}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          購買 <span className="font-bold text-indigo-600">{purchase.sessions}</span> 堂 / 
                          花費 <span className="font-bold text-amber-600">${purchase.price.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          換算單價：${Math.round(purchase.price / purchase.sessions).toLocaleString()}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleDeletePurchase(editingCustomer.id, purchase.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="刪除此筆紀錄"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>目前沒有任何購買紀錄</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
               {(() => {
                 const stats = getCustomerStats(editingCustomer.purchases);
                 return (
                   <div className="text-sm text-gray-600">
                     總計：<span className="font-bold text-gray-800">{stats.totalSessions} 堂</span> / 
                     累積消費：<span className="font-bold text-gray-800">${stats.totalSpent.toLocaleString()}</span>
                   </div>
                 );
               })()}
              <button type="button" onClick={() => setIsHistoryModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors">
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認對話框 */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-3">請確認操作</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, confirmText: '確定', confirmStyle: 'danger' })}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 text-white rounded-md transition-colors font-medium ${
                  confirmDialog.confirmStyle === 'primary' 
                    ? 'bg-indigo-600 hover:bg-indigo-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


// ==========================================
// 系統二：店面營收預測總帳 (本地儲存防禦版)
// ==========================================
function RevenueTracker() {
  const defaultData = [
    { id: 1, date: '2023-11-01', income: 6000, consumption: 4000, person: '查' },
    { id: 2, date: '2023-11-01', income: 6000, consumption: 4000, person: '歐' },
    { id: 3, date: '2023-11-02', income: 15000, consumption: 9500, person: '查' },
  ];

  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem('gym_crm_entries_v2');
      if (saved) {
        let parsedData = JSON.parse(saved);
        if (Array.isArray(parsedData)) {
          return parsedData.map(item => {
            if (!item.person) return { ...item, person: '查' };
            if (item.person === '夥伴 A') return { ...item, person: '查' };
            if (item.person === '夥伴 B') return { ...item, person: '歐' };
            if (item.person === '姜佩均') return { ...item, person: '安' };
            return item;
          });
        }
      }
    } catch (error) { console.error("讀取營收資料失敗:", error); }
    return defaultData;
  });

  const [viewMode, setViewMode] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [customerEntries, setCustomerEntries] = useState(() => {
    try {
      const saved = localStorage.getItem('gym_crm_customers_v2');
      if (saved) {
        let parsedData = JSON.parse(saved);
        if (Array.isArray(parsedData)) {
          return parsedData.map(item => {
            if (item.source === '姜佩均') return { ...item, source: '安' };
            return item;
          });
        }
      }
      return [];
    } catch (error) { console.error("讀取客戶資料失敗:", error); return []; }
  });

  const [clientDate, setClientDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientName, setClientName] = useState('');
  const [clientSourceSelect, setClientSourceSelect] = useState('查');
  const [clientSourceInput, setClientSourceInput] = useState('');
  const [clientPaymentMethod, setClientPaymentMethod] = useState('現金');
  const [clientDeposit, setClientDeposit] = useState('');
  const [clientProduct, setClientProduct] = useState('');
  const [clientBurn, setClientBurn] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const [isNewMemberBuy, setIsNewMemberBuy] = useState(false);
  const [isNewMemberReserve, setIsNewMemberReserve] = useState(false);
  const [isOldMemberRenew, setIsOldMemberRenew] = useState(false);
  const [isOldMemberReserve, setIsOldMemberReserve] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    try { localStorage.setItem('gym_crm_entries_v2', JSON.stringify(entries)); } 
    catch (error) {}
  }, [entries]);

  useEffect(() => {
    try { localStorage.setItem('gym_crm_customers_v2', JSON.stringify(customerEntries)); } 
    catch (error) {}
  }, [customerEntries]);

  const handleEditCustomer = (entry) => {
    setEditingId(entry.id);
    setClientDate(entry.date);
    setClientName(entry.name);
    setClientSourceSelect(entry.source);
    setClientSourceInput('');
    setClientPaymentMethod(entry.paymentMethod || '現金');
    setClientDeposit(entry.deposit > 0 ? entry.deposit.toString() : '');
    setClientProduct(entry.product);
    setClientBurn(entry.burn > 0 ? entry.burn.toString() : '');
    setIsNewMemberBuy(entry.isNewMemberBuy || false);
    setIsNewMemberReserve(entry.isNewMemberReserve || false);
    setIsOldMemberRenew(entry.isOldMemberRenew || false);
    setIsOldMemberReserve(entry.isOldMemberReserve || false);
    window.scrollTo({ top: 200, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setClientName('');
    setClientDeposit('');
    setClientProduct('');
    setClientBurn('');
    setClientPaymentMethod('現金');
    setClientSourceSelect('查');
    setClientSourceInput('');
    setIsNewMemberBuy(false);
    setIsNewMemberReserve(false);
    setIsOldMemberRenew(false);
    setIsOldMemberReserve(false);
    setClientDate(new Date().toISOString().split('T')[0]);
  };

  const handleConfirmClearMonth = () => {
    setEntries(prev => prev.filter(e => !e.date.startsWith(selectedMonth)));
    setCustomerEntries(prev => prev.filter(e => !e.date.startsWith(selectedMonth)));
    setShowClearConfirm(false);
    showToast(`已成功清空 ${selectedMonth} 的所有資料`);
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleAddCustomer = (e) => {
    e.preventDefault();
    if (!clientName) return; 

    const depositAmount = Number(clientDeposit) || 0;
    const burnAmount = Number(clientBurn) || 0;
    const targetPerson = clientSourceSelect === 'custom' ? clientSourceInput.trim() : clientSourceSelect;

    if (!targetPerson) {
      showToast('請輸入訓練師名稱');
      return;
    }

    if (editingId) {
      const oldEntry = customerEntries.find(e => e.id === editingId);
      if (!oldEntry) return;

      const updatedEntry = {
        ...oldEntry, date: clientDate, name: clientName, source: targetPerson,
        paymentMethod: clientPaymentMethod, deposit: depositAmount, product: clientProduct,
        burn: burnAmount, isNewMemberBuy, isNewMemberReserve, isOldMemberRenew, isOldMemberReserve
      };

      setCustomerEntries(prev => prev.map(item => item.id === editingId ? updatedEntry : item));

      setEntries(prevEntries => {
        let nextDailyEntries = [...prevEntries];
        const oldDailyIndex = nextDailyEntries.findIndex(d => d.date === oldEntry.date && d.person === oldEntry.source);
        if (oldDailyIndex >= 0) {
          const oldDaily = nextDailyEntries[oldDailyIndex];
          nextDailyEntries[oldDailyIndex] = {
            ...oldDaily,
            income: Math.max(0, oldDaily.income - (oldEntry.deposit || 0)),
            consumption: Math.max(0, oldDaily.consumption - (oldEntry.burn || 0))
          };
          if (nextDailyEntries[oldDailyIndex].income === 0 && nextDailyEntries[oldDailyIndex].consumption === 0) {
              nextDailyEntries.splice(oldDailyIndex, 1);
          }
        }
        
        const newDailyIndex = nextDailyEntries.findIndex(d => d.date === clientDate && d.person === targetPerson);
        if (newDailyIndex >= 0) {
           nextDailyEntries[newDailyIndex] = {
             ...nextDailyEntries[newDailyIndex],
             income: nextDailyEntries[newDailyIndex].income + depositAmount,
             consumption: nextDailyEntries[newDailyIndex].consumption + burnAmount
           };
        } else {
           nextDailyEntries.push({ id: Date.now(), date: clientDate, person: targetPerson, income: depositAmount, consumption: burnAmount });
        }
        return nextDailyEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
      });
      handleCancelEdit();
    } else {
      const newCustomerEntry = {
        id: Date.now(), date: clientDate, name: clientName, source: targetPerson,
        paymentMethod: clientPaymentMethod, deposit: depositAmount, product: clientProduct,
        burn: burnAmount, isNewMemberBuy, isNewMemberReserve, isOldMemberRenew, isOldMemberReserve
      };

      setCustomerEntries(prev => [newCustomerEntry, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
      
      setEntries(prevEntries => {
        const existingIndex = prevEntries.findIndex(e => e.date === clientDate && e.person === targetPerson);
        let nextDailyEntries = [...prevEntries];
        if (existingIndex >= 0) {
          const target = nextDailyEntries[existingIndex];
          nextDailyEntries[existingIndex] = {
            ...target, income: target.income + depositAmount, consumption: target.consumption + burnAmount
          };
        } else {
          nextDailyEntries.push({ id: Date.now() + 1, date: clientDate, person: targetPerson, income: depositAmount, consumption: burnAmount });
        }
        return nextDailyEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
      });

      const newMonth = clientDate.substring(0, 7);
      if (newMonth !== selectedMonth) setSelectedMonth(newMonth);

      setClientName(''); setClientDeposit(''); setClientProduct(''); setClientBurn('');
      setClientPaymentMethod('現金'); setClientSourceSelect('查'); setClientSourceInput('');
      setIsNewMemberBuy(false); setIsNewMemberReserve(false); setIsOldMemberRenew(false); setIsOldMemberReserve(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split(/\r?\n/);
      const parseCSVLine = (line) => {
        const result = []; let current = ''; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') inQuotes = !inQuotes;
          else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
          else current += line[i];
        }
        result.push(current.trim());
        return result;
      };

      const newEntries = [];
      const dailyUpdates = {};

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = parseCSVLine(line);
        if (cols.length < 7) continue;

        const rawDate = cols[0].replace(/"/g, '');
        const dateStr = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
        const name = cols[1].replace(/"/g, '');
        const source = cols[2].replace(/"/g, '');
        const paymentMethod = cols[3].replace(/"/g, '');
        const product = cols[4].replace(/"/g, '');
        const price = Number(cols[5].replace(/"/g, '').replace(/,/g, '')) || 0;
        const burnMethod = cols[6].replace(/"/g, '');
        
        const isNewBuy = cols[7]?.toUpperCase().includes('TRUE');
        const isNewReserve = cols[8]?.toUpperCase().includes('TRUE');
        const isOldRenew = cols[9]?.toUpperCase().includes('TRUE');
        const isOldReserve = cols[10]?.toUpperCase().includes('TRUE');

        const deposit = paymentMethod !== '點數' ? price : 0;
        const burn = burnMethod !== '購課' ? price : 0;

        newEntries.push({
          id: Date.now() + i, date: dateStr, name: name, source: source,
          paymentMethod: paymentMethod, deposit: deposit, product: product, burn: burn,
          isNewMemberBuy: isNewBuy, isNewMemberReserve: isNewReserve, isOldMemberRenew: isOldRenew, isOldMemberReserve: isOldReserve
        });

        const key = `${dateStr}_${source}`;
        if (!dailyUpdates[key]) dailyUpdates[key] = { income: 0, consumption: 0, date: dateStr, person: source };
        dailyUpdates[key].income += deposit;
        dailyUpdates[key].consumption += burn;
      }

      if (newEntries.length > 0) {
        setCustomerEntries(prev => [...newEntries, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
        setEntries(prev => {
            let nextEntries = [...prev];
            Object.values(dailyUpdates).forEach(update => {
                const idx = nextEntries.findIndex(e => e.date === update.date && e.person === update.person);
                if (idx >= 0) {
                    nextEntries[idx] = { ...nextEntries[idx], income: nextEntries[idx].income + update.income, consumption: nextEntries[idx].consumption + update.consumption };
                } else {
                    nextEntries.push({ id: Date.now() + Math.random(), date: update.date, person: update.person, income: update.income, consumption: update.consumption });
                }
            });
            return nextEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
        });
        showToast(`成功匯入 ${newEntries.length} 筆資料！`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportCSV = () => {
    let csvContent = "\uFEFF日期,客戶,訂單來源,入金方式,品名,金額,消化方式,新客購課,新客預約,舊客續課,舊客預約\n";
    filteredCustomers.forEach(e => {
      const dateStr = e.date.replace(/-/g, '');
      const price = Math.max(e.deposit, e.burn);
      const burnMethod = e.burn > 0 ? '使用扣點' : '購課';
      const row = [`"${dateStr}"`, `"${e.name}"`, `"${e.source}"`, `"${e.paymentMethod}"`, `"${e.product}"`, `"${price}"`, `"${burnMethod}"`, e.isNewMemberBuy ? "TRUE" : "FALSE", e.isNewMemberReserve ? "TRUE" : "FALSE", e.isOldMemberRenew ? "TRUE" : "FALSE", e.isOldMemberReserve ? "TRUE" : "FALSE"];
      csvContent += row.join(",") + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `客戶消費紀錄備份_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteCustomer = (id) => {
    const deletedEntry = customerEntries.find(entry => entry.id === id);
    if (!deletedEntry) return;
    setCustomerEntries(customerEntries.filter(entry => entry.id !== id));
    setEntries(prevEntries => {
      let nextDailyEntries = [...prevEntries];
      const dailyIndex = nextDailyEntries.findIndex(d => d.date === deletedEntry.date && d.person === deletedEntry.source);
      if (dailyIndex >= 0) {
        const daily = nextDailyEntries[dailyIndex];
        const newIncome = Math.max(0, daily.income - (deletedEntry.deposit || 0));
        const newConsumption = Math.max(0, daily.consumption - (deletedEntry.burn || 0));
        if (newIncome === 0 && newConsumption === 0) nextDailyEntries.splice(dailyIndex, 1);
        else nextDailyEntries[dailyIndex] = { ...daily, income: newIncome, consumption: newConsumption };
      }
      return nextDailyEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
    });
  };

  const handleDeleteDailyEntry = (id) => setEntries(entries.filter(entry => entry.id !== id));

  const filteredCustomers = useMemo(() => {
    let filtered = customerEntries.filter(entry => entry.date && entry.date.startsWith(selectedMonth));
    if (clientSearch) {
      const lowerSearch = clientSearch.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.name.toLowerCase().includes(lowerSearch) || 
        entry.product.toLowerCase().includes(lowerSearch) ||
        entry.source.toLowerCase().includes(lowerSearch) ||
        (entry.paymentMethod && entry.paymentMethod.toLowerCase().includes(lowerSearch)) ||
        entry.date.includes(lowerSearch)
      );
    }
    return filtered;
  }, [customerEntries, clientSearch, selectedMonth]);

  const visitStats = useMemo(() => {
    let newCount = 0, oldCount = 0, newMemberBuy = 0, newMemberReserve = 0, oldMemberRenew = 0, oldMemberReserve = 0; 
    filteredCustomers.forEach(entry => {
      const product = entry.product || '';
      if (product.includes('訓練課程-新客初次９折優惠')) newCount++;
      else if (product.includes('使用扣點') || product.includes('訓練課程－單次')) oldCount++;
      if (entry.isNewMemberBuy) newMemberBuy++;
      if (entry.isNewMemberReserve) newMemberReserve++;
      if (entry.isOldMemberRenew) oldMemberRenew++;
      if (entry.isOldMemberReserve) oldMemberReserve++;
    });
    return { newCount, oldCount, total: newCount + oldCount, newMemberBuy, newMemberReserve, oldMemberRenew, oldMemberReserve };
  }, [filteredCustomers]);

  const paymentStats = useMemo(() => {
    const stats = { '點數': 0, '現金': 0, '街口': 0, 'Line Pay': 0, '轉帳': 0, '刷卡': 0, 'KLook': 0 };
    filteredCustomers.forEach(entry => {
      const method = entry.paymentMethod;
      if (stats.hasOwnProperty(method)) stats[method] += (entry.deposit || entry.burn || 0);
    });
    return stats;
  }, [filteredCustomers]);

  const filteredEntries = useMemo(() => {
    let filtered = entries.filter(entry => entry.date && entry.date.startsWith(selectedMonth));
    if (viewMode !== 'all') filtered = filtered.filter(entry => entry.person === viewMode);
    return filtered;
  }, [entries, viewMode, selectedMonth]);

  const cumulativeData = useMemo(() => {
    let accIncome = 0, accConsumption = 0;
    return filteredEntries.map(entry => {
      accIncome += entry.income; accConsumption += entry.consumption;
      return { ...entry, accIncome, accConsumption, dayOfMonth: new Date(entry.date).getDate() };
    });
  }, [filteredEntries]);

  const projectionData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate(); 
    
    const calculateRegression = (dataPoints) => {
      if (dataPoints.length < 2) return null;
      const n = dataPoints.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      dataPoints.forEach(p => { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x; });
      const denominator = (n * sumXX - sumX * sumX);
      if (denominator === 0) return null;
      const slope = (n * sumXY - sumX * sumY) / denominator;
      const intercept = (sumY - slope * sumX) / n;
      return { slope, intercept };
    };

    const incomePoints = cumulativeData.map(d => ({ x: d.dayOfMonth, y: d.accIncome }));
    const consumPoints = cumulativeData.map(d => ({ x: d.dayOfMonth, y: d.accConsumption }));
    const incomeReg = calculateRegression(incomePoints);
    const consumReg = calculateRegression(consumPoints);
    
    const fullMonthData = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEntries = cumulativeData.filter(d => d.dayOfMonth === day);
      const lastEntryOfDay = dayEntries.length > 0 ? dayEntries[dayEntries.length - 1] : null;
      let predictedIncome = 0, predictedConsumption = 0;
      if (incomeReg) predictedIncome = incomeReg.slope * day + incomeReg.intercept;
      if (consumReg) predictedConsumption = consumReg.slope * day + consumReg.intercept;

      fullMonthData.push({
        day, dateLabel: `${day}號`,
        actualIncome: lastEntryOfDay ? lastEntryOfDay.accIncome : null,
        actualConsumption: lastEntryOfDay ? lastEntryOfDay.accConsumption : null,
        predIncome: predictedIncome > 0 ? Math.round(predictedIncome) : 0,
        predConsumption: predictedConsumption > 0 ? Math.round(predictedConsumption) : 0,
        dailyIncome: lastEntryOfDay ? lastEntryOfDay.income : 0,
        dailyConsumption: lastEntryOfDay ? lastEntryOfDay.consumption : 0,
      });
    }
    return { fullMonthData, incomeReg, consumReg, daysInMonth };
  }, [cumulativeData, selectedMonth]);

  const stats = useMemo(() => {
    const currentTotalIncome = cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1].accIncome : 0;
    const currentTotalConsumption = cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1].accConsumption : 0;
    const lastDayData = projectionData.fullMonthData[projectionData.fullMonthData.length - 1];
    const projectedTotalIncome = lastDayData ? lastDayData.predIncome : 0;
    const projectedTotalConsumption = lastDayData ? lastDayData.predConsumption : 0;
    return { currentTotalIncome, currentTotalConsumption, projectedTotalIncome, projectedTotalConsumption, count: filteredEntries.length };
  }, [cumulativeData, projectionData, filteredEntries]);

  const uniqueTrainers = useMemo(() => {
    const trainers = new Set(['查', '歐', '安']); 
    entries.filter(e => e.date && e.date.startsWith(selectedMonth)).forEach(e => trainers.add(e.person));
    customerEntries.filter(e => e.date && e.date.startsWith(selectedMonth)).forEach(e => trainers.add(e.source));
    return Array.from(trainers);
  }, [entries, customerEntries, selectedMonth]);

  const getPersonBadgeStyle = (personName) => {
    switch (personName) {
      case '查': return 'bg-blue-50 text-blue-700';
      case '歐': return 'bg-purple-50 text-purple-700';
      case '安': return 'bg-orange-50 text-orange-700';
      default: return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const getPaymentMethodStyle = (method) => {
    switch (method) {
      case '現金': return 'bg-green-50 text-green-700 border-green-200';
      case '刷卡': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case '轉帳': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'Line Pay': return 'bg-green-50 text-[#00C300] border-green-200';
      case '街口': return 'bg-red-50 text-red-600 border-red-200';
      case 'KLook': return 'bg-orange-50 text-orange-600 border-orange-200';
      case '點數': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const formatYAxis = (value) => (value / 10000).toFixed(1) + '萬';

  return (
    <div className="bg-slate-50 text-slate-800 p-4 font-sans relative pb-10">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Calculator className="text-blue-600" />
                伸動保健室營收與消化預測
              </h1>
              <p className="text-slate-500 text-sm mt-1">團隊業績追蹤與線性迴歸分析</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
               <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <CalendarDays size={18} className="text-blue-500 mr-2" />
                  <input type="month" value={selectedMonth} onChange={(e) => { if(e.target.value) setSelectedMonth(e.target.value); }} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" />
               </div>
               <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                 <button onClick={() => setViewMode('all')} className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                   <Users size={16} /> 總覽
                 </button>
                 {uniqueTrainers.map(trainer => (
                   <button key={trainer} onClick={() => setViewMode(trainer)} className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${viewMode === trainer ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                     <User size={16} /> {trainer}
                   </button>
                 ))}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={`${selectedMonth} 累積入金 (${viewMode === 'all' ? '總計' : viewMode})`} value={stats.currentTotalIncome} color="text-emerald-700" bgColor="bg-emerald-50" icon={<TrendingUp size={20} />} />
            <StatCard title={`${selectedMonth} 預測入金 (${viewMode === 'all' ? '總計' : viewMode})`} value={stats.projectedTotalIncome} subValue={`較目前增加 ${Math.round(stats.projectedTotalIncome - stats.currentTotalIncome).toLocaleString()}`} color="text-emerald-600" isProjection />
            <StatCard title={`${selectedMonth} 累積消化 (${viewMode === 'all' ? '總計' : viewMode})`} value={stats.currentTotalConsumption} color="text-amber-700" bgColor="bg-amber-50" icon={<TrendingDown size={20} />} />
            <StatCard title={`${selectedMonth} 預測消化 (${viewMode === 'all' ? '總計' : viewMode})`} value={stats.projectedTotalConsumption} subValue={`較目前增加 ${Math.round(stats.projectedTotalConsumption - stats.currentTotalConsumption).toLocaleString()}`} color="text-amber-600" isProjection />
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">{viewMode === 'all' ? '全公司' : viewMode} 趨勢與預測 ({selectedMonth})</h3>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> 實際入金</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-emerald-400 border-dashed rounded-full"></div> 預測入金</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded-full"></div> 實際消化</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-amber-500 border-dashed rounded-full"></div> 預測消化</span>
                </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projectionData.fullMonthData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="dateLabel" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={formatYAxis} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="predIncome" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} name="預測入金" />
                    <Line type="monotone" dataKey="predConsumption" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} name="預測消化" />
                    <Area type="monotone" dataKey="actualIncome" stroke="#059669" fill="#059669" fillOpacity={0.1} strokeWidth={3} name="實際入金" />
                    <Area type="monotone" dataKey="actualConsumption" stroke="#d97706" fill="#d97706" fillOpacity={0.1} strokeWidth={3} name="實際消化" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingBag className="text-purple-600" />
                    {selectedMonth} 營收與預約明細
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">獨立於點數系統外，專門記錄每日財務金流狀況</p>
                </div>
                
                <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                  <button onClick={handleExportCSV} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                    <Save size={16} /> 下載本月備份
                  </button>
                  <label className="cursor-pointer bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors m-0">
                      <Upload size={16} /> 匯入 CSV
                      <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                  <button onClick={() => setShowClearConfirm(true)} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                    <Trash2 size={16} /> 清空本月資料
                  </button>
                  <div className="relative w-full sm:w-64 mt-2 sm:mt-0">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="搜尋日期、客戶、品項..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all" />
                  </div>
                </div>
              </div>

              <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all duration-300 ${editingId ? 'ring-2 ring-blue-400' : ''}`}>
                 <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 justify-between">
                   <span className="flex items-center gap-2">
                      {editingId ? <Edit className="w-4 h-4 text-blue-600"/> : <Plus className="w-4 h-4 text-purple-600"/>}
                      {editingId ? '編輯消費紀錄' : '新增消費紀錄 (自動同步至總帳與對應月份)'}
                   </span>
                   {editingId && (
                     <button onClick={handleCancelEdit} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200">
                       <X size={12}/> 取消編輯
                     </button>
                   )}
                 </h3>
                 <form onSubmit={handleAddCustomer}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 items-end mb-4">
                      <div className="lg:col-span-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">日期</label>
                        <input type="date" required value={clientDate} onChange={(e) => setClientDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-purple-500 outline-none text-sm" />
                      </div>
                      <div className="lg:col-span-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">客戶名稱</label>
                        <input type="text" required placeholder="姓名" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-purple-500 outline-none text-sm" />
                      </div>
                      <div className="lg:col-span-1">
                         <label className="block text-xs font-medium text-slate-500 mb-1">訓練師</label>
                         {clientSourceSelect === 'custom' ? (
                           <div className="flex gap-1">
                             <input type="text" placeholder="輸入名稱" value={clientSourceInput} onChange={(e) => setClientSourceInput(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-purple-500 outline-none text-sm" autoFocus />
                             <button type="button" onClick={() => { setClientSourceSelect('查'); setClientSourceInput(''); }} className="px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"><X size={14}/></button>
                           </div>
                         ) : (
                           <select value={clientSourceSelect} onChange={(e) => setClientSourceSelect(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-purple-500 outline-none text-sm bg-white">
                             {uniqueTrainers.map(t => <option key={t} value={t}>{t}</option>)}
                             <option value="custom">➕ 其他 (手動輸入)</option>
                           </select>
                         )}
                      </div>
                      <div className="lg:col-span-1">
                         <label className="block text-xs font-medium text-slate-500 mb-1">來源</label>
                         <select value={clientPaymentMethod} onChange={(e) => setClientPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-purple-500 outline-none text-sm bg-white">
                           <option value="點數">點數</option>
                           <option value="現金">現金</option>
                           <option value="街口">街口</option>
                           <option value="Line Pay">Line Pay</option>
                           <option value="轉帳">轉帳</option>
                           <option value="刷卡">刷卡</option>
                           <option value="KLook">KLook</option>
                         </select>
                      </div>
                      <div className="lg:col-span-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">入金金額</label>
                        <input type="number" placeholder="0" value={clientDeposit} onChange={(e) => setClientDeposit(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-emerald-500 outline-none text-sm" />
                      </div>
                      <div className="lg:col-span-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">品名</label>
                        <input type="text" list="product-options" placeholder="購買項目" value={clientProduct} onChange={(e) => setClientProduct(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-purple-500 outline-none text-sm" />
                        <datalist id="product-options">
                          <option value="使用扣點" />
                          <option value="訓練課程－單次" />
                          <option value="訓練課程-新客初次９折優惠" />
                          <option value="訓練課程-軟QQ方案-５堂" />
                          <option value="訓練課程-軟QQ方案-２５堂" />
                          <option value="訓練課程-軟QQQ方案" />
                          <option value="訓練課程-優惠方案" />
                        </datalist>
                      </div>
                      <div className="lg:col-span-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">消化金額</label>
                        <div className="flex gap-2">
                           <input type="number" placeholder="0" value={clientBurn} onChange={(e) => setClientBurn(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-amber-500 outline-none text-sm" />
                           <button type="submit" className={`${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'} text-white rounded-lg px-3 py-2 transition-colors flex items-center gap-1 shrink-0`}>
                             <Save size={16}/> {editingId ? '更新' : ''}
                           </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                       <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${isNewMemberBuy ? 'bg-pink-50 border-pink-200 ring-1 ring-pink-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                          <input type="checkbox" checked={isNewMemberBuy} onChange={(e) => setIsNewMemberBuy(e.target.checked)} className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500" />
                          <span className={`text-sm font-medium ${isNewMemberBuy ? 'text-pink-700' : 'text-slate-600'}`}>新客購課</span>
                       </label>
                       <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${isNewMemberReserve ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                          <input type="checkbox" checked={isNewMemberReserve} onChange={(e) => setIsNewMemberReserve(e.target.checked)} className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
                          <span className={`text-sm font-medium ${isNewMemberReserve ? 'text-purple-700' : 'text-slate-600'}`}>新客預約</span>
                       </label>
                       <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${isOldMemberRenew ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                          <input type="checkbox" checked={isOldMemberRenew} onChange={(e) => setIsOldMemberRenew(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                          <span className={`text-sm font-medium ${isOldMemberRenew ? 'text-indigo-700' : 'text-slate-600'}`}>舊客續課</span>
                       </label>
                       <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${isOldMemberReserve ? 'bg-cyan-50 border-cyan-200 ring-1 ring-cyan-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                          <input type="checkbox" checked={isOldMemberReserve} onChange={(e) => setIsOldMemberReserve(e.target.checked)} className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500" />
                          <span className={`text-sm font-medium ${isOldMemberReserve ? 'text-cyan-700' : 'text-slate-600'}`}>舊客預約</span>
                       </label>
                    </div>
                 </form>

                 <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="flex items-center gap-2 mb-3">
                       <Users size={16} className="text-slate-400"/>
                       <h4 className="text-sm font-bold text-slate-700">本月來店人次統計</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                       <div className="p-4 rounded-xl border border-blue-100 bg-blue-50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm"><UserCheck size={18}/></div>
                            <div><div className="text-xs text-blue-600 font-medium opacity-80">舊客人次</div><div className="text-xs text-slate-400 scale-90 origin-left">使用扣點 / 單次</div></div>
                          </div>
                          <div className="text-xl font-bold text-blue-700">{visitStats.oldCount}</div>
                       </div>
                       <div className="p-4 rounded-xl border border-rose-100 bg-rose-50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg text-rose-600 shadow-sm"><UserPlus size={18}/></div>
                            <div><div className="text-xs text-rose-600 font-medium opacity-80">新客人次</div><div className="text-xs text-slate-400 scale-90 origin-left">初次體驗 (9折)</div></div>
                          </div>
                          <div className="text-xl font-bold text-rose-700">{visitStats.newCount}</div>
                       </div>
                       <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg text-slate-600 shadow-sm"><Users size={18}/></div>
                            <div className="text-xs text-slate-600 font-medium">來店總人次</div>
                          </div>
                          <div className="text-xl font-bold text-slate-700">{visitStats.total}</div>
                       </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                         <div className="p-3 rounded-xl border border-pink-100 bg-pink-50 flex flex-col items-center justify-center text-center">
                            <div className="text-xs text-pink-600 mb-1 font-medium flex items-center gap-1"><CreditCard size={12}/> 新客購課</div>
                            <div className="text-lg font-bold text-pink-700">{visitStats.newMemberBuy}</div>
                         </div>
                         <div className="p-3 rounded-xl border border-purple-100 bg-purple-50 flex flex-col items-center justify-center text-center">
                            <div className="text-xs text-purple-600 mb-1 font-medium flex items-center gap-1"><CalendarCheck size={12}/> 新客預約</div>
                            <div className="text-lg font-bold text-purple-700">{visitStats.newMemberReserve}</div>
                         </div>
                         <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50 flex flex-col items-center justify-center text-center">
                             <div className="text-xs text-indigo-600 mb-1 font-medium flex items-center gap-1"><BookOpen size={12}/> 舊客續課</div>
                             <div className="text-lg font-bold text-indigo-700">{visitStats.oldMemberRenew}</div>
                         </div>
                         <div className="p-3 rounded-xl border border-cyan-100 bg-cyan-50 flex flex-col items-center justify-center text-center">
                             <div className="text-xs text-cyan-600 mb-1 font-medium flex items-center gap-1"><CalendarCheck size={12}/> 舊客預約</div>
                             <div className="text-lg font-bold text-cyan-700">{visitStats.oldMemberReserve}</div>
                         </div>
                    </div>
                 </div>

                 <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="flex items-center gap-2 mb-3">
                       <PieChart size={16} className="text-slate-400"/>
                       <h4 className="text-sm font-bold text-slate-700">本月來源</h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                      {Object.entries(paymentStats).map(([method, amount]) => {
                          const baseStyle = getPaymentMethodStyle(method);
                          const cardStyle = baseStyle.replace('text-', 'border-').replace('bg-', 'bg-opacity-20 ');
                          return (
                              <div key={method} className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center ${cardStyle}`}>
                                 <div className="text-xs text-slate-500 mb-1 opacity-80">{method}</div>
                                 <div className="text-sm font-bold text-slate-700">${amount.toLocaleString()}</div>
                              </div>
                          );
                      })}
                    </div>
                 </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-sm text-slate-500 uppercase bg-purple-50 border-b border-purple-100">
                        <tr>
                          <th className="px-2 py-3 text-center w-8 whitespace-nowrap">#</th>
                          <th className="px-2 py-3 whitespace-nowrap">日期</th>
                          <th className="px-2 py-3 whitespace-nowrap">客戶名稱</th>
                          <th className="px-2 py-3 whitespace-nowrap">訓練師</th>
                          <th className="px-2 py-3 whitespace-nowrap">來源</th>
                          <th className="px-2 py-3 text-right whitespace-nowrap">入金</th>
                          <th className="px-2 py-3 whitespace-nowrap">品名</th>
                          <th className="px-2 py-3 text-right whitespace-nowrap">消化</th>
                          <th className="px-2 py-3 whitespace-nowrap">預約/購課</th>
                          <th className="px-2 py-3 text-center whitespace-nowrap">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map((entry, index) => {
                             const paymentStyle = entry.paymentMethod ? getPaymentMethodStyle(entry.paymentMethod) : '';
                             return (
                               <tr key={entry.id} className={`border-b border-slate-50 hover:bg-slate-50 ${editingId === entry.id ? 'bg-blue-50' : 'bg-white'}`}>
                                 <td className="px-2 py-3 text-center text-slate-400 font-mono text-sm whitespace-nowrap">
                                   {filteredCustomers.length - index}
                                 </td>
                                 <td className="px-2 py-3 font-medium text-slate-500 text-sm whitespace-nowrap">{entry.date}</td>
                                 <td className="px-2 py-3 font-bold text-slate-800 text-sm whitespace-nowrap">{entry.name}</td>
                                 <td className="px-2 py-3 text-sm whitespace-nowrap">
                                   <span className={`px-2 py-1 rounded text-sm font-medium ${getPersonBadgeStyle(entry.source)}`}>
                                     {entry.source}
                                   </span>
                                 </td>
                                 <td className="px-2 py-3 text-sm whitespace-nowrap">
                                   {entry.paymentMethod && (
                                     <span className={`px-2 py-1 rounded border text-sm font-medium flex items-center w-fit gap-1 ${paymentStyle}`}>
                                       <Wallet size={12}/>
                                       {entry.paymentMethod}
                                     </span>
                                   )}
                                 </td>
                                 <td className="px-2 py-3 text-right font-medium text-emerald-600 text-sm whitespace-nowrap">
                                   {entry.deposit > 0 ? `$${entry.deposit.toLocaleString()}` : '-'}
                                 </td>
                                 <td className="px-2 py-3 text-slate-700 text-sm whitespace-nowrap">{entry.product}</td>
                                 <td className="px-2 py-3 text-right font-medium text-amber-600 text-sm whitespace-nowrap">
                                   {entry.burn > 0 ? `$${entry.burn.toLocaleString()}` : '-'}
                                 </td>
                                 <td className="px-2 py-3 text-sm whitespace-nowrap">
                                    <div className="flex gap-1">
                                       {entry.isNewMemberBuy && <span className="px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-700 border border-pink-200">新購</span>}
                                       {entry.isNewMemberReserve && <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">新約</span>}
                                       {entry.isOldMemberRenew && <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">舊續</span>}
                                       {entry.isOldMemberReserve && <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700 border border-cyan-200">舊約</span>}
                                    </div>
                                 </td>
                                 <td className="px-2 py-3 text-center flex items-center justify-center gap-2 text-sm whitespace-nowrap">
                                   <button onClick={() => handleEditCustomer(entry)} className="text-blue-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50" title="編輯"><Edit size={16} /></button>
                                   <button onClick={() => handleDeleteCustomer(entry.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50" title="刪除"><Trash2 size={16} /></button>
                                 </td>
                               </tr>
                             );
                          })
                        ) : (
                          <tr>
                            <td colSpan="10" className="px-2 py-12 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-2"><ShoppingBag className="w-8 h-8 text-slate-200"/><p>本月尚無客戶紀錄</p></div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                 </div>
              </div>
            </div>

          </div>
        </div>

        <div className="border-t border-slate-200 my-8"></div>

        {/* SECTION 2: 詳細記錄 */}
        <div className="space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700">詳細記錄 ({viewMode === 'all' ? '全部' : viewMode}) - 本月總帳</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-sm text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-2 py-3 whitespace-nowrap">日期</th>
                    <th className="px-2 py-3 whitespace-nowrap">訓練師</th>
                    <th className="px-2 py-3 text-right whitespace-nowrap">入金</th>
                    <th className="px-2 py-3 text-right whitespace-nowrap">消化</th>
                    <th className="px-2 py-3 text-center whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length > 0 ? (
                    filteredEntries.map((entry) => (
                      <tr key={entry.id} className="bg-white border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-2 py-3 font-medium text-slate-900 text-sm whitespace-nowrap">{entry.date}</td>
                        <td className="px-2 py-3 text-sm whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-sm font-medium ${getPersonBadgeStyle(entry.person)}`}>{entry.person}</span>
                        </td>
                        <td className="px-2 py-3 text-right text-emerald-600 font-medium text-sm whitespace-nowrap">{entry.income.toLocaleString()}</td>
                        <td className="px-2 py-3 text-right text-amber-600 font-medium text-sm whitespace-nowrap">{entry.consumption.toLocaleString()}</td>
                        <td className="px-2 py-3 text-center text-sm whitespace-nowrap">
                          <button onClick={() => handleDeleteDailyEntry(entry.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50" title="刪除資料"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-2 py-8 text-center text-slate-400">本月尚無總帳紀錄</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
               <AlertTriangle size={24} />
               <h3 className="text-xl font-bold">確定要清空 {selectedMonth} 的資料嗎？</h3>
            </div>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              這個操作將會永久刪除<strong>這個月（{selectedMonth}）的「明細」與「每日營收總帳」</strong>。<br/><br/>
              建議您在清空前，先點擊「下載本月備份」將資料存回電腦。
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors">取消</button>
              <button onClick={handleConfirmClearMonth} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-red-200">確定清空本月</button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <CheckSquare size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 主應用程式 (結合雙系統切換)
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('revenue');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* 雙頁籤導航列 */}
      <div className="w-full bg-white border-b border-slate-200 sticky top-0 z-[60] px-4 py-4 flex justify-center gap-4 shadow-sm">
        <button
          onClick={() => setActiveTab('revenue')}
          className={`px-6 py-2.5 flex items-center gap-2 rounded-full font-bold text-sm transition-all ${
            activeTab === 'revenue' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-600 ring-offset-2' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Calculator size={18} />
          財務營收總帳
        </button>
        <button
          onClick={() => setActiveTab('crm')}
          className={`px-6 py-2.5 flex items-center gap-2 rounded-full font-bold text-sm transition-all ${
            activeTab === 'crm' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <BookOpen size={18} />
          顧客課程紀錄系統
        </button>
      </div>

      {/* 內容區塊 */}
      <div className="flex-1 w-full">
        {activeTab === 'revenue' && <RevenueTracker />}
        {activeTab === 'crm' && <CRMSystem />}
      </div>
    </div>
  );
}
