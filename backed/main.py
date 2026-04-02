import os
import concurrent.futures
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests
import uvicorn

# --- 1. FastAPI 实例初始化 ---
app = FastAPI()

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. 代理与默认配置 ---
PROXIES = {
    "http": "http://127.0.0.1:10808",
    "https": "http://127.0.0.1:10808",
}

DEFAULT_COOKIES = "_ga=GA1.1.351210979.1774871044; _gcl_au=1.1.59906989.1774871044; AGL_USER_ID=ce8abe01-a484-4553-9139-7e29ebe0844e; _bl_uid=6gmpdnFIdqe496e8j61s816xIFeb; _twpid=tw.1774871044141.991332126295388668; _tt_enable_cookie=1; _ttp=01KMZ8XRKB30ZTA7F807YB19ET_.tt.1; _fbp=fb.1.1774871044791.394031421897288588; smidV2=202603301944117ac37a3e54124459df4483f571a08d7f0083809b3f14d8340; _c_WBKFRo=fW4ghPprEV4trpPRWODYivI7vpEZobxBFI1BpjQn; appVersion=2.0; deviceType=pc; deviceId=12eb1de4e4401c57775872379c7ef3cd; page_session=ed0b49c0-5707-458f-9b43-af4d181dac05; Hm_lvt_8aa1693861618ac63989ae373e684811=1774871052,1774925388,1775013804; HMACCOUNT=314BB31598F49BBD; _clck=vqm3ed%5E2%5Eg4u%5E0%5E2280; _cfuvid=dA_O4jzcX1M3syjUhOBBYTaid5syFmF0YBem5LQHdvg-1775014743.7322361-1.0.1.1-znVSkbx2X.qc22yYBsqUcWtpc9_0jFy8gAkfhT0E2_A; SESSION=YjgwNjk1NDItZjIzMC00ZWY1LWIwZmUtMjYxMzA1MzE2NDQy; cf_clearance=dpQZbjWxEUN7W7_EA9Y2iXtSyxqZJWUFA0aNIhxEHG0-1775019338-1.2.1.1-2BCfgaz.HLdfk0oggLoEWOVoAWtcSZBB2hSGelAdanb1H6xxcVqs6LRyO.mkCkLyeaI0C37cPehh_g5ShdmJQ5F6HdqcjRgCOzkh_ceWcwofLs9xk67O8vLwxN8MVKcLH4pOLZNahUnan010HI2QdD9d7MmDtdfxv02YzERn.5neHg7k0YlIOXVZB0oQE9GTaOps5JI0lMYxJyRyVna2C5wzqeQ6dLK5_Upnj5u7MNs; _clsk=1mx0wuf%5E1775019671585%5E14%5E1%5Ek.clarity.ms%2Fcollect; _ga_Q21FRKKG88=GS2.1.s1775013804$o7$g1$t1775019984$j60$l0$h0; Hm_lpvt_8aa1693861618ac63989ae373e684811=1775019985; .thumbcache_211a882976e013454a0403b9c1967076=S6iDiTLPLSYMZBQ64qGxp8hsgp2PAFwVZYXnSr7O2BKFBJvojdDaN0rP9zHaTWMKkRI9GIw5VpylJnv/1DFGBQ%3D%3D; _uetsid=c0d766202c2d11f1a130cbd70b9353d7; _uetvid=c0d773902c2d11f1bde311940ff015a7; ttcsid_CM9SHDBC77U4KJBR96OG=1775013804943::zj0MR4f4he_oW_n2aZih.5.1775019986026.1; ttcsid=1775019653880::XGDxQ-rbV8FkWSOtG190.6.1775019986026.0::1.330044.331714::264482.9.324.2003::332673.81.501"

def get_headers(custom_cookie: str = None, country: str = "US", currency: str = "USD"):
    cookie = custom_cookie.strip() if custom_cookie and custom_cookie.strip() else DEFAULT_COOKIES
    return {
        "Country": country,
        "Currency": currency,
        "Language": "zh-CN",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Cookie": cookie
    }

# --- 3. 接口数据模型 ---
class ScrapeRequest(BaseModel):
    pid: str
    startDate: str
    endDate: str
    sortBy: str
    pageNo: int = 1
    pageSize: int = 10
    cookie: str = None
    country: str = "US"
    currency: str = "USD"

