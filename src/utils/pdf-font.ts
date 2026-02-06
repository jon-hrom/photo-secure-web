// Utility to add Russian language support to jsPDF using Roboto font from pdfMake
import { jsPDF } from 'jspdf';

let fontsCache: any = null;

// Add Roboto font to jsPDF
export const addRobotoFont = async (doc: jsPDF) => {
  // Lazy load pdfMake fonts only when needed
  if (!fontsCache) {
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    // Handle both default export and named export
    fontsCache = pdfFontsModule.default?.pdfMake?.vfs || pdfFontsModule.pdfMake?.vfs;
    
    if (!fontsCache) {
      throw new Error('Failed to load pdfMake fonts');
    }
  }

  const robotoRegular = fontsCache['Roboto-Regular.ttf'];
  
  if (!robotoRegular) {
    throw new Error('Roboto-Regular.ttf not found in pdfMake fonts');
  }
  
  // Add font to jsPDF
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto');
};

export default addRobotoFont;