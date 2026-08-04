"use client";

import { useEffect, useRef, useState } from "react";

type MapScale = "local" | "city" | "region";

export type PlanningMapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "zone" | "facility" | "imported";
  score?: number;
};

type TencentMapInstance = {
  setCenter: (center: unknown) => void;
  setZoom: (zoom: number) => void;
  setPitch: (pitch: number) => void;
  destroy?: () => void;
};

type TencentLayer = {
  destroy?: () => void;
  on?: (event: string, handler: (payload: {
    geometry?: { id?: string; properties?: { kind?: string } };
  }) => void) => void;
};

declare global {
  interface Window {
    TMap?: {
      LatLng: new (lat: number, lng: number) => unknown;
      Map: new (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => TencentMapInstance;
      MultiMarker: new (options: Record<string, unknown>) => TencentLayer;
      MarkerStyle: new (options: Record<string, unknown>) => unknown;
      MultiLabel: new (options: Record<string, unknown>) => TencentLayer;
      LabelStyle: new (options: Record<string, unknown>) => unknown;
    };
  }
}

let mapLoader: Promise<void> | null = null;

function loadTencentMap(key: string) {
  if (window.TMap) return Promise.resolve();
  if (mapLoader) return mapLoader;
  mapLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.charset = "utf-8";
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("腾讯地图脚本加载失败"));
    document.head.appendChild(script);
  });
  return mapLoader;
}

const scaleViews: Record<
  MapScale,
  { zoom: number; pitch: number }
> = {
  local: {
    zoom: 13.4,
    pitch: 24,
  },
  city: {
    zoom: 10.7,
    pitch: 12,
  },
  region: {
    zoom: 7.2,
    pitch: 0,
  },
};

export default function TencentPlanningMap({
  apiKey,
  scale,
  center,
  points,
  activeZoneId,
  onZoneSelect,
}: {
  apiKey: string;
  scale: MapScale;
  center: { lat: number; lng: number };
  points: PlanningMapPoint[];
  activeZoneId: string;
  onZoneSelect: (zoneId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<TencentMapInstance | null>(null);
  const markerLayerRef = useRef<TencentLayer | null>(null);
  const labelLayerRef = useRef<TencentLayer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    apiKey ? "loading" : "error",
  );

  useEffect(() => {
    if (!apiKey || !containerRef.current) {
      setStatus("error");
      return;
    }
    let cancelled = false;
    loadTencentMap(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current || !window.TMap) return;
        const view = scaleViews[scale];
        const map = new window.TMap.Map(containerRef.current, {
          center: new window.TMap.LatLng(center.lat, center.lng),
          zoom: view.zoom,
          pitch: view.pitch,
          rotation: 0,
          showControl: false,
          baseMap: {
            type: "vector",
            features: ["base", "building3d", "point", "label"],
          },
        });
        mapRef.current = map;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      markerLayerRef.current?.destroy?.();
      labelLayerRef.current?.destroy?.();
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const TMap = window.TMap;
    if (!map || !TMap) return;
    const view = scaleViews[scale];
    map.setCenter(new TMap.LatLng(center.lat, center.lng));
    map.setZoom(view.zoom);
    map.setPitch(view.pitch);
  }, [center.lat, center.lng, scale, status]);

  useEffect(() => {
    const map = mapRef.current;
    const TMap = window.TMap;
    if (!map || !TMap || status !== "ready") return;

    markerLayerRef.current?.destroy?.();
    labelLayerRef.current?.destroy?.();

    const visiblePoints =
      scale === "local"
        ? points
        : points.filter((point) => point.kind === "zone");
    const activePoints = visiblePoints.filter(
      (point) => point.id === activeZoneId,
    );
    const regularPoints = visiblePoints.filter(
      (point) => point.id !== activeZoneId,
    );
    const markerLayer = new TMap.MultiMarker({
      id: "planning-points",
      map,
      styles: {
        zone: new TMap.MarkerStyle({
          width: 24,
          height: 34,
          anchor: { x: 12, y: 34 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
        }),
        active: new TMap.MarkerStyle({
          width: 31,
          height: 43,
          anchor: { x: 15, y: 43 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
        }),
        facility: new TMap.MarkerStyle({
          width: 17,
          height: 24,
          anchor: { x: 8, y: 24 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
        }),
      },
      geometries: [
        ...regularPoints.map((point) => ({
          id: point.id,
          styleId: point.kind === "zone" ? "zone" : "facility",
          position: new TMap.LatLng(point.lat, point.lng),
          properties: { kind: point.kind },
        })),
        ...activePoints.map((point) => ({
          id: point.id,
          styleId: "active",
          position: new TMap.LatLng(point.lat, point.lng),
          properties: { kind: point.kind },
        })),
      ],
    });
    markerLayer.on?.("click", (event) => {
      if (
        event.geometry?.properties?.kind === "zone" &&
        event.geometry.id
      ) {
        onZoneSelect(event.geometry.id);
      }
    });
    markerLayerRef.current = markerLayer;

    const zones = points.filter((point) => point.kind === "zone");
    labelLayerRef.current = new TMap.MultiLabel({
      id: "planning-labels",
      map,
      styles: {
        zone: new TMap.LabelStyle({
          color: "#17352d",
          size: 12,
          offset: { x: 0, y: -42 },
          alignment: "center",
          verticalAlignment: "middle",
        }),
      },
      geometries: zones.map((point) => ({
        id: `label-${point.id}`,
        styleId: "zone",
        position: new TMap.LatLng(point.lat, point.lng),
        content: `${point.name}${point.score === undefined ? "" : ` · ${point.score.toFixed(0)}`}`,
      })),
    });
  }, [activeZoneId, onZoneSelect, points, scale, status]);

  return (
    <div className="tencent-map-shell">
      <div className="tencent-map-container" ref={containerRef} />
      {status === "loading" && (
        <div className="tencent-map-status">正在加载腾讯矢量地图…</div>
      )}
      {status === "error" && (
        <div className="tencent-map-status error">
          真实地图暂不可用，已保留分析沙盘作为备用视图。
        </div>
      )}
      <div className="real-map-caption">
        <b>腾讯地图 · GCJ-02</b>
        <span>真实海岸线、岛屿、道路与地名</span>
      </div>
    </div>
  );
}
