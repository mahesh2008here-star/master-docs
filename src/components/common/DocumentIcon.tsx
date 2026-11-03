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
import { AnimatedIcon } from './AnimatedIcon';

interface DocumentIconProps {
  typeKey: DocumentType;
  className?: string;
  animate?: boolean;
}

export const DocumentIcon: React.FC<DocumentIconProps> = ({ 
  typeKey, 
  className = "w-5 h-5",
  animate = true
}) => {
  const getIconAndGlow = () => {
    switch (typeKey) {
      case 'pdf':
        return { icon: BookOpen, glow: '#E65C56' };
      case 'word':
        return { icon: FileText, glow: '#3478D4' };
      case 'excel':
        return { icon: FileSpreadsheet, glow: '#249B65' };
      case 'powerpoint':
        return { icon: Presentation, glow: '#D88B32' };
      case 'markdown':
      case 'text':
        return { icon: FileCode, glow: '#8A65C9' };
      default:
        return { icon: File, glow: '#605C48' };
    }
  };

  const { icon, glow } = getIconAndGlow();

  if (!animate) {
    const IconComponent = icon;
    return <IconComponent className={className} />;
  }

  return (
    <AnimatedIcon 
      icon={icon} 
      className={className} 
      animateOnHover 
      glowColor={glow}
    />
  );
};
