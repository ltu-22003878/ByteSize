export const wardrobe = {
  outfit: [
    { id: 'tee', name: 'Classic T-shirt', xp: 0, color: '#7c3aed' },
    { id: 'shirt', name: 'Campus shirt', xp: 150, color: '#3b82f6' },
    { id: 'crop', name: 'Crop top', xp: 350, color: '#f472b6' },
    { id: 'hoodie', name: 'Pixel hoodie', xp: 650, color: '#10b981' },
    { id: 'jacket', name: 'Legend jacket', xp: 1200, color: '#f59e0b' },
    { id: 'cosmic', name: 'Cosmic fit', xp: 2000, color: '#8b5cf6' },
  ],
  accessory: [
    { id: 'none', name: 'No accessory', xp: 0 },
    { id: 'glasses', name: 'Everyday glasses', xp: 200 },
    { id: 'cap', name: 'Campus cap', xp: 400 },
    { id: 'rareGlasses', name: 'Rare pixel glasses', xp: 900 },
    { id: 'crown', name: 'Golden crown', xp: 1800 },
  ],
};
export const isUnlocked = (item, xp) => xp >= item.xp;
export const normalizeAvatar = (avatar, xp) => {
  const outfit = wardrobe.outfit.find(i => i.id === avatar.outfitId && isUnlocked(i, xp)) || wardrobe.outfit[0];
  const accessory = wardrobe.accessory.find(i => i.id === avatar.accessory && isUnlocked(i, xp)) || wardrobe.accessory[0];
  return { ...avatar, outfitId: outfit.id, outfit: outfit.color, accessory: accessory.id };
};
