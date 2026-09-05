// Multi-warehouse inventory allocation & automatic split engine

export function allocateInventorySplits(items = [], warehouses = [], inventory = []) {
  const allocations = [];
  let isSplitOccurred = false;

  // Clone inventory stock counters for simulation
  const stockMap = new Map();
  for (const inv of inventory) {
    const key = `${inv.warehouse_id}:${inv.product_id}`;
    stockMap.set(key, inv.available_stock);
  }

  for (const item of items) {
    const cat = (item.category || '').toUpperCase();
    if (item.is_subscription || cat === 'SERVICE' || cat === 'SUBSCRIPTION' || cat === 'SOFTWARE') {
      allocations.push({
        id: `alloc-dig-${Math.random().toString(36).substr(2, 8)}`,
        product_id: item.product_id || item.id,
        product_name: item.product_name || item.name,
        warehouse_id: 'cloud-provisioning',
        warehouse_name: 'Global Cloud Provisioning Center',
        allocated_quantity: item.quantity,
        tracking_number: `PROV-${Math.floor(100000 + Math.random() * 900000)}`,
        transit_days: 0,
        status: 'AUTO_PROVISIONED',
        fulfillment_type: 'DIGITAL'
      });
      continue;
    }

    let remainingNeeded = Number(item.quantity) || 1;
    let itemSplitCount = 0;

    for (const wh of warehouses) {
      if (remainingNeeded <= 0) break;

      const key = `${wh.id}:${item.product_id || item.id}`;
      const available = stockMap.get(key) || 0;

      if (available > 0) {
        const allocatedQty = Math.min(available, remainingNeeded);
        stockMap.set(key, available - allocatedQty);
        remainingNeeded -= allocatedQty;
        itemSplitCount++;

        allocations.push({
          id: `alloc-${Math.random().toString(36).substr(2, 8)}`,
          product_id: item.product_id || item.id,
          product_name: item.product_name || item.name,
          warehouse_id: wh.id,
          warehouse_name: wh.name,
          location: wh.location,
          allocated_quantity: allocatedQty,
          tracking_number: `TRK-${wh.code}-${Math.floor(100000 + Math.random() * 900000)}`,
          transit_days: wh.transit_days || 2,
          status: 'SPLIT_ALLOCATED',
          fulfillment_type: 'PHYSICAL'
        });
      }
    }

    if (itemSplitCount > 1) {
      isSplitOccurred = true;
    }

    // If remaining needed still > 0, backorder allocation
    if (remainingNeeded > 0) {
      allocations.push({
        id: `alloc-backorder-${Math.random().toString(36).substr(2, 8)}`,
        product_id: item.product_id || item.id,
        product_name: item.product_name || item.name,
        warehouse_id: 'factory-direct',
        warehouse_name: 'Factory Direct Backorder Hub',
        location: 'Direct OEM Dispatch',
        allocated_quantity: remainingNeeded,
        tracking_number: `OEM-${Math.floor(100000 + Math.random() * 900000)}`,
        transit_days: 7,
        status: 'BACKORDER_PLANNED',
        fulfillment_type: 'BACKORDER'
      });
      isSplitOccurred = true;
    }
  }

  return {
    allocations,
    is_split_occurred: isSplitOccurred,
    warehouse_count: new Set(allocations.filter(a => a.fulfillment_type === 'PHYSICAL').map(a => a.warehouse_id)).size
  };
}
