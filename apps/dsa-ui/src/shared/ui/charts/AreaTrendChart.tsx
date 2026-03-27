import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'
import { useTheme } from '@/app/providers/useTheme'

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
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const rootStyle = getComputedStyle(document.documentElement)
    const chartTextColor = rootStyle.getPropertyValue('--dsa-chart-text').trim() || 'rgba(34, 45, 67, 0.85)'
    const chartBorderColor = rootStyle.getPropertyValue('--dsa-chart-border').trim() || 'rgba(159, 18, 57, 0.16)'
    const chartGridColor = rootStyle.getPropertyValue('--dsa-chart-grid').trim() || 'rgba(159, 18, 57, 0.08)'
    const chartCrosshairColor = rootStyle.getPropertyValue('--dsa-chart-crosshair').trim() || 'rgba(225, 29, 72, 0.35)'
    const chartLineColor = rootStyle.getPropertyValue('--dsa-chart-line').trim() || 'rgba(225, 29, 72, 0.95)'
    const chartTopColor = rootStyle.getPropertyValue('--dsa-chart-top').trim() || 'rgba(225, 29, 72, 0.34)'
    const chartBottomColor = rootStyle.getPropertyValue('--dsa-chart-bottom').trim() || 'rgba(225, 29, 72, 0.04)'

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: chartTextColor,
        fontFamily: 'Manrope, Segoe UI, sans-serif',
      },
      rightPriceScale: {
        borderColor: chartBorderColor,
      },
      timeScale: {
        borderColor: chartBorderColor,
      },
      grid: {
        vertLines: { color: chartGridColor },
        horzLines: { color: chartGridColor },
      },
      crosshair: {
        vertLine: {
          color: chartCrosshairColor,
          width: 1,
        },
        horzLine: {
          color: chartCrosshairColor,
          width: 1,
        },
      },
    })

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: chartLineColor,
      topColor: chartTopColor,
      bottomColor: chartBottomColor,
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
  }, [data, height, theme])

  return <div className={className} ref={containerRef} />
}
