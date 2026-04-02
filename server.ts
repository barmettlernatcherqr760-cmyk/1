import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const DEFAULT_COOKIES = "_ga=GA1.1.351210979.1774871044; _gcl_au=1.1.59906989.1774871044; AGL_USER_ID=ce8abe01-a484-4553-9139-7e29ebe0844e; _bl_uid=6gmpdnFIdqe496e8j61s816xIFeb; _twpid=tw.1774871044141.991332126295388668; _tt_enable_cookie=1; _ttp=01KMZ8XRKB30ZTA7F807YB19ET_.tt.1; _fbp=fb.1.1774871044791.394031421897288588; smidV2=202603301944117ac37a3e54124459df4483f571a08d7f0083809b3f14d8340; _c_WBKFRo=fW4ghPprEV4trpPRWODYivI7vpEZobxBFI1BpjQn; appVersion=2.0; deviceType=pc; deviceId=12eb1de4e4401c57775872379c7ef3cd; page_session=ed0b49c0-5707-458f-9b43-af4d181dac05; Hm_lvt_8aa1693861618ac63989ae373e684811=1774871052,1774925388,1775013804; HMACCOUNT=314BB31598F49BBD; _clck=vqm3ed%5E2%5Eg4u%5E0%5E2280; _clsk=1mx0wuf%5E1775019671585%5E14%5E1%5Ek.clarity.ms%2Fcollect; _ga_Q21FRKKG88=GS2.1.s1775013804$o7$g1$t1775019984$j60$l0$h0; Hm_lpvt_8aa1693861618ac63989ae373e684811=1775019985; .thumbcache_211a882976e013454a0403b9c1967076=S6iDiTLPLSYMZBQ64qGxp8hsgp2PAFwVZYXnSr7O2BKFBJvojdDaN0rP9zHaTWMKkRI9GIw5VpylJnv/1DFGBQ%3D%3D; _uetsid=c0d766202c2d11f1a130cbd70b9353d7; _uetvid=c0d773902c2d11f1bde311940ff015a7; ttcsid_CM9SHDBC77U4KJBR96OG=1775013804943::zj0MR4f4he_oW_n2aZih.5.1775019986026.1; ttcsid=1775019653880::XGDxQ-rbV8FkWSOtG190.6.1775019986026.0::1.330044.331714::264482.9.324.2003::332673.81.501";

const getHeaders = (customCookie?: string, country: string = "US", currency: string = "USD") => {
  const cookie = customCookie || process.env.KALODATA_COOKIES || DEFAULT_COOKIES;
  return {
    "authority": "www.kalodata.com",
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "cookie": cookie,
    "origin": "https://www.kalodata.com",
    "pragma": "no-cache",
    "referer": "https://www.kalodata.com/",
    "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "country": country,
    "currency": currency,
    "language": "zh-CN"
  };
};

