// Utility to add Russian language support to jsPDF using Roboto font from pdfMake
import { jsPDF } from 'jspdf';

let fontsCache: any = null;

// Add Roboto font to jsPDF
export const addRobotoFont = async (doc: jsPDF) => {
  // Lazy load pdfMake fonts only when needed
  if (!fontsCache) {
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    
    console.log('pdfFontsModule keys:', Object.keys(pdfFontsModule));
    console.log('pdfFontsModule.default:', pdfFontsModule.default);
    console.log('pdfFontsModule.pdfMake:', (pdfFontsModule as any).pdfMake);
    
    // Try all possible paths
    fontsCache = 
      pdfFontsModule.default?.pdfMake?.vfs || 
      (pdfFontsModule as any).pdfMake?.vfs ||
      (pdfFontsModule as any).vfs ||
      pdfFontsModule.default;
    
    console.log('fontsCache:', fontsCache ? 'loaded' : 'null');
    console.log('fontsCache keys:', fontsCache ? Object.keys(fontsCache).slice(0, 5) : 'none');
    
    if (!fontsCache) {
      throw new Error('Failed to load pdfMake fonts');
    }
  }

  const robotoRegular = fontsCache['Roboto-Regular.ttf'];
  
  console.log('robotoRegular:', robotoRegular ? `loaded (${robotoRegular.length} chars)` : 'not found');
  
  if (!robotoRegular) {
    throw new Error('Roboto-Regular.ttf not found in pdfMake fonts');
  }
  
  // Add font to jsPDF
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto');
};

export default addRobotoFont;