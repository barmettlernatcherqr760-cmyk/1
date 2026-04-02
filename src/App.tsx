import React, { useState, useEffect } from "react";
import { Search, Download, ExternalLink, Play, Calendar, ChevronLeft, ChevronRight, Loader2, Settings, X, Info, Tag, Globe, Star, DollarSign, Store, Package, Clock, ArrowUp, TrendingUp, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 可视化呈现增长率标签的小组件 (上升红色，下降绿色)
const GrowthBadge = ({ value, label }: { value?: number, label: string }) => {
  if (value === undefined) return null;
  const isPositive = value >= 0;
  return (
    <div className={cn("text-[11px] font-medium flex items-center gap-0.5", isPositive ? "text-red-500" : "text-green-500")}>
      <span className="text-gray-400 mr-0.5">{label}</span>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </div>
  );
};

interface VideoItem {
  id: string;
  description: string;
  create_time: string;
  revenue: number;
  sale: number;
  views: number;
  ad: number;
  mp4Url: string;
  handle: string;
  duration: string;
  tiktokVideoUrl: string;
  tiktokHomepageUrl: string;
  coverImageUrl: string;
  isAd: boolean;
}

interface ProductInfo {
  images: string[];
  totalCreators: number;
  totalVideos: number;
  price?: string | number;
  category?: string;
  rating?: string | number;
  title?: string;
  brand?: string;
  collectDay?: string;
  stock?: string | number;
  
  range_sale?: string;
  range_revenue?: string;
  recent_3_sale?: string;
  recent_3_revenue?: string;
  prev_3_sale?: string;
  prev_3_revenue?: string;
  growth_3_sale?: number;
  growth_3_revenue?: number;
  recent_7_sale?: string;
  recent_7_revenue?: string;
  prev_7_sale?: string;
  prev_7_revenue?: string;
  growth_7_sale?: number;
  growth_7_revenue?: number;
}

const TIME_RANGES = [
  { label: "昨日", value: 1 },
  { label: "过去7天", value: 7 },
  { label: "过去30天", value: 30 },
  { label: "过去90天", value: 90 },
  { label: "过去180天", value: 180 },
];

const SORT_OPTIONS = [
  { label: "成交金额", value: "revenue" },
  { label: "观看次数", value: "views" },
  { label: "销量", value: "sale" },
  { label: "发布日期", value: "create_time" },
];

const REGIONS = [
  { label: "🇺🇸 美国", country: "US", currency: "USD" },
  { label: "🇲🇽 墨西哥", country: "MX", currency: "MXN" },
  { label: "🇬🇧 英国", country: "GB", currency: "GBP" },
  { label: "🇪🇸 西班牙", country: "ES", currency: "EUR" },
  { label: "🇩🇪 德国", country: "DE", currency: "EUR" },
  { label: "🇫🇷 法国", country: "FR", currency: "EUR" },
  { label: "🇮🇹 意大利", country: "IT", currency: "EUR" },
];

export default function App() {
  const [pid, setPid] = useState("");
  const [timeRange, setTimeRange] = useState(7);
  const [sortBy, setSortBy] = useState("revenue");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ total: number; list: VideoItem[]; product?: ProductInfo } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedRegion, setSelectedRegion] = useState(REGIONS[0]);
  const [targetCurrency, setTargetCurrency] = useState<"LOCAL" | "CNY">("LOCAL");

  const [showSettings, setShowSettings] = useState(false);
  const [customCookie, setCustomCookie] = useState(() => localStorage.getItem("kalodata_cookie") || "");

  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [isImgModalOpen, setIsImgModalOpen] = useState(false);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  const [jumpPage, setJumpPage] = useState("");
  const [showTopBtn, setShowTopBtn] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowTopBtn(true);
      } else {
        setShowTopBtn(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fetchData = async (pageNum = 1, overrideTimeRange?: number) => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    setCurrentImgIdx(0);
    
    const activeTimeRange = overrideTimeRange !== undefined ? overrideTimeRange : timeRange;
    const today = new Date();
    
    // 【修改点】Kalodata 有两天延迟，以 T-2 为最新数据基准
    const baseTime = today.getTime() - 2 * 86400000;
    const endDate = new Date(baseTime).toISOString().split('T')[0];
    const startDate = new Date(baseTime - (activeTimeRange - 1) * 86400000).toISOString().split('T')[0];

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid,
          startDate,
          endDate,
          sortBy,
          pageNo: pageNum,
          pageSize: 10,
          cookie: customCookie,
          country: selectedRegion.country,
          currency: targetCurrency === "CNY" ? "CNY" : selectedRegion.currency
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("403 Forbidden: Cookie 已过期或被拦截。请在设置中更新最新的 Cookie。");
        }
        throw new Error(result.error || "获取数据失败");
      }
      
      setData(result);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchData(1);
  };

  const handlePageChange = (newPage: number) => {
    const totalPages = Math.ceil((data?.total || 0) / 10);
    if (newPage >= 1 && newPage <= totalPages) {
      fetchData(newPage);
      scrollToTop();
    }
  };

  const handleJumpPage = () => {
    const p = parseInt(jumpPage);
    const totalPages = Math.ceil((data?.total || 0) / 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      handlePageChange(p);
    }
    setJumpPage("");
  };

  const [isTesting, setIsTesting] = useState(false);

  const testConnection = async () => {
    if (!pid) {
      setError("请先输入一个 PID 进行测试");
      return;
    }
    setIsTesting(true);
    setError(null);
    try {
      const today = new Date();
      // 【修改点】测试连接同样对齐 T-2 基准
      const baseTime = today.getTime() - 2 * 86400000;
      const endDate = new Date(baseTime).toISOString().split('T')[0];
      const startDate = new Date(baseTime - 6 * 86400000).toISOString().split('T')[0];
      
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid,
          startDate,
          endDate,
          sortBy: "revenue",
          pageNo: 1,
          pageSize: 1,
          cookie: customCookie,
          country: selectedRegion.country,
          currency: targetCurrency === "CNY" ? "CNY" : selectedRegion.currency
        }),
      });
      
      const result = await response.json();
      if (response.ok) {
        alert(`连接成功！检测到该产品共有 ${result.total} 条视频数据。`);
      } else {
        throw new Error(result.error || "连接失败");
      }
    } catch (err: any) {
      setError(`测试失败: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const saveCookie = () => {
    localStorage.setItem("kalodata_cookie", customCookie);
    setShowSettings(false);
  };

  const getCurrencySymbol = () => {
    if (targetCurrency === "CNY") return "¥";
    switch (selectedRegion.currency) {
      case "USD": return "$";
      case "GBP": return "£";
      case "EUR": return "€";
      case "MXN": return "$";
      default: return "";
    }
  };

  const formatNumber = (val: any) => {
    const symbol = getCurrencySymbol();
    if (val === null || val === undefined) return `${symbol}0`;
    const strVal = String(val).replace(/^[¥$£€]/, '').trim();
    if (/[万wWkK]/.test(strVal)) return `${symbol}${strVal}`;
    const num = Number(strVal.replace(/,/g, ''));
    if (isNaN(num)) return `${symbol}${strVal}`;
    if (num >= 10000) return `${symbol}${(num / 10000).toFixed(2)}万`;
    return `${symbol}${num.toLocaleString()}`;
  };

  const formatViews = (num: number) => {
    if (num >= 10000) return `${(num / 10000).toFixed(2)}万`;
    return num.toLocaleString();
  };

  // 根据当前选择找到对应的按钮Label作为标题使用
  const timeLabel = TIME_RANGES.find(r => r.value === timeRange)?.label || "所选时间段";

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#333] font-sans p-6 relative">
      <div className="max-w-7xl mx-auto space-y-6">
       {/* Brand Bar */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 flex items-center justify-center bg-transparent">
            <img 
              src="/logo.png" 
              alt="乘丰 Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter flex items-center gap-1">
              乘丰<span className="text-[#1A7F82]">·找对标</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">找准对标 · 拍出爆款</p>
          </div>
        </div>

        {/* Header / Search Bar */}
        <header className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] h-10 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="请输入产品PID"
              className="w-full h-full pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1A7F82] transition-all text-sm"
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <div className="flex items-center gap-2 h-10">
            <Globe className="w-4 h-4 text-gray-400" />
            <select
              value={selectedRegion.country}
              onChange={(e) => {
                const region = REGIONS.find(r => r.country === e.target.value);
                if (region) setSelectedRegion(region);
              }}
              className="h-full px-3 pr-8 bg-gray-50 border border-gray-200 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1A7F82] transition-all cursor-pointer appearance-none outline-none"
              style={{ backgroundSize: '1em', backgroundPosition: 'right 0.5em center', backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat' }}
            >
              {REGIONS.map(r => (
                <option key={r.country} value={r.country}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border border-gray-200 h-10">
            <button
              onClick={() => {
                setTargetCurrency("LOCAL");
                if (pid) fetchData(1);
              }}
              className={cn(
                "px-3 h-full text-xs rounded-full transition-all whitespace-nowrap",
                targetCurrency === "LOCAL" ? "bg-white text-[#1A7F82] shadow-sm font-bold" : "text-gray-500 hover:text-gray-700"
              )}
            >
              当地货币
            </button>
            <button
              onClick={() => {
                setTargetCurrency("CNY");
                if (pid) fetchData(1);
              }}
              className={cn(
                "px-3 h-full text-xs rounded-full transition-all whitespace-nowrap",
                targetCurrency === "CNY" ? "bg-white text-[#1A7F82] shadow-sm font-bold" : "text-gray-500 hover:text-gray-700"
              )}
            >
              人民币
            </button>
          </div>
          
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border border-gray-200 h-10 hidden lg:flex">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => {
                  setTimeRange(range.value);
                  if (pid) {
                    fetchData(1, range.value);
                  }
                }}
                className={cn(
                  "px-3 h-full text-xs rounded-full transition-all whitespace-nowrap",
                  timeRange === range.value
                    ? "bg-white text-[#1A7F82] shadow-sm font-bold"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 h-10">
            <button
              onClick={handleSearch}
              disabled={loading || !pid}
              className="bg-[#1A7F82] hover:bg-[#156A6C] disabled:bg-teal-200 text-white px-8 h-full rounded-full font-bold transition-all flex items-center gap-2 shadow-md shadow-teal-100 active:scale-95"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              开始抓取
            </button>
          </div>
        </header>
        
        {/* Product Overview */}
        {data?.product && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                <Play className="w-3 h-3 fill-current" />
                产品主图
              </h3>
              {data.product.images.length > 0 ? (
                <div className="relative w-full aspect-square bg-gray-50 rounded-xl overflow-hidden group">
                  <img 
                    src={data.product.images[currentImgIdx]} 
                    alt="产品主图" 
                    className="w-full h-full object-contain cursor-zoom-in transition-transform duration-300 group-hover:scale-105" 
                    referrerPolicy="no-referrer"
                    onClick={() => setIsImgModalOpen(true)}
                  />
                  {data.product.images.length > 1 && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentImgIdx(prev => prev === 0 ? data.product!.images.length - 1 : prev - 1); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentImgIdx(prev => prev === data.product!.images.length - 1 ? 0 : prev + 1); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
                        {currentImgIdx + 1} / {data.product.images.length}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-square bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 text-sm italic">
                  暂无图片
                </div>
              )}
            </div>

            <div className="md:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3"/>产品价格</p>
                    <p className="text-xl font-bold text-gray-800">{data.product.price || '未知'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Store className="w-3 h-3"/>店铺名称</p>
                    <p className="text-xl font-bold text-gray-800 line-clamp-1" title={data.product.brand}>{data.product.brand || '未知'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Package className="w-3 h-3"/>当前库存</p>
                    <p className="text-xl font-bold text-gray-800">{data.product.stock || '未知'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Tag className="w-3 h-3"/>产品类目</p>
                    <p className="text-base font-bold text-gray-800 line-clamp-2" title={data.product.category}>{data.product.category || '未知'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Star className="w-3 h-3"/>产品评分</p>
                    <p className="text-xl font-bold text-[#f59e0b]">{data.product.rating || '暂无'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3"/>最早收录</p>
                    <p className="text-xl font-bold text-gray-800">{data.product.collectDay || '未知'}</p>
                  </div>
              </div>

              {/* === 【核心新增功能：销售表现与环比追踪区域】 === */}
              <div className="bg-gray-50/70 p-4 rounded-xl mt-4 border border-gray-100">
                <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-[#1A7F82]" />
                  销售表现与环比追踪
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 当前所选范围 */}
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <p className="text-xs text-gray-500 mb-2 font-bold">{timeLabel} 合计</p>
                    <div className="space-y-1">
                      <p className="text-2xl font-black text-[#1A7F82]">{data.product.range_sale} <span className="text-xs font-normal text-gray-400">件</span></p>
                      <p className="text-lg font-bold text-gray-800">{data.product.range_revenue}</p>
                    </div>
                  </div>

                  {/* 近3天 */}
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs text-gray-500 font-bold">近3天走势</p>
                      <div className="flex gap-2">
                        <GrowthBadge value={data.product.growth_3_sale} label="销量" />
                        <GrowthBadge value={data.product.growth_3_revenue} label="金额" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-[10px] text-gray-400 mb-0.5">最近三天</p>
                        <p className="font-bold text-[#1A7F82]">{data.product.recent_3_sale}件</p>
                        <p className="font-bold text-gray-800">{data.product.recent_3_revenue}</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-[10px] text-gray-400 mb-0.5">之前三天</p>
                        <p className="font-bold text-gray-500">{data.product.prev_3_sale}件</p>
                        <p className="font-bold text-gray-500">{data.product.prev_3_revenue}</p>
                      </div>
                    </div>
                  </div>

                  {/* 近7天 */}
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs text-gray-500 font-bold">近7天走势</p>
                      <div className="flex gap-2">
                        <GrowthBadge value={data.product.growth_7_sale} label="销量" />
                        <GrowthBadge value={data.product.growth_7_revenue} label="金额" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-[10px] text-gray-400 mb-0.5">最近七天</p>
                        <p className="font-bold text-[#1A7F82]">{data.product.recent_7_sale}件</p>
                        <p className="font-bold text-gray-800">{data.product.recent_7_revenue}</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-[10px] text-gray-400 mb-0.5">之前七天</p>
                        <p className="font-bold text-gray-500">{data.product.prev_7_sale}件</p>
                        <p className="font-bold text-gray-500">{data.product.prev_7_revenue}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-8 items-center pt-2 border-t border-gray-100 mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-gray-400">总达人数</span>
                  <span className="text-2xl font-black text-[#1A7F82]">{data.product.totalCreators.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-gray-400">总视频数</span>
                  <span className="text-2xl font-black text-[#1A7F82]">{data.product.totalVideos.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              >
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-600" />
                    抓取设置
                  </h3>
                  <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      Kalodata Cookie
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">必填</span>
                    </label>
                    <textarea
                      value={customCookie}
                      onChange={(e) => setCustomCookie(e.target.value)}
                      placeholder="请粘贴来自 kalodata.com 的完整 Cookie 字符串..."
                      className="w-full h-32 p-3 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                    />
                    <div className="flex gap-2 p-3 bg-blue-50 rounded-lg text-[11px] text-blue-700">
                      <Info className="w-4 h-4 flex-shrink-0" />
                      <p>
                        如果出现 403 错误，请在浏览器中登录 Kalodata，按 F12 打开控制台，在 Network 标签页找到任意请求，复制其 Request Headers 中的 <b>Cookie</b> 字段并粘贴到此处。
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-gray-50/50 flex justify-between items-center gap-3">
                  <button
                    onClick={testConnection}
                    disabled={isTesting || !pid}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    测试连接
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSettings(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveCookie}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                    >
                      保存设置
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Main Content (Table) */}
        <main className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                视频与广告 <span className="text-gray-400 font-normal text-base">({data?.total || 0} 条)</span>
              </h2>
              {/* 【修改点】UI 展示同步修正为 T-2 到 T-(range+1) 展现确切的数据区间 */}
              <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                数据范围: {new Date(Date.now() - (timeRange + 1) * 86400000).toLocaleDateString()} ~ {new Date(Date.now() - 2 * 86400000).toLocaleDateString()}
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-blue-100 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium">
              <Download className="w-4 h-4" />
              数据导出
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-gray-500 text-sm font-medium">
                  <th className="px-6 py-4 w-16 whitespace-nowrap">排名</th>
                  <th className="px-6 py-4 whitespace-nowrap">视频内容</th>
                  {SORT_OPTIONS.map((opt) => (
                    <th 
                      key={opt.value} 
                      className={cn(
                        "px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors whitespace-nowrap",
                        sortBy === opt.value && "text-blue-600"
                      )}
                      onClick={() => {
                        setSortBy(opt.value);
                        if (data) fetchData(1);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {opt.label}
                        <div className="flex flex-col scale-75 opacity-50">
                          <div className={cn("w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[4px] border-b-current", sortBy === opt.value && "opacity-100")} />
                          <div className={cn("w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-current mt-0.5", sortBy === opt.value && "opacity-100")} />
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A7F82]" />
                        <p>正在加载数据...</p>
                      </div>
                    </td>
                  </tr>
                ) : data?.list.length ? (
                  data.list.map((item, index) => (
                    <tr
                      key={item.id}
                      className="group hover:bg-[#1A7F82]/5 transition-colors"
                    >
                      <td className="px-6 py-6 text-gray-400 font-medium whitespace-nowrap">
                        {(page - 1) * 10 + index + 1}
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex gap-4 min-w-[300px]">
                          <div className="relative w-24 h-32 flex-shrink-0 rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-shadow">
                            <img
                              src={item.coverImageUrl}
                              alt="Cover"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {item.isAd && (
                              <div className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                AD
                              </div>
                            )}
                            <div 
                              className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                              onClick={() => {
                                if (item.mp4Url && item.mp4Url !== "获取失败") {
                                  setPlayingVideoUrl(item.mp4Url);
                                } else {
                                  alert('视频地址获取失败或未无水印解析');
                                }
                              }}
                            >
                              <div className="bg-white/90 p-2 rounded-full text-blue-600 hover:scale-110 transition-transform">
                                <Play className="w-4 h-4 fill-current pl-0.5" />
                              </div>
                            </div>
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded flex items-center gap-0.5">
                              <Play className="w-2 h-2 fill-current" />
                              {item.duration}
                            </div>
                          </div>
                          <div className="flex flex-col justify-between py-1">
                            <p className="text-sm line-clamp-3 text-gray-700 leading-relaxed group-hover:text-blue-900 transition-colors">
                              {item.description || "无描述"}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <a
                                href={item.tiktokVideoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-gray-400 hover:text-blue-500 flex items-center gap-1 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                TikTok 原链接
                              </a>
                              <a
                                href={item.tiktokHomepageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-gray-400 hover:text-blue-500 flex items-center gap-1 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                作者主页
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 font-bold text-blue-600 whitespace-nowrap">
                        {formatNumber(item.revenue)}
                      </td>
                      <td className="px-6 py-6 text-gray-600 font-medium whitespace-nowrap">
                        {formatViews(item.views)}
                      </td>
                      <td className="px-6 py-6 text-gray-600 font-medium whitespace-nowrap">
                        {item.sale.toLocaleString()}
                      </td>
                      <td className="px-6 py-6 text-gray-400 text-sm whitespace-nowrap">
                        {item.create_time}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-gray-400">
                      {pid ? "未找到相关视频数据，或该时间段内暂无视频" : "请输入产品 PID 开始探索"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > 10 && (
            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-sm font-medium text-gray-500">
                共 {data.total} 条视频数据
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1 || loading}
                  onClick={() => handlePageChange(page - 1)}
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(data.total / 10) }, (_, i) => i + 1)
                    .filter(p => {
                      const totalPages = Math.ceil(data.total / 10);
                      if (totalPages <= 7) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (p >= page - 2 && p <= page + 2) return true;
                      return false;
                    })
                    .reduce((acc: any[], p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) => (
                      p === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-2 text-gray-400">...</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p as number)}
                          disabled={loading}
                          className={cn(
                            "w-8 h-8 rounded-lg text-sm font-medium transition-colors flex items-center justify-center",
                            page === p
                              ? "bg-[#1A7F82] text-white shadow-sm"
                              : "text-gray-600 hover:bg-gray-100 border border-transparent"
                          )}
                        >
                          {p}
                        </button>
                      )
                    ))
                  }
                </div>

                <button
                  disabled={page >= Math.ceil(data.total / 10) || loading}
                  onClick={() => handlePageChange(page + 1)}
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>前往</span>
                <input
                  type="number"
                  min="1"
                  max={Math.ceil(data.total / 10)}
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJumpPage();
                  }}
                  className="w-16 h-8 text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A7F82] transition-all bg-white"
                />
                <span>页</span>
                <button 
                  onClick={handleJumpPage}
                  disabled={loading || !jumpPage}
                  className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium ml-1 disabled:opacity-50"
                >
                  跳转
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 回到顶部悬浮按钮 */}
      <AnimatePresence>
        {showTopBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-10 right-10 z-[90] p-3 rounded-full bg-[#1A7F82] text-white shadow-xl hover:bg-[#156A6C] hover:scale-110 transition-all focus:outline-none"
            title="回到顶部"
          >
            <ArrowUp className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* 图片放大 Modal */}
      <AnimatePresence>
        {isImgModalOpen && data?.product && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setIsImgModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <img 
                src={data.product.images[currentImgIdx]} 
                alt="Large Product" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <button onClick={() => setIsImgModalOpen(false)} className="absolute top-0 right-0 m-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 transition">
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 视频播放小窗 Modal */}
      <AnimatePresence>
        {playingVideoUrl && (
          <div 
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            onClick={() => setPlayingVideoUrl(null)}
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative h-[85vh] aspect-[9/16] max-w-[95vw] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setPlayingVideoUrl(null)} className="absolute top-4 right-4 z-10 bg-black/40 hover:bg-black/80 text-white p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              <video 
                src={playingVideoUrl} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 right-6 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-[100]"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">!</div>
            {error}
            <button onClick={() => setError(null)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}