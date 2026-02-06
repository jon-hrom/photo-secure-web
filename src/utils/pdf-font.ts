// Utility to add Russian language support to jsPDF using Roboto font from pdfMake
import { jsPDF } from 'jspdf';

let fontsCache: any = null;

// Add Roboto font to jsPDF
export const addRobotoFont = async (doc: jsPDF) => {
  // Lazy load pdfMake fonts only when needed
  if (!fontsCache) {
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    fontsCache = pdfFontsModule.default || pdfFontsModule;
    
    if (!fontsCache) {
      throw new Error('Failed to load pdfMake fonts');
    }
  }

  const robotoRegular = fontsCache['Roboto-Regular.ttf'];
  const robotoMedium = fontsCache['Roboto-Medium.ttf'];
  
  if (!robotoRegular || !robotoMedium) {
    throw new Error('Roboto fonts not found in pdfMake');
  }
  
  // Add normal and bold variants
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  
  doc.addFileToVFS('Roboto-Medium.ttf', robotoMedium);
  doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');
  
  doc.setFont('Roboto', 'normal');
};

export default addRobotoFont;