"use client";

import { useEffect, useRef, useState } from "react";

type MapScale = "local" | "city" | "region";

export type PlanningMapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "zone" | "facility" | "imported" | "recommendation" | "constraint";
  score?: number;
  rank?: number;
  serviceRadiusKm?: number;
  source?: "tencent" | "tianditu" | "cross_verified" | "model";
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
      MultiCircle?: new (options: Record<string, unknown>) => TencentLayer;
      CircleStyle?: new (options: Record<string, unknown>) => unknown;
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
  const mapRef = useRef<TencentMapInstance | null>(null);
  const markerLayerRef = useRef<TencentLayer | null>(null);
  const labelLayerRef = useRef<TencentLayer | null>(null);
  const circleLayerRef = useRef<TencentLayer | null>(null);
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
    loadTencentMap(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current || !window.TMap) return;
        const view = scaleViews[initialScaleRef.current];
        const initialCenter = initialCenterRef.current;
        const map = new window.TMap.Map(containerRef.current, {
          center: new window.TMap.LatLng(initialCenter.lat, initialCenter.lng),
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
      circleLayerRef.current?.destroy?.();
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
    if (!map || !TMap || status !== "ready" || !activeRecommendationId) return;
    const recommendation = points.find(
      (point) =>
        point.kind === "recommendation" && point.id === activeRecommendationId,
    );
    if (!recommendation) return;
    map.setCenter(new TMap.LatLng(recommendation.lat, recommendation.lng));
    if (scale === "local") map.setZoom(14.2);
  }, [activeRecommendationId, points, scale, status]);

  useEffect(() => {
    const map = mapRef.current;
    const TMap = window.TMap;
    if (!map || !TMap || status !== "ready") return;

    markerLayerRef.current?.destroy?.();
    labelLayerRef.current?.destroy?.();
    circleLayerRef.current?.destroy?.();

    const visiblePoints =
      scale === "local"
        ? points
        : points.filter(
            (point) =>
              point.kind === "zone" ||
              point.kind === "recommendation" ||
              point.kind === "constraint",
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
        tianditu: new TMap.MarkerStyle({
          width: 19,
          height: 27,
          anchor: { x: 9, y: 27 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
        }),
        crossVerified: new TMap.MarkerStyle({
          width: 24,
          height: 34,
          anchor: { x: 12, y: 34 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
        }),
        recommendation: new TMap.MarkerStyle({
          width: 34,
          height: 47,
          anchor: { x: 17, y: 47 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
        }),
        recommendationActive: new TMap.MarkerStyle({
          width: 43,
          height: 59,
          anchor: { x: 21, y: 59 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
        }),
        constraint: new TMap.MarkerStyle({
          width: 23,
          height: 32,
          anchor: { x: 11, y: 32 },
          src: "https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png",
        }),
      },
      geometries: visiblePoints.map((point) => ({
          id: point.id,
          styleId:
            point.kind === "recommendation"
              ? point.id === activeRecommendationId
                ? "recommendationActive"
                : "recommendation"
              : point.id === activeZoneId
                ? "active"
                : point.kind === "zone"
                  ? "zone"
                  : point.kind === "constraint"
                    ? "constraint"
                    : point.source === "cross_verified"
                      ? "crossVerified"
                      : point.source === "tianditu"
                        ? "tianditu"
                        : "facility",
          position: new TMap.LatLng(point.lat, point.lng),
          properties: { kind: point.kind },
        })),
    });
    markerLayer.on?.("click", (event) => {
      if (
        event.geometry?.properties?.kind === "zone" &&
        event.geometry.id
      ) {
        onZoneSelect(event.geometry.id);
      } else if (
        event.geometry?.properties?.kind === "recommendation" &&
        event.geometry.id
      ) {
        onRecommendationSelect(event.geometry.id);
      }
    });
    markerLayerRef.current = markerLayer;

    const zones = points.filter((point) => point.kind === "zone");
    const recommendations = visiblePoints.filter(
      (point) => point.kind === "recommendation",
    );
    const constraints = visiblePoints.filter(
      (point) => point.kind === "constraint",
    );
    const sourcePoints = scale === "local"
      ? visiblePoints.filter(
          (point) => point.source === "tianditu" || point.source === "cross_verified",
        )
      : [];
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
        recommendation: new TMap.LabelStyle({
          color: "#a84235",
          size: 14,
          offset: { x: 0, y: -59 },
          alignment: "center",
          verticalAlignment: "middle",
        }),
        constraint: new TMap.LabelStyle({
          color: "#9f352c",
          size: 11,
          offset: { x: 0, y: -38 },
          alignment: "center",
          verticalAlignment: "middle",
        }),
      },
      geometries: [
        ...zones.map((point) => ({
          id: `label-${point.id}`,
          styleId: "zone",
          position: new TMap.LatLng(point.lat, point.lng),
          content: `${point.name}${point.score === undefined ? "" : ` · ${point.score.toFixed(0)}`}`,
        })),
        ...recommendations.map((point) => ({
          id: `label-${point.id}`,
          styleId: "recommendation",
          position: new TMap.LatLng(point.lat, point.lng),
          content: `方案 0${point.rank ?? ""} · ${point.name}`,
        })),
        ...constraints.map((point) => ({
          id: `label-${point.id}`,
          styleId: "constraint",
          position: new TMap.LatLng(point.lat, point.lng),
          content: `避让 · ${point.name}`,
        })),
      ],
    });

    const MultiCircle = TMap.MultiCircle;
    const CircleStyle = TMap.CircleStyle;
    if (MultiCircle && CircleStyle && (recommendations.length || sourcePoints.length)) {
      circleLayerRef.current = new MultiCircle({
        id: "recommendation-service-circles",
        map,
        styles: {
          recommendation: new CircleStyle({
            color: "rgba(223, 124, 99, 0.12)",
            showBorder: true,
            borderColor: "rgba(190, 78, 61, 0.72)",
            borderWidth: 2,
          }),
          active: new CircleStyle({
            color: "rgba(160, 193, 73, 0.18)",
            showBorder: true,
            borderColor: "rgba(98, 128, 35, 0.92)",
            borderWidth: 3,
          }),
          tianditu: new CircleStyle({
            color: "rgba(58, 145, 164, 0.18)",
            showBorder: true,
            borderColor: "rgba(41, 120, 139, 0.88)",
            borderWidth: 2,
          }),
          crossVerified: new CircleStyle({
            color: "rgba(171, 205, 77, 0.24)",
            showBorder: true,
            borderColor: "rgba(102, 137, 37, 0.92)",
            borderWidth: 3,
          }),
        },
        geometries: [
          ...recommendations.map((point) => ({
            id: `circle-${point.id}`,
            styleId: point.id === activeRecommendationId ? "active" : "recommendation",
            center: new TMap.LatLng(point.lat, point.lng),
            radius: Math.max(250, (point.serviceRadiusKm ?? 1) * 1000),
          })),
          ...sourcePoints.map((point) => ({
            id: `source-circle-${point.id}`,
            styleId: point.source === "cross_verified" ? "crossVerified" : "tianditu",
            center: new TMap.LatLng(point.lat, point.lng),
            radius: point.source === "cross_verified" ? 115 : 85,
          })),
        ],
      });
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
        <b>腾讯底图 × 天地图权威增强</b>
        <span>道路/海岸线 · 行政地名 · 跨源公共设施核验</span>
      </div>
    </div>
  );
}
