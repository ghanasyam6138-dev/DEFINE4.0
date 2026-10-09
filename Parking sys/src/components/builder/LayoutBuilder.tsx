import React, { useState, useRef, useEffect } from 'react';
import type { ParkingArea, ParkingLevel, Slot, LayoutElement, SlotType, SlotStatus } from '../../types';
import { dbService } from '../../services/dbService';
import { useToast } from '../../context/ToastContext';
import {
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Eye,
  Zap,
  ZoomIn,
  ZoomOut,
  Layers,
  Car,
  RotateCcw,
  AlertTriangle,
  Move,
  Maximize2,
  Bike
} from 'lucide-react';

export const renderCurvedRoadSvg = (
  corner: 'top_right' | 'top_left' | 'bottom_right' | 'bottom_left',
  width: number,
  height: number,
  zoomLevel: number = 1
) => {
  const w = width;
  const h = height;
  const rOut = Math.min(w, h);
  const laneW = Math.min(60, rOut);
  const rIn = Math.max(0, rOut - laneW);
  const rMid = (rIn + rOut) / 2;

  let asphaltPath = '';
  let curbPath = '';
  let centerLinePath = '';

  switch (corner) {
    case 'top_right': {
      // Center of curvature at Top-Right (w, 0).
      // Connects Top edge (x in [w - rOut, w - rIn], y = 0) to Right edge (x = w, y in [rIn, rOut])
      if (rIn === 0) {
        asphaltPath = `M ${w - rOut} 0 L ${w} 0 L ${w} ${rOut} A ${rOut} ${rOut} 0 0 1 ${w - rOut} 0 Z`;
        curbPath = `M ${w} ${rOut} A ${rOut} ${rOut} 0 0 1 ${w - rOut} 0`;
      } else {
        asphaltPath = `M ${w - rOut} 0 L ${w - rIn} 0 A ${rIn} ${rIn} 0 0 0 ${w} ${rIn} L ${w} ${rOut} A ${rOut} ${rOut} 0 0 1 ${w - rOut} 0 Z`;
        curbPath = `M ${w - rIn} 0 A ${rIn} ${rIn} 0 0 0 ${w} ${rIn} M ${w} ${rOut} A ${rOut} ${rOut} 0 0 1 ${w - rOut} 0`;
      }
      centerLinePath = `M ${w - rMid} 0 A ${rMid} ${rMid} 0 0 0 ${w} ${rMid}`;
      break;
    }

    case 'top_left': {
      // Center of curvature at Top-Left (0, 0).
      // Connects Top edge (x in [rIn, rOut], y = 0) to Left edge (x = 0, y in [rIn, rOut])
      if (rIn === 0) {
        asphaltPath = `M 0 0 L ${rOut} 0 A ${rOut} ${rOut} 0 0 1 0 ${rOut} Z`;
        curbPath = `M ${rOut} 0 A ${rOut} ${rOut} 0 0 1 0 ${rOut}`;
      } else {
        asphaltPath = `M ${rIn} 0 L ${rOut} 0 A ${rOut} ${rOut} 0 0 1 0 ${rOut} L 0 ${rIn} A ${rIn} ${rIn} 0 0 0 ${rIn} 0 Z`;
        curbPath = `M ${rOut} 0 A ${rOut} ${rOut} 0 0 1 0 ${rOut} M 0 ${rIn} A ${rIn} ${rIn} 0 0 0 ${rIn} 0`;
      }
      centerLinePath = `M ${rMid} 0 A ${rMid} ${rMid} 0 0 1 0 ${rMid}`;
      break;
    }

    case 'bottom_right': {
      // Center of curvature at Bottom-Right (w, h).
      // Connects Bottom edge (x in [w - rOut, w - rIn], y = h) to Right edge (x = w, y in [h - rOut, h - rIn])
      if (rIn === 0) {
        asphaltPath = `M ${w - rOut} ${h} L ${w} ${h} L ${w} ${h - rOut} A ${rOut} ${rOut} 0 0 0 ${w - rOut} ${h} Z`;
        curbPath = `M ${w} ${h - rOut} A ${rOut} ${rOut} 0 0 0 ${w - rOut} ${h}`;
      } else {
        asphaltPath = `M ${w - rOut} ${h} L ${w - rIn} ${h} A ${rIn} ${rIn} 0 0 1 ${w} ${h - rIn} L ${w} ${h - rOut} A ${rOut} ${rOut} 0 0 0 ${w - rOut} ${h} Z`;
        curbPath = `M ${w - rIn} ${h} A ${rIn} ${rIn} 0 0 1 ${w} ${h - rIn} M ${w} ${h - rOut} A ${rOut} ${rOut} 0 0 0 ${w - rOut} ${h}`;
      }
      centerLinePath = `M ${w - rMid} ${h} A ${rMid} ${rMid} 0 0 1 ${w} ${h - rMid}`;
      break;
    }

    case 'bottom_left': {
      // Center of curvature at Bottom-Left (0, h).
      // Connects Bottom edge (x in [rIn, rOut], y = h) to Left edge (x = 0, y in [h - rOut, h - rIn])
      if (rIn === 0) {
        asphaltPath = `M 0 ${h} L ${rOut} ${h} A ${rOut} ${rOut} 0 0 0 0 ${h - rOut} Z`;
        curbPath = `M ${rOut} ${h} A ${rOut} ${rOut} 0 0 0 0 ${h - rOut}`;
      } else {
        asphaltPath = `M ${rIn} ${h} L ${rOut} ${h} A ${rOut} ${rOut} 0 0 0 0 ${h - rOut} L 0 ${h - rIn} A ${rIn} ${rIn} 0 0 1 ${rIn} ${h} Z`;
        curbPath = `M ${rOut} ${h} A ${rOut} ${rOut} 0 0 0 0 ${h - rOut} M 0 ${h - rIn} A ${rIn} ${rIn} 0 0 1 ${rIn} ${h}`;
      }
      centerLinePath = `M ${rMid} ${h} A ${rMid} ${rMid} 0 0 0 0 ${h - rMid}`;
      break;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none'
      }}
    >
      {/* Seamless asphalt body - exactly matches regular road #1c1338 */}
      <path d={asphaltPath} fill="#1c1338" stroke="none" />
      {/* Outer & Inner Curbs - exactly matches regular road border #475569 with borderless joints */}
      <path d={curbPath} fill="none" stroke="#475569" strokeWidth="1" />
      {/* Continuous Center Yellow Divider */}
      <path
        d={centerLinePath}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={Math.max(1.5, 2 * zoomLevel)}
        strokeDasharray="5,4"
      />
    </svg>
  );
};

interface LayoutBuilderProps {
  parkingArea: ParkingArea;
  onSave?: (updatedArea: ParkingArea) => void;
}

