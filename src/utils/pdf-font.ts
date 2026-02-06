// Utility to add Russian language support to jsPDF using Roboto font from pdfMake
import { jsPDF } from 'jspdf';

let fontsInitialized = false;

// Add Roboto font to jsPDF
export const addRobotoFont = async (doc: jsPDF) => {
  // Lazy load pdfMake fonts only when needed
  if (!fontsInitialized) {
    const pdfMake = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake.default as any).vfs = pdfFonts.default.pdfMake.vfs;
    fontsInitialized = true;
  }

  // Dynamic import to access initialized VFS
  const pdfFonts = await import('pdfmake/build/vfs_fonts');
  const robotoRegular = pdfFonts.default.pdfMake.vfs['Roboto-Regular.ttf'];
  
  // Add font to jsPDF
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto');
};

export default addRobotoFont;