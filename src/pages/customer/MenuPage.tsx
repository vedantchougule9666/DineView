import React from 'react';
import HomePage from './HomePage';

/**
 * MenuPage displays the live restaurant menu.
 * All categories and dishes are sourced strictly from MenuContext (never static imports),
 * ensuring live updates from admin edits reflect instantly without a page reload.
 */
export const MenuPage: React.FC = () => {
  return <HomePage />;
};

export default MenuPage;
