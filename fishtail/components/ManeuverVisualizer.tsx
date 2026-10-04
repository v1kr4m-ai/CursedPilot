
import React, { useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Compass, ZoomIn, ZoomOut, Play, Pause, RotateCcw, BarChart2, Minimize2, Maximize2, Minus, Square, SlidersHorizontal } from 'lucide-react';
import { CalculationResult } from '../types';

interface ManeuverVisualizerProps {
  result: CalculationResult;
  yardScale: number;
  onSetScale: (scale: number) => void;
  onExport?: (format: 'svg' | 'jpg') => void;
  onSaveAsTable?: () => void;
  stationSolver?: {
    enabled: boolean;
    initialStation: { x: number; y: number; name: string; bearing: number; range: number };
    targetStation: { x: number; y: number; name: string; bearing: number; range: number };
  };
}

export interface ManeuverVisualizerHandle {
  getSvg: () => SVGSVGElement | null;
}

interface HoverInfo {
  x: number;
  y: number;
  svgX: number;
  svgY: number;
  heading: number;
  advance: number;
  transfer: number;
  visible: boolean;
  legLabel: string;
}

const ManeuverVisualizer = forwardRef<ManeuverVisualizerHandle, ManeuverVisualizerProps>(({ result, yardScale, onSetScale, onExport, onSaveAsTable, stationSolver }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'ppi'>('graph');
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [showCompass, setShowCompass] = useState(false);
  const [compassPos, setCompassPos] = useState({ x: 0, y: 0 });
  const [mouseWorld, setMouseWorld] = useState<{ x: number; y: number } | null>(null);

  // States for absolute position of floating windows (if null, defaults to relative CSS positions first)
  const [hudPos, setHudPos] = useState<{ x: number; y: number } | null>(null);
  const [hudMinimized, setHudMinimized] = useState(false);

  const [palettePos, setPalettePos] = useState<{ x: number; y: number } | null>(null);
  const [paletteMinimized, setPaletteMinimized] = useState(false);

  // Universal handler for mouse and touch dragging of custom panels
  const handleDragStart = (
    e: React.MouseEvent | React.TouchEvent,
    setPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>,
    currentPos: { x: number; y: number } | null,
    elementId: 'hud' | 'palette'
  ) => {
    // Prevent dragging on input buttons, select boxes, or active links
    if ((e.target as HTMLElement).closest('button, select, input, a, [role="button"]')) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let xOffset = 0;
    let yOffset = 0;

    if (currentPos) {
      xOffset = currentPos.x;
      yOffset = currentPos.y;
    } else {
      // Trace exact coordinate relative to container base
      const panel = container.querySelector(elementId === 'hud' ? '#draggable-hud' : '#draggable-palette');
      if (panel) {
        const panelRect = panel.getBoundingClientRect();
        xOffset = panelRect.left - rect.left;
        yOffset = panelRect.top - rect.top;
      } else {
        xOffset = elementId === 'hud' ? 16 : rect.width - 240;
        yOffset = 80;
      }
    }

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const startX = clientX - xOffset;
    const startY = clientY - yOffset;

    const handleDragMove = (moveEvent: MouseEvent | TouchEvent) => {
      // Prevent standard touch scrolling while interacting with the control headers
      moveEvent.preventDefault();

      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      let nextX = curX - startX;
      let nextY = curY - startY;

      // Restric draggable bounds securely inside our interactive visualizer viewport
      const parentRect = container.getBoundingClientRect();
      const panel = container.querySelector(elementId === 'hud' ? '#draggable-hud' : '#draggable-palette');
      const panelWidth = panel ? panel.clientWidth : (elementId === 'hud' ? 180 : 250);
      const panelHeight = panel ? panel.clientHeight : (elementId === 'hud' ? 150 : 240);

      nextX = Math.max(8, Math.min(nextX, parentRect.width - panelWidth - 8));
      nextY = Math.max(8, Math.min(nextY, parentRect.height - panelHeight - 8));

      setPos({ x: nextX, y: nextY });
    };

    const handleDragEnd = () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };

    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    window.removeEventListener('touchmove', handleDragMove);
    window.removeEventListener('touchend', handleDragEnd);

    window.addEventListener('mousemove', handleDragMove, { passive: false });
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
  };

  // Auto-switch view to 'ppi' when station solver is enabled
  React.useEffect(() => {
    if (stationSolver?.enabled) {
      setViewMode('ppi');
    } else {
      setViewMode('graph');
    }
  }, [stationSolver?.enabled]);
  
  // Pan and Drag State (Graph Offset)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Mobile/Pinch Zoom States
  const [zoomScale, setZoomScale] = useState(1);
  const lastTouchDist = useRef<number | null>(null);

  // Reset compass position and pan offset when the calculated result changes
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationTime, setAnimationTime] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(2);
  const [loopAnimation, setLoopAnimation] = useState(true);

  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  React.useEffect(() => {
    setCompassPos({ x: 0, y: 0 });
    setMouseWorld(null);
    setPanOffset({ x: 0, y: 0 });
    setZoomScale(1);
    setIsDragging(false);
    setIsPlaying(false);
    setAnimationTime(0);
  }, [result]);

  React.useEffect(() => {
    if (isPlaying) {
      const tick = (now: number) => {
        if (lastTimeRef.current === null) {
          lastTimeRef.current = now;
        }
        const deltaSec = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;

        setAnimationTime(prev => {
          let nextTime = prev + deltaSec * animationSpeed;
          if (nextTime >= result.total_time) {
            if (loopAnimation) {
              return 0; // Loop around automatically
            } else {
              setIsPlaying(false);
              return result.total_time;
            }
          }
          return nextTime;
        });

        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    } else {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      lastTimeRef.current = null;
    }

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [isPlaying, animationSpeed, loopAnimation, result.total_time]);
  
  const width = 800;
  const height = 1100;
  const margin = 120;
  const guideOffset = -60;

  useImperativeHandle(ref, () => ({
    getSvg: () => svgRef.current
  }));

  const scale = useMemo(() => {
    const extent = yardScale / zoomScale;
    
    return {
      x: (x: number) => (x / extent) * (width / 2 - margin) + width / 2 + panOffset.x,
      y: (y: number) => (height - 340) - margin - (y / extent) * (height - 550 - 2 * margin) + panOffset.y,
      invX: (px: number) => ((px - width / 2 - panOffset.x) / (width / 2 - margin)) * extent,
      invY: (py: number) => ((height - 340 - margin - py + panOffset.y) / (height - 550 - 2 * margin)) * extent,
      extent,
      pixelsPerYard: ((width / 2 - margin) / extent)
    };
  }, [yardScale, zoomScale, height, panOffset]);

  const getShiftedX = (x: number) => {
    // The graph and the actual maneuver are totally different.
    // The graph always remains at the origin (0,0) to represent the math plot.
    return x;
  };

  const getShiftedY = (y: number) => {
    // The graph always remains at the origin (0,0) to represent the math plot.
    return y;
  };

  const guideXCoord = stationSolver?.enabled ? 0 : guideOffset;

  const ticks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 360; i += 5) {
      const isMajor = i % 30 === 0;
      const isMedium = i % 10 === 0 && !isMajor;
      const tickLen = isMajor ? 10 : (isMedium ? 7 : 4);
      const angleRad = (i * Math.PI) / 180;
      const theta = angleRad - Math.PI / 2;
      const r1 = 160; 
      const r2 = r1 - tickLen;
      
      arr.push({
        x1: r1 * Math.cos(theta),
        y1: r1 * Math.sin(theta),
        x2: r2 * Math.cos(theta),
        y2: r2 * Math.sin(theta),
        isMajor,
        isMedium
      });
    }
    return arr;
  }, []);

  const labels = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 360; i += 30) {
      const angleRad = (i * Math.PI) / 180;
      const theta = angleRad - Math.PI / 2;
      const rLabel = 172; 
      const bearingStr = i.toString().padStart(3, '0');
      
      arr.push({
        x: rLabel * Math.cos(theta),
        y: rLabel * Math.sin(theta),
        text: bearingStr
      });
    }
    return arr;
  }, []);

  const cardinalLabels = useMemo(() => {
    return [
      { text: 'N', angle: 0 },
      { text: 'E', angle: 90 },
      { text: 'S', angle: 180 },
      { text: 'W', angle: 270 }
    ].map(c => {
      const theta = (c.angle * Math.PI) / 180 - Math.PI / 2;
      const r = 132;
      return {
        x: r * Math.cos(theta),
        y: r * Math.sin(theta),
        text: c.text
      };
    });
  }, []);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!showCompass) return;
    
    // Prevent moving if clicking buttons or scale toolbars inside the interactive areas
    const target = e.target as SVGElement;
    if (target.closest('.pointer-events-auto') || target.tagName === 'BUTTON') {
      return;
    }

    if (!svgRef.current) return;
    
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;
    
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(CTM.inverse());
    
    const worldX = scale.invX(svgPt.x);
    const worldY = scale.invY(svgPt.y);

    setCompassPos({ x: worldX, y: worldY });
  };

  const cornerPathD = useMemo(() => {
    return result.corner_points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${scale.x(getShiftedX(p.x))} ${scale.y(getShiftedY(p.y))}`
    ).join(' ');
  }, [result, scale, stationSolver]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (target.closest('.pointer-events-auto') || target.tagName === 'BUTTON') {
      return;
    }
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (target.closest('.pointer-events-auto') || target.tagName === 'BUTTON') {
      return;
    }
    if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    lastTouchDist.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (target.closest('.pointer-events-auto') || target.tagName === 'BUTTON') {
      return;
    }

    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      const factor = dist / lastTouchDist.current;
      if (Math.abs(dist - lastTouchDist.current) > 1) {
        setZoomScale(prev => Math.max(0.5, Math.min(6.0, prev * factor)));
        lastTouchDist.current = dist;
      }
      return;
    }

    if (!svgRef.current || !isDragging || e.touches.length !== 1) return;
    
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;

    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;
    
    const viewBoxDx = dx / CTM.a;
    const viewBoxDy = dy / CTM.d;

    setPanOffset(prev => ({
      x: prev.x + viewBoxDx,
      y: prev.y + viewBoxDy
    }));
    
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    const pt = svgRef.current.createSVGPoint();
    pt.x = e.touches[0].clientX;
    pt.y = e.touches[0].clientY;
    const svgPt = pt.matrixTransform(CTM.inverse());
    
    const worldX = scale.invX(svgPt.x);
    const worldY = scale.invY(svgPt.y);

    if (showCompass) {
      setMouseWorld({ x: worldX, y: worldY });
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomIntensity = 0.08;
    const delta = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
    setZoomScale(prev => Math.max(0.5, Math.min(6.0, prev * delta)));
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;
    
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(CTM.inverse());
    
    const worldX = scale.invX(svgPt.x);
    const worldY = scale.invY(svgPt.y);

    if (showCompass) {
      setMouseWorld({ x: worldX, y: worldY });
    }

    if (isDragging) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      const viewBoxDx = dx / CTM.a;
      const viewBoxDy = dy / CTM.d;

      setPanOffset(prev => ({
        x: prev.x + viewBoxDx,
        y: prev.y + viewBoxDy
      }));
      
      dragStart.current = { x: e.clientX, y: e.clientY };
      return; 
    }

    let minDistance = 30 / scale.pixelsPerYard; 
    let foundInfo: HoverInfo | null = null;

    for (let i = 1; i < result.corner_points.length; i++) {
      const p1Raw = result.corner_points[i - 1];
      const p2Raw = result.corner_points[i];
      const p1 = {
        ...p1Raw,
        x: getShiftedX(p1Raw.x),
        y: getShiftedY(p1Raw.y)
      };
      const p2 = {
        ...p2Raw,
        x: getShiftedX(p2Raw.x),
        y: getShiftedY(p2Raw.y)
      };
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) continue;
      
      let t = ((worldX - p1.x) * dx + (worldY - p1.y) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      const dist = Math.sqrt((worldX - projX) ** 2 + (worldY - projY) ** 2);
      
      if (dist < minDistance) {
        minDistance = dist;
        const segmentDist = Math.sqrt((projX - p1.x) ** 2 + (projY - p1.y) ** 2);
        const currentHead = p1.headingAtStep ?? 0;
        
        foundInfo = {
          x: projX,
          y: projY,
          svgX: scale.x(projX),
          svgY: scale.y(projY),
          heading: currentHead,
          advance: p2.type === 'advance' ? segmentDist : (p1.type === 'advance' ? Math.sqrt((p1.x - getShiftedX(result.corner_points[i-2].x))**2 + (p1.y - getShiftedY(result.corner_points[i-2].y))**2) : 0),
          transfer: p2.type === 'transfer' ? segmentDist : 0,
          visible: true,
          legLabel: p2.type === 'advance' ? `Advance Leg` : `Transfer Leg`
        };
      }
    }
    setHover(foundInfo);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const legs = useMemo(() => {
    return result.track_points.slice(1).map((tp, idx) => {
      const angle = tp.turnAngle !== undefined ? tp.turnAngle : (() => {
        const prevHeading = result.track_points[idx].heading;
        let a = tp.heading - prevHeading;
        if (a > 180) a -= 360;
        if (a < -180) a += 360;
        return a;
      })();

      return {
        leg: idx + 1,
        angle: angle,
        advance: tp.advance,
        transfer: tp.transfer,
        time: tp.time
      };
    });
  }, [result]);

  const animationNodes = useMemo(() => {
    const nodes: Array<{ x: number; y: number; heading: number; time: number }> = [];
    let cumTime = 0;
    
    // Node 0 starts at (0,0) and course 000 at time 0
    nodes.push({
      x: 0,
      y: 0,
      heading: 0,
      time: 0
    });

    for (let i = 0; i < result.track_points.length - 1; i++) {
      const tp = result.track_points[i + 1];
      const prevNode = nodes[nodes.length - 1];
      
      const advPoint = result.corner_points[2 * i + 1];
      const trPoint = result.corner_points[2 * i + 2];

      if (!advPoint || !trPoint) continue;

      const advance = tp.advance;
      const transfer = tp.transfer;
      const legTime = tp.time;
      const totalDist = advance + transfer;

      const advRatio = totalDist > 0 ? advance / totalDist : 0.5;
      const tAdv = legTime * advRatio;

      // Save advance point (end of advance leg)
      const advHeading = prevNode.heading;
      nodes.push({
        x: advPoint.x,
        y: advPoint.y,
        heading: advHeading,
        time: cumTime + tAdv
      });

      // Save transfer point (end of transfer leg)
      const trHeading = trPoint.headingAtStep ?? prevNode.heading;
      nodes.push({
        x: trPoint.x,
        y: trPoint.y,
        heading: trHeading,
        time: cumTime + legTime
      });

      cumTime += legTime;
    }

    return nodes;
  }, [result]);

  const ppiInitialStation = useMemo(() => {
    if (stationSolver?.enabled) {
      return stationSolver.initialStation;
    }
    return { x: 0, y: 1200, name: "Initial Position", bearing: 0, range: 1200 };
  }, [stationSolver]);

  const ppiTargetStation = useMemo(() => {
    if (stationSolver?.enabled) {
      return stationSolver.targetStation;
    }
    const relX = result.final_position.x;
    const relY = 1200 + result.final_position.y - result.guide_distance;
    const range = Math.sqrt(relX * relX + relY * relY);
    const bearingRad = Math.atan2(relX, relY);
    const bearing = (bearingRad * 180 / Math.PI + 360) % 360;
    return { x: relX, y: relY, name: "Final Position", bearing, range };
  }, [stationSolver, result]);

  const relativeTrackPathD = useMemo(() => {
    if (animationNodes.length === 0) return "";
    const initialX = ppiInitialStation.x;
    const initialY = ppiInitialStation.y;
    const guideSpeedYdsPerSec = result.total_time > 0 ? result.guide_distance / result.total_time : 0;

    return animationNodes.map((node, idx) => {
      const relX = initialX + node.x;
      const relY = initialY + node.y - (guideSpeedYdsPerSec * node.time);
      const svgX = scale.x(relX);
      const svgY = scale.y(relY);
      return `${idx === 0 ? 'M' : 'L'} ${svgX} ${svgY}`;
    }).join(' ');
  }, [animationNodes, ppiInitialStation, result.guide_distance, result.total_time, scale]);

  const currentShip = useMemo(() => {
    const t = animationTime;
    if (animationNodes.length === 0) return { x: 0, y: 0, heading: 0 };
    if (t <= 0) return animationNodes[0];
    if (t >= result.total_time) return animationNodes[animationNodes.length - 1];

    for (let i = 1; i < animationNodes.length; i++) {
      const p1 = animationNodes[i - 1];
      const p2 = animationNodes[i];
      if (t >= p1.time && t <= p2.time) {
        const duration = p2.time - p1.time;
        const ratio = duration > 0 ? (t - p1.time) / duration : 0;
        
        const x = p1.x + (p2.x - p1.x) * ratio;
        const y = p1.y + (p2.y - p1.y) * ratio;
        
        let h1 = p1.heading;
        let h2 = p2.heading;
        let diff = h2 - h1;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        const heading = (h1 + diff * ratio + 360) % 360;

        return { x, y, heading };
      }
    }

    return animationNodes[animationNodes.length - 1];
  }, [animationTime, animationNodes, result.total_time]);

  const activePhase = useMemo(() => {
    const t = animationTime;
    if (animationNodes.length <= 1) return { label: "Ready", detail: "Maneuver inactive" };
    if (t <= 0) return { label: "Ready", detail: "Ready to execute" };
    if (t >= result.total_time) return { label: "Finished", detail: "Arrived in Station" };

    let cumTime = 0;
    for (let i = 0; i < result.track_points.length - 1; i++) {
      const tp = result.track_points[i + 1];
      const legTime = tp.time;
      const advance = tp.advance;
      const transfer = tp.transfer;
      const totalDist = advance + transfer;
      const advRatio = totalDist > 0 ? advance / totalDist : 0.5;
      const tAdv = legTime * advRatio;

      const prevHeading = i === 0 ? 0 : result.track_points[i].heading;
      const nextHeading = tp.heading;

      if (t >= cumTime && t <= cumTime + legTime) {
        if (t <= cumTime + tAdv) {
          return {
            label: `Leg ${i + 1}: Advance`,
            detail: `Steady Course ${Math.round(prevHeading).toString().padStart(3, '0')}°`
          };
        } else {
          return {
            label: `Leg ${i + 1}: Turn`,
            detail: `Swinging: ${Math.round(prevHeading).toString().padStart(3, '0')}° ➔ ${Math.round(nextHeading).toString().padStart(3, '0')}°`
          };
        }
      }
      cumTime += legTime;
    }
    return { label: "Navigating", detail: "Adjusting station" };
  }, [animationTime, animationNodes, result]);

  const dynamicTitle = useMemo(() => {
    if (legs.length === 0) return "Tactical Plot Evolution";
    const a1 = Math.abs(Math.round(legs[0].angle));
    
    if (legs.length === 2) {
      return `${a1}° HALF FISHTAIL`;
    } else if (legs.length === 3) {
      const a2 = Math.abs(Math.round(legs[1].angle));
      const a3 = Math.abs(Math.round(legs[2].angle));
      
      if (Math.abs(a2 - 2 * a1) <= 1 && Math.abs(a3 - a1) <= 1) {
        return `${a1}° FULL FISHTAIL`;
      } else {
        return `${a1}° ${a3}° DISTORTED FISHTAIL`;
      }
    }
    return "FISHTAIL EVOLUTION";
  }, [legs]);

  return (
    <div ref={containerRef} className="glass rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden relative shadow-2xl animate-in fade-in duration-500 cursor-crosshair">
      {/* View Mode Tab Selector absolute-center at top */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-35 pointer-events-auto flex p-1 bg-slate-900/95 border border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => setViewMode('graph')}
          className={`px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all flex items-center gap-1.5 select-none ${viewMode === 'graph' ? 'bg-blue-600 text-white shadow shadow-blue-500/20' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <BarChart2 className="w-3.5 h-3.5" /> Math Plot
        </button>
        <button
          type="button"
          onClick={() => setViewMode('ppi')}
          className={`px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all flex items-center gap-1.5 select-none ${viewMode === 'ppi' ? 'bg-cyan-600 text-white shadow shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} /> Radar PPI Simulator
        </button>
      </div>

      {/* Floating Draggable Tactical Animation HUD */}
      <div 
        id="draggable-hud"
        onMouseDown={(e) => handleDragStart(e, setHudPos, hudPos, 'hud')}
        onTouchStart={(e) => handleDragStart(e, setHudPos, hudPos, 'hud')}
        style={hudPos ? { left: `${hudPos.x}px`, top: `${hudPos.y}px` } : undefined}
        className={`absolute z-35 pointer-events-auto transition-all ${hudPos ? '' : 'left-6 top-[220px] sm:top-24'} animate-in slide-in-from-left-4 duration-300`}
      >
        {hudMinimized ? (
          <button
            type="button"
            onClick={() => setHudMinimized(false)}
            className="w-12 h-12 rounded-full glass border border-slate-800 hover:border-cyan-500 text-cyan-400 shadow-2xl flex items-center justify-center transition-all cursor-pointer glow-cyan active:scale-95 group relative select-none bg-slate-950/95"
            title="Expand Maneuver Animator"
          >
            <Play className="w-5 h-5 fill-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[8px] font-black text-cyan-400 uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
              Animator
            </span>
          </button>
        ) : (
          <div className="glass px-3 py-2.5 rounded-2xl border border-slate-800/80 bg-slate-955/95 shadow-2xl flex flex-col gap-2 select-none cursor-grab active:cursor-grabbing w-[190px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/50 pb-1.5">
              <div className="flex flex-col animate-in fade-in duration-300">
                <h4 className="text-[9px] font-black text-cyan-400 tracking-widest uppercase truncate max-w-[105px]">Maneuver Animator</h4>
                <p className="text-[7.5px] text-slate-500 font-bold uppercase">
                  {stationSolver?.enabled ? 'Target Mode' : 'Direct Motion'}
                </p>
              </div>
              
              {/* Minimize button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setHudMinimized(true); }}
                className="p-1 rounded-md hover:bg-slate-800/80 text-slate-400 hover:text-cyan-400 transition-all font-bold ml-1 flex items-center justify-center shrink-0"
                title="Minimize"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Live status badge */}
              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex flex-col gap-0.5 font-mono">
                <div className="flex justify-between items-center text-[8px]">
                  <span className="text-slate-500 uppercase">TIME:</span>
                  <span className="text-white font-bold">{animationTime.toFixed(1)}s / {result.total_time.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between items-center text-[8px]">
                  <span className="text-slate-500 uppercase">HEAD:</span>
                  <span className="text-yellow-400 font-bold">{Math.round(currentShip.heading).toString().padStart(3, '0')}°</span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-1.5 border border-slate-800/50">
                  <div 
                    className="bg-cyan-500 h-full rounded-full transition-all duration-75"
                    style={{ width: `${(animationTime / result.total_time) * 100}%` }}
                  />
                </div>

                {/* Real-time sub-phase context tracking */}
                <div className="flex flex-col border-t border-slate-800/50 pt-1 mt-1 text-[7.5px] font-black">
                  <span className="text-cyan-400 tracking-tight uppercase">{activePhase.label}</span>
                  <span className="text-slate-300 font-medium leading-tight mt-0.5 font-sans normal-case">{activePhase.detail}</span>
                </div>
              </div>

              {/* Play / Pause row */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPlaying(prev => !prev)}
                  className={`flex-1 py-1.2 rounded-lg text-[8.5px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1 active:scale-95 ${isPlaying ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-2.5 h-2.5 fill-white" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-2.5 h-2.5 fill-white" /> Play
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setAnimationTime(0);
                  }}
                  className="p-1 px-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all active:scale-95"
                  title="Reset Animation"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Speed multiplier selector */}
              <div className="flex justify-between items-center bg-slate-900/65 border border-slate-800/40 p-1.5 rounded-xl gap-1">
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest pl-1">WARP:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 5, 10].map(sp => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => setAnimationSpeed(sp)}
                      className={`px-1 py-0.5 rounded text-[8px] font-black transition-all ${animationSpeed === sp ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Draggable Save & Zoom Palette */}
      <div
        id="draggable-palette"
        onMouseDown={(e) => handleDragStart(e, setPalettePos, palettePos, 'palette')}
        onTouchStart={(e) => handleDragStart(e, setPalettePos, palettePos, 'palette')}
        style={palettePos ? { left: `${palettePos.x}px`, top: `${palettePos.y}px` } : undefined}
        className={`absolute z-35 pointer-events-auto transition-all ${palettePos ? '' : 'right-6 top-[220px] sm:top-24'} animate-in slide-in-from-right-4 duration-300`}
      >
        {paletteMinimized ? (
          <button
            type="button"
            onClick={() => setPaletteMinimized(false)}
            className="w-12 h-12 rounded-full glass border border-slate-800 hover:border-cyan-500 text-cyan-400 shadow-2xl flex items-center justify-center transition-all cursor-pointer glow-cyan active:scale-95 group relative select-none bg-slate-950/95"
            title="Expand Controls"
          >
            <SlidersHorizontal className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[8px] font-black text-cyan-400 uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all">
              Controls
            </span>
          </button>
        ) : (
          <div className="glass px-3 py-2.5 rounded-2xl border border-slate-800/80 bg-slate-955/95 shadow-2xl flex flex-col gap-2 select-none cursor-grab active:cursor-grabbing w-[230px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/50 pb-1.5 animate-in fade-in duration-300">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-cyan-400 tracking-widest uppercase">Plot Controls</span>
                <span className="text-[8px] font-black text-blue-400 uppercase tracking-wider">
                  Scale: {yardScale} YDS
                </span>
              </div>
              {/* Minimize button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPaletteMinimized(true); }}
                className="p-1 rounded-md hover:bg-slate-800/80 text-slate-400 hover:text-cyan-400 transition-all font-bold ml-1 flex items-center justify-center shrink-0"
                title="Minimize"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Scale Presets Grid */}
              <div className="flex flex-col gap-1">
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider">Scale Presets</span>
                <div className="flex gap-1">
                  {[50, 100, 200, 500].map(s => (
                    <button 
                      key={s} 
                      type="button"
                      onClick={() => onSetScale(s)}
                      className={`flex-1 py-1 rounded-lg text-[8px] font-black tracking-tight transition-all uppercase ${yardScale === s ? 'bg-blue-600 text-white shadow shadow-blue-500/20' : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                    >
                      {s}Y
                    </button>
                  ))}
                </div>
              </div>

              {/* Zoom & View Controls Grid */}
              <div className="flex flex-col gap-1">
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider">Zoom & View</span>
                <div className="flex items-center gap-1">
                  <button 
                    type="button"
                    onClick={() => setZoomScale(prev => Math.min(6.0, prev * 1.3))}
                    className="flex-1 py-1 bg-slate-900 border border-slate-800/40 hover:bg-slate-800 text-blue-400 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3 h-3" />
                    <span className="text-[8px] font-black uppercase tracking-tight">In</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setZoomScale(prev => Math.max(0.5, prev / 1.3))}
                    className="flex-1 py-1 bg-slate-900 border border-slate-800/40 hover:bg-slate-800 text-blue-400 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3 h-3" />
                    <span className="text-[8px] font-black uppercase tracking-tight">Out</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      setZoomScale(1);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className="flex-1 py-1 bg-slate-900 border border-slate-800/40 hover:bg-slate-800 text-amber-505 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1"
                    title="Reset Zoom"
                  >
                    <span className="text-[8px] font-black uppercase tracking-tight">1:1</span>
                  </button>
                </div>
              </div>

              {/* Compass Toggle & Recenter Box */}
              <div className="flex flex-col gap-1 border-t border-slate-900 pt-2">
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider">Compass Overlay</span>
                <div className="flex gap-1">
                  <button 
                    type="button"
                    onClick={() => setShowCompass(prev => !prev)}
                    className={`flex-1 py-1 rounded-lg text-[8px] font-black tracking-tight transition-all uppercase flex items-center justify-center gap-1 ${showCompass ? 'bg-indigo-600 text-white' : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800'}`}
                  >
                    <Compass className="w-3 h-3 animate-pulse" />
                    {showCompass ? 'ON' : 'OFF'}
                  </button>
                  {showCompass && (
                    <button 
                      type="button"
                      onClick={() => setCompassPos({ x: 0, y: 0 })}
                      className="py-1 px-2 rounded-lg text-[8px] font-black tracking-tight transition-all uppercase bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      Reset
                    </button>
                  )}
                </div>
                {(panOffset.x !== 0 || panOffset.y !== 0) && (
                  <button 
                    type="button"
                    onClick={() => setPanOffset({ x: 0, y: 0 })}
                    className="mt-1 w-full py-1 rounded-lg text-[8px] font-black tracking-tight transition-all uppercase bg-teal-600 hover:bg-teal-500 text-white font-bold animate-in zoom-in-95 duration-200 text-center"
                  >
                    Recenter Map View
                  </button>
                )}
              </div>

              {/* Save & Export Section */}
              <div className="flex flex-col gap-1 border-t border-slate-900 pt-2">
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider">Save & Export</span>
                <div className="flex gap-1.5">
                  {onExport && (
                    <>
                      <button 
                        type="button"
                        onClick={() => onExport('jpg')}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[8px] font-black tracking-widest uppercase transition-all active:scale-95 text-center flex items-center justify-center cursor-pointer font-black"
                      >
                        JPG
                      </button>
                      <button 
                        type="button"
                        onClick={() => onExport('svg')}
                        className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[8px] font-black tracking-widest uppercase transition-all active:scale-95 text-center flex items-center justify-center cursor-pointer border border-slate-800"
                      >
                        SVG
                      </button>
                    </>
                  )}

                  {onSaveAsTable && (
                    <button 
                      type="button"
                      onClick={onSaveAsTable}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[8px] font-black tracking-widest uppercase transition-all active:scale-95 text-center flex items-center justify-center cursor-pointer font-black"
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showCompass && (
        <div className="absolute bottom-6 left-6 z-30 bg-slate-950/90 hover:bg-slate-950 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-800/80 text-[10px] uppercase font-bold tracking-wider animate-pulse flex items-center gap-1.5 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></div>
          Click plot to reposition Compass Rose (Drag plot to pan)
        </div>
      )}

      <svg 
        ref={svgRef} 
        viewBox={`0 0 ${width} ${height}`} 
        className={`w-full h-auto select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHover(null);
          setMouseWorld(null);
          setIsDragging(false);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleSvgClick}
        onWheel={handleWheel}
      >
        <defs>
          <linearGradient id="radarSweepGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="radarScreenBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#155e75" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={width} height={height} fill="#020617" />

        {/* RADAR PPI BACKGROUND BLUR EFFECT */}
        {viewMode === 'ppi' && (
          <circle 
            cx={scale.x(0)} 
            cy={scale.y(0)} 
            r={(yardScale * 1.5) * scale.pixelsPerYard} 
            fill="url(#radarScreenBg)" 
          />
        )}
        
        {/* Radar PPI Rings and Compass Lines */}
        {viewMode === 'ppi' && (() => {
          const rScaleExtent = yardScale / zoomScale;
          const ringUnits = [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000].filter(r => r < rScaleExtent * 1.8);
          const bearingAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
          const sweepAngle = (animationTime * 45) % 360;

          return (
            <g id="radar-ppi-grid">
              {/* Concentric rings */}
              {ringUnits.map(r => (
                <g key={`ring-${r}`}>
                  <circle 
                    cx={scale.x(0)} 
                    cy={scale.y(0)} 
                    r={r * scale.pixelsPerYard} 
                    fill="none" 
                    stroke="#06b6d4" 
                    strokeWidth={r % 1000 === 0 ? "1.5" : "0.75"} 
                    strokeDasharray={r % 1000 === 0 ? "none" : "3,3"}
                    opacity={r % 1000 === 0 ? "0.35" : "0.15"} 
                  />
                  <text 
                    x={scale.x(0) + (r * scale.pixelsPerYard)} 
                    y={scale.y(0)} 
                    dy="11"
                    fill="#06b6d4" 
                    opacity="0.5"
                    className="text-[8px] font-black tracking-normal select-none pointer-events-none font-mono"
                    textAnchor="middle"
                  >
                    {r}Y
                  </text>
                </g>
              ))}

              {/* Bearing radial lines */}
              {bearingAngles.map(angle => {
                const angleRad = (angle * Math.PI) / 180;
                const px = Math.sin(angleRad) * (rScaleExtent * 0.9);
                const py = Math.cos(angleRad) * (rScaleExtent * 0.9);
                return (
                  <g key={`brg-${angle}`}>
                    <line 
                      x1={scale.x(0)} 
                      y1={scale.y(0)} 
                      x2={scale.x(px)} 
                      y2={scale.y(py)} 
                      stroke="#06b6d4" 
                      strokeWidth="0.5" 
                      opacity="0.15" 
                    />
                    <text 
                      x={scale.x(px * 1.04)} 
                      y={scale.y(py * 1.04)} 
                      fill="#06b6d4" 
                      opacity="0.6"
                      className="text-[8px] font-black font-mono select-none pointer-events-none"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {angle.toString().padStart(3, '0')}°
                    </text>
                  </g>
                );
              })}

              {/* Rotating radar sweep */}
              <g transform={`translate(${scale.x(0)}, ${scale.y(0)}) rotate(${sweepAngle})`}>
                <line 
                  x1="0" 
                  y1="0" 
                  x2="0" 
                  y2={-rScaleExtent * 1.1 * scale.pixelsPerYard} 
                  stroke="#22d3ee" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  opacity="0.6" 
                />
                <path 
                  d={`M 0 0 L ${Math.sin(-18 * Math.PI / 180) * -rScaleExtent * 1.1 * scale.pixelsPerYard} ${Math.cos(-18 * Math.PI / 180) * -rScaleExtent * 1.1 * scale.pixelsPerYard} A ${rScaleExtent * 1.1 * scale.pixelsPerYard} ${rScaleExtent * 1.1 * scale.pixelsPerYard} 0 0 1 0 ${-rScaleExtent * 1.1 * scale.pixelsPerYard} Z`} 
                  fill="url(#radarSweepGlow)" 
                  opacity="0.22" 
                />
              </g>
            </g>
          );
        })()}

        {/* Coordinate Grid Overlay */}
        {viewMode === 'graph' && (() => {
          // Identify scope based on yardScale, minor lines every 100yds, major division every 500yds
          const maxVal = Math.max(5000, yardScale * 3);
          const gridValues: number[] = [];
          for (let val = -maxVal; val <= maxVal; val += 100) {
            gridValues.push(val);
          }

          return (
            <g id="coordinate-grid-overlay">
              {gridValues.map(val => {
                const x = scale.x(val);
                const y = scale.y(val);
                const isMajor = val % 500 === 0;
                const isCenter = val === 0;

                const showX = x >= 15 && x <= width - 15;
                const showY = y >= 60 && y <= height - 320;

                if (!isMajor) {
                  // Minor grid lines (100yds)
                  return (
                    <React.Fragment key={`minor-${val}`}>
                      {showX && (
                        <line 
                          x1={x} 
                          y1={60} 
                          x2={x} 
                          y2={height - 320} 
                          stroke="#0f172a" 
                          strokeWidth="0.5" 
                        />
                      )}
                      {showY && (
                        <line 
                          x1={15} 
                          y1={y} 
                          x2={width - 15} 
                          y2={y} 
                          stroke="#0f172a" 
                          strokeWidth="0.5" 
                        />
                      )}
                    </React.Fragment>
                  );
                }

                // Major coordinate grid lines (500yds)
                return (
                  <React.Fragment key={`major-${val}`}>
                    {/* Vertical grid line */}
                    {showX && (
                      <g>
                        <line 
                          x1={x} 
                          y1={60} 
                          x2={x} 
                          y2={height - 320} 
                          stroke={isCenter ? "#334155" : "#1e293b"} 
                          strokeWidth={isCenter ? "1.5" : "0.75"} 
                          strokeDasharray={isCenter ? "none" : "3,3"}
                        />
                        {/* X-Axis Distance Marker on Y-limit edge */}
                        <g transform={`translate(${x}, ${height - 325})`}>
                          <rect 
                            x="-22" 
                            y="-7" 
                            width="44" 
                            height="14" 
                            rx="4" 
                            fill="#090d16" 
                            stroke="#1e293b" 
                            strokeWidth="1" 
                          />
                          <text 
                            fill={isCenter ? "#22d3ee" : "#475569"} 
                            className="text-[8px] font-black mono select-none pointer-events-none" 
                            textAnchor="middle"
                            y="2.5"
                          >
                            {val === 0 ? "0 Y" : `${val > 0 ? "+" : ""}${val}`}
                          </text>
                        </g>
                      </g>
                    )}

                    {/* Horizontal grid line */}
                    {showY && (
                      <g>
                        <line 
                          x1={15} 
                          y1={y} 
                          x2={width - 15} 
                          y2={y} 
                          stroke={isCenter ? "#334155" : "#1e293b"} 
                          strokeWidth={isCenter ? "1.5" : "0.75"} 
                          strokeDasharray={isCenter ? "none" : "3,3"}
                        />
                        {/* Y-Axis Distance Marker on X-limit edge */}
                        <g transform={`translate(42, ${y})`}>
                          <rect 
                            x="-22" 
                            y="-7" 
                            width="44" 
                            height="14" 
                            rx="4" 
                            fill="#090d16" 
                            stroke="#1e293b" 
                            strokeWidth="1" 
                          />
                          <text 
                            fill={isCenter ? "#22d3ee" : "#475569"} 
                            className="text-[8px] font-black mono select-none pointer-events-none" 
                            textAnchor="middle" 
                            dominantBaseline="middle"
                          >
                            {val === 0 ? "0 Y" : `${val > 0 ? "+" : ""}${val}`}
                          </text>
                        </g>
                      </g>
                    )}
                  </React.Fragment>
                );
              })}
            </g>
          );
        })()}

        {/* Scale Indicator */}
        <g transform={`translate(40, ${height - 340})`}>
          <line x1="0" y1="0" x2={200 * scale.pixelsPerYard} y2="0" stroke="#94a3b8" strokeWidth="2" />
          <line x1="0" y1="-5" x2="0" y2="5" stroke="#94a3b8" strokeWidth="2" />
          <line x1={200 * scale.pixelsPerYard} y1="-5" x2={200 * scale.pixelsPerYard} y2="5" stroke="#94a3b8" strokeWidth="2" />
          <text x={100 * scale.pixelsPerYard} y="-12" textAnchor="middle" fill="#94a3b8" className="text-[10px] font-black uppercase">200 Yards</text>
        </g>

        {/* GUIDE SHIP PATH */}
        {viewMode === 'graph' && (
          <g>
            <line 
              x1={scale.x(guideXCoord)} y1={scale.y(0)} 
              x2={scale.x(guideXCoord)} y2={scale.y(result.guide_distance)} 
              stroke="#eab308" strokeWidth="1.5" strokeDasharray="8,4" 
              opacity={stationSolver?.enabled ? "0.6" : "0.3"}
            />
            <circle cx={scale.x(guideXCoord)} cy={scale.y(result.guide_distance)} r="4" fill="#64748b" />
            <text x={scale.x(guideXCoord)} y={scale.y(result.guide_distance)} dy="-15" textAnchor="middle" fill="#fbbf24" className="text-[10px] font-black uppercase tracking-widest">{stationSolver?.enabled ? "Guide Track (000°)" : "Guide Pos Final"}</text>
          </g>
        )}

        {/* COMPASS ROSE INTERACTIVE OVERLAY */}
        {showCompass && (
          <g transform={`translate(${scale.x(compassPos.x)}, ${scale.y(compassPos.y)})`}>
            {/* Outer dotted boundary */}
            <circle r="195" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,6" strokeOpacity="0.05" />

            {/* Concentric rings */}
            <circle r="160" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.25" />
            <circle r="148" fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeOpacity="0.15" />
            <circle r="120" fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeOpacity="0.1" />
            
            {/* Radial crosshair tracks */}
            <line x1="-165" y1="0" x2="165" y2="0" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="3,3" strokeOpacity="0.15" />
            <line x1="0" y1="-165" x2="0" y2="165" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="3,3" strokeOpacity="0.15" />

            {/* Core beveled marine star */}
            <g opacity="0.65">
              {/* Primary blades */}
              <g transform="rotate(0)">
                <path d="M 0 0 L -5 -12 L 0 -110 Z" fill="#60a5fa" fillOpacity="0.3" />
                <path d="M 0 0 L 5 -12 L 0 -110 Z" fill="#1d4ed8" fillOpacity="0.3" />
              </g>
              <g transform="rotate(90)">
                <path d="M 0 0 L -5 -12 L 0 -110 Z" fill="#60a5fa" fillOpacity="0.3" />
                <path d="M 0 0 L 5 -12 L 0 -110 Z" fill="#1d4ed8" fillOpacity="0.3" />
              </g>
              <g transform="rotate(180)">
                <path d="M 0 0 L -5 -12 L 0 -110 Z" fill="#60a5fa" fillOpacity="0.3" />
                <path d="M 0 0 L 5 -12 L 0 -110 Z" fill="#1d4ed8" fillOpacity="0.3" />
              </g>
              <g transform="rotate(270)">
                <path d="M 0 0 L -5 -12 L 0 -110 Z" fill="#60a5fa" fillOpacity="0.3" />
                <path d="M 0 0 L 5 -12 L 0 -110 Z" fill="#1d4ed8" fillOpacity="0.3" />
              </g>

              {/* Secondary blades */}
              <g transform="rotate(45)">
                <path d="M 0 0 L -4 -10 L 0 -75 Z" fill="#38bdf8" fillOpacity="0.18" />
                <path d="M 0 0 L 4 -10 L 0 -75 Z" fill="#1e293b" fillOpacity="0.18" />
              </g>
              <g transform="rotate(135)">
                <path d="M 0 0 L -4 -10 L 0 -75 Z" fill="#38bdf8" fillOpacity="0.18" />
                <path d="M 0 0 L 4 -10 L 0 -75 Z" fill="#1e293b" fillOpacity="0.18" />
              </g>
              <g transform="rotate(225)">
                <path d="M 0 0 L -4 -10 L 0 -75 Z" fill="#38bdf8" fillOpacity="0.18" />
                <path d="M 0 0 L 4 -10 L 0 -75 Z" fill="#1e293b" fillOpacity="0.18" />
              </g>
              <g transform="rotate(315)">
                <path d="M 0 0 L -4 -10 L 0 -75 Z" fill="#38bdf8" fillOpacity="0.18" />
                <path d="M 0 0 L 4 -10 L 0 -75 Z" fill="#1e293b" fillOpacity="0.18" />
              </g>
              
              <circle r="4" fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeOpacity="0.3" />
              <circle r="1" fill="#38bdf8" fillOpacity="0.5" />
            </g>

            {/* Bearings Tick System */}
            {ticks.map((t, idx) => (
              <line 
                key={`tick-${idx}`} 
                x1={t.x1} 
                y1={t.y1} 
                x2={t.x2} 
                y2={t.y2} 
                stroke={t.isMajor ? "#38bdf8" : (t.isMedium ? "#0ea5e9" : "#0284c7")} 
                strokeWidth={t.isMajor ? 1.5 : 1}
                strokeOpacity={t.isMajor ? 0.45 : (t.isMedium ? 0.3 : 0.15)}
              />
            ))}

            {/* Degree Bearings (rotations offset outwards) */}
            {labels.map((l, idx) => (
              <text
                key={`label-${idx}`}
                x={l.x}
                y={l.y}
                fill="#94a3b8"
                fillOpacity="0.6"
                className="text-[9px] font-black mono select-none pointer-events-none"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {l.text}
              </text>
            ))}

            {/* Primary Cardinal Headers */}
            {cardinalLabels.map((cl, idx) => (
              <text
                key={`clabel-${idx}`}
                x={cl.x}
                y={cl.y}
                fill="#38bdf8"
                fillOpacity="0.8"
                className="text-[12px] font-black tracking-tight select-none pointer-events-none"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {cl.text}
              </text>
            ))}

            {/* High-Contrast Interactive Bearing Highlight */}
            {mouseWorld && (() => {
              const dx = mouseWorld.x - compassPos.x;
              const dy = mouseWorld.y - compassPos.y;
              if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                const bRad = Math.atan2(dx, dy);
                const bearing = (bRad * 180 / Math.PI + 360) % 360;
                const theta = bRad - Math.PI / 2;
                const rLine = 195;
                const endX = rLine * Math.cos(theta);
                const endY = rLine * Math.sin(theta);
                return (
                  <g>
                    {/* Shadow/Glow effect for the contrasting line */}
                    <line 
                      x1="0" 
                      y1="0" 
                      x2={endX} 
                      y2={endY} 
                      stroke="#f43f5e" 
                      strokeWidth="5" 
                      strokeLinecap="round" 
                      opacity="0.35" 
                      className="blur-[2px]"
                    />
                    {/* Main sharp contrasting line */}
                    <line 
                      x1="0" 
                      y1="0" 
                      x2={endX} 
                      y2={endY} 
                      stroke="#f43f5e" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                    />
                    {/* Digital bearing badge on outer perimeter */}
                    <g transform={`translate(${endX * 1.05}, ${endY * 1.05})`}>
                      <circle r="15" fill="#f43f5e" stroke="white" strokeWidth="1.5" className="shadow-lg animate-in zoom-in-50 duration-150" />
                      <text 
                        fill="white" 
                        className="text-[9px] font-black mono select-none pointer-events-none" 
                        textAnchor="middle" 
                        dominantBaseline="middle"
                      >
                        {Math.round(bearing).toString().padStart(3, '0')}
                      </text>
                    </g>
                  </g>
                );
              }
              return null;
            })()}
          </g>
        )}

        {/* OWN SHIP TACTICAL TRACK */}
        {viewMode === 'graph' && (
          <path d={cornerPathD} fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Visual Directional Arrows along EACH leg segment of the path */}
        {viewMode === 'graph' && result.corner_points.map((p, i) => {
          if (i === 0) return null;
          const p1 = result.corner_points[i - 1];
          const p2 = p;

          const svgX1 = scale.x(getShiftedX(p1.x));
          const svgY1 = scale.y(getShiftedY(p1.y));
          const svgX2 = scale.x(getShiftedX(p2.x));
          const svgY2 = scale.y(getShiftedY(p2.y));

          const midX = (svgX1 + svgX2) / 2;
          const midY = (svgY1 + svgY2) / 2;

          const dx = svgX2 - svgX1;
          const dy = svgY2 - svgY1;
          const angleRad = Math.atan2(dy, dx);
          const angleDeg = (angleRad * 180) / Math.PI;

          const turnIdx = Math.floor((i - 1) / 2);
          const turnAngle = legs[turnIdx]?.angle ?? 0;

          return (
            <g key={`dir-arrow-${i}`}>
              {/* Sleek directional indicator arrow overlay on the path line itself */}
              <g transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}>
                <path 
                  d="M -7 -4 L 1 0 L -7 4" 
                  fill="none" 
                  stroke={p2.type === 'transfer' ? (turnAngle >= 0 ? "#22c55e" : "#ef4444") : "#00f0ff"} 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </g>

              {/* Special Rotation indicator widget for Transfer segments */}
              {p2.type === 'transfer' && (
                <g transform={`translate(${midX}, ${midY})`}>
                  {/* Outer circle layout badge */}
                  <circle r="12" fill="#090d16" stroke={turnAngle >= 0 ? "#22c55e" : "#ef4444"} strokeWidth="1.5" className="shadow-lg" />
                  {turnAngle >= 0 ? (
                    // Clockwise Starboard circular arrow symbol
                    <path 
                      d="M -4 -2 A 4 4 0 1 1 -1 3 M -4 -2 L -6.5 -1.5 M -4 -2 L -2.5 -4" 
                      fill="none" 
                      stroke="#22c55e" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      transform="translate(1, -0.5)"
                    />
                  ) : (
                    // Counter-clockwise Port circular arrow symbol
                    <path 
                      d="M 4 -2 A 4 4 0 1 0 1 3 M 4 -2 L 6.5 -1.5 M 4 -2 L 2.5 -4" 
                      fill="none" 
                      stroke="#ef4444" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      transform="translate(-1, -0.5)"
                    />
                  )}
                  {/* Navigation Rotation text label */}
                  <text 
                    fill={turnAngle >= 0 ? "#22c55e" : "#ef4444"} 
                    className="text-[7px] font-black pointer-events-none select-none tracking-widest uppercase"
                    textAnchor="middle"
                    y="-16"
                  >
                    {turnAngle >= 0 ? "STBD" : "PORT"}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Animated Custom Vessel Vector HUD or Relative Station-Taking View */}
        {viewMode === 'ppi' ? (() => {
          const initialX = ppiInitialStation.x;
          const initialY = ppiInitialStation.y;
          const targetX = ppiTargetStation.x;
          const targetY = ppiTargetStation.y;

          const initialSvgX = scale.x(initialX);
          const initialSvgY = scale.y(initialY);
          const targetSvgX = scale.x(targetX);
          const targetSvgY = scale.y(targetY);

          // Radar PPI center (0,0) - Guide is static at center
          const guideSpeedYdsPerSec = result.total_time > 0 ? result.guide_distance / result.total_time : 0;
          
          const guideSvgX = scale.x(0);
          const guideSvgY = scale.y(0);

          // Stationing ship relative positions
          const relOwnX = initialX + currentShip.x;
          const relOwnY = initialY + currentShip.y - (guideSpeedYdsPerSec * animationTime);

          const ownShipSvgX = scale.x(relOwnX);
          const ownShipSvgY = scale.y(relOwnY);

          // Get dynamic relative distance & bearing for HUD connecting vector
          const dx = relOwnX;
          const dy = relOwnY;
          const liveRange = Math.sqrt(dx * dx + dy * dy);
          const liveBearingRad = Math.atan2(dx, dy);
          const liveBearing = (liveBearingRad * 180 / Math.PI + 360) % 360;

          const connectionMidX = (guideSvgX + ownShipSvgX) / 2;
          const connectionMidY = (guideSvgY + ownShipSvgY) / 2;

          return (
            <g id="station-solver-animation-layer">
              {/* Actual relative trajectory (fishtail trace relative to the Guide) */}
              <path 
                d={relativeTrackPathD} 
                fill="none" 
                stroke="#6366f1" 
                strokeWidth="2" 
                strokeDasharray="4,4" 
                opacity="0.8" 
              />

              {/* 1. Relative connection vector line (glowing orange) */}
              <line 
                x1={guideSvgX} 
                y1={guideSvgY} 
                x2={ownShipSvgX} 
                y2={ownShipSvgY} 
                stroke="#eab308" 
                strokeWidth="1.5" 
                strokeDasharray="4,4" 
                opacity="0.85" 
              />

              {/* Live connecting metric tag in the middle */}
              <g transform={`translate(${connectionMidX}, ${connectionMidY})`}>
                <rect 
                  x="-75" 
                  y="-10" 
                  width="150" 
                  height="18" 
                  rx="6" 
                  fill="#030712" 
                  stroke="#eab308" 
                  strokeWidth="1" 
                  opacity="0.95"
                />
                <text 
                  fill="#fbbf24" 
                  className="text-[7.5px] font-black mono text-center select-none pointer-events-none" 
                  textAnchor="middle" 
                  y="1.5"
                >
                  SEP: {Math.round(liveRange)}y | BRG: {Math.round(liveBearing).toString().padStart(3, '0')}°
                </text>
              </g>

              {/* Steady course indicator of Guide (pointing north at 000°) */}
              <line 
                x1={guideSvgX} 
                y1={guideSvgY} 
                x2={guideSvgX} 
                y2={guideSvgY - 60} 
                stroke="#fbbf24" 
                strokeWidth="1.5" 
                strokeDasharray="4,2" 
                opacity="0.7" 
              />

              {/* 2. Initial Station point marker */}
              <circle cx={initialSvgX} cy={initialSvgY} r="14" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3,3" />
              <circle cx={initialSvgX} cy={initialSvgY} r="3" fill="#3b82f6" />
              <text 
                x={initialSvgX} 
                y={initialSvgY - 18} 
                fill="#60a5fa" 
                className="text-[8px] font-black uppercase tracking-wider"
                textAnchor="middle"
              >
                Start: {ppiInitialStation.name} ({Math.round(ppiInitialStation.range)}y)
              </text>

              {/* 3. Target Station point marker */}
              <circle cx={targetSvgX} cy={targetSvgY} r="14" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3,3" />
              <circle cx={targetSvgX} cy={targetSvgY} r="3" fill="#22c55e" />
              <text 
                x={targetSvgX} 
                y={targetSvgY + 22} 
                fill="#4ade80" 
                className="text-[8px] font-black uppercase tracking-wider dialog-title text-center"
                textAnchor="middle"
              >
                Target: {ppiTargetStation.name} ({Math.round(ppiTargetStation.range)}y)
              </text>

              {/* 4. DYNAMIC MOVING REFERENCE GUIDE VESSEL */}
              <g transform={`translate(${guideSvgX}, ${guideSvgY})`}>
                {/* Radar sweep glow */}
                <circle cx="0" cy="0" r="18" fill="none" stroke="#eab308" strokeWidth="0.75" strokeDasharray="2,4" opacity="0.5" />
                
                {/* Guide Ship Hull contour (Course 000) */}
                <path 
                  d="M 0 -13 L 5 -6 L 5 9 C 5 11, -5 11, -5 9 L -5 -6 Z" 
                  fill="#1e1b4b" 
                  stroke="#eab308" 
                  strokeWidth="2" 
                />
                
                {/* Label flag */}
                <g transform="translate(0, -22)">
                  <rect x="-35" y="-7" width="70" height="13" rx="3" fill="#090514" stroke="#eab308" strokeWidth="1" />
                  <text fill="#fbbf24" className="text-[7px] font-black mono text-center" textAnchor="middle" y="2">
                    GUIDE (000°)
                  </text>
                </g>
              </g>

              {/* 5. ANIMATED DYNAMIC OWN SHIP TAKING STATION */}
              <g id="animated-relative-own-ship">
                {/* Dynamic radar ring */}
                <circle 
                  cx={ownShipSvgX} 
                  cy={ownShipSvgY} 
                  r="26" 
                  fill="none" 
                  stroke="#6366f1" 
                  strokeWidth="1.25" 
                  strokeDasharray="4,5" 
                  opacity="0.4" 
                />

                <g transform={`translate(${ownShipSvgX}, ${ownShipSvgY}) rotate(${currentShip.heading})`}>
                  {/* Outer aura outline */}
                  <ellipse cx="0" cy="0" rx="9" ry="14" fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth="1" />
                  
                  {/* Pointed hull contour */}
                  <path 
                    d="M 0 -13 L 5 -6 L 5 10 C 5 12, -5 12, -5 10 L -5 -6 Z" 
                    fill="#050714" 
                    stroke="#818cf8" 
                    strokeWidth="2" 
                  />
                  <line x1="0" y1="8" x2="0" y2="13" stroke="#f43f5e" strokeWidth="1.5" />
                  <line x1="0" y1="-13" x2="0" y2="-26" stroke="#818cf8" strokeWidth="1" strokeDasharray="2,2" />
                  <circle cx="0" cy="-26" r="2" fill="#818cf8" />
                </g>

                {/* Relative Floating Status Badge */}
                <g transform={`translate(${ownShipSvgX}, ${ownShipSvgY - 26})`}>
                  <rect x="-42" y="-8" width="84" height="15" rx="4" fill="#020617" stroke="#6366f1" strokeWidth="1" />
                  <text fill="white" className="text-[7.5px] font-black mono text-center" textAnchor="middle" y="2.5">
                    OWN T+{animationTime.toFixed(1)}s | {Math.round(currentShip.heading).toString().padStart(3, '0')}°
                  </text>
                </g>
              </g>
            </g>
          );
        })() : (() => {
          const shipX = scale.x(currentShip.x);
          const shipY = scale.y(currentShip.y);
          const shipHeading = currentShip.heading;

          return (
            <g id="animated-vessel-overlay">
              {/* Radar pulse glowing ring */}
              <circle 
                cx={shipX} 
                cy={shipY} 
                r="30" 
                fill="none" 
                stroke="#22d3ee" 
                strokeWidth="1" 
                strokeDasharray="4,6" 
                opacity="0.32" 
                className="animate-spin"
                style={{ transformOrigin: `${shipX}px ${shipY}px`, animationDuration: '6s' }}
              />

              {/* Dynamic Position vector marker */}
              <g transform={`translate(${shipX}, ${shipY}) rotate(${shipHeading})`}>
                {/* Aura shadow circle */}
                <ellipse cx="0" cy="0" rx="10" ry="16" fill="rgba(34, 211, 238, 0.15)" stroke="#22d3ee" strokeWidth="0.5" />
                
                {/* Vessel pointed hull contour */}
                <path 
                  d="M 0 -15 L 6 -7 L 6 11 C 6 13, -6 13, -6 11 L -6 -7 Z" 
                  fill="#030712" 
                  stroke="#22d3ee" 
                  strokeWidth="2" 
                />
                
                {/* Visual rudder line inside the vessel back */}
                <line x1="0" y1="10" x2="0" y2="15" stroke="#ef4444" strokeWidth="1.5" />

                {/* Laser Direction Vector Line */}
                <line x1="0" y1="-15" x2="0" y2="-32" stroke="#22d3ee" strokeWidth="1" strokeDasharray="3,2" />
                <circle cx="0" cy="-32" r="2.5" fill="#22d3ee" />
              </g>

              {/* Real-Time Vessel Floating Status Tag */}
              <g transform={`translate(${shipX}, ${shipY + 36})`}>
                <rect x="-42" y="-9" width="84" height="18" rx="5" fill="#020617" stroke="#22d3ee" strokeWidth="1" />
                <text fill="white" className="text-[8px] font-black mono select-none pointer-events-none" textAnchor="middle" y="2.5">
                  T+{animationTime.toFixed(1)}s | {Math.round(shipHeading).toString().padStart(3, '0')}°
                </text>
              </g>
            </g>
          );
        })()}
        
        {/* Plot Labels */}
        {viewMode === 'graph' && (
          <>
            {result.corner_points.map((p, i) => {
              if (i === 0) return null;
              const prev = result.corner_points[i - 1];
              const midX = (getShiftedX(p.x) + getShiftedX(prev.x)) / 2;
              const midY = (getShiftedY(p.y) + getShiftedY(prev.y)) / 2;
              
              return (
                <g key={`lbl-${i}`}>
                  <text 
                    x={scale.x(midX)} 
                    y={scale.y(midY)} 
                    fill={p.type === 'advance' ? "#60a5fa" : "#94a3b8"} 
                    className="text-[9px] font-black uppercase pointer-events-none"
                    textAnchor="middle"
                    dy="-8"
                  >
                    {p.label}
                  </text>

                  {p.type === 'transfer' && (
                    <g transform={`translate(${scale.x(getShiftedX(p.x))}, ${scale.y(getShiftedY(p.y))})`}>
                      <circle r="4" fill="#fbbf24" stroke="white" strokeWidth="1" />
                      <text 
                        fill="#fbbf24" 
                        className="text-[10px] font-black pointer-events-none"
                        textAnchor="start"
                        dx="12"
                        dy="4"
                      >
                        HEAD: {Math.round(p.headingAtStep || 0).toString().padStart(3, '0')}°
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Start & End Markers */}
            <circle cx={scale.x(getShiftedX(0))} cy={scale.y(getShiftedY(0))} r="6" fill="white" stroke="#3b82f6" strokeWidth="2" />
            <circle cx={scale.x(getShiftedX(result.final_position.x))} cy={scale.y(getShiftedY(result.final_position.y))} r="8" fill="#ef4444" stroke="white" strokeWidth="2" />
          </>
        )}

        {/* HOVER TOOLTIP */}
        {hover && (
          <g transform={`translate(${hover.svgX}, ${hover.svgY})`}>
            <circle r="12" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="1" className="animate-pulse" />
            <g transform={`translate(${hover.svgX > width - 200 ? -170 : 20}, ${hover.svgY < 100 ? 60 : -60})`}>
              <rect width="160" height="90" rx="8" fill="rgba(2, 6, 23, 0.95)" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="12" y="24" fill="#3b82f6" className="text-[11px] font-black uppercase tracking-tight">{hover.legLabel}</text>
              <text x="12" y="44" fill="white" className="text-[10px] font-bold">SHIP HEAD: <tspan fill="#fbbf24" className="font-black">{Math.round(hover.heading).toString().padStart(3, '0')}°</tspan></text>
              <text x="12" y="60" fill="white" className="text-[10px] font-bold">ADVANCE: <tspan fill="#60a5fa" className="font-black">{Math.round(hover.advance)} YDS</tspan></text>
              <text x="12" y="76" fill="white" className="text-[10px] font-bold">TRANSFER: <tspan fill="#94a3b8" className="font-black">{Math.round(hover.transfer)} YDS</tspan></text>
            </g>
          </g>
        )}

        {/* MANEOUVER CALCULATIONS BOX */}
        <g transform={`translate(20, ${height - 300})`}>
          <rect width={width - 40} height="160" fill="rgba(15, 23, 42, 0.98)" stroke="#334155" strokeWidth="2" rx="16" />
          <text x="30" y="40" fill="#3b82f6" className="text-base font-black uppercase tracking-widest">MANEOUVER CALCULATIONS</text>
          
          <g transform="translate(30, 75)">
            <text x="0" y="0" fill="#94a3b8" className="text-[11px] font-bold uppercase tracking-widest">Evolution Time:</text>
            <text x="160" y="0" fill="white" className="text-sm font-black mono">{formatTime(result.total_time)}</text>
            <text x="0" y="30" fill="#94a3b8" className="text-[11px] font-bold uppercase tracking-widest">Guide Distance:</text>
            <text x="160" y="30" fill="white" className="text-sm font-black mono">{Math.round(result.guide_distance)} YDS</text>
          </g>

          <g transform="translate(320, 75)">
            <text x="0" y="0" fill="#ef4444" className="text-[11px] font-bold uppercase tracking-widest">Drop Distance (ΔY):</text>
            <text x="180" y="0" fill="white" className="text-sm font-black mono">{Math.round(result.drop_distance)} YDS</text>
            <text x="0" y="30" fill="#3b82f6" className="text-[11px] font-bold uppercase tracking-widest">Lateral Sep. (ΔX):</text>
            <text x="180" y="30" fill="white" className="text-sm font-black mono">{Math.round(result.lateral_separation)} YDS</text>
          </g>

          <g transform={`translate(${width - 240}, 75)`}>
            <text x="0" y="0" fill="#94a3b8" className="text-[11px] font-bold uppercase tracking-widest">Final Pos (yds):</text>
            <text x="0" y="25" fill="#3b82f6" className="text-xs font-black mono">X: {result.final_position.x.toFixed(1)}</text>
            <text x="0" y="45" fill="#3b82f6" className="text-xs font-black mono">Y: {result.final_position.y.toFixed(1)}</text>
          </g>
        </g>

        {/* TURNING DATA INTERPOLATION TABLE */}
        <g transform={`translate(20, ${height - 130})`}>
          <rect width={width - 40} height="110" fill="rgba(15, 23, 42, 0.9)" stroke="#334155" strokeWidth="1" rx="16" />
          <text x="20" y="25" fill="#94a3b8" className="text-[10px] font-black uppercase tracking-widest">TURNING DATA INTERPOLATION</text>
          
          <g transform="translate(20, 45)">
            <text x="0" y="0" fill="#475569" className="text-[9px] font-black uppercase">Turn Angle</text>
            <text x="200" y="0" fill="#475569" className="text-[9px] font-black uppercase">Advance (yds)</text>
            <text x="400" y="0" fill="#475569" className="text-[9px] font-black uppercase">Transfer (yds)</text>
            <text x="600" y="0" fill="#475569" className="text-[9px] font-black uppercase">Time (sec)</text>
          </g>

          {legs.map((leg, idx) => (
            <g key={idx} transform={`translate(20, ${65 + idx * 15})`}>
              <text x="0" y="0" fill="white" className="text-[10px] font-black mono">{leg.angle >= 0 ? '+' : ''}{Math.round(leg.angle)}°</text>
              <text x="200" y="0" fill="#60a5fa" className="text-[10px] font-black mono">{leg.advance.toFixed(1)}</text>
              <text x="400" y="0" fill="#94a3b8" className="text-[10px] font-black mono">{leg.transfer.toFixed(1)}</text>
              <text x="600" y="0" fill="white" className="text-[10px] font-black mono">{leg.time.toFixed(1)}s</text>
            </g>
          ))}
        </g>

        <text x={width / 2} y="50" textAnchor="middle" fill="white" className="text-3xl font-black uppercase tracking-tighter">{dynamicTitle}</text>
      </svg>
    </div>
  );
});

ManeuverVisualizer.displayName = 'ManeuverVisualizer';

export default ManeuverVisualizer;
