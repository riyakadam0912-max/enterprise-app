# Dashboard Setup And Performance Notes

## Overview

The dashboard home page is optimized so heavy chart rendering does not block initial paint.

## Chart Loading Strategy

- Recharts-heavy UI is extracted into a dedicated client component.
- The chart bundle is loaded with Next.js dynamic import.
- Server-side rendering is disabled for chart components (`ssr: false`).
- A Suspense boundary wraps the chart region.
- A chart-shaped skeleton is displayed while chart code or data is loading.

## Implemented Files

- src/components/DashboardPage.tsx
	- Uses dynamic import for the chart container.
	- Keeps dashboard cards/attendance visible immediately.
- src/components/dashboard/DashboardCharts.tsx
	- Contains Recharts components (Scatter, Bar, Line).
- src/components/dashboard/DashboardChartsSkeleton.tsx
	- Provides shape-matching placeholders for chart panels.

## Why This Was Added

- Reduces initial blocking work on dashboard render.
- Improves perceived load time by showing instant skeleton placeholders.
- Prevents server-side chart rendering overhead for Recharts.

## Local Verification

1. Start backend on port 3000.
2. Start frontend on port 3001.
3. Open `/dashboard`.
4. Confirm KPI and attendance sections render first.
5. Confirm chart skeleton appears briefly before charts hydrate.

## Notes

- If chart data is not available yet, the skeleton remains visible until data arrives.
- If dynamic import fails, the chart section fallback keeps layout stable.
