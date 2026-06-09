export default function MiniShape({ cells, color }) {
  const maxRow = Math.max(...cells.map(([row]) => row));
  const maxCol = Math.max(...cells.map(([, col]) => col));
  const filled = new Set(cells.map(([row, col]) => `${row},${col}`));

  const rows = [];
  for (let row = 0; row <= maxRow; row++) {
    const cols = [];
    for (let col = 0; col <= maxCol; col++) {
      const isFilled = filled.has(`${row},${col}`);
      cols.push(
        <span
          key={col}
          className="mini-cell"
          style={{ backgroundColor: isFilled ? color : 'transparent' }}
        />
      );
    }
    rows.push(
      <div className="mini-row" key={row}>
        {cols}
      </div>
    );
  }
  return <div className="mini-shape">{rows}</div>;
}