# --- 4. 核心 API 接口 ---
@app.post("/api/scrape")
def scrape_data(req: ScrapeRequest):
    headers = get_headers(req.cookie, req.country, req.currency)
    
    count_payload = {
        "id": req.pid,
        "startDate": req.startDate,
        "endDate": req.endDate,
        "authority": True,
        "pageNo": 1,
        "pageSize": 10,
        "sort": [{"field": req.sortBy, "type": "DESC"}]
    }

    # 获取对比日期（基准点为今日往前推，考虑2天延迟）
    today = datetime.now()
    def get_dt_str(days_ago):
        return (today - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        
    # 修改这里的逻辑偏移量，以 T-2 作为实际数据计算基准
    cur_3_end, cur_3_start = get_dt_str(2), get_dt_str(4)       # 最近三天: T-2 到 T-4
    prev_3_end, prev_3_start = get_dt_str(5), get_dt_str(7)     # 之前三天: T-5 到 T-7
    cur_7_end, cur_7_start = get_dt_str(2), get_dt_str(8)       # 最近七天: T-2 到 T-8
    prev_7_end, prev_7_start = get_dt_str(9), get_dt_str(15)    # 之前七天: T-9 到 T-15

    try:
        def fetch_json(url, is_post=True, payload=None):
            if is_post:
                return requests.post(url, json=payload, headers=headers, proxies=PROXIES, timeout=10).json()
            return requests.get(url, headers=headers, proxies=PROXIES, timeout=10).json()

        # 请求特定时段的基础数据
        def fetch_total(start, end):
            url = "https://www.kalodata.com/product/detail/total"
            payload = {"id": req.pid, "startDate": start, "endDate": end, "authority": True}
            try:
                resp = requests.post(url, json=payload, headers=headers, proxies=PROXIES, timeout=10).json()
                data = resp.get("data", {})
                sale_str = str(data.get("sale", "0")).replace(",", "")
                sale = float(sale_str) if sale_str else 0.0
                revenue = float(data.get("original_revenue", 0.0))
                return {
                    "sale": sale, 
                    "revenue": revenue, 
                    "revenue_str": data.get("revenue", "$0"), 
                    "sale_str": data.get("sale", "0")
                }
            except Exception:
                return {"sale": 0.0, "revenue": 0.0, "revenue_str": "$0", "sale_str": "0"}

        count_url = "https://www.kalodata.com/product/detail/video/count"
        creator_count_url = "https://www.kalodata.com/product/detail/creator/count"
        images_url = f"https://www.kalodata.com/product/detail/getImages?productId={req.pid}"
        detail_url = "https://www.kalodata.com/product/detail"

        # 【关键修改：把产品商品信息的并发请求提前，使其即使找不到视频也能渲染基本信息】
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_count = executor.submit(fetch_json, count_url, True, count_payload)
            future_creator = executor.submit(fetch_json, creator_count_url, True, count_payload)
            future_images = executor.submit(fetch_json, images_url, False)
            future_info = executor.submit(fetch_json, detail_url, True, count_payload) 
            
            f_cur_range = executor.submit(fetch_total, req.startDate, req.endDate)
            f_cur_3 = executor.submit(fetch_total, cur_3_start, cur_3_end)
            f_prev_3 = executor.submit(fetch_total, prev_3_start, prev_3_end)
            f_cur_7 = executor.submit(fetch_total, cur_7_start, cur_7_end)
            f_prev_7 = executor.submit(fetch_total, prev_7_start, prev_7_end)

            try:
                count_json = future_count.result()
            except Exception:
                return JSONResponse(status_code=403, content={"error": "Kalodata 访问被拦截或 Cookie 已过期，请在设置中更新有效 Cookie。"})

            total_videos = count_json.get("data", 0)
            total_creators = future_creator.result().get("data", 0)
            
            images_data = future_images.result().get("data", [])
            product_images = [str(img) for img in images_data] if isinstance(images_data, list) else ([str(images_data)] if images_data else [])
            
            info_data = future_info.result().get("data", {})
            product_price = info_data.get("unit_price", "未知")
            categories = [info_data.get("pri_cate_id", ""), info_data.get("sec_cate_id", ""), info_data.get("ter_cate_id", "")]
            product_category = " > ".join([c for c in categories if c]) or "未知"
            product_rating = info_data.get("product_rating", "暂无评分")
            product_title = info_data.get("product_title", "暂无简介")
            brand_name = info_data.get("brand_name", "未知")
            collect_day = info_data.get("collect_day", "未知")
            sku_info = info_data.get("skuInfo", [])
            stock = sku_info[0].get("stock", "未知") if sku_info and isinstance(sku_info, list) else "未知"

            def calc_growth(cur, prev):
                if prev == 0:
                    return 100.0 if cur > 0 else 0.0
                return ((cur - prev) / prev) * 100.0

            cur_range_data = f_cur_range.result()
            cur_3_data, prev_3_data = f_cur_3.result(), f_prev_3.result()
            cur_7_data, prev_7_data = f_cur_7.result(), f_prev_7.result()

            # 将完善的产品信息提取为完整字典
            product_dict = {
                "images": product_images,
                "totalCreators": total_creators,
                "totalVideos": total_videos,
                "price": product_price,
                "category": product_category,
                "rating": product_rating,
                "title": product_title,
                "brand": brand_name,
                "collectDay": collect_day,
                "stock": stock,
                "range_sale": cur_range_data["sale_str"],
                "range_revenue": cur_range_data["revenue_str"],
                "recent_3_sale": cur_3_data["sale_str"],
                "recent_3_revenue": cur_3_data["revenue_str"],
                "prev_3_sale": prev_3_data["sale_str"],
                "prev_3_revenue": prev_3_data["revenue_str"],
                "growth_3_sale": calc_growth(cur_3_data["sale"], prev_3_data["sale"]),
                "growth_3_revenue": calc_growth(cur_3_data["revenue"], prev_3_data["revenue"]),
                "recent_7_sale": cur_7_data["sale_str"],
                "recent_7_revenue": cur_7_data["revenue_str"],
                "prev_7_sale": prev_7_data["sale_str"],
                "prev_7_revenue": prev_7_data["revenue_str"],
                "growth_7_sale": calc_growth(cur_7_data["sale"], prev_7_data["sale"]),
                "growth_7_revenue": calc_growth(cur_7_data["revenue"], prev_7_data["revenue"]),
            }

        # 如果无视频，不再返回空字典，而是返回我们上方构造完毕的产品详细数据！
        if total_videos == 0:
            return {"total": 0, "list": [], "product": product_dict}

        # 2. 获取当页视频列表
        list_url = "https://www.kalodata.com/product/detail/video/queryList"
        list_payload = {**count_payload, "pageNo": req.pageNo, "pageSize": req.pageSize}
        video_list = requests.post(list_url, json=list_payload, headers=headers, proxies=PROXIES, timeout=15).json().get("data", [])

        def fetch_video_detail(item):
            v_id = item.get("id")
            mp4_url = "获取失败"
            handle = "未知"
            duration = "未知"
            
            def get_mp4():
                resp = requests.get(f"https://www.kalodata.com/video/detail/getVideoUrl?videoId={v_id}", headers=headers, proxies=PROXIES, timeout=5)
                return resp.json().get("data", {}).get("url", "获取失败")
                
            def get_detail():
                resp = requests.post("https://www.kalodata.com/video/detail", json={"id": v_id, "startDate": req.startDate, "endDate": req.endDate, "authority": True}, headers=headers, proxies=PROXIES, timeout=5)
                return resp.json().get("data", {})

            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as inner_executor:
                f_mp4 = inner_executor.submit(get_mp4)
                f_detail = inner_executor.submit(get_detail)
                
                try: mp4_url = f_mp4.result()
                except: pass
                
                try: 
                    detail_data = f_detail.result()
                    handle = detail_data.get("handle", "未知")
                    duration = detail_data.get("duration", "未知")
                except: pass

            return {
                **item,
                "mp4Url": mp4_url,
                "handle": handle,
                "duration": duration,
                "tiktokVideoUrl": f"https://www.tiktok.com/@{handle}/video/{v_id}" if handle != "未知" else "未知",
                "tiktokHomepageUrl": f"https://www.tiktok.com/@{handle}" if handle != "未知" else "未知",
                "coverImageUrl": f"https://img.kalocdn.com/tiktok.video/{v_id}/cover.png",
                "isAd": str(item.get("ad")) == "1"
            }

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            detailed_list = list(executor.map(fetch_video_detail, video_list))

        return {
            "total": total_videos,
            "list": detailed_list,
            "product": product_dict
        }
        
    except requests.exceptions.RequestException as e:
        print(f"Network Error: {e}")
        return JSONResponse(status_code=500, content={"error": f"网络异常或代理连接失败，请确认 10808 端口代理是否开启，或将其置为空字典: {str(e)}"})
    except Exception as e:
        print(f"Scrape Error: {e}")
        return JSONResponse(status_code=500, content={"error": f"抓取失败: {str(e)}"})


# --- 5. 挂载前端 React 打包产物 (SPA 路由适配) ---
dist_dir = os.path.join(os.path.dirname(__file__), "dist")

assets_path = os.path.join(dist_dir, "assets")
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

@app.get("/{catchall:path}")
def serve_spa(catchall: str):
    if catchall.startswith("api/"):
        return JSONResponse({"detail": "API endpoint not found"}, status_code=404)
    
    file_path = os.path.join(dist_dir, catchall)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    index_file = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
        
    return JSONResponse(
        {"error": "未找到前端构建产物。请先在终端运行 'npm run build'。"}, 
        status_code=404
    )

# --- 6. 启动服务 ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)