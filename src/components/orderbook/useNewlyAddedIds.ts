import { useEffect, useRef, useState } from 'react';
import type { Order, Position } from '../../types';

/** Ids of orders/positions that just appeared, cleared after a short highlight window. */
export function useNewlyAddedIds(orders: Order[], positions: Position[]): Set<string> {
  // Track newly executed orders and positions for visual feedback
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const prevOrderIdsRef = useRef<Set<string>>(new Set(orders.map((o) => o.id)));
  const prevPositionIdsRef = useRef<Set<string>>(new Set(positions.map((p) => p.id)));

  useEffect(() => {
    const currentOrderIds = new Set(orders.map((o) => o.id));
    const newOrders = orders.filter((o) => !prevOrderIdsRef.current.has(o.id));

    const currentPositionIds = new Set(positions.map((p) => p.id));
    const newPositions = positions.filter((p) => !prevPositionIdsRef.current.has(p.id));

    if (newOrders.length > 0 || newPositions.length > 0) {
      const freshIds = new Set<string>();
      newOrders.forEach((o) => freshIds.add(o.id));
      newPositions.forEach((p) => freshIds.add(p.id));

      setNewlyAddedIds((prev) => new Set([...prev, ...freshIds]));

      const timer = setTimeout(() => {
        setNewlyAddedIds((prev) => {
          const next = new Set(prev);
          freshIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 4000);

      prevOrderIdsRef.current = currentOrderIds;
      prevPositionIdsRef.current = currentPositionIds;

      return () => clearTimeout(timer);
    } else {
      prevOrderIdsRef.current = currentOrderIds;
      prevPositionIdsRef.current = currentPositionIds;
    }
  }, [orders, positions]);
  return newlyAddedIds;
}
