// Screen px per unit of an <svg>, as CSS sizes it: what a tile's words are fitted by (`fitWords`).
import { useEffect, useState, type RefObject } from 'react'

/**
 * Screen px per unit of an <svg> whose viewBox is `width` by `height`, kept as it resizes: the
 * viewBox fits inside the element, so the smaller of its two ratios. 1 until it is first measured.
 */
export function useScale(
  svg: RefObject<SVGSVGElement | null>,
  { width, height }: { width: number; height: number },
): number {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const element = svg.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const box = entry.contentRect
        setScale(Math.min(box.width / width, box.height / height))
      }
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [svg, width, height])
  return scale
}
