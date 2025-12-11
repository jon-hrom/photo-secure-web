export const isAdminUser = (userEmail?: string | null, vkUser?: any): boolean => {
  // Check email admin
  if (userEmail === 'jonhrom2012@gmail.com') {
    return true;
  }
  
  // Check VK admin by VK ID (more reliable than name)
  // VK API returns user_id as number, so convert to string for comparison
  if (vkUser && (vkUser.vk_id === '74713477' || String(vkUser.vk_id) === '74713477')) {
    return true;
  }
  
  // Fallback: Check VK admin by name
  if (vkUser && vkUser.name) {
    const name = vkUser.name;
    if (
      name.includes('Пономарев Евгений') || 
      name.includes('Евгений Пономарёв') ||
      name.includes('Евгений')
    ) {
      return true;
    }
  }
  
  return false;
};