import React from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  FileCode, 
  File, 
  BookOpen 
} from 'lucide-react';
import { DocumentType } from '../../types/document';

interface DocumentIconProps {
  typeKey: DocumentType;
  className?: string;
}

export const DocumentIcon: React.FC<DocumentIconProps> = ({ typeKey, className = "w-5 h-5" }) => {
  switch (typeKey) {
    case 'pdf':
      return <BookOpen className={className} />;
    case 'word':
      return <FileText className={className} />;
    case 'excel':
      return <FileSpreadsheet className={className} />;
    case 'powerpoint':
      return <Presentation className={className} />;
    case 'markdown':
    case 'text':
      return <FileCode className={className} />;
    default:
      return <File className={className} />;
  }
};
