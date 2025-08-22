import { IsoTile } from './IsoTile';
import type { Tile } from '../types';

interface IsoGridProps {
  tiles: Tile[];
  homeTileId: string;
  onTileClick: (tile: Tile) => void;
  pendingItem: { name: string; icon: string } | null;
  lastPlacedKey: string | null;
  isPlaceable?: (tile: Tile) => boolean;
}

export function IsoGrid({
  tiles,
  homeTileId,
  onTileClick,
  pendingItem,
  lastPlacedKey,
  isPlaceable,
}: IsoGridProps) {
  const GRID_SIZE = 7;
  const tileW = 60;
  const tileH = 30;
  const gridW = GRID_SIZE * tileW;
  const gridH = GRID_SIZE * tileH;

  return (
    <div
      style={{
        position: "relative",
        width: gridW,
        height: gridH,
        margin: "0 auto",
        overflow: "visible",
      }}
    >
      {tiles.map((t) => {
        const placeable = isPlaceable ? isPlaceable(t) : false;
        const left = (t.x - t.y) * (tileW / 2) + gridW / 2 - tileW / 2;
        const top = (t.x + t.y) * (tileH / 2);

        return (
          <IsoTile
            key={t.id}
            tile={t}
            left={left}
            top={top}
            w={tileW}
            h={tileH}
            onClick={() => onTileClick(t)}
            isHome={t.id === homeTileId}
            pendingItem={pendingItem}
            placeable={placeable}
            isNewlyPlaced={lastPlacedKey === t.id}
          />
        );
      })}
    </div>
  );
}
