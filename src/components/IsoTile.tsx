import { useState, useEffect } from 'react';
import type { Tile } from '../types';

interface IsoTileProps {
  tile: Tile;
  onClick: () => void;
  isHome: boolean;
  pendingItem: { name: string; icon: string } | null;
  left: number;
  top: number;
  w: number;
  h: number;
  placeable: boolean;
  isNewlyPlaced: boolean;
}

export function IsoTile({
  tile,
  onClick,
  isHome,
  pendingItem,
  left,
  top,
  w,
  h,
  placeable,
  isNewlyPlaced,
}: IsoTileProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (isNewlyPlaced || tile.entity) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 300);
      return () => clearTimeout(t);
    }
  }, [isNewlyPlaced, tile.entity]);

  const showGhost = hovered && placeable && !tile.entity && !!pendingItem;

  const baseFill = isHome ? "#FFF7ED" : "rgba(255,255,255,0.8)";
  const hoverFill = placeable ? "#E0F2FE" : "#FFE4E6";
  const downFill = placeable ? "#BAE6FD" : "#FECDD3";
  const stroke = hovered ? (placeable ? "#38BDF8" : "#FB7185") : "rgba(0,0,0,0.15)";
  const fill = pressed ? downFill : hovered ? hoverFill : baseFill;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      title={isHome ? "Dom" : tile.entity ? tile.entity.label : pendingItem ? `Postaw: ${pendingItem.name}` : "Pusty kafelek"}
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        WebkitClipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
        clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
        border: "none",
        padding: 0,
        background: "transparent",
        cursor: placeable ? "pointer" : "not-allowed",
      }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
          pointerEvents: "none",
        }}
      >
        <polygon
          points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          pointerEvents: "none",
          willChange: "transform",
        }}
      >
        {isHome ? (
          <span
            style={{
              fontSize: 18,
              display: "inline-block",
              transform: `scale(${pop ? 1.1 : 1})`,
              transition: "transform 300ms ease-out",
            }}
          >
            🏠
          </span>
        ) : tile.entity ? (
          <span
            style={{
              fontSize: 18,
              display: "inline-block",
              transform: `scale(${pop ? 1.1 : 1})`,
              transition: "transform 300ms ease-out",
            }}
          >
            {tile.entity.icon}
          </span>
        ) : showGhost ? (
          <span
            style={{
              fontSize: 20,
              opacity: 0.4,
              display: "inline-block",
              transform: `scale(${hovered ? 1.05 : 1})`,
              transition: "transform 200ms ease-out",
              animation: "pulse 1.2s ease-in-out infinite",
            }}
          >
            {pendingItem!.icon}
          </span>
        ) : null}
      </div>
      <style>{`@keyframes pulse{0%{opacity:.35}50%{opacity:.55}100%{opacity:.35}}`}</style>
    </button>
  );
}
