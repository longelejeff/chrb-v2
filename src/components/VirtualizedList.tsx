import { FixedSizeList } from 'react-window';
import { CSSProperties, memo } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemSize: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface RowProps {
  index: number;
  style: CSSProperties;
}

function VirtualizedListInner<T>({
  items,
  height,
  itemSize,
  renderItem,
  className = '',
}: VirtualizedListProps<T>) {
  const Row = ({ index, style }: RowProps) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  );

  return (
    <FixedSizeList
      height={height}
      itemCount={items.length}
      itemSize={itemSize}
      width="100%"
      className={className}
    >
      {Row}
    </FixedSizeList>
  );
}

export const VirtualizedList = memo(VirtualizedListInner) as typeof VirtualizedListInner;