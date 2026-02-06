// Utility to add Russian language support to jsPDF using Roboto font from pdfMake
import { jsPDF } from 'jspdf';

// Import pdfMake fonts
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Initialize pdfMake fonts
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

// Add Roboto font to jsPDF
export const addRobotoFont = (doc: jsPDF) => {
  // Get Roboto-Regular font from pdfMake VFS
  const robotoRegular = pdfFonts.pdfMake.vfs['Roboto-Regular.ttf'];
  
  // Add font to jsPDF
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto');
};

export default addRobotoFont;