app.post("/api/scrape", async (req, res) => {
  const { pid, startDate, endDate, sortBy, pageNo = 1, pageSize = 10, cookie: customCookie, country = "US", currency = "USD" } = req.body;

  if (!pid) return res.status(400).json({ error: "PID is required" });

  const headers = getHeaders(customCookie, country, currency);
  const config = { headers, timeout: 20000 };

  const getDtStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // 修改这里的逻辑偏移量，以 T-2 作为实际数据计算基准
  const cur_3_end = getDtStr(2);
  const cur_3_start = getDtStr(4);
  const prev_3_end = getDtStr(5);
  const prev_3_start = getDtStr(7);
  const cur_7_end = getDtStr(2);
  const cur_7_start = getDtStr(8);
  const prev_7_end = getDtStr(9);
  const prev_7_start = getDtStr(15);

  const fetchTotal = async (start: string, end: string) => {
    try {
      const resp = await axios.post("https://www.kalodata.com/product/detail/total", { id: pid, startDate: start, endDate: end, authority: true }, config);
      const data = resp.data?.data || {};
      const saleStr = String(data.sale || "0").replace(/,/g, "");
      const sale = parseFloat(saleStr) || 0;
      const revenue = parseFloat(data.original_revenue || "0");
      return { sale, revenue, revenue_str: data.revenue || "$0", sale_str: data.sale || "0" };
    } catch(e) {
      return { sale: 0, revenue: 0, revenue_str: "$0", sale_str: "0" };
    }
  };

  const calcGrowth = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  try {
    console.log(`[Scrape] Starting request for PID: ${pid}, Page: ${pageNo}`);
    
    const countUrl = "https://www.kalodata.com/product/detail/video/count";
    const creatorCountUrl = "https://www.kalodata.com/product/detail/creator/count";
    const imagesUrl = `https://www.kalodata.com/product/detail/getImages?productId=${pid}`;
    
    const countPayload = {
      id: pid,
      startDate,
      endDate,
      authority: true,
      pageNo: 1,
      pageSize: 10,
      sort: [{ field: sortBy, type: "DESC" }]
    };
    
    // 并发请求基础数据与对比数据
    const [countResp, creatorResp, imagesResp, curRangeData, cur3Data, prev3Data, cur7Data, prev7Data] = await Promise.all([
      axios.post(countUrl, countPayload, config),
      axios.post(creatorCountUrl, countPayload, config),
      axios.get(imagesUrl, config),
      fetchTotal(startDate, endDate),
      fetchTotal(cur_3_start, cur_3_end),
      fetchTotal(prev_3_start, prev_3_end),
      fetchTotal(cur_7_start, cur_7_end),
      fetchTotal(prev_7_start, prev_7_end)
    ]);

    console.log(`[Scrape] Count success: ${countResp.data?.data}`);
    
    const totalVideos = countResp.data?.data || 0;
    const totalCreators = creatorResp.data?.data || 0;
    const productImages = Array.isArray(imagesResp.data?.data) ? imagesResp.data.data : [];

    if (totalVideos === 0) return res.json({ total: 0, list: [], product: { images: productImages, totalCreators: 0 } });

    const listUrl = "https://www.kalodata.com/product/detail/video/queryList";
    const listPayload = { ...countPayload, pageNo, pageSize };
    const listResp = await axios.post(listUrl, listPayload, config);
    const videoList = listResp.data?.data || [];

    const detailedList = await Promise.all(videoList.map(async (item: any) => {
      const vId = item.id;
      let mp4Url = "获取失败";
      try {
        const urlResp = await axios.get(`https://www.kalodata.com/video/detail/getVideoUrl?videoId=${vId}`, config);
        mp4Url = urlResp.data?.data?.url || "获取失败";
      } catch (e) {}

      let handle = "未知";
      let duration = "未知";
      try {
        const detailResp = await axios.post("https://www.kalodata.com/video/detail", {
          id: vId, startDate, endDate, authority: true
        }, config);
        handle = detailResp.data?.data?.handle || "未知";
        duration = detailResp.data?.data?.duration || "未知";
      } catch (e) {}

      return {
        ...item,
        mp4Url,
        handle,
        duration,
        tiktokVideoUrl: handle !== "未知" ? `https://www.tiktok.com/@${handle}/video/${vId}` : "未知",
        tiktokHomepageUrl: handle !== "未知" ? `https://www.tiktok.com/@${handle}` : "未知",
        coverImageUrl: `https://img.kalocdn.com/tiktok.video/${vId}/cover.png`,
        isAd: item.ad === 1
      };
    }));

    res.json({ 
      total: totalVideos, 
      list: detailedList,
      product: {
        images: productImages,
        totalCreators,
        totalVideos,
        range_sale: curRangeData.sale_str,
        range_revenue: curRangeData.revenue_str,
        recent_3_sale: cur3Data.sale_str,
        recent_3_revenue: cur3Data.revenue_str,
        growth_3_sale: calcGrowth(cur3Data.sale, prev3Data.sale),
        growth_3_revenue: calcGrowth(cur3Data.revenue, prev3Data.revenue),
        recent_7_sale: cur7Data.sale_str,
        recent_7_revenue: cur7Data.revenue_str,
        growth_7_sale: calcGrowth(cur7Data.sale, prev7Data.sale),
        growth_7_revenue: calcGrowth(cur7Data.revenue, prev7Data.revenue),
      }
    });
  } catch (error: any) {
    console.error("Scrape error:", error.response?.status || error.message);
    res.status(error.response?.status || 500).json({ 
      error: `Kalodata 请求失败: ${error.response?.status || error.message}`,
      status: error.response?.status 
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();