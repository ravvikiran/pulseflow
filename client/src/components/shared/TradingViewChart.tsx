import { useEffect, useRef, useState } from "react";
import { createChart, type IChartApi, ColorType, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries } from "lightweight-charts";

interface CandleData {
  timestamp: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingViewChartProps {
  candles: CandleData[];
  ema20?: number[];
  ema50?: number[];
  ema200?: number[];
  height?: number;
  showVolume?: boolean;
}

function toUnixDay(ts: string | Date): number {
  const d = new Date(ts);
  // lightweight-charts expects UTC business day as seconds
  return Math.floor(d.getTime() / 1000);
}

export default function TradingViewChart({
  candles,
  ema20,
  ema50,
  ema200,
  height = 420,
  showVolume = true,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0 });

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    const container = chartContainerRef.current;

    // Create chart
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.2)", style: 3 },
        horzLine: { color: "rgba(255,255,255,0.2)", style: 3 },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.1, bottom: showVolume ? 0.25 : 0.05 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: false,
        rightOffset: 5,
        barSpacing: 6,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    // Sort candles by time
    const sorted = [...candles].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const candleData = sorted.map((c) => ({
      time: toUnixDay(c.timestamp) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // EMA overlays
    if (ema20 && ema20.length > 0) {
      const ema20Series = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const ema20Data = ema20.map((val, i) => ({
        time: toUnixDay(sorted[i]?.timestamp ?? new Date()) as any,
        value: val,
      })).filter(d => d.value > 0);
      if (ema20Data.length > 0) ema20Series.setData(ema20Data);
    }

    if (ema50 && ema50.length > 0) {
      const ema50Series = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const ema50Data = ema50.map((val, i) => ({
        time: toUnixDay(sorted[i]?.timestamp ?? new Date()) as any,
        value: val,
      })).filter(d => d.value > 0);
      if (ema50Data.length > 0) ema50Series.setData(ema50Data);
    }

    if (ema200 && ema200.length > 0) {
      const ema200Series = chart.addSeries(LineSeries, {
        color: "#8b5cf6",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const ema200Data = ema200.map((val, i) => ({
        time: toUnixDay(sorted[i]?.timestamp ?? new Date()) as any,
        value: val,
      })).filter(d => d.value > 0);
      if (ema200Data.length > 0) ema200Series.setData(ema200Data);
    }

    // Volume histogram
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "#6366f1",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      const volumeData = sorted.map((c) => ({
        time: toUnixDay(c.timestamp) as any,
        value: c.volume,
        color: c.close >= c.open ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
      }));
      volumeSeries.setData(volumeData);
    }

    // Fit content
    chart.timeScale().fitContent();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
        setDimensions({ width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, ema20, ema50, ema200, height, showVolume]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ height }}
    />
  );
}