export const LayoutBuilder: React.FC<LayoutBuilderProps> = ({ parkingArea, onSave }) => {
  const { success, error, info } = useToast();

  const [area, setArea] = useState<ParkingArea>(parkingArea);
  const [activeLevelId, setActiveLevelId] = useState<string>(
    parkingArea.levels[0]?.id || ''
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);

  // Modals for deletion confirmation
  const [showDeleteLevelModal, setShowDeleteLevelModal] = useState<boolean>(false);
  const [showClearCanvasModal, setShowClearCanvasModal] = useState<boolean>(false);

  // Mouse Drag & Drop State
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    itemType: 'slot' | 'element';
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Element resize state
  const [resizeState, setResizeState] = useState<{
    id: string;
    handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Load existing slots for this facility
  const [slots, setSlots] = useState<Slot[]>(() =>
    dbService.getSlots(parkingArea.id)
  );

  useEffect(() => {
    const refreshSlots = () => setSlots(dbService.getSlots(parkingArea.id));
    refreshSlots();
    const unsubscribe = dbService.subscribe(refreshSlots);
    return unsubscribe;
  }, [parkingArea.id]);

  const activeLevel = area.levels.find((l) => l.id === activeLevelId) || area.levels[0];
  const levelSlots = slots.filter((s) => s.levelId === activeLevel?.id);
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);
  const selectedElement = activeLevel?.elements.find((e) => e.id === selectedElementId);

  // --- Mouse Drag-and-Drop Handler (Smooth Window Listeners + 10px Grid Snap) ---
  useEffect(() => {
    if (!dragState || !dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - dragState.startX) / zoom;
      const deltaY = (e.clientY - dragState.startY) / zoom;

      // 10px grid snap
      const newX = Math.max(0, Math.round((dragState.origX + deltaX) / 10) * 10);
      const newY = Math.max(0, Math.round((dragState.origY + deltaY) / 10) * 10);

      if (dragState.itemType === 'slot') {
        setSlots((prev) =>
          prev.map((s) =>
            s.id === dragState.id
              ? { ...s, coordinates: { ...s.coordinates, x: newX, y: newY } }
              : s
          )
        );
      } else if (dragState.itemType === 'element') {
        const draggingElem = activeLevel?.elements.find((el) => el.id === dragState.id);
        let finalX = newX;
        let finalY = newY;

        // Magnetic Snapping for Roads into continuous curves without hitting other elements
        if (draggingElem && draggingElem.type === 'road') {
          const isDraggingH = draggingElem.width >= draggingElem.height && (!draggingElem.curveCorner || draggingElem.curveCorner === 'none');
          const isDraggingV = draggingElem.height > draggingElem.width && (!draggingElem.curveCorner || draggingElem.curveCorner === 'none');
          const isDraggingCurve = !!draggingElem.curveCorner && draggingElem.curveCorner !== 'none';

          // Collision detection against slots and other obstacles
          const hitsObstacle = (box: { x: number; y: number; width: number; height: number }) => {
            const hitsSlot = levelSlots.some((slot) => {
              return !(
                box.x + box.width <= slot.coordinates.x + 2 ||
                box.x >= slot.coordinates.x + slot.coordinates.width - 2 ||
                box.y + box.height <= slot.coordinates.y + 2 ||
                box.y >= slot.coordinates.y + slot.coordinates.height - 2
              );
            });
            if (hitsSlot) return true;

            const hitsNonRoad = activeLevel?.elements.some((other) => {
              if (other.id === draggingElem.id || other.type === 'road') return false;
              return !(
                box.x + box.width <= other.x + 2 ||
                box.x >= other.x + other.width - 2 ||
                box.y + box.height <= other.y + 2 ||
                box.y >= other.y + other.height - 2
              );
            });
            return !!hitsNonRoad;
          };

          const SNAP_THRESHOLD = 36;
          let minSnapDist = SNAP_THRESHOLD;
          let candidateSnap: { x: number; y: number } | null = null;

          const testSnapPoint = (pt: { x: number; y: number }) => {
            const dist = Math.hypot(newX - pt.x, newY - pt.y);
            if (dist < minSnapDist && !hitsObstacle({ ...pt, width: draggingElem.width, height: draggingElem.height })) {
              minSnapDist = dist;
              candidateSnap = pt;
            }
          };

          activeLevel?.elements.forEach((other) => {
            if (other.id === draggingElem.id || other.type !== 'road') return;

            const isOtherH = other.width >= other.height && (!other.curveCorner || other.curveCorner === 'none');
            const isOtherV = other.height > other.width && (!other.curveCorner || other.curveCorner === 'none');
            const isOtherCurve = !!other.curveCorner && other.curveCorner !== 'none';

            // 1. Dragging Horizontal Road
            if (isDraggingH) {
              if (isOtherH) {
                // End-to-end collinear
                testSnapPoint({ x: other.x + other.width, y: other.y });
                testSnapPoint({ x: other.x - draggingElem.width, y: other.y });
              } else if (isOtherV) {
                // Corner / junction with vertical road
                testSnapPoint({ x: other.x - draggingElem.width, y: other.y });
                testSnapPoint({ x: other.x - draggingElem.width, y: other.y + other.height - draggingElem.height });
                testSnapPoint({ x: other.x + other.width, y: other.y });
                testSnapPoint({ x: other.x + other.width, y: other.y + other.height - draggingElem.height });
              } else if (isOtherCurve) {
                if (other.curveCorner === 'top_right') {
                  testSnapPoint({ x: other.x + other.width, y: other.y });
                } else if (other.curveCorner === 'top_left') {
                  testSnapPoint({ x: other.x - draggingElem.width, y: other.y });
                } else if (other.curveCorner === 'bottom_right') {
                  testSnapPoint({ x: other.x + other.width, y: other.y + other.height - draggingElem.height });
                } else if (other.curveCorner === 'bottom_left') {
                  testSnapPoint({ x: other.x - draggingElem.width, y: other.y + other.height - draggingElem.height });
                }
              }
            }

            // 2. Dragging Vertical Road
            if (isDraggingV) {
              if (isOtherV) {
                // End-to-end collinear
                testSnapPoint({ x: other.x, y: other.y + other.height });
                testSnapPoint({ x: other.x, y: other.y - draggingElem.height });
              } else if (isOtherH) {
                // Corner / junction with horizontal road
                testSnapPoint({ x: other.x, y: other.y - draggingElem.height });
                testSnapPoint({ x: other.x + other.width - draggingElem.width, y: other.y - draggingElem.height });
                testSnapPoint({ x: other.x, y: other.y + other.height });
                testSnapPoint({ x: other.x + other.width - draggingElem.width, y: other.y + other.height });
              } else if (isOtherCurve) {
                if (other.curveCorner === 'top_right') {
                  testSnapPoint({ x: other.x + other.width - draggingElem.width, y: other.y - draggingElem.height });
                } else if (other.curveCorner === 'top_left') {
                  testSnapPoint({ x: other.x, y: other.y - draggingElem.height });
                } else if (other.curveCorner === 'bottom_right') {
                  testSnapPoint({ x: other.x + other.width - draggingElem.width, y: other.y + other.height });
                } else if (other.curveCorner === 'bottom_left') {
                  testSnapPoint({ x: other.x, y: other.y + other.height });
                }
              }
            }

            // 3. Dragging Curve
            if (isDraggingCurve) {
              if (draggingElem.curveCorner === 'top_right') {
                if (isOtherV) {
                  testSnapPoint({ x: other.x - (draggingElem.width - other.width), y: other.y + other.height });
                }
                if (isOtherH) {
                  testSnapPoint({ x: other.x - draggingElem.width, y: other.y });
                }
              } else if (draggingElem.curveCorner === 'top_left') {
                if (isOtherV) {
                  testSnapPoint({ x: other.x, y: other.y + other.height });
                }
                if (isOtherH) {
                  testSnapPoint({ x: other.x + other.width, y: other.y });
                }
              } else if (draggingElem.curveCorner === 'bottom_right') {
                if (isOtherV) {
                  testSnapPoint({ x: other.x - (draggingElem.width - other.width), y: other.y - draggingElem.height });
                }
                if (isOtherH) {
                  testSnapPoint({ x: other.x - draggingElem.width, y: other.y - (draggingElem.height - other.height) });
                }
              } else if (draggingElem.curveCorner === 'bottom_left') {
                if (isOtherV) {
                  testSnapPoint({ x: other.x, y: other.y - draggingElem.height });
                }
                if (isOtherH) {
                  testSnapPoint({ x: other.x + other.width, y: other.y - (draggingElem.height - other.height) });
                }
              }
            }
          });

          if (candidateSnap) {
            finalX = (candidateSnap as { x: number; y: number }).x;
            finalY = (candidateSnap as { x: number; y: number }).y;
          }
        }

        setArea((prevArea) => {
          const updatedLevels = prevArea.levels.map((lvl) => {
            if (lvl.id === activeLevel?.id) {
              return {
                ...lvl,
                elements: lvl.elements.map((el) =>
                  el.id === dragState.id ? { ...el, x: finalX, y: finalY } : el
                )
              };
            }
            return lvl;
          });
          return { ...prevArea, levels: updatedLevels };
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, zoom, activeLevel?.id]);

  // --- Element Edge Resize via 8 handles ---
  useEffect(() => {
    if (!resizeState) return;
    const MIN_SIZE = 30;
    const snap = (v: number) => Math.round(v / 10) * 10;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizeState.startX) / zoom;
      const dy = (e.clientY - resizeState.startY) / zoom;
      const h = resizeState.handle;

      let newX = resizeState.origX;
      let newY = resizeState.origY;
      let newW = resizeState.origW;
      let newH = resizeState.origH;

      // Horizontal
      if (h === 'e' || h === 'ne' || h === 'se') {
        newW = Math.max(MIN_SIZE, snap(resizeState.origW + dx));
      }
      if (h === 'w' || h === 'nw' || h === 'sw') {
        const clamped = Math.max(MIN_SIZE, snap(resizeState.origW - dx));
        newX = snap(resizeState.origX + (resizeState.origW - clamped));
        newW = clamped;
      }
      // Vertical
      if (h === 's' || h === 'se' || h === 'sw') {
        newH = Math.max(MIN_SIZE, snap(resizeState.origH + dy));
      }
      if (h === 'n' || h === 'ne' || h === 'nw') {
        const clamped = Math.max(MIN_SIZE, snap(resizeState.origH - dy));
        newY = snap(resizeState.origY + (resizeState.origH - clamped));
        newH = clamped;
      }

      setArea((prevArea) => ({
        ...prevArea,
        levels: prevArea.levels.map((lvl) =>
          lvl.id !== activeLevel?.id ? lvl : {
            ...lvl,
            elements: lvl.elements.map((el) =>
              el.id !== resizeState.id ? el : { ...el, x: newX, y: newY, width: newW, height: newH }
            )
          }
        )
      }));
    };

    const handleMouseUp = () => setResizeState(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, zoom, activeLevel?.id]);

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    elem: LayoutElement,
    handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeState({
      id: elem.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: elem.x,
      origY: elem.y,
      origW: elem.width,
      origH: elem.height
    });
  };

  const handleSlotMouseDown = (e: React.MouseEvent, slot: Slot) => {
    if (isPreviewMode) return;
    e.stopPropagation();
    setSelectedSlotId(slot.id);
    setSelectedElementId(null);

    setDragState({
      isDragging: true,
      itemType: 'slot',
      id: slot.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: slot.coordinates.x,
      origY: slot.coordinates.y
    });
  };

  const handleElementMouseDown = (e: React.MouseEvent, elem: LayoutElement) => {
    if (isPreviewMode) return;
    e.stopPropagation();
    setSelectedElementId(elem.id);
    setSelectedSlotId(null);

    setDragState({
      isDragging: true,
      itemType: 'element',
      id: elem.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: elem.x,
      origY: elem.y
    });
  };

  // --- Palette HTML5 Drag & Drop onto Canvas ---
  const handlePaletteDragStart = (
    e: React.DragEvent,
    payload: { kind: 'slot' | 'element'; type: string; label?: string; width?: number; height?: number; curveCorner?: LayoutElement['curveCorner'] }
  ) => {
    e.dataTransfer.setData('application/parksmart-palette', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/parksmart-palette');
    if (!dataStr || !canvasRef.current || !activeLevel) return;

    try {
      const payload = JSON.parse(dataStr);
      const rect = canvasRef.current.getBoundingClientRect();
      const dropX = Math.max(0, Math.round(((e.clientX - rect.left) / zoom) / 10) * 10);
      const dropY = Math.max(0, Math.round(((e.clientY - rect.top) / zoom) / 10) * 10);

      if (payload.kind === 'slot') {
        handleAddSlot(payload.type as SlotType, dropX, dropY);
      } else if (payload.kind === 'element') {
        handleAddElement(
          payload.type as LayoutElement['type'],
          payload.label || 'Element',
          dropX,
          dropY,
          payload.width,
          payload.height,
          payload.curveCorner
        );
      }
    } catch (err) {
      console.error('Failed to parse drag drop payload', err);
    }
  };

  // --- Slot Management ---
  const handleAddSlot = (type: SlotType = 'standard', customX?: number, customY?: number) => {
    if (!activeLevel) return;

    const isTwoWheeler = type === 'two_wheeler' || type === 'two_wheeler_ev';
    const count = levelSlots.length + 1;
    const prefix = type === 'ev' ? 'EV' : type === 'two_wheeler_ev' ? '2W-EV' : type === 'two_wheeler' ? '2W' : type === 'accessible' ? 'ACC' : 'A';
    const number = `${prefix}-${count < 10 ? '0' + count : count}`;

    const newSlotId = `slot-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const newSlot: Slot = {
      id: newSlotId,
      number,
      levelId: activeLevel.id,
      zoneId: activeLevel.zones.find(z => isTwoWheeler ? z.id.includes('2w') : true)?.id || activeLevel.zones[0]?.id || 'zone-default',
      parkingAreaId: area.id,
      type,
      status: 'available',
      coordinates: {
        x: customX !== undefined ? customX : 60 + ((levelSlots.length % 6) * 100),
        y: customY !== undefined ? customY : 120 + (Math.floor(levelSlots.length / 6) * 140),
        width: isTwoWheeler ? 48 : 75,
        height: isTwoWheeler ? 90 : 120
      },
      directionalNotes: isTwoWheeler ? 'Park in designated 2-wheeler bay' : 'Follow lane signs',
      isBookable: true,
      evSpecs: type === 'ev' ? {
        connectorType: 'CCS2',
        powerKw: 60,
        chargingTariffPerHour: area.tariffs.evChargingRatePerHour || 80,
        includedInParking: false
      } : type === 'two_wheeler_ev' ? {
        connectorType: 'Type 2',
        powerKw: 3.3,
        chargingTariffPerHour: area.tariffs.twoWheelerEvRatePerHour || 40,
        includedInParking: false
      } : undefined
    };

    const updated = [...slots, newSlot];
    setSlots(updated);
    setSelectedSlotId(newSlot.id);
    setSelectedElementId(null);
    success('Slot Added', `Added ${newSlot.number} to canvas. Drag to position.`);
  };

  const handleUpdateSelectedSlot = (updates: Partial<Slot>) => {
    if (!selectedSlotId) return;

    // Validate duplicate number
    if (updates.number && updates.number !== selectedSlot?.number) {
      const duplicate = slots.find(
        (s) => s.parkingAreaId === area.id && s.number.toLowerCase() === updates.number?.toLowerCase() && s.id !== selectedSlotId
      );
      if (duplicate) {
        error('Duplicate Slot', `Slot number ${updates.number} already exists in this facility.`);
        return;
      }
    }

    setSlots((prev) =>
      prev.map((s) => (s.id === selectedSlotId ? { ...s, ...updates } : s))
    );
  };

  const handleDeleteSelectedSlot = () => {
    if (!selectedSlotId) return;
    setSlots((prev) => prev.filter((s) => s.id !== selectedSlotId));
    setSelectedSlotId(null);
    info('Slot Removed', 'Selected slot has been deleted.');
  };

  // --- Element Management (Gates, Ramps, Walkways, Roads) ---
  const handleAddElement = (
    type: LayoutElement['type'],
    label: string,
    customX?: number,
    customY?: number,
    customWidth?: number,
    customHeight?: number,
    curveCorner?: LayoutElement['curveCorner']
  ) => {
    if (!activeLevel) return;

    let defaultWidth = 100;
    let defaultHeight = 45;

    if (type === 'road') {
      if (curveCorner && curveCorner !== 'none') {
        defaultWidth = customWidth || 60;
        defaultHeight = customHeight || 60;
      } else {
        defaultWidth = customWidth || 320;
        defaultHeight = customHeight || 60;
      }
    } else if (type.includes('gate')) {
      defaultWidth = customWidth || 120;
      defaultHeight = customHeight || 45;
    } else if (type === 'ramp') {
      defaultWidth = customWidth || 140;
      defaultHeight = customHeight || 60;
    } else if (type === 'walkway') {
      defaultWidth = customWidth || 160;
      defaultHeight = customHeight || 35;
    }

    const newElem: LayoutElement = {
      id: `el-${Date.now()}`,
      type,
      label,
      x: customX !== undefined ? customX : 60,
      y: customY !== undefined ? customY : 60,
      width: defaultWidth,
      height: defaultHeight,
      direction: type === 'road' && defaultWidth >= defaultHeight ? 'right' : 'down',
      curveCorner: curveCorner || 'none'
    };

    const updatedLevels = area.levels.map((lvl) => {
      if (lvl.id === activeLevel.id) {
        return { ...lvl, elements: [...lvl.elements, newElem] };
      }
      return lvl;
    });

    setArea({ ...area, levels: updatedLevels });
    setSelectedElementId(newElem.id);
    setSelectedSlotId(null);
    success('Element Added', `Added ${label} to canvas. Drag to position.`);
  };

  const handleDeleteSelectedElement = () => {
    if (!selectedElementId || !activeLevel) return;
    const updatedLevels = area.levels.map((lvl) => {
      if (lvl.id === activeLevel.id) {
        return { ...lvl, elements: lvl.elements.filter((e) => e.id !== selectedElementId) };
      }
      return lvl;
    });
    setArea({ ...area, levels: updatedLevels });
    setSelectedElementId(null);
    info('Element Removed', 'Element has been deleted.');
  };

  // --- Level Operations (Add Level, Delete Level, Clear Canvas) ---
  const handleAddNewLevel = () => {
    const newLevelNum = area.levels.length + 1;
    const newLevelId = `lvl-${Date.now()}-${newLevelNum}`;
    const newLevel: ParkingLevel = {
      id: newLevelId,
      name: `Level ${newLevelNum}`,
      levelNumber: newLevelNum,
      width: 800,
      height: 520,
      zones: [
        { id: `zone-${newLevelNum}-a`, name: `Zone ${String.fromCharCode(64 + newLevelNum)}`, color: '#9333ea', slotCount: 0 }
      ],
      elements: []
    };

    const updatedArea: ParkingArea = {
      ...area,
      levels: [...area.levels, newLevel],
      updatedAt: new Date().toISOString()
    };

    dbService.saveParkingArea(updatedArea);
    setArea(updatedArea);
    setActiveLevelId(newLevelId);
    setSelectedSlotId(null);
    setSelectedElementId(null);
    success('New Floor Added', `Created "${newLevel.name}". You can now design its layout.`);
  };

  const handleConfirmDeleteLevel = () => {
    if (!activeLevel) return;
    const lvlName = activeLevel.name;
    const res = dbService.deleteLevel(area.id, activeLevel.id);
    if (res.success) {
      const refreshedArea = dbService.getParkingAreaById(area.id);
      if (refreshedArea) {
        setArea(refreshedArea);
        setActiveLevelId(refreshedArea.levels[0]?.id || '');
      }
      setSlots(dbService.getSlots(area.id));
      setSelectedSlotId(null);
      setSelectedElementId(null);
      success('Floor Layout Deleted', `Deleted "${lvlName}" and removed all its elements.`);
    } else {
      error('Delete Failed', res.error || 'Could not delete floor level.');
    }
    setShowDeleteLevelModal(false);
  };

  const handleConfirmClearCanvas = () => {
    if (!activeLevel) return;
    dbService.clearLevel(area.id, activeLevel.id);
    const refreshedArea = dbService.getParkingAreaById(area.id);
    if (refreshedArea) {
      setArea(refreshedArea);
    }
    setSlots(dbService.getSlots(area.id));
    setSelectedSlotId(null);
    setSelectedElementId(null);
    success('Canvas Cleared', `Cleared all elements and bays from "${activeLevel.name}".`);
    setShowClearCanvasModal(false);
  };

  // --- Save / Publish Actions ---
  const handleSave = (publishState?: boolean) => {
    const updatedArea: ParkingArea = {
      ...area,
      isPublished: publishState !== undefined ? publishState : area.isPublished,
      updatedAt: new Date().toISOString()
    };

    dbService.saveParkingArea(updatedArea);
    dbService.saveSlotsBatch(slots);

    dbService.addAuditLog({
      actorId: area.ownerAdminId,
      actorName: 'Facility Admin',
      actorRole: 'parking_admin',
      action: publishState ? 'FACILITY_PUBLISHED' : 'FACILITY_LAYOUT_SAVED',
      parkingAreaId: area.id,
      targetResource: area.name,
      details: `Saved layout with ${slots.length} slots across ${area.levels.length} floor(s). Publication: ${updatedArea.isPublished ? 'Published' : 'Draft'}`
    });

    setArea(updatedArea);
    if (onSave) onSave(updatedArea);

    success(
      publishState ? 'Published Live!' : 'Layout Saved',
      publishState ? 'Facility is now publicly visible on the landing page.' : 'Parking layout, road geometry, and slot coordinates saved to database.'
    );
  };

  return (
    <div className="builder-container">
      {/* Top Controls Toolbar */}
      <div className="builder-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Level Selector & Level Operations */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={18} style={{ color: 'var(--primary)' }} />
            <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>Level:</strong>
            <select
              value={activeLevelId}
              onChange={(e) => {
                setActiveLevelId(e.target.value);
                setSelectedSlotId(null);
                setSelectedElementId(null);
              }}
              className="form-select"
              style={{ padding: '6px 12px', width: 'auto', minWidth: '150px' }}
            >
              {area.levels.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name} ({slots.filter((s) => s.levelId === lvl.id).length} bays)
                </option>
              ))}
            </select>

            {!isPreviewMode && (
              <>
                <button
                  type="button"
                  onClick={handleAddNewLevel}
                  className="btn btn-secondary btn-sm"
                  title="Add new floor level"
                >
                  <Plus size={14} />
                  <span>+ Floor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteLevelModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#ef4444' }}
                  title="Delete this floor layout"
                >
                  <Trash2 size={14} />
                  <span>Delete Floor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClearCanvasModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#f59e0b' }}
                  title="Clear all elements & bays on this floor"
                >
                  <RotateCcw size={14} />
                  <span>Clear Canvas</span>
                </button>
              </>
            )}
          </div>

          <div style={{ height: '24px', width: '1px', background: 'var(--border-light)' }} />

          {/* Quick Add / Drag Palette */}
          {!isPreviewMode && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'slot', type: 'standard' })}
                onClick={() => handleAddSlot('standard')}
                className="btn btn-secondary btn-sm"
                title="Click or drag onto canvas"
              >
                <Plus size={13} />
                <span>+ Standard Bay</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'slot', type: 'ev' })}
                onClick={() => handleAddSlot('ev')}
                className="btn btn-secondary btn-sm"
                style={{ color: '#10b981' }}
                title="Click or drag onto canvas"
              >
                <Zap size={13} />
                <span>+ EV Charger</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'slot', type: 'accessible' })}
                onClick={() => handleAddSlot('accessible')}
                className="btn btn-secondary btn-sm"
                style={{ color: '#d946ef' }}
                title="Click or drag onto canvas"
              >
                <span>+ Accessible Bay</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'slot', type: 'two_wheeler' })}
                onClick={() => handleAddSlot('two_wheeler')}
                className="btn btn-secondary btn-sm"
                style={{ color: '#ea580c', fontWeight: 600 }}
                title="Click or drag onto canvas"
              >
                <Bike size={13} />
                <span>+ 2-Wheeler Bay</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'slot', type: 'two_wheeler_ev' })}
                onClick={() => handleAddSlot('two_wheeler_ev')}
                className="btn btn-secondary btn-sm"
                style={{ color: '#10b981', fontWeight: 600 }}
                title="Click or drag onto canvas"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Bike size={13} />
                  <Zap size={11} />
                </div>
                <span>+ 2W EV Bay</span>
              </button>

              {/* ROAD PALETTE BUTTONS */}
              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'road', label: 'Main Drive Lane', width: 320, height: 60 })}
                onClick={() => handleAddElement('road', 'Main Drive Lane', undefined, undefined, 320, 60)}
                className="btn btn-secondary btn-sm"
                style={{ color: '#f59e0b', fontWeight: 600 }}
                title="Add horizontal asphalt road lane (click or drag onto canvas)"
              >
                <span>🛣️ + Road (Horizontal)</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'road', label: 'Drive Lane', width: 60, height: 280 })}
                onClick={() => handleAddElement('road', 'Drive Lane', undefined, undefined, 60, 280)}
                className="btn btn-secondary btn-sm"
                style={{ color: '#f59e0b', fontWeight: 600 }}
                title="Add vertical asphalt road lane (click or drag onto canvas)"
              >
                <span>🛣️ + Road (Vertical)</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'road', label: 'Intersection', width: 90, height: 90 })}
                onClick={() => handleAddElement('road', 'Intersection', undefined, undefined, 90, 90)}
                className="btn btn-secondary btn-sm"
                style={{ color: '#f59e0b', fontSize: '0.78rem' }}
                title="Add square intersection road block"
              >
                <span>+ Junction</span>
              </button>

              {/* CURVED ROAD PALETTE BUTTONS */}
              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'road', label: 'Curved Road (TR)', width: 60, height: 60, curveCorner: 'top_right' })}
                onClick={() => handleAddElement('road', 'Curved Road (TR)', undefined, undefined, 60, 60, 'top_right')}
                className="btn btn-secondary btn-sm"
                style={{ color: '#f59e0b', fontSize: '0.78rem' }}
                title="Add curved road bending Top-to-Right (magnetic snaps to straight roads)"
              >
                <span>↪ Curve (TR)</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'road', label: 'Curved Road (TL)', width: 60, height: 60, curveCorner: 'top_left' })}
                onClick={() => handleAddElement('road', 'Curved Road (TL)', undefined, undefined, 60, 60, 'top_left')}
                className="btn btn-secondary btn-sm"
                style={{ color: '#f59e0b', fontSize: '0.78rem' }}
                title="Add curved road bending Top-to-Left (magnetic snaps to straight roads)"
              >
                <span>↩ Curve (TL)</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'road', label: 'Curved Road (BR)', width: 60, height: 60, curveCorner: 'bottom_right' })}
                onClick={() => handleAddElement('road', 'Curved Road (BR)', undefined, undefined, 60, 60, 'bottom_right')}
                className="btn btn-secondary btn-sm"
                style={{ color: '#f59e0b', fontSize: '0.78rem' }}
                title="Add curved road bending Bottom-to-Right (magnetic snaps to straight roads)"
              >
                <span>⤷ Curve (BR)</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'road', label: 'Curved Road (BL)', width: 60, height: 60, curveCorner: 'bottom_left' })}
                onClick={() => handleAddElement('road', 'Curved Road (BL)', undefined, undefined, 60, 60, 'bottom_left')}
                className="btn btn-secondary btn-sm"
                style={{ color: '#f59e0b', fontSize: '0.78rem' }}
                title="Add curved road bending Bottom-to-Left (magnetic snaps to straight roads)"
              >
                <span>⤶ Curve (BL)</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'entry_gate', label: 'Entry Gate', width: 120, height: 45 })}
                onClick={() => handleAddElement('entry_gate', 'Entry Gate')}
                className="btn btn-secondary btn-sm"
                title="Click or drag onto canvas"
              >
                <span>+ Entry Gate</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'exit_gate', label: 'Exit Gate', width: 120, height: 45 })}
                onClick={() => handleAddElement('exit_gate', 'Exit Gate')}
                className="btn btn-secondary btn-sm"
                title="Click or drag onto canvas"
              >
                <span>+ Exit Gate</span>
              </button>

              <button
                type="button"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, { kind: 'element', type: 'ramp', label: 'Ramp', width: 140, height: 60 })}
                onClick={() => handleAddElement('ramp', 'Ramp')}
                className="btn btn-secondary btn-sm"
                title="Click or drag onto canvas"
              >
                <span>+ Ramp</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Zoom controls */}
          <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="btn btn-sm" title="Zoom Out">
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', padding: '0 6px', fontWeight: 600 }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} className="btn btn-sm" title="Zoom In">
              <ZoomIn size={15} />
            </button>
          </div>

          {/* Preview toggle */}
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`btn btn-sm ${isPreviewMode ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Eye size={15} />
            <span>{isPreviewMode ? 'Exit Preview' : 'Interactive Preview'}</span>
          </button>

          {/* Save Draft */}
          <button onClick={() => handleSave()} className="btn btn-secondary btn-sm">
            <Save size={15} />
            <span>Save Draft</span>
          </button>

          {/* Publish Button */}
          <button
            onClick={() => handleSave(!area.isPublished)}
            className={`btn btn-sm ${area.isPublished ? 'btn-danger' : 'btn-success'}`}
          >
            <CheckCircle size={15} />
            <span>{area.isPublished ? 'Unpublish' : 'Publish Live'}</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Guidance Banner */}
      {!isPreviewMode && (
        <div style={{ background: 'rgba(232, 121, 249, 0.15)', border: '1px solid rgba(232, 121, 249, 0.25) ', borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#e879f9' }}>
          <Move size={15} />
          <span>
            <strong>Interactive Drag & Drop Active:</strong> Click and drag any bay, gate, ramp, or road element directly on the canvas to reposition it (automatically snaps to 10px grid). You can also drag tools from the toolbar directly into the canvas.
          </span>
        </div>
      )}

      {/* Main Canvas & Inspector Split View */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedSlot || selectedElement ? '1fr 340px' : '1fr', gap: '16px', alignItems: 'start' }}>
        {/* Interactive Visual Canvas Container */}
        <div
          className="builder-canvas-wrapper"
          ref={canvasRef}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSlotId(null);
              setSelectedElementId(null);
            }
          }}
          style={{ minHeight: '560px', overflow: 'auto', background: '#0b1120', position: 'relative' }}
        >
          <div
            className="builder-canvas"
            style={{
              width: `${(activeLevel?.width || 800) * zoom}px`,
              height: `${(activeLevel?.height || 520) * zoom}px`,
              transformOrigin: 'top left',
              position: 'relative',
              background: '#120f26'
            }}
          >
            {/* Floor Lane Grid Lines */}
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.18 }}
            >
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#64748b" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Layout Elements (Gates, Ramps, Walkways, Roads) */}
            {activeLevel?.elements.map((elem) => {
              const isSelected = selectedElementId === elem.id;
              const isCurrentlyDragging = dragState?.isDragging && dragState?.itemType === 'element' && dragState.id === elem.id;
              const isRoad = elem.type === 'road';
              const isGate = elem.type.includes('gate');
              const isRamp = elem.type === 'ramp';
              const isHorizontalRoad = isRoad && elem.width >= elem.height;
              const isVerticalRoad = isRoad && elem.height > elem.width;
              const isCurve = isRoad && !!elem.curveCorner && elem.curveCorner !== 'none';

              return (
                <div
                  key={elem.id}
                  onMouseDown={(e) => handleElementMouseDown(e, elem)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isPreviewMode) {
                      setSelectedElementId(elem.id);
                      setSelectedSlotId(null);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    left: `${elem.x * zoom}px`,
                    top: `${elem.y * zoom}px`,
                    width: `${elem.width * zoom}px`,
                    height: `${elem.height * zoom}px`,
                    background: isCurve
                      ? 'transparent'
                      : isRoad
                        ? '#1c1338'
                        : isGate
                          ? '#1e3a8a'
                          : isRamp
                            ? '#334155'
                            : '#0f766e',
                    border: isSelected
                      ? '2px solid #e879f9'
                      : isCurve
                        ? 'none'
                        : isRoad
                          ? '1px solid #475569'
                          : '1px solid #94a3b8',
                    color: '#f8fafc',
                    borderRadius: isCurve ? '0' : isRoad ? '4px' : '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: `${0.75 * zoom}rem`,
                    fontWeight: 700,
                    cursor: isPreviewMode ? 'default' : isCurrentlyDragging ? 'grabbing' : 'grab',
                    boxShadow: isCurrentlyDragging
                      ? '0 10px 25px rgba(232, 121, 249, 0.25) '
                      : isSelected
                        ? '0 0 0 2px rgba(232, 121, 249, 0.25) '
                        : isCurve
                          ? 'none'
                          : '0 4px 8px rgba(0,0,0,0.3)',
                    zIndex: isCurrentlyDragging ? 40 : isRoad ? 5 : 10,
                    userSelect: 'none',
                    overflow: 'hidden',
                    transition: isCurrentlyDragging ? 'none' : 'box-shadow 0.15s ease'
                  }}
                >
                  {/* Road Specific Asphalt Markings */}
                  {isRoad ? (
                    <>
                      {/* Curved Corner Road SVG Rendering */}
                      {isCurve && elem.curveCorner && elem.curveCorner !== 'none' ? (
                        renderCurvedRoadSvg(elem.curveCorner, elem.width, elem.height, zoom)
                      ) : (
                        <>
                          {/* Horizontal Road: Center Dashed Yellow Divider */}
                          {isHorizontalRoad && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: 0,
                                right: 0,
                                height: 0,
                                borderTop: `${Math.max(1.5, 2 * zoom)}px dashed #f59e0b`,
                                transform: 'translateY(-50%)',
                                pointerEvents: 'none'
                              }}
                            />
                          )}

                          {/* Vertical Road: Center Dashed Yellow Divider */}
                          {isVerticalRoad && (
                            <div
                              style={{
                                position: 'absolute',
                                left: '50%',
                                top: 0,
                                bottom: 0,
                                width: 0,
                                borderLeft: `${Math.max(1.5, 2 * zoom)}px dashed #f59e0b`,
                                transform: 'translateX(-50%)',
                                pointerEvents: 'none'
                              }}
                            />
                          )}
                        </>
                      )}

                      {/* Road Center Label Badge - Omitted on Curved Road Tiles */}
                      {!isCurve && (
                        <div
                          style={{
                            position: 'relative',
                            zIndex: 2,
                            background: 'rgba(15, 23, 42, 0.85)',
                            padding: isVerticalRoad ? '4px 3px' : '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            fontSize: `${0.68 * zoom}rem`,
                            letterSpacing: '0.04em',
                            color: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            writingMode: isVerticalRoad ? 'vertical-rl' : 'horizontal-tb'
                          }}
                        >
                          <span>{elem.label || 'ROAD'}</span>
                          {elem.direction === 'right' && <span>→</span>}
                          {elem.direction === 'left' && <span>←</span>}
                          {elem.direction === 'up' && <span>↑</span>}
                          {elem.direction === 'down' && <span>↓</span>}
                        </div>
                      )}
                    </>
                  ) : (
                    <span>{elem.label}</span>
                  )}

                  {/* ── 8 Resize Handles (only when selected & editing) ── */}
                  {isSelected && !isPreviewMode && (() => {
                    const HS = 10; // handle size px
                    const HALF = HS / 2;
                    const handles: Array<{
                      h: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
                      style: React.CSSProperties;
                      cursor: string;
                    }> = [
                        { h: 'n', cursor: 'ns-resize', style: { top: -HALF, left: '50%', transform: 'translateX(-50%)' } },
                        { h: 's', cursor: 'ns-resize', style: { bottom: -HALF, left: '50%', transform: 'translateX(-50%)' } },
                        { h: 'e', cursor: 'ew-resize', style: { right: -HALF, top: '50%', transform: 'translateY(-50%)' } },
                        { h: 'w', cursor: 'ew-resize', style: { left: -HALF, top: '50%', transform: 'translateY(-50%)' } },
                        { h: 'ne', cursor: 'ne-resize', style: { top: -HALF, right: -HALF } },
                        { h: 'nw', cursor: 'nw-resize', style: { top: -HALF, left: -HALF } },
                        { h: 'se', cursor: 'se-resize', style: { bottom: -HALF, right: -HALF } },
                        { h: 'sw', cursor: 'sw-resize', style: { bottom: -HALF, left: -HALF } },
                      ];
                    return handles.map(({ h, cursor, style }) => (
                      <div
                        key={h}
                        onMouseDown={(e) => handleResizeMouseDown(e, elem, h)}
                        style={{
                          position: 'absolute',
                          width: HS,
                          height: HS,
                          background: '#e879f9',
                          border: '2px solid #fff',
                          borderRadius: '2px',
                          cursor,
                          zIndex: 60,
                          ...style
                        }}
                      />
                    ));
                  })()}
                </div>
              );
            })}

            {/* Parking Slots */}
            {levelSlots.map((slot) => {
              const isSelected = selectedSlotId === slot.id;
              const isCurrentlyDragging = dragState?.isDragging && dragState?.itemType === 'slot' && dragState.id === slot.id;

              return (
                <div
                  key={slot.id}
                  onMouseDown={(e) => handleSlotMouseDown(e, slot)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSlotId(slot.id);
                    setSelectedElementId(null);
                  }}
                  className={`slot-node slot-node-${slot.status} ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: `${slot.coordinates.x * zoom}px`,
                    top: `${slot.coordinates.y * zoom}px`,
                    width: `${slot.coordinates.width * zoom}px`,
                    height: `${slot.coordinates.height * zoom}px`,
                    cursor: isPreviewMode ? 'default' : isCurrentlyDragging ? 'grabbing' : 'grab',
                    zIndex: isCurrentlyDragging ? 50 : isSelected ? 20 : 15,
                    userSelect: 'none',
                    boxShadow: isCurrentlyDragging
                      ? '0 12px 28px rgba(232, 121, 249, 0.25) '
                      : undefined
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {(slot.type === 'two_wheeler' || slot.type === 'two_wheeler_ev') && (
                      <Bike size={13} style={{ color: (slot.type === 'two_wheeler_ev' ? '#10b981' : '#f97316') }} />
                    )}
                    {(slot.type === 'ev' || slot.type === 'two_wheeler_ev') && <Zap size={14} style={{ color: '#10b981' }} />}
                    <span>{slot.number}</span>
                  </div>

                  <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', opacity: 0.85, marginTop: '2px' }}>
                    {slot.status}
                  </div>

                  {slot.status === 'occupied' && (
                    (slot.type === 'two_wheeler' || slot.type === 'two_wheeler_ev') ? (
                      <Bike size={20} style={{ color: '#ef4444', marginTop: '4px' }} />
                    ) : (
                      <Car size={24} style={{ color: '#ef4444', marginTop: '6px' }} />
                    )
                  )}

                  {slot.status === 'reserved' && (
                    (slot.type === 'two_wheeler' || slot.type === 'two_wheeler_ev') ? (
                      <Bike size={18} style={{ color: '#fbbf24', marginTop: '4px', opacity: 0.7 }} />
                    ) : (
                      <Car size={20} style={{ color: '#fbbf24', marginTop: '6px', opacity: 0.7 }} />
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Inspector Sidebar */}
        {selectedSlot && (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Edit Bay: {selectedSlot.number}
              </h3>
              <button
                type="button"
                onClick={handleDeleteSelectedSlot}
                className="btn btn-secondary btn-sm"
                style={{ color: '#ef4444' }}
                title="Delete Slot"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Slot Number / Identifier</label>
              <input
                type="text"
                value={selectedSlot.number}
                onChange={(e) => handleUpdateSelectedSlot({ number: e.target.value.toUpperCase() })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Slot Type</label>
              <select
                value={selectedSlot.type}
                onChange={(e) => handleUpdateSelectedSlot({ type: e.target.value as SlotType })}
                className="form-select"
              >
                <option value="standard">Standard Car</option>
                <option value="ev">EV Charging Bay (Car)</option>
                <option value="two_wheeler">2-Wheeler (Bike / Scooter)</option>
                <option value="two_wheeler_ev">2-Wheeler EV Charger</option>
                <option value="accessible">Accessible / Disabled</option>
                <option value="staff_only">Staff / Official Only</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Operational Status</label>
              <select
                value={selectedSlot.status}
                onChange={(e) => handleUpdateSelectedSlot({ status: e.target.value as SlotStatus })}
                className="form-select"
              >
                <option value="available">Available (Bookable)</option>
                <option value="reserved">Reserved</option>
                <option value="occupied">Occupied</option>
                <option value="under_maintenance">Under Maintenance</option>
                <option value="not_allocated">Not Allocated</option>
              </select>
            </div>

            {(selectedSlot.type === 'ev' || selectedSlot.type === 'two_wheeler_ev') && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <strong style={{ fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                  <Zap size={15} /> {selectedSlot.type === 'two_wheeler_ev' ? '2-Wheeler EV Charger Specifications' : 'EV Charger Specifications'}
                </strong>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Connector Standard</label>
                  <select
                    value={selectedSlot.evSpecs?.connectorType || 'CCS2'}
                    onChange={(e) =>
                      handleUpdateSelectedSlot({
                        evSpecs: {
                          connectorType: e.target.value as any,
                          powerKw: selectedSlot.evSpecs?.powerKw || 60,
                          chargingTariffPerHour: selectedSlot.evSpecs?.chargingTariffPerHour || 80,
                          includedInParking: false
                        }
                      })
                    }
                    className="form-select"
                  >
                    <option value="CCS2">CCS2 (DC Fast Charge)</option>
                    <option value="Type 2">Type 2 (AC Fast Charge)</option>
                    <option value="CHAdeMO">CHAdeMO</option>
                    <option value="GB/T">GB/T</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Power (kW)</label>
                    <input
                      type="number"
                      value={selectedSlot.evSpecs?.powerKw || 60}
                      onChange={(e) =>
                        handleUpdateSelectedSlot({
                          evSpecs: {
                            ...(selectedSlot.evSpecs || { connectorType: 'CCS2', chargingTariffPerHour: 80, includedInParking: false }),
                            powerKw: Number(e.target.value)
                          }
                        })
                      }
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Rate (₹/hr)</label>
                    <input
                      type="number"
                      value={selectedSlot.evSpecs?.chargingTariffPerHour || 80}
                      onChange={(e) =>
                        handleUpdateSelectedSlot({
                          evSpecs: {
                            ...(selectedSlot.evSpecs || { connectorType: 'CCS2', powerKw: 60, includedInParking: false }),
                            chargingTariffPerHour: Number(e.target.value)
                          }
                        })
                      }
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Directional Guidance Notes</label>
              <textarea
                value={selectedSlot.directionalNotes || ''}
                onChange={(e) => handleUpdateSelectedSlot({ directionalNotes: e.target.value })}
                className="form-textarea"
                rows={2}
                placeholder="e.g. Next to Pillar 4B, turn left after Entry Gate"
              />
            </div>

            {/* Position coordinate sliders */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Position Coordinates (px):</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>X Position:</label>
                  <input
                    type="number"
                    value={selectedSlot.coordinates.x}
                    onChange={(e) =>
                      handleUpdateSelectedSlot({
                        coordinates: { ...selectedSlot.coordinates, x: Number(e.target.value) }
                      })
                    }
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Y Position:</label>
                  <input
                    type="number"
                    value={selectedSlot.coordinates.y}
                    onChange={(e) =>
                      handleUpdateSelectedSlot({
                        coordinates: { ...selectedSlot.coordinates, y: Number(e.target.value) }
                      })
                    }
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Element / Road Inspector */}
        {selectedElement && !selectedSlot && (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {selectedElement.type === 'road' ? '🛣️ Road Lane' : 'Element'}: {selectedElement.label}
              </h3>
              <button
                type="button"
                onClick={handleDeleteSelectedElement}
                className="btn btn-secondary btn-sm"
                style={{ color: '#ef4444' }}
                title="Delete element"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Element Label / Lane Name</label>
              <input
                type="text"
                value={selectedElement.label}
                onChange={(e) => {
                  const updatedLevels = area.levels.map((lvl) => {
                    if (lvl.id === activeLevel.id) {
                      return {
                        ...lvl,
                        elements: lvl.elements.map((el) =>
                          el.id === selectedElement.id ? { ...el, label: e.target.value } : el
                        )
                      };
                    }
                    return lvl;
                  });
                  setArea({ ...area, levels: updatedLevels });
                }}
                className="form-input"
                placeholder="e.g. Main Drive Lane, Gate A Approach"
              />
            </div>

            {/* Road / Element Dimensions (Width & Height) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Width (px):</label>
                <input
                  type="number"
                  value={selectedElement.width}
                  onChange={(e) => {
                    const newW = Math.max(20, Number(e.target.value));
                    const updatedLevels = area.levels.map((lvl) => {
                      if (lvl.id === activeLevel.id) {
                        return {
                          ...lvl,
                          elements: lvl.elements.map((el) =>
                            el.id === selectedElement.id ? { ...el, width: newW } : el
                          )
                        };
                      }
                      return lvl;
                    });
                    setArea({ ...area, levels: updatedLevels });
                  }}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Height (px):</label>
                <input
                  type="number"
                  value={selectedElement.height}
                  onChange={(e) => {
                    const newH = Math.max(20, Number(e.target.value));
                    const updatedLevels = area.levels.map((lvl) => {
                      if (lvl.id === activeLevel.id) {
                        return {
                          ...lvl,
                          elements: lvl.elements.map((el) =>
                            el.id === selectedElement.id ? { ...el, height: newH } : el
                          )
                        };
                      }
                      return lvl;
                    });
                    setArea({ ...area, levels: updatedLevels });
                  }}
                  className="form-input"
                />
              </div>
            </div>

            {/* Road Curve Corner Configurator */}
            {selectedElement.type === 'road' && (
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Road Type & Curved Corner</label>
                <select
                  value={selectedElement.curveCorner || 'none'}
                  onChange={(e) => {
                    const corner = e.target.value as LayoutElement['curveCorner'];
                    const isCurve = corner && corner !== 'none';
                    const updatedLevels = area.levels.map((lvl) => {
                      if (lvl.id === activeLevel.id) {
                        return {
                          ...lvl,
                          elements: lvl.elements.map((el) =>
                            el.id === selectedElement.id
                              ? {
                                ...el,
                                curveCorner: corner,
                                width: isCurve ? 60 : el.width,
                                height: isCurve ? 60 : el.height,
                                label: isCurve ? `Curved Turn (${corner.replace('_', ' ')})` : (el.width >= el.height ? 'Main Drive Lane' : 'Drive Lane')
                              }
                              : el
                          )
                        };
                      }
                      return lvl;
                    });
                    setArea({ ...area, levels: updatedLevels });
                  }}
                  className="form-select"
                >
                  <option value="none">Straight Asphalt Road</option>
                  <option value="top_right">↪ Curved Road (Top-Right Bend)</option>
                  <option value="top_left">↩ Curved Road (Top-Left Bend)</option>
                  <option value="bottom_right">⤷ Curved Road (Bottom-Right Bend)</option>
                  <option value="bottom_left">⤶ Curved Road (Bottom-Left Bend)</option>
                </select>
              </div>
            )}

            {/* Quick Rotate / Orientation Toggle for Roads */}
            {selectedElement.type === 'road' && (!selectedElement.curveCorner || selectedElement.curveCorner === 'none') && (
              <div style={{ marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const updatedLevels = area.levels.map((lvl) => {
                      if (lvl.id === activeLevel.id) {
                        return {
                          ...lvl,
                          elements: lvl.elements.map((el) =>
                            el.id === selectedElement.id
                              ? {
                                ...el,
                                width: el.height,
                                height: el.width,
                                direction: (el.width >= el.height ? 'down' : 'right') as 'down' | 'right'
                              }
                              : el
                          )
                        };
                      }
                      return lvl;
                    });
                    setArea({ ...area, levels: updatedLevels });
                    info('Rotated', 'Swapped road width and height.');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Maximize2 size={14} />
                  <span>Rotate Road 90° (H ↔ V)</span>
                </button>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Traffic Direction</label>
              <select
                value={selectedElement.direction || 'right'}
                onChange={(e) => {
                  const updatedLevels = area.levels.map((lvl) => {
                    if (lvl.id === activeLevel.id) {
                      return {
                        ...lvl,
                        elements: lvl.elements.map((el) =>
                          el.id === selectedElement.id ? { ...el, direction: e.target.value as any } : el
                        )
                      };
                    }
                    return lvl;
                  });
                  setArea({ ...area, levels: updatedLevels });
                }}
                className="form-select"
              >
                <option value="right">Right (→)</option>
                <option value="left">Left (←)</option>
                <option value="down">Down (↓)</option>
                <option value="up">Up (↑)</option>
              </select>
            </div>

            {/* Position coordinate sliders */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Coordinates (px):</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>X Position:</label>
                  <input
                    type="number"
                    value={selectedElement.x}
                    onChange={(e) => {
                      const newX = Number(e.target.value);
                      const updatedLevels = area.levels.map((lvl) => {
                        if (lvl.id === activeLevel.id) {
                          return {
                            ...lvl,
                            elements: lvl.elements.map((el) =>
                              el.id === selectedElement.id ? { ...el, x: newX } : el
                            )
                          };
                        }
                        return lvl;
                      });
                      setArea({ ...area, levels: updatedLevels });
                    }}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Y Position:</label>
                  <input
                    type="number"
                    value={selectedElement.y}
                    onChange={(e) => {
                      const newY = Number(e.target.value);
                      const updatedLevels = area.levels.map((lvl) => {
                        if (lvl.id === activeLevel.id) {
                          return {
                            ...lvl,
                            elements: lvl.elements.map((el) =>
                              el.id === selectedElement.id ? { ...el, y: newY } : el
                            )
                          };
                        }
                        return lvl;
                      });
                      setArea({ ...area, levels: updatedLevels });
                    }}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visual Legend Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: 'var(--card-bg)', padding: '12px 18px', borderRadius: '10px', border: '1px solid var(--border-light)', fontSize: '0.82rem', alignItems: 'center' }}>
        <strong style={{ color: 'var(--text-main)' }}>Canvas Legend:</strong>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} />
          Available
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b' }} />
          Reserved
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }} />
          Occupied
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={14} style={{ color: '#10b981' }} />
          EV Fast Bay
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '22px', height: '8px', background: '#1c1338', borderTop: '2px dashed #f59e0b', borderRadius: '1px' }} />
          Asphalt Road Lane
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#1e3a8a' }} />
          Gate
        </span>
      </div>

      {/* Delete Floor Level Confirmation Modal */}
      {showDeleteLevelModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteLevelModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px', padding: '28px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Delete Floor Layout
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Floor Level: {activeLevel?.name}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '20px' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-main)' }}>{activeLevel?.name}</strong>?
              This will permanently delete all {levelSlots.length} parking bay(s) and {activeLevel?.elements.length || 0} layout element(s) on this floor.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDeleteLevelModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLevel}
                className="btn btn-danger"
              >
                <Trash2 size={15} />
                <span>Delete Floor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Canvas Confirmation Modal */}
      {showClearCanvasModal && (
        <div className="modal-overlay" onClick={() => setShowClearCanvasModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px', padding: '28px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <RotateCcw size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Clear Floor Canvas
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Reset elements on {activeLevel?.name}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '20px' }}>
              Are you sure you want to clear all slots and layout elements on <strong style={{ color: 'var(--text-main)' }}>{activeLevel?.name}</strong>?
              The floor level itself will be kept, but all its bays and roads will be removed so you can start clean.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowClearCanvasModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearCanvas}
                className="btn btn-danger"
                style={{ background: '#d97706', borderColor: '#b45309' }}
              >
                <RotateCcw size={15} />
                <span>Clear Canvas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
