"use client";

import { useEffect, useRef, useState } from "react";
import { gcj02ToWgs84 } from "./data-pipeline";
import type { PlanningMapPoint } from "./TencentPlanningMap";

type MapScale = "local" | "city" | "region";

type TiandituOverlay = {
  addEventListener?: (event: string, handler: () => void) => void;
};

type TiandituMap = {
  addOverLay: (overlay: TiandituOverlay) => void;
  centerAndZoom: (center: unknown, zoom: number) => void;
  clearOverLays: () => void;
  enableScrollWheelZoom?: () => void;
};

declare global {
  interface Window {
    T?: {
      Map: new (container: HTMLElement) => TiandituMap;
      LngLat: new (lng: number, lat: number) => unknown;
      Point: new (x: number, y: number) => unknown;
      Marker: new (point: unknown, options?: Record<string, unknown>) => TiandituOverlay;
      Label: new (options: Record<string, unknown>) => TiandituOverlay;
      Circle: new (
        center: unknown,
        radius: number,
        options?: Record<string, unknown>,
      ) => TiandituOverlay;
      Icon?: new (options: Record<string, unknown>) => unknown;
    };
  }
}

let tiandituLoader: Promise<void> | null = null;

function loadTianditu(key: string) {
  if (window.T) return Promise.resolve();
  if (tiandituLoader) return tiandituLoader;
  tiandituLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.charset = "utf-8";
    script.src = `https://api.tianditu.gov.cn/api?v=4.0&tk=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => (window.T ? resolve() : reject(new Error("天地图对象未初始化")));
    script.onerror = () => reject(new Error("天地图脚本加载失败"));
    document.head.appendChild(script);
  });
  return tiandituLoader;
}

const scaleZoom: Record<MapScale, number> = {
  local: 14,
  city: 11,
  region: 7,
};

const markerStyle: Record<PlanningMapPoint["kind"], { color: string; glyph: string }> = {
  zone: { color: "#2f715e", glyph: "住" },
  facility: { color: "#477c92", glyph: "设" },
  imported: { color: "#477c92", glyph: "点" },
  recommendation: { color: "#c45242", glyph: "荐" },
  constraint: { color: "#8d3e38", glyph: "险" },
};

function svgMarker(color: string, glyph: string, active: boolean) {
  const size = active ? 42 : 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 42 50"><path d="M21 49C15 39 5 32 5 20a16 16 0 1 1 32 0c0 12-10 19-16 29Z" fill="${color}" stroke="#fff" stroke-width="3"/><circle cx="21" cy="20" r="10" fill="rgba(255,255,255,.92)"/><text x="21" y="24" text-anchor="middle" font-size="12" font-weight="700" fill="${color}" font-family="Arial,'Microsoft YaHei'">${glyph}</text></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    width: size,
    height: size + 8,
  };
}

function toWgs84(point: { lat: number; lng: number }) {
  return gcj02ToWgs84(point);
}

export default function TiandituPlanningMap({
  apiKey,
  scale,
  center,
  points,
  activeZoneId,
  activeRecommendationId,
  onZoneSelect,
  onRecommendationSelect,
}: {
  apiKey: string;
  scale: MapScale;
  center: { lat: number; lng: number };
  points: PlanningMapPoint[];
  activeZoneId: string;
  activeRecommendationId: string;
  onZoneSelect: (zoneId: string) => void;
  onRecommendationSelect: (recommendationId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<TiandituMap | null>(null);
  const initialCenterRef = useRef(center);
  const initialScaleRef = useRef(scale);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    apiKey ? "loading" : "error",
  );

  useEffect(() => {
    if (!apiKey || !containerRef.current) {
      setStatus("error");
      return;
    }
    let cancelled = false;
    loadTianditu(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current || !window.T) return;
        const initialCenter = toWgs84(initialCenterRef.current);
        const map = new window.T.Map(containerRef.current);
        map.centerAndZoom(
          new window.T.LngLat(initialCenter.lng, initialCenter.lat),
          scaleZoom[initialScaleRef.current],
        );
        map.enableScrollWheelZoom?.();
        mapRef.current = map;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      mapRef.current?.clearOverLays();
      mapRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const T = window.T;
    if (!map || !T || status !== "ready") return;
    const normalized = toWgs84(center);
    map.centerAndZoom(new T.LngLat(normalized.lng, normalized.lat), scaleZoom[scale]);
  }, [center, scale, status]);

  useEffect(() => {
    const map = mapRef.current;
    const T = window.T;
    if (!map || !T || status !== "ready") return;
    map.clearOverLays();

    const visiblePoints = scale === "local"
      ? points
      : points.filter((point) =>
          point.kind === "zone" ||
          point.kind === "recommendation" ||
          point.kind === "constraint",
        );

    visiblePoints.forEach((point) => {
      const normalized = toWgs84(point);
      const lngLat = new T.LngLat(normalized.lng, normalized.lat);
      const active = point.id === activeZoneId || point.id === activeRecommendationId;
      const style = markerStyle[point.kind];
      const markerAsset = svgMarker(style.color, style.glyph, active);
      const icon = T.Icon
        ? new T.Icon({
            iconUrl: markerAsset.url,
            iconSize: new T.Point(markerAsset.width, markerAsset.height),
            iconAnchor: new T.Point(markerAsset.width / 2, markerAsset.height),
          })
        : undefined;
      const marker = new T.Marker(lngLat, icon ? { icon } : undefined);
      if (point.kind === "zone") {
        marker.addEventListener?.("click", () => onZoneSelect(point.id));
      } else if (point.kind === "recommendation") {
        marker.addEventListener?.("click", () => onRecommendationSelect(point.id));
      }
      map.addOverLay(marker);

      if (
        point.kind === "zone" ||
        point.kind === "recommendation" ||
        point.kind === "constraint"
      ) {
        const prefix = point.kind === "recommendation"
          ? `方案 0${point.rank ?? ""} · `
          : point.kind === "constraint"
            ? "避让 · "
            : "";
        const score = point.kind === "zone" && point.score !== undefined
          ? ` · ${point.score.toFixed(0)}`
          : "";
        const label = new T.Label({
          text: `${prefix}${point.name}${score}`,
          position: lngLat,
          offset: new T.Point(-46, active ? -66 : -58),
        });
        map.addOverLay(label);
      }

      if (point.kind === "recommendation") {
        const circle = new T.Circle(
          lngLat,
          Math.max(250, (point.serviceRadiusKm ?? 1) * 1000),
          {
            color: active ? "#6d8f31" : "#bd5545",
            weight: active ? 3 : 2,
            opacity: 0.82,
            fillColor: active ? "#b8d36d" : "#e79b8e",
            fillOpacity: active ? 0.2 : 0.13,
            lineStyle: "dashed",
          },
        );
        map.addOverLay(circle);
      }
    });

    const activeRecommendation = visiblePoints.find(
      (point) => point.kind === "recommendation" && point.id === activeRecommendationId,
    );
    if (activeRecommendation) {
      const normalized = toWgs84(activeRecommendation);
      map.centerAndZoom(
        new T.LngLat(normalized.lng, normalized.lat),
        scale === "local" ? 15 : scaleZoom[scale],
      );
    }
  }, [
    activeRecommendationId,
    activeZoneId,
    onRecommendationSelect,
    onZoneSelect,
    points,
    scale,
    status,
  ]);

  return (
    <div className="tencent-map-shell tianditu-map-shell">
      <div className="tencent-map-container" ref={containerRef} />
      {status === "loading" && (
        <div className="tencent-map-status">正在加载天地图国家地理底图…</div>
      )}
      {status === "error" && (
        <div className="tencent-map-status error">
          天地图暂不可用，请检查浏览器端 Key 与域名白名单，或切换腾讯地图。
        </div>
      )}
      <div className="real-map-caption">
        <b>天地图 · WGS‑84 展示</b>
        <span>GCJ‑02 分析点已转换 · 国家地理底图与行政地名</span>
      </div>
    </div>
  );
}
