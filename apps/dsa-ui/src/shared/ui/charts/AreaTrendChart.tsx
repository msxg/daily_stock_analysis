import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'

export type TrendPoint = {
  time: Time
  value: number
}

type AreaTrendChartProps = {
  data: TrendPoint[]
  height?: number
  className?: string
}

export function AreaTrendChart({ data, height = 280, className = '' }: AreaTrendChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(34, 45, 67, 0.85)',
        fontFamily: 'Manrope, Segoe UI, sans-serif',
      },
      rightPriceScale: {
        borderColor: 'rgba(27, 90, 74, 0.16)',
      },
      timeScale: {
        borderColor: 'rgba(27, 90, 74, 0.16)',
      },
      grid: {
        vertLines: { color: 'rgba(27, 90, 74, 0.08)' },
        horzLines: { color: 'rgba(27, 90, 74, 0.08)' },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(14, 165, 152, 0.35)',
          width: 1,
        },
        horzLine: {
          color: 'rgba(14, 165, 152, 0.35)',
          width: 1,
        },
      },
    })

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(14, 165, 152, 0.95)',
      topColor: 'rgba(14, 165, 152, 0.34)',
      bottomColor: 'rgba(14, 165, 152, 0.04)',
      lineWidth: 2,
    })

    areaSeries.setData(data)
    chart.timeScale().fitContent()

    const resizeChart = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }

    const resizeObserver = new ResizeObserver(resizeChart)
    resizeObserver.observe(containerRef.current)

    chartRef.current = chart
    seriesRef.current = areaSeries

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [height, data])

  return <div className={className} ref={containerRef} />
}
