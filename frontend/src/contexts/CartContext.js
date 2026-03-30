import { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [canteenId, setCanteenId] = useState(null);
  const [canteenName, setCanteenName] = useState(null);

  const addItem = useCallback((item, cId, cName) => {
    if (canteenId && canteenId !== cId) {
      setItems([{ ...item, qty: 1 }]);
      setCanteenId(cId);
      setCanteenName(cName);
      return;
    }
    if (!canteenId) {
      setCanteenId(cId);
      setCanteenName(cName);
    }
    setItems(prev => {
      const existing = prev.find(i => i.item_id === item.item_id);
      if (existing) {
        return prev.map(i => i.item_id === item.item_id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }, [canteenId]);

  const removeItem = useCallback((itemId) => {
    setItems(prev => {
      const existing = prev.find(i => i.item_id === itemId);
      if (existing && existing.qty > 1) {
        return prev.map(i => i.item_id === itemId ? { ...i, qty: i.qty - 1 } : i);
      }
      const filtered = prev.filter(i => i.item_id !== itemId);
      if (filtered.length === 0) {
        setCanteenId(null);
        setCanteenName(null);
      }
      return filtered;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCanteenId(null);
    setCanteenName(null);
  }, []);

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <CartContext.Provider value={{ items, canteenId, canteenName, addItem, removeItem, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
