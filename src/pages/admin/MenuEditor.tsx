import React from 'react';
import MenuManager from './MenuManager';

/**
 * MenuEditor component for managing menu categories, items, pricing, and availability.
 * Automatically invalidates cache and triggers MenuContext live refresh upon save.
 */
export const MenuEditor: React.FC = () => {
  return <MenuManager />;
};

export default MenuEditor;
